-- Buddy Book โปรโมชั่น tab needs to read promotions directly with the anon key.
-- Same two-layer rule as menu_items/bean_options (20260706040000 + 20260706050000):
-- grant table access AND a real RLS policy, not just one or the other.

grant select on table promotions to anon;
create policy "anon can read promotions" on promotions for select to anon using (true);

notify pgrst, 'reload schema';
