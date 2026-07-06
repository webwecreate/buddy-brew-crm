-- Fix: members.tier ไม่เคยอัปเดตอัตโนมัติตามแต้มสะสม (ตั้งเป็น 'sip' ตอนสมัครแล้วค้าง)
-- Trigger คำนวณ tier ใหม่ทุกครั้งที่ point เปลี่ยน ครอบคลุมทุกทาง (claim_order_token, manual adjustment ในอนาคต)
-- ช่วงแต้ม: Sip 0-99 / Drink 100-299 / Slurpp 300+ (ดู PROJECT_OVERVIEW.md ข้อ 6)

create or replace function update_member_tier()
returns trigger
language plpgsql
as $$
begin
  new.tier := case
    when new.point >= 300 then 'slurpp'
    when new.point >= 100 then 'drink'
    else 'sip'
  end;
  return new;
end;
$$;

create trigger trg_update_member_tier
before insert or update of point on members
for each row
execute function update_member_tier();

-- backfill สมาชิกเดิมที่ tier ค้างผิดอยู่แล้วก่อนมี trigger นี้
update members set point = point;
