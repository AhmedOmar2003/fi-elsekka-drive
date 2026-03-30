import { calculateRideFare } from "@/lib/ride-pricing";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_BASE_URL = "https://nominatim.openstreetmap.org/reverse";
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";
const GOOGLE_PLACES_AUTOCOMPLETE_BASE_URL =
  "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const GOOGLE_PLACES_TEXT_SEARCH_BASE_URL =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_GEOCODE_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_DIRECTIONS_BASE_URL = "https://maps.googleapis.com/maps/api/directions/json";
const REQUEST_HEADERS = {
  "User-Agent": "FiElSekka/1.0 (ride-booking-platform)",
  "Accept-Language": "ar,en",
};

const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

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

function parseGoogleAddressComponents(components: any[] | undefined) {
  const list = Array.isArray(components) ? components : [];
  const getLongName = (...types: string[]) => {
    const match = list.find((component) =>
      Array.isArray(component.types) &&
      types.some((type) => component.types.includes(type))
    );
    return match?.long_name || null;
  };

  return {
    city:
      getLongName("locality", "administrative_area_level_2", "administrative_area_level_1") ||
      null,
    area:
      getLongName("sublocality", "sublocality_level_1", "neighborhood", "route") || null,
  };
}

function normalizeGoogleGeocodeResult(result: any, fallbackQuery: string): GeocodedLocation {
  const location = result?.geometry?.location;
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    throw new Error("تعذر قراءة المكان من جوجل.");
  }

  const { city, area } = parseGoogleAddressComponents(result.address_components);
  const primaryLabel =
    result.address_components?.[0]?.long_name ||
    result.formatted_address?.split(",")[0] ||
    fallbackQuery;

  return {
    label: primaryLabel,
    address: result.formatted_address || fallbackQuery,
    latitude: Number(location.lat),
    longitude: Number(location.lng),
    city,
    area,
  };
}

async function searchLocationsWithGoogle(
  query: string,
  limit = 5,
  sessionToken?: string
): Promise<GeocodedLocation[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is missing.");
  }

  const url = new URL(GOOGLE_PLACES_AUTOCOMPLETE_BASE_URL);
  url.searchParams.set("input", query);
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);
  url.searchParams.set("language", "ar");
  url.searchParams.set("region", "eg");
  url.searchParams.set("components", "country:EG");
  url.searchParams.set("types", "geocode");
  if (sessionToken) {
    url.searchParams.set("sessiontoken", sessionToken);
  }

  const response = await fetch(url.toString(), {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("تعذر البحث عن المكان من خرائط جوجل.");
  }

  const payload = await response.json();
  if (!["OK", "ZERO_RESULTS"].includes(payload.status) || !Array.isArray(payload.predictions)) {
    const apiMessage =
      typeof payload?.error_message === "string" && payload.error_message.trim()
        ? payload.error_message.trim()
        : null;
    throw new Error(apiMessage || "تعذر البحث عن المكان من خرائط جوجل.");
  }

  if (!payload.predictions.length) {
    return await searchLocationsWithGoogleGeocode(query, limit);
  }

  const predictions = payload.predictions.slice(0, Math.min(Math.max(limit, 1), 8));
  const details = await Promise.all(
    predictions.map(async (prediction: any) => {
      const placeId = prediction?.place_id;
      if (!placeId) {
        return null;
      }

      const geocodeUrl = new URL(GOOGLE_GEOCODE_BASE_URL);
      geocodeUrl.searchParams.set("place_id", placeId);
      geocodeUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY);
      geocodeUrl.searchParams.set("language", "ar");
      geocodeUrl.searchParams.set("region", "eg");

      const geocodeResponse = await fetch(geocodeUrl.toString(), {
        headers: REQUEST_HEADERS,
        cache: "no-store",
      });

      if (!geocodeResponse.ok) {
        return null;
      }

      const geocodePayload = await geocodeResponse.json();
      const result = geocodePayload.results?.[0];
      if (geocodePayload.status !== "OK" || !result) {
        return null;
      }

      return normalizeGoogleGeocodeResult(
        result,
        prediction.description || query
      );
    })
  );

  const normalized = details.filter(Boolean) as GeocodedLocation[];
  if (!normalized.length) {
    return await searchLocationsWithGoogleGeocode(query, limit);
  }

  return normalized;
}

async function searchLocationsWithGoogleGeocode(
  query: string,
  limit = 5
): Promise<GeocodedLocation[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is missing.");
  }

  const url = new URL(GOOGLE_GEOCODE_BASE_URL);
  url.searchParams.set("address", query);
  url.searchParams.set("components", "country:EG");
  url.searchParams.set("language", "ar");
  url.searchParams.set("region", "eg");
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

  const response = await fetch(url.toString(), {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("تعذر البحث عن المكان من خرائط جوجل.");
  }

  const payload = await response.json();
  if (!["OK", "ZERO_RESULTS"].includes(payload.status) || !Array.isArray(payload.results)) {
    const apiMessage =
      typeof payload?.error_message === "string" && payload.error_message.trim()
        ? payload.error_message.trim()
        : null;
    throw new Error(apiMessage || "تعذر البحث عن المكان من خرائط جوجل.");
  }

  const results = payload.results
    .slice(0, Math.min(Math.max(limit, 1), 8))
    .map((result: any) => normalizeGoogleGeocodeResult(result, query));

  if (!results.length) {
    throw new Error("مش قادر أوصل للمكان اللي كتبته. جرّب اسم منطقة أو شارع أوضح.");
  }

  return results;
}

async function searchLocationsWithGoogleTextSearch(
  query: string,
  limit = 5
): Promise<GeocodedLocation[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is missing.");
  }

  const url = new URL(GOOGLE_PLACES_TEXT_SEARCH_BASE_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("language", "ar");
  url.searchParams.set("region", "eg");
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

  const response = await fetch(url.toString(), {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("تعذر البحث عن المكان من خرائط جوجل.");
  }

  const payload = await response.json();
  if (!["OK", "ZERO_RESULTS"].includes(payload.status) || !Array.isArray(payload.results)) {
    const apiMessage =
      typeof payload?.error_message === "string" && payload.error_message.trim()
        ? payload.error_message.trim()
        : null;
    throw new Error(apiMessage || "تعذر البحث عن المكان من خرائط جوجل.");
  }

  const results = payload.results
    .slice(0, Math.min(Math.max(limit, 1), 8))
    .filter(
      (result: any) =>
        Number.isFinite(result?.geometry?.location?.lat) &&
        Number.isFinite(result?.geometry?.location?.lng)
    )
    .map((result: any) => {
      const { city, area } = parseGoogleAddressComponents(result.address_components);
      return {
        label: result.name || result.formatted_address?.split(",")[0] || query,
        address: result.formatted_address || result.name || query,
        latitude: Number(result.geometry.location.lat),
        longitude: Number(result.geometry.location.lng),
        city,
        area,
      } satisfies GeocodedLocation;
    });

  if (!results.length) {
    throw new Error("مش قادر أوصل للمكان اللي كتبته. جرّب اسم القرية مع المركز أو المحافظة.");
  }

  return results;
}

async function reverseGeocodeWithGoogle(
  latitude: number,
  longitude: number
): Promise<GeocodedLocation> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is missing.");
  }

  const url = new URL(GOOGLE_GEOCODE_BASE_URL);
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);
  url.searchParams.set("language", "ar");
  url.searchParams.set("region", "eg");

  const response = await fetch(url.toString(), {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("تعذر تحديد المكان من خرائط جوجل.");
  }

  const payload = await response.json();
  if (payload.status !== "OK" || !Array.isArray(payload.results) || !payload.results.length) {
    throw new Error("مش قادر أحدد المكان المختار من الخريطة.");
  }

  return normalizeGoogleGeocodeResult(payload.results[0], "موقعي الحالي");
}

async function getRouteDistanceAndDurationWithGoogle(
  pickup: GeocodedLocation,
  destination: GeocodedLocation
) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is missing.");
  }

  const url = new URL(GOOGLE_DIRECTIONS_BASE_URL);
  url.searchParams.set("origin", `${pickup.latitude},${pickup.longitude}`);
  url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("departure_time", "now");
  url.searchParams.set("language", "ar");
  url.searchParams.set("region", "eg");
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

  const response = await fetch(url.toString(), {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("تعذر حساب الطريق من خرائط جوجل.");
  }

  const payload = await response.json();
  const leg = payload.routes?.[0]?.legs?.[0];

  if (payload.status !== "OK" || !leg?.distance?.value || !leg?.duration?.value) {
    throw new Error("مش قادر أحسب المدة والمسافة من خرائط جوجل.");
  }

  return {
    distanceKm: Number(leg.distance.value) / 1000,
    durationMinutes: Number(leg.duration.value) / 60,
  };
}

async function searchLocationsWithOsm(
  query: string,
  limit = 5
): Promise<GeocodedLocation[]> {
  const url = new URL(NOMINATIM_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 8)));
  url.searchParams.set("countrycodes", "eg");

  const response = await fetch(url.toString(), {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("تعذر تحديد الموقع دلوقتي.");
  }

  const payload = await response.json();
  const matches = Array.isArray(payload) ? payload : [];

  if (matches.length === 0) {
    throw new Error("مش قادر أوصل للمكان اللي كتبته. جرّب تكتب العنوان بشكل أوضح.");
  }

  return matches
    .filter((match) => match?.lat && match?.lon)
    .map((match) => {
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
      } satisfies GeocodedLocation;
    });
}

async function reverseGeocodeWithOsm(
  latitude: number,
  longitude: number
): Promise<GeocodedLocation> {
  const url = new URL(NOMINATIM_REVERSE_BASE_URL);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  const response = await fetch(url.toString(), {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("تعذر تحديد المكان من الخريطة دلوقتي.");
  }

  const match = await response.json();
  if (!match?.lat || !match?.lon) {
    throw new Error("مش قادر أحدد المكان المختار من الخريطة.");
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
    label: match.name || match.display_name?.split(",")[0] || "نقطة من الخريطة",
    address: buildReadableAddress(match) || match.display_name || "نقطة من الخريطة",
    latitude: Number(match.lat),
    longitude: Number(match.lon),
    city,
    area,
  };
}

async function getRouteDistanceAndDurationWithOsm(
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

export async function searchLocations(
  query: string,
  limit = 5,
  sessionToken?: string
): Promise<GeocodedLocation[]> {
  if (GOOGLE_MAPS_API_KEY) {
    try {
      return await searchLocationsWithGoogle(query, limit, sessionToken);
    } catch {
      try {
        return await searchLocationsWithGoogleGeocode(query, limit);
      } catch {
        try {
          return await searchLocationsWithGoogleTextSearch(query, limit);
        } catch {
          return await searchLocationsWithOsm(query, limit);
        }
      }
    }
  }

  return await searchLocationsWithOsm(query, limit);
}

async function geocodePlace(query: string): Promise<GeocodedLocation> {
  const matches = await searchLocations(query, 1);
  const firstMatch = matches[0];

  if (!firstMatch) {
    throw new Error("مش قادر أوصل للمكان اللي كتبته. جرّب تكتب العنوان بشكل أوضح.");
  }

  return firstMatch;
}

async function getRouteDistanceAndDuration(
  pickup: GeocodedLocation,
  destination: GeocodedLocation
) {
  if (GOOGLE_MAPS_API_KEY) {
    try {
      return await getRouteDistanceAndDurationWithGoogle(pickup, destination);
    } catch {
      return await getRouteDistanceAndDurationWithOsm(pickup, destination);
    }
  }

  return await getRouteDistanceAndDurationWithOsm(pickup, destination);
}

export async function estimateRideFromText(input: {
  pickupQuery: string;
  destinationQuery: string;
  pickupLocation?: GeocodedLocation | null;
  destinationLocation?: GeocodedLocation | null;
  tripType: "airport_ride" | "normal_ride";
  preferredVehicleType?: "car" | "tuk_tuk" | "any";
  luggageCount?: number;
  passengerCount?: number;
}) {
  const pickup = input.pickupLocation ?? (await geocodePlace(input.pickupQuery));
  const destination =
    input.destinationLocation ?? (await geocodePlace(input.destinationQuery));
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

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<GeocodedLocation> {
  if (GOOGLE_MAPS_API_KEY) {
    try {
      return await reverseGeocodeWithGoogle(latitude, longitude);
    } catch {
      return await reverseGeocodeWithOsm(latitude, longitude);
    }
  }

  return await reverseGeocodeWithOsm(latitude, longitude);
}
