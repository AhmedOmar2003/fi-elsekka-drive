import { NextResponse } from "next/server";

import {
  createRideAuthedClient,
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";
import { dispatchTripToMarketplace } from "@/lib/ride-dispatch-server";

function normalizeVehicleType(value: unknown) {
  return value === "car" || value === "tuk_tuk" || value === "mini_bus" ? value : "car";
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

  const authedClient = createRideAuthedClient(auth.token);
  const serviceClient = createRideServiceClient();

  if (!authedClient || !serviceClient) {
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

    const { data: tripId, error: tripError } = await authedClient.rpc(
      "create_trip_request_v2",
      {
        p_trip_type: tripType,
        p_pickup_label: estimate.pickup.label,
        p_pickup_address: estimate.pickup.address,
        p_destination_label: estimate.destination.label,
        p_destination_address: estimate.destination.address,
        p_pickup_latitude: estimate.pickup.latitude,
        p_pickup_longitude: estimate.pickup.longitude,
        p_destination_latitude: estimate.destination.latitude,
        p_destination_longitude: estimate.destination.longitude,
        p_airport_name: tripType === "airport_ride" ? body.airportName || estimate.destination.label || null : null,
        p_airport_terminal: tripType === "airport_ride" ? body.airportTerminal || null : null,
        p_airport_ride_mode: tripType === "airport_ride" ? body.airportRideMode || null : null,
        p_flight_number: tripType === "airport_ride" ? body.flightNumber || null : null,
        p_flight_time: tripType === "airport_ride" && body.flightTime ? body.flightTime : null,
        p_luggage_count: luggageCount,
        p_passenger_count: passengerCount,
        p_rider_notes: body.notes || null,
        p_is_round_trip: isRoundTrip,
        p_waiting_duration_minutes: waitingDurationMinutes,
        p_return_destination_label: isRoundTrip ? body.returnDestinationLabel || null : null,
        p_return_destination_address: isRoundTrip ? body.returnDestinationAddress || null : null,
        p_return_destination_latitude: isRoundTrip ? Number(body.returnDestinationLatitude ?? NaN) || null : null,
        p_return_destination_longitude: isRoundTrip ? Number(body.returnDestinationLongitude ?? NaN) || null : null,
      }
    );

    if (tripError || !tripId) {
      throw tripError || new Error("تعذر إنشاء المشوار.");
    }

    const now = new Date().toISOString();
    const estimatedPrice = Number(estimate.suggestedPrice || estimate.minPrice || 0);

    const { error: tripMetaError } = await serviceClient
      .from("trips")
      .update({
        estimated_price: estimatedPrice > 0 ? estimatedPrice : null,
        search_started_at: now,
        status: "searching_driver",
        metadata: {
          route_distance_km: estimate.distanceKm,
          route_duration_minutes: estimate.durationMinutes,
          route_points: Array.isArray(estimate.routePoints) ? estimate.routePoints : [],
          suggested_price_min: estimate.minPrice,
          suggested_price_max: estimate.maxPrice,
          map_estimated_price: estimatedPrice,
          admin_selected_price: estimatedPrice > 0 ? estimatedPrice : null,
          preferred_vehicle_type: preferredVehicleType,
          pickup_city: estimate.pickup.city,
          destination_city: estimate.destination.city,
          pickup_area: estimate.pickup.area,
          destination_area: estimate.destination.area,
          airport_departure_time: tripType === "airport_ride" ? body.departureTime || null : null,
          airport_departure_label: tripType === "airport_ride" ? body.departureTimeLabel || null : null,
          is_round_trip: isRoundTrip,
          waiting_duration_minutes: waitingDurationMinutes,
          return_status: isRoundTrip ? 'outbound' : 'not_applicable',
          dispatch_mode: "instant_marketplace",
          awaiting_admin_dispatch: false,
          customer_price_confirmed: true,
          customer_price_confirmed_at: now,
        },
      })
      .eq("id", tripId);

    if (tripMetaError) throw tripMetaError;

    await serviceClient.from("trip_status_history").insert({
      trip_id: tripId,
      status: "searching_driver",
      changed_by: auth.profile.user.id,
      note: "العميل أرسل الطلب، وتم تسعيره تلقائيًا وتجهيزه للتوزيع الفوري على الكباتن.",
      metadata: {
        distance_km: estimate.distanceKm,
        duration_minutes: estimate.durationMinutes,
        preferred_vehicle_type: preferredVehicleType,
        dispatch_mode: "instant_marketplace",
        auto_priced_price: estimatedPrice > 0 ? estimatedPrice : null,
        is_round_trip: isRoundTrip,
        waiting_duration_minutes: waitingDurationMinutes,
      },
    });

    await serviceClient.from("notifications").insert({
      recipient_user_id: auth.profile.user.id,
      type: "trip_created",
      title: "استلمنا طلب مشوارك",
      body: "تم تحديد المسافة والسعر التلقائي، وبدأنا فورًا نبحث لك عن أقرب كابتن مناسب.",
      payload: {
        trip_id: tripId,
        estimated_price: estimatedPrice,
        route_distance_km: estimate.distanceKm,
        route_duration_minutes: estimate.durationMinutes,
        is_round_trip: isRoundTrip,
      },
      related_trip_id: tripId,
    });

    const dispatchResult = await dispatchTripToMarketplace(serviceClient, {
      tripId,
      triggeredByUserId: auth.profile.user.id,
      explicitPrice: estimatedPrice > 0 ? estimatedPrice : null,
      source: "trip_request",
    });

    return NextResponse.json({
      success: true,
      tripId,
      status: dispatchResult.status,
      offeredDriverCount: dispatchResult.offeredDriverCount,
      fallbackToAdmin: dispatchResult.fallbackToAdmin,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر إرسال طلب المشوار." },
      { status: 500 }
    );
  }
}

