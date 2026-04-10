"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { TripDispatchForm } from "@/components/admin-dashboard/actions";
import { Button } from "@/components/ui/button";

type WizardDriver = {
    id: string;
    fullName: string;
    vehicleId: string | null;
    vehicleLabel: string | null;
};

const STEP_LABELS = ["حدد السعر", "تأكيد العميل", "تعيين الكابتن"] as const;

function resolveUnlockedStep(hasAdminPrice: boolean, customerPriceConfirmed: boolean) {
    if (!hasAdminPrice) return 0;
    if (!customerPriceConfirmed) return 1;
    return 2;
}

export function TripOpsWizard({
    tripId,
    mapEstimatedPrice,
    adminSelectedPrice,
    customerPriceConfirmed,
    assignableDrivers,
}: {
    tripId: string;
    mapEstimatedPrice: number | null;
    adminSelectedPrice: number | null;
    customerPriceConfirmed: boolean;
    assignableDrivers: WizardDriver[];
}) {
    const router = useRouter();
    const unlockedStep = useMemo(
        () => resolveUnlockedStep(adminSelectedPrice !== null, customerPriceConfirmed),
        [adminSelectedPrice, customerPriceConfirmed]
    );
    const [currentStep, setCurrentStep] = useState(unlockedStep);

    useEffect(() => {
        setCurrentStep(unlockedStep);
    }, [unlockedStep]);

    useEffect(() => {
        if (unlockedStep !== 1) return;
        const timer = window.setInterval(() => {
            router.refresh();
        }, 10000);
        return () => window.clearInterval(timer);
    }, [router, unlockedStep]);

    return (
        <div className="space-y-5 rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-0">
                {STEP_LABELS.map((label, index) => {
                    const isDone = index < unlockedStep;
                    const isCurrent = index === currentStep;
                    return (
                        <div key={label} className="flex flex-1 items-center gap-3">
                            <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                                    isDone || isCurrent
                                        ? "border-primary bg-primary text-white"
                                        : "border-white/10 bg-white/[0.03] text-white/45"
                                }`}
                            >
                                {index + 1}
                            </div>
                            <p className={`text-sm font-black ${isDone || isCurrent ? "text-white" : "text-white/45"}`}>{label}</p>
                            {index < STEP_LABELS.length - 1 ? (
                                <div className={`hidden h-px flex-1 md:block ${index < unlockedStep ? "bg-primary" : "bg-white/10"}`} />
                            ) : null}
                        </div>
                    );
                })}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
                {currentStep === 0 ? (
                    <TripDispatchForm
                        tripId={tripId}
                        broadcastDrivers={[]}
                        assignableDrivers={assignableDrivers}
                        mapEstimatedPrice={mapEstimatedPrice}
                        initialMode="dispatch_offer"
                        lockMode="dispatch_offer"
                        compact
                        defaultPrice={adminSelectedPrice?.toString() || ""}
                    />
                ) : null}

                {currentStep === 1 ? (
                    <div className="flex min-h-40 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
                        <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-200">
                            بانتظار تأكيد العميل
                        </div>
                        <p className="text-sm text-white/65">
                            {adminSelectedPrice !== null ? `السعر المحدد ${adminSelectedPrice} ج.م` : "تم إرسال السعر للعميل"}
                        </p>
                        <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => router.refresh()}>
                            تحديث
                        </Button>
                    </div>
                ) : null}

                {currentStep === 2 ? (
                    <TripDispatchForm
                        tripId={tripId}
                        broadcastDrivers={assignableDrivers}
                        assignableDrivers={assignableDrivers}
                        mapEstimatedPrice={mapEstimatedPrice}
                        initialMode="assign_driver"
                        lockMode="assign_driver"
                        compact
                        defaultPrice={adminSelectedPrice?.toString() || ""}
                    />
                ) : null}
            </div>

            <div className="flex items-center justify-between gap-3">
                <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    disabled={currentStep === 0}
                    onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
                >
                    السابق
                </Button>
                <Button
                    disabled={currentStep >= unlockedStep || currentStep === STEP_LABELS.length - 1}
                    onClick={() => setCurrentStep((step) => Math.min(unlockedStep, step + 1))}
                >
                    التالي
                </Button>
            </div>
        </div>
    );
}
