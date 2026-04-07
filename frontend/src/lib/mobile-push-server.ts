type MobilePushPayload = {
  title: string;
  message: string;
  link?: string;
  requireInteraction?: boolean;
  topic?: string;
};

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
const mobilePushFunctionUrl = (
  process.env.MOBILE_PUSH_FUNCTION_URL ||
  (supabaseUrl ? `${supabaseUrl}/functions/v1/send-mobile-push` : "")
).trim();

function buildFunctionPayload(
  recipients: MobilePushTokenRecord[],
  payload: MobilePushPayload
) {
  const link = payload.link || "/notifications";
  return {
    recipients: recipients.map((record) => ({
      token: record.token,
      platform: record.platform,
      provider: record.provider || "fcm",
    })),
    notification: {
      title: payload.title.startsWith("في السكة")
        ? payload.title
        : `في السكة | ${payload.title}`,
      body: payload.message,
    },
    data: {
      link,
      url: link,
      title: payload.title.startsWith("في السكة")
        ? payload.title
        : `في السكة | ${payload.title}`,
      body: payload.message,
      topic: payload.topic || "fi_elsekka_mobile",
      requireInteraction: String(payload.requireInteraction ?? true),
    },
  };
}

async function deliverToMobileTokens(
  supabaseAdmin: any,
  userId: string,
  payload: MobilePushPayload
) {
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
      "Supabase mobile push function is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY, or override MOBILE_PUSH_FUNCTION_URL."
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
