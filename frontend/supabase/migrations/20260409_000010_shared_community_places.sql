create table if not exists public.community_places (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    address_text text not null,
    latitude double precision not null,
    longitude double precision not null,
    city text,
    area text,
    usage_count integer not null default 1,
    source text not null default 'user_created',
    search_key text not null,
    phonetic_key text not null,
    created_by uuid references public.profiles(id) on delete set null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint community_places_coordinates_check check (
        latitude between -90 and 90
        and longitude between -180 and 180
    ),
    constraint community_places_usage_count_check check (usage_count >= 1),
    constraint community_places_name_check check (char_length(trim(name)) >= 3)
);

create index if not exists community_places_usage_idx
    on public.community_places (usage_count desc, updated_at desc);

create index if not exists community_places_search_key_idx
    on public.community_places (search_key);

create index if not exists community_places_phonetic_key_idx
    on public.community_places (phonetic_key);

create index if not exists community_places_coordinates_idx
    on public.community_places (latitude, longitude);

create index if not exists community_places_created_by_idx
    on public.community_places (created_by);

alter table public.community_places enable row level security;

drop policy if exists community_places_shared_select on public.community_places;
create policy community_places_shared_select
on public.community_places
for select
to authenticated
using (true);

drop policy if exists community_places_shared_insert on public.community_places;
create policy community_places_shared_insert
on public.community_places
for insert
to authenticated
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists community_places_shared_update on public.community_places;
create policy community_places_shared_update
on public.community_places
for update
to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());
