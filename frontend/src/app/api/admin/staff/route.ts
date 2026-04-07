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

const DEFAULT_PERMS_FOR_OPS = ['view_orders', 'update_order_status', 'assign_driver', 'view_drivers'];

function randomPassword() {
  return `Tmp!${Math.random().toString(36).slice(2, 8)}#${Math.floor(100 + Math.random() * 900)}`;
}

export async function GET(request: Request) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server misconfigured: missing service role key' }, { status: 500 });
  const auth = await requireAdminApi(request, 'manage_admins');
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, role, permissions, disabled, created_at, last_login_at, username')
    .in('role', ['super_admin', 'operations_manager', 'catalog_manager', 'support_agent', 'admin'])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data });
}

export async function POST(request: Request) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server misconfigured: missing service role key' }, { status: 500 });
  const auth = await requireAdminApi(request, 'manage_admins');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      full_name,
      username,
      email,
      role,
      permissions,
      tempPassword,
      disabled = false,
    } = body;

    if (!full_name || !username || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const allowedRoles = ['super_admin', 'admin', 'operations_manager', 'catalog_manager', 'support_agent'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const perms: string[] =
      permissions && Array.isArray(permissions) && permissions.length > 0
        ? permissions
        : role === 'operations_manager'
          ? DEFAULT_PERMS_FOR_OPS
          : [];

    const password = tempPassword || randomPassword();

    const { data: userCreated, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        username,
        role,
        permissions: perms,
      },
    });

    if (authError || !userCreated?.user) {
      const msg = authError?.message || 'Auth create failed';
      const code = msg.includes('User already registered') ? 409 : 400;
      return NextResponse.json({ error: msg, stage: 'auth.createUser' }, { status: code });
    }

    const supaUser = userCreated.user;
    const { error: upsertError } = await supabaseAdmin.from('users').upsert({
      id: supaUser.id,
      full_name,
      email,
      username,
      role,
      permissions: perms,
      disabled,
      must_change_password: true,
    });

    if (upsertError) {
      const msg = upsertError.message || '';
      if (msg.includes('permissions') || msg.includes('disabled')) {
        return NextResponse.json({
          error: 'Database missing required columns (permissions/disabled). Run supabase-admin-rls.sql migration.',
          stage: 'db.upsert',
        }, { status: 500 });
      }
      return NextResponse.json({ error: msg, stage: 'db.upsert' }, { status: 500 });
    }

    await recordServerAdminAudit(auth.profile, {
      action: 'staff.create',
      entityType: 'staff',
      entityId: supaUser.id,
      entityLabel: full_name || email,
      details: {
        email,
        username,
        role,
        disabled,
        permissionsCount: perms.length,
      },
    });

    return NextResponse.json({ success: true, tempPassword: password });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error', stage: 'catch' }, { status: 500 });
  }
}
