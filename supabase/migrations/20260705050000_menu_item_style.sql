alter table menu_items add column style text;  -- milk / orange / black (ใช้จัดกลุ่มปุ่มใน Staff Panel เฉพาะหมวด coffee)

update menu_items set style = 'black' where name in ('Americano', 'Espresso', 'Drip Coffee');
update menu_items set style = 'orange' where name in ('Orange Espresso');
update menu_items set style = 'milk' where name in (
  'Latte', 'Cappuccino', 'Mocha', 'Caramel Latte', 'Earl Grey Latte',
  'French Vanilla Latte', 'Coconut Espresso', 'Es-Yen'
);
