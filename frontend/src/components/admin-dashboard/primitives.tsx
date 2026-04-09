import Link from "next/link";
import { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

type Tone = "primary" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<Tone, string> = {
    primary: "border-primary/20 bg-primary/10 text-primary",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    danger: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    info: "border-sky-500/20 bg-sky-500/10 text-sky-300",
};

export function statusTone(status: string): Tone {
    switch (status) {
        case "completed":
        case "approved":
        case "active":
        case "available":
            return "success";
        case "cancelled":
        case "rejected":
        case "suspended":
            return "danger";
        case "pending":
        case "searching_driver":
        case "requires_review":
        case "waiting_user":
            return "warning";
        case "accepted":
        case "driver_on_the_way":
        case "driver_arrived":
        case "trip_started":
        case "waiting_for_return":
        case "offered":
        case "busy":
            return "info";
        default:
            return "primary";
    }
}

export function formatLabel(value: string) {
    const labels: Record<string, string> = {
        completed: "مكتمل",
        approved: "مقبول",
        active: "نشط",
        available: "متاح",
        cancelled: "ملغي",
        rejected: "مرفوض",
        suspended: "موقوف",
        pending: "معلّق",
        searching_driver: "بندور على كابتن",
        requires_review: "محتاج مراجعة",
        waiting_user: "مستني العميل",
        accepted: "اتقبل",
        driver_on_the_way: "الكابتن في الطريق",
        driver_arrived: "الكابتن وصل",
        trip_started: "المشوار بدأ",
        waiting_for_return: "في انتظار الرجوع",
        offered: "اتعرض على كابتن",
        busy: "مشغول",
        airport_ride: "مشوار مطار",
        normal_ride: "مشوار عادي",
        car: "عربية",
        tuk_tuk: "توك توك",
        in_progress: "شغال عليها",
        resolved: "اتحلّت",
        closed: "اتقفلت",
        internal: "داخلي",
        all: "الكل",
        customers: "العملاء",
        drivers: "الكباتن",
        admins: "الإدارة",
    };

    return labels[value] || value.replaceAll("_", " ");
}

export function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
    return (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-black text-white">{title}</h2>
                    {subtitle ? <p className="mt-1 text-sm text-white/55">{subtitle}</p> : null}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

export function StatsCard({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: Tone }) {
    return (
        <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
            <div className="flex items-center justify-between gap-3">
                <Badge className={TONE_CLASSES[tone]} variant="outline">
                    {label}
                </Badge>
                <span className="text-3xl font-black">{value.toLocaleString()}</span>
            </div>
            <p className="mt-4 text-sm text-white/55">{hint}</p>
        </div>
    );
}

export function StatusBadge({ status }: { status: string }) {
    return (
        <Badge className={TONE_CLASSES[statusTone(status)]} variant="outline">
            {formatLabel(status)}
        </Badge>
    );
}

export function FilterBar({ children }: { children: ReactNode }) {
    return <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.025] p-4 md:grid-cols-2 xl:grid-cols-5">{children}</div>;
}

export function DataTable({
    columns,
    rows,
    emptyState,
}: {
    columns: Array<{ key: string; label: string; className?: string }>;
    rows: Array<Record<string, ReactNode>>;
    emptyState?: string;
}) {
    return (
        <div className="overflow-hidden rounded-[24px] border border-white/10">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-white/[0.04] text-right text-white/50">
                        <tr>
                            {columns.map((column) => (
                                <th key={column.key} className={`px-4 py-3 font-semibold ${column.className || ""}`}>
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {rows.length === 0 ? (
                            <tr>
                                <td className="px-4 py-8 text-center text-white/45" colSpan={columns.length}>
                                    {emptyState || "لسه مفيش بيانات."}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, index) => (
                                <tr key={index} className="bg-white/[0.01] text-white/80 transition hover:bg-white/[0.035]">
                                    {columns.map((column) => (
                                        <td key={column.key} className={`px-4 py-4 align-top ${column.className || ""}`}>
                                            {row[column.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function BarList({ data, max = 1 }: { data: Array<{ label: string; value: number }>; max?: number }) {
    const safeMax = max || Math.max(...data.map((item) => item.value), 1);

    return (
        <div className="space-y-3">
            {data.map((item) => (
                <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-white/75">{item.label}</span>
                        <span className="font-semibold text-white">{item.value}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/8">
                        <div className="h-2.5 rounded-full bg-gradient-to-l from-primary to-emerald-300" style={{ width: `${Math.max((item.value / safeMax) * 100, 6)}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function TripTimeline({
    items,
}: {
    items: Array<{ id: number; status: string; note: string | null; createdAt: string; changedByName: string | null }>;
}) {
    return (
        <div className="space-y-4">
            {items.map((item, index) => (
                <div key={item.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                        <div className={`h-3.5 w-3.5 rounded-full ${TONE_CLASSES[statusTone(item.status)]}`} />
                        {index < items.length - 1 ? <div className="mt-2 h-full w-px bg-white/10" /> : null}
                    </div>
                    <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <StatusBadge status={item.status} />
                            <span className="text-xs text-white/45">{new Date(item.createdAt).toLocaleString("ar-EG")}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/80">{item.note || "تم تحديث الحالة من غير ملاحظة إضافية."}</p>
                        <p className="mt-2 text-xs text-white/45">بواسطة: {item.changedByName || "النظام"}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function MetricPanel({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
    return (
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
            <p className="mt-3 text-2xl font-black">{value}</p>
            {sublabel ? <p className="mt-2 text-sm text-white/55">{sublabel}</p> : null}
        </div>
    );
}

export function EntityLink({ href, title, subtitle }: { href: string; title: string; subtitle?: string | null }) {
    return (
        <Link href={href} className="block rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-primary/25 hover:bg-white/[0.05]">
            <p className="font-semibold text-white">{title}</p>
            {subtitle ? <p className="mt-1 text-sm text-white/55">{subtitle}</p> : null}
        </Link>
    );
}
