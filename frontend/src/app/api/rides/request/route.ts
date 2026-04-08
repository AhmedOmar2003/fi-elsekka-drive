import { NextResponse } from "next/server";

import {
  createRideAuthedClient,
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";

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
      "create_trip_request",
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
        estimated_price: null,
        search_started_at: now,
        status: "pending",
        metadata: {
          route_distance_km: estimate.distanceKm,
          route_duration_minutes: estimate.durationMinutes,
          suggested_price_min: estimate.minPrice,
          suggested_price_max: estimate.maxPrice,
          map_estimated_price: estimatedPrice,
          preferred_vehicle_type: preferredVehicleType,
          pickup_city: estimate.pickup.city,
          destination_city: estimate.destination.city,
          pickup_area: estimate.pickup.area,
          destination_area: estimate.destination.area,
          airport_departure_time: tripType === "airport_ride" ? body.departureTime || null : null,
          airport_departure_label: tripType === "airport_ride" ? body.departureTimeLabel || null : null,
          dispatch_mode: "admin_dispatch_only",
          awaiting_admin_dispatch: true,
        },
      })
      .eq("id", tripId);

    if (tripMetaError) throw tripMetaError;

    await serviceClient.from("trip_status_history").insert({
      trip_id: tripId,
      status: "pending",
      changed_by: auth.profile.user.id,
      note: "العميل أرسل الطلب والخط السير اتحدد. الطلب دلوقتي في انتظار تسعير وإسناد الإدارة.",
      metadata: {
        distance_km: estimate.distanceKm,
        duration_minutes: estimate.durationMinutes,
        preferred_vehicle_type: preferredVehicleType,
      },
    });

    const { data: admins, error: adminsError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("account_status", "active");

    if (adminsError) throw adminsError;

    const adminNotifications = (admins || []).map((admin) => ({
      recipient_user_id: admin.id,
      type: "admin_message",
      title: "طلب مشوار جديد جاهز للتوزيع",
      body: `مشوار من ${estimate.pickup.label} إلى ${estimate.destination.label}. حدّد السعر النهائي وأسنده للكباتن.`,
      payload: {
        trip_id: tripId,
        pickup_label: estimate.pickup.label,
        destination_label: estimate.destination.label,
        trip_type: tripType,
        preferred_vehicle_type: preferredVehicleType,
        suggested_price: estimatedPrice,
      },
      related_trip_id: tripId,
    }));

    if (adminNotifications.length > 0) {
      const { error: adminsNotifyError } = await serviceClient
        .from("notifications")
        .insert(adminNotifications);
      if (adminsNotifyError) throw adminsNotifyError;
    }

    await serviceClient.from("notifications").insert({
      recipient_user_id: auth.profile.user.id,
      type: "trip_created",
      title: "استلمنا طلب مشوارك",
      body: "تم تحديد المسافة والمدة، والطلب الآن عند الإدارة لتسعيره وإسناده لكابتن مناسب.",
      payload: {
        trip_id: tripId,
        estimated_price: estimatedPrice,
        route_distance_km: estimate.distanceKm,
        route_duration_minutes: estimate.durationMinutes,
      },
      related_trip_id: tripId,
    });

    return NextResponse.json({
      success: true,
      tripId,
      status: "pending",
      offeredDriverCount: 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر إرسال طلب المشوار." },
      { status: 500 }
    );
  }
}

