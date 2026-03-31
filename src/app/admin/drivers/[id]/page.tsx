import Link from "next/link";
import { notFound } from "next/navigation";

import { DriverCredentialsForm, DriverStateActions } from "@/components/admin-dashboard/actions";
import { DataTable, MetricPanel, SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchDriverDetail } from "@/lib/admin-dashboard-data";

type Params = Promise<{ id: string }>;

export default async function AdminDriverDetailsPage({ params }: { params: Params }) {
    const { id } = await params;
    const detail = await fetchDriverDetail(id);

    if (!detail || !detail.profile || !detail.driverProfile) notFound();

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/drivers" className="text-sm text-primary">
                    الرجوع للكباتن
                </Link>
                <h1 className="mt-2 text-3xl font-black">{detail.profile.fullName}</h1>
            </div>

            <section className="grid gap-4 lg:grid-cols-4">
                <MetricPanel label="طلب الانضمام" value={detail.driverProfile.applicationStatus} />
                <MetricPanel label="التحقق" value={detail.driverProfile.verificationStatus} />
                <MetricPanel label="التواجد" value={detail.driverProfile.availabilityStatus} />
                <MetricPanel label="الحساب" value={detail.profile.accountStatus} sublabel={detail.driverProfile.workingCity} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                <SectionCard title="ملف الكابتن" subtitle="البيانات الشخصية والتشغيلية">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs tracking-[0.2em] text-white/40">التواصل</p>
                            <p className="mt-3 text-sm text-white/75">{detail.profile.phone || "مفيش رقم"}</p>
                            <p className="mt-1 text-sm text-white/45">{detail.profile.email || "مفيش إيميل"}</p>
                            <p className={`mt-2 text-xs ${detail.authAccount.exists ? "text-emerald-300/90" : "text-amber-300/90"}`}>
                                {detail.authAccount.exists
                                    ? `حساب الدخول جاهز${detail.authAccount.lastSignInAt ? ` · آخر دخول ${new Date(detail.authAccount.lastSignInAt).toLocaleString("ar-EG")}` : ""}`
                                    : "حساب الدخول غير موجود في Auth"}
                            </p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs tracking-[0.2em] text-white/40">منطقة التشغيل</p>
                            <p className="mt-3 text-sm text-white/75">{detail.driverProfile.workingCity}</p>
                            <p className="mt-1 text-sm text-white/45">{detail.driverProfile.workingArea || "مفيش منطقة إضافية"}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 md:col-span-2">
                            <p className="text-xs tracking-[0.2em] text-white/40">ملاحظات تشغيلية</p>
                            <p className="mt-3 text-sm leading-7 text-white/75">{detail.driverProfile.operationalNotes || "لسه مفيش ملاحظات."}</p>
                            {detail.driverProfile.suspensionReason ? <p className="mt-3 text-sm text-rose-300">سبب الإيقاف: {detail.driverProfile.suspensionReason}</p> : null}
                        </div>
                    </div>
                </SectionCard>

                <div className="space-y-4">
                    <DriverStateActions driverId={detail.profile.id} />
                    <DriverCredentialsForm
                        driverId={detail.profile.id}
                        currentEmail={detail.authAccount.email || detail.profile.email}
                        currentPhone={detail.profile.phone}
                        authExists={detail.authAccount.exists}
                    />
                </div>
            </section>

            <SectionCard title="سجل المركبات" subtitle="العربيات والتكاتك المرتبطة بالكابتن">
                <DataTable
                    columns={[
                        { key: "vehicle", label: "المركبة" },
                        { key: "type", label: "النوع" },
                        { key: "plate", label: "اللوحة" },
                        { key: "approval", label: "المراجعة" },
                    ]}
                    rows={detail.vehicles.map((vehicle) => ({
                        vehicle: <div><p className="font-semibold">{vehicle.label}</p><p className="mt-1 text-xs text-white/45">{vehicle.isPrimary ? "المركبة الأساسية" : "مركبة إضافية"}</p></div>,
                        type: vehicle.vehicleType,
                        plate: vehicle.plateNumber || "—",
                        approval: <StatusBadge status={vehicle.approvalStatus} />,
                    }))}
                    emptyState="لسه مفيش مركبات مربوطة بالكابتن ده."
                />
            </SectionCard>

            <SectionCard title="المستندات" subtitle="الملفات المرفوعة وحالة مراجعتها">
                <DataTable
                    columns={[
                        { key: "type", label: "نوع المستند" },
                        { key: "file", label: "اسم الملف" },
                        { key: "approval", label: "المراجعة" },
                        { key: "created", label: "وقت الرفع" },
                    ]}
                    rows={detail.documents.map((doc) => ({
                        type: doc.documentType,
                        file: <span className="font-mono text-xs text-white/70">{doc.fileName || `${doc.storageBucket}/${doc.storagePath}`}</span>,
                        approval: <StatusBadge status={doc.approvalStatus} />,
                        created: new Date(doc.createdAt).toLocaleString("ar-EG"),
                    }))}
                    emptyState="لسه مفيش مستندات مرفوعة."
                />
            </SectionCard>

            <SectionCard title="أحدث المشاوير" subtitle="آخر المشاوير اللي الكابتن اشتغل عليها">
                <DataTable
                    columns={[
                        { key: "trip", label: "المشوار" },
                        { key: "customer", label: "العميل" },
                        { key: "route", label: "خط السير" },
                        { key: "status", label: "الحالة" },
                    ]}
                    rows={detail.recentTrips.map((trip) => ({
                        trip: <Link href={`/admin/trips/${trip.id}`} className="font-mono text-xs text-primary">{trip.id.slice(0, 8)}</Link>,
                        customer: trip.customerName,
                        route: <div><p>{trip.pickup}</p><p className="mt-1 text-xs text-white/45">{trip.destination}</p></div>,
                        status: <StatusBadge status={trip.status} />,
                    }))}
                    emptyState="لسه مفيش تاريخ مشاوير للكابتن ده."
                />
            </SectionCard>
        </div>
    );
}
