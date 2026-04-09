import { NextResponse } from "next/server";

import { registerCommunityPlace } from "@/lib/community-places-server";
import { requireRideUser } from "@/lib/ride-server-auth";

export async function POST(request: Request) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  if (auth.profile.disabled) {
    return NextResponse.json(
      { error: "الحساب الحالي موقوف مؤقتًا." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const label = String(body.label || body.name || "").trim();
    const address = String(body.address || "").trim();
    const city = String(body.city || "").trim();
    const area = String(body.area || "").trim();
    const source = String(body.source || "user_created").trim() || "user_created";
    const usageCount = Math.max(1, Number(body.usageCount || 1));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { error: "إحداثيات المكان غير صالحة." },
        { status: 400 }
      );
    }

    const place = await registerCommunityPlace({
      createdBy: auth.profile.user.id,
      place: {
        label,
        address,
        latitude,
        longitude,
        city: city || null,
        area: area || null,
        source,
        usageCount,
      },
    });

    if (!place) {
      return NextResponse.json(
        { error: "تعذر حفظ المكان المشترك الآن." },
        { status: 422 }
      );
    }

    return NextResponse.json({ place });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر حفظ المكان المشترك الآن." },
      { status: 500 }
    );
  }
}
