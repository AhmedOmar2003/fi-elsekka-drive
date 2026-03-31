import Link from "next/link";

import { DataTable, FilterBar, SectionCard, StatusBadge, formatLabel } from "@/components/admin-dashboard/primitives";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchDriversList, fetchTripsList } from "@/lib/admin-dashboard-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminTripsPage({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;
    const status = typeof params.status === "string" ? params.status : "all";
    const tripType = typeof params.tripType === "string" ? params.tripType : "all";
    const city = typeof params.city === "string" ? params.city : "";
    const driverId = typeof params.driverId === "string" ? params.driverId : "all";
    const manualMode = typeof params.manualMode === "string" ? params.manualMode : "all";

    const [drivers, trips] = await Promise.all([
        fetchDriversList({}),
        fetchTripsList({
            status,
            tripType,
            city: city || undefined,
            driverId,
            manualMode,
        }),
    ]);

    const manualTrips = trips.filter((trip) => trip.manualRequest);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
                <Link href="/admin/trips" className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${manualMode === "all" ? "bg-primary text-white" : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}>
                    كل المشاوير
                </Link>
                <Link href="/admin/trips?manualMode=manual" className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${manualMode === "manual" ? "bg-primary text-white" : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}>
                    طلبات يدوية
                </Link>
                <Link href="/admin/trips?manualMode=mapped" className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${manualMode === "mapped" ? "bg-primary text-white" : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}>
                    طلبات بالخريطة
                </Link>
            </div>

            <SectionCard title="إدارة المشاوير" subtitle="راجع وفلتر وافتح تفاصيل أي طلب مشوار في النظام">
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4">
                        <p className="text-xs text-white/45">طلبات يدوية محتاجة مراجعة</p>
                        <p className="mt-2 text-2xl font-black text-white">{manualTrips.length}</p>
                        <p className="mt-2 text-sm text-white/60">دي الطلبات اللي محتاجة تحدد لها سعر ومدة وكابتن من الإدارة.</p>
                    </div>
                    <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/5 p-4 md:col-span-2">
                        <p className="text-sm font-black text-white">محتاج تحديد سعر ومدة ومندوب</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {manualTrips.slice(0, 4).map((trip) => (
                                <Link key={trip.id} href={`/admin/trips/${trip.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                                    {trip.customerName} · {trip.pickup}
                                </Link>
                            ))}
                            {manualTrips.length === 0 ? <p className="text-sm text-white/55">مفيش طلبات يدوية جديدة دلوقتي.</p> : null}
                        </div>
                    </div>
                </div>

                <form className="space-y-4">
                    <FilterBar>
                        <Select name="status" defaultValue={status} className="bg-white/5 text-white">
                            <option value="all">كل الحالات</option>
                            {[
                                "pending",
                                "searching_driver",
                                "offered",
                                "accepted",
                                "driver_on_the_way",
                                "driver_arrived",
                                "trip_started",
                                "completed",
                                "cancelled",
                            ].map((item) => (
                                <option key={item} value={item}>
                                    {formatLabel(item)}
                                </option>
                            ))}
                        </Select>
                        <Select name="tripType" defaultValue={tripType} className="bg-white/5 text-white">
                            <option value="all">كل أنواع المشاوير</option>
                            <option value="airport_ride">مشوار مطار</option>
                            <option value="normal_ride">مشوار عادي</option>
                        </Select>
                        <Select name="driverId" defaultValue={driverId} className="bg-white/5 text-white">
                            <option value="all">كل الكباتن</option>
                            {drivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                    {driver.fullName}
                                </option>
                            ))}
                        </Select>
                        <Select name="manualMode" defaultValue={manualMode} className="bg-white/5 text-white">
                            <option value="all">كل أنواع الطلب</option>
                            <option value="manual">طلبات يدوية</option>
                            <option value="mapped">طلبات بالخريطة</option>
                        </Select>
                        <Input name="city" defaultValue={city} placeholder="فلتر حسب المدينة" className="bg-white/5 text-white" />
                        <button className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white">تطبيق الفلاتر</button>
                    </FilterBar>
                </form>

                <div className="mt-5">
                    <DataTable
                        columns={[
                            { key: "id", label: "رقم المشوار" },
                            { key: "customer", label: "العميل" },
                            { key: "driver", label: "الكابتن" },
                            { key: "type", label: "النوع" },
                            { key: "route", label: "خط السير" },
                            { key: "status", label: "الحالة" },
                            { key: "created", label: "وقت الإنشاء" },
                            { key: "actions", label: "الإجراءات", className: "text-left" },
                        ]}
                        rows={trips.map((trip) => ({
                            id: <span className="font-mono text-xs text-white/70">{trip.id.slice(0, 8)}</span>,
                            customer: (
                                <div>
                                    <p className="font-semibold">{trip.customerName}</p>
                                    <p className="text-xs text-white/45">{trip.city || "مدينة غير محددة"}</p>
                                </div>
                            ),
                            driver: trip.driverName || <span className="text-white/40">لسه من غير كابتن</span>,
                            type: (
                                <div className="space-y-1">
                                    <span className="block text-white/70">{trip.tripType}</span>
                                    {trip.manualRequest ? <span className="inline-flex rounded-full bg-amber-400/15 px-2 py-1 text-[11px] font-bold text-amber-300">طلب يدوي</span> : null}
                                </div>
                            ),
                            route: (
                                <div>
                                    <p className="text-white/70">{trip.pickup}</p>
                                    <p className="mt-1 text-xs text-white/45">{trip.destination}</p>
                                </div>
                            ),
                            status: <StatusBadge status={trip.status} />,
                            created: new Date(trip.createdAt).toLocaleString("ar-EG"),
                            actions: (
                                <Link href={`/admin/trips/${trip.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                                    فتح التفاصيل
                                </Link>
                            ),
                        }))}
                        emptyState="مفيش مشاوير مطابقة للفلاتر الحالية."
                    />
                </div>
            </SectionCard>
        </div>
    );
}

