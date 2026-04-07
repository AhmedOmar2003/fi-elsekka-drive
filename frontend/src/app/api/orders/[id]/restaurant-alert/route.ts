import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRestaurantOrderSnapshot } from '@/lib/restaurant-order';
import { createRestaurantNotificationsWithPush } from '@/lib/user-push-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing service role key' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice('Bearer '.length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, shipping_address')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.user_id !== authData.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const restaurantOrder = getRestaurantOrderSnapshot(order.shipping_address);
  if (!restaurantOrder.isRestaurantOrder || !restaurantOrder.restaurantId) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const customerName =
    order.shipping_address?.recipient ||
    order.shipping_address?.recipientName ||
    order.shipping_address?.full_name ||
    authData.user.user_metadata?.full_name ||
    authData.user.email ||
    'عميل جديد';

  const result = await createRestaurantNotificationsWithPush(
    supabaseAdmin,
    restaurantOrder.restaurantId,
    {
      title: `طلب جديد من ${customerName}`,
      message: `فيه طلب جديد من العميل ${customerName} وصل من موقع في السكة. افتح لوحة المطعم وشوف تفاصيله الآن.`,
      link: '/restaurant',
      topic: 'restaurant-order-created',
    }
  );

  return NextResponse.json({
    restaurantId: restaurantOrder.restaurantId,
    ...result,
  });
}
