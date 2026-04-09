import { NextResponse } from "next/server";

import { createRideServiceClient, requireRideUser } from "@/lib/ride-server-auth";
import { ensureMarketplaceDispatchProgress } from "@/lib/ride-dispatch-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params) {
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

    const { data: trip, error: tripError } = await serviceClient
      .from("trips")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const isOwner = trip.customer_id === auth.profile.user.id;
    const isAssignedDriver = trip.assigned_driver_id === auth.profile.user.id;
    const isAdmin = auth.profile.role === "admin";

    if (!isOwner && !isAssignedDriver && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const metadata = ((trip.metadata as Record<string, unknown> | null) || {});
    if (
      !trip.assigned_driver_id &&
      auth.profile.user.id &&
      metadata.customer_price_confirmed === true &&
      ["searching_driver", "offered"].includes(String(trip.status))
    ) {
      await ensureMarketplaceDispatchProgress(serviceClient, {
        trip: {
          id: String(trip.id),
          customer_id: String(trip.customer_id),
          trip_type: String(trip.trip_type),
          status: String(trip.status),
          pickup_label: (trip.pickup_label as string | null) ?? null,
          destination_label: (trip.destination_label as string | null) ?? null,
          estimated_price:
            trip.estimated_price === null ? null : Number(trip.estimated_price),
          metadata,
          assigned_driver_id: trip.assigned_driver_id as string | null,
        },
        triggeredByUserId: auth.profile.user.id,
      });
    }

    const { data: refreshedTrip, error: refreshedTripError } = await serviceClient
      .from("trips")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (refreshedTripError) throw refreshedTripError;
    if (!refreshedTrip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const [customerResult, driverResult, vehicleResult, timelineResult, reviewResult] =
      await Promise.all([
        serviceClient
          .from("profiles")
          .select("id, full_name, email, phone")
          .eq("id", refreshedTrip.customer_id)
          .maybeSingle(),
        refreshedTrip.assigned_driver_id
          ? serviceClient
              .from("profiles")
              .select("id, full_name, phone")
              .eq("id", refreshedTrip.assigned_driver_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        refreshedTrip.assigned_vehicle_id
          ? serviceClient
              .from("vehicles")
              .select("id, vehicle_type, brand, model, color, plate_number")
              .eq("id", refreshedTrip.assigned_vehicle_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        serviceClient
          .from("trip_status_history")
          .select("id, status, note, created_at, changed_by")
          .eq("trip_id", id)
          .order("created_at", { ascending: true }),
        serviceClient
          .from("trip_reviews")
          .select("id, customer_id, driver_id, rating, comment, created_at")
          .eq("trip_id", id)
          .maybeSingle(),
      ]);

    return NextResponse.json({
      trip: refreshedTrip,
      customer: customerResult.data,
      driver: driverResult.data,
      vehicle: vehicleResult.data,
      timeline: timelineResult.data || [],
      review: reviewResult.data || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحميل بيانات المشوار." },
      { status: 500 }
    );
  }
}
