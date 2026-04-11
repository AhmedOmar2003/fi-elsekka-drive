import Link from "next/link";

import { BarList, EntityLink, SectionCard, StatsCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { AdminStabilityTools } from "@/components/admin-dashboard/stability-tools";
import { fetchDashboardOverview } from "@/lib/admin-dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
    const overview = await fetchDashboardOverview();

    return (
        <div className="space-y-6">
            <section className="rounded-[32px] border border-primary/15 bg-[radial-gradient(circle_at_top_right,rgba(20,148,111,0.22),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-xs tracking-[0.35em] text-primary/75">مركز التشغيل</p>
            <h1 className="mt-3 text-3xl font-black md:text-4xl">لوحة تشغيل وصلني</h1>
                        <p className="mt-3 text-sm leading-7 text-white/60 md:text-base">
                            لوحة داخلية لمتابعة المشاوير والكباتن والتوزيع والدعم وحالة الخدمة، متصممة لشغل يومي سريع يناسب طبيعة التشغيل في مصر.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/admin/dispatch" className="rounded-2xl border border-primary/20 bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20">
                            افتح لوحة التوزيع
                        </Link>
                        <Link href="/admin/trips" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white">
                            راجع كل المشاوير
                        </Link>
                    </div>
                </div>
            </section>

            <AdminStabilityTools />

            {overview.isDegraded ? (
                <section className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    {overview.degradedReason || "الإحصائيات مؤقتًا غير متاحة بالكامل بسبب ضغط الخادم، وسيتم تحديثها تلقائيًا عند استقرار الاتصال."}
                </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {overview.stats.map((stat) => (
                    <StatsCard key={stat.label} {...stat} />
                ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <SectionCard title="المشاوير حسب اليوم" subtitle="حجم الطلب خلال آخر 14 يوم">
                    <BarList data={overview.tripsPerDay} max={Math.max(...overview.tripsPerDay.map((item) => item.value), 1)} />
                </SectionCard>

                <SectionCard title="توزيع حالات المشاوير" subtitle="الوضع التشغيلي الحالي">
                    <div className="space-y-3">
                        {overview.tripStatusDistribution.map((item) => (
                            <div key={item.status} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={item.status} />
                                    <span className="text-sm text-white/65">{item.label}</span>
                                </div>
                                <span className="text-lg font-black">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
                <SectionCard title="المشاوير حسب المدينة" subtitle="أماكن الطلب الأعلى">
                    <BarList data={overview.tripsPerCity} max={Math.max(...overview.tripsPerCity.map((item) => item.value), 1)} />
                </SectionCard>

                <SectionCard title="نشاط الكباتن" subtitle="حالة الأسطول الآن">
                    <div className="space-y-3">
                        {overview.driverActivity.map((item) => (
                            <div key={item.status} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={item.status} />
                                    <span className="text-sm text-white/65">{item.label}</span>
                                </div>
                                <span className="text-lg font-black">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title="اختصارات سريعة" subtitle="ادخل مباشرة على أهم القوايم">
                    <div className="space-y-3">
                        <EntityLink href="/admin/trips?status=pending" title="طلبات مشاوير معلقة" subtitle="راجع كل الطلبات اللي لسه ما اتسندتش" />
                        <EntityLink href="/admin/drivers?approvalStatus=pending" title="طلبات كباتن تحت المراجعة" subtitle="راجع الأوراق وبيانات المركبة وحالة الانضمام" />
                        <EntityLink href="/admin/users" title="العملاء المسجلين" subtitle="شوف كل العملاء الجدد والحسابات اللي اتعملت من التطبيق" />
                        <EntityLink href="/admin/support" title="صندوق الدعم المفتوح" subtitle="رد على مشاكل المشاوير والشكاوى" />
                    </div>
                </SectionCard>
            </section>

            <SectionCard title="طلبات شغالة الآن" subtitle="المشاوير الموجودة حاليًا في دورة التوزيع">
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {overview.activeTrips.map((trip) => (
                        <Link key={trip.id} href={`/admin/trips/${trip.id}`} className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 transition hover:border-primary/25 hover:bg-white/[0.045]">
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold">{trip.customerName}</p>
                                <StatusBadge status={trip.status} />
                            </div>
                            <p className="mt-3 text-sm text-white/60">{trip.pickup}</p>
                            <p className="mt-1 text-sm text-white">{trip.destination}</p>
                            <div className="mt-4 flex items-center justify-between text-xs text-white/45">
                                <span>{trip.tripType}</span>
                                <span>{new Date(trip.createdAt).toLocaleString("ar-EG")}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
}
