import { Header } from "@/components/layout/header";
import { AuthForm } from "@/components/ui/ride-auth-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  const role = params.role === "captain" ? "captain" : "customer";
  const redirect = params.redirect || undefined;

  return (
    <>
      <Header />
      <main className="flex-1 w-full pt-20 pb-24 px-4 overflow-y-auto">
        <AuthForm mode="register" role={role} redirectTo={redirect} />
      </main>
    </>
  );
}
