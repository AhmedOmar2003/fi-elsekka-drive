import "server-only";

import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import type { GeocodedLocation } from "@/lib/ride-maps-server";

const MAX_PROXIMITY_RADIUS_METERS = 500;
const SEARCH_BOUNDING_BOX_DEGREES = 0.008;
const MIN_PUBLIC_CONTRIBUTORS = 4;
const MIN_PUBLIC_USAGE_COUNT = 5;

type CommunityPlaceRow = {
  id: string;
  name: string;
  address_text: string;
  latitude: number;
  longitude: number;
  city: string | null;
  area: string | null;
  usage_count: number;
  source: string;
  search_key: string;
  phonetic_key: string;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type CommunityPlaceMetadata = Record<string, unknown>;

export type SharedGeocodedLocation = GeocodedLocation & {
  id?: string;
  source?: string;
  usageCount?: number;
  metadata?: CommunityPlaceMetadata;
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/kh/g, "5")
    .replace(/gh/g, "8")
    .replace(/\s+/g, " ")
    .trim();
}

function phoneticKey(value: string) {
  const normalized = normalizeText(value);
  const arabicMap: Record<string, string> = {
    ا: "a",
    ب: "b",
    ت: "t",
    ث: "s",
    ج: "g",
    ح: "h",
    خ: "5",
    د: "d",
    ذ: "z",
    ر: "r",
    ز: "z",
    س: "s",
    ش: "sh",
    ص: "s",
    ض: "d",
    ط: "t",
    ظ: "z",
    ع: "a",
    غ: "8",
    ف: "f",
    ق: "q",
    ك: "k",
    ل: "l",
    م: "m",
    ن: "n",
    ه: "h",
    و: "w",
    ي: "i",
  };

  let mapped = "";
  for (const char of normalized) {
    if (char === " ") continue;
    mapped += arabicMap[char] ?? char;
  }

  return mapped
    .replace(/[aeiouyw]/g, "")
    .replace(/(.)\1+/g, "$1");
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const costs = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = i - 1;
    costs[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = costs[j];
      const substitution = a[i - 1] === b[j - 1] ? previous : previous + 1;
      costs[j] = Math.min(costs[j] + 1, costs[j - 1] + 1, substitution);
      previous = current;
    }
  }

  return costs[b.length];
}

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 *
      Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2));
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function isMeaningfulName(value: string) {
  const normalized = normalizeText(value);
  if (normalized.length < 3) return false;
  const blocked = new Set([
    "here",
    "my home",
    "unknown",
    "unknwn",
    "home",
    "location",
    "place",
    "point",
    "مكاني",
    "هنا",
    "بيتي",
    "البيت",
    "منزلي",
    "غير معروف",
    "مجهول",
    "مكان",
    "نقطه",
    "نقطة",
    "موقع",
  ]);
  return !blocked.has(normalized);
}

function isGenericAdministrativeLabel(value: string) {
  const normalized = normalizeText(value);
  const administrativeLabels = new Set([
    "الدقهليه",
    "دقهليه",
    "dakahlia",
    "الدقهلية",
    "القاهره",
    "القاهرة",
    "cairo",
    "الجيزه",
    "الجيزة",
    "giza",
    "المنصوره",
    "المنصورة",
    "mansoura",
    "مصر",
    "egypt",
  ]);
  if (administrativeLabels.has(normalized)) {
    return true;
  }
  return normalized.startsWith("محافظه ") || normalized.startsWith("محافظة ");
}

function labelSpecificityScore(value: string) {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  const normalized = normalizeText(cleaned);
  if (!normalized) return -1000;
  if (!isMeaningfulName(cleaned)) return -500;

  let score = Math.min(cleaned.length, 50);
  const words = normalized.split(" ").filter(Boolean);
  if (words.length >= 2) score += 20;
  if (words.length >= 3) score += 10;
  if (/\d/.test(cleaned)) score += 8;
  if (/[-,،/]/.test(cleaned)) score += 6;

  const detailHints = [
    "قريه",
    "قرية",
    "شارع",
    "حاره",
    "حارة",
    "عزبه",
    "عزبة",
    "نجع",
    "كفر",
    "حي",
    "ميدان",
    "منطقه",
    "منطقة",
    "عماره",
    "عمارة",
    "مدخل",
    "زقاق",
    "villa",
    "village",
    "street",
    "district",
    "block",
  ];
  if (detailHints.some((hint) => normalized.includes(hint))) {
    score += 40;
  }

  if (isGenericAdministrativeLabel(normalized)) {
    score -= 120;
  }
  if (normalized.includes("مكان محفوظ")) {
    score -= 160;
  }
  return score;
}

function choosePreferredLabel(current: string, incoming: string) {
  const currentClean = String(current || "").trim().replace(/\s+/g, " ");
  const incomingClean = String(incoming || "").trim().replace(/\s+/g, " ");
  const currentScore = labelSpecificityScore(currentClean);
  const incomingScore = labelSpecificityScore(incomingClean);

  if (incomingScore > currentScore) {
    return incomingClean;
  }
  if (currentScore > incomingScore) {
    return currentClean;
  }
  if (!isMeaningfulName(currentClean) && isMeaningfulName(incomingClean)) {
    return incomingClean;
  }
  if (incomingClean.length > currentClean.length + 6 && isMeaningfulName(incomingClean)) {
    return incomingClean;
  }
  return currentClean || incomingClean;
}

function extractSpecificAddressPart(address: string) {
  const raw = String(address || "").trim();
  if (!raw) return "";
  const parts = raw
    .split(/[،,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const specific = parts.find(
    (part) => isMeaningfulName(part) && !isGenericAdministrativeLabel(part)
  );
  return specific || "";
}

function promoteSuggestionLabel(place: SharedGeocodedLocation): SharedGeocodedLocation {
  if (!isGenericAdministrativeLabel(place.label)) {
    return place;
  }

  const fromAddress = extractSpecificAddressPart(place.address || "");
  const fromArea =
    place.area && isMeaningfulName(place.area) && !isGenericAdministrativeLabel(place.area)
      ? place.area.trim()
      : "";
  const fromCity =
    place.city && isMeaningfulName(place.city) && !isGenericAdministrativeLabel(place.city)
      ? place.city.trim()
      : "";

  const candidate = fromAddress || fromArea || fromCity;
  if (!candidate) {
    return place;
  }
  return {
    ...place,
    label: choosePreferredLabel(place.label, candidate),
  };
}

function normalizeLocation(
  input: SharedGeocodedLocation,
  fallbackSource = "user_created"
): SharedGeocodedLocation | null {
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }

  const rawLabel = String(input.label || "").trim().replace(/\s+/g, " ");
  const city = String(input.city || "").trim() || null;
  const area = String(input.area || "").trim() || null;
  const fallbackLabel =
    area ? `مكان محفوظ - ${area}` : city ? `مكان محفوظ - ${city}` : "مكان محفوظ على الخريطة";
  const label = isMeaningfulName(rawLabel) ? rawLabel : fallbackLabel;
  if (!isMeaningfulName(label)) {
    return null;
  }

  const rawAddress = String(input.address || "").trim().replace(/\s+/g, " ");
  const address = rawAddress || label;

  return {
    id: input.id,
    label,
    address,
    latitude,
    longitude,
    city,
    area,
    source: String(input.source || fallbackSource).trim() || fallbackSource,
    usageCount: Math.max(1, Number(input.usageCount || 1)),
  };
}

function rowToLocation(row: CommunityPlaceRow): SharedGeocodedLocation {
  return {
    id: row.id,
    label: row.name,
    address: row.address_text,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    city: row.city,
    area: row.area,
    source: row.source === "user_created" ? "user_created" : "shared_community",
    usageCount: Math.max(1, Number(row.usage_count || 1)),
    metadata: extractMetadata(row),
  };
}

function extractMetadata(row: CommunityPlaceRow): CommunityPlaceMetadata {
  if (row.metadata && typeof row.metadata === "object") {
    return row.metadata as CommunityPlaceMetadata;
  }
  return {};
}

function contributorIdsFromMetadata(metadata: CommunityPlaceMetadata) {
  const raw = metadata.contributor_user_ids;
  if (!Array.isArray(raw)) {
    return [] as string[];
  }
  return Array.from(
    new Set(
      raw
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0)
    )
  );
}

function visibilityStats(row: CommunityPlaceRow) {
  const metadata = extractMetadata(row);
  const contributors = contributorIdsFromMetadata(metadata);
  const rawContributorCount = Number(
    metadata.unique_contributors || metadata.contributor_count || 0
  );
  const contributorCount = Math.max(
    contributors.length,
    rawContributorCount
  );
  const usageCount = Math.max(0, Number(row.usage_count || 0));
  const isPublicByMetadata = metadata.is_public === true;
  const hasContributorSignals = contributors.length > 0 || rawContributorCount > 0;
  const isPublic =
    isPublicByMetadata ||
    contributorCount >= MIN_PUBLIC_CONTRIBUTORS ||
    (!hasContributorSignals && usageCount >= MIN_PUBLIC_USAGE_COUNT);
  return {
    metadata,
    contributors,
    contributorCount,
    usageCount,
    isPublic,
    hasContributorSignals,
  };
}

function isSearchVisible(row: CommunityPlaceRow) {
  if (row.source !== "user_created") {
    return true;
  }
  return visibilityStats(row).isPublic;
}

function shouldMergePlace(
  existing: SharedGeocodedLocation,
  incoming: SharedGeocodedLocation
) {
  const distanceKm = haversineDistanceKm(
    existing.latitude,
    existing.longitude,
    incoming.latitude,
    incoming.longitude
  );
  if (distanceKm > MAX_PROXIMITY_RADIUS_METERS / 1000) {
    return false;
  }

  const existingName = normalizeText(existing.label);
  const incomingName = normalizeText(incoming.label);
  const existingPhonetic = phoneticKey(existing.label);
  const incomingPhonetic = phoneticKey(incoming.label);

  if (!existingName || !incomingName) {
    return distanceKm <= 0.25;
  }

  if (existingName === incomingName || existingPhonetic === incomingPhonetic) {
    return true;
  }

  if (
    existingName.includes(incomingName) ||
    incomingName.includes(existingName)
  ) {
    return true;
  }

  if (existing.source === "user_created" || incoming.source === "user_created") {
    return distanceKm <= 0.35;
  }

  return levenshtein(existingPhonetic, incomingPhonetic) <= 2;
}

function scoreSearchMatch(
  place: SharedGeocodedLocation,
  query: string,
  nearLatitude?: number,
  nearLongitude?: number
) {
  const normalizedQuery = normalizeText(query);
  const phoneticQuery = phoneticKey(query);
  const label = normalizeText(place.label);
  const address = normalizeText(place.address);
  const city = normalizeText(place.city || "");
  const area = normalizeText(place.area || "");
  const haystack = `${label} ${address} ${city} ${area}`.trim();
  const phoneticHaystack = phoneticKey(haystack);

  let score = 0;
  if (label === normalizedQuery) {
    score += 220;
  } else if (label.startsWith(normalizedQuery)) {
    score += 170;
  } else if (haystack.includes(normalizedQuery)) {
    score += 130;
  }

  if (phoneticQuery) {
    if (phoneticKey(label) === phoneticQuery) {
      score += 180;
    } else if (phoneticHaystack.includes(phoneticQuery)) {
      score += 120;
    } else if (levenshtein(phoneticKey(label), phoneticQuery) <= 2) {
      score += 90;
    }
  }

  score += Math.min((place.usageCount || 0) * 14, 140);
  if (place.source === "user_created") {
    score += 35;
  }

  const distanceKm =
    Number.isFinite(nearLatitude) && Number.isFinite(nearLongitude)
      ? haversineDistanceKm(
          nearLatitude!,
          nearLongitude!,
          place.latitude,
          place.longitude
        )
      : Number.POSITIVE_INFINITY;

  score -= Number.isFinite(distanceKm) ? Math.min(Math.round(distanceKm * 10), 140) : 0;
  return { score, distanceKm };
}

export async function searchCommunityPlaces(
  query: string,
  options: {
    limit?: number;
    nearLatitude?: number;
    nearLongitude?: number;
  } = {}
): Promise<SharedGeocodedLocation[]> {
  const supabase = createAdminPlatformClient();
  const normalizedQuery = normalizeText(query);
  const phoneticQuery = phoneticKey(query);
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 12);

  if (!supabase || (!normalizedQuery && !phoneticQuery)) {
    return [];
  }

  const tokens = Array.from(
    new Set(
      normalizedQuery
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    )
  );

  let request = supabase
    .from("community_places")
    .select(
      "id,name,address_text,latitude,longitude,city,area,usage_count,source,search_key,phonetic_key,created_by,metadata,created_at,updated_at"
    )
    .limit(80);

  const searchFilters = (
    tokens.length ? tokens : [normalizedQuery]
  ).flatMap((token) => {
    const filters = [`search_key.ilike.%${token}%`];
    const tokenPhonetic = phoneticKey(token);
    if (tokenPhonetic) {
      filters.push(`phonetic_key.ilike.%${tokenPhonetic}%`);
    }
    return filters;
  });

  if (searchFilters.length) {
    request = request.or(searchFilters.join(","));
  }

  const { data, error } = await request;
  if (error || !Array.isArray(data)) {
    return [];
  }

  const scored = data
    .map((row) => row as CommunityPlaceRow)
    .filter((row) => isSearchVisible(row))
    .map((row) => rowToLocation(row))
    .map((place) => promoteSuggestionLabel(place))
    .map((place) => ({
      place,
      ...scoreSearchMatch(place, query, options.nearLatitude, options.nearLongitude),
    }))
    .filter((item) => item.score > 0);

  scored.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    const usageDiff = (b.place.usageCount || 0) - (a.place.usageCount || 0);
    if (usageDiff !== 0) return usageDiff;
    return a.distanceKm - b.distanceKm;
  });

  return scored.slice(0, limit).map((item) => item.place);
}

export async function findNearestCommunityPlace(
  latitude: number,
  longitude: number,
  options: {
    radiusMeters?: number;
  } = {}
): Promise<SharedGeocodedLocation | null> {
  const supabase = createAdminPlatformClient();
  if (!supabase) return null;

  const radiusMeters = Math.min(
    Math.max(options.radiusMeters ?? MAX_PROXIMITY_RADIUS_METERS, 50),
    1500
  );

  const { data, error } = await supabase
    .from("community_places")
    .select(
      "id,name,address_text,latitude,longitude,city,area,usage_count,source,search_key,phonetic_key,created_by,metadata,created_at,updated_at"
    )
    .gte("latitude", latitude - SEARCH_BOUNDING_BOX_DEGREES)
    .lte("latitude", latitude + SEARCH_BOUNDING_BOX_DEGREES)
    .gte("longitude", longitude - SEARCH_BOUNDING_BOX_DEGREES)
    .lte("longitude", longitude + SEARCH_BOUNDING_BOX_DEGREES)
    .limit(60);

  if (error || !Array.isArray(data)) {
    return null;
  }

  let best: SharedGeocodedLocation | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const row of data as CommunityPlaceRow[]) {
    const location = rowToLocation(row);
    const distanceKm = haversineDistanceKm(
      latitude,
      longitude,
      location.latitude,
      location.longitude
    );
    if (distanceKm <= radiusMeters / 1000 && distanceKm < bestDistance) {
      best = location;
      bestDistance = distanceKm;
    }
  }

  return best;
}

export async function registerCommunityPlace(input: {
  place: SharedGeocodedLocation;
  createdBy: string | null;
}) {
  const supabase = createAdminPlatformClient();
  const normalized = normalizeLocation(input.place);
  if (!supabase || !normalized) {
    return null;
  }

  const nearby = await findNearestCommunityPlace(normalized.latitude, normalized.longitude, {
    radiusMeters: MAX_PROXIMITY_RADIUS_METERS,
  });

  if (nearby && shouldMergePlace(nearby, normalized) && nearby.id) {
    const currentMetadata = nearby.metadata || {};
    const currentContributors = contributorIdsFromMetadata(currentMetadata);
    const nextContributors = Array.from(
      new Set([
        ...currentContributors,
        ...(input.createdBy ? [input.createdBy] : []),
      ])
    );
    const nextUsageCount = Math.max(
      (nearby.usageCount || 1) + Math.max(1, normalized.usageCount || 1),
      1
    );
    const contributorCount = Math.max(
      nextContributors.length,
      Number(currentMetadata.unique_contributors || currentMetadata.contributor_count || 0)
    );
    const hasContributorSignals =
      nextContributors.length > 0 ||
      Number(currentMetadata.unique_contributors || currentMetadata.contributor_count || 0) > 0;
    const isPublic =
      contributorCount >= MIN_PUBLIC_CONTRIBUTORS ||
      (!hasContributorSignals && nextUsageCount >= MIN_PUBLIC_USAGE_COUNT);
    const mergedLabel = choosePreferredLabel(nearby.label, normalized.label);
    const mergedAddress =
      nearby.address.length >= normalized.address.length ? nearby.address : normalized.address;
    const mergedCity = nearby.city || normalized.city || null;
    const mergedArea = nearby.area || normalized.area || null;

    const { data, error } = await supabase
      .from("community_places")
      .update({
        name: mergedLabel,
        address_text: mergedAddress,
        city: mergedCity,
        area: mergedArea,
        usage_count: nextUsageCount,
        source:
          nearby.source === "user_created" || normalized.source === "user_created"
            ? "user_created"
            : nearby.source || normalized.source,
        search_key: normalizeText(`${mergedLabel} ${mergedAddress} ${mergedCity || ""} ${mergedArea || ""}`),
        phonetic_key: phoneticKey(`${mergedLabel} ${mergedAddress} ${mergedCity || ""} ${mergedArea || ""}`),
        updated_at: new Date().toISOString(),
        metadata: {
          ...currentMetadata,
          merged_with_user: input.createdBy,
          last_source: normalized.source,
          contributor_user_ids: nextContributors,
          contributor_count: contributorCount,
          unique_contributors: contributorCount,
          is_public: isPublic,
        },
      })
      .eq("id", nearby.id)
      .select(
        "id,name,address_text,latitude,longitude,city,area,usage_count,source,search_key,phonetic_key,created_by,metadata,created_at,updated_at"
      )
      .maybeSingle();

    if (error || !data) {
      return nearby;
    }

    return rowToLocation(data as CommunityPlaceRow);
  }

  const searchKey = normalizeText(
    `${normalized.label} ${normalized.address} ${normalized.city || ""} ${normalized.area || ""}`
  );
  const phonetic = phoneticKey(
    `${normalized.label} ${normalized.address} ${normalized.city || ""} ${normalized.area || ""}`
  );
  const initialContributors = input.createdBy ? [input.createdBy] : [];
  const initialContributorCount = initialContributors.length;
  const initialUsageCount = Math.max(1, normalized.usageCount || 1);
  const initialPublic =
    initialContributorCount >= MIN_PUBLIC_CONTRIBUTORS;

  const { data, error } = await supabase
    .from("community_places")
    .insert({
      name: normalized.label,
      address_text: normalized.address,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      city: normalized.city,
      area: normalized.area,
      usage_count: initialUsageCount,
      source: normalized.source || "user_created",
      search_key: searchKey,
      phonetic_key: phonetic,
      created_by: input.createdBy,
      metadata: {
        created_from: "mobile_app",
        contributor_user_ids: initialContributors,
        contributor_count: initialContributorCount,
        unique_contributors: initialContributorCount,
        is_public: initialPublic,
      },
    })
    .select(
      "id,name,address_text,latitude,longitude,city,area,usage_count,source,search_key,phonetic_key,created_by,metadata,created_at,updated_at"
    )
    .maybeSingle();

  if (error || !data) {
    return normalized;
  }

  return rowToLocation(data as CommunityPlaceRow);
}
