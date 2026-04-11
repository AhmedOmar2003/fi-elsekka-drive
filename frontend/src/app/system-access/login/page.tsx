import { ensureBootstrappedSuperAdmin, SUPER_ADMIN_BOOTSTRAP_DEFAULTS } from "@/lib/bootstrap-super-admin";

import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{
    redirect?: string;
  }>;
};

export default async function SecureAdminLogin({ searchParams }: LoginPageProps) {
  if (process.env.NODE_ENV !== "production") {
    await ensureBootstrappedSuperAdmin();
  }

  const resolvedSearchParams = (await searchParams) || {};
  const redirect = resolvedSearchParams.redirect || "/admin";

  return (
    <LoginClient
      emailPlaceholder={SUPER_ADMIN_BOOTSTRAP_DEFAULTS.email}
      redirect={redirect}
    />
  );
}
