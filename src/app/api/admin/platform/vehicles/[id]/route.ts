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
        const approvalStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : null;
        if (!approvalStatus) {
            return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
        }

        const { error } = await supabase
            .from("vehicles")
            .update({
                approval_status: approvalStatus,
                approval_notes: note,
                approved_at: now,
                approved_by: auth.profile.user.id,
                updated_at: now,
            })
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Unexpected vehicle action failure" }, { status: 500 });
    }
}
