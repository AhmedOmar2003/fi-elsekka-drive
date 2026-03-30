import { NextResponse } from "next/server";

import {
  createRideAuthedClient,
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";

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
    const tripType = body.tripType === "airport_ride" ? "airport_ride" : "normal_ride";
    const preferredVehicleType = normalizeVehicleType(body.preferredVehicleType);
    const pickupText = String(body.pickupText || "").trim();
    const destinationText = String(body.destinationText || "").trim();
    const passengerCount = Math.max(1, Number(body.passengerCount || 1));
    const luggageCount = Math.max(0, Number(body.luggageCount || 0));

    if (!pickupText || !destinationText) {
      return NextResponse.json(
        { error: "اكتب نقطة التحرك والوجهة الأول." },
        { status: 400 }
      );
    }

    const { data: tripId, error: tripError } = await authedClient.rpc(
      "create_trip_request",
      {
        p_trip_type: tripType,
        p_pickup_label: pickupText,
        p_pickup_address: pickupText,
        p_destination_label: destinationText,
        p_destination_address: destinationText,
        p_pickup_latitude: null,
        p_pickup_longitude: null,
        p_destination_latitude: null,
        p_destination_longitude: null,
        p_airport_name: tripType === "airport_ride" ? body.airportName || null : null,
        p_airport_terminal: tripType === "airport_ride" ? body.airportTerminal || null : null,
        p_airport_ride_mode: tripType === "airport_ride" ? body.airportRideMode || null : null,
        p_flight_number: tripType === "airport_ride" ? body.flightNumber || null : null,
        p_flight_time:
          tripType === "airport_ride" && body.flightTime ? body.flightTime : null,
        p_luggage_count: luggageCount,
        p_passenger_count: passengerCount,
        p_rider_notes: body.notes || "manual_location_request",
      }
    );

    if (tripError || !tripId) {
      throw tripError || new Error("تعذر إنشاء الطلب اليدوي.");
    }

    const adminMessage = "طلب يدوي محتاج مراجعة المكان والسعر والمدة واختيار كابتن مناسب.";

    const { error: tripMetaError } = await serviceClient
      .from("trips")
      .update({
        status: "pending",
        metadata: {
          manual_location_request: true,
          manual_pricing_required: true,
          manual_dispatch_required: true,
          preferred_vehicle_type: preferredVehicleType,
          raw_pickup_text: pickupText,
          raw_destination_text: destinationText,
          awaiting_admin_quote: true,
        },
      })
      .eq("id", tripId);

    if (tripMetaError) throw tripMetaError;

    await serviceClient.from("trip_status_history").insert({
      trip_id: tripId,
      status: "pending",
      changed_by: auth.profile.user.id,
      note: adminMessage,
      metadata: {
        manual_request: true,
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
      title: "طلب يدوي جديد",
      body: `فيه طلب جديد من ${pickupText} إلى ${destinationText}. راجعه وحدد السعر والمدة والكابتن المناسب.`,
      payload: {
        trip_id: tripId,
        manual_request: true,
        pickup_text: pickupText,
        destination_text: destinationText,
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
      title: "استلمنا طلبك اليدوي",
      body: "استنّى دقائق ونحدد لك المدة والسعر والكابتن المناسب لوجهتك.",
      payload: {
        trip_id: tripId,
        manual_request: true,
      },
      related_trip_id: tripId,
    });

    return NextResponse.json({
      success: true,
      tripId,
      status: "pending",
      manual: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر إرسال الطلب اليدوي." },
      { status: 500 }
    );
  }
}
