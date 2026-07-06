-- Atomic claim: validate token, credit points, insert ledger row — all in one transaction.
-- ป้องกันการเคลมซ้ำ (race condition) ด้วย "update ... where status='pending'" แบบอะตอมมิก
create or replace function claim_order_token(p_token text, p_member_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_token_row order_claim_tokens%rowtype;
begin
  update order_claim_tokens
  set status = 'claimed', claimed_by = p_member_id, claimed_at = now()
  where token = p_token and status = 'pending' and expires_at > now()
  returning * into v_token_row;

  if not found then
    return jsonb_build_object('success', false, 'error', 'token invalid, already claimed, or expired');
  end if;

  insert into points_transactions (member_id, point_change, menu_item_id, bean_option_id, channel, created_at)
  values (p_member_id, v_token_row.point_value, v_token_row.menu_item_id, v_token_row.bean_option_id, v_token_row.channel, now());

  update members set point = point + v_token_row.point_value where id = p_member_id;

  return jsonb_build_object('success', true, 'point_awarded', v_token_row.point_value);
end;
$$;

grant execute on function claim_order_token(text, uuid) to service_role;
