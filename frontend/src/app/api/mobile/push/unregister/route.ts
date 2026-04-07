import { NextResponse } from "next/server";

import { createRideServiceClient, requireRideUser } from "@/lib/ride-server-auth";

export async function POST(request: Request) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const token = String(body.token || "").trim();
    if (!token) {
      return NextResponse.json({ error: "token is required." }, { status: 400 });
    }

    const serviceClient = createRideServiceClient();
    if (!serviceClient) {
      return NextResponse.json(
        { error: "Server misconfiguration." },
        { status: 500 }
      );
    }

    const { error } = await serviceClient
      .from("mobile_push_tokens")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.profile.user.id)
      .eq("token", token);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected mobile push unregister failure." },
      { status: 500 }
    );
  }
}
