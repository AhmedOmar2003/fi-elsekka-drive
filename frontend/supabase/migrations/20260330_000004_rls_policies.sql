alter table public.profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.driver_documents enable row level security;
alter table public.saved_places enable row level security;
alter table public.trips enable row level security;
alter table public.trip_offers enable row level security;
alter table public.trip_status_history enable row level security;
alter table public.notifications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.admin_announcements enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
on public.profiles
for select
to authenticated
using (
    id = auth.uid()
    or public.is_admin()
    or exists (
        select 1
        from public.trips t
        where (
            (t.customer_id = auth.uid() and t.assigned_driver_id = public.profiles.id)
            or (t.assigned_driver_id = auth.uid() and t.customer_id = public.profiles.id)
        )
          and t.status in ('accepted', 'driver_on_the_way', 'driver_arrived', 'trip_started', 'completed')
    )
);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert
on public.profiles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete
on public.profiles
for delete
to authenticated
using (public.is_admin());

drop policy if exists driver_profiles_own_select on public.driver_profiles;
create policy driver_profiles_own_select
on public.driver_profiles
for select
to authenticated
using (
    id = auth.uid()
    or public.is_admin()
    or exists (
        select 1
        from public.trips t
        where t.customer_id = auth.uid()
          and t.assigned_driver_id = public.driver_profiles.id
          and t.status in ('accepted', 'driver_on_the_way', 'driver_arrived', 'trip_started', 'completed')
    )
);

drop policy if exists driver_profiles_own_insert on public.driver_profiles;
create policy driver_profiles_own_insert
on public.driver_profiles
for insert
to authenticated
with check (id = auth.uid() or public.is_admin());

drop policy if exists driver_profiles_own_update on public.driver_profiles;
create policy driver_profiles_own_update
on public.driver_profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists vehicles_access_policy on public.vehicles;
create policy vehicles_access_policy
on public.vehicles
for select
to authenticated
using (
    driver_id = auth.uid()
    or public.is_admin()
    or exists (
        select 1
        from public.trips t
        where t.customer_id = auth.uid()
          and t.assigned_vehicle_id = public.vehicles.id
          and t.status in ('accepted', 'driver_on_the_way', 'driver_arrived', 'trip_started', 'completed')
    )
);

drop policy if exists vehicles_own_insert on public.vehicles;
create policy vehicles_own_insert
on public.vehicles
for insert
to authenticated
with check (driver_id = auth.uid() or public.is_admin());

drop policy if exists vehicles_own_update on public.vehicles;
create policy vehicles_own_update
on public.vehicles
for update
to authenticated
using (driver_id = auth.uid() or public.is_admin())
with check (driver_id = auth.uid() or public.is_admin());

drop policy if exists vehicles_own_delete on public.vehicles;
create policy vehicles_own_delete
on public.vehicles
for delete
to authenticated
using (driver_id = auth.uid() or public.is_admin());

drop policy if exists driver_documents_access_policy on public.driver_documents;
create policy driver_documents_access_policy
on public.driver_documents
for select
to authenticated
using (driver_id = auth.uid() or public.is_admin());

drop policy if exists driver_documents_own_insert on public.driver_documents;
create policy driver_documents_own_insert
on public.driver_documents
for insert
to authenticated
with check (driver_id = auth.uid() or public.is_admin());

drop policy if exists driver_documents_own_update on public.driver_documents;
create policy driver_documents_own_update
on public.driver_documents
for update
to authenticated
using (driver_id = auth.uid() or public.is_admin())
with check (driver_id = auth.uid() or public.is_admin());

drop policy if exists driver_documents_own_delete on public.driver_documents;
create policy driver_documents_own_delete
on public.driver_documents
for delete
to authenticated
using (driver_id = auth.uid() or public.is_admin());

drop policy if exists saved_places_own_select on public.saved_places;
create policy saved_places_own_select
on public.saved_places
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists saved_places_own_insert on public.saved_places;
create policy saved_places_own_insert
on public.saved_places
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists saved_places_own_update on public.saved_places;
create policy saved_places_own_update
on public.saved_places
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists saved_places_own_delete on public.saved_places;
create policy saved_places_own_delete
on public.saved_places
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists trips_customer_or_driver_select on public.trips;
create policy trips_customer_or_driver_select
on public.trips
for select
to authenticated
using (
    customer_id = auth.uid()
    or assigned_driver_id = auth.uid()
    or public.is_admin()
    or exists (
        select 1
        from public.trip_offers o
        where o.trip_id = public.trips.id
          and o.driver_id = auth.uid()
    )
);

drop policy if exists trips_customer_insert on public.trips;
create policy trips_customer_insert
on public.trips
for insert
to authenticated
with check (customer_id = auth.uid() or public.is_admin());

drop policy if exists trips_admin_update on public.trips;
create policy trips_admin_update
on public.trips
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists trips_admin_delete on public.trips;
create policy trips_admin_delete
on public.trips
for delete
to authenticated
using (public.is_admin());

drop policy if exists trip_offers_driver_select on public.trip_offers;
create policy trip_offers_driver_select
on public.trip_offers
for select
to authenticated
using (
    driver_id = auth.uid()
    or public.is_admin()
    or exists (
        select 1
        from public.trips t
        where t.id = public.trip_offers.trip_id
          and t.customer_id = auth.uid()
          and public.trip_offers.offer_status = 'accepted'
    )
);

drop policy if exists trip_offers_admin_insert on public.trip_offers;
create policy trip_offers_admin_insert
on public.trip_offers
for insert
to authenticated
with check (public.is_admin());

drop policy if exists trip_offers_admin_update on public.trip_offers;
create policy trip_offers_admin_update
on public.trip_offers
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists trip_offers_admin_delete on public.trip_offers;
create policy trip_offers_admin_delete
on public.trip_offers
for delete
to authenticated
using (public.is_admin());

drop policy if exists trip_status_history_trip_access on public.trip_status_history;
create policy trip_status_history_trip_access
on public.trip_status_history
for select
to authenticated
using (
    public.is_admin()
    or exists (
        select 1
        from public.trips t
        where t.id = public.trip_status_history.trip_id
          and (
              t.customer_id = auth.uid()
              or t.assigned_driver_id = auth.uid()
          )
    )
    or exists (
        select 1
        from public.trip_offers o
        where o.trip_id = public.trip_status_history.trip_id
          and o.driver_id = auth.uid()
    )
);

drop policy if exists trip_status_history_admin_insert on public.trip_status_history;
create policy trip_status_history_admin_insert
on public.trip_status_history
for insert
to authenticated
with check (public.is_admin());

drop policy if exists notifications_own_select on public.notifications;
create policy notifications_own_select
on public.notifications
for select
to authenticated
using (recipient_user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update
on public.notifications
for update
to authenticated
using (recipient_user_id = auth.uid() or public.is_admin())
with check (recipient_user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert
on public.notifications
for insert
to authenticated
with check (public.is_admin());

drop policy if exists support_tickets_owner_select on public.support_tickets;
create policy support_tickets_owner_select
on public.support_tickets
for select
to authenticated
using (created_by = auth.uid() or public.is_admin());

drop policy if exists support_tickets_owner_insert on public.support_tickets;
create policy support_tickets_owner_insert
on public.support_tickets
for insert
to authenticated
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists support_tickets_admin_update on public.support_tickets;
create policy support_tickets_admin_update
on public.support_tickets
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists support_ticket_messages_access on public.support_ticket_messages;
create policy support_ticket_messages_access
on public.support_ticket_messages
for select
to authenticated
using (
    public.is_admin()
    or (
        not is_internal
        and exists (
            select 1
            from public.support_tickets t
            where t.id = public.support_ticket_messages.ticket_id
              and t.created_by = auth.uid()
        )
    )
);

drop policy if exists support_ticket_messages_owner_insert on public.support_ticket_messages;
create policy support_ticket_messages_owner_insert
on public.support_ticket_messages
for insert
to authenticated
with check (
    public.is_admin()
    or (
        sender_user_id = auth.uid()
        and is_internal = false
        and exists (
            select 1
            from public.support_tickets t
            where t.id = public.support_ticket_messages.ticket_id
              and t.created_by = auth.uid()
        )
    )
);

drop policy if exists admin_announcements_active_read on public.admin_announcements;
create policy admin_announcements_active_read
on public.admin_announcements
for select
to authenticated
using (
    public.is_admin()
    or (
        is_active = true
        and coalesce(starts_at, timezone('utc', now())) <= timezone('utc', now())
        and coalesce(ends_at, timezone('utc', now()) + interval '100 years') >= timezone('utc', now())
        and exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and (
                  public.admin_announcements.audience = 'all'
                  or (public.admin_announcements.audience = 'customers' and p.role = 'customer')
                  or (public.admin_announcements.audience = 'drivers' and p.role = 'driver')
                  or (public.admin_announcements.audience = 'admins' and p.role = 'admin')
              )
        )
    )
);

drop policy if exists admin_announcements_admin_insert on public.admin_announcements;
create policy admin_announcements_admin_insert
on public.admin_announcements
for insert
to authenticated
with check (public.is_admin());

drop policy if exists admin_announcements_admin_update on public.admin_announcements;
create policy admin_announcements_admin_update
on public.admin_announcements
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists admin_announcements_admin_delete on public.admin_announcements;
create policy admin_announcements_admin_delete
on public.admin_announcements
for delete
to authenticated
using (public.is_admin());

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read
on public.audit_logs
for select
to authenticated
using (public.is_admin());
