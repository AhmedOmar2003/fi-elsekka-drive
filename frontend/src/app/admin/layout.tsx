import { ReactNode } from "react";

import { AdminDashboardShell } from "@/components/admin-dashboard/shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminLayout({ children }: { children: ReactNode }) {
    return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
