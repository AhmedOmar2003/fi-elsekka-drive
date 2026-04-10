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

function parseSupabaseCookieValue(rawValue: string): string | null {
  try {
    const decoded = decodeURIComponent(rawValue);
    const parsed = JSON.parse(decoded);

    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
      return parsed[0];
    }
    if (parsed && typeof parsed === 'object' && 'access_token' in parsed) {
      const token = (parsed as { access_token?: unknown }).access_token;
      return typeof token === 'string' ? token : null;
    }

    return decoded || null;
  } catch {
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue || null;
    }
  }
}

function extractTokenFromCookieHeader(cookie: string): string | null {
  const cookieEntries = cookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return [part, ''] as const;
      return [
        part.slice(0, separatorIndex).trim(),
        part.slice(separatorIndex + 1).trim(),
      ] as const;
    });

  const directCookie = cookieEntries.find(([name]) =>
    name === 'sb-access-token' || /(^sb-.*-auth-token$)/.test(name)
  );
  if (directCookie) {
    return parseSupabaseCookieValue(directCookie[1]);
  }

  const chunked = cookieEntries
    .map(([name, value]) => {
      const match = name.match(/^(sb-.*-auth-token)\.(\d+)$/);
      if (!match) return null;
      return {
        base: match[1],
        index: Number(match[2]),
        value,
      };
    })
    .filter((item): item is { base: string; index: number; value: string } => item !== null)
    .sort((left, right) => left.index - right.index);

  if (chunked.length > 0) {
    const merged = chunked.map((item) => item.value).join('');
    return parseSupabaseCookieValue(merged);
  }

  return null;
}

function extractToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  const cookie = req.headers.get('cookie') || '';
  return extractTokenFromCookieHeader(cookie);
}

async function fetchUser(token: string) {
  if (!supabaseAdmin) return { user: null, role: null, permissions: [] as string[], disabled: true };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { user: null, role: null, permissions: [], disabled: true };

  const user = data.user;
  const metaRole =
    user.user_metadata?.role ||
    (user.app_metadata as Record<string, unknown> | undefined)?.role;

  const [
    { data: legacyProfile },
    { data: operationalProfile }
  ] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('role, permissions, disabled')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('role, account_status')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

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
