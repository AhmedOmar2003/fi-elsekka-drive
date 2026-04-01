"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPinned,
  PlaneTakeoff,
  Search,
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

type SearchLocation = EstimatePayload["pickup"];
type MapField = "pickup" | "destination" | null;
type SheetMode = "expanded" | "collapsed";
type AutocompleteField = Exclude<MapField, null> | null;

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
  const [mapSearchField, setMapSearchField] = useState<Exclude<MapField, null>>(
    "pickup"
  );
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [mapSearchResults, setMapSearchResults] = useState<SearchLocation[]>([]);
  const [isMapSearchOpen, setIsMapSearchOpen] = useState(false);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [activeAutocompleteField, setActiveAutocompleteField] =
    useState<AutocompleteField>(null);
  const [autocompleteResults, setAutocompleteResults] = useState<SearchLocation[]>([]);
  const [isSearchingAutocomplete, setIsSearchingAutocomplete] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("expanded");
  const [pickupLocation, setPickupLocation] = useState<SearchLocation | null>(null);
  const [destinationLocation, setDestinationLocation] =
    useState<SearchLocation | null>(null);
  const [searchSessionToken, setSearchSessionToken] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`
  );

  const buildFieldValue = (location: SearchLocation) => {
    return [location.label, location.area, location.city]
      .filter(Boolean)
      .join("، ");
  };

  useEffect(() => {
    if (tripType === "airport_ride") {
      setPreferredVehicleType("car");
    }
  }, [tripType]);

  useEffect(() => {
    const query =
      activeAutocompleteField === "pickup"
        ? pickup.trim()
        : activeAutocompleteField === "destination"
          ? destination.trim()
          : "";

    if (!activeAutocompleteField || query.length < 2) {
      setAutocompleteResults([]);
      setIsSearchingAutocomplete(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearchingAutocomplete(true);
      try {
        const response = await fetch(
          `/api/rides/search-locations?q=${encodeURIComponent(query)}&sessionToken=${encodeURIComponent(searchSessionToken)}`,
          { signal: controller.signal }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "تعذر جلب الاقتراحات.");
        }

        setAutocompleteResults(Array.isArray(payload.results) ? payload.results : []);
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return;
        }
        setAutocompleteResults([]);
      } finally {
        setIsSearchingAutocomplete(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeAutocompleteField, destination, pickup, searchSessionToken]);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return;
    }

    const permissionsApi = (navigator as Navigator & {
      permissions?: {
        query: (descriptor: { name: "geolocation" }) => Promise<{
          state: "granted" | "denied" | "prompt";
        }>;
      };
    }).permissions;

    void permissionsApi
      ?.query({ name: "geolocation" })
      .then((result) => {
        if (result.state !== "granted") {
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const nextLocation: [number, number] = [
              position.coords.latitude,
              position.coords.longitude,
            ];
            setMapLocation(nextLocation);

            if (!pickup) {
              try {
                const response = await fetch("/api/rides/reverse-geocode", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    latitude: nextLocation[0],
                    longitude: nextLocation[1],
                  }),
                });
                const payload = await response.json().catch(() => ({}));
                if (response.ok && payload.location) {
                  setPickupLocation(payload.location);
                  setPickup(buildFieldValue(payload.location));
                }
              } catch {}
            }
          },
          () => {},
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 300000,
          }
        );
      })
      .catch(() => {});
  }, [pickup]);

  const handleEstimate = async () => {
    if (!pickup.trim() || !destination.trim()) {
      toast.error("اكتب نقطة التحرك والوجهة الأول.");
      return null;
    }

    setIsEstimating(true);
    try {
      const response = await fetch("/api/rides/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupQuery: pickup,
          destinationQuery: destination,
          pickupLocation,
          destinationLocation,
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
      return payload.estimate as EstimatePayload;
    } catch (error: any) {
      toast.error(error?.message || "تعذر حساب المشوار.");
      return null;
    } finally {
      setIsEstimating(false);
    }
  };

  const handleContinue = async () => {
    if (tripType === "airport_ride" && !flightTime) {
      toast.error("اكتب ميعاد الرحلة علشان نكمل الطلب.");
      return;
    }

    const nextEstimate = estimate ?? (await handleEstimate());
    if (!nextEstimate) {
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

      if (!payload.location) {
        throw new Error("المكان المختار مش واضح، جرّب تزوم أكتر.");
      }

      const fieldValue = buildFieldValue(payload.location);

      if (field === "pickup") {
        setPickupLocation(payload.location);
        setPickup(fieldValue);
      } else {
        setDestinationLocation(payload.location);
        setDestination(fieldValue);
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
      toast.error("الموقع غير متاح من المتصفح هنا. استخدم التحديد من الخريطة داخل التطبيق.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLocation: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setMapLocation(nextLocation);
        await resolveMapLocation(nextLocation[0], nextLocation[1], "pickup");
        toast.success("حددنا موقعك الحالي.");
      },
      () => {
        toast.error("فعّل إذن الموقع للمتصفح أو حدده يدويًا من الخريطة.");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const handleOpenMapSearch = (field: Exclude<MapField, null>) => {
    setMapSearchField(field);
    setMapSearchQuery(field === "pickup" ? pickup : destination);
    setMapSearchResults([]);
    setIsMapSearchOpen(true);
    setActiveMapField(null);
    setActiveAutocompleteField(null);
    setAutocompleteResults([]);
    setSearchSessionToken(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}`
    );
  };

  const handleSearchMapLocations = async () => {
    if (mapSearchQuery.trim().length < 2) {
      toast.error("اكتب اسم مكان أو عنوان أوضح.");
      return;
    }

    setIsSearchingMap(true);
    try {
      const response = await fetch(
        `/api/rides/search-locations?q=${encodeURIComponent(mapSearchQuery.trim())}&sessionToken=${encodeURIComponent(searchSessionToken)}`
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "تعذر البحث عن المكان.");
      }

      setMapSearchResults(Array.isArray(payload.results) ? payload.results : []);
      if (!payload.results?.length) {
        toast.error("ملقيناش نتيجة واضحة، جرّب عنوان أدق.");
      }
    } catch (error: any) {
      toast.error(error?.message || "تعذر البحث عن المكان.");
    } finally {
      setIsSearchingMap(false);
    }
  };

  const applyLocationFromSearch = (
    location: SearchLocation,
    field: Exclude<MapField, null>
  ) => {
    if (field === "pickup") {
      setPickupLocation(location);
      setPickup(buildFieldValue(location));
    } else {
      setDestinationLocation(location);
      setDestination(buildFieldValue(location));
    }

    setMapLocation([location.latitude, location.longitude]);
    setEstimate(null);
    setIsMapSearchOpen(false);
    setMapSearchResults([]);
    setActiveAutocompleteField(null);
    setAutocompleteResults([]);
    toast.success(field === "pickup" ? "اخترنا نقطة التحرك." : "اخترنا الوجهة.");
  };

  const beginMapPick = (field: Exclude<MapField, null>) => {
    setActiveMapField(field);
    setSheetMode("collapsed");
    setIsMapSearchOpen(false);
    setActiveAutocompleteField(null);
    setAutocompleteResults([]);
    setEstimate(null);
    toast.message(
      field === "pickup"
        ? "حرّك الخريطة لحد نقطة التحرك واضغط تثبيت."
        : "حرّك الخريطة لحد الوجهة واضغط تثبيت."
    );
  };

  const sheetTransform = useMemo(() => {
    return sheetMode === "expanded"
      ? "translateY(0)"
      : "translateY(calc(100% - 78px))";
  }, [sheetMode]);

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
              حرّك الخريطة لحد المكان الصح، وبعدها اضغط تثبيت النقطة عشان الاسم ينزل في الحقل تلقائي.
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

        {isMapSearchOpen ? (
          <div className="absolute inset-x-4 top-20 z-30 rounded-[24px] border border-white/10 bg-surface-container/95 p-3 shadow-[var(--shadow-premium)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex rounded-full bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => setMapSearchField("pickup")}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${
                    mapSearchField === "pickup"
                      ? "bg-primary text-white"
                      : "text-white/55"
                  }`}
                >
                  نقطة التحرك
                </button>
                <button
                  type="button"
                  onClick={() => setMapSearchField("destination")}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${
                    mapSearchField === "destination"
                      ? "bg-primary text-white"
                      : "text-white/55"
                  }`}
                >
                  الوجهة
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsMapSearchOpen(false)}
                className="text-xs font-bold text-white/55"
              >
                قفل
              </button>
            </div>

            <div className="flex gap-2">
              <Input
                value={mapSearchQuery}
                onChange={(event) => setMapSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSearchMapLocations();
                  }
                }}
                className="h-12 rounded-[18px] border-white/10 bg-black/10"
                placeholder={
                  mapSearchField === "pickup"
                    ? "دوّر على نقطة التحرك"
                    : "دوّر على الوجهة"
                }
              />
              <Button
                type="button"
                isLoading={isSearchingMap}
                className="h-12 rounded-[18px] px-4"
                onClick={() => void handleSearchMapLocations()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-[16px] px-4 text-xs"
                onClick={() => beginMapPick(mapSearchField)}
              >
                حدده يدوي من الخريطة
              </Button>
            </div>

            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {mapSearchResults.length ? (
                mapSearchResults.map((result, index) => (
                  <button
                    key={`${result.latitude}-${result.longitude}-${index}`}
                    type="button"
                    onClick={() => applyLocationFromSearch(result, mapSearchField)}
                    className="w-full rounded-[18px] border border-white/5 bg-black/10 px-4 py-3 text-right transition hover:border-primary/25 hover:bg-primary/10"
                  >
                    <p className="text-sm font-black text-white">{result.label}</p>
                    <p className="mt-1 text-xs text-white/55">{result.address}</p>
                  </button>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-white/10 px-4 py-4 text-sm text-white/50">
                  اكتب اسم المكان أو الشارع واضغط بحث.
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="absolute left-4 top-40 z-20">
          <button
            type="button"
            onClick={() => handleOpenMapSearch(pickup ? "destination" : "pickup")}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/5 bg-surface-container/95 text-foreground shadow-[var(--shadow-premium)] backdrop-blur-md"
            aria-label="ابحث عن مكان على الخريطة"
          >
            <Search className="h-5 w-5 text-primary" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-0">
        <div
          className="pointer-events-auto w-full max-w-xl rounded-t-[30px] border-t border-white/10 bg-surface-container/95 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] backdrop-blur-3xl transition-transform duration-300 md:rounded-[30px] md:border"
          style={{ transform: sheetTransform }}
        >
          <div className="px-4 pt-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-foreground">رايح فين؟</h2>
                <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-primary">
                  <Sparkles className="h-3 w-3" />
                  اكتب أو اختار من الخريطة
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSheetMode((current) =>
                    current === "expanded" ? "collapsed" : "expanded"
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/15"
                aria-label={sheetMode === "expanded" ? "طي الطلب" : "فتح الطلب"}
              >
                {sheetMode === "expanded" ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronUp className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex max-h-[54vh] flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4 custom-scrollbar">
              
              <div className="rounded-[28px] border border-white/5 bg-surface-container-low p-2 shadow-inner">
                <div className="space-y-2">
                  <div className="relative group">
                    <Input
                      value={destination}
                      onFocus={() => setActiveAutocompleteField("destination")}
                      onChange={(event) => {
                        setDestination(event.target.value);
                        setDestinationLocation(null);
                        setEstimate(null);
                        setActiveAutocompleteField("destination");
                      }}
                      className="h-16 text-lg rounded-[22px] border-0 bg-white/5 px-5 shadow-none ring-0 placeholder:text-gray-400 focus-visible:bg-white/10 font-black transition-all"
                      placeholder="رايح فين؟"
                    />
                  </div>

                  <div className="mx-4 h-[2px] bg-white/5 rounded-full" />

                  <div className="relative">
                    <Input
                      value={pickup}
                      onFocus={() => setActiveAutocompleteField("pickup")}
                      onChange={(event) => {
                        setPickup(event.target.value);
                        setPickupLocation(null);
                        setEstimate(null);
                        setActiveAutocompleteField("pickup");
                      }}
                      className="h-14 rounded-[20px] border-0 bg-transparent px-5 text-sm shadow-none ring-0 placeholder:text-gray-500 focus-visible:bg-white/5 font-bold transition-all"
                      placeholder="موقعك الحالي"
                    />
                  </div>
                </div>
              </div>

              {activeAutocompleteField ? (
                <div className="rounded-[24px] border border-white/5 bg-surface-container-low px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-white/60">
                      {activeAutocompleteField === "pickup"
                        ? "اقتراحات نقطة التحرك"
                        : "اقتراحات الوجهة"}
                    </p>
                    {isSearchingAutocomplete ? (
                      <p className="text-[11px] font-bold text-primary">بندور...</p>
                    ) : null}
                  </div>

                  <div className="max-h-52 space-y-2 overflow-y-auto">
                    {autocompleteResults.length ? (
                      autocompleteResults.map((result, index) => (
                        <button
                          key={`${activeAutocompleteField}-${result.latitude}-${result.longitude}-${index}`}
                          type="button"
                          onClick={() =>
                            applyLocationFromSearch(result, activeAutocompleteField)
                          }
                          className="w-full rounded-[18px] border border-white/5 bg-black/10 px-4 py-3 text-right transition hover:border-primary/25 hover:bg-primary/10"
                        >
                          <p className="text-sm font-black text-white">{result.label}</p>
                          <p className="mt-1 text-xs text-white/55">{result.address}</p>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-white/10 px-4 py-4 text-sm text-white/45">
                        اكتب اسم شارع أو منطقة أو معلم واضح، وهتظهر لك اقتراحات تختار منها.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-white/50 px-1">اختار المركبة</p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTripType("normal_ride");
                      setPreferredVehicleType("car");
                    }}
                    className={`flex flex-col items-center justify-center gap-2 rounded-[24px] border border-white/5 p-4 transition-all duration-300 ${
                      tripType === "normal_ride" && preferredVehicleType === "car"
                        ? "bg-primary/20 border-primary shadow-[0_4px_20px_-4px_rgba(61,161,132,0.3)] scale-[1.02]"
                        : "bg-surface-container-low hover:bg-surface-container hover:scale-[1.02]"
                    }`}
                  >
                    <span className="text-3xl drop-shadow-md">🚗</span>
                    <span className={`text-xs font-black ${tripType === "normal_ride" && preferredVehicleType === "car" ? "text-primary" : "text-white"}`}>عربية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTripType("normal_ride");
                      setPreferredVehicleType("tuk_tuk");
                    }}
                    className={`flex flex-col items-center justify-center gap-2 rounded-[24px] border border-white/5 p-4 transition-all duration-300 ${
                      tripType === "normal_ride" && preferredVehicleType === "tuk_tuk"
                        ? "bg-primary/20 border-primary shadow-[0_4px_20px_-4px_rgba(61,161,132,0.3)] scale-[1.02]"
                        : "bg-surface-container-low hover:bg-surface-container hover:scale-[1.02]"
                    }`}
                  >
                    <span className="text-3xl drop-shadow-md">🛺</span>
                    <span className={`text-xs font-black ${tripType === "normal_ride" && preferredVehicleType === "tuk_tuk" ? "text-primary" : "text-white"}`}>توك توك</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTripType("airport_ride");
                      setPreferredVehicleType("car");
                    }}
                    className={`flex flex-col items-center justify-center gap-2 rounded-[24px] border border-white/5 p-4 transition-all duration-300 ${
                      tripType === "airport_ride"
                        ? "bg-secondary/20 border-secondary shadow-[0_4px_20px_-4px_rgba(207,122,143,0.3)] scale-[1.02]"
                        : "bg-surface-container-low hover:bg-surface-container hover:scale-[1.02]"
                    }`}
                  >
                    <span className="text-3xl drop-shadow-md">✈️</span>
                    <span className={`text-[11px] font-black ${tripType === "airport_ride" ? "text-secondary" : "text-white"}`}>توصيلة مطار</span>
                  </button>
                </div>

                <div className="relative mt-2">
                  <UserRound className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <Input
                    value={passengerCount}
                    onChange={(event) => {
                      setPassengerCount(event.target.value);
                      setEstimate(null);
                    }}
                    placeholder="عدد الركاب"
                    className="h-12 rounded-[20px] border-white/5 bg-surface-container-low pe-12 ps-4 text-sm font-bold"
                  />
                </div>
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
                onClick={handleContinue}
                isLoading={isEstimating}
                className="h-[60px] w-full rounded-[24px] bg-primary text-[18px] font-black text-white transition-all active:scale-[0.98] hover:bg-primary-hover shadow-[var(--shadow-glow-primary)] flex items-center justify-center gap-2"
              >
                اطلب الكابتن
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
