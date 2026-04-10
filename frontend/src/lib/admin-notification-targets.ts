import { ADMIN_NOTIFICATION_ROLES } from "@/lib/admin-notification-recipients";

type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => any;
    upsert?: (values: Record<string, unknown>, options?: Record<string, unknown>) => any;
  };
  auth?: {
    admin?: {
      listUsers?: (params?: { page?: number; perPage?: number }) => Promise<any>;
    };
  };
};

type CurrentAdminUser = {
  id: string;
  email?: string | null;
};

export async function resolveAdminNotificationRecipientIds(supabase: SupabaseLikeClient) {
  const ids = new Set<string>();
  const now = new Date().toISOString();

  const profilesResult = await supabase
    .from("profiles")
    .select("id, role, account_status, full_name, email")
    .in("role", [...ADMIN_NOTIFICATION_ROLES])
    .eq("account_status", "active");

  for (const row of profilesResult.data || []) {
    if (!row?.id) continue;
    const id = String(row.id);
    ids.add(id);
  }

  const legacyUsersResult = await supabase
    .from("users")
    .select("id, role, disabled")
    .in("role", [...ADMIN_NOTIFICATION_ROLES]);

  if (!legacyUsersResult.error) {
    for (const row of legacyUsersResult.data || []) {
      if (!row?.id || row?.disabled === true) continue;
      const legacyId = String(row.id);
      if (ids.has(legacyId)) continue;

      // If a legacy admin exists without a profiles row, create a minimal operational profile
      // so notifications can be delivered reliably via recipient_user_id.
      const profilesTable = supabase.from("profiles");
      if (typeof profilesTable.upsert === "function") {
        const upsertPayload = {
          id: legacyId,
          role: String(row.role || "admin"),
          account_status: "active",
          full_name: String((row as Record<string, unknown>).full_name || "Admin"),
          display_name: String((row as Record<string, unknown>).full_name || "Admin"),
          email: String((row as Record<string, unknown>).email || ""),
          updated_at: now,
        };
        const upsertResult = await profilesTable.upsert(upsertPayload, { onConflict: "id" });
        if (!upsertResult?.error) {
          ids.add(legacyId);
        }
      }
    }
  }

  // Fallback for environments where admin roles exist only in Supabase Auth metadata.
  const listUsersFn = supabase.auth?.admin?.listUsers;
  if (typeof listUsersFn === "function") {
    try {
      const listed = await listUsersFn({ page: 1, perPage: 300 });
      const authUsers = listed?.data?.users || [];
      for (const authUser of authUsers) {
        const id = String(authUser?.id || "").trim();
        if (!id || ids.has(id)) continue;

        const userMeta =
          authUser.user_metadata && typeof authUser.user_metadata === "object"
            ? (authUser.user_metadata as Record<string, unknown>)
            : {};
        const appMeta =
          authUser.app_metadata && typeof authUser.app_metadata === "object"
            ? (authUser.app_metadata as Record<string, unknown>)
            : {};
        const role = String(userMeta.role || appMeta.role || "").trim();
        if (!ADMIN_NOTIFICATION_ROLES.includes(role as (typeof ADMIN_NOTIFICATION_ROLES)[number])) {
          continue;
        }

        ids.add(id);
        const profilesTable = supabase.from("profiles");
        if (typeof profilesTable.upsert === "function") {
          const fullName = String(userMeta.full_name || authUser.email || "Admin");
          await profilesTable.upsert(
            {
              id,
              role,
              account_status: "active",
              full_name: fullName,
              display_name: fullName,
              email: String(authUser.email || ""),
              updated_at: now,
            },
            { onConflict: "id" }
          );
        }
      }
    } catch {
      // Keep notifications flow alive even if auth-admin listing is unavailable in this environment.
    }
  }

  return [...ids];
}

export async function resolveCurrentAdminNotificationRecipientIds(
  supabase: SupabaseLikeClient,
  currentUser: CurrentAdminUser
) {
  const ids = new Set<string>();
  if (currentUser.id) ids.add(String(currentUser.id));

  const normalizedEmail = String(currentUser.email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return [...ids];
  }

  const [profilesResult, legacyUsersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, role, account_status")
      .in("role", [...ADMIN_NOTIFICATION_ROLES])
      .eq("account_status", "active"),
    supabase
      .from("users")
      .select("id, email, role, disabled")
      .in("role", [...ADMIN_NOTIFICATION_ROLES]),
  ]);

  for (const row of profilesResult.data || []) {
    if (String(row?.email || "").trim().toLowerCase() === normalizedEmail && row?.id) {
      ids.add(String(row.id));
    }
  }

  if (!legacyUsersResult.error) {
    for (const row of legacyUsersResult.data || []) {
      if (row?.disabled === true) continue;
      if (String(row?.email || "").trim().toLowerCase() === normalizedEmail && row?.id) {
        ids.add(String(row.id));
      }
    }
  }

  return [...ids];
}
