import { redirect } from "next/navigation";

export default function AdminLoginLegacyRedirect() {
    redirect("/system-access/login");
}
