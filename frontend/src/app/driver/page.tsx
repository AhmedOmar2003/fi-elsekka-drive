"use client"

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MapPin, Phone, Package, Navigation, CheckCircle2, Loader2, ChevronDown, ChevronUp, Bell, BellOff, X, AlertCircle, Coffee, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { RequestAttachmentsGallery } from '@/components/orders/request-attachments-gallery'
import { getRestaurantOrderSnapshot } from '@/lib/restaurant-order'
import { formatDeliveryAddressLines } from '@/lib/delivery-location'
import { showInstantDeviceNotification } from '@/lib/device-notifications'

// Helper for VAPID key conversion
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface DriverOrder {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    shipping_address: any;
    order_items?: any[];
    users?: { full_name: string; phone: string; };
}

// --- Minimal sound using Web Audio API (no external file needed) ---
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(880, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
        g.gain.setValueAtTime(0.4, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.6);
    } catch (e) {
        // Silently fail if audio is blocked
    }
}

function OrderCard({ order, onMarkDelivered, onMarkPickedUp, isUpdating }: {
    order: DriverOrder;
    onMarkDelivered: (id: string) => void;
    onMarkPickedUp: (id: string) => void;
    isUpdating: boolean;
}) {
    const [expanded, setExpanded] = useState(false)
    const isDelivered = order.status === 'delivered'
    const isShipped = order.status === 'shipped'
    const isProcessing = order.status === 'processing' || order.status === 'pending'

    const customerName = order.users?.full_name || 'غير معروف'
    const phone = order.shipping_address?.phone || order.users?.phone || 'لا يوجد رقم'
    const deliveryAddress = formatDeliveryAddressLines(order.shipping_address)
    const address = [
        deliveryAddress.zone,
        deliveryAddress.secondary,
        deliveryAddress.street
    ].filter(Boolean).join('، ')
    const driverInstruction = order.shipping_address?.driver_delivery_note?.trim()
    const isTextRequestOrder = order.shipping_address?.request_mode === 'custom_category_text'
    const restaurantOrder = getRestaurantOrderSnapshot(order.shipping_address)
    const textRequest = order.shipping_address?.custom_request_text
    const textRequestCategory = order.shipping_address?.custom_request_category_name
    const textRequestImageUrls = Array.isArray(order.shipping_address?.custom_request_image_urls) ? order.shipping_address.custom_request_image_urls : []
    const pricingPending = order.shipping_address?.pricing_pending === true

    return (
        <div className={`rounded-2xl border overflow-hidden transition-all ${isDelivered
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-surface border-surface-hover shadow-sm'
        }`}>
            {/* Header row - always visible */}
            <button
                type="button"
                onClick={(event) => {
                    event.preventDefault()
                    setExpanded(v => !v)
                }}
                className="w-full flex items-center justify-between gap-3 p-4 text-right"
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDelivered ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                        {isDelivered ? <CheckCircle2 className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                    </div>
                    <div className="text-right min-w-0">
                        <p className={`text-xs font-mono mb-0.5 ${isDelivered ? 'text-emerald-500/70' : 'text-gray-500'}`}>
                            طلب #{order.id.slice(0, 6)}
                        </p>
                        <p className={`font-black text-sm truncate ${isDelivered ? 'text-emerald-600' : 'text-foreground'}`}>
                            {customerName}
                        </p>
                        {restaurantOrder.isRestaurantOrder && (
                            <p className="mt-1 text-[11px] font-bold text-primary truncate">
                                من مطعم: {restaurantOrder.restaurantName || 'مطعم من في السكة'}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${isDelivered
                        ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20'
                        : isShipped
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                            : 'bg-amber-400/10 text-amber-500 border-amber-400/20'
                    }`}>
                        {isDelivered ? 'تم التوصيل ✓' : isShipped ? 'في الطريق للعميل' : 'لسه بيستلم الطلب'}
                    </span>
                    {expanded
                        ? <ChevronUp className="w-5 h-5 text-gray-400" />
                        : <ChevronDown className="w-5 h-5 text-gray-400" />
                    }
                </div>
            </button>

            {/* Expanded body */}
            {expanded && (
                <div className="border-t border-surface-hover p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {restaurantOrder.isRestaurantOrder && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                            <p className="text-xs font-black text-primary/80">طلب مطعم</p>
                            <p className="text-sm font-black text-foreground">
                                استلامك هيكون من مطعم: {restaurantOrder.restaurantName || 'مطعم من في السكة'}
                            </p>
                        </div>
                    )}

                    <div className="flex items-start gap-3">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-xs text-gray-500 mb-1">رقم الهاتف</p>
                            <div className="flex items-center justify-between bg-background border border-surface-hover px-3 py-2 rounded-xl">
                                <p className="font-mono text-sm font-bold tracking-wider" dir="ltr">{phone}</p>
                                <a href={`tel:${phone}`} className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
                                    اتصال 📞
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs text-gray-500 mb-1">العنوان</p>
                            <p className="font-bold text-sm text-foreground leading-relaxed">{address || 'لا يوجد عنوان'}</p>
                            {order.shipping_address?.notes && (
                                <p className="text-xs mt-1.5 p-2 bg-amber-400/5 border border-amber-400/20 rounded-lg text-amber-600 font-medium">
                                    📝 {order.shipping_address.notes}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-surface-hover">
                        <span className="text-xs text-gray-500">إجمالي الطلب</span>
                        <span className="font-black text-primary text-lg">{pricingPending ? 'بانتظار تسعير الإدارة' : `${order.total_amount?.toLocaleString() || 0} ج.م`}</span>
                    </div>

                    {isTextRequestOrder && (textRequest || textRequestImageUrls.length > 0) && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                            <p className="text-xs font-black text-primary/80">
                                {textRequestCategory ? `طلب ${textRequestCategory} النصي` : 'طلب نصي'}
                            </p>
                            <p className="text-sm leading-7 text-foreground whitespace-pre-wrap">
                                {textRequest?.trim() || 'هذا الطلب يعتمد على الصور المرفقة فقط بدون نص إضافي.'}
                            </p>
                            <p className="text-xs text-gray-500">هذا هو النص الذي كتبه العميل، فنفّذه كما هو أو تواصل مع الإدارة لو احتجت توضيحًا.</p>
                            <RequestAttachmentsGallery
                                imageUrls={textRequestImageUrls}
                                title="صور الطلب المرفقة"
                                hint="افتح الصورة في نافذة جديدة لو احتجت تكبير الروشتة أو قراءة الاسم بوضوح."
                                compact
                            />
                        </div>
                    )}

                    {isTextRequestOrder && !isDelivered && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                            <p className="text-xs font-black text-emerald-500/80">التسعيرة المعتمدة</p>
                            {pricingPending ? (
                                <p className="text-xs leading-6 text-gray-500">
                                    الإدارة ما زالت تراجع سعر هذا الطلب. بعد اعتماد العميل للتسعيرة سيصلك الطلب بالمبلغ النهائي الواجب الالتزام به.
                                </p>
                            ) : (
                                <div className="rounded-xl bg-background/70 px-3 py-3 text-sm">
                                    <p className="text-gray-500">التسعيرة التي وافق عليها العميل:</p>
                                    <p className="mt-1 font-black text-foreground">
                                        {Number(order.shipping_address?.quoted_final_total || order.total_amount || 0).toLocaleString()} ج.م
                                        <span className="mr-2 text-xs font-medium text-gray-500">(شامل 20 ج.م توصيل)</span>
                                    </p>
                                    <p className="mt-2 text-xs text-gray-500">التزم بهذه التسعيرة عند تنفيذ الطلب وتسليمه للعميل.</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1">
                        <p className="text-xs font-bold text-primary/80">تعليمات الإدارة ليك</p>
                        {driverInstruction ? (
                            <p className="text-sm font-black leading-7 text-foreground">{driverInstruction}</p>
                        ) : (
                            <p className="text-xs leading-6 text-gray-500">بانتظار الإدارة لتكتب لك تعليمات التوصيل الخاصة بك.</p>
                        )}
                    </div>

                    {!isDelivered && isProcessing && (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                onMarkPickedUp(order.id)
                            }}
                            disabled={isUpdating}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                        >
                            {isUpdating
                                ? <Loader2 className="w-5 h-5 animate-spin" />
                                : <><Truck className="w-5 h-5" /> استلمت الطلب من المحل ورايح للعميل</>
                            }
                        </button>
                    )}

                    {!isDelivered && isShipped && (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                onMarkDelivered(order.id)
                            }}
                            disabled={isUpdating}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                        >
                            {isUpdating
                                ? <Loader2 className="w-5 h-5 animate-spin" />
                                : <><CheckCircle2 className="w-5 h-5" /> تم التوصيل خلاص</>
                            }
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default function DriverDashboard() {
    const router = useRouter()
    const [activeOrders, setActiveOrders] = useState<DriverOrder[]>([])
    const [deliveredOrders, setDeliveredOrders] = useState<DriverOrder[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [driverUser, setDriverUser] = useState<any>(null)
    const [notificationsAllowed, setNotificationsAllowed] = useState(true)
    const [pushStatus, setPushStatus] = useState<NotificationPermission | 'prompt' | 'unsupported'>('prompt')
    const [isSubscribing, setIsSubscribing] = useState(false)
    const [actionLoadingOrder, setActionLoadingOrder] = useState<string | null>(null) // ID of order currently accepting/rejecting
    const [showAvailabilityPrompt, setShowAvailabilityPrompt] = useState(false)
    const [isSettingAvailability, setIsSettingAvailability] = useState(false)
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null) // null = not loaded yet
    const activeOrdersRef = useRef<DriverOrder[]>([])
    const notificationsAllowedRef = useRef(true)
    const knownOrderIds = useRef<Set<string>>(new Set())
    const isFirstLoad = useRef(true)
    const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY

    const fetchOrders = useCallback(async (session: any, userId: string) => {
        try {
            const res = await fetch(`/api/driver/orders?driverId=${userId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })
            if (!res.ok) throw new Error('Failed to fetch orders')
            const data = await res.json()
            return {
                activeOrders: (data.orders || []) as DriverOrder[],
                deliveredOrders: (data.deliveredOrders || []) as DriverOrder[],
            }
        } catch (err) {
            console.error('Driver fetch error:', err)
            return {
                activeOrders: [],
                deliveredOrders: [],
            }
        }
    }, [])

    const initializeDriver = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            
            // Fetch driver profile to get is_available
            const { data: profile } = await supabase
                .from('users')
                .select('is_available')
                .eq('id', session.user.id)
                .single()
            
            if (profile) {
                setIsAvailable(profile.is_available !== false) // default to true if null
            }
        } catch (err) {
            console.error('Driver profile fetch error:', err)
        }
    }, [])

    useEffect(() => {
        activeOrdersRef.current = activeOrders
    }, [activeOrders])

    useEffect(() => {
        notificationsAllowedRef.current = notificationsAllowed
    }, [notificationsAllowed])

    const refreshDriverOrders = useCallback(async (
        session: any,
        userId: string,
        options?: { notifyNewOrders?: boolean; withLoader?: boolean }
    ) => {
        const notifyNewOrders = options?.notifyNewOrders === true
        if (options?.withLoader) {
            setIsLoading(true)
        }

        const { activeOrders: nextActiveOrders, deliveredOrders: nextDeliveredOrders } = await fetchOrders(session, userId)

        const previousActiveIds = new Set(activeOrdersRef.current.map((order) => order.id))
        const newPendingOrders = nextActiveOrders.filter(
            (order) =>
                !previousActiveIds.has(order.id) &&
                order.shipping_address?.driver?.acceptance_status === 'pending'
        )

        nextActiveOrders.forEach((order) => knownOrderIds.current.add(order.id))

        setActiveOrders(nextActiveOrders)
        setDeliveredOrders(nextDeliveredOrders)

        if (!isFirstLoad.current && notifyNewOrders && newPendingOrders.length > 0) {
            const primaryPendingOrder = newPendingOrders[0]
            const restaurantOrder = getRestaurantOrderSnapshot(primaryPendingOrder.shipping_address)
            if (notificationsAllowedRef.current) {
                playNotificationSound()
            }
            void showInstantDeviceNotification({
                title: restaurantOrder.isRestaurantOrder
                    ? `طلب جديد من مطعم ${restaurantOrder.restaurantName || 'من في السكة'}`
                    : 'طلب جديد بانتظارك',
                body: restaurantOrder.isRestaurantOrder
                    ? 'فيه طلب مطعم جديد وصل لك الآن من الإدارة. افتحه وشوف التفاصيل بسرعة.'
                    : 'الإدارة بعتت لك طلب جديد الآن. افتحه وشوف التفاصيل بسرعة.',
                url: `/driver?order=${primaryPendingOrder.id}`,
                tag: `/driver?order=${primaryPendingOrder.id}::driver-assignment`,
            })
            toast(
                restaurantOrder.isRestaurantOrder
                    ? `🛵 طلب جديد من مطعم ${restaurantOrder.restaurantName || 'من في السكة'} بانتظارك!`
                    : '🛵 طلب جديد بانتظارك من الإدارة!',
                { duration: 6000 }
            )
        }

        activeOrdersRef.current = nextActiveOrders
        setIsLoading(false)
    }, [fetchOrders])

    useEffect(() => {
        const init = async () => {
            setIsLoading(true)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/driver/login'); return; }
            const user = session.user

            // Check role from auth metadata first, then fall back to public.users table
            // (for backward compatibility with accounts created before metadata fix)
            let isDriver = user.user_metadata?.role === 'driver'
            if (!isDriver) {
                const { data: publicUser } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', user.id)
                    .single()
                isDriver = publicUser?.role === 'driver'
            }

            if (!isDriver) { router.push('/account'); return; }
            setDriverUser(user)

            initializeDriver()
            await refreshDriverOrders(session, user.id, { withLoader: false })
            isFirstLoad.current = false

            // Real-time subscription for new/updated orders
            const channel = supabase
                .channel(`driver-orders-${user.id}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'orders'
                }, async (payload: any) => {
                    const nextDriverId = payload.new?.shipping_address?.driver?.id
                    const previousDriverId = payload.old?.shipping_address?.driver?.id
                    const affectsThisDriver = nextDriverId === user.id || previousDriverId === user.id

                    if (!affectsThisDriver) return

                    const { data: { session: liveSession } } = await supabase.auth.getSession()
                    if (liveSession) {
                        await refreshDriverOrders(liveSession, user.id, { notifyNewOrders: true, withLoader: false })
                    }
                })
                .on('broadcast', { event: 'new-assignment' }, async () => {
                    const { data: { session: liveSession } } = await supabase.auth.getSession()
                    if (liveSession) {
                        await refreshDriverOrders(liveSession, user.id, { notifyNewOrders: true, withLoader: false })
                    }
                })
                .subscribe()

            return () => { supabase.removeChannel(channel) }
        }
        init()

        // Check Push Notification status
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setPushStatus(Notification.permission)
        } else {
            setPushStatus('unsupported')
        }
    }, [initializeDriver, refreshDriverOrders, router])

    const syncDriverPushSubscription = useCallback(async (subscription: PushSubscription) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            throw new Error('جلسة المندوب خلصت، سجل دخول تاني')
        }

        const res = await fetch('/api/driver/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ subscription })
        })

        if (!res.ok) {
            const payload = await res.json().catch(() => null)
            throw new Error(payload?.error || 'فشل حفظ اشتراك إشعارات المندوب')
        }

        setPushStatus('granted')
        return true
    }, [])

    const subscribeToPush = useCallback(async (interactive = true) => {
        if (typeof window === 'undefined') return false
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !window.isSecureContext || !publicVapidKey) {
            setPushStatus('unsupported')
            return false
        }

        setIsSubscribing(interactive)

        try {
            const currentPermission = Notification.permission
            if (currentPermission === 'denied') {
                setPushStatus('denied')
                return false
            }

            const registration = await navigator.serviceWorker.ready
            const existingSubscription = await registration.pushManager.getSubscription()

            if (existingSubscription) {
                const success = await syncDriverPushSubscription(existingSubscription)
                if (success && interactive) {
                    toast.success('تم تفعيل إشعارات موبايل المندوب 🔔')
                }
                return success
            }

            if (currentPermission === 'default' && !interactive) {
                setPushStatus('prompt')
                return false
            }

            const permission = currentPermission === 'granted'
                ? 'granted'
                : await Notification.requestPermission()

            setPushStatus(permission)

            if (permission !== 'granted') {
                if (interactive && permission === 'denied') {
                    toast.error('المتصفح منع الإشعارات، فعّلها من الإعدادات')
                }
                return false
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            })

            const success = await syncDriverPushSubscription(subscription)
            if (success && interactive) {
                toast.success('تم تفعيل إشعارات موبايل المندوب 🔔')
            }
            return success
        } catch (err: any) {
            console.error('Driver push error:', err)
            setPushStatus('prompt')
            if (interactive) {
                toast.error(err?.message || 'في حاجة عطلت تفعيل إشعارات الموبايل')
            }
            return false
        } finally {
            setIsSubscribing(false)
        }
    }, [publicVapidKey, syncDriverPushSubscription])

    useEffect(() => {
        void subscribeToPush(false)
    }, [subscribeToPush])

    const acceptOrder = async (orderId: string) => {
        setActionLoadingOrder(orderId)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const res = await fetch('/api/driver/accept-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ orderId })
            })
            if (!res.ok) throw new Error('Failed to accept order')
            
            // Update local state to accepted immediately
            setActiveOrders(prev => prev.map(o => o.id === orderId 
                ? { ...o, shipping_address: { ...o.shipping_address, driver: { ...o.shipping_address.driver, acceptance_status: 'accepted' } } } 
                : o
            ))
            toast.success('تمام، استلمت الطلب 🛵')
        } catch (err: any) {
            toast.error('في حاجة عطلت قبول الطلب')
        } finally {
            setActionLoadingOrder(null)
        }
    }

    const rejectOrder = async (orderId: string) => {
        setActionLoadingOrder(orderId)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const res = await fetch('/api/driver/reject-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ orderId })
            })
            if (!res.ok) throw new Error('Failed to reject order')
            
            // Remove from local state
            setActiveOrders(prev => prev.filter(o => o.id !== orderId))
            toast.success('تم رفض الطلب بنجاح.')
        } catch (err: any) {
            toast.error('في حاجة عطلت رفض الطلب')
        } finally {
            setActionLoadingOrder(null)
        }
    }

    const markAsPickedUp = async (orderId: string) => {
        setUpdatingId(orderId)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const res = await fetch('/api/driver/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ orderId, status: 'shipped' })
            })
            if (!res.ok) {
                const e = await res.json()
                throw new Error(e.error || 'Failed to update status')
            }

            toast.success('تمام، بلغنا الإدارة والعميل إنك بقيت في الطريق 🛵')
            setActiveOrders(prev => prev.map(o => (
                o.id === orderId
                    ? {
                        ...o,
                        status: 'shipped',
                        shipping_address: {
                            ...o.shipping_address,
                            driver_pickup_confirmed_at: new Date().toISOString(),
                        }
                    }
                    : o
            )))
        } catch (err: any) {
            toast.error(err.message || 'في حاجة عطلت تحديث حالة الشحن')
        } finally {
            setUpdatingId(null)
        }
    }

    const markAsDelivered = async (orderId: string) => {
        setUpdatingId(orderId)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const res = await fetch('/api/driver/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ orderId, status: 'delivered' })
            })
            if (!res.ok) {
                const e = await res.json()
                throw new Error(e.error || 'Failed to update status')
            }
            toast.success("تم تأكيد التوصيل بنجاح! 📦✨")
            const order = activeOrders.find(o => o.id === orderId)
            if (order) {
                setActiveOrders(prev => {
                    const remainingOrders = prev.filter(o => o.id !== orderId)
                    
                    // Show the availability post-delivery prompt if there are no other active orders left
                    if (remainingOrders.length === 0) {
                        setShowAvailabilityPrompt(true)
                    }
                    
                    return remainingOrders
                })
                setDeliveredOrders(prev => [{ ...order, status: 'delivered' }, ...prev])
            }
        } catch (err: any) {
            toast.error(err.message || "في حاجة عطلت التحديث")
        } finally {
            setUpdatingId(null)
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4 min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-gray-500 font-bold">ثانية واحدة بنجهز طلباتك...</p>
            </div>
        )
    }

    const handleSetAvailability = async (isAvailable: boolean) => {
        setIsSettingAvailability(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch('/api/driver/set-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ isAvailable })
            })

            if (!res.ok) throw new Error('Failed to set availability')
            
            // Update local state immediately
            setIsAvailable(isAvailable)
            setShowAvailabilityPrompt(false)
            
            if (isAvailable) {
                toast.success('بطل! منتظرين الأوردرات الجديدة ليك 🚀')
            } else {
                toast('ارتاح شوية يا وحش، متنساش ترجع تاني 😴', { icon: '☕' })
            }
        } catch (err) {
            toast.error('في حاجة عطلت تحديث حالتك')
        } finally {
            setIsSettingAvailability(false)
        }
    }

    const pendingOrders = activeOrders.filter(o => o.shipping_address?.driver?.acceptance_status === 'pending')
    const acceptedActiveOrders = activeOrders.filter(o => o.shipping_address?.driver?.acceptance_status !== 'pending')
    const pendingPrimaryOrder = pendingOrders[0] || null
    const pendingRestaurantOrder = pendingPrimaryOrder ? getRestaurantOrderSnapshot(pendingPrimaryOrder.shipping_address) : null

    return (
        <div className="space-y-6 pb-8 relative">
            {/* Full Screen Availability Prompt Modal (After Delivery) */}
            {showAvailabilityPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                    <div className="bg-surface border border-surface-hover rounded-3xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 fade-in duration-300">
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h2 className="text-xl font-black text-center text-foreground mb-2">عاش يا بطل! التوصيلة خلصت 🦸‍♂️</h2>
                        <p className="text-center text-gray-400 mb-8 text-sm leading-relaxed">
                            فاضي وجاهز تقبض وتوصل طلبات تانية، ولا ناوي تخنسر وتعمل نفسك تعبان؟ <br/>
                            <span className="text-xs text-rose-400 mt-2 inline-block">(أنت الخسران لو ريحت 🤣)</span>
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => handleSetAvailability(true)}
                                disabled={isSettingAvailability}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all flex justify-center items-center gap-2"
                            >
                                {isSettingAvailability ? <Loader2 className="w-5 h-5 animate-spin" /> : 'جاهز للطلبات ورزقي على الله 🛵'}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetAvailability(false)}
                                disabled={isSettingAvailability}
                                className="w-full bg-surface-hover border border-surface-hover hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400 text-gray-400 font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2"
                            >
                                {isSettingAvailability ? <Loader2 className="w-5 h-5 animate-spin" /> : 'هريح شوية / تعبان 😴'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Screen Pending Order Notification Modal */}
            {pendingOrders.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                    <div className="bg-surface border border-surface-hover rounded-3xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 fade-in duration-300">
                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                            <Bell className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-black text-center text-foreground mb-2">فيه طلب جديد ليك! 🔔</h2>
                        <p className="text-center text-gray-400 mb-6 text-sm">
                            {pendingRestaurantOrder?.isRestaurantOrder
                                ? `الإدارة بعتالك طلب من مطعم ${pendingRestaurantOrder.restaurantName || 'من في السكة'}، إنت جاهز تستلمه؟`
                                : 'الإدارة بعتالك طلب جديد، إنت جاهز تمسكه دلوقتي؟'}
                        </p>
                        
                        <div className="space-y-3 mb-6 bg-background rounded-2xl p-4 border border-surface-hover">
                            {pendingRestaurantOrder?.isRestaurantOrder && (
                                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-sm">
                                    <p className="text-xs font-black text-primary/80">مكان الاستلام</p>
                                    <p className="mt-1 font-black text-foreground">
                                        مطعم {pendingRestaurantOrder.restaurantName || 'من في السكة'}
                                    </p>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">رقم الطلب</span>
                                <span className="font-mono font-bold text-foreground">#{pendingOrders[0].id.slice(0, 6)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">إجمالي المبلغ</span>
                                <span className="font-black text-primary">
                                    {pendingOrders[0].shipping_address?.pricing_pending ? 'بانتظار تسعير الإدارة' : `${pendingOrders[0].total_amount?.toLocaleString() || 0} ج.م`}
                                </span>
                            </div>
                            <div className="pt-2 mt-2 border-t border-surface-hover text-sm">
                                <p className="text-gray-500 mb-1 line-clamp-1">العنوان:</p>
                                <p className="font-bold text-foreground line-clamp-2">{pendingOrders[0].shipping_address?.street || 'عنوان غير معروف'}</p>
                            </div>
                            {pendingOrders[0].shipping_address?.request_mode === 'custom_category_text' && (
                                <div className="pt-2 mt-2 border-t border-surface-hover text-sm">
                                    <p className="text-gray-500 mb-1">الطلب النصي:</p>
                                    <p className="font-bold text-foreground line-clamp-4 whitespace-pre-wrap">
                                        {pendingOrders[0].shipping_address?.custom_request_text?.trim() || 'الطلب يعتمد على الصور المرفقة فقط.'}
                                    </p>
                                    <RequestAttachmentsGallery
                                        imageUrls={Array.isArray(pendingOrders[0].shipping_address?.custom_request_image_urls) ? pendingOrders[0].shipping_address.custom_request_image_urls : []}
                                        title="المرفقات"
                                        hint="الصور المرسلة مع الطلب"
                                        compact
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => acceptOrder(pendingOrders[0].id)}
                                disabled={actionLoadingOrder === pendingOrders[0].id}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all flex justify-center items-center gap-2"
                            >
                                {actionLoadingOrder === pendingOrders[0].id ? <Loader2 className="w-5 h-5 animate-spin" /> : 'نعم، جاهز للتسليم ✔️'}
                            </button>
                            <button
                                onClick={() => rejectOrder(pendingOrders[0].id)}
                                disabled={actionLoadingOrder === pendingOrders[0].id}
                                className="w-full bg-surface-hover hover:bg-rose-500/10 hover:text-rose-500 text-gray-500 font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2"
                            >
                                {actionLoadingOrder === pendingOrders[0].id ? <Loader2 className="w-5 h-5 animate-spin" /> : 'لا، لدي مشكلة / طلب آخر ❌'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resting Banner — only shows when driver chose to rest */}
            {isAvailable === false && (
                <div className="bg-amber-400/10 border border-amber-400/20 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full animate-pulse bg-amber-400" />
                        <div>
                            <p className="font-bold text-sm text-amber-400">مريح حالياً — الإدارة مش قادرة تعينك دلوقتي</p>
                            <p className="text-xs text-gray-500 mt-0.5">خد راحتك وروق، ولما تكون جاهز اضغط على الزر.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleSetAvailability(true)}
                        disabled={isSettingAvailability}
                        className="shrink-0 text-xs font-bold px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-50"
                    >
                        {isSettingAvailability ? '...' : 'جاهز دلوقتي 🚀'}
                    </button>
                </div>
            )}

            {/* Push Notification Promo Banner */}
            {pushStatus === 'default' || pushStatus === 'prompt' ? (
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4">
                    <div className="flex items-start gap-3 w-full sm:w-auto">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex flex-shrink-0 items-center justify-center text-primary mt-0.5">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-sm text-foreground">فعّل إشعارات الموبايل 🔔</p>
                            <p className="text-xs text-gray-500 mt-1">عشان الموبايل يرن فور تعيين طلب جديد لك، حتى لو التطبيق مقفول.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { void subscribeToPush(true) }}
                        disabled={isSubscribing}
                        className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تفعيل الآن'}
                    </button>
                </div>
            ) : pushStatus === 'denied' ? (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-sm text-rose-500">تم حظر الإشعارات</p>
                        <p className="text-xs text-gray-500 mt-1">عشان تستقبل تنبيهات الطلبات الجديدة، يرجى تفعيل الإشعارات من إعدادات المتصفح أو جهازك.</p>
                    </div>
                </div>
            ) : null}

            {/* Active Orders Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-black text-base text-foreground flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse inline-block"></span>
                        طلبات نشطة
                        {acceptedActiveOrders.length > 0 && (
                            <span className="text-xs font-bold bg-amber-400/15 text-amber-500 px-2 py-0.5 rounded-full">{acceptedActiveOrders.length}</span>
                        )}
                    </h2>
                    <button
                        onClick={() => setNotificationsAllowed(v => !v)}
                        className={`p-2 rounded-xl transition-colors text-xs flex items-center gap-1 font-bold ${notificationsAllowed ? 'bg-primary/10 text-primary' : 'bg-surface-hover text-gray-400'}`}
                        title={notificationsAllowed ? 'الأصوات مفعّلة' : 'الأصوات مطفية'}
                    >
                        {notificationsAllowed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                        {notificationsAllowed ? 'صوت' : 'صامت'}
                    </button>
                </div>

                {acceptedActiveOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-surface border border-surface-hover rounded-2xl">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                        <p className="font-black text-foreground">مفيش طلبات شغالة دلوقتي</p>
                        <p className="text-xs text-gray-500 mt-1">أول ما يوصلك طلب ويتوافق عليه هتلاقيه هنا</p>
                    </div>
                ) : (
                    acceptedActiveOrders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onMarkDelivered={markAsDelivered}
                            onMarkPickedUp={markAsPickedUp}
                            isUpdating={updatingId === order.id}
                        />
                    ))
                )}
            </div>

            {/* Delivered Orders Section */}
            {deliveredOrders.length > 0 && (
                <div className="space-y-3">
                    <h2 className="font-black text-base text-foreground flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block"></span>
                        تم التوصيل <span className="text-xs font-bold text-gray-400">(آخر 24 ساعة)</span>
                        <span className="text-xs font-bold bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full">{deliveredOrders.length}</span>
                    </h2>
                    {deliveredOrders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onMarkDelivered={markAsDelivered}
                            onMarkPickedUp={markAsPickedUp}
                            isUpdating={false}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

