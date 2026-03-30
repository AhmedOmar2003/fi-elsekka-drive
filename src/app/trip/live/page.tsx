import Link from "next/link";
import { ArrowRight, PhoneCall, XIcon, ShieldCheck, MapPin } from "lucide-react";
import { liveTripCaptain, tripStatusSteps } from "@/lib/ride-content";
import { Button } from "@/components/ui/button";

export default function LiveTripPage() {
  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,rgba(15,21,19,1),rgba(20,28,25,1))]">
      {/* Map Background Placeholder */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(61,161,132,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(61,161,132,0.1)_1px,transparent_1px)] [background-size:32px_32px]" />
        
        {/* Fake Map Car Tracking UI */}
        <div className="absolute top-[35%] left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none w-full">
          {/* Car Pin */}
          <div className="w-14 h-14 rounded-full border-[4px] border-primary/30 bg-primary/10 flex items-center justify-center relative animate-pulse-slow">
            <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shadow-[0_0_20px_rgba(61,161,132,1)]">
              <span className="text-xl">🚙</span>
            </span>
            <div className="absolute -top-10 bg-surface-container-high px-3 py-1.5 rounded-xl text-xs font-black shadow-lg border border-white/5 whitespace-nowrap text-primary">
              باقي {liveTripCaptain.eta}
            </div>
          </div>
        </div>

        {/* Top App Bar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center pointer-events-none">
          <Button asChild variant="secondary" size="icon" className="h-12 w-12 rounded-full shadow-[var(--shadow-material-2)] bg-surface-container/90 backdrop-blur-md border border-white/5 text-foreground pointer-events-auto hover:bg-surface-container">
            <Link href="/" aria-label="الرئيسية">
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <div className="bg-surface-container/90 backdrop-blur-md border border-white/5 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <span className="text-sm font-black text-foreground">الكابتن في الطريق</span>
          </div>
          <div className="w-12 h-12 bg-surface-container/90 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-blue-400 pointer-events-auto shadow-lg cursor-pointer">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Bottom Sheet UI */}
      <div className="absolute bottom-0 inset-x-0 z-10 pb-[20px] md:pb-6 pointer-events-none flex justify-center">
        <div className="w-full max-w-xl pointer-events-auto bg-surface-container/95 backdrop-blur-xl rounded-t-[36px] md:rounded-[36px] border-t md:border border-white/10 shadow-[var(--shadow-premium)] p-5 pb-8 transition-all duration-300">
          
          <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

          {/* Driver & Vehicle Summary */}
          <div className="flex gap-4 items-center bg-surface-container-low border border-white/5 rounded-[28px] p-4 mb-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary shrink-0 border-2 border-primary/30">
                {liveTripCaptain.name.charAt(0)}
              </div>
              <div className="absolute -bottom-2 -right-1 bg-surface-container-high text-amber-400 text-[11px] font-black px-1.5 py-0.5 rounded-md border border-white/10 flex items-center gap-0.5">
                ★ {liveTripCaptain.rating}
              </div>
            </div>
            
            <div className="flex-1">
              <p className="text-sm font-black text-foreground mb-0.5">{liveTripCaptain.name}</p>
              <p className="text-xs text-gray-400">{liveTripCaptain.vehicleName}</p>
            </div>
            
            <div className="text-center bg-surface-container-high px-3 py-2 rounded-[16px] border border-white/5">
              <p className="text-base font-black text-foreground tracking-widest">{liveTripCaptain.plate}</p>
              <p className="text-[10px] text-gray-500">رمادي</p>
            </div>
          </div>

          {/* Progress Timeline (Simplified for Mobile) */}
          <div className="bg-surface-container-low border border-white/5 rounded-[24px] p-4 mb-5">
            <div className="flex justify-between items-center relative">
              <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-white/10 z-0" />
              <div className="absolute left-6 right-1/2 top-1/2 -translate-y-1/2 h-0.5 bg-primary z-0" />
              
              <div className="flex flex-col items-center gap-1.5 relative z-10">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center ring-2 ring-primary/20">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <span className="text-[10px] font-bold text-primary">تم القبول</span>
              </div>
              
              <div className="flex flex-col items-center gap-1.5 relative z-10">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center ring-4 ring-primary/30 animate-pulse-slow">
                  <div className="w-2.5 h-2.5 bg-white rounded-full" />
                </div>
                <span className="text-[10px] font-bold text-primary">في الطريق</span>
              </div>

              <div className="flex flex-col items-center gap-1.5 relative z-10 opacity-40">
                <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center border border-white/20">
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                </div>
                <span className="text-[10px] font-bold text-gray-300">وصل</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-row gap-3">
            <Button className="h-14 w-14 rounded-[22px] shrink-0 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/10">
              <XIcon className="h-5 w-5" />
            </Button>
            <Button className="h-14 flex-1 rounded-[22px] text-base font-black bg-primary hover:bg-primary-hover shadow-[0_4px_20px_-4px_rgba(61,161,132,0.4)] text-white gap-2">
              <PhoneCall className="h-5 w-5" />
              اتصال بالكابتن
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
