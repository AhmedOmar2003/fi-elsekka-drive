import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import { hasPermission } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return auth.response;

    const adminProfile = { role: auth.profile.role, permissions: auth.profile.permissions };
    if (!hasPermission(adminProfile, "view_drivers")) {
        return NextResponse.json({ error: "Forbidden: view_drivers permission required" }, { status: 403 });
    }

    const supabase = createAdminPlatformClient();
    if (!supabase) {
        return NextResponse.json({ error: "Server misconfigured: missing Supabase service role key" }, { status: 500 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const action = String(body.action || "");
    const note = body.note ? String(body.note) : null;
    const now = new Date().toISOString();

    try {
        if (action === "approve") {
            await supabase.from("profiles").update({ role: "driver", account_status: "active", updated_at: now }).eq("id", id);
            await supabase
                .from("driver_profiles")
                .update({
                    application_status: "approved",
                    verification_status: "approved",
                    is_accepting_offers: true,
                    approved_at: now,
                    approved_by: auth.profile.user.id,
                    suspension_reason: null,
                    suspended_at: null,
                    suspended_by: null,
                    updated_at: now,
                })
                .eq("id", id);

            return NextResponse.json({ success: true });
        }

        if (action === "reject") {
            await supabase
                .from("driver_profiles")
                .update({
                    application_status: "rejected",
                    verification_status: "rejected",
                    is_accepting_offers: false,
                    suspension_reason: note,
                    updated_at: now,
                })
                .eq("id", id);

            return NextResponse.json({ success: true });
        }

        if (action === "suspend") {
            await supabase.from("profiles").update({ account_status: "suspended", updated_at: now }).eq("id", id);
            await supabase
                .from("driver_profiles")
                .update({
                    application_status: "suspended",
                    suspension_reason: note || "Suspended from admin dashboard",
                    suspended_at: now,
                    suspended_by: auth.profile.user.id,
                    is_accepting_offers: false,
                    availability_status: "offline",
                    updated_at: now,
                })
                .eq("id", id);

            return NextResponse.json({ success: true });
        }

        if (action === "reactivate") {
            await supabase.from("profiles").update({ account_status: "active", updated_at: now }).eq("id", id);
            await supabase
                .from("driver_profiles")
                .update({
                    application_status: "approved",
                    verification_status: "approved",
                    suspension_reason: null,
                    suspended_at: null,
                    suspended_by: null,
                    is_accepting_offers: true,
                    availability_status: "offline",
                    updated_at: now,
                })
                .eq("id", id);

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Unexpected driver action failure" }, { status: 500 });
    }
}
