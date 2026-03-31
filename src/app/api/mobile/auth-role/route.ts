import { NextRequest, NextResponse } from "next/server";

import { createAdminPlatformClient } from "@/lib/admin-platform-server";

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminPlatformClient();
    if (!supabase) {
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [{ data: driverProfile }, { data: profile }] = await Promise.all([
        supabase.from("driver_profiles").select("id, application_status, verification_status").eq("id", user.id).maybeSingle(),
        supabase.from("profiles").select("role, account_status").eq("id", user.id).maybeSingle(),
    ]);

    const role = driverProfile ? "driver" : String(profile?.role || user.user_metadata?.role || user.app_metadata?.role || "customer");

    return NextResponse.json({
        userId: user.id,
        role,
        driverProfileExists: Boolean(driverProfile),
        applicationStatus: driverProfile?.application_status || null,
        verificationStatus: driverProfile?.verification_status || null,
        accountStatus: profile?.account_status || null,
    });
}
