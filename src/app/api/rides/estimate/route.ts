import { NextResponse } from "next/server";

import { estimateRideFromText } from "@/lib/ride-maps-server";

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

    if (!pickupQuery || !destinationQuery) {
      return NextResponse.json(
        { error: "اكتب نقطة التحرك والوجهة الأول." },
        { status: 400 }
      );
    }

    const estimate = await estimateRideFromText({
      pickupQuery,
      destinationQuery,
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
