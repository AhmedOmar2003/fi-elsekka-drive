"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

async function sendJson(url: string, method: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "فشل تنفيذ الإجراء");
    }
}

export function TripStatusForm({ tripId, currentStatus }: { tripId: string; currentStatus: string }) {
    const router = useRouter();
    const [status, setStatus] = useState(currentStatus);
    const [isPending, startTransition] = useTransition();

    return (
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <Label className="text-white/75">غيّر حالة المشوار</Label>
            <div className="flex flex-col gap-3 md:flex-row">
                <Select value={status} onChange={(event) => setStatus(event.target.value)} className="bg-white/5 text-white">
                    {["pending", "searching_driver", "offered", "accepted", "driver_on_the_way", "driver_arrived", "trip_started", "completed", "cancelled"].map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </Select>
                <Button
                    isLoading={isPending}
                    onClick={() =>
                        startTransition(async () => {
                            await sendJson(`/api/admin/platform/trips/${tripId}`, "PATCH", { action: "update_status", status });
                            router.refresh();
                        })
                    }
                >
                    حفظ الحالة
                </Button>
            </div>
        </div>
    );
}

export function TripDispatchForm({
    tripId,
    drivers,
}: {
    tripId: string;
    drivers: Array<{ id: string; fullName: string; vehicleId: string | null; vehicleLabel: string | null }>;
}) {
    const router = useRouter();
    const [driverId, setDriverId] = useState(drivers[0]?.id || "");
    const [mode, setMode] = useState<"dispatch_offer" | "assign_driver">("dispatch_offer");
    const [isPending, startTransition] = useTransition();

    const selectedDriver = drivers.find((driver) => driver.id === driverId);

    return (
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <Label className="text-white/75">إجراء التوزيع</Label>
            <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <Select value={driverId} onChange={(event) => setDriverId(event.target.value)} className="bg-white/5 text-white">
                    {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                            {driver.fullName} {driver.vehicleLabel ? `· ${driver.vehicleLabel}` : ""}
                        </option>
                    ))}
                </Select>
                <Select value={mode} onChange={(event) => setMode(event.target.value as "dispatch_offer" | "assign_driver")} className="bg-white/5 text-white">
                    <option value="dispatch_offer">ابعت عرض</option>
                    <option value="assign_driver">اسند مباشر</option>
                </Select>
                <Button
                    isLoading={isPending}
                    onClick={() =>
                        startTransition(async () => {
                            if (!driverId) return;
                            await sendJson(`/api/admin/platform/trips/${tripId}`, "PATCH", {
                                action: mode,
                                driverId,
                                vehicleId: selectedDriver?.vehicleId || null,
                            });
                            router.refresh();
                        })
                    }
                >
                    تنفيذ
                </Button>
            </div>
        </div>
    );
}

export function DriverStateActions({ driverId }: { driverId: string }) {
    const router = useRouter();
    const [note, setNote] = useState("");
    const [isPending, startTransition] = useTransition();

    const runAction = (action: string) =>
        startTransition(async () => {
            await sendJson(`/api/admin/platform/drivers/${driverId}`, "PATCH", { action, note });
            router.refresh();
        });

    return (
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <Label className="text-white/75">إجراءات الكابتن</Label>
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="ملاحظة إدارية أو سبب الإيقاف" className="bg-white/5 text-white" />
            <div className="flex flex-wrap gap-2">
                <Button isLoading={isPending} onClick={() => runAction("approve")} variant="secondary">
                    قبول
                </Button>
                <Button isLoading={isPending} onClick={() => runAction("reject")} variant="outline">
                    رفض
                </Button>
                <Button isLoading={isPending} onClick={() => runAction("suspend")} variant="danger">
                    إيقاف
                </Button>
                <Button isLoading={isPending} onClick={() => runAction("reactivate")} variant="ghost" className="border border-white/10 bg-white/5 text-white hover:bg-white/10">
                    إعادة تفعيل
                </Button>
            </div>
        </div>
    );
}

export function VehicleApprovalActions({ vehicleId }: { vehicleId: string }) {
    const router = useRouter();
    const [note, setNote] = useState("");
    const [isPending, startTransition] = useTransition();

    const runAction = (action: "approve" | "reject") =>
        startTransition(async () => {
            await sendJson(`/api/admin/platform/vehicles/${vehicleId}`, "PATCH", { action, note });
            router.refresh();
        });

    return (
        <div className="space-y-3">
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="ملاحظة المراجعة" className="bg-white/5 text-white" />
            <div className="flex gap-2">
                <Button isLoading={isPending} onClick={() => runAction("approve")} variant="secondary">
                    قبول
                </Button>
                <Button isLoading={isPending} onClick={() => runAction("reject")} variant="outline">
                    رفض
                </Button>
            </div>
        </div>
    );
}

export function SupportReplyForm({ ticketId }: { ticketId: string }) {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("in_progress");
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        startTransition(async () => {
            await sendJson(`/api/admin/platform/support/${ticketId}`, "POST", { message, status });
            setMessage("");
            router.refresh();
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <Label className="text-white/75">الرد على التذكرة</Label>
            <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-28 w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/35"
                placeholder="اكتب رد الدعم أو ملاحظة تشغيل داخلية"
            />
            <div className="flex flex-col gap-3 md:flex-row">
                <Select value={status} onChange={(event) => setStatus(event.target.value)} className="bg-white/5 text-white">
                    <option value="in_progress">شغال عليها</option>
                    <option value="waiting_user">مستني العميل</option>
                    <option value="resolved">اتحلّت</option>
                    <option value="closed">اتقفلت</option>
                </Select>
                <Button type="submit" isLoading={isPending}>
                    إرسال الرد
                </Button>
            </div>
        </form>
    );
}

export function NotificationComposer() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [audience, setAudience] = useState("all");
    const [startsAt, setStartsAt] = useState("");
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        startTransition(async () => {
            await sendJson("/api/admin/platform/announcements", "POST", {
                title,
                body,
                audience,
                startsAt: startsAt || null,
            });
            setTitle("");
            setBody("");
            setStartsAt("");
            router.refresh();
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label className="text-white/75">العنوان</Label>
                    <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="تحديث صيانة، تحديث مشاوير المطار..." className="bg-white/5 text-white" />
                </div>
                <div className="space-y-2">
                    <Label className="text-white/75">الفئة المستهدفة</Label>
                    <Select value={audience} onChange={(event) => setAudience(event.target.value)} className="bg-white/5 text-white">
                        <option value="all">الكل</option>
                        <option value="customers">العملاء</option>
                        <option value="drivers">الكباتن</option>
                        <option value="admins">الإدارة</option>
                    </Select>
                </div>
            </div>
            <div className="space-y-2">
                <Label className="text-white/75">الرسالة</Label>
                <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    className="min-h-32 w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/35"
                    placeholder="اكتب محتوى الإعلان أو الإشعار"
                />
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="space-y-2 md:w-72">
                    <Label className="text-white/75">وقت الإرسال</Label>
                    <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="bg-white/5 text-white" />
                </div>
                <Button type="submit" isLoading={isPending}>
                    إرسال الإعلان
                </Button>
            </div>
        </form>
    );
}
