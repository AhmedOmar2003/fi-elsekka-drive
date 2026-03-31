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

    return NextResponse.json({ trips: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحميل الرحلات." },
      { status: 500 }
    );
  }
}
