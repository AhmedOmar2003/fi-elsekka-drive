import { NextResponse } from "next/server";

import {
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";

type Params = { params: Promise<{ id: string }> };

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
    const rating = Math.max(1, Math.min(5, Number(body.rating || 0)));
    const comment = String(body.comment || "").trim();

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "اختار تقييم من 1 إلى 5 نجوم." }, { status: 400 });
    }

    const { data: trip, error: tripError } = await serviceClient
      .from("trips")
      .select("id, customer_id, assigned_driver_id, status")
      .eq("id", id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return NextResponse.json({ error: "المشوار مش موجود." }, { status: 404 });
    }

    if (String(trip.customer_id) !== auth.profile.user.id) {
      return NextResponse.json({ error: "العميل صاحب المشوار فقط يقدر يقيّم." }, { status: 403 });
    }
    if (!trip.assigned_driver_id) {
      return NextResponse.json({ error: "المشوار لسه ما اتسندش لكابتن." }, { status: 409 });
    }
    if (String(trip.status) !== "completed") {
      return NextResponse.json({ error: "ينفع التقييم بعد اكتمال المشوار فقط." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const reviewPayload = {
      trip_id: trip.id,
      customer_id: trip.customer_id,
      driver_id: trip.assigned_driver_id,
      rating,
      comment: comment || null,
      updated_at: now,
    };

    const { error: upsertError } = await serviceClient
      .from("trip_reviews")
      .upsert(reviewPayload, { onConflict: "trip_id" });
    if (upsertError) throw upsertError;

    await serviceClient.from("notifications").insert({
      recipient_user_id: trip.assigned_driver_id,
      type: "admin_message",
      title: "تقييم جديد من عميل",
      body: comment
        ? `العميل قيّمك ${rating} نجوم وكتب: ${comment}`
        : `العميل قيّمك ${rating} نجوم على المشوار.`,
      payload: { trip_id: trip.id, rating, comment: comment || null },
      related_trip_id: trip.id,
    });

    const { data: admins } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("account_status", "active");

    if (admins?.length) {
      await serviceClient.from("notifications").insert(
        admins.map((admin) => ({
          recipient_user_id: admin.id,
          type: "admin_message",
          title: "تقييم جديد على مشوار",
          body: `العميل قيّم الكابتن ${rating} نجوم${comment ? ` وكتب: ${comment}` : ""}.`,
          payload: { trip_id: trip.id, rating, comment: comment || null, driver_id: trip.assigned_driver_id },
          related_trip_id: trip.id,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      review: {
        rating,
        comment: comment || null,
        created_at: now,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر حفظ التقييم." },
      { status: 500 }
    );
  }
}
