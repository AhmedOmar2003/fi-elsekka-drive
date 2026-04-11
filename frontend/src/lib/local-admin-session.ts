import "server-only";

import crypto from "node:crypto";

const ENABLE_LOCAL_ADMIN_FALLBACK = process.env.ENABLE_LOCAL_ADMIN_FALLBACK !== "false";
const LOCAL_ADMIN_FALLBACK_SECRET =
  process.env.LOCAL_ADMIN_FALLBACK_SECRET || process.env.SUPABASE_SERVICE_KEY || "";
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "admin@drive.com").trim().toLowerCase();
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "drive1";
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || "Drive Super Admin";
const LOCAL_ADMIN_FALLBACK_USER_ID =
  process.env.LOCAL_ADMIN_FALLBACK_USER_ID || "00000000-0000-4000-8000-000000000001";

const DEFAULT_PERMISSIONS = [
  "view_orders",
  "update_order_status",
  "assign_driver",
  "view_drivers",
  "manage_products",
  "manage_categories",
  "manage_offers",
  "manage_discounts",
  "manage_users",
  "manage_admins",
  "manage_settings",
  "view_reports",
];

const TOKEN_EXPIRY_SECONDS = 60 * 60 * 8;

export type LocalAdminSessionPayload = {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  exp: number;
  iat: number;
  iss: "local-admin";
  user_metadata: {
    full_name: string;
    role: string;
    permissions: string[];
  };
  app_metadata: {
    role: string;
    permissions: string[];
  };
};

function base64urlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(content: string) {
  return base64urlEncode(crypto.createHmac("sha256", LOCAL_ADMIN_FALLBACK_SECRET).update(content).digest());
}

export function localAdminFallbackEnabled() {
  return ENABLE_LOCAL_ADMIN_FALLBACK && !!LOCAL_ADMIN_FALLBACK_SECRET;
}

export function validateLocalAdminCredentials(email: string, password: string) {
  return (
    localAdminFallbackEnabled() &&
    email.trim().toLowerCase() === SUPER_ADMIN_EMAIL &&
    password === SUPER_ADMIN_PASSWORD
  );
}

export function issueLocalAdminToken(): string {
  if (!localAdminFallbackEnabled()) {
    throw new Error("Local admin fallback is disabled.");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: LocalAdminSessionPayload = {
    sub: LOCAL_ADMIN_FALLBACK_USER_ID,
    email: SUPER_ADMIN_EMAIL,
    role: "super_admin",
    permissions: DEFAULT_PERMISSIONS,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
    iss: "local-admin",
    user_metadata: {
      full_name: SUPER_ADMIN_NAME,
      role: "super_admin",
      permissions: DEFAULT_PERMISSIONS,
    },
    app_metadata: {
      role: "super_admin",
      permissions: DEFAULT_PERMISSIONS,
    },
  };

  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64urlEncode(JSON.stringify(payload));
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyLocalAdminToken(token: string): LocalAdminSessionPayload | null {
  if (!localAdminFallbackEnabled()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expectedSignature = sign(`${header}.${body}`);
  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expectedSignature);
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64urlDecode(body)) as LocalAdminSessionPayload;
    if (payload?.iss !== "local-admin") return null;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

export const LOCAL_ADMIN_SESSION_MAX_AGE_SECONDS = TOKEN_EXPIRY_SECONDS;
export const LOCAL_ADMIN_PROFILE = {
  id: LOCAL_ADMIN_FALLBACK_USER_ID,
  email: SUPER_ADMIN_EMAIL,
  full_name: SUPER_ADMIN_NAME,
  role: "super_admin",
  permissions: DEFAULT_PERMISSIONS,
  disabled: false,
} as const;
