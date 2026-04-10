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
        -- Treat "busy" as the only non-operational state.
        if coalesce(v_driver.availability_status, 'available') = 'busy' then
            raise exception 'Driver is not operationally available';
        end if;

        -- Direct admin assignment can bypass "is_accepting_offers" toggle.
        if v_offer.offered_by_admin_id is null
           and v_driver.is_accepting_offers is distinct from true then
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
