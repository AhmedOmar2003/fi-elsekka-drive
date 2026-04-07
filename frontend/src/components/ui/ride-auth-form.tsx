"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/services/authService";
import { supabase } from "@/lib/supabase";

type AuthFormProps = {
  mode: "login" | "register";
  role?: "customer" | "captain";
  redirectTo?: string;
};

export function AuthForm({
  mode,
  role = "customer",
  redirectTo,
}: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const isCaptain = role === "captain";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const submitLabel = useMemo(() => {
    if (isRegister) {
      return "إنشاء الحساب";
    }
    return "تسجيل الدخول";
  }, [isRegister]);

  const successRedirect = useMemo(() => {
    if (redirectTo) return redirectTo;
    return isCaptain ? "/captain/offers" : "/book";
  }, [isCaptain, redirectTo]);

  const setSessionCookie = async () => {
    const { data } = await supabase.auth.getSession();
    if (typeof document === "undefined") return;
    if (data?.session?.access_token) {
      document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${
        60 * 60 * 24 * 30
      }; SameSite=Lax;${window.location.protocol === "https:" ? " Secure" : ""}`;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      if (isRegister) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: isCaptain ? "driver" : "customer",
            fullName,
            phone,
            email,
            password,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "تعذر إنشاء الحساب.");
        }

        const loginResult = await signIn(email.trim().toLowerCase(), password);
        if (loginResult.error) {
          throw loginResult.error;
        }

        await setSessionCookie();
        toast.success(
          "الحساب اتفتح بنجاح."
        );
        router.replace(successRedirect);
        return;
      }

      const result = await signIn(email.trim().toLowerCase(), password);
      if (result.error) {
        throw result.error;
      }

      const userRole =
        result.data.user?.user_metadata?.role ||
        result.data.user?.app_metadata?.role ||
        null;

      if (isCaptain && userRole !== "driver") {
        throw new Error("الحساب ده مش مخصص للكباتن.");
      }

      if (!isCaptain && userRole === "driver") {
        throw new Error("الحساب ده خاص بالكباتن. ادخل من رابط دخول الكباتن.");
      }

      await setSessionCookie();
      toast.success("أهلاً بيك، تم تسجيل الدخول.");
      router.replace(successRedirect);
    } catch (error: any) {
      toast.error(error?.message || "حصلت مشكلة في تسجيل الدخول.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[420px] w-full animate-fade-scale-in rounded-[36px] bg-surface-container-low/60 backdrop-blur-2xl border border-white/10 p-6 md:p-10 shadow-[var(--shadow-premium)]">
      {!isRegister ? (
        <div className="flex bg-surface-container-low p-1 rounded-full mb-8 shadow-inner border border-white/5">
          <Link
            href={`/login${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className={`flex-1 text-center py-2.5 rounded-full text-sm font-black transition-all ${
              !isCaptain ? "bg-primary text-white shadow-[var(--shadow-material-1)]" : "text-gray-400 hover:text-foreground"
            }`}
          >
            عميل
          </Link>
          <Link
            href={`/captain/login${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className={`flex-1 text-center py-2.5 rounded-full text-sm font-black transition-all ${
              isCaptain ? "bg-surface-container-high text-primary shadow-[var(--shadow-material-1)] border border-primary/20" : "text-gray-400 hover:text-foreground"
            }`}
          >
            كابتن
          </Link>
        </div>
      ) : null}

      <div className="text-center mb-10">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6 shadow-inner border border-primary/20">
          {isRegister ? <UserPlus className="h-7 w-7 text-primary" /> : <LogIn className="h-7 w-7 text-primary" />}
        </div>
        <h1 className="text-3xl font-black text-foreground mb-3 tracking-tight">
          {isRegister ? "أهلاً بيك في السكة" : (isCaptain ? "دخول الكباتن" : "سجل دخولك")}
        </h1>
        <p className="text-sm text-gray-400 font-medium max-w-[280px] mx-auto leading-relaxed">
          {isRegister
            ? "اعمل حساب جديد بخطوة واحدة واطلب أول مشوار ليك."
            : "سجل دخولك عشان تطلب مشوارك وتتابع رحلاتك."}
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="bg-surface-container-high/30 rounded-[28px] overflow-hidden border border-white/5 shadow-inner">
          {isRegister ? (
            <div className="border-b border-white/5">
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="h-16 bg-transparent border-0 rounded-none px-6 focus-visible:bg-white/5 transition-all text-[15px]"
                placeholder="اسمك بالكامل"
              />
            </div>
          ) : null}

          {isRegister ? (
            <div className="border-b border-white/5">
              <Input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="h-16 bg-transparent border-0 rounded-none px-6 text-left focus-visible:bg-white/5 transition-all text-[15px]"
                dir="ltr"
                placeholder="رقم الموبايل"
              />
            </div>
          ) : null}

          <div className="border-b border-white/5">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-16 bg-transparent border-0 rounded-none px-6 text-left focus-visible:bg-white/5 transition-all text-[15px]"
              dir="ltr"
              placeholder="الإيميل بتاعك"
            />
          </div>

          <div>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-16 bg-transparent border-0 rounded-none px-6 focus-visible:bg-white/5 transition-all text-[15px]"
              placeholder="كلمة المرور"
            />
          </div>
        </div>

        <Button
          type="submit"
          isLoading={isLoading}
          className="h-14 w-full rounded-[20px] text-[17px] font-black mt-6 shadow-[var(--shadow-glow-primary)] transition-transform active:scale-[0.98]"
        >
          {submitLabel}
        </Button>

        <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t border-white/5">
          {isRegister ? (
            <Link
              href={`/login${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
              className="text-sm text-primary font-bold hover:underline"
            >
              عندي حساب بالفعل
            </Link>
          ) : isCaptain ? (
            <Link href="/support" className="text-sm text-primary font-bold hover:underline">
              معنديش حساب كابتن، أكلم الإدارة
            </Link>
          ) : (
            <Link
              href={`/register${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
              className="text-sm text-primary font-bold hover:underline"
            >
              إنشاء حساب جديد
            </Link>
          )}

          {!isRegister ? (
            <Link href="/support" className="text-xs text-gray-500 hover:text-foreground transition-colors">
              نسيت كلمة المرور؟
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  );
}
