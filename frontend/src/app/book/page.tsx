import { Header } from "@/components/layout/header";
import { BookingForm } from "@/components/ui/ride-booking-form";

export default function BookingStartPage() {
  return (
    <>
      <Header />
      <main className="flex-1 w-full relative">
        <BookingForm />
      </main>
    </>
  );
}
