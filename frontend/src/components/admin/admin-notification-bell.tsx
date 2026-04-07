"use client";

import * as React from "react";
import { Bell, CheckCircle2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AppNotification,
  deleteAllNotifications,
  emitNotificationsSync,
  fetchUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  mergeNotificationIntoList,
} from "@/services/notificationsService";
import { supabase } from "@/lib/supabase";
import { showInstantDeviceNotification } from "@/lib/device-notifications";

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY || "";

type PushSetupState = "checking" | "enabled" | "prompt" | "blocked" | "unsupported" | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function AdminNotificationBell() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pushSetupState, setPushSetupState] = React.useState<PushSetupState>("checking");
  const [isSubscribingPush, setIsSubscribingPush] = React.useState(false);
  const [isClearingNotifications, setIsClearingNotifications] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const playNotificationSound = React.useCallback(() => {
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  const syncPushSubscription = React.useCallback(
    async (subscription: PushSubscription) => {
      if (!session?.access_token) {
        setPushSetupState("error");
        return false;
      }

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ subscription }),
      });

      if (!response.ok) {
        setPushSetupState("error");
        return false;
      }

      setPushSetupState("enabled");
      return true;
    },
    [session?.access_token]
  );

  const subscribeToPhoneNotifications = React.useCallback(
    async (interactive: boolean) => {
      if (typeof window === "undefined" || !user) return false;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !window.isSecureContext || !publicVapidKey) {
        setPushSetupState("unsupported");
        return false;
      }

      setIsSubscribingPush(interactive);

      try {
        const currentPermission = Notification.permission;
        if (currentPermission === "denied") {
          setPushSetupState("blocked");
          return false;
        }

        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          return await syncPushSubscription(existingSubscription);
        }

        if (currentPermission === "default" && !interactive) {
          setPushSetupState("prompt");
          return false;
        }

        const permission = currentPermission === "granted" ? "granted" : await Notification.requestPermission();
        if (permission !== "granted") {
          setPushSetupState(permission === "denied" ? "blocked" : "prompt");
          return false;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        });

        const success = await syncPushSubscription(subscription);
        if (success && interactive) {
          toast.success("تم تفعيل إشعارات لوحة التحكم");
        }
        return success;
      } catch (error) {
        console.error("Admin push subscription error:", error);
        setPushSetupState("error");
        if (interactive) toast.error("حصلت مشكلة أثناء تفعيل إشعارات لوحة التحكم");
        return false;
      } finally {
        setIsSubscribingPush(false);
      }
    },
    [syncPushSubscription, user]
  );

  const loadNotifications = React.useCallback(async () => {
    if (!user) return;
    const data = await fetchUserNotifications(user.id, 30);
    setNotifications(data);
    setIsLoading(false);
  }, [user]);

  React.useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  React.useEffect(() => {
    if (!user) return;
    void subscribeToPhoneNotifications(false);
  }, [subscribeToPhoneNotifications, user]);

  React.useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`admin-dashboard-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as AppNotification;
          setNotifications((prev) => mergeNotificationIntoList(prev, notification));
          playNotificationSound();
          void showInstantDeviceNotification({
            title: notification.title,
            body: notification.message,
            url: notification.link || "/admin/orders",
            tag: `${notification.link || "/admin/orders"}::${notification.title}`,
          });
          toast.success(notification.title, {
            description: notification.message,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification;
          setNotifications((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playNotificationSound, user]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      if (user && unreadCount > 0) {
        void markAllNotificationsAsRead(user.id);
        setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      }
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, unreadCount, user]);

  const openNotification = async (notification: AppNotification) => {
    if (user && !notification.is_read) {
      await markNotificationAsRead(notification.id, user.id);
      setNotifications((prev) => prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)));
    }
    setIsOpen(false);
    router.push(notification.link || "/admin/orders");
  };

  const clearAllNotifications = async () => {
    if (!user || notifications.length === 0 || isClearingNotifications) return;

    setIsClearingNotifications(true);
    const previous = notifications;
    setNotifications([]);
    emitNotificationsSync({ type: "delete-all", userId: user.id });

    const ok = await deleteAllNotifications(user.id);
    if (ok) {
      toast.success("تم مسح كل الإشعارات");
    } else {
      setNotifications(previous);
      for (const notification of previous) {
        emitNotificationsSync({ type: "upsert", userId: user.id, notification });
      }
      toast.error("مش قادرين نمسح الإشعارات دلوقتي");
    }

    setIsClearingNotifications(false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-xl p-2 text-gray-400 transition-colors hover:bg-surface-hover hover:text-foreground"
        aria-label="إشعارات لوحة التحكم"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-surface-hover bg-surface shadow-2xl">
          <div className="border-b border-surface-hover px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-foreground">إشعارات لوحة التحكم</h3>
                <p className="mt-1 text-[11px] text-gray-500">طلبات جديدة وتحديثات التسليم المهمة</p>
              </div>
              {notifications.length > 0 && (
                <button
                  onClick={() => void clearAllNotifications()}
                  disabled={isClearingNotifications}
                  className="shrink-0 rounded-xl border border-surface-hover bg-surface-hover px-3 py-1.5 text-[11px] font-bold text-gray-400 transition-colors hover:text-foreground hover:bg-background disabled:opacity-60"
                >
                  {isClearingNotifications ? "جارٍ المسح..." : "مسح الكل"}
                </button>
              )}
            </div>
          </div>

          <div className="border-b border-surface-hover/70 p-2.5 md:hidden">
            {pushSetupState === "enabled" ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                <div>
                  <p className="text-xs font-black text-foreground">إشعارات الهاتف</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">مفعلة وتوصلك حتى لو اللوحة مقفولة</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-500">
                  مفعلة
                </span>
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-foreground">فعّل إشعارات الهاتف</p>
                    <p className="mt-1 text-[10px] leading-5 text-gray-500">
                      علشان أول ما يدخل طلب جديد أو يوصل طلب، الإشعار يوصلك فورًا على الجهاز.
                    </p>
                  </div>
                  <button
                    onClick={() => void subscribeToPhoneNotifications(true)}
                    disabled={isSubscribingPush || pushSetupState === "unsupported"}
                    className="shrink-0 rounded-2xl bg-primary px-3 py-2 text-[11px] font-black text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {isSubscribingPush ? "جارٍ التفعيل..." : "فعّلها"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">جاري التحميل...</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-gray-600">
                <CheckCircle2 className="h-8 w-8 opacity-30" />
                <p className="text-xs">لا توجد إشعارات بعد</p>
                <p className="text-[10px] text-gray-700">أول ما يدخل طلب جديد أو يتم تسليم طلب هتلاقيه هنا.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => void openNotification(notification)}
                  className={`flex w-full items-start gap-3 border-b border-surface-hover px-4 py-3 text-start transition-colors hover:bg-surface-hover ${
                    !notification.is_read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-primary">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground">{notification.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-400">{notification.message}</p>
                    <p className="mt-1 text-[10px] text-gray-600">
                      {new Date(notification.created_at).toLocaleString("ar-EG")}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-surface-hover bg-background/70 p-3">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/admin/orders");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/15"
            >
              افتح لوحة الطلبات
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
