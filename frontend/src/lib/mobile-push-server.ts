type MobilePushPayload = {
  title: string;
  message: string;
  link?: string;
  requireInteraction?: boolean;
  topic?: string;
  eventType?: string;
  soundProfile?: "critical" | "medium" | "warning" | "silent";
  channelId?: string;
};

const waselnyCriticalChannelId = "waselny_trip_critical_v2";
const waselnyUpdatesChannelId = "waselny_trip_updates_v2";
const waselnyWarningChannelId = "waselny_trip_warning_v2";

function inferEventType(payload: MobilePushPayload): string {
  if ((payload.eventType || "").trim()) return String(payload.eventType).trim();
  const topic = String(payload.topic || "").toLowerCase();
  if (topic.includes("trip-completed")) return "trip_ended";
  if (topic.includes("eta") || topic.includes("driver-accepted")) return "trip_accepted";
  if (topic.includes("cancel")) return "trip_cancelled";
  if (topic.includes("arrived")) return "driver_arrived";
  if (topic.includes("trip-started")) return "trip_started";
  if (topic.includes("marketplace-offer") || topic.includes("trip-request")) return "trip_requested";
  return "trip_update";
}

function inferSoundProfile(eventType: string, payload: MobilePushPayload) {
  if (payload.soundProfile) return payload.soundProfile;
  const event = eventType.toLowerCase();
  if (event === "trip_requested" || event === "driver_arrived") return "critical" as const;
  if (event === "driver_cancelled" || event === "user_cancelled" || event === "trip_cancelled") {
    return "warning" as const;
  }
  if (event === "trip_accepted" || event === "trip_started" || event === "trip_ended") {
    return "medium" as const;
  }
  return "medium" as const;
}

function resolveChannelId(soundProfile: MobilePushPayload["soundProfile"], payload: MobilePushPayload) {
  if ((payload.channelId || "").trim()) return String(payload.channelId).trim();
  switch (soundProfile) {
    case "critical":
      return waselnyCriticalChannelId;
    case "warning":
      return waselnyWarningChannelId;
    case "silent":
    case "medium":
    default:
      return waselnyUpdatesChannelId;
  }
}

type MobilePushTokenRecord = {
  id: string;
  token: string;
  platform: string;
  provider: string;
};

type MobilePushFunctionResult = {
  success?: boolean;
  sent?: number;
  invalidTokens?: string[];
};

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_KEY || "").trim();
const pushViaDbTriggerOnly =
  String(process.env.PUSH_VIA_DB_TRIGGER_ONLY || "").trim().toLowerCase() ===
  "true";
const mobilePushFunctionName = (
  process.env.MOBILE_PUSH_FUNCTION_NAME || "send-mobile-push"
).trim();
const mobilePushFunctionUrl = (
  process.env.MOBILE_PUSH_FUNCTION_URL ||
  (supabaseUrl && mobilePushFunctionName
    ? `${supabaseUrl}/functions/v1/${mobilePushFunctionName}`
    : "")
).trim();

function buildFunctionPayload(
  recipients: MobilePushTokenRecord[],
  payload: MobilePushPayload
) {
  const link = payload.link || "/notifications";
  const eventType = inferEventType(payload);
  const soundProfile = inferSoundProfile(eventType, payload);
  const channelId = resolveChannelId(soundProfile, payload);
  return {
    recipients: recipients.map((record) => ({
      token: record.token,
      platform: record.platform,
      provider: record.provider || "fcm",
    })),
    notification: {
      title: payload.title.startsWith("وصلني")
        ? payload.title
        : `وصلني | ${payload.title}`,
      body: payload.message,
      sound: "default",
    },
    data: {
      link,
      url: link,
      title: payload.title.startsWith("وصلني")
        ? payload.title
        : `وصلني | ${payload.title}`,
      body: payload.message,
      topic: payload.topic || "fi_elsekka_mobile",
      eventType,
      event_type: eventType,
      soundProfile: soundProfile,
      sound_profile: soundProfile,
      sound: soundProfile === "silent" ? "none" : "default",
      channelId,
      channel_id: channelId,
      android_channel_id: channelId,
      requireInteraction: String(payload.requireInteraction ?? true),
    },
  };
}

async function deliverToMobileTokens(
  supabaseAdmin: any,
  userId: string,
  payload: MobilePushPayload
) {
  if (pushViaDbTriggerOnly) {
    return { success: true, skipped: true, devicesNotified: 0 };
  }

  if (!supabaseAdmin || !userId) {
    return { success: false, skipped: true, devicesNotified: 0 };
  }

  const { data: tokens, error } = await supabaseAdmin
    .from("mobile_push_tokens")
    .select("id, token, platform, provider")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    console.error("Failed to fetch mobile push tokens:", error);
    return { success: false, skipped: false, devicesNotified: 0 };
  }

  const uniqueTokens = ((tokens || []) as MobilePushTokenRecord[]).filter(
    (record, index, all) =>
      record?.token &&
      all.findIndex((item) => item.token === record.token) === index
  );

  if (uniqueTokens.length === 0) {
    return { success: true, skipped: true, devicesNotified: 0 };
  }

  if (!mobilePushFunctionUrl || !supabaseServiceKey) {
    console.error(
      "Supabase mobile push function is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY, or override MOBILE_PUSH_FUNCTION_URL / MOBILE_PUSH_FUNCTION_NAME."
    );
    return { success: false, skipped: true, devicesNotified: 0 };
  }

  const response = await fetch(mobilePushFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify(buildFunctionPayload(uniqueTokens, payload)),
  });

  if (!response.ok) {
    const raw = await response.text();
    console.error("Supabase mobile push function failed:", raw);
    return { success: false, skipped: false, devicesNotified: 0 };
  }

  const result = (await response.json().catch(
    () => ({}) as MobilePushFunctionResult
  )) as MobilePushFunctionResult;

  const invalidTokens = Array.isArray(result.invalidTokens)
    ? result.invalidTokens.filter(Boolean)
    : [];

  if (invalidTokens.length > 0) {
    await supabaseAdmin
      .from("mobile_push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("token", invalidTokens);
  }

  return {
    success: Boolean(result.success ?? true),
    skipped: false,
    devicesNotified:
      typeof result.sent === "number" ? result.sent : uniqueTokens.length,
  };
}

export async function sendMobilePushToUserDevices(
  supabaseAdmin: any,
  userId: string,
  payload: MobilePushPayload
) {
  return deliverToMobileTokens(supabaseAdmin, userId, payload);
}

export async function sendMobilePushToDriverDevices(
  supabaseAdmin: any,
  driverId: string,
  payload: MobilePushPayload
) {
  return deliverToMobileTokens(supabaseAdmin, driverId, payload);
}
