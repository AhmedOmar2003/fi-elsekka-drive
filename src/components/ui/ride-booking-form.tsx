"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock3, MapPin, MapPinned, MessageSquarePlus, PlaneTakeoff, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function BookingForm() {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [tripType, setTripType] = useState("normal");
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,rgba(15,21,19,1),rgba(20,28,25,1))]">
      {/* Map Background Placeholder */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(61,161,132,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(61,161,132,0.1)_1px,transparent_1px)] [background-size:32px_32px]" />
        
        {/* Fake Map Route UI for demo */}
        <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
          <div className="w-12 h-12 rounded-full border-[6px] border-primary/20 bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(61,161,132,0.4)] relative">
            <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
            <div className="absolute -bottom-10 bg-surface-container-high px-3 py-1.5 rounded-xl text-xs font-black shadow-lg whitespace-nowrap border border-white/5">
              موقعك الحالي
            </div>
          </div>
        </div>

        {/* Current Location FAB (Native app feel) */}
        <button className="absolute right-4 bottom-[calc(40vh+20px)] sm:bottom-[340px] z-10 w-12 h-12 bg-surface-container rounded-full shadow-[var(--shadow-material-3)] flex items-center justify-center text-foreground border border-white/5 active:scale-95 transition-transform">
          <Navigation className="w-5 h-5 text-primary" />
        </button>
      </div>

      {/* Bottom Sheet UI */}
      <div className="absolute bottom-0 inset-x-0 z-10 pb-[80px] md:pb-6 pointer-events-none flex justify-center">
        <div className="w-full max-w-xl pointer-events-auto bg-surface-container/95 backdrop-blur-xl rounded-t-[36px] md:rounded-[36px] border-t md:border border-white/10 shadow-[var(--shadow-premium)] p-5 pb-6 transition-all duration-300">
          
          <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

          <div className="space-y-4">
            {/* Trip Type */}
            <Select value={tripType} onChange={(event) => setTripType(event.target.value)}>
              <option value="normal">مشوار عادي</option>
              <option value="airport">إلى المطار</option>
            </Select>

            {/* Inputs Container */}
            <div className="relative rounded-[28px] overflow-hidden bg-surface-container-low border border-white/5 p-2 shadow-inner">
              <div className="absolute right-7 top-7 bottom-7 w-px bg-surface-border flex flex-col justify-between items-center z-0">
                <span className="w-2.5 h-2.5 rounded-full bg-primary absolute -top-1" />
                <span className="w-2.5 h-2.5 rounded-full bg-secondary absolute -bottom-1" />
              </div>
              
              <div className="relative z-10 bg-transparent flex flex-col gap-2">
                <Input
                  value={pickup}
                  onChange={(event) => setPickup(event.target.value)}
                  className="ps-12 pe-4 h-14 bg-transparent border-0 ring-0 shadow-none text-base placeholder:text-gray-500 rounded-[20px] focus-visible:bg-white/5"
                  placeholder="نقطة التحرك (موقعك الحالي)"
                />
                <div className="h-px bg-surface-border/50 mx-4" />
                <Input
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  className="ps-12 pe-4 h-14 bg-transparent border-0 ring-0 shadow-none text-base font-bold placeholder:text-gray-400 rounded-[20px] focus-visible:bg-white/5"
                  placeholder="رايح فين؟"
                />
              </div>
            </div>

            {/* Conditional Airport Fields */}
            {tripType === "airport" && (
              <div className="grid gap-3 rounded-[24px] bg-secondary/10 p-4 border border-secondary/20 animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                    <Input type="datetime-local" className="pe-3 ps-9 h-12 bg-transparent border-white/10 text-xs" />
                  </div>
                  <div className="relative">
                    <PlaneTakeoff className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                    <Input placeholder="رقم الرحلة" className="pe-3 ps-9 h-12 bg-transparent border-white/10 text-sm" />
                  </div>
                </div>
              </div>
            )}

            {/* Notes Toggle */}
            <button 
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-foreground transition-colors mx-2"
            >
              <MessageSquarePlus className="w-4 h-4" />
              {showNotes ? "إخفاء الملاحظات" : "ملاحظات للكابتن؟"}
            </button>

            {showNotes && (
              <textarea
                rows={2}
                placeholder="مثال: مستني عند البوابة الرئيسية."
                className="w-full rounded-[20px] border border-white/10 bg-surface-container-low px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary/40 animate-fade-in"
              />
            )}

            {/* Main Action Call */}
            <Button asChild className="h-14 w-full rounded-full text-lg font-black bg-primary hover:bg-primary-hover shadow-[0_4px_20px_-4px_rgba(61,161,132,0.4)] text-white mt-2">
              <Link href="/trip/confirm">
                تأكيد المشوار
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
