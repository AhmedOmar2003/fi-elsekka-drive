insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('profile-images', 'profile-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
    ('driver-documents', 'driver-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('vehicle-files', 'vehicle-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('support-attachments', 'support-attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_images_public_read on storage.objects;
create policy profile_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'profile-images');

drop policy if exists profile_images_owner_insert on storage.objects;
create policy profile_images_owner_insert
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'profile-images'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists profile_images_owner_update on storage.objects;
create policy profile_images_owner_update
on storage.objects
for update
to authenticated
using (
    bucket_id = 'profile-images'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
)
with check (
    bucket_id = 'profile-images'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists profile_images_owner_delete on storage.objects;
create policy profile_images_owner_delete
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'profile-images'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists private_driver_documents_owner_read on storage.objects;
create policy private_driver_documents_owner_read
on storage.objects
for select
to authenticated
using (
    bucket_id = 'driver-documents'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists private_driver_documents_owner_insert on storage.objects;
create policy private_driver_documents_owner_insert
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'driver-documents'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists private_driver_documents_owner_update on storage.objects;
create policy private_driver_documents_owner_update
on storage.objects
for update
to authenticated
using (
    bucket_id = 'driver-documents'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
)
with check (
    bucket_id = 'driver-documents'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists private_driver_documents_owner_delete on storage.objects;
create policy private_driver_documents_owner_delete
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'driver-documents'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists private_vehicle_files_owner_read on storage.objects;
create policy private_vehicle_files_owner_read
on storage.objects
for select
to authenticated
using (
    bucket_id = 'vehicle-files'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists private_vehicle_files_owner_insert on storage.objects;
create policy private_vehicle_files_owner_insert
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'vehicle-files'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists private_vehicle_files_owner_update on storage.objects;
create policy private_vehicle_files_owner_update
on storage.objects
for update
to authenticated
using (
    bucket_id = 'vehicle-files'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
)
with check (
    bucket_id = 'vehicle-files'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists private_vehicle_files_owner_delete on storage.objects;
create policy private_vehicle_files_owner_delete
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'vehicle-files'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists support_attachments_owner_read on storage.objects;
create policy support_attachments_owner_read
on storage.objects
for select
to authenticated
using (
    bucket_id = 'support-attachments'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists support_attachments_owner_insert on storage.objects;
create policy support_attachments_owner_insert
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'support-attachments'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists support_attachments_owner_update on storage.objects;
create policy support_attachments_owner_update
on storage.objects
for update
to authenticated
using (
    bucket_id = 'support-attachments'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
)
with check (
    bucket_id = 'support-attachments'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);

drop policy if exists support_attachments_owner_delete on storage.objects;
create policy support_attachments_owner_delete
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'support-attachments'
    and (
        public.is_admin()
        or (storage.foldername(name))[1] = auth.uid()::text
    )
);
