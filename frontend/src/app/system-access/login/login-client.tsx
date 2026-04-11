"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, Lock, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { getFirstAccessibleAdminPath } from "@/lib/permissions";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { signIn } from "@/services/authService";
import type { Session, User } from "@supabase/supabase-js";

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

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Clear stale local session instantly without waiting on network signOut.
    localStorage.removeItem("guestCart");
    localStorage.removeItem("fi-elsekka-auth-session");
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        localStorage.removeItem(key);
      }
    });
    const secure = window.location.protocol === "https:" ? " Secure;" : "";
    document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax;${secure}`;
    document.cookie = `sb-refresh-token=; path=/; max-age=0; SameSite=Lax;${secure}`;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : null;
    if (projectRef) {
      document.cookie = `sb-${projectRef}-auth-token=; path=/; max-age=0; SameSite=Lax;${secure}`;
    }
    void supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }, []);

  const persistSessionCookies = (session: Session | null | undefined) => {
    if (typeof document === "undefined" || !session?.access_token) return;
    const secure = window.location.protocol === "https:" ? " Secure;" : "";
    document.cookie = `sb-access-token=${encodeURIComponent(session.access_token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax;${secure}`;
    if (session.refresh_token) {
      document.cookie = `sb-refresh-token=${encodeURIComponent(session.refresh_token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax;${secure}`;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectRef = supabaseUrl
      ? new URL(supabaseUrl).hostname.split(".")[0]
      : null;
    if (projectRef) {
      const authPayload = encodeURIComponent(
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      );
      document.cookie = `sb-${projectRef}-auth-token=${authPayload}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax;${secure}`;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("أدخل البريد وكلمة المرور.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("إعدادات Supabase غير مكتملة على بيئة النشر.");
      return;
    }

    setIsLoading(true);
    try {
      // Do not block login flow on this lightweight endpoint.
      void fetch("/api/system-access/rate-limit", {
        method: "POST",
        cache: "no-store",
      }).catch(() => {});

      const { data: signInData, error } = await withTimeout(
        signIn(email.trim().toLowerCase(), password),
        25000,
        "signin",
      );

      if (error) {
        toast.error("بيانات الدخول غير صحيحة أو الحساب مقيد.");
        return;
      }

      persistSessionCookies(signInData?.session);
      const resolvedProfile = buildAdminProfileFromUser(signInData?.user);

      const adminRoles = [
        "super_admin",
        "admin",
        "operations_manager",
        "catalog_manager",
        "support_agent",
      ];

      if (!resolvedProfile || !adminRoles.includes(resolvedProfile.role || "")) {
        void supabase.auth.signOut({ scope: "local" }).catch(() => {});
        toast.error("الحساب ده مش مخصص لدخول لوحة التحكم.");
        return;
      }

      router.replace(
        redirect === "/admin" ? getFirstAccessibleAdminPath(resolvedProfile) : redirect
      );
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith("timeout:")
        ? "الخادم تأخر في الاستجابة. حاول مرة أخرى خلال لحظات."
        : "حصلت مشكلة أثناء تسجيل الدخول. حاول مرة أخرى.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  function buildAdminProfileFromUser(user: User | null | undefined) {
    if (!user) return null;
    const userMeta = user.user_metadata as Record<string, unknown> | undefined;
    const appMeta = user.app_metadata as Record<string, unknown> | undefined;
    const role =
      (typeof userMeta?.role === "string" ? userMeta.role : null) ||
      (typeof appMeta?.role === "string" ? appMeta.role : null) ||
      undefined;
    const userPerms = Array.isArray(userMeta?.permissions) ? userMeta?.permissions : [];
    const appPerms = Array.isArray(appMeta?.permissions) ? appMeta?.permissions : [];
    const permissions = [...userPerms, ...appPerms].filter(
      (item, index, arr): item is string =>
        typeof item === "string" && arr.findIndex((entry) => entry === item) === index,
    );

    return {
      id: user.id,
      full_name: (typeof userMeta?.full_name === "string" ? userMeta.full_name : user.email) || "",
      email: user.email || "",
      role,
      permissions,
      disabled: false,
    };
  }

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
