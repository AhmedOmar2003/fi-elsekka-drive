export type DispatchSlaState = "healthy" | "warning" | "breached";

export type DispatchLocationPoint = {
    latitude: number;
    longitude: number;
    source: "pickup" | "destination" | "driver_gps" | "city_hint";
    updatedAt?: string | null;
};

export type DispatchQueueTripItem = {
    id: string;
    customerName: string;
    pickup: string;
    destination: string;
    tripType: string;
    status: string;
    createdAt: string;
    estimatedPrice: number | null;
    offeredDriverCount: number;
    dispatchMode: string | null;
    awaitingAdminDispatch: boolean;
    fallbackReason: string | null;
    ageMinutes: number;
    slaState: DispatchSlaState;
    slaLabel: string;
    region: string | null;
    pickupLocation: DispatchLocationPoint | null;
    destinationLocation: DispatchLocationPoint | null;
};

export type DispatchLiveTripItem = {
    id: string;
    customerName: string;
    driverId: string | null;
    driverName: string | null;
    driverVehicleLabel: string | null;
    tripType: string;
    status: string;
    createdAt: string;
    acceptedAt: string | null;
    captainEtaMinutes: number | null;
    ageMinutes: number;
    slaState: DispatchSlaState;
    slaLabel: string;
    region: string | null;
    pickup: string;
    destination: string;
    pickupLocation: DispatchLocationPoint | null;
    destinationLocation: DispatchLocationPoint | null;
    driverLocation: DispatchLocationPoint | null;
};

export type DispatchFleetDriverItem = {
    id: string;
    fullName: string;
    availabilityStatus: string;
    city: string;
    area: string | null;
    vehicleId: string | null;
    vehicleLabel: string | null;
    isAcceptingOffers: boolean;
    hasActiveTrip: boolean;
    hasOpenOffer: boolean;
    lastSeenAt: string | null;
    locationLabel: string | null;
    location: DispatchLocationPoint | null;
};

export type DispatchBoardMetrics = {
    queueTripsCount: number;
    liveTripsCount: number;
    onlineDriversCount: number;
    adminRescueCount: number;
    breachedTripsCount: number;
};

export type DispatchBoardData = {
    generatedAt: string;
    regionOptions: string[];
    metrics: DispatchBoardMetrics;
    queueTrips: DispatchQueueTripItem[];
    liveTrips: DispatchLiveTripItem[];
    availableDrivers: DispatchFleetDriverItem[];
    assignableDrivers: DispatchFleetDriverItem[];
};
