"use client";

import * as React from "react";
import { Bell, CheckCircle2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AppNotification,
  emitNotificationsSync,
  mergeNotificationIntoList,
} from "@/services/notificationsService";
import { showInstantDeviceNotification } from "@/lib/device-notifications";

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY || "";

type PushSetupState = "checking" | "enabled" | "prompt" | "blocked" | "unsupported" | "error";
type AdminNotificationsResponse = { notifications?: AppNotification[]; error?: string };

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function normalizeRealtimeNotification(raw: Record<string, unknown>, fallbackUserId: string): AppNotification {
  const payload = (raw.payload as Record<string, unknown> | null) || null;
  const tripId = String(raw.related_trip_id || payload?.trip_id || "").trim();
  const ticketId = String(payload?.ticket_id || "").trim();
  const derivedLink =
    String(raw.link || payload?.link || payload?.url || "").trim() ||
    (tripId ? `/admin/trips/${tripId}` : ticketId ? `/admin/support/${ticketId}` : "/admin/notifications");

  return {
    id: String(raw.id || ""),
    user_id: String(raw.recipient_user_id || raw.user_id || fallbackUserId),
    title: String(raw.title || "إشعار جديد"),
    message: String(raw.body || raw.message || ""),
    link: derivedLink,
    is_read: Boolean(raw.is_read),
    created_at: String(raw.created_at || new Date().toISOString()),
    type: typeof raw.type === "string" ? raw.type : undefined,
    payload,
    related_trip_id: tripId || null,
  };
}

export function AdminNotificationBell() {
  const { user, profile, session } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pushSetupState, setPushSetupState] = React.useState<PushSetupState>("checking");
  const [isSubscribingPush, setIsSubscribingPush] = React.useState(false);
  const [isClearingNotifications, setIsClearingNotifications] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const knownNotificationIdsRef = React.useRef<Set<string>>(new Set());
  const hasCompletedInitialLoadRef = React.useRef(false);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const recipientId = user?.id || profile?.id || "admin-session";

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const ensureAudioContext = React.useCallback(async () => {
    if (typeof window === "undefined") return null;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    if (audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
      } catch {
        return null;
      }
    }

    return audioContextRef.current;
  }, []);

  const playNotificationSound = React.useCallback(() => {
    void ensureAudioContext().then((context) => {
      if (!context) return;

      const now = context.currentTime;
      const sequence = [
        { at: 0, frequency: 880, duration: 0.11 },
        { at: 0.16, frequency: 1175, duration: 0.14 },
      ];

      for (const tone of sequence) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, now + tone.at);

        gain.gain.setValueAtTime(0.0001, now + tone.at);
        gain.gain.exponentialRampToValueAtTime(0.12, now + tone.at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.at + tone.duration);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + tone.at);
        oscillator.stop(now + tone.at + tone.duration);
      }
    });
  }, [ensureAudioContext]);

  const fetchAdminNotifications = React.useCallback(async (limit = 30): Promise<AppNotification[]> => {
    const response = await fetch(`/api/admin/platform/notifications?limit=${limit}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`notifications_fetch_failed_${response.status}`);
    }

    const payload = (await response.json()) as AdminNotificationsResponse;
    return Array.isArray(payload.notifications) ? payload.notifications : [];
  }, []);

  const markAllAdminNotificationsAsRead = React.useCallback(async () => {
    const response = await fetch("/api/admin/platform/notifications", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "mark_all_read" }),
    });

    return response.ok;
  }, []);

  const markAdminNotificationAsRead = React.useCallback(async (notificationId: string) => {
    const response = await fetch(`/api/admin/platform/notifications/${notificationId}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "mark_read" }),
    });

    return response.ok;
  }, []);

  const deleteAllAdminNotifications = React.useCallback(async () => {
    const response = await fetch("/api/admin/platform/notifications", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "delete_all" }),
    });

    return response.ok;
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
      if (typeof window === "undefined") return false;
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
    [syncPushSubscription]
  );

  const surfaceIncomingNotifications = React.useCallback((items: AppNotification[]) => {
    if (!items.length) return;
    playNotificationSound();
    for (const notification of items.slice(0, 3)) {
      void showInstantDeviceNotification({
        title: notification.title,
        body: notification.message,
        url: notification.link || "/admin/notifications",
        tag: `${notification.link || "/admin/notifications"}::${notification.title}`,
      });
      toast.success(notification.title, {
        description: notification.message,
      });
    }
  }, [playNotificationSound]);

  const loadNotifications = React.useCallback(async () => {
    try {
      const data = await fetchAdminNotifications(30);
      const previousIds = knownNotificationIdsRef.current;
      const incoming = data.filter((item) => !previousIds.has(item.id));
      knownNotificationIdsRef.current = new Set(data.map((item) => item.id));
      setNotifications(data);
      if (hasCompletedInitialLoadRef.current && incoming.length > 0) {
        surfaceIncomingNotifications(incoming);
      }
      hasCompletedInitialLoadRef.current = true;
    } catch (error) {
      console.error("Admin bell: loadNotifications failed", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchAdminNotifications, surfaceIncomingNotifications]);

  React.useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  React.useEffect(() => {
    const activateAudio = () => {
      void ensureAudioContext();
    };
    window.addEventListener("pointerdown", activateAudio, { once: true });
    window.addEventListener("keydown", activateAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", activateAudio);
      window.removeEventListener("keydown", activateAudio);
    };
  }, [ensureAudioContext]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  React.useEffect(() => {
    void subscribeToPhoneNotifications(false);
  }, [subscribeToPhoneNotifications]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      if (unreadCount > 0) {
        void markAllAdminNotificationsAsRead();
        setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      }
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, unreadCount, markAllAdminNotificationsAsRead]);

  const openNotification = async (notification: AppNotification) => {
    if (!notification.is_read) {
      await markAdminNotificationAsRead(notification.id);
      setNotifications((prev) => prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)));
    }
    setIsOpen(false);
    router.push(notification.link || "/admin/notifications");
  };

  const clearAllNotifications = async () => {
    if (notifications.length === 0 || isClearingNotifications) return;

    setIsClearingNotifications(true);
    const previous = notifications;
    setNotifications([]);
    emitNotificationsSync({ type: "delete-all", userId: recipientId });

    const ok = await deleteAllAdminNotifications();
    if (ok) {
      toast.success("تم مسح كل الإشعارات");
    } else {
      setNotifications(previous);
      for (const notification of previous) {
        emitNotificationsSync({ type: "upsert", userId: recipientId, notification });
      }
      toast.error("مش قادرين نمسح الإشعارات دلوقتي");
    }

    setIsClearingNotifications(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-xl p-2 text-white/80 transition-colors hover:bg-surface-hover hover:text-white disabled:cursor-default disabled:opacity-70"
        aria-label="إشعارات لوحة التحكم"
      >
        <Bell className="h-5 w-5" />
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
                <p className="mt-1 text-[11px] text-gray-500">طلبات جديدة، تأكيدات سعر، وتعيين الكباتن</p>
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
                      علشان أول ما يدخل طلب جديد أو العميل يؤكد السعر، الإشعار يوصلك فورًا على الجهاز.
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
                <p className="text-[10px] text-gray-700">هتلاقي هنا الطلبات الجديدة وتأكيدات السعر وكل ما يحتاج تدخل سريع.</p>
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
                router.push("/admin/notifications");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/15"
            >
              افتح كل الإشعارات
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
