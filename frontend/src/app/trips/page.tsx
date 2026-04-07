import Link from "next/link";
import { Header } from "@/components/layout/header";
import { EmptyState, StatusBadge } from "@/components/ride/shared";
import { tripHistory } from "@/lib/ride-content";

export default function TripsPage() {
  const upcoming = tripHistory.filter((trip) => trip.status === "upcoming");
  const completed = tripHistory.filter((trip) => trip.status === "completed");
  const cancelled = tripHistory.filter((trip) => trip.status === "cancelled");

  return (
    <>
      <Header />
      <main className="mx-auto flex-1 w-full max-w-md px-4 pt-24 pb-32 animate-fade-in">
        
        <div className="mb-6">
          <h1 className="text-3xl font-black text-foreground">الرحلات</h1>
          <p className="mt-2 text-sm text-gray-400">تابع مشاويرك الجاية والقديمة بكل سهولة.</p>
        </div>

        <div className="space-y-8">
          {[
            { title: "الرحلات القادمة", items: upcoming },
            { title: "الرحلات المكتملة", items: completed },
            { title: "الرحلات الملغية", items: cancelled },
          ].map((section) => (
            <div key={section.title} className="space-y-4">
              <h2 className="text-xl font-black text-foreground border-b border-white/10 pb-2">{section.title}</h2>
              <div className="space-y-3">
                {section.items.length > 0 ? (
                  section.items.map((trip) => (
                    <Link key={trip.id} href={trip.href} className="block rounded-[24px] border border-white/5 bg-surface-container-low px-5 py-4 transition-colors hover:bg-surface-container active:scale-[0.98]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-foreground">{trip.title}</p>
                        <StatusBadge status={trip.status} />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">{trip.date}</p>
                      <p className="mt-3 text-sm font-black text-primary">{trip.price}</p>
                    </Link>
                  ))
                ) : (
                  <EmptyState title="لا توجد رحلات" description={`لا توجد سجلات في قسم ${section.title}.`} />
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
