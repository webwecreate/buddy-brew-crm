alter table menu_items add column sort_order integer not null default 100;
-- ยิ่งเลขน้อย ยิ่งอยู่บนสุด (เมนูขายดี) — style (milk/orange/black) เลิกใช้จัดกลุ่ม UI แล้ว
-- แต่คอลัมน์ยังเก็บไว้เผื่อใช้วิเคราะห์ทีหลัง ไม่ต้องลบ

update menu_items set sort_order = 1 where name = 'Espresso';
update menu_items set sort_order = 2 where name = 'Americano';
update menu_items set sort_order = 3 where name = 'Latte';
update menu_items set sort_order = 4 where name = 'Cappuccino';
update menu_items set sort_order = 5 where name = 'Mocha';
update menu_items set sort_order = 6 where name = 'Es-Yen';
update menu_items set sort_order = 7 where name = 'Orange Espresso';
update menu_items set sort_order = 8 where name = 'Coconut Espresso';
update menu_items set sort_order = 9 where name = 'Caramel Latte';
update menu_items set sort_order = 10 where name = 'Earl Grey Latte';
update menu_items set sort_order = 11 where name = 'French Vanilla Latte';
update menu_items set sort_order = 12 where name = 'Drip Coffee';
