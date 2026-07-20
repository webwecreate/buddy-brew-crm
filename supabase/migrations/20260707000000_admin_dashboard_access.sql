-- Admin Dashboard v1 (Overview + สมาชิก): let logged-in staff/admin (role `authenticated`,
-- from the staff-login just shipped) read members + points_transactions directly via
-- PostgREST, instead of writing a new Edge Function for every read.
-- Same two-layer rule as always (see learning.md #6): grant = can touch table, policy = which rows.

grant select on table members to authenticated;
create policy "authenticated can read members" on members
  for select to authenticated using (true);

grant select on table points_transactions to authenticated;
create policy "authenticated can read points_transactions" on points_transactions
  for select to authenticated using (true);

-- Staff can edit their own notes/photo link on a member directly, but NOT point/tier —
-- column-level grant restricts the UPDATE to just these two columns regardless of RLS.
grant update (staff_photo_url, staff_note) on members to authenticated;
create policy "authenticated can update staff fields" on members
  for update to authenticated using (true) with check (true);

-- Manual point adjustment must stay atomic + go through the ledger (points_transactions),
-- same shape as claim_order_token() in 20260706030000_claim_order_token_function.sql.
-- trg_update_member_tier (20260706060000) fires on the point update, so tier stays in sync.
create or replace function manual_adjust_points(p_member_id uuid, p_delta integer, p_reason text)
returns jsonb
language plpgsql
security definer
as $$
begin
  update members set point = point + p_delta where id = p_member_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'member not found');
  end if;

  insert into points_transactions (member_id, point_change, reason)
  values (p_member_id, p_delta, 'manual_adjustment: ' || coalesce(p_reason, ''));

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function manual_adjust_points(uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';
