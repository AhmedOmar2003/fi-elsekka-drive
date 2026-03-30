"use client";

import Link from "next/link";
import { ArrowLeft, Briefcase, PlaneTakeoff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MapPreview } from "@/components/ride/shared";
import { airports } from "@/lib/ride-content";

export function AirportRideForm() {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr]">
      <div className="ride-panel rounded-[32px] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PlaneTakeoff className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-foreground">مشوار المطار</h1>
            <p className="text-sm text-gray-500">لو رايح أو جاي من المطار، إدينا التفاصيل اللي هتفرق مع الاستقبال والتحرك.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">نوع الرحلة</label>
            <Select defaultValue="pickup">
              <option value="pickup">استقبال من المطار</option>
              <option value="dropoff">توصيل للمطار</option>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">المطار</label>
            <Select defaultValue={airports[0]}>
              {airports.map((airport) => (
                <option key={airport} value={airport}>
                  {airport}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">الترمينال</label>
            <Input placeholder="مثال: Terminal 3" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">رقم الرحلة</label>
            <Input placeholder="اختياري - مثال: MS985" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">عدد الركاب</label>
            <div className="relative">
              <Users className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input placeholder="2" className="pe-10" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">عدد الشنط</label>
            <div className="relative">
              <Briefcase className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
              <Input placeholder="3" className="pe-10" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-black text-foreground">ملاحظات للكابتن</label>
            <textarea
              rows={4}
              placeholder="مثال: هبقى مستني عند بوابة الوصول 5، أو معايا عربية أطفال."
              className="w-full rounded-[24px] border border-surface-border bg-surface-container px-4 py-3 text-sm text-foreground shadow-[var(--shadow-material-1)] outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-primary/10 bg-primary/5 p-4 text-sm leading-7 text-gray-500">
          هنستخدم البيانات دي بعدين في الـtrip summary، ونفس الهيكل جاهز لإرسالها لقاعدة البيانات وربط حالة الرحلة الفعلية.
        </div>

        <Button asChild className="mt-5 h-12 w-full rounded-full text-base">
          <Link href="/trip/confirm">
            راجع الطلب
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <MapPreview
        title="تجهيز الوصول أو التحرك"
        subtitle="المكان ده جاهز لعرض route من البيت أو المطار، مع ETA، pin الترمينال، وأقرب كابتن متاح بعد الدمج الفعلي."
      />
    </div>
  );
}
