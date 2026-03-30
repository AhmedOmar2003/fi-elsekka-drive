"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Clock3,
  LocateFixed,
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

type MapField = "pickup" | "destination" | null;
type SheetMode = "expanded" | "collapsed";

const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357];

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
  const [mapLocation, setMapLocation] = useState<[number, number]>(DEFAULT_CENTER);
  const [activeMapField, setActiveMapField] = useState<MapField>(null);
  const [isResolvingMap, setIsResolvingMap] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("expanded");
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    if (tripType === "airport_ride") {
      setPreferredVehicleType("car");
    }
  }, [tripType]);

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
          preferredVehicleType:
            tripType === "airport_ride" ? "car" : preferredVehicleType,
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
      preferredVehicleType: tripType === "airport_ride" ? "car" : preferredVehicleType,
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

  const resolveMapLocation = async (
    latitude: number,
    longitude: number,
    field: Exclude<MapField, null>
  ) => {
    setIsResolvingMap(true);
    try {
      const response = await fetch("/api/rides/reverse-geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "تعذر تحديد المكان من الخريطة.");
      }

      const address = payload.location?.address || payload.location?.label;
      if (!address) {
        throw new Error("المكان المختار مش واضح، جرّب تزوم أكتر.");
      }

      if (field === "pickup") {
        setPickup(address);
      } else {
        setDestination(address);
      }

      setEstimate(null);
      setActiveMapField(null);
      toast.success(field === "pickup" ? "ثبتنا نقطة التحرك." : "ثبتنا الوجهة.");
    } catch (error: any) {
      toast.error(error?.message || "تعذر تحديد المكان من الخريطة.");
    } finally {
      setIsResolvingMap(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("الموبايل ده مش مدي صلاحية للموقع الحالي.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLocation: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setMapLocation(nextLocation);
        setSheetMode("collapsed");
        await resolveMapLocation(nextLocation[0], nextLocation[1], "pickup");
      },
      () => toast.error("مش قادر أوصل لموقعك الحالي دلوقتي.")
    );
  };

  const beginMapPick = (field: Exclude<MapField, null>) => {
    setActiveMapField(field);
    setSheetMode("collapsed");
    setEstimate(null);
    toast.message(
      field === "pickup"
        ? "حرّك الخريطة لحد نقطة التحرك واضغط تثبيت."
        : "حرّك الخريطة لحد الوجهة واضغط تثبيت."
    );
  };

  const handleHandleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    dragStartY.current = event.touches[0]?.clientY ?? null;
  };

  const handleHandleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;

    const currentY = event.touches[0]?.clientY ?? dragStartY.current;
    const delta = currentY - dragStartY.current;

    if (sheetMode === "expanded") {
      setDragOffset(Math.max(0, Math.min(260, delta)));
      return;
    }

    setDragOffset(Math.min(0, Math.max(-260, delta)));
  };

  const handleHandleTouchEnd = () => {
    if (sheetMode === "expanded") {
      setSheetMode(dragOffset > 100 ? "collapsed" : "expanded");
    } else {
      setSheetMode(dragOffset < -70 ? "expanded" : "collapsed");
    }

    dragStartY.current = null;
    setDragOffset(0);
  };

  const sheetTransform = useMemo(() => {
    if (sheetMode === "expanded") {
      return `translateY(${Math.max(0, dragOffset)}px)`;
    }

    return `translateY(calc(100% - 108px + ${Math.min(0, dragOffset)}px))`;
  }, [dragOffset, sheetMode]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[linear-gradient(180deg,rgba(15,21,19,1),rgba(20,28,25,1))]">
      <div className="absolute inset-0 z-0">
        <InteractiveMap
          initialCenter={mapLocation}
          onLocationChange={(lat, lng) => setMapLocation([lat, lng])}
          zoom={14}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/75 via-transparent to-background/20" />

        {activeMapField ? (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative flex flex-col items-center">
                <div className="h-14 w-14 rounded-full border border-primary/30 bg-primary/15 backdrop-blur-sm" />
                <div className="absolute -top-6 rounded-full bg-surface-container/90 px-4 py-2 text-xs font-black text-primary shadow-lg">
                  {activeMapField === "pickup"
                    ? "ثبت نقطة التحرك هنا"
                    : "ثبت الوجهة هنا"}
                </div>
                <div className="absolute flex h-14 w-14 items-center justify-center text-primary">
                  <MapPinned className="h-7 w-7" />
                </div>
              </div>
            </div>

            <div className="absolute inset-x-4 top-24 z-30 rounded-[22px] border border-primary/20 bg-surface-container/90 px-4 py-3 text-sm text-white shadow-[var(--shadow-premium)] backdrop-blur-xl">
              حرّك الخريطة لحد المكان الصح، وبعدها اضغط تثبيت النقطة.
            </div>

            <div className="absolute inset-x-4 bottom-28 z-30 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="h-12 flex-1 rounded-[18px]"
                onClick={() => setActiveMapField(null)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                isLoading={isResolvingMap}
                className="h-12 flex-[1.4] rounded-[18px]"
                onClick={() =>
                  void resolveMapLocation(
                    mapLocation[0],
                    mapLocation[1],
                    activeMapField
                  )
                }
              >
                تثبيت النقطة
              </Button>
            </div>
          </>
        ) : null}

        <button
          onClick={handleUseCurrentLocation}
          className="absolute right-4 bottom-[calc(52vh+10px)] z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/5 bg-surface-container/95 text-foreground shadow-[var(--shadow-premium)] backdrop-blur-md sm:bottom-[410px]"
          aria-label="استخدم موقعي الحالي"
        >
          <Navigation className="h-5 w-5 text-primary" />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-0">
        <div
          className="pointer-events-auto w-full max-w-xl rounded-t-[36px] border-t border-white/10 bg-surface-container/95 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] backdrop-blur-3xl transition-transform duration-300 md:rounded-[36px] md:border"
          style={{ transform: sheetTransform }}
        >
          <div
            className="cursor-grab px-5 pt-4 active:cursor-grabbing"
            onTouchStart={handleHandleTouchStart}
            onTouchMove={handleHandleTouchMove}
            onTouchEnd={handleHandleTouchEnd}
            onClick={() =>
              setSheetMode((current) =>
                current === "expanded" ? "collapsed" : "expanded"
              )
            }
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/10" />
            <div className="mb-2 flex items-center justify-between rounded-[22px] border border-white/5 bg-black/10 px-4 py-3">
              <div>
                <p className="text-sm font-black text-white">
                  {pickup && destination ? "المشوار جاهز للمراجعة" : "حدد المشوار"}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  اسحب لتحت عشان تشوف الخريطة أو لفوق عشان تكمل الطلب
                </p>
              </div>
              <div className="text-primary">
                {sheetMode === "expanded" ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronUp className="h-5 w-5" />
                )}
              </div>
            </div>
          </div>

          <div className="flex max-h-[72vh] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-foreground">رايح فين؟</h2>
                  <p className="mt-0.5 flex items-center gap-1 text-[13px] font-bold text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    اكتب أو حدّد من على الخريطة واحسب الوقت والسعر
                  </p>
                </div>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner">
                  <MapPinned className="h-7 w-7 text-primary" />
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

              <div className="rounded-[28px] border border-white/5 bg-surface-container-low p-2 shadow-inner">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      value={pickup}
                      onChange={(event) => {
                        setPickup(event.target.value);
                        setEstimate(null);
                      }}
                      className="h-14 rounded-[20px] border-0 bg-transparent pe-24 ps-5 text-base shadow-none ring-0 placeholder:text-gray-500 focus-visible:bg-white/5"
                      placeholder="منين هتتحرك؟"
                    />
                    <div className="absolute inset-y-0 end-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20"
                        aria-label="حدد موقعي الحالي"
                      >
                        <LocateFixed className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => beginMapPick("pickup")}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/75 transition hover:bg-white/10"
                        aria-label="حدد نقطة التحرك من الخريطة"
                      >
                        <MapPinned className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mx-4 h-px bg-surface-border/50" />

                  <div className="relative">
                    <Input
                      value={destination}
                      onChange={(event) => {
                        setDestination(event.target.value);
                        setEstimate(null);
                      }}
                      className="h-14 rounded-[20px] border-0 bg-transparent pe-14 ps-5 text-base shadow-none ring-0 placeholder:text-gray-500 focus-visible:bg-white/5"
                      placeholder="رايح فين؟"
                    />
                    <div className="absolute inset-y-0 end-3 flex items-center">
                      <button
                        type="button"
                        onClick={() => beginMapPick("destination")}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/75 transition hover:bg-white/10"
                        aria-label="حدد الوجهة من الخريطة"
                      >
                        <MapPinned className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <UserRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <Input
                    value={passengerCount}
                    onChange={(event) => {
                      setPassengerCount(event.target.value);
                      setEstimate(null);
                    }}
                    placeholder="عدد الركاب"
                    className="h-12 rounded-[18px] border-white/10 bg-surface-container-low pe-10"
                  />
                </div>

                {tripType === "airport_ride" ? (
                  <div className="rounded-[18px] border border-primary/20 bg-primary/10 px-4 py-3">
                    <p className="text-xs text-white/45">نوع المركبة</p>
                    <p className="mt-1 text-sm font-black text-white">عربية فقط</p>
                  </div>
                ) : (
                  <Select
                    value={preferredVehicleType}
                    onChange={(event) => {
                      setPreferredVehicleType(
                        event.target.value === "car" ||
                          event.target.value === "tuk_tuk"
                          ? event.target.value
                          : "any"
                      );
                      setEstimate(null);
                    }}
                  >
                    <option value="any">الأقرب والمتاح</option>
                    <option value="car">عربية</option>
                    <option value="tuk_tuk">توك توك</option>
                  </Select>
                )}
              </div>

              {tripType === "airport_ride" ? (
                <div className="grid gap-3 rounded-[24px] border border-secondary/20 bg-secondary/10 p-4 animate-fade-in">
                  <Input
                    value={airportName}
                    onChange={(event) => setAirportName(event.target.value)}
                    placeholder="اسم المطار"
                    className="h-12 border-white/10 bg-transparent"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={airportRideMode}
                      onChange={(event) =>
                        setAirportRideMode(
                          event.target.value === "arrival"
                            ? "arrival"
                            : "departure"
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
                      className="h-12 border-white/10 bg-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Clock3 className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                      <Input
                        type="datetime-local"
                        value={flightTime}
                        onChange={(event) => setFlightTime(event.target.value)}
                        className="h-12 border-white/10 bg-transparent pe-3 ps-9 text-xs"
                      />
                    </div>
                    <div className="relative">
                      <PlaneTakeoff className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                      <Input
                        value={flightNumber}
                        onChange={(event) => setFlightNumber(event.target.value)}
                        placeholder="رقم الرحلة"
                        className="h-12 border-white/10 bg-transparent pe-3 ps-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <Briefcase className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                    <Input
                      value={luggageCount}
                      onChange={(event) => {
                        setLuggageCount(event.target.value);
                        setEstimate(null);
                      }}
                      placeholder="عدد الشنط"
                      className="h-12 border-white/10 bg-transparent pe-10"
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
                <div className="space-y-3 rounded-[24px] border border-primary/20 bg-primary/10 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/55">المسافة المتوقعة</p>
                      <p className="text-lg font-black text-white">
                        {estimate.distanceKm} كم
                      </p>
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

            <div className="relative shrink-0 space-y-3 border-t border-white/5 bg-surface-container-high/50 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
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
                className="h-[58px] w-full rounded-[24px] bg-primary text-[17px] font-black text-white hover:bg-primary-hover"
              >
                راجع الطلب وكمله
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
