import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import { hasPermission } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return auth.response;

    const adminProfile = { role: auth.profile.role, permissions: auth.profile.permissions };
    if (!hasPermission(adminProfile, "view_orders")) {
        return NextResponse.json({ error: "Forbidden: support access requires trip operations permission" }, { status: 403 });
    }

    const supabase = createAdminPlatformClient();
    if (!supabase) {
        return NextResponse.json({ error: "Server misconfigured: missing Supabase service role key" }, { status: 500 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const message = String(body.message || "").trim();
    const status = String(body.status || "in_progress");
    const now = new Date().toISOString();

    if (!message) {
        return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    try {
        const [{ data: ticket }, { error: messageError }] = await Promise.all([
            supabase.from("support_tickets").select("created_by").eq("id", id).single(),
            supabase.from("support_ticket_messages").insert({
                ticket_id: id,
                sender_user_id: auth.profile.user.id,
                message_body: message,
                is_internal: false,
            }),
        ]);

        if (messageError) throw messageError;

        await supabase
            .from("support_tickets")
            .update({
                status,
                last_message_at: now,
                updated_at: now,
            })
            .eq("id", id);

        if (ticket?.created_by) {
            await supabase.from("notifications").insert({
                recipient_user_id: ticket.created_by,
                type: "support_update",
                title: "تحديث على تذكرتك",
                body: "فريق الدعم رد على التذكرة الخاصة بيك من لوحة التشغيل.",
                payload: { ticket_id: id },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Unexpected support action failure" }, { status: 500 });
    }
}
