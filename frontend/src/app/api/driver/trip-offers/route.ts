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
    const nowIso = new Date().toISOString();
    await serviceClient
      .from("trip_offers")
      .update({
        offer_status: "timed_out",
        responded_at: nowIso,
        updated_at: nowIso,
        rejection_reason: "انتهت مهلة مراجعة العرض.",
      })
      .eq("driver_id", auth.profile.user.id)
      .eq("offer_status", "offered")
      .lte("expires_at", nowIso);

    const { data: offers, error } = await serviceClient
      .from("trip_offers")
      .select("*")
      .eq("driver_id", auth.profile.user.id)
      .in("offer_status", ["offered", "accepted", "rejected"])
      .order("offered_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const tripIds = (offers || []).map((offer) => offer.trip_id);
    const trips =
      tripIds.length > 0
        ? await serviceClient
            .from("trips")
            .select(
              "id, customer_id, trip_type, status, pickup_label, pickup_address, pickup_latitude, pickup_longitude, destination_label, destination_address, destination_latitude, destination_longitude, passenger_count, luggage_count, estimated_price, created_at"
            )
            .in("id", tripIds)
        : { data: [] as any[] };

    const customerIds = (trips.data || []).map((trip) => trip.customer_id);
    const customers =
      customerIds.length > 0
        ? await serviceClient
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", customerIds)
        : { data: [] as any[] };

    const tripMap = new Map((trips.data || []).map((trip) => [trip.id, trip]));
    const customerMap = new Map(
      (customers.data || []).map((customer) => [customer.id, customer])
    );

    const now = Date.now();
    const payload = (offers || [])
      .map((offer) => {
        const trip = tripMap.get(offer.trip_id);
        const customer = trip ? customerMap.get(trip.customer_id) : null;

        return {
          id: offer.id,
          offerStatus: offer.offer_status,
          offeredAt: offer.offered_at,
          expiresAt: offer.expires_at,
          trip: trip
            ? {
                ...trip,
                customerName: customer?.full_name || "عميل",
                customerPhone: customer?.phone || null,
              }
            : null,
        };
      })
      .filter((offer) => {
        const trip = offer.trip;
        if (!trip) return false;
        if (trip.status === "cancelled") return false;
        const expiresAt = offer.expiresAt ? new Date(String(offer.expiresAt)).getTime() : Number.NaN;
        if (offer.offerStatus === "offered" && Number.isFinite(expiresAt) && expiresAt <= now) {
          return false;
        }
        if (offer.offerStatus === "offered" && trip.status === "completed") {
          return false;
        }
        return true;
      });

    return NextResponse.json({ offers: payload });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحميل عروض المشاوير." },
      { status: 500 }
    );
  }
}
