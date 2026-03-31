import { NextResponse } from "next/server";

import { createRideServiceClient, requireRideUser } from "@/lib/ride-server-auth";

export async function GET(request: Request) {
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
    const column = auth.profile.role === "driver" ? "assigned_driver_id" : "customer_id";
    const { data, error } = await serviceClient
      .from("trips")
      .select("*")
      .eq(column, auth.profile.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const trips = data || [];
    const driverIds = [...new Set(trips.map((trip) => String(trip.assigned_driver_id || "")).filter(Boolean))];
    const vehicleIds = [...new Set(trips.map((trip) => String(trip.assigned_vehicle_id || "")).filter(Boolean))];
    const tripIds = trips.map((trip) => String(trip.id));

    const [driversResult, vehiclesResult, reviewsResult] = await Promise.all([
      driverIds.length
        ? serviceClient.from("profiles").select("id, full_name, phone").in("id", driverIds)
        : Promise.resolve({ data: [] as any[] }),
      vehicleIds.length
        ? serviceClient.from("vehicles").select("id, vehicle_type, brand, model, plate_number").in("id", vehicleIds)
        : Promise.resolve({ data: [] as any[] }),
      tripIds.length
        ? serviceClient
            .from("trip_reviews")
            .select("id, trip_id, customer_id, driver_id, rating, comment, created_at")
            .in("trip_id", tripIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const driverMap = new Map((driversResult.data || []).map((driver) => [String(driver.id), driver]));
    const vehicleMap = new Map((vehiclesResult.data || []).map((vehicle) => [String(vehicle.id), vehicle]));
    const reviewMap = new Map((reviewsResult.data || []).map((review) => [String(review.trip_id), review]));

    return NextResponse.json({
      trips: trips.map((trip) => ({
        trip,
        driver: trip.assigned_driver_id ? driverMap.get(String(trip.assigned_driver_id)) || null : null,
        vehicle: trip.assigned_vehicle_id ? vehicleMap.get(String(trip.assigned_vehicle_id)) || null : null,
        review: reviewMap.get(String(trip.id)) || null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحميل الرحلات." },
      { status: 500 }
    );
  }
}
