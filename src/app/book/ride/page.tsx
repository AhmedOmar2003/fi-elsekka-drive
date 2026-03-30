import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { NormalRideForm } from "@/components/ui/ride-normal-form";

export default function NormalRidePage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex-1 max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8">
        <NormalRideForm />
      </main>
      <Footer />
    </>
  );
}
