import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { DriverCard, StatusBadge, VehicleCard } from "@/components/ride/shared";
import { liveTripCaptain, tripHistory } from "@/lib/ride-content";
import { MapPin, Navigation } from "lucide-react";

export default async function TripDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = tripHistory.find((entry) => entry.id === id);

  if (!trip) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="mx-auto flex-1 w-full max-w-md px-4 pt-24 pb-32 animate-fade-in relative">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-foreground mb-2">{trip.title}</h1>
            <p className="text-sm text-gray-400">{trip.date}</p>
          </div>
          <StatusBadge status={trip.status} />
        </div>

        <div className="space-y-4">
          {/* Static Map Snapshot Fake */}
          <div className="w-full h-40 rounded-[28px] overflow-hidden relative border border-white/5 bg-surface-container">
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(61,161,132,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(61,161,132,0.1)_1px,transparent_1px)] [background-size:20px_20px]" />
             <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex items-center justify-between pointer-events-none">
                <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center ring-4 ring-primary/20" />
                <div className="flex-1 h-0.5 bg-primary/50 border-t-2 border-dashed border-primary/50 relative top-0" />
                <div className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center ring-4 ring-secondary/20" />
             </div>
          </div>

          <div className="bg-surface-container-low border border-white/5 rounded-[28px] p-5">
            <h2 className="text-lg font-black text-foreground border-b border-white/10 pb-3 mb-4">ملخص الرحلة</h2>
            
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center py-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <div className="w-px h-6 bg-surface-border my-1" />
                  <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                </div>
                <div className="flex-1 flex flex-col justify-between py-0">
                  <p className="text-sm font-black text-foreground">مدينة نصر - عباس العقاد</p>
                  <p className="text-sm font-black text-foreground">التجمع الخامس - شارع التسعين</p>
                </div>
              </div>

              <div className="h-px bg-white/5 w-full my-2" />

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400 font-bold">التكلفة النهائية</span>
                <span className="text-lg font-black text-primary">{trip.price}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
             <h2 className="text-lg font-black text-foreground px-2">معلومات الكابتن</h2>
             <DriverCard name={liveTripCaptain.name} rating={liveTripCaptain.rating} phone={liveTripCaptain.phone} eta={liveTripCaptain.eta} />
             <VehicleCard title={liveTripCaptain.vehicleName} subtitle={`لون ${liveTripCaptain.color}`} plate={liveTripCaptain.plate} />
          </div>
        </div>
      </main>
    </>
  );
}
