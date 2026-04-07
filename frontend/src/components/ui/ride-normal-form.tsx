import Link from "next/link";
import { ArrowLeft, CarFront, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MapPreview } from "@/components/ride/shared";

export function NormalRideForm() {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr]">
      <div className="ride-panel rounded-[32px] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
            <CarFront className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-foreground">مشوار عادي</h1>
            <p className="text-sm text-gray-500">من نقطة لنقطة، مع ملحوظات سريعة وتفضيل نوع المركبة لو محتاج.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">من</label>
            <Input placeholder="حدد مكان التحرك" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">إلى</label>
            <Input placeholder="حدد الوجهة" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">عدد الركاب</label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input placeholder="1" className="pe-10" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-foreground">نوع المركبة المفضل</label>
            <Select defaultValue="any">
              <option value="any">المتاح الأقرب</option>
              <option value="car">عربية</option>
              <option value="tuktuk">توك توك</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-black text-foreground">ملاحظات</label>
            <textarea
              rows={4}
              placeholder="مثال: كلمني قبل ما توصل، أو في طفل معايا."
              className="w-full rounded-[24px] border border-surface-border bg-surface-container px-4 py-3 text-sm text-foreground shadow-[var(--shadow-material-1)] outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">المسافة: 8.6 كم placeholder</span>
          <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-black text-secondary">الوقت: 17 دقيقة placeholder</span>
        </div>

        <Button asChild className="mt-5 h-12 w-full rounded-full text-base">
          <Link href="/trip/confirm">
            راجع الطلب
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <MapPreview
        title="Route preview للمشوار"
        subtitle="مكان الخريطة live بعد الربط: pickup pin، destination pin، ETA، وإظهار أقرب كباتن في النطاق."
      />
    </div>
  );
}
