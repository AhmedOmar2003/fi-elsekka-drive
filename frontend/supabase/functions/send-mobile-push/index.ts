// @ts-nocheck
import { GoogleAuth } from "npm:google-auth-library@9.15.1";

type FunctionRecipient = {
  token: string;
  platform?: string;
  provider?: string;
};

type FunctionPayload = {
  recipients?: FunctionRecipient[];
  notification?: {
    title?: string;
    body?: string;
  };
  data?: Record<string, string | number | boolean | null | undefined>;
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

function loadServiceAccount(): FirebaseServiceAccount | null {
  const rawJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")?.trim() || "";
  if (rawJson) {
    try {
      return JSON.parse(rawJson) as FirebaseServiceAccount;
    } catch (error) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON", error);
      return null;
    }
  }

  const projectId = Deno.env.get("FIREBASE_PROJECT_ID")?.trim() || "";
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL")?.trim() || "";
  const privateKey = (Deno.env.get("FIREBASE_PRIVATE_KEY") || "")
    .trim()
    .replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
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

function normalizeData(
  rawData: FunctionPayload["data"] | undefined
): Record<string, string> {
  if (!rawData) return {};
  return Object.fromEntries(
    Object.entries(rawData)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

function isInvalidTokenError(body: FcmErrorBody) {
  const details = Array.isArray(body.error?.details) ? body.error!.details! : [];
  const codes = details
    .map((entry) => String(entry?.errorCode || "").trim().toUpperCase())
    .filter(Boolean);
  return codes.includes("UNREGISTERED") || codes.includes("INVALID_ARGUMENT");
}

async function sendToRecipient(
  recipient: FunctionRecipient,
  accessToken: string,
  projectId: string,
  notificationTitle: string,
  notificationBody: string,
  data: Record<string, string>
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
              channel_id: "fi_elsekka_rides",
              click_action: "FLUTTER_NOTIFICATION_CLICK",
              sound: "default",
              tag: `${data.link || data.url || "/notifications"}::${notificationTitle}`,
            },
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
            payload: {
              aps: {
                sound: "default",
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

  try {
    const serviceAccount = loadServiceAccount();
    if (
      !serviceAccount?.project_id ||
      !serviceAccount.client_email ||
      !serviceAccount.private_key
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Missing Firebase service account secrets. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = (await request.json()) as FunctionPayload;
    const recipients = Array.isArray(payload.recipients)
      ? payload.recipients.filter(
          (entry) =>
            String(entry?.token || "").trim().length > 0 &&
            String(entry?.provider || "fcm").trim().toLowerCase() === "fcm"
        )
      : [];

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, invalidTokens: [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const title = String(payload.notification?.title || "في السكة").trim();
    const body = String(payload.notification?.body || "").trim();
    const data = normalizeData(payload.data);
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

    for (const recipient of recipients) {
      const result = await sendToRecipient(
        recipient,
        accessToken,
        serviceAccount.project_id,
        title,
        body,
        data
      );
      if (result.success) {
        sent += 1;
      } else if (result.invalid) {
        invalidTokens.push(recipient.token);
      }
    }

    return new Response(
      JSON.stringify({
        success: sent > 0,
        sent,
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

