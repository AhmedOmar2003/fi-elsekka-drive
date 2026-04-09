import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import { hasPermission } from "@/lib/permissions";
import { fetchEligibleDriversForTrip } from "@/lib/ride-dispatch-server";
import { canAdminManuallyTransitionTrip, getAllowedAdminManualTripStatuses, isTripStatus } from "@/lib/trip-state-machine";
import { sendPushToUserDevices } from "@/lib/user-push-server";

type Context = { params: Promise<{ id: string }> };

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

            if (["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return", "completed", "cancelled"].includes(String(trip.status))) {
                return NextResponse.json({ error: "المشوار خرج من مرحلة التوزيع، وما ينفعش يتبعت من جديد." }, { status: 400 });
            }

            const eligibility = await fetchEligibleDriversForTrip(supabase, {
                trip_type: String(trip.trip_type),
                metadata: (trip.metadata as Record<string, unknown> | null) || null,
            });

            if (eligibility.drivers.length === 0) {
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
            const offersPayload = eligibility.drivers.map((driver) => ({
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
                    offered_driver_count: eligibility.drivers.length,
                    metadata: {
                        ...metadata,
                        admin_selected_price: broadcastPrice,
                        admin_priced_at: now,
                        admin_priced_by: auth.profile.user.id,
                        latest_dispatch_mode: "admin_broadcast",
                        latest_dispatch_driver_count: eligibility.drivers.length,
                    },
                })
                .eq("id", id);

            if (tripUpdateError) throw tripUpdateError;

            await supabase.from("trip_status_history").insert({
                trip_id: id,
                status: "offered",
                changed_by: auth.profile.user.id,
                note: `تم تسعير المشوار وبعت العرض إلى ${eligibility.drivers.length} كابتن مناسبين.`,
                metadata: {
                    offered_driver_count: eligibility.drivers.length,
                    quoted_price: broadcastPrice,
                },
            });

            const notificationsPayload = eligibility.drivers.map((driver) => ({
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
                eligibility.drivers.map((driver) =>
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
                        body: `دلوقتي رحلتك اتبعت لـ ${eligibility.drivers.length} كابتن مناسبين. أول ما حد يقبل هنبلّغك فورًا.`,
                        payload: {
                            trip_id: id,
                            offered_driver_count: eligibility.drivers.length,
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

            return NextResponse.json({ success: true, offeredDriverCount: eligibility.drivers.length, price: broadcastPrice });
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





