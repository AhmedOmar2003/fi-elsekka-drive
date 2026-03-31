import { NextResponse } from "next/server";

import {
  createRideAuthedClient,
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";
import { sendPushToUserDevices } from "@/lib/user-push-server";

type Params = { params: Promise<{ offerId: string }> };

export async function POST(request: Request, context: Params) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  if (auth.profile.role !== "driver") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authedClient = createRideAuthedClient(auth.token);
  const serviceClient = createRideServiceClient();

  if (!authedClient || !serviceClient) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  try {
    const { offerId } = await context.params;
    const body = await request.json();
    const action = body.action === "reject" ? "reject" : "accept";
    const etaMinutes =
      action === "accept"
        ? Math.min(180, Math.max(1, Number(body.etaMinutes || 15)))
        : null;

    const { data: offer, error: offerError } = await serviceClient
      .from("trip_offers")
      .select("id, trip_id, driver_id")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) throw offerError;
    if (!offer || String(offer.driver_id) !== auth.profile.user.id) {
      return NextResponse.json({ error: "العرض ده مش تابع للكابتن الحالي." }, { status: 404 });
    }

    const { data: trip, error: tripError } = await serviceClient
      .from("trips")
      .select("id, customer_id, pickup_label, destination_label, metadata")
      .eq("id", offer.trip_id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return NextResponse.json({ error: "المشوار المرتبط بالعرض مش موجود." }, { status: 404 });
    }

    const { data, error } = await authedClient.rpc("driver_respond_to_trip_offer", {
      p_offer_id: offerId,
      p_accept: action === "accept",
      p_rejection_reason: action === "reject" ? body.rejectionReason || null : null,
    });

    if (error) throw error;

    if (action === "accept") {
      const now = new Date().toISOString();
      const metadata = ((trip.metadata as Record<string, unknown> | null) || {});

      const { error: tripUpdateError } = await serviceClient
        .from("trips")
        .update({
          status: "driver_on_the_way",
          driver_on_the_way_at: now,
          updated_at: now,
          metadata: {
            ...metadata,
            captain_eta_minutes: etaMinutes,
            captain_eta_label: `حوالي ${etaMinutes} دقيقة`,
            captain_last_response_at: now,
          },
        })
        .eq("id", trip.id);
      if (tripUpdateError) throw tripUpdateError;

      const { error: driverUpdateError } = await serviceClient
        .from("driver_profiles")
        .update({
          availability_status: "busy",
          is_accepting_offers: false,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", auth.profile.user.id);
      if (driverUpdateError) throw driverUpdateError;

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "driver_on_the_way",
        changed_by: auth.profile.user.id,
        note: `الكابتن أكد إنه هيوصل خلال ${etaMinutes} دقيقة.`,
        metadata: {
          captain_eta_minutes: etaMinutes,
          captain_eta_label: `حوالي ${etaMinutes} دقيقة`,
        },
      });
      if (historyError) throw historyError;

      const { error: notificationError } = await serviceClient.from("notifications").insert({
        recipient_user_id: trip.customer_id,
        type: "driver_eta_update",
        title: "الكابتن قبل المشوار",
        body: `الكابتن في الطريق وهيوصلك خلال حوالي ${etaMinutes} دقيقة.`,
        payload: {
          trip_id: trip.id,
          captain_eta_minutes: etaMinutes,
          captain_eta_label: `حوالي ${etaMinutes} دقيقة`,
        },
        related_trip_id: trip.id,
      });
      if (notificationError) throw notificationError;

      await sendPushToUserDevices(serviceClient, trip.customer_id, {
        title: "الكابتن قبل المشوار",
        message: `الكابتن في الطريق وهيوصلك خلال حوالي ${etaMinutes} دقيقة.`,
        link: "/trip/live",
        requireInteraction: true,
        topic: "driver-eta-update",
      });
    }

    return NextResponse.json({ success: true, offerId: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحديث رد الكابتن على العرض." },
      { status: 500 }
    );
  }
}
