"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
    fetchAdminCategoryAnalytics,
    type AdminAnalyticsRange,
    type AdminCategoryAnalyticsData,
} from '@/services/adminService';
import { hasPermission } from '@/lib/permissions';
import {
    ArrowLeft,
    BarChart3,
    Clock3,
    Loader2,
    Package,
    ShoppingCart,
    TrendingUp,
    Wallet,
} from 'lucide-react';

const EMPTY_CATEGORY_ANALYTICS: AdminCategoryAnalyticsData = {
    windowDays: 30,
    category: {
        id: '',
        name: '...',
    },
    summary: {
        quantity: 0,
        ordersCount: 0,
        revenue: 0,
        share: 0,
    },
    topProducts: [],
    trends: {
        dailyRevenue: [],
        dailyOrders: [],
    },
};

function currency(value: number) {
    return `${Math.round(value || 0).toLocaleString()} ج.م`;
}

function maxValue(items: Array<{ value: number }>) {
    return items.reduce((max, item) => Math.max(max, item.value), 0);
}

export default function AdminCategoryAnalyticsPage() {
    const { user, profile, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const categoryId = params?.id;
    const initialRange = Number(searchParams.get('range') || 30);
    const [windowDays, setWindowDays] = useState<AdminAnalyticsRange>(initialRange === 7 || initialRange === 90 ? initialRange : 30);
    const [isLoading, setIsLoading] = useState(true);
    const [analytics, setAnalytics] = useState<AdminCategoryAnalyticsData>(EMPTY_CATEGORY_ANALYTICS);

    useEffect(() => {
        if (isAuthLoading) return;
        if (!user) {
            setIsLoading(false);
            return;
        }

        if (!hasPermission(profile, 'view_reports')) {
            router.replace('/admin/orders');
            return;
        }

        if (!categoryId) {
            router.replace('/admin/analytics');
            return;
        }

        let cancelled = false;

        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await fetchAdminCategoryAnalytics(categoryId, windowDays);
                if (cancelled) return;
                setAnalytics(data);
            } catch (error) {
                console.error('Failed to load category analytics', error);
                if (!cancelled) toast.error('تعذر تحميل تحليل القسم دلوقتي.');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadData();

        return () => {
            cancelled = true;
        };
    }, [user, profile, isAuthLoading, router, categoryId, windowDays]);

    useEffect(() => {
        const current = searchParams.get('range');
        const wanted = String(windowDays);
        if (current === wanted || !categoryId) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set('range', wanted);
        router.replace(`/admin/analytics/categories/${categoryId}?${params.toString()}`);
    }, [windowDays, router, searchParams, categoryId]);

    const revenueMax = maxValue(analytics.trends.dailyRevenue);
    const ordersMax = maxValue(analytics.trends.dailyOrders);

    const notes = useMemo(() => {
        const result: string[] = [];
        if (analytics.summary.ordersCount === 0) {
            result.push('القسم ده لسه مجبش طلبات فعلية في الفترة دي، فممكن يحتاج ظهور أو منتجات أوضح.');
        }
        if (analytics.topProducts.length > 0) {
            result.push(`أكتر حاجة شغالة هنا: ${analytics.topProducts[0].name}.`);
        }
        if (analytics.summary.share > 0) {
            result.push(`القسم مساهم بحوالي ${analytics.summary.share}% من إجمالي الطلبات في نفس الفترة.`);
        }
        if (result.length === 0) {
            result.push('الصورة العامة للقسم هتوضح أكتر أول ما الطلبات تزيد في الفترة الجاية.');
        }
        return result;
    }, [analytics]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-black text-foreground">تحليل قسم {analytics.category.name}</h1>
                    <p className="mt-1 text-sm text-gray-500">نظرة مركزة على الطلبات والدخل والمنتجات الشغالة جوه القسم ده.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-2xl border border-surface-hover bg-surface p-1">
                        {[7, 30, 90].map((days) => (
                            <button
                                key={days}
                                type="button"
                                onClick={() => setWindowDays(days as AdminAnalyticsRange)}
                                className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                                    windowDays === days ? 'bg-primary text-white' : 'text-gray-400 hover:text-foreground'
                                }`}
                            >
                                {days} يوم
                            </button>
                        ))}
                    </div>
                    <Link href="/admin/analytics" className="rounded-2xl border border-surface-hover bg-surface px-4 py-2.5 text-sm font-bold text-gray-300 transition-colors hover:border-primary/20 hover:text-foreground">
                        ارجع للتحليلات
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                    { label: 'عدد القطع المطلوبة', value: analytics.summary.quantity.toLocaleString(), icon: Package, tone: 'text-primary bg-primary/10' },
                    { label: 'عدد الطلبات', value: analytics.summary.ordersCount.toLocaleString(), icon: ShoppingCart, tone: 'text-sky-400 bg-sky-400/10' },
                    { label: 'الدخل التقريبي', value: currency(analytics.summary.revenue), icon: Wallet, tone: 'text-emerald-400 bg-emerald-400/10' },
                    { label: 'نسبة مساهمة القسم', value: `${analytics.summary.share}%`, icon: TrendingUp, tone: 'text-violet-400 bg-violet-400/10' },
                ].map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="rounded-2xl border border-surface-hover bg-surface p-5 shadow-sm">
                            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${card.tone}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-bold text-gray-500">{card.label}</p>
                            <p className="mt-2 text-2xl font-black text-foreground">{isLoading ? '...' : card.value}</p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-surface-hover bg-surface shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between border-b border-surface-hover p-5">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-primary" />
                            <h2 className="text-sm font-bold text-foreground">الدخل اليومي للقسم</h2>
                        </div>
                        <div className="text-xs text-gray-500">آخر {windowDays} يوم</div>
                    </div>

                    <div className="grid grid-cols-7 gap-3 p-5">
                        {isLoading ? (
                            [...Array(Math.min(windowDays, 7))].map((_, index) => (
                                <div key={index} className="h-36 rounded-xl bg-surface-hover animate-pulse" />
                            ))
                        ) : (
                            analytics.trends.dailyRevenue.slice(-7).map((point) => (
                                <div key={point.label} className="flex flex-col items-center gap-3">
                                    <div className="flex h-36 w-full items-end rounded-2xl bg-background p-2">
                                        <div
                                            className="w-full rounded-xl bg-gradient-to-t from-primary to-emerald-400"
                                            style={{ height: `${revenueMax > 0 ? Math.max((point.value / revenueMax) * 100, point.value > 0 ? 12 : 4) : 4}%` }}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[11px] font-bold text-foreground">{point.label}</p>
                                        <p className="text-[10px] text-gray-500">{currency(point.value)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-surface-hover bg-surface shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between border-b border-surface-hover p-5">
                        <div className="flex items-center gap-2">
                            <Clock3 className="w-4 h-4 text-sky-400" />
                            <h2 className="text-sm font-bold text-foreground">الطلبات اليومية للقسم</h2>
                        </div>
                        <div className="text-xs text-gray-500">آخر {windowDays} يوم</div>
                    </div>

                    <div className="grid grid-cols-7 gap-3 p-5">
                        {isLoading ? (
                            [...Array(Math.min(windowDays, 7))].map((_, index) => (
                                <div key={index} className="h-36 rounded-xl bg-surface-hover animate-pulse" />
                            ))
                        ) : (
                            analytics.trends.dailyOrders.slice(-7).map((point) => (
                                <div key={point.label} className="flex flex-col items-center gap-3">
                                    <div className="flex h-36 w-full items-end rounded-2xl bg-background p-2">
                                        <div
                                            className="w-full rounded-xl bg-gradient-to-t from-sky-500 to-violet-400"
                                            style={{ height: `${ordersMax > 0 ? Math.max((point.value / ordersMax) * 100, point.value > 0 ? 12 : 4) : 4}%` }}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[11px] font-bold text-foreground">{point.label}</p>
                                        <p className="text-[10px] text-gray-500">{point.value.toLocaleString()} طلب</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 rounded-2xl border border-surface-hover bg-surface shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between border-b border-surface-hover p-5">
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-primary" />
                            <h2 className="text-sm font-bold text-foreground">أكثر منتجات القسم طلبًا</h2>
                        </div>
                        <div className="text-xs text-gray-500">في آخر {windowDays} يوم</div>
                    </div>

                    <div className="divide-y divide-surface-hover">
                        {isLoading ? (
                            <div className="p-5 space-y-3">
                                {[...Array(5)].map((_, index) => (
                                    <div key={index} className="h-16 rounded-xl bg-surface-hover animate-pulse" />
                                ))}
                            </div>
                        ) : analytics.topProducts.length === 0 ? (
                            <div className="p-10 text-center text-sm text-gray-500">لسه مفيش طلبات على منتجات القسم ده في الفترة دي.</div>
                        ) : (
                            analytics.topProducts.map((product, index) => (
                                <div key={product.id} className="flex items-center gap-4 px-5 py-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary">
                                        {index + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-foreground">{product.name}</p>
                                        <p className="text-xs text-gray-500">{product.quantity} قطعة</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-foreground">{currency(product.revenue)}</p>
                                        <Link href="/admin/products" className="text-[11px] font-bold text-primary hover:text-primary/80">
                                            افتح المنتج
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-surface-hover bg-surface p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <h2 className="text-sm font-bold text-foreground">ملحوظات سريعة</h2>
                    </div>

                    <div className="space-y-3">
                        {notes.map((note, index) => (
                            <div key={index} className="rounded-xl bg-background px-4 py-3 text-sm text-gray-300">
                                {note}
                            </div>
                        ))}
                    </div>

                    <div className="mt-4">
                        <Link href={`/admin/analytics?range=${windowDays}`} className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/80">
                            ارجع للتحليلات العامة <ArrowLeft className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur-sm">
                    <div className="flex items-center gap-3 rounded-2xl border border-surface-hover bg-surface px-5 py-4 text-sm font-bold text-foreground shadow-xl">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        بنجمع تحليل القسم دلوقتي...
                    </div>
                </div>
            )}
        </div>
    );
}
