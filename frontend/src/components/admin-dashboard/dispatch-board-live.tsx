"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MapPinned, Radar, RefreshCw, ShieldAlert, Users } from "lucide-react";

import { TripDispatchForm } from "@/components/admin-dashboard/actions";
import { FilterBar, MetricPanel, SectionCard, StatusBadge, formatLabel } from "@/components/admin-dashboard/primitives";
import { supabase } from "@/lib/supabase";
import type { DispatchBoardData, DispatchFleetDriverItem, DispatchLiveTripItem, DispatchQueueTripItem, DispatchSlaState } from "@/lib/admin-dispatch-types";

type DispatchBoardLiveProps = {
    initialBoard: DispatchBoardData;
};

const DispatchFleetMap = dynamic(
    () => import("@/components/admin-dashboard/dispatch-fleet-map").then((module) => module.DispatchFleetMap),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-[38rem] items-center justify-center rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(20,148,111,0.12),transparent_45%)] text-center">
                <div>
                    <p className="text-lg font-black text-white">جارٍ تحميل خريطة التوزيع</p>
                    <p className="mt-2 text-sm leading-7 text-white/50">بنجهز رؤية الأسطول والرحلات الحية بدون تعطيل build السيرفر.</p>
                </div>
            </div>
        ),
    }
);

function slaClasses(state: DispatchSlaState) {
    switch (state) {
        case "breached":
            return "border-rose-500/25 bg-rose-500/10 text-rose-200";
        case "warning":
            return "border-amber-500/25 bg-amber-500/10 text-amber-100";
        default:
            return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    }
}

export function DispatchBoardLive({ initialBoard }: DispatchBoardLiveProps) {
    const [board, setBoard] = useState(initialBoard);
    const [selectedTripId, setSelectedTripId] = useState<string | null>(initialBoard.queueTrips[0]?.id || initialBoard.liveTrips[0]?.id || null);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [region, setRegion] = useState("all");
    const [sla, setSla] = useState<DispatchSlaState | "all">("all");
    const [scope, setScope] = useState<"all" | "queue" | "live" | "drivers">("all");
    const [isPending, startTransition] = useTransition();
    const deferredSearch = useDeferredValue(search);

    useEffect(() => {
        setBoard(initialBoard);
    }, [initialBoard]);

    useEffect(() => {
        let cancelled = false;

        const refreshBoard = async () => {
            try {
                const response = await fetch("/api/admin/platform/dispatch-board", { cache: "no-store" });
                if (!response.ok) return;
                const nextBoard = (await response.json()) as DispatchBoardData;
                if (cancelled) return;
                startTransition(() => {
                    setBoard(nextBoard);
                });
            } catch {
                // Ignore transient refresh errors to keep the board stable.
            }
        };

        const interval = window.setInterval(refreshBoard, 15000);
        const channel = supabase
            .channel("admin-dispatch-board-live")
            .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, refreshBoard)
            .on("postgres_changes", { event: "*", schema: "public", table: "trip_offers" }, refreshBoard)
            .on("postgres_changes", { event: "*", schema: "public", table: "driver_profiles" }, refreshBoard)
            .subscribe();

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, []);

    const filteredBoard = useMemo(() => {
        const searchValue = deferredSearch.trim().toLowerCase();
        const matchesSearch = (value: string | null | undefined) => !searchValue || String(value || "").toLowerCase().includes(searchValue);
        const matchesRegion = (value: string | null | undefined) => region === "all" || String(value || "") === region;
        const matchesSla = (value: DispatchSlaState) => sla === "all" || value === sla;

        const queueTrips = board.queueTrips.filter((trip) => {
            if (scope !== "all" && scope !== "queue") return false;
            return (
                matchesRegion(trip.region) &&
                matchesSla(trip.slaState) &&
                [trip.customerName, trip.pickup, trip.destination, trip.id].some(matchesSearch)
            );
        });

        const liveTrips = board.liveTrips.filter((trip) => {
            if (scope !== "all" && scope !== "live") return false;
            return (
                matchesRegion(trip.region) &&
                matchesSla(trip.slaState) &&
                [trip.customerName, trip.driverName, trip.pickup, trip.destination, trip.id].some(matchesSearch)
            );
        });

        const availableDrivers = board.availableDrivers.filter((driver) => {
            return matchesRegion(driver.city) && [driver.fullName, driver.city, driver.area, driver.vehicleLabel, driver.id].some(matchesSearch);
        });

        const assignableDrivers = board.assignableDrivers.filter((driver) => {
            return matchesRegion(driver.city) && [driver.fullName, driver.city, driver.area, driver.vehicleLabel, driver.id].some(matchesSearch);
        });

        return {
            ...board,
            queueTrips,
            liveTrips,
            availableDrivers,
            assignableDrivers,
        };
    }, [board, deferredSearch, region, scope, sla]);

    const availableDriverOptions = filteredBoard.availableDrivers.map((driver) => ({
        id: driver.id,
        fullName: driver.fullName,
        vehicleId: driver.vehicleId,
        vehicleLabel: driver.vehicleLabel,
    }));

    const assignableDriverOptions = filteredBoard.assignableDrivers.map((driver) => ({
        id: driver.id,
        fullName: driver.fullName,
        vehicleId: driver.vehicleId,
        vehicleLabel: driver.vehicleLabel,
    }));
    const visibleAvailableDrivers = scope === "all" || scope === "drivers" ? filteredBoard.availableDrivers : [];

    const handleTripFocus = (trip: DispatchQueueTripItem | DispatchLiveTripItem) => {
        setSelectedTripId(trip.id);
        if ("driverId" in trip) {
            setSelectedDriverId(trip.driverId);
        } else {
            setSelectedDriverId(null);
        }
    };

    const handleDriverFocus = (driver: DispatchFleetDriverItem) => {
        setSelectedDriverId(driver.id);
        const liveTrip = filteredBoard.liveTrips.find((trip) => trip.driverId === driver.id);
        setSelectedTripId(liveTrip?.id || null);
    };

    return (
        <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricPanel label="طابور التوزيع" value={String(board.metrics.queueTripsCount)} sublabel="طلبات بتنتظر عرض أو تدخل سريع" />
                <MetricPanel label="رحلات حية" value={String(board.metrics.liveTripsCount)} sublabel="كباتن شغالة على الأرض الآن" />
                <MetricPanel label="كباتن متاحون" value={String(board.metrics.onlineDriversCount)} sublabel="جاهزون للتوزيع أو الإسناد" />
                <MetricPanel label="رحلات Rescue" value={String(board.metrics.adminRescueCount)} sublabel="حوّلت للنظام التشغيلي للإدارة" />
                <MetricPanel label="SLA حرجة" value={String(board.metrics.breachedTripsCount)} sublabel="تحتاج انتباه فوري" />
            </section>

            <SectionCard
                title="لوحة التوزيع الحية"
                subtitle={`آخر تحديث ${new Date(board.generatedAt).toLocaleString("ar-EG")} ${isPending ? "· جارٍ التحديث..." : ""}`}
                action={
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08]"
                    >
                        <RefreshCw className="h-4 w-4" />
                        تحديث كامل
                    </button>
                }
            >
                <FilterBar>
                    <label className="space-y-2">
                        <span className="text-xs text-white/45">بحث</span>
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="رحلة، عميل، كابتن، منطقة..."
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-primary/35"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-white/45">المنطقة</span>
                        <select
                            value={region}
                            onChange={(event) => setRegion(event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-primary/35"
                        >
                            <option value="all">كل المناطق</option>
                            {board.regionOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-white/45">SLA</span>
                        <select
                            value={sla}
                            onChange={(event) => setSla(event.target.value as DispatchSlaState | "all")}
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-primary/35"
                        >
                            <option value="all">كل الحالات</option>
                            <option value="healthy">سليم</option>
                            <option value="warning">متابعة</option>
                            <option value="breached">حرج</option>
                        </select>
                    </label>
                    <label className="space-y-2">
                        <span className="text-xs text-white/45">النطاق</span>
                        <select
                            value={scope}
                            onChange={(event) => setScope(event.target.value as "all" | "queue" | "live" | "drivers")}
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-primary/35"
                        >
                            <option value="all">الكل</option>
                            <option value="queue">طابور التوزيع</option>
                            <option value="live">الرحلات الحية</option>
                            <option value="drivers">الأسطول</option>
                        </select>
                    </label>
                    <div className="flex items-end">
                        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                            <p className="font-semibold text-white">Realtime hints</p>
                            <p className="mt-1 text-xs leading-6 text-white/45">التحديث يعمل عبر polling + Supabase triggers على الرحلات والعروض والكباتن.</p>
                        </div>
                    </div>
                </FilterBar>
            </SectionCard>

            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                <SectionCard title="خريطة الأسطول والتوزيع" subtitle="طابور الطلبات + الرحلات الحية + رؤية الكباتن المتاحين">
                    <DispatchFleetMap board={filteredBoard} selectedTripId={selectedTripId} selectedDriverId={selectedDriverId} />
                </SectionCard>

                <div className="space-y-6">
                    <SectionCard title="طابور التوزيع" subtitle="الطلبات التي تنتظر البث أو الإنقاذ">
                        <div className="space-y-4">
                            {filteredBoard.queueTrips.map((trip) => (
                                <div
                                    key={trip.id}
                                    className={`w-full rounded-[26px] border p-4 text-right transition ${
                                        selectedTripId === trip.id
                                            ? "border-primary/35 bg-primary/10"
                                            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                                    }`}
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-white">{trip.customerName}</p>
                                            <p className="mt-1 text-xs text-white/45">{new Date(trip.createdAt).toLocaleString("ar-EG")}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-3 py-1 text-xs ${slaClasses(trip.slaState)}`}>{trip.slaLabel}</span>
                                            <StatusBadge status={trip.status} />
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                                            <p className="text-xs tracking-[0.2em] text-white/35">من</p>
                                            <p className="mt-2 text-sm text-white/75">{trip.pickup}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                                            <p className="text-xs tracking-[0.2em] text-white/35">إلى</p>
                                            <p className="mt-2 text-sm text-white/75">{trip.destination}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
                                        <span className="rounded-full border border-white/10 px-3 py-1">العمر {trip.ageMinutes} د</span>
                                        <span className="rounded-full border border-white/10 px-3 py-1">العروض {trip.offeredDriverCount}</span>
                                        <span className="rounded-full border border-white/10 px-3 py-1">{trip.region || "منطقة غير محددة"}</span>
                                        {trip.awaitingAdminDispatch ? <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-rose-200">تدخل يدوي مطلوب</span> : null}
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleTripFocus(trip)}
                                            className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/80 transition hover:bg-black/30"
                                        >
                                            ركّز على الخريطة
                                        </button>
                                        <Link href={`/admin/trips/${trip.id}`} className="inline-flex text-sm text-primary">
                                            فتح تفاصيل المشوار
                                        </Link>
                                    </div>
                                    <div className="mt-4">
                                        <TripDispatchForm tripId={trip.id} broadcastDrivers={availableDriverOptions} assignableDrivers={assignableDriverOptions} />
                                    </div>
                                </div>
                            ))}
                            {filteredBoard.queueTrips.length === 0 ? <p className="text-sm text-white/45">مفيش رحلات حالية في طابور التوزيع حسب الفلاتر.</p> : null}
                        </div>
                    </SectionCard>

                    <SectionCard title="الرحلات الحية" subtitle="رحلات اتسندت وبتتحرك الآن">
                        <div className="space-y-3">
                            {filteredBoard.liveTrips.map((trip) => (
                                <button
                                    key={trip.id}
                                    type="button"
                                    onClick={() => handleTripFocus(trip)}
                                    className={`w-full rounded-[24px] border p-4 text-right transition ${
                                        selectedTripId === trip.id
                                            ? "border-sky-400/30 bg-sky-500/10"
                                            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-white">{trip.driverName || "كابتن"} <span className="text-white/40">←</span> {trip.customerName}</p>
                                            <p className="mt-1 text-xs text-white/45">{formatLabel(trip.status)} · {trip.captainEtaMinutes !== null ? `${trip.captainEtaMinutes} د ETA` : "ETA غير متاح"}</p>
                                        </div>
                                        <span className={`rounded-full border px-3 py-1 text-xs ${slaClasses(trip.slaState)}`}>{trip.slaLabel}</span>
                                    </div>
                                    <div className="mt-3 text-sm text-white/70">{trip.pickup}</div>
                                    <div className="mt-1 text-sm text-white/45">{trip.destination}</div>
                                </button>
                            ))}
                            {filteredBoard.liveTrips.length === 0 ? <p className="text-sm text-white/45">مفيش رحلات حية مطابقة للفلاتر.</p> : null}
                        </div>
                    </SectionCard>

                    <SectionCard title="الكباتن المتاحون" subtitle="الجاهزون للبث أو الإسناد المباشر الآن">
                        <div className="space-y-3">
                            {visibleAvailableDrivers.map((driver) => (
                                <button
                                    key={driver.id}
                                    type="button"
                                    onClick={() => handleDriverFocus(driver)}
                                    className={`flex w-full items-center justify-between rounded-[24px] border p-4 text-right transition ${
                                        selectedDriverId === driver.id
                                            ? "border-emerald-400/30 bg-emerald-500/10"
                                            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 rounded-full border border-white/10 bg-black/20 p-2 text-white/70">
                                            <Users className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{driver.fullName}</p>
                                            <p className="mt-1 text-xs text-white/45">{driver.city}{driver.area ? ` · ${driver.area}` : ""}</p>
                                            <p className="mt-1 text-xs text-white/55">{driver.vehicleLabel || "مفيش مركبة أساسية"}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-left">
                                        <StatusBadge status={driver.availabilityStatus} />
                                        {driver.hasOpenOffer ? <p className="text-xs text-amber-200">عليه عرض مفتوح</p> : <p className="text-xs text-white/35">{driver.locationLabel || "موقع غير متاح"}</p>}
                                    </div>
                                </button>
                            ))}
                            {visibleAvailableDrivers.length === 0 ? <p className="text-sm text-white/45">لا يوجد كباتن متاحون ضمن الفلاتر الحالية.</p> : null}
                        </div>
                    </SectionCard>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
                <SectionCard title="تشغيل تلقائي" subtitle="المحرك الجديد هو القائد الأساسي للتوزيع">
                    <div className="flex items-start gap-3 text-sm leading-7 text-white/60">
                        <Radar className="mt-1 h-5 w-5 text-primary" />
                        <p>الرحلات تدخل `searching_driver` وتتحول تلقائيًا للبث، بينما الإدارة تتدخل فقط لو الرحلة احتاجت rescue أو assignment يدوي.</p>
                    </div>
                </SectionCard>
                <SectionCard title="SLA & Rescue" subtitle="رحلات متأخرة أو تصعيدات جاهزة للتدخل">
                    <div className="flex items-start gap-3 text-sm leading-7 text-white/60">
                        <ShieldAlert className="mt-1 h-5 w-5 text-amber-300" />
                        <p>أي رحلة تجاوزت الزمن الطبيعي أو عجزت الجولة التلقائية عن إيجاد كابتن تظهر هنا كحالة قابلة للتدخل السريع مع context كامل.</p>
                    </div>
                </SectionCard>
                <SectionCard title="Fleet Visibility" subtitle="رؤية مباشرة لحركة الكباتن ونقاط الالتقاط">
                    <div className="flex items-start gap-3 text-sm leading-7 text-white/60">
                        <MapPinned className="mt-1 h-5 w-5 text-sky-300" />
                        <p>الرحلات الحية تستخدم GPS الكابتن، بينما الكباتن المتاحون بدون رحلة يظهرون بإشارة تقريبية حسب مدينة التشغيل لتقوية قرار التوزيع.</p>
                    </div>
                </SectionCard>
            </section>
        </div>
    );
}
