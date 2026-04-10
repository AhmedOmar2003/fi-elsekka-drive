import { ADMIN_NOTIFICATION_ROLES } from "@/lib/admin-notification-recipients";

type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => any;
  };
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
