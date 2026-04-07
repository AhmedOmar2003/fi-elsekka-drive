import { NextResponse } from 'next/server';
import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

export const driverSupabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export type DriverProfile = {
  user: User;
  fullName: string | null;
  disabled: boolean;
};

export type DriverCheck =
  | { ok: true; profile: DriverProfile }
  | { ok: false; response: NextResponse };

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
  return alt?.[1] || null;
}

export async function requireDriverApi(req: Request): Promise<DriverCheck> {
  if (!driverSupabaseAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Server misconfigured' }, { status: 500 }),
    };
  }

  const token = extractToken(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data, error } = await driverSupabaseAdmin.auth.getUser(token);
  const user = data.user;

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: profile } = await driverSupabaseAdmin
    .from('users')
    .select('role, full_name, disabled')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'driver' || profile.disabled === true) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    profile: {
      user,
      fullName: profile.full_name || user.user_metadata?.full_name || null,
      disabled: profile.disabled === true,
    },
  };
}
