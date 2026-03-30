import Link from "next/link";

import { VehicleApprovalActions } from "@/components/admin-dashboard/actions";
import { DataTable, SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchVehiclesList } from "@/lib/admin-dashboard-data";

export default async function AdminVehiclesPage() {
    const vehicles = await fetchVehiclesList();

    return (
        <div className="space-y-6">
            <SectionCard title="Vehicles management" subtitle="Approve, reject, and review fleet records for cars and tuk-tuks">
                <DataTable
                    columns={[
                        { key: "vehicleId", label: "Vehicle ID" },
                        { key: "driver", label: "Driver" },
                        { key: "type", label: "Vehicle type" },
                        { key: "brand", label: "Brand / Model" },
                        { key: "plate", label: "Plate number" },
                        { key: "approval", label: "Approval" },
                        { key: "actions", label: "Actions" },
                    ]}
                    rows={vehicles.map((vehicle) => ({
                        vehicleId: <span className="font-mono text-xs text-white/70">{vehicle.id.slice(0, 8)}</span>,
                        driver: (
                            <Link href={`/admin/drivers/${vehicle.driverId}`} className="font-semibold text-white transition hover:text-primary">
                                {vehicle.driverName}
                            </Link>
                        ),
                        type: vehicle.vehicleType,
                        brand: <div><p>{vehicle.brand}</p><p className="mt-1 text-xs text-white/45">{vehicle.model}</p></div>,
                        plate: vehicle.plateNumber || "—",
                        approval: <StatusBadge status={vehicle.approvalStatus} />,
                        actions: <VehicleApprovalActions vehicleId={vehicle.id} />,
                    }))}
                    emptyState="No vehicles found."
                />
            </SectionCard>
        </div>
    );
}
