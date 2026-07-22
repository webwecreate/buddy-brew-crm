-- Reward Engine: seed badge definitions + auto-unlock trigger.
-- Only the badges computable from data we already have (see PROJECT_OVERVIEW.md §7 brainstorm
-- table) — "Rain Hunter" is deliberately excluded, it needs a weather API or a manual staff
-- toggle ("วันนี้ฝนตก" checkbox), neither of which exists yet.

insert into badges (name, condition, icon) values
  ('Espresso Lover', 'ซื้อ Espresso ครบ 20 แก้ว', 'ti-coffee'),
  ('Latte Master', 'ซื้อ Latte ครบ 30 แก้ว', 'ti-coffee'),
  ('Matcha Fan', 'ซื้อเมนู Matcha ครบ 20 แก้ว', 'ti-leaf'),
  ('Early Bird', 'ซื้อก่อน 9 โมงเช้า ครบ 15 ครั้ง', 'ti-sunrise'),
  ('Night Owl', 'ซื้อหลังสองทุ่ม ครบ 20 ครั้ง', 'ti-moon-stars'),
  ('Buddy Friend', 'เป็นสมาชิกครบ 1 ปี', 'ti-heart');

-- Fires after every real purchase (menu_item_id is set — skips manual point adjustments,
-- birthday bonuses, etc. which shouldn't count toward "buy N drinks" badges).
-- security definer: same reasoning as claim_order_token()/manual_adjust_points() — the
-- triggering INSERT already runs inside one of those SECURITY DEFINER functions, but this
-- makes the trigger's own privileges explicit rather than relying on that inherited context.
create or replace function check_badge_unlocks()
returns trigger
language plpgsql
security definer
as $$
declare
  v_count integer;
  v_badge_id uuid;
begin
  if new.menu_item_id is null then
    return new;
  end if;

  select count(*) into v_count from points_transactions pt
    join menu_items mi on mi.id = pt.menu_item_id
    where pt.member_id = new.member_id and mi.name = 'Espresso';
  if v_count >= 20 then
    select id into v_badge_id from badges where name = 'Espresso Lover';
    insert into badges_earned (member_id, badge_id) values (new.member_id, v_badge_id) on conflict (member_id, badge_id) do nothing;
  end if;

  select count(*) into v_count from points_transactions pt
    join menu_items mi on mi.id = pt.menu_item_id
    where pt.member_id = new.member_id and mi.name = 'Latte';
  if v_count >= 30 then
    select id into v_badge_id from badges where name = 'Latte Master';
    insert into badges_earned (member_id, badge_id) values (new.member_id, v_badge_id) on conflict (member_id, badge_id) do nothing;
  end if;

  select count(*) into v_count from points_transactions pt
    join menu_items mi on mi.id = pt.menu_item_id
    where pt.member_id = new.member_id and mi.category = 'matcha';
  if v_count >= 20 then
    select id into v_badge_id from badges where name = 'Matcha Fan';
    insert into badges_earned (member_id, badge_id) values (new.member_id, v_badge_id) on conflict (member_id, badge_id) do nothing;
  end if;

  if extract(hour from new.created_at) < 9 then
    select count(*) into v_count from points_transactions
      where member_id = new.member_id and menu_item_id is not null and extract(hour from created_at) < 9;
    if v_count >= 15 then
      select id into v_badge_id from badges where name = 'Early Bird';
      insert into badges_earned (member_id, badge_id) values (new.member_id, v_badge_id) on conflict (member_id, badge_id) do nothing;
    end if;
  end if;

  if extract(hour from new.created_at) >= 20 then
    select count(*) into v_count from points_transactions
      where member_id = new.member_id and menu_item_id is not null and extract(hour from created_at) >= 20;
    if v_count >= 20 then
      select id into v_badge_id from badges where name = 'Night Owl';
      insert into badges_earned (member_id, badge_id) values (new.member_id, v_badge_id) on conflict (member_id, badge_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_check_badge_unlocks
after insert on points_transactions
for each row
execute function check_badge_unlocks();

-- "Buddy Friend" (1-year anniversary) isn't tied to any transaction event, so it can't fire
-- from this trigger — it's checked lazily instead, in get-member-history, whenever a member
-- opens Buddy Book (see supabase/functions/get-member-history/index.ts).

notify pgrst, 'reload schema';
