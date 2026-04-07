-- Run this once in Supabase SQL Editor to create the fixed super admin account.
-- Email: admin@drive.com
-- Password: drive1
--
-- Important:
-- The password is stored safely as a hash in auth.users.
-- Do not store plain text passwords in public tables.

create extension if not exists pgcrypto;

do $$
declare
    admin_email constant text := 'admin@drive.com';
    admin_password constant text := 'drive1';
    admin_full_name constant text := 'Drive Super Admin';
    admin_username constant text := 'drive-super-admin';
    admin_user_id uuid;
    has_profiles_guard_trigger boolean := false;
begin
    select id
    into admin_user_id
    from auth.users
    where email = admin_email
    limit 1;

    if admin_user_id is null then
        admin_user_id := gen_random_uuid();

        insert into auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token,
            is_sso_user,
            is_anonymous
        )
        values (
            '00000000-0000-0000-0000-000000000000',
            admin_user_id,
            'authenticated',
            'authenticated',
            admin_email,
            crypt(admin_password, gen_salt('bf')),
            timezone('utc', now()),
            jsonb_build_object(
                'provider', 'email',
                'providers', array['email']
            ),
            jsonb_build_object(
                'full_name', admin_full_name,
                'username', admin_username,
                'role', 'super_admin',
                'permissions', jsonb_build_array(
                    'view_orders',
                    'update_order_status',
                    'assign_driver',
                    'view_drivers',
                    'manage_products',
                    'manage_categories',
                    'manage_offers',
                    'manage_discounts',
                    'manage_users',
                    'manage_admins',
                    'manage_settings',
                    'view_reports'
                )
            ),
            timezone('utc', now()),
            timezone('utc', now()),
            '',
            '',
            '',
            '',
            false,
            false
        );
    else
        update auth.users
        set
            email = admin_email,
            encrypted_password = crypt(admin_password, gen_salt('bf')),
            email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
            raw_app_meta_data = jsonb_build_object(
                'provider', 'email',
                'providers', array['email']
            ),
            raw_user_meta_data = jsonb_build_object(
                'full_name', admin_full_name,
                'username', admin_username,
                'role', 'super_admin',
                'permissions', jsonb_build_array(
                    'view_orders',
                    'update_order_status',
                    'assign_driver',
                    'view_drivers',
                    'manage_products',
                    'manage_categories',
                    'manage_offers',
                    'manage_discounts',
                    'manage_users',
                    'manage_admins',
                    'manage_settings',
                    'view_reports'
                )
            ),
            updated_at = timezone('utc', now())
        where id = admin_user_id;
    end if;

    if to_regclass('public.users') is not null then
        insert into public.users (
            id,
            full_name,
            username,
            email,
            role,
            permissions,
            disabled,
            must_change_password
        )
        values (
            admin_user_id,
            admin_full_name,
            admin_username,
            admin_email,
            'super_admin',
            array[
                'view_orders',
                'update_order_status',
                'assign_driver',
                'view_drivers',
                'manage_products',
                'manage_categories',
                'manage_offers',
                'manage_discounts',
                'manage_users',
                'manage_admins',
                'manage_settings',
                'view_reports'
            ]::text[],
            false,
            false
        )
        on conflict (id) do update
        set
            full_name = excluded.full_name,
            username = excluded.username,
            email = excluded.email,
            role = excluded.role,
            permissions = excluded.permissions,
            disabled = false,
            must_change_password = false;
    end if;

    select exists (
        select 1
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'profiles'
          and t.tgname = 'profiles_protect_privileged_fields'
          and not t.tgisinternal
    )
    into has_profiles_guard_trigger;

    if has_profiles_guard_trigger then
        execute 'alter table public.profiles disable trigger profiles_protect_privileged_fields';
    end if;

    insert into public.profiles (
        id,
        full_name,
        display_name,
        email,
        role,
        account_status
    )
    values (
        admin_user_id,
        admin_full_name,
        'Super Admin',
        admin_email,
        'admin',
        'active'
    )
    on conflict (id) do update
    set
        full_name = excluded.full_name,
        display_name = excluded.display_name,
        email = excluded.email,
        role = excluded.role,
        account_status = excluded.account_status;

    if has_profiles_guard_trigger then
        execute 'alter table public.profiles enable trigger profiles_protect_privileged_fields';
    end if;
end $$;
