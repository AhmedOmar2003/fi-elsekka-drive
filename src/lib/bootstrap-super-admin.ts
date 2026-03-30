import "server-only";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || "";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "admin@drive.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "drive1";
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || "Drive Super Admin";
const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || "drive-super-admin";

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

let bootstrapPromise: Promise<void> | null = null;

async function findAuthUserIdByEmail(supabaseAdmin: ReturnType<typeof createClient>, email: string) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    return match?.id || null;
}

async function runBootstrap() {
    if (!supabaseUrl || !serviceRoleKey) return;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    let authUserId = await findAuthUserIdByEmail(supabaseAdmin, SUPER_ADMIN_EMAIL);

    if (!authUserId) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: SUPER_ADMIN_EMAIL,
            password: SUPER_ADMIN_PASSWORD,
            email_confirm: true,
            user_metadata: {
                full_name: SUPER_ADMIN_NAME,
                username: SUPER_ADMIN_USERNAME,
                role: "super_admin",
                permissions: DEFAULT_PERMISSIONS,
            },
        });

        if (error && !error.message?.includes("User already registered")) {
            throw error;
        }

        authUserId = data.user?.id || (await findAuthUserIdByEmail(supabaseAdmin, SUPER_ADMIN_EMAIL));
    } else {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            email: SUPER_ADMIN_EMAIL,
            password: SUPER_ADMIN_PASSWORD,
            user_metadata: {
                full_name: SUPER_ADMIN_NAME,
                username: SUPER_ADMIN_USERNAME,
                role: "super_admin",
                permissions: DEFAULT_PERMISSIONS,
            },
        });

        if (error) throw error;
    }

    if (!authUserId) return;

    const legacyPayload = {
        id: authUserId,
        full_name: SUPER_ADMIN_NAME,
        username: SUPER_ADMIN_USERNAME,
        email: SUPER_ADMIN_EMAIL,
        role: "super_admin",
        permissions: DEFAULT_PERMISSIONS,
        disabled: false,
        must_change_password: false,
    };

    const { error: legacyError } = await supabaseAdmin.from("users").upsert(legacyPayload);
    if (legacyError && process.env.NODE_ENV !== "production") {
        console.warn("Super admin bootstrap legacy users upsert skipped:", legacyError.message);
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
        id: authUserId,
        full_name: SUPER_ADMIN_NAME,
        display_name: "Super Admin",
        email: SUPER_ADMIN_EMAIL,
        role: "admin",
        account_status: "active",
    });

    if (profileError && process.env.NODE_ENV !== "production") {
        console.warn("Super admin bootstrap profiles upsert skipped:", profileError.message);
    }
}

export async function ensureBootstrappedSuperAdmin() {
    if (!bootstrapPromise) {
        bootstrapPromise = runBootstrap().catch((error) => {
            if (process.env.NODE_ENV !== "production") {
                console.error("Failed to bootstrap super admin:", error);
            }
        });
    }

    await bootstrapPromise;
}

export const SUPER_ADMIN_BOOTSTRAP_DEFAULTS = {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
};
