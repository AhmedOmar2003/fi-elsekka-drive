import { NextResponse } from "next/server";

import {
  createRideAuthedClient,
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";

type Params = { params: Promise<{ offerId: string }> };

export async function POST(request: Request, context: Params) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  if (auth.profile.role !== "driver") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authedClient = createRideAuthedClient(auth.token);
  const serviceClient = createRideServiceClient();

  if (!authedClient || !serviceClient) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  try {
    const { offerId } = await context.params;
    const body = await request.json();
    const action = body.action === "reject" ? "reject" : "accept";

    const { data, error } = await authedClient.rpc("driver_respond_to_trip_offer", {
      p_offer_id: offerId,
      p_accept: action === "accept",
      p_rejection_reason: action === "reject" ? body.rejectionReason || null : null,
    });

    if (error) throw error;

    if (action === "accept") {
      await serviceClient
        .from("driver_profiles")
        .update({
          availability_status: "busy",
          is_accepting_offers: false,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", auth.profile.user.id);
    }

    return NextResponse.json({ success: true, offerId: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحديث رد الكابتن على العرض." },
      { status: 500 }
    );
  }
}
