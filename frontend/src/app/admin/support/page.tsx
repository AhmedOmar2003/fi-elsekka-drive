import Link from "next/link";

import { DataTable, SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchSupportTickets } from "@/lib/admin-dashboard-data";

export default async function AdminSupportPage() {
    const tickets = await fetchSupportTickets();

    return (
        <div className="space-y-6">
            <SectionCard title="صندوق الدعم" subtitle="الشكاوى ومشاكل المشاوير والتصعيدات">
                <DataTable
                    columns={[
                        { key: "ticket", label: "رقم التذكرة" },
                        { key: "user", label: "المستخدم" },
                        { key: "trip", label: "رقم المشوار" },
                        { key: "category", label: "التصنيف" },
                        { key: "status", label: "الحالة" },
                        { key: "created", label: "وقت الإنشاء" },
                        { key: "actions", label: "الإجراءات" },
                    ]}
                    rows={tickets.map((ticket) => ({
                        ticket: <div><p className="font-mono text-xs text-white/70">{ticket.id.slice(0, 8)}</p><p className="mt-1 text-xs text-white/45">{ticket.subject}</p></div>,
                        user: ticket.userName,
                        trip: ticket.tripId ? <Link href={`/admin/trips/${ticket.tripId}`} className="text-primary">{ticket.tripId.slice(0, 8)}</Link> : "—",
                        category: ticket.category,
                        status: <StatusBadge status={ticket.status} />,
                        created: new Date(ticket.createdAt).toLocaleString("ar-EG"),
                        actions: (
                            <Link href={`/admin/support/${ticket.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                                فتح المحادثة
                            </Link>
                        ),
                    }))}
                    emptyState="لسه مفيش تذاكر دعم."
                />
            </SectionCard>
        </div>
    );
}
