import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-guard';
import { getOrderEconomics } from '@/lib/order-economics';

const ACTIVE_STATUSES = ['pending', 'processing', 'shipped'];

function getPeriodStarts() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(todayStart);
  const day = weekStart.getDay();
  const diff = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - diff);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    todayStart: todayStart.getTime(),
    weekStart: weekStart.getTime(),
    monthStart: monthStart.getTime(),
  };
}

function getDeliveredTimestamp(order: any) {
  const raw =
    order?.shipping_address?.driver_delivered_at ||
    order?.shipping_address?.delivered_at ||
    order?.updated_at ||
    order?.created_at;

  const parsed = new Date(raw || '').getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(request, 'view_drivers');
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing service configuration' }, { status: 500 });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let { data: driver, error: driverError } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, phone, created_at, is_available, last_login_at')
    .eq('id', id)
    .eq('role', 'driver')
    .maybeSingle();

  if (driverError) {
    return NextResponse.json({ error: driverError.message }, { status: 500 });
  }

  if (!driver) {
    const { data: authLookup, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(id);
    const authUser = authLookup?.user;
    const authRole = authUser?.user_metadata?.role || authUser?.app_metadata?.role;

    if (authLookupError || !authUser || authRole !== 'driver') {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    driver = {
      id: authUser.id,
      full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'مندوب',
      email: authUser.email || '',
      phone: authUser.user_metadata?.phone || null,
      created_at: authUser.created_at || new Date().toISOString(),
      is_available: true,
      last_login_at: authUser.last_sign_in_at || null,
    };
  }

  let orders: any[] = [];

  const targetedOrders = await supabaseAdmin
    .from('orders')
    .select('id, total_amount, status, created_at, updated_at, user_id, shipping_address')
    .contains('shipping_address', { driver: { id } })
    .order('created_at', { ascending: false })
    .limit(500);

  if (targetedOrders.error) {
    const fallbackOrders = await supabaseAdmin
      .from('orders')
      .select('id, total_amount, status, created_at, updated_at, user_id, shipping_address')
      .order('created_at', { ascending: false })
      .limit(800);

    if (fallbackOrders.error) {
      return NextResponse.json({ error: fallbackOrders.error.message }, { status: 500 });
    }

    orders = (fallbackOrders.data || []).filter((order: any) => order.shipping_address?.driver?.id === id);
  } else {
    orders = targetedOrders.data || [];
  }

  const deliveredOrders = orders.filter((order) => order.status === 'delivered');
  const activeOrders = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
  const cancelledOrders = orders.filter((order) => order.status === 'cancelled');

  const { todayStart, weekStart, monthStart } = getPeriodStarts();
  const deliveredEconomics = deliveredOrders.map((order) => ({
    order,
    economics: getOrderEconomics(order),
    deliveredAt: getDeliveredTimestamp(order),
  }));

  const earnings = {
    today: deliveredEconomics
      .filter(({ deliveredAt }) => deliveredAt >= todayStart)
      .reduce((sum, entry) => sum + entry.economics.driverRevenue, 0),
    week: deliveredEconomics
      .filter(({ deliveredAt }) => deliveredAt >= weekStart)
      .reduce((sum, entry) => sum + entry.economics.driverRevenue, 0),
    month: deliveredEconomics
      .filter(({ deliveredAt }) => deliveredAt >= monthStart)
      .reduce((sum, entry) => sum + entry.economics.driverRevenue, 0),
    total: deliveredEconomics.reduce((sum, entry) => sum + entry.economics.driverRevenue, 0),
  };

  const deliveredOrderIds = deliveredOrders.map((order) => order.id);
  let avgRating: number | null = null;
  let ratingCount = 0;

  if (deliveredOrderIds.length > 0) {
    const { data: reviews } = await supabaseAdmin
      .from('driver_reviews')
      .select('rating')
      .in('order_id', deliveredOrderIds);

    if (reviews?.length) {
      ratingCount = reviews.length;
      avgRating = Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1));
    }
  }

  const recentOrders = orders.slice(0, 12).map((order) => ({
    id: order.id,
    status: order.status,
    total_amount: order.total_amount || 0,
    created_at: order.created_at,
    delivered_at: order.shipping_address?.driver_delivered_at || null,
    customer_name:
      order.shipping_address?.recipient ||
      order.shipping_address?.recipientName ||
      order.shipping_address?.full_name ||
      'عميل',
    phone:
      order.shipping_address?.phone ||
      order.shipping_address?.recipientPhone ||
      '',
  }));

  return NextResponse.json({
    driver,
    stats: {
      totalOrders: orders.length,
      activeOrders: activeOrders.length,
      deliveredOrders: deliveredOrders.length,
      cancelledOrders: cancelledOrders.length,
      earnings,
      avgRating,
      ratingCount,
    },
    recentOrders,
  });
}
