import { NextRequest, NextResponse } from 'next/server';
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

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function resolveStaffId(request: NextRequest, context: any) {
  const params = context?.params || {};
  const routeId = typeof params.id === 'string' ? params.id : undefined;
  const urlPath = request.url || '';
  const derivedId = urlPath.includes('/api/admin/staff/')
    ? urlPath.split('/api/admin/staff/')[1]?.split(/[?#]/)[0]
    : undefined;
  const rawId = routeId || derivedId;
  const id = rawId ? decodeURIComponent(rawId) : undefined;

  return { id, routeId, derivedId };
}

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

export async function PATCH(request: NextRequest, context: any) {
  const { id, routeId, derivedId } = resolveStaffId(request, context);

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing service role key', stage: 'config' }, { status: 500 });
  }

  if (!id || !UUID_REGEX.test(id)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('staff PATCH missing/invalid id', { routeId, derivedId, url: request.url });
    }
    return NextResponse.json({ error: 'Invalid or missing staff id', stage: 'validate.id' }, { status: 400 });
  }

  const auth = await requireAdminApi(request, 'manage_admins');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { full_name, username, role, permissions, disabled } = body;

    const { data: beforeUpdate } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, username, role, permissions, disabled')
      .eq('id', id)
      .single();

    if (!beforeUpdate) {
      return NextResponse.json({ error: 'الموظف غير موجود', stage: 'db.select' }, { status: 404 });
    }

    // Validate body
    if (disabled === undefined && full_name === undefined && username === undefined && role === undefined && permissions === undefined) {
      return NextResponse.json({ error: 'Nothing to update', stage: 'validate.body' }, { status: 400 });
    }
    if (disabled !== undefined && typeof disabled !== 'boolean') {
      return NextResponse.json({ error: 'disabled must be boolean', stage: 'validate.body' }, { status: 400 });
    }
    if (beforeUpdate.role === 'super_admin' && disabled === true) {
      return NextResponse.json({ error: 'لا يمكن تعطيل حساب السوبر أدمن من إدارة الطاقم' }, { status: 403 });
    }

    const updates: Record<string, any> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (username !== undefined) updates.username = username;
    if (role !== undefined) updates.role = role;
    if (permissions !== undefined) updates.permissions = permissions;
    if (disabled !== undefined) updates.disabled = disabled;

    const { error } = await supabaseAdmin.from('users').update(updates).eq('id', id);
    if (error) {
      const msg = error.message || '';
      if (msg.includes('permissions') || msg.includes('disabled') || msg.includes('must_change_password') || msg.includes('username')) {
        return NextResponse.json({
          error: 'Database missing required staff columns. Run supabase-admin-rls.sql migration.',
          stage: 'db.update',
        }, { status: 500 });
      }
      return NextResponse.json({ error: msg, stage: 'db.update' }, { status: 500 });
    }

    // Sync auth metadata if role/permissions/full_name/username changed
    if (role !== undefined || permissions !== undefined || full_name !== undefined || username !== undefined) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: {
          ...(role !== undefined ? { role } : {}),
          ...(permissions !== undefined ? { permissions } : {}),
          ...(full_name !== undefined ? { full_name } : {}),
          ...(username !== undefined ? { username } : {}),
        },
      });
      if (authErr) {
        return NextResponse.json({ error: authErr.message, stage: 'auth.updateUserById' }, { status: 500 });
      }
    }

    await recordServerAdminAudit(auth.profile, {
      action: disabled === true && beforeUpdate?.disabled !== true
        ? 'staff.disable'
        : disabled === false && beforeUpdate?.disabled === true
          ? 'staff.enable'
          : 'staff.update',
      entityType: 'staff',
      entityId: id,
      entityLabel: full_name || beforeUpdate?.full_name || beforeUpdate?.email || id,
      severity: disabled === true ? 'warning' : 'info',
      details: {
        before: beforeUpdate || null,
        after: updates,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('staff PATCH error', { id, url: request.url, message: e?.message, stack: e?.stack });
    }
    return NextResponse.json({ error: e?.message || 'Internal error', stage: 'catch' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: any) {
  const { id, routeId, derivedId } = resolveStaffId(request, context);

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing service role key', stage: 'config' }, { status: 500 });
  }

  if (!id || !UUID_REGEX.test(id)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('staff DELETE missing/invalid id', { routeId, derivedId, url: request.url });
    }
    return NextResponse.json({ error: 'Invalid or missing staff id', stage: 'validate.id' }, { status: 400 });
  }

  const auth = await requireAdminApi(request, 'manage_admins');
  if (!auth.ok) return auth.response;

  if (auth.profile.user.id === id) {
    return NextResponse.json({ error: 'لا يمكن حذف حسابك الحالي' }, { status: 400 });
  }

  try {
    const { data: targetStaff, error: targetError } = await supabaseAdmin
      .from('users')
      .select('id, role, email, full_name')
      .eq('id', id)
      .single();

    if (targetError || !targetStaff) {
      return NextResponse.json({ error: 'الموظف غير موجود', stage: 'db.select' }, { status: 404 });
    }

    if (targetStaff.role === 'super_admin') {
      return NextResponse.json({ error: 'لا يمكن حذف حساب السوبر أدمن من إدارة الطاقم', stage: 'authorize.delete' }, { status: 403 });
    }

    // Remove any customer-side activity created by this staff member before deleting the account.
    const { data: ownedOrders, error: ordersLookupError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', id);

    if (ordersLookupError) {
      return NextResponse.json({ error: ordersLookupError.message, stage: 'orders.lookup' }, { status: 500 });
    }

    const ownedOrderIds = (ownedOrders || []).map((order) => order.id);

    if (ownedOrderIds.length > 0) {
      const orderItemsDeleteError = await safeDelete(
        supabaseAdmin.from('order_items').delete().in('order_id', ownedOrderIds)
      );
      if (orderItemsDeleteError) {
        return NextResponse.json({ error: orderItemsDeleteError, stage: 'order_items.delete' }, { status: 500 });
      }

      const orderReviewsDeleteError = await safeDelete(
        supabaseAdmin.from('driver_reviews').delete().in('order_id', ownedOrderIds)
      );
      if (orderReviewsDeleteError) {
        return NextResponse.json({ error: orderReviewsDeleteError, stage: 'driver_reviews.order_delete' }, { status: 500 });
      }

      const ordersDeleteError = await safeDelete(
        supabaseAdmin.from('orders').delete().in('id', ownedOrderIds),
        false
      );
      if (ordersDeleteError) {
        return NextResponse.json({ error: ordersDeleteError, stage: 'orders.delete' }, { status: 500 });
      }
    }

    const userNotificationsDeleteError = await safeDelete(
      supabaseAdmin.from('notifications').delete().eq('user_id', id)
    );
    if (userNotificationsDeleteError) {
      return NextResponse.json({ error: userNotificationsDeleteError, stage: 'notifications.delete' }, { status: 500 });
    }

    const cartItemsDeleteError = await safeDelete(
      supabaseAdmin.from('cart_items').delete().eq('user_id', id)
    );
    if (cartItemsDeleteError) {
      return NextResponse.json({ error: cartItemsDeleteError, stage: 'cart_items.delete' }, { status: 500 });
    }

    const directDriverReviewsDeleteError = await safeDelete(
      supabaseAdmin.from('driver_reviews').delete().eq('user_id', id)
    );
    if (directDriverReviewsDeleteError) {
      return NextResponse.json({ error: directDriverReviewsDeleteError, stage: 'driver_reviews.user_delete' }, { status: 500 });
    }

    const directDriverAssignmentsDeleteError = await safeDelete(
      supabaseAdmin.from('driver_reviews').delete().eq('driver_id', id)
    );
    if (directDriverAssignmentsDeleteError) {
      return NextResponse.json({ error: directDriverAssignmentsDeleteError, stage: 'driver_reviews.driver_delete' }, { status: 500 });
    }

    const subscriptionsDeleteError = await safeDelete(
      supabaseAdmin.from('driver_subscriptions').delete().eq('driver_id', id)
    );
    if (subscriptionsDeleteError) {
      return NextResponse.json({ error: subscriptionsDeleteError, stage: 'driver_subscriptions.delete' }, { status: 500 });
    }

    const { data: authLookup, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(id);
    const authUserExists = !!authLookup?.user;

    if (authLookupError && !authLookupError.message?.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: authLookupError.message, stage: 'auth.getUserById' }, { status: 500 });
    }

    if (authUserExists) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id);

      if (authDeleteError) {
        return NextResponse.json({
          error: authDeleteError.message,
          stage: 'auth.deleteUser',
        }, { status: 500 });
      }
    }

    const { error: dbDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (dbDeleteError) {
      return NextResponse.json({ error: dbDeleteError.message, stage: 'db.delete' }, { status: 500 });
    }

    await recordServerAdminAudit(auth.profile, {
      action: 'staff.delete',
      entityType: 'staff',
      entityId: targetStaff.id,
      entityLabel: targetStaff.full_name || targetStaff.email || targetStaff.id,
      severity: 'critical',
      details: {
        email: targetStaff.email,
        role: targetStaff.role,
        deletedOrdersCount: ownedOrderIds.length,
        authUserDeleted: authUserExists,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        id: targetStaff.id,
        email: targetStaff.email,
        full_name: targetStaff.full_name,
      },
      authUserDeleted: authUserExists,
      deletedOrdersCount: ownedOrderIds.length,
    });
  } catch (e: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('staff DELETE error', { id, url: request.url, message: e?.message, stack: e?.stack });
    }
    return NextResponse.json({ error: e?.message || 'Internal error', stage: 'catch' }, { status: 500 });
  }
}
