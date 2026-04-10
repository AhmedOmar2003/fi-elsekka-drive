"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useMemo, useState } from "react";
import {
    Bell,
    CarFront,
    ClipboardList,
    Headset,
    LayoutDashboard,
    LogOut,
    Menu,
    Send,
    Settings,
    Shield,
    UserCog,
    Users,
    X,
} from "lucide-react";

import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { hasFullAdminAccess, hasPermission } from "@/lib/permissions";
import { signOut } from "@/services/authService";

type AdminShellProps = {
    children: ReactNode;
};

const NAV_ITEMS = [
    { href: "/admin", label: "النظرة العامة", icon: LayoutDashboard, fullAdmin: true },
    { href: "/admin/trips", label: "المشاوير", icon: ClipboardList, permission: "view_orders" as const },
    { href: "/admin/drivers", label: "الكباتن", icon: Users, permission: "view_drivers" as const },
    { href: "/admin/vehicles", label: "المركبات", icon: CarFront, permission: "view_drivers" as const },
    { href: "/admin/dispatch", label: "التوزيع", icon: Send, permission: "assign_driver" as const },
    { href: "/admin/support", label: "الدعم", icon: Headset, permission: "view_orders" as const },
    { href: "/admin/users", label: "العملاء", icon: Users, permission: "manage_users" as const },
    { href: "/admin/notifications", label: "الإشعارات", icon: Bell, permission: "manage_settings" as const },
    { href: "/admin/staff", label: "فريق التشغيل", icon: UserCog, permission: "manage_admins" as const },
    { href: "/admin/settings", label: "الإعدادات", icon: Settings, permission: "manage_settings" as const },
];

function roleLabel(role?: string | null) {
    switch (role) {
        case "super_admin":
            return "سوبر أدمن";
        case "admin":
            return "أدمن";
        case "operations_manager":
            return "مسؤول توزيع";
        case "support_agent":
            return "مسؤول دعم";
        case "catalog_manager":
            return "مشرف تشغيل";
        default:
            return "فريق التشغيل";
    }
}

export function AdminDashboardShell({ children }: AdminShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, profile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const visibleItems = useMemo(() => {
        if (!profile && !user) {
            return NAV_ITEMS;
        }

        return NAV_ITEMS.filter((item) => {
            if (item.fullAdmin) return hasFullAdminAccess(profile);
            if (!item.permission) return true;
            return hasPermission(profile, item.permission);
        });
    }, [profile, user]);

    const pageTitle = useMemo(() => {
        const current = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
        return current?.label || "لوحة التحكم";
    }, [pathname]);

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    return (
        <div className="min-h-screen bg-[#061512] text-white">
            <div className="flex min-h-screen">
                <aside className="hidden w-72 shrink-0 border-l border-white/10 bg-[#081c18] xl:flex xl:flex-col">
                    <div className="border-b border-white/10 px-6 py-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                                <Shield className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-lg font-black">في السكة</p>
                                <p className="text-xs text-white/60">لوحة تشغيل في السكة</p>
                            </div>
                        </div>
                    </div>

                    <nav className="flex-1 space-y-1 px-4 py-6">
                        {visibleItems.map((item) => {
                            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                                        active
                                            ? "bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(20,148,111,0.25)]"
                                            : "text-white/70 hover:bg-white/5 hover:text-white"
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="border-t border-white/10 px-4 py-5">
                        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-sm font-semibold">{profile?.full_name || user?.email || "أدمن"}</p>
                            <p className="mt-1 text-xs text-white/55">{roleLabel(profile?.role)}</p>
                        </div>
                        <Button variant="outline" className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={handleLogout}>
                            <LogOut className="h-4 w-4" />
                            تسجيل الخروج
                        </Button>
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#061512]/90 backdrop-blur">
                        <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-6">
                            <div className="flex items-center gap-3">
                                <button
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white xl:hidden"
                                    onClick={() => setIsOpen(true)}
                                >
                                    <Menu className="h-5 w-5" />
                                </button>
                                <div>
                                    <p className="text-xs tracking-[0.3em] text-white/40">في السكة</p>
                                    <h1 className="text-xl font-black">{pageTitle}</h1>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="hidden rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary md:block">
                                    جاهزين للتوزيع اللحظي
                                </div>
                                <div className="flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-1.5">
                                    <AdminNotificationBell />
                                </div>
                                <div className="flex h-11 min-w-[11rem] items-center justify-end rounded-2xl border border-white/10 bg-white/5 px-4 text-right">
                                    <div>
                                        <p className="text-sm font-semibold">{profile?.full_name || "أدمن"}</p>
                                        <p className="text-xs text-white/50">{roleLabel(profile?.role)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
                </div>
            </div>

            {isOpen ? (
                <div className="fixed inset-0 z-50 bg-black/60 xl:hidden" onClick={() => setIsOpen(false)}>
                    <div
                        className="absolute inset-y-0 right-0 w-72 border-l border-white/10 bg-[#081c18] p-4"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <p className="text-lg font-black">في السكة</p>
                                <p className="text-xs text-white/60">لوحة تشغيل في السكة</p>
                            </div>
                            <button className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5" onClick={() => setIsOpen(false)}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <nav className="space-y-1">
                            {visibleItems.map((item) => {
                                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                                            active ? "bg-primary/15 text-primary" : "text-white/70 hover:bg-white/5 hover:text-white"
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
