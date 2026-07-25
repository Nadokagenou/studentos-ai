# ตั้งค่า Push Notification (เตือนแม้ปิดแอป)

ฝั่งแอปเสร็จแล้ว 100% — เหลือตั้งค่าฝั่ง Supabase 4 ขั้น ทำครั้งเดียวจบ

> **กุญแจ VAPID ของโปรเจกต์นี้** (สร้างไว้แล้ว)
> - Public (อยู่ใน `config.js` แล้ว): `BHrP-CpWVD4hOHxZoMZsBT7mmlpjH4tOXp-QozzHlCQft_rATWQMI5OpyRsFjN7zju2TdaTuEzmo_0SJQwtPZNQ`
> - **Private: ขอจาก Claude ในแชท** — ห้ามใส่ในโค้ด/repo เด็ดขาด ใส่ได้เฉพาะช่อง Secrets ของ Supabase

## 1. สร้างตารางเก็บ subscription

Supabase → **SQL Editor** → New query → วาง → Run

```sql
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  tz_offset int default 420,
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- drop ก่อนเพื่อให้รันซ้ำได้ไม่ error (create policy ไม่มี if not exists)
drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions" on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);
```

> ถ้าเจอ `ERROR: policy ... already exists` แปลว่ารันสำเร็จไปแล้วรอบก่อน — ข้ามไปขั้นที่ 2 ได้เลย
>
> เช็กว่าครบไหม: `select * from pg_policies where tablename = 'push_subscriptions';` ควรได้ 1 แถว

## 2. สร้าง Edge Function

Supabase → **Edge Functions** → **Deploy a new function** → ตั้งชื่อ `send-reminders`
→ ลบโค้ดตัวอย่างทิ้ง แล้ววางเนื้อหาไฟล์ `supabase/functions/send-reminders/index.ts` ทั้งหมด → Deploy

## 3. ใส่ Secrets

Supabase → **Edge Functions** → **Secrets** → เพิ่ม 3 ตัว:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | `BHrP-CpWVD4hOHxZoMZsBT7mmlpjH4tOXp-QozzHlCQft_rATWQMI5OpyRsFjN7zju2TdaTuEzmo_0SJQwtPZNQ` |
| `VAPID_PRIVATE_KEY` | (ขอจาก Claude ในแชท) |
| `VAPID_SUBJECT` | `mailto:brutalprojectee@gmail.com` |

> `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` มีให้อัตโนมัติ ไม่ต้องเพิ่มเอง

## 4. ตั้งเวลาให้ทำงานอัตโนมัติทุก 30 นาที

SQL Editor → วาง → Run
(แทน `<PROJECT_REF>` = `yunbytxtgghizrdqftvj` และ `<ANON_KEY>` = anon key ใน `config.js`)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'studentos-send-reminders',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://yunbytxtgghizrdqftvj.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb
  );
  $$
);
```

ตรวจว่าตั้งสำเร็จ: `select * from cron.job;`

## ทดสอบ

1. เปิดแอปบนมือถือ → ล็อกอิน Google → แท็บ **ฉัน** → กด **เปิดการแจ้งเตือน** → อนุญาต
2. เพิ่มงานที่กำหนดส่งภายใน 24 ชม.
3. ยิง Edge Function ด้วยมือเพื่อทดสอบทันที (ไม่ต้องรอ cron): Supabase → Edge Functions → `send-reminders` → **Invoke**
4. ปิดแอป/ปิดหน้าจอ → ควรได้ notification เด้งเข้ามือถือ

## ข้อจำกัดที่ต้องรู้

- **iPhone**: Web Push ใช้ได้เฉพาะเมื่อ **Add to Home Screen** แล้วเปิดจากไอคอน (iOS 16.4+) — เปิดใน Safari เฉย ๆ จะไม่ได้ push
- **Android/Chrome**: ใช้ได้ทันทีหลังกดอนุญาต
- ระบบกันสแปม: เตือนคนเดิมไม่เกิน 1 ครั้งต่อ 4 ชม. และงานเดิมเตือนครั้งเดียว
