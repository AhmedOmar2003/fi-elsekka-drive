import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApi } from "@/lib/admin-guard";
import { resolveAdminNotificationRecipientIds } from "@/lib/admin-notification-targets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
const adminDbProtectMode = process.env.ADMIN_DB_PROTECT_MODE === "true";

function createAdminServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function deriveLink(record: Record<string, unknown>) {
  const payload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : {};
  const directLink = String(record.link || payload.link || payload.url || "").trim();
  if (directLink) return directLink;

  const tripId = String(record.related_trip_id || payload.trip_id || "").trim();
  if (tripId) return `/admin/trips/${tripId}`;

  const ticketId = String(payload.ticket_id || "").trim();
  if (ticketId) return `/admin/support/${ticketId}`;

  return "/admin/notifications";
}

function normalizeNotification(record: Record<string, unknown>) {
  return {
    id: String(record.id || ""),
    user_id: String(record.recipient_user_id || ""),
    title: String(record.title || "إشعار جديد"),
    message: String(record.body || record.message || ""),
    link: deriveLink(record),
    is_read: Boolean(record.is_read),
    created_at: String(record.created_at || new Date().toISOString()),
    type: typeof record.type === "string" ? record.type : null,
    payload:
      record.payload && typeof record.payload === "object"
        ? (record.payload as Record<string, unknown>)
        : null,
    related_trip_id:
      typeof record.related_trip_id === "string" ? record.related_trip_id : null,
  };
}

export async function GET(request: Request) {
  const auth = await requireAdminApi(request);
  if (!auth.ok) return auth.response;
  if (adminDbProtectMode) {
    return NextResponse.json({ notifications: [] });
  }

  const supabase = createAdminServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") || 30);
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 30;
  const recipientIds = await resolveAdminNotificationRecipientIds(supabase);
  if (recipientIds.length === 0) {
    return NextResponse.json({ notifications: [] });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_user_id, title, body, is_read, created_at, type, payload, related_trip_id")
    .in("recipient_user_id", recipientIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to load notifications." }, { status: 500 });
  }

  return NextResponse.json({
    notifications: (data || []).map((item) => normalizeNotification(item as Record<string, unknown>)),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi(request);
  if (!auth.ok) return auth.response;
  if (adminDbProtectMode) {
    return NextResponse.json({ success: true, skipped: "admin_db_protect_mode" });
  }

  const supabase = createAdminServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  const recipientIds = await resolveAdminNotificationRecipientIds(supabase);
  if (recipientIds.length === 0) {
    return NextResponse.json({ success: true });
  }

  if (action === "mark_all_read") {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("recipient_user_id", recipientIds)
      .eq("is_read", false);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to mark notifications as read." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === "delete_all") {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("recipient_user_id", recipientIds);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to delete notifications." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
