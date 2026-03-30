import { NextResponse } from "next/server";

import { searchLocations } from "@/lib/ride-maps-server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") || "").trim();
    const sessionToken = String(searchParams.get("sessionToken") || "").trim();

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchLocations(query, 5, sessionToken || undefined);
    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر البحث عن المكان الآن." },
      { status: 500 }
    );
  }
}
