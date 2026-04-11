begin;

create or replace function public.recompute_driver_operational_availability(p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_driver public.driver_profiles%rowtype;
    v_has_active_trip boolean := false;
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
        set availability_status = 'busy'::public.driver_availability_status,
            last_seen_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        where id = p_driver_id
          and availability_status <> 'busy'::public.driver_availability_status;
        return;
    end if;

    if v_driver.availability_status = 'busy'::public.driver_availability_status then
        update public.driver_profiles
        set availability_status = (
                case
                    when v_driver.application_status = 'approved'
                     and v_driver.verification_status = 'approved'
                     and v_driver.is_accepting_offers = true
                        then 'available'::public.driver_availability_status
                    else 'offline'::public.driver_availability_status
                end
            ),
            last_seen_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        where id = p_driver_id;
    end if;
end;
$$;

commit;
