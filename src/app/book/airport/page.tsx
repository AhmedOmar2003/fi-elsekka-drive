import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { AirportRideForm } from "@/components/ui/ride-airport-form";

export default function AirportRidePage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex-1 max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8">
        <AirportRideForm />
      </main>
      <Footer />
    </>
  );
}
