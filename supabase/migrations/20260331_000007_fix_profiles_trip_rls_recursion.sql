drop policy if exists profiles_self_select on public.profiles;

create policy profiles_self_select
on public.profiles
for select
to authenticated
using (
    id = auth.uid()
    or public.is_admin()
);
