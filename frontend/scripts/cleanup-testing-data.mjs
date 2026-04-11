#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const TEST_KEYWORDS = [
  "test",
  "demo",
  "dummy",
  "sample",
  "sandbox",
  "qa",
  "staging",
  "اختبار",
  "تجريبي",
];

const TEST_EMAIL_FRAGMENTS = ["test", "demo", "dummy", "example", "qa", "sandbox"];
const PROTECTED_EMAILS = new Set(["admin@drive.com"]);

const args = new Set(process.argv.slice(2));
const EXECUTE = args.has("--execute");
const ALL_RUNTIME_TRIPS = args.has("--all-runtime-trips");
const KEEP_TEST_USERS = args.has("--keep-test-users");
const WITH_TEST_UPLOADS = args.has("--with-test-uploads");

function parseEnvFile(envPath) {
  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

const envPath = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local in current directory.");
  process.exit(1);
}

const env = parseEnvFile(envPath);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Supabase URL or service role key is missing in .env.local");
  process.exit(1);
}

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: fetchWithTimeout },
});

function chunk(list, size = 200) {
  const result = [];
  for (let i = 0; i < list.length; i += size) result.push(list.slice(i, i + size));
  return result;
}

function isTransientError(message = "") {
  const text = String(message).toLowerCase();
  return (
    text.includes("aborterror") ||
    text.includes("failed to fetch") ||
    text.includes("timed out") ||
    text.includes("timeout") ||
    text.includes("522") ||
    text.includes("connection") ||
    text.includes("schema cache") ||
    text.includes("retrying")
  );
}

async function withRetries(label, task, retries = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const result = await task();
      if (result?.error) {
        const message = result.error.message || `Unknown Supabase error in ${label}`;
        if (attempt < retries && isTransientError(message)) {
          await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
          continue;
        }
        throw new Error(`${label}: ${message}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < retries && isTransientError(error?.message || "")) {
        await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error(`${label}: failed after retries`);
}

function hasKeyword(value) {
  if (!value) return false;
  const text = String(value).toLowerCase();
  return TEST_KEYWORDS.some((keyword) => text.includes(keyword));
}

function isLikelyTestProfile(profile) {
  const role = String(profile.role || "").toLowerCase();
  const email = String(profile.email || "").toLowerCase().trim();
  if (PROTECTED_EMAILS.has(email)) return false;
  if (role === "admin" || role === "super_admin") return false;

  if (TEST_EMAIL_FRAGMENTS.some((fragment) => email.includes(fragment))) return true;
  if (hasKeyword(profile.full_name) || hasKeyword(profile.display_name)) return true;
  if (hasKeyword(profile.phone)) return true;

  const metadata = profile.metadata && typeof profile.metadata === "object" ? profile.metadata : {};
  const testFlags = ["is_test_user", "test_user", "seeded_test_data", "demo_account"];
  for (const key of testFlags) {
    if (metadata[key] === true || metadata[key] === "true") return true;
  }
  return false;
}

async function selectTripIdsForTestUsers(testUserIds) {
  if (testUserIds.length === 0) return [];
  const ids = new Set();
  for (const userIdBatch of chunk(testUserIds, 200)) {
    const { data } = await withRetries("load trips for test users", () =>
      supabase.from("trips").select("id").in("customer_id", userIdBatch)
    );
    for (const row of data || []) ids.add(row.id);
  }
  return Array.from(ids);
}

async function selectAllRuntimeTripIds() {
  const ids = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const to = from + pageSize - 1;
    const { data } = await withRetries("load all trip ids", () =>
      supabase.from("trips").select("id").order("id", { ascending: true }).range(from, to)
    );
    const rows = data || [];
    if (rows.length === 0) break;
    ids.push(...rows.map((item) => item.id).filter(Boolean));
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

async function collectIdsByFilter(table, idField, filterField, values) {
  if (values.length === 0) return [];
  const ids = new Set();
  for (const batch of chunk(values, 200)) {
    const { data } = await withRetries(`collect ids from ${table}`, () =>
      supabase.from(table).select(idField).in(filterField, batch)
    );
    for (const row of data || []) {
      if (row[idField]) ids.add(row[idField]);
    }
  }
  return Array.from(ids);
}

async function deleteByIds(table, idField, ids) {
  if (ids.length === 0) return 0;
  let deleted = 0;
  for (const batch of chunk(ids, 200)) {
    await withRetries(`delete from ${table}`, () => supabase.from(table).delete().in(idField, batch));
    deleted += batch.length;
  }
  return deleted;
}

async function deleteByInFilter(table, filterField, values) {
  if (values.length === 0) return 0;
  let deleted = 0;
  for (const batch of chunk(values, 200)) {
    await withRetries(`delete from ${table}`, () => supabase.from(table).delete().in(filterField, batch));
    deleted += batch.length;
  }
  return deleted;
}

async function main() {
  const summary = {
    mode: EXECUTE ? "execute" : "dry_run",
    allRuntimeTrips: ALL_RUNTIME_TRIPS,
    keepTestUsers: KEEP_TEST_USERS,
    withTestUploads: WITH_TEST_UPLOADS,
    willDelete: {},
    deleted: {},
    skipped: {},
  };

  let testUserIds = [];
  let testProfiles = [];
  const needsProfileScan = !(ALL_RUNTIME_TRIPS && KEEP_TEST_USERS && !WITH_TEST_UPLOADS);

  if (needsProfileScan) {
    const { data: profiles } = await withRetries("load profiles", () =>
      supabase
        .from("profiles")
        .select("id,role,email,full_name,display_name,phone,metadata")
        .in("role", ["customer", "driver", "admin"])
    );
    testProfiles = (profiles || []).filter(isLikelyTestProfile);
    testUserIds = testProfiles.map((item) => item.id);
  }

  const tripIds = ALL_RUNTIME_TRIPS
    ? await selectAllRuntimeTripIds()
    : await selectTripIdsForTestUsers(testUserIds);

  const ticketIds = await collectIdsByFilter("support_tickets", "id", "trip_id", tripIds);
  const tripNotificationIds = await collectIdsByFilter("notifications", "id", "related_trip_id", tripIds);
  const userNotificationIds = await collectIdsByFilter("notifications", "id", "recipient_user_id", testUserIds);

  const notificationIds = Array.from(new Set([...tripNotificationIds, ...userNotificationIds]));
  const storageRefs = [];

  if (WITH_TEST_UPLOADS && testUserIds.length > 0) {
    try {
      const { data: docs } = await withRetries("load driver_documents for storage cleanup", () =>
        supabase
          .from("driver_documents")
          .select("storage_bucket,storage_path")
          .in("driver_id", testUserIds)
          .not("storage_path", "is", null)
      );
      for (const item of docs || []) {
        if (item.storage_bucket && item.storage_path) {
          storageRefs.push({ bucket: item.storage_bucket, path: item.storage_path });
        }
      }
    } catch (error) {
      summary.skipped.driverDocumentsStorage = error?.message || String(error);
    }

    try {
      const { data: avatars } = await withRetries("load profile avatars for storage cleanup", () =>
        supabase
          .from("profiles")
          .select("avatar_bucket,avatar_path")
          .in("id", testUserIds)
          .not("avatar_path", "is", null)
      );
      for (const item of avatars || []) {
        if (item.avatar_path) {
          storageRefs.push({ bucket: item.avatar_bucket || "avatars", path: item.avatar_path });
        }
      }
    } catch (error) {
      summary.skipped.profileAvatarStorage = error?.message || String(error);
    }

    if (ticketIds.length > 0) {
      try {
        const { data: attachments } = await withRetries("load support attachments for storage cleanup", () =>
          supabase
            .from("support_ticket_messages")
            .select("attachment_bucket,attachment_path")
            .in("ticket_id", ticketIds)
            .not("attachment_bucket", "is", null)
            .not("attachment_path", "is", null)
        );
        for (const item of attachments || []) {
          if (item.attachment_bucket && item.attachment_path) {
            storageRefs.push({ bucket: item.attachment_bucket, path: item.attachment_path });
          }
        }
      } catch (error) {
        summary.skipped.supportAttachmentStorage = error?.message || String(error);
      }
    }
  }

  summary.willDelete = {
    testProfiles: testUserIds.length,
    trips: tripIds.length,
    tripOffersByTrip: tripIds.length ? "matched by trip_id" : 0,
    tripStatusHistoryByTrip: tripIds.length ? "matched by trip_id" : 0,
    tripReviewsByTrip: tripIds.length ? "matched by trip_id" : 0,
    supportTickets: ticketIds.length,
    notifications: notificationIds.length,
    mobilePushTokensByUser: testUserIds.length ? "matched by user_id" : 0,
    savedPlacesByUser: testUserIds.length ? "matched by user_id" : 0,
    communityPlacesByCreator: testUserIds.length ? "matched by created_by" : 0,
    storageFiles: storageRefs.length,
  };

  if (!EXECUTE) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  summary.deleted.trip_reviews = await deleteByInFilter("trip_reviews", "trip_id", tripIds);
  summary.deleted.trip_status_history = await deleteByInFilter("trip_status_history", "trip_id", tripIds);
  summary.deleted.trip_offers = await deleteByInFilter("trip_offers", "trip_id", tripIds);
  summary.deleted.notifications = await deleteByIds("notifications", "id", notificationIds);
  summary.deleted.support_ticket_messages = await deleteByInFilter("support_ticket_messages", "ticket_id", ticketIds);
  summary.deleted.support_tickets = await deleteByIds("support_tickets", "id", ticketIds);
  summary.deleted.mobile_push_tokens = await deleteByInFilter("mobile_push_tokens", "user_id", testUserIds);
  summary.deleted.saved_places = await deleteByInFilter("saved_places", "user_id", testUserIds);
  summary.deleted.community_places = await deleteByInFilter("community_places", "created_by", testUserIds);
  summary.deleted.trips = await deleteByIds("trips", "id", tripIds);

  if (WITH_TEST_UPLOADS && storageRefs.length > 0) {
    const grouped = new Map();
    for (const ref of storageRefs) {
      if (!grouped.has(ref.bucket)) grouped.set(ref.bucket, new Set());
      grouped.get(ref.bucket).add(ref.path);
    }

    let removedFiles = 0;
    const storageErrors = [];
    for (const [bucket, pathsSet] of grouped.entries()) {
      const paths = Array.from(pathsSet);
      for (const batch of chunk(paths, 100)) {
        try {
          const { error } = await withRetries(`remove files from bucket ${bucket}`, () =>
            supabase.storage.from(bucket).remove(batch)
          );
          if (error) {
            storageErrors.push({ bucket, error: error.message || "Unknown storage remove error" });
          } else {
            removedFiles += batch.length;
          }
        } catch (error) {
          storageErrors.push({ bucket, error: error?.message || String(error) });
        }
      }
    }

    summary.deleted.storage_files = removedFiles;
    if (storageErrors.length) summary.skipped.storageErrors = storageErrors;
  } else {
    summary.skipped.storage = "Storage cleanup is disabled (use --with-test-uploads).";
  }

  if (!KEEP_TEST_USERS && testUserIds.length > 0) {
    let deletedAuthUsers = 0;
    const userDeleteErrors = [];
    for (const userId of testUserIds) {
      try {
        const { error } = await withRetries("delete auth user", () => supabase.auth.admin.deleteUser(userId));
        if (!error) deletedAuthUsers += 1;
      } catch (error) {
        userDeleteErrors.push({ userId, error: error?.message || String(error) });
      }
    }
    summary.deleted.auth_users = deletedAuthUsers;
    if (userDeleteErrors.length) summary.skipped.authUsersDeleteErrors = userDeleteErrors;
  } else {
    summary.skipped.testUsers = "Profiles/Auth users were preserved by flag.";
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
