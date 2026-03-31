import { createClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || "";

function extractAccessToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/sb-[^-]+-auth-token=([^;]+)/);
  if (match) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      return parsed.access_token || null;
    } catch {
      return null;
    }
  }

  const fallback = cookie.match(/sb-access-token=([^;]+)/);
  return fallback?.[1] || null;
}

export function createRideServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createRideAuthedClient(token: string) {
  if (!supabaseUrl || !supabaseAnonKey || !token) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

export type RideSessionProfile = {
  user: User;
  role: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  disabled: boolean;
};

export type RideSessionCheck =
  | { ok: true; token: string; profile: RideSessionProfile }
  | { ok: false; response: NextResponse };

export async function requireRideUser(req: Request): Promise<RideSessionCheck> {
  const serviceClient = createRideServiceClient();
  if (!serviceClient) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Server misconfiguration: Supabase credentials are missing." },
        { status: 500 }
      ),
    };
  }

  const token = extractAccessToken(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await serviceClient.auth.getUser(token);

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const [{ data: profile }, { data: driverProfile }] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("id, role, full_name, phone, email, account_status")
      .eq("id", user.id)
      .maybeSingle(),
    serviceClient
      .from("driver_profiles")
      .select("id, application_status, verification_status")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const role = driverProfile
    ? "driver"
    : profile?.role ||
      user.user_metadata?.role ||
      user.app_metadata?.role ||
      null;
  const disabled =
    profile?.account_status && profile.account_status !== "active";

  return {
    ok: true,
    token,
    profile: {
      user,
      role,
      fullName: profile?.full_name || user.user_metadata?.full_name || null,
      phone: profile?.phone || user.phone || null,
      email: profile?.email || user.email || null,
      disabled: Boolean(disabled),
    },
  };
}
