import { redirect } from "next/navigation";

export default function AdminSearchRequestsLegacyRedirect() {
    redirect("/admin/trips?status=searching_driver");
}
