# Buddy Brew Member Platform — Project Overview

สรุปรวมทุกอย่างที่ตัดสินใจไว้ในการวางแผน+ลงมือสร้างระบบสมาชิก **เป็น single source of truth**
ถ้าเปิดแชทใหม่ (context เต็ม หรือแยก session) ให้อ่านไฟล์นี้ก่อนเสมอ ไม่ต้องไล่อ่านแชทเก่า

---

## 1. เป้าหมาย

สร้างระบบสมาชิกของร้าน Buddy Brew ที่เป็นทรัพย์สินของร้านเอง ทำงานผ่าน LINE OA + LIFF
ไม่ใช่แค่ระบบแต้ม แต่ต่อยอดเป็น Tier, Badge, Mission, Coupon, Referral ได้ในอนาคต

---

## 2. Tech stack

| ส่วน | ใช้อะไร | เหตุผล |
|---|---|---|
| ช่องทางลูกค้า | LINE OA + LIFF | ลูกค้าไม่ต้องลงแอปใหม่ ใช้ LINE ที่มีอยู่แล้ว |
| Backend | Supabase (Postgres + Data API + Edge Functions) | หน้าตา Table Editor คล้ายสเปรดชีตที่คุ้นเคย ไม่ต้องเขียน backend เองทั้งหมดแบบ WordPress plugin |
| Hosting หน้า LIFF | GitHub repo (public) + GitHub Pages (โฟลเดอร์ `/docs`) | แก้โค้ด → commit → push → deploy อัตโนมัติ |
| Staff Panel / Admin Dashboard | เว็บธรรมดา (Option A — ไม่ใช่ LIFF) | เร็วกว่า ไม่ต้องทำ LINE ID allowlist — ดูข้อ 6 |
| ปริ้นเตอร์ (เคส delivery) | Wongnai 58IIH (ESC/POS) เครื่องสำรองที่มีอยู่แล้ว ผูกเฉพาะ Buddy Brew | ปริ้นเตอร์ Bluetooth ที่ต่อ GrabMerchant แชร์กับระบบอื่นพร้อมกันไม่ได้ |

---

## 3. Account / ID ทั้งหมด (ของจริง ใช้อ้างอิงตรงๆ)

| อะไร | ค่า |
|---|---|
| Supabase Project URL | `https://xsokynhtoxktazlomsnx.supabase.co` |
| Supabase Project ref | `xsokynhtoxktazlomsnx` |
| Supabase region | Singapore |
| Supabase publishable key | `sb_publishable_r-BdEYs8q61oSQKv_qJpPw_Xh5BPgRa` (ปลอดภัยเปิดเผยได้ ถูกออกแบบมาให้ public) |
| LINE Provider | Buddy Brew |
| LINE Messaging API channel | "Buddy Brew" — Channel ID `2010607210` (ผูกกับ OA ตัวจริงที่มีลูกค้าอยู่) |
| LINE Login channel | "Buddy Brew Member" — Channel ID `2010607478` (ใช้เป็น `LIFF_CHANNEL_ID` secret) |
| LIFF app (Customer) | "Buddy Book" — LIFF ID `2010607478-4ZyARdyI` |
| GitHub repo | `https://github.com/webwecreate/buddy-brew-plaform` (Public) |
| GitHub Pages URL | `https://webwecreate.github.io/buddy-brew-plaform/` |

**ห้ามใส่ในไฟล์นี้/ในโค้ด**: service_role key / secret key ของ Supabase — เก็บเป็น Edge Function secret เท่านั้น ไม่ commit ลง git เด็ดขาด

---

## 4. Architecture

```
ลูกค้า (LINE App) ──┐                      พนักงาน (POS/แท็บเล็ต) ──┐
                    ▼                                              ▼
        ┌── LINE Platform ──┐                    ┌── Buddy Platform (Supabase) ──┐
        │ LINE OA · Messaging API │──────────────▶│ Data API (auto REST)          │
        │ LIFF "Buddy Book"       │               │ Edge Functions (Reward Engine) │
        └────────────────────┘                    │ Staff Panel + Admin Dashboard  │
                    │                              └────────────────────────────────┘
                    └──────────────────┬──────────────────────┘
                                       ▼
                              Database (Postgres)
                         members · points · badges · coupons
```

- LIFF page (`docs/index.html`, host บน GitHub Pages) เรียก Supabase ผ่าน Edge Function เท่านั้น ไม่แตะตารางตรงๆ
- Staff Panel/Admin Dashboard (Phase 2 — ยังไม่ได้สร้าง) เป็นเว็บเดียวกัน แยกมุมมองตาม role หลัง login (ดูข้อ 7)

---

## 5. โครงสร้างไฟล์ในโปรเจกต์ (repo `buddy-brew-plaform`)

```
buddy-platform/
├── PROJECT_OVERVIEW.md              ← ไฟล์นี้
├── docs/
│   └── index.html                   ← หน้า LIFF "Buddy Book" (GitHub Pages serve จากตรงนี้)
└── supabase/
    ├── config.toml                  ← ผูก project_id ให้ Supabase GitHub Integration รู้จัก repo นี้
    ├── functions/
    │   └── create-or-get-member/
    │       └── index.ts             ← Edge Function เดียวที่แตะตาราง members ได้
    └── migrations/
        └── 20260705000000_init_members.sql
```

โครงสร้างนี้จงใจให้ตรงกับ Supabase CLI convention (`supabase/functions/`, `supabase/migrations/`) เพื่อให้ **Supabase GitHub Integration** (Project Settings → Integrations → GitHub) deploy migration + edge function ให้อัตโนมัติทุกครั้งที่ push — ไม่ต้อง copy-paste เข้า dashboard เองอีกต่อไป (สถานะการเชื่อมต่อ ดูข้อ 9)

---

## 6. Database schema

### `members` (สร้างแล้ว ใช้งานจริงใน Phase 1)

```sql
create table members (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique not null,
  display_name text not null,
  picture_url text,
  tier text not null default 'sip',       -- sip / drink / slurpp
  point integer not null default 0,
  birthday date,
  staff_photo_url text,                    -- อัพโดยพนักงาน เห็นเฉพาะ staff/admin
  staff_note text,                         -- จำหน้า-นิสัย-ชื่อเล่น เห็นเฉพาะ staff/admin
  created_at timestamptz not null default now()
);
alter table members enable row level security;  -- ไม่มี policy = เข้าได้แค่ทาง edge function (service role) เท่านั้น
```

### `menu_items` + `bean_options` (สร้างแล้ว มีข้อมูลเมนูจริงของร้านครบ)

แก้ปัญหา "ไม่อยากให้พนักงานพิมพ์ราคาเอง" — ราคาผูกกับเมนูโดยตรง พนักงานแค่กดเลือก ระบบคำนวณให้เอง

```sql
menu_items (id, name, category, style, base_price, has_bean_choice, sort_order, available_hot, available_cold, active)
  -- category: signature / coffee / matcha / non_coffee / special / snack (snack ยังไม่มีข้อมูลเมนู)
  -- style (เฉพาะ category=coffee): milk / orange / black — เก็บไว้เผื่อวิเคราะห์ทีหลัง ไม่ได้ใช้จัดกลุ่ม UI แล้ว (ดูข้อ Staff Panel flow ด้านล่าง)
  -- sort_order: ยิ่งน้อยยิ่งอยู่บนสุด (เรียงตามความนิยม ใช้กับหมวด coffee เป็นหลัก)
  -- ตัวอย่าง: Espresso / coffee / black / 55 / true / sort_order 1
  --          Drip Coffee / coffee / black / 100 / true / sort_order 12   ← ดริปเป็นเมนูของตัวเอง ไม่ใช่ add-on อยู่ล่างสุดเพราะขายน้อยกว่า
  --          Matcha Latte / matcha / null / 85 / false / sort_order 100 (default)

bean_options (id, name, extra_price, active)
  -- มาตรฐาน = +0, Special Beans (Osmanthus) = +20
  -- กฎ: ราคาสุดท้าย = base_price + extra_price เสมอ (ดริป special = 100+20 = 120 ตรงกับที่ร้านคิด)
```

ข้อมูลเมนูทั้งหมด (Signature, Coffee, Matcha, Non-Coffee) ใส่ไว้ครบแล้วตาม migration `20260705040000` → `20260705060000` — **ยังขาดเมนู Snack** (รอร้านส่งรายการ+ราคาจริง)

**หลักการสำคัญที่ตกลงกันไว้**: เก็บข้อมูลระดับเมนูจริงเสมอ (ไม่ยุบรวม Latte/Cappuccino เป็นก้อนเดียวในฐานข้อมูล) — การจัดกลุ่มเพื่อความเร็วทำที่ชั้น **UI ของ Staff Panel เท่านั้น** ไม่กระทบข้อมูลที่เก็บจริง

**Staff Panel — flow การกดสร้าง QR (wireframe อยู่ในแชท ทำใน claude.ai/design ต่อได้)**
1. **ไม่มี step "ร้อน/เย็น" บังคับแล้ว** — ค่าเริ่มต้น = **เย็น** เสมอ (ออเดอร์ร้อนมีน้อยมาก) มีแค่ **toggle เล็กๆ ลอยมุมบน** ให้สลับเป็นร้อนได้ถ้าต้องการ (แตะครั้งเดียว) ลด step ของ staff สำหรับเคสส่วนใหญ่ (เย็น) ให้เหลือน้อยที่สุด — กรองเมนูตาม `available_hot`/`available_cold` เหมือนเดิม แค่ไม่บังคับถามทุกครั้ง
   - ร้อน: ไม่มี Signature เลย, Coffee มีแค่ Espresso/Americano/Latte/Cappuccino/Mocha/Drip Coffee, Matcha มีแค่ Clear Matcha/Matcha Latte, Non-Coffee มีแค่ Rich Cocoa/Oreo Milk/Taro Milk
   - เย็น (default): มีครบทุกเมนู
2. กดหมวดเมนู: Signature / Coffee / Matcha / Non-Coffee / Snack (หมวดที่ไม่มีเมนูเหลือหลังกรองร้อน/เย็นจะไม่โชว์ปุ่มให้กด)
3. ถ้าเป็น Coffee → เมนูเรียงเป็น**รายการเดียว**ตาม `sort_order` (ไม่แยกนม/ส้ม/ดำแล้ว) เรียงตามความนิยม: Espresso, Americano, Latte, Cappuccino, Mocha, Es-Yen, Orange Espresso, Coconut Espresso, Caramel/Earl Grey/French Vanilla Latte, Drip Coffee (ล่างสุด)
4. เลือกเมล็ด (ถ้าเมนูนั้นมี `has_bean_choice = true`)
5. ระบบคำนวณราคา+แต้ม → สร้าง QR ใช้ครั้งเดียว

หมายเหตุ: หน้าตา toggle จริง (swap/overlay-icon) ยังไม่ fix ค่อยออกแบบตอนทำ UI จริง หลักการที่ fix แล้วคือ "default เย็น ลด step ให้มากที่สุด"

**Tier ให้ส่วนลดอะไร — ยังไม่ตัดสินใจ (รอข้อมูลจริงก่อน)**: แนวคิดเบื้องต้นที่คุยไว้คือ tier สูงอาจได้ส่วนลดขนม 10% แต่ยังไม่ fix ต้องรอดูพฤติกรรมจริงหลังเปิดใช้ก่อนค่อยตัดสินใจ (ไม่กระทบ schema ตอนนี้ — คอลัมน์ `tier` มีอยู่แล้วพร้อมใช้ทันทีที่ตัดสินใจ)

### ตารางที่จะเพิ่มใน Phase 2

```
points_transactions (
  id, member_id FK,
  point_change,
  menu_item_id FK -> menu_items.id,   -- อ้างอิงเมนูจริง ไม่ใช่พิมพ์ข้อความอิสระ
  bean_option_id FK -> bean_options.id (nullable),
  final_price,       -- snapshot ราคาที่ลูกค้าจ่ายจริง (เก็บไว้ดูยอดขาย/บัญชี ไม่ใช้คิดแต้ม — ดูกฎด้านล่าง)
  reason,           -- ใช้ตอนไม่ใช่การซื้อเมนู เช่น "birthday_bonus", "referral_bonus"
  created_at        -- ใช้เป็นเวลาสั่งซื้อด้วย → คำนวณ badge ตามช่วงเวลาได้ (Early Bird / Night Owl)
)
```

**กฎสำคัญของ Reward Engine: คำนวณแต้มจาก `menu_items.base_price` เสมอ ไม่ใช้ `final_price` ที่ลูกค้าจ่ายจริง**
- เหตุผล: ราคาบน Grab/LINEMAN ถูกบวกเพิ่มเพื่อกัน GP ของแพลตฟอร์ม สูงกว่าราคาหน้าร้านจริง ถ้าคิดแต้มจากราคานั้นจะเป็นสัดส่วนที่ผิด (delivery ได้แต้มเยอะกว่าหน้าร้านทั้งที่ร้านต้นทุนแพงกว่า)
- สูตร: `point_change = floor((menu_items.base_price + bean_options.extra_price) / 10)` เสมอ ไม่ว่าจะเป็นช่องทางไหน (หน้าร้าน/delivery)
- `final_price` ยังเก็บไว้เพื่อดูยอดขายจริงต่อช่องทาง แค่ไม่เอามาคำนวณแต้ม

```
badges (id, name, condition)
badges_earned (id, member_id FK, badge_id FK, earned_at)
missions (id, title, type, reward_point)
missions_progress (id, member_id FK, mission_id FK, status)
rewards (id, name, point_cost)
coupons (id, member_id FK, reward_id FK, code, status, expires_at)
referrals (id, referrer_id FK, referred_id FK, created_at)
order_claim_tokens (id, token, channel, point_value, status, claimed_by, claimed_at, expires_at)
  -- สำหรับเคส delivery (Grab/LINEMAN) ดูข้อ 7
```

---

## 7. Flow หลัก

**User flow — ลูกค้าใหม่ (สมัครหน้าร้าน)**
1. ลูกค้าสแกน QR ร้าน (ป้าย/โต๊ะ) → เปิด LIFF "Buddy Book" → login LINE → ระบบสร้างสมาชิกอัตโนมัติ

**User flow — ลูกค้าเก่า สะสมแต้มหน้าร้าน (ตัดสินใจแล้ว: ลูกค้าสแกนพนักงาน ไม่ใช่พนักงานสแกนลูกค้า)**
1. ลูกค้าชำระเงินที่ POS Wongnai ตามปกติ (ไม่แตะต้อง POS)
2. พนักงานกดเลือกเมนูที่ขาย (Espresso/Latte/Matcha/...) บน Staff Panel
3. ระบบสร้าง QR/token **ใช้ได้ครั้งเดียว** โชว์บนหน้าจอ Staff Panel (กลไกเดียวกับ Delivery flow ด้านล่าง แค่โชว์บนจอแทนปริ้นติดถุง)
4. ลูกค้าสแกน QR นั้นด้วยมือถือตัวเอง (คุ้นเคยแบบสแกนจ่าย PromptPay) → login LINE (ถ้ายังไม่เคย)
5. ระบบเช็ค token แบบ atomic → เพิ่มแต้ม + บันทึกเมนูที่ซื้อลง `points_transactions` (เก็บข้อมูลระดับเมนูไว้คำนวณ badge)
6. เหตุผลที่เลือกทางนี้แทน "พนักงานสแกนลูกค้า": ลูกค้าคุ้นกับการสแกน QR ที่ร้านโชว์อยู่แล้ว และทำให้พนักงานกดเมนูบันทึกข้อมูลได้ในตัว ไม่ต้องมีขั้นตอนแยก

**Delivery flow (Grab/LINEMAN — ไม่มีจังหวะเจอหน้าลูกค้า)**
1. พนักงานแพ็คออเดอร์ตามปกติ
2. เปิด Staff Panel → กรอกยอด → ระบบสร้าง QR/รหัส **ใช้ได้ครั้งเดียว** (token สุ่ม ไม่ใช่ static QR)
3. แปะสติกเกอร์ติดถุง (หรือเขียนรหัส 6 หลักด้วยมือถ้ายังไม่มีระบบปริ้นอัตโนมัติ)
4. ลูกค้าได้รับของ สแกน/กรอกรหัส → login LINE (ถ้ายังไม่เคย)
5. ระบบเช็ค token แบบ atomic (เคลมซ้ำไม่ได้) → เพิ่มแต้มให้บัญชีที่ login อยู่ (ระบบรู้ว่าเป็นใครจาก LINE login ตอนเคลม ไม่ใช่จากตัว QR)
6. ข้อจำกัดที่ต้องยอมรับ: adoption ต่ำกว่าหน้าร้านเพราะต้องพึ่งลูกค้าเปิดแอปมาเคลมเอง ไม่ใช่ 100%

**ข้อจำกัดสำคัญ: Tier discount / แลกคูปอง ใช้กับออเดอร์ Grab/LINEMAN ไม่ได้เลย**
- สะสมแต้มได้ปกติ (ผ่าน QR ครั้งเดียวข้างบน) แต่ **ใช้สิทธิ์ (ส่วนลด Tier, แลกคูปอง) ได้เฉพาะหน้าร้านเท่านั้น**
- เหตุผล: Grab/LINEMAN เป็นระบบปิด ราคาที่ลูกค้าเห็นตายตัวตามที่ตั้งไว้ใน Grab Merchant Portal ไม่มีช่องทางให้ระบบภายนอกเข้าไปลดราคา ณ ตอนสั่งได้ และเราไม่เห็นออเดอร์แบบ real-time ด้วย — เป็นข้อจำกัดร่วมของทุกร้านที่ทำ CRM เอง ไม่ใช่ปัญหาเฉพาะระบบนี้
- ทางเลือกเสริม (ถ้าอยากให้): ลูกค้าทักแชท LINE OA ขอใช้คูปอง พนักงานคืนเงิน/เครดิตให้เองแบบ manual — ทำได้แต่ไม่ scale เหมาะกับเคสน้อยๆ เท่านั้น
- **ต้องสื่อสารกับลูกค้าให้ชัดในหน้า Buddy Book**: "สิทธิ์ Tier/คูปอง ใช้ได้เฉพาะหน้าร้าน" กันลูกค้าคาดหวังผิด

**Admin/Staff access — ตัดสินใจแล้ว: Option A (เว็บธรรมดา ไม่ใช่ LIFF)**
- เข้า URL หลังบ้านเดียวกันจากเบราว์เซอร์ (มือถือ/โน้ตบุ๊ค) กด "เพิ่มลงหน้าจอโฮม" ให้หน้าตาเหมือนแอปได้
- Login ด้วย email+รหัสผ่านของ Supabase เอง ไม่ผูกกับ LINE account ส่วนตัวของพนักงาน
- เหตุผล: เร็วกว่า ไม่ต้องสร้าง allowlist LINE user ID + ไม่ต้องสร้าง LIFF channel เพิ่มอีก 2 ตัว (เปลี่ยนไปทาง LIFF ทีหลังได้ ตาม ci-guide ถ้าต้องการ)

**Admin Dashboard — โครงเมนูซ้าย (wireframe อยู่ในแชท)**
1. **Overview** — การ์ดสรุปวันนี้ (จำนวนสมาชิก, แต้มแจกวันนี้, เมนูขายดี, badge ที่เปิดใช้)
2. **สมาชิก** — ค้นหา+รายชื่อ (โชว์เมนูโปรดในลิสต์ด้วย — คำนวณจาก `points_transactions` ไม่ได้เก็บเป็น column) คลิกเข้าดูรายละเอียด: รูป (อัพได้), โน้ต (แก้ได้), และ **ปรับแต้มด้วยมือ** (ช่อง +/- ตัวเลข + เหตุผล → บันทึกเป็นแถวใหม่ใน `points_transactions` ที่ `reason` ขึ้นต้นด้วย `manual_adjustment:` ไม่ต้องเพิ่ม schema ใหม่)
3. **แต้ม** — แยกจาก Reports เพราะมีทั้งดู (ledger การเข้า-ออกแต้มทั้งร้าน, สรุปแจก/แลกวันนี้) และทำงานจริง (จะโตขึ้นเรื่อยๆ)
4. **เมนู** — ตาราง `menu_items` แก้ราคา/เปิดปิดร้อน-เย็น/เพิ่มเมนูใหม่ได้ตรงนี้
5. **Badge/Mission** — ดู/เปิดปิด/เพิ่ม badge เงื่อนไข
6. **รายงาน** — ยอดขายแยกเมนู, สัดส่วน Tier, สมาชิกใหม่รายสัปดาห์ (ยังไม่มีข้อมูลจริงจนกว่าจะเปิดใช้งาน)
7. **พนักงาน** — จัดการ account login (email/รหัสผ่าน Supabase, Option A)

**Badge ไอเดีย (จาก brainstorm แยกต่างหาก) — คำนวณได้จาก `points_transactions` ที่แก้ schema แล้ว**

| Badge | เงื่อนไข | คำนวณได้จาก |
|---|---|---|
| Espresso Lover | ซื้อ Espresso ครบ 20 แก้ว | `count(*) where menu_item='Espresso'` |
| Latte Master | ซื้อ Latte ครบ 30 แก้ว | `count(*) where menu_item='Latte'` |
| Matcha Fan | ซื้อ Matcha ครบ 20 แก้ว | `count(*) where menu_item='Matcha'` |
| Early Bird | ซื้อก่อน 9 โมง 15 ครั้ง | `count(*) where extract(hour from created_at) < 9` |
| Night Owl | ซื้อหลังสองทุ่ม 20 ครั้ง | `count(*) where extract(hour from created_at) >= 20` |
| Buddy Friend | Add LINE ครบ 1 ปี | `members.created_at` เทียบกับวันนี้ |
| Rain Hunter | ซื้อวันที่ฝนตก 5 ครั้ง | **ยังคำนวณเองไม่ได้** ต้องมีข้อมูลสภาพอากาศ — ทางเลือก: (a) ต่อ weather API เทียบวันที่ (b) ให้พนักงานติ๊ก "วันนี้ฝนตก" เองใน Staff Panel (ง่ายกว่า แนะนำ) |

หลักการ: badge ไม่ให้ส่วนลด แค่ให้สะสม/โชว์ (ตามที่ brainstorm ไว้) — เก็บไว้ตัดสินใจอีกทีตอนสร้างจริงว่าจะให้รางวัลอะไรเพิ่มไหม

**Birthday — ยังไม่มีวิธีเก็บค่าจริง**: คอลัมน์ `birthday` มีอยู่แล้วในตาราง `members` แต่ LINE ไม่ส่งวันเกิดมาให้ตอน login (scope `profile` ไม่มีข้อมูลนี้) ต้องทำหน้ากรอกแยก (เช่น ถามครั้งแรกหลัง login พร้อมแต้มจูงใจให้กรอก) — ยังไม่ได้ออกแบบหน้านี้

---

## 8. Role & Permissions

| ข้อมูล | ลูกค้า (LIFF) | พนักงาน (Staff Panel) | เจ้าของ (Admin Dashboard) |
|---|---|---|---|
| แต้ม/Tier/QR ตัวเอง | เห็น | เห็น (ตอนสแกน) | เห็น |
| รูป+โน้ตจำลูกค้า (staff_photo_url, staff_note) | **ไม่เห็นเด็ดขาด** | เห็นเต็ม | เห็นเต็ม |
| ตั้งค่า mission/badge/รายงาน | ไม่เห็น | ไม่เห็น | เห็น |

กติกาสำคัญ: ฟิลด์ `staff_photo_url`/`staff_note` ต้องกรองออกตั้งแต่ระดับ REST endpoint ไม่ใช่แค่ซ่อนที่หน้าจอ ปรับสิทธิ์นี้ทีหลังได้เสมอเพราะเช็ค role ที่ชั้น API ไม่ได้ฝังตายตัว

**Buddy Book — โครงหน้าจอ (wireframe อยู่ในแชท)**
- โปรไฟล์ + Tier badge + **ไอคอน QR เล็กมุมบนขวา** (minimal, สำรองไว้ใช้ในอนาคต ไม่ใช่ flow หลักในการเก็บแต้มแล้ว เพราะตอนนี้ลูกค้าสแกนพนักงานแทน)
- แต้มสะสม + progress bar ไป Tier ถัดไป
- Badge ของฉัน (โชว์แค่ 3 ที่ปลดแล้วในหน้าแรก) + ปุ่ม **"ดูทั้งหมด"** เปิดหน้าแยกโชว์ badge ครบทุกอันทั้งที่ปลดแล้ว/ยังไม่ปลด พร้อมเงื่อนไขการปลด (กระตุ้นให้อยากสะสมต่อ)
- คูปองที่ถืออยู่
- ประวัติการซื้อล่าสุด
- แบนเนอร์ชวนกรอกวันเกิด (ตรงกับ gap ที่เจอไว้ก่อนหน้า)

---

## 9. สถานะปัจจุบัน

- [x] Tech stack, schema, architecture, flow ทั้งหมดออกแบบแล้ว (ข้อ 1-8)
- [x] Supabase project สร้างแล้ว (Singapore) + ตาราง `members` รันสำเร็จ
- [x] Edge Function `create-or-get-member` เขียน + deploy สำเร็จ (ผ่านหน้า dashboard "Via Editor")
- [x] LINE: Provider + Messaging API channel (เชื่อมกับ OA เดิม) + LINE Login channel + LIFF app "Buddy Book" สร้างครบ
- [x] GitHub repo `buddy-brew-plaform` (Public) + GitHub Pages เปิดใช้งานที่ `/docs`
- [x] Repo จัดโครงสร้างให้ตรง Supabase CLI convention แล้ว (`supabase/functions`, `supabase/migrations`, `supabase/config.toml`)
- [x] เชื่อม Supabase GitHub Integration สำหรับ migrations (auto-apply เมื่อ push ยืนยันแล้วด้วย test migration)
- [x] ตั้ง GitHub Actions (`​.github/workflows/deploy-functions.yml`) สำหรับ auto-deploy Edge Function เพราะ Integration หลักครอบคลุมแค่ migrations ไม่รวม functions
- [x] **ทดสอบ login ผ่าน LIFF สำเร็จ end-to-end แล้ว** (2026-07-05) — tag ไว้ที่ `v1-first-login-success`
- [ ] ตกแต่งหน้า Buddy Book ให้ตรง CI (ตอนนี้เป็นเวอร์ชันทดสอบเปล่าๆ — โชว์แค่ชื่อ+แต้ม)

## Phase 2 (ยังไม่เริ่ม)
Tier graphic ใหม่ (Sip/Drink/Slurpp), Staff Panel (สแกน+กรอกแต้ม+อัพรูปลูกค้า), Reward Engine, Badge/Mission, Referral, Delivery QR claim, เชื่อม printer 58IIH

## Phase 3 (ยังไม่เริ่ม)
Lucky Wheel, Leaderboard, Seasonal Event, Coffee Passport, Personalized Offer

---

## 10. ปัญหาที่เจอระหว่างทาง (กันแก้ซ้ำ)

1. **LINE เปลี่ยนกฎ**: สร้าง LIFF app ผ่าน Messaging API channel ตรงๆ ไม่ได้แล้ว ต้องสร้างผ่าน **LINE Login channel** แทน
2. **GitHub Pages ฟรีใช้กับ repo Private ไม่ได้** — ต้องเป็น Public ถึงจะเปิด Pages ฟรีได้ (ตัดสินใจแล้วว่าปลอดภัย เพราะไม่เคย commit secret จริงลง repo)
3. **Edge Function 500 error** เกิดจาก 2 สาเหตุรวมกัน:
   - ตาราง `members` ไม่มีอยู่จริง (ลืมรัน migration หลังสร้างโปรเจกต์ใหม่รอบสอง)
   - `import ... from "https://esm.sh/@supabase/supabase-js@2"` ทำให้ function boot fail แบบเงียบ (log โชว์แค่ "booted" แล้ว "shutdown: EarlyDrop" ไม่มี error จริงโผล่) แก้โดยเปลี่ยนเป็น `import ... from "npm:@supabase/supabase-js@2"` ตาม convention ที่ Supabase แนะนำเอง
4. **Supabase GitHub Integration (Project Settings → Integrations) auto-deploy แค่ database migrations เท่านั้น ไม่รวม Edge Functions** — ต้องตั้ง GitHub Actions แยกต่างหาก (`.github/workflows/deploy-functions.yml`) ใช้ `supabase/setup-cli` + secret `SUPABASE_ACCESS_TOKEN` ถึงจะ auto-deploy function ได้จริง
5. **"permission denied for table members"** แม้ใช้ service_role key แล้ว — เกิดจากตอนสร้างโปรเจกต์ปิด "Automatically expose new tables" ไว้ ทำให้ตารางที่สร้างผ่าน raw SQL migration ไม่มี GRANT ให้ role ไหนเลยแม้แต่ service_role ต้องเพิ่ม `grant select, insert, update, delete on table members to service_role;` เอง แล้วสั่ง `notify pgrst, 'reload schema';` ต่อท้ายเพื่อบังคับ PostgREST รีเฟรช cache สิทธิ์ทันที (ไม่งั้นต้องรอ cache หมดอายุเอง)

---

## 11. Working conventions (วิธีทำงานร่วมกันในโปรเจกต์นี้)

- **Git**: ทุกครั้งที่แก้โค้ด → commit ทันที → **push ทันที** (เคยลืม push มาแล้วครั้งหนึ่ง ห้ามลืมอีก) ถือเป็น backup อัตโนมัติ
- **Git tag** ที่จุดสำคัญ (เช่น "ทดสอบ login ผ่านครั้งแรก") ไว้ย้อนกลับง่าย
- **ถ้าเปิดแชทใหม่**: อ่านไฟล์นี้ (`PROJECT_OVERVIEW.md`) ก่อนเสมอ ไม่ต้องไล่ history แชทเก่า
- **แยกแชทตามเนื้องาน ไม่ใช่ตามโมเดล**: แชทนี้ = engineering/architecture (ต้องคิดลึก ใช้ Sonnet/Opus) ถ้าจะแยกแชทสำหรับ Brand/Design (ทำงานกับ ci-guide, mockup) แยกได้ แต่ไม่จำเป็นต้องแยกเพราะเรื่อง context เต็ม (ระบบสรุปให้อัตโนมัติ)
- **Backup ข้อมูลจริงในตาราง** (ไม่ใช่แค่โค้ด) ยังไม่ได้ตั้งค่า — Supabase free tier มี backup จำกัด ต้องกลับมาคุยเรื่องนี้ก่อนเปิดใช้จริงกับลูกค้า
