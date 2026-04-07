import { NextResponse } from "next/server";

import { createRideServiceClient, requireRideUser } from "@/lib/ride-server-auth";

export async function POST(request: Request) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const token = String(body.token || "").trim();
    const platform = String(body.platform || "").trim().toLowerCase();
    const provider = String(body.provider || "fcm").trim().toLowerCase();

    if (!token || !platform) {
      return NextResponse.json(
        { error: "token and platform are required." },
        { status: 400 }
      );
    }

    const serviceClient = createRideServiceClient();
    if (!serviceClient) {
      return NextResponse.json(
        { error: "Server misconfiguration." },
        { status: 500 }
      );
    }

    const updatedAt = new Date().toISOString();
    const { data: updatedRows, error: updateError } = await serviceClient
      .from("mobile_push_tokens")
      .update({
        user_id: auth.profile.user.id,
        platform,
        provider,
        is_active: true,
        last_seen_at: updatedAt,
        updated_at: updatedAt,
      })
      .eq("token", token)
      .select("id");

    if (updateError) {
      console.error("Failed to update mobile push token:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertError } = await serviceClient
        .from("mobile_push_tokens")
        .insert({
          user_id: auth.profile.user.id,
          token,
          platform,
          provider,
          is_active: true,
          last_seen_at: updatedAt,
          updated_at: updatedAt,
        });

      if (insertError) {
        console.error("Failed to insert mobile push token:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected mobile push registration failure." },
      { status: 500 }
    );
  }
}
