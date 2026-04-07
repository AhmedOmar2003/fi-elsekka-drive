import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/admin-guard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
}

function startOfWeek() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const diff = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - diff);
    return date.toISOString();
}

function startOfYesterday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 1);
    return date.toISOString();
}

function startOfMonth() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
    return date.toISOString();
}

function startOfYear() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setMonth(0, 1);
    return date.toISOString();
}

function clampRange(input: string | null) {
    const parsed = Number(input || 30);
    return parsed === 7 || parsed === 90 ? parsed : 30;
}

function isMissingRelationError(message?: string) {
    const text = String(message || '').toLowerCase();
    return text.includes('does not exist') || text.includes('relation') || text.includes('schema cache');
}

export async function GET(request: Request) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Missing service configuration' }, { status: 500 });
    }

    const auth = await requireAdminApi(request, 'view_reports');
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const rangeDays = clampRange(searchParams.get('range'));

    const today = startOfToday();
    const yesterday = startOfYesterday();
    const week = startOfWeek();
    const month = startOfMonth();
    const year = startOfYear();
    const previousWeekDate = new Date(week);
    previousWeekDate.setDate(previousWeekDate.getDate() - 7);
    const previousWeek = previousWeekDate.toISOString();
    const previousMonthDate = new Date(month);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
    const previousMonth = previousMonthDate.toISOString();
    const rangeStartDate = new Date();
    rangeStartDate.setHours(0, 0, 0, 0);
    rangeStartDate.setDate(rangeStartDate.getDate() - (rangeDays - 1));
    const rangeStart = rangeStartDate.toISOString();

    const [totalRes, todayRes, yesterdayRes, weekRes, previousWeekRes, monthRes, previousMonthRes, yearRes, totalPageViewsRes, todayPageViewsRes, yesterdayPageViewsRes, weekPageViewsRes, previousWeekPageViewsRes, monthPageViewsRes, previousMonthPageViewsRes, yearPageViewsRes, pageRowsRes] = await Promise.all([
        supabaseAdmin.from('site_visits').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('site_visits').select('id', { count: 'exact', head: true }).gte('created_at', today),
        supabaseAdmin.from('site_visits').select('id', { count: 'exact', head: true }).gte('created_at', yesterday).lt('created_at', today),
        supabaseAdmin.from('site_visits').select('id', { count: 'exact', head: true }).gte('created_at', week),
        supabaseAdmin.from('site_visits').select('id', { count: 'exact', head: true }).gte('created_at', previousWeek).lt('created_at', week),
        supabaseAdmin.from('site_visits').select('id', { count: 'exact', head: true }).gte('created_at', month),
        supabaseAdmin.from('site_visits').select('id', { count: 'exact', head: true }).gte('created_at', previousMonth).lt('created_at', month),
        supabaseAdmin.from('site_visits').select('id', { count: 'exact', head: true }).gte('created_at', year),
        supabaseAdmin.from('site_page_views').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('site_page_views').select('id', { count: 'exact', head: true }).gte('created_at', today),
        supabaseAdmin.from('site_page_views').select('id', { count: 'exact', head: true }).gte('created_at', yesterday).lt('created_at', today),
        supabaseAdmin.from('site_page_views').select('id', { count: 'exact', head: true }).gte('created_at', week),
        supabaseAdmin.from('site_page_views').select('id', { count: 'exact', head: true }).gte('created_at', previousWeek).lt('created_at', week),
        supabaseAdmin.from('site_page_views').select('id', { count: 'exact', head: true }).gte('created_at', month),
        supabaseAdmin.from('site_page_views').select('id', { count: 'exact', head: true }).gte('created_at', previousMonth).lt('created_at', month),
        supabaseAdmin.from('site_page_views').select('id', { count: 'exact', head: true }).gte('created_at', year),
        supabaseAdmin.from('site_page_views').select('path, session_id, previous_path, created_at').gte('created_at', rangeStart),
    ]);

    const visitError =
        totalRes.error ||
        todayRes.error ||
        yesterdayRes.error ||
        weekRes.error ||
        previousWeekRes.error ||
        monthRes.error ||
        previousMonthRes.error ||
        yearRes.error;

    if (visitError) {
        return NextResponse.json({ error: visitError.message || 'Failed to load visit analytics' }, { status: 500 });
    }

    const pageViewError =
        totalPageViewsRes.error ||
        todayPageViewsRes.error ||
        yesterdayPageViewsRes.error ||
        weekPageViewsRes.error ||
        previousWeekPageViewsRes.error ||
        monthPageViewsRes.error ||
        previousMonthPageViewsRes.error ||
        yearPageViewsRes.error ||
        pageRowsRes.error;

    const canUsePageViews = !pageViewError || !isMissingRelationError(pageViewError.message);
    if (pageViewError && canUsePageViews) {
        return NextResponse.json({ error: pageViewError.message || 'Failed to load page view analytics' }, { status: 500 });
    }

    const pageRows = pageRowsRes.data || [];
    const pageViewCounts = new Map<string, number>();
    const checkoutSourceCounts = new Map<string, number>();
    const sessionGroups = new Map<string, Array<{ path: string; created_at: string }>>();

    for (const row of canUsePageViews ? pageRows : []) {
        const path = row.path || '/';
        pageViewCounts.set(path, (pageViewCounts.get(path) || 0) + 1);

        if (path.startsWith('/checkout') || path.startsWith('/cart')) {
            const source = row.previous_path || 'دخول مباشر';
            checkoutSourceCounts.set(source, (checkoutSourceCounts.get(source) || 0) + 1);
        }

        if (row.session_id) {
            const sessionRows = sessionGroups.get(row.session_id) || [];
            sessionRows.push({ path, created_at: row.created_at });
            sessionGroups.set(row.session_id, sessionRows);
        }
    }

    const exitCounts = new Map<string, number>();
    for (const rows of sessionGroups.values()) {
        const last = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).pop();
        if (last?.path) {
            exitCounts.set(last.path, (exitCounts.get(last.path) || 0) + 1);
        }
    }

    const topPages = [...pageViewCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([path, views]) => ({ path, views }));

    const exitPages = [...pageViewCounts.entries()]
        .map(([path, views]) => {
            const exits = exitCounts.get(path) || 0;
            return {
                path,
                views,
                exits,
                exitRate: views > 0 ? Math.round((exits / views) * 100) : 0,
            };
        })
        .filter((item) => item.views >= 2)
        .sort((a, b) => {
            if (b.exitRate !== a.exitRate) return b.exitRate - a.exitRate;
            return b.exits - a.exits;
        })
        .slice(0, 8);

    const checkoutSources = [...checkoutSourceCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([path, count]) => ({ path, count }));

    return NextResponse.json({
        totalVisits: totalRes.count || 0,
        todayVisits: todayRes.count || 0,
        yesterdayVisits: yesterdayRes.count || 0,
        weekVisits: weekRes.count || 0,
        previousWeekVisits: previousWeekRes.count || 0,
        monthVisits: monthRes.count || 0,
        previousMonthVisits: previousMonthRes.count || 0,
        yearVisits: yearRes.count || 0,
        totalPageViews: canUsePageViews ? (totalPageViewsRes.count || 0) : 0,
        todayPageViews: canUsePageViews ? (todayPageViewsRes.count || 0) : 0,
        yesterdayPageViews: canUsePageViews ? (yesterdayPageViewsRes.count || 0) : 0,
        weekPageViews: canUsePageViews ? (weekPageViewsRes.count || 0) : 0,
        previousWeekPageViews: canUsePageViews ? (previousWeekPageViewsRes.count || 0) : 0,
        monthPageViews: canUsePageViews ? (monthPageViewsRes.count || 0) : 0,
        previousMonthPageViews: canUsePageViews ? (previousMonthPageViewsRes.count || 0) : 0,
        yearPageViews: canUsePageViews ? (yearPageViewsRes.count || 0) : 0,
        topPages: canUsePageViews ? topPages : [],
        exitPages: canUsePageViews ? exitPages : [],
        checkoutSources: canUsePageViews ? checkoutSources : [],
        pageViewsReady: canUsePageViews,
    });
}
