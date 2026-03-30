import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: NextRequest) {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return auth.response;

    const adminProfile = { role: auth.profile.role, permissions: auth.profile.permissions };
    if (!hasPermission(adminProfile, "manage_settings")) {
        return NextResponse.json({ error: "Forbidden: manage_settings permission required" }, { status: 403 });
    }

    const supabase = createAdminPlatformClient();
    if (!supabase) {
        return NextResponse.json({ error: "Server misconfigured: missing Supabase service role key" }, { status: 500 });
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const message = String(body.body || "").trim();
    const audience = String(body.audience || "all");
    const startsAt = body.startsAt ? String(body.startsAt) : null;

    if (!title || !message) {
        return NextResponse.json({ error: "title and body are required" }, { status: 400 });
    }

    try {
        const { data: announcement, error } = await supabase
            .from("admin_announcements")
            .insert({
                created_by: auth.profile.user.id,
                audience,
                title,
                body: message,
                is_active: true,
                starts_at: startsAt,
            })
            .select("id")
            .single();

        if (error) throw error;

        let recipientsQuery = supabase.from("profiles").select("id");
        if (audience === "drivers") recipientsQuery = recipientsQuery.eq("role", "driver");
        if (audience === "customers") recipientsQuery = recipientsQuery.eq("role", "customer");
        if (audience === "admins") recipientsQuery = recipientsQuery.eq("role", "admin");

        const { data: recipients } = await recipientsQuery.limit(1000);

        if (recipients?.length) {
            await supabase.from("notifications").insert(
                recipients.map((recipient) => ({
                    recipient_user_id: recipient.id,
                    type: "admin_message",
                    title,
                    body: message,
                    payload: { announcement_id: announcement.id, audience },
                })),
            );
        }

        return NextResponse.json({ success: true, announcementId: announcement.id, recipients: recipients?.length || 0 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Unexpected announcement failure" }, { status: 500 });
    }
}
