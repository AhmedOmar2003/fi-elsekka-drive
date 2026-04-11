import { NextResponse } from "next/server";

import {
  createRideServiceClient,
  requireRideUser,
} from "@/lib/ride-server-auth";
import { resolveAdminNotificationRecipientIds } from "@/lib/admin-notification-targets";
import { sendPushToUserDevices } from "@/lib/user-push-server";

type Params = { params: Promise<{ id: string }> };
type TripMetadata = Record<string, unknown>;

const ROUTE_VERSION = "trip-status-v3-2026-04-09";
const ALREADY_DONE_STATUSES = new Set(["driver_arrived", "trip_started", "waiting_for_return", "completed"]);
const NON_CANCELLABLE_CUSTOMER_STATUSES = new Set(["trip_started", "completed"]);
const DEFAULT_WAITING_PRICE_PER_MINUTE = Number(process.env.WAITING_PRICE_PER_MINUTE || 2);
const DEFAULT_WAITING_FREE_MINUTES = Number(process.env.WAITING_FREE_MINUTES || 5);
const CONFIRM_PRICE_ALIASES = new Set([
  "customer_confirm_price",
  "confirmed",
  "confirm",
  "confirm_price",
  "approve",
  "approve_price",
  "approve_quote",
  "customer_approved_quote",
  "price_confirmed",
]);
const CANCEL_TRIP_ALIASES = new Set([
  "customer_cancel_trip",
  "cancelled",
  "cancel",
  "cancel_trip",
  "trip_cancelled",
  "customer_cancel",
]);
const START_WAITING_ALIASES = new Set([
  "driver_start_waiting",
  "start_waiting",
  "begin_waiting",
]);
const END_WAITING_ALIASES = new Set([
  "driver_end_waiting",
  "end_waiting",
  "stop_waiting",
]);

function asPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function asNonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function asIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

function waitingConfig(metadata: TripMetadata) {
  const waitingPricePerMinute = Math.max(
    0.1,
    Number(
      asPositiveNumber(metadata["waiting_price_per_minute"]) ??
        DEFAULT_WAITING_PRICE_PER_MINUTE
    )
  );
  const waitingFreeMinutes = Math.max(
    0,
    asNonNegativeInt(
      metadata["waiting_free_minutes"],
      Math.max(0, DEFAULT_WAITING_FREE_MINUTES)
    )
  );

  return {
    waitingEnabled: metadata["waiting_enabled"] === true,
    waitingPricePerMinute,
    waitingFreeMinutes,
  };
}

function resolveBaseTripPrice(
  estimatedPrice: unknown,
  metadata: TripMetadata
): number | null {
  const explicitBase =
    asPositiveNumber(metadata["base_price"]) ??
    asPositiveNumber(metadata["admin_selected_price"]) ??
    asPositiveNumber(estimatedPrice) ??
    asPositiveNumber(metadata["map_estimated_price"]);
  return explicitBase;
}

function closeWaitingSession(
  metadata: TripMetadata,
  nowIso: string,
  estimatedPrice: unknown
) {
  const nowDate = new Date(nowIso);
  const config = waitingConfig(metadata);
  let waitingTotalSeconds = asNonNegativeInt(metadata["waiting_total_seconds"], 0);

  const waitingActive = metadata["waiting_active"] === true;
  const waitingStartDate = asIsoDate(metadata["waiting_start_time"]);
  if (waitingActive && waitingStartDate != null) {
    const elapsed = Math.max(
      0,
      Math.floor((nowDate.getTime() - waitingStartDate.getTime()) / 1000)
    );
    waitingTotalSeconds += elapsed;
  }

  const waitingChargeableSeconds = Math.max(
    0,
    waitingTotalSeconds - config.waitingFreeMinutes * 60
  );
  const waitingCost = roundMoney(
    (waitingChargeableSeconds / 60) * config.waitingPricePerMinute
  );
  const basePrice = resolveBaseTripPrice(estimatedPrice, metadata);
  const finalPrice =
    basePrice == null ? null : roundMoney(basePrice + waitingCost);

  const nextMetadata: TripMetadata = {
    ...metadata,
    waiting_enabled: config.waitingEnabled,
    waiting_price_per_minute: config.waitingPricePerMinute,
    waiting_free_minutes: config.waitingFreeMinutes,
    waiting_active: false,
    waiting_start_time: null,
    waiting_last_ended_at: nowIso,
    waiting_total_seconds: waitingTotalSeconds,
    waiting_chargeable_seconds: waitingChargeableSeconds,
    waiting_cost: waitingCost,
    base_price: basePrice,
    final_price: finalPrice,
  };

  return {
    nextMetadata,
    waitingTotalSeconds,
    waitingChargeableSeconds,
    waitingCost,
    finalPrice,
  };
}

export async function POST(request: Request, context: Params) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  const serviceClient = createRideServiceClient();
  if (!serviceClient) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const requestedAction = String(body.action || body.status || body.intent || "").trim().toLowerCase();
    const action = CONFIRM_PRICE_ALIASES.has(requestedAction)
      ? "customer_confirm_price"
      : CANCEL_TRIP_ALIASES.has(requestedAction)
        ? "customer_cancel_trip"
        : START_WAITING_ALIASES.has(requestedAction)
          ? "driver_start_waiting"
          : END_WAITING_ALIASES.has(requestedAction)
            ? "driver_end_waiting"
        : requestedAction;
    const now = new Date().toISOString();

    const { data: trip, error: tripError } = await serviceClient
      .from("trips")
      .select("id, customer_id, assigned_driver_id, trip_type, pickup_label, destination_label, estimated_price, status, is_round_trip, waiting_duration_minutes, return_status, return_destination_label, return_destination_address, return_destination_latitude, return_destination_longitude, metadata")
      .eq("id", id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return NextResponse.json({ error: "المشوار مش موجود." }, { status: 404 });
    }

    const isCustomer = String(trip.customer_id) === auth.profile.user.id;
    const isDriver = String(trip.assigned_driver_id || "") === auth.profile.user.id;

    if (!isCustomer && !isDriver && auth.profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "customer_confirm_arrived" || action === "driver_mark_arrived") {
      if (action === "customer_confirm_arrived" && !isCustomer) {
        return NextResponse.json({ error: "العميل فقط يقدر يؤكد الوصول." }, { status: 403 });
      }
      if (action === "driver_mark_arrived" && !isDriver) {
        return NextResponse.json({ error: "الكابتن فقط يقدر يعلن الوصول." }, { status: 403 });
      }

      if (ALREADY_DONE_STATUSES.has(String(trip.status))) {
        return NextResponse.json({ success: true, status: trip.status, routeVersion: ROUTE_VERSION });
      }

      if (!["accepted", "driver_on_the_way", "offered"].includes(String(trip.status))) {
        return NextResponse.json({ error: "الحالة الحالية لا تسمح بتأكيد الوصول." }, { status: 409 });
      }

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "driver_arrived",
          driver_arrived_at: now,
          updated_at: now,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const note =
        action === "customer_confirm_arrived"
          ? "العميل أكد إن الكابتن وصل لنقطة التحرك."
          : "الكابتن أعلن إنه وصل لنقطة التحرك.";

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "driver_arrived",
        changed_by: auth.profile.user.id,
        note,
      });
      if (historyError) throw historyError;

      if (action === "customer_confirm_arrived" && trip.assigned_driver_id) {
        await serviceClient.from("notifications").insert({
          recipient_user_id: trip.assigned_driver_id,
          type: "driver_arrived",
          title: "العميل أكد وصولك",
          body: "العميل أكد إنك وصلت لنقطة التحرك. ابدأ المشوار لما تكونوا جاهزين.",
          payload: { trip_id: trip.id },
          related_trip_id: trip.id,
        });
      }

      return NextResponse.json({ success: true, status: "driver_arrived", routeVersion: ROUTE_VERSION });
    }

    const metadata: TripMetadata = ((trip.metadata as TripMetadata | null) || {});
    const waitingOptions = waitingConfig(metadata);
    const basePrice = resolveBaseTripPrice(trip.estimated_price, metadata);
    const adminSelectedPrice = metadata["admin_selected_price"];
    const hasQuotedPrice =
      Number(
        typeof adminSelectedPrice === "number" || typeof adminSelectedPrice === "string"
          ? adminSelectedPrice
          : 0
      ) > 0;

    if (action === "customer_confirm_price") {
      if (!isCustomer && auth.profile.role !== "admin") {
        return NextResponse.json({ error: "العميل أو الإدارة فقط يقدروا يؤكدوا السعر." }, { status: 403 });
      }

      if (!hasQuotedPrice) {
        return NextResponse.json({ error: "لسه مفيش سعر نهائي من الإدارة لتأكيده." }, { status: 409 });
      }

      if (["accepted", "driver_on_the_way", "driver_arrived", "trip_started", "waiting_for_return", "completed"].includes(String(trip.status))) {
        return NextResponse.json({ success: true, status: trip.status, routeVersion: ROUTE_VERSION });
      }

      const nextStatus = "searching_driver";
      const nextMetadata = {
        ...metadata,
        awaiting_admin_pricing: false,
        awaiting_admin_dispatch: true,
        customer_price_confirmed: true,
        customer_price_confirmed_at: now,
        dispatch_mode: "admin_assignment_pending",
        base_price: basePrice,
        final_price: basePrice,
      };

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: nextStatus,
          updated_at: now,
          metadata: nextMetadata,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: nextStatus,
        changed_by: auth.profile.user.id,
        note: "العميل وافق على السعر النهائي، والرحلة الآن في انتظار تعيين كابتن من الإدارة.",
        metadata: {
          admin_selected_price: metadata["admin_selected_price"] ?? null,
          dispatch_mode: "admin_assignment_pending",
        },
      });
      if (historyError) throw historyError;

      const adminRecipientIds = await resolveAdminNotificationRecipientIds(serviceClient);

      const adminNotifications = adminRecipientIds.map((adminId) => ({
        recipient_user_id: adminId,
        type: "admin_message",
        title: "العميل أكد السعر",
        body: "العميل وافق على السعر النهائي. عيّن كابتن مناسب للرحلة الآن.",
        payload: {
          trip_id: trip.id,
          action: "assign_driver_after_price_confirmation",
          admin_selected_price: metadata["admin_selected_price"] ?? null,
        },
        related_trip_id: trip.id,
      }));

      if (adminNotifications.length > 0) {
        const insertedNotifications = await Promise.allSettled(
          adminNotifications.map(async (notification) => {
            const { error } = await serviceClient.from("notifications").insert(notification);
            if (error) throw error;
            return notification;
          })
        );
        const failedNotifications = insertedNotifications.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        if (failedNotifications.length > 0) {
          console.error("[rides/status] failed to insert admin notifications after customer_confirm_price", {
            tripId: trip.id,
            failures: failedNotifications.map((result) => String(result.reason)),
          });
        }
        const successfulNotifications = insertedNotifications
          .filter((result): result is PromiseFulfilledResult<(typeof adminNotifications)[number]> => result.status === "fulfilled")
          .map((result) => result.value);

        void Promise.all(
          successfulNotifications.map((notification) =>
            sendPushToUserDevices(serviceClient, notification.recipient_user_id, {
              title: "العميل أكد السعر",
              message: "العميل وافق على السعر النهائي. عيّن كابتن مناسب الآن.",
              link: `/admin/trips/${trip.id}`,
              topic: "admin-customer-price-confirmed",
            })
          )
        ).catch((pushError) => {
          console.error("[rides/status] failed to send admin push notifications after customer_confirm_price", {
            tripId: trip.id,
            error: String(pushError),
          });
        });
      }

      await serviceClient.from("notifications").insert({
        recipient_user_id: trip.customer_id,
        type: "trip_offered",
        title: "تم تأكيد السعر",
        body: "تم تأكيد السعر النهائي، والإدارة تراجع الآن تعيين كابتن مناسب لرحلتك.",
        payload: { trip_id: trip.id },
        related_trip_id: trip.id,
      });

      return NextResponse.json({
        success: true,
        status: nextStatus,
        offeredDriverCount: 0,
        fallbackToAdmin: false,
        routeVersion: ROUTE_VERSION,
      });
    }

    if (action === "customer_cancel_trip") {
      if (!isCustomer && auth.profile.role !== "admin") {
        return NextResponse.json({ error: "العميل أو الإدارة فقط يقدروا يلغوا المشوار." }, { status: 403 });
      }

      if (NON_CANCELLABLE_CUSTOMER_STATUSES.has(String(trip.status))) {
        return NextResponse.json({ error: "المشوار بدأ بالفعل ولا يمكن إلغاؤه من التطبيق." }, { status: 409 });
      }

      const { error: cancelError } = await serviceClient.rpc('cancel_trip_request', {
        p_trip_id: trip.id,
        p_reason: 'تم الإلغاء بواسطة العميل من التطبيق.'
      });

      if (cancelError) throw cancelError;

      const cancelledBy = isCustomer ? "customer" : "admin";
      const cancelledByLabel = isCustomer ? "العميل" : "الإدارة";
      const adminRecipientIds = await resolveAdminNotificationRecipientIds(serviceClient);
      const adminNotifications = adminRecipientIds.map((adminId) => ({
        recipient_user_id: adminId,
        type: "admin_message",
        title: isCustomer ? "العميل ألغى المشوار" : "تم إلغاء المشوار من الإدارة",
        body: `${cancelledByLabel} ألغى الرحلة من ${trip.pickup_label || "نقطة التحرك"} إلى ${trip.destination_label || "الوجهة"}.`,
        payload: {
          trip_id: trip.id,
          action: "trip_cancelled",
          cancelled_by: cancelledBy,
        },
        related_trip_id: trip.id,
      }));

      if (adminNotifications.length > 0) {
        const insertedNotifications = await Promise.allSettled(
          adminNotifications.map(async (notification) => {
            const { error } = await serviceClient.from("notifications").insert(notification);
            if (error) throw error;
            return notification;
          })
        );
        const failedNotifications = insertedNotifications.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        if (failedNotifications.length > 0) {
          console.error("[rides/status] failed to insert admin notifications after customer_cancel_trip", {
            tripId: trip.id,
            failures: failedNotifications.map((result) => String(result.reason)),
          });
        }
        const successfulNotifications = insertedNotifications
          .filter((result): result is PromiseFulfilledResult<(typeof adminNotifications)[number]> => result.status === "fulfilled")
          .map((result) => result.value);

        void Promise.all(
          successfulNotifications.map((notification) =>
            sendPushToUserDevices(serviceClient, notification.recipient_user_id, {
              title: isCustomer ? "العميل ألغى المشوار" : "تم إلغاء المشوار من الإدارة",
              message: `${cancelledByLabel} ألغى الرحلة. افتح المشوار لمراجعة التفاصيل.`,
              link: `/admin/trips/${trip.id}`,
              topic: "admin-trip-cancelled",
            })
          )
        ).catch((pushError) => {
          console.error("[rides/status] failed to send admin push notifications after customer_cancel_trip", {
            tripId: trip.id,
            error: String(pushError),
          });
        });
      }

      return NextResponse.json({ success: true, status: "cancelled", routeVersion: ROUTE_VERSION });
    }

    if (action === "customer_report_driver_delay") {
      if (!isCustomer) {
        return NextResponse.json({ error: "العميل فقط يقدر يبلغ بتأخير الكابتن." }, { status: 403 });
      }

      if (String(trip.status) !== "driver_on_the_way") {
        return NextResponse.json({ error: "الحالة الحالية لا تسمح بتسجيل تأخير الكابتن." }, { status: 409 });
      }

      const adminRecipientIds = await resolveAdminNotificationRecipientIds(serviceClient);

      const adminNotifications = adminRecipientIds.map((adminId) => ({
        recipient_user_id: adminId,
        type: "admin_message",
        title: "العميل بلّغ إن الكابتن متأخر",
        body: "الوقت المتوقع انتهى والعميل أكد إن الكابتن لسه ما وصلش. راجع الرحلة وكلم الكابتن فورًا.",
        payload: { trip_id: trip.id, action: "driver_delay_reported" },
        related_trip_id: trip.id,
      }));

      if (adminNotifications.length > 0) {
        const insertedNotifications = await Promise.allSettled(
          adminNotifications.map((notification) => serviceClient.from("notifications").insert(notification))
        );
        const failedNotifications = insertedNotifications.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        if (failedNotifications.length > 0) {
          console.error("[rides/status] failed to insert admin notifications after report_driver_delay", {
            tripId: trip.id,
            failures: failedNotifications.map((result) => String(result.reason)),
          });
        }
      }

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: String(trip.status),
        changed_by: auth.profile.user.id,
        note: "العميل بلّغ إن الكابتن متأخر عن زمن الوصول المتوقع.",
      });
      if (historyError) throw historyError;

      if (trip.assigned_driver_id) {
        await serviceClient.from("notifications").insert({
          recipient_user_id: trip.assigned_driver_id,
          type: "admin_message",
          title: "العميل منتظرك الآن",
          body: "الوقت المتوقع انتهى والعميل بلّغ إنك لسه ما وصلتش. حدّث حالة الرحلة أو تواصل فورًا.",
          payload: { trip_id: trip.id, action: "driver_delay_reported" },
          related_trip_id: trip.id,
        });
      }

      return NextResponse.json({
        success: true,
        status: trip.status,
        notifiedAdmins: adminNotifications.length,
        routeVersion: ROUTE_VERSION,
      });
    }

    if (action === "driver_start_waiting") {
      if (!isDriver) {
        return NextResponse.json({ error: "الكابتن فقط يقدر يبدأ الانتظار." }, { status: 403 });
      }
      if (!waitingOptions.waitingEnabled) {
        return NextResponse.json({ error: "الانتظار غير مفعل في هذه الرحلة." }, { status: 409 });
      }

      const canStartWaiting =
        String(trip.status) === "trip_started" ||
        (String(trip.status) === "waiting_for_return" && trip.is_round_trip === true);
      if (!canStartWaiting) {
        return NextResponse.json({ error: "لا يمكن بدء الانتظار في الحالة الحالية." }, { status: 409 });
      }

      if (metadata["waiting_active"] === true) {
        return NextResponse.json({ success: true, status: trip.status, waitingActive: true, routeVersion: ROUTE_VERSION });
      }

      const nextMetadata: TripMetadata = {
        ...metadata,
        waiting_enabled: true,
        waiting_price_per_minute: waitingOptions.waitingPricePerMinute,
        waiting_free_minutes: waitingOptions.waitingFreeMinutes,
        waiting_active: true,
        waiting_start_time: now,
        waiting_last_started_at: now,
        base_price: basePrice,
      };

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          metadata: nextMetadata,
          updated_at: now,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: String(trip.status),
        changed_by: auth.profile.user.id,
        note: "الكابتن بدأ احتساب وقت الانتظار.",
        metadata: {
          waiting_active: true,
          waiting_start_time: now,
          waiting_price_per_minute: waitingOptions.waitingPricePerMinute,
          waiting_free_minutes: waitingOptions.waitingFreeMinutes,
        },
      });
      if (historyError) throw historyError;

      await serviceClient.from("notifications").insert({
        recipient_user_id: trip.customer_id,
        type: "trip_offered",
        title: "بدأ وقت الانتظار",
        body: `تم تشغيل الانتظار. أول ${waitingOptions.waitingFreeMinutes} دقائق مجانًا ثم يتم الاحتساب بالدقيقة.`,
        payload: {
          trip_id: trip.id,
          waiting_active: true,
          waiting_start_time: now,
          waiting_price_per_minute: waitingOptions.waitingPricePerMinute,
          waiting_free_minutes: waitingOptions.waitingFreeMinutes,
        },
        related_trip_id: trip.id,
      });

      return NextResponse.json({
        success: true,
        status: trip.status,
        waitingActive: true,
        routeVersion: ROUTE_VERSION,
      });
    }

    if (action === "driver_end_waiting") {
      if (!isDriver) {
        return NextResponse.json({ error: "الكابتن فقط يقدر ينهي الانتظار." }, { status: 403 });
      }
      if (!waitingOptions.waitingEnabled) {
        return NextResponse.json({ error: "الانتظار غير مفعل في هذه الرحلة." }, { status: 409 });
      }

      if (metadata["waiting_active"] !== true) {
        return NextResponse.json({
          success: true,
          status: trip.status,
          waitingActive: false,
          waitingCost: Number(metadata["waiting_cost"] || 0),
          routeVersion: ROUTE_VERSION,
        });
      }

      const closedWaiting = closeWaitingSession(metadata, now, trip.estimated_price);

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          metadata: closedWaiting.nextMetadata,
          estimated_price: closedWaiting.finalPrice ?? trip.estimated_price,
          updated_at: now,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const waitingMinutes = Number((closedWaiting.waitingTotalSeconds / 60).toFixed(1));
      const chargeableMinutes = Number((closedWaiting.waitingChargeableSeconds / 60).toFixed(1));

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: String(trip.status),
        changed_by: auth.profile.user.id,
        note: "الكابتن أنهى الانتظار وتم تحديث التكلفة.",
        metadata: {
          waiting_active: false,
          waiting_total_minutes: waitingMinutes,
          waiting_chargeable_minutes: chargeableMinutes,
          waiting_cost: closedWaiting.waitingCost,
          final_price: closedWaiting.finalPrice,
        },
      });
      if (historyError) throw historyError;

      await serviceClient.from("notifications").insert({
        recipient_user_id: trip.customer_id,
        type: "trip_offered",
        title: "تم إنهاء الانتظار",
        body: `وقت الانتظار: ${waitingMinutes} دقيقة (المحتسب ${chargeableMinutes} دقيقة).`,
        payload: {
          trip_id: trip.id,
          waiting_active: false,
          waiting_total_seconds: closedWaiting.waitingTotalSeconds,
          waiting_chargeable_seconds: closedWaiting.waitingChargeableSeconds,
          waiting_cost: closedWaiting.waitingCost,
          final_price: closedWaiting.finalPrice,
        },
        related_trip_id: trip.id,
      });

      return NextResponse.json({
        success: true,
        status: trip.status,
        waitingActive: false,
        waitingTotalSeconds: closedWaiting.waitingTotalSeconds,
        waitingCost: closedWaiting.waitingCost,
        finalPrice: closedWaiting.finalPrice,
        routeVersion: ROUTE_VERSION,
      });
    }

    if (action === "driver_start_trip") {
      if (!isDriver) {
        return NextResponse.json({ error: "الكابتن فقط يقدر يبدأ المشوار." }, { status: 403 });
      }

      if (String(trip.status) === "trip_started" || String(trip.status) === "completed") {
        return NextResponse.json({ success: true, status: trip.status, routeVersion: ROUTE_VERSION });
      }
      if (String(trip.status) !== "driver_arrived") {
        return NextResponse.json({ error: "لازم الكابتن يكون وصل الأول." }, { status: 409 });
      }

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "trip_started",
          trip_started_at: now,
          updated_at: now,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "trip_started",
        changed_by: auth.profile.user.id,
        note: "الكابتن بدأ المشوار.",
      });
      if (historyError) throw historyError;

      await serviceClient.from("notifications").insert({
        recipient_user_id: trip.customer_id,
        type: "trip_started",
        title: "المشوار بدأ",
        body: "الكابتن بدأ المشوار. ربنا يوصلك بالسلامة.",
        payload: { trip_id: trip.id },
        related_trip_id: trip.id,
      });

      void sendPushToUserDevices(serviceClient, trip.customer_id, {
        title: "المشوار بدأ",
        message: "الكابتن بدأ المشوار. تقدر تتابع الحالة من التطبيق.",
        link: "/trip/live",
        topic: "trip-started",
      }).catch((pushError) => {
        console.error("[rides/status] failed to send trip-started push", {
          tripId: trip.id,
          error: String(pushError),
        });
      });

      return NextResponse.json({ success: true, status: "trip_started", routeVersion: ROUTE_VERSION });
    }

    if (action === "customer_start_return") {
      if (!isCustomer && auth.profile.role !== "admin") {
        return NextResponse.json({ error: "العميل أو الإدارة فقط يقدروا يبدأوا الرجوع." }, { status: 403 });
      }

      if (trip.is_round_trip !== true) {
        return NextResponse.json({ error: "المشوار الحالي ليس ذهاب وعودة." }, { status: 409 });
      }

      if (String(trip.status) === "trip_started" && trip.return_status === "return_in_progress") {
        return NextResponse.json({ success: true, status: "trip_started", routeVersion: ROUTE_VERSION });
      }

      if (String(trip.status) !== "waiting_for_return" || String(trip.return_status) !== "waiting_for_return") {
        return NextResponse.json({ error: "الرحلة ليست في مرحلة انتظار الرجوع." }, { status: 409 });
      }

      const closedWaiting =
        metadata["waiting_active"] === true
          ? closeWaitingSession(metadata, now, trip.estimated_price)
          : null;

      const nextMetadata = {
        ...(closedWaiting?.nextMetadata ?? metadata),
        return_status: "return_in_progress",
        return_started_at: now,
      };

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "trip_started",
          return_status: "return_in_progress",
          return_started_at: now,
          estimated_price: closedWaiting?.finalPrice ?? trip.estimated_price,
          updated_at: now,
          metadata: nextMetadata,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "trip_started",
        changed_by: auth.profile.user.id,
        note: "العميل أكد بدء رحلة الرجوع مع نفس الكابتن.",
        metadata: {
          round_trip: true,
          return_status: "return_in_progress",
          waiting_cost: closedWaiting?.waitingCost ?? metadata["waiting_cost"] ?? 0,
          final_price: closedWaiting?.finalPrice ?? metadata["final_price"] ?? null,
        },
      });
      if (historyError) throw historyError;

      if (trip.assigned_driver_id) {
        await serviceClient.from("notifications").insert({
          recipient_user_id: trip.assigned_driver_id,
          type: "trip_started",
          title: "العميل جاهز للرجوع",
          body: "رحلة الرجوع بدأت الآن. تحرك بالعميل إلى نقطة الرجوع المتفق عليها.",
          payload: { trip_id: trip.id, return_status: "return_in_progress" },
          related_trip_id: trip.id,
        });
      }

      return NextResponse.json({ success: true, status: "trip_started", routeVersion: ROUTE_VERSION });
    }

    if (action === "customer_cancel_return") {
      if (!isCustomer && auth.profile.role !== "admin") {
        return NextResponse.json({ error: "العميل أو الإدارة فقط يقدروا يلغوا الرجوع." }, { status: 403 });
      }

      if (trip.is_round_trip !== true) {
        return NextResponse.json({ error: "المشوار الحالي ليس ذهاب وعودة." }, { status: 409 });
      }

      if (String(trip.status) === "completed" && String(trip.return_status) === "return_cancelled") {
        return NextResponse.json({ success: true, status: "completed", routeVersion: ROUTE_VERSION });
      }

      if (String(trip.status) !== "waiting_for_return") {
        return NextResponse.json({ error: "لا يمكن إلغاء الرجوع إلا أثناء الانتظار في الوجهة." }, { status: 409 });
      }

      const closedWaiting =
        metadata["waiting_active"] === true
          ? closeWaitingSession(metadata, now, trip.estimated_price)
          : null;

      const nextMetadata = {
        ...(closedWaiting?.nextMetadata ?? metadata),
        return_status: "return_cancelled",
        return_cancelled_at: now,
      };

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "completed",
          completed_at: now,
          return_status: "return_cancelled",
          return_cancelled_at: now,
          estimated_price: closedWaiting?.finalPrice ?? trip.estimated_price,
          updated_at: now,
          metadata: nextMetadata,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      if (trip.assigned_driver_id) {
        await serviceClient
          .from("driver_profiles")
          .update({
            availability_status: "available",
            last_seen_at: now,
          })
          .eq("id", trip.assigned_driver_id);
      }

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "completed",
        changed_by: auth.profile.user.id,
        note: "العميل ألغى رحلة الرجوع، وتم إغلاق المشوار بالكامل.",
        metadata: {
          round_trip: true,
          return_status: "return_cancelled",
          waiting_cost: closedWaiting?.waitingCost ?? metadata["waiting_cost"] ?? 0,
          final_price: closedWaiting?.finalPrice ?? metadata["final_price"] ?? null,
        },
      });
      if (historyError) throw historyError;

      const cancelledBy = isCustomer ? "customer" : "admin";
      const cancelledByLabel = isCustomer ? "العميل" : "الإدارة";
      const adminRecipientIds = await resolveAdminNotificationRecipientIds(serviceClient);
      const adminNotifications = adminRecipientIds.map((adminId) => ({
        recipient_user_id: adminId,
        type: "admin_message",
        title: "تم إلغاء رحلة الرجوع",
        body: `${cancelledByLabel} ألغى جزء الرجوع في رحلة الذهاب والعودة، وتم إغلاق الرحلة.`,
        payload: {
          trip_id: trip.id,
          action: "return_cancelled",
          cancelled_by: cancelledBy,
        },
        related_trip_id: trip.id,
      }));

      if (adminNotifications.length > 0) {
        const insertedNotifications = await Promise.allSettled(
          adminNotifications.map(async (notification) => {
            const { error } = await serviceClient.from("notifications").insert(notification);
            if (error) throw error;
            return notification;
          })
        );
        const failedNotifications = insertedNotifications.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        if (failedNotifications.length > 0) {
          console.error("[rides/status] failed to insert admin notifications after customer_cancel_return", {
            tripId: trip.id,
            failures: failedNotifications.map((result) => String(result.reason)),
          });
        }
        const successfulNotifications = insertedNotifications
          .filter((result): result is PromiseFulfilledResult<(typeof adminNotifications)[number]> => result.status === "fulfilled")
          .map((result) => result.value);

        void Promise.all(
          successfulNotifications.map((notification) =>
            sendPushToUserDevices(serviceClient, notification.recipient_user_id, {
              title: "تم إلغاء رحلة الرجوع",
              message: `${cancelledByLabel} ألغى رحلة الرجوع. راجع تفاصيل المشوار.`,
              link: `/admin/trips/${trip.id}`,
              topic: "admin-return-cancelled",
            })
          )
        ).catch((pushError) => {
          console.error("[rides/status] failed to send admin push notifications after customer_cancel_return", {
            tripId: trip.id,
            error: String(pushError),
          });
        });
      }

      return NextResponse.json({ success: true, status: "completed", routeVersion: ROUTE_VERSION });
    }

    if (action === "driver_complete_trip") {
      if (!isDriver) {
        return NextResponse.json({ error: "الكابتن فقط يقدر ينهي المشوار." }, { status: 403 });
      }

      if (String(trip.status) === "completed") {
        return NextResponse.json({ success: true, status: "completed", routeVersion: ROUTE_VERSION });
      }
      if (!["trip_started", "driver_arrived"].includes(String(trip.status))) {
        return NextResponse.json({ error: "لازم المشوار يكون بدأ أو الكابتن وصل الأول." }, { status: 409 });
      }

      const isRoundTrip = trip.is_round_trip === true;
      const returnStatus = String(trip.return_status || "not_applicable");
      const closedWaiting =
        metadata["waiting_active"] === true
          ? closeWaitingSession(metadata, now, trip.estimated_price)
          : null;

      if (isRoundTrip && returnStatus == "outbound") {
        const nextMetadata = {
          ...(closedWaiting?.nextMetadata ?? metadata),
          return_status: "waiting_for_return",
          waiting_for_return_at: now,
        };

        const { error: updateError } = await serviceClient
          .from("trips")
          .update({
            status: "waiting_for_return",
            waiting_for_return_at: now,
            return_status: "waiting_for_return",
            estimated_price: closedWaiting?.finalPrice ?? trip.estimated_price,
            updated_at: now,
            metadata: nextMetadata,
          })
          .eq("id", trip.id);
        if (updateError) throw updateError;

        const { error: historyError } = await serviceClient.from("trip_status_history").insert({
          trip_id: trip.id,
          status: "waiting_for_return",
          changed_by: auth.profile.user.id,
          note: "وصلتم لوجهة الذهاب. الرحلة الآن في انتظار تأكيد الرجوع من العميل.",
          metadata: {
            round_trip: true,
            return_status: "waiting_for_return",
            waiting_duration_minutes: trip.waiting_duration_minutes ?? null,
            waiting_cost: closedWaiting?.waitingCost ?? metadata["waiting_cost"] ?? 0,
            final_price: closedWaiting?.finalPrice ?? metadata["final_price"] ?? null,
          },
        });
        if (historyError) throw historyError;

        await serviceClient.from("notifications").insert({
          recipient_user_id: trip.customer_id,
          type: "driver_arrived",
          title: "وصلتم لوجهة الذهاب",
          body: "دي رحلة ذهاب وعودة. لما تبقى جاهز، اضغط ابدأ الرجوع. ولو لسه، خليك على وضع الانتظار.",
          payload: {
            trip_id: trip.id,
            round_trip: true,
            return_status: "waiting_for_return",
          },
          related_trip_id: trip.id,
        });

        return NextResponse.json({ success: true, status: "waiting_for_return", routeVersion: ROUTE_VERSION });
      }

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: "completed",
          completed_at: now,
          return_status: isRoundTrip ? "return_completed" : trip.return_status,
          estimated_price: closedWaiting?.finalPrice ?? trip.estimated_price,
          updated_at: now,
          metadata: {
            ...(closedWaiting?.nextMetadata ?? metadata),
            return_status: isRoundTrip ? "return_completed" : metadata["return_status"],
          },
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      if (trip.assigned_driver_id) {
        await serviceClient
          .from("driver_profiles")
          .update({
            availability_status: "available",
            last_seen_at: now,
          })
          .eq("id", trip.assigned_driver_id);
      }

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: "completed",
        changed_by: auth.profile.user.id,
        note: isRoundTrip
          ? "الكابتن أنهى رحلة الرجوع واكتملت الرحلة بالكامل."
          : "الكابتن أنهى المشوار ووصل للوجهة.",
        metadata: isRoundTrip
          ? {
              round_trip: true,
              return_status: "return_completed",
              waiting_cost: closedWaiting?.waitingCost ?? metadata["waiting_cost"] ?? 0,
              final_price: closedWaiting?.finalPrice ?? metadata["final_price"] ?? null,
            }
          : {},
      });
      if (historyError) throw historyError;

      await serviceClient.from("notifications").insert({
        recipient_user_id: trip.customer_id,
        type: "trip_completed",
        title: "المشوار اكتمل",
        body: "وصلت لوجهتك؟ قيّم الكابتن بنجوم وتعليق علشان تساعدنا نحسن الخدمة.",
        payload: { trip_id: trip.id, request_review: true },
        related_trip_id: trip.id,
      });

      void sendPushToUserDevices(serviceClient, trip.customer_id, {
        title: "المشوار اكتمل",
        message: "لو وصلت بالسلامة، قيّم الكابتن من التطبيق.",
        link: "/trip/live",
        requireInteraction: true,
        topic: "trip-completed",
      }).catch((pushError) => {
        console.error("[rides/status] failed to send trip-completed push", {
          tripId: trip.id,
          error: String(pushError),
        });
      });

      return NextResponse.json({ success: true, status: "completed", routeVersion: ROUTE_VERSION });
    }

    if (isCustomer && hasQuotedPrice && ["pending", "searching_driver", "offered"].includes(String(trip.status))) {
      const nextStatus = "searching_driver";
      const nextMetadata = {
        ...metadata,
        awaiting_admin_pricing: false,
        awaiting_admin_dispatch: true,
        customer_price_confirmed: true,
        customer_price_confirmed_at: now,
        dispatch_mode: "admin_assignment_pending",
        base_price: basePrice,
        final_price: basePrice,
      };

      const { error: updateError } = await serviceClient
        .from("trips")
        .update({
          status: nextStatus,
          updated_at: now,
          metadata: nextMetadata,
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      const { error: historyError } = await serviceClient.from("trip_status_history").insert({
        trip_id: trip.id,
        status: nextStatus,
        changed_by: auth.profile.user.id,
        note: `تم تأكيد السعر من العميل عبر مسار متوافق (${requestedAction || "unknown_action"}).`,
        metadata: {
          admin_selected_price: metadata["admin_selected_price"] ?? null,
          requested_action: requestedAction || null,
          dispatch_mode: "admin_assignment_pending",
        },
      });
      if (historyError) throw historyError;

      const adminRecipientIds = await resolveAdminNotificationRecipientIds(serviceClient);

      const adminNotifications = adminRecipientIds.map((adminId) => ({
        recipient_user_id: adminId,
        type: "admin_message",
        title: "العميل أكد السعر",
        body: "العميل وافق على السعر النهائي. عيّن كابتن مناسب للرحلة الآن.",
        payload: {
          trip_id: trip.id,
          action: "assign_driver_after_price_confirmation",
          admin_selected_price: metadata["admin_selected_price"] ?? null,
        },
        related_trip_id: trip.id,
      }));

      if (adminNotifications.length > 0) {
        const insertedNotifications = await Promise.allSettled(
          adminNotifications.map(async (notification) => {
            const { error } = await serviceClient.from("notifications").insert(notification);
            if (error) throw error;
            return notification;
          })
        );
        const failedNotifications = insertedNotifications.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        if (failedNotifications.length > 0) {
          console.error("[rides/status] failed to insert admin notifications after customer_confirm_price_status", {
            tripId: trip.id,
            failures: failedNotifications.map((result) => String(result.reason)),
          });
        }
        const successfulNotifications = insertedNotifications
          .filter((result): result is PromiseFulfilledResult<(typeof adminNotifications)[number]> => result.status === "fulfilled")
          .map((result) => result.value);

        void Promise.all(
          successfulNotifications.map((notification) =>
            sendPushToUserDevices(serviceClient, notification.recipient_user_id, {
              title: "العميل أكد السعر",
              message: "العميل وافق على السعر النهائي. عيّن كابتن مناسب الآن.",
              link: `/admin/trips/${trip.id}`,
              topic: "admin-customer-price-confirmed",
            })
          )
        ).catch((pushError) => {
          console.error("[rides/status] failed to send admin push notifications after customer_confirm_price_status", {
            tripId: trip.id,
            error: String(pushError),
          });
        });
      }

      return NextResponse.json({
        success: true,
        status: nextStatus,
        offeredDriverCount: 0,
        fallbackToAdmin: false,
        normalizedAction: "customer_confirm_price",
        routeVersion: ROUTE_VERSION,
      });
    }

    return NextResponse.json(
      { error: "العملية المطلوبة غير مدعومة.", action: requestedAction || null, routeVersion: ROUTE_VERSION },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر تحديث حالة المشوار.", routeVersion: ROUTE_VERSION },
      { status: 500 }
    );
  }
}
