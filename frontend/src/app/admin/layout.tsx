"use client";

import { ReactNode } from "react";

import { AdminDashboardShell } from "@/components/admin-dashboard/shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
    return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
