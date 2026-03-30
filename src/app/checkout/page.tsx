import { redirect } from "next/navigation";

export default function LegacyCheckoutPage() {
  redirect("/trip/confirm");
}
