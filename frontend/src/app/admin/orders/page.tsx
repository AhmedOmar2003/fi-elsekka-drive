import { redirect } from "next/navigation";

export default function AdminOrdersLegacyRedirect() {
    redirect("/admin/trips");
}
