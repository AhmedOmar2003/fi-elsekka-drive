"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CarFront, LogIn, UserPlus, CarTaxiFront } from "lucide-react";
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

  const [vehicleType, setVehicleType] = useState<"car" | "tuk_tuk">("car");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [workingCity, setWorkingCity] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const submitLabel = useMemo(() => {
    if (isRegister) {
      return isCaptain ? "إنشاء حساب كابتن" : "إنشاء الحساب";
    }
    return "تسجيل الدخول";
  }, [isRegister, isCaptain]);

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
            nationalId: isCaptain ? nationalId : null,
            workingCity: isCaptain ? workingCity : null,
            vehicleType: isCaptain ? vehicleType : null,
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
          isCaptain
            ? "حساب الكابتن اتفتح، وكملنا أول خطوة من الانضمام."
            : "الحساب اتفتح بنجاح."
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
        throw new Error("الحساب ده خاص بالكباتن. ادخل من تبويب الكابتن.");
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
    <div className="mx-auto max-w-md w-full animate-fade-in pt-4 pb-12">
      <div className="flex bg-surface-container-low p-1 rounded-full mb-8 shadow-inner border border-white/5">
        <Link
          href={`/${isRegister ? "register" : "login"}${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className={`flex-1 text-center py-2.5 rounded-full text-sm font-black transition-all ${
            !isCaptain ? "bg-primary text-white shadow-[var(--shadow-material-1)]" : "text-gray-400 hover:text-foreground"
          }`}
        >
          أطلب توصيلة
        </Link>
        <Link
          href={`/${isRegister ? "register" : "login"}?role=captain${redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className={`flex-1 text-center py-2.5 rounded-full text-sm font-black transition-all ${
            isCaptain ? "bg-surface-container-high text-primary shadow-[var(--shadow-material-1)] border border-primary/20" : "text-gray-400 hover:text-foreground"
          }`}
        >
          كابتن
        </Link>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-foreground mb-2">
          {isRegister ? (isCaptain ? "إنشاء حساب كابتن" : "إنشاء حساب جديد") : (isCaptain ? "دخول الكباتن" : "تسجيل الدخول")}
        </h1>
        <p className="text-sm text-gray-500 max-w-[320px] mx-auto leading-7">
          {isRegister
            ? isCaptain
              ? "سجّل بالإيميل وكمل بياناتك الأساسية علشان نبدأ مراجعة حسابك."
              : "سجّل بالإيميل العادي Gmail من غير انتظار رسالة تأكيد."
            : "ادخل بالإيميل والباسورد وتابع مشاويرك على طول."}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {isRegister ? (
          <Input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="h-14 bg-surface-container-low border-white/10 rounded-[20px] px-5"
            placeholder={isCaptain ? "اسمك بالكامل زي البطاقة" : "اسمك بالكامل"}
          />
        ) : null}

        {isRegister ? (
          <Input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-14 bg-surface-container-low border-white/10 rounded-[20px] px-5 text-left"
            dir="ltr"
            placeholder="رقم الموبايل"
          />
        ) : null}

        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-14 bg-surface-container-low border-white/10 rounded-[20px] px-5 text-left"
          dir="ltr"
          placeholder="name@gmail.com"
        />

        {isRegister && isCaptain ? (
          <>
            <Input
              value={nationalId}
              onChange={(event) => setNationalId(event.target.value)}
              className="h-14 bg-surface-container-low border-white/10 rounded-[20px] px-5"
              placeholder="الرقم القومي"
            />
            <Input
              value={workingCity}
              onChange={(event) => setWorkingCity(event.target.value)}
              className="h-14 bg-surface-container-low border-white/10 rounded-[20px] px-5"
              placeholder="المدينة أو المحافظة الأساسية"
            />
            <div className="pt-2 pb-2">
              <label className="block text-sm font-bold text-foreground mb-3 px-2">نوع مركبتك إيه؟</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVehicleType("car")}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-[24px] border-2 transition-all ${
                    vehicleType === "car"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-surface-container-low bg-surface-container-low text-gray-400 hover:border-white/10"
                  }`}
                >
                  <CarTaxiFront className="w-8 h-8 mb-2" />
                  <span className="text-sm font-black">عربية</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVehicleType("tuk_tuk")}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-[24px] border-2 transition-all ${
                    vehicleType === "tuk_tuk"
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-surface-container-low bg-surface-container-low text-gray-400 hover:border-white/10"
                  }`}
                >
                  <CarFront className="w-8 h-8 mb-2" />
                  <span className="text-sm font-black">توك توك</span>
                </button>
              </div>
            </div>
          </>
        ) : null}

        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-14 bg-surface-container-low border-white/10 rounded-[20px] px-5"
          placeholder="كلمة المرور"
        />

        <Button
          type="submit"
          isLoading={isLoading}
          className="h-14 w-full rounded-full text-base font-black mt-4 shadow-[0_4px_20px_-4px_rgba(61,161,132,0.4)]"
        >
          {isRegister ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {submitLabel}
        </Button>

        <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t border-white/5">
          <Link
            href={`${isRegister ? "/login" : "/register"}${isCaptain ? "?role=captain" : ""}${redirectTo ? `${isCaptain ? "&" : "?"}redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="text-sm text-primary font-bold hover:underline"
          >
            {isRegister ? "عندي حساب بالفعل" : "إنشاء حساب جديد"}
          </Link>

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
