import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/admin-guard';
import { recordServerAdminAudit } from '@/lib/admin-audit-server';
import { BACKUP_TABLE_KEYS, BACKUP_TABLE_LABELS } from '@/lib/admin-backup';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const BATCH_SIZE = 500;

type ClearTarget = 'orders' | 'products' | 'restaurants' | 'drivers' | 'staff';

function isClearTarget(value: string | null): value is ClearTarget {
  return value === 'orders' || value === 'products' || value === 'restaurants' || value === 'drivers' || value === 'staff';
}

async function deleteRowsByIds(tableName: string, ids: string[]) {
  if (!supabaseAdmin || ids.length === 0) return;
  const key = BACKUP_TABLE_KEYS[tableName];
  if (!key) throw new Error(`جدول ${tableName} غير مدعوم للمسح التجريبي`);

  const { error } = await supabaseAdmin.from(tableName).delete().in(key, ids);
  if (error) {
    throw new Error(`فشل مسح ${BACKUP_TABLE_LABELS[tableName] || tableName}: ${error.message}`);
  }
}

async function deleteAllRows(tableName: string) {
  if (!supabaseAdmin) return 0;

  const key = BACKUP_TABLE_KEYS[tableName];
  if (!key) throw new Error(`جدول ${tableName} غير مدعوم للمسح التجريبي`);

  let deleted = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select(key)
      .order(key, { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      throw new Error(`فشل قراءة ${BACKUP_TABLE_LABELS[tableName] || tableName}: ${error.message}`);
    }

    const rows = Array.isArray(data) ? (data as unknown as Array<Record<string, unknown>>) : [];

    const ids = rows
      .map((row) => row[key])
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    if (ids.length === 0) break;

    await deleteRowsByIds(tableName, ids);
    deleted += ids.length;
  }

  return deleted;
}

async function countRows(tableName: string) {
  if (!supabaseAdmin) return 0;
  const { count, error } = await supabaseAdmin.from(tableName).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`فشل قراءة عدد ${BACKUP_TABLE_LABELS[tableName] || tableName}: ${error.message}`);
  return count || 0;
}

async function clearOrdersData() {
  const deletedOrderItems = await deleteAllRows('order_items');
  const deletedDriverReviews = await deleteAllRows('driver_reviews');
  const deletedDeliveryInfo = await deleteAllRows('delivery_info');
  const deletedNotifications = await deleteAllRows('notifications');
  const deletedOrders = await deleteAllRows('orders');

  return {
    deletedOrders,
    deletedOrderItems,
    deletedDriverReviews,
    deletedDeliveryInfo,
    deletedNotifications,
  };
}

async function clearProductsData() {
  const orderItemsCount = await countRows('order_items');
  if (orderItemsCount > 0) {
    throw new Error('امسح الطلبات الأول علشان نقدر نمسح المنتجات بدون ما نكسر السجلات المرتبطة بيها.');
  }

  const deletedReviews = await deleteAllRows('reviews');
  const deletedFavorites = await deleteAllRows('favorites');
  const deletedCartItems = await deleteAllRows('cart_items');
  const deletedSpecifications = await deleteAllRows('product_specifications');
  const deletedProducts = await deleteAllRows('products');

  return {
    deletedProducts,
    deletedSpecifications,
    deletedReviews,
    deletedFavorites,
    deletedCartItems,
  };
}

async function clearRestaurantsData() {
  if (!supabaseAdmin) return {};

  const { count: restaurantOrdersCount, error: restaurantOrdersError } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .contains('shipping_address', { restaurant_order: true });

  if (restaurantOrdersError) {
    throw new Error(`فشل فحص طلبات المطاعم: ${restaurantOrdersError.message}`);
  }

  if ((restaurantOrdersCount || 0) > 0) {
    throw new Error('امسح الطلبات الأول علشان نقدر نمسح المطاعم ومنتجاتها التجريبية بأمان.');
  }

  const { data: restaurantProducts, error: restaurantProductsError } = await supabaseAdmin
    .from('products')
    .select('id')
    .contains('specifications', { restaurant_item: true });

  if (restaurantProductsError) {
    throw new Error(`فشل قراءة منتجات المطاعم: ${restaurantProductsError.message}`);
  }

  const restaurantProductIds = (restaurantProducts || []).map((item) => item.id).filter(Boolean);

  if (restaurantProductIds.length > 0) {
    const { error: deleteReviewsError } = await supabaseAdmin.from('reviews').delete().in('product_id', restaurantProductIds);
    if (deleteReviewsError) throw new Error(`فشل مسح تقييمات منتجات المطاعم: ${deleteReviewsError.message}`);

    const { error: deleteFavoritesError } = await supabaseAdmin.from('favorites').delete().in('product_id', restaurantProductIds);
    if (deleteFavoritesError) throw new Error(`فشل مسح مفضلة منتجات المطاعم: ${deleteFavoritesError.message}`);

    const { error: deleteCartItemsError } = await supabaseAdmin.from('cart_items').delete().in('product_id', restaurantProductIds);
    if (deleteCartItemsError) throw new Error(`فشل مسح سلة منتجات المطاعم: ${deleteCartItemsError.message}`);

    const { error: deleteSpecsError } = await supabaseAdmin.from('product_specifications').delete().in('product_id', restaurantProductIds);
    if (deleteSpecsError) throw new Error(`فشل مسح مواصفات منتجات المطاعم: ${deleteSpecsError.message}`);

    const { error: deleteProductsError } = await supabaseAdmin.from('products').delete().in('id', restaurantProductIds);
    if (deleteProductsError) throw new Error(`فشل مسح منتجات المطاعم: ${deleteProductsError.message}`);
  }

  const deletedRestaurants = await deleteAllRows('restaurants');

  return {
    deletedRestaurants,
    deletedRestaurantProducts: restaurantProductIds.length,
  };
}

async function deleteAuthUsersByIds(ids: string[]) {
  if (!supabaseAdmin) return;
  for (const id of ids) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    if (error && !error.message?.toLowerCase().includes('not found')) {
      throw new Error(`فشل قراءة حساب الدخول: ${error.message}`);
    }
    if (data?.user) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (deleteError) {
        throw new Error(`فشل حذف حساب الدخول: ${deleteError.message}`);
      }
    }
  }
}

async function clearDriversData() {
  if (!supabaseAdmin) return {};
  const { data: drivers, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', 'driver');

  if (error) throw new Error(`فشل قراءة المندوبين: ${error.message}`);

  const driverIds = (drivers || []).map((driver) => driver.id).filter(Boolean);
  if (driverIds.length === 0) {
    return { deletedDrivers: 0 };
  }

  const { error: notificationsError } = await supabaseAdmin.from('notifications').delete().in('user_id', driverIds);
  if (notificationsError) throw new Error(`فشل مسح إشعارات المندوبين: ${notificationsError.message}`);

  const { error: subscriptionsError } = await supabaseAdmin.from('driver_subscriptions').delete().in('driver_id', driverIds);
  if (subscriptionsError) throw new Error(`فشل مسح اشتراكات المندوبين: ${subscriptionsError.message}`);

  await deleteAuthUsersByIds(driverIds);

  const { error: usersDeleteError } = await supabaseAdmin.from('users').delete().in('id', driverIds);
  if (usersDeleteError) throw new Error(`فشل مسح حسابات المندوبين: ${usersDeleteError.message}`);

  return { deletedDrivers: driverIds.length };
}

async function clearStaffData(currentUserId: string) {
  if (!supabaseAdmin) return {};
  const staffRoles = ['admin', 'operations_manager', 'catalog_manager', 'support_agent'];

  const { data: staffMembers, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .in('role', staffRoles)
    .neq('id', currentUserId);

  if (error) throw new Error(`فشل قراءة الطاقم: ${error.message}`);

  const staffIds = (staffMembers || []).map((member) => member.id).filter(Boolean);
  if (staffIds.length === 0) {
    return { deletedStaff: 0 };
  }

  const { error: notificationsError } = await supabaseAdmin.from('notifications').delete().in('user_id', staffIds);
  if (notificationsError) throw new Error(`فشل مسح إشعارات الطاقم: ${notificationsError.message}`);

  const { error: userSubscriptionsError } = await supabaseAdmin.from('user_subscriptions').delete().in('user_id', staffIds);
  if (userSubscriptionsError && !userSubscriptionsError.message?.includes('relation')) {
    throw new Error(`فشل مسح اشتراكات الطاقم: ${userSubscriptionsError.message}`);
  }

  await deleteAuthUsersByIds(staffIds);

  const { error: usersDeleteError } = await supabaseAdmin.from('users').delete().in('id', staffIds);
  if (usersDeleteError) throw new Error(`فشل مسح حسابات الطاقم: ${usersDeleteError.message}`);

  return { deletedStaff: staffIds.length, preservedSuperAdmin: true };
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing service role key' }, { status: 500 });
  }

  const auth = await requireAdminApi(request);
  if (!auth.ok) return auth.response;

  if (auth.profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'المسح الكلي التجريبي متاح للسوبر أدمن فقط.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const target = typeof body?.target === 'string' ? body.target : null;

    if (!isClearTarget(target)) {
      return NextResponse.json({ error: 'نوع المسح المطلوب غير معروف.' }, { status: 400 });
    }

    let summary: Record<string, unknown>;
    switch (target) {
      case 'orders':
        summary = await clearOrdersData();
        break;
      case 'products':
        summary = await clearProductsData();
        break;
      case 'restaurants':
        summary = await clearRestaurantsData();
        break;
      case 'drivers':
        summary = await clearDriversData();
        break;
      case 'staff':
        summary = await clearStaffData(auth.profile.user.id);
        break;
    }

    await recordServerAdminAudit(auth.profile, {
      action: `experimental.clear_all.${target}`,
      entityType: target,
      severity: 'critical',
      details: summary,
    });

    return NextResponse.json({
      success: true,
      target,
      summary,
      message: 'تم المسح التجريبي بنجاح',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'حدث خطأ أثناء المسح التجريبي' }, { status: 500 });
  }
}
