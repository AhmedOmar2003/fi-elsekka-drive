import { calculateRideFare } from "@/lib/ride-pricing";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";
const REQUEST_HEADERS = {
  "User-Agent": "FiElSekka/1.0 (ride-booking-platform)",
  "Accept-Language": "ar,en",
};

export type GeocodedLocation = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string | null;
  area: string | null;
};

export type RideEstimateResult = {
  pickup: GeocodedLocation;
  destination: GeocodedLocation;
  distanceKm: number;
  durationMinutes: number;
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
};

function buildReadableAddress(payload: any) {
  const address = payload?.address || {};
  return [
    address.road,
    address.suburb,
    address.city || address.town || address.state_district,
    address.state,
  ]
    .filter(Boolean)
    .join("، ");
}

async function geocodePlace(query: string): Promise<GeocodedLocation> {
  const url = new URL(NOMINATIM_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "eg");

  const response = await fetch(url.toString(), {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("تعذر تحديد الموقع دلوقتي.");
  }

  const payload = await response.json();
  const match = Array.isArray(payload) ? payload[0] : null;

  if (!match?.lat || !match?.lon) {
    throw new Error("مش قادر أوصل للمكان اللي كتبته. جرّب تكتب العنوان بشكل أوضح.");
  }

  const city =
    match.address?.city ||
    match.address?.town ||
    match.address?.state_district ||
    match.address?.state ||
    null;
  const area =
    match.address?.suburb ||
    match.address?.neighbourhood ||
    match.address?.quarter ||
    null;

  return {
    label: match.name || match.display_name?.split(",")[0] || query,
    address: buildReadableAddress(match) || match.display_name || query,
    latitude: Number(match.lat),
    longitude: Number(match.lon),
    city,
    area,
  };
}

async function getRouteDistanceAndDuration(
  pickup: GeocodedLocation,
  destination: GeocodedLocation
) {
  const url = `${OSRM_BASE_URL}/${pickup.longitude},${pickup.latitude};${destination.longitude},${destination.latitude}?overview=false`;
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("تعذر حساب خط السير دلوقتي.");
  }

  const payload = await response.json();
  const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;

  if (!route?.distance || !route?.duration) {
    throw new Error("مش قادر أحسب المسافة والوقت حاليًا.");
  }

  return {
    distanceKm: Number(route.distance) / 1000,
    durationMinutes: Number(route.duration) / 60,
  };
}

export async function estimateRideFromText(input: {
  pickupQuery: string;
  destinationQuery: string;
  tripType: "airport_ride" | "normal_ride";
  preferredVehicleType?: "car" | "tuk_tuk" | "any";
  luggageCount?: number;
  passengerCount?: number;
}) {
  const pickup = await geocodePlace(input.pickupQuery);
  const destination = await geocodePlace(input.destinationQuery);
  const route = await getRouteDistanceAndDuration(pickup, destination);
  const fare = calculateRideFare({
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    tripType: input.tripType,
    preferredVehicleType: input.preferredVehicleType,
    luggageCount: input.luggageCount,
    passengerCount: input.passengerCount,
  });

  return {
    pickup,
    destination,
    distanceKm: Number(route.distanceKm.toFixed(1)),
    durationMinutes: Math.max(1, Math.round(route.durationMinutes)),
    ...fare,
  } satisfies RideEstimateResult;
}
