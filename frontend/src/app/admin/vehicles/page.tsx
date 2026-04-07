import Link from "next/link";

import { VehicleApprovalActions } from "@/components/admin-dashboard/actions";
import { DataTable, SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchVehiclesList } from "@/lib/admin-dashboard-data";

export default async function AdminVehiclesPage() {
    const vehicles = await fetchVehiclesList();

    return (
        <div className="space-y-6">
            <SectionCard title="إدارة المركبات" subtitle="قبول ورفض ومراجعة بيانات العربيات والتكاتك">
                <DataTable
                    columns={[
                        { key: "vehicleId", label: "رقم المركبة" },
                        { key: "driver", label: "الكابتن" },
                        { key: "type", label: "نوع المركبة" },
                        { key: "brand", label: "الماركة / الموديل" },
                        { key: "plate", label: "رقم اللوحة" },
                        { key: "approval", label: "المراجعة" },
                        { key: "actions", label: "الإجراءات" },
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
                    emptyState="مفيش مركبات موجودة."
                />
            </SectionCard>
        </div>
    );
}
