// @ts-nocheck
import { GoogleAuth } from "npm:google-auth-library@9.15.1";
import { createClient } from "npm:@supabase/supabase-js@2";

type FunctionRecipient = {
  token: string;
  platform?: string;
  provider?: string;
};

type FunctionPayload = {
  recipients?: FunctionRecipient[];
  token?: string;
  title?: string;
  body?: string;
  notification?: {
    title?: string;
    body?: string;
  };
  data?: Record<string, unknown>;
  record?: Record<string, unknown>;
  new?: Record<string, unknown>;
};

type NotificationRecord = {
  recipient_user_id?: string;
  title?: string;
  body?: string;
  payload?: Record<string, unknown> | string | null;
};

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

type FcmErrorBody = {
  error?: {
    code?: number;
    message?: string;
    details?: Array<{
      "@type"?: string;
      errorCode?: string;
    }>;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LEGACY_CHANNEL_ID = "fi_elsekka_rides";
const DEFAULT_UPDATES_CHANNEL_ID = "waselny_trip_updates_v2";
const DEFAULT_CRITICAL_CHANNEL_ID = "waselny_trip_critical_v2";
const DEFAULT_WARNING_CHANNEL_ID = "waselny_trip_warning_v2";
const SEND_CONCURRENCY = 20;

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
).trim();

function loadServiceAccount(): FirebaseServiceAccount | null {
  const rawJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")?.trim() || "";
  if (!rawJson) return null;

  try {
    const parsed = JSON.parse(rawJson) as FirebaseServiceAccount;
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (error) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON", error);
    return null;
  }
}

async function getAccessToken(serviceAccount: FirebaseServiceAccount) {
  const auth = new GoogleAuth({
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
    projectId: serviceAccount.project_id,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });

  const token = await auth.getAccessToken();
  return typeof token === "string" ? token : token?.token || null;
}

function normalizeUnknownData(rawData: unknown): Record<string, string> {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) return {};
  return Object.fromEntries(
    Object.entries(rawData as Record<string, unknown>)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

function parseNotificationRecordPayload(
  rawPayload: NotificationRecord["payload"]
): Record<string, unknown> {
  if (!rawPayload) return {};
  if (typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
    return rawPayload as Record<string, unknown>;
  }
  if (typeof rawPayload === "string") {
    try {
      const parsed = JSON.parse(rawPayload);
      return typeof parsed === "object" && parsed && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function extractNotificationRecord(payload: FunctionPayload): NotificationRecord | null {
  const record = payload.record || payload.new;
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  return record as NotificationRecord;
}

function createSupabaseAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function dedupeRecipients(recipients: FunctionRecipient[]) {
  const seen = new Set<string>();
  const out: FunctionRecipient[] = [];
  for (const recipient of recipients) {
    const token = String(recipient?.token || "").trim();
    const provider = String(recipient?.provider || "fcm").trim().toLowerCase();
    if (!token || provider !== "fcm" || seen.has(token)) continue;
    seen.add(token);
    out.push({ ...recipient, token, provider: "fcm" });
  }
  return out;
}

async function fetchRecipientsFromNotificationRecord(record: NotificationRecord) {
  const recipientUserId = String(record.recipient_user_id || "").trim();
  if (!recipientUserId) return [] as FunctionRecipient[];

  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets."
    );
  }

  const { data: tokens, error } = await supabaseAdmin
    .from("mobile_push_tokens")
    .select("token, platform, provider")
    .eq("user_id", recipientUserId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to fetch mobile push tokens: ${error.message}`);
  }

  return dedupeRecipients((tokens || []) as FunctionRecipient[]);
}

function normalizeSoundProfile(data: Record<string, string>) {
  const raw = (
    data.soundProfile ||
    data.sound_profile ||
    data.sound ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  if (raw === "critical") return "critical";
  if (raw === "warning") return "warning";
  if (raw === "silent" || raw === "none" || raw === "off") return "silent";

  const eventType = (data.eventType || data.event_type || "").toLowerCase().trim();
  if (eventType === "driver_arrived" || eventType === "trip_requested") return "critical";
  if (
    eventType === "driver_cancelled" ||
    eventType === "user_cancelled" ||
    eventType === "trip_cancelled"
  )
    return "warning";

  return "medium";
}

function resolveChannelId(data: Record<string, string>, profile: string) {
  const explicit = (
    data.channelId ||
    data.channel_id ||
    data.android_channel_id ||
    ""
  )
    .toString()
    .trim();

  if (explicit) return explicit;

  switch (profile) {
    case "critical":
      return DEFAULT_CRITICAL_CHANNEL_ID;
    case "warning":
      return DEFAULT_WARNING_CHANNEL_ID;
    case "silent":
    case "medium":
    default:
      return DEFAULT_UPDATES_CHANNEL_ID || LEGACY_CHANNEL_ID;
  }
}

function resolveSoundName(profile: string) {
  return profile === "silent" ? undefined : "default";
}

function isInvalidTokenError(body: FcmErrorBody) {
  const details = Array.isArray(body.error?.details) ? body.error!.details! : [];
  const codes = details
    .map((entry) => String(entry?.errorCode || "").trim().toUpperCase())
    .filter(Boolean);
  return codes.includes("UNREGISTERED") || codes.includes("INVALID_ARGUMENT");
}

async function markInvalidTokensAsInactive(tokens: string[]) {
  if (!tokens.length) return;
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) return;

  await supabaseAdmin
    .from("mobile_push_tokens")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("token", tokens);
}

async function sendToRecipient(
  recipient: FunctionRecipient,
  accessToken: string,
  projectId: string,
  notificationTitle: string,
  notificationBody: string,
  data: Record<string, string>,
  channelId: string,
  soundName: string | undefined
) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: recipient.token,
          notification: {
            title: notificationTitle,
            body: notificationBody,
          },
          data,
          android: {
            priority: "high",
            notification: {
              channel_id: channelId || LEGACY_CHANNEL_ID,
              click_action: "FLUTTER_NOTIFICATION_CLICK",
              sound: soundName,
              tag: `${data.link || data.url || "/notifications"}::${notificationTitle}`,
            },
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
            payload: {
              aps: {
                sound: soundName,
                badge: 1,
                category: "FI_ELSEKKA_RIDE_UPDATE",
              },
            },
          },
        },
      }),
    }
  );

  if (response.ok) {
    return { success: true, invalid: false };
  }

  const errorBody = (await response.json().catch(() => ({}))) as FcmErrorBody;
  console.error("FCM HTTP v1 send failed:", errorBody);
  return {
    success: false,
    invalid: isInvalidTokenError(errorBody),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const expectedKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    const authHeader = (request.headers.get("authorization") || "").trim();
    const apiKeyHeader = (request.headers.get("apikey") || "").trim();
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    const isAuthorized =
      !expectedKey || bearerToken === expectedKey || apiKeyHeader === expectedKey;

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceAccount = loadServiceAccount();
    if (
      !serviceAccount?.project_id ||
      !serviceAccount.client_email ||
      !serviceAccount.private_key
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing Firebase service account secret FIREBASE_SERVICE_ACCOUNT_JSON.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = (await request.json().catch(() => ({}))) as FunctionPayload;

    // mode A: direct recipients
    let recipients = Array.isArray(payload.recipients)
      ? dedupeRecipients(payload.recipients)
      : [];

    // mode B: single token
    if (recipients.length === 0) {
      const singleToken = String(payload.token || "").trim();
      if (singleToken) recipients = [{ token: singleToken, provider: "fcm" }];
    }

    let title = String(payload.notification?.title || payload.title || "وصلني").trim();
    let body = String(payload.notification?.body || payload.body || "").trim();
    let data = normalizeUnknownData(payload.data);

    // mode C: webhook record from notifications insert
    if (recipients.length === 0) {
      const record = extractNotificationRecord(payload);
      if (record) {
        recipients = await fetchRecipientsFromNotificationRecord(record);
        if (!title) title = String(record.title || "وصلني").trim();
        if (!body) body = String(record.body || "").trim();
        const mergedData = {
          ...parseNotificationRecordPayload(record.payload),
          ...data,
        };
        data = normalizeUnknownData(mergedData);
      }
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, invalidTokens: [], reason: "no_recipients" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const soundProfile = normalizeSoundProfile(data);
    const channelId = resolveChannelId(data, soundProfile);
    const soundName = resolveSoundName(soundProfile);
    const accessToken = await getAccessToken(serviceAccount);

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Failed to obtain a Firebase access token." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let sent = 0;
    const invalidTokens: string[] = [];
    const batches: FunctionRecipient[][] = [];

    for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
      batches.push(recipients.slice(i, i + SEND_CONCURRENCY));
    }

    for (const batch of batches) {
      const settled = await Promise.allSettled(
        batch.map((recipient) =>
          sendToRecipient(
            recipient,
            accessToken,
            serviceAccount.project_id!,
            title,
            body,
            data,
            channelId,
            soundName
          ).then((result) => ({ recipient, result }))
        )
      );

      for (const entry of settled) {
        if (entry.status === "rejected") {
          console.error("FCM send failed by exception:", entry.reason);
          continue;
        }

        if (entry.value.result.success) {
          sent += 1;
        } else if (entry.value.result.invalid) {
          invalidTokens.push(entry.value.recipient.token);
        }
      }
    }

    await markInvalidTokensAsInactive(invalidTokens);

    return new Response(
      JSON.stringify({
        success: sent > 0,
        sent,
        attempted: recipients.length,
        invalidTokens,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-mobile-push edge function failed:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected failure.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
