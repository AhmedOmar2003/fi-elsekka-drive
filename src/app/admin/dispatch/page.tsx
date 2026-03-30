import Link from "next/link";

import { TripDispatchForm } from "@/components/admin-dashboard/actions";
import { SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchDispatchBoard } from "@/lib/admin-dashboard-data";

export default async function AdminDispatchPage() {
    const board = await fetchDispatchBoard();

    return (
        <div className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <SectionCard title="طلبات محتاجة توزيع" subtitle="المشاوير اللي مستنية إرسال عرض أو إسناد مباشر">
                    <div className="space-y-4">
                        {board.activeTrips.map((trip) => (
                            <div key={trip.id} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold">{trip.customerName}</p>
                                        <p className="mt-1 text-xs text-white/45">{new Date(trip.createdAt).toLocaleString("ar-EG")}</p>
                                    </div>
                                    <StatusBadge status={trip.status} />
                                </div>
                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                                        <p className="text-xs tracking-[0.2em] text-white/35">من</p>
                                        <p className="mt-2 text-sm text-white/75">{trip.pickup}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                                        <p className="text-xs tracking-[0.2em] text-white/35">إلى</p>
                                        <p className="mt-2 text-sm text-white/75">{trip.destination}</p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <TripDispatchForm
                                        tripId={trip.id}
                                        drivers={board.availableDrivers.map((driver) => ({
                                            id: driver.id,
                                            fullName: driver.fullName,
                                            vehicleId: driver.vehicleId,
                                            vehicleLabel: driver.vehicleLabel,
                                        }))}
                                    />
                                </div>
                                <Link href={`/admin/trips/${trip.id}`} className="mt-3 inline-flex text-sm text-primary">
                                    فتح تفاصيل المشوار
                                </Link>
                            </div>
                        ))}
                        {board.activeTrips.length === 0 ? <p className="text-sm text-white/45">مفيش طلبات حالية في قائمة التوزيع.</p> : null}
                    </div>
                </SectionCard>

                <div className="space-y-6">
                    <SectionCard title="الكباتن المتاحين" subtitle="الكباتن الأونلاين مع مركباتهم الأساسية">
                        <div className="space-y-3">
                            {board.availableDrivers.map((driver) => (
                                <Link key={driver.id} href={`/admin/drivers/${driver.id}`} className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/25 hover:bg-white/[0.05]">
                                    <div>
                                        <p className="font-semibold">{driver.fullName}</p>
                                        <p className="mt-1 text-xs text-white/45">{driver.city}</p>
                                        <p className="mt-1 text-xs text-white/55">{driver.vehicleLabel || "مفيش مركبة أساسية"}</p>
                                    </div>
                                    <StatusBadge status={driver.availabilityStatus} />
                                </Link>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard title="مساحة الخريطة الجاهزة" subtitle="مكان مخصص للخريطة والوقت المتوقع وأقرب كابتن">
                        <div className="flex min-h-[22rem] items-center justify-center rounded-[28px] border border-dashed border-primary/25 bg-[radial-gradient(circle_at_center,rgba(20,148,111,0.12),transparent_45%)] text-center">
                            <div>
                                <p className="text-lg font-black">مكان الخريطة المباشرة</p>
                                <p className="mt-2 max-w-sm text-sm leading-7 text-white/55">
                                    الجزء ده جاهز يتوصل لاحقًا بمواقع الكباتن الحية، خطوط السير، كروت الوقت المتوقع، وتجميعات التوزيع من خلال Supabase Realtime وخرائط.
                                </p>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </section>
        </div>
    );
}
