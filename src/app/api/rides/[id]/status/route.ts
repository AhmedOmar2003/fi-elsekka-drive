import { NextResponse } from "next/server";

import {
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";
import { sendPushToUserDevices } from "@/lib/user-push-server";

type Params = { params: Promise<{ id: string }> };

const ALREADY_DONE_STATUSES = new Set(["driver_arrived", "trip_started", "completed"]);

export async function POST(request: Request, context: Params) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  const serviceClient = createRideServiceClient();
  if (!serviceClient) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const action = String(body.action || "").trim();
    const now = new Date().toISOString();

    const { data: trip, error: tripError } = await serviceClient
      .from("trips")
      .select("id, customer_id, assigned_driver_id, status, metadata")
      .eq("id", id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return NextResponse.json({ error: "المشوار مش موجود." }, { status: 404 });
    }

    const isCustomer = String(trip.customer_id) === auth.profile.user.id;
    const isDriver = String(trip.assigned_driver_id || "") === auth.profile.user.id;

    if (!isCustomer && !isDriver && auth.profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "customer_confirm_arrived" || action === "driver_mark_arrived") {
      if (action === "customer_confirm_arrived" && !isCustomer) {
        return NextResponse.json({ error: "العميل فقط يقدر يؤكد الوصول." }, { status: 403 });
      }
      if (action === "driver_mark_arrived" && !isDriver) {
        return NextResponse.json({ error: "الكابتن فقط يقدر يعلن الوصول." }, { status: 403 });
      }

      if (ALREADY_DONE_STATUSES.has(String(trip.status))) {
        return NextResponse.json({ success: true, status: trip.status });
      }

      if (!["accepted", "driver_on_the_way", "offered"].includes(String(trip.status))) {
        return NextResponse.json({ error: "الحالة الحالية لا تسمح بتأكيد الوصول." }, { status: 409 });
      }

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "driver_arrived",
          driver_arrived_at: now,
          updated_at: now,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const note =
        action === "customer_confirm_arrived"
          ? "العميل أكد إن الكابتن وصل لنقطة التحرك."
          : "الكابتن أعلن إنه وصل لنقطة التحرك.";

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "driver_arrived",
        changed_by: auth.profile.user.id,
        note,
      });
      if (historyError) throw historyError;

      if (action === "customer_confirm_arrived" && trip.assigned_driver_id) {
        await serviceClient.from("notifications").insert({
          recipient_user_id: trip.assigned_driver_id,
          type: "driver_arrived",
          title: "العميل أكد وصولك",
          body: "العميل أكد إنك وصلت لنقطة التحرك. ابدأ المشوار لما تكونوا جاهزين.",
          payload: { trip_id: trip.id },
          related_trip_id: trip.id,
        });
      }

      return NextResponse.json({ success: true, status: "driver_arrived" });
    }

    if (action === "customer_report_driver_delay") {
      if (!isCustomer) {
        return NextResponse.json({ error: "العميل فقط يقدر يبلغ بتأخير الكابتن." }, { status: 403 });
      }

      if (String(trip.status) !== "driver_on_the_way") {
        return NextResponse.json({ error: "الحالة الحالية لا تسمح بتسجيل تأخير الكابتن." }, { status: 409 });
      }

      const { data: admins } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("account_status", "active")
        .limit(100);

      const adminNotifications = (admins || []).map((admin) => ({
        recipient_user_id: admin.id,
        type: "admin_message",
        title: "العميل بلّغ إن الكابتن متأخر",
        body: "الوقت المتوقع انتهى والعميل أكد إن الكابتن لسه ما وصلش. راجع الرحلة وكلم الكابتن فورًا.",
        payload: { trip_id: trip.id, action: "driver_delay_reported" },
        related_trip_id: trip.id,
      }));

      if (adminNotifications.length > 0) {
        const { error: notificationError } = await serviceClient
          .from("notifications")
          .insert(adminNotifications);
        if (notificationError) throw notificationError;
      }

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: String(trip.status),
        changed_by: auth.profile.user.id,
        note: "العميل بلّغ إن الكابتن متأخر عن زمن الوصول المتوقع.",
      });
      if (historyError) throw historyError;

      if (trip.assigned_driver_id) {
        await serviceClient.from("notifications").insert({
          recipient_user_id: trip.assigned_driver_id,
          type: "admin_message",
          title: "العميل منتظرك الآن",
          body: "الوقت المتوقع انتهى والعميل بلّغ إنك لسه ما وصلتش. حدّث حالة الرحلة أو تواصل فورًا.",
          payload: { trip_id: trip.id, action: "driver_delay_reported" },
          related_trip_id: trip.id,
        });
      }

      return NextResponse.json({ success: true, status: trip.status, notifiedAdmins: adminNotifications.length });
    }

    if (action === "driver_start_trip") {
      if (!isDriver) {
        return NextResponse.json({ error: "الكابتن فقط يقدر يبدأ المشوار." }, { status: 403 });
      }

      if (String(trip.status) === "trip_started" || String(trip.status) === "completed") {
        return NextResponse.json({ success: true, status: trip.status });
      }
      if (String(trip.status) !== "driver_arrived") {
        return NextResponse.json({ error: "لازم الكابتن يكون وصل الأول." }, { status: 409 });
      }

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "trip_started",
          trip_started_at: now,
          updated_at: now,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "trip_started",
        changed_by: auth.profile.user.id,
        note: "الكابتن بدأ المشوار.",
      });
      if (historyError) throw historyError;

      await serviceClient.from("notifications").insert({
        recipient_user_id: trip.customer_id,
        type: "trip_started",
        title: "المشوار بدأ",
        body: "الكابتن بدأ المشوار. ربنا يوصلك بالسلامة.",
        payload: { trip_id: trip.id },
        related_trip_id: trip.id,
      });

      await sendPushToUserDevices(serviceClient, trip.customer_id, {
        title: "المشوار بدأ",
        message: "الكابتن بدأ المشوار. تقدر تتابع الحالة من التطبيق.",
        link: "/trip/live",
        topic: "trip-started",
      });

      return NextResponse.json({ success: true, status: "trip_started" });
    }

    if (action === "driver_complete_trip") {
      if (!isDriver) {
        return NextResponse.json({ error: "الكابتن فقط يقدر ينهي المشوار." }, { status: 403 });
      }

      if (String(trip.status) === "completed") {
        return NextResponse.json({ success: true, status: "completed" });
      }
      if (!["trip_started", "driver_arrived"].includes(String(trip.status))) {
        return NextResponse.json({ error: "لازم المشوار يكون بدأ أو الكابتن وصل الأول." }, { status: 409 });
      }

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      if (trip.assigned_driver_id) {
        await serviceClient
          .from("driver_profiles")
          .update({
            availability_status: "online",
            is_accepting_offers: true,
            last_seen_at: now,
          })
          .eq("id", trip.assigned_driver_id);
      }

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "completed",
        changed_by: auth.profile.user.id,
        note: "الكابتن أنهى المشوار ووصل للوجهة.",
      });
      if (historyError) throw historyError;

      await serviceClient.from("notifications").insert({
        recipient_user_id: trip.customer_id,
        type: "trip_completed",
        title: "المشوار اكتمل",
        body: "وصلت لوجهتك؟ قيّم الكابتن بنجوم وتعليق علشان تساعدنا نحسن الخدمة.",
        payload: { trip_id: trip.id, request_review: true },
        related_trip_id: trip.id,
      });

      await sendPushToUserDevices(serviceClient, trip.customer_id, {
        title: "المشوار اكتمل",
        message: "لو وصلت بالسلامة، قيّم الكابتن من التطبيق.",
        link: "/trip/live",
        requireInteraction: true,
        topic: "trip-completed",
      });

      return NextResponse.json({ success: true, status: "completed" });
    }

    return NextResponse.json({ error: "العملية المطلوبة غير مدعومة." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحديث حالة المشوار." },
      { status: 500 }
    );
  }
}
