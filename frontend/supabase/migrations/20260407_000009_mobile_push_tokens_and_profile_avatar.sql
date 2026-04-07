create extension if not exists pgcrypto;

alter table public.profiles
    add column if not exists avatar_path text;

alter table public.driver_profiles
    add column if not exists avatar_path text;

create table if not exists public.mobile_push_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    token text not null,
    platform text not null check (platform in ('android', 'ios')),
    provider text not null check (provider in ('fcm', 'apns')),
    is_active boolean not null default true,
    last_seen_at timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists mobile_push_tokens_token_key
    on public.mobile_push_tokens (token);

create index if not exists mobile_push_tokens_user_id_idx
    on public.mobile_push_tokens (user_id, is_active);

alter table public.mobile_push_tokens enable row level security;

drop policy if exists mobile_push_tokens_own_select on public.mobile_push_tokens;
create policy mobile_push_tokens_own_select
on public.mobile_push_tokens
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists mobile_push_tokens_own_insert on public.mobile_push_tokens;
create policy mobile_push_tokens_own_insert
on public.mobile_push_tokens
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists mobile_push_tokens_own_update on public.mobile_push_tokens;
create policy mobile_push_tokens_own_update
on public.mobile_push_tokens
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists mobile_push_tokens_own_delete on public.mobile_push_tokens;
create policy mobile_push_tokens_own_delete
on public.mobile_push_tokens
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());
