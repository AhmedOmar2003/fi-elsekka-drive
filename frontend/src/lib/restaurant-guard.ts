import { NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import type { Restaurant } from "@/services/restaurantsService";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || "";

export const restaurantSupabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export type RestaurantManagerProfile = {
  user: User;
  fullName: string | null;
  email: string | null;
  restaurant: Restaurant;
};

export type RestaurantManagerCheck =
  | { ok: true; profile: RestaurantManagerProfile }
  | { ok: false; response: NextResponse };

function extractToken(req: Request): string | null {
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

  const alt = cookie.match(/sb-access-token=([^;]+)/);
  return alt?.[1] || null;
}

export async function requireRestaurantApi(req: Request): Promise<RestaurantManagerCheck> {
  if (!restaurantSupabaseAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }),
    };
  }

  const token = extractToken(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data, error } = await restaurantSupabaseAdmin.auth.getUser(token);
  const user = data.user;

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await restaurantSupabaseAdmin
    .from("users")
    .select("role, full_name, email, disabled")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "restaurant_manager" || profile.disabled === true) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const normalizedEmail = String(profile.email || user.email || "").trim().toLowerCase();
  const { data: restaurant, error: restaurantError } = await restaurantSupabaseAdmin
    .from("restaurants")
    .select("*")
    .ilike("manager_email", normalizedEmail)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return {
      ok: false,
      response: NextResponse.json({ error: "المطعم ده لسه مش مربوط بحساب دخول صالح" }, { status: 404 }),
    };
  }

  return {
    ok: true,
    profile: {
      user,
      fullName: profile.full_name || user.user_metadata?.full_name || null,
      email: normalizedEmail,
      restaurant: restaurant as Restaurant,
    },
  };
}
