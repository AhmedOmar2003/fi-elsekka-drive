import { NextResponse } from "next/server";

import {
  createRideAuthedClient,
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";
import { resolveAdminNotificationRecipientIds } from "@/lib/admin-notification-targets";
import { sendPushToUserDevices } from "@/lib/user-push-server";

type Params = { params: Promise<{ offerId: string }> };

function isDirectAdminOffer(input: {
  offeredByAdminId?: unknown;
  offerMetadata?: Record<string, unknown> | null;
  tripMetadata?: Record<string, unknown> | null;
}) {
  const modeFromOffer = input.offerMetadata?.dispatch_mode;
  const modeFromTrip = input.tripMetadata?.latest_dispatch_mode;
  if (typeof modeFromOffer === "string" && modeFromOffer === "admin_direct_offer") {
    return true;
  }
  if (typeof modeFromTrip === "string" && modeFromTrip === "admin_direct_offer") {
    return true;
  }
  return Boolean(input.offeredByAdminId);
}

async function notifyAdminsAboutDriverDecision(options: {
  serviceClient: NonNullable<ReturnType<typeof createRideServiceClient>>;
  tripId: string;
  tripPickupLabel: string | null;
  tripDestinationLabel: string | null;
  driverId: string;
  driverName: string;
  action: "accept" | "reject";
  etaMinutes?: number | null;
}) {
  const {
    serviceClient,
    tripId,
    tripPickupLabel,
    tripDestinationLabel,
    driverId,
    driverName,
    action,
    etaMinutes,
  } = options;
  const recipientIds = await resolveAdminNotificationRecipientIds(serviceClient as any);
  if (recipientIds.length === 0) return;

  const title = action === "accept" ? "الكابتن وافق على الرحلة" : "الكابتن رفض الرحلة";
  const body =
    action === "accept"
      ? `${driverName} وافق على الرحلة من ${String(tripPickupLabel || "نقطة التحرك")} إلى ${String(tripDestinationLabel || "الوجهة")}${etaMinutes ? ` (ETA: ${etaMinutes} دقيقة)` : ""}.`
      : `${driverName} رفض الرحلة من ${String(tripPickupLabel || "نقطة التحرك")} إلى ${String(tripDestinationLabel || "الوجهة")}.`;

  await serviceClient.from("notifications").insert(
    recipientIds.map((adminId) => ({
      recipient_user_id: adminId,
      type: "admin_message",
      title,
      body,
      payload: {
        action: action === "accept" ? "driver_accepted_offer" : "driver_rejected_offer",
        trip_id: tripId,
        driver_id: driverId,
        driver_name: driverName,
        eta_minutes: etaMinutes ?? null,
      },
      related_trip_id: tripId,
    }))
  );

  await Promise.all(
    recipientIds.map((adminId) =>
      sendPushToUserDevices(serviceClient, adminId, {
        title,
        message: body,
        link: `/admin/trips/${tripId}`,
        requireInteraction: true,
        topic: action === "accept" ? "admin-driver-accepted" : "admin-driver-rejected",
        eventType: action === "accept" ? "trip_accepted" : "driver_cancelled",
        soundProfile: action === "accept" ? "medium" : "warning",
      }).catch(() => null)
    )
  );
}

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
    const activeTripStatuses = new Set([
      "accepted",
      "driver_on_the_way",
      "driver_arrived",
      "trip_started",
      "waiting_for_return",
    ]);
    const etaMinutes =
      action === "accept"
        ? Math.min(180, Math.max(1, Number(body.etaMinutes || 15)))
        : null;

    const { data: offer, error: offerError } = await serviceClient
      .from("trip_offers")
      .select("id, trip_id, driver_id, expires_at, offer_status, offered_by_admin_id, metadata")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) throw offerError;
    if (!offer || String(offer.driver_id) !== auth.profile.user.id) {
      return NextResponse.json({ error: "العرض ده مش تابع للكابتن الحالي." }, { status: 404 });
    }

    const { data: trip, error: tripError } = await serviceClient
      .from("trips")
      .select(
        "id, customer_id, pickup_label, destination_label, metadata, status, assigned_driver_id"
      )
      .eq("id", offer.trip_id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return NextResponse.json({ error: "المشوار المرتبط بالعرض مش موجود." }, { status: 404 });
    }
    if (trip.status === "cancelled") {
      return NextResponse.json({ error: "المشوار ده اتلغى خلاص." }, { status: 409 });
    }
    if (action === "accept") {
      const assignedDriverId = String(trip.assigned_driver_id || "");
      const currentStatus = String(trip.status || "");
      if (
        assignedDriverId === auth.profile.user.id &&
        activeTripStatuses.has(currentStatus)
      ) {
        return NextResponse.json({
          success: true,
          offerId,
          tripId: trip.id,
          alreadyAnswered: true,
          tripStatus: currentStatus,
        });
      }
      if (
        assignedDriverId &&
        assignedDriverId !== auth.profile.user.id &&
        activeTripStatuses.has(currentStatus)
      ) {
        return NextResponse.json(
          { error: "تم إسناد الرحلة بالفعل إلى كابتن آخر." },
          { status: 409 }
        );
      }
    }
    if (
      offer.offer_status === "offered" &&
      offer.expires_at &&
      new Date(offer.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json({ error: "مهلة مراجعة العرض خلصت." }, { status: 409 });
    }

    const runRespondRpc = () =>
      authedClient.rpc("driver_respond_to_trip_offer", {
        p_offer_id: offerId,
        p_accept: action === "accept",
        p_rejection_reason: action === "reject" ? body.rejectionReason || null : null,
      });

    let { data, error } = await runRespondRpc();

    if (error) {
      const normalizedError = String(error.message || "").toLowerCase();
      const isDirectOffer = isDirectAdminOffer({
        offeredByAdminId: offer.offered_by_admin_id,
        offerMetadata:
          offer.metadata && typeof offer.metadata === "object"
            ? (offer.metadata as Record<string, unknown>)
            : null,
        tripMetadata:
          trip.metadata && typeof trip.metadata === "object"
            ? (trip.metadata as Record<string, unknown>)
            : null,
      });

      const canRetryOperationally =
        action === "accept" &&
        isDirectOffer &&
        (normalizedError.includes("not operationally available") ||
          normalizedError.includes("not accepting offers"));

      if (canRetryOperationally) {
        const nowIso = new Date().toISOString();
        const [{ data: driverProfile }, { data: activeTrip }] = await Promise.all([
          serviceClient
            .from("driver_profiles")
            .select("id, availability_status, is_accepting_offers")
            .eq("id", auth.profile.user.id)
            .maybeSingle(),
          serviceClient
            .from("trips")
            .select("id")
            .eq("assigned_driver_id", auth.profile.user.id)
            .in("status", Array.from(activeTripStatuses))
            .limit(1)
            .maybeSingle(),
        ]);

        if (activeTrip?.id || String(driverProfile?.availability_status || "") === "busy") {
          return NextResponse.json(
            { error: "الكابتن مشغول حاليًا ومش يقدر يقبل الرحلة." },
            { status: 409 }
          );
        }

        await serviceClient
          .from("driver_profiles")
          .update({
            availability_status: "available",
            is_accepting_offers: true,
            last_seen_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", auth.profile.user.id);

        const retried = await runRespondRpc();
        data = retried.data;
        error = retried.error;
      }

      if (error) {
        const normalizedRetryError = String(error.message || "").toLowerCase();
        if (normalizedRetryError.includes("not operationally available")) {
          return NextResponse.json(
            { error: "لا يمكن قبول الرحلة الآن لأن الكابتن غير متاح تشغيليًا." },
            { status: 409 }
          );
        }
        if (normalizedRetryError.includes("not accepting offers")) {
          return NextResponse.json(
            { error: "الكابتن موقوف من استقبال العروض الآن." },
            { status: 409 }
          );
        }
      }

      const finalNormalizedError = String(error?.message || normalizedError).toLowerCase();
      if (finalNormalizedError.includes("already answered")) {
        const { data: refreshedTrip, error: refreshedTripError } = await serviceClient
          .from("trips")
          .select("id, status, assigned_driver_id")
          .eq("id", offer.trip_id)
          .maybeSingle();
        if (refreshedTripError) throw refreshedTripError;
        const assignedDriverId = String(refreshedTrip?.assigned_driver_id || "");
        const currentStatus = String(refreshedTrip?.status || "");
        if (
          action === "accept" &&
          assignedDriverId === auth.profile.user.id &&
          activeTripStatuses.has(currentStatus)
        ) {
          return NextResponse.json({
            success: true,
            offerId,
            tripId: refreshedTrip?.id ?? offer.trip_id,
            alreadyAnswered: true,
            tripStatus: currentStatus,
          });
        }
        return NextResponse.json(
          { error: "تم الرد على العرض بالفعل أو تم إسناد الرحلة لكابتن آخر." },
          { status: 409 }
        );
      }
      if (error) {
        throw error;
      }
    }

    const isDirectOffer = isDirectAdminOffer({
      offeredByAdminId: offer.offered_by_admin_id,
      offerMetadata:
        offer.metadata && typeof offer.metadata === "object"
          ? (offer.metadata as Record<string, unknown>)
          : null,
      tripMetadata:
        trip.metadata && typeof trip.metadata === "object"
          ? (trip.metadata as Record<string, unknown>)
          : null,
    });

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
        eventType: "trip_accepted",
        soundProfile: "medium",
      });

      if (isDirectOffer) {
        try {
          await notifyAdminsAboutDriverDecision({
            serviceClient,
            tripId: trip.id,
            tripPickupLabel: trip.pickup_label as string | null,
            tripDestinationLabel: trip.destination_label as string | null,
            driverId: auth.profile.user.id,
            driverName: auth.profile.fullName || "الكابتن",
            action: "accept",
            etaMinutes,
          });
        } catch (notifyError) {
          console.error("Failed to notify admins after direct offer acceptance", notifyError);
        }
      }
    } else if (isDirectOffer) {
      try {
        await notifyAdminsAboutDriverDecision({
          serviceClient,
          tripId: trip.id,
          tripPickupLabel: trip.pickup_label as string | null,
          tripDestinationLabel: trip.destination_label as string | null,
          driverId: auth.profile.user.id,
          driverName: auth.profile.fullName || "الكابتن",
          action: "reject",
        });
      } catch (notifyError) {
        console.error("Failed to notify admins after direct offer rejection", notifyError);
      }
    }

    return NextResponse.json({ success: true, offerId: data, tripId: trip.id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحديث رد الكابتن على العرض." },
      { status: 500 }
    );
  }
}
