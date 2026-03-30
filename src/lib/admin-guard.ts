import { NextResponse } from 'next/server';
import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export type AdminProfile = {
  user: User;
  role: string | null;
  permissions: string[];
  disabled: boolean;
};

export type AdminCheck =
  | { ok: true; profile: AdminProfile }
  | { ok: false; response: NextResponse };

const ALLOWED_ROLES = ['super_admin', 'operations_manager', 'catalog_manager', 'support_agent', 'admin'];

const isProtectedSuperAdmin = (role: string | null, disabled: boolean) =>
  role === 'super_admin' ? false : disabled;

function extractToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(/sb-[^-]+-auth-token=([^;]+)/);
  if (match) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      return parsed.access_token || null;
    } catch {
      return null;
    }
  }
  const alt = cookie.match(/sb-access-token=([^;]+)/);
  if (alt) return alt[1];
  return null;
}

async function fetchUser(token: string) {
  if (!supabaseAdmin) return { user: null, role: null, permissions: [] as string[], disabled: true };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { user: null, role: null, permissions: [], disabled: true };

  const user = data.user;
  const metaRole =
    user.user_metadata?.role ||
    (user.app_metadata as Record<string, unknown> | undefined)?.role;

  const { data: legacyProfile } = await supabaseAdmin
    .from('users')
    .select('role, permissions, disabled')
    .eq('id', user.id)
    .single();

  const { data: operationalProfile } = await supabaseAdmin
    .from('profiles')
    .select('role, account_status')
    .eq('id', user.id)
    .maybeSingle();

  const role = legacyProfile?.role || operationalProfile?.role || metaRole || null;
  const permissions: string[] = Array.isArray(legacyProfile?.permissions)
    ? legacyProfile.permissions
    : Array.isArray(user.user_metadata?.permissions)
      ? user.user_metadata?.permissions
      : [];
  const disabled = isProtectedSuperAdmin(
    role,
    legacyProfile?.disabled === true || (operationalProfile?.account_status && operationalProfile.account_status !== 'active')
  );

  return { user, role, permissions, disabled };
}

export async function requireAdminApi(req: Request, requiredPermissions?: string | string[]): Promise<AdminCheck> {
  const token = extractToken(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { user, role, permissions, disabled } = await fetchUser(token);
  if (!user || !role || disabled || !ALLOWED_ROLES.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: admin access required' },
        { status: 403 }
      ),
    };
  }

  if (requiredPermissions) {
    const needed = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    const hasAll = needed.every((p) => permissions.includes(p) || role === 'super_admin' || role === 'admin');
    if (!hasAll) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 }),
      };
    }
  }

  return { ok: true, profile: { user, role, permissions, disabled } };
}

export async function verifyAdminToken(token: string) {
  const { user, role, permissions, disabled } = await fetchUser(token);
  const normalizedDisabled = isProtectedSuperAdmin(role, disabled);
  const isAdmin = !!user && !!role && !normalizedDisabled && ALLOWED_ROLES.includes(role);
  return { user, isAdmin, role, permissions, disabled: normalizedDisabled };
}

export function extractAccessToken(req: Request) {
  return extractToken(req);
}
