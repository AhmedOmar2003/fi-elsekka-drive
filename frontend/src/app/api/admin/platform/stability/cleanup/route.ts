import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApi } from "@/lib/admin-guard";
import { recordServerAdminAudit } from "@/lib/admin-audit-server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || "";

const supabaseAdmin =
    supabaseUrl && serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey, {
              auth: { autoRefreshToken: false, persistSession: false },
          })
        : null;

const BATCH_SIZE = 80;
const SAFE_TRIP_RETENTION_HOURS = 6;

type CleanupScope = "safe_closed_trips" | "all_trips";

function isCleanupScope(value: string | null): value is CleanupScope {
    return value === "safe_closed_trips" || value === "all_trips";
}

function isMissingRelationError(message?: string) {
    const text = String(message || "").toLowerCase();
    return text.includes("does not exist") || text.includes("relation") || text.includes("schema cache");
}

function isAvailabilityEnumMismatch(message?: string) {
    const text = String(message || "").toLowerCase();
    return text.includes("availability_status") && text.includes("driver_availability_status") && text.includes("type text");
}

function chunk<T>(items: T[], size: number) {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size));
    }
    return result;
}

function toLowerSafe(value: unknown) {
    return String(value || "").trim().toLowerCase();
}

function containsAny(haystack: string, needles: string[]) {
    return needles.some((needle) => haystack.includes(needle));
}

function isTruthy(value: unknown) {
    if (value === true || value === 1) return true;
    const text = toLowerSafe(value);
    return text === "true" || text === "1" || text === "yes";
}

function isTestMetadata(metadata: Record<string, unknown> | null) {
    if (!metadata) return false;

    const directFlags = [
        metadata.is_test,
        metadata.test_data,
        metadata.qa_data,
        metadata.dev_seed,
        metadata.generated_for_testing,
    ];
    if (directFlags.some(isTruthy)) return true;

    const sourceKeys = [
        metadata.source,
        metadata.created_by,
        metadata.request_source,
        metadata.dispatch_mode,
        metadata.channel,
    ];

    const sourceText = sourceKeys.map((value) => toLowerSafe(value)).join(" ");
    return containsAny(sourceText, ["test", "qa", "debug", "seed", "script", "dev"]);
}

function isLikelyTestText(value: unknown) {
    const text = toLowerSafe(value);
    if (!text) return false;
    return containsAny(text, [
        "test",
        "qa",
        "demo",
        "debug",
        "seed",
        "اختبار",
        "تجريبي",
    ]);
}

type ProfileSnapshot = {
    id: string;
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
};

type TripSnapshot = {
    id: string;
    status: string;
    created_at: string;
    customer_id: string | null;
    pickup_label?: string | null;
    destination_label?: string | null;
    metadata?: Record<string, unknown> | null;
};

function isLikelyTestTrip(trip: TripSnapshot, profile: ProfileSnapshot | null) {
    if (isTestMetadata(trip.metadata || null)) return true;

    if (isLikelyTestText(trip.pickup_label) || isLikelyTestText(trip.destination_label)) return true;

    if (!profile) return false;

    return [profile.full_name, profile.phone, profile.email].some(isLikelyTestText);
}

async function loadProfilesSnapshot(ids: string[]) {
    if (!supabaseAdmin || ids.length === 0) return new Map<string, ProfileSnapshot>();

    const chunks = chunk([...new Set(ids.filter(Boolean))], BATCH_SIZE);
    const map = new Map<string, ProfileSnapshot>();

    for (const group of chunks) {
        const { data, error } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name, phone, email")
            .in("id", group);

        if (error) {
            if (isMissingRelationError(error.message)) continue;
            throw new Error(`تعذر قراءة بيانات العملاء للتنظيف الآمن: ${error.message}`);
        }

        for (const row of data || []) {
            const id = String((row as Record<string, unknown>).id || "").trim();
            if (!id) continue;
            map.set(id, {
                id,
                full_name: ((row as Record<string, unknown>).full_name as string | null) || null,
                phone: ((row as Record<string, unknown>).phone as string | null) || null,
                email: ((row as Record<string, unknown>).email as string | null) || null,
            });
        }
    }

    return map;
}

async function tableExists(tableName: string) {
    if (!supabaseAdmin) return false;
    const { error } = await supabaseAdmin.from(tableName).select("id").limit(1);
    if (!error) return true;
    if (isMissingRelationError(error.message)) return false;
    throw new Error(`فشل فحص الجدول ${tableName}: ${error.message}`);
}

async function listTargetTripIds(scope: CleanupScope) {
    if (!supabaseAdmin) return [] as string[];
    const { data, error } = await supabaseAdmin
        .from("trips")
        .select("id, status, created_at, customer_id, pickup_label, destination_label, metadata")
        .order("created_at", { ascending: true })
        .limit(3000);

    if (error) {
        throw new Error(`تعذر قراءة المشاوير: ${error.message}`);
    }

    const rows = (data || []) as TripSnapshot[];
    const customerIds = [...new Set(rows.map((row) => String(row.customer_id || "")).filter(Boolean))];
    const profilesMap = await loadProfilesSnapshot(customerIds);

    const testOnlyRows = rows.filter((row) => isLikelyTestTrip(row, profilesMap.get(String(row.customer_id || "")) || null));

    if (scope === "all_trips") {
        // Critical safety guard:
        // even in "all_trips", we only delete trips classified as test/demo data.
        return testOnlyRows.map((row) => row.id).filter(Boolean);
    }

    const threshold = Date.now() - SAFE_TRIP_RETENTION_HOURS * 60 * 60 * 1000;
    return testOnlyRows
        .filter((row) => ["completed", "cancelled"].includes(String(row.status || "")))
        .filter((row) => {
            const createdAt = new Date(row.created_at || "").getTime();
            if (!Number.isFinite(createdAt)) return false;
            return createdAt <= threshold;
        })
        .map((row) => row.id)
        .filter(Boolean);
}

async function deleteByTripIds(tableName: string, tripColumn: string, tripIds: string[]) {
    if (!supabaseAdmin || tripIds.length === 0) return 0;
    const exists = await tableExists(tableName);
    if (!exists) return 0;

    let deleted = 0;
    for (const group of chunk(tripIds, BATCH_SIZE)) {
        const { error } = await supabaseAdmin.from(tableName).delete().in(tripColumn, group);
        if (error && !isMissingRelationError(error.message)) {
            throw new Error(`تعذر تنظيف ${tableName}: ${error.message}`);
        }
        if (!error) deleted += group.length;
    }
    return deleted;
}

async function deleteSupportTicketsByTripIds(tripIds: string[]) {
    if (!supabaseAdmin || tripIds.length === 0) {
        return { ticketsDeleted: 0, messagesDeleted: 0 };
    }

    const ticketsTableExists = await tableExists("support_tickets");
    if (!ticketsTableExists) return { ticketsDeleted: 0, messagesDeleted: 0 };

    let ticketIds: string[] = [];
    for (const group of chunk(tripIds, BATCH_SIZE)) {
        const { data, error } = await supabaseAdmin
            .from("support_tickets")
            .select("id")
            .in("trip_id", group)
            .limit(1000);
        if (error && !isMissingRelationError(error.message)) {
            throw new Error(`تعذر قراءة تذاكر الدعم: ${error.message}`);
        }
        if (data) {
            ticketIds.push(...data.map((item) => String(item.id)).filter(Boolean));
        }
    }
    ticketIds = [...new Set(ticketIds)];
    if (ticketIds.length === 0) return { ticketsDeleted: 0, messagesDeleted: 0 };

    const messagesTableExists = await tableExists("support_ticket_messages");
    let messagesDeleted = 0;
    if (messagesTableExists) {
        for (const group of chunk(ticketIds, BATCH_SIZE)) {
            const { error } = await supabaseAdmin.from("support_ticket_messages").delete().in("ticket_id", group);
            if (error && !isMissingRelationError(error.message)) {
                throw new Error(`تعذر تنظيف رسائل الدعم: ${error.message}`);
            }
            if (!error) messagesDeleted += group.length;
        }
    }

    let ticketsDeleted = 0;
    for (const group of chunk(ticketIds, BATCH_SIZE)) {
        const { error } = await supabaseAdmin.from("support_tickets").delete().in("id", group);
        if (error && !isMissingRelationError(error.message)) {
            throw new Error(`تعذر تنظيف تذاكر الدعم: ${error.message}`);
        }
        if (!error) ticketsDeleted += group.length;
    }

    return { ticketsDeleted, messagesDeleted };
}

async function deleteTripLinkedNotifications(tripIds: string[], scope: CleanupScope) {
    if (!supabaseAdmin) return 0;
    const notificationsTableExists = await tableExists("notifications");
    if (!notificationsTableExists) return 0;

    let deleted = 0;

    for (const group of chunk(tripIds, BATCH_SIZE)) {
        const { error } = await supabaseAdmin.from("notifications").delete().in("related_trip_id", group);
        if (error && !isMissingRelationError(error.message)) {
            throw new Error(`تعذر تنظيف الإشعارات المرتبطة بالمشاوير: ${error.message}`);
        }
        if (!error) deleted += group.length;
    }

    const { data: payloadCandidates, error: payloadError } = await supabaseAdmin
        .from("notifications")
        .select("id, payload, type")
        .order("created_at", { ascending: false })
        .limit(1200);

    if (payloadError && !isMissingRelationError(payloadError.message)) {
        throw new Error(`تعذر قراءة إشعارات payload: ${payloadError.message}`);
    }

    const tripIdsSet = new Set(tripIds);
    const payloadIds = (payloadCandidates || [])
        .filter((item) => {
            const payload = item.payload && typeof item.payload === "object" ? (item.payload as Record<string, unknown>) : null;
            const payloadTripId = String(payload?.trip_id || "").trim();
            if (payloadTripId && tripIdsSet.has(payloadTripId)) return true;
            if (scope === "all_trips" && String(item.type || "") === "admin_message") return true;
            return false;
        })
        .map((item) => String(item.id))
        .filter(Boolean);

    for (const group of chunk(payloadIds, BATCH_SIZE)) {
        const { error } = await supabaseAdmin.from("notifications").delete().in("id", group);
        if (error && !isMissingRelationError(error.message)) {
            throw new Error(`تعذر تنظيف إشعارات payload: ${error.message}`);
        }
        if (!error) deleted += group.length;
    }

    return deleted;
}

export async function POST(request: Request) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "إعدادات الخادم ناقصة (SUPABASE_SERVICE_KEY)." }, { status: 500 });
    }

    const auth = await requireAdminApi(request, "manage_settings");
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json().catch(() => ({}));
        const rawScope = typeof body?.scope === "string" ? body.scope : "safe_closed_trips";
        const scope: CleanupScope = isCleanupScope(rawScope) ? rawScope : "safe_closed_trips";

        const tripsTableExists = await tableExists("trips");
        if (!tripsTableExists) {
            return NextResponse.json({
                success: true,
                scope,
                summary: {
                    targetedTrips: 0,
                    tripsDeleted: 0,
                    tripOffersDeleted: 0,
                    tripStatusHistoryDeleted: 0,
                    tripReviewsDeleted: 0,
                    notificationsDeleted: 0,
                    supportTicketsDeleted: 0,
                    supportMessagesDeleted: 0,
                },
                message: "جدول المشاوير غير موجود في هذه البيئة.",
            });
        }

        const tripIds = await listTargetTripIds(scope);
        if (tripIds.length === 0) {
            return NextResponse.json({
                success: true,
                scope,
                summary: {
                    targetedTrips: 0,
                    tripsDeleted: 0,
                    tripOffersDeleted: 0,
                    tripStatusHistoryDeleted: 0,
                    tripReviewsDeleted: 0,
                    notificationsDeleted: 0,
                    supportTicketsDeleted: 0,
                    supportMessagesDeleted: 0,
                },
                message: "لا توجد بيانات تجريبية مطابقة للتنظيف الآن.",
            });
        }

        const tripOffersDeleted = await deleteByTripIds("trip_offers", "trip_id", tripIds);
        const tripStatusHistoryDeleted = await deleteByTripIds("trip_status_history", "trip_id", tripIds);
        const tripReviewsDeleted = await deleteByTripIds("trip_reviews", "trip_id", tripIds);
        const notificationsDeleted = await deleteTripLinkedNotifications(tripIds, scope);
        const supportCleanup = await deleteSupportTicketsByTripIds(tripIds);
        const tripsDeleted = await deleteByTripIds("trips", "id", tripIds);

        const summary = {
            targetedTrips: tripIds.length,
            tripsDeleted,
            tripOffersDeleted,
            tripStatusHistoryDeleted,
            tripReviewsDeleted,
            notificationsDeleted,
            supportTicketsDeleted: supportCleanup.ticketsDeleted,
            supportMessagesDeleted: supportCleanup.messagesDeleted,
        };

        await recordServerAdminAudit(auth.profile, {
            action: "platform.stability.cleanup_runtime",
            entityType: "runtime_cleanup",
            severity: "critical",
            details: {
                scope,
                ...summary,
            },
        });

        return NextResponse.json({
            success: true,
            scope,
            summary,
            message:
                scope === "all_trips"
                    ? "تم تنظيف كل المشاوير التجريبية (فقط) وملحقاتها بنجاح."
                    : "تم تنظيف المشاوير التجريبية المنتهية/الملغية وملحقاتها بنجاح.",
        });
    } catch (error: any) {
        const message = String(error?.message || "");
        if (isAvailabilityEnumMismatch(message)) {
            return NextResponse.json(
                {
                    error:
                        "تنظيف المشاوير متوقف مؤقتًا بسبب تعارض enum في الدالة الخاصة بحالة الكابتن. طبّق آخر migration في Supabase (20260411_000013_fix_driver_availability_enum_case) ثم أعد المحاولة.",
                    technical: message,
                },
                { status: 500 },
            );
        }
        return NextResponse.json({ error: message || "فشل تنفيذ تنظيف الاستقرار" }, { status: 500 });
    }
}
