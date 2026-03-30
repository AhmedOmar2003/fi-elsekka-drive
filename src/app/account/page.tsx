import Link from "next/link";
import { Header } from "@/components/layout/header";
import { EmptyState, StatusBadge } from "@/components/ride/shared";
import { Button } from "@/components/ui/button";
import { profileSavedPlaces, tripHistory } from "@/lib/ride-content";

export default function AccountPage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex-1 w-full max-w-md px-4 pt-24 pb-32 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-foreground">حسابي</h1>
          <p className="mt-2 text-sm text-gray-400">أهلاً يا أحمد، ده ملخص حسابك.</p>
        </div>

        <div className="space-y-6">
          {/* Profile Card */}
          <div className="rounded-[32px] bg-surface-container-low border border-white/5 shadow-sm p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-primary/10 text-2xl font-black text-primary">أ</div>
              <div>
                <h2 className="text-2xl font-black text-foreground">أحمد رمضان</h2>
                <p className="text-sm text-gray-500" dir="ltr">0100 224 1188</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-white/5 bg-surface-container/50 px-4 py-3">
                <p className="text-xs font-black text-gray-500">الرحلات</p>
                <p className="mt-1 text-2xl font-black text-foreground">18</p>
              </div>
              <div className="rounded-[24px] border border-white/5 bg-surface-container/50 px-4 py-3">
                <p className="text-xs font-black text-gray-500">الأماكن</p>
                <p className="mt-1 text-2xl font-black text-foreground">3</p>
              </div>
            </div>
          </div>

          {/* Saved Places */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-xl font-black text-foreground">أماكن محفوظة</h3>
              <Button variant="outline" size="sm" className="rounded-full text-xs h-8 border-white/10 bg-transparent">أضف</Button>
            </div>
            <div className="space-y-3">
              {profileSavedPlaces.map((place) => (
                <div key={place.name} className="flex flex-col rounded-[24px] border border-white/5 bg-surface-container-low px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-foreground">{place.name}</p>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">محفوظ</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-500">{place.address}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Trips */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-xl font-black text-foreground">آخر الرحلات</h3>
              <Button asChild variant="outline" size="sm" className="rounded-full text-xs h-8 border-white/10 bg-transparent">
                <Link href="/trips">الكل</Link>
              </Button>
            </div>
            <div className="space-y-3">
              {tripHistory.slice(0, 2).map((trip) => (
                <Link key={trip.id} href={trip.href} className="block rounded-[24px] border border-white/5 bg-surface-container-low px-5 py-4 transition-colors hover:bg-surface-container active:scale-[0.98]">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-sm font-black text-foreground">{trip.title}</p>
                    <StatusBadge status={trip.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{trip.date}</p>
                    <p className="text-sm font-black text-primary">{trip.price}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          
          <Button asChild variant="ghost" className="w-full text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-full">
            <Link href="/login">تسجيل الخروج</Link>
          </Button>

        </div>
      </main>
    </>
  );
}
