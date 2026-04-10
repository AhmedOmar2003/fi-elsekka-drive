import Link from "next/link";
import { notFound } from "next/navigation";

import { TripOpsWizard } from "@/components/admin-dashboard/trip-ops-wizard";
import { MetricPanel, SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchDispatchBoard, fetchTripDetail } from "@/lib/admin-dashboard-data";

type Params = Promise<{ id: string }>;

export default async function AdminTripDetailsPage({ params }: { params: Params }) {
    const { id } = await params;
    const [detail, dispatchBoard] = await Promise.all([fetchTripDetail(id), fetchDispatchBoard()]);

    if (!detail) notFound();

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <Link href="/admin/trips" className="text-sm text-primary">
                        الرجوع للمشاوير
                    </Link>
                    <h1 className="mt-2 text-3xl font-black">مشوار #{detail.trip.id.slice(0, 8)}</h1>
                </div>
                <StatusBadge status={detail.trip.status} />
            </div>

            <section className="grid gap-4 lg:grid-cols-5">
                <MetricPanel label="نوع المشوار" value={detail.trip.tripType} />
                <MetricPanel label="عدد الركاب" value={String(detail.trip.passengerCount)} />
                <MetricPanel label="عدد الشنط" value={String(detail.trip.luggageCount)} sublabel="في مشاوير المطار فقط" />
                <MetricPanel label="السعر التقديري" value={detail.trip.mapEstimatedPrice ? `${detail.trip.mapEstimatedPrice} ج.م` : "لسه"} />
                <MetricPanel label="السعر النهائي" value={detail.trip.adminSelectedPrice ? `${detail.trip.adminSelectedPrice} ج.م` : "لسه ما اتحددش"} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <TripOpsWizard
                    tripId={detail.trip.id}
                    mapEstimatedPrice={detail.trip.mapEstimatedPrice}
                    adminSelectedPrice={detail.trip.adminSelectedPrice}
                    customerPriceConfirmed={detail.trip.customerPriceConfirmed}
                    assignableDrivers={dispatchBoard.assignableDrivers.map((driver) => ({
                        id: driver.id,
                        fullName: driver.fullName,
                        vehicleId: driver.vehicleId,
                        vehicleLabel: driver.vehicleLabel,
                    }))}
                />

                <SectionCard title="ملخص المشوار" subtitle="الخط الأساسي وبيانات الراكب">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs tracking-[0.2em] text-white/40">التحرك من</p>
                            <p className="mt-3 text-lg font-bold">{detail.trip.pickupLabel}</p>
                            <p className="mt-2 text-sm text-white/55">{detail.trip.pickupAddress}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs tracking-[0.2em] text-white/40">الوجهة</p>
                            <p className="mt-3 text-lg font-bold">{detail.trip.destinationLabel}</p>
                            <p className="mt-2 text-sm text-white/55">{detail.trip.destinationAddress}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs tracking-[0.2em] text-white/40">العميل</p>
                            <p className="mt-3 text-lg font-bold">{detail.customer?.fullName || "عميل غير معروف"}</p>
                            <p className="mt-2 text-sm text-white/55">{detail.customer?.phone || "مفيش رقم"}</p>
                            <p className="mt-1 text-sm text-white/45">{detail.customer?.email || "مفيش إيميل"}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs tracking-[0.2em] text-white/40">الكابتن المتسند</p>
                            <p className="mt-3 text-lg font-bold">{detail.driver?.fullName || "لسه ما اتسندش"}</p>
                            <p className="mt-2 text-sm text-white/55">{detail.driver?.phone || "مفيش رقم"}</p>
                            <p className="mt-1 text-sm text-white/45">{detail.vehicle?.label || "مفيش مركبة متسجلة"}</p>
                        </div>
                    </div>

                    {detail.trip.tripType === "airport_ride" ? (
                        <div className="mt-4 rounded-3xl border border-primary/15 bg-primary/10 p-4">
                            <p className="text-sm font-semibold text-primary">تفاصيل مشوار المطار</p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <p className="text-sm text-white/75">المطار: {detail.trip.airportName || "—"}</p>
                                <p className="text-sm text-white/75">النوع: {detail.trip.airportRideMode || "—"}</p>
                                <p className="text-sm text-white/75">الترمينال: {detail.trip.airportTerminal || "—"}</p>
                                <p className="text-sm text-white/75">رقم الرحلة: {detail.trip.flightNumber || "—"}</p>
                                <p className="text-sm text-white/75">موعد التحرك: {detail.trip.airportDepartureLabel || (detail.trip.airportDepartureTime ? new Date(detail.trip.airportDepartureTime).toLocaleString("ar-EG") : "—")}</p>
                                <p className="text-sm text-white/75">ميعاد الرحلة: {detail.trip.flightTime ? new Date(detail.trip.flightTime).toLocaleString("ar-EG") : "—"}</p>
                            </div>
                        </div>
                    ) : null}

                    {detail.trip.riderNotes ? (
                        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs tracking-[0.2em] text-white/40">ملاحظات</p>
                            <p className="mt-3 text-sm leading-7 text-white/75">{detail.trip.riderNotes}</p>
                        </div>
                    ) : null}
                </SectionCard>
            </section>
        </div>
    );
}



