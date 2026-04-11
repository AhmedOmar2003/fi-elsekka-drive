import { NextResponse } from "next/server";

import {
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";
import { resolveAdminNotificationRecipientIds } from "@/lib/admin-notification-targets";
import { sendPushToUserDevices } from "@/lib/user-push-server";

const DEFAULT_WAITING_PRICE_PER_MINUTE = Number(process.env.WAITING_PRICE_PER_MINUTE || 2);
const DEFAULT_WAITING_FREE_MINUTES = Number(process.env.WAITING_FREE_MINUTES || 5);

function normalizeVehicleType(value: unknown) {
  return value === "car" || value === "tuk_tuk" || value === "mini_bus" ? value : "car";
}

function normalizeRequestSource(value: unknown): "manual" | "map" {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (
    raw === "manual" ||
    raw === "manual_request" ||
    raw === "manual_text" ||
    raw === "typed" ||
    raw === "text" ||
    raw === "name"
  ) {
    return "manual";
  }

  return "map";
}

type CreateTripRecordInput = {
  customerId: string;
  tripType: "normal_ride" | "airport_ride";
  estimate: any;
  tripBody: any;
  luggageCount: number;
  passengerCount: number;
  isRoundTrip: boolean;
  waitingDurationMinutes: number | null;
  waitingEnabled: boolean;
};

async function createTripRecord(
  serviceClient: NonNullable<ReturnType<typeof createRideServiceClient>>,
  input: CreateTripRecordInput
) {
  const {
    customerId,
    tripType,
    estimate,
    tripBody,
    luggageCount,
    passengerCount,
    isRoundTrip,
    waitingDurationMinutes,
    waitingEnabled,
  } = input;

  const returnDestinationLabel = isRoundTrip
    ? tripBody.returnDestinationLabel || estimate.pickup.label || null
    : null;
  const returnDestinationAddress = isRoundTrip
    ? tripBody.returnDestinationAddress || estimate.pickup.address || null
    : null;
  const returnDestinationLatitude = isRoundTrip
    ? Number(tripBody.returnDestinationLatitude ?? estimate.pickup.latitude)
    : null;
  const returnDestinationLongitude = isRoundTrip
    ? Number(tripBody.returnDestinationLongitude ?? estimate.pickup.longitude)
    : null;

  const { data, error } = await serviceClient
    .from("trips")
    .insert({
      customer_id: customerId,
      trip_type: tripType,
      status: "pending",
      pickup_label: estimate.pickup.label,
      pickup_address: estimate.pickup.address,
      pickup_latitude: estimate.pickup.latitude,
      pickup_longitude: estimate.pickup.longitude,
      destination_label: estimate.destination.label,
      destination_address: estimate.destination.address,
      destination_latitude: estimate.destination.latitude,
      destination_longitude: estimate.destination.longitude,
      airport_name: tripType === "airport_ride" ? tripBody.airportName || estimate.destination.label || null : null,
      airport_terminal: tripType === "airport_ride" ? tripBody.airportTerminal || null : null,
      airport_ride_mode: tripType === "airport_ride" ? tripBody.airportRideMode || null : null,
      flight_number: tripType === "airport_ride" ? tripBody.flightNumber || null : null,
      flight_time: tripType === "airport_ride" && tripBody.flightTime ? tripBody.flightTime : null,
      luggage_count: luggageCount,
      passenger_count: passengerCount,
      rider_notes: tripBody.notes || null,
      is_round_trip: isRoundTrip,
      waiting_duration_minutes: isRoundTrip ? waitingDurationMinutes : null,
      return_status: isRoundTrip ? "outbound" : "not_applicable",
      return_pickup_label: isRoundTrip ? estimate.destination.label : null,
      return_pickup_address: isRoundTrip ? estimate.destination.address : null,
      return_pickup_latitude: isRoundTrip ? estimate.destination.latitude : null,
      return_pickup_longitude: isRoundTrip ? estimate.destination.longitude : null,
      return_destination_label: returnDestinationLabel,
      return_destination_address: returnDestinationAddress,
      return_destination_latitude: returnDestinationLatitude,
      return_destination_longitude: returnDestinationLongitude,
      metadata: isRoundTrip
        ? {
            round_trip: true,
            return_status: "outbound",
            waiting_duration_minutes: waitingDurationMinutes ?? 0,
            waiting_enabled: waitingEnabled,
            waiting_price_per_minute: DEFAULT_WAITING_PRICE_PER_MINUTE,
            waiting_free_minutes: DEFAULT_WAITING_FREE_MINUTES,
            waiting_active: false,
            waiting_start_time: null,
            waiting_total_seconds: 0,
            waiting_chargeable_seconds: 0,
            waiting_cost: 0,
            final_price: null,
          }
        : {
            waiting_enabled: waitingEnabled,
            waiting_price_per_minute: DEFAULT_WAITING_PRICE_PER_MINUTE,
            waiting_free_minutes: DEFAULT_WAITING_FREE_MINUTES,
            waiting_active: false,
            waiting_start_time: null,
            waiting_total_seconds: 0,
            waiting_chargeable_seconds: 0,
            waiting_cost: 0,
            final_price: null,
          },
    })
    .select("id")
    .single();

  return { tripId: data?.id as string | undefined, error };
}

export async function POST(request: Request) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  if (auth.profile.disabled) {
    return NextResponse.json(
      { error: "الحساب الحالي موقوف مؤقتًا." },
      { status: 403 }
    );
  }

  const serviceClient = createRideServiceClient();

  if (!serviceClient) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const tripType = body.tripType === "airport_ride" ? "airport_ride" : "normal_ride";
    const passengerCount = Math.max(1, Number(body.passengerCount || 1));
    const luggageCount = Math.max(0, Number(body.luggageCount || 0));
    const isRoundTrip = body.isRoundTrip === true;
    const waitingDurationMinutes = isRoundTrip
      ? Math.min(720, Math.max(0, Number(body.waitingDurationMinutes || 0)))
      : null;
    const waitingEnabled = body.waitingEnabled === true;
    const requestSource = normalizeRequestSource(
      body.requestSource ?? body.requestMethod ?? body.request_method ?? body.source
    );
    const preferredVehicleType =
      tripType === "airport_ride" ? "car" : normalizeVehicleType(body.preferredVehicleType);
    const estimate = body.estimate;

    if (!estimate?.pickup || !estimate?.destination) {
      return NextResponse.json(
        { error: "لازم تحسب المشوار الأول قبل الإرسال." },
        { status: 400 }
      );
    }

    if (tripType === "airport_ride" && (!body.flightTime || !body.departureTime)) {
      return NextResponse.json(
        { error: "في مشوار المطار لازم تحدد موعد التحرك وموعد إقلاع الطائرة." },
        { status: 400 }
      );
    }

    const { tripId, error: tripError } = await createTripRecord(serviceClient, {
      customerId: auth.profile.user.id,
      tripType,
      estimate,
      tripBody: body,
      luggageCount,
      passengerCount,
      isRoundTrip,
      waitingDurationMinutes,
      waitingEnabled,
    });

    if (tripError || !tripId) {
      throw tripError || new Error("تعذر إنشاء المشوار.");
    }

    const now = new Date().toISOString();
    const estimatedPrice = Number(estimate.suggestedPrice || estimate.minPrice || 0);

    const { error: tripMetaError } = await serviceClient
      .from("trips")
      .update({
        estimated_price: null,
        search_started_at: null,
        status: "pending",
        metadata: {
          route_distance_km: estimate.distanceKm,
          route_duration_minutes: estimate.durationMinutes,
          route_points: Array.isArray(estimate.routePoints) ? estimate.routePoints : [],
          suggested_price_min: estimate.minPrice,
          suggested_price_max: estimate.maxPrice,
          map_estimated_price: estimatedPrice > 0 ? estimatedPrice : null,
          admin_selected_price: null,
          preferred_vehicle_type: preferredVehicleType,
          pickup_city: estimate.pickup.city,
          destination_city: estimate.destination.city,
          pickup_area: estimate.pickup.area,
          destination_area: estimate.destination.area,
          airport_departure_time: tripType === "airport_ride" ? body.departureTime || null : null,
          airport_departure_label: tripType === "airport_ride" ? body.departureTimeLabel || null : null,
          is_round_trip: isRoundTrip,
          waiting_duration_minutes: waitingDurationMinutes,
          waiting_enabled: waitingEnabled,
          waiting_price_per_minute: DEFAULT_WAITING_PRICE_PER_MINUTE,
          waiting_free_minutes: DEFAULT_WAITING_FREE_MINUTES,
          waiting_active: false,
          waiting_start_time: null,
          waiting_total_seconds: 0,
          waiting_chargeable_seconds: 0,
          waiting_cost: 0,
          final_price: null,
          request_source: requestSource,
          return_status: isRoundTrip ? 'outbound' : 'not_applicable',
          dispatch_mode: "awaiting_admin_pricing",
          awaiting_admin_pricing: true,
          awaiting_admin_dispatch: false,
          customer_price_confirmed: false,
          customer_price_confirmed_at: null,
        },
      })
      .eq("id", tripId);

    if (tripMetaError) throw tripMetaError;

    await serviceClient.from("trip_status_history").insert({
      trip_id: tripId,
      status: "pending",
      changed_by: auth.profile.user.id,
      note: "العميل أرسل الطلب، والرحلة الآن في انتظار تسعير الإدارة.",
      metadata: {
        distance_km: estimate.distanceKm,
        duration_minutes: estimate.durationMinutes,
        preferred_vehicle_type: preferredVehicleType,
        request_source: requestSource,
        dispatch_mode: "awaiting_admin_pricing",
        map_estimated_price: estimatedPrice > 0 ? estimatedPrice : null,
        is_round_trip: isRoundTrip,
        waiting_duration_minutes: waitingDurationMinutes,
        waiting_enabled: waitingEnabled,
        waiting_price_per_minute: DEFAULT_WAITING_PRICE_PER_MINUTE,
        waiting_free_minutes: DEFAULT_WAITING_FREE_MINUTES,
        },
    });

    await serviceClient.from("notifications").insert({
      recipient_user_id: auth.profile.user.id,
      type: "trip_created",
      title: "استلمنا طلب مشوارك",
      body: "تم استلام طلبك، والإدارة ستحدد السعر النهائي قبل تعيين الكابتن.",
      payload: {
        trip_id: tripId,
        estimated_price: null,
        route_distance_km: estimate.distanceKm,
        route_duration_minutes: estimate.durationMinutes,
        is_round_trip: isRoundTrip,
      },
      related_trip_id: tripId,
    });

    const adminRecipientIds = await resolveAdminNotificationRecipientIds(serviceClient);

    const adminNotifications = adminRecipientIds.map((adminId) => ({
      recipient_user_id: adminId,
      type: "admin_message",
      title: "طلب مشوار جديد يحتاج تسعير",
      body: `طلب جديد من ${estimate.pickup.label} إلى ${estimate.destination.label} في انتظار تحديد السعر من الإدارة.`,
      payload: {
        trip_id: tripId,
        action: "price_trip_request",
        map_estimated_price: estimatedPrice > 0 ? estimatedPrice : null,
      },
      related_trip_id: tripId,
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
        console.error("[rides/request] failed to insert admin notifications", {
          tripId,
          failures: failedNotifications.map((result) => String(result.reason)),
        });
      }
      const successfulNotifications = insertedNotifications
        .filter((result): result is PromiseFulfilledResult<(typeof adminNotifications)[number]> => result.status === "fulfilled")
        .map((result) => result.value);
      void Promise.all(
        successfulNotifications.map((notification) =>
          sendPushToUserDevices(serviceClient, notification.recipient_user_id, {
            title: "طلب مشوار جديد يحتاج تسعير",
            message: "يوجد طلب جديد في انتظار تحديد السعر النهائي من الإدارة.",
            link: `/admin/trips/${tripId}`,
            topic: "admin-price-trip-request",
          })
        )
      ).catch((pushError) => {
        console.error("[rides/request] failed to send admin push notifications", {
          tripId,
          error: String(pushError),
        });
      });
    }

    return NextResponse.json({
      success: true,
      tripId,
      status: "pending",
      offeredDriverCount: 0,
      fallbackToAdmin: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر إرسال طلب المشوار." },
      { status: 500 }
    );
  }
}

