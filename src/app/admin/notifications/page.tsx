import { NotificationComposer } from "@/components/admin-dashboard/actions";
import { DataTable, SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchAnnouncements } from "@/lib/admin-dashboard-data";

export default async function AdminNotificationsPage() {
    const announcements = await fetchAnnouncements();

    return (
        <div className="space-y-6">
            <NotificationComposer />

            <SectionCard title="Announcements history" subtitle="Scheduled and live notifications sent from operations">
                <DataTable
                    columns={[
                        { key: "title", label: "Title" },
                        { key: "audience", label: "Audience" },
                        { key: "status", label: "Status" },
                        { key: "window", label: "Schedule" },
                        { key: "created", label: "Created" },
                    ]}
                    rows={announcements.map((item) => ({
                        title: <div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-white/45">{item.body}</p></div>,
                        audience: item.audience,
                        status: <StatusBadge status={item.isActive ? "active" : "cancelled"} />,
                        window: <div><p>{item.startsAt ? new Date(item.startsAt).toLocaleString("en-GB") : "Immediate"}</p><p className="mt-1 text-xs text-white/45">{item.endsAt ? new Date(item.endsAt).toLocaleString("en-GB") : "No expiry"}</p></div>,
                        created: <div><p>{new Date(item.createdAt).toLocaleString("en-GB")}</p><p className="mt-1 text-xs text-white/45">{item.createdByName || "Admin"}</p></div>,
                    }))}
                    emptyState="No announcements have been created yet."
                />
            </SectionCard>
        </div>
    );
}
