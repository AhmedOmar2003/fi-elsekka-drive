"use client";

import Link from "next/link";
import { ArrowLeft, CarFront, LogIn, UserPlus, CarTaxiFront, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export function AuthForm({ mode, role = "customer" }: { mode: "login" | "register"; role?: "customer" | "captain" }) {
  const isRegister = mode === "register";
  const isCaptain = role === "captain";

  const [vehicleType, setVehicleType] = useState("car");

  return (
    <div className="mx-auto max-w-md w-full animate-fade-in pt-4 pb-12">
      {/* Role Switcher (App-like top tabs) */}
      <div className="flex bg-surface-container-low p-1 rounded-full mb-8 shadow-inner border border-white/5">
        <Link
          href={`/${isRegister ? "register" : "login"}`}
          className={`flex-1 text-center py-2.5 rounded-full text-sm font-black transition-all ${
            !isCaptain ? "bg-primary text-white shadow-[var(--shadow-material-1)]" : "text-gray-400 hover:text-foreground"
          }`}
        >
          أطلب توصيلة (راكب)
        </Link>
        <Link
          href={`/${isRegister ? "register" : "login"}?role=captain`}
          className={`flex-1 text-center py-2.5 rounded-full text-sm font-black transition-all ${
            isCaptain ? "bg-surface-container-high text-primary shadow-[var(--shadow-material-1)] border border-primary/20" : "text-gray-400 hover:text-foreground"
          }`}
        >
          شريك السكة (كابتن)
        </Link>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-foreground mb-2">
          {isRegister ? (isCaptain ? "سجل معانا كابتن" : "إنشاء حساب جديد") : (isCaptain ? "دخول الكباتن" : "تسجيل الدخول")}
        </h1>
        <p className="text-sm text-gray-500 max-w-[280px] mx-auto">
          {isRegister 
            ? "بخطوات بسيطة وفي أقل من دقيقة، املأ بياناتك الأساسية."
            : "أهلاً بك مرة أخرى، ادخل لتتابع مشاويرك."}
        </p>
      </div>

      <div className="space-y-4">
        {/* Registration specific fields */}
        {isRegister && (
          <div>
            <Input className="h-14 bg-surface-container-low border-white/10 rounded-[20px] px-5 focus-visible:bg-surface-container-high transition-colors" placeholder={isCaptain ? "اسمك بالكامل (زي البطاقة)" : "اسمك بالكامل"} />
          </div>
        )}

        {/* Common fields */}
        <div>
          <Input type="tel" className="h-14 bg-surface-container-low border-white/10 rounded-[20px] px-5 focus-visible:bg-surface-container-high transition-colors text-left" dir="ltr" placeholder="رقم الموبايل (مثال: 010xxxxxxxx)" />
        </div>
        
        {/* Vehicle Selection for Captain Registration */}
        {isRegister && isCaptain && (
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
                <span className="text-sm font-black">صاحب عربية</span>
              </button>
              
              <button
                type="button"
                onClick={() => setVehicleType("tuktuk")}
                className={`relative flex flex-col items-center justify-center p-4 rounded-[24px] border-2 transition-all ${
                  vehicleType === "tuktuk" 
                    ? "border-secondary bg-secondary/10 text-secondary" 
                    : "border-surface-container-low bg-surface-container-low text-gray-400 hover:border-white/10"
                }`}
              >
                <div className="flex animate-pulse-slow">
                  <CarFront className="w-8 h-8 mb-2" />
                </div>
                <span className="text-sm font-black">صاحب توكتوك</span>
              </button>
            </div>
          </div>
        )}

        {/* Common fields cont. */}
        <div>
          <Input type="password" className="h-14 bg-surface-container-low border-white/10 rounded-[20px] px-5 focus-visible:bg-surface-container-high transition-colors" placeholder="كلمة المرور" />
        </div>

        {/* Register submit fields */}
        {isRegister && isCaptain ? (
          <div>
            <Input className="h-14 bg-surface-container-low border-white/10 rounded-[20px] px-5 focus-visible:bg-surface-container-high transition-colors" placeholder="المنطقة أو المحافظة" />
          </div>
        ) : null}

        <Button className="h-14 w-full rounded-full text-base font-black mt-4 shadow-[0_4px_20px_-4px_rgba(61,161,132,0.4)]">
          {isRegister ? (isCaptain ? "سجل ككابتن دلوقتي" : "إنشاء الحساب") : "تسجيل الدخول"}
        </Button>

        <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t border-white/5">
          <Link href={isRegister ? `/login${isCaptain ? "?role=captain" : ""}` : `/register${isCaptain ? "?role=captain" : ""}`} className="text-sm text-primary font-bold hover:underline">
            {isRegister ? "عندي حساب بالفعل، تسجيل الدخول" : (isCaptain ? "جديد معانا؟ سجل ككابتن" : "إنشاء حساب جديد كراكب")}
          </Link>
          
          {!isRegister && (
            <Link href="/support" className="text-xs text-gray-500 hover:text-foreground transition-colors">
              نسيت كلمة المرور؟
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
