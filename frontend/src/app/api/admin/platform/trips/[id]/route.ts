import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import { hasPermission } from "@/lib/permissions";
import { sendPushToUserDevices } from "@/lib/user-push-server";

type Context = { params: Promise<{ id: string }> };

type DriverCandidate = {
    id: string;
    fullName: string;
    workingCity: string | null;
    workingArea: string | null;
    vehicleId: string | null;
    vehicleType: "car" | "tuk_tuk" | null;
    vehicleLabel: string | null;
    score: number;
};

function normalizePreferredVehicleType(value: unknown, tripType: string) {
    if (tripType === "airport_ride") return "car";
    return value === "car" || value === "tuk_tuk" ? value : "any";
}

async function fetchEligibleDriversForTrip(
    supabase: NonNullable<ReturnType<typeof createAdminPlatformClient>>,
    trip: { trip_type: string; metadata: Record<string, unknown> | null }
): Promise<DriverCandidate[]> {
    const preferredVehicleType = normalizePreferredVehicleType(trip.metadata?.preferred_vehicle_type, String(trip.trip_type));
    const pickupCity = typeof trip.metadata?.pickup_city === "string" ? trip.metadata.pickup_city : null;
    const pickupArea = typeof trip.metadata?.pickup_area === "string" ? trip.metadata.pickup_area : null;

    const { data: driverProfiles, error: driversError } = await supabase
        .from("driver_profiles")
        .select("id, working_city, working_area, availability_status, is_accepting_offers, application_status, verification_status")
        .eq("availability_status", "online")
        .eq("is_accepting_offers", true)
        .eq("application_status", "approved")
        .eq("verification_status", "approved");

    if (driversError) throw driversError;

    const driverIds = (driverProfiles || []).map((driver) => String(driver.id));
    if (driverIds.length === 0) return [];

    const [{ data: profiles, error: profilesError }, { data: vehicles, error: vehiclesError }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, account_status").in("id", driverIds),
        supabase
            .from("vehicles")
            .select("id, driver_id, vehicle_type, approval_status, is_primary, is_active, brand, model")
            .in("driver_id", driverIds)
            .eq("approval_status", "approved")
            .eq("is_primary", true)
            .eq("is_active", true),
    ]);

    if (profilesError) throw profilesError;
    if (vehiclesError) throw vehiclesError;

    const activeProfiles = new Map(
        (profiles || [])
            .filter((profile) => profile.account_status === "active")
            .map((profile) => [String(profile.id), String(profile.full_name || "كابتن")])
    );

    const primaryVehicleByDriver = new Map(
        (vehicles || []).map((vehicle) => [String(vehicle.driver_id), vehicle])
    );

    return (driverProfiles || [])
        .filter((driver) => activeProfiles.has(String(driver.id)))
        .map((driver) => {
            const vehicle = primaryVehicleByDriver.get(String(driver.id));
            const cityScore = pickupCity && driver.working_city && String(driver.working_city).toLowerCase().includes(String(pickupCity).toLowerCase()) ? 2 : 0;
            const areaScore = pickupArea && driver.working_area && String(driver.working_area).toLowerCase().includes(String(pickupArea).toLowerCase()) ? 1 : 0;

            return {
                id: String(driver.id),
                fullName: activeProfiles.get(String(driver.id)) || "كابتن",
                workingCity: driver.working_city as string | null,
                workingArea: driver.working_area as string | null,
                vehicleId: vehicle ? String(vehicle.id) : null,
                vehicleType: vehicle ? (String(vehicle.vehicle_type) as "car" | "tuk_tuk") : null,
                vehicleLabel: vehicle ? `${String(vehicle.brand)} ${String(vehicle.model)} · ${String(vehicle.vehicle_type)}` : null,
                score: cityScore + areaScore,
            } satisfies DriverCandidate;
        })
        .filter((driver) => {
            if (!driver.vehicleId || !driver.vehicleType) return false;
            if (preferredVehicleType === "any") return true;
            return driver.vehicleType === preferredVehicleType;
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 12);
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
                return NextResponse.json({ error: "حدد سعر صحيح قبل إرسال العرض للكباتن." }, { status: 400 });
            }

            const { data: trip, error: tripError } = await supabase
                .from("trips")
                .select("id, trip_type, status, customer_id, pickup_label, destination_label, estimated_price, metadata")
                .eq("id", id)
                .single();

            if (tripError || !trip) {
                return NextResponse.json({ error: "المشوار المطلوب مش موجود." }, { status: 404 });
            }

            if (["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "completed", "cancelled"].includes(String(trip.status))) {
                return NextResponse.json({ error: "المشوار خرج من مرحلة التوزيع، وما ينفعش يتبعت من جديد." }, { status: 400 });
            }

            const rankedDrivers = await fetchEligibleDriversForTrip(supabase, {
                trip_type: String(trip.trip_type),
                metadata: (trip.metadata as Record<string, unknown> | null) || null,
            });

            if (rankedDrivers.length === 0) {
                return NextResponse.json({ error: "مفيش كباتن متاحين حاليًا بالمركبة المناسبة للمشوار ده." }, { status: 400 });
            }

            const now = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
            const metadata = ((trip.metadata as Record<string, unknown> | null) || {});
            const fallbackMapEstimate =
                trip.estimated_price === null
                    ? Number((metadata.map_estimated_price as number | null) ?? 0) || null
                    : Number(trip.estimated_price);
            const broadcastPrice = price ?? fallbackMapEstimate;
            const offersPayload = rankedDrivers.map((driver) => ({
                trip_id: id,
                driver_id: driver.id,
                vehicle_id: driver.vehicleId,
                offered_by_admin_id: auth.profile.user.id,
                offer_status: "offered",
                offered_at: now,
                responded_at: null,
                rejection_reason: null,
                expires_at: expiresAt,
                metadata: {
                    ...metadata,
                    dispatch_mode: "admin_broadcast",
                    broadcast_price: broadcastPrice,
                    matched_score: driver.score,
                },
                updated_at: now,
            }));

            const { error: offersError } = await supabase
                .from("trip_offers")
                .upsert(offersPayload, { onConflict: "trip_id,driver_id" });

            if (offersError) throw offersError;

            const { error: tripUpdateError } = await supabase
                .from("trips")
                .update({
                    status: "offered",
                    offered_at: now,
                    updated_at: now,
                    estimated_price: broadcastPrice,
                    offered_driver_count: rankedDrivers.length,
                    metadata: {
                        ...metadata,
                        admin_selected_price: broadcastPrice,
                        admin_priced_at: now,
                        admin_priced_by: auth.profile.user.id,
                        latest_dispatch_mode: "admin_broadcast",
                        latest_dispatch_driver_count: rankedDrivers.length,
                    },
                })
                .eq("id", id);

            if (tripUpdateError) throw tripUpdateError;

            await supabase.from("trip_status_history").insert({
                trip_id: id,
                status: "offered",
                changed_by: auth.profile.user.id,
                note: `تم تسعير المشوار وبعت العرض إلى ${rankedDrivers.length} كابتن مناسبين.`,
                metadata: {
                    offered_driver_count: rankedDrivers.length,
                    quoted_price: broadcastPrice,
                },
            });

            const notificationsPayload = rankedDrivers.map((driver) => ({
                recipient_user_id: driver.id,
                type: "trip_offered",
                title: "عرض مشوار جديد من الإدارة",
                body: `مشوار من ${String(trip.pickup_label || "نقطة التحرك")} إلى ${String(trip.destination_label || "الوجهة")}. السعر المحدد: ${broadcastPrice ? `${broadcastPrice} ج.م` : "سيظهر داخل الطلب"}.`,
                payload: {
                    trip_id: id,
                    estimated_price: broadcastPrice,
                    dispatch_mode: "admin_broadcast",
                },
                related_trip_id: id,
            }));

            const { error: notificationsError } = await supabase.from("notifications").insert(notificationsPayload);
            if (notificationsError) throw notificationsError;

            await Promise.all(
                rankedDrivers.map((driver) =>
                    sendPushToUserDevices(supabase, driver.id, {
                        title: "وصلك عرض مشوار جديد",
                        message: `مشوار من ${String(trip.pickup_label || "نقطة التحرك")} إلى ${String(trip.destination_label || "الوجهة")}. افتح التطبيق ولو العرض مناسب اقبله قبل غيرك.`,
                        link: "/captain/offers",
                        requireInteraction: true,
                        topic: "admin-broadcast-offer",
                    })
                )
            );

            if (trip.customer_id) {
                await supabase.from("notifications").insert({
                    recipient_user_id: trip.customer_id,
                    type: "trip_offered",
                    title: "عرضنا رحلتك على الكباتن",
                    body: `دلوقتي رحلتك اتبعت لـ ${rankedDrivers.length} كابتن مناسبين. أول ما حد يقبل هنبلّغك فورًا.`,
                    payload: {
                        trip_id: id,
                        offered_driver_count: rankedDrivers.length,
                        estimated_price: broadcastPrice,
                        dispatch_mode: "admin_broadcast",
                    },
                    related_trip_id: id,
                });

                await sendPushToUserDevices(supabase, trip.customer_id, {
                    title: "عرضنا رحلتك على الكباتن",
                    message: "رحلتك اتبعت للكباتن المناسبين، وأول ما كابتن يقبل هنبلغك فورًا.",
                    link: "/trip/live",
                    topic: "customer-trip-offered",
                });
            }

            return NextResponse.json({ success: true, offeredDriverCount: rankedDrivers.length, price: broadcastPrice });
        }

        if (action === "assign_driver") {
            const driverId = String(body.driverId || "");
            const vehicleId = body.vehicleId ? String(body.vehicleId) : null;
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

            await sendPushToUserDevices(supabase, driverId, {
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

        if (action === "update_status") {
            const status = String(body.status || "");
            if (!status) {
                return NextResponse.json({ error: "status is required" }, { status: 400 });
            }

            const now = new Date().toISOString();
            const updates: Record<string, unknown> = {
                status,
                updated_at: now,
            };

            if (status === "completed") updates.completed_at = now;
            if (status === "driver_on_the_way") updates.driver_on_the_way_at = now;
            if (status === "driver_arrived") updates.driver_arrived_at = now;
            if (status === "trip_started") updates.trip_started_at = now;

            const { error } = await supabase.from("trips").update(updates).eq("id", id);
            if (error) throw error;

            await supabase.from("trip_status_history").insert({
                trip_id: id,
                status,
                changed_by: auth.profile.user.id,
                note: "Admin updated trip status from dashboard",
            });

            return NextResponse.json({ success: true });
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





