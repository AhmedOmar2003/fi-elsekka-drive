"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { formatLabel } from "@/components/admin-dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { optimizeImageForUpload } from "@/lib/image-upload";

async function sendJson<T = Record<string, unknown>>(url: string, method: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(payload.error || "فشل تنفيذ الإجراء");
    }

    return payload as T;
}

async function sendFormData(url: string, body: FormData) {
    const response = await fetch(url, {
        method: "POST",
        body,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || "فشل تنفيذ الإجراء");
    }

    return payload;
}

async function prepareUploadFile(file: File) {
    if (file.type.startsWith("image/")) {
        return optimizeImageForUpload(file, { maxDimension: 1200, quality: 0.72 });
    }

    return file;
}

async function uploadCaptainDocument(url: string, documentType: string, file: File | null, vehicleId?: string | null) {
    if (!file) return;

    const prepared = await prepareUploadFile(file);
    if (prepared.size > 4 * 1024 * 1024) {
        throw new Error(`ملف ${file.name} ما زال كبير. صغّره أو ارفعه PDF أخف.`);
    }

    const formData = new FormData();
    formData.set("documentType", documentType);
    formData.set("file", prepared);
    if (vehicleId) {
        formData.set("vehicleId", vehicleId);
    }

    await sendFormData(url, formData);
}

export function TripStatusForm({ tripId, currentStatus }: { tripId: string; currentStatus: string }) {
    const router = useRouter();
    const [status, setStatus] = useState(currentStatus);
    const [isPending, startTransition] = useTransition();

    return (
        <div className="relative z-30 space-y-3 overflow-visible rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <Label className="text-white/75">غيّر حالة المشوار</Label>
            <div className="flex flex-col gap-3 md:flex-row">
                <Select value={status} onChange={(event) => setStatus(event.target.value)} className="bg-white/5 text-white">
                    {["pending", "searching_driver", "offered", "accepted", "driver_on_the_way", "driver_arrived", "trip_started", "completed", "cancelled"].map((item) => (
                        <option key={item} value={item}>
                            {formatLabel(item)}
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
    broadcastDrivers,
    assignableDrivers,
}: {
    tripId: string;
    broadcastDrivers: Array<{ id: string; fullName: string; vehicleId: string | null; vehicleLabel: string | null }>;
    assignableDrivers: Array<{ id: string; fullName: string; vehicleId: string | null; vehicleLabel: string | null }>;
}) {
    const router = useRouter();
    const hasBroadcastDrivers = broadcastDrivers.length > 0;
    const hasAssignableDrivers = assignableDrivers.length > 0;
    const [driverId, setDriverId] = useState(assignableDrivers[0]?.id || "");
    const [price, setPrice] = useState("");
    const [mode, setMode] = useState<"dispatch_offer" | "assign_driver">("dispatch_offer");
    const [isPending, startTransition] = useTransition();

    const selectedDriver = assignableDrivers.find((driver) => driver.id === driverId);
    const isDirectAssign = mode === "assign_driver";

    return (
        <div className="relative z-30 space-y-3 overflow-visible rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <Label className="text-white/75">إجراء التوزيع</Label>
            <div className="grid items-start gap-3 md:grid-cols-[220px_1fr]">
                <Select value={mode} onChange={(event) => setMode(event.target.value as "dispatch_offer" | "assign_driver")} className="relative z-30 bg-white/5 text-white">
                    <option value="dispatch_offer">تسعير ثم بث للكباتن</option>
                    <option value="assign_driver">اسناد مباشر لكابتن</option>
                </Select>
                <Input
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="السعر اللي الإدارة اعتمدته"
                    className="bg-white/5 text-white"
                    dir="ltr"
                    inputMode="decimal"
                />
            </div>

            {isDirectAssign ? (
                <Select value={driverId} onChange={(event) => setDriverId(event.target.value)} className="relative z-30 bg-white/5 text-white" disabled={!hasAssignableDrivers}>
                    {hasAssignableDrivers ? (
                        assignableDrivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                                {driver.fullName}{driver.vehicleLabel ? ` · ${driver.vehicleLabel}` : ""}
                            </option>
                        ))
                    ) : (
                        <option value="">مفيش كباتن متاحين حاليًا</option>
                    )}
                </Select>
            ) : (
                <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-3 text-sm text-white/70">
                    {hasBroadcastDrivers
                        ? `العرض هيتبعت تلقائيًا إلى ${broadcastDrivers.length} كباتن متاحين بالمركبة المناسبة، وأول كابتن يقبله هيتسند له المشوار.`
                        : "مفيش كباتن أونلاين وجاهزين حاليًا لاستقبال بث المشوار ده."}
                </div>
            )}

            <Button
                isLoading={isPending}
                disabled={(!hasBroadcastDrivers && !isDirectAssign) || (!hasAssignableDrivers && isDirectAssign) || (isDirectAssign && !driverId)}
                onClick={() =>
                    startTransition(async () => {
                        await sendJson(`/api/admin/platform/trips/${tripId}`, "PATCH", {
                            action: mode,
                            driverId: isDirectAssign ? driverId : null,
                            vehicleId: isDirectAssign ? selectedDriver?.vehicleId || null : null,
                            price: price.trim() || null,
                        });
                        toast.success(isDirectAssign ? "تم الإسناد المباشر بنجاح." : "تم تسعير المشوار وإرساله للكباتن المتاحين.");
                        router.refresh();
                    })
                }
            >
                {isDirectAssign ? "اسند للكابتن" : "سعّر وابعت للكباتن"}
            </Button>
            {!hasBroadcastDrivers ? <p className="text-xs text-amber-300/90">البث التلقائي يحتاج كباتن أونلاين ومفعلين استقبال العروض.</p> : null}
            {!hasAssignableDrivers ? <p className="text-xs text-amber-300/90">الإسناد المباشر يحتاج على الأقل كابتن معتمد ومركبة أساسية جاهزة.</p> : null}
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
        <div className="relative z-30 space-y-3 overflow-visible rounded-3xl border border-white/10 bg-white/[0.025] p-4">
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

export function CreateCaptainForm() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [vehicleType, setVehicleType] = useState("car");
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [nationalId, setNationalId] = useState("");
    const [workingCity, setWorkingCity] = useState("");
    const [workingArea, setWorkingArea] = useState("");
    const [brand, setBrand] = useState("");
    const [model, setModel] = useState("");
    const [color, setColor] = useState("");
    const [manufacturingYear, setManufacturingYear] = useState(String(new Date().getFullYear()));
    const [plateNumber, setPlateNumber] = useState("");
    const [seatCount, setSeatCount] = useState("4");
    const [operatingArea, setOperatingArea] = useState("");
    const [vehicleCondition, setVehicleCondition] = useState("");
    const [adminNotes, setAdminNotes] = useState("");
    const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
    const [nationalIdPhoto, setNationalIdPhoto] = useState<File | null>(null);
    const [driverLicensePhoto, setDriverLicensePhoto] = useState<File | null>(null);
    const [vehicleLicensePhoto, setVehicleLicensePhoto] = useState<File | null>(null);
    const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);
    const [criminalRecordPhoto, setCriminalRecordPhoto] = useState<File | null>(null);

    const resetForm = () => {
        setFullName("");
        setPhone("");
        setEmail("");
        setPassword("");
        setNationalId("");
        setWorkingCity("");
        setWorkingArea("");
        setBrand("");
        setModel("");
        setColor("");
        setManufacturingYear(String(new Date().getFullYear()));
        setPlateNumber("");
        setSeatCount("4");
        setOperatingArea("");
        setVehicleCondition("");
        setAdminNotes("");
        setProfilePhoto(null);
        setNationalIdPhoto(null);
        setDriverLicensePhoto(null);
        setVehicleLicensePhoto(null);
        setVehiclePhoto(null);
        setCriminalRecordPhoto(null);
        setVehicleType("car");
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        startTransition(async () => {
            try {
                const payload = await sendJson<{ userId: string; vehicleId: string; loginLink: string }>("/api/admin/platform/drivers", "POST", {
                    fullName,
                    phone,
                    email,
                    password,
                    nationalId,
                    workingCity,
                    workingArea,
                    vehicleType,
                    brand,
                    model,
                    color,
                    manufacturingYear,
                    plateNumber,
                    seatCount,
                    operatingArea,
                    vehicleCondition,
                    adminNotes,
                });
                const documentsUrl = `/api/admin/platform/drivers/${payload.userId}/documents`;

                await uploadCaptainDocument(documentsUrl, "profile_photo", profilePhoto);
                await uploadCaptainDocument(documentsUrl, "national_id", nationalIdPhoto);
                await uploadCaptainDocument(documentsUrl, "driver_license", driverLicensePhoto);
                await uploadCaptainDocument(documentsUrl, "criminal_record", criminalRecordPhoto);
                await uploadCaptainDocument(documentsUrl, "vehicle_license", vehicleLicensePhoto, payload.vehicleId);
                await uploadCaptainDocument(documentsUrl, "vehicle_photo", vehiclePhoto, payload.vehicleId);

                toast.success(`تم إنشاء حساب الكابتن. رابط الدخول: /captain/login`);
                resetForm();
                setIsOpen(false);
                router.refresh();
            } catch (error: any) {
                toast.error(error?.message || "تعذر إنشاء حساب الكابتن.");
            }
        });
    };

    return (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-lg font-black text-white">قسم الكباتن</p>
                    <p className="mt-1 text-sm text-white/55">
                        إضافة كابتن جديد يدويًا من الإدارة مع إنشاء الحساب والمركبة والمستندات الأساسية مرة واحدة.
                    </p>
                </div>
                <Button type="button" onClick={() => setIsOpen((current) => !current)} className="md:min-w-44">
                    {isOpen ? "قفل الفورم" : "إضافة كابتن"}
                </Button>
            </div>

            {isOpen ? (
                <form onSubmit={handleSubmit} className="mt-5 space-y-5">
                    <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                            <p className="text-xs text-white/45">الحساب</p>
                            <p className="mt-1 text-sm font-bold text-white">إيميل + باسورد</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                            <p className="text-xs text-white/45">البيانات الشخصية</p>
                            <p className="mt-1 text-sm font-bold text-white">اسم + رقم + قومي</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                            <p className="text-xs text-white/45">المركبة</p>
                            <p className="mt-1 text-sm font-bold text-white">نوع + لوحة + تشغيل</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                            <p className="text-xs text-white/45">المرفقات</p>
                            <p className="mt-1 text-sm font-bold text-white">صور ومستندات</p>
                        </div>
                    </div>

                    <div className="max-h-[72vh] space-y-5 overflow-y-auto pe-2">
                        <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                            <p className="text-sm font-black text-white">بيانات الحساب والدخول</p>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-white/75">اسم الكابتن بالكامل</Label>
                                    <Input value={fullName} onChange={(event) => setFullName(event.target.value)} className="bg-white/5 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">رقم الموبايل</Label>
                                    <Input value={phone} onChange={(event) => setPhone(event.target.value)} className="bg-white/5 text-white" dir="ltr" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">الإيميل</Label>
                                    <Input value={email} onChange={(event) => setEmail(event.target.value)} className="bg-white/5 text-white" dir="ltr" placeholder="captain@gmail.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">الباسورد</Label>
                                    <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="bg-white/5 text-white" dir="ltr" placeholder="هيستخدمه الكابتن في تسجيل الدخول" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">الرقم القومي</Label>
                                    <Input value={nationalId} onChange={(event) => setNationalId(event.target.value)} className="bg-white/5 text-white" dir="ltr" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">المدينة الأساسية</Label>
                                    <Input value={workingCity} onChange={(event) => setWorkingCity(event.target.value)} className="bg-white/5 text-white" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-white/75">المنطقة / نطاق العمل</Label>
                                    <Input value={workingArea} onChange={(event) => setWorkingArea(event.target.value)} className="bg-white/5 text-white" placeholder="مثال: منيا القمح - مشتول السوق" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                            <p className="text-sm font-black text-white">بيانات المركبة والتشغيل</p>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-white/75">نوع المركبة</Label>
                                    <Select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} className="bg-white/5 text-white">
                                        <option value="car">عربية</option>
                                        <option value="tuk_tuk">توك توك</option>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">منطقة تشغيل المركبة</Label>
                                    <Input value={operatingArea} onChange={(event) => setOperatingArea(event.target.value)} className="bg-white/5 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">الماركة</Label>
                                    <Input value={brand} onChange={(event) => setBrand(event.target.value)} className="bg-white/5 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">الموديل</Label>
                                    <Input value={model} onChange={(event) => setModel(event.target.value)} className="bg-white/5 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">اللون</Label>
                                    <Input value={color} onChange={(event) => setColor(event.target.value)} className="bg-white/5 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">سنة الصنع</Label>
                                    <Input value={manufacturingYear} onChange={(event) => setManufacturingYear(event.target.value)} className="bg-white/5 text-white" dir="ltr" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">رقم اللوحة</Label>
                                    <Input value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} className="bg-white/5 text-white" />
                                </div>
                                {vehicleType === "car" ? (
                                    <div className="space-y-2">
                                        <Label className="text-white/75">عدد المقاعد</Label>
                                        <Input value={seatCount} onChange={(event) => setSeatCount(event.target.value)} className="bg-white/5 text-white" dir="ltr" />
                                    </div>
                                ) : null}
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-white/75">حالة المركبة / ملاحظات تشغيل</Label>
                                    <Input value={vehicleCondition} onChange={(event) => setVehicleCondition(event.target.value)} className="bg-white/5 text-white" placeholder="مثال: حالة ممتازة - شغال داخل المدينة فقط" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                            <p className="text-sm font-black text-white">الصور والمستندات</p>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-white/75">صورة الكابتن</Label>
                                    <Input type="file" accept="image/*" onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)} className="bg-white/5 text-white file:text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">صورة البطاقة</Label>
                                    <Input type="file" accept="image/*,application/pdf" onChange={(event) => setNationalIdPhoto(event.target.files?.[0] || null)} className="bg-white/5 text-white file:text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">رخصة القيادة</Label>
                                    <Input type="file" accept="image/*,application/pdf" onChange={(event) => setDriverLicensePhoto(event.target.files?.[0] || null)} className="bg-white/5 text-white file:text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">رخصة المركبة</Label>
                                    <Input type="file" accept="image/*,application/pdf" onChange={(event) => setVehicleLicensePhoto(event.target.files?.[0] || null)} className="bg-white/5 text-white file:text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">صورة المركبة</Label>
                                    <Input type="file" accept="image/*" onChange={(event) => setVehiclePhoto(event.target.files?.[0] || null)} className="bg-white/5 text-white file:text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/75">فيش / صحيفة حالة جنائية</Label>
                                    <Input type="file" accept="image/*,application/pdf" onChange={(event) => setCriminalRecordPhoto(event.target.files?.[0] || null)} className="bg-white/5 text-white file:text-white" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-white/75">ملاحظات داخلية للإدارة</Label>
                                    <textarea
                                        value={adminNotes}
                                        onChange={(event) => setAdminNotes(event.target.value)}
                                        className="min-h-28 w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/35"
                                        placeholder="أي ملاحظة داخلية عن الكابتن أو التشغيل أو المستندات"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-white/10 pt-4 md:flex-row md:justify-end">
                        <Button type="button" variant="ghost" className="border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => { resetForm(); setIsOpen(false); }}>
                            إلغاء
                        </Button>
                        <Button type="submit" isLoading={isPending} className="md:min-w-48">
                            حفظ الكابتن وإنشاء الحساب
                        </Button>
                    </div>
                </form>
            ) : null}
        </div>
    );
}






export function DriverCredentialsForm({
    driverId,
    currentEmail,
    currentPhone,
    authExists,
}: {
    driverId: string;
    currentEmail: string | null;
    currentPhone: string | null;
    authExists: boolean;
}) {
    const router = useRouter();
    const [email, setEmail] = useState(currentEmail || "");
    const [phone, setPhone] = useState(currentPhone || "");
    const [password, setPassword] = useState("");
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        startTransition(async () => {
            try {
                await sendJson(`/api/admin/platform/drivers/${driverId}`, "PATCH", {
                    action: "update_credentials",
                    email,
                    phone,
                    password,
                });
                toast.success("اتحدثت بيانات دخول الكابتن بنجاح.");
                setPassword("");
                router.refresh();
            } catch (error: any) {
                toast.error(error?.message || "تعذر تحديث بيانات الدخول.");
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="relative z-30 space-y-3 overflow-visible rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <Label className="text-white/75">بيانات دخول الكابتن</Label>
            <p className={`text-xs ${authExists ? "text-emerald-300/90" : "text-amber-300/90"}`}>
                {authExists ? "حساب الدخول موجود في Auth وجاهز للتعديل." : "حساب الدخول ده غير موجود في Auth، وده غالبًا سبب فشل تسجيل الدخول."}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="captain@gmail.com" className="bg-white/5 text-white" dir="ltr" />
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="رقم الموبايل" className="bg-white/5 text-white" dir="ltr" />
                <div className="space-y-2 md:col-span-2">
                    <Input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="اكتب باسورد جديد لو حابب تغيّره"
                        className="bg-white/5 text-white"
                        dir="ltr"
                    />
                    <p className="text-xs text-white/45">سيب الباسورد فاضي لو عاوز تعدّل الإيميل أو الرقم فقط.</p>
                </div>
            </div>
            <Button type="submit" isLoading={isPending}>
                حفظ بيانات الدخول
            </Button>
        </form>
    );
}
