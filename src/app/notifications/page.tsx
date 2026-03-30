import { Header } from "@/components/layout/header";
import { NotificationItem } from "@/components/ride/shared";
import { notificationItems } from "@/lib/ride-content";

export default function NotificationsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex-1 w-full max-w-md px-4 pt-24 pb-32 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-foreground">الإشعارات</h1>
          <p className="mt-2 text-sm text-gray-400">تابع جديد مشاويرك وحالة طلبك أول بأول.</p>
        </div>
        <div className="space-y-3">
          {notificationItems.map((item) => (
            <NotificationItem key={item.id} title={item.title} body={item.body} time={item.time} tone={item.tone} />
          ))}
        </div>
      </main>
    </>
  );
}
