import { NextResponse } from "next/server";

import { estimateRideFromText, type GeocodedLocation } from "@/lib/ride-maps-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pickupQuery = String(body.pickupQuery || "").trim();
    const destinationQuery = String(body.destinationQuery || "").trim();
    const tripType =
      body.tripType === "airport_ride" ? "airport_ride" : "normal_ride";
    const preferredVehicleType =
      body.preferredVehicleType === "car" ||
      body.preferredVehicleType === "tuk_tuk"
        ? body.preferredVehicleType
        : "any";
    const pickupLocation = body.pickupLocation as GeocodedLocation | null | undefined;
    const destinationLocation = body.destinationLocation as GeocodedLocation | null | undefined;

    if (!pickupQuery || !destinationQuery) {
      return NextResponse.json(
        { error: "اكتب نقطة التحرك والوجهة الأول." },
        { status: 400 }
      );
    }

    const estimate = await estimateRideFromText({
      pickupQuery,
      destinationQuery,
      pickupLocation:
        pickupLocation &&
        Number.isFinite(Number(pickupLocation.latitude)) &&
        Number.isFinite(Number(pickupLocation.longitude))
          ? pickupLocation
          : null,
      destinationLocation:
        destinationLocation &&
        Number.isFinite(Number(destinationLocation.latitude)) &&
        Number.isFinite(Number(destinationLocation.longitude))
          ? destinationLocation
          : null,
      tripType,
      preferredVehicleType,
      luggageCount: Number(body.luggageCount || 0),
      passengerCount: Number(body.passengerCount || 1),
    });

    return NextResponse.json({ estimate });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "حصلت مشكلة في حساب الوقت والسعر." },
      { status: 500 }
    );
  }
}
