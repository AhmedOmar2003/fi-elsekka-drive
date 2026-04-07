"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  LoaderCircle,
  MapPin,
  PlaneTakeoff,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InteractiveMap } from "@/components/map/dynamic-map-wrapper";
import {
  clearRideBookingDraft,
  readRideBookingDraft,
  type RideBookingDraft,
} from "@/lib/ride-booking-draft";
import { useAuth } from "@/contexts/AuthContext";

type TripPoint = NonNullable<RideBookingDraft["estimate"]>["pickup"];

function formatPlaceTitle(point: TripPoint) {
  const candidates = [point.label, point.area, point.city]
    .map((value) => value?.trim())
    .filter(Boolean) as string[];

  if (candidates.length > 0) {
    return candidates[0];
  }

  return point.address
    .split("،")
    .map((part) => part.trim())
    .filter(Boolean)[0] || "مكان غير محدد";
}

function formatPlaceSubtitle(point: TripPoint) {
  const addressParts = point.address
    .split("،")
    .map((part) => part.trim())
    .filter(Boolean);

  const title = formatPlaceTitle(point);
  const filteredParts = addressParts.filter((part) => part !== title);
  const detail = filteredParts.slice(0, 2).join("، ");

  return detail || point.city || point.area || point.address;
}

export default function TripConfirmationPage() {
  const router = useRouter();
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const [draft, setDraft] = useState<RideBookingDraft | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const nextDraft = readRideBookingDraft();
    if (!nextDraft?.estimate) {
      router.replace("/book");
      return;
    }

    setDraft(nextDraft);
    setIsReady(true);
  }, [router]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (!draft?.estimate) return [30.0444, 31.2357];
    return [draft.estimate.pickup.latitude, draft.estimate.pickup.longitude];
  }, [draft]);

  const handleConfirm = async () => {
    if (!draft?.estimate) {
      toast.error("بيانات المشوار مش كاملة. ارجع احسبه من الأول.");
      router.replace("/book");
      return;
    }

    if (isAuthLoading) return;

    if (!user) {
      router.push("/login?redirect=/trip/confirm");
      return;
    }

    if (profile?.disabled) {
      toast.error("الحساب الحالي موقوف مؤقتًا.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/rides/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.push("/login?redirect=/trip/confirm");
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || "تعذر إرسال طلب المشوار.");
      }

      clearRideBookingDraft();
      toast.success(
        payload.offeredDriverCount > 0
          ? "اترسل الطلب للكباتن القريبين."
          : "استلمنا الطلب ولسه بندور على كابتن مناسب."
      );
      router.replace(`/trip/live?id=${payload.tripId}`);
    } catch (error: any) {
      toast.error(error?.message || "حصلت مشكلة أثناء إرسال الطلب.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isReady || !draft?.estimate) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-surface-container px-5 py-3 text-sm text-white/70">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          بنجهز ملخص المشوار...
        </div>
      </div>
    );
  }

  const { estimate } = draft;
  const pickupTitle = formatPlaceTitle(estimate.pickup);
  const pickupSubtitle = formatPlaceSubtitle(estimate.pickup);
  const destinationTitle = formatPlaceTitle(estimate.destination);
  const destinationSubtitle = formatPlaceSubtitle(estimate.destination);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,rgba(9,12,16,1),rgba(14,20,18,1))]">
      <div className="absolute inset-0">
        <InteractiveMap initialCenter={mapCenter} zoom={13} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/20 to-background/95" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-4 pb-6 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <Button
            asChild
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full bg-surface-container/90 backdrop-blur-md"
          >
            <Link href="/book" aria-label="رجوع">
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>

          <div className="rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-black text-primary">
            راجع طلبك
          </div>
        </div>

        <div className="mt-auto rounded-[32px] border border-white/10 bg-surface-container/95 p-5 shadow-[var(--shadow-premium)] backdrop-blur-2xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-foreground">راجع مشوارك</h1>
              <p className="mt-1 text-sm leading-7 text-white/60">
                الطلب هيتبعت للكباتن القريبين عشان يقبلوه على طول.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/5 bg-surface-container-low p-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center py-1">
                  <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                  <div className="my-1 h-10 w-0.5 bg-white/10" />
                  <div className="h-3 w-3 rounded-full bg-secondary ring-4 ring-secondary/20" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-xs text-white/45">من</p>
                    <p className="mt-1 text-sm font-black text-foreground">
                      {pickupTitle}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-white/55">
                      {pickupSubtitle}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">إلى</p>
                    <p className="mt-1 text-sm font-black text-foreground">
                      {destinationTitle}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-white/55">
                      {destinationSubtitle}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[22px] border border-white/5 bg-surface-container-low p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-300">
                  <Clock3 className="h-5 w-5" />
                </div>
                <p className="text-xs text-white/50">المدة المتوقعة</p>
                <p className="mt-1 text-lg font-black text-white">
                  {estimate.durationMinutes} دقيقة
                </p>
              </div>

              <div className="rounded-[22px] border border-white/5 bg-surface-container-low p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                  <DollarSign className="h-5 w-5" />
                </div>
                <p className="text-xs text-white/50">السعر المقترح</p>
                <p className="mt-1 text-lg font-black text-white">
                  {estimate.minPrice} - {estimate.maxPrice} ج.م
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-white/5 bg-black/15 px-4 py-3">
                <p className="text-xs text-white/45">نوع المشوار</p>
                <p className="mt-1 text-sm font-black text-white">
                  {draft.tripType === "airport_ride" ? "مشوار مطار" : "مشوار عادي"}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/5 bg-black/15 px-4 py-3">
                <p className="text-xs text-white/45">المركبة المفضلة</p>
                <p className="mt-1 text-sm font-black text-white">
                  {draft.preferredVehicleType === "car"
                    ? "عربية"
                    : draft.preferredVehicleType === "tuk_tuk"
                      ? "توك توك"
                      : "الأقرب والمتاح"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-white/5 bg-black/15 px-4 py-3">
                <p className="text-xs text-white/45">عدد الركاب</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-black text-white">
                  <UserRound className="h-4 w-4 text-primary" />
                  {draft.passengerCount}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/5 bg-black/15 px-4 py-3">
                <p className="text-xs text-white/45">المسافة</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-black text-white">
                  <MapPin className="h-4 w-4 text-secondary" />
                  {estimate.distanceKm} كم
                </p>
              </div>
            </div>

            {draft.tripType === "airport_ride" ? (
              <div className="rounded-[24px] border border-secondary/20 bg-secondary/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-secondary">
                  <PlaneTakeoff className="h-4 w-4" />
                  <p className="text-sm font-black">تفاصيل المطار</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-white/45">المطار</p>
                    <p className="mt-1 font-bold text-white">{draft.airportName || "غير محدد"}</p>
                  </div>
                  <div>
                    <p className="text-white/45">نوع الرحلة</p>
                    <p className="mt-1 font-bold text-white">
                      {draft.airportRideMode === "arrival" ? "استقبال من المطار" : "توصيل للمطار"}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/45">ميعاد الطيارة</p>
                    <p className="mt-1 font-bold text-white">{draft.flightTime || "غير محدد"}</p>
                  </div>
                  <div>
                    <p className="text-white/45">الترمينال / الرحلة</p>
                    <p className="mt-1 font-bold text-white">
                      {[draft.airportTerminal, draft.flightNumber].filter(Boolean).join(" - ") || "غير محدد"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {draft.notes ? (
              <div className="flex gap-3 rounded-[22px] border border-primary/15 bg-primary/5 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-black text-white">ملاحظاتك للكابتن</p>
                  <p className="mt-1 text-sm leading-7 text-white/70">{draft.notes}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-3 border-t border-white/5 pt-4">
            {!user ? (
              <div className="rounded-[20px] border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm leading-7 text-amber-100">
                محتاج تسجل دخول الأول علشان نبعت الطلب للكباتن ونتابع حالته.
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button asChild variant="secondary" className="h-[60px] rounded-[24px] px-6 text-base shadow-sm">
                <Link href="/book">عدّل</Link>
              </Button>
              <Button
                type="button"
                isLoading={isSubmitting}
                onClick={handleConfirm}
                className="h-[60px] flex-1 rounded-[24px] text-lg font-black shadow-[var(--shadow-glow-primary)] active:scale-[0.98]"
              >
                {user ? "أكد المشوار" : "سجل وكمل من هنا"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
