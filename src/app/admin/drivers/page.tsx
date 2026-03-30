import Link from "next/link";

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
            <SectionCard title="Drivers management" subtitle="Approval queue, live availability, and fleet performance">
                <form className="space-y-4">
                    <FilterBar>
                        <Select name="approvalStatus" defaultValue={approvalStatus} className="bg-white/5 text-white">
                            <option value="all">All approvals</option>
                            <option value="pending">pending</option>
                            <option value="approved">approved</option>
                            <option value="rejected">rejected</option>
                            <option value="suspended">suspended</option>
                        </Select>
                        <Select name="vehicleType" defaultValue={vehicleType} className="bg-white/5 text-white">
                            <option value="all">All vehicle types</option>
                            <option value="car">car</option>
                            <option value="tuk_tuk">tuk_tuk</option>
                        </Select>
                        <Select name="availabilityStatus" defaultValue={availabilityStatus} className="bg-white/5 text-white">
                            <option value="all">All live states</option>
                            <option value="online">online</option>
                            <option value="offline">offline</option>
                            <option value="busy">busy</option>
                        </Select>
                        <Input name="city" defaultValue={city} placeholder="Filter by city" className="bg-white/5 text-white" />
                        <button className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white">Apply filters</button>
                    </FilterBar>
                </form>

                <div className="mt-5">
                    <DataTable
                        columns={[
                            { key: "driver", label: "Driver" },
                            { key: "vehicle", label: "Vehicle" },
                            { key: "live", label: "Live status" },
                            { key: "approval", label: "Approval" },
                            { key: "city", label: "City" },
                            { key: "trips", label: "Completed trips" },
                            { key: "actions", label: "Actions", className: "text-left" },
                        ]}
                        rows={drivers.map((driver) => ({
                            driver: (
                                <div>
                                    <p className="font-semibold">{driver.fullName}</p>
                                    <p className="mt-1 text-xs text-white/45">{driver.phone || "No phone"}</p>
                                </div>
                            ),
                            vehicle: <span className="text-white/70">{driver.vehicleType || "No primary vehicle"}</span>,
                            live: <StatusBadge status={driver.availabilityStatus} />,
                            approval: <StatusBadge status={driver.applicationStatus} />,
                            city: <div><p>{driver.city || "—"}</p><p className="mt-1 text-xs text-white/45">{driver.area || "—"}</p></div>,
                            trips: <span className="font-semibold">{driver.tripsCompleted}</span>,
                            actions: (
                                <Link href={`/admin/drivers/${driver.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                                    View driver
                                </Link>
                            ),
                        }))}
                        emptyState="No drivers match the current filters."
                    />
                </div>
            </SectionCard>
        </div>
    );
}
