"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, Loader2, Star, MessageSquare, Package } from 'lucide-react'
import { normalizeDisplayCity } from '@/lib/delivery-location'

interface DeliveredOrder {
    id: string;
    total_amount: number;
    created_at: string;
    shipping_address: any;
    review?: { rating: number; comment: string | null } | null;
}

function StarDisplay({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-4 h-4 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
            ))}
        </div>
    )
}

export default function DriverHistoryPage() {
    const router = useRouter()
    const [orders, setOrders] = useState<DeliveredOrder[]>([])
    const [avgRating, setAvgRating] = useState<number | null>(null)
    const [totalCount, setTotalCount] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const load = async () => {
            setIsLoading(true)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return; }

            const res = await fetch('/api/driver/history', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })

            if (!res.ok) {
                const e = await res.json()
                setError(e.error || 'فشل تحميل السجل')
                setIsLoading(false)
                return
            }

            const data = await res.json()
            setOrders(data.orders || [])
            setTotalCount(data.totalCount || 0)
            setAvgRating(data.avgRating)
            setIsLoading(false)
        }
        load()
    }, [router])

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4 min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-gray-500 font-bold">جاري تحميل سجلك...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <p className="text-red-500 font-bold">{error}</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Stats Header */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface border border-surface-hover rounded-2xl p-4 text-center">
                    <p className="text-3xl font-black text-primary">{totalCount}</p>
                    <p className="text-xs text-gray-500 mt-1 font-bold">طلب تم توصيله</p>
                </div>
                <div className="bg-surface border border-surface-hover rounded-2xl p-4 text-center">
                    {avgRating !== null ? (
                        <>
                            <p className="text-3xl font-black text-amber-500">{avgRating}</p>
                            <div className="flex justify-center mt-1">
                                <StarDisplay rating={Math.round(avgRating)} />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 font-bold">متوسط التقييم</p>
                        </>
                    ) : (
                        <>
                            <p className="text-3xl font-black text-gray-400">—</p>
                            <p className="text-xs text-gray-500 mt-1 font-bold">لا توجد تقييمات بعد</p>
                        </>
                    )}
                </div>
            </div>

            {/* Orders list */}
            {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-surface border border-surface-hover rounded-2xl">
                    <Package className="w-10 h-10 text-gray-400 mb-3" />
                    <p className="font-black text-foreground">لا توجد طلبات موصّلة بعد</p>
                    <p className="text-xs text-gray-500 mt-1">بعد توصيل طلباتك ستظهر هنا مع تقييمات العملاء</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <h2 className="font-black text-base text-foreground">الطلبات السابقة ({totalCount})</h2>
                    {orders.map(order => {
                        const address = [
                            normalizeDisplayCity(order.shipping_address?.city),
                            order.shipping_address?.area,
                        ].filter(Boolean).join('، ')

                        const customerName = order.shipping_address?.recipient || order.shipping_address?.recipientName || 'عميل'

                        const date = new Date(order.created_at).toLocaleDateString('ar-EG', {
                            year: 'numeric', month: 'short', day: 'numeric'
                        })

                        return (
                            <div key={order.id} className="bg-surface border border-surface-hover rounded-2xl overflow-hidden">
                                <div className="p-4 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs text-gray-500 font-mono">طلب #{order.id.slice(0,6)}</p>
                                            <p className="font-bold text-sm text-foreground truncate">{customerName}</p>
                                            {address && <p className="text-xs text-gray-400 truncate">{address}</p>}
                                            <p className="text-xs text-gray-400">{date}</p>
                                        </div>
                                    </div>
                                    <div className="text-left shrink-0">
                                        <p className="font-black text-primary text-base">{order.total_amount?.toLocaleString()} ج.م</p>
                                    </div>
                                </div>

                                {/* Customer Review */}
                                {order.review ? (
                                    <div className="border-t border-surface-hover px-4 py-3 bg-amber-400/5 flex items-start gap-3">
                                        <MessageSquare className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <StarDisplay rating={order.review.rating} />
                                            {order.review.comment && (
                                                <p className="text-xs text-gray-500 mt-1 italic">"{order.review.comment}"</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border-t border-surface-hover px-4 py-2 flex items-center gap-2">
                                        <Star className="w-4 h-4 text-gray-300" />
                                        <p className="text-xs text-gray-400">لم يقيّم العميل بعد</p>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
