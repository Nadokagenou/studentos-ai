-- ============================================================
-- 23 ต.ค. 69 · ชวนเพื่อนมาใช้แอป (ภารกิจปลดธีม Halloween ข้อ 1: ชวนให้ครบ 3 คน)
-- ------------------------------------------------------------
-- แบบเดียวกับแอปที่ใช้รหัสชวนเพื่อน: ทุกบัญชีมีรหัสเชิญของตัวเองหนึ่งรหัส
-- เป็นคำภาษาอังกฤษธีม Halloween สามคำ เช่น BAT-MOON-CANDY — อ่านออกเสียงบอกกันได้
-- พิมพ์ตามได้โดยไม่ต้องเดาว่าเป็นเลข 0 หรือตัว O · ส่งเป็นลิงก์/QR ก็ได้ (?invite=รหัส)
--
-- ทำไมต้องนับที่เซิร์ฟเวอร์ ไม่ใช่ในเครื่อง: จำนวนคนที่ชวนมาได้เป็นเรื่องระหว่างสองบัญชี
-- ถ้านับในเครื่อง ใครก็แก้ localStorage ให้เป็น 3 ได้ · ส่วนภารกิจข้อ 2 (ทำงานเสร็จ 1 งาน)
-- อยู่ในเครื่องได้ เพราะงานเป็นของเจ้าตัวคนเดียวอยู่แล้ว
--
-- กติกา (บังคับใน redeem_invite ที่เดียว · ห้ามเขียนตารางตรงจากเบราว์เซอร์):
--   · บัญชีหนึ่งถูกชวนได้ครั้งเดียวตลอดไป (invitee เป็น primary key)
--   · ใช้รหัสตัวเองไม่ได้ · ใช้รหัสของคนที่บล็อกกันไม่ได้
--   · ต้องเป็นคนที่ไม่เคยใช้ StudentOS มาก่อน (เจ้าของสั่ง 23 ต.ค. 69: "ชวนเพื่อนคือชวนคนที่ไม่เคยใช้ให้ใช้")
--     ไม่งั้นทั้งห้องที่ใช้อยู่แล้วแค่แลกรหัสกันก็ครบภารกิจโดยไม่มีใครมาใหม่สักคน · ตรวจสองชั้น:
--       1. บัญชีสร้างมาไม่เกิน 7 วัน (เวลาให้เพื่อนที่สมัครแล้วค่อยพิมพ์รหัสตามมาทีหลัง)
--       2. วันแรกที่เปิดแอป (user_state.data.funnel.firstOpen · รวมทุกเครื่อง และรวมช่วงที่ใช้
--          โดยไม่ล็อกอินด้วย เพราะข้อมูลในเครื่องถูกย้ายเข้าบัญชีตอนล็อกอินครั้งแรก) ต้องไม่ก่อน
--          วันสมัครเกิน 1 วัน — คนที่ใช้แอปมานานแล้วเพิ่งสมัครบัญชี ไม่ใช่คนที่ถูกชวนมา
--          (เผื่อ 1 วันให้คนที่กดลิงก์แล้วลองเล่นก่อนสมัคร)
--     ที่ตรวจไม่ได้: คนเดิมสมัครบัญชีที่สองบนเครื่องที่สลับบัญชี (ข้อมูลเครื่องถูกแยกเก็บ เริ่มใหม่สะอาด)
--   · รหัสหนึ่งใช้ได้ 6 คน (max_uses) — ภารกิจต้องการ 3 · ที่เหลือเผื่อชวนต่อ
--   · ใช้รหัสแล้วเป็นเพื่อนกันทันที (ตอบรับแล้ว) — คนที่ชวนกันมาไม่ต้องค้นหากันอีกรอบ
-- ============================================================

create table if not exists public.invite_codes (
  owner      uuid primary key references auth.users(id) on delete cascade,
  code       text not null,                 -- แสดงผล: BAT-MOON-CANDY
  code_key   text not null,                 -- เทียบ: BATMOONCANDY (ไม่สนขีด/เว้นวรรค/ตัวพิมพ์)
  max_uses   int  not null default 6 check (max_uses between 0 and 50),
  created_at timestamptz not null default now()
);
create unique index if not exists invite_codes_key on public.invite_codes (code_key);

create table if not exists public.invite_redemptions (
  invitee     uuid primary key references auth.users(id) on delete cascade,
  inviter     uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  constraint invite_not_self check (invitee <> inviter)
);
create index if not exists invite_redemptions_inviter on public.invite_redemptions (inviter);

alter table public.invite_codes enable row level security;
alter table public.invite_redemptions enable row level security;

-- อ่านได้เฉพาะของตัวเอง · ไม่มี policy เขียน = เขียนตรงไม่ได้ ต้องผ่านฟังก์ชันข้างล่าง
drop policy if exists "own invite code" on public.invite_codes;
create policy "own invite code" on public.invite_codes
  for select to authenticated using (owner = auth.uid());
drop policy if exists "own invite redemptions" on public.invite_redemptions;
create policy "own invite redemptions" on public.invite_redemptions
  for select to authenticated using (inviter = auth.uid() or invitee = auth.uid());

-- ---------- รหัสเชิญของฉัน (สร้างให้ถ้ายังไม่มี) + ความคืบหน้า ----------
-- คืนแถวเดียว: รหัส · ใช้ได้กี่คน · ใช้ไปแล้วกี่คน · เพื่อนที่ชวนมา · เราเองถูกชวนมาแล้วหรือยัง
-- 64 คำ ยกกำลัง 3 = 262,144 รหัส · ชนกันก็สุ่มใหม่ (สูงสุด 30 รอบ ลูปต้องมีทางออกเสมอ)
create or replace function public.my_invite()
returns table (code text, max_uses int, used int, friends jsonb, invited_by jsonb)
language plpgsql volatile security definer set search_path = public as $fn$
declare
  v_me uuid := auth.uid();
  v_words text[] := array[
    'BAT','CAT','OWL','WEB','BOO','FOG','IMP','HEX','ELF','YEW',
    'MOON','BONE','CAPE','CROW','FANG','MASK','MIST','TOMB','WAND','HOWL',
    'ROBE','COIN','CAKE','HOOD','LAMP','RUNE','SOUP','VINE','WOLF','STAR',
    'OMEN','LEAF','GHOST','WITCH','CANDY','SKULL','BROOM','CRYPT','RAVEN','SPELL',
    'TORCH','ACORN','CHARM','CLOAK','FEAST','HAUNT','NIGHT','TREAT','TRICK','GOURD',
    'FROST','ATTIC','MUMMY','BEAST','CHILL','SHADE','CANDLE','POTION','SPIDER','COFFIN',
    'GOBLIN','PUMPKIN','LANTERN','VAMPIRE'];
  v_n int := array_length(v_words, 1);
  v_code text; v_key text; i int := 0;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if not exists (select 1 from public.invite_codes c where c.owner = v_me) then
    loop
      i := i + 1;
      v_code := v_words[1 + floor(random() * v_n)::int] || '-' ||
                v_words[1 + floor(random() * v_n)::int] || '-' ||
                v_words[1 + floor(random() * v_n)::int];
      v_key := replace(v_code, '-', '');
      begin
        insert into public.invite_codes (owner, code, code_key) values (v_me, v_code, v_key)
          on conflict (owner) do nothing;
        exit;
      exception when unique_violation then
        if i >= 30 then raise exception 'สร้างรหัสเชิญไม่สำเร็จ ลองใหม่อีกครั้ง'; end if;
      end;
    end loop;
  end if;

  return query
    select c.code, c.max_uses,
           (select count(*)::int from public.invite_redemptions r where r.inviter = v_me),
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'name', coalesce(p.display_name, 'นักเรียน'),
                      'handle', p.handle, 'avatar', p.avatar, 'at', r.redeemed_at)
                    order by r.redeemed_at)
               from public.invite_redemptions r
               left join public.profiles p on p.id = r.invitee
              where r.inviter = v_me), '[]'::jsonb),
           (select jsonb_build_object('name', coalesce(p.display_name, 'นักเรียน'), 'handle', p.handle)
              from public.invite_redemptions r
              left join public.profiles p on p.id = r.inviter
             where r.invitee = v_me)
      from public.invite_codes c
     where c.owner = v_me;
end;
$fn$;

revoke all on function public.my_invite() from public, anon;
grant execute on function public.my_invite() to authenticated;

-- ---------- ใช้รหัสเชิญของเพื่อน ----------
-- คืนคำเดียวให้ฝั่งแอปเลือกข้อความได้เลย (ไม่ raise สำหรับกรณีที่ผู้ใช้ทำได้ตามปกติ
-- เพราะ raise แปลว่าแอปต้องแกะข้อความภาษาไทยกลับมาเป็นกรณี):
--   ok        สำเร็จ · เป็นเพื่อนกันแล้ว
--   not_found ไม่มีรหัสนี้
--   self      รหัสของตัวเอง
--   already   บัญชีนี้ใช้รหัสเชิญไปแล้ว (ของใครก็ตาม)
--   full      รหัสนี้มีคนใช้ครบแล้ว
--   not_new   เคยใช้ StudentOS มาก่อน (บัญชีเก่าเกิน 7 วัน หรือเปิดแอปมาก่อนสมัครนานแล้ว)
--   blocked   บล็อกกันอยู่
create or replace function public.redeem_invite(p_code text)
returns text
language plpgsql volatile security definer set search_path = public as $fn$
declare
  v_me uuid := auth.uid();
  v_key text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z]', '', 'g'));
  v_owner uuid; v_max int; v_used int; v_born timestamptz; v_first timestamptz;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if length(v_key) < 6 or length(v_key) > 30 then return 'not_found'; end if;

  -- ล็อกแถวรหัสไว้ระหว่างนับ · สองคนกดพร้อมกันตอนเหลือที่เดียวต้องได้แค่คนเดียว
  select c.owner, c.max_uses into v_owner, v_max
    from public.invite_codes c where c.code_key = v_key for update;
  if v_owner is null then return 'not_found'; end if;
  if v_owner = v_me then return 'self'; end if;
  if exists (select 1 from public.invite_redemptions r where r.invitee = v_me) then return 'already'; end if;
  if public.is_blocked(v_me, v_owner) then return 'blocked'; end if;

  select u.created_at into v_born from auth.users u where u.id = v_me;
  if v_born is null or v_born < now() - interval '7 days' then return 'not_new'; end if;

  -- เปิดแอปครั้งแรกนานก่อนสมัคร = เคยใช้แล้ว · ไม่มีข้อมูล/อ่านค่าไม่ได้ = ไม่มีหลักฐานว่าเคยใช้ ปล่อยผ่าน
  begin
    select (s.data #>> '{funnel,firstOpen}')::timestamptz into v_first
      from public.user_state s where s.id = v_me;
  exception when others then v_first := null;
  end;
  if v_first is not null and v_first < v_born - interval '1 day' then return 'not_new'; end if;

  select count(*) into v_used from public.invite_redemptions r where r.inviter = v_owner;
  if v_used >= v_max then return 'full'; end if;

  insert into public.invite_redemptions (invitee, inviter) values (v_me, v_owner)
    on conflict (invitee) do nothing;
  if not found then return 'already'; end if;

  -- เป็นเพื่อนกันทันที · ถ้ามีคำขอค้างอยู่ก่อนแล้ว (ใครขอก็ตาม) ถือว่าตอบรับ
  insert into public.friendships (a, b, asked_by, status, accepted_at)
  values (least(v_me, v_owner), greatest(v_me, v_owner), v_owner, 'accepted', now())
  on conflict (a, b) do update
    set status = 'accepted', accepted_at = coalesce(friendships.accepted_at, now());

  return 'ok';
end;
$fn$;

revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;
