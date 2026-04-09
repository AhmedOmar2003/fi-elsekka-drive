do $$
begin
    if exists (
        select 1
        from pg_enum
        where enumtypid = 'public.driver_availability_status'::regtype
          and enumlabel = 'online'
    ) and not exists (
        select 1
        from pg_enum
        where enumtypid = 'public.driver_availability_status'::regtype
          and enumlabel = 'available'
    ) then
        alter type public.driver_availability_status rename value 'online' to 'available';
    end if;
exception
    when undefined_object then
        null;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_enum
        where enumtypid = 'public.driver_availability_status'::regtype
          and enumlabel = 'available'
    ) then
        alter type public.driver_availability_status add value 'available';
    end if;
exception
    when undefined_object then
        null;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_enum
        where enumtypid = 'public.vehicle_type'::regtype
          and enumlabel = 'mini_bus'
    ) then
        alter type public.vehicle_type add value 'mini_bus';
    end if;
exception
    when undefined_object then
        null;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_enum
        where enumtypid = 'public.trip_status'::regtype
          and enumlabel = 'waiting_for_return'
    ) then
        alter type public.trip_status add value 'waiting_for_return' after 'trip_started';
    end if;
exception
    when undefined_object then
        null;
end $$;

do $$
begin
    if not exists (select 1 from pg_type where typname = 'round_trip_return_status') then
        create type public.round_trip_return_status as enum (
            'not_applicable',
            'outbound',
            'waiting_for_return',
            'return_in_progress',
            'return_cancelled',
            'return_completed'
        );
    end if;
end $$;
