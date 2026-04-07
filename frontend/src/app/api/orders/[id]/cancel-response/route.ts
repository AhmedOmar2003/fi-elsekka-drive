import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractAccessToken } from '@/lib/admin-guard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;

function resolveOrderId(request: NextRequest, context: any) {
  const params = context?.params || {};
  const routeId = typeof params.id === 'string' ? params.id : undefined;
  const derivedId = request.url.includes('/api/orders/')
    ? request.url.split('/api/orders/')[1]?.split('/cancel-response')[0]?.split(/[?#]/)[0]
    : undefined;
  const rawId = routeId || derivedId;
  return rawId ? decodeURIComponent(rawId) : undefined;
}

export async function POST(request: NextRequest, context: any) {
  const id = resolveOrderId(request, context);

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured', stage: 'config' }, { status: 500 });
  }

  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid order id', stage: 'validate.id' }, { status: 400 });
  }

  const token = extractAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized', stage: 'auth.token' }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Unauthorized', stage: 'auth.user' }, { status: 401 });
  }

  const user = authData.user;
  const body = await request.json().catch(() => null);
  const decision = body?.decision;

  if (!['insist', 'confirm_cancel'].includes(decision)) {
    return NextResponse.json({ error: 'قرار العميل غير صحيح', stage: 'validate.decision' }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, status, shipping_address')
    .eq('id', id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found', stage: 'db.order' }, { status: 404 });
  }

  if (order.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden', stage: 'auth.owner' }, { status: 403 });
  }

  if (order.status !== 'cancelled') {
    return NextResponse.json({ error: 'هذا الطلب ليس في حالة ملغية الآن', stage: 'validate.status' }, { status: 400 });
  }

  if (!order.shipping_address?.cancellation_reason) {
    return NextResponse.json({ error: 'لا توجد بيانات إلغاء مرتبطة بهذا الطلب', stage: 'validate.cancellation' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const updatedShipping = {
    ...(order.shipping_address || {}),
    customer_cancellation_response: decision,
    customer_cancellation_response_at: nowIso,
    customer_cancellation_response_handled_at: null,
  };

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ shipping_address: updatedShipping })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message, stage: 'db.update' }, { status: 500 });
  }

  try {
    await supabaseAdmin.from('admin_audit_logs').insert({
      actor_user_id: user.id,
      actor_email: user.email || null,
      actor_role: 'customer',
      action: decision === 'insist' ? 'order.customer_insists_after_cancel' : 'order.customer_confirms_cancel',
      entity_type: 'order',
      entity_id: id,
      entity_label: id.slice(0, 8),
      severity: decision === 'insist' ? 'warning' : 'info',
      details: {
        cancellation_reason: order.shipping_address?.cancellation_reason || null,
        decision,
      },
    });
  } catch {
    // Audit logging is helpful, but it should not block the customer response flow.
  }

  return NextResponse.json({
    success: true,
    decision,
    shipping_address: updatedShipping,
  });
}
