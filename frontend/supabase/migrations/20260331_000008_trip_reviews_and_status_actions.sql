create table if not exists public.trip_reviews (
    id uuid primary key default gen_random_uuid(),
    trip_id uuid not null references public.trips(id) on delete cascade,
    customer_id uuid not null references public.profiles(id) on delete cascade,
    driver_id uuid not null references public.driver_profiles(id) on delete cascade,
    rating smallint not null check (rating between 1 and 5),
    comment text null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (trip_id),
    unique (trip_id, customer_id)
);

create index if not exists trip_reviews_driver_id_idx on public.trip_reviews(driver_id);
create index if not exists trip_reviews_customer_id_idx on public.trip_reviews(customer_id);
create index if not exists trip_reviews_trip_id_idx on public.trip_reviews(trip_id);

alter table public.trip_reviews enable row level security;

drop policy if exists trip_reviews_customer_select on public.trip_reviews;
create policy trip_reviews_customer_select
on public.trip_reviews
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists trip_reviews_driver_select on public.trip_reviews;
create policy trip_reviews_driver_select
on public.trip_reviews
for select
to authenticated
using (driver_id = auth.uid());

drop policy if exists trip_reviews_admin_select on public.trip_reviews;
create policy trip_reviews_admin_select
on public.trip_reviews
for select
to authenticated
using (public.is_admin());

drop policy if exists trip_reviews_customer_insert on public.trip_reviews;
create policy trip_reviews_customer_insert
on public.trip_reviews
for insert
to authenticated
with check (customer_id = auth.uid());

drop policy if exists trip_reviews_customer_update on public.trip_reviews;
create policy trip_reviews_customer_update
on public.trip_reviews
for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

drop policy if exists trip_reviews_admin_update on public.trip_reviews;
create policy trip_reviews_admin_update
on public.trip_reviews
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
