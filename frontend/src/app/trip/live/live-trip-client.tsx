"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CarFront,
  Clock3,
  LoaderCircle,
  PhoneCall,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InteractiveMap } from "@/components/map/dynamic-map-wrapper";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatRideDate,
  getRideStatusLabel,
  getRideStatusTone,
} from "@/lib/ride-status";

type TripPayload = {
  trip: {
    id: string;
    trip_type: string;
    status: string;
    pickup_label: string;
    pickup_address: string;
    pickup_latitude: number | null;
    pickup_longitude: number | null;
    destination_label: string;
    destination_address: string;
    destination_latitude: number | null;
    destination_longitude: number | null;
    passenger_count: number;
    luggage_count: number;
    estimated_price: number | null;
    airport_name: string | null;
    airport_terminal: string | null;
    airport_ride_mode: string | null;
    flight_number: string | null;
    flight_time: string | null;
    rider_notes: string | null;
    metadata?: {
      route_distance_km?: number;
      route_duration_minutes?: number;
      suggested_price_min?: number;
      suggested_price_max?: number;
    } | null;
  };
  customer?: {
    full_name?: string | null;
    phone?: string | null;
  } | null;
  driver?: {
    full_name?: string | null;
    phone?: string | null;
  } | null;
  vehicle?: {
    vehicle_type?: string | null;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    plate_number?: string | null;
  } | null;
  timeline: Array<{
    id: string;
    status: string;
    note: string | null;
    created_at: string;
  }>;
};

export function LiveTripClient({ tripId }: { tripId?: string }) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [payload, setPayload] = useState<TripPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTrip = useCallback(
    async (silent?: boolean) => {
      if (!tripId) {
        router.replace("/book");
        return;
      }

      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const response = await fetch(`/api/rides/${tripId}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
          router.replace(`/login?redirect=${encodeURIComponent(`/trip/live?id=${tripId}`)}`);
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "تعذر تحميل حالة المشوار.");
        }

        setPayload(data);
      } catch (error: any) {
        if (!silent) {
          toast.error(error?.message || "تعذر تحميل بيانات المشوار.");
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [router, tripId]
  );

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/trip/live${tripId ? `?id=${tripId}` : ""}`)}`);
      return;
    }

    void loadTrip();
  }, [isAuthLoading, loadTrip, router, tripId, user]);

  useEffect(() => {
    if (!tripId || !user) return;
    const interval = window.setInterval(() => {
      void loadTrip(true);
    }, 8000);

    return () => window.clearInterval(interval);
  }, [loadTrip, tripId, user]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (!payload?.trip?.pickup_latitude || !payload?.trip?.pickup_longitude) {
      return [30.0444, 31.2357];
    }
    return [payload.trip.pickup_latitude, payload.trip.pickup_longitude];
  }, [payload]);

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-surface-container px-5 py-3 text-sm text-white/70">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          بنجيب آخر حالة للمشوار...
        </div>
      </div>
    );
  }

  if (!payload?.trip) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-lg font-black text-white">المشوار ده مش ظاهر عندك دلوقتي.</p>
        <Button asChild>
          <Link href="/book">اطلب مشوار جديد</Link>
        </Button>
      </div>
    );
  }

  const { trip, driver, vehicle, timeline } = payload;
  const priceRange =
    trip.metadata?.suggested_price_min && trip.metadata?.suggested_price_max
      ? `${trip.metadata.suggested_price_min} - ${trip.metadata.suggested_price_max} ج.م`
      : trip.estimated_price
        ? `${trip.estimated_price} ج.م`
        : "لسه بنحسبه";

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,rgba(9,12,16,1),rgba(14,20,18,1))]">
      <div className="absolute inset-0">
        <InteractiveMap initialCenter={mapCenter} zoom={13} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/65 via-transparent to-background/95" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-4 pb-6 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <Button
            asChild
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full bg-surface-container/90 backdrop-blur-md"
          >
            <Link href="/" aria-label="الرئيسية">
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>

          <div
            className={`rounded-full border px-4 py-2 text-sm font-black ${getRideStatusTone(
              trip.status
            )}`}
          >
            {getRideStatusLabel(trip.status)}
          </div>
        </div>

        <div className="mt-auto rounded-[32px] border border-white/10 bg-surface-container/95 p-5 shadow-[var(--shadow-premium)] backdrop-blur-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-foreground">متابعة المشوار</h1>
              <p className="mt-1 text-sm leading-7 text-white/60">
                {trip.status === "searching_driver" || trip.status === "offered"
                  ? "الطلب عند فريق التشغيل والكباتن المتاحين دلوقتي."
                  : "ده ملخص الحالة الحالية للمشوار وكل تحديثاته."}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => void loadTrip(true)}
              className="h-11 w-11 rounded-full"
            >
              <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="mb-4 rounded-[28px] border border-white/5 bg-surface-container-low p-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center py-1">
                <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                <div className="my-1 h-10 w-0.5 bg-white/10" />
                <div className="h-3 w-3 rounded-full bg-secondary ring-4 ring-secondary/20" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs text-white/45">من</p>
                  <p className="mt-1 text-sm font-black text-white">{trip.pickup_address}</p>
                </div>
                <div>
                  <p className="text-xs text-white/45">إلى</p>
                  <p className="mt-1 text-sm font-black text-white">{trip.destination_address}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] border border-white/5 bg-black/15 p-4">
              <p className="text-xs text-white/45">الوقت المتوقع</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-black text-white">
                <Clock3 className="h-4 w-4 text-primary" />
                {trip.metadata?.route_duration_minutes ?? "..."} دقيقة
              </p>
            </div>
            <div className="rounded-[22px] border border-white/5 bg-black/15 p-4">
              <p className="text-xs text-white/45">السعر المقترح</p>
              <p className="mt-2 text-lg font-black text-white">{priceRange}</p>
            </div>
          </div>

          {driver ? (
            <div className="mt-4 rounded-[26px] border border-primary/15 bg-primary/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50">الكابتن اللي استلم المشوار</p>
                  <p className="mt-1 text-lg font-black text-white">{driver.full_name || "كابتن"}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-3">
                  <p className="text-white/45">الموبايل</p>
                  <p className="mt-1 font-bold text-white">{driver.phone || "غير متاح"}</p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-3">
                  <p className="text-white/45">المركبة</p>
                  <p className="mt-1 font-bold text-white">
                    {[vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "سيارة الكابتن"}
                  </p>
                </div>
              </div>

              {vehicle ? (
                <div className="mt-3 rounded-[18px] border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/75">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <CarFront className="h-4 w-4 text-primary" />
                    {vehicle.vehicle_type === "tuk_tuk" ? "توك توك" : "عربية"} -{" "}
                    {vehicle.plate_number || "بدون لوحة"}
                  </div>
                  <p className="mt-1 text-white/60">{vehicle.color || "اللون غير مضاف"}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] border border-amber-400/15 bg-amber-500/10 p-4 text-sm leading-7 text-amber-100">
              {trip.status === "offered"
                ? "الطلب متبعت للكباتن القريبين. أول ما حد يقبل هتشوف بياناته هنا."
                : "لسه بندور على كابتن مناسب قريب من نقطة التحرك."}
            </div>
          )}

          {trip.trip_type === "airport_ride" ? (
            <div className="mt-4 rounded-[24px] border border-secondary/20 bg-secondary/10 p-4 text-sm">
              <p className="font-black text-secondary">تفاصيل المطار</p>
              <p className="mt-2 leading-7 text-white/75">
                {trip.airport_name || "المطار"} /{" "}
                {trip.airport_ride_mode === "arrival" ? "استقبال" : "توصيل"} /{" "}
                {trip.flight_time || "ميعاد غير محدد"}
              </p>
            </div>
          ) : null}

          {trip.rider_notes ? (
            <div className="mt-4 rounded-[22px] border border-white/5 bg-black/15 px-4 py-3 text-sm leading-7 text-white/75">
              <span className="font-black text-white">ملاحظاتك:</span> {trip.rider_notes}
            </div>
          ) : null}

          <div className="mt-5">
            <h2 className="mb-3 text-sm font-black text-white">الخطوات اللي حصلت</h2>
            <div className="space-y-3">
              {timeline.map((item, index) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-[20px] border border-white/5 bg-surface-container-low px-4 py-3"
                >
                  <div className="flex flex-col items-center">
                    <div className="mt-1 h-3 w-3 rounded-full bg-primary" />
                    {index < timeline.length - 1 ? (
                      <div className="mt-1 h-full w-0.5 bg-white/10" />
                    ) : null}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-white">
                        {getRideStatusLabel(item.status)}
                      </p>
                      <span className="text-xs text-white/45">
                        {formatRideDate(item.created_at)}
                      </span>
                    </div>
                    {item.note ? (
                      <p className="mt-1 text-sm leading-7 text-white/60">{item.note}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button asChild variant="secondary" className="h-14 flex-1 rounded-[20px]">
              <Link href="/support">مشكلة في المشوار</Link>
            </Button>
            <Button
              type="button"
              variant="primary"
              className="h-14 flex-1 rounded-[20px]"
              onClick={() =>
                driver?.phone
                  ? (window.location.href = `tel:${driver.phone}`)
                  : toast.error("رقم الكابتن لسه مش متاح.")
              }
            >
              <PhoneCall className="h-4 w-4" />
              اتصال
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
