do $$
begin
    if not exists (select 1 from pg_type where typname = 'trip_type') then
        create type public.trip_type as enum ('airport_ride', 'normal_ride');
    end if;
    if not exists (select 1 from pg_type where typname = 'trip_status') then
        create type public.trip_status as enum (
            'pending',
            'searching_driver',
            'offered',
            'accepted',
            'driver_on_the_way',
            'driver_arrived',
            'trip_started',
            'completed',
            'cancelled'
        );
    end if;
    if not exists (select 1 from pg_type where typname = 'offer_status') then
        create type public.offer_status as enum ('offered', 'accepted', 'rejected', 'timed_out', 'cancelled');
    end if;
    if not exists (select 1 from pg_type where typname = 'airport_ride_mode') then
        create type public.airport_ride_mode as enum ('arrival', 'departure');
    end if;
    if not exists (select 1 from pg_type where typname = 'notification_type') then
        create type public.notification_type as enum (
            'trip_created',
            'trip_offered',
            'trip_accepted',
            'trip_rejected',
            'driver_arrived',
            'trip_started',
            'trip_completed',
            'trip_cancelled',
            'onboarding_update',
            'admin_message',
            'support_update'
        );
    end if;
    if not exists (select 1 from pg_type where typname = 'support_ticket_status') then
        create type public.support_ticket_status as enum ('open', 'in_progress', 'waiting_user', 'resolved', 'closed');
    end if;
    if not exists (select 1 from pg_type where typname = 'support_ticket_category') then
        create type public.support_ticket_category as enum (
            'trip_issue',
            'driver_issue',
            'payment_issue',
            'account_issue',
            'general_complaint'
        );
    end if;
    if not exists (select 1 from pg_type where typname = 'announcement_audience') then
        create type public.announcement_audience as enum ('all', 'customers', 'drivers', 'admins');
    end if;
end $$;

create table if not exists public.trips (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.profiles(id) on delete restrict,
    assigned_driver_id uuid references public.driver_profiles(id) on delete set null,
    assigned_vehicle_id uuid references public.vehicles(id) on delete set null,
    created_by_admin_id uuid references public.profiles(id) on delete set null,
    trip_type public.trip_type not null,
    status public.trip_status not null default 'pending',
    pickup_label text not null,
    pickup_address text not null,
    pickup_latitude double precision,
    pickup_longitude double precision,
    destination_label text not null,
    destination_address text not null,
    destination_latitude double precision,
    destination_longitude double precision,
    airport_name text,
    airport_terminal text,
    airport_ride_mode public.airport_ride_mode,
    flight_number text,
    flight_time timestamptz,
    luggage_count integer not null default 0,
    passenger_count integer not null default 1,
    rider_notes text,
    estimated_price numeric(10,2),
    actual_price numeric(10,2),
    currency_code text not null default 'EGP',
    offered_driver_count integer not null default 0,
    cancellation_reason text,
    cancelled_by uuid references public.profiles(id) on delete set null,
    requested_at timestamptz not null default timezone('utc', now()),
    search_started_at timestamptz,
    offered_at timestamptz,
    accepted_at timestamptz,
    driver_on_the_way_at timestamptz,
    driver_arrived_at timestamptz,
    trip_started_at timestamptz,
    completed_at timestamptz,
    cancelled_at timestamptz,
    admin_notes text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint trips_coordinates_check check (
        (pickup_latitude is null and pickup_longitude is null)
        or (pickup_latitude between -90 and 90 and pickup_longitude between -180 and 180)
    ),
    constraint trips_destination_coordinates_check check (
        (destination_latitude is null and destination_longitude is null)
        or (destination_latitude between -90 and 90 and destination_longitude between -180 and 180)
    ),
    constraint trips_passengers_check check (passenger_count between 1 and 12),
    constraint trips_luggage_check check (luggage_count >= 0),
    constraint trips_prices_check check (
        (estimated_price is null or estimated_price >= 0)
        and (actual_price is null or actual_price >= 0)
    ),
    constraint trips_airport_requirements_check check (
        trip_type <> 'airport_ride'
        or (
            airport_name is not null
            and airport_ride_mode is not null
            and flight_time is not null
        )
    )
);

create index if not exists trips_customer_idx on public.trips (customer_id);
create index if not exists trips_assigned_driver_idx on public.trips (assigned_driver_id);
create index if not exists trips_assigned_vehicle_idx on public.trips (assigned_vehicle_id);
create index if not exists trips_status_idx on public.trips (status);
create index if not exists trips_trip_type_idx on public.trips (trip_type);
create index if not exists trips_created_at_idx on public.trips (created_at desc);
create index if not exists trips_requested_at_idx on public.trips (requested_at desc);
create index if not exists trips_driver_status_created_idx on public.trips (assigned_driver_id, status, created_at desc);

create table if not exists public.trip_offers (
    id uuid primary key default gen_random_uuid(),
    trip_id uuid not null references public.trips(id) on delete cascade,
    driver_id uuid not null references public.driver_profiles(id) on delete cascade,
    vehicle_id uuid references public.vehicles(id) on delete set null,
    offered_by_admin_id uuid references public.profiles(id) on delete set null,
    offer_status public.offer_status not null default 'offered',
    offered_at timestamptz not null default timezone('utc', now()),
    expires_at timestamptz,
    responded_at timestamptz,
    rejection_reason text,
    driver_note text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint trip_offers_unique_per_driver unique (trip_id, driver_id)
);

create unique index if not exists trip_offers_single_accepted_trip_idx
    on public.trip_offers (trip_id)
    where offer_status = 'accepted';

create index if not exists trip_offers_driver_status_idx on public.trip_offers (driver_id, offer_status, offered_at desc);
create index if not exists trip_offers_trip_status_idx on public.trip_offers (trip_id, offer_status);
create index if not exists trip_offers_expires_at_idx on public.trip_offers (expires_at);

create table if not exists public.trip_status_history (
    id bigint generated always as identity primary key,
    trip_id uuid not null references public.trips(id) on delete cascade,
    status public.trip_status not null,
    changed_by uuid references public.profiles(id) on delete set null,
    note text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists trip_status_history_trip_created_idx
    on public.trip_status_history (trip_id, created_at desc);

create index if not exists trip_status_history_status_idx
    on public.trip_status_history (status, created_at desc);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_user_id uuid not null references public.profiles(id) on delete cascade,
    type public.notification_type not null,
    title text not null,
    body text not null,
    payload jsonb not null default '{}'::jsonb,
    related_trip_id uuid references public.trips(id) on delete set null,
    is_read boolean not null default false,
    read_at timestamptz,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_recipient_created_idx
    on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_unread_idx
    on public.notifications (recipient_user_id, is_read, created_at desc);

create index if not exists notifications_type_idx on public.notifications (type);

create table if not exists public.support_tickets (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null references public.profiles(id) on delete cascade,
    trip_id uuid references public.trips(id) on delete set null,
    assigned_admin_id uuid references public.profiles(id) on delete set null,
    category public.support_ticket_category not null,
    status public.support_ticket_status not null default 'open',
    subject text not null,
    description text not null,
    priority smallint not null default 2,
    resolved_at timestamptz,
    closed_at timestamptz,
    last_message_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint support_tickets_priority_check check (priority between 1 and 5)
);

create index if not exists support_tickets_creator_idx on public.support_tickets (created_by, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_category_idx on public.support_tickets (category);
create index if not exists support_tickets_trip_idx on public.support_tickets (trip_id);

create table if not exists public.support_ticket_messages (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null references public.support_tickets(id) on delete cascade,
    sender_user_id uuid not null references public.profiles(id) on delete cascade,
    message_body text not null,
    attachment_bucket text,
    attachment_path text,
    is_internal boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists support_ticket_messages_ticket_created_idx
    on public.support_ticket_messages (ticket_id, created_at asc);

create table if not exists public.admin_announcements (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null references public.profiles(id) on delete restrict,
    audience public.announcement_audience not null default 'all',
    title text not null,
    body text not null,
    payload jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_announcements_active_idx
    on public.admin_announcements (is_active, starts_at desc, created_at desc);

create table if not exists public.audit_logs (
    id bigint generated always as identity primary key,
    actor_user_id uuid references public.profiles(id) on delete set null,
    actor_role public.user_role,
    action text not null,
    entity_table text not null,
    entity_id text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_actor_created_idx on public.audit_logs (actor_user_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_table, entity_id);
