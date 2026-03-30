import Link from "next/link";
import { ArrowRight, MapPin, Navigation, Edit2, CheckCircle2, DollarSign, Clock, GitCommit } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TripConfirmationPage() {
  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,rgba(15,21,19,1),rgba(20,28,25,1))]">
      {/* Map Background Placeholder */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(61,161,132,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(61,161,132,0.1)_1px,transparent_1px)] [background-size:32px_32px]" />
        
        {/* Fake Map Route UI for demo */}
        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none w-full max-w-[280px]">
          {/* Pickup Pin */}
          <div className="w-10 h-10 rounded-full border-[5px] border-primary/20 bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(61,161,132,0.4)] relative z-10">
            <span className="w-3 h-3 rounded-full bg-white shadow-sm" />
            <div className="absolute -right-28 bg-surface-container-high px-3 py-1.5 rounded-xl text-[10px] font-black shadow-lg border border-white/5 truncate max-w-[100px]">التجمع الخامس</div>
          </div>
          {/* Route Line */}
          <div className="h-24 w-1.5 bg-gradient-to-b from-primary to-secondary rounded-full -my-2 opacity-80" />
          {/* Dropoff Pin */}
          <div className="w-10 h-10 rounded-full border-[5px] border-secondary/20 bg-secondary flex items-center justify-center shadow-[0_0_30px_rgba(182,106,123,0.4)] relative z-10">
            <span className="w-3 h-3 rounded-full bg-white shadow-sm" />
            <div className="absolute -left-28 bg-surface-container-high px-3 py-1.5 rounded-xl text-[10px] font-black shadow-lg border border-white/5 truncate max-w-[100px]">مطار القاهرة</div>
          </div>
        </div>

        {/* Back Button (App Bar) */}
        <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
          <Button asChild variant="secondary" size="icon" className="h-12 w-12 rounded-full shadow-[var(--shadow-material-2)] bg-surface-container/90 backdrop-blur-md border border-white/5 text-foreground hover:bg-surface-container">
            <Link href="/book" aria-label="رجوع">
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <div className="bg-surface-container/90 backdrop-blur-md border border-white/5 px-4 py-2 rounded-full shadow-lg">
            <span className="text-sm font-black text-foreground">راجع طلبك</span>
          </div>
          <div className="w-12" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Bottom Sheet UI */}
      <div className="absolute bottom-0 inset-x-0 z-10 pb-[20px] md:pb-6 pointer-events-none flex justify-center">
        <div className="w-full max-w-xl pointer-events-auto bg-surface-container/95 backdrop-blur-xl rounded-t-[36px] md:rounded-[36px] border-t md:border border-white/10 shadow-[var(--shadow-premium)] p-5 pb-8 transition-all duration-300">
          
          <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

          <div className="space-y-5">
            {/* Route Summary */}
            <div className="relative rounded-[28px] overflow-hidden bg-surface-container-low border border-white/5 p-4 shadow-inner">
              <div className="flex gap-4 items-stretch">
                <div className="flex flex-col items-center justify-between py-1">
                  <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20" />
                  <div className="w-0.5 h-8 bg-surface-border my-1" />
                  <div className="w-3 h-3 rounded-full bg-secondary ring-4 ring-secondary/20" />
                </div>
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <p className="text-xs text-gray-500 font-bold mb-0.5">من</p>
                    <p className="text-sm font-black text-foreground">التجمع الخامس - شارع التسعين</p>
                  </div>
                  <div className="h-px bg-surface-border/50 my-2" />
                  <div>
                    <p className="text-xs text-gray-500 font-bold mb-0.5">إلى</p>
                    <p className="text-sm font-black text-foreground">مطار القاهرة - مبنى 3</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trip Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-low border border-white/5 rounded-[24px] p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold">السعر التقريبي</p>
                  <p className="text-sm font-black text-foreground">280 - 320 ج</p>
                </div>
              </div>
              <div className="bg-surface-container-low border border-white/5 rounded-[24px] p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold">الوقت المتوقع</p>
                  <p className="text-sm font-black text-foreground">35 دقيقة</p>
                </div>
              </div>
            </div>

            {/* Note Snippet */}
            <div className="bg-primary/5 border border-primary/10 rounded-[20px] p-3.5 flex gap-3 items-start">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-[13px] leading-relaxed text-gray-400">
                <span className="font-bold text-foreground">ملاحظة:</span> معايا شنطتين كبار وطفل، لو في زحمة يا ريت تبلغني.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button asChild variant="secondary" className="h-14 w-14 rounded-[20px] shrink-0 bg-surface-container border border-white/5 text-foreground hover:bg-surface-container-high">
                <Link href="/book">
                  <Edit2 className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild className="h-14 flex-1 rounded-[20px] text-lg font-black bg-primary hover:bg-primary-hover shadow-[0_4px_20px_-4px_rgba(61,161,132,0.4)] text-white">
                <Link href="/trip/live">
                  أكد الطلب وابحث عن كابتن
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
