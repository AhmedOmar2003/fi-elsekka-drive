type FareInput = {
  distanceKm: number;
  durationMinutes: number;
  tripType: "airport_ride" | "normal_ride";
  preferredVehicleType?: "car" | "tuk_tuk" | "any";
  luggageCount?: number;
  passengerCount?: number;
};

export type FareEstimate = {
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
};

function roundToNearestFive(value: number) {
  return Math.ceil(value / 5) * 5;
}

export function calculateRideFare(input: FareInput): FareEstimate {
  const distanceKm = Math.max(0, input.distanceKm);
  const durationMinutes = Math.max(0, input.durationMinutes);
  const luggageCount = Math.max(0, input.luggageCount || 0);
  const passengerCount = Math.max(1, input.passengerCount || 1);
  const prefersTukTuk = input.preferredVehicleType === "tuk_tuk";
  const isAirport = input.tripType === "airport_ride";

  let baseFare = prefersTukTuk ? 18 : 28;
  let perKm = prefersTukTuk ? 4.25 : 7;
  let perMinute = prefersTukTuk ? 0.55 : 0.8;

  if (isAirport) {
    baseFare += prefersTukTuk ? 25 : 70;
    perKm += prefersTukTuk ? 1.25 : 2;
    perMinute += prefersTukTuk ? 0.1 : 0.2;
  }

  const luggageFee = isAirport ? luggageCount * 15 : 0;
  const passengerFee = passengerCount > 2 ? (passengerCount - 2) * 6 : 0;

  const rawSuggested =
    baseFare +
    distanceKm * perKm +
    durationMinutes * perMinute +
    luggageFee +
    passengerFee;

  const suggestedPrice = roundToNearestFive(rawSuggested);
  const variance = Math.max(10, Math.round(suggestedPrice * 0.08));

  return {
    suggestedPrice,
    minPrice: roundToNearestFive(Math.max(15, suggestedPrice - variance)),
    maxPrice: roundToNearestFive(suggestedPrice + variance),
  };
}
