create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
    if not exists (select 1 from pg_type where typname = 'user_role') then
        create type public.user_role as enum ('customer', 'driver', 'admin');
    end if;
    if not exists (select 1 from pg_type where typname = 'account_status') then
        create type public.account_status as enum ('active', 'pending', 'suspended', 'disabled');
    end if;
    if not exists (select 1 from pg_type where typname = 'vehicle_type') then
        create type public.vehicle_type as enum ('car', 'tuk_tuk');
    end if;
    if not exists (select 1 from pg_type where typname = 'driver_availability_status') then
        create type public.driver_availability_status as enum ('offline', 'online', 'busy');
    end if;
    if not exists (select 1 from pg_type where typname = 'approval_status') then
        create type public.approval_status as enum ('pending', 'approved', 'rejected', 'requires_review', 'suspended');
    end if;
    if not exists (select 1 from pg_type where typname = 'driver_document_type') then
        create type public.driver_document_type as enum (
            'profile_photo',
            'national_id',
            'driver_license',
            'vehicle_license',
            'vehicle_photo',
            'criminal_record',
            'other'
        );
    end if;
    if not exists (select 1 from pg_type where typname = 'saved_place_type') then
        create type public.saved_place_type as enum ('home', 'work', 'other');
    end if;
end $$;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role public.user_role not null default 'customer',
    account_status public.account_status not null default 'active',
    full_name text,
    display_name text,
    email citext,
    phone text,
    avatar_bucket text,
    avatar_path text,
    preferred_language text not null default 'ar-EG',
    profile_completed_at timestamptz,
    last_login_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint profiles_email_or_phone_check check (email is not null or phone is not null)
);

create unique index if not exists profiles_email_unique_idx
    on public.profiles (email)
    where email is not null;

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_account_status_idx on public.profiles (account_status);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

create table if not exists public.driver_profiles (
    id uuid primary key references public.profiles(id) on delete cascade,
    application_status public.approval_status not null default 'pending',
    verification_status public.approval_status not null default 'pending',
    availability_status public.driver_availability_status not null default 'offline',
    is_accepting_offers boolean not null default false,
    national_id text not null,
    working_city text not null,
    working_area text,
    operational_notes text,
    suspension_reason text,
    approved_at timestamptz,
    approved_by uuid references public.profiles(id),
    suspended_at timestamptz,
    suspended_by uuid references public.profiles(id),
    last_seen_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint driver_profiles_national_id_check check (char_length(trim(national_id)) >= 8)
);

create unique index if not exists driver_profiles_national_id_unique_idx
    on public.driver_profiles (lower(trim(national_id)));

create index if not exists driver_profiles_application_status_idx
    on public.driver_profiles (application_status);

create index if not exists driver_profiles_verification_status_idx
    on public.driver_profiles (verification_status);

create index if not exists driver_profiles_availability_status_idx
    on public.driver_profiles (availability_status);

create index if not exists driver_profiles_city_area_idx
    on public.driver_profiles (working_city, working_area);

create table if not exists public.vehicles (
    id uuid primary key default gen_random_uuid(),
    driver_id uuid not null references public.driver_profiles(id) on delete cascade,
    vehicle_type public.vehicle_type not null,
    brand text not null,
    model text not null,
    color text not null,
    manufacturing_year integer not null,
    plate_number text,
    seat_count integer,
    operating_area text,
    condition_notes text,
    approval_status public.approval_status not null default 'pending',
    approval_notes text,
    approved_at timestamptz,
    approved_by uuid references public.profiles(id),
    is_primary boolean not null default false,
    is_active boolean not null default true,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint vehicles_year_check check (
        manufacturing_year between 1970 and extract(year from timezone('utc', now()))::integer + 1
    ),
    constraint vehicles_plate_required_check check (
        (vehicle_type = 'car' and plate_number is not null and char_length(trim(plate_number)) >= 4)
        or vehicle_type = 'tuk_tuk'
    ),
    constraint vehicles_seat_count_check check (
        (vehicle_type = 'car' and seat_count between 1 and 12)
        or (vehicle_type = 'tuk_tuk' and seat_count is null)
    )
);

create unique index if not exists vehicles_primary_active_unique_idx
    on public.vehicles (driver_id)
    where is_primary and is_active;

create unique index if not exists vehicles_plate_number_unique_idx
    on public.vehicles (lower(trim(plate_number)))
    where plate_number is not null;

create index if not exists vehicles_driver_idx on public.vehicles (driver_id);
create index if not exists vehicles_type_idx on public.vehicles (vehicle_type);
create index if not exists vehicles_approval_status_idx on public.vehicles (approval_status);
create index if not exists vehicles_created_at_idx on public.vehicles (created_at desc);

create table if not exists public.driver_documents (
    id uuid primary key default gen_random_uuid(),
    driver_id uuid not null references public.driver_profiles(id) on delete cascade,
    vehicle_id uuid references public.vehicles(id) on delete cascade,
    document_type public.driver_document_type not null,
    storage_bucket text not null,
    storage_path text not null,
    file_name text,
    mime_type text,
    file_size_bytes bigint,
    approval_status public.approval_status not null default 'pending',
    review_notes text,
    reviewed_at timestamptz,
    reviewed_by uuid references public.profiles(id),
    expires_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint driver_documents_size_check check (file_size_bytes is null or file_size_bytes > 0),
    constraint driver_documents_vehicle_scope_check check (
        (document_type in ('vehicle_license', 'vehicle_photo') and vehicle_id is not null)
        or (document_type not in ('vehicle_license', 'vehicle_photo'))
    )
);

create unique index if not exists driver_documents_storage_path_unique_idx
    on public.driver_documents (storage_bucket, storage_path);

create index if not exists driver_documents_driver_idx on public.driver_documents (driver_id);
create index if not exists driver_documents_vehicle_idx on public.driver_documents (vehicle_id);
create index if not exists driver_documents_type_idx on public.driver_documents (document_type);
create index if not exists driver_documents_approval_status_idx on public.driver_documents (approval_status);

create table if not exists public.saved_places (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    place_type public.saved_place_type not null default 'other',
    label text not null,
    address_text text not null,
    latitude double precision,
    longitude double precision,
    city text,
    area text,
    is_default boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint saved_places_coordinates_check check (
        (latitude is null and longitude is null)
        or (
            latitude between -90 and 90
            and longitude between -180 and 180
        )
    )
);

create unique index if not exists saved_places_default_per_type_unique_idx
    on public.saved_places (user_id, place_type)
    where is_default;

create index if not exists saved_places_user_idx on public.saved_places (user_id);
create index if not exists saved_places_created_at_idx on public.saved_places (created_at desc);
