import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApi } from "@/lib/admin-guard";
import { resolveAdminNotificationRecipientIds } from "@/lib/admin-notification-targets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

function createAdminServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params) {
  const auth = await requireAdminApi(request);
  if (!auth.ok) return auth.response;

  const supabase = createAdminServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  const recipientIds = await resolveAdminNotificationRecipientIds(supabase);
  if (recipientIds.length === 0) {
    return NextResponse.json({ success: true });
  }

  if (action !== "mark_read") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .in("recipient_user_id", recipientIds);

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to mark notification as read." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
