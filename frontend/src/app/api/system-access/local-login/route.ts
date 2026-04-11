import { NextRequest, NextResponse } from "next/server";

import {
  issueLocalAdminToken,
  LOCAL_ADMIN_PROFILE,
  localAdminFallbackEnabled,
  LOCAL_ADMIN_SESSION_MAX_AGE_SECONDS,
  validateLocalAdminCredentials,
} from "@/lib/local-admin-session";

type LocalLoginBody = {
  email?: string;
  password?: string;
};

function getProjectRef() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!localAdminFallbackEnabled()) {
    return NextResponse.json(
      { error: "Local fallback is disabled." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as LocalLoginBody;
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!validateLocalAdminCredentials(email, password)) {
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const accessToken = issueLocalAdminToken();
  const secure = request.nextUrl.protocol === "https:";
  const projectRef = getProjectRef();

  const response = NextResponse.json(
    {
      ok: true,
      fallback: true,
      profile: LOCAL_ADMIN_PROFILE,
    },
    { headers: { "Cache-Control": "no-store" } },
  );

  response.cookies.set("sb-access-token", accessToken, {
    path: "/",
    httpOnly: false,
    secure,
    sameSite: "lax",
    maxAge: LOCAL_ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  response.cookies.set("sb-refresh-token", "", {
    path: "/",
    httpOnly: false,
    secure,
    sameSite: "lax",
    maxAge: 0,
  });

  if (projectRef) {
    response.cookies.set(
      `sb-${projectRef}-auth-token`,
      JSON.stringify({ access_token: accessToken, refresh_token: "" }),
      {
        path: "/",
        httpOnly: false,
        secure,
        sameSite: "lax",
        maxAge: LOCAL_ADMIN_SESSION_MAX_AGE_SECONDS,
      },
    );
  }

  return response;
}
