"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/services/authService";
import { fetchRestaurantManagerOrders, submitRestaurantOrderEta } from "@/services/restaurantsService";
import {
  BellRing,
  ChevronDown,
  ChevronUp,
  ChefHat,
  Clock3,
  Loader2,
  LogOut,
  Menu,
  PackageCheck,
  Send,
  Store,
  TimerReset,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatRestaurantEtaWindow, getRestaurantOrderSnapshot } from "@/lib/restaurant-order";
import { getSelectedVariantLabel } from "@/lib/product-variants";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RestaurantNotificationBell } from "@/components/restaurant/restaurant-notification-bell";

type RestaurantPortalOrder = {
  id: string;
  status: string;
  total_amount: number;
  restaurant_total?: number;
  created_at: string;
  shipping_address?: Record<string, any>;
  users?: { full_name?: string; email?: string; phone?: string } | { full_name?: string; email?: string; phone?: string }[] | null;
  order_items?: Array<{
    id: string;
    quantity: number;
    price_at_purchase?: number | null;
    selected_variant_json?: Record<string, any> | null;
    products?: {
      id: string;
      name: string;
      price?: number | null;
      image_url?: string | null;
    } | null;
  }>;
};

function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "في الانتظار";
    case "processing":
      return "قيد التجهيز";
    case "shipped":
      return "في الطريق";
    case "delivered":
      return "تم التوصيل";
    case "cancelled":
      return "ملغي";
    default:
      return status || "غير معروف";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "pending":
      return "border-amber-400/20 bg-amber-400/10 text-amber-400";
    case "processing":
      return "border-sky-500/20 bg-sky-500/10 text-sky-400";
    case "shipped":
      return "border-violet-500/20 bg-violet-500/10 text-violet-400";
    case "delivered":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
    case "cancelled":
      return "border-rose-500/20 bg-rose-500/10 text-rose-400";
    default:
      return "border-surface-hover bg-surface-hover text-gray-400";
  }
}

function orderUser(users: RestaurantPortalOrder["users"]) {
  return Array.isArray(users) ? users[0] : users;
}

function RestaurantEtaComposer({
  order,
  onSaved,
}: {
  order: RestaurantPortalOrder;
  onSaved: (shippingAddress: Record<string, any>) => void;
}) {
  const shipping = order.shipping_address || {};
  const etaSnapshot = getRestaurantOrderSnapshot(shipping);
  const [etaText, setEtaText] = React.useState(etaSnapshot.etaText || "");
  const [etaHours, setEtaHours] = React.useState(etaSnapshot.etaHours || 0);
  const [etaDays, setEtaDays] = React.useState(etaSnapshot.etaDays || 0);
  const [etaNote, setEtaNote] = React.useState(etaSnapshot.etaNote || "");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setEtaText(etaSnapshot.etaText || "");
    setEtaHours(etaSnapshot.etaHours || 0);
    setEtaDays(etaSnapshot.etaDays || 0);
    setEtaNote(etaSnapshot.etaNote || "");
  }, [order.id, etaSnapshot.etaDays, etaSnapshot.etaHours, etaSnapshot.etaNote, etaSnapshot.etaText]);

  const handleSubmit = async () => {
    if (!etaText.trim()) {
      toast.error("اكتب نصًا واضحًا للموعد قبل الإرسال");
      return;
    }

    if (etaDays <= 0 && etaHours <= 0) {
      toast.error("حدد عدد ساعات أو أيام على الأقل");
      return;
    }

    setIsSaving(true);
    try {
      const payload = await submitRestaurantOrderEta(order.id, {
        etaText,
        etaHours,
        etaDays,
        etaNote,
      });
      onSaved(payload.shipping_address || {});
      toast.success("تم إرسال الموعد للإدارة بنجاح");
    } catch (error: any) {
      toast.error(error?.message || "فشل إرسال الموعد");
    } finally {
      setIsSaving(false);
    }
  };

  const isClosed = ["cancelled", "delivered"].includes(order.status);

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-primary/80">وقت تجهيز وتوصيل الطلب</p>
          <p className="mt-1 text-sm leading-7 text-gray-400">
            اكتب الوقت المتوقع عندك، والإدارة هتراجعه وتبلغه للعميل والمندوب بشكل رسمي.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${
          etaSnapshot.etaStatus === "approved"
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            : etaSnapshot.etaStatus === "submitted"
              ? "border-sky-500/20 bg-sky-500/10 text-sky-400"
              : "border-amber-400/20 bg-amber-400/10 text-amber-400"
        }`}>
          {etaSnapshot.etaStatus === "approved"
            ? "اعتمدته الإدارة"
            : etaSnapshot.etaStatus === "submitted"
              ? "وصل للإدارة"
              : "بانتظار ردك"}
        </span>
      </div>

      {(etaSnapshot.etaText || etaSnapshot.etaSubmittedAt) && (
        <div className="rounded-2xl border border-surface-hover bg-background/70 px-4 py-3 text-sm">
          <p className="font-black text-foreground">{etaSnapshot.etaText || "موعد بدون نص"}</p>
          <p className="mt-1 text-xs text-gray-500">
            المدة المحسوبة: {formatRestaurantEtaWindow(etaSnapshot.etaDays, etaSnapshot.etaHours)}
          </p>
          {etaSnapshot.etaSubmittedAt && (
            <p className="mt-1 text-xs text-gray-500">
              آخر إرسال: {new Date(etaSnapshot.etaSubmittedAt).toLocaleString("ar-EG")}
            </p>
          )}
        </div>
      )}

      {!isClosed && (
        <>
          <div>
            <p className="mb-2 text-xs font-black text-gray-500">النص اللي هيوصل للإدارة</p>
            <input
              type="text"
              value={etaText}
              onChange={(event) => setEtaText(event.target.value)}
              placeholder="مثال: الطلب هيكون جاهز خلال ساعة ونصف"
              className="w-full rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-black text-gray-500">عدد الأيام</p>
              <input
                type="number"
                min={0}
                value={etaDays}
                onChange={(event) => setEtaDays(Number(event.target.value || 0))}
                className="w-full rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-black text-gray-500">عدد الساعات</p>
              <input
                type="number"
                min={0}
                value={etaHours}
                onChange={(event) => setEtaHours(Number(event.target.value || 0))}
                className="w-full rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-black text-gray-500">ملاحظة للإدارة (اختياري)</p>
            <textarea
              rows={2}
              value={etaNote}
              onChange={(event) => setEtaNote(event.target.value)}
              placeholder="مثال: الطلب محتاج 20 دقيقة تجهيز قبل خروجه"
              className="w-full resize-none rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>

          <div className="rounded-2xl border border-surface-hover bg-background/70 px-4 py-3 text-xs text-gray-500">
            المدة الحالية: <span className="font-black text-primary">{formatRestaurantEtaWindow(etaDays, etaHours)}</span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-black text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : etaSnapshot.etaStatus === "submitted" ? <TimerReset className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {isSaving ? "جاري الإرسال..." : etaSnapshot.etaStatus === "submitted" ? "تحديث الموعد عند الإدارة" : "إرسال الموعد للإدارة"}
          </button>
        </>
      )}
    </div>
  );
}

function RestaurantOrderCard({
  order,
  defaultExpanded = false,
  tone = "active",
  onSaved,
}: {
  order: RestaurantPortalOrder;
  defaultExpanded?: boolean;
  tone?: "active" | "closed";
  onSaved: (shippingAddress: Record<string, any>) => void;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const customer = orderUser(order.users);
  const shipping = order.shipping_address || {};
  const restaurantOrderSnapshot = getRestaurantOrderSnapshot(shipping);
  const isClosedTone = tone === "closed";
  const summaryItems = [
    {
      label: "العميل",
      value: customer?.full_name || "غير معروف",
      valueClassName: "text-foreground",
    },
    {
      label: "رقم العميل",
      value: customer?.phone || shipping.phone || "غير متوفر",
      valueClassName: "text-foreground",
    },
    {
      label: "وقت الطلب",
      value: `${new Date(order.created_at).toLocaleDateString("ar-EG")} - ${new Date(order.created_at).toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      valueClassName: "text-foreground",
    },
    {
      label: "أصناف مطعمك",
      value: String(order.order_items?.length || 0),
      valueClassName: "text-primary",
    },
  ];

  return (
    <div
      className={`overflow-hidden rounded-3xl border transition-colors ${
        isClosedTone
          ? "border-emerald-500/15 bg-emerald-500/[0.04] hover:border-emerald-500/25"
          : "border-amber-400/15 bg-background/40 hover:border-primary/20"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={`flex w-full flex-col gap-4 p-4 text-right transition-colors sm:p-5 md:flex-row md:items-start md:justify-between ${
          isClosedTone ? "hover:bg-emerald-500/[0.03]" : "hover:bg-surface/40"
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-foreground">طلب #{order.id.slice(0, 8)}</p>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${statusClass(order.status)}`}>
              {statusLabel(order.status)}
            </span>
            {restaurantOrderSnapshot.etaStatus === "approved" && (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-400">
                الموعد اتعتمد
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-surface-hover bg-surface/70 px-3 py-2.5">
                <p className="text-[11px] font-black text-gray-500">{item.label}</p>
                <p className={`mt-1 break-words text-sm font-black leading-6 ${item.valueClassName}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-3 md:flex md:items-end">
          <div className="rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-right md:min-w-[190px]">
            <p className="text-[11px] font-black text-gray-500">إجمالي منتجات مطعمك</p>
            <p className="mt-1 text-2xl font-black text-primary">
              {Number(order.restaurant_total || 0).toLocaleString("ar-EG")} ج.م
            </p>
          </div>

          <span className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-surface-hover bg-surface px-3 py-2 text-xs font-black text-gray-300 md:h-auto md:w-auto md:rounded-full">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="hidden sm:inline">{expanded ? "إخفاء التفاصيل" : "افتح التفاصيل"}</span>
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-surface-hover px-4 pb-4 pt-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-surface-hover bg-surface px-4 py-3">
              <p className="text-xs font-black text-gray-500">بيانات العميل</p>
              <div className="mt-2 space-y-1 text-sm text-foreground">
                <p>{customer?.phone || shipping.phone || "بدون رقم هاتف"}</p>
                <p className="text-gray-400">{customer?.email || "بدون إيميل"}</p>
                <p className="text-gray-400">
                  {[shipping.city, shipping.area, shipping.street || shipping.address].filter(Boolean).join("، ") || "العنوان هيتراجع من الإدارة"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-surface-hover bg-surface px-4 py-3">
              <p className="text-xs font-black text-gray-500">تنسيق الطلب</p>
              <p className="mt-2 text-sm leading-7 text-gray-400">
                ابعت موعد التجهيز أو التوصيل المتوقع من هنا، والإدارة هتعتمده وتبلغه للعميل والمندوب.
              </p>
              {restaurantOrderSnapshot.restaurantName && (
                <p className="mt-2 text-xs font-black text-primary">
                  الطلب ظاهر عندك باسم المطعم: {restaurantOrderSnapshot.restaurantName}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <RestaurantEtaComposer order={order} onSaved={onSaved} />
          </div>

          <div className="mt-4">
            <p className="mb-3 text-sm font-black text-foreground">الأصناف المطلوبة من منيو المطعم</p>
            <div className="space-y-3">
              {order.order_items?.map((item) => {
                const unitPrice = Number(item.price_at_purchase || item.products?.price || 0);
                const quantity = Number(item.quantity || 1);
                return (
                  <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-surface-hover bg-surface px-3 py-3">
                    <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-surface-hover bg-background">
                      {item.products?.image_url ? (
                        <Image src={item.products.image_url} alt={item.products?.name || "منتج"} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-500">
                          <ChefHat className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-black leading-6 text-foreground">{item.products?.name || "منتج من المطعم"}</p>
                      {getSelectedVariantLabel(item.selected_variant_json) ? (
                        <p className="mt-1 text-[11px] font-bold text-primary">
                          {getSelectedVariantLabel(item.selected_variant_json)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-gray-500">
                        {quantity} × {unitPrice.toLocaleString("ar-EG")} ج.م
                      </p>
                    </div>
                    <p className="shrink-0 pt-1 text-sm font-black text-primary">
                      {(unitPrice * quantity).toLocaleString("ar-EG")} ج.م
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RestaurantPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [restaurant, setRestaurant] = React.useState<any>(null);
  const [orders, setOrders] = React.useState<RestaurantPortalOrder[]>([]);
  const [mobilePanelOpen, setMobilePanelOpen] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState<"active" | "closed">("active");
  const ordersRef = React.useRef<RestaurantPortalOrder[]>([]);
  const hasLoadedOnceRef = React.useRef(false);
  const restaurantIdRef = React.useRef<string>("");
  const refreshTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOrders = React.useCallback(async (options?: { withLoader?: boolean; notifyNewOrders?: boolean }) => {
    if (options?.withLoader !== false) {
      setLoading(true);
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/restaurant/login");
        return;
      }

      const payload = await fetchRestaurantManagerOrders();
      const nextRestaurant = payload.restaurant || null;
      const nextOrders = (payload.orders || []) as RestaurantPortalOrder[];
      const previousActiveIds = new Set(
        ordersRef.current
          .filter((order) => !["delivered", "cancelled"].includes(order.status))
          .map((order) => order.id)
      );
      const newActiveOrders = nextOrders.filter(
        (order) =>
          !["delivered", "cancelled"].includes(order.status) &&
          !previousActiveIds.has(order.id)
      );

      restaurantIdRef.current = String(nextRestaurant?.id || "");
      setRestaurant(nextRestaurant);
      setOrders(nextOrders);
      ordersRef.current = nextOrders;

      if (hasLoadedOnceRef.current && options?.notifyNewOrders && newActiveOrders.length > 0) {
        // The notification bell now owns the audible/visual notification.
      }

      hasLoadedOnceRef.current = true;
    } catch (error: any) {
      if (String(error?.message || "").includes("Unauthorized") || String(error?.message || "").includes("Forbidden")) {
        router.replace("/restaurant/login");
        return;
      }

      toast.error(error?.message || "مش قادرين نفتح طلبات المطعم دلوقتي");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const queueOrdersRefresh = React.useCallback((options?: { notifyNewOrders?: boolean }) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      void loadOrders({ withLoader: false, notifyNewOrders: options?.notifyNewOrders });
    }, 200);
  }, [loadOrders]);

  React.useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  React.useEffect(() => {
    let isCancelled = false;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || isCancelled) return;

      const channel = supabase
        .channel(`restaurant-orders-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
          },
          async (payload: any) => {
            const nextRestaurantId = String(payload.new?.shipping_address?.restaurant_id || "").trim();
            const previousRestaurantId = String(payload.old?.shipping_address?.restaurant_id || "").trim();
            const currentRestaurantId = restaurantIdRef.current;
            const affectsCurrentRestaurant =
              !!currentRestaurantId &&
              (nextRestaurantId === currentRestaurantId || previousRestaurantId === currentRestaurantId);

            if (!affectsCurrentRestaurant) return;
            queueOrdersRefresh({ notifyNewOrders: true });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "order_items",
          },
          async () => {
            if (!restaurantIdRef.current) return;
            queueOrdersRefresh({ notifyNewOrders: true });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = setupRealtime();

    return () => {
      isCancelled = true;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      void cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [loadOrders, queueOrdersRefresh]);

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/restaurant/login?logged_out=1";
  };

  const activeOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const closedOrders = orders.filter((order) => ["delivered", "cancelled"].includes(order.status));
  const visibleOrders = mobileTab === "active" ? activeOrders : closedOrders;
  const summaryCards = [
    {
      label: "إجمالي الطلبات",
      value: orders.length,
      accent: "text-primary",
      frame: "bg-primary/10 text-primary",
      icon: BellRing,
    },
    {
      label: "طلبات شغالة الآن",
      value: activeOrders.length,
      accent: "text-amber-400",
      frame: "bg-amber-400/10 text-amber-400",
      icon: Clock3,
    },
    {
      label: "طلبات مقفولة",
      value: closedOrders.length,
      accent: "text-emerald-400",
      frame: "bg-emerald-500/10 text-emerald-400",
      icon: PackageCheck,
    },
    {
      label: "حالة المطعم",
      value: restaurant?.is_available ? "متاح الآن" : "غير متاح الآن",
      accent: restaurant?.is_available ? "text-emerald-400" : "text-amber-400",
      frame: restaurant?.is_available ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-400/10 text-amber-400",
      icon: Store,
    },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-gray-500">ثانية واحدة بنجهز طلبات المطعم...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-3 pb-6 pt-4 sm:px-4 sm:pb-10 md:px-6">
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <div className="rounded-3xl border border-surface-hover bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-16 sm:w-16">
                <ChefHat className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-primary">بوابة المطعم</p>
                <h1 className="mt-1 text-xl font-black text-foreground sm:text-2xl">
                  {restaurant?.name || "مطعم في السكة"}
                </h1>
                <p className="mt-1 text-xs leading-6 text-gray-500 sm:text-sm">
                  الطلبات اللي جاية من موقع في السكة هتظهر لك هنا مباشرة.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 sm:hidden">
              <button
                type="button"
                onClick={() => setMobilePanelOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-surface-hover bg-background text-gray-300 transition-colors hover:border-primary hover:text-primary"
                title="فتح لوحة سريعة"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2">
                <RestaurantNotificationBell />
                <ThemeToggle />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400 transition-colors hover:bg-rose-500 hover:text-white"
                  title="تسجيل الخروج"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="hidden items-center justify-end gap-2 sm:flex">
              <RestaurantNotificationBell />
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400 transition-colors hover:bg-rose-500 hover:text-white"
                title="تسجيل الخروج"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 hidden grid-cols-2 gap-3 sm:grid">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-2xl border border-surface-hover bg-background/60 p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`rounded-2xl p-3 ${card.frame}`}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-[11px] font-black text-gray-500 sm:text-xs">{card.label}</p>
                  </div>
                  <p className={`mt-4 text-lg font-black sm:text-2xl ${card.accent}`}>{card.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        {mobilePanelOpen && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <button
              type="button"
              aria-label="إغلاق اللوحة السريعة"
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              onClick={() => setMobilePanelOpen(false)}
            />
            <div className="absolute inset-x-3 top-4 bottom-4 overflow-hidden rounded-[28px] border border-surface-hover bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-surface-hover px-4 py-4">
                <div>
                  <p className="text-sm font-black text-foreground">لوحة المطعم السريعة</p>
                  <p className="mt-1 text-[11px] text-gray-500">ملخص المطعم والإجراءات المهمة في مكان واحد.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobilePanelOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-surface-hover bg-background text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="h-full overflow-y-auto px-4 pb-6 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.label} className="rounded-2xl border border-surface-hover bg-background/60 p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className={`rounded-2xl p-3 ${card.frame}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <p className="text-[11px] font-black text-gray-500">{card.label}</p>
                        </div>
                        <p className={`mt-4 text-lg font-black ${card.accent}`}>{card.value}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-2xl border border-surface-hover bg-background/70 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMobilePanelOpen(false);
                      void loadOrders({ withLoader: false });
                    }}
                    className="w-full rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-sm font-black text-foreground"
                  >
                    تحديث الطلبات الآن
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-surface-hover bg-surface p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-foreground sm:text-xl">طلبات المطعم</h2>
            </div>
            <button
              type="button"
              onClick={() => loadOrders()}
              className="rounded-2xl border border-surface-hover bg-background px-4 py-2.5 text-sm font-bold text-gray-300 transition-colors hover:border-primary hover:text-primary sm:w-auto"
            >
              تحديث الآن
            </button>
          </div>

          <div className="sticky top-3 z-20 mb-5 rounded-[24px] border border-surface-hover bg-background/80 p-2 shadow-[0_12px_28px_rgba(0,0,0,0.16)] backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMobileTab("active")}
              className={`rounded-2xl px-3 py-3 text-sm font-black transition-colors ${
                mobileTab === "active"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-gray-400"
              }`}
            >
              الشغالة
              <span className="mr-2 text-[11px] opacity-80">{activeOrders.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("closed")}
              className={`rounded-2xl px-3 py-3 text-sm font-black transition-colors ${
                mobileTab === "closed"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-gray-400"
              }`}
            >
              المقفولة
              <span className="mr-2 text-[11px] opacity-80">{closedOrders.length}</span>
            </button>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-surface-hover bg-background/50 px-6 py-14 text-center">
              <PackageCheck className="mx-auto h-10 w-10 text-gray-600" />
              <p className="mt-4 text-base font-black text-foreground">لسه مفيش طلبات واصلة للمطعم</p>
              <p className="mt-2 text-sm leading-7 text-gray-500">
                أول ما عميل يطلب من منيو المطعم عندك، الطلب هيظهر هنا ومعاه بيانات العميل والمنتجات المطلوبة.
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              <section
                className={`space-y-4 rounded-[28px] border p-4 shadow-sm ${
                  mobileTab === "active"
                    ? "border-amber-400/15 bg-amber-400/[0.035]"
                    : "border-emerald-500/15 bg-emerald-500/[0.035]"
                }`}
              >
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                    mobileTab === "active"
                      ? "border-amber-400/20 bg-amber-400/10"
                      : "border-emerald-500/20 bg-emerald-500/10"
                  }`}
                >
                  <div>
                    <h3 className="text-base font-black text-foreground">
                      {mobileTab === "active" ? "الطلبات الشغالة" : "الطلبات المقفولة"}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {mobileTab === "active"
                        ? "دي الطلبات اللي محتاجة منك متابعة أو رد بوقت التوصيل."
                        : "الطلبات اللي اتسلمت أو اتلغت موجودة هنا للرجوع السريع."}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black ${
                      mobileTab === "active"
                        ? "border-amber-400/20 bg-amber-400/10 text-amber-400"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    {visibleOrders.length} طلب
                  </span>
                </div>

                {visibleOrders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-surface-hover bg-background/50 px-6 py-10 text-center text-sm text-gray-500">
                    {mobileTab === "active"
                      ? "مفيش طلبات شغالة حاليًا، أول ما طلب جديد يدخل هيظهر هنا فوق."
                      : "لسه ما عندكش طلبات مقفولة."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleOrders.map((order, index) => (
                      <RestaurantOrderCard
                        key={order.id}
                        order={order}
                        defaultExpanded={index === 0}
                        tone={mobileTab === "active" ? "active" : "closed"}
                        onSaved={(nextShippingAddress) => {
                          setOrders((prev) =>
                            prev.map((entry) =>
                              entry.id === order.id
                                ? { ...entry, shipping_address: nextShippingAddress }
                                : entry
                            )
                          );
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

    </main>
  );
}
