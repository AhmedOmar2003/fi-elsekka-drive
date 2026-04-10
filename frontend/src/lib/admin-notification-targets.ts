import { ADMIN_NOTIFICATION_ROLES } from "@/lib/admin-notification-recipients";

type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => any;
  };
};

type CurrentAdminUser = {
  id: string;
  email?: string | null;
};

export async function resolveAdminNotificationRecipientIds(supabase: SupabaseLikeClient) {
  const ids = new Set<string>();

  const profilesResult = await supabase
    .from("profiles")
    .select("id, role, account_status")
    .in("role", [...ADMIN_NOTIFICATION_ROLES])
    .eq("account_status", "active");

  for (const row of profilesResult.data || []) {
    if (row?.id) ids.add(String(row.id));
  }

  const legacyUsersResult = await supabase
    .from("users")
    .select("id, role, disabled")
    .in("role", [...ADMIN_NOTIFICATION_ROLES]);

  if (!legacyUsersResult.error) {
    for (const row of legacyUsersResult.data || []) {
      if (row?.id && row?.disabled !== true) {
        ids.add(String(row.id));
      }
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
