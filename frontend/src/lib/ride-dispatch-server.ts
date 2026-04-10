import { createRideServiceClient } from "@/lib/ride-server-auth";
import { sendPushToUserDevices } from "@/lib/user-push-server";

type RideServiceClient = NonNullable<ReturnType<typeof createRideServiceClient>>;

type TripDispatchTrip = {
    id: string;
    customer_id: string;
    trip_type: string;
    status: string;
    pickup_label: string | null;
    destination_label: string | null;
    estimated_price: number | null;
    metadata: Record<string, unknown> | null;
    assigned_driver_id?: string | null;
};

export type DriverCandidate = {
    id: string;
    fullName: string;
    workingCity: string | null;
    workingArea: string | null;
    vehicleId: string | null;
    vehicleType: "car" | "tuk_tuk" | "mini_bus" | null;
    vehicleLabel: string | null;
    score: number;
};

export type DriverEligibilityResult = {
    drivers: DriverCandidate[];
    fallbackReason: "no_eligible_drivers_online" | "invalid_vehicle_match" | "driver_conflict" | null;
};

const OFFER_EXPIRY_MINUTES = 2;
const DEFAULT_DRIVER_BROADCAST_LIMIT = 5;
const MAX_MARKETPLACE_ATTEMPTS = 2;
const ACTIVE_ASSIGNED_TRIP_STATUSES = new Set([
    "accepted",
    "driver_on_the_way",
    "driver_arrived",
    "trip_started",
    "waiting_for_return",
]);
const NON_DISPATCHABLE_TRIP_STATUSES = new Set([
    ...ACTIVE_ASSIGNED_TRIP_STATUSES,
    "completed",
    "cancelled",
]);

function normalizePreferredVehicleType(value: unknown, tripType: string) {
    if (tripType === "airport_ride") return "car";
    return value === "car" || value === "tuk_tuk" || value === "mini_bus" ? value : "any";
}

function coercePositiveNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function fetchEligibleDriversForTrip(
    supabase: RideServiceClient,
    trip: { trip_type: string; metadata: Record<string, unknown> | null }
): Promise<DriverEligibilityResult> {
    const preferredVehicleType = normalizePreferredVehicleType(
        trip.metadata?.preferred_vehicle_type,
        String(trip.trip_type)
    );
    const pickupCity = typeof trip.metadata?.pickup_city === "string" ? trip.metadata.pickup_city : null;
    const pickupArea = typeof trip.metadata?.pickup_area === "string" ? trip.metadata.pickup_area : null;

    const { data: driverProfiles, error: driversError } = await supabase
        .from("driver_profiles")
        .select("id, working_city, working_area, availability_status, is_accepting_offers, application_status, verification_status, last_seen_at")
        .eq("availability_status", "available")
        .eq("application_status", "approved")
        .eq("verification_status", "approved");

    if (driversError) throw driversError;

    const driverIds = (driverProfiles || []).map((driver) => String(driver.id));
    if (driverIds.length === 0) {
        return {
            drivers: [],
            fallbackReason: "no_eligible_drivers_online",
        };
    }

    const nowIso = new Date().toISOString();
    const [
        { data: profiles, error: profilesError },
        { data: vehicles, error: vehiclesError },
        { data: activeOffers, error: activeOffersError },
        { data: activeTrips, error: activeTripsError },
    ] = await Promise.all([
        supabase.from("profiles").select("id, full_name, account_status").in("id", driverIds),
        supabase
            .from("vehicles")
            .select("id, driver_id, vehicle_type, approval_status, is_primary, is_active, brand, model")
            .in("driver_id", driverIds)
            .eq("approval_status", "approved")
            .eq("is_primary", true)
            .eq("is_active", true),
        supabase
            .from("trip_offers")
            .select("driver_id")
            .in("driver_id", driverIds)
            .eq("offer_status", "offered")
            .gt("expires_at", nowIso),
        supabase
            .from("trips")
            .select("assigned_driver_id, status")
            .in("assigned_driver_id", driverIds)
            .in("status", Array.from(ACTIVE_ASSIGNED_TRIP_STATUSES)),
    ]);

    if (profilesError) throw profilesError;
    if (vehiclesError) throw vehiclesError;
    if (activeOffersError) throw activeOffersError;
    if (activeTripsError) throw activeTripsError;

    const activeProfiles = new Map(
        (profiles || [])
            .filter((profile) => profile.account_status === "active")
            .map((profile) => [String(profile.id), String(profile.full_name || "كابتن")])
    );

    const primaryVehicleByDriver = new Map(
        (vehicles || []).map((vehicle) => [String(vehicle.driver_id), vehicle])
    );
    const driversWithOpenOffers = new Set(
        (activeOffers || []).map((offer) => String(offer.driver_id))
    );
    const driversWithActiveTrips = new Set(
        (activeTrips || [])
            .map((trip) => trip.assigned_driver_id)
            .filter(Boolean)
            .map((driverId) => String(driverId))
    );

    const operationalDrivers = (driverProfiles || [])
        .filter((driver) => activeProfiles.has(String(driver.id)))
        .filter((driver) => !driversWithOpenOffers.has(String(driver.id)))
        .filter((driver) => !driversWithActiveTrips.has(String(driver.id)))
        .map((driver) => {
            const vehicle = primaryVehicleByDriver.get(String(driver.id));
            const cityScore =
                pickupCity &&
                driver.working_city &&
                String(driver.working_city).toLowerCase().includes(String(pickupCity).toLowerCase())
                    ? 3
                    : 0;
            const areaScore =
                pickupArea &&
                driver.working_area &&
                String(driver.working_area).toLowerCase().includes(String(pickupArea).toLowerCase())
                    ? 2
                    : 0;
            const lastSeenAt = driver.last_seen_at ? new Date(String(driver.last_seen_at)).getTime() : Number.NaN;
            const minutesSinceLastSeen = Number.isFinite(lastSeenAt)
                ? Math.max(0, (Date.now() - lastSeenAt) / 60000)
                : Number.POSITIVE_INFINITY;
            const freshnessScore = minutesSinceLastSeen <= 5 ? 2 : minutesSinceLastSeen <= 30 ? 1 : 0;

            return {
                id: String(driver.id),
                fullName: activeProfiles.get(String(driver.id)) || "كابتن",
                workingCity: driver.working_city as string | null,
                workingArea: driver.working_area as string | null,
                vehicleId: vehicle ? String(vehicle.id) : null,
                vehicleType: vehicle ? (String(vehicle.vehicle_type) as "car" | "tuk_tuk" | "mini_bus") : null,
                vehicleLabel: vehicle ? `${String(vehicle.brand)} ${String(vehicle.model)} · ${String(vehicle.vehicle_type)}` : null,
                score: cityScore + areaScore + freshnessScore,
            } satisfies DriverCandidate;
        })
        .filter((driver) => driver.vehicleId && driver.vehicleType);

    if (operationalDrivers.length === 0) {
        return {
            drivers: [],
            fallbackReason:
                driversWithOpenOffers.size > 0 || driversWithActiveTrips.size > 0
                    ? "driver_conflict"
                    : "no_eligible_drivers_online",
        };
    }

    const rankedDrivers = operationalDrivers
        .filter((driver) => {
            if (preferredVehicleType === "any") return true;
            return driver.vehicleType === preferredVehicleType;
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 12);

    if (rankedDrivers.length === 0) {
        return {
            drivers: [],
            fallbackReason: preferredVehicleType === "any" ? "no_eligible_drivers_online" : "invalid_vehicle_match",
        };
    }

    return {
        drivers: rankedDrivers,
        fallbackReason: null,
    };
}

async function notifyAdminsAboutDispatchFallback(
    supabase: RideServiceClient,
    trip: TripDispatchTrip,
    fallbackReason: string
) {
    const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("account_status", "active")
        .limit(100);

    const payload = (admins || []).map((admin) => ({
        recipient_user_id: admin.id,
        type: "admin_message",
        title: "الرحلة محتاجة تدخل يدوي",
        body: `الرحلة من ${String(trip.pickup_label || "نقطة التحرك")} إلى ${String(trip.destination_label || "الوجهة")} لم تجد كباتن مناسبين تلقائيًا.`,
        payload: {
            trip_id: trip.id,
            fallback_reason: fallbackReason,
            latest_dispatch_mode: "admin_override_required",
        },
        related_trip_id: trip.id,
    }));

    if (payload.length > 0) {
        await supabase.from("notifications").insert(payload);
    }
}

async function markTripAwaitingAdminDispatch(
    supabase: RideServiceClient,
    trip: TripDispatchTrip,
    triggeredByUserId: string,
    fallbackReason: string
) {
    const metadata = (trip.metadata || {}) as Record<string, unknown>;
    const now = new Date().toISOString();
    const alreadyNotified = metadata.marketplace_fallback_notified_at;

    await supabase
        .from("trips")
        .update({
            status: "searching_driver",
            offered_driver_count: 0,
            updated_at: now,
            metadata: {
                ...metadata,
                awaiting_admin_dispatch: true,
                dispatch_mode: "admin_override_required",
                latest_dispatch_mode: "admin_override_required",
                marketplace_fallback_reason: fallbackReason,
                marketplace_fallback_at: now,
                marketplace_fallback_notified_at: alreadyNotified || now,
                marketplace_offer_expires_at: null,
            },
        })
        .eq("id", trip.id);

    await supabase.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "searching_driver",
        changed_by: triggeredByUserId,
        note: "التوزيع التلقائي لم يجد كابتن مناسب. تم تحويل الرحلة لتدخل الإدارة.",
        metadata: {
            fallback_reason: fallbackReason,
            dispatch_mode: "admin_override_required",
        },
    });

    if (!alreadyNotified) {
        await notifyAdminsAboutDispatchFallback(supabase, trip, fallbackReason);
        if (trip.customer_id) {
            await supabase.from("notifications").insert({
                recipient_user_id: trip.customer_id,
                type: "admin_message",
                title: "ما زلنا نبحث عن كابتن مناسب",
                body: "لم نجد كابتن مناسب تلقائيًا في الجولة الحالية، وتم تصعيد الرحلة لفريق التشغيل لمتابعتها يدويًا.",
                payload: {
                    trip_id: trip.id,
                    fallback_reason: fallbackReason,
                },
                related_trip_id: trip.id,
            });
        }
    }
}

export async function dispatchTripToMarketplace(
    supabase: RideServiceClient,
    options: {
        tripId?: string;
        trip?: TripDispatchTrip;
        triggeredByUserId: string;
        explicitPrice?: number | null;
        source: "trip_request" | "customer_confirm_price" | "marketplace_retry";
        forceRedispatch?: boolean;
    }
) {
    const trip =
        options.trip ||
        (
            await supabase
                .from("trips")
                .select("id, customer_id, trip_type, status, pickup_label, destination_label, estimated_price, metadata, assigned_driver_id")
                .eq("id", options.tripId)
                .single()
        ).data;

    if (!trip) {
        throw new Error("المشوار المطلوب غير موجود للتوزيع التلقائي.");
    }

    const currentTrip = {
        ...trip,
        metadata: ((trip.metadata as Record<string, unknown> | null) || null),
    } satisfies TripDispatchTrip;

    if (NON_DISPATCHABLE_TRIP_STATUSES.has(String(currentTrip.status)) || currentTrip.assigned_driver_id) {
        return {
            success: true,
            tripId: currentTrip.id,
            status: currentTrip.status,
            offeredDriverCount: 0,
            fallbackToAdmin: false,
            skipped: "already_active",
        };
    }

    const metadata = (currentTrip.metadata || {}) as Record<string, unknown>;
    const attemptCount = Math.max(0, Number(metadata.marketplace_dispatch_attempt_count || 0));
    const quotedPrice =
        options.explicitPrice ??
        coercePositiveNumber(metadata.admin_selected_price) ??
        coercePositiveNumber(currentTrip.estimated_price) ??
        coercePositiveNumber(metadata.map_estimated_price);

    if (!quotedPrice) {
        await markTripAwaitingAdminDispatch(
            supabase,
            currentTrip,
            options.triggeredByUserId,
            "auto_price_unavailable"
        );
        return {
            success: true,
            tripId: currentTrip.id,
            status: "searching_driver",
            offeredDriverCount: 0,
            fallbackToAdmin: true,
            skipped: "missing_price",
        };
    }

    const eligibility = await fetchEligibleDriversForTrip(supabase, {
        trip_type: String(currentTrip.trip_type),
        metadata,
    });

    if (eligibility.drivers.length === 0) {
        await markTripAwaitingAdminDispatch(
            supabase,
            currentTrip,
            options.triggeredByUserId,
            eligibility.fallbackReason || "no_eligible_drivers_online"
        );
        return {
            success: true,
            tripId: currentTrip.id,
            status: "searching_driver",
            offeredDriverCount: 0,
            fallbackToAdmin: true,
            skipped: eligibility.fallbackReason || "no_drivers",
        };
    }

    const selectedDrivers = eligibility.drivers.slice(0, DEFAULT_DRIVER_BROADCAST_LIMIT);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + OFFER_EXPIRY_MINUTES * 60 * 1000).toISOString();

    if (options.forceRedispatch) {
        await supabase
            .from("trip_offers")
            .update({
                offer_status: "timed_out",
                responded_at: now,
                updated_at: now,
                rejection_reason: "انتهت جولة البث السابقة بدون قبول",
            })
            .eq("trip_id", currentTrip.id)
            .eq("offer_status", "offered")
            .lte("expires_at", now);
    } else {
        await supabase
            .from("trip_offers")
            .update({
                offer_status: "cancelled",
                responded_at: now,
                updated_at: now,
                rejection_reason: "تمت إعادة بث الرحلة تلقائيًا بجولة أحدث",
            })
            .eq("trip_id", currentTrip.id)
            .eq("offer_status", "offered");
    }

    const offersPayload = selectedDrivers.map((driver) => ({
        trip_id: currentTrip.id,
        driver_id: driver.id,
        vehicle_id: driver.vehicleId,
        offered_by_admin_id: null,
        offer_status: "offered",
        offered_at: now,
        responded_at: null,
        rejection_reason: null,
        expires_at: expiresAt,
        metadata: {
            ...metadata,
            dispatch_mode: "instant_marketplace",
            quoted_price: quotedPrice,
            matched_score: driver.score,
            marketplace_round: attemptCount + 1,
        },
        updated_at: now,
    }));

    const { error: offersError } = await supabase
        .from("trip_offers")
        .upsert(offersPayload, { onConflict: "trip_id,driver_id" });
    if (offersError) throw offersError;

    const nextMetadata = {
        ...metadata,
        admin_selected_price: quotedPrice,
        customer_price_confirmed: true,
        customer_price_confirmed_at: metadata.customer_price_confirmed_at || now,
        awaiting_admin_dispatch: false,
        dispatch_mode: "instant_marketplace",
        latest_dispatch_mode: "instant_marketplace",
        latest_dispatch_driver_count: selectedDrivers.length,
        marketplace_dispatch_attempt_count: attemptCount + 1,
        marketplace_last_dispatched_at: now,
        marketplace_offer_expires_at: expiresAt,
        marketplace_fallback_reason: null,
        marketplace_fallback_at: null,
        marketplace_fallback_notified_at: null,
    };

    const { error: tripUpdateError } = await supabase
        .from("trips")
        .update({
            status: "offered",
            offered_at: now,
            updated_at: now,
            estimated_price: quotedPrice,
            offered_driver_count: selectedDrivers.length,
            metadata: nextMetadata,
        })
        .eq("id", currentTrip.id);
    if (tripUpdateError) throw tripUpdateError;

    await supabase.from("trip_status_history").insert({
        trip_id: currentTrip.id,
        status: "offered",
        changed_by: options.triggeredByUserId,
        note:
            options.source === "marketplace_retry"
                ? `تمت إعادة بث الرحلة تلقائيًا إلى ${selectedDrivers.length} كباتن.`
                : `تم تشغيل التوزيع التلقائي وإرسال الرحلة إلى ${selectedDrivers.length} كباتن مناسبين.`,
        metadata: {
            dispatch_mode: "instant_marketplace",
            dispatch_source: options.source,
            offered_driver_count: selectedDrivers.length,
            quoted_price: quotedPrice,
            marketplace_round: attemptCount + 1,
        },
    });

    const notificationsPayload = selectedDrivers.map((driver) => ({
        recipient_user_id: driver.id,
        type: "trip_offered",
        title: "عرض مشوار جديد تلقائيًا",
        body: `مشوار من ${String(currentTrip.pickup_label || "نقطة التحرك")} إلى ${String(currentTrip.destination_label || "الوجهة")} بالسعر ${quotedPrice} ج.م.`,
        payload: {
            trip_id: currentTrip.id,
            estimated_price: quotedPrice,
            dispatch_mode: "instant_marketplace",
        },
        related_trip_id: currentTrip.id,
    }));
    if (notificationsPayload.length > 0) {
        await supabase.from("notifications").insert(notificationsPayload);
    }

    await Promise.all(
        selectedDrivers.map((driver) =>
            sendPushToUserDevices(supabase, driver.id, {
                title: "وصلك عرض مشوار جديد",
                message: `مشوار من ${String(currentTrip.pickup_label || "نقطة التحرك")} إلى ${String(currentTrip.destination_label || "الوجهة")} بالسعر ${quotedPrice} ج.م.`,
                link: "/captain/offers",
                requireInteraction: true,
                topic: "instant-marketplace-offer",
            })
        )
    );

    if (currentTrip.customer_id) {
        await supabase.from("notifications").insert({
            recipient_user_id: currentTrip.customer_id,
            type: "trip_offered",
            title: "بدأنا ندور على كابتن تلقائيًا",
            body: `السعر اتحدد تلقائيًا عند ${quotedPrice} ج.م وبدأنا نعرض الرحلة على أقرب الكباتن المناسبين.`,
            payload: {
                trip_id: currentTrip.id,
                estimated_price: quotedPrice,
                offered_driver_count: selectedDrivers.length,
                dispatch_mode: "instant_marketplace",
            },
            related_trip_id: currentTrip.id,
        });
    }

    return {
        success: true,
        tripId: currentTrip.id,
        status: "offered",
        offeredDriverCount: selectedDrivers.length,
        fallbackToAdmin: false,
        quotedPrice,
    };
}

export async function ensureMarketplaceDispatchProgress(
    supabase: RideServiceClient,
    options: {
        trip: TripDispatchTrip;
        triggeredByUserId: string;
    }
) {
    const trip = options.trip;
    const metadata = ((trip.metadata as Record<string, unknown> | null) || {});

    if (trip.assigned_driver_id || NON_DISPATCHABLE_TRIP_STATUSES.has(String(trip.status))) {
        return {
            success: true,
            tripId: trip.id,
            status: trip.status,
            offeredDriverCount: 0,
            fallbackToAdmin: false,
            skipped: "already_active",
        };
    }

    if (metadata.awaiting_admin_dispatch === true) {
        return {
            success: true,
            tripId: trip.id,
            status: trip.status,
            offeredDriverCount: 0,
            fallbackToAdmin: true,
            skipped: "awaiting_admin_dispatch",
        };
    }

    const { data: openOffers, error: offersError } = await supabase
        .from("trip_offers")
        .select("id, expires_at, offer_status")
        .eq("trip_id", trip.id)
        .eq("offer_status", "offered");
    if (offersError) throw offersError;

    const now = Date.now();
    const activeOffers = (openOffers || []).filter((offer) => {
        const expiresAt = offer.expires_at ? new Date(String(offer.expires_at)).getTime() : Number.NaN;
        return Number.isFinite(expiresAt) && expiresAt > now;
    });

    if (activeOffers.length > 0) {
        if (String(trip.status) !== "offered") {
            await supabase
                .from("trips")
                .update({
                    status: "offered",
                    offered_driver_count: activeOffers.length,
                    updated_at: new Date().toISOString(),
                    metadata: {
                        ...metadata,
                        awaiting_admin_dispatch: false,
                        dispatch_mode: "instant_marketplace",
                        latest_dispatch_mode: "instant_marketplace",
                        latest_dispatch_driver_count: activeOffers.length,
                    },
                })
                .eq("id", trip.id);
        }
        return {
            success: true,
            tripId: trip.id,
            status: "offered",
            offeredDriverCount: activeOffers.length,
            fallbackToAdmin: false,
            skipped: "offers_still_active",
        };
    }

    const attemptCount = Math.max(0, Number(metadata.marketplace_dispatch_attempt_count || 0));
    if (attemptCount >= MAX_MARKETPLACE_ATTEMPTS) {
        await markTripAwaitingAdminDispatch(
            supabase,
            trip,
            options.triggeredByUserId,
            "marketplace_attempts_exhausted"
        );
        return {
            success: true,
            tripId: trip.id,
            status: "searching_driver",
            offeredDriverCount: 0,
            fallbackToAdmin: true,
            skipped: "attempts_exhausted",
        };
    }

    return dispatchTripToMarketplace(supabase, {
        trip,
        triggeredByUserId: options.triggeredByUserId,
        source: "marketplace_retry",
        forceRedispatch: true,
    });
}
