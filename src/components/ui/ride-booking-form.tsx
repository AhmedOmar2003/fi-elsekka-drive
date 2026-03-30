"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Clock3,
  MapPinned,
  Navigation,
  PlaneTakeoff,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { InteractiveMap } from "@/components/map/dynamic-map-wrapper";
import { saveRideBookingDraft } from "@/lib/ride-booking-draft";

type EstimatePayload = {
  pickup: {
    label: string;
    address: string;
    latitude: number;
    longitude: number;
    city: string | null;
    area: string | null;
  };
  destination: {
    label: string;
    address: string;
    latitude: number;
    longitude: number;
    city: string | null;
    area: string | null;
  };
  distanceKm: number;
  durationMinutes: number;
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
};

export function BookingForm() {
  const router = useRouter();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [tripType, setTripType] = useState<"normal_ride" | "airport_ride">(
    "normal_ride"
  );
  const [preferredVehicleType, setPreferredVehicleType] = useState<
    "any" | "car" | "tuk_tuk"
  >("any");
  const [notes, setNotes] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [luggageCount, setLuggageCount] = useState("0");
  const [airportName, setAirportName] = useState("مطار القاهرة الدولي");
  const [airportTerminal, setAirportTerminal] = useState("");
  const [airportRideMode, setAirportRideMode] = useState<"arrival" | "departure">(
    "departure"
  );
  const [flightNumber, setFlightNumber] = useState("");
  const [flightTime, setFlightTime] = useState("");
  const [estimate, setEstimate] = useState<EstimatePayload | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [mapLocation, setMapLocation] = useState<[number, number]>([30.0444, 31.2357]);

  const handleEstimate = async () => {
    if (!pickup.trim() || !destination.trim()) {
      toast.error("اكتب نقطة التحرك والوجهة الأول.");
      return;
    }

    setIsEstimating(true);
    try {
      const response = await fetch("/api/rides/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupQuery: pickup,
          destinationQuery: destination,
          tripType,
          preferredVehicleType,
          passengerCount: Number(passengerCount || 1),
          luggageCount: Number(luggageCount || 0),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "تعذر حساب المشوار.");
      }

      setEstimate(payload.estimate);
      setMapLocation([
        payload.estimate.pickup.latitude,
        payload.estimate.pickup.longitude,
      ]);
      toast.success("حسبنا لك الوقت والسعر المقترح.");
    } catch (error: any) {
      toast.error(error?.message || "تعذر حساب المشوار.");
    } finally {
      setIsEstimating(false);
    }
  };

  const handleContinue = async () => {
    const nextEstimate = estimate;
    if (!nextEstimate) {
      await handleEstimate();
      return;
    }

    if (tripType === "airport_ride" && !flightTime) {
      toast.error("اكتب ميعاد الرحلة علشان نكمل الطلب.");
      return;
    }

    saveRideBookingDraft({
      tripType,
      pickupQuery: pickup,
      destinationQuery: destination,
      preferredVehicleType,
      passengerCount: Number(passengerCount || 1),
      luggageCount: Number(luggageCount || 0),
      notes,
      airportName: tripType === "airport_ride" ? airportName : undefined,
      airportTerminal: tripType === "airport_ride" ? airportTerminal : undefined,
      airportRideMode: tripType === "airport_ride" ? airportRideMode : undefined,
      flightNumber: tripType === "airport_ride" ? flightNumber : undefined,
      flightTime: tripType === "airport_ride" ? flightTime : undefined,
      estimate: nextEstimate,
    });

    router.push("/trip/confirm");
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("الموبايل ده مش مدي صلاحية للموقع الحالي.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapLocation([position.coords.latitude, position.coords.longitude]);
        toast.success("حدثنا مكانك الحالي على الخريطة.");
      },
      () => toast.error("مش قادر أوصل لموقعك الحالي دلوقتي.")
    );
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,rgba(15,21,19,1),rgba(20,28,25,1))]">
      <div className="absolute inset-0 z-0">
        <InteractiveMap
          initialCenter={mapLocation}
          onLocationChange={(lat, lng) => setMapLocation([lat, lng])}
          zoom={14}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-transparent to-transparent pointer-events-none" />

        <button
          onClick={handleCurrentLocation}
          className="absolute right-4 bottom-[calc(52vh+10px)] sm:bottom-[410px] z-20 w-12 h-12 bg-surface-container/95 backdrop-blur-md rounded-full shadow-[var(--shadow-premium)] flex items-center justify-center text-foreground border border-white/5"
        >
          <Navigation className="w-5 h-5 text-primary" />
        </button>
      </div>

      <div className="absolute bottom-0 inset-x-0 z-30 pb-0 pointer-events-none flex justify-center">
        <div className="w-full max-w-xl pointer-events-auto bg-surface-container/95 backdrop-blur-3xl rounded-t-[36px] md:rounded-[36px] border-t md:border border-white/10 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] pt-5 flex flex-col">
          <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-5 shrink-0" />

          <div className="px-5 space-y-4 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-black text-foreground">رايح فين؟</h2>
                <p className="text-[13px] text-primary mt-0.5 font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  اكتب من وإلى واحسب الوقت والسعر فورًا
                </p>
              </div>
              <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-inner shrink-0">
                <MapPinned className="w-7 h-7 text-primary" />
              </div>
            </div>

            <Select
              value={tripType}
              onChange={(event) =>
                setTripType(
                  event.target.value === "airport_ride"
                    ? "airport_ride"
                    : "normal_ride"
                )
              }
            >
              <option value="normal_ride">مشوار عادي</option>
              <option value="airport_ride">مشوار مطار</option>
            </Select>

            <div className="relative rounded-[28px] overflow-hidden bg-surface-container-low border border-white/5 p-2 shadow-inner">
              <div className="relative z-10 bg-transparent flex flex-col gap-2">
                <Input
                  value={pickup}
                  onChange={(event) => setPickup(event.target.value)}
                  className="ps-5 pe-4 h-14 bg-transparent border-0 ring-0 shadow-none text-base placeholder:text-gray-500 rounded-[20px] focus-visible:bg-white/5"
                  placeholder="منين هتتحرك؟"
                />
                <div className="h-px bg-surface-border/50 mx-4" />
                <Input
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  className="ps-5 pe-4 h-14 bg-transparent border-0 ring-0 shadow-none text-base placeholder:text-gray-500 rounded-[20px] focus-visible:bg-white/5"
                  placeholder="رايح فين؟"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <UserRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={passengerCount}
                  onChange={(event) => setPassengerCount(event.target.value)}
                  placeholder="عدد الركاب"
                  className="pe-10 h-12 bg-surface-container-low border-white/10 rounded-[18px]"
                />
              </div>
              <Select
                value={preferredVehicleType}
                onChange={(event) =>
                  setPreferredVehicleType(
                    event.target.value === "car" ||
                      event.target.value === "tuk_tuk"
                      ? event.target.value
                      : "any"
                  )
                }
              >
                <option value="any">الأقرب والمتاح</option>
                <option value="car">عربية</option>
                <option value="tuk_tuk">توك توك</option>
              </Select>
            </div>

            {tripType === "airport_ride" ? (
              <div className="grid gap-3 rounded-[24px] bg-secondary/10 p-4 border border-secondary/20 animate-fade-in">
                <Input
                  value={airportName}
                  onChange={(event) => setAirportName(event.target.value)}
                  placeholder="اسم المطار"
                  className="h-12 bg-transparent border-white/10"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={airportRideMode}
                    onChange={(event) =>
                      setAirportRideMode(
                        event.target.value === "arrival" ? "arrival" : "departure"
                      )
                    }
                  >
                    <option value="departure">توصيل للمطار</option>
                    <option value="arrival">استقبال من المطار</option>
                  </Select>
                  <Input
                    value={airportTerminal}
                    onChange={(event) => setAirportTerminal(event.target.value)}
                    placeholder="الترمينال"
                    className="h-12 bg-transparent border-white/10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                    <Input
                      type="datetime-local"
                      value={flightTime}
                      onChange={(event) => setFlightTime(event.target.value)}
                      className="pe-3 ps-9 h-12 bg-transparent border-white/10 text-xs"
                    />
                  </div>
                  <div className="relative">
                    <PlaneTakeoff className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                    <Input
                      value={flightNumber}
                      onChange={(event) => setFlightNumber(event.target.value)}
                      placeholder="رقم الرحلة"
                      className="pe-3 ps-9 h-12 bg-transparent border-white/10 text-sm"
                    />
                  </div>
                </div>
                <div className="relative">
                  <Briefcase className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                  <Input
                    value={luggageCount}
                    onChange={(event) => setLuggageCount(event.target.value)}
                    placeholder="عدد الشنط"
                    className="pe-10 h-12 bg-transparent border-white/10"
                  />
                </div>
              </div>
            ) : null}

            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="ملاحظات للكابتن لو محتاج"
              className="w-full rounded-[20px] border border-white/10 bg-surface-container-low px-4 py-3 text-sm text-foreground outline-none placeholder:text-white/35"
            />

            {estimate ? (
              <div className="rounded-[24px] border border-primary/20 bg-primary/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/55">المسافة المتوقعة</p>
                    <p className="text-lg font-black text-white">{estimate.distanceKm} كم</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-white/55">الوقت المتوقع</p>
                    <p className="text-lg font-black text-white">
                      {estimate.durationMinutes} دقيقة
                    </p>
                  </div>
                </div>
                <div className="rounded-[18px] bg-black/15 px-4 py-3">
                  <p className="text-xs text-white/60">السعر المقترح</p>
                  <p className="mt-1 text-xl font-black text-primary">
                    {estimate.minPrice} - {estimate.maxPrice} ج.م
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] px-5 bg-surface-container-high/50 border-t border-white/5 relative shrink-0 space-y-3">
            <Button
              type="button"
              onClick={handleEstimate}
              isLoading={isEstimating}
              variant="secondary"
              className="h-12 w-full rounded-[20px]"
            >
              احسب المدة والسعر
            </Button>
            <Button
              type="button"
              onClick={handleContinue}
              className="h-[58px] w-full rounded-[24px] text-[17px] font-black bg-primary hover:bg-primary-hover text-white"
            >
              راجع الطلب وكمله
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
