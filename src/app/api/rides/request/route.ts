import { NextResponse } from "next/server";

import {
  createRideAuthedClient,
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";
import { sendPushToUserDevices } from "@/lib/user-push-server";

function normalizeVehicleType(value: unknown) {
  return value === "car" || value === "tuk_tuk" ? value : "any";
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

    const tripType =
      body.tripType === "airport_ride" ? "airport_ride" : "normal_ride";
    const passengerCount = Math.max(1, Number(body.passengerCount || 1));
    const luggageCount = Math.max(0, Number(body.luggageCount || 0));
    const preferredVehicleType = normalizeVehicleType(body.preferredVehicleType);
    const estimate = body.estimate;

    if (!estimate?.pickup || !estimate?.destination) {
      return NextResponse.json(
        { error: "لازم تحسب المشوار الأول قبل الإرسال." },
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
        p_airport_name: tripType === "airport_ride" ? body.airportName || null : null,
        p_airport_terminal:
          tripType === "airport_ride" ? body.airportTerminal || null : null,
        p_airport_ride_mode:
          tripType === "airport_ride" ? body.airportRideMode || null : null,
        p_flight_number:
          tripType === "airport_ride" ? body.flightNumber || null : null,
        p_flight_time:
          tripType === "airport_ride" && body.flightTime
            ? body.flightTime
            : null,
        p_luggage_count: luggageCount,
        p_passenger_count: passengerCount,
        p_rider_notes: body.notes || null,
      }
    );

    if (tripError || !tripId) {
      throw tripError || new Error("تعذر إنشاء المشوار.");
    }

    const now = new Date().toISOString();
    const pickupCity = estimate.pickup.city || estimate.destination.city || null;

    const { error: tripMetaError } = await serviceClient
      .from("trips")
      .update({
        estimated_price: Number(estimate.suggestedPrice || 0),
        search_started_at: now,
        status: "searching_driver",
        metadata: {
          route_distance_km: estimate.distanceKm,
          route_duration_minutes: estimate.durationMinutes,
          suggested_price_min: estimate.minPrice,
          suggested_price_max: estimate.maxPrice,
          preferred_vehicle_type: preferredVehicleType,
          pickup_city: estimate.pickup.city,
          destination_city: estimate.destination.city,
          pickup_area: estimate.pickup.area,
          destination_area: estimate.destination.area,
        },
      })
      .eq("id", tripId);

    if (tripMetaError) throw tripMetaError;

    await serviceClient.from("trip_status_history").insert({
      trip_id: tripId,
      status: "searching_driver",
      changed_by: auth.profile.user.id,
      note: "العميل أنشأ المشوار وبدأ البحث عن كابتن.",
      metadata: {
        distance_km: estimate.distanceKm,
        duration_minutes: estimate.durationMinutes,
      },
    });

    const { data: candidateDrivers, error: driversError } = await serviceClient
      .from("driver_profiles")
      .select(
        "id, working_city, working_area, availability_status, is_accepting_offers, application_status, verification_status"
      )
      .eq("availability_status", "online")
      .eq("is_accepting_offers", true)
      .eq("application_status", "approved")
      .eq("verification_status", "approved");

    if (driversError) throw driversError;

    const driverIds = (candidateDrivers || []).map((driver) => driver.id);

    const [{ data: profiles }, { data: vehicles }] = await Promise.all([
      driverIds.length
        ? serviceClient
            .from("profiles")
            .select("id, account_status, full_name")
            .in("id", driverIds)
        : Promise.resolve({ data: [] as any[] }),
      driverIds.length
        ? serviceClient
            .from("vehicles")
            .select(
              "id, driver_id, vehicle_type, approval_status, is_primary, is_active, brand, model"
            )
            .in("driver_id", driverIds)
            .eq("approval_status", "approved")
            .eq("is_primary", true)
            .eq("is_active", true)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const activeProfiles = new Map(
      (profiles || [])
        .filter((profile) => profile.account_status === "active")
        .map((profile) => [profile.id, profile])
    );

    const primaryVehicleByDriver = new Map(
      (vehicles || []).map((vehicle) => [vehicle.driver_id, vehicle])
    );

    const rankedDrivers = (candidateDrivers || [])
      .filter((driver) => activeProfiles.has(driver.id))
      .map((driver) => ({
        ...driver,
        vehicle: primaryVehicleByDriver.get(driver.id) || null,
        score:
          (pickupCity &&
          driver.working_city &&
          driver.working_city.toLowerCase().includes(String(pickupCity).toLowerCase())
            ? 2
            : 0) +
          (driver.working_area &&
          estimate.pickup.area &&
          driver.working_area.toLowerCase().includes(String(estimate.pickup.area).toLowerCase())
            ? 1
            : 0),
      }))
      .filter((driver) => {
        if (!driver.vehicle) return false;
        if (preferredVehicleType === "any") return true;
        return driver.vehicle.vehicle_type === preferredVehicleType;
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);

    if (rankedDrivers.length > 0) {
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      const offersPayload = rankedDrivers.map((driver) => ({
        trip_id: tripId,
        driver_id: driver.id,
        vehicle_id: driver.vehicle?.id || null,
        offer_status: "offered",
        offered_at: now,
        expires_at: expiresAt,
        metadata: {
          preferred_vehicle_type: preferredVehicleType,
          routed_by: "customer_auto_dispatch",
        },
      }));

      const notificationsPayload = rankedDrivers.map((driver) => ({
        recipient_user_id: driver.id,
        type: "trip_offered",
        title: "فيه مشوار جديد قريب منك",
        body: `مشوار من ${estimate.pickup.label} إلى ${estimate.destination.label}. راجعه بسرعة قبل ما يروح لغيرك.`,
        payload: {
          trip_id: tripId,
          pickup_label: estimate.pickup.label,
          destination_label: estimate.destination.label,
          estimated_price: estimate.suggestedPrice,
        },
        related_trip_id: tripId,
      }));

      const [{ error: offersError }, { error: notificationsError }] =
        await Promise.all([
          serviceClient.from("trip_offers").insert(offersPayload),
          serviceClient.from("notifications").insert(notificationsPayload),
        ]);

      if (offersError) throw offersError;
      if (notificationsError) throw notificationsError;

      await Promise.all(
        rankedDrivers.map((driver) =>
          sendPushToUserDevices(serviceClient, driver.id, {
            title: "وصلك طلب مشوار جديد",
            message: `مشوار من ${estimate.pickup.label} إلى ${estimate.destination.label}. افتح التطبيق ورد بسرعة.`,
            link: "/captain/offers",
            requireInteraction: true,
            topic: "ride-offer",
          })
        )
      );

      await serviceClient
        .from("trips")
        .update({
          status: "offered",
          offered_at: now,
          offered_driver_count: rankedDrivers.length,
        })
        .eq("id", tripId);

      await serviceClient.from("trip_status_history").insert({
        trip_id: tripId,
        status: "offered",
        changed_by: auth.profile.user.id,
        note: "تم إرسال المشوار للكباتن المتاحين.",
        metadata: {
          offered_driver_count: rankedDrivers.length,
        },
      });
    }

    await serviceClient.from("notifications").insert({
      recipient_user_id: auth.profile.user.id,
      type: "trip_created",
      title: "استلمنا طلب مشوارك",
      body:
        rankedDrivers.length > 0
          ? "بنبعت الطلب دلوقتي للكباتن المتاحين، وأول ما حد يقبل هتوصلك الحالة."
          : "استلمنا الطلب ولسه بندور على كابتن مناسب قريب منك.",
      payload: {
        trip_id: tripId,
        offered_driver_count: rankedDrivers.length,
      },
      related_trip_id: tripId,
    });

    return NextResponse.json({
      success: true,
      tripId,
      status: rankedDrivers.length > 0 ? "offered" : "searching_driver",
      offeredDriverCount: rankedDrivers.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر إرسال طلب المشوار." },
      { status: 500 }
    );
  }
}
