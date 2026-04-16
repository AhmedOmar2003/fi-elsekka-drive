import "server-only";

import { createClient } from "@supabase/supabase-js";
import { resolveAdminNotificationRecipientIds } from "@/lib/admin-notification-targets";

import type {
    DispatchBoardData,
    DispatchFleetDriverItem,
    DispatchLiveTripItem,
    DispatchLocationPoint,
    DispatchQueueTripItem,
    DispatchSlaState,
} from "@/lib/admin-dispatch-types";

type Json = Record<string, unknown>;

export type DashboardStat = {
    label: string;
    value: number;
    tone: "primary" | "success" | "warning" | "danger" | "info";
    hint: string;
};

export type DashboardBarPoint = {
    label: string;
    value: number;
};

export type DashboardStatusPoint = {
    label: string;
    value: number;
    status: string;
};

export type AdminTripListItem = {
    id: string;
    customerName: string;
    driverName: string | null;
    tripType: string;
    pickup: string;
    destination: string;
    status: string;
    createdAt: string;
    city: string | null;
    passengerCount: number;
    luggageCount: number;
    requestSource: string;
};

export type AdminTripOffer = {
    id: string;
    driverId: string;
    driverName: string;
    vehicleLabel: string | null;
    offerStatus: string;
    offeredAt: string;
    respondedAt: string | null;
    rejectionReason: string | null;
};

export type AdminTripDetail = {
    trip: {
        id: string;
        status: string;
        tripType: string;
        pickupLabel: string;
        pickupAddress: string;
        destinationLabel: string;
        destinationAddress: string;
        passengerCount: number;
        luggageCount: number;
        riderNotes: string | null;
        airportName: string | null;
        airportTerminal: string | null;
        airportRideMode: string | null;
        flightNumber: string | null;
        flightTime: string | null;
        airportDepartureTime: string | null;
        airportDepartureLabel: string | null;
        estimatedPrice: number | null;
        mapEstimatedPrice: number | null;
        adminSelectedPrice: number | null;
        customerPriceConfirmed: boolean;
        actualPrice: number | null;
        createdAt: string;
        requestedAt: string;
        acceptedAt: string | null;
        completedAt: string | null;
        cancelledAt: string | null;
        cancellationReason: string | null;
        adminNotes: string | null;
    };
    customer: {
        id: string;
        fullName: string;
        phone: string | null;
        email: string | null;
    } | null;
    driver: {
        id: string;
        fullName: string;
        phone: string | null;
        workingCity: string | null;
        availabilityStatus: string | null;
    } | null;
    vehicle: {
        id: string;
        label: string;
        plateNumber: string | null;
        vehicleType: string;
    } | null;
    offers: AdminTripOffer[];
    timeline: Array<{
        id: number;
        status: string;
        note: string | null;
        createdAt: string;
        changedByName: string | null;
    }>;
    review: {
        rating: number;
        comment: string | null;
        createdAt: string;
        customerName: string;
        driverName: string;
    } | null;
};

export type AdminDriverListItem = {
    id: string;
    fullName: string;
    phone: string | null;
    city: string | null;
    area: string | null;
    availabilityStatus: string;
    dispatchReady: boolean;
    dispatchBlockReason: string | null;
    applicationStatus: string;
    verificationStatus: string;
    vehicleType: string | null;
    tripsCompleted: number;
    accountStatus: string;
};

export type AdminDriverDetail = {
    profile: {
        id: string;
        fullName: string;
        phone: string | null;
        email: string | null;
        accountStatus: string;
    } | null;
    driverProfile: {
        applicationStatus: string;
        verificationStatus: string;
        availabilityStatus: string;
        workingCity: string;
        workingArea: string | null;
        operationalNotes: string | null;
        suspensionReason: string | null;
        approvedAt: string | null;
    } | null;
    vehicles: Array<{
        id: string;
        label: string;
        vehicleType: string;
        approvalStatus: string;
        plateNumber: string | null;
        isPrimary: boolean;
    }>;
    documents: Array<{
        id: string;
        documentType: string;
        approvalStatus: string;
        fileName: string | null;
        storageBucket: string;
        storagePath: string;
        createdAt: string;
    }>;
    recentTrips: AdminTripListItem[];
    authAccount: {
        exists: boolean;
        email: string | null;
        lastSignInAt: string | null;
    };
    recentReviews: Array<{
        id: string;
        rating: number;
        comment: string | null;
        createdAt: string;
        customerName: string;
        tripId: string;
        pickup: string;
        destination: string;
    }>;
};

export type AdminVehicleListItem = {
    id: string;
    driverName: string;
    driverId: string;
    vehicleType: string;
    brand: string;
    model: string;
    plateNumber: string | null;
    approvalStatus: string;
    isPrimary: boolean;
};

export type DispatchTripItem = {
    id: string;
    customerName: string;
    pickup: string;
    destination: string;
    tripType: string;
    status: string;
    createdAt: string;
};

export type DispatchDriverItem = {
    id: string;
    fullName: string;
    availabilityStatus: string;
    city: string;
    vehicleId: string | null;
    vehicleLabel: string | null;
    isAcceptingOffers: boolean;
};

export type SupportTicketListItem = {
    id: string;
    userName: string;
    tripId: string | null;
    category: string;
    status: string;
    createdAt: string;
    subject: string;
};

export type SupportTicketDetail = {
    ticket: {
        id: string;
        subject: string;
        description: string;
        category: string;
        status: string;
        createdAt: string;
        tripId: string | null;
        userName: string;
        userId: string;
    } | null;
    messages: Array<{
        id: string;
        senderUserId: string;
        senderName: string;
        messageBody: string;
        createdAt: string;
        isInternal: boolean;
    }>;
};

export type AnnouncementItem = {
    id: string;
    title: string;
    body: string;
    audience: string;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
    createdAt: string;
    createdByName: string | null;
};

export type StaffListItem = {
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
    lastLogin: string | null;
};

export type AdminCustomerListItem = {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    status: string;
    createdAt: string;
};

export type AdminInboxNotification = {
    id: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string;
    recipientName: string | null;
    link: string;
};

export type DashboardOverview = {
    stats: DashboardStat[];
    tripsPerDay: DashboardBarPoint[];
    tripsPerCity: DashboardBarPoint[];
    driverActivity: DashboardStatusPoint[];
    tripStatusDistribution: DashboardStatusPoint[];
    activeTrips: DispatchTripItem[];
    isDegraded: boolean;
    degradedReason: string | null;
    generatedAt: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || "";
const ADMIN_DB_PROTECT_MODE = process.env.ADMIN_DB_PROTECT_MODE === "true";
const ADMIN_QUERY_TIMEOUT_MS = Math.max(2500, Number(process.env.ADMIN_QUERY_TIMEOUT_MS || 7000));
const DASHBOARD_OVERVIEW_CACHE_TTL_MS = Math.max(30000, Number(process.env.ADMIN_DASHBOARD_CACHE_TTL_MS || 300000));
const DISPATCH_BOARD_CACHE_TTL_MS = Math.max(10000, Number(process.env.ADMIN_DISPATCH_BOARD_CACHE_TTL_MS || 45000));
const ADMIN_LIST_CACHE_TTL_MS = Math.max(5000, Number(process.env.ADMIN_LIST_CACHE_TTL_MS || 15000));
const ADMIN_LIST_CACHE_MAX_ENTRIES = Math.max(20, Number(process.env.ADMIN_LIST_CACHE_MAX_ENTRIES || 80));
let dashboardOverviewCache: DashboardOverview | null = null;
let dashboardOverviewCacheAt = 0;
let dispatchBoardCache: DispatchBoardData | null = null;
let dispatchBoardCacheAt = 0;
const tripsListCache = new Map<string, { value: AdminTripListItem[]; at: number }>();
const driversListCache = new Map<string, { value: AdminDriverListItem[]; at: number }>();

function getCachedList<T>(cache: Map<string, { value: T; at: number }>, key: string): T | null {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > ADMIN_LIST_CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return hit.value;
}

function setCachedList<T>(cache: Map<string, { value: T; at: number }>, key: string, value: T) {
    cache.set(key, { value, at: Date.now() });
    if (cache.size <= ADMIN_LIST_CACHE_MAX_ENTRIES) return;

    const oldest = [...cache.entries()].sort((left, right) => left[1].at - right[1].at);
    const overflow = cache.size - ADMIN_LIST_CACHE_MAX_ENTRIES;
    for (let i = 0; i < overflow; i += 1) {
        cache.delete(oldest[i][0]);
    }
}

function createAdminClient() {
    if (ADMIN_DB_PROTECT_MODE) return null;
    if (!supabaseUrl || !serviceRoleKey) return null;
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

function startOfTodayIso() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    return start.toISOString();
}

function daysAgoIso(days: number) {
    const value = new Date();
    value.setUTCDate(value.getUTCDate() - days);
    return value.toISOString();
}

function cityFromAddress(value: string | null | undefined) {
    if (!value) return null;
    return value.split(",")[0]?.trim() || null;
}

function normalizeTripRequestSource(value: unknown): "manual" | "map" {
    const raw = String(value || "")
        .trim()
        .toLowerCase();

    if (
        raw === "manual" ||
        raw === "manual_request" ||
        raw === "manual_text" ||
        raw === "typed" ||
        raw === "text" ||
        raw === "name"
    ) {
        return "manual";
    }

    return "map";
}

const CITY_COORDINATES: Record<string, [number, number]> = {
    cairo: [30.0444, 31.2357],
    "new cairo": [30.03, 31.47],
    giza: [30.0131, 31.2089],
    alexandria: [31.2001, 29.9187],
    mansoura: [31.0409, 31.3785],
    tanta: [30.7865, 31.0004],
    maadi: [29.9602, 31.2569],
    mokattam: [30.0081, 31.3031],
    nasr: [30.0561, 31.3302],
    dokki: [30.0384, 31.2122],
    heliopolis: [30.0965, 31.3307],
    shoubra: [30.1241, 31.2443],
    zagazig: [30.5877, 31.502],
    portsaid: [31.2653, 32.3019],
    suez: [29.9668, 32.5498],
    ismailia: [30.5965, 32.2715],
    asyut: [27.1809, 31.1837],
    sohag: [26.5591, 31.6957],
};

function normalizeCityKey(value: string | null | undefined) {
    if (!value) return null;
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/مدينة /g, "")
        .replace(/القاهرة الجديدة/g, "new cairo")
        .replace(/القاهره الجديده/g, "new cairo")
        .replace(/القاهرة/g, "cairo")
        .replace(/القاهره/g, "cairo")
        .replace(/الجيزة/g, "giza")
        .replace(/الاسكندرية|الإسكندرية/g, "alexandria")
        .replace(/المنصورة/g, "mansoura")
        .replace(/طنطا/g, "tanta")
        .replace(/المعادي/g, "maadi")
        .replace(/المقطم/g, "mokattam")
        .replace(/مدينة نصر/g, "nasr")
        .replace(/الدقي/g, "dokki")
        .replace(/مصر الجديدة/g, "heliopolis")
        .replace(/شبرا/g, "shoubra")
        .replace(/الزقازيق/g, "zagazig")
        .replace(/بورسعيد/g, "portsaid")
        .replace(/السويس/g, "suez")
        .replace(/الإسماعيلية|الاسماعيلية/g, "ismailia")
        .replace(/أسيوط|اسيوط/g, "asyut")
        .replace(/سوهاج/g, "sohag");
}

function getCityHintLocation(city: string | null | undefined): DispatchLocationPoint | null {
    const key = normalizeCityKey(city);
    if (!key) return null;
    const coords = CITY_COORDINATES[key];
    if (!coords) return null;
    return {
        latitude: coords[0],
        longitude: coords[1],
        source: "city_hint",
    };
}

function toFiniteNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function buildPoint(latitude: unknown, longitude: unknown, source: DispatchLocationPoint["source"], updatedAt?: unknown): DispatchLocationPoint | null {
    const lat = toFiniteNumber(latitude);
    const lng = toFiniteNumber(longitude);
    if (lat === null || lng === null) return null;
    return {
        latitude: lat,
        longitude: lng,
        source,
        updatedAt: typeof updatedAt === "string" ? updatedAt : null,
    };
}

function minutesSince(timestamp: string | null | undefined) {
    if (!timestamp) return null;
    const value = new Date(timestamp).getTime();
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.round((Date.now() - value) / 60000));
}

function computeQueueSla(ageMinutes: number, awaitingAdminDispatch: boolean): { state: DispatchSlaState; label: string } {
    if (awaitingAdminDispatch || ageMinutes >= 8) {
        return { state: "breached", label: awaitingAdminDispatch ? "يحتاج تدخل تشغيلي" : "متأخر في التوزيع" };
    }
    if (ageMinutes >= 4) {
        return { state: "warning", label: "تأخير يحتاج متابعة" };
    }
    return { state: "healthy", label: "داخل الزمن الطبيعي" };
}

function computeLiveSla(status: string, ageMinutes: number, captainEtaMinutes: number | null): { state: DispatchSlaState; label: string } {
    if (status === "driver_arrived") {
        return { state: "healthy", label: "الكابتن وصل لنقطة التحرك" };
    }
    if (status === "trip_started") {
        return { state: "healthy", label: "المشوار شغال حاليًا" };
    }
    if (captainEtaMinutes !== null && captainEtaMinutes > 20) {
        return { state: "warning", label: "ETA مرتفع لنقطة التحرك" };
    }
    if (ageMinutes >= 25) {
        return { state: "breached", label: "الرحلة متأخرة تشغيليًا" };
    }
    return { state: "healthy", label: "الحركة مستقرة" };
}

async function withQueryTimeout<T>(
    promise: PromiseLike<T>,
    fallback: T,
    onFallback?: () => void
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let fallbackReported = false;
    const reportFallback = () => {
        if (fallbackReported) return;
        fallbackReported = true;
        onFallback?.();
    };
    const timeoutPromise = new Promise<T>((resolve) => {
        timer = setTimeout(() => {
            reportFallback();
            resolve(fallback);
        }, ADMIN_QUERY_TIMEOUT_MS);
    });

    try {
        return await Promise.race([Promise.resolve(promise), timeoutPromise]);
    } catch {
        reportFallback();
        return fallback;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function loadProfilesMap(ids: string[]) {
    const supabase = createAdminClient();
    if (!supabase || ids.length === 0) return new Map<string, Json>();

    const uniqueIds = [...new Set(ids.filter(Boolean))];
    const { data } = await withQueryTimeout(
        supabase
            .from("profiles")
            .select("id, full_name, phone, email, account_status")
            .in("id", uniqueIds),
        { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
    );

    return new Map((data || []).map((row) => [row.id as string, row as Json]));
}

function buildEmptyDashboardOverview(reason: string): DashboardOverview {
    return {
        stats: [] as DashboardStat[],
        tripsPerDay: [] as DashboardBarPoint[],
        tripsPerCity: [] as DashboardBarPoint[],
        driverActivity: [] as DashboardStatusPoint[],
        tripStatusDistribution: [] as DashboardStatusPoint[],
        activeTrips: [] as DispatchTripItem[],
        isDegraded: true,
        degradedReason: reason,
        generatedAt: new Date().toISOString(),
    };
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
    const emptyOverview = buildEmptyDashboardOverview(
        ADMIN_DB_PROTECT_MODE
            ? "وضع حماية قاعدة البيانات مُفعل مؤقتًا لتخفيف الضغط."
            : "تعذر تحميل الإحصائيات الآن بسبب ضغط قاعدة البيانات."
    );
    const now = Date.now();
    const cacheIsFresh = dashboardOverviewCache && now - dashboardOverviewCacheAt < DASHBOARD_OVERVIEW_CACHE_TTL_MS;

    const supabase = createAdminClient();
    if (!supabase) {
        return cacheIsFresh
            ? { ...dashboardOverviewCache!, isDegraded: true, degradedReason: "عرض آخر لقطة محفوظة: الاتصال بقاعدة البيانات غير متاح حاليًا." }
            : emptyOverview;
    }

    try {
        let degraded = false;
        const todayIso = startOfTodayIso();
        const last14DaysIso = daysAgoIso(13);

        const [recentTripsResult, driverProfilesResult, supportTicketsResult] = await Promise.all([
            withQueryTimeout(
                supabase
                    .from("trips")
                    .select("id, status, created_at, completed_at, pickup_address, pickup_label, destination_label, customer_id, trip_type")
                    .gte("created_at", last14DaysIso)
                    .order("created_at", { ascending: true })
                    .limit(600),
                { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" },
                () => {
                    degraded = true;
                }
            ),
            withQueryTimeout(
                supabase
                    .from("driver_profiles")
                    .select("availability_status, application_status")
                    .order("created_at", { ascending: false })
                    .limit(600),
                { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" },
                () => {
                    degraded = true;
                }
            ),
            withQueryTimeout(
                supabase
                    .from("support_tickets")
                    .select("status, created_at")
                    .gte("created_at", daysAgoIso(30))
                    .order("created_at", { ascending: false })
                    .limit(500),
                { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" },
                () => {
                    degraded = true;
                }
            ),
        ]);

        const recentTrips = (recentTripsResult.data || []) as Array<Record<string, unknown>>;
        const driverRows = (driverProfilesResult.data || []) as Array<Record<string, unknown>>;
        const supportRows = (supportTicketsResult.data || []) as Array<Record<string, unknown>>;

        if (recentTrips.length === 0 && driverRows.length === 0 && cacheIsFresh) {
            return {
                ...dashboardOverviewCache!,
                isDegraded: true,
                degradedReason: "تعذر تحديث الأرقام الآن، وتم عرض آخر لقطة ناجحة.",
                generatedAt: new Date().toISOString(),
            };
        }

        const activeStatuses = new Set(["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return"]);
        const dashboardStatuses = new Set(["pending", "searching_driver", "offered", "accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return"]);
        const openTicketStatuses = new Set(["open", "in_progress", "waiting_user"]);

        let tripsToday = 0;
        let tripsInProgress = 0;
        let completedToday = 0;
        let cancelledTrips = 0;
        const dayMap = new Map<string, number>();
        const cityMap = new Map<string, number>();
        const statusMap = new Map<string, number>();

        for (const trip of recentTrips) {
            const createdAt = String(trip.created_at || "");
            const status = String(trip.status || "");

            if (createdAt >= todayIso) tripsToday += 1;
            if (activeStatuses.has(status)) tripsInProgress += 1;
            if (status === "cancelled") cancelledTrips += 1;
            if (status === "completed" && String(trip.completed_at || "") >= todayIso) completedToday += 1;

            const dateKey = new Date(createdAt).toLocaleDateString("en-CA");
            dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);

            const city = cityFromAddress((trip.pickup_address as string | null) || (trip.pickup_label as string | null));
            if (city) cityMap.set(city, (cityMap.get(city) || 0) + 1);

            statusMap.set(status, (statusMap.get(status) || 0) + 1);
        }

        const driverStatusMap = new Map<string, number>();
        let activeDrivers = 0;
        let onlineDrivers = 0;
        let pendingApprovals = 0;

        for (const driver of driverRows) {
            const availabilityStatus = String(driver.availability_status || "busy");
            const applicationStatus = String(driver.application_status || "");

            if (applicationStatus === "approved") activeDrivers += 1;
            if (availabilityStatus === "available") onlineDrivers += 1;
            if (applicationStatus === "pending" || applicationStatus === "requires_review") pendingApprovals += 1;

            driverStatusMap.set(availabilityStatus, (driverStatusMap.get(availabilityStatus) || 0) + 1);
        }

        let openTickets = 0;
        for (const ticket of supportRows) {
            const status = String(ticket.status || "");
            if (openTicketStatuses.has(status)) openTickets += 1;
        }

        const activeTrips = recentTrips
            .filter((trip) => dashboardStatuses.has(String(trip.status || "")))
            .slice(-6)
            .reverse()
            .map((trip) => ({
                id: String(trip.id),
                customerName: "عميل",
                pickup: String(trip.pickup_label || trip.pickup_address || "نقطة الانطلاق"),
                destination: String(trip.destination_label || "الوجهة"),
                tripType: String(trip.trip_type || "normal_ride"),
                status: String(trip.status || "pending"),
                createdAt: String(trip.created_at || new Date().toISOString()),
            }));

        const stats: DashboardStat[] = [
            { label: "Total trips today", value: tripsToday, tone: "primary", hint: "طلبات اليوم من أول اليوم لحد دلوقتي" },
            { label: "Trips in progress", value: tripsInProgress, tone: "info", hint: "المشاوير اللي شغالة حاليًا" },
            { label: "Completed today", value: completedToday, tone: "success", hint: "مشاوير خلصت النهارده" },
            { label: "Cancelled trips", value: cancelledTrips, tone: "danger", hint: "إجمالي المشاوير الملغية" },
            { label: "Active drivers", value: activeDrivers, tone: "primary", hint: "الكباتن الموافق عليهم" },
            { label: "Online drivers", value: onlineDrivers, tone: "success", hint: "الكباتن الجاهزين حاليًا" },
            { label: "Pending approvals", value: pendingApprovals, tone: "warning", hint: "طلبات كباتن مستنية مراجعة" },
            { label: "Open tickets", value: openTickets, tone: "warning", hint: "تذاكر الدعم المفتوحة" },
        ];

        const overview: DashboardOverview = {
            stats,
            tripsPerDay: [...dayMap.entries()].map(([label, value]) => ({ label, value })),
            tripsPerCity: [...cityMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })),
            driverActivity: [...driverStatusMap.entries()].map(([status, value]) => ({ label: status.replaceAll("_", " "), value, status })),
            tripStatusDistribution: [...statusMap.entries()].map(([status, value]) => ({ label: status.replaceAll("_", " "), value, status })),
            activeTrips,
            isDegraded: degraded,
            degradedReason: degraded ? "تم تحميل الأرقام من وضع خفيف بسبب ضغط قاعدة البيانات." : null,
            generatedAt: new Date().toISOString(),
        };

        dashboardOverviewCache = overview;
        dashboardOverviewCacheAt = Date.now();
        return overview;
    } catch {
        return cacheIsFresh
            ? { ...dashboardOverviewCache!, isDegraded: true, degradedReason: "تعذر تحديث الأرقام الآن، وتم عرض آخر لقطة ناجحة." }
            : emptyOverview;
    }
}

export async function fetchTripsList(filters: {
    status?: string;
    tripType?: string;
    city?: string;
    driverId?: string;
    manualMode?: string;
    from?: string;
    to?: string;
}) {
    const cacheKey = JSON.stringify({
        status: filters.status || "all",
        tripType: filters.tripType || "all",
        city: filters.city || "",
        driverId: filters.driverId || "all",
        manualMode: filters.manualMode || "all",
        from: filters.from || "",
        to: filters.to || "",
    });
    const cached = getCachedList(tripsListCache, cacheKey);
    if (cached) return cached;

    const supabase = createAdminClient();
    if (!supabase) return [] as AdminTripListItem[];

    let query = supabase
        .from("trips")
        .select("id, customer_id, assigned_driver_id, trip_type, pickup_label, pickup_address, destination_label, status, created_at, passenger_count, luggage_count, metadata")
        .order("created_at", { ascending: false })
        .limit(100);

    if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.tripType && filters.tripType !== "all") query = query.eq("trip_type", filters.tripType);
    if (filters.driverId && filters.driverId !== "all") query = query.eq("assigned_driver_id", filters.driverId);
    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lte("created_at", filters.to);
    if (filters.city) query = query.ilike("pickup_address", `%${filters.city}%`);

    const { data } = await withQueryTimeout(
        query,
        { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
    );
    let rows = (data || []) as Array<Record<string, unknown>>;

    if (filters.manualMode === "manual") {
        rows = rows.filter(
            (row) =>
                normalizeTripRequestSource(
                    (row.metadata as Record<string, unknown> | null)?.request_source
                ) === "manual"
        );
    } else if (filters.manualMode === "map") {
        rows = rows.filter(
            (row) =>
                normalizeTripRequestSource(
                    (row.metadata as Record<string, unknown> | null)?.request_source
                ) !== "manual"
        );
    }
    const profilesMap = await loadProfilesMap(rows.flatMap((row) => [String(row.customer_id), String(row.assigned_driver_id || "")]));

    const result = rows.map((row) => ({
        id: String(row.id),
        customerName: String((profilesMap.get(String(row.customer_id))?.full_name as string) || "عميل"),
        driverName: row.assigned_driver_id ? String((profilesMap.get(String(row.assigned_driver_id))?.full_name as string) || "كابتن") : null,
        tripType: String(row.trip_type),
        pickup: String(row.pickup_label || row.pickup_address || "من"),
        destination: String(row.destination_label || "إلى"),
        status: String(row.status),
        createdAt: String(row.created_at),
        city: cityFromAddress(row.pickup_address as string | null),
        passengerCount: Number(row.passenger_count || 1),
        luggageCount: Number(row.luggage_count || 0),
        requestSource: normalizeTripRequestSource(
            (row.metadata as Record<string, unknown> | null)?.request_source
        ),
    }));

    setCachedList(tripsListCache, cacheKey, result);
    return result;
}

export async function fetchTripDetail(id: string) {
    const supabase = createAdminClient();
    if (!supabase) return null as AdminTripDetail | null;

    const { data: trip } = await withQueryTimeout(
        supabase
            .from("trips")
            .select("*")
            .eq("id", id)
            .maybeSingle(),
        { data: null as any, error: null, count: null, status: 200, statusText: "OK" }
    );

    if (!trip) return null;

    const [{ data: customer }, { data: driverProfile }, { data: vehicle }, { data: offers }, { data: history }, { data: review }] = await Promise.all([
        withQueryTimeout(
            supabase.from("profiles").select("id, full_name, phone, email").eq("id", trip.customer_id).maybeSingle(),
            { data: null as any, error: null, count: null, status: 200, statusText: "OK" }
        ),
        trip.assigned_driver_id
            ? withQueryTimeout(
                  supabase.from("driver_profiles").select("id, working_city, availability_status").eq("id", trip.assigned_driver_id).maybeSingle(),
                  { data: null as any, error: null, count: null, status: 200, statusText: "OK" }
              )
            : Promise.resolve({ data: null }),
        trip.assigned_vehicle_id
            ? withQueryTimeout(
                  supabase.from("vehicles").select("id, vehicle_type, brand, model, plate_number").eq("id", trip.assigned_vehicle_id).maybeSingle(),
                  { data: null as any, error: null, count: null, status: 200, statusText: "OK" }
              )
            : Promise.resolve({ data: null }),
        withQueryTimeout(
            supabase.from("trip_offers").select("id, driver_id, vehicle_id, offer_status, offered_at, responded_at, rejection_reason").eq("trip_id", id).order("offered_at", { ascending: false }),
            { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
        ),
        withQueryTimeout(
            supabase.from("trip_status_history").select("id, status, note, changed_by, created_at").eq("trip_id", id).order("created_at", { ascending: true }),
            { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
        ),
        withQueryTimeout(
            supabase.from("trip_reviews").select("id, rating, comment, created_at, customer_id, driver_id").eq("trip_id", id).maybeSingle(),
            { data: null as any, error: null, count: null, status: 200, statusText: "OK" }
        ),
    ]);

    const offerDriverIds = (offers || []).map((offer) => String(offer.driver_id));
    const historyActorIds = (history || []).map((entry) => String(entry.changed_by || ""));
    const extraIds = [String(trip.assigned_driver_id || ""), ...offerDriverIds, ...historyActorIds].filter(Boolean);
    const profilesMap = await loadProfilesMap(extraIds);

    return {
        trip: {
            id: String(trip.id),
            status: String(trip.status),
            tripType: String(trip.trip_type),
            pickupLabel: String(trip.pickup_label || "من"),
            pickupAddress: String(trip.pickup_address || ""),
            destinationLabel: String(trip.destination_label || "إلى"),
            destinationAddress: String(trip.destination_address || ""),
            passengerCount: Number(trip.passenger_count || 1),
            luggageCount: Number(trip.luggage_count || 0),
            riderNotes: (trip.rider_notes as string | null) || null,
            airportName: (trip.airport_name as string | null) || null,
            airportTerminal: (trip.airport_terminal as string | null) || null,
            airportRideMode: (trip.airport_ride_mode as string | null) || null,
            flightNumber: (trip.flight_number as string | null) || null,
            flightTime: (trip.flight_time as string | null) || null,
            airportDepartureTime: (trip.metadata?.airport_departure_time as string | null) || null,
            airportDepartureLabel: (trip.metadata?.airport_departure_label as string | null) || null,
            estimatedPrice: trip.estimated_price === null ? null : Number(trip.estimated_price),
            mapEstimatedPrice: trip.metadata?.map_estimated_price === undefined || trip.metadata?.map_estimated_price === null ? null : Number(trip.metadata.map_estimated_price),
            adminSelectedPrice: trip.metadata?.admin_selected_price === undefined || trip.metadata?.admin_selected_price === null ? null : Number(trip.metadata.admin_selected_price),
            customerPriceConfirmed: trip.metadata?.customer_price_confirmed === true,
            actualPrice: trip.actual_price === null ? null : Number(trip.actual_price),
            createdAt: String(trip.created_at),
            requestedAt: String(trip.requested_at),
            acceptedAt: (trip.accepted_at as string | null) || null,
            completedAt: (trip.completed_at as string | null) || null,
            cancelledAt: (trip.cancelled_at as string | null) || null,
            cancellationReason: (trip.cancellation_reason as string | null) || null,
            adminNotes: (trip.admin_notes as string | null) || null,
        },
        customer: customer
            ? {
                  id: String(customer.id),
                  fullName: String(customer.full_name || "عميل"),
                  phone: (customer.phone as string | null) || null,
                  email: (customer.email as string | null) || null,
              }
            : null,
        driver: driverProfile
            ? {
                  id: String(driverProfile.id),
                  fullName: String((profilesMap.get(String(driverProfile.id))?.full_name as string) || "كابتن"),
                  phone: (profilesMap.get(String(driverProfile.id))?.phone as string | null) || null,
                  workingCity: (driverProfile.working_city as string | null) || null,
                  availabilityStatus: (driverProfile.availability_status as string | null) || null,
              }
            : null,
        vehicle: vehicle
            ? {
                  id: String(vehicle.id),
                  label: `${String(vehicle.brand)} ${String(vehicle.model)}`,
                  plateNumber: (vehicle.plate_number as string | null) || null,
                  vehicleType: String(vehicle.vehicle_type),
              }
            : null,
        offers: (offers || []).map((offer) => ({
            id: String(offer.id),
            driverId: String(offer.driver_id),
            driverName: String((profilesMap.get(String(offer.driver_id))?.full_name as string) || "كابتن"),
            vehicleLabel: null,
            offerStatus: String(offer.offer_status),
            offeredAt: String(offer.offered_at),
            respondedAt: (offer.responded_at as string | null) || null,
            rejectionReason: (offer.rejection_reason as string | null) || null,
        })),
        timeline: (history || []).map((entry) => ({
            id: Number(entry.id),
            status: String(entry.status),
            note: (entry.note as string | null) || null,
            createdAt: String(entry.created_at),
            changedByName: entry.changed_by ? String((profilesMap.get(String(entry.changed_by))?.full_name as string) || "System") : "System",
        })),
        review: review
            ? {
                  rating: Number(review.rating || 0),
                  comment: (review.comment as string | null) || null,
                  createdAt: String(review.created_at),
                  customerName: String(customer?.full_name || "عميل"),
                  driverName: String((profilesMap.get(String(review.driver_id))?.full_name as string) || "كابتن"),
              }
            : null,
    };
}

export async function fetchDriversList(filters: {
    approvalStatus?: string;
    vehicleType?: string;
    city?: string;
    availabilityStatus?: string;
}) {
    const cacheKey = JSON.stringify({
        approvalStatus: filters.approvalStatus || "all",
        vehicleType: filters.vehicleType || "all",
        city: filters.city || "",
        availabilityStatus: filters.availabilityStatus || "all",
    });
    const cached = getCachedList(driversListCache, cacheKey);
    if (cached) return cached;

    const supabase = createAdminClient();
    if (!supabase) return [] as AdminDriverListItem[];

    let query = supabase
        .from("driver_profiles")
        .select("id, application_status, verification_status, availability_status, working_city, working_area")
        .order("created_at", { ascending: false })
        .limit(100);

    if (filters.approvalStatus && filters.approvalStatus !== "all") query = query.eq("application_status", filters.approvalStatus);
    if (filters.city) query = query.ilike("working_city", `%${filters.city}%`);
    // التواجد النهائي بيتحسب لاحقًا من حالة الرحلات الفعلية، علشان نقدر نميز الكابتن المشغول.

    const { data } = await withQueryTimeout(
        query,
        { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
    );
    let rows = (data || []) as Array<Record<string, unknown>>;

    const driverIds = rows.map((row) => String(row.id));
    const [profilesMap, vehiclesResult, tripsResult] = await Promise.all([
        withQueryTimeout(loadProfilesMap(driverIds), new Map<string, Json>()),
        withQueryTimeout(
            supabase.from("vehicles").select("id, driver_id, vehicle_type, is_primary, is_active, approval_status").in("driver_id", driverIds),
            { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
        ),
        withQueryTimeout(
            supabase.from("trips").select("assigned_driver_id, status").in("assigned_driver_id", driverIds),
            { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
        ),
    ]);

    const { data: freshDriverRows } = await withQueryTimeout(
        supabase
            .from("driver_profiles")
            .select("id, is_accepting_offers")
            .in("id", driverIds),
        { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
    );

    const { data: openOffers } = await withQueryTimeout(
        supabase
            .from("trip_offers")
            .select("driver_id, offer_status, expires_at")
            .in("driver_id", driverIds)
            .eq("offer_status", "offered")
            .gt("expires_at", new Date().toISOString()),
        { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
    );

    const vehicleMap = new Map<string, string>();
    const vehicleReadyMap = new Map<string, boolean>();
    for (const vehicle of vehiclesResult.data || []) {
        if (vehicle.is_primary || !vehicleMap.has(String(vehicle.driver_id))) {
            vehicleMap.set(String(vehicle.driver_id), String(vehicle.vehicle_type));
            vehicleReadyMap.set(
                String(vehicle.driver_id),
                vehicle.is_active === true && String(vehicle.approval_status || "") === "approved"
            );
        }
    }

    const completedTripsMap = new Map<string, number>();
    const activeTripMap = new Map<string, boolean>();
    for (const trip of tripsResult.data || []) {
        if (trip.status === "completed" && trip.assigned_driver_id) {
            const key = String(trip.assigned_driver_id);
            completedTripsMap.set(key, (completedTripsMap.get(key) || 0) + 1);
        }
        if (
            trip.assigned_driver_id &&
            ["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return"].includes(String(trip.status))
        ) {
            activeTripMap.set(String(trip.assigned_driver_id), true);
        }
    }

    const acceptingOffersMap = new Map<string, boolean>();
    for (const driver of freshDriverRows || []) {
        acceptingOffersMap.set(String(driver.id), Boolean(driver.is_accepting_offers));
    }

    const openOfferMap = new Map<string, boolean>();
    for (const offer of openOffers || []) {
        if (offer.driver_id) {
            openOfferMap.set(String(offer.driver_id), true);
        }
    }

    const result = rows
        .filter((row) => !filters.vehicleType || filters.vehicleType === "all" || vehicleMap.get(String(row.id)) === filters.vehicleType)
        .map((row) => {
            const driverId = String(row.id);
            const rawAvailability = String(row.availability_status);
            const accountStatus = String((profilesMap.get(driverId)?.account_status as string) || "active");
            const hasActiveTrip = activeTripMap.get(driverId) === true;
            const hasOpenOffer = openOfferMap.get(driverId) === true;
            const isAcceptingOffers = acceptingOffersMap.get(driverId) !== false;
            const vehicleReady = vehicleReadyMap.get(driverId) === true;

            let dispatchBlockReason: string | null = null;
            if (accountStatus !== "active") dispatchBlockReason = "الحساب غير نشط";
            else if (String(row.application_status) !== "approved" || String(row.verification_status) !== "approved") dispatchBlockReason = "المراجعة غير مكتملة";
            else if (!vehicleMap.get(driverId)) dispatchBlockReason = "مفيش مركبة أساسية";
            else if (!vehicleReady) dispatchBlockReason = "المركبة غير جاهزة";
            else if (hasActiveTrip) dispatchBlockReason = "مشغول في رحلة";
            else if (hasOpenOffer) dispatchBlockReason = "عنده عرض مفتوح";

            const dispatchReady = dispatchBlockReason === null;
            const effectiveAvailability = dispatchReady ? "available" : "busy";

            return {
                id: driverId,
                fullName: String((profilesMap.get(driverId)?.full_name as string) || "كابتن"),
                phone: (profilesMap.get(driverId)?.phone as string | null) || null,
                city: (row.working_city as string | null) || null,
                area: (row.working_area as string | null) || null,
                availabilityStatus: effectiveAvailability,
                dispatchReady,
                dispatchBlockReason,
                applicationStatus: String(row.application_status),
                verificationStatus: String(row.verification_status),
                vehicleType: vehicleMap.get(driverId) || null,
                tripsCompleted: completedTripsMap.get(driverId) || 0,
                accountStatus,
            };
        })
        .filter((row) => !filters.availabilityStatus || filters.availabilityStatus === "all" || row.availabilityStatus === filters.availabilityStatus);

    setCachedList(driversListCache, cacheKey, result);
    return result;
}

export async function fetchDriverDetail(id: string) {
    const supabase = createAdminClient();
    if (!supabase) return null as AdminDriverDetail | null;

    const [{ data: driverProfile }, { data: profile }, { data: vehicles }, { data: documents }, { data: trips }, { data: reviews }, authUserResult] = await Promise.all([
        withQueryTimeout(
            supabase.from("driver_profiles").select("*").eq("id", id).maybeSingle(),
            { data: null as any, error: null, count: null, status: 200, statusText: "OK" }
        ),
        withQueryTimeout(
            supabase.from("profiles").select("id, full_name, phone, email, account_status").eq("id", id).maybeSingle(),
            { data: null as any, error: null, count: null, status: 200, statusText: "OK" }
        ),
        withQueryTimeout(
            supabase.from("vehicles").select("id, vehicle_type, brand, model, plate_number, approval_status, is_primary").eq("driver_id", id).order("is_primary", { ascending: false }),
            { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
        ),
        withQueryTimeout(
            supabase.from("driver_documents").select("id, document_type, approval_status, file_name, storage_bucket, storage_path, created_at").eq("driver_id", id).order("created_at", { ascending: false }),
            { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
        ),
        withQueryTimeout(
            supabase.from("trips").select("id, customer_id, assigned_driver_id, trip_type, pickup_label, pickup_address, destination_label, status, created_at, passenger_count, luggage_count, metadata").eq("assigned_driver_id", id).order("created_at", { ascending: false }).limit(8),
            { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
        ),
        withQueryTimeout(
            supabase.from("trip_reviews").select("id, trip_id, customer_id, rating, comment, created_at").eq("driver_id", id).order("created_at", { ascending: false }).limit(12),
            { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
        ),
        withQueryTimeout(
            supabase.auth.admin.getUserById(id),
            { data: { user: null } as any, error: null }
        ),
    ]);

    const tripProfilesMap = await loadProfilesMap([...(trips || []).map((trip) => String(trip.customer_id)), ...(reviews || []).map((review) => String(review.customer_id))]);
    const authUser = authUserResult.data?.user || null;

    return {
        profile: profile
            ? {
                  id: String(profile.id),
                  fullName: String(profile.full_name || "كابتن"),
                  phone: (profile.phone as string | null) || null,
                  email: (profile.email as string | null) || null,
                  accountStatus: String(profile.account_status || "active"),
              }
            : null,
        driverProfile: driverProfile
            ? {
                  applicationStatus: String(driverProfile.application_status),
                  verificationStatus: String(driverProfile.verification_status),
                  availabilityStatus:
                      String(profile?.account_status || "active") !== "active" ||
                      String(driverProfile.application_status || "") !== "approved" ||
                      String(driverProfile.verification_status || "") !== "approved" ||
                      (trips || []).some((trip) => ["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return"].includes(String(trip.status)))
                          ? "busy"
                          : "available",
                  workingCity: String(driverProfile.working_city || ""),
                  workingArea: (driverProfile.working_area as string | null) || null,
                  operationalNotes: (driverProfile.operational_notes as string | null) || null,
                  suspensionReason: (driverProfile.suspension_reason as string | null) || null,
                  approvedAt: (driverProfile.approved_at as string | null) || null,
              }
            : null,
        vehicles: (vehicles || []).map((vehicle) => ({
            id: String(vehicle.id),
            label: `${String(vehicle.brand)} ${String(vehicle.model)}`,
            vehicleType: String(vehicle.vehicle_type),
            approvalStatus: String(vehicle.approval_status),
            plateNumber: (vehicle.plate_number as string | null) || null,
            isPrimary: Boolean(vehicle.is_primary),
        })),
        documents: (documents || []).map((doc) => ({
            id: String(doc.id),
            documentType: String(doc.document_type),
            approvalStatus: String(doc.approval_status),
            fileName: (doc.file_name as string | null) || null,
            storageBucket: String(doc.storage_bucket),
            storagePath: String(doc.storage_path),
            createdAt: String(doc.created_at),
        })),
        recentTrips: (trips || []).map((trip) => ({
            id: String(trip.id),
            customerName: String((tripProfilesMap.get(String(trip.customer_id))?.full_name as string) || "عميل"),
            driverName: profile ? String(profile.full_name || "كابتن") : null,
            tripType: String(trip.trip_type),
            pickup: String(trip.pickup_label || trip.pickup_address || "من"),
            destination: String(trip.destination_label || "إلى"),
            status: String(trip.status),
            createdAt: String(trip.created_at),
            city: cityFromAddress(trip.pickup_address as string | null),
            passengerCount: Number(trip.passenger_count || 1),
            luggageCount: Number(trip.luggage_count || 0),
        })),
        authAccount: {
            exists: Boolean(authUser),
            email: authUser?.email || null,
            lastSignInAt: authUser?.last_sign_in_at || null,
        },
        recentReviews: (reviews || []).map((review) => {
            const relatedTrip = (trips || []).find((trip) => String(trip.id) === String(review.trip_id));
            return {
                id: String(review.id),
                rating: Number(review.rating || 0),
                comment: (review.comment as string | null) || null,
                createdAt: String(review.created_at),
                customerName: String((tripProfilesMap.get(String(review.customer_id))?.full_name as string) || "عميل"),
                tripId: String(review.trip_id),
                pickup: String(relatedTrip?.pickup_label || relatedTrip?.pickup_address || "من"),
                destination: String(relatedTrip?.destination_label || "إلى"),
            };
        }),
    };
}

export async function fetchVehiclesList() {
    const supabase = createAdminClient();
    if (!supabase) return [] as AdminVehicleListItem[];

    const { data: vehicles } = await withQueryTimeout(
        supabase
            .from("vehicles")
            .select("id, driver_id, vehicle_type, brand, model, plate_number, approval_status, is_primary")
            .order("created_at", { ascending: false })
            .limit(100),
        { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
    );

    const profilesMap = await loadProfilesMap((vehicles || []).map((vehicle) => String(vehicle.driver_id)));

    return (vehicles || []).map((vehicle) => ({
        id: String(vehicle.id),
        driverName: String((profilesMap.get(String(vehicle.driver_id))?.full_name as string) || "كابتن"),
        driverId: String(vehicle.driver_id),
        vehicleType: String(vehicle.vehicle_type),
        brand: String(vehicle.brand),
        model: String(vehicle.model),
        plateNumber: (vehicle.plate_number as string | null) || null,
        approvalStatus: String(vehicle.approval_status),
        isPrimary: Boolean(vehicle.is_primary),
    }));
}

export async function fetchDispatchBoard(): Promise<DispatchBoardData> {
    const now = Date.now();
    const cacheIsFresh = dispatchBoardCache && now - dispatchBoardCacheAt < DISPATCH_BOARD_CACHE_TTL_MS;
    if (cacheIsFresh) return dispatchBoardCache!;

    const emptyBoard: DispatchBoardData = {
        generatedAt: new Date().toISOString(),
        regionOptions: [],
        metrics: {
            queueTripsCount: 0,
            liveTripsCount: 0,
            onlineDriversCount: 0,
            adminRescueCount: 0,
            breachedTripsCount: 0,
        },
        queueTrips: [],
        liveTrips: [],
        availableDrivers: [],
        assignableDrivers: [],
    };

    const supabase = createAdminClient();
    if (!supabase) {
        return dispatchBoardCache || emptyBoard;
    }

    try {
        const nowIso = new Date().toISOString();
        const [
            { data: queueTripsData },
            { data: liveTripsData },
            { data: drivers },
        ] = await withQueryTimeout(
            Promise.all([
                supabase
                    .from("trips")
                    .select("id, customer_id, pickup_label, pickup_address, pickup_latitude, pickup_longitude, destination_label, destination_address, destination_latitude, destination_longitude, trip_type, status, created_at, estimated_price, offered_driver_count, metadata")
                    .in("status", ["pending", "searching_driver", "offered"])
                    .order("created_at", { ascending: false })
                    .limit(40),
                supabase
                    .from("trips")
                    .select("id, customer_id, assigned_driver_id, pickup_label, pickup_address, pickup_latitude, pickup_longitude, destination_label, destination_address, destination_latitude, destination_longitude, trip_type, status, created_at, accepted_at, metadata")
                    .in("status", ["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return"])
                    .order("updated_at", { ascending: false })
                    .limit(50),
                supabase
                    .from("driver_profiles")
                    .select("id, availability_status, working_city, working_area, is_accepting_offers, application_status, verification_status, last_seen_at")
                    .eq("application_status", "approved")
                    .eq("verification_status", "approved")
                    .order("updated_at", { ascending: false })
                    .limit(120),
            ]),
            [
                { data: [] as any[] },
                { data: [] as any[] },
                { data: [] as any[] },
            ] as any
        );

    const queueTripsRows = (queueTripsData || []) as Record<string, unknown>[];
    const liveTripsRows = (liveTripsData || []) as Record<string, unknown>[];
    const driverRows = (drivers || []) as Record<string, unknown>[];
    const driverIds = driverRows.map((driver) => String(driver.id)).filter(Boolean);
    const [{ data: vehicles }, { data: openOffers }] = driverIds.length
        ? await Promise.all([
              supabase
                  .from("vehicles")
                  .select("id, driver_id, vehicle_type, brand, model, is_primary, is_active, approval_status")
                  .in("driver_id", driverIds)
                  .eq("is_active", true)
                  .eq("approval_status", "approved"),
              supabase
                  .from("trip_offers")
                  .select("trip_id, driver_id, offer_status, expires_at")
                  .in("driver_id", driverIds)
                  .eq("offer_status", "offered")
                  .gt("expires_at", nowIso),
          ])
        : [{ data: [] }, { data: [] }];

    const profileIds = [
        ...queueTripsRows.map((trip) => String(trip.customer_id)),
        ...liveTripsRows.map((trip) => String(trip.customer_id)),
        ...liveTripsRows.map((trip) => String(trip.assigned_driver_id || "")),
        ...driverRows.map((driver) => String(driver.id)),
    ].filter(Boolean);
    const profilesMap = await loadProfilesMap(profileIds);

    const primaryVehicleMap = new Map<string, { id: string; label: string }>();
    for (const vehicle of vehicles || []) {
        if (vehicle.is_primary || !primaryVehicleMap.has(String(vehicle.driver_id))) {
            primaryVehicleMap.set(String(vehicle.driver_id), {
                id: String(vehicle.id),
                label: `${String(vehicle.brand)} ${String(vehicle.model)} · ${String(vehicle.vehicle_type)}`,
            });
        }
    }

    const openOfferCounts = new Map<string, number>();
    for (const offer of openOffers || []) {
        const driverId = String(offer.driver_id || "");
        if (!driverId) continue;
        openOfferCounts.set(driverId, (openOfferCounts.get(driverId) || 0) + 1);
    }

    const liveDriverLocationMap = new Map<string, DispatchLocationPoint | null>();
    for (const trip of liveTripsRows) {
        const metadata = ((trip.metadata as Record<string, unknown> | null) || {});
        const rawDriverLocation =
            metadata.driver_location && typeof metadata.driver_location === "object"
                ? (metadata.driver_location as Record<string, unknown>)
                : null;
        const driverLocation = rawDriverLocation
            ? buildPoint(rawDriverLocation.latitude, rawDriverLocation.longitude, "driver_gps", rawDriverLocation.updated_at)
            : null;
        if (trip.assigned_driver_id) {
            liveDriverLocationMap.set(String(trip.assigned_driver_id), driverLocation);
        }
    }

    const queueTrips: DispatchQueueTripItem[] = queueTripsRows.map((trip) => {
        const metadata = ((trip.metadata as Record<string, unknown> | null) || {});
        const ageMinutes = minutesSince(String(trip.created_at)) || 0;
        const awaitingAdminDispatch = metadata.awaiting_admin_dispatch === true;
        const fallbackReason = typeof metadata.marketplace_fallback_reason === "string" ? metadata.marketplace_fallback_reason : null;
        const sla = computeQueueSla(ageMinutes, awaitingAdminDispatch);
        const region =
            (typeof metadata.pickup_city === "string" ? metadata.pickup_city : null) ||
            cityFromAddress((trip.pickup_address as string | null) || (trip.pickup_label as string | null));

        return {
            id: String(trip.id),
            customerName: String((profilesMap.get(String(trip.customer_id))?.full_name as string) || "عميل"),
            pickup: String(trip.pickup_label || trip.pickup_address || "من"),
            destination: String(trip.destination_label || trip.destination_address || "إلى"),
            tripType: String(trip.trip_type),
            status: String(trip.status),
            createdAt: String(trip.created_at),
            estimatedPrice: toFiniteNumber(trip.estimated_price),
            offeredDriverCount: Number(trip.offered_driver_count || 0),
            dispatchMode: typeof metadata.dispatch_mode === "string" ? metadata.dispatch_mode : null,
            awaitingAdminDispatch,
            fallbackReason,
            ageMinutes,
            slaState: sla.state,
            slaLabel: sla.label,
            region,
            pickupLocation: buildPoint(trip.pickup_latitude, trip.pickup_longitude, "pickup"),
            destinationLocation: buildPoint(trip.destination_latitude, trip.destination_longitude, "destination"),
        };
    });

    const liveTrips: DispatchLiveTripItem[] = liveTripsRows.map((trip) => {
        const metadata = ((trip.metadata as Record<string, unknown> | null) || {});
        const ageMinutes = minutesSince(String(trip.accepted_at || trip.created_at)) || 0;
        const captainEtaMinutes =
            toFiniteNumber(metadata.driver_eta_minutes) ??
            toFiniteNumber(metadata.captain_eta_minutes) ??
            toFiniteNumber(metadata.arrival_eta_minutes);
        const sla = computeLiveSla(String(trip.status), ageMinutes, captainEtaMinutes);
        const region =
            (typeof metadata.pickup_city === "string" ? metadata.pickup_city : null) ||
            cityFromAddress((trip.pickup_address as string | null) || (trip.pickup_label as string | null));
        const rawDriverLocation =
            metadata.driver_location && typeof metadata.driver_location === "object"
                ? (metadata.driver_location as Record<string, unknown>)
                : null;

        return {
            id: String(trip.id),
            customerName: String((profilesMap.get(String(trip.customer_id))?.full_name as string) || "عميل"),
            driverId: trip.assigned_driver_id ? String(trip.assigned_driver_id) : null,
            driverName: trip.assigned_driver_id
                ? String((profilesMap.get(String(trip.assigned_driver_id))?.full_name as string) || "كابتن")
                : null,
            driverVehicleLabel: trip.assigned_driver_id ? (primaryVehicleMap.get(String(trip.assigned_driver_id))?.label || null) : null,
            tripType: String(trip.trip_type),
            status: String(trip.status),
            createdAt: String(trip.created_at),
            acceptedAt: (trip.accepted_at as string | null) || null,
            captainEtaMinutes,
            ageMinutes,
            slaState: sla.state,
            slaLabel: sla.label,
            region,
            pickup: String(trip.pickup_label || trip.pickup_address || "من"),
            destination: String(trip.destination_label || trip.destination_address || "إلى"),
            pickupLocation: buildPoint(trip.pickup_latitude, trip.pickup_longitude, "pickup"),
            destinationLocation: buildPoint(trip.destination_latitude, trip.destination_longitude, "destination"),
            driverLocation: rawDriverLocation
                ? buildPoint(rawDriverLocation.latitude, rawDriverLocation.longitude, "driver_gps", rawDriverLocation.updated_at)
                : null,
        };
    });

    const driversWithActiveTrips = new Set(
        liveTripsRows
            .map((trip) => trip.assigned_driver_id)
            .filter(Boolean)
            .map((driverId) => String(driverId))
    );

    const normalizedDrivers: DispatchFleetDriverItem[] = driverRows
        .filter((driver) => {
            const profile = profilesMap.get(String(driver.id));
            return (profile?.account_status as string | undefined) !== "suspended" && primaryVehicleMap.has(String(driver.id));
        })
        .map((driver) => {
            const driverId = String(driver.id);
            const hasActiveTrip = driversWithActiveTrips.has(driverId);
            const hasOpenOffer = (openOfferCounts.get(driverId) || 0) > 0;
            const vehicleReady = primaryVehicleMap.has(driverId);
            const accountStatus = String((profilesMap.get(driverId)?.account_status as string) || "active");
            const reviewReady = String(driver.application_status || "") === "approved" && String(driver.verification_status || "") === "approved";
            const dispatchReady = accountStatus === "active" && reviewReady && vehicleReady && !hasActiveTrip && !hasOpenOffer;
            const location = liveDriverLocationMap.get(driverId) || getCityHintLocation(driver.working_city as string | null);
            return {
                id: driverId,
                fullName: String((profilesMap.get(driverId)?.full_name as string) || "كابتن"),
                availabilityStatus: dispatchReady ? "available" : "busy",
                city: String(driver.working_city || "غير محدد"),
                area: (driver.working_area as string | null) || null,
                vehicleId: primaryVehicleMap.get(driverId)?.id || null,
                vehicleLabel: primaryVehicleMap.get(driverId)?.label || null,
                isAcceptingOffers: Boolean(driver.is_accepting_offers),
                hasActiveTrip,
                hasOpenOffer,
                lastSeenAt: (driver.last_seen_at as string | null) || null,
                locationLabel: location?.source === "city_hint" ? `تقديري من ${String(driver.working_city || "المدينة")}` : "موقع حي",
                location,
            };
        });

    const availableDrivers = normalizedDrivers.filter(
        (driver) =>
            driver.availabilityStatus === "available"
    );

    const regionOptions = Array.from(
        new Set(
            [
                ...queueTrips.map((trip) => trip.region),
                ...liveTrips.map((trip) => trip.region),
                ...normalizedDrivers.map((driver) => driver.city),
            ].filter((value): value is string => Boolean(value && value.trim()))
        )
    ).sort((left, right) => left.localeCompare(right, "ar"));

        const board: DispatchBoardData = {
            generatedAt: new Date().toISOString(),
            regionOptions,
            metrics: {
                queueTripsCount: queueTrips.length,
                liveTripsCount: liveTrips.length,
                onlineDriversCount: normalizedDrivers.filter((driver) => driver.availabilityStatus === "available").length,
                adminRescueCount: queueTrips.filter((trip) => trip.awaitingAdminDispatch).length,
                breachedTripsCount: [...queueTrips, ...liveTrips].filter((trip) => trip.slaState === "breached").length,
            },
            queueTrips,
            liveTrips,
            availableDrivers,
            assignableDrivers: normalizedDrivers,
        };

        dispatchBoardCache = board;
        dispatchBoardCacheAt = Date.now();
        return board;
    } catch {
        return dispatchBoardCache || emptyBoard;
    }
}

export async function fetchSupportTickets() {
    const supabase = createAdminClient();
    if (!supabase) return [] as SupportTicketListItem[];

    const { data } = await supabase
        .from("support_tickets")
        .select("id, created_by, trip_id, category, status, created_at, subject")
        .order("created_at", { ascending: false })
        .limit(100);

    const profilesMap = await loadProfilesMap((data || []).map((ticket) => String(ticket.created_by)));

    return (data || []).map((ticket) => ({
        id: String(ticket.id),
        userName: String((profilesMap.get(String(ticket.created_by))?.full_name as string) || "مستخدم"),
        tripId: (ticket.trip_id as string | null) || null,
        category: String(ticket.category),
        status: String(ticket.status),
        createdAt: String(ticket.created_at),
        subject: String(ticket.subject),
    }));
}

export async function fetchSupportTicketDetail(id: string) {
    const supabase = createAdminClient();
    if (!supabase) return null as SupportTicketDetail | null;

    const [{ data: ticket }, { data: messages }] = await Promise.all([
        supabase.from("support_tickets").select("*").eq("id", id).maybeSingle(),
        supabase.from("support_ticket_messages").select("id, sender_user_id, message_body, created_at, is_internal").eq("ticket_id", id).order("created_at", { ascending: true }),
    ]);

    if (!ticket) return null;
    const profilesMap = await loadProfilesMap([String(ticket.created_by), ...(messages || []).map((message) => String(message.sender_user_id))]);

    return {
        ticket: {
            id: String(ticket.id),
            subject: String(ticket.subject),
            description: String(ticket.description),
            category: String(ticket.category),
            status: String(ticket.status),
            createdAt: String(ticket.created_at),
            tripId: (ticket.trip_id as string | null) || null,
            userName: String((profilesMap.get(String(ticket.created_by))?.full_name as string) || "مستخدم"),
            userId: String(ticket.created_by),
        },
        messages: (messages || []).map((message) => ({
            id: String(message.id),
            senderUserId: String(message.sender_user_id),
            senderName: String((profilesMap.get(String(message.sender_user_id))?.full_name as string) || "عضو"),
            messageBody: String(message.message_body),
            createdAt: String(message.created_at),
            isInternal: Boolean(message.is_internal),
        })),
    };
}

export async function fetchAnnouncements() {
    const supabase = createAdminClient();
    if (!supabase) return [] as AnnouncementItem[];

    const { data } = await supabase
        .from("admin_announcements")
        .select("id, title, body, audience, is_active, starts_at, ends_at, created_at, created_by")
        .order("created_at", { ascending: false })
        .limit(50);

    const profilesMap = await loadProfilesMap((data || []).map((item) => String(item.created_by)));

    return (data || []).map((item) => ({
        id: String(item.id),
        title: String(item.title),
        body: String(item.body),
        audience: String(item.audience),
        isActive: Boolean(item.is_active),
        startsAt: (item.starts_at as string | null) || null,
        endsAt: (item.ends_at as string | null) || null,
        createdAt: String(item.created_at),
        createdByName: String((profilesMap.get(String(item.created_by))?.full_name as string) || "Admin"),
    }));
}

export async function fetchAdminInboxNotifications() {
    const supabase = createAdminClient();
    if (!supabase) return [] as AdminInboxNotification[];

    const adminIds = await resolveAdminNotificationRecipientIds(supabase);
    if (adminIds.length === 0) return [] as AdminInboxNotification[];

    const { data } = await supabase
        .from("notifications")
        .select("id, recipient_user_id, title, body, is_read, created_at, type, payload, related_trip_id")
        .in("recipient_user_id", adminIds)
        .eq("type", "admin_message")
        .order("created_at", { ascending: false })
        .limit(40);

    const profilesMap = await loadProfilesMap((data || []).map((item) => String(item.recipient_user_id)));

    return (data || []).map((item) => ({
        // Keep notifications actionable from admin inbox table.
        link: (() => {
            const payload =
                item.payload && typeof item.payload === "object"
                    ? (item.payload as Record<string, unknown>)
                    : {};
            const directLink = String(payload.link || payload.url || "").trim();
            if (directLink) return directLink;
            const tripId = String(item.related_trip_id || payload.trip_id || "").trim();
            if (tripId) return `/admin/trips/${tripId}`;
            const ticketId = String(payload.ticket_id || "").trim();
            if (ticketId) return `/admin/support/${ticketId}`;
            return "/admin/notifications";
        })(),
        id: String(item.id),
        title: String(item.title),
        body: String(item.body),
        isRead: Boolean(item.is_read),
        createdAt: String(item.created_at),
        recipientName: (profilesMap.get(String(item.recipient_user_id))?.full_name as string | null) || null,
    }));
}

export async function fetchCustomersList() {
    const supabase = createAdminClient();
    if (!supabase) return [] as AdminCustomerListItem[];

    const [{ data: profiles }, { data: driverProfiles }] = await Promise.all([
        withQueryTimeout(
            supabase
                .from("profiles")
                .select("id, full_name, email, phone, account_status, created_at, role")
                .order("created_at", { ascending: false })
                .limit(150),
            { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
        ),
        withQueryTimeout(
            supabase.from("driver_profiles").select("id"),
            { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
        ),
    ]);

    const driverIds = new Set((driverProfiles || []).map((item) => String(item.id)));

    return (profiles || [])
        .filter((profile) => String(profile.role || "customer") === "customer")
        .filter((profile) => !driverIds.has(String(profile.id)))
        .map((profile) => ({
            id: String(profile.id),
            fullName: String(profile.full_name || "مستخدم"),
            email: (profile.email as string | null) || null,
            phone: (profile.phone as string | null) || null,
            status: String(profile.account_status || "active"),
            createdAt: String(profile.created_at),
        }));
}

export async function fetchStaffSnapshot() {
    const supabase = createAdminClient();
    if (!supabase) return [] as StaffListItem[];

    const { data: legacyStaff, error } = await withQueryTimeout(
        supabase
            .from("users")
            .select("id, full_name, email, role, disabled, last_login_at")
            .in("role", ["super_admin", "admin", "operations_manager", "catalog_manager", "support_agent"])
            .order("created_at", { ascending: false }),
        { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
    );

    if (!error && legacyStaff) {
        return legacyStaff.map((item) => ({
            id: String(item.id),
            fullName: String(item.full_name || "Staff"),
            email: String(item.email || ""),
            role: String(item.role),
            status: item.disabled ? "disabled" : "active",
            lastLogin: (item.last_login_at as string | null) || null,
        }));
    }

    const { data: profiles } = await withQueryTimeout(
        supabase
            .from("profiles")
            .select("id, full_name, email, role, account_status, last_login_at")
            .eq("role", "admin")
            .order("created_at", { ascending: false }),
        { data: [] as any[], error: null, count: null, status: 200, statusText: "OK" }
    );

    return (profiles || []).map((item) => ({
        id: String(item.id),
        fullName: String(item.full_name || "Admin"),
        email: String(item.email || ""),
        role: String(item.role),
        status: String(item.account_status || "active"),
        lastLogin: (item.last_login_at as string | null) || null,
    }));
}














