alter table order_claim_tokens add column menu_item_id uuid references menu_items(id);
alter table order_claim_tokens add column bean_option_id uuid references bean_options(id);
-- ขาดไปตอนออกแบบตอนแรก จำเป็นสำหรับคำนวณ badge ระดับเมนู (เช่น Latte Master) จากออเดอร์ที่มาผ่าน QR
