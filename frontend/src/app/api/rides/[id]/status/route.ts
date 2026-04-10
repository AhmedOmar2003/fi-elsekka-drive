import { NextResponse } from "next/server";

import {
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";
import { resolveAdminNotificationRecipientIds } from "@/lib/admin-notification-targets";
import { sendPushToUserDevices } from "@/lib/user-push-server";

type Params = { params: Promise<{ id: string }> };

const ROUTE_VERSION = "trip-status-v3-2026-04-09";
const ALREADY_DONE_STATUSES = new Set(["driver_arrived", "trip_started", "waiting_for_return", "completed"]);
const NON_CANCELLABLE_CUSTOMER_STATUSES = new Set(["trip_started", "completed"]);
const CONFIRM_PRICE_ALIASES = new Set([
  "customer_confirm_price",
  "confirmed",
  "confirm",
  "confirm_price",
  "approve",
  "approve_price",
  "approve_quote",
  "customer_approved_quote",
  "price_confirmed",
]);
const CANCEL_TRIP_ALIASES = new Set([
  "customer_cancel_trip",
  "cancelled",
  "cancel",
  "cancel_trip",
  "trip_cancelled",
  "customer_cancel",
]);

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
    const requestedAction = String(body.action || body.status || body.intent || "").trim().toLowerCase();
    const action = CONFIRM_PRICE_ALIASES.has(requestedAction)
      ? "customer_confirm_price"
      : CANCEL_TRIP_ALIASES.has(requestedAction)
        ? "customer_cancel_trip"
        : requestedAction;
    const now = new Date().toISOString();

    const { data: trip, error: tripError } = await serviceClient
      .from("trips")
      .select("id, customer_id, assigned_driver_id, trip_type, pickup_label, destination_label, estimated_price, status, is_round_trip, waiting_duration_minutes, return_status, return_destination_label, return_destination_address, return_destination_latitude, return_destination_longitude, metadata")
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
        return NextResponse.json({ success: true, status: trip.status, routeVersion: ROUTE_VERSION });
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

      return NextResponse.json({ success: true, status: "driver_arrived", routeVersion: ROUTE_VERSION });
    }

    const metadata = ((trip.metadata as Record<string, unknown> | null) || {});
    const adminSelectedPrice = metadata["admin_selected_price"];
    const hasQuotedPrice =
      Number(
        typeof adminSelectedPrice === "number" || typeof adminSelectedPrice === "string"
          ? adminSelectedPrice
          : 0
      ) > 0;

    if (action === "customer_confirm_price") {
      if (!isCustomer && auth.profile.role !== "admin") {
        return NextResponse.json({ error: "العميل أو الإدارة فقط يقدروا يؤكدوا السعر." }, { status: 403 });
      }

      if (!hasQuotedPrice) {
        return NextResponse.json({ error: "لسه مفيش سعر نهائي من الإدارة لتأكيده." }, { status: 409 });
      }

      if (["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return", "completed"].includes(String(trip.status))) {
        return NextResponse.json({ success: true, status: trip.status, routeVersion: ROUTE_VERSION });
      }

      const nextStatus = "searching_driver";
      const nextMetadata = {
        ...metadata,
        awaiting_admin_pricing: false,
        awaiting_admin_dispatch: true,
        customer_price_confirmed: true,
        customer_price_confirmed_at: now,
        dispatch_mode: "admin_assignment_pending",
      };

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: nextStatus,
          updated_at: now,
          metadata: nextMetadata,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: nextStatus,
        changed_by: auth.profile.user.id,
        note: "العميل وافق على السعر النهائي، والرحلة الآن في انتظار تعيين كابتن من الإدارة.",
        metadata: {
          admin_selected_price: metadata["admin_selected_price"] ?? null,
          dispatch_mode: "admin_assignment_pending",
        },
      });
      if (historyError) throw historyError;

      const adminRecipientIds = await resolveAdminNotificationRecipientIds(serviceClient);

      const adminNotifications = adminRecipientIds.map((adminId) => ({
        recipient_user_id: adminId,
        type: "admin_message",
        title: "العميل أكد السعر",
        body: "العميل وافق على السعر النهائي. عيّن كابتن مناسب للرحلة الآن.",
        payload: {
          trip_id: trip.id,
          action: "assign_driver_after_price_confirmation",
          admin_selected_price: metadata["admin_selected_price"] ?? null,
        },
        related_trip_id: trip.id,
      }));

      if (adminNotifications.length > 0) {
        const insertedNotifications = await Promise.allSettled(
          adminNotifications.map(async (notification) => {
            const { error } = await serviceClient.from("notifications").insert(notification);
            if (error) throw error;
            return notification;
          })
        );
        const failedNotifications = insertedNotifications.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        if (failedNotifications.length > 0) {
          console.error("[rides/status] failed to insert admin notifications after customer_confirm_price", {
            tripId: trip.id,
            failures: failedNotifications.map((result) => String(result.reason)),
          });
        }
        const successfulNotifications = insertedNotifications
          .filter((result): result is PromiseFulfilledResult<(typeof adminNotifications)[number]> => result.status === "fulfilled")
          .map((result) => result.value);

        await Promise.all(
          successfulNotifications.map((notification) =>
            sendPushToUserDevices(serviceClient, notification.recipient_user_id, {
              title: "العميل أكد السعر",
              message: "العميل وافق على السعر النهائي. عيّن كابتن مناسب الآن.",
              link: `/admin/trips/${trip.id}`,
              topic: "admin-customer-price-confirmed",
            })
          )
        );
      }

      await serviceClient.from("notifications").insert({
        recipient_user_id: trip.customer_id,
        type: "trip_offered",
        title: "تم تأكيد السعر",
        body: "تم تأكيد السعر النهائي، والإدارة تراجع الآن تعيين كابتن مناسب لرحلتك.",
        payload: { trip_id: trip.id },
        related_trip_id: trip.id,
      });

      return NextResponse.json({
        success: true,
        status: nextStatus,
        offeredDriverCount: 0,
        fallbackToAdmin: false,
        routeVersion: ROUTE_VERSION,
      });
    }

    if (action === "customer_cancel_trip") {
      if (!isCustomer && auth.profile.role !== "admin") {
        return NextResponse.json({ error: "العميل أو الإدارة فقط يقدروا يلغوا المشوار." }, { status: 403 });
      }

      if (NON_CANCELLABLE_CUSTOMER_STATUSES.has(String(trip.status))) {
        return NextResponse.json({ error: "المشوار بدأ بالفعل ولا يمكن إلغاؤه من التطبيق." }, { status: 409 });
      }

      const { error: cancelError } = await serviceClient.rpc('cancel_trip_request', {
        p_trip_id: trip.id,
        p_reason: 'تم الإلغاء بواسطة العميل من التطبيق.'
      });

      if (cancelError) throw cancelError;

      return NextResponse.json({ success: true, status: "cancelled", routeVersion: ROUTE_VERSION });
    }

    if (action === "customer_report_driver_delay") {
      if (!isCustomer) {
        return NextResponse.json({ error: "العميل فقط يقدر يبلغ بتأخير الكابتن." }, { status: 403 });
      }

      if (String(trip.status) !== "driver_on_the_way") {
        return NextResponse.json({ error: "الحالة الحالية لا تسمح بتسجيل تأخير الكابتن." }, { status: 409 });
      }

      const adminRecipientIds = await resolveAdminNotificationRecipientIds(serviceClient);

      const adminNotifications = adminRecipientIds.map((adminId) => ({
        recipient_user_id: adminId,
        type: "admin_message",
        title: "العميل بلّغ إن الكابتن متأخر",
        body: "الوقت المتوقع انتهى والعميل أكد إن الكابتن لسه ما وصلش. راجع الرحلة وكلم الكابتن فورًا.",
        payload: { trip_id: trip.id, action: "driver_delay_reported" },
        related_trip_id: trip.id,
      }));

      if (adminNotifications.length > 0) {
        const insertedNotifications = await Promise.allSettled(
          adminNotifications.map((notification) => serviceClient.from("notifications").insert(notification))
        );
        const failedNotifications = insertedNotifications.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        if (failedNotifications.length > 0) {
          console.error("[rides/status] failed to insert admin notifications after report_driver_delay", {
            tripId: trip.id,
            failures: failedNotifications.map((result) => String(result.reason)),
          });
        }
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

      return NextResponse.json({
        success: true,
        status: trip.status,
        notifiedAdmins: adminNotifications.length,
        routeVersion: ROUTE_VERSION,
      });
    }

    if (action === "driver_start_trip") {
      if (!isDriver) {
        return NextResponse.json({ error: "الكابتن فقط يقدر يبدأ المشوار." }, { status: 403 });
      }

      if (String(trip.status) === "trip_started" || String(trip.status) === "completed") {
        return NextResponse.json({ success: true, status: trip.status, routeVersion: ROUTE_VERSION });
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

      return NextResponse.json({ success: true, status: "trip_started", routeVersion: ROUTE_VERSION });
    }

    if (action === "customer_start_return") {
      if (!isCustomer && auth.profile.role !== "admin") {
        return NextResponse.json({ error: "العميل أو الإدارة فقط يقدروا يبدأوا الرجوع." }, { status: 403 });
      }

      if (trip.is_round_trip !== true) {
        return NextResponse.json({ error: "المشوار الحالي ليس ذهاب وعودة." }, { status: 409 });
      }

      if (String(trip.status) === "trip_started" && trip.return_status === "return_in_progress") {
        return NextResponse.json({ success: true, status: "trip_started", routeVersion: ROUTE_VERSION });
      }

      if (String(trip.status) !== "waiting_for_return" || String(trip.return_status) !== "waiting_for_return") {
        return NextResponse.json({ error: "الرحلة ليست في مرحلة انتظار الرجوع." }, { status: 409 });
      }

      const nextMetadata = {
        ...metadata,
        return_status: "return_in_progress",
        return_started_at: now,
      };

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "trip_started",
          return_status: "return_in_progress",
          return_started_at: now,
          updated_at: now,
          metadata: nextMetadata,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "trip_started",
        changed_by: auth.profile.user.id,
        note: "العميل أكد بدء رحلة الرجوع مع نفس الكابتن.",
        metadata: {
          round_trip: true,
          return_status: "return_in_progress",
        },
      });
      if (historyError) throw historyError;

      if (trip.assigned_driver_id) {
        await serviceClient.from("notifications").insert({
          recipient_user_id: trip.assigned_driver_id,
          type: "trip_started",
          title: "العميل جاهز للرجوع",
          body: "رحلة الرجوع بدأت الآن. تحرك بالعميل إلى نقطة الرجوع المتفق عليها.",
          payload: { trip_id: trip.id, return_status: "return_in_progress" },
          related_trip_id: trip.id,
        });
      }

      return NextResponse.json({ success: true, status: "trip_started", routeVersion: ROUTE_VERSION });
    }

    if (action === "customer_cancel_return") {
      if (!isCustomer && auth.profile.role !== "admin") {
        return NextResponse.json({ error: "العميل أو الإدارة فقط يقدروا يلغوا الرجوع." }, { status: 403 });
      }

      if (trip.is_round_trip !== true) {
        return NextResponse.json({ error: "المشوار الحالي ليس ذهاب وعودة." }, { status: 409 });
      }

      if (String(trip.status) === "completed" && String(trip.return_status) === "return_cancelled") {
        return NextResponse.json({ success: true, status: "completed", routeVersion: ROUTE_VERSION });
      }

      if (String(trip.status) !== "waiting_for_return") {
        return NextResponse.json({ error: "لا يمكن إلغاء الرجوع إلا أثناء الانتظار في الوجهة." }, { status: 409 });
      }

      const nextMetadata = {
        ...metadata,
        return_status: "return_cancelled",
        return_cancelled_at: now,
      };

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "completed",
          completed_at: now,
          return_status: "return_cancelled",
          return_cancelled_at: now,
          updated_at: now,
          metadata: nextMetadata,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      if (trip.assigned_driver_id) {
        await serviceClient
          .from("driver_profiles")
          .update({
            availability_status: "available",
            last_seen_at: now,
          })
          .eq("id", trip.assigned_driver_id);
      }

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "completed",
        changed_by: auth.profile.user.id,
        note: "العميل ألغى رحلة الرجوع، وتم إغلاق المشوار بالكامل.",
        metadata: {
          round_trip: true,
          return_status: "return_cancelled",
        },
      });
      if (historyError) throw historyError;

      return NextResponse.json({ success: true, status: "completed", routeVersion: ROUTE_VERSION });
    }

    if (action === "driver_complete_trip") {
      if (!isDriver) {
        return NextResponse.json({ error: "الكابتن فقط يقدر ينهي المشوار." }, { status: 403 });
      }

      if (String(trip.status) === "completed") {
        return NextResponse.json({ success: true, status: "completed", routeVersion: ROUTE_VERSION });
      }
      if (!["trip_started", "driver_arrived"].includes(String(trip.status))) {
        return NextResponse.json({ error: "لازم المشوار يكون بدأ أو الكابتن وصل الأول." }, { status: 409 });
      }

      const isRoundTrip = trip.is_round_trip === true;
      const returnStatus = String(trip.return_status || "not_applicable");

      if (isRoundTrip && returnStatus == "outbound") {
        const nextMetadata = {
          ...metadata,
          return_status: "waiting_for_return",
          waiting_for_return_at: now,
        };

        const { error: updateError } = await serviceClient
          .from("trips")
          .update({
            status: "waiting_for_return",
            waiting_for_return_at: now,
            return_status: "waiting_for_return",
            updated_at: now,
            metadata: nextMetadata,
          })
          .eq("id", trip.id);
        if (updateError) throw updateError;

        const { error: historyError } = await serviceClient.from("trip_status_history").insert({
          trip_id: trip.id,
          status: "waiting_for_return",
          changed_by: auth.profile.user.id,
          note: "وصلتم لوجهة الذهاب. الرحلة الآن في انتظار تأكيد الرجوع من العميل.",
          metadata: {
            round_trip: true,
            return_status: "waiting_for_return",
            waiting_duration_minutes: trip.waiting_duration_minutes ?? null,
          },
        });
        if (historyError) throw historyError;

        await serviceClient.from("notifications").insert({
          recipient_user_id: trip.customer_id,
          type: "driver_arrived",
          title: "وصلتم لوجهة الذهاب",
          body: "دي رحلة ذهاب وعودة. لما تبقى جاهز، اضغط ابدأ الرجوع. ولو لسه، خليك على وضع الانتظار.",
          payload: {
            trip_id: trip.id,
            round_trip: true,
            return_status: "waiting_for_return",
          },
          related_trip_id: trip.id,
        });

        return NextResponse.json({ success: true, status: "waiting_for_return", routeVersion: ROUTE_VERSION });
      }

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "completed",
          completed_at: now,
          return_status: isRoundTrip ? "return_completed" : trip.return_status,
          updated_at: now,
          metadata: {
            ...metadata,
            return_status: isRoundTrip ? "return_completed" : metadata["return_status"],
          },
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      if (trip.assigned_driver_id) {
        await serviceClient
          .from("driver_profiles")
          .update({
            availability_status: "available",
            last_seen_at: now,
          })
          .eq("id", trip.assigned_driver_id);
      }

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "completed",
        changed_by: auth.profile.user.id,
        note: isRoundTrip
          ? "الكابتن أنهى رحلة الرجوع واكتملت الرحلة بالكامل."
          : "الكابتن أنهى المشوار ووصل للوجهة.",
        metadata: isRoundTrip
          ? { round_trip: true, return_status: "return_completed" }
          : {},
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

      return NextResponse.json({ success: true, status: "completed", routeVersion: ROUTE_VERSION });
    }

    if (isCustomer && hasQuotedPrice && ["pending", "searching_driver", "offered"].includes(String(trip.status))) {
      const nextStatus = "searching_driver";
      const nextMetadata = {
        ...metadata,
        awaiting_admin_pricing: false,
        awaiting_admin_dispatch: true,
        customer_price_confirmed: true,
        customer_price_confirmed_at: now,
        dispatch_mode: "admin_assignment_pending",
      };

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: nextStatus,
          updated_at: now,
          metadata: nextMetadata,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: nextStatus,
        changed_by: auth.profile.user.id,
        note: `تم تأكيد السعر من العميل عبر مسار متوافق (${requestedAction || "unknown_action"}).`,
        metadata: {
          admin_selected_price: metadata["admin_selected_price"] ?? null,
          requested_action: requestedAction || null,
          dispatch_mode: "admin_assignment_pending",
        },
      });
      if (historyError) throw historyError;

      const adminRecipientIds = await resolveAdminNotificationRecipientIds(serviceClient);

      const adminNotifications = adminRecipientIds.map((adminId) => ({
        recipient_user_id: adminId,
        type: "admin_message",
        title: "العميل أكد السعر",
        body: "العميل وافق على السعر النهائي. عيّن كابتن مناسب للرحلة الآن.",
        payload: {
          trip_id: trip.id,
          action: "assign_driver_after_price_confirmation",
          admin_selected_price: metadata["admin_selected_price"] ?? null,
        },
        related_trip_id: trip.id,
      }));

      if (adminNotifications.length > 0) {
        const insertedNotifications = await Promise.allSettled(
          adminNotifications.map(async (notification) => {
            const { error } = await serviceClient.from("notifications").insert(notification);
            if (error) throw error;
            return notification;
          })
        );
        const failedNotifications = insertedNotifications.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        if (failedNotifications.length > 0) {
          console.error("[rides/status] failed to insert admin notifications after customer_confirm_price_status", {
            tripId: trip.id,
            failures: failedNotifications.map((result) => String(result.reason)),
          });
        }
        const successfulNotifications = insertedNotifications
          .filter((result): result is PromiseFulfilledResult<(typeof adminNotifications)[number]> => result.status === "fulfilled")
          .map((result) => result.value);

        await Promise.all(
          successfulNotifications.map((notification) =>
            sendPushToUserDevices(serviceClient, notification.recipient_user_id, {
              title: "العميل أكد السعر",
              message: "العميل وافق على السعر النهائي. عيّن كابتن مناسب الآن.",
              link: `/admin/trips/${trip.id}`,
              topic: "admin-customer-price-confirmed",
            })
          )
        );
      }

      return NextResponse.json({
        success: true,
        status: nextStatus,
        offeredDriverCount: 0,
        fallbackToAdmin: false,
        normalizedAction: "customer_confirm_price",
        routeVersion: ROUTE_VERSION,
      });
    }

    return NextResponse.json(
      { error: "العملية المطلوبة غير مدعومة.", action: requestedAction || null, routeVersion: ROUTE_VERSION },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحديث حالة المشوار.", routeVersion: ROUTE_VERSION },
      { status: 500 }
    );
  }
}
