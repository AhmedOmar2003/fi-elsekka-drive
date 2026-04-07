"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FileUploadField } from "@/components/ui/ride-file-upload-field";
import { driverRequirements, vehicleBrands, vehicleTypes } from "@/lib/ride-content";

export function DriverRegistrationForm() {
  const [vehicleType, setVehicleType] = useState("car");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="ride-panel rounded-[32px] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-foreground">انضم ككابتن</h1>
            <p className="mt-2 text-sm text-gray-500">سجل بياناتك وبيانات المركبة. الفورم جاهز للتخزين وربط حالة المراجعة بعدين.</p>
          </div>
          <Badge variant="success" className="rounded-full px-4 py-1.5 text-xs">
            Frontend جاهز للـSupabase
          </Badge>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">الاسم بالكامل</label>
            <Input placeholder="مثال: محمود السيد" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">رقم الموبايل</label>
            <Input placeholder="0100xxxxxxx" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">الرقم القومي</label>
            <Input placeholder="14 رقم" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">المدينة / المنطقة</label>
            <Input placeholder="مثال: المعادي - القاهرة" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">نوع المركبة</label>
            <Select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}>
              {vehicleTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">الماركة</label>
            <Select defaultValue={vehicleBrands[0]}>
              {vehicleBrands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">الموديل</label>
            <Input placeholder="مثال: إلنترا 2021" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">اللون</label>
            <Input placeholder="أبيض" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">سنة الصنع</label>
            <Input placeholder="2020" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">رقم اللوحة</label>
            <Input placeholder="س ب د 1234" />
          </div>

          {vehicleType === "car" ? (
            <div>
              <label className="mb-2 block text-sm font-black text-foreground">عدد المقاعد</label>
              <Input placeholder="4" />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm font-black text-foreground">منطقة التشغيل</label>
                <Input placeholder="مثال: فيصل / الهرم" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-black text-foreground">حالة التوك توك</label>
                <Select defaultValue="good">
                  <option value="good">كويسة</option>
                  <option value="very-good">جيدة جدًا</option>
                  <option value="excellent">ممتازة</option>
                </Select>
              </div>
            </>
          )}

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-black text-foreground">ملاحظات إضافية</label>
            <textarea
              rows={4}
              placeholder="مثال: معايا خبرة في مشاوير المطار، أو بشتغل في نطاق معين."
              className="w-full rounded-[24px] border border-surface-border bg-surface-container px-4 py-3 text-sm text-foreground shadow-[var(--shadow-material-1)] outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FileUploadField label="صورة شخصية" hint="Placeholder لصورة البروفايل بعد الربط الفعلي." />
          <FileUploadField label="صورة رخصة القيادة" hint="هتترفع وتتراجع من لوحة الإدارة لاحقًا." />
          <FileUploadField label="صورة البطاقة" hint="الوجهين أو الملف المطلوب." />
          <FileUploadField label="رخصة المركبة" hint="صورة واضحة للترخيص الحالي." />
          <FileUploadField label="صورة المركبة" hint="من الأمام أو زاوية تبين الحالة." />
          <FileUploadField label="فيش وتشبيه / خلفية" hint="اختياري حاليًا، ومكانه جاهز لو قررتوا تخلوه إلزامي." />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button className="h-12 flex-1 rounded-full text-base">قدّم الطلب</Button>
          <Button variant="outline" className="h-12 rounded-full px-6">
            احفظ كمسودة
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="ride-panel rounded-[32px] p-5">
          <h2 className="text-xl font-black text-foreground">المطلوب منك</h2>
          <div className="mt-5 space-y-3">
            {driverRequirements.map((requirement) => (
              <div key={requirement} className="rounded-[22px] border border-surface-border bg-white/75 px-4 py-3 text-sm font-bold text-foreground">
                {requirement}
              </div>
            ))}
          </div>
        </div>
        <div className="ride-panel rounded-[32px] p-5">
          <h2 className="text-xl font-black text-foreground">حالة الطلب</h2>
          <div className="mt-5 space-y-3">
            {[
              "تم استلام البيانات",
              "مراجعة المستندات",
              "مراجعة المركبة",
              "تم القبول / محتاجين استكمال",
            ].map((item, index) => (
              <div key={item} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                  {index + 1}
                </span>
                <p className="text-sm font-bold text-gray-600">{item}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 rounded-[22px] bg-primary/5 px-4 py-3 text-sm leading-7 text-gray-500">
            الـUI هنا جاهز يشتغل مع status values جاية من قاعدة البيانات بعدين، سواء pending أو approved أو needs_review.
          </p>
        </div>
      </div>
    </div>
  );
}
