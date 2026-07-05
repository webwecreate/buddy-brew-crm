alter table menu_items add column point_value integer not null default 5;
-- แต้มต่อแก้ว กำหนดเองต่อเมนู ไม่ผูกกับราคาแล้ว (กัน margin ต่ำแต่ได้แต้มเยอะกว่าของ margin สูง)
-- เริ่มต้นให้ทุกเมนู 5 แต้มเท่ากันหมด ปรับแยกทีหลังต่อเมนูได้ผ่าน Admin Dashboard
