alter table public.trips
    add column if not exists is_round_trip boolean not null default false,
    add column if not exists waiting_duration_minutes integer,
    add column if not exists return_status public.round_trip_return_status not null default 'not_applicable',
    add column if not exists return_pickup_label text,
    add column if not exists return_pickup_address text,
    add column if not exists return_pickup_latitude double precision,
    add column if not exists return_pickup_longitude double precision,
    add column if not exists return_destination_label text,
    add column if not exists return_destination_address text,
    add column if not exists return_destination_latitude double precision,
    add column if not exists return_destination_longitude double precision,
    add column if not exists waiting_for_return_at timestamptz,
    add column if not exists return_started_at timestamptz,
    add column if not exists return_cancelled_at timestamptz;

alter table public.trips
    drop constraint if exists trips_waiting_duration_check;

alter table public.trips
    add constraint trips_waiting_duration_check
    check (waiting_duration_minutes is null or waiting_duration_minutes between 0 and 720);

alter table public.trips
    drop constraint if exists trips_round_trip_coordinates_check;

alter table public.trips
    add constraint trips_round_trip_coordinates_check
    check (
        (return_pickup_latitude is null and return_pickup_longitude is null)
        or (
            return_pickup_latitude between -90 and 90
            and return_pickup_longitude between -180 and 180
        )
    );

alter table public.trips
    drop constraint if exists trips_round_trip_destination_coordinates_check;

alter table public.trips
    add constraint trips_round_trip_destination_coordinates_check
    check (
        (return_destination_latitude is null and return_destination_longitude is null)
        or (
            return_destination_latitude between -90 and 90
            and return_destination_longitude between -180 and 180
        )
    );

alter table public.trips
    drop constraint if exists trips_round_trip_status_check;

alter table public.trips
    add constraint trips_round_trip_status_check
    check (
        (is_round_trip = false and return_status = 'not_applicable')
        or (is_round_trip = true and return_status <> 'not_applicable')
    );

create or replace function public.driver_has_active_trip(p_driver_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select exists (
        select 1
        from public.trips
        where assigned_driver_id = p_driver_id
          and status in (
              'accepted',
              'driver_on_the_way',
              'driver_arrived',
              'trip_started',
              'waiting_for_return'
          )
    )
$$;

create or replace function public.recompute_driver_operational_availability(p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_driver public.driver_profiles;
    v_has_active_trip boolean;
begin
    if p_driver_id is null then
        return;
    end if;

    select * into v_driver
    from public.driver_profiles
    where id = p_driver_id;

    if v_driver.id is null then
        return;
    end if;

    v_has_active_trip := public.driver_has_active_trip(p_driver_id);

    if v_has_active_trip then
        update public.driver_profiles
        set availability_status = 'busy',
            last_seen_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        where id = p_driver_id
          and availability_status <> 'busy';
        return;
    end if;

    if v_driver.availability_status = 'busy' then
        update public.driver_profiles
        set availability_status = case
                when v_driver.application_status = 'approved'
                 and v_driver.verification_status = 'approved'
                 and v_driver.is_accepting_offers = true
                    then 'available'
                else 'offline'
            end,
            last_seen_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        where id = p_driver_id;
    end if;
end;
$$;

create or replace function public.sync_trip_driver_operational_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        perform public.recompute_driver_operational_availability(old.assigned_driver_id);
        return old;
    end if;

    if tg_op in ('INSERT', 'UPDATE') then
        if tg_op = 'UPDATE' and old.assigned_driver_id is distinct from new.assigned_driver_id then
            perform public.recompute_driver_operational_availability(old.assigned_driver_id);
        end if;
        perform public.recompute_driver_operational_availability(new.assigned_driver_id);
        return new;
    end if;

    return coalesce(new, old);
end;
$$;

create or replace function public.set_driver_availability(p_status public.driver_availability_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_status = 'available' and public.driver_has_active_trip(auth.uid()) then
        raise exception 'Driver has an active trip and cannot be marked available';
    end if;

    update public.driver_profiles
    set availability_status = p_status,
        is_accepting_offers = case
            when p_status = 'offline' then false
            when p_status = 'available' then true
            else is_accepting_offers
        end,
        last_seen_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where id = auth.uid();

    perform public.recompute_driver_operational_availability(auth.uid());
end;
$$;

create or replace function public.validate_trip_assignment()
returns trigger
language plpgsql
as $$
declare
    vehicle_owner_id uuid;
begin
    if new.assigned_vehicle_id is not null and new.assigned_driver_id is null then
        raise exception 'Assigned vehicle requires assigned driver';
    end if;

    if new.assigned_vehicle_id is not null then
        select driver_id into vehicle_owner_id
        from public.vehicles
        where id = new.assigned_vehicle_id;

        if vehicle_owner_id is null then
            raise exception 'Assigned vehicle does not exist';
        end if;

        if vehicle_owner_id <> new.assigned_driver_id then
            raise exception 'Assigned vehicle must belong to the assigned driver';
        end if;
    end if;

    if new.status in (
        'accepted',
        'driver_on_the_way',
        'driver_arrived',
        'trip_started',
        'waiting_for_return',
        'completed'
    ) and new.assigned_driver_id is null then
        raise exception 'Assigned driver is required for the selected trip status';
    end if;

    if new.status = 'waiting_for_return' and coalesce(new.is_round_trip, false) = false then
        raise exception 'waiting_for_return is only valid for round trips';
    end if;

    if coalesce(new.is_round_trip, false) = false and new.return_status <> 'not_applicable' then
        raise exception 'Non-round trips cannot carry a return status';
    end if;

    return new;
end;
$$;

create or replace function public.apply_trip_status_timestamps()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        new.requested_at = coalesce(new.requested_at, timezone('utc', now()));
    end if;

    if tg_op = 'INSERT' or new.status is distinct from old.status then
        case new.status
            when 'searching_driver' then new.search_started_at = coalesce(new.search_started_at, timezone('utc', now()));
            when 'offered' then new.offered_at = coalesce(new.offered_at, timezone('utc', now()));
            when 'accepted' then new.accepted_at = coalesce(new.accepted_at, timezone('utc', now()));
            when 'driver_on_the_way' then new.driver_on_the_way_at = coalesce(new.driver_on_the_way_at, timezone('utc', now()));
            when 'driver_arrived' then new.driver_arrived_at = coalesce(new.driver_arrived_at, timezone('utc', now()));
            when 'trip_started' then new.trip_started_at = coalesce(new.trip_started_at, timezone('utc', now()));
            when 'waiting_for_return' then new.waiting_for_return_at = coalesce(new.waiting_for_return_at, timezone('utc', now()));
            when 'completed' then new.completed_at = coalesce(new.completed_at, timezone('utc', now()));
            when 'cancelled' then new.cancelled_at = coalesce(new.cancelled_at, timezone('utc', now()));
        end case;
    end if;

    if tg_op = 'INSERT' or new.return_status is distinct from old.return_status then
        case new.return_status
            when 'waiting_for_return' then new.waiting_for_return_at = coalesce(new.waiting_for_return_at, timezone('utc', now()));
            when 'return_in_progress' then new.return_started_at = coalesce(new.return_started_at, timezone('utc', now()));
            when 'return_cancelled' then new.return_cancelled_at = coalesce(new.return_cancelled_at, timezone('utc', now()));
            else null;
        end case;
    end if;

    return new;
end;
$$;

create or replace function public.create_trip_request(
    p_trip_type public.trip_type,
    p_pickup_label text,
    p_pickup_address text,
    p_destination_label text,
    p_destination_address text,
    p_pickup_latitude double precision default null,
    p_pickup_longitude double precision default null,
    p_destination_latitude double precision default null,
    p_destination_longitude double precision default null,
    p_airport_name text default null,
    p_airport_terminal text default null,
    p_airport_ride_mode public.airport_ride_mode default null,
    p_flight_number text default null,
    p_flight_time timestamptz default null,
    p_luggage_count integer default 0,
    p_passenger_count integer default 1,
    p_rider_notes text default null,
    p_is_round_trip boolean default false,
    p_waiting_duration_minutes integer default null,
    p_return_destination_label text default null,
    p_return_destination_address text default null,
    p_return_destination_latitude double precision default null,
    p_return_destination_longitude double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_trip_id uuid;
    v_return_destination_label text;
    v_return_destination_address text;
    v_return_destination_latitude double precision;
    v_return_destination_longitude double precision;
begin
    v_return_destination_label := case
        when coalesce(p_is_round_trip, false)
            then coalesce(nullif(trim(p_return_destination_label), ''), p_pickup_label)
        else null
    end;
    v_return_destination_address := case
        when coalesce(p_is_round_trip, false)
            then coalesce(nullif(trim(p_return_destination_address), ''), p_pickup_address)
        else null
    end;
    v_return_destination_latitude := case
        when coalesce(p_is_round_trip, false)
            then coalesce(p_return_destination_latitude, p_pickup_latitude)
        else null
    end;
    v_return_destination_longitude := case
        when coalesce(p_is_round_trip, false)
            then coalesce(p_return_destination_longitude, p_pickup_longitude)
        else null
    end;

    insert into public.trips (
        customer_id,
        trip_type,
        status,
        pickup_label,
        pickup_address,
        pickup_latitude,
        pickup_longitude,
        destination_label,
        destination_address,
        destination_latitude,
        destination_longitude,
        airport_name,
        airport_terminal,
        airport_ride_mode,
        flight_number,
        flight_time,
        luggage_count,
        passenger_count,
        rider_notes,
        is_round_trip,
        waiting_duration_minutes,
        return_status,
        return_pickup_label,
        return_pickup_address,
        return_pickup_latitude,
        return_pickup_longitude,
        return_destination_label,
        return_destination_address,
        return_destination_latitude,
        return_destination_longitude,
        metadata
    )
    values (
        auth.uid(),
        p_trip_type,
        'pending',
        p_pickup_label,
        p_pickup_address,
        p_pickup_latitude,
        p_pickup_longitude,
        p_destination_label,
        p_destination_address,
        p_destination_latitude,
        p_destination_longitude,
        p_airport_name,
        p_airport_terminal,
        p_airport_ride_mode,
        p_flight_number,
        p_flight_time,
        coalesce(p_luggage_count, 0),
        coalesce(p_passenger_count, 1),
        p_rider_notes,
        coalesce(p_is_round_trip, false),
        case
            when coalesce(p_is_round_trip, false)
                then greatest(coalesce(p_waiting_duration_minutes, 0), 0)
            else null
        end,
        case
            when coalesce(p_is_round_trip, false) then 'outbound'::public.round_trip_return_status
            else 'not_applicable'::public.round_trip_return_status
        end,
        case when coalesce(p_is_round_trip, false) then p_destination_label else null end,
        case when coalesce(p_is_round_trip, false) then p_destination_address else null end,
        case when coalesce(p_is_round_trip, false) then p_destination_latitude else null end,
        case when coalesce(p_is_round_trip, false) then p_destination_longitude else null end,
        v_return_destination_label,
        v_return_destination_address,
        v_return_destination_latitude,
        v_return_destination_longitude,
        case
            when coalesce(p_is_round_trip, false)
                then jsonb_build_object(
                    'round_trip', true,
                    'return_status', 'outbound',
                    'waiting_duration_minutes', greatest(coalesce(p_waiting_duration_minutes, 0), 0)
                )
            else '{}'::jsonb
        end
    )
    returning id into v_trip_id;

    perform public.write_audit_log(
        'trip_created',
        'trips',
        v_trip_id::text,
        jsonb_build_object(
            'trip_type', p_trip_type,
            'is_round_trip', coalesce(p_is_round_trip, false),
            'waiting_duration_minutes', p_waiting_duration_minutes
        )
    );
    return v_trip_id;
end;
$$;

create or replace function public.driver_respond_to_trip_offer(
    p_offer_id uuid,
    p_accept boolean,
    p_rejection_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.trip_offers;
    v_trip public.trips;
    v_driver public.driver_profiles;
    v_now timestamptz := timezone('utc', now());
begin
    select * into v_offer
    from public.trip_offers
    where id = p_offer_id
      and driver_id = auth.uid()
    for update;

    if v_offer.id is null then
        raise exception 'Trip offer not found';
    end if;

    if v_offer.offer_status <> 'offered' then
        raise exception 'Trip offer already answered';
    end if;

    if v_offer.expires_at is not null and v_offer.expires_at <= v_now then
        update public.trip_offers
        set offer_status = 'timed_out',
            responded_at = v_now,
            updated_at = v_now,
            rejection_reason = 'Trip offer timed out before response'
        where id = v_offer.id;
        raise exception 'Trip offer already answered';
    end if;

    select * into v_driver
    from public.driver_profiles
    where id = auth.uid()
    for update;

    if v_driver.id is null then
        raise exception 'Driver profile not found';
    end if;

    select * into v_trip
    from public.trips
    where id = v_offer.trip_id
    for update;

    if v_trip.id is null then
        raise exception 'Trip not found';
    end if;

    if p_accept then
        if v_driver.availability_status <> 'available' then
            raise exception 'Driver is not operationally available';
        end if;

        if v_driver.is_accepting_offers is distinct from true then
            raise exception 'Driver is not accepting offers';
        end if;

        if public.driver_has_active_trip(auth.uid()) then
            raise exception 'Driver already has an active trip';
        end if;

        if v_trip.status not in ('pending', 'searching_driver', 'offered', 'accepted') then
            raise exception 'Trip is no longer dispatchable';
        end if;

        if v_trip.assigned_driver_id is not null and v_trip.assigned_driver_id <> auth.uid() then
            raise exception 'Trip already accepted by another driver';
        end if;

        update public.trip_offers
        set offer_status = 'accepted',
            responded_at = v_now,
            updated_at = v_now
        where id = p_offer_id
          and offer_status = 'offered';

        if not found then
            raise exception 'Trip offer already answered';
        end if;

        update public.trip_offers
        set offer_status = 'cancelled',
            responded_at = v_now,
            updated_at = v_now,
            rejection_reason = 'Trip won by another driver'
        where trip_id = v_offer.trip_id
          and id <> p_offer_id
          and offer_status = 'offered';

        update public.trip_offers
        set offer_status = 'cancelled',
            responded_at = v_now,
            updated_at = v_now,
            rejection_reason = 'Driver accepted another trip and became busy'
        where driver_id = auth.uid()
          and trip_id <> v_offer.trip_id
          and offer_status = 'offered';

        update public.trips
        set assigned_driver_id = auth.uid(),
            assigned_vehicle_id = v_offer.vehicle_id,
            status = 'accepted',
            accepted_at = coalesce(accepted_at, v_now),
            offered_driver_count = 1,
            updated_at = v_now,
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                'dispatch_concluded_at', v_now,
                'dispatch_winning_driver_id', auth.uid()
            )
        where id = v_offer.trip_id
          and (
              assigned_driver_id is null
              or assigned_driver_id = auth.uid()
          );

        if not found then
            raise exception 'Trip already accepted by another driver';
        end if;

        update public.driver_profiles
        set availability_status = 'busy',
            last_seen_at = v_now,
            updated_at = v_now
        where id = auth.uid();

        insert into public.notifications (recipient_user_id, type, title, body, payload, related_trip_id)
        select
            t.customer_id,
            'trip_accepted',
            'الكابتن وافق على المشوار',
            case
                when t.is_round_trip
                    then 'لقينا لك كابتن للمشوار ذهاب وعودة. نفس الكابتن هيكمل معاك الرحلتين.'
                else 'لقينا لك كابتن للمشوار. تابع حالة الرحلة من الشاشة الرئيسية.'
            end,
            jsonb_build_object('offer_id', p_offer_id, 'driver_id', auth.uid(), 'is_round_trip', t.is_round_trip),
            t.id
        from public.trips t
        where t.id = v_offer.trip_id;
    else
        update public.trip_offers
        set offer_status = 'rejected',
            rejection_reason = p_rejection_reason,
            responded_at = v_now,
            updated_at = v_now
        where id = p_offer_id;
    end if;

    perform public.write_audit_log(
        case when p_accept then 'trip_offer_accepted' else 'trip_offer_rejected' end,
        'trip_offers',
        p_offer_id::text,
        jsonb_build_object('trip_id', v_offer.trip_id)
    );

    return v_offer.trip_id;
end;
$$;

create or replace function public.cancel_trip_request(
    p_trip_id uuid,
    p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_trip public.trips;
    v_now timestamptz := timezone('utc', now());
begin
    select * into v_trip
    from public.trips
    where id = p_trip_id
    for update;

    if v_trip.id is null then
        raise exception 'Trip not found';
    end if;

    if not public.is_admin() and v_trip.customer_id <> auth.uid() then
        raise exception 'Only the trip owner or admins can cancel this trip';
    end if;

    if v_trip.status in ('trip_started', 'completed') and v_trip.return_status <> 'waiting_for_return' then
        raise exception 'Trip can no longer be cancelled';
    end if;

    update public.trips
    set status = 'cancelled',
        return_status = case
            when is_round_trip and return_status = 'waiting_for_return'
                then 'return_cancelled'::public.round_trip_return_status
            else return_status
        end,
        cancellation_reason = p_reason,
        cancelled_by = auth.uid(),
        cancelled_at = v_now,
        return_cancelled_at = case
            when is_round_trip and return_status = 'waiting_for_return'
                then coalesce(return_cancelled_at, v_now)
            else return_cancelled_at
        end,
        updated_at = v_now,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'return_cancelled', is_round_trip and return_status = 'waiting_for_return',
            'return_cancellation_reason', p_reason
        )
    where id = p_trip_id;

    update public.trip_offers
    set offer_status = 'cancelled',
        responded_at = v_now,
        updated_at = v_now
    where trip_id = p_trip_id
      and offer_status = 'offered';

    perform public.recompute_driver_operational_availability(v_trip.assigned_driver_id);
end;
$$;

drop trigger if exists trips_sync_driver_operational_availability on public.trips;
create trigger trips_sync_driver_operational_availability
after insert or update of assigned_driver_id, status, return_status or delete on public.trips
for each row execute function public.sync_trip_driver_operational_availability();
