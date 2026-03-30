import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import { hasPermission } from "@/lib/permissions";

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
            const driverId = String(body.driverId || "");
            const vehicleId = body.vehicleId ? String(body.vehicleId) : null;
            if (!driverId) {
                return NextResponse.json({ error: "driverId is required for dispatch_offer" }, { status: 400 });
            }

            const now = new Date().toISOString();
            const { data: offer, error: offerError } = await supabase
                .from("trip_offers")
                .insert({
                    trip_id: id,
                    driver_id: driverId,
                    vehicle_id: vehicleId,
                    offered_by_admin_id: auth.profile.user.id,
                    offer_status: "offered",
                    offered_at: now,
                })
                .select("id")
                .single();

            if (offerError) throw offerError;

            const { error: tripError } = await supabase
                .from("trips")
                .update({
                    status: "offered",
                    offered_at: now,
                    updated_at: now,
                })
                .eq("id", id);

            if (tripError) throw tripError;

            await supabase.from("trip_status_history").insert({
                trip_id: id,
                status: "offered",
                changed_by: auth.profile.user.id,
                note: "Admin dispatched trip offer to driver",
            });

            await supabase.from("notifications").insert({
                recipient_user_id: driverId,
                type: "trip_offered",
                title: "مشوار جديد متاح",
                body: "تم إرسال مشوار جديد لك من لوحة التشغيل.",
                payload: { offer_id: offer.id },
                related_trip_id: id,
            });

            return NextResponse.json({ success: true, offerId: offer.id });
        }

        if (action === "assign_driver") {
            const driverId = String(body.driverId || "");
            const vehicleId = body.vehicleId ? String(body.vehicleId) : null;
            if (!driverId) {
                return NextResponse.json({ error: "driverId is required for assign_driver" }, { status: 400 });
            }

            const now = new Date().toISOString();
            const { error } = await supabase
                .from("trips")
                .update({
                    assigned_driver_id: driverId,
                    assigned_vehicle_id: vehicleId,
                    status: "accepted",
                    accepted_at: now,
                    updated_at: now,
                })
                .eq("id", id);

            if (error) throw error;

            await supabase.from("trip_status_history").insert({
                trip_id: id,
                status: "accepted",
                changed_by: auth.profile.user.id,
                note: "Admin assigned driver directly from dispatch board",
            });

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
