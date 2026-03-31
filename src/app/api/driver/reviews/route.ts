import { NextResponse } from "next/server";

import {
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";

export async function GET(request: Request) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  if (auth.profile.role !== "driver") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = createRideServiceClient();
  if (!serviceClient) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  try {
    const { data: reviews, error } = await serviceClient
      .from("trip_reviews")
      .select("id, trip_id, customer_id, driver_id, rating, comment, created_at")
      .eq("driver_id", auth.profile.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const tripIds = (reviews || []).map((review) => String(review.trip_id));
    const customerIds = (reviews || []).map((review) => String(review.customer_id));

    const [tripsResult, customersResult] = await Promise.all([
      tripIds.length
        ? serviceClient
            .from("trips")
            .select("id, pickup_label, pickup_address, destination_label, destination_address, trip_type, estimated_price, completed_at")
            .in("id", tripIds)
        : Promise.resolve({ data: [] as any[] }),
      customerIds.length
        ? serviceClient
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", customerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const tripMap = new Map((tripsResult.data || []).map((trip) => [String(trip.id), trip]));
    const customerMap = new Map((customersResult.data || []).map((customer) => [String(customer.id), customer]));

    return NextResponse.json({
      reviews: (reviews || []).map((review) => {
        const trip = tripMap.get(String(review.trip_id));
        const customer = customerMap.get(String(review.customer_id));
        return {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.created_at,
          customer: {
            id: review.customer_id,
            fullName: customer?.full_name || "عميل",
            phone: customer?.phone || null,
          },
          trip: trip
            ? {
                id: trip.id,
                pickupLabel: trip.pickup_label || trip.pickup_address,
                destinationLabel: trip.destination_label || trip.destination_address,
                tripType: trip.trip_type,
                estimatedPrice: trip.estimated_price,
                completedAt: trip.completed_at,
              }
            : null,
        };
      }),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحميل تقييمات الكابتن." },
      { status: 500 }
    );
  }
}
