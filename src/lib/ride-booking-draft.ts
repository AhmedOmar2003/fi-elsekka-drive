export type RideBookingDraft = {
  tripType: "airport_ride" | "normal_ride";
  pickupQuery: string;
  destinationQuery: string;
  preferredVehicleType: "car" | "tuk_tuk" | "any";
  passengerCount: number;
  luggageCount: number;
  notes: string;
  airportName?: string;
  airportTerminal?: string;
  airportRideMode?: "arrival" | "departure";
  flightNumber?: string;
  flightTime?: string;
  estimate?: {
    pickup: {
      label: string;
      address: string;
      latitude: number;
      longitude: number;
      city: string | null;
      area: string | null;
    };
    destination: {
      label: string;
      address: string;
      latitude: number;
      longitude: number;
      city: string | null;
      area: string | null;
    };
    distanceKm: number;
    durationMinutes: number;
    suggestedPrice: number;
    minPrice: number;
    maxPrice: number;
  };
};

const STORAGE_KEY = "fi-elsekka-ride-draft";

export function saveRideBookingDraft(draft: RideBookingDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function readRideBookingDraft(): RideBookingDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RideBookingDraft) : null;
  } catch {
    return null;
  }
}

export function clearRideBookingDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
