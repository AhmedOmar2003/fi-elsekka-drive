"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock3, MapPin, MapPinned, MessageSquarePlus, PlaneTakeoff, Navigation, CarTaxiFront, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { InteractiveMap } from "@/components/map/dynamic-map-wrapper";

export function BookingForm() {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [tripType, setTripType] = useState("normal");
  const [showNotes, setShowNotes] = useState(false);
  const [mapLocation, setMapLocation] = useState<[number, number]>([31.0366, 31.3637]); // Default Mansoura/Mit El Amel region approx

  // Focus current location button
  const handleCurrentLocation = () => {
    // In a real app we would call navigator.geolocation.getCurrentPosition
    setMapLocation([31.0366, 31.3637]);
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,rgba(15,21,19,1),rgba(20,28,25,1))]">
      {/* Real Interactive Map Background */}
      <div className="absolute inset-0 z-0">
        <InteractiveMap 
          initialCenter={mapLocation}
          onLocationChange={(lat, lng) => setMapLocation([lat, lng])}
          zoom={15}
        />
        
        {/* Fixed Center Map Pin UI */}
        <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none drop-shadow-2xl z-20">
          <div className="w-12 h-12 rounded-full border-[6px] border-primary/30 bg-primary flex items-center justify-center shadow-[0_0_40px_rgba(61,161,132,0.8)] relative animate-pulse-slow">
            <span className="w-3 h-3 rounded-full bg-white shadow-sm" />
            <div className="absolute -bottom-10 bg-surface-container-high px-3 py-1.5 rounded-xl text-xs font-black shadow-lg shadow-black/50 whitespace-nowrap border border-white/10 text-primary">
              موقع التحرك
            </div>
          </div>
          <div className="w-1.5 h-6 bg-primary/80 mt-1 rounded-full shadow-lg"></div>
          <div className="w-4 h-1 bg-black/40 rounded-full blur-[2px] mt-1"></div>
        </div>

        {/* Top Fade overlay to make Top App Bar readable */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-background/90 to-transparent z-10 pointer-events-none" />

        {/* Current Location FAB (Native app feel) */}
        <button 
          onClick={handleCurrentLocation}
          className="absolute right-4 bottom-[calc(48vh+20px)] sm:bottom-[400px] z-20 w-12 h-12 bg-surface-container/95 backdrop-blur-md rounded-full shadow-[var(--shadow-premium)] flex items-center justify-center text-foreground border border-white/5 active:scale-95 transition-transform hover:bg-surface-container-high cursor-pointer"
        >
          <Navigation className="w-5 h-5 text-primary" />
        </button>
      </div>

      {/* Bottom Sheet UI - Flush to bottom */}
      <div className="absolute bottom-0 inset-x-0 z-30 pb-0 pointer-events-none flex justify-center">
        <div className="w-full max-w-xl pointer-events-auto bg-surface-container/95 backdrop-blur-3xl rounded-t-[36px] md:rounded-[36px] border-t md:border border-white/10 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] pt-5 flex flex-col transition-all duration-300">
          
          <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-5 shrink-0" />

          <div className="px-5 space-y-4 flex-1">
            
            {/* Illustrative Header for Vitality */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-black text-foreground drop-shadow-sm">مشوارك أسهل</h2>
                <p className="text-[13px] text-primary mt-0.5 font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> حدد وجهتك واختار عربية أو توكتوك 
                </p>
              </div>
              <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-inner relative overflow-hidden shrink-0">
                <CarTaxiFront className="w-7 h-7 text-primary relative z-10 animate-float" />
              </div>
            </div>

            {/* Trip Type */}
            <Select value={tripType} onChange={(event) => setTripType(event.target.value)}>
              <option value="normal">مشوار عادي</option>
              <option value="airport">إلى المطار</option>
            </Select>

            {/* Inputs Container */}
            <div className="relative rounded-[28px] overflow-hidden bg-surface-container-low border border-white/5 p-2 shadow-inner">
              <div className="absolute right-7 top-7 bottom-7 w-px bg-surface-border flex flex-col justify-between items-center z-0">
                <span className="w-2.5 h-2.5 rounded-full bg-primary absolute -top-1 ring-4 ring-primary/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-secondary absolute -bottom-1 ring-4 ring-secondary/20" />
              </div>
              
              <div className="relative z-10 bg-transparent flex flex-col gap-2">
                <Input
                  value={pickup}
                  onChange={(event) => setPickup(event.target.value)}
                  className="ps-12 pe-4 h-14 bg-transparent border-0 ring-0 shadow-none text-base placeholder:text-gray-500 rounded-[20px] focus-visible:bg-white/5 transition-colors"
                  placeholder="نقطة التحرك (موقعك الحالي)"
                />
                <div className="h-px bg-surface-border/50 mx-4" />
                <Input
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  className="ps-12 pe-4 h-14 bg-transparent border-0 ring-0 shadow-none text-base font-bold placeholder:text-gray-400 rounded-[20px] focus-visible:bg-white/5 transition-colors"
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
                className="w-full rounded-[20px] border border-white/10 bg-surface-container-low px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary/40 animate-fade-in resize-none"
              />
            )}
          </div>

          {/* Main Action Call - Fixed at bottom like Navbar */}
          <div className="mt-4 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] px-5 bg-surface-container-high/50 border-t border-white/5 relative shrink-0">
             <Button asChild className="h-[64px] w-full rounded-[24px] text-[17px] font-black bg-primary hover:bg-primary-hover shadow-[0_4px_20px_-4px_rgba(61,161,132,0.4)] text-white relative z-10 transition-transform active:scale-95 group overflow-hidden">
               {/* We pass the lat/lng coordinates directly to the confirmation so we can display them or store them! */}
               <Link href={`/trip/confirm?lat=${mapLocation[0]}&lng=${mapLocation[1]}&destination=${encodeURIComponent(destination)}`} className="flex items-center justify-center gap-2">
                 <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-[position:200%_0,0_0] bg-no-repeat transition-[background-position_0s_ease] hover:bg-[position:-200%_0,0_0] hover:transition-[background-position_1.5s_ease]" />
                 تأكيد المشوار 
                 <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
               </Link>
             </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
