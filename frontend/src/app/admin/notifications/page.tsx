import Link from "next/link";
import { NotificationComposer } from "@/components/admin-dashboard/actions";
import { DataTable, SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchAdminInboxNotifications, fetchAnnouncements } from "@/lib/admin-dashboard-data";

export default async function AdminNotificationsPage() {
    const inbox = await fetchAdminInboxNotifications();
    const announcements = await fetchAnnouncements();

    return (
        <div className="space-y-6">
            <NotificationComposer />

            <SectionCard title="تنبيهات الإدارة" subtitle="أحداث تشغيلية داخلية زي تسجيل عميل جديد">
                <DataTable
                    columns={[
                        { key: "title", label: "العنوان" },
                        { key: "recipient", label: "وصلت لمين" },
                        { key: "status", label: "الحالة" },
                        { key: "created", label: "وقت الإنشاء" },
                    ]}
                    rows={inbox.map((item) => ({
                        title: (
                            <div>
                                <p className="font-semibold">{item.title}</p>
                                <p className="mt-1 text-xs text-white/45">{item.body}</p>
                                <Link href={item.link} className="mt-2 inline-flex text-xs font-bold text-primary hover:underline">
                                    فتح التفاصيل
                                </Link>
                            </div>
                        ),
                        recipient: item.recipientName || "إدارة",
                        status: <StatusBadge status={item.isRead ? "completed" : "pending"} />,
                        created: new Date(item.createdAt).toLocaleString("ar-EG"),
                    }))}
                    emptyState="لسه مفيش تنبيهات داخلية."
                />
            </SectionCard>

            <SectionCard title="سجل الإعلانات" subtitle="الإشعارات المجدولة والمباشرة المرسلة من التشغيل">
                <DataTable
                    columns={[
                        { key: "title", label: "العنوان" },
                        { key: "audience", label: "الفئة" },
                        { key: "status", label: "الحالة" },
                        { key: "window", label: "الجدولة" },
                        { key: "created", label: "تاريخ الإنشاء" },
                    ]}
                    rows={announcements.map((item) => ({
                        title: <div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-white/45">{item.body}</p></div>,
                        audience: item.audience,
                        status: <StatusBadge status={item.isActive ? "active" : "cancelled"} />,
                        window: <div><p>{item.startsAt ? new Date(item.startsAt).toLocaleString("ar-EG") : "فوري"}</p><p className="mt-1 text-xs text-white/45">{item.endsAt ? new Date(item.endsAt).toLocaleString("ar-EG") : "من غير انتهاء"}</p></div>,
                        created: <div><p>{new Date(item.createdAt).toLocaleString("ar-EG")}</p><p className="mt-1 text-xs text-white/45">{item.createdByName || "أدمن"}</p></div>,
                    }))}
                    emptyState="لسه مفيش إعلانات متسجلة."
                />
            </SectionCard>
        </div>
    );
}
