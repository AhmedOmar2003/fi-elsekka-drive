import Link from "next/link";

import { DataTable, FilterBar, SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
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

    const [drivers, trips] = await Promise.all([
        fetchDriversList({}),
        fetchTripsList({
            status,
            tripType,
            city: city || undefined,
            driverId,
        }),
    ]);

    return (
        <div className="space-y-6">
            <SectionCard title="إدارة المشاوير" subtitle="راجع وفلتر وافتح تفاصيل أي طلب مشوار في النظام">
                <form className="space-y-4">
                    <FilterBar>
                        <Select name="status" defaultValue={status} className="bg-white/5 text-white">
                            <option value="all">كل الحالات</option>
                            {["pending", "searching_driver", "offered", "accepted", "driver_on_the_way", "driver_arrived", "trip_started", "completed", "cancelled"].map((item) => (
                                <option key={item} value={item}>
                                    {item}
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
                            customer: <div><p className="font-semibold">{trip.customerName}</p><p className="text-xs text-white/45">{trip.city || "مدينة غير محددة"}</p></div>,
                            driver: trip.driverName || <span className="text-white/40">لسه من غير كابتن</span>,
                            type: <span className="text-white/70">{trip.tripType}</span>,
                            route: <div><p className="text-white/70">{trip.pickup}</p><p className="mt-1 text-xs text-white/45">{trip.destination}</p></div>,
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
