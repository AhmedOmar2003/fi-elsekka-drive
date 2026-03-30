import Link from "next/link";
import { notFound } from "next/navigation";

import { DriverStateActions } from "@/components/admin-dashboard/actions";
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
                    Back to drivers
                </Link>
                <h1 className="mt-2 text-3xl font-black">{detail.profile.fullName}</h1>
            </div>

            <section className="grid gap-4 lg:grid-cols-4">
                <MetricPanel label="Application" value={detail.driverProfile.applicationStatus} />
                <MetricPanel label="Verification" value={detail.driverProfile.verificationStatus} />
                <MetricPanel label="Availability" value={detail.driverProfile.availabilityStatus} />
                <MetricPanel label="Account" value={detail.profile.accountStatus} sublabel={detail.driverProfile.workingCity} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                <SectionCard title="Driver profile" subtitle="Personal and operational data">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Contact</p>
                            <p className="mt-3 text-sm text-white/75">{detail.profile.phone || "No phone"}</p>
                            <p className="mt-1 text-sm text-white/45">{detail.profile.email || "No email"}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Area</p>
                            <p className="mt-3 text-sm text-white/75">{detail.driverProfile.workingCity}</p>
                            <p className="mt-1 text-sm text-white/45">{detail.driverProfile.workingArea || "No secondary area"}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 md:col-span-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Operational notes</p>
                            <p className="mt-3 text-sm leading-7 text-white/75">{detail.driverProfile.operationalNotes || "No notes yet."}</p>
                            {detail.driverProfile.suspensionReason ? <p className="mt-3 text-sm text-rose-300">Suspension reason: {detail.driverProfile.suspensionReason}</p> : null}
                        </div>
                    </div>
                </SectionCard>

                <DriverStateActions driverId={detail.profile.id} />
            </section>

            <SectionCard title="Vehicle records" subtitle="Cars and tuk-tuks linked to this captain">
                <DataTable
                    columns={[
                        { key: "vehicle", label: "Vehicle" },
                        { key: "type", label: "Type" },
                        { key: "plate", label: "Plate" },
                        { key: "approval", label: "Approval" },
                    ]}
                    rows={detail.vehicles.map((vehicle) => ({
                        vehicle: <div><p className="font-semibold">{vehicle.label}</p><p className="mt-1 text-xs text-white/45">{vehicle.isPrimary ? "Primary vehicle" : "Secondary vehicle"}</p></div>,
                        type: vehicle.vehicleType,
                        plate: vehicle.plateNumber || "—",
                        approval: <StatusBadge status={vehicle.approvalStatus} />,
                    }))}
                    emptyState="No vehicles linked to this driver yet."
                />
            </SectionCard>

            <SectionCard title="Documents" subtitle="Uploaded files and review state">
                <DataTable
                    columns={[
                        { key: "type", label: "Document type" },
                        { key: "file", label: "File name" },
                        { key: "approval", label: "Approval" },
                        { key: "created", label: "Uploaded" },
                    ]}
                    rows={detail.documents.map((doc) => ({
                        type: doc.documentType,
                        file: <span className="font-mono text-xs text-white/70">{doc.fileName || `${doc.storageBucket}/${doc.storagePath}`}</span>,
                        approval: <StatusBadge status={doc.approvalStatus} />,
                        created: new Date(doc.createdAt).toLocaleString("en-GB"),
                    }))}
                    emptyState="No documents uploaded yet."
                />
            </SectionCard>

            <SectionCard title="Recent trip history" subtitle="Latest rides completed or handled by this driver">
                <DataTable
                    columns={[
                        { key: "trip", label: "Trip" },
                        { key: "customer", label: "Customer" },
                        { key: "route", label: "Route" },
                        { key: "status", label: "Status" },
                    ]}
                    rows={detail.recentTrips.map((trip) => ({
                        trip: <Link href={`/admin/trips/${trip.id}`} className="font-mono text-xs text-primary">{trip.id.slice(0, 8)}</Link>,
                        customer: trip.customerName,
                        route: <div><p>{trip.pickup}</p><p className="mt-1 text-xs text-white/45">{trip.destination}</p></div>,
                        status: <StatusBadge status={trip.status} />,
                    }))}
                    emptyState="No trip history for this driver yet."
                />
            </SectionCard>
        </div>
    );
}
