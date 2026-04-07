import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/admin-guard';
import { recordServerAdminAudit } from '@/lib/admin-audit-server';
import { attachOrderEconomics, CURRENT_DELIVERY_FEE } from '@/lib/order-economics';
import { reserveOrderInventory, restoreOrderInventory } from '@/lib/order-inventory';
import { createUserNotificationWithPush } from '@/lib/user-push-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;
const LATE_BUFFER_MINUTES = 5;
const DEFAULT_CANCEL_MESSAGE =
  'لو كنت ما زلت تريد هذا الطلب، ادينا فرصة نجهزه على أكمل وجه، ولو أصبح جاهزًا هنرسل لك إشعارًا جديدًا بموعد الوصول المتوقع.';
const REOPEN_CUSTOMER_MESSAGE =
  'استلمنا رغبتك في استمرار الطلب، وبدأنا نجهزه من جديد. سنتابع معك بخطة التوصيل فور اكتمال التجهيز.';
const SEARCH_REQUEST_UNAVAILABLE_MESSAGE =
  'للأسف مش عارفين نوفر طلبك دلوقتي. لو لقيناه في أي وقت بعد كده هنرجع نبلغك فورًا.';

function resolveOrderId(request: NextRequest, context: any) {
  const params = context?.params || {};
  const routeId = typeof params.id === 'string' ? params.id : undefined;
  const derivedId = request.url.includes('/api/admin/orders/')
    ? request.url.split('/api/admin/orders/')[1]?.split(/[?#]/)[0]
    : undefined;
  const rawId = routeId || derivedId;
  return rawId ? decodeURIComponent(rawId) : undefined;
}

export async function GET(request: NextRequest, context: any) {
  const id = resolveOrderId(request, context);
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured', stage: 'config' }, { status: 500 });
  }
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid order id', stage: 'validate.id' }, { status: 400 });
  }

  const auth = await requireAdminApi(request, 'view_orders');
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from('order_items')
    .select(`
      id,
      order_id,
      product_id,
      quantity,
      price_at_purchase,
      selected_variant_json,
      products(name, price, image_url)
    `)
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message, stage: 'db.order_items' }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}

export async function PATCH(request: NextRequest, context: any) {
  const id = resolveOrderId(request, context);
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured', stage: 'config' }, { status: 500 });
  }
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid order id', stage: 'validate.id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === 'cancel') {
    const auth = await requireAdminApi(request, 'update_order_status');
    if (!auth.ok) return auth.response;

    const cancellationReason = String(body?.cancellationReason || '').trim();
    const customerMessage = String(body?.customerMessage || DEFAULT_CANCEL_MESSAGE).trim();
    if (!cancellationReason) {
      return NextResponse.json({ error: 'سبب الإلغاء مطلوب', stage: 'validate.reason' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, status, shipping_address')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found', stage: 'db.order' }, { status: 404 });
    }

    const updatedShipping = {
      ...(order.shipping_address || {}),
      cancellation_reason: cancellationReason,
      cancellation_message: customerMessage,
      admin_cancelled_at: new Date().toISOString(),
      customer_cancellation_response: null,
      customer_cancellation_response_at: null,
      customer_cancellation_response_handled_at: null,
      reopened_after_customer_request_at: null,
    };

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'cancelled',
        shipping_address: updatedShipping,
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message, stage: 'db.update' }, { status: 500 });
    }

    try {
      await restoreOrderInventory(supabaseAdmin, id, 'admin_cancelled');
    } catch (inventoryError: any) {
      console.error('restoreOrderInventory(admin cancel) error:', inventoryError?.message || inventoryError);
    }

    if (order.user_id) {
      await createUserNotificationWithPush(supabaseAdmin, order.user_id, {
        title: 'تم إلغاء طلبك',
        message: `تم إلغاء الطلب بسبب: ${cancellationReason}. ${customerMessage}`,
        link: '/orders',
      });
    }

    await recordServerAdminAudit(auth.profile, {
      action: 'order.cancel_with_reason',
      entityType: 'order',
      entityId: id,
      entityLabel: id.slice(0, 8),
      severity: 'warning',
      details: {
        previous_status: order.status,
        cancellation_reason: cancellationReason,
      },
    });

    return NextResponse.json({ success: true, shipping_address: updatedShipping });
  }

  if (action === 'reopen_after_customer_request') {
    const auth = await requireAdminApi(request, ['update_order_status']);
    if (!auth.ok) return auth.response;

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, status, shipping_address')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found', stage: 'db.order' }, { status: 404 });
    }

    if (order.status !== 'cancelled') {
      return NextResponse.json({ error: 'لا يمكن إعادة فتح طلب غير ملغي', stage: 'validate.status' }, { status: 400 });
    }

    if (order.shipping_address?.customer_cancellation_response !== 'insist') {
      return NextResponse.json(
        { error: 'العميل لم يؤكد رغبته في استمرار الطلب بعد', stage: 'validate.customer_response' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const updatedShipping = {
      ...(order.shipping_address || {}),
      last_customer_cancellation_response: order.shipping_address?.customer_cancellation_response || null,
      last_customer_cancellation_response_at: order.shipping_address?.customer_cancellation_response_at || null,
      customer_cancellation_response: null,
      customer_cancellation_response_at: null,
      customer_cancellation_response_handled_at: nowIso,
      reopened_after_customer_request_at: nowIso,
    };

    let reservedForReopen = false;
    try {
      await reserveOrderInventory(supabaseAdmin, id, 'reopened_after_customer_request');
      reservedForReopen = true;
    } catch (inventoryError: any) {
      return NextResponse.json({ error: inventoryError?.message || 'تعذر حجز المخزون من جديد', stage: 'inventory.reserve' }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'processing',
        shipping_address: updatedShipping,
      })
      .eq('id', id);

    if (updateError) {
      if (reservedForReopen) {
        try {
          await restoreOrderInventory(supabaseAdmin, id, 'reopen_failed');
        } catch (inventoryRollbackError) {
          console.error('restoreOrderInventory(reopen rollback) error:', inventoryRollbackError);
        }
      }
      return NextResponse.json({ error: updateError.message, stage: 'db.update' }, { status: 500 });
    }

    if (order.user_id) {
      await createUserNotificationWithPush(supabaseAdmin, order.user_id, {
        title: 'طلبك عاد لقيد التجهيز',
        message: REOPEN_CUSTOMER_MESSAGE,
        link: '/orders',
      });
    }

    await recordServerAdminAudit(auth.profile, {
      action: 'order.reopen_after_customer_request',
      entityType: 'order',
      entityId: id,
      entityLabel: id.slice(0, 8),
      details: {
        previous_status: order.status,
        customer_response: 'insist',
      },
    });

    return NextResponse.json({ success: true, status: 'processing', shipping_address: updatedShipping });
  }

  if (action === 'delivery_plan') {
    const auth = await requireAdminApi(request, ['update_order_status']);
    if (!auth.ok) return auth.response;

    const estimatedText = String(body?.estimatedText || '').trim();
    const driverNote = String(body?.driverNote || '').trim();
    const etaHours = Math.max(0, Number(body?.etaHours || 0));
    const etaDays = Math.max(0, Number(body?.etaDays || 0));

    if (!estimatedText) {
      return NextResponse.json({ error: 'نص موعد التوصيل مطلوب', stage: 'validate.estimated_text' }, { status: 400 });
    }
    if (!Number.isFinite(etaHours) || !Number.isFinite(etaDays)) {
      return NextResponse.json({ error: 'قيم الوقت غير صحيحة', stage: 'validate.timing' }, { status: 400 });
    }
    if (etaHours <= 0 && etaDays <= 0) {
      return NextResponse.json({ error: 'حدد عدد ساعات أو أيام على الأقل', stage: 'validate.timing' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, status, shipping_address')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found', stage: 'db.order' }, { status: 404 });
    }

    if (order.status === 'cancelled' || order.status === 'delivered') {
      return NextResponse.json({ error: 'لا يمكن تعيين موعد توصيل لطلب غير نشط', stage: 'validate.status' }, { status: 400 });
    }

    const isRestaurantOrder = order.shipping_address?.restaurant_order === true || !!order.shipping_address?.restaurant_id;

    if (!isRestaurantOrder && order.shipping_address?.driver?.acceptance_status !== 'accepted') {
      return NextResponse.json({ error: 'انتظر حتى يؤكد المندوب استلام الطلب أولاً', stage: 'validate.driver_acceptance' }, { status: 400 });
    }

    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + (((etaDays * 24) + etaHours) * 60 * 60 * 1000));

    const updatedShipping = {
      ...(order.shipping_address || {}),
      estimated_delivery: estimatedText,
      estimated_delivery_hours: etaHours,
      estimated_delivery_days: etaDays,
      driver_delivery_note: driverNote,
      delivery_eta_set_at: startedAt.toISOString(),
      delivery_deadline_at: deadlineAt.toISOString(),
      delivery_late_buffer_minutes: LATE_BUFFER_MINUTES,
      ...(isRestaurantOrder
        ? {
            restaurant_eta_status: 'approved',
            restaurant_eta_approved_at: startedAt.toISOString(),
          }
        : {}),
    };

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        shipping_address: updatedShipping,
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message, stage: 'db.update' }, { status: 500 });
    }

    if (order.user_id) {
      const humanWindow = etaDays > 0 && etaHours > 0
        ? `${etaDays} يوم و${etaHours} ساعة`
        : etaDays > 0
          ? `${etaDays} يوم`
          : `${etaHours} ساعة`;

      await createUserNotificationWithPush(supabaseAdmin, order.user_id, {
        title: 'تم تجهيز طلبك للتوصيل',
        message: `${estimatedText}. المدة المتوقعة: ${humanWindow}. سنبلغك فور أي تحديث جديد.`,
        link: '/orders',
      });
    }

    await recordServerAdminAudit(auth.profile, {
      action: 'order.set_delivery_plan',
      entityType: 'order',
      entityId: id,
      entityLabel: id.slice(0, 8),
      details: {
        estimated_text: estimatedText,
        eta_hours: etaHours,
        eta_days: etaDays,
        delivery_deadline_at: deadlineAt.toISOString(),
      },
    });

    return NextResponse.json({ success: true, shipping_address: updatedShipping });
  }

  if (action === 'text_order_quote') {
    const auth = await requireAdminApi(request, ['update_order_status']);
    if (!auth.ok) return auth.response;

    const productsSubtotal = Number(body?.productsSubtotal);
    if (!Number.isFinite(productsSubtotal) || productsSubtotal < 0) {
      return NextResponse.json({ error: 'قيمة المنتجات غير صحيحة', stage: 'validate.products_subtotal' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, status, total_amount, shipping_address')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found', stage: 'db.order' }, { status: 404 });
    }

    if (order.shipping_address?.request_mode !== 'custom_category_text') {
      return NextResponse.json({ error: 'هذا الطلب ليس طلبًا نصيًا قابلًا للتسعير الإداري', stage: 'validate.mode' }, { status: 400 });
    }

    if (order.status === 'cancelled' || order.status === 'delivered') {
      return NextResponse.json({ error: 'لا يمكن تسعير طلب غير نشط', stage: 'validate.status' }, { status: 400 });
    }

    const quotedFinalTotal = productsSubtotal + CURRENT_DELIVERY_FEE;
    const nowIso = new Date().toISOString();
    const updatedShipping = attachOrderEconomics(
        {
          ...(order.shipping_address || {}),
          search_pending: false,
          search_status: 'found_and_priced',
          search_found_at: nowIso,
          pricing_pending: false,
          quoted_products_total: productsSubtotal,
          quoted_delivery_fee: CURRENT_DELIVERY_FEE,
        quoted_final_total: quotedFinalTotal,
        pricing_updated_at: nowIso,
        pricing_updated_by_admin_id: null,
        pricing_updated_by_admin_name: 'الإدارة',
        customer_quote_response: null,
        customer_quote_response_at: null,
      },
      quotedFinalTotal,
      0
    );

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        total_amount: quotedFinalTotal,
        shipping_address: updatedShipping,
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message, stage: 'db.update' }, { status: 500 });
    }

    if (order.user_id) {
      await createUserNotificationWithPush(supabaseAdmin, order.user_id, {
        title: 'لقينالك طلبك',
        message: `لقينالك طلبك وسعره ${quotedFinalTotal.toLocaleString()} ج.م شامل التوصيل. ادخل على حسابك وشوف لو تحب نكمل ونجهزهولك.`,
        link: '/account?tab=search_requests',
      });
    }

    await recordServerAdminAudit(auth.profile, {
      action: 'order.text_quote_sent_to_customer',
      entityType: 'order',
      entityId: id,
      entityLabel: id.slice(0, 8),
      details: {
        products_subtotal: productsSubtotal,
        quoted_final_total: quotedFinalTotal,
      },
    });

    return NextResponse.json({
      success: true,
      total_amount: quotedFinalTotal,
      shipping_address: updatedShipping,
    });
  }

  if (action === 'search_request_unavailable') {
    const auth = await requireAdminApi(request, ['update_order_status']);
    if (!auth.ok) return auth.response;

    const adminMessage = String(body?.customerMessage || SEARCH_REQUEST_UNAVAILABLE_MESSAGE).trim();

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, status, shipping_address')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found', stage: 'db.order' }, { status: 404 });
    }

    if (order.shipping_address?.request_mode !== 'custom_category_text') {
      return NextResponse.json({ error: 'هذا الطلب ليس طلب بحث نصي', stage: 'validate.mode' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const updatedShipping = {
      ...(order.shipping_address || {}),
      search_pending: false,
      search_status: 'not_found_for_now',
      search_closed_at: nowIso,
      search_closed_reason: 'not_available_now',
      search_closed_message: adminMessage,
      pricing_pending: false,
      customer_quote_response: 'reject',
      customer_quote_response_at: nowIso,
    };

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'cancelled',
        shipping_address: updatedShipping,
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message, stage: 'db.update' }, { status: 500 });
    }

    if (order.user_id) {
      await createUserNotificationWithPush(supabaseAdmin, order.user_id, {
        title: 'للأسف مش لقينا طلبك دلوقتي',
        message: `${adminMessage} لو لقيناه في أي وقت بعد كده هنرجع نبعتلك فورًا.`,
        link: '/account',
      });
    }

    await recordServerAdminAudit(auth.profile, {
      action: 'order.search_request_unavailable',
      entityType: 'order',
      entityId: id,
      entityLabel: id.slice(0, 8),
      severity: 'warning',
      details: {
        search_status: 'not_found_for_now',
        customer_message: adminMessage,
      },
    });

    return NextResponse.json({
      success: true,
      status: 'cancelled',
      shipping_address: updatedShipping,
    });
  }

  if (action === 'pricing') {
    const auth = await requireAdminApi(request, ['update_order_status']);
    if (!auth.ok) return auth.response;

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status, total_amount, shipping_address')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found', stage: 'db.order' }, { status: 404 });
    }

    const updatedShipping = attachOrderEconomics(order.shipping_address || {}, order.total_amount || 0, 0);

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        shipping_address: updatedShipping,
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message, stage: 'db.update' }, { status: 500 });
    }

    await recordServerAdminAudit(auth.profile, {
      action: 'order.update_pricing_breakdown',
      entityType: 'order',
      entityId: id,
      entityLabel: id.slice(0, 8),
      details: {
        merchant_discount_amount: 0,
        platform_revenue: updatedShipping.platform_revenue,
        driver_revenue: updatedShipping.driver_revenue,
        merchant_settlement: updatedShipping.merchant_settlement,
      },
    });

    return NextResponse.json({ success: true, shipping_address: updatedShipping });
  }

  return NextResponse.json({ error: 'Unsupported action', stage: 'validate.action' }, { status: 400 });
}
