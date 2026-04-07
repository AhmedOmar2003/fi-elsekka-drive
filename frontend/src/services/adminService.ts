import { supabase } from '@/lib/supabase';
import { attachOrderEconomics, getOrderEconomics } from '@/lib/order-economics';
import { optimizeImageForUpload } from '@/lib/image-upload';

// ─── Helper: log Supabase errors properly (they are objects, not strings) ──────
export function logError(ctx: string, error: unknown) {
    if (!error) return;
    const e = error as Record<string, unknown>;
    // Ignore AbortErrors — transient lock conflicts handled at client level
    const msg = (e.message as string) || '';
    if (msg.includes('AbortError') || msg.includes('Lock broken')) return;
    console.error(`[adminService] ${ctx}:`, e.message || e.code || JSON.stringify(e));
}

type AuditSeverity = 'info' | 'warning' | 'critical';

type AuditPayload = {
    action: string;
    entityType: string;
    entityId?: string | null;
    entityLabel?: string | null;
    severity?: AuditSeverity;
    details?: Record<string, unknown>;
};

async function logAdminAction(payload: AuditPayload) {
    try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) return;

        const { data: profile } = await supabase
            .from('users')
            .select('email, role')
            .eq('id', user.id)
            .single();

        const role = profile?.role || user.user_metadata?.role || null;
        const email = profile?.email || user.email || null;

        await supabase.from('admin_audit_logs').insert({
            actor_user_id: user.id,
            actor_email: email,
            actor_role: role,
            action: payload.action,
            entity_type: payload.entityType,
            entity_id: payload.entityId || null,
            entity_label: payload.entityLabel || null,
            severity: payload.severity || 'info',
            details: payload.details || {},
        });
    } catch (error) {
        logError('logAdminAction', error);
    }
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function fetchAdminStats() {
    const [usersRes, productsRes, ordersRes, revenueRes] = await Promise.all([
        supabase.from('users').select('id, role'),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id, status, shipping_address'),
        supabase.from('orders').select('total_amount, shipping_address, status').eq('status', 'delivered'),
    ]);

    if (usersRes.error) logError('fetchAdminStats.users', usersRes.error);
    if (productsRes.error) logError('fetchAdminStats.products', productsRes.error);
    if (ordersRes.error) logError('fetchAdminStats.orders', ordersRes.error);
    if (revenueRes.error) logError('fetchAdminStats.revenue', revenueRes.error);

    const regularUsers = (usersRes.data || []).filter((user) => !user.role || user.role === 'user');
    const visibleOrders = (ordersRes.data || []).filter((order) => !isCustomerSelfCancelledGraceOrder(order));
    const standardOrders = visibleOrders.filter((order) => !isSearchRequestOrder(order));
    const searchRequests = visibleOrders.filter((order) => isSearchRequestOrder(order));
    const totalRevenue = (revenueRes.data || [])
        .filter((order) => !isCustomerSelfCancelledGraceOrder(order))
        .reduce((sum, order) => sum + getOrderEconomics(order).platformRevenue, 0);

    return {
        totalUsers: regularUsers.length,
        totalProducts: productsRes.count || 0,
        totalOrders: standardOrders.length,
        totalTrackedOrders: visibleOrders.length,
        totalSearchRequests: searchRequests.length,
        totalRevenue,
    };
}

export async function fetchRecentOrders(limit = 5) {
    const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at, user_id, shipping_address, users(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(limit * 4);
    if (error) logError('fetchRecentOrders', error);
    return (data || []).filter((order) => !isCustomerSelfCancelledGraceOrder(order)).slice(0, limit);
}

export type AdminOverview = {
    orderHealth: {
        pending: number;
        processing: number;
        shipped: number;
        ordersToday: number;
        deliveredToday: number;
        needsAssignment: number;
        overdueShipping: number;
        standardOrders: number;
        searchingRequests: number;
        pricedSearchRequests: number;
    };
    financeHealth: {
        deliveredRevenueToday: number;
        deliveredDriverRevenueToday: number;
        deliveredMerchantSettlementToday: number;
        deliveredMerchantDiscountProfitToday: number;
        averageDeliveredOrderValue: number;
        openOrderValue: number;
        openPlatformRevenue: number;
    };
    teamHealth: {
        totalStaff: number;
        activeStaff: number;
        disabledStaff: number;
        mustChangePassword: number;
        staleStaffCount: number;
        neverLoggedInStaff: number;
        totalDrivers: number;
        availableDrivers: number;
        restingDrivers: number;
        newDriversThisWeek: number;
        newStaffThisWeek: number;
        newCustomersThisWeek: number;
    };
    inventoryHealth: {
        lowStockCount: number;
        outOfStockCount: number;
        lowStockProducts: Array<{
            id: string;
            name: string;
            stock_quantity: number;
            price: number;
        }>;
        outOfStockProducts: Array<{
            id: string;
            name: string;
            price: number;
        }>;
    };
    staffActivity: Array<{
        id: string;
        full_name: string;
        email: string;
        role: string;
        last_login_at: string | null;
        status: 'recent' | 'stale' | 'never' | 'disabled';
    }>;
    latestJoins: Array<{
        id: string;
        full_name: string;
        email: string;
        role: string;
        created_at: string;
    }>;
};

export type AdminAuditLog = {
    id: string;
    actor_user_id: string | null;
    actor_email: string | null;
    actor_role: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    entity_label: string | null;
    severity: AuditSeverity;
    details: Record<string, any> | null;
    created_at: string;
};

export type AdminSearchResults = {
    staff: Array<{
        id: string;
        full_name: string;
        email: string;
        username?: string | null;
        role?: string | null;
        disabled?: boolean | null;
    }>;
    users: Array<{
        id: string;
        full_name: string;
        email: string;
        phone?: string | null;
        role?: string | null;
    }>;
    products: Array<{
        id: string;
        name: string;
        price: number;
        stock_quantity?: number | null;
    }>;
    categories: Array<{
        id: string;
        name: string;
        description?: string | null;
    }>;
    orders: Array<{
        id: string;
        status: string;
        total_amount: number;
        created_at: string;
        customer_name: string;
        customer_email: string;
        phone: string;
    }>;
};

export type OperationsCenterData = {
    summary: {
        criticalCount: number;
        pendingWithoutDriver: number;
        overdueShipping: number;
        addressIssues: number;
        rejectedByDrivers: number;
        gracePeriodOrders: number;
    };
    pendingWithoutDriver: any[];
    overdueShipping: any[];
    addressIssues: any[];
    rejectedByDrivers: any[];
    gracePeriodOrders: any[];
};

export type AdminVisitAnalytics = {
    totalVisits: number;
    todayVisits: number;
    yesterdayVisits: number;
    weekVisits: number;
    previousWeekVisits: number;
    monthVisits: number;
    previousMonthVisits: number;
    yearVisits: number;
    totalPageViews: number;
    todayPageViews: number;
    yesterdayPageViews: number;
    weekPageViews: number;
    previousWeekPageViews: number;
    monthPageViews: number;
    previousMonthPageViews: number;
    yearPageViews: number;
    topPages: Array<{
        path: string;
        views: number;
    }>;
    exitPages: Array<{
        path: string;
        views: number;
        exits: number;
        exitRate: number;
    }>;
    checkoutSources: Array<{
        path: string;
        count: number;
    }>;
};

export type AdminAnalyticsRange = 7 | 30 | 90;

export type AdminAnalyticsData = {
    windowDays: AdminAnalyticsRange;
    revenue: {
        today: number;
        week: number;
        month: number;
        year: number;
    };
    comparisons: {
        revenue: {
            todayVsYesterday: number;
            weekVsPreviousWeek: number;
            monthVsPreviousMonth: number;
            yearVsPreviousYear: number;
        };
        visits: {
            todayVsYesterday: number;
            weekVsPreviousWeek: number;
            monthVsPreviousMonth: number;
            pageViewsTodayVsYesterday: number;
            pageViewsWeekVsPreviousWeek: number;
            pageViewsMonthVsPreviousMonth: number;
        };
    };
    visits: AdminVisitAnalytics;
    summary: {
        totalTrackedOrders: number;
        deliveredOrders: number;
        totalOrderedUnits: number;
        conversionRate: number;
        averageOrderValue: number;
    };
    trends: {
        dailyRevenue: Array<{
            label: string;
            value: number;
        }>;
        dailyOrders: Array<{
            label: string;
            value: number;
        }>;
    };
    productInsights: {
        mostOrdered: {
            id: string;
            name: string;
            image_url?: string | null;
            quantity: number;
        } | null;
        topProducts: Array<{
            id: string;
            name: string;
            image_url?: string | null;
            quantity: number;
        }>;
    };
    categoryInsights: {
        mostOrdered: {
            id: string;
            name: string;
            quantity: number;
        } | null;
        leastOrdered: {
            id: string;
            name: string;
            quantity: number;
        } | null;
        rows: Array<{
            id: string;
            name: string;
            quantity: number;
            share: number;
            ordersCount: number;
            revenue: number;
        }>;
    };
};

export type AdminCategoryAnalyticsData = {
    windowDays: AdminAnalyticsRange;
    category: {
        id: string;
        name: string;
    };
    summary: {
        quantity: number;
        ordersCount: number;
        revenue: number;
        share: number;
    };
    topProducts: Array<{
        id: string;
        name: string;
        image_url?: string | null;
        quantity: number;
        revenue: number;
    }>;
    trends: {
        dailyRevenue: Array<{ label: string; value: number }>;
        dailyOrders: Array<{ label: string; value: number }>;
    };
};

const ORDER_LATE_BUFFER_MS = 5 * 60 * 1000;

function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

function startOfWeek() {
    const date = startOfToday();
    const diff = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - diff);
    return date;
}

function startOfMonth() {
    const date = startOfToday();
    date.setDate(1);
    return date;
}

function startOfYear() {
    const date = startOfToday();
    date.setMonth(0, 1);
    return date;
}

function startOfYesterday() {
    const date = startOfToday();
    date.setDate(date.getDate() - 1);
    return date;
}

function addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function clampAnalyticsRange(value?: number | null): AdminAnalyticsRange {
    if (value === 7 || value === 30 || value === 90) return value;
    return 30;
}

function buildDailyBuckets(windowDays: AdminAnalyticsRange) {
    return Array.from({ length: windowDays }, (_, index) => {
        const bucketDate = addDays(startOfToday(), -((windowDays - 1) - index));
        return {
            key: bucketDate.toISOString().slice(0, 10),
            label: bucketDate.toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' }),
            value: 0,
        };
    });
}

function percentChange(current: number, previous: number) {
    if (previous <= 0 && current <= 0) return 0;
    if (previous <= 0) return 100;
    return Number((((current - previous) / previous) * 100).toFixed(1));
}

function isStaffRole(role?: string | null) {
    return ['super_admin', 'admin', 'operations_manager', 'catalog_manager', 'support_agent'].includes(role || '');
}

function sanitizeSearchTerm(query: string) {
    return query.trim().replace(/[,%()]/g, ' ');
}

function relationUser(order: any) {
    return Array.isArray(order?.users) ? order.users[0] : order?.users;
}

function orderShipping(order: any) {
    return order?.shipping_address || {};
}

function isPharmacyTextRequest(order: any) {
    const shipping = orderShipping(order);
    return shipping.request_mode === 'custom_category_text' && String(shipping.custom_request_category_name || '').trim() === 'صيدلية';
}

export function isSearchRequestOrder(order: any) {
    if (!order || isPharmacyTextRequest(order)) return false;

    const shipping = orderShipping(order);
    if (shipping.request_mode !== 'custom_category_text') return false;

    return (
        shipping.search_pending === true ||
        (
            shipping.search_pending !== true &&
            !shipping.customer_quote_response &&
            order?.status !== 'cancelled'
        )
    );
}

export function isSearchingRequestOrder(order: any) {
    return isSearchRequestOrder(order) && orderShipping(order).search_pending === true;
}

export function isPricedSearchRequestOrder(order: any) {
    const shipping = orderShipping(order);
    return (
        isSearchRequestOrder(order) &&
        shipping.search_pending !== true &&
        shipping.search_status === 'found_and_priced'
    );
}

export function getAdminOrderKind(order: any): 'standard' | 'searching_request' | 'priced_request' {
    if (isSearchingRequestOrder(order)) return 'searching_request';
    if (isPricedSearchRequestOrder(order)) return 'priced_request';
    return 'standard';
}

function getOrderDeadline(order: any) {
    const deadline = order?.shipping_address?.delivery_deadline_at;
    if (!deadline) return null;
    const parsed = new Date(deadline).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

function isOrderOverdue(order: any) {
    if (['delivered', 'cancelled'].includes(order?.status)) return false;
    const deadline = getOrderDeadline(order);
    if (!deadline) return false;
    return Date.now() > deadline + ORDER_LATE_BUFFER_MS;
}

export function isCustomerSelfCancelledGraceOrder(order: any) {
    if (order?.status !== 'cancelled') return false;
    const shipping = order?.shipping_address || {};
    return (
        shipping.customer_cancelled_during_grace_period === true ||
        (
            shipping.customer_cancelled_order === true &&
            (shipping.customer_cancel_origin === 'grace_period' || shipping.is_grace_period === true)
        )
    );
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
    const [ordersRes, usersRes, productsRes] = await Promise.all([
        supabase.from('orders').select('id, status, created_at, total_amount, shipping_address'),
        supabase.from('users').select('id, full_name, email, role, disabled, must_change_password, created_at, last_login_at, is_available'),
        supabase.from('products').select('id, name, price, stock_quantity'),
    ]);

    if (ordersRes.error) logError('fetchAdminOverview.orders', ordersRes.error);
    if (usersRes.error) logError('fetchAdminOverview.users', usersRes.error);
    if (productsRes.error) logError('fetchAdminOverview.products', productsRes.error);

    const orders = (ordersRes.data || []).filter(order => !isCustomerSelfCancelledGraceOrder(order));
    const standardOrders = orders.filter(order => !isSearchRequestOrder(order));
    const searchRequests = orders.filter(order => isSearchRequestOrder(order));
    const searchingRequests = searchRequests.filter(order => isSearchingRequestOrder(order));
    const pricedSearchRequests = searchRequests.filter(order => isPricedSearchRequestOrder(order));
    const users = usersRes.data || [];
    const products = productsRes.data || [];

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const staleThreshold = new Date(now - (1000 * 60 * 60 * 24 * 7));

    const pending = standardOrders.filter(order => order.status === 'pending').length;
    const processing = standardOrders.filter(order => order.status === 'processing').length;
    const shipped = standardOrders.filter(order => order.status === 'shipped').length;
    const ordersToday = standardOrders.filter(order => new Date(order.created_at).getTime() >= todayStart.getTime()).length;
    const deliveredTodayOrders = standardOrders.filter(order => order.status === 'delivered' && new Date(order.created_at).getTime() >= todayStart.getTime());
    const deliveredToday = deliveredTodayOrders.length;
    const needsAssignment = standardOrders.filter(order => {
        const activeStatus = ['pending', 'processing', 'shipped'].includes(order.status);
        return activeStatus && !order.shipping_address?.driver?.id;
    }).length;
    const overdueShipping = standardOrders.filter(order => isOrderOverdue(order)).length;

    const staff = users.filter(user => isStaffRole(user.role));
    const drivers = users.filter(user => user.role === 'driver');
    const customers = users.filter(user => !user.role || user.role === 'user');
    const deliveredOrders = standardOrders.filter(order => order.status === 'delivered');
    const deliveredTodayEconomics = deliveredTodayOrders.map(order => getOrderEconomics(order));
    const openOrders = standardOrders.filter(order => ['pending', 'processing', 'shipped'].includes(order.status));
    const openEconomics = openOrders.map(order => getOrderEconomics(order));

    const outOfStockProducts = products
        .filter(product => typeof product.stock_quantity === 'number' && product.stock_quantity <= 0)
        .slice(0, 4)
        .map(product => ({
            id: product.id,
            name: product.name,
            price: product.price,
        }));

    const lowStockProducts = products
        .filter(product => typeof product.stock_quantity === 'number' && product.stock_quantity > 0 && product.stock_quantity <= 5)
        .sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0))
        .slice(0, 6)
        .map(product => ({
            id: product.id,
            name: product.name,
            stock_quantity: product.stock_quantity,
            price: product.price,
        }));

    const latestJoins = [...users]
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
        .slice(0, 8)
        .map(user => ({
            id: user.id,
            full_name: user.full_name || 'بدون اسم',
            email: user.email || '',
            role: user.role || 'user',
            created_at: user.created_at,
        }));

    const staffActivity = [...staff]
        .sort((a, b) => {
            const aTime = new Date(a.last_login_at || a.created_at || '').getTime();
            const bTime = new Date(b.last_login_at || b.created_at || '').getTime();
            return bTime - aTime;
        })
        .slice(0, 5)
        .map(user => {
            const lastLoginAt = user.last_login_at || null;
            let status: 'recent' | 'stale' | 'never' | 'disabled' = 'never';
            if (user.disabled === true) status = 'disabled';
            else if (!lastLoginAt) status = 'never';
            else if (new Date(lastLoginAt).getTime() >= staleThreshold.getTime()) status = 'recent';
            else status = 'stale';

            return {
                id: user.id,
                full_name: user.full_name || 'بدون اسم',
                email: user.email || '',
                role: user.role || 'admin',
                last_login_at: lastLoginAt,
                status,
            };
        });

    return {
        orderHealth: {
            pending,
            processing,
            shipped,
            ordersToday,
            deliveredToday,
            needsAssignment,
            overdueShipping,
            standardOrders: standardOrders.length,
            searchingRequests: searchingRequests.length,
            pricedSearchRequests: pricedSearchRequests.length,
        },
        financeHealth: {
            deliveredRevenueToday: deliveredTodayEconomics.reduce((sum, order) => sum + order.platformRevenue, 0),
            deliveredDriverRevenueToday: deliveredTodayEconomics.reduce((sum, order) => sum + order.driverRevenue, 0),
            deliveredMerchantSettlementToday: deliveredTodayEconomics.reduce((sum, order) => sum + order.merchantSettlement, 0),
            deliveredMerchantDiscountProfitToday: deliveredTodayEconomics.reduce((sum, order) => sum + order.merchantDiscountAmount, 0),
            averageDeliveredOrderValue: deliveredOrders.length > 0
                ? Math.round(deliveredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0) / deliveredOrders.length)
                : 0,
            openOrderValue: openEconomics.reduce((sum, order) => sum + order.grossCollected, 0),
            openPlatformRevenue: openEconomics.reduce((sum, order) => sum + order.platformRevenue, 0),
        },
        teamHealth: {
            totalStaff: staff.length,
            activeStaff: staff.filter(user => user.disabled !== true).length,
            disabledStaff: staff.filter(user => user.disabled === true).length,
            mustChangePassword: staff.filter(user => user.must_change_password === true).length,
            staleStaffCount: staff.filter(user =>
                user.disabled !== true &&
                !!user.last_login_at &&
                new Date(user.last_login_at).getTime() < staleThreshold.getTime()
            ).length,
            neverLoggedInStaff: staff.filter(user => user.disabled !== true && !user.last_login_at).length,
            totalDrivers: drivers.length,
            availableDrivers: drivers.filter(user => user.is_available !== false).length,
            restingDrivers: drivers.filter(user => user.is_available === false).length,
            newDriversThisWeek: drivers.filter(user => new Date(user.created_at || '').getTime() >= weekStart.getTime()).length,
            newStaffThisWeek: staff.filter(user => new Date(user.created_at || '').getTime() >= weekStart.getTime()).length,
            newCustomersThisWeek: customers.filter(user => new Date(user.created_at || '').getTime() >= weekStart.getTime()).length,
        },
        inventoryHealth: {
            lowStockCount: products.filter(product => typeof product.stock_quantity === 'number' && product.stock_quantity > 0 && product.stock_quantity <= 5).length,
            outOfStockCount: products.filter(product => typeof product.stock_quantity === 'number' && product.stock_quantity <= 0).length,
            lowStockProducts,
            outOfStockProducts,
        },
        staffActivity,
        latestJoins,
    };
}

export async function fetchAdminVisitAnalytics(windowDaysInput?: number): Promise<AdminVisitAnalytics> {
    const windowDays = clampAnalyticsRange(windowDaysInput);
    try {
        const res = await fetch(`/api/admin/analytics/visits?range=${windowDays}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload) {
            throw new Error(payload?.error || 'تعذر تحميل زيارات الموقع');
        }

        return {
            totalVisits: Number(payload.totalVisits || 0),
            todayVisits: Number(payload.todayVisits || 0),
            yesterdayVisits: Number(payload.yesterdayVisits || 0),
            weekVisits: Number(payload.weekVisits || 0),
            previousWeekVisits: Number(payload.previousWeekVisits || 0),
            monthVisits: Number(payload.monthVisits || 0),
            previousMonthVisits: Number(payload.previousMonthVisits || 0),
            yearVisits: Number(payload.yearVisits || 0),
            totalPageViews: Number(payload.totalPageViews || 0),
            todayPageViews: Number(payload.todayPageViews || 0),
            yesterdayPageViews: Number(payload.yesterdayPageViews || 0),
            weekPageViews: Number(payload.weekPageViews || 0),
            previousWeekPageViews: Number(payload.previousWeekPageViews || 0),
            monthPageViews: Number(payload.monthPageViews || 0),
            previousMonthPageViews: Number(payload.previousMonthPageViews || 0),
            yearPageViews: Number(payload.yearPageViews || 0),
            topPages: Array.isArray(payload.topPages) ? payload.topPages : [],
            exitPages: Array.isArray(payload.exitPages) ? payload.exitPages : [],
            checkoutSources: Array.isArray(payload.checkoutSources) ? payload.checkoutSources : [],
        };
    } catch (error) {
        logError('fetchAdminVisitAnalytics', error);
        return {
            totalVisits: 0,
            todayVisits: 0,
            yesterdayVisits: 0,
            weekVisits: 0,
            previousWeekVisits: 0,
            monthVisits: 0,
            previousMonthVisits: 0,
            yearVisits: 0,
            totalPageViews: 0,
            todayPageViews: 0,
            yesterdayPageViews: 0,
            weekPageViews: 0,
            previousWeekPageViews: 0,
            monthPageViews: 0,
            previousMonthPageViews: 0,
            yearPageViews: 0,
            topPages: [],
            exitPages: [],
            checkoutSources: [],
        };
    }
}

export async function fetchAdminAnalytics(windowDaysInput?: number): Promise<AdminAnalyticsData> {
    const windowDays = clampAnalyticsRange(windowDaysInput);
    const [ordersRes, orderItemsRes, productsRes, categoriesRes, visits] = await Promise.all([
        supabase.from('orders').select('id, status, created_at, total_amount, shipping_address'),
        supabase.from('order_items').select('order_id, product_id, quantity, price_at_purchase'),
        supabase.from('products').select('id, name, image_url, category_id'),
        supabase.from('categories').select('id, name'),
        fetchAdminVisitAnalytics(windowDays),
    ]);

    if (ordersRes.error) logError('fetchAdminAnalytics.orders', ordersRes.error);
    if (orderItemsRes.error) logError('fetchAdminAnalytics.order_items', orderItemsRes.error);
    if (productsRes.error) logError('fetchAdminAnalytics.products', productsRes.error);
    if (categoriesRes.error) logError('fetchAdminAnalytics.categories', categoriesRes.error);

    const todayStart = startOfToday().getTime();
    const yesterdayStart = startOfYesterday().getTime();
    const weekStart = startOfWeek().getTime();
    const monthStart = startOfMonth().getTime();
    const yearStart = startOfYear().getTime();
    const previousWeekStart = addDays(startOfWeek(), -7).getTime();
    const previousMonthStartDate = startOfMonth();
    previousMonthStartDate.setMonth(previousMonthStartDate.getMonth() - 1);
    const previousMonthStart = previousMonthStartDate.getTime();
    const previousYearStartDate = startOfYear();
    previousYearStartDate.setFullYear(previousYearStartDate.getFullYear() - 1);
    const previousYearStart = previousYearStartDate.getTime();
    const windowStart = addDays(startOfToday(), -(windowDays - 1)).getTime();

    const visibleOrders = (ordersRes.data || []).filter((order) => !isCustomerSelfCancelledGraceOrder(order));
    const activeOrders = visibleOrders.filter((order) => order.status !== 'cancelled');
    const deliveredOrders = activeOrders.filter((order) => order.status === 'delivered');
    const windowOrders = activeOrders.filter((order) => new Date(order.created_at || '').getTime() >= windowStart);
    const windowDeliveredOrders = deliveredOrders.filter((order) => new Date(order.created_at || '').getTime() >= windowStart);
    const activeOrderIds = new Set(windowOrders.map((order) => order.id));

    const deliveredRevenue = {
        today: 0,
        week: 0,
        month: 0,
        year: 0,
    };
    const previousRevenue = {
        yesterday: 0,
        previousWeek: 0,
        previousMonth: 0,
        previousYear: 0,
    };

    const dailyRevenueBuckets = buildDailyBuckets(windowDays);
    const dailyOrderBuckets = buildDailyBuckets(windowDays);

    for (const order of deliveredOrders) {
        const orderTime = new Date(order.created_at || '').getTime();
        const platformRevenue = getOrderEconomics(order).platformRevenue;
        const orderDayKey = new Date(order.created_at || '').toISOString().slice(0, 10);

        if (orderTime >= todayStart) deliveredRevenue.today += platformRevenue;
        if (orderTime >= weekStart) deliveredRevenue.week += platformRevenue;
        if (orderTime >= monthStart) deliveredRevenue.month += platformRevenue;
        if (orderTime >= yearStart) deliveredRevenue.year += platformRevenue;

        if (orderTime >= yesterdayStart && orderTime < todayStart) previousRevenue.yesterday += platformRevenue;
        if (orderTime >= previousWeekStart && orderTime < weekStart) previousRevenue.previousWeek += platformRevenue;
        if (orderTime >= previousMonthStart && orderTime < monthStart) previousRevenue.previousMonth += platformRevenue;
        if (orderTime >= previousYearStart && orderTime < yearStart) previousRevenue.previousYear += platformRevenue;

        const revenueBucket = dailyRevenueBuckets.find((bucket) => bucket.key === orderDayKey);
        if (revenueBucket) revenueBucket.value += platformRevenue;
    }

    for (const order of windowOrders) {
        const orderDayKey = new Date(order.created_at || '').toISOString().slice(0, 10);
        const bucket = dailyOrderBuckets.find((entry) => entry.key === orderDayKey);
        if (bucket) bucket.value += 1;
    }

    const productLookup = new Map(
        (productsRes.data || []).map((product) => [
            product.id,
            {
                id: product.id,
                name: product.name,
                image_url: product.image_url,
                category_id: product.category_id,
            },
        ])
    );

    const categoryTotals = new Map<string, { id: string; name: string; quantity: number; orders: Set<string>; revenue: number }>(
        (categoriesRes.data || []).map((category) => [
            category.id,
            { id: category.id, name: category.name, quantity: 0, orders: new Set<string>(), revenue: 0 },
        ])
    );

    const productTotals = new Map<string, { id: string; name: string; image_url?: string | null; quantity: number }>();
    let totalOrderedUnits = 0;

    for (const item of orderItemsRes.data || []) {
        if (!item.order_id || !activeOrderIds.has(item.order_id) || !item.product_id) continue;

        const quantity = Number(item.quantity || 0) || 1;
        const product = productLookup.get(item.product_id);
        if (!product) continue;

        totalOrderedUnits += quantity;

        const existingProduct = productTotals.get(item.product_id);
        if (existingProduct) {
            existingProduct.quantity += quantity;
        } else {
            productTotals.set(item.product_id, {
                id: product.id,
                name: product.name,
                image_url: product.image_url,
                quantity,
            });
        }

        if (product.category_id && categoryTotals.has(product.category_id)) {
            const row = categoryTotals.get(product.category_id)!;
            row.quantity += quantity;
            row.orders.add(item.order_id);
            row.revenue += (Number(item.price_at_purchase || 0) || 0) * quantity;
        }
    }

    const topProducts = [...productTotals.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 6);

    const categoryRows = [...categoryTotals.values()]
        .sort((a, b) => {
            if (b.quantity !== a.quantity) return b.quantity - a.quantity;
            return a.name.localeCompare(b.name, 'ar');
        })
        .map((category) => ({
            id: category.id,
            name: category.name,
            quantity: category.quantity,
            share: totalOrderedUnits > 0 ? Math.round((category.quantity / totalOrderedUnits) * 100) : 0,
            ordersCount: category.orders.size,
            revenue: category.revenue,
        }));

    const leastOrdered = [...categoryRows]
        .sort((a, b) => {
            if (a.quantity !== b.quantity) return a.quantity - b.quantity;
            return a.name.localeCompare(b.name, 'ar');
        })[0] || null;

    return {
        revenue: deliveredRevenue,
        windowDays,
        comparisons: {
            revenue: {
                todayVsYesterday: percentChange(deliveredRevenue.today, previousRevenue.yesterday),
                weekVsPreviousWeek: percentChange(deliveredRevenue.week, previousRevenue.previousWeek),
                monthVsPreviousMonth: percentChange(deliveredRevenue.month, previousRevenue.previousMonth),
                yearVsPreviousYear: percentChange(deliveredRevenue.year, previousRevenue.previousYear),
            },
            visits: {
                todayVsYesterday: percentChange(visits.todayVisits, visits.yesterdayVisits),
                weekVsPreviousWeek: percentChange(visits.weekVisits, visits.previousWeekVisits),
                monthVsPreviousMonth: percentChange(visits.monthVisits, visits.previousMonthVisits),
                pageViewsTodayVsYesterday: percentChange(visits.todayPageViews, visits.yesterdayPageViews),
                pageViewsWeekVsPreviousWeek: percentChange(visits.weekPageViews, visits.previousWeekPageViews),
                pageViewsMonthVsPreviousMonth: percentChange(visits.monthPageViews, visits.previousMonthPageViews),
            },
        },
        visits,
        summary: {
            totalTrackedOrders: windowOrders.length,
            deliveredOrders: windowDeliveredOrders.length,
            totalOrderedUnits,
            conversionRate: visits.totalVisits > 0
                ? Number(((windowOrders.length / visits.totalVisits) * 100).toFixed(1))
                : 0,
            averageOrderValue: windowDeliveredOrders.length > 0
                ? Math.round(windowDeliveredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0) / windowDeliveredOrders.length)
                : 0,
        },
        trends: {
            dailyRevenue: dailyRevenueBuckets.map(({ label, value }) => ({ label, value })),
            dailyOrders: dailyOrderBuckets.map(({ label, value }) => ({ label, value })),
        },
        productInsights: {
            mostOrdered: topProducts[0] || null,
            topProducts,
        },
        categoryInsights: {
            mostOrdered: categoryRows[0] || null,
            leastOrdered,
            rows: categoryRows,
        },
    };
}

export async function fetchAdminCategoryAnalytics(categoryId: string, windowDaysInput?: number): Promise<AdminCategoryAnalyticsData> {
    const windowDays = clampAnalyticsRange(windowDaysInput);
    const [ordersRes, orderItemsRes, productsRes, categoriesRes] = await Promise.all([
        supabase.from('orders').select('id, status, created_at, total_amount, shipping_address'),
        supabase.from('order_items').select('order_id, product_id, quantity, price_at_purchase'),
        supabase.from('products').select('id, name, image_url, category_id'),
        supabase.from('categories').select('id, name'),
    ]);

    if (ordersRes.error) logError('fetchAdminCategoryAnalytics.orders', ordersRes.error);
    if (orderItemsRes.error) logError('fetchAdminCategoryAnalytics.order_items', orderItemsRes.error);
    if (productsRes.error) logError('fetchAdminCategoryAnalytics.products', productsRes.error);
    if (categoriesRes.error) logError('fetchAdminCategoryAnalytics.categories', categoriesRes.error);

    const category = (categoriesRes.data || []).find((item) => item.id === categoryId);
    const windowStart = addDays(startOfToday(), -(windowDays - 1)).getTime();
    const activeOrders = (ordersRes.data || [])
        .filter((order) => !isCustomerSelfCancelledGraceOrder(order) && order.status !== 'cancelled')
        .filter((order) => new Date(order.created_at || '').getTime() >= windowStart);
    const activeOrderIds = new Set(activeOrders.map((order) => order.id));
    const orderLookup = new Map(activeOrders.map((order) => [order.id, order]));

    const productLookup = new Map(
        (productsRes.data || [])
            .filter((product) => product.category_id === categoryId)
            .map((product) => [product.id, product])
    );

    const topProducts = new Map<string, { id: string; name: string; image_url?: string | null; quantity: number; revenue: number }>();
    const orderSet = new Set<string>();
    let quantity = 0;
    let revenue = 0;

    const dailyRevenueBuckets = buildDailyBuckets(windowDays);
    const dailyOrderBuckets = buildDailyBuckets(windowDays);

    for (const item of orderItemsRes.data || []) {
        if (!item.order_id || !activeOrderIds.has(item.order_id) || !item.product_id) continue;
        const product = productLookup.get(item.product_id);
        if (!product) continue;

        const itemQuantity = Number(item.quantity || 0) || 1;
        const itemRevenue = (Number(item.price_at_purchase || 0) || 0) * itemQuantity;
        quantity += itemQuantity;
        revenue += itemRevenue;
        orderSet.add(item.order_id);

        const existing = topProducts.get(item.product_id);
        if (existing) {
            existing.quantity += itemQuantity;
            existing.revenue += itemRevenue;
        } else {
            topProducts.set(item.product_id, {
                id: product.id,
                name: product.name,
                image_url: product.image_url,
                quantity: itemQuantity,
                revenue: itemRevenue,
            });
        }

        const order = orderLookup.get(item.order_id);
        const dayKey = new Date(order?.created_at || '').toISOString().slice(0, 10);
        const revenueBucket = dailyRevenueBuckets.find((bucket) => bucket.key === dayKey);
        if (revenueBucket) revenueBucket.value += itemRevenue;
    }

    for (const orderId of orderSet) {
        const order = orderLookup.get(orderId);
        if (!order) continue;
        const dayKey = new Date(order.created_at || '').toISOString().slice(0, 10);
        const bucket = dailyOrderBuckets.find((entry) => entry.key === dayKey);
        if (bucket) bucket.value += 1;
    }

    const totalAllCategoriesQuantity = (orderItemsRes.data || []).reduce((sum, item) => {
        if (!item.order_id || !activeOrderIds.has(item.order_id) || !item.product_id) return sum;
        const product = (productsRes.data || []).find((entry) => entry.id === item.product_id);
        if (!product) return sum;
        return sum + (Number(item.quantity || 0) || 1);
    }, 0);

    return {
        windowDays,
        category: {
            id: categoryId,
            name: category?.name || 'قسم غير معروف',
        },
        summary: {
            quantity,
            ordersCount: orderSet.size,
            revenue,
            share: totalAllCategoriesQuantity > 0 ? Math.round((quantity / totalAllCategoriesQuantity) * 100) : 0,
        },
        topProducts: [...topProducts.values()]
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 8),
        trends: {
            dailyRevenue: dailyRevenueBuckets.map(({ label, value }) => ({ label, value })),
            dailyOrders: dailyOrderBuckets.map(({ label, value }) => ({ label, value })),
        },
    };
}

export async function fetchAdminAuditLogs(limit = 80): Promise<AdminAuditLog[]> {
    const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) logError('fetchAdminAuditLogs', error);
    return (data as AdminAuditLog[]) || [];
}

export async function fetchAdminSearchResults(query: string): Promise<AdminSearchResults> {
    const term = sanitizeSearchTerm(query);
    if (term.length < 2) {
        return { staff: [], users: [], products: [], categories: [], orders: [] };
    }

    const like = `%${term}%`;
    const [usersRes, productsRes, categoriesRes, ordersRes] = await Promise.all([
        supabase
            .from('users')
            .select('id, full_name, email, username, role, phone, disabled')
            .or(`full_name.ilike.${like},email.ilike.${like},username.ilike.${like},phone.ilike.${like}`)
            .limit(20),
        supabase
            .from('products')
            .select('id, name, price, stock_quantity')
            .ilike('name', like)
            .limit(8),
        supabase
            .from('categories')
            .select('id, name, description')
            .or(`name.ilike.${like},description.ilike.${like}`)
            .limit(8),
        supabase
            .from('orders')
            .select('id, status, total_amount, created_at, shipping_address, users(full_name, email)')
            .order('created_at', { ascending: false })
            .limit(120),
    ]);

    if (usersRes.error) logError('fetchAdminSearchResults.users', usersRes.error);
    if (productsRes.error) logError('fetchAdminSearchResults.products', productsRes.error);
    if (categoriesRes.error) logError('fetchAdminSearchResults.categories', categoriesRes.error);
    if (ordersRes.error) logError('fetchAdminSearchResults.orders', ordersRes.error);

    const allUsers = usersRes.data || [];
    const staff = allUsers
        .filter((user) => isStaffRole(user.role))
        .slice(0, 8);
    const users = allUsers
        .filter((user) => !isStaffRole(user.role) && user.role !== 'driver')
        .slice(0, 8);

    const orders = (ordersRes.data || [])
        .filter((order) => !isCustomerSelfCancelledGraceOrder(order))
        .filter((order) => {
            const user = relationUser(order);
            const haystacks = [
                order.id,
                order.status,
                user?.full_name,
                user?.email,
                order.shipping_address?.phone,
                order.shipping_address?.city,
                order.shipping_address?.area,
                order.shipping_address?.street,
                order.shipping_address?.address,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystacks.includes(term.toLowerCase());
        })
        .slice(0, 8)
        .map((order) => {
            const user = relationUser(order);
            return {
                id: order.id,
                status: order.status,
                total_amount: order.total_amount || 0,
                created_at: order.created_at,
                customer_name: user?.full_name || 'غير معروف',
                customer_email: user?.email || '',
                phone: order.shipping_address?.phone || '',
            };
        });

    return {
        staff: staff as AdminSearchResults['staff'],
        users: users as AdminSearchResults['users'],
        products: (productsRes.data || []) as AdminSearchResults['products'],
        categories: (categoriesRes.data || []) as AdminSearchResults['categories'],
        orders,
    };
}

export async function fetchOperationsCenterData(): Promise<OperationsCenterData> {
    const { data, error } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, shipping_address, users(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(150);

    if (error) {
        logError('fetchOperationsCenterData', error);
        return {
            summary: {
                criticalCount: 0,
                pendingWithoutDriver: 0,
                overdueShipping: 0,
                addressIssues: 0,
                rejectedByDrivers: 0,
                gracePeriodOrders: 0,
            },
            pendingWithoutDriver: [],
            overdueShipping: [],
            addressIssues: [],
            rejectedByDrivers: [],
            gracePeriodOrders: [],
        };
    }

    const now = Date.now();
    const orders = (data || []).filter((order) => !isCustomerSelfCancelledGraceOrder(order));
    const activeStatuses = ['pending', 'processing', 'shipped'];

    const pendingWithoutDriver = orders.filter((order) =>
        activeStatuses.includes(order.status) && !order.shipping_address?.driver?.id
    );

    const overdueShipping = orders.filter((order) => isOrderOverdue(order));

    const addressIssues = orders.filter((order) => {
        const shipping = order.shipping_address || {};
        return activeStatuses.includes(order.status) && (!shipping.phone || (!shipping.city && !shipping.area) || (!shipping.street && !shipping.address));
    });

    const rejectedByDrivers = orders.filter((order) =>
        activeStatuses.includes(order.status) && Array.isArray(order.shipping_address?.rejected_by) && order.shipping_address.rejected_by.length > 0
    );

    const gracePeriodOrders = orders.filter((order) =>
        order.status === 'pending' && order.shipping_address?.is_grace_period === true
    );

    const mapOrders = (list: any[]) =>
        list.slice(0, 12).map((order) => {
            const user = relationUser(order);
            return {
                ...order,
                customer_name: user?.full_name || 'غير معروف',
                customer_email: user?.email || '',
                driver_name: order.shipping_address?.driver?.name || '',
                phone: order.shipping_address?.phone || '',
                rejected_count: Array.isArray(order.shipping_address?.rejected_by) ? order.shipping_address.rejected_by.length : 0,
            };
        });

    const summary = {
        criticalCount:
            pendingWithoutDriver.length +
            overdueShipping.length +
            addressIssues.length +
            rejectedByDrivers.length,
        pendingWithoutDriver: pendingWithoutDriver.length,
        overdueShipping: overdueShipping.length,
        addressIssues: addressIssues.length,
        rejectedByDrivers: rejectedByDrivers.length,
        gracePeriodOrders: gracePeriodOrders.length,
    };

    return {
        summary,
        pendingWithoutDriver: mapOrders(pendingWithoutDriver),
        overdueShipping: mapOrders(overdueShipping),
        addressIssues: mapOrders(addressIssues),
        rejectedByDrivers: mapOrders(rejectedByDrivers),
        gracePeriodOrders: mapOrders(gracePeriodOrders),
    };
}

// ─── Products ─────────────────────────────────────────────────────────────────
export async function fetchAdminProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), product_specifications(id, label, description)')
        .order('created_at', { ascending: false });
    if (error) logError('fetchAdminProducts', error);
    return data || [];
}

// Columns that may not exist in older schemas — strip all at once on column error
const OPTIONAL_COLUMNS = ['discount_percentage', 'stock_quantity', 'image_url', 'is_best_seller', 'show_in_offers'];

function stripOptionalColumns(payload: Record<string, unknown>): Record<string, unknown> {
    const safe = { ...payload };
    for (const col of OPTIONAL_COLUMNS) delete safe[col];
    return safe;
}

function isColumnError(msg: string) {
    return msg.includes("Could not find the '") || msg.includes('column') || msg.includes('schema cache');
}

export async function createProduct(payload: Record<string, unknown>) {
    let res = await supabase.from('products').insert([payload]).select().single();
    if (res.error && isColumnError(res.error.message || '')) {
        // Retry with ONLY core columns guaranteed to exist
        const safe = stripOptionalColumns(payload);
        res = await supabase.from('products').insert([safe]).select().single();
    }
    if (res.error) logError('createProduct', res.error);
    if (!res.error) {
        await logAdminAction({
            action: 'product.create',
            entityType: 'product',
            entityId: (res.data as any)?.id,
            entityLabel: String(payload.name || (res.data as any)?.name || 'منتج'),
            details: {
                price: payload.price,
                category_id: payload.category_id,
            },
        });
    }
    return res;
}

export async function updateProduct(id: string, payload: Record<string, unknown>) {
    let res = await supabase.from('products').update(payload).eq('id', id);
    if (res.error && isColumnError(res.error.message || '')) {
        const safe = stripOptionalColumns(payload);
        res = await supabase.from('products').update(safe).eq('id', id).select().single();
    }
    if (res.error) logError('updateProduct', res.error);
    if (!res.error) {
        await logAdminAction({
            action: 'product.update',
            entityType: 'product',
            entityId: id,
            entityLabel: String(payload.name || id),
            details: payload,
        });
    }
    return res;
}

export async function saveProductSpecifications(productId: string, specs: { id?: string, label: string, description: string }[]) {
    // 1. Delete all existing specs for this product to keep it simple
    const deleteRes = await supabase.from('product_specifications').delete().eq('product_id', productId);
    if (deleteRes.error) {
        logError('saveProductSpecifications.delete', deleteRes.error);
        return { error: deleteRes.error };
    }

    // 2. Insert new valid specs
    const newSpecs = specs.filter(s => s.label.trim() && s.description.trim()).map(s => ({
        product_id: productId,
        label: s.label.trim(),
        description: s.description.trim()
    }));

    if (newSpecs.length > 0) {
        const res = await supabase.from('product_specifications').insert(newSpecs);
        if (res.error) {
            logError('saveProductSpecifications.insert', res.error);
            return { error: res.error };
        }
    }

    return { error: null };
}



export async function deleteProduct(id: string) {
    const res = await supabase.from('products').delete().eq('id', id);
    if (res.error) {
        logError('deleteProduct', res.error);
        return { success: false, error: res.error.message || 'Error' };
    }
    await logAdminAction({
        action: 'product.delete',
        entityType: 'product',
        entityId: id,
        entityLabel: id,
        severity: 'warning',
    });
    return { success: true };
}

// ─── Image Upload ─────────────────────────────────────────────────────────────
export async function uploadProductImage(file: File): Promise<string | null> {
    const optimizedFile = await optimizeImageForUpload(file);
    const ext = optimizedFile.name.split('.').pop() || 'webp';
    const path = `products/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, optimizedFile, {
        upsert: true,
        contentType: optimizedFile.type || 'image/webp',
    });
    if (error) { logError('uploadProductImage', error); return null; }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
}

// ─── Categories ───────────────────────────────────────────────────────────────
export async function fetchAdminCategories() {
    const { data, error } = await supabase
        .from('categories')
        .select('*, products(id)')
        .order('created_at', { ascending: false });
    if (error) logError('fetchAdminCategories', error);
    return data || [];
}

export async function createCategory(name: string, description: string) {
    const res = await supabase.from('categories').insert([{ name, description }]).select().single();
    if (res.error) logError('createCategory', res.error);
    if (!res.error) {
        await logAdminAction({
            action: 'category.create',
            entityType: 'category',
            entityId: (res.data as any)?.id,
            entityLabel: name,
            details: { description },
        });
    }
    return res;
}

export async function updateCategory(id: string, name: string, description: string) {
    const res = await supabase.from('categories').update({ name, description }).eq('id', id);
    if (res.error) logError('updateCategory', res.error);
    if (!res.error) {
        await logAdminAction({
            action: 'category.update',
            entityType: 'category',
            entityId: id,
            entityLabel: name,
            details: { description },
        });
    }
    return res;
}

export async function deleteCategory(id: string) {
    const res = await supabase.from('categories').delete().eq('id', id);
    if (res.error) logError('deleteCategory', res.error);
    if (!res.error) {
        await logAdminAction({
            action: 'category.delete',
            entityType: 'category',
            entityId: id,
            entityLabel: id,
            severity: 'warning',
        });
    }
    return res;
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export async function fetchAdminOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            users(full_name, email),
            order_items(
                id, product_id, quantity, price_at_purchase, selected_variant_json,
                products(name, price, image_url)
            )
        `)
        .order('created_at', { ascending: false });
    if (error) logError('fetchAdminOrders', error);
    return (data || []).filter((order) => !isCustomerSelfCancelledGraceOrder(order));
}

export async function fetchOrderDetails(orderId: string) {
    try {
        const res = await fetch(`/api/admin/orders/${orderId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(payload?.error || 'Failed to fetch order details');
        }
        return payload?.data || [];
    } catch (error: any) {
        logError('fetchOrderDetails', error);
        return [];
    }
}

export async function updateOrderStatus(orderId: string, status: string) {
    const res = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (res.error) logError('updateOrderStatus', res.error);
    if (!res.error) {
        await logAdminAction({
            action: 'order.status_update',
            entityType: 'order',
            entityId: orderId,
            entityLabel: orderId.slice(0, 8),
            details: { status },
            severity: status === 'cancelled' ? 'warning' : 'info',
        });
    }
    return res;
}

export async function saveAdminOrderEconomics(orderId: string, merchantDiscountAmount: number) {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'pricing',
            merchantDiscountAmount,
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل حفظ تفصيل الإيراد');
    }
    return data;
}

export async function saveAdminTextOrderQuote(orderId: string, productsSubtotal: number) {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'text_order_quote',
            productsSubtotal,
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل إرسال التسعيرة للعميل');
    }
    return data;
}

export async function markAdminSearchRequestUnavailable(orderId: string, customerMessage?: string) {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'search_request_unavailable',
            customerMessage,
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل إرسال إشعار تعذر توفير الطلب');
    }
    return data;
}

export async function updateOrderEstimation(orderId: string, estimatedTime: string) {
    // 1. Fetch current shipping_address JSON
    const { data: order } = await supabase.from('orders').select('shipping_address').eq('id', orderId).single();
    if (!order || !order.shipping_address) return { error: { message: "Order not found" } };

    // 2. Attach estimated_delivery
    const newShipping = { ...order.shipping_address, estimated_delivery: estimatedTime };
    
    // 3. Update the order
    const res = await supabase.from('orders').update({ shipping_address: newShipping }).eq('id', orderId);
    if (res.error) logError('updateOrderEstimation', res.error);
    if (!res.error) {
        await logAdminAction({
            action: 'order.estimation_update',
            entityType: 'order',
            entityId: orderId,
            entityLabel: orderId.slice(0, 8),
            details: { estimated_delivery: estimatedTime },
        });
    }
    return res;
}

export async function updateOrderDriver(orderId: string, driver: { id: string, name: string, phone: string } | null) {
    // 1. Fetch current shipping_address JSON
    const { data: order } = await supabase.from('orders').select('shipping_address').eq('id', orderId).single();
    if (!order || !order.shipping_address) return { error: { message: "Order not found" } };

    // 2. Attach or remove driver
    const newShipping = { ...order.shipping_address };
    if (driver) {
        newShipping.driver = driver;
    } else {
        delete newShipping.driver;
    }
    
    // 3. Update the order
    const res = await supabase.from('orders').update({ shipping_address: newShipping }).eq('id', orderId);
    if (res.error) logError('updateOrderDriver', res.error);
    if (!res.error) {
        await logAdminAction({
            action: driver ? 'order.assign_driver' : 'order.unassign_driver',
            entityType: 'order',
            entityId: orderId,
            entityLabel: orderId.slice(0, 8),
            details: driver ? { driver_id: driver.id, driver_name: driver.name } : { driver_id: null },
            severity: driver ? 'info' : 'warning',
        });
    }
    return res;
}

export async function cancelAdminOrder(orderId: string, cancellationReason: string, customerMessage: string) {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'cancel',
            cancellationReason,
            customerMessage,
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل إلغاء الطلب');
    }
    return data;
}

export async function saveAdminOrderDeliveryPlan(
    orderId: string,
    payload: { estimatedText: string; etaHours: number; etaDays: number; driverNote: string }
) {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delivery_plan',
            ...payload,
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل حفظ خطة التوصيل');
    }
    return data;
}

export async function reopenCancelledOrderAfterCustomerRequest(orderId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'reopen_after_customer_request',
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل إعادة فتح الطلب');
    }
    return data;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function fetchAdminUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) logError('fetchAdminUsers', error);
    return (data || []).filter((user: any) => !['super_admin', 'admin', 'operations_manager', 'catalog_manager', 'support_agent', 'driver'].includes(user.role || ''));
}

export async function deleteUser(userId: string) {
    const res = await fetch('/api/admin/users/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'single', userId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل حذف المستخدم');
    }
    return data;
}

export async function deleteAllRegularUsers() {
    const res = await fetch('/api/admin/users/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all_regular_users' }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل تنظيف المستخدمين');
    }
    return data;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function broadcastOfferNotification(title: string, message: string, link: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        return { error: new Error("Missing authenticated session") };
    }

    const res = await fetch('/api/admin/broadcast-offers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title, message, link }),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
        const apiError = payload?.error || 'Failed to broadcast offer notification';
        logError('broadcastOfferNotification - api', apiError);
        return { error: new Error(apiError) };
    }

    await logAdminAction({
        action: 'promotion.broadcast_notification',
        entityType: 'notification',
        entityLabel: title,
        details: {
            recipients: payload?.count || 0,
            push_users: payload?.pushUsersCount || 0,
            push_devices: payload?.pushDevicesCount || 0,
            skipped_push: payload?.skippedPushCount || 0,
            failed_push: payload?.failedPushCount || 0,
            link
        },
    });
    
    return {
        success: true,
        count: payload?.count || 0,
        requested: payload?.requested || 0,
        pushUsersCount: payload?.pushUsersCount || 0,
        pushDevicesCount: payload?.pushDevicesCount || 0,
        skippedPushCount: payload?.skippedPushCount || 0,
        failedPushCount: payload?.failedPushCount || 0,
    };
}

export async function clearExperimentalAdminData(target: 'orders' | 'products' | 'restaurants' | 'drivers' | 'staff') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('سجّل دخولك من جديد علشان نكمل المسح التجريبي.');
    }

    const res = await fetch('/api/admin/experimental/clear-all', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ target }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل المسح التجريبي');
    }

    return data;
}
