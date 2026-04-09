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
            else null;
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
