-- Storage bucket for staff-uploaded member photos (members.staff_photo_url).
-- Public read: the URL itself is never exposed to the customer-facing app
-- (create-or-get-member only selects id/display_name/picture_url/tier/point/created_at,
-- never staff_photo_url), so a public bucket is fine — upload/replace stays staff-only.

insert into storage.buckets (id, name, public)
values ('member-photos', 'member-photos', true)
on conflict (id) do nothing;

create policy "authenticated can upload member photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'member-photos');

create policy "authenticated can replace member photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'member-photos');

create policy "public can view member photos" on storage.objects
  for select to public
  using (bucket_id = 'member-photos');
