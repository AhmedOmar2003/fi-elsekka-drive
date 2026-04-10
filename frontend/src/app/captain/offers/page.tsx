"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock3,
  LoaderCircle,
  RefreshCcw,
  Smartphone,
  TimerReset,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatRideDate,
  getOfferStatusLabel,
  getRideStatusTone,
} from "@/lib/ride-status";

type DriverOffer = {
  id: string;
  offerStatus: string;
  offeredAt: string;
  expiresAt: string | null;
  trip: {
    id: string;
    trip_type: string;
    status: string;
    pickup_label: string;
    pickup_address: string;
    destination_label: string;
    destination_address: string;
    passenger_count: number;
    luggage_count: number;
    estimated_price: number | null;
    created_at: string;
    customerName: string;
    customerPhone: string | null;
  } | null;
};

export default function CaptainOffersPage() {
  const router = useRouter();
  const { user, profile, session, isLoading: isAuthLoading } = useAuth();
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [pushState, setPushState] = useState<"checking" | "enabled" | "prompt" | "blocked" | "unsupported">("checking");
  const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY || "";

  const effectiveRole = useMemo(
    () => profile?.role || user?.user_metadata?.role || user?.app_metadata?.role || null,
    [profile?.role, user?.app_metadata?.role, user?.user_metadata?.role]
  );

  const loadOffers = useCallback(async (silent?: boolean) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await fetch("/api/driver/trip-offers", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        router.replace("/captain/login?redirect=/captain/offers");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "تعذر تحميل العروض.");
      }

      setOffers(data.offers || []);
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || "تعذر تحميل المشاوير المتاحة.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace("/captain/login?redirect=/captain/offers");
      return;
    }

    if (effectiveRole !== "driver") {
      router.replace("/captain/login?redirect=/captain/offers");
      return;
    }

    void loadOffers();
  }, [effectiveRole, isAuthLoading, loadOffers, router, user]);

  useEffect(() => {
    if (!user || effectiveRole !== "driver") return;
    const interval = window.setInterval(() => void loadOffers(true), 10000);
    return () => window.clearInterval(interval);
  }, [effectiveRole, loadOffers, user]);

  const urlBase64ToUint8Array = useCallback((base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }, []);

  const enablePushNotifications = useCallback(async () => {
    if (!session?.access_token) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !window.isSecureContext || !publicVapidKey) {
      setPushState("unsupported");
      return;
    }

    try {
      if (Notification.permission === "denied") {
        setPushState("blocked");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        setPushState(permission === "denied" ? "blocked" : "prompt");
        return;
      }

      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        }));

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ subscription }),
      });

      if (!response.ok) {
        throw new Error("تعذر تفعيل الإشعارات.");
      }

      setPushState("enabled");
      toast.success("إشعارات الطلبات اتفعلت على موبايلك.");
    } catch (error: any) {
      toast.error(error?.message || "تعذر تفعيل إشعارات الموبايل.");
    }
  }, [publicVapidKey, session?.access_token, urlBase64ToUint8Array]);

  useEffect(() => {
    if (!user || effectiveRole !== "driver") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !window.isSecureContext || !publicVapidKey) {
      setPushState("unsupported");
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setPushState(subscription ? "enabled" : "prompt");
      })
      .catch(() => {
        setPushState("prompt");
      });
  }, [effectiveRole, publicVapidKey, user]);

  const respondToOffer = async (offerId: string, action: "accept" | "reject") => {
    setBusyOfferId(offerId);
    try {
      const response = await fetch(`/api/driver/trip-offers/${offerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "تعذر تحديث العرض.");
      }

      toast.success(action === "accept" ? "تم قبول المشوار." : "تم رفض العرض.");
      await loadOffers(true);
    } catch (error: any) {
      toast.error(error?.message || "تعذر إرسال ردك.");
    } finally {
      setBusyOfferId(null);
    }
  };

  const acceptedTrip = offers.find(
    (offer) => offer.offerStatus === "accepted" && offer.trip?.id
  );

  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(180deg,rgba(9,12,16,1),rgba(14,20,18,1))] px-4 pb-8 pt-4">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex items-center justify-between">
          <Button asChild variant="secondary" size="icon" className="h-12 w-12 rounded-full">
            <Link href="/">
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-full px-4"
            onClick={() => void loadOffers(true)}
          >
            <RefreshCcw className="h-4 w-4" />
            تحديث
          </Button>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-surface-container/95 p-5 shadow-[var(--shadow-premium)] backdrop-blur-2xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white">عروض المشاوير</h1>
              <p className="mt-1 text-sm leading-7 text-white/60">
                المشوار بيجيلك من فريق التشغيل، ولو مناسب لك تقدر تقبله فورًا.
              </p>
            </div>
            <div className="rounded-[20px] border border-primary/20 bg-primary/10 px-4 py-3 text-center">
              <p className="text-xs text-white/45">العروض الحالية</p>
              <p className="mt-1 text-xl font-black text-primary">{offers.length}</p>
            </div>
          </div>

          {acceptedTrip?.trip ? (
            <div className="mb-5 rounded-[24px] border border-primary/15 bg-primary/10 p-4">
              <p className="text-sm font-black text-white">فيه مشوار مقبول حاليًا</p>
              <p className="mt-1 text-sm leading-7 text-white/70">
                تقدر تتابع حالته وتتحرك عليه من شاشة الرحلة الحية.
              </p>
              <Button asChild className="mt-4 h-12 rounded-[18px]">
                <Link href={`/trip/live?id=${acceptedTrip.trip.id}`}>افتح المشوار الحالي</Link>
              </Button>
            </div>
          ) : null}

          {pushState !== "enabled" ? (
            <div className="mb-5 rounded-[24px] border border-primary/15 bg-primary/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">فعّل إشعارات الموبايل</p>
                  <p className="mt-1 text-sm leading-7 text-white/65">
                    أول ما الإدارة تبعتلك عرض جديد، التليفون ينبهك فورًا حتى لو التطبيق في الخلفية.
                  </p>
                </div>
                <Button type="button" className="h-11 rounded-[16px]" onClick={() => void enablePushNotifications()}>
                  <Smartphone className="h-4 w-4" />
                  تفعيل
                </Button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center justify-center rounded-[24px] border border-white/5 bg-surface-container-low px-4 py-8 text-sm text-white/60">
              <LoaderCircle className="me-3 h-4 w-4 animate-spin text-primary" />
              بنحمل العروض المتاحة...
            </div>
          ) : offers.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-surface-container-low px-5 py-8 text-center">
              <p className="text-lg font-black text-white">لسه مفيش عروض قريبة</p>
              <p className="mt-2 text-sm leading-7 text-white/60">
                خليك متاح، وأول ما يوصلك مشوار من منطقتك هيظهر هنا تلقائي.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {offers.map((offer) => {
                const trip = offer.trip;
                const isOffered = offer.offerStatus === "offered";

                return (
                  <div
                    key={offer.id}
                    className="rounded-[26px] border border-white/5 bg-surface-container-low p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">
                          {trip?.trip_type === "airport_ride" ? "مشوار مطار" : "مشوار عادي"}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          اتبعتلك {formatRideDate(offer.offeredAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black ${getRideStatusTone(
                          offer.offerStatus
                        )}`}
                      >
                        {getOfferStatusLabel(offer.offerStatus)}
                      </span>
                    </div>

                    {trip ? (
                      <>
                        <div className="space-y-3 rounded-[20px] border border-white/5 bg-black/10 p-4 text-sm">
                          <div>
                            <p className="text-white/45">من</p>
                            <p className="mt-1 font-bold text-white">{trip.pickup_address}</p>
                          </div>
                          <div>
                            <p className="text-white/45">إلى</p>
                            <p className="mt-1 font-bold text-white">{trip.destination_address}</p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-[18px] border border-white/5 bg-black/10 px-4 py-3">
                            <p className="text-white/45">العميل</p>
                            <p className="mt-1 flex items-center gap-2 font-bold text-white">
                              <UserRound className="h-4 w-4 text-primary" />
                              {trip.customerName}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/5 bg-black/10 px-4 py-3">
                            <p className="text-white/45">السعر المقترح</p>
                            <p className="mt-1 font-bold text-white">
                              {trip.estimated_price ? `${trip.estimated_price} ج.م` : "لسه"}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/5 bg-black/10 px-4 py-3">
                            <p className="text-white/45">الركاب / الشنط</p>
                            <p className="mt-1 font-bold text-white">
                              {trip.passenger_count} راكب
                              {trip.luggage_count ? ` / ${trip.luggage_count} شنطة` : ""}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/5 bg-black/10 px-4 py-3">
                            <p className="text-white/45">الوقت</p>
                            <p className="mt-1 flex items-center gap-2 font-bold text-white">
                              <Clock3 className="h-4 w-4 text-primary" />
                              {formatRideDate(trip.created_at)}
                            </p>
                          </div>
                        </div>

                        {offer.expiresAt && isOffered ? (
                          <div className="mt-3 flex items-center gap-2 rounded-[18px] border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                            <TimerReset className="h-4 w-4" />
                            العرض متاح لحد {formatRideDate(offer.expiresAt)}
                          </div>
                        ) : null}

                        <div className="mt-4 flex gap-3">
                          {isOffered ? (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-12 flex-1 rounded-[18px]"
                                isLoading={busyOfferId === offer.id}
                                onClick={() => respondToOffer(offer.id, "reject")}
                              >
                                رفض
                              </Button>
                              <Button
                                type="button"
                                className="h-12 flex-1 rounded-[18px]"
                                isLoading={busyOfferId === offer.id}
                                onClick={() => respondToOffer(offer.id, "accept")}
                              >
                                قبول المشوار
                              </Button>
                            </>
                          ) : trip.id ? (
                            <Button asChild className="h-12 w-full rounded-[18px]">
                              <Link href={`/trip/live?id=${trip.id}`}>متابعة المشوار</Link>
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[20px] border border-white/5 bg-black/10 px-4 py-4 text-sm text-white/60">
                        بيانات المشوار مش متاحة حاليًا.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
