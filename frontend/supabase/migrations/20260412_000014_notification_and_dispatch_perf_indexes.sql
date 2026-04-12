-- Keep notifications and dispatch queries fast under high request volume.
-- Safe data-plane optimization: no schema shape changes, only indexes.

create index if not exists idx_notifications_recipient_unread_created
  on public.notifications (recipient_user_id, is_read, created_at desc);

create index if not exists idx_notifications_related_trip_created
  on public.notifications (related_trip_id, created_at desc)
  where related_trip_id is not null;

create index if not exists idx_trip_status_history_trip_created
  on public.trip_status_history (trip_id, created_at desc);

create index if not exists idx_trip_offers_trip_status_expires
  on public.trip_offers (trip_id, offer_status, expires_at desc);

create index if not exists idx_mobile_push_tokens_user_active_updated
  on public.mobile_push_tokens (user_id, is_active, updated_at desc);
