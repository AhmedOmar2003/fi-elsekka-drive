'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowRight,
  Clock3,
  Loader2,
  PackageCheck,
  Store,
  TrendingUp,
  Wallet,
  CalendarDays,
  Mail,
  XCircle,
  UtensilsCrossed,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';

type RestaurantProfile = {
  id: string;
  name: string;
  short_description?: string | null;
  description?: string | null;
  cuisine?: string | null;
  image_url?: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
  is_active: boolean;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

type RestaurantStatsPayload = {
  restaurant: RestaurantProfile;
  stats: {
    totalOrders: number;
    activeOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    earnings: {
      today: number;
      week: number;
      month: number;
      total: number;
    };
  };
  trends: Array<{
    key: string;
    label: string;
    revenue: number;
    orders: number;
  }>;
  topItems: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    status: string;
    created_at: string;
    delivered_at: string | null;
    customer_name: string;
    phone?: string;
    items_count: number;
    subtotal: number;
  }>;
};

type RangeKey = 'today' | 'week' | 'month' | 'all';

const statusLabelMap: Record<string, string> = {
  pending: 'بانتظار التنفيذ',
  processing: 'قيد التجهيز',
  shipped: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

const statusToneMap: Record<string, string> = {
  pending: 'bg-amber-400/10 text-amber-300 border-amber-400/15',
  processing: 'bg-sky-400/10 text-sky-300 border-sky-400/15',
  shipped: 'bg-violet-400/10 text-violet-300 border-violet-400/15',
  delivered: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15',
  cancelled: 'bg-rose-500/10 text-rose-300 border-rose-500/15',
};

export default function AdminRestaurantOverviewPage() {
  const params = useParams<{ id: string }>();
  const restaurantId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [data, setData] = useState<RestaurantStatsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRange, setActiveRange] = useState<RangeKey>('week');

  useEffect(() => {
    if (!restaurantId) return;

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/restaurants/${restaurantId}`, {
          credentials: 'include',
          cache: 'no-store',
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload) {
          throw new Error(payload?.error || 'تعذر تحميل صفحة المطعم');
        }

        setData(payload);
      } catch (error: any) {
        toast.error(error?.message || 'فشل تحميل بيانات المطعم');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [restaurantId]);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'إجمالي الطلبات',
        value: data.stats.totalOrders,
        helper: `${data.stats.activeOrders} شغال الآن`,
        icon: Store,
        tone: 'text-primary bg-primary/10',
      },
      {
        label: 'تم توصيله',
        value: data.stats.deliveredOrders,
        helper: `${data.stats.cancelledOrders} طلب ملغي`,
        icon: PackageCheck,
        tone: 'text-emerald-400 bg-emerald-400/10',
      },
      {
        label: 'دخل اليوم',
        value: `${data.stats.earnings.today.toLocaleString()} ج.م`,
        helper: `الأسبوع ${data.stats.earnings.week.toLocaleString()} ج.م`,
        icon: Wallet,
        tone: 'text-amber-300 bg-amber-400/10',
      },
      {
        label: 'دخل الشهر',
        value: `${data.stats.earnings.month.toLocaleString()} ج.م`,
        helper: `الإجمالي ${data.stats.earnings.total.toLocaleString()} ج.م`,
        icon: TrendingUp,
        tone: 'text-sky-300 bg-sky-400/10',
      },
    ];
  }, [data]);

  const filteredOrders = useMemo(() => {
    if (!data) return [];
    if (activeRange === 'all') return data.recentOrders;

    const rangeStart = new Date();
    if (activeRange === 'today') {
      rangeStart.setHours(0, 0, 0, 0);
    } else if (activeRange === 'week') {
      rangeStart.setHours(0, 0, 0, 0);
      const diff = (rangeStart.getDay() + 6) % 7;
      rangeStart.setDate(rangeStart.getDate() - diff);
    } else {
      rangeStart.setDate(1);
      rangeStart.setHours(0, 0, 0, 0);
    }

    return data.recentOrders.filter((order) => {
      const source = order.delivered_at || order.created_at;
      const value = new Date(source).getTime();
      return Number.isFinite(value) && value >= rangeStart.getTime();
    });
  }, [activeRange, data]);

  const selectedRevenue = useMemo(() => {
    if (!data) return 0;
    if (activeRange === 'today') return data.stats.earnings.today;
    if (activeRange === 'week') return data.stats.earnings.week;
    if (activeRange === 'month') return data.stats.earnings.month;
    return data.stats.earnings.total;
  }, [activeRange, data]);

  const maxTrendRevenue = useMemo(() => {
    if (!data?.trends?.length) return 1;
    return Math.max(...data.trends.map((item) => item.revenue), 1);
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-surface-hover bg-surface p-8 text-center shadow-sm">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-bold text-gray-400">بنجهز ملخص المطعم حالًا...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
        <p className="text-sm font-bold text-rose-300">مش قادرين نعرض بيانات المطعم دلوقتي.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/admin/restaurants"
            className="inline-flex items-center gap-2 rounded-xl border border-surface-hover bg-surface px-3 py-2 text-xs font-bold text-gray-400 transition-colors hover:border-primary/30 hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" />
            رجوع للمطاعم
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-black text-foreground">صفحة المطعم</h1>
            <p className="mt-1 text-sm text-gray-500">هنا هتشوف عدد الطلبات ودخل المطعم من سعر المنتجات فقط، من غير أي جزء خاص بالتوصيل.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-primary/15 bg-primary/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-primary/15 text-primary">
              {data.restaurant.image_url ? (
                <Image src={data.restaurant.image_url} alt={data.restaurant.name} fill className="object-cover" />
              ) : (
                <Store className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-lg font-black text-foreground">{data.restaurant.name}</p>
              <p className="text-xs text-gray-500">{data.restaurant.cuisine || 'مطعم داخل قسم الطعام'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-3xl border border-surface-hover bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-500">{card.label}</p>
                  <p className="mt-3 text-2xl font-black text-foreground">{card.value}</p>
                  <p className="mt-2 text-xs text-gray-500">{card.helper}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl border border-surface-hover bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground">تحليل أسرع لأداء المطعم</h2>
            <p className="mt-1 text-sm text-gray-500">من هنا تراجع المدة اللي تهمك وتشوف الأيام الأقوى والأصناف اللي ماشية أكثر.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'today', label: 'اليوم' },
              { key: 'week', label: 'الأسبوع' },
              { key: 'month', label: 'الشهر' },
              { key: 'all', label: 'الكل' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveRange(item.key as RangeKey)}
                className={`rounded-full border px-4 py-2 text-xs font-black transition ${
                  activeRange === item.key
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-surface-hover bg-background text-gray-400 hover:border-primary/20 hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-surface-hover bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-foreground">أداء آخر 7 أيام</p>
                <p className="mt-1 text-xs text-gray-500">القيمة هنا من سعر المنتجات فقط، من غير أي جزء خاص بالتوصيل.</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Activity className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-2">
              {data.trends.map((item) => {
                const height = Math.max(16, Math.round((item.revenue / maxTrendRevenue) * 120));
                return (
                  <div key={item.key} className="flex flex-col items-center gap-2">
                    <div className="flex h-36 w-full items-end justify-center rounded-2xl border border-surface-hover bg-surface px-2 py-3">
                      <div className="w-full rounded-xl bg-primary/80 transition-all" style={{ height }} />
                    </div>
                    <p className="text-[11px] font-bold text-gray-400">{item.label}</p>
                    <p className="text-[11px] font-black text-foreground">{item.revenue.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <MiniMetric
              icon={Wallet}
              label={`دخل ${activeRange === 'today' ? 'اليوم' : activeRange === 'week' ? 'الأسبوع' : activeRange === 'month' ? 'الشهر' : 'الإجمالي'}`}
              value={`${selectedRevenue.toLocaleString()} ج.م`}
              helper="صافي سعر المنتجات فقط"
              tone="text-primary bg-primary/10"
            />

            <div className="rounded-3xl border border-surface-hover bg-background p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-foreground">أكثر الأصناف طلبًا</p>
                  <p className="mt-1 text-xs text-gray-500">أهم 5 أصناف من منيو المطعم بحسب عدد مرات الطلب.</p>
                </div>
                <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {data.topItems.length === 0 ? (
                  <div className="rounded-2xl border border-surface-hover bg-surface px-4 py-6 text-center text-sm text-gray-500">
                    لسه ما فيش بيانات كفاية علشان نطلع الأصناف الأكثر طلبًا.
                  </div>
                ) : (
                  data.topItems.map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-surface-hover bg-surface px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-foreground">
                          {index + 1}. {item.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{item.revenue.toLocaleString()} ج.م من هذا الصنف</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                        {item.quantity} طلب
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-surface-hover bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-surface-hover pb-4">
            <div>
              <h2 className="text-lg font-black text-foreground">آخر طلبات المطعم</h2>
              <p className="mt-1 text-sm text-gray-500">ملخص سريع لآخر الطلبات المرتبطة بالمطعم، مع قيمة الأطباق فقط بدون التوصيل.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-surface-hover bg-background px-4 py-8 text-center text-sm text-gray-500">
                مفيش طلبات ظاهرة في المدة اللي اخترتها.
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-surface-hover bg-background px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-foreground">طلب #{order.id.slice(-6).toUpperCase()}</p>
                      <p className="text-xs text-gray-500">{order.customer_name}</p>
                      {order.phone ? <p className="text-[11px] text-gray-500" dir="ltr">{order.phone}</p> : null}
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusToneMap[order.status] || 'border-surface-hover bg-surface-hover text-gray-300'}`}>
                      {statusLabelMap[order.status] || order.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MetricBox label="قيمة المنتجات" value={`${Number(order.subtotal || 0).toLocaleString()} ج.م`} />
                    <MetricBox label="عدد الأصناف" value={`${order.items_count}`} />
                    <MetricBox
                      label="تم التوصيل"
                      value={order.delivered_at ? new Date(order.delivered_at).toLocaleDateString('ar-EG') : '—'}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-surface-hover bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-black text-foreground">ملف المطعم</h2>
            <div className="mt-4 space-y-3">
              <InfoRow icon={Store} label="حالة الظهور" value={data.restaurant.is_active ? 'ظاهر في المتجر' : 'موقوف'} />
              <InfoRow icon={Clock3} label="التوفر الحالي" value={data.restaurant.is_available ? 'متاح الآن' : 'غير متاح الآن'} />
              <InfoRow icon={Mail} label="إيميل المتابعة" value={data.restaurant.manager_email || 'غير محدد'} dir="ltr" />
              <InfoRow icon={CalendarDays} label="تاريخ الإضافة" value={new Date(data.restaurant.created_at).toLocaleDateString('ar-EG')} />
            </div>
          </div>

          <div className="rounded-3xl border border-surface-hover bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-black text-foreground">مؤشرات سريعة</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MiniMetric
                icon={PackageCheck}
                label="طلبات تم توصيلها"
                value={data.stats.deliveredOrders}
                helper={`${data.stats.activeOrders} طلب شغال حاليًا`}
                tone="text-emerald-300 bg-emerald-500/10"
              />
              <MiniMetric
                icon={XCircle}
                label="طلبات ملغية"
                value={data.stats.cancelledOrders}
                helper="علشان تراجع التشغيل وتقلل الفاقد"
                tone="text-rose-300 bg-rose-500/10"
              />
              <MiniMetric
                icon={Wallet}
                label="دخل الأسبوع"
                value={`${data.stats.earnings.week.toLocaleString()} ج.م`}
                helper="صافي قيمة المنتجات فقط"
                tone="text-amber-300 bg-amber-400/10"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-surface-hover bg-background px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-gray-500">{label}</p>
        <p className="mt-1 break-words text-sm font-black text-foreground" dir={dir}>
          {value}
        </p>
      </div>
    </div>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  helper: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-surface-hover bg-background px-4 py-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-500">{label}</p>
          <p className="mt-1 text-base font-black text-foreground">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-hover bg-surface px-3 py-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-black text-foreground">{value}</p>
    </div>
  );
}
