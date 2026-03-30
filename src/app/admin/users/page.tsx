import { DataTable, SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchCustomersList } from "@/lib/admin-dashboard-data";

export default async function AdminUsersPage() {
    const customers = await fetchCustomersList();

    return (
        <div className="space-y-6">
            <SectionCard title="العملاء المسجلين" subtitle="كل الحسابات اللي سجلت من واجهة العميل">
                <DataTable
                    columns={[
                        { key: "name", label: "المستخدم" },
                        { key: "email", label: "الإيميل" },
                        { key: "phone", label: "الموبايل" },
                        { key: "status", label: "الحالة" },
                        { key: "created", label: "تاريخ التسجيل" },
                    ]}
                    rows={customers.map((customer) => ({
                        name: (
                            <div>
                                <p className="font-semibold">{customer.fullName}</p>
                                <p className="mt-1 text-xs text-white/45">{customer.id.slice(0, 8)}</p>
                            </div>
                        ),
                        email: <span className="text-white/75">{customer.email || "—"}</span>,
                        phone: <span className="text-white/75">{customer.phone || "—"}</span>,
                        status: <StatusBadge status={customer.status} />,
                        created: (
                            <div>
                                <p>{new Date(customer.createdAt).toLocaleDateString("ar-EG")}</p>
                                <p className="mt-1 text-xs text-white/45">
                                    {new Date(customer.createdAt).toLocaleTimeString("ar-EG", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </p>
                            </div>
                        ),
                    }))}
                    emptyState="لسه مفيش عملاء مسجلين."
                />
            </SectionCard>
        </div>
    );
}
