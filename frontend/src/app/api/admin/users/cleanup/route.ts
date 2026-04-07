import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/admin-guard';
import { recordServerAdminAudit } from '@/lib/admin-audit-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const STAFF_ROLES = ['super_admin', 'admin', 'operations_manager', 'catalog_manager', 'support_agent', 'driver'];

async function safeDelete(builder: PromiseLike<{ error: { message?: string } | null }>, ignoreMissing = true) {
  const { error } = await builder;
  if (!error) return null;

  const message = error.message || '';
  if (ignoreMissing && (
    message.includes('relation') ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  )) {
    return null;
  }

  return message || 'Unknown delete error';
}

function relationOrderStatus(item: any) {
  const relation = Array.isArray(item?.orders) ? item.orders[0] : item?.orders;
  return relation?.status || null;
}

async function syncBestSellerFlags() {
  if (!supabaseAdmin) return { topIds: [] as string[] };

  const resetError = await safeDelete(
    supabaseAdmin.from('products').update({ is_best_seller: false }).not('id', 'is', null),
    false
  );
  if (resetError) {
    throw new Error(resetError);
  }

  const { data: orderItems, error } = await supabaseAdmin
    .from('order_items')
    .select('product_id, quantity, orders(status)');

  if (error) throw error;

  const sales: Record<string, number> = {};
  for (const item of orderItems || []) {
    const status = relationOrderStatus(item);
    if (!item.product_id || status === 'cancelled') continue;
    sales[item.product_id] = (sales[item.product_id] || 0) + (item.quantity || 1);
  }

  const topIds = Object.entries(sales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([productId]) => productId);

  if (topIds.length > 0) {
    const { error: topError } = await supabaseAdmin
      .from('products')
      .update({ is_best_seller: true })
      .in('id', topIds);

    if (topError) throw topError;
  }

  return { topIds };
}

async function cleanupUsers(userIds: string[]) {
  if (!supabaseAdmin || userIds.length === 0) {
    return { deletedUsers: 0, deletedOrders: 0, topIds: [] as string[] };
  }

  const { data: ordersLookup, error: ordersLookupError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .in('user_id', userIds);

  if (ordersLookupError) throw ordersLookupError;

  const orderIds = (ordersLookup || []).map((order) => order.id);

  if (orderIds.length > 0) {
    const orderItemsError = await safeDelete(
      supabaseAdmin.from('order_items').delete().in('order_id', orderIds),
      false
    );
    if (orderItemsError) throw new Error(orderItemsError);

    const orderDriverReviewsError = await safeDelete(
      supabaseAdmin.from('driver_reviews').delete().in('order_id', orderIds)
    );
    if (orderDriverReviewsError) throw new Error(orderDriverReviewsError);

    const ordersError = await safeDelete(
      supabaseAdmin.from('orders').delete().in('id', orderIds),
      false
    );
    if (ordersError) throw new Error(ordersError);
  }

  const favoriteError = await safeDelete(
    supabaseAdmin.from('favorites').delete().in('user_id', userIds)
  );
  if (favoriteError) throw new Error(favoriteError);

  const notificationsError = await safeDelete(
    supabaseAdmin.from('notifications').delete().in('user_id', userIds)
  );
  if (notificationsError) throw new Error(notificationsError);

  const cartItemsError = await safeDelete(
    supabaseAdmin.from('cart_items').delete().in('user_id', userIds)
  );
  if (cartItemsError) throw new Error(cartItemsError);

  const reviewsError = await safeDelete(
    supabaseAdmin.from('reviews').delete().in('user_id', userIds)
  );
  if (reviewsError) throw new Error(reviewsError);

  const driverReviewsError = await safeDelete(
    supabaseAdmin.from('driver_reviews').delete().in('user_id', userIds)
  );
  if (driverReviewsError) throw new Error(driverReviewsError);

  for (const userId of userIds) {
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError && !authDeleteError.message?.toLowerCase().includes('not found')) {
      throw authDeleteError;
    }
  }

  const usersDeleteError = await safeDelete(
    supabaseAdmin.from('users').delete().in('id', userIds),
    false
  );
  if (usersDeleteError) throw new Error(usersDeleteError);

  const { topIds } = await syncBestSellerFlags();
  return {
    deletedUsers: userIds.length,
    deletedOrders: orderIds.length,
    topIds,
  };
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const auth = await requireAdminApi(request, 'manage_users');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const scope = body?.scope;

    if (scope === 'all_regular_users' && !['super_admin', 'admin'].includes(auth.profile.role || '')) {
      return NextResponse.json({ error: 'Only super admins can bulk-delete users' }, { status: 403 });
    }

    let targetUsers: Array<{ id: string; email?: string | null; full_name?: string | null; role?: string | null }> = [];

    if (scope === 'single') {
      const userId = body?.userId;
      if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
      }

      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, role')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (STAFF_ROLES.includes(user.role || '')) {
        return NextResponse.json({ error: 'هذا المستخدم ليس عميلاً عادياً. استخدم قسم الطاقم أو المندوبين.' }, { status: 400 });
      }

      targetUsers = [user];
    } else if (scope === 'all_regular_users') {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, role')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      targetUsers = (users || []).filter((user) => !STAFF_ROLES.includes(user.role || ''));
    } else {
      return NextResponse.json({ error: 'Unsupported cleanup scope' }, { status: 400 });
    }

    if (targetUsers.length === 0) {
      return NextResponse.json({ success: true, deletedUsers: 0, deletedOrders: 0, topIds: [] });
    }

    const result = await cleanupUsers(targetUsers.map((user) => user.id));

    await recordServerAdminAudit(auth.profile, {
      action: scope === 'all_regular_users' ? 'users.bulk_cleanup' : 'user.deep_delete',
      entityType: 'user',
      severity: 'critical',
      details: {
        deleted_users: result.deletedUsers,
        deleted_orders: result.deletedOrders,
        best_sellers_synced: true,
        top_product_ids: result.topIds,
      },
    });

    return NextResponse.json({
      success: true,
      deletedUsers: result.deletedUsers,
      deletedOrders: result.deletedOrders,
      topIds: result.topIds,
    });
  } catch (error: any) {
    console.error('admin users cleanup error', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
