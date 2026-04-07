import { redirect } from "next/navigation";

export default function AdminOperationsLegacyRedirect() {
    redirect("/admin/dispatch");
}
