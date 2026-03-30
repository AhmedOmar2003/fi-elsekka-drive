import { NextResponse } from "next/server";

import { reverseGeocodeCoordinates } from "@/lib/ride-maps-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { error: "إحداثيات المكان المختار مش صحيحة." },
        { status: 400 }
      );
    }

    const location = await reverseGeocodeCoordinates(latitude, longitude);
    return NextResponse.json({ location });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر قراءة المكان من الخريطة." },
      { status: 500 }
    );
  }
}
