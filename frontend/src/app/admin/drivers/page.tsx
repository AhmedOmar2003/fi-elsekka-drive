import Link from "next/link";

import { CreateCaptainForm } from "@/components/admin-dashboard/actions";
import { DataTable, FilterBar, SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchDriversList } from "@/lib/admin-dashboard-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminDriversPage({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;
    const approvalStatus = typeof params.approvalStatus === "string" ? params.approvalStatus : "all";
    const vehicleType = typeof params.vehicleType === "string" ? params.vehicleType : "all";
    const city = typeof params.city === "string" ? params.city : "";
    const availabilityStatus = typeof params.availabilityStatus === "string" ? params.availabilityStatus : "all";

    const drivers = await fetchDriversList({
        approvalStatus,
        vehicleType,
        city: city || undefined,
        availabilityStatus,
    });

    return (
        <div className="space-y-6">
            <CreateCaptainForm />

            <SectionCard title="إدارة الكباتن" subtitle="طلبات المراجعة، التواجد الحالي، وأداء الأسطول">
                <form className="space-y-4">
                    <FilterBar>
                        <Select name="approvalStatus" defaultValue={approvalStatus} className="bg-white/5 text-white">
                            <option value="all">كل حالات المراجعة</option>
                            <option value="pending">معلّق</option>
                            <option value="approved">مقبول</option>
                            <option value="rejected">مرفوض</option>
                            <option value="suspended">موقوف</option>
                        </Select>
                        <Select name="vehicleType" defaultValue={vehicleType} className="bg-white/5 text-white">
                            <option value="all">كل أنواع المركبات</option>
                            <option value="car">عربية</option>
                            <option value="tuk_tuk">توك توك</option>
                        </Select>
                        <Select name="availabilityStatus" defaultValue={availabilityStatus} className="bg-white/5 text-white">
                            <option value="all">كل الحالات</option>
                            <option value="available">متاح</option>
                            <option value="busy">مشغول</option>
                        </Select>
                        <Input name="city" defaultValue={city} placeholder="فلتر حسب المدينة" className="bg-white/5 text-white" />
                        <button className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white">تطبيق الفلاتر</button>
                    </FilterBar>
                </form>

                <div className="mt-5">
                    <DataTable
                        columns={[
                            { key: "driver", label: "الكابتن" },
                            { key: "vehicle", label: "المركبة" },
                            { key: "live", label: "الحالة الآن" },
                            { key: "dispatch", label: "جاهز للتوزيع" },
                            { key: "approval", label: "المراجعة" },
                            { key: "city", label: "المدينة" },
                            { key: "trips", label: "مشاوير مكتملة" },
                            { key: "actions", label: "الإجراءات", className: "text-left" },
                        ]}
                        rows={drivers.map((driver) => ({
                            driver: (
                                <div>
                                    <p className="font-semibold">{driver.fullName}</p>
                                    <p className="mt-1 text-xs text-white/45">{driver.phone || "مفيش رقم"}</p>
                                </div>
                            ),
                            vehicle: <span className="text-white/70">{driver.vehicleType || "مفيش مركبة أساسية"}</span>,
                            live: <StatusBadge status={driver.availabilityStatus} />,
                            dispatch: driver.dispatchReady ? (
                                <StatusBadge status="active" />
                            ) : (
                                <div>
                                    <StatusBadge status="warning" />
                                    <p className="mt-1 text-xs text-white/45">{driver.dispatchBlockReason || "غير جاهز"}</p>
                                </div>
                            ),
                            approval: <StatusBadge status={driver.applicationStatus} />,
                            city: <div><p>{driver.city || "—"}</p><p className="mt-1 text-xs text-white/45">{driver.area || "—"}</p></div>,
                            trips: <span className="font-semibold">{driver.tripsCompleted}</span>,
                            actions: (
                                <Link href={`/admin/drivers/${driver.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                                    عرض الكابتن
                                </Link>
                            ),
                        }))}
                        emptyState="مفيش كباتن مطابقين للفلاتر الحالية."
                    />
                </div>
            </SectionCard>
        </div>
    );
}
