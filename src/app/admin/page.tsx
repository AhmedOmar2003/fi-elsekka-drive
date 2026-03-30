import Link from "next/link";

import { BarList, EntityLink, SectionCard, StatsCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchDashboardOverview } from "@/lib/admin-dashboard-data";

export default async function AdminOverviewPage() {
    const overview = await fetchDashboardOverview();

    return (
        <div className="space-y-6">
            <section className="rounded-[32px] border border-primary/15 bg-[radial-gradient(circle_at_top_right,rgba(20,148,111,0.22),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-xs uppercase tracking-[0.35em] text-primary/75">Operations Hub</p>
                        <h1 className="mt-3 text-3xl font-black md:text-4xl">لوحة تشغيل في السكة</h1>
                        <p className="mt-3 text-sm leading-7 text-white/60 md:text-base">
                            Internal console for trips, captains, dispatch, support, and service health. Built for high-volume operations with a mobile-native Egyptian ride flow.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/admin/dispatch" className="rounded-2xl border border-primary/20 bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20">
                            Open dispatch board
                        </Link>
                        <Link href="/admin/trips" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white">
                            Review all trips
                        </Link>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {overview.stats.map((stat) => (
                    <StatsCard key={stat.label} {...stat} />
                ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <SectionCard title="Trips per day" subtitle="Last 14 days ride volume">
                    <BarList data={overview.tripsPerDay} max={Math.max(...overview.tripsPerDay.map((item) => item.value), 1)} />
                </SectionCard>

                <SectionCard title="Trip status distribution" subtitle="Current operational mix">
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
                <SectionCard title="Trips per city" subtitle="Pickup demand concentration">
                    <BarList data={overview.tripsPerCity} max={Math.max(...overview.tripsPerCity.map((item) => item.value), 1)} />
                </SectionCard>

                <SectionCard title="Driver activity" subtitle="Live fleet availability">
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

                <SectionCard title="Quick modules" subtitle="Jump into the busiest operational queues">
                    <div className="space-y-3">
                        <EntityLink href="/admin/trips?status=pending" title="Pending trip requests" subtitle="Review all unassigned customer requests" />
                        <EntityLink href="/admin/drivers?approvalStatus=pending" title="Pending driver approvals" subtitle="Check docs, vehicle data, and onboarding state" />
                        <EntityLink href="/admin/support" title="Open support inbox" subtitle="Reply to trip issues and escalations" />
                    </div>
                </SectionCard>
            </section>

            <SectionCard title="Active ride requests" subtitle="Trips currently moving through dispatch">
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
                                <span>{new Date(trip.createdAt).toLocaleString("en-GB")}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
}
