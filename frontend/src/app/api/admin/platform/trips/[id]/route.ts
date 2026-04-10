import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import { sendPushToDriverDevices } from "@/lib/driver-push-server";
import { hasPermission } from "@/lib/permissions";
import { canAdminManuallyTransitionTrip, getAllowedAdminManualTripStatuses, isTripStatus } from "@/lib/trip-state-machine";
import { sendPushToUserDevices } from "@/lib/user-push-server";

type Context = { params: Promise<{ id: string }> };

type EligibleDriverRecord = {
    id: string;
    fullName: string;
    vehicleId: string;
};

async function fetchEligibleDriversForAdminAssignment(supabase: ReturnType<typeof createAdminPlatformClient>) {
    if (!supabase) return [] as EligibleDriverRecord[];

    const nowIso = new Date().toISOString();
    const [{ data: driverProfiles }, { data: vehicles }, { data: profiles }, { data: activeTrips }, { data: openOffers }] = await Promise.all([
        supabase
            .from("driver_profiles")
            .select("id, application_status, verification_status")
            .eq("application_status", "approved")
            .eq("verification_status", "approved"),
        supabase
            .from("vehicles")
            .select("id, driver_id, is_primary, is_active, approval_status")
            .eq("is_primary", true)
            .eq("is_active", true)
            .eq("approval_status", "approved"),
        supabase
            .from("profiles")
            .select("id, full_name, account_status, role")
            .eq("role", "driver")
            .eq("account_status", "active"),
        supabase
            .from("trips")
            .select("assigned_driver_id, status")
            .in("status", ["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return"]),
        supabase
            .from("trip_offers")
            .select("driver_id, offer_status, expires_at")
            .eq("offer_status", "offered")
            .gt("expires_at", nowIso),
    ]);

    const readyVehicleByDriver = new Map<string, string>();
    for (const vehicle of vehicles || []) {
        if (vehicle.driver_id && vehicle.id) {
            readyVehicleByDriver.set(String(vehicle.driver_id), String(vehicle.id));
        }
    }

    const activeTripDrivers = new Set(
        (activeTrips || [])
            .map((trip) => trip.assigned_driver_id)
            .filter(Boolean)
            .map((driverId) => String(driverId))
    );

    const driversWithOpenOffers = new Set(
        (openOffers || [])
            .map((offer) => offer.driver_id)
            .filter(Boolean)
            .map((driverId) => String(driverId))
    );

    const profilesMap = new Map(
        (profiles || []).map((profile) => [String(profile.id), profile])
    );

    return (driverProfiles || [])
        .map((driver) => {
            const driverId = String(driver.id);
            const profile = profilesMap.get(driverId);
            const vehicleId = readyVehicleByDriver.get(driverId);
            if (!profile || !vehicleId) return null;
            if (activeTripDrivers.has(driverId)) return null;
            if (driversWithOpenOffers.has(driverId)) return null;
            return {
                id: driverId,
                fullName: String(profile.full_name || "كابتن"),
                vehicleId,
            } satisfies EligibleDriverRecord;
        })
        .filter((driver): driver is EligibleDriverRecord => driver !== null);
}

export async function PATCH(request: NextRequest, context: Context) {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return auth.response;

    const supabase = createAdminPlatformClient();
    if (!supabase) {
        return NextResponse.json({ error: "Server misconfigured: missing Supabase service role key" }, { status: 500 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const action = String(body.action || "");
    const adminProfile = { role: auth.profile.role, permissions: auth.profile.permissions };

    try {
        if (action === "dispatch_offer" || action === "assign_driver") {
            if (!hasPermission(adminProfile, "assign_driver")) {
                return NextResponse.json({ error: "Forbidden: assign_driver permission required" }, { status: 403 });
            }
        } else if (!hasPermission(adminProfile, "update_order_status") && !hasPermission(adminProfile, "view_orders")) {
            return NextResponse.json({ error: "Forbidden: trip management permission required" }, { status: 403 });
        }

        if (action === "dispatch_offer") {
            const price = body.price === null || body.price === undefined || body.price === "" ? null : Number(body.price);
            if (price !== null && (!Number.isFinite(price) || price <= 0)) {
                return NextResponse.json({ error: "حدد سعر صحيح قبل إرسال السعر للعميل." }, { status: 400 });
            }

            const { data: trip, error: tripError } = await supabase
                .from("trips")
                .select("id, trip_type, status, customer_id, pickup_label, destination_label, estimated_price, metadata")
                .eq("id", id)
                .single();

            if (tripError || !trip) {
                return NextResponse.json({ error: "المشوار المطلوب مش موجود." }, { status: 404 });
            }

            if (["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return", "completed", "cancelled"].includes(String(trip.status))) {
                return NextResponse.json({ error: "المشوار خرج من مرحلة التسعير/التعيين، وما ينفعش يتعدل من هنا." }, { status: 400 });
            }

            const now = new Date().toISOString();
            const metadata = ((trip.metadata as Record<string, unknown> | null) || {});
            const quotedPrice = price ?? (
                trip.estimated_price === null
                    ? Number((metadata.map_estimated_price as number | null) ?? 0) || null
                    : Number(trip.estimated_price)
            );

            const { error: tripUpdateError } = await supabase
                .from("trips")
                .update({
                    status: "pending",
                    updated_at: now,
                    estimated_price: null,
                    offered_driver_count: 0,
                    metadata: {
                        ...metadata,
                        admin_selected_price: quotedPrice,
                        admin_priced_at: now,
                        admin_priced_by: auth.profile.user.id,
                        awaiting_admin_pricing: false,
                        awaiting_admin_dispatch: false,
                        customer_price_confirmed: false,
                        customer_price_confirmed_at: null,
                        latest_dispatch_mode: "awaiting_customer_price_confirmation",
                    },
                })
                .eq("id", id);

            if (tripUpdateError) throw tripUpdateError;

            await supabase.from("trip_status_history").insert({
                trip_id: id,
                status: "pending",
                changed_by: auth.profile.user.id,
                note: "تم تحديد السعر النهائي وإرساله للعميل في انتظار تأكيده.",
                metadata: {
                    quoted_price: quotedPrice,
                },
            });

            if (trip.customer_id) {
                await supabase.from("notifications").insert({
                    recipient_user_id: trip.customer_id,
                    type: "trip_offered",
                    title: "تم تحديد السعر النهائي",
                        body: `الإدارة حدّدت سعر الرحلة${quotedPrice ? `: ${quotedPrice} ج.م` : ""}. أكّد السعر لو مناسب أو الغِ الطلب.`,
                        payload: {
                            trip_id: id,
                            estimated_price: quotedPrice,
                            dispatch_mode: "awaiting_customer_price_confirmation",
                        },
                    related_trip_id: id,
                });

                await sendPushToUserDevices(supabase, trip.customer_id, {
                    title: "تم تحديد السعر النهائي",
                    message: "الإدارة حدّدت السعر النهائي. افتح التطبيق وأكّد السعر أو الغِ الطلب.",
                    link: "/trip/live",
                    topic: "customer-price-quoted",
                });
            }

            return NextResponse.json({ success: true, offeredDriverCount: 0, price: quotedPrice });
        }

        if (action === "assign_driver") {
            const driverId = String(body.driverId || "");
            let vehicleId = body.vehicleId ? String(body.vehicleId) : null;
            const price = body.price === null || body.price === undefined || body.price === "" ? null : Number(body.price);
            if (!driverId) {
                return NextResponse.json({ error: "driverId is required for assign_driver" }, { status: 400 });
            }
            if (price !== null && (!Number.isFinite(price) || price <= 0)) {
                return NextResponse.json({ error: "حدد سعر صحيح قبل الإسناد المباشر." }, { status: 400 });
            }

            const { data: trip, error: tripError } = await supabase
                .from("trips")
                .select("id, status, customer_id, pickup_label, destination_label, metadata")
                .eq("id", id)
                .single();

            if (tripError || !trip) {
                return NextResponse.json({ error: "المشوار المطلوب مش موجود." }, { status: 404 });
            }

            const now = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
            const metadata = ((trip.metadata as Record<string, unknown> | null) || {});
            if (metadata.customer_price_confirmed !== true) {
                return NextResponse.json({ error: "لازم العميل يؤكد السعر الأول قبل تعيين كابتن." }, { status: 409 });
            }

            const [{ data: driverProfile, error: driverProfileError }, { data: profileRow, error: profileError }, { data: primaryVehicle, error: vehicleError }, { data: activeTrips, error: activeTripsError }, { data: openOffers, error: openOffersError }] = await Promise.all([
                supabase
                    .from("driver_profiles")
                    .select("id, availability_status, is_accepting_offers, application_status, verification_status")
                    .eq("id", driverId)
                    .maybeSingle(),
                supabase
                    .from("profiles")
                    .select("id, full_name, account_status")
                    .eq("id", driverId)
                    .maybeSingle(),
                supabase
                    .from("vehicles")
                    .select("id, approval_status, is_primary, is_active, vehicle_type, brand, model")
                    .eq("driver_id", driverId)
                    .eq("is_primary", true)
                    .eq("is_active", true)
                    .maybeSingle(),
                supabase
                    .from("trips")
                    .select("id, status")
                    .eq("assigned_driver_id", driverId)
                    .in("status", ["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return"])
                    .limit(1),
                supabase
                    .from("trip_offers")
                    .select("id, trip_id, offer_status, expires_at")
                    .eq("driver_id", driverId)
                    .eq("offer_status", "offered")
                    .gt("expires_at", now)
                    .neq("trip_id", id)
                    .limit(1),
            ]);

            if (driverProfileError || !driverProfile || profileError || !profileRow) {
                return NextResponse.json({ error: "الكابتن المحدد غير موجود أو غير مكتمل البيانات." }, { status: 404 });
            }

            if (vehicleError || !primaryVehicle) {
                return NextResponse.json({ error: "الكابتن لا يملك مركبة أساسية جاهزة للإسناد." }, { status: 409 });
            }

            if (activeTripsError || openOffersError) {
                throw activeTripsError || openOffersError;
            }

            if (String(profileRow.account_status || "") !== "active") {
                return NextResponse.json({ error: "حساب الكابتن غير نشط حاليًا." }, { status: 409 });
            }

            if (String(driverProfile.application_status || "") !== "approved" || String(driverProfile.verification_status || "") !== "approved") {
                return NextResponse.json({ error: "الكابتن غير معتمد بالكامل حتى الآن." }, { status: 409 });
            }

            if ((activeTrips || []).length > 0) {
                await supabase
                    .from("driver_profiles")
                    .update({ availability_status: "busy", last_seen_at: now })
                    .eq("id", driverId);
                return NextResponse.json({ error: "الكابتن مشغول حاليًا في رحلة أخرى.", conflictReason: "active_trip" }, { status: 409 });
            }

            if ((openOffers || []).length > 0) {
                return NextResponse.json({ error: "الكابتن لديه عرض آخر مفتوح الآن.", conflictReason: "open_offer" }, { status: 409 });
            }

            if (String(primaryVehicle.approval_status || "") !== "approved" || primaryVehicle.is_active !== true) {
                return NextResponse.json({ error: "مركبة الكابتن ليست جاهزة أو غير معتمدة." }, { status: 409 });
            }

            vehicleId = vehicleId || String(primaryVehicle.id || "");
            if (!vehicleId) {
                return NextResponse.json({ error: "تعذر تحديد مركبة الكابتن للإسناد." }, { status: 409 });
            }

            await supabase
                .from("trip_offers")
                .update({
                    offer_status: "cancelled",
                    responded_at: now,
                    updated_at: now,
                    rejection_reason: "تم تحويل المشوار إلى عرض حصري لكابتن آخر من الإدارة",
                })
                .eq("trip_id", id)
                .neq("driver_id", driverId)
                .in("offer_status", ["offered", "rejected", "cancelled"]);

            const { error: offerError } = await supabase.from("trip_offers").upsert({
                trip_id: id,
                driver_id: driverId,
                vehicle_id: vehicleId,
                offered_by_admin_id: auth.profile.user.id,
                offer_status: "offered",
                offered_at: now,
                responded_at: null,
                rejection_reason: null,
                expires_at: expiresAt,
                updated_at: now,
                metadata: {
                    ...metadata,
                    dispatch_mode: "admin_direct_offer",
                    broadcast_price: price ?? (metadata.map_estimated_price as number | null) ?? null,
                },
            }, { onConflict: "trip_id,driver_id" });

            if (offerError) throw offerError;

            const { error } = await supabase
                .from("trips")
                .update({
                    assigned_driver_id: null,
                    assigned_vehicle_id: null,
                    status: "offered",
                    offered_at: now,
                    estimated_price: price ?? ((metadata.map_estimated_price as number | null) ?? null),
                    updated_at: now,
                    metadata: {
                        ...metadata,
                        admin_selected_price: price ?? ((metadata.map_estimated_price as number | null) ?? null),
                        admin_priced_at: now,
                        admin_priced_by: auth.profile.user.id,
                        latest_dispatch_mode: "admin_direct_offer",
                        latest_direct_driver_id: driverId,
                    },
                })
                .eq("id", id);

            if (error) throw error;

            await supabase.from("trip_status_history").insert({
                trip_id: id,
                status: "offered",
                changed_by: auth.profile.user.id,
                note: "تم إرسال عرض حصري للكابتن من لوحة التشغيل وينتظر موافقته.",
                metadata: {
                    quoted_price: price ?? ((metadata.map_estimated_price as number | null) ?? null),
                    direct_driver_id: driverId,
                },
            });

            await supabase.from("notifications").insert({
                recipient_user_id: driverId,
                type: "trip_offered",
                title: "عرض مشوار مباشر من الإدارة",
                body: `تم تخصيص مشوار لك من ${String(trip.pickup_label || "نقطة التحرك")} إلى ${String(trip.destination_label || "الوجهة")}. افتح التطبيق ووافق أو ارفض.`,
                payload: {
                    trip_id: id,
                    estimated_price: price ?? ((metadata.map_estimated_price as number | null) ?? null),
                    dispatch_mode: "admin_direct_offer",
                },
                related_trip_id: id,
            });

            await sendPushToDriverDevices(supabase, driverId, {
                title: "الإدارة خصصت لك مشوار",
                message: `مشوار من ${String(trip.pickup_label || "نقطة التحرك")} إلى ${String(trip.destination_label || "الوجهة")} في انتظار موافقتك الآن.`,
                link: "/captain/offers",
                requireInteraction: true,
                topic: "admin-direct-offer",
            });

            if (trip.customer_id) {
                await supabase.from("notifications").insert({
                    recipient_user_id: trip.customer_id,
                    type: "trip_offered",
                    title: "رشحنالك كابتن مناسب",
                    body: "رحلتك اتعرضت على كابتن مناسب وبنستنى رده دلوقتي. أول ما يوافق هيوصلك إشعار فورًا.",
                    payload: {
                        trip_id: id,
                        estimated_price: price ?? ((metadata.map_estimated_price as number | null) ?? null),
                        dispatch_mode: "admin_direct_offer",
                        direct_driver_id: driverId,
                    },
                    related_trip_id: id,
                });

                await sendPushToUserDevices(supabase, trip.customer_id, {
                    title: "رشحنالك كابتن مناسب",
                    message: "رحلتك اتعرضت على كابتن مناسب، وأول ما يوافق هنوصل لك خبر فورًا.",
                    link: "/trip/live",
                    topic: "customer-direct-offer",
                });
            }

            return NextResponse.json({ success: true });
        }

        if (action === "broadcast_available_drivers") {
            const price = body.price === null || body.price === undefined || body.price === "" ? null : Number(body.price);
            if (price !== null && (!Number.isFinite(price) || price <= 0)) {
                return NextResponse.json({ error: "حدد سعر صحيح قبل إرسال الطلب للكباتن." }, { status: 400 });
            }

            const { data: trip, error: tripError } = await supabase
                .from("trips")
                .select("id, status, customer_id, pickup_label, destination_label, metadata")
                .eq("id", id)
                .single();

            if (tripError || !trip) {
                return NextResponse.json({ error: "المشوار المطلوب مش موجود." }, { status: 404 });
            }

            const metadata = ((trip.metadata as Record<string, unknown> | null) || {});
            if (metadata.customer_price_confirmed !== true) {
                return NextResponse.json({ error: "لازم العميل يؤكد السعر الأول قبل إرسال الطلب للكباتن." }, { status: 409 });
            }

            const eligibleDrivers = await fetchEligibleDriversForAdminAssignment(supabase);
            if (eligibleDrivers.length === 0) {
                return NextResponse.json({ error: "لا يوجد كباتن متاحون الآن لإرسال الطلب لهم." }, { status: 409 });
            }

            const now = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
            const quotedPrice = price ?? ((metadata.map_estimated_price as number | null) ?? null);

            await supabase
                .from("trip_offers")
                .update({
                    offer_status: "cancelled",
                    responded_at: now,
                    updated_at: now,
                    rejection_reason: "تمت إعادة إرسال الرحلة لكل الكباتن المتاحين من الإدارة",
                })
                .eq("trip_id", id)
                .eq("offer_status", "offered");

            const offersPayload = eligibleDrivers.map((driver) => ({
                trip_id: id,
                driver_id: driver.id,
                vehicle_id: driver.vehicleId,
                offered_by_admin_id: auth.profile.user.id,
                offer_status: "offered",
                offered_at: now,
                responded_at: null,
                rejection_reason: null,
                expires_at: expiresAt,
                updated_at: now,
                metadata: {
                    ...metadata,
                    dispatch_mode: "admin_broadcast_available",
                    broadcast_price: quotedPrice,
                },
            }));

            const { error: offersError } = await supabase
                .from("trip_offers")
                .upsert(offersPayload, { onConflict: "trip_id,driver_id" });

            if (offersError) throw offersError;

            const { error: tripUpdateError } = await supabase
                .from("trips")
                .update({
                    assigned_driver_id: null,
                    assigned_vehicle_id: null,
                    status: "offered",
                    offered_at: now,
                    offered_driver_count: eligibleDrivers.length,
                    estimated_price: quotedPrice,
                    updated_at: now,
                    metadata: {
                        ...metadata,
                        admin_selected_price: quotedPrice,
                        admin_priced_at: now,
                        admin_priced_by: auth.profile.user.id,
                        latest_dispatch_mode: "admin_broadcast_available",
                        latest_direct_driver_id: null,
                        awaiting_admin_dispatch: false,
                    },
                })
                .eq("id", id);

            if (tripUpdateError) throw tripUpdateError;

            await supabase.from("trip_status_history").insert({
                trip_id: id,
                status: "offered",
                changed_by: auth.profile.user.id,
                note: "تم إرسال الرحلة لكل الكباتن المتاحين من لوحة التشغيل.",
                metadata: {
                    quoted_price: quotedPrice,
                    offered_driver_count: eligibleDrivers.length,
                    dispatch_mode: "admin_broadcast_available",
                },
            });

            await Promise.all(
                eligibleDrivers.map(async (driver) => {
                    await supabase.from("notifications").insert({
                        recipient_user_id: driver.id,
                        type: "trip_offered",
                        title: "عرض مشوار جديد",
                        body: `رحلة من ${String(trip.pickup_label || "نقطة التحرك")} إلى ${String(trip.destination_label || "الوجهة")} في انتظار موافقتك.`,
                        payload: {
                            trip_id: id,
                            estimated_price: quotedPrice,
                            dispatch_mode: "admin_broadcast_available",
                        },
                        related_trip_id: id,
                    });

                    await sendPushToDriverDevices(supabase, driver.id, {
                        title: "عرض مشوار جديد",
                        message: `رحلة من ${String(trip.pickup_label || "نقطة التحرك")} إلى ${String(trip.destination_label || "الوجهة")} وصلت لك الآن.`,
                        link: "/captain/offers",
                        requireInteraction: true,
                        topic: "admin-broadcast-available",
                    });
                })
            );

            if (trip.customer_id) {
                await supabase.from("notifications").insert({
                    recipient_user_id: trip.customer_id,
                    type: "trip_offered",
                    title: "تم إرسال الطلب للكباتن المتاحين",
                    body: "الرحلة اتبعتت الآن لكل الكباتن المتاحين، وأول ما أحدهم يوافق هيوصلك إشعار فورًا.",
                    payload: {
                        trip_id: id,
                        estimated_price: quotedPrice,
                        dispatch_mode: "admin_broadcast_available",
                        offered_driver_count: eligibleDrivers.length,
                    },
                    related_trip_id: id,
                });
            }

            return NextResponse.json({ success: true, offeredDriverCount: eligibleDrivers.length });
        }

        if (action === "update_status") {
            const requestedStatus = String(body.status || "");
            const note = String(body.note || "").trim();
            if (!requestedStatus) {
                return NextResponse.json({ error: "status is required" }, { status: 400 });
            }
            if (!isTripStatus(requestedStatus)) {
                return NextResponse.json({ error: "حالة الرحلة المطلوبة غير معروفة." }, { status: 400 });
            }

            const { data: trip, error: tripError } = await supabase
                .from("trips")
                .select("id, status")
                .eq("id", id)
                .single();

            if (tripError || !trip) {
                return NextResponse.json({ error: "المشوار المطلوب مش موجود." }, { status: 404 });
            }

            const currentStatus = String(trip.status || "");
            if (!isTripStatus(currentStatus)) {
                return NextResponse.json({ error: "الحالة الحالية للمشوار غير مدعومة." }, { status: 409 });
            }

            if (!canAdminManuallyTransitionTrip(currentStatus, requestedStatus)) {
                return NextResponse.json(
                    {
                        error: "الانتقال اليدوي المطلوب غير مسموح من الحالة الحالية.",
                        currentStatus,
                        allowedStatuses: getAllowedAdminManualTripStatuses(currentStatus),
                    },
                    { status: 409 }
                );
            }

            if (currentStatus === requestedStatus) {
                return NextResponse.json({ success: true, status: currentStatus, noop: true });
            }

            const now = new Date().toISOString();
            const updates: Record<string, unknown> = {
                status: requestedStatus,
                updated_at: now,
            };

            if (requestedStatus === "completed") updates.completed_at = now;
            if (requestedStatus === "driver_on_the_way") updates.driver_on_the_way_at = now;
            if (requestedStatus === "driver_arrived") updates.driver_arrived_at = now;
            if (requestedStatus === "trip_started") updates.trip_started_at = now;
            if (requestedStatus === "cancelled") {
                updates.cancelled_at = now;
                updates.cancelled_by = auth.profile.user.id;
                updates.cancellation_reason = note || "Manual admin cancellation";
            }

            const { error } = await supabase.from("trips").update(updates).eq("id", id);
            if (error) throw error;

            await supabase.from("trip_status_history").insert({
                trip_id: id,
                status: requestedStatus,
                changed_by: auth.profile.user.id,
                note: note || `Admin changed trip status manually from ${currentStatus} to ${requestedStatus}.`,
                metadata: {
                    action: "admin_manual_status_override",
                    from_status: currentStatus,
                    to_status: requestedStatus,
                },
            });

            return NextResponse.json({ success: true, status: requestedStatus });
        }

        if (action === "cancel_trip") {
            const now = new Date().toISOString();
            const { error } = await supabase
                .from("trips")
                .update({
                    status: "cancelled",
                    cancelled_at: now,
                    cancelled_by: auth.profile.user.id,
                    cancellation_reason: body.reason || "Cancelled by admin dashboard",
                    updated_at: now,
                })
                .eq("id", id);

            if (error) throw error;

            await supabase.from("trip_status_history").insert({
                trip_id: id,
                status: "cancelled",
                changed_by: auth.profile.user.id,
                note: String(body.reason || "Cancelled by admin dashboard"),
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Unexpected trip action failure" }, { status: 500 });
    }
}





