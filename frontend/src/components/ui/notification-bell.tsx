"use client"

import * as React from "react"
import { Bell, CheckCircle2, ChevronLeft } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
    AppNotification,
    NOTIFICATIONS_SYNC_EVENT,
    NotificationsSyncDetail,
    emitNotificationsSync,
    fetchUserNotifications,
    mergeNotificationIntoList,
} from "@/services/notificationsService"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

const DUPLICATE_NOTIFICATION_WINDOW_MS = 10000
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY || ""

type PushSetupState = "checking" | "enabled" | "prompt" | "blocked" | "unsupported" | "error"

function isDeliveryNotification(notification: AppNotification) {
    return notification.link === "/account" || notification.title.includes("توصيل") || notification.title.includes("طلبك")
}

function getNotificationFingerprint(notification: Pick<AppNotification, "title" | "message" | "link">) {
    return `${notification.title}__${notification.message}__${notification.link || ""}`
}

function dedupeNotifications(notifications: AppNotification[]) {
    const seenIds = new Set<string>()
    const seenFingerprints = new Map<string, number>()

    return notifications
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .filter((notification) => {
            if (seenIds.has(notification.id)) {
                return false
            }

            seenIds.add(notification.id)

            const fingerprint = getNotificationFingerprint(notification)
            const createdAt = new Date(notification.created_at).getTime()
            const lastSeenAt = seenFingerprints.get(fingerprint)

            if (
                typeof lastSeenAt === "number" &&
                Number.isFinite(createdAt) &&
                Math.abs(lastSeenAt - createdAt) <= DUPLICATE_NOTIFICATION_WINDOW_MS
            ) {
                return false
            }

            seenFingerprints.set(fingerprint, Number.isFinite(createdAt) ? createdAt : Date.now())
            return true
        })
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function NotificationBell() {
    const { user, session } = useAuth()
    const router = useRouter()
    const [notifications, setNotifications] = React.useState<AppNotification[]>([])
    const [isOpen, setIsOpen] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(true)
    const [pushSetupState, setPushSetupState] = React.useState<PushSetupState>("checking")
    const [isSubscribingPush, setIsSubscribingPush] = React.useState(false)
    const popoverRef = React.useRef<HTMLDivElement>(null)
    const seenNotificationIdsRef = React.useRef<Set<string>>(new Set())
    const recentFingerprintsRef = React.useRef<Map<string, number>>(new Map())
    const hasBootstrappedRef = React.useRef(false)

    const unreadCount = notifications.filter((notification) => !notification.is_read).length
    const previewNotifications = notifications.slice(0, 4)

    const playNotificationSound = React.useCallback(() => {
        try {
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
            audio.volume = 0.5
            audio.play().catch(() => {})
        } catch {
            // Ignore audio playback issues
        }
    }, [])

    const showNotificationToast = React.useCallback((notification: AppNotification) => {
        toast.custom((toastId) => (
            <div className="w-[min(92vw,420px)] overflow-hidden rounded-[32px] border border-white/5 bg-surface-container-low/95 shadow-[var(--shadow-premium)] backdrop-blur-3xl animate-fade-scale-in">
                <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-primary" />
                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            {isDeliveryNotification(notification) ? (
                                <CheckCircle2 className="h-5 w-5" />
                            ) : (
                                <Bell className="h-5 w-5" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-foreground">
                                {notification.title}
                            </p>
                            <p className="mt-1 text-xs leading-6 text-gray-500">
                                {notification.message}
                            </p>
                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        toast.dismiss(toastId)
                                        router.push(notification.link || "/notifications")
                                    }}
                                    className="rounded-2xl bg-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-primary/90"
                                >
                                    افتح الإشعار
                                </button>
                                <button
                                    onClick={() => toast.dismiss(toastId)}
                                    className="rounded-2xl bg-surface-hover px-3 py-2 text-xs font-bold text-gray-500 transition-colors hover:text-foreground"
                                >
                                    لاحقًا
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ), {
            id: `notification-${notification.id}`,
            duration: 7000,
            position: "top-center",
        })
    }, [router])

    const rememberNotification = React.useCallback((notification: AppNotification) => {
        seenNotificationIdsRef.current.add(notification.id)
        recentFingerprintsRef.current.set(
            getNotificationFingerprint(notification),
            Number.isFinite(new Date(notification.created_at).getTime()) ? new Date(notification.created_at).getTime() : Date.now()
        )
    }, [])

    const shouldIgnoreNotification = React.useCallback((notification: AppNotification) => {
        if (seenNotificationIdsRef.current.has(notification.id)) {
            return true
        }

        const fingerprint = getNotificationFingerprint(notification)
        const createdAt = new Date(notification.created_at).getTime()
        const comparableTime = Number.isFinite(createdAt) ? createdAt : Date.now()
        const lastSeenAt = recentFingerprintsRef.current.get(fingerprint)

        if (typeof lastSeenAt === "number" && Math.abs(lastSeenAt - comparableTime) <= DUPLICATE_NOTIFICATION_WINDOW_MS) {
            seenNotificationIdsRef.current.add(notification.id)
            return true
        }

        return false
    }, [])

    const syncNotifications = React.useCallback(async (announceNewNotifications: boolean) => {
        if (!user) return

        const data = await fetchUserNotifications(user.id, 50)
        const uniqueNotifications = dedupeNotifications(data)
        const incomingIds = new Set(uniqueNotifications.map((notification) => notification.id))
        const newNotifications = uniqueNotifications.filter((notification) => !seenNotificationIdsRef.current.has(notification.id))

        seenNotificationIdsRef.current = new Set()
        recentFingerprintsRef.current = new Map()
        uniqueNotifications.forEach(rememberNotification)
        setNotifications(uniqueNotifications)
        setIsLoading(false)

        if (announceNewNotifications && hasBootstrappedRef.current) {
            newNotifications
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .forEach((notification, index) => {
                    window.setTimeout(() => {
                        playNotificationSound()
                        showNotificationToast(notification)
                    }, index * 250)
                })
        }

        if (!hasBootstrappedRef.current) {
            hasBootstrappedRef.current = incomingIds.size >= 0
        }
    }, [playNotificationSound, rememberNotification, showNotificationToast, user])

    const loadNotifications = React.useCallback(async () => {
        await syncNotifications(false)
    }, [syncNotifications])

    const syncPushSubscription = React.useCallback(async (subscription: PushSubscription) => {
        if (!session?.access_token) {
            setPushSetupState("error")
            return false
        }

        const response = await fetch("/api/notifications/subscribe", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ subscription }),
        })

        if (!response.ok) {
            setPushSetupState("error")
            return false
        }

        setPushSetupState("enabled")
        return true
    }, [session?.access_token])

    const subscribeToPhoneNotifications = React.useCallback(async (interactive: boolean) => {
        if (typeof window === "undefined" || !user) return false
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !window.isSecureContext || !publicVapidKey) {
            setPushSetupState("unsupported")
            return false
        }

        setIsSubscribingPush(interactive)

        try {
            const currentPermission = Notification.permission
            if (currentPermission === "denied") {
                setPushSetupState("blocked")
                return false
            }

            const registration = await navigator.serviceWorker.ready
            const existingSubscription = await registration.pushManager.getSubscription()
            if (existingSubscription) {
                return await syncPushSubscription(existingSubscription)
            }

            if (currentPermission === "default" && !interactive) {
                setPushSetupState("prompt")
                return false
            }

            const permission = currentPermission === "granted"
                ? "granted"
                : await Notification.requestPermission()

            if (permission !== "granted") {
                setPushSetupState(permission === "denied" ? "blocked" : "prompt")
                return false
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
            })

            const success = await syncPushSubscription(subscription)
            if (success && interactive) {
                toast.success("تم تفعيل إشعارات الهاتف بنجاح")
            }
            return success
        } catch (error) {
            console.error("Customer push subscription error:", error)
            setPushSetupState("error")
            if (interactive) {
                toast.error("حصلت مشكلة أثناء تفعيل إشعارات الهاتف")
            }
            return false
        } finally {
            setIsSubscribingPush(false)
        }
    }, [syncPushSubscription, user])

    React.useEffect(() => {
        void loadNotifications()
    }, [loadNotifications])

    React.useEffect(() => {
        if (!user) return
        void subscribeToPhoneNotifications(false)
    }, [subscribeToPhoneNotifications, user])

    React.useEffect(() => {
        if (!user) return

        const poll = () => {
            void syncNotifications(true)
        }

        const interval = window.setInterval(poll, 5000)
        const onFocus = () => poll()
        const onVisible = () => {
            if (document.visibilityState === "visible") {
                poll()
            }
        }

        window.addEventListener("focus", onFocus)
        document.addEventListener("visibilitychange", onVisible)

        return () => {
            window.clearInterval(interval)
            window.removeEventListener("focus", onFocus)
            document.removeEventListener("visibilitychange", onVisible)
        }
    }, [syncNotifications, user])

    React.useEffect(() => {
        if (!user) return

        const channelId = `notifications-${user.id}`
        const channel = supabase
            .channel(channelId)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newNotification = payload.new as AppNotification
                    if (shouldIgnoreNotification(newNotification)) {
                        return
                    }

                    rememberNotification(newNotification)
                    setNotifications((prev) => mergeNotificationIntoList(prev, newNotification))
                    emitNotificationsSync({ type: "upsert", userId: user.id, notification: newNotification })
                    playNotificationSound()
                    showNotificationToast(newNotification)
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
                    const updatedNotification = payload.new as AppNotification
                    setNotifications((prev) =>
                        prev.map((item) => item.id === updatedNotification.id ? { ...item, ...updatedNotification } : item)
                    )
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const deletedNotificationId = String((payload.old as { id?: string })?.id || "")
                    if (!deletedNotificationId) return
                    setNotifications((prev) => prev.filter((item) => item.id !== deletedNotificationId))
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [playNotificationSound, rememberNotification, shouldIgnoreNotification, showNotificationToast, user])

    React.useEffect(() => {
        if (!user) return

        const handleSync = (event: Event) => {
            const detail = (event as CustomEvent<NotificationsSyncDetail>).detail
            if (!detail || detail.userId !== user.id) return

            setNotifications((prev) => {
                switch (detail.type) {
                    case "mark-read":
                        return prev.map((item) => item.id === detail.notificationId ? { ...item, is_read: true } : item)
                    case "mark-all-read":
                        return prev.map((item) => ({ ...item, is_read: true }))
                    case "delete-one":
                        return prev.filter((item) => item.id !== detail.notificationId)
                    case "delete-all":
                        return []
                    case "upsert":
                        return mergeNotificationIntoList(prev, detail.notification)
                    default:
                        return prev
                }
            })
        }

        window.addEventListener(NOTIFICATIONS_SYNC_EVENT, handleSync as EventListener)
        return () => window.removeEventListener(NOTIFICATIONS_SYNC_EVENT, handleSync as EventListener)
    }, [user])

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [isOpen])

    const openNotification = (notification: AppNotification) => {
        setIsOpen(false)
        router.push(notification.link || "/notifications")
    }

    if (!user) return null

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="relative text-gray-500 hover:text-foreground bg-surface-hover/50 hover:bg-surface-hover w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95"
                aria-label="الإشعارات"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-background">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="fixed left-3 right-3 top-[84px] z-50 flex max-h-[78vh] w-auto flex-col overflow-hidden rounded-[28px] border border-white/5 bg-surface-container-low/95 backdrop-blur-2xl shadow-[var(--shadow-premium)] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 animate-fade-scale-in">
                    <div className="border-b border-surface-hover bg-surface-lighter/50 px-4 py-3">
                        <h3 className="font-heading font-black text-foreground">الإشعارات</h3>
                        <p className="mt-1 text-[11px] text-gray-500">أحدث 4 إشعارات فقط</p>
                    </div>

                    <div className="border-b border-surface-hover/70 p-3">
                        {pushSetupState === "enabled" ? (
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5">
                                <div>
                                    <p className="text-sm font-black text-foreground">إشعارات الهاتف</p>
                                    <p className="mt-0.5 text-[11px] text-gray-500">مفعلة وتمام</p>
                                </div>
                                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-600">
                                    مفعلة
                                </span>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-foreground">إشعارات الهاتف</p>
                                        <p className="mt-1 text-xs leading-6 text-gray-500">
                                            فعّلها علشان لما نلاقي طلبك أو يحصل تحديث مهم، الإشعار ينزل على الجهاز حتى لو الموقع مقفول.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => void subscribeToPhoneNotifications(true)}
                                        disabled={isSubscribingPush || pushSetupState === "unsupported"}
                                        className="shrink-0 rounded-2xl bg-primary px-3 py-2 text-xs font-black text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                                    >
                                        {isSubscribingPush ? "جارٍ التفعيل..." : "فعّلها"}
                                    </button>
                                </div>
                                {pushSetupState === "blocked" && (
                                    <p className="mt-3 text-[11px] leading-5 text-rose-400">
                                        المتصفح قافل الإشعارات حاليًا. اسمح بها من إعدادات الموقع ثم جرّب مرة ثانية.
                                    </p>
                                )}
                                {pushSetupState === "unsupported" && (
                                    <p className="mt-3 text-[11px] leading-5 text-amber-500">
                                        الجهاز أو المتصفح الحالي لا يدعم Web Push بالطريقة المطلوبة.
                                    </p>
                                )}
                                {pushSetupState === "error" && (
                                    <p className="mt-3 text-[11px] leading-5 text-rose-400">
                                        حصلت مشكلة أثناء ربط الجهاز بالإشعارات. حاول تاني من الزر.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="min-h-0 max-h-[42vh] flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-8 text-center text-gray-500">جاري التحميل...</div>
                        ) : previewNotifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="mx-auto mb-3 h-6 w-6 text-gray-400" />
                                <p className="text-sm font-bold text-gray-500">لا توجد إشعارات جديدة</p>
                            </div>
                        ) : (
                            previewNotifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    onClick={() => openNotification(notification)}
                                    className={`block w-full border-b border-surface-hover/50 px-4 py-3 text-start transition-colors hover:bg-surface-hover ${!notification.is_read ? "bg-primary/5" : ""}`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex items-center gap-2">
                                            {!notification.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                                            <p className="truncate text-sm font-bold text-foreground">{notification.title}</p>
                                        </div>
                                        <span className="shrink-0 text-[10px] text-gray-400">
                                            {new Date(notification.created_at).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                                        </span>
                                    </div>
                                    <p className="mt-1 pe-4 text-xs leading-6 text-gray-500 line-clamp-2">
                                        {notification.message}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="border-t border-surface-hover bg-background/70 p-3">
                        <button
                            onClick={() => {
                                setIsOpen(false)
                                router.push("/notifications")
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/15"
                        >
                            فتح كل الإشعارات
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
