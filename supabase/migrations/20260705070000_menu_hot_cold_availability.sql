alter table menu_items add column available_hot boolean not null default false;
alter table menu_items add column available_cold boolean not null default true;
-- ทุกเมนูขายเย็นได้หมด (default true) แต่ร้อนขายได้แค่บางเมนู (default false, เปิดเฉพาะที่ระบุ)
-- Signature ทั้งหมด: ไม่มีร้อนขาย (ปล่อย default false ไว้ ไม่ต้องเปิด)

update menu_items set available_hot = true where name in (
  'Espresso', 'Americano', 'Latte', 'Cappuccino', 'Mocha', 'Drip Coffee',
  'Clear Matcha', 'Matcha Latte',
  'Rich Cocoa', 'Oreo Milk', 'Taro Milk'
);
