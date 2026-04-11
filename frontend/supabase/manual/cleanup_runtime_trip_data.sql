-- ============================================================
-- Runtime Trip Data Cleanup (DATA ONLY, NO SCHEMA CHANGES)
-- Project: Waslni / fi-elsekka
--
-- Safe scope:
-- - Removes runtime/testing trip data only
-- - Keeps schema, relations, RLS, auth config, buckets structure
-- - Keeps users/profiles unless you add separate user cleanup
--
-- Run in Supabase SQL Editor when infra is stable.
-- ============================================================

-- ============================================================
-- 1) DRY RUN (preview only, no delete)
-- ============================================================
with trip_ids as (
    select id
    from public.trips
)
select
    (select count(*) from trip_ids) as trips,
    (select count(*) from public.trip_offers o where o.trip_id in (select id from trip_ids)) as trip_offers,
    (select count(*) from public.trip_status_history h where h.trip_id in (select id from trip_ids)) as trip_status_history,
    (select count(*) from public.trip_reviews r where r.trip_id in (select id from trip_ids)) as trip_reviews,
    (
        select count(*)
        from public.support_tickets s
        where s.trip_id in (select id from trip_ids)
    ) as support_tickets,
    (
        select count(*)
        from public.support_ticket_messages m
        where m.ticket_id in (
            select s.id
            from public.support_tickets s
            where s.trip_id in (select id from trip_ids)
        )
    ) as support_ticket_messages,
    (
        select count(*)
        from public.notifications n
        where
            n.related_trip_id in (select id from trip_ids)
            or exists (
                select 1
                from trip_ids t
                where t.id::text = n.payload->>'trip_id'
            )
    ) as notifications_linked_to_trips;


-- ============================================================
-- 2) EXECUTE CLEANUP (uncomment and run when ready)
-- ============================================================
/*
begin;

create temporary table if not exists _tmp_cleanup_trip_ids on commit drop as
select id
from public.trips;

with deleted_notifications as (
    delete from public.notifications n
    where
        n.related_trip_id in (select id from _tmp_cleanup_trip_ids)
        or exists (
            select 1
            from _tmp_cleanup_trip_ids t
            where t.id::text = n.payload->>'trip_id'
        )
    returning 1
),
deleted_support_tickets as (
    -- support_ticket_messages will cascade via FK (on delete cascade)
    delete from public.support_tickets s
    where s.trip_id in (select id from _tmp_cleanup_trip_ids)
    returning 1
),
deleted_trips as (
    -- trip_offers / trip_status_history / trip_reviews cascade via FK
    delete from public.trips tr
    where tr.id in (select id from _tmp_cleanup_trip_ids)
    returning 1
)
select
    (select count(*) from _tmp_cleanup_trip_ids) as deleted_trips_total,
    (select count(*) from deleted_notifications) as deleted_notifications,
    (select count(*) from deleted_support_tickets) as deleted_support_tickets,
    (select count(*) from deleted_trips) as deleted_trips;

commit;
*/


-- ============================================================
-- Optional: post-check
-- ============================================================
-- select count(*) as remaining_trips from public.trips;
-- select count(*) as remaining_trip_offers from public.trip_offers;
-- select count(*) as remaining_trip_status_history from public.trip_status_history;
-- select count(*) as remaining_trip_reviews from public.trip_reviews;
