# ตั้งค่า Supabase (ล็อกอิน Google + ซิงก์ข้อมูล)

โค้ดฝั่งแอปเสร็จหมดแล้ว — เหลือตั้งค่าฝั่ง Supabase ตามนี้ครั้งเดียวจบ

## 1. สร้างโปรเจกต์

1. สมัคร/ล็อกอินที่ https://supabase.com (ใช้บัญชี GitHub ได้เลย)
2. **New Project** → ตั้งชื่อ `studentos-ai` → เลือก region `Southeast Asia (Singapore)` → Create

## 2. สร้างตารางเก็บข้อมูล

ไปที่ **SQL Editor** → New query → วางทั้งก้อนนี้ → Run

```sql
create table if not exists public.user_state (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "own state" on public.user_state
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

(RLS policy นี้ทำให้แต่ละคนอ่าน/เขียนได้เฉพาะข้อมูลของตัวเอง)

## 3. เปิด Google Login

1. ไปที่ https://console.cloud.google.com → สร้างโปรเจกต์ใหม่ (ชื่ออะไรก็ได้)
2. **APIs & Services → OAuth consent screen** → External → กรอกชื่อแอป + อีเมล → Save
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs ใส่: `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
     (ดู PROJECT-REF ได้จาก URL โปรเจกต์ Supabase)
   - Create → จะได้ **Client ID** และ **Client Secret**
4. กลับมาที่ Supabase → **Authentication → Sign In / Providers → Google** → Enable
   → วาง Client ID + Client Secret → Save

## 4. ตั้ง Redirect URL ของแอป

Supabase → **Authentication → URL Configuration**
- Site URL: `https://nadokagenou.github.io/studentos-ai/`
- Redirect URLs: เพิ่ม `https://nadokagenou.github.io/studentos-ai/`

## 5. เอาค่ามาใส่แอป

Supabase → **Project Settings → API** → copy 2 ค่า:
- **Project URL** (เช่น `https://abcdefgh.supabase.co`)
- **anon public key**

เอาไปใส่ใน `config.js` แล้ว push — จบ

> anon key อยู่ในโค้ดฝั่ง browser ได้ ไม่ใช่ความลับ — ความปลอดภัยคุมด้วย RLS ในข้อ 2
