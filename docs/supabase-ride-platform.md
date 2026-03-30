# في السكة: Supabase backend foundation

## What was added

- `supabase/migrations/20260330_000001_identity_fleet.sql`
- `supabase/migrations/20260330_000002_trip_operations.sql`
- `supabase/migrations/20260330_000003_functions_and_triggers.sql`
- `supabase/migrations/20260330_000004_rls_policies.sql`
- `supabase/migrations/20260330_000005_storage_buckets.sql`
- `src/lib/ride-backend-types.ts`

## Core model

- `profiles` is the app-level identity table linked `1:1` with `auth.users`.
- `driver_profiles` extends `profiles` for captain onboarding, approval, and live availability.
- `vehicles` stores both cars and tuk-tuks with approval lifecycle and one primary active vehicle per driver.
- `driver_documents` stores private file references for IDs, licenses, vehicle files, and optional criminal records.
- `trips` stores the customer request, routing data, airport-specific fields, prices, timestamps, and lifecycle status.
- `trip_offers` stores every dispatch attempt from admin to drivers.
- `trip_status_history` stores status timeline snapshots.
- `notifications`, `saved_places`, `support_tickets`, `support_ticket_messages`, `admin_announcements`, and `audit_logs` cover the operational side.

## Main RPCs

- `create_trip_request(...)`
- `admin_dispatch_trip_offer(...)`
- `driver_respond_to_trip_offer(...)`
- `update_trip_status(...)`
- `cancel_trip_request(...)`
- `mark_notification_read(...)`
- `set_driver_availability(...)`

## Suggested frontend usage

### Customer creates a ride

```ts
const { data, error } = await supabase.rpc('create_trip_request', {
  p_trip_type: 'airport_ride',
  p_pickup_label: 'مدينة نصر',
  p_pickup_address: 'شارع عباس العقاد',
  p_destination_label: 'مطار القاهرة',
  p_destination_address: 'مطار القاهرة الدولي',
  p_airport_name: 'Cairo International Airport',
  p_airport_ride_mode: 'departure',
  p_flight_time: new Date().toISOString(),
});
```

### Admin dispatches a ride to a driver

Use the service role on the server or an admin-authenticated session:

```ts
const { data, error } = await supabase.rpc('admin_dispatch_trip_offer', {
  p_trip_id: tripId,
  p_driver_id: driverId,
  p_vehicle_id: vehicleId,
  p_expires_in_minutes: 2,
});
```

### Driver accepts or rejects

```ts
const { data, error } = await supabase.rpc('driver_respond_to_trip_offer', {
  p_offer_id: offerId,
  p_accept: true,
});
```

## Storage path convention

- `profile-images/<user-id>/avatar.webp`
- `driver-documents/<user-id>/national-id/front.webp`
- `driver-documents/<user-id>/driver-license/license.pdf`
- `vehicle-files/<user-id>/<vehicle-id>/license.pdf`
- `vehicle-files/<user-id>/<vehicle-id>/photo-1.webp`
- `support-attachments/<user-id>/<ticket-id>/attachment.pdf`

## Important integration notes

- Keep admin dashboards on the server side and use the service role only there.
- For private files, generate signed URLs from a server action or API route.
- Prefer RPCs for trip dispatch, offer response, and trip status transitions instead of raw client-side updates.
- `profiles.role` should be changed to `admin` only from SQL, migration seeds, or secure server tooling.
- Existing frontend code still references legacy ecommerce tables like `users`; migrate those calls to `profiles`, `trips`, and the new RPCs step by step.
