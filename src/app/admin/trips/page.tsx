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
            <SectionCard title="Trips management" subtitle="Browse, filter, and drill into every ride request in the system">
                <form className="space-y-4">
                    <FilterBar>
                        <Select name="status" defaultValue={status} className="bg-white/5 text-white">
                            <option value="all">All statuses</option>
                            {["pending", "searching_driver", "offered", "accepted", "driver_on_the_way", "driver_arrived", "trip_started", "completed", "cancelled"].map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </Select>
                        <Select name="tripType" defaultValue={tripType} className="bg-white/5 text-white">
                            <option value="all">All trip types</option>
                            <option value="airport_ride">airport_ride</option>
                            <option value="normal_ride">normal_ride</option>
                        </Select>
                        <Select name="driverId" defaultValue={driverId} className="bg-white/5 text-white">
                            <option value="all">All drivers</option>
                            {drivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                    {driver.fullName}
                                </option>
                            ))}
                        </Select>
                        <Input name="city" defaultValue={city} placeholder="Filter by city" className="bg-white/5 text-white" />
                        <button className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white">Apply filters</button>
                    </FilterBar>
                </form>

                <div className="mt-5">
                    <DataTable
                        columns={[
                            { key: "id", label: "Trip ID" },
                            { key: "customer", label: "Customer" },
                            { key: "driver", label: "Driver" },
                            { key: "type", label: "Type" },
                            { key: "route", label: "Route" },
                            { key: "status", label: "Status" },
                            { key: "created", label: "Created" },
                            { key: "actions", label: "Actions", className: "text-left" },
                        ]}
                        rows={trips.map((trip) => ({
                            id: <span className="font-mono text-xs text-white/70">{trip.id.slice(0, 8)}</span>,
                            customer: <div><p className="font-semibold">{trip.customerName}</p><p className="text-xs text-white/45">{trip.city || "Unknown city"}</p></div>,
                            driver: trip.driverName || <span className="text-white/40">Unassigned</span>,
                            type: <span className="text-white/70">{trip.tripType}</span>,
                            route: <div><p className="text-white/70">{trip.pickup}</p><p className="mt-1 text-xs text-white/45">{trip.destination}</p></div>,
                            status: <StatusBadge status={trip.status} />,
                            created: new Date(trip.createdAt).toLocaleString("en-GB"),
                            actions: (
                                <Link href={`/admin/trips/${trip.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                                    Open details
                                </Link>
                            ),
                        }))}
                        emptyState="No trips match the current filters."
                    />
                </div>
            </SectionCard>
        </div>
    );
}
