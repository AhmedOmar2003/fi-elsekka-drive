import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createOrderAdminNotificationsWithPush } from '@/lib/user-push-server';
import { getRestaurantOrderSnapshot } from '@/lib/restaurant-order';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfiguration: missing Supabase service credentials.' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, total_amount, shipping_address')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: customerProfile } = await supabaseAdmin
      .from('users')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const customerName =
      customerProfile?.full_name ||
      order.shipping_address?.recipient ||
      customerProfile?.email ||
      user.email ||
      'عميل جديد';

    const restaurantOrder = getRestaurantOrderSnapshot(order.shipping_address);
    const orderValue = Number(order.total_amount || 0);
    const totalText = orderValue > 0 ? ` بقيمة ${orderValue.toLocaleString('ar-EG')} ج.م` : '';

    await createOrderAdminNotificationsWithPush(supabaseAdmin, {
      title: `طلب جديد من ${customerName}`,
      message: restaurantOrder.isRestaurantOrder
        ? `العميل ${customerName} أكد طلبًا جديدًا من مطعم ${restaurantOrder.restaurantName || 'مطعم وصلني'}${totalText}.`
        : `العميل ${customerName} أكد طلبًا جديدًا${totalText}.`,
      link: `/admin/orders?order=${orderId}`,
      topic: 'admin-order-created',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error /orders/[id]/admin-alert:', error);
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
}
