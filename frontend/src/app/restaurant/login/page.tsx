"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { getUserProfile, signIn, signOut } from "@/services/authService";
import { ChefHat, AlertCircle, CheckCircle2, LogIn } from "lucide-react";

export default function RestaurantLoginPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <React.Suspense
        fallback={
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        }
      >
        <RestaurantLoginContent />
      </React.Suspense>
    </main>
  );
}

function RestaurantLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = React.useState(searchParams.get("email") || "");
  const [password, setPassword] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const blocked = searchParams.get("blocked") === "1";
    if (blocked) {
      setSuccessMsg("");
      setErrorMsg("الحساب ده مخصص لبوابة المطعم فقط. سجل من هنا علشان تشوف طلبات مطعمك على طول.");
      return;
    }

    const signedOut = searchParams.get("logged_out") === "1";
    if (signedOut) {
      setErrorMsg("");
      setSuccessMsg("استنّاك ترجع تتابع طلبات المطعم من جديد 👨‍🍳");
    }
  }, [searchParams]);

  const translateError = (message: string) => {
    if (message.includes("Invalid login credentials")) {
      return "الإيميل أو الباسورد مش مظبوطين، جرّب تاني.";
    }
    if (message.includes("Email not confirmed")) {
      return "الإيميل لسه محتاج تأكيد.";
    }
    return "مش قادرين نفتح بوابة المطعم دلوقتي، جرّب تاني بعد شوية.";
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const { data, error } = await signIn(email, password);
    if (error) {
      setIsLoading(false);
      setErrorMsg(translateError(error.message));
      return;
    }

    const authUser = data?.user;
    const userRole = authUser?.user_metadata?.role;
    const profile = authUser?.id ? await getUserProfile(authUser.id) : null;
    const normalizedRole = profile?.role || userRole || null;

    if (normalizedRole !== "restaurant_manager") {
      await signOut();
      setIsLoading(false);
      setErrorMsg("الصفحة دي مخصوص للمطاعم فقط. لو إنت عميل أو موظف استخدم صفحة الدخول المناسبة ليك.");
      return;
    }

    if (profile?.disabled) {
      await signOut();
      setIsLoading(false);
      setErrorMsg("حساب المطعم ده موقوف حاليًا. تواصل مع إدارة في السكة علشان نفعّله لك.");
      return;
    }

    router.push("/restaurant");
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-surface-hover bg-surface p-6 shadow-premium sm:p-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ChefHat className="h-8 w-8" />
      </div>

      <h1 className="mb-2 text-center text-3xl font-black text-foreground">بوابة المطعم</h1>
      <p className="mb-8 text-center text-gray-500">
        ادخل بالإيميل والباسورد اللي الإدارة سلّمتهم لك علشان تتابع الطلبات الجديدة من في السكة.
      </p>

      {errorMsg ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      {successMsg ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      ) : null}

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-2">
          <label className="px-1 text-sm font-bold text-foreground">الإيميل</label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="restaurant@mail.com"
            className="h-12 rounded-xl border-surface-hover bg-background text-start direction-ltr focus-visible:border-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="px-1 text-sm font-bold text-foreground">الباسورد</label>
          <PasswordInput
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-12 rounded-xl border-surface-hover bg-background text-start direction-ltr focus-visible:border-primary"
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-lg font-bold"
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
          ) : (
            <>
              <LogIn className="h-5 w-5" />
              ادخل على طلبات المطعم
            </>
          )}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-gray-500">
        لو إنت مستخدم عادي،{" "}
        <Link href="/login" className="font-bold text-primary hover:underline">
          ارجع لصفحة الدخول العادية
        </Link>
      </div>
    </div>
  );
}
