create or replace function public.create_trip_request_v2(
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
