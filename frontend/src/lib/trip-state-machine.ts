import type { TripStatus } from "@/lib/ride-backend-types";

export const TRIP_STATUS_FLOW: readonly TripStatus[] = [
    "pending",
    "searching_driver",
    "offered",
    "accepted",
    "driver_on_the_way",
    "driver_arrived",
    "trip_started",
    "completed",
    "cancelled",
] as const;

const ADMIN_MANUAL_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
    pending: ["searching_driver", "cancelled"],
    searching_driver: ["pending", "cancelled"],
    offered: ["searching_driver", "cancelled"],
    accepted: ["driver_on_the_way", "cancelled"],
    driver_on_the_way: ["driver_arrived", "cancelled"],
    driver_arrived: ["trip_started", "cancelled"],
    trip_started: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
};

export function isTripStatus(value: string): value is TripStatus {
    return TRIP_STATUS_FLOW.includes(value as TripStatus);
}

export function isTerminalTripStatus(status: TripStatus) {
    return status === "completed" || status === "cancelled";
}

export function getAllowedAdminManualTripStatuses(currentStatus: TripStatus) {
    return ADMIN_MANUAL_TRANSITIONS[currentStatus];
}

export function canAdminManuallyTransitionTrip(fromStatus: TripStatus, toStatus: TripStatus) {
    return fromStatus === toStatus || ADMIN_MANUAL_TRANSITIONS[fromStatus].includes(toStatus);
}
