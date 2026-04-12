// @ts-nocheck
import { GoogleAuth } from "npm:google-auth-library@9.15.1";
import { createClient } from "npm:@supabase/supabase-js@2";

type FunctionRecipient = {
  token: string;
  platform?: string;
  provider?: string;
};

type IncomingPayload = {
  recipients?: FunctionRecipient[];
  token?: string;
  title?: string;
  body?: string;
  notification?: { title?: string; body?: string };
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
    details?: Array<{ "@type"?: string; errorCode?: string }>;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const DEFAULT_UPDATES_CHANNEL_ID = "waselny_trip_updates_v2";
const DEFAULT_CRITICAL_CHANNEL_ID = "waselny_trip_critical_v2";
const DEFAULT_WARNING_CHANNEL_ID = "waselny_trip_warning_v2";
const LEGACY_CHANNEL_ID = "fi_elsekka_rides";
const SEND_CONCURRENCY = 20;

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").trim();
const SUPABASE_SERVICE_ROLE_KEY =
  (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();

function loadServiceAccount(): FirebaseServiceAccount | null {
  const rawJson = (Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "").trim();
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson) as FirebaseServiceAccount;
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e);
    return null;
  }
}

async function getAccessToken(sa: FirebaseServiceAccount) {
  const auth = new GoogleAuth({
    credentials: {
      client_email: sa.client_email,
      private_key: sa.private_key,
    },
    projectId: sa.project_id,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });

  const token = await auth.getAccessToken();
  return typeof token === "string" ? token : token?.token || null;
}

function toStringMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)])
  );
}

function parseRecordPayload(
  raw: NotificationRecord["payload"]
): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function extractNotificationRecord(
  payload: IncomingPayload
): NotificationRecord | null {
  const rec = payload.record || payload.new;
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) return null;
  return rec as NotificationRecord;
}

function normalizeSoundProfile(data: Record<string, string>) {
  const raw = (
    data.soundProfile ||
    data.sound_profile ||
    data.sound ||
    ""
  )
    .toLowerCase()
    .trim();

  if (raw === "critical") return "critical";
  if (raw === "warning") return "warning";
  if (raw === "silent" || raw === "none" || raw === "off") return "silent";

  const event = (data.eventType || data.event_type || "").toLowerCase().trim();
  if (event === "driver_arrived" || event === "trip_requested") return "critical";
  if (
    event === "driver_cancelled" ||
    event === "user_cancelled" ||
    event === "trip_cancelled"
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
  ).trim();

  if (explicit) return explicit;
  if (profile === "critical") return DEFAULT_CRITICAL_CHANNEL_ID;
  if (profile === "warning") return DEFAULT_WARNING_CHANNEL_ID;
  if (profile === "silent") return DEFAULT_UPDATES_CHANNEL_ID || LEGACY_CHANNEL_ID;
  return DEFAULT_UPDATES_CHANNEL_ID || LEGACY_CHANNEL_ID;
}

function resolveSoundName(profile: string) {
  return profile === "silent" ? undefined : "default";
}

function isInvalidTokenError(body: FcmErrorBody) {
  const details = Array.isArray(body.error?.details) ? body.error!.details! : [];
  const codes = details
    .map((d) => String(d?.errorCode || "").toUpperCase().trim())
    .filter(Boolean);

  return codes.includes("UNREGISTERED") || codes.includes("INVALID_ARGUMENT");
}

function uniqueByToken(recipients: FunctionRecipient[]) {
  const seen = new Set<string>();
  const result: FunctionRecipient[] = [];
  for (const r of recipients) {
    const token = String(r?.token || "").trim();
    const provider = String(r?.provider || "fcm").toLowerCase().trim();
    if (!token || provider !== "fcm" || seen.has(token)) continue;
    seen.add(token);
    result.push({ ...r, token, provider: "fcm" });
  }
  return result;
}

function createSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchRecipientsFromUserId(userId: string) {
  const supabase = createSupabaseAdmin();
  if (!supabase) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets."
    );
  }

  const { data, error } = await supabase
    .from("mobile_push_tokens")
    .select("token, platform, provider")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to fetch mobile_push_tokens: ${error.message}`);
  }

  return uniqueByToken((data || []) as FunctionRecipient[]);
}

async function deactivateInvalidTokens(tokens: string[]) {
  if (!tokens.length) return;
  const supabase = createSupabaseAdmin();
  if (!supabase) return;

  await supabase
    .from("mobile_push_tokens")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("token", tokens);
}

async function sendOne(
  recipient: FunctionRecipient,
  accessToken: string,
  projectId: string,
  title: string,
  body: string,
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
          notification: { title, body },
          data,
          android: {
            priority: "high",
            notification: {
              channel_id: channelId,
              click_action: "FLUTTER_NOTIFICATION_CLICK",
              sound: soundName,
              tag: `${data.link || data.url || "/notifications"}::${title}`,
            },
          },
          apns: {
            headers: { "apns-priority": "10" },
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

  if (response.ok) return { success: true, invalid: false };

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
    // Authorization (Webhook secret OR service role headers)
    const pushAuthBypass =
      String(Deno.env.get("PUSH_AUTH_BYPASS") || "").trim().toLowerCase() === "true";
    const expectedWebhookSecret = (Deno.env.get("PUSH_WEBHOOK_SECRET") || "").trim();
    const expectedServiceRole = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();

    const authHeader = (request.headers.get("authorization") || "").trim();
    const apiKeyHeader = (request.headers.get("apikey") || "").trim();
    const webhookSecretHeader = (request.headers.get("x-webhook-secret") || "").trim();

    const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    const isAuthorized =
      pushAuthBypass ||
      (expectedWebhookSecret && webhookSecretHeader === expectedWebhookSecret) ||
      (expectedServiceRole &&
        (bearerToken === expectedServiceRole || apiKeyHeader === expectedServiceRole));

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sa = loadServiceAccount();
    if (!sa?.project_id || !sa.client_email || !sa.private_key) {
      return new Response(
        JSON.stringify({
          error:
            "Missing Firebase service account secrets. Set FIREBASE_SERVICE_ACCOUNT_JSON.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = (await request.json().catch(() => ({}))) as IncomingPayload;

    let recipients: FunctionRecipient[] = Array.isArray(payload.recipients)
      ? uniqueByToken(
        payload.recipients.filter((r) => String(r?.token || "").trim().length > 0)
      )
      : [];

    const directToken = String(payload.token || "").trim();
    if (!recipients.length && directToken) {
      recipients = [{ token: directToken, provider: "fcm" }];
    }

    let title = String(payload.notification?.title || payload.title || "وصلني").trim();
    let body = String(payload.notification?.body || payload.body || "").trim();
    let data = toStringMap(payload.data);

    // Webhook mode: INSERT on notifications
    if (!recipients.length) {
      const record = extractNotificationRecord(payload);
      if (record) {
        const recipientUserId = String(record.recipient_user_id || "").trim();
        if (recipientUserId) {
          recipients = await fetchRecipientsFromUserId(recipientUserId);
        }

        if (!title) title = String(record.title || "وصلني").trim();
        if (!body) body = String(record.body || "").trim();

        const merged = {
          ...parseRecordPayload(record.payload),
          ...data,
        };
        data = toStringMap(merged);
      }
    }

    if (!recipients.length) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          invalidTokens: [],
          reason: "no_recipients",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(sa);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Failed to obtain Firebase access token." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const soundProfile = normalizeSoundProfile(data);
    const channelId = resolveChannelId(data, soundProfile);
    const soundName = resolveSoundName(soundProfile);

    let sent = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
      const batch = recipients.slice(i, i + SEND_CONCURRENCY);

      const settled = await Promise.allSettled(
        batch.map((recipient) =>
          sendOne(
            recipient,
            accessToken,
            sa.project_id!,
            title,
            body,
            data,
            channelId,
            soundName
          ).then((result) => ({ recipient, result }))
        )
      );

      for (const item of settled) {
        if (item.status === "rejected") {
          console.error("FCM send exception:", item.reason);
          continue;
        }
        if (item.value.result.success) {
          sent += 1;
        } else if (item.value.result.invalid) {
          invalidTokens.push(item.value.recipient.token);
        }
      }
    }

    await deactivateInvalidTokens(invalidTokens);

    return new Response(
      JSON.stringify({
        success: sent > 0,
        sent,
        attempted: recipients.length,
        invalidTokens,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
