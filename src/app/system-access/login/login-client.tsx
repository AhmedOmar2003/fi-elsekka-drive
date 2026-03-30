"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, Lock, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { getFirstAccessibleAdminPath } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import { getUserProfile, signIn, signOut } from "@/services/authService";

type LoginClientProps = {
  emailPlaceholder: string;
  redirect: string;
};

export function LoginClient({
  emailPlaceholder,
  redirect,
}: LoginClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    signOut();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("أدخل البريد وكلمة المرور.");
      return;
    }

    setIsLoading(true);

    await fetch("/api/system-access/rate-limit", {
      method: "POST",
      cache: "no-store",
    }).catch(() => {});

    const { data: signInData, error } = await signIn(
      email.trim().toLowerCase(),
      password
    );

    if (error) {
      setIsLoading(false);
      toast.error("بيانات الدخول غير صحيحة أو الحساب مقيد.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax;${
        window.location.protocol === "https:" ? " Secure" : ""
      }`;
    }

    const profile = signInData?.user?.id
      ? await getUserProfile(signInData.user.id)
      : null;
    const authMetadataRole =
      signInData?.user?.user_metadata?.role ||
      signInData?.user?.app_metadata?.role ||
      null;
    const authMetadataPermissions = Array.isArray(
      signInData?.user?.user_metadata?.permissions
    )
      ? signInData.user.user_metadata.permissions
      : Array.isArray(signInData?.user?.app_metadata?.permissions)
        ? signInData.user.app_metadata.permissions
        : [];

    const resolvedProfile = profile
      ? {
          ...profile,
          role: profile.role || authMetadataRole || undefined,
          permissions:
            Array.isArray(profile.permissions) && profile.permissions.length > 0
              ? profile.permissions
              : authMetadataPermissions,
        }
      : signInData?.user?.id
        ? {
            id: signInData.user.id,
            full_name:
              signInData.user.user_metadata?.full_name ||
              signInData.user.email ||
              "",
            email: signInData.user.email || "",
            role: authMetadataRole || undefined,
            permissions: authMetadataPermissions,
            disabled: false,
          }
        : null;

    const adminRoles = [
      "super_admin",
      "admin",
      "operations_manager",
      "catalog_manager",
      "support_agent",
    ];

    if (!resolvedProfile || !adminRoles.includes(resolvedProfile.role || "")) {
      await signOut();
      setIsLoading(false);
      toast.error("الحساب ده مش مخصص لدخول لوحة التحكم.");
      return;
    }

    setIsLoading(false);
    router.replace(
      redirect === "/admin" ? getFirstAccessibleAdminPath(resolvedProfile) : redirect
    );
  };

  return (
    <div className="min-h-screen bg-[#05070a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-black text-white mb-2">
            دخول الإدارة الآمن
          </h1>
          <p className="text-sm font-bold text-gray-500">
            حساب السوبر أدمن الافتراضي جاهز للاستخدام
          </p>
        </div>

        <div className="bg-[#0a0e14] border border-white/5 shadow-2xl rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 ms-1 uppercase tracking-widest">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-gray-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl ps-12 pe-4 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-bold"
                  placeholder={emailPlaceholder}
                  dir="ltr"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 ms-1 uppercase tracking-widest">
                كلمة المرور
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-gray-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl ps-12 pe-4 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all tracking-widest font-bold"
                  placeholder="••••••••"
                  dir="ltr"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-primary hover:bg-primary-hover active:bg-primary/80 text-white font-bold rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mt-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جار التحقق...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  دخول الإدارة
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-xs font-bold text-gray-500 hover:text-white transition-colors"
          >
            &larr; العودة للموقع
          </a>
        </div>
      </div>
    </div>
  );
}
