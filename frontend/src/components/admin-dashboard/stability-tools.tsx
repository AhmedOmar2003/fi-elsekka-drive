"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Trash2, ZapOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { readAdminLightMode, writeAdminLightMode } from "@/lib/admin-stability-client";

type CleanupSummary = {
    targetedTrips: number;
    tripsDeleted: number;
    tripOffersDeleted: number;
    tripStatusHistoryDeleted: number;
    tripReviewsDeleted: number;
    notificationsDeleted: number;
    supportTicketsDeleted: number;
    supportMessagesDeleted: number;
};

type CleanupResponse = {
    success?: boolean;
    error?: string;
    message?: string;
    summary?: CleanupSummary;
};

async function postCleanup(scope: "safe_closed_trips" | "all_trips"): Promise<CleanupResponse> {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    const response = await fetch("/api/admin/platform/stability/cleanup", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ scope }),
    });

    const payload = (await response.json().catch(() => ({}))) as CleanupResponse;
    if (!response.ok) {
        throw new Error(payload.error || "تعذر تنفيذ تنظيف بيانات الاختبار.");
    }
    return payload;
}

export function AdminStabilityTools() {
    const router = useRouter();
    const [lightModeEnabled, setLightModeEnabled] = useState(() => readAdminLightMode());
    const [isSafeCleanupPending, setSafeCleanupPending] = useState(false);
    const [isFullCleanupPending, setFullCleanupPending] = useState(false);
    const [lastSummary, setLastSummary] = useState<CleanupSummary | null>(null);

    const disabled = isSafeCleanupPending || isFullCleanupPending;

    const modeLabel = useMemo(
        () => (lightModeEnabled ? "الوضع الخفيف مفعّل" : "الوضع الطبيعي مفعّل"),
        [lightModeEnabled]
    );

    const toggleLightMode = () => {
        const next = !lightModeEnabled;
        writeAdminLightMode(next);
        setLightModeEnabled(next);
        toast.success(next ? "تم تفعيل الوضع الخفيف لتقليل الضغط." : "تم الرجوع للوضع الطبيعي.");
    };

    const runSafeCleanup = async () => {
        setSafeCleanupPending(true);
        try {
            const result = await postCleanup("safe_closed_trips");
            if (result.summary) setLastSummary(result.summary);
            toast.success(result.message || "تم تنظيف البيانات التجريبية المنتهية.");
            router.refresh();
        } catch (error: any) {
            toast.error(error?.message || "تعذر تنفيذ التنظيف الآمن.");
        } finally {
            setSafeCleanupPending(false);
        }
    };

    const runFullCleanup = async () => {
        const confirmed = window.confirm(
            "ده هيمسح كل المشاوير التجريبية الحالية وملحقاتها (العروض/الحالات/إشعاراتها). المستخدمين والكباتن هيفضلوا موجودين. هل متأكد؟"
        );
        if (!confirmed) return;

        setFullCleanupPending(true);
        try {
            const result = await postCleanup("all_trips");
            if (result.summary) setLastSummary(result.summary);
            toast.success(result.message || "تم تنظيف كل بيانات المشاوير التجريبية.");
            router.refresh();
        } catch (error: any) {
            toast.error(error?.message || "تعذر تنفيذ التنظيف الشامل.");
        } finally {
            setFullCleanupPending(false);
        }
    };

    return (
        <section className="rounded-[28px] border border-primary/20 bg-primary/5 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-sm font-black text-white">استقرار وضع الاختبار</p>
                    <p className="mt-1 text-xs text-white/60">
                        أدوات سريعة لتخفيف الضغط بدون أي تغيير في بنية قاعدة البيانات.
                    </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/75">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    {modeLabel}
                </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Button
                    type="button"
                    variant={lightModeEnabled ? "secondary" : "outline"}
                    className={lightModeEnabled ? "" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}
                    onClick={toggleLightMode}
                >
                    <ZapOff className="h-4 w-4" />
                    {lightModeEnabled ? "إيقاف الوضع الخفيف" : "تفعيل الوضع الخفيف"}
                </Button>

                <Button type="button" isLoading={isSafeCleanupPending} disabled={disabled} onClick={runSafeCleanup}>
                    <Trash2 className="h-4 w-4" />
                    تنظيف آمن (منتهي/ملغي)
                </Button>

                <Button
                    type="button"
                    variant="danger"
                    isLoading={isFullCleanupPending}
                    disabled={disabled}
                    onClick={runFullCleanup}
                >
                    {isFullCleanupPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    تنظيف شامل للمشاوير
                </Button>
            </div>

            {lastSummary ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/75">
                    <p className="font-bold text-white">آخر نتيجة تنظيف</p>
                    <p className="mt-1">
                        المشاوير المستهدفة: {lastSummary.targetedTrips} · المحذوف: {lastSummary.tripsDeleted} ·
                        العروض: {lastSummary.tripOffersDeleted} · الحالة: {lastSummary.tripStatusHistoryDeleted} ·
                        الإشعارات: {lastSummary.notificationsDeleted}
                    </p>
                </div>
            ) : null}
        </section>
    );
}
