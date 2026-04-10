import Link from "next/link";
import { notFound } from "next/navigation";

import { TripDispatchForm, TripStatusForm } from "@/components/admin-dashboard/actions";
import { MetricPanel, SectionCard, StatusBadge, TripTimeline } from "@/components/admin-dashboard/primitives";
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

            <SectionCard title="خطوات التشغيل" subtitle="التسلسل البسيط لهذه الرحلة">
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                        <p className="text-xs tracking-[0.2em] text-white/40">1</p>
                        <p className="mt-3 text-sm font-black">حدد السعر النهائي</p>
                        <p className="mt-2 text-sm text-white/55">بعد إرسال الطلب تظهر الرحلة هنا بانتظار التسعير.</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                        <p className="text-xs tracking-[0.2em] text-white/40">2</p>
                        <p className="mt-3 text-sm font-black">انتظر تأكيد العميل</p>
                        <p className="mt-2 text-sm text-white/55">أول ما العميل يؤكد السعر، يصلك إشعار فورًا.</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                        <p className="text-xs tracking-[0.2em] text-white/40">3</p>
                        <p className="mt-3 text-sm font-black">عيّن كابتن مناسب</p>
                        <p className="mt-2 text-sm text-white/55">بعد التأكيد، افتح التعيين المباشر وحدد الكابتن المناسب.</p>
                    </div>
                </div>
            </SectionCard>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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

                <div className="space-y-6">
                    <TripDispatchForm
                        mapEstimatedPrice={detail.trip.mapEstimatedPrice}
                        tripId={detail.trip.id}
                        broadcastDrivers={dispatchBoard.availableDrivers.map((driver) => ({
                            id: driver.id,
                            fullName: driver.fullName,
                            vehicleId: driver.vehicleId,
                            vehicleLabel: driver.vehicleLabel,
                        }))}
                        assignableDrivers={dispatchBoard.assignableDrivers.map((driver) => ({
                            id: driver.id,
                            fullName: driver.fullName,
                            vehicleId: driver.vehicleId,
                            vehicleLabel: driver.vehicleLabel,
                        }))}
                    />
                    <TripStatusForm tripId={detail.trip.id} currentStatus={detail.trip.status} />
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <SectionCard title="تسلسل المشوار" subtitle="كل تغيير حصل على المشوار">
                    <TripTimeline items={detail.timeline} />
                </SectionCard>

                <SectionCard title="عروض التوزيع" subtitle="سجل العروض اللي اتبعتت للكباتن">
                    <div className="space-y-3">
                        {detail.offers.map((offer) => (
                            <div key={offer.id} className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold">{offer.driverName}</p>
                                        <p className="mt-1 text-xs text-white/45">{new Date(offer.offeredAt).toLocaleString("ar-EG")}</p>
                                    </div>
                                    <StatusBadge status={offer.offerStatus} />
                                </div>
                                {offer.rejectionReason ? <p className="mt-3 text-sm text-white/55">سبب الرفض: {offer.rejectionReason}</p> : null}
                            </div>
                        ))}
                        {detail.offers.length === 0 ? <p className="text-sm text-white/45">لسه مفيش عروض اتبعتت.</p> : null}
                    </div>
                </SectionCard>

                <SectionCard title="تقييم العميل" subtitle="بيظهر بعد اكتمال الرحلة">
                    {detail.review ? (
                        <div className="space-y-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-lg font-black text-white">{detail.review.customerName}</p>
                                    <p className="mt-1 text-sm text-white/55">قيّم الكابتن {detail.review.driverName}</p>
                                </div>
                                <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200">
                                    {detail.review.rating} / 5 نجوم
                                </div>
                            </div>
                            <p className="text-sm text-white/75">{detail.review.comment || 'العميل ما كتبش تعليق نصي، لكن سجّل تقييم بالنجوم.'}</p>
                            <p className="text-xs text-white/45">اتسجل التقييم يوم {new Date(detail.review.createdAt).toLocaleString("ar-EG")}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-white/45">لسه العميل ما قيّمش الرحلة دي.</p>
                    )}
                </SectionCard>
            </section>
        </div>
    );
}



