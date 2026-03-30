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
                        Back to trips
                    </Link>
                    <h1 className="mt-2 text-3xl font-black">Trip #{detail.trip.id.slice(0, 8)}</h1>
                </div>
                <StatusBadge status={detail.trip.status} />
            </div>

            <section className="grid gap-4 lg:grid-cols-4">
                <MetricPanel label="Trip type" value={detail.trip.tripType} />
                <MetricPanel label="Passengers" value={String(detail.trip.passengerCount)} />
                <MetricPanel label="Luggage" value={String(detail.trip.luggageCount)} sublabel="Airport rides only" />
                <MetricPanel label="Estimated price" value={detail.trip.estimatedPrice ? `${detail.trip.estimatedPrice} EGP` : "Pending"} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <SectionCard title="Trip summary" subtitle="Core route and rider information">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Pickup</p>
                            <p className="mt-3 text-lg font-bold">{detail.trip.pickupLabel}</p>
                            <p className="mt-2 text-sm text-white/55">{detail.trip.pickupAddress}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Destination</p>
                            <p className="mt-3 text-lg font-bold">{detail.trip.destinationLabel}</p>
                            <p className="mt-2 text-sm text-white/55">{detail.trip.destinationAddress}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Customer</p>
                            <p className="mt-3 text-lg font-bold">{detail.customer?.fullName || "Unknown customer"}</p>
                            <p className="mt-2 text-sm text-white/55">{detail.customer?.phone || "No phone"}</p>
                            <p className="mt-1 text-sm text-white/45">{detail.customer?.email || "No email"}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Assigned driver</p>
                            <p className="mt-3 text-lg font-bold">{detail.driver?.fullName || "Not assigned yet"}</p>
                            <p className="mt-2 text-sm text-white/55">{detail.driver?.phone || "No phone"}</p>
                            <p className="mt-1 text-sm text-white/45">{detail.vehicle?.label || "No vehicle selected"}</p>
                        </div>
                    </div>

                    {detail.trip.tripType === "airport_ride" ? (
                        <div className="mt-4 rounded-3xl border border-primary/15 bg-primary/10 p-4">
                            <p className="text-sm font-semibold text-primary">Airport ride details</p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <p className="text-sm text-white/75">Airport: {detail.trip.airportName || "—"}</p>
                                <p className="text-sm text-white/75">Mode: {detail.trip.airportRideMode || "—"}</p>
                                <p className="text-sm text-white/75">Terminal: {detail.trip.airportTerminal || "—"}</p>
                                <p className="text-sm text-white/75">Flight: {detail.trip.flightNumber || "—"}</p>
                                <p className="text-sm text-white/75 md:col-span-2">Flight time: {detail.trip.flightTime ? new Date(detail.trip.flightTime).toLocaleString("en-GB") : "—"}</p>
                            </div>
                        </div>
                    ) : null}

                    {detail.trip.riderNotes ? (
                        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Notes</p>
                            <p className="mt-3 text-sm leading-7 text-white/75">{detail.trip.riderNotes}</p>
                        </div>
                    ) : null}
                </SectionCard>

                <div className="space-y-6">
                    <TripDispatchForm tripId={detail.trip.id} drivers={dispatchBoard.availableDrivers.map((driver) => ({
                        id: driver.id,
                        fullName: driver.fullName,
                        vehicleId: driver.vehicleId,
                        vehicleLabel: driver.vehicleLabel,
                    }))} />
                    <TripStatusForm tripId={detail.trip.id} currentStatus={detail.trip.status} />
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <SectionCard title="Trip timeline" subtitle="Every change recorded on the trip">
                    <TripTimeline items={detail.timeline} />
                </SectionCard>

                <SectionCard title="Dispatch offers" subtitle="Driver decision flow for this trip">
                    <div className="space-y-3">
                        {detail.offers.map((offer) => (
                            <div key={offer.id} className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold">{offer.driverName}</p>
                                        <p className="mt-1 text-xs text-white/45">{new Date(offer.offeredAt).toLocaleString("en-GB")}</p>
                                    </div>
                                    <StatusBadge status={offer.offerStatus} />
                                </div>
                                {offer.rejectionReason ? <p className="mt-3 text-sm text-white/55">Reason: {offer.rejectionReason}</p> : null}
                            </div>
                        ))}
                        {detail.offers.length === 0 ? <p className="text-sm text-white/45">No offers have been sent yet.</p> : null}
                    </div>
                </SectionCard>
            </section>
        </div>
    );
}
