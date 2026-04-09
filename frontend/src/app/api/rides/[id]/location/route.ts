import { NextResponse } from "next/server";

import {
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  const serviceClient = createRideServiceClient();
  if (!serviceClient) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "إحداثيات الموقع غير صالحة." }, { status: 400 });
    }

    const { data: trip, error: tripError } = await serviceClient
      .from("trips")
      .select("id, status, assigned_driver_id, metadata")
      .eq("id", id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return NextResponse.json({ error: "المشوار مش موجود." }, { status: 404 });
    }

    const isAssignedDriver = String(trip.assigned_driver_id || "") === auth.profile.user.id;
    if (!isAssignedDriver && auth.profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["driver_on_the_way", "driver_arrived", "trip_started"].includes(String(trip.status))) {
      return NextResponse.json({ success: true, skipped: true, status: trip.status });
    }

    const now = new Date().toISOString();
    const metadata = ((trip.metadata as Record<string, unknown> | null) || {});

    const { error: updateError } = await serviceClient
      .from("trips")
      .update({
        metadata: {
          ...metadata,
          driver_location: {
            latitude,
            longitude,
            updated_at: now,
          },
        },
        updated_at: now,
      })
      .eq("id", trip.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      latitude,
      longitude,
      updatedAt: now,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحديث موقع الكابتن." },
      { status: 500 }
    );
  }
}
