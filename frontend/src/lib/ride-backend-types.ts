export type UserRole = 'customer' | 'driver' | 'admin';
export type AccountStatus = 'active' | 'pending' | 'suspended' | 'disabled';
export type VehicleType = 'car' | 'tuk_tuk' | 'mini_bus';
export type TripType = 'airport_ride' | 'normal_ride';
export type TripStatus =
    | 'pending'
    | 'searching_driver'
    | 'offered'
    | 'accepted'
    | 'driver_on_the_way'
    | 'driver_arrived'
    | 'waiting_for_return'
    | 'trip_started'
    | 'completed'
    | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'requires_review' | 'suspended';
export type DriverAvailabilityStatus = 'offline' | 'available' | 'busy';
export type OfferStatus = 'offered' | 'accepted' | 'rejected' | 'timed_out' | 'cancelled';
export type AirportRideMode = 'arrival' | 'departure';
export type RoundTripReturnStatus =
    | 'not_applicable'
    | 'outbound'
    | 'waiting_for_return'
    | 'return_in_progress'
    | 'return_cancelled'
    | 'return_completed';
export type NotificationType =
    | 'trip_created'
    | 'trip_offered'
    | 'trip_accepted'
    | 'trip_rejected'
    | 'driver_arrived'
    | 'trip_started'
    | 'trip_completed'
    | 'trip_cancelled'
    | 'onboarding_update'
    | 'admin_message'
    | 'support_update';

export interface ProfileRecord {
    id: string;
    role: UserRole;
    account_status: AccountStatus;
    full_name: string | null;
    display_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_bucket: string | null;
    avatar_path: string | null;
    preferred_language: string;
    profile_completed_at: string | null;
    last_login_at: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface DriverProfileRecord {
    id: string;
    application_status: ApprovalStatus;
    verification_status: ApprovalStatus;
    availability_status: DriverAvailabilityStatus;
    is_accepting_offers: boolean;
    national_id: string;
    working_city: string;
    working_area: string | null;
    operational_notes: string | null;
    suspension_reason: string | null;
    approved_at: string | null;
    approved_by: string | null;
    suspended_at: string | null;
    suspended_by: string | null;
    last_seen_at: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface VehicleRecord {
    id: string;
    driver_id: string;
    vehicle_type: VehicleType;
    brand: string;
    model: string;
    color: string;
    manufacturing_year: number;
    plate_number: string | null;
    seat_count: number | null;
    operating_area: string | null;
    condition_notes: string | null;
    approval_status: ApprovalStatus;
    approval_notes: string | null;
    approved_at: string | null;
    approved_by: string | null;
    is_primary: boolean;
    is_active: boolean;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface TripRecord {
    id: string;
    customer_id: string;
    assigned_driver_id: string | null;
    assigned_vehicle_id: string | null;
    trip_type: TripType;
    status: TripStatus;
    pickup_label: string;
    pickup_address: string;
    pickup_latitude: number | null;
    pickup_longitude: number | null;
    destination_label: string;
    destination_address: string;
    destination_latitude: number | null;
    destination_longitude: number | null;
    is_round_trip: boolean;
    waiting_duration_minutes: number | null;
    return_status: RoundTripReturnStatus;
    return_pickup_label: string | null;
    return_pickup_address: string | null;
    return_pickup_latitude: number | null;
    return_pickup_longitude: number | null;
    return_destination_label: string | null;
    return_destination_address: string | null;
    return_destination_latitude: number | null;
    return_destination_longitude: number | null;
    airport_name: string | null;
    airport_terminal: string | null;
    airport_ride_mode: AirportRideMode | null;
    flight_number: string | null;
    flight_time: string | null;
    luggage_count: number;
    passenger_count: number;
    rider_notes: string | null;
    estimated_price: number | null;
    actual_price: number | null;
    currency_code: string;
    offered_driver_count: number;
    cancellation_reason: string | null;
    requested_at: string;
    search_started_at: string | null;
    offered_at: string | null;
    accepted_at: string | null;
    driver_on_the_way_at: string | null;
    driver_arrived_at: string | null;
    trip_started_at: string | null;
    waiting_for_return_at: string | null;
    return_started_at: string | null;
    return_cancelled_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    admin_notes: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface CreateTripRequestInput {
    trip_type: TripType;
    pickup_label: string;
    pickup_address: string;
    pickup_latitude?: number | null;
    pickup_longitude?: number | null;
    destination_label: string;
    destination_address: string;
    destination_latitude?: number | null;
    destination_longitude?: number | null;
    airport_name?: string | null;
    airport_terminal?: string | null;
    airport_ride_mode?: AirportRideMode | null;
    flight_number?: string | null;
    flight_time?: string | null;
    luggage_count?: number;
    passenger_count?: number;
    rider_notes?: string | null;
    is_round_trip?: boolean;
    waiting_duration_minutes?: number | null;
    return_pickup_label?: string | null;
    return_pickup_address?: string | null;
    return_pickup_latitude?: number | null;
    return_pickup_longitude?: number | null;
    return_destination_label?: string | null;
    return_destination_address?: string | null;
    return_destination_latitude?: number | null;
    return_destination_longitude?: number | null;
}

export interface DriverOfferDecisionInput {
    offerId: string;
    accept: boolean;
    rejectionReason?: string | null;
}
