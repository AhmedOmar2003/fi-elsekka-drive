create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
    select auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
          and account_status = 'active'
    )
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    insert into public.profiles (
        id,
        full_name,
        display_name,
        email,
        phone,
        metadata
    )
    values (
        new.id,
        coalesce(
            new.raw_user_meta_data ->> 'full_name',
            new.raw_user_meta_data ->> 'name',
            new.raw_user_meta_data ->> 'display_name'
        ),
        coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
        new.email,
        new.phone,
        coalesce(new.raw_user_meta_data, '{}'::jsonb)
    )
    on conflict (id) do update
    set
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        email = coalesce(excluded.email, public.profiles.email),
        phone = coalesce(excluded.phone, public.profiles.phone),
        updated_at = timezone('utc', now());

    return new;
end;
$$;

drop trigger if exists on_auth_user_sync on auth.users;
create trigger on_auth_user_sync
after insert or update of email, phone, raw_user_meta_data
on auth.users
for each row
execute function public.handle_auth_user_sync();

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    if old.role is distinct from new.role then
        raise exception 'Only admins can change profile roles';
    end if;

    if old.account_status is distinct from new.account_status then
        raise exception 'Only admins can change account status';
    end if;

    return new;
end;
$$;

create or replace function public.protect_driver_profile_privileged_fields()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    if old.application_status is distinct from new.application_status
        or old.verification_status is distinct from new.verification_status
        or old.suspension_reason is distinct from new.suspension_reason
        or old.approved_at is distinct from new.approved_at
        or old.approved_by is distinct from new.approved_by
        or old.suspended_at is distinct from new.suspended_at
        or old.suspended_by is distinct from new.suspended_by then
        raise exception 'Only admins can change driver review and suspension fields';
    end if;

    return new;
end;
$$;

create or replace function public.protect_vehicle_review_fields()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    if old.approval_status is distinct from new.approval_status
        or old.approval_notes is distinct from new.approval_notes
        or old.approved_at is distinct from new.approved_at
        or old.approved_by is distinct from new.approved_by then
        raise exception 'Only admins can review vehicles';
    end if;

    return new;
end;
$$;

create or replace function public.protect_driver_document_review_fields()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    if old.approval_status is distinct from new.approval_status
        or old.review_notes is distinct from new.review_notes
        or old.reviewed_at is distinct from new.reviewed_at
        or old.reviewed_by is distinct from new.reviewed_by then
        raise exception 'Only admins can review driver documents';
    end if;

    return new;
end;
$$;

create or replace function public.protect_notification_updates()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    if old.recipient_user_id is distinct from new.recipient_user_id
        or old.type is distinct from new.type
        or old.title is distinct from new.title
        or old.body is distinct from new.body
        or old.payload is distinct from new.payload
        or old.related_trip_id is distinct from new.related_trip_id
        or old.created_at is distinct from new.created_at then
        raise exception 'Users can only change notification read state';
    end if;

    return new;
end;
$$;

create or replace function public.enforce_single_primary_vehicle()
returns trigger
language plpgsql
as $$
begin
    if new.is_primary then
        update public.vehicles
        set is_primary = false,
            updated_at = timezone('utc', now())
        where driver_id = new.driver_id
          and id <> coalesce(new.id, gen_random_uuid())
          and is_primary = true;
    end if;

    return new;
end;
$$;

create or replace function public.enforce_single_default_saved_place()
returns trigger
language plpgsql
as $$
begin
    if new.is_default then
        update public.saved_places
        set is_default = false,
            updated_at = timezone('utc', now())
        where user_id = new.user_id
          and place_type = new.place_type
          and id <> coalesce(new.id, gen_random_uuid())
          and is_default = true;
    end if;

    return new;
end;
$$;

create or replace function public.validate_driver_document_vehicle()
returns trigger
language plpgsql
as $$
declare
    vehicle_owner_id uuid;
begin
    if new.vehicle_id is not null then
        select driver_id into vehicle_owner_id
        from public.vehicles
        where id = new.vehicle_id;

        if vehicle_owner_id is null then
            raise exception 'Vehicle not found for driver document';
        end if;

        if vehicle_owner_id <> new.driver_id then
            raise exception 'Vehicle document must belong to the same driver';
        end if;
    end if;

    return new;
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

    if new.status in ('accepted', 'driver_on_the_way', 'driver_arrived', 'trip_started', 'completed')
        and new.assigned_driver_id is null then
        raise exception 'Assigned driver is required for the selected trip status';
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
            when 'completed' then new.completed_at = coalesce(new.completed_at, timezone('utc', now()));
            when 'cancelled' then new.cancelled_at = coalesce(new.cancelled_at, timezone('utc', now()));
        end case;
    end if;

    return new;
end;
$$;

create or replace function public.log_trip_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' or new.status is distinct from old.status then
        insert into public.trip_status_history (trip_id, status, changed_by)
        values (new.id, new.status, auth.uid());
    end if;

    return new;
end;
$$;

create or replace function public.write_audit_log(
    p_action text,
    p_entity_table text,
    p_entity_id text,
    p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.audit_logs (actor_user_id, actor_role, action, entity_table, entity_id, metadata)
    select
        auth.uid(),
        p.role,
        p_action,
        p_entity_table,
        p_entity_id,
        coalesce(p_metadata, '{}'::jsonb)
    from public.profiles p
    where p.id = auth.uid();
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.notifications
    set is_read = true,
        read_at = timezone('utc', now())
    where id = p_notification_id
      and recipient_user_id = auth.uid();
end;
$$;

create or replace function public.set_driver_availability(p_status public.driver_availability_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.driver_profiles
    set availability_status = p_status,
        last_seen_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where id = auth.uid();
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
    p_rider_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_trip_id uuid;
begin
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
        rider_notes
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
        p_rider_notes
    )
    returning id into v_trip_id;

    perform public.write_audit_log('trip_created', 'trips', v_trip_id::text, jsonb_build_object('trip_type', p_trip_type));
    return v_trip_id;
end;
$$;

create or replace function public.admin_dispatch_trip_offer(
    p_trip_id uuid,
    p_driver_id uuid,
    p_vehicle_id uuid default null,
    p_expires_in_minutes integer default 2
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer_id uuid;
begin
    if not public.is_admin() then
        raise exception 'Only admins can dispatch trip offers';
    end if;

    insert into public.trip_offers (
        trip_id,
        driver_id,
        vehicle_id,
        offered_by_admin_id,
        offer_status,
        expires_at
    )
    values (
        p_trip_id,
        p_driver_id,
        p_vehicle_id,
        auth.uid(),
        'offered',
        timezone('utc', now()) + make_interval(mins => greatest(coalesce(p_expires_in_minutes, 2), 1))
    )
    returning id into v_offer_id;

    update public.trips
    set status = 'offered',
        offered_at = timezone('utc', now()),
        offered_driver_count = offered_driver_count + 1,
        updated_at = timezone('utc', now())
    where id = p_trip_id;

    insert into public.notifications (recipient_user_id, type, title, body, payload, related_trip_id)
    values (
        p_driver_id,
        'trip_offered',
        'مشوار جديد متاح',
        'فيه طلب جديد اتبعت لك. راجعه بسرعة قبل ما الوقت يخلص.',
        jsonb_build_object('offer_id', v_offer_id),
        p_trip_id
    );

    perform public.write_audit_log('trip_offer_dispatched', 'trip_offers', v_offer_id::text, jsonb_build_object('trip_id', p_trip_id, 'driver_id', p_driver_id));
    return v_offer_id;
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
begin
    select * into v_offer
    from public.trip_offers
    where id = p_offer_id
      and driver_id = auth.uid();

    if v_offer.id is null then
        raise exception 'Trip offer not found';
    end if;

    if v_offer.offer_status <> 'offered' then
        raise exception 'Trip offer already answered';
    end if;

    if p_accept then
        if exists (
            select 1
            from public.trip_offers
            where trip_id = v_offer.trip_id
              and offer_status = 'accepted'
        ) then
            raise exception 'Trip already accepted by another driver';
        end if;

        update public.trip_offers
        set offer_status = 'accepted',
            responded_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        where id = p_offer_id;

        update public.trip_offers
        set offer_status = 'cancelled',
            responded_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        where trip_id = v_offer.trip_id
          and id <> p_offer_id
          and offer_status = 'offered';

        update public.trips
        set assigned_driver_id = auth.uid(),
            assigned_vehicle_id = v_offer.vehicle_id,
            status = 'accepted',
            accepted_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        where id = v_offer.trip_id;

        insert into public.notifications (recipient_user_id, type, title, body, payload, related_trip_id)
        select
            t.customer_id,
            'trip_accepted',
            'الكابتن وافق على المشوار',
            'لقينا لك كابتن للمشوار. تابع حالة الرحلة من الشاشة الرئيسية.',
            jsonb_build_object('offer_id', p_offer_id, 'driver_id', auth.uid()),
            t.id
        from public.trips t
        where t.id = v_offer.trip_id;
    else
        update public.trip_offers
        set offer_status = 'rejected',
            rejection_reason = p_rejection_reason,
            responded_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
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

create or replace function public.update_trip_status(
    p_trip_id uuid,
    p_status public.trip_status,
    p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_trip public.trips;
begin
    select * into v_trip
    from public.trips
    where id = p_trip_id;

    if v_trip.id is null then
        raise exception 'Trip not found';
    end if;

    if not public.is_admin() and v_trip.assigned_driver_id <> auth.uid() then
        raise exception 'Only the assigned driver or admins can update this trip';
    end if;

    update public.trips
    set status = p_status,
        updated_at = timezone('utc', now())
    where id = p_trip_id;

    if p_note is not null then
        insert into public.trip_status_history (trip_id, status, changed_by, note)
        values (p_trip_id, p_status, auth.uid(), p_note);
    end if;
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
begin
    select * into v_trip
    from public.trips
    where id = p_trip_id;

    if v_trip.id is null then
        raise exception 'Trip not found';
    end if;

    if not public.is_admin() and v_trip.customer_id <> auth.uid() then
        raise exception 'Only the trip owner or admins can cancel this trip';
    end if;

    if v_trip.status in ('trip_started', 'completed') then
        raise exception 'Trip can no longer be cancelled';
    end if;

    update public.trips
    set status = 'cancelled',
        cancellation_reason = p_reason,
        cancelled_by = auth.uid(),
        cancelled_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where id = p_trip_id;

    update public.trip_offers
    set offer_status = 'cancelled',
        responded_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where trip_id = p_trip_id
      and offer_status = 'offered';
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists profiles_protect_privileged_fields on public.profiles;
create trigger profiles_protect_privileged_fields
before update on public.profiles
for each row execute function public.protect_profile_privileged_fields();

drop trigger if exists driver_profiles_set_updated_at on public.driver_profiles;
create trigger driver_profiles_set_updated_at
before update on public.driver_profiles
for each row execute function public.set_updated_at();

drop trigger if exists driver_profiles_protect_privileged_fields on public.driver_profiles;
create trigger driver_profiles_protect_privileged_fields
before update on public.driver_profiles
for each row execute function public.protect_driver_profile_privileged_fields();

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

drop trigger if exists vehicles_enforce_single_primary on public.vehicles;
create trigger vehicles_enforce_single_primary
before insert or update on public.vehicles
for each row execute function public.enforce_single_primary_vehicle();

drop trigger if exists vehicles_protect_review_fields on public.vehicles;
create trigger vehicles_protect_review_fields
before update on public.vehicles
for each row execute function public.protect_vehicle_review_fields();

drop trigger if exists driver_documents_set_updated_at on public.driver_documents;
create trigger driver_documents_set_updated_at
before update on public.driver_documents
for each row execute function public.set_updated_at();

drop trigger if exists driver_documents_validate_vehicle on public.driver_documents;
create trigger driver_documents_validate_vehicle
before insert or update on public.driver_documents
for each row execute function public.validate_driver_document_vehicle();

drop trigger if exists driver_documents_protect_review_fields on public.driver_documents;
create trigger driver_documents_protect_review_fields
before update on public.driver_documents
for each row execute function public.protect_driver_document_review_fields();

drop trigger if exists saved_places_set_updated_at on public.saved_places;
create trigger saved_places_set_updated_at
before update on public.saved_places
for each row execute function public.set_updated_at();

drop trigger if exists saved_places_enforce_single_default on public.saved_places;
create trigger saved_places_enforce_single_default
before insert or update on public.saved_places
for each row execute function public.enforce_single_default_saved_place();

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

drop trigger if exists trips_validate_assignment on public.trips;
create trigger trips_validate_assignment
before insert or update on public.trips
for each row execute function public.validate_trip_assignment();

drop trigger if exists trips_apply_status_timestamps on public.trips;
create trigger trips_apply_status_timestamps
before insert or update on public.trips
for each row execute function public.apply_trip_status_timestamps();

drop trigger if exists trips_log_status_history on public.trips;
create trigger trips_log_status_history
after insert or update of status on public.trips
for each row execute function public.log_trip_status_history();

drop trigger if exists trip_offers_set_updated_at on public.trip_offers;
create trigger trip_offers_set_updated_at
before update on public.trip_offers
for each row execute function public.set_updated_at();

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

drop trigger if exists admin_announcements_set_updated_at on public.admin_announcements;
create trigger admin_announcements_set_updated_at
before update on public.admin_announcements
for each row execute function public.set_updated_at();

drop trigger if exists notifications_protect_updates on public.notifications;
create trigger notifications_protect_updates
before update on public.notifications
for each row execute function public.protect_notification_updates();
