# คลังงาน (Task Vault) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** รูปโจทย์ · งานที่ทำเสร็จ · โน้ต และข้อความ "จดไว้" ต่องาน เก็บขึ้นคลาวด์ เปิดได้จากไทล์หน้าแรก แท็บ "ฉัน" และโหมดโฟกัส

**Architecture:** รายการรูป (`t.files`) กับโน้ต (`t.note`) อยู่ในงาน จึงซิงก์ รวมสามทาง และย้ายตามบัญชีด้วยระบบเดิม · ไฟล์รูปอยู่ใน bucket ปิด `task-files/<uid>/<fileId>.jpg` อ่านด้วย signed URL · IndexedDB `studentos-files` เป็นทั้งแคชและคิวส่ง/คิวลบ · โค้ดใหม่ทั้งหมดอยู่ในไฟล์ `vault.js` + `vault.css` (แบบเดียวกับ `hw.js`/`hw.css`) แตะ `app.js` แค่จุดต่อ

**Tech Stack:** Vanilla JS (ไม่มี build) · Supabase Storage (supabase-js จาก CDN ที่แอปโหลดอยู่แล้ว) · IndexedDB · canvas · เทสต์ node `vm` + PGlite

**Spec:** `alt/docs/superpowers/specs/2026-10-31-task-vault-design.md` — อ่านคู่กันเสมอ แผนนี้อ้างเลขข้อของสเปก

## Global Constraints

- ทุกอย่างลง **ทั้งสองสาย** ในงานเดียวกัน: `alt/` และราก · `vault.js` กับ `vault.css` ของสองสายต้อง **ไบต์ตรงกัน** · ส่วนที่แก้ใน `app.js`/`index.html`/`safety.js`/`sw.js` ต้องเป็น diff เดียวกันทั้งสองสาย (ตรวจด้วย `diff <(git diff -U0 -- app.js | grep '^[+-][^+-]') <(git diff -U0 -- alt/app.js | grep '^[+-][^+-]')`)
- ไฟล์ที่ทำงานเป็น CRLF ต้องคงเป็น CRLF (`tr -cd '\r' < f | wc -c` ก่อน/หลังต้องเพิ่มตามจำนวนบรรทัดใหม่เท่านั้น)
- **ห้ามเปลี่ยนคีย์ `studentos.alt.*`** · ไฟล์รูปห้ามเข้า localStorage
- **ห้ามแก้ `style.css`** · CSS ใหม่อยู่ใน `vault.css` เท่านั้น
- ลำดับสคริปต์: `vault.js` โหลด **ก่อน `app.js`** ต่อจาก `events.js` (เรียก global ของแอปตอนรันเท่านั้น ไม่ใช่ตอนโหลด)
- ไฟล์ใหม่ทุกไฟล์ต้องอยู่ใน precache ของ `sw.js` ทั้งสองสาย (sw-check ตรวจว่าไฟล์มีจริง และห้ามชื่อซ้ำ)
- bucket: `task-files` · `public = false` · `file_size_limit = 1048576` · `allowed_mime_types = {image/jpeg}` · path `<uid>/<fileId>.jpg`
- ย่อรูป: ด้านยาว ≤ 1600px · JPEG 0.82 · เกิน 1MB ลองใหม่ที่ 0.7
- เพดาน `VAULT_CAP = 300` รูปต่อบัญชี (นับงานในถังขยะด้วย)
- เก็บกวาดลบเฉพาะไฟล์ที่ไม่มีงานไหนอ้างถึง **และ** เก่ากว่า `VAULT_SWEEP_GRACE_MS = 86400000`
- ชื่อฟีเจอร์ `vault` ใน `sosFeature` · ปิด = ไทล์ แถวแท็บ "ฉัน" แถว "ดูโจทย์" และปุ่ม "ถ่ายงานที่ทำเสร็จ" หายหมด
- ป้าย "ส่งแล้ว ✓" เป็นสีเขียว ห้ามสีทอง (ทองไว้ของสำเร็จจริงเท่านั้น)
- หน้าแรก `scr-menu` ต้องไม่ต้องเลื่อนที่ 375×812
- ไม่มีกุญแจ/ความลับลง repo · ไม่ push จนเจ้าของสั่ง · ชื่อรุ่นเจ้าของตั้งเอง
- ข้อความ UI ภาษาไทย ตามต้นแบบ `alt/docs/superpowers/mockups/2026-10-31-task-vault-prototype.html`
- เครดิตในคอมเมนต์: เส้นสาย = Cult UI Illustration Fluid Rendering (MIT) · ไอคอน = Lucide `archive` (ISC)

## Review Focus

1. **เลือก 10 รูป 12MP พร้อมกันบนมือถือรุ่นเล็ก** — ต้องไม่ค้าง/ไม่แครช: ย่อทีละรูป (await ในลูป) ไม่ใช่ `Promise.all` · ปุ่มบันทึกบอก "กำลังย่อรูป 3/10"
2. **เพิ่มรูปตอนออฟไลน์แล้วปิดแอปก่อนส่งทัน** — เปิดใหม่ต้องส่งต่อเอง: คิวอยู่ใน IndexedDB (`pending`) + `up:false` ในงาน
3. **อีกเครื่องเพิ่มรูปแต่ยังไม่ได้ส่งขึ้น** (`up:false` ซิงก์มาถึงเครื่องนี้ ไฟล์ไม่มีทั้งในเครื่องและบนคลาวด์) — ต้องเห็นช่องรูปพร้อมป้าย "รอส่งจากเครื่องที่ถ่าย" ไม่ใช่รูปพังหรือ error
4. **สลับบัญชีระหว่างส่งรูป** — รูปของบัญชีเก่าต้องไม่ไปโผล่ในงานของบัญชีใหม่ · ส่งซ้ำแล้วเจอ "มีไฟล์อยู่แล้ว" (409) = ถือว่าสำเร็จ
5. **คลังเหลือ 2 ช่องแต่เลือกมา 5 รูป** — บันทึก 2 รูปแรก แล้วบอกตรง ๆ ว่าอีก 3 รูปไม่ได้เก็บเพราะคลังเต็ม (ไม่เงียบ ไม่ทิ้งทั้งชุด)

แต่ละข้อมีเทสต์อยู่ในงานที่เป็นเจ้าของโค้ด (ข้อ 1 → งาน 4 · ข้อ 2–5 → งาน 2–3)

---

### Task 1: bucket `task-files` + เทสต์ RLS

**Files:**
- Create: `supabase/migrations/20261031120000_task_files.sql`
- Create: `supabase/tests/task_files.test.mjs` (รูปแบบเดียวกับ `account_isolation.test.mjs`: role `anon`/`authenticated` · `auth.uid()` จาก `request.jwt.claim.sub`)

**Interfaces:**
- Produces: bucket `task-files` + policy สามข้อบน `storage.objects` ที่งาน 3 ใช้ผ่าน `sb.storage.from('task-files')`

- [ ] **Step 1: เขียนเทสต์ (ยังไม่มี migration)**

จำลอง schema `storage` ขั้นต่ำในหัวเทสต์: ตาราง `storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[])` · `storage.objects(id uuid default gen_random_uuid() primary key, bucket_id text, name text, owner uuid, created_at timestamptz default now())` เปิด RLS + grant select/insert/update/delete ให้ `authenticated`, `anon` · ฟังก์ชัน `storage.foldername(name text) returns text[]` = ทุกท่อนของ `string_to_array(name,'/')` ยกเว้นท่อนสุดท้าย (ตรงกับของ Supabase)

เคส (ชื่อเคส = ข้อความใน `ok()`):
- `bucket ปิด · 1MB · jpeg เท่านั้น` → แถว `task-files`: `public=false`, `file_size_limit=1048576`, `allowed_mime_types='{image/jpeg}'`
- `เจ้าของอัปโหลดลงโฟลเดอร์ตัวเองได้` → u1 insert `u1/fa.jpg` สำเร็จ
- `อัปโหลดลงโฟลเดอร์คนอื่นไม่ได้` → u2 insert `u1/fx.jpg` โยน error
- `คนอื่นอ่านไม่เห็น` → u2 `select count(*)` ของ `u1/%` = 0 · u1 เห็น 1
- `ไม่ล็อกอินอ่านไม่เห็น` → anon เห็น 0
- `คนอื่นลบไม่ได้ · เจ้าของลบได้` → u2 delete = 0 แถว แล้ว u1 delete = 1 แถว
- `แก้ไฟล์ไม่ได้ (ไม่มี policy update)` → u1 update name = 0 แถว
- `รัน migration ซ้ำได้` → exec ไฟล์เดิมรอบสองไม่โยน

- [ ] **Step 2: รันให้เห็นว่าตก**

Run: `node supabase/tests/task_files.test.mjs <pglite>/dist/index.js` (ติดตั้งตามหัวไฟล์ `token_purchases.test.mjs`)
Expected: ตก ที่ `bucket ปิด…` (ยังไม่มีแถว)

- [ ] **Step 3: เขียน migration** — ลอกรูปแบบจาก `20260910160000_delete_and_privacy.sql` ส่วน bucket `dm` · คอมเมนต์หัวไฟล์ภาษาไทยอธิบายว่าทำไมปิด และว่าเจ้าของต้องรันเอง

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-files', 'task-files', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "task files own upload" on storage.objects;
create policy "task files own upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "task files own read" on storage.objects;
create policy "task files own read" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "task files own delete" on storage.objects;
create policy "task files own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-files' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน** — Expected: ผ่าน 8/8
- [ ] **Step 5: เพิ่มแถวใน AGENTS.md ตารางเทสต์ PGlite** (`task_files.test.mjs` — 8/8 + วันที่) แล้ว commit

---

### Task 2: แกนข้อมูลของคลัง (ฟังก์ชันบริสุทธิ์)

**Files:**
- Create: `alt/vault.js` (ส่วนบนสุดของไฟล์ — ไม่แตะ DOM, IndexedDB หรือ Supabase)
- Create: `alt/devtools/vault-check.cjs` — โหลด `vault.js` ทั้งไฟล์ใน `vm` (รูปแบบเดียวกับ `subjects-check.cjs` · รับ argv `.` = สายราก)

**Interfaces:**
- Produces (global ใน `vault.js`):
  - `const VAULT_CAP = 300` · `const VAULT_SWEEP_GRACE_MS = 86400000` · `const VAULT_BUCKET = 'task-files'` · `const VAULT_KINDS = ['q', 'done', 'note']`
  - `vaultFiles(t) -> Array<Meta>` — `t.files` หรือ `[]` (ไม่สร้างช่องให้งานที่ไม่มีรูป)
  - `Meta = { id: string, kind: 'q'|'done'|'note', w: number, h: number, bytes: number, at: number, up: boolean }`
  - `vaultNewId() -> string` — `'f' + Date.now().toString(36) + 4 ตัวสุ่ม base36`
  - `vaultAddMeta(t, meta) -> Meta` — push ลง `t.files` (สร้าง array ถ้ายังไม่มี) คืน meta ตัวเดียวกัน
  - `vaultRemoveMeta(t, id) -> Meta|null` — เอาออกจาก `t.files` · `t.files` ว่างแล้ว = `delete t.files`
  - `vaultCount(tasks) -> { files: number, tasks: number }` — นับทุกงานรวมในถัง (`tasks` = `state.tasks`)
  - `vaultCapLeft(tasks) -> number` — `max(0, VAULT_CAP - files)`
  - `vaultSheetPlan(n, left) -> { take: number, skip: number }`
  - `vaultShrinkSize(w, h) -> { w, h }` — ด้านยาว ≤ 1600 ปัดเป็นจำนวนเต็ม ไม่ขยาย
  - `vaultPath(uid, id) -> string` — `uid + '/' + id + '.jpg'`
  - `vaultOrphans(objects, tasks, uid, nowMs) -> string[]` — `objects = [{ name: 'fa.jpg', created_at: ISO }]` (ผลของ `storage.list(uid)`) คืน path เต็มของไฟล์ที่ไม่มี `t.files` ไหนอ้างถึง (รวมงานในถัง) และ `nowMs - created_at > VAULT_SWEEP_GRACE_MS`
  - `vaultThumbState(meta, hasLocal) -> 'local'|'cloud'|'elsewhere'` — มีในเครื่อง = `local` · ไม่มีแต่ `up` = `cloud` · ไม่มีและ `!up` = `elsewhere`
  - `vaultSortTasks(tasks) -> Task[]` — งานไม่ลบ (`!t.deleted`) · มีรูปหรือ `t.note` ขึ้นก่อน → ที่เหลือตามกำหนดส่งใกล้สุด → งานเสร็จแล้วไว้ท้าย (ใหม่สุดก่อน)

- [ ] **Step 1: เขียนเทสต์ใน `vault-check.cjs`**

```js
check('ย่อด้านยาวเหลือ 1600 ไม่ขยายรูปเล็ก', () => {
  assert.deepEqual(plain(vaultShrinkSize(2400, 3200)), { w: 1200, h: 1600 });
  assert.deepEqual(plain(vaultShrinkSize(4000, 1000)), { w: 1600, h: 400 });
  assert.deepEqual(plain(vaultShrinkSize(800, 600)), { w: 800, h: 600 });
});
check('งานไม่มีรูป = ไม่มีช่อง files · ลบใบสุดท้ายแล้วช่องหาย', () => {
  const t = { id: 'a' }; assert.equal(vaultFiles(t).length, 0); assert.ok(!('files' in t));
  const m = vaultAddMeta(t, { id: 'f1', kind: 'q', w: 1, h: 1, bytes: 1, at: 1, up: false });
  assert.equal(t.files.length, 1); assert.equal(m.id, 'f1');
  assert.equal(vaultRemoveMeta(t, 'f1').id, 'f1'); assert.ok(!('files' in t));
});
check('เพดาน 300 นับงานในถังด้วย', () => {
  const many = n => Array.from({ length: n }, (_, i) => ({ id: 'f' + i, kind: 'q', up: true }));
  assert.equal(vaultCapLeft([{ files: many(200) }, { deleted: true, files: many(99) }]), 1);
  assert.equal(vaultCapLeft([{ files: many(300) }]), 0);
});
check('คลังเหลือ 2 ช่อง เลือก 5 = เก็บ 2 ข้าม 3', () => assert.deepEqual(plain(vaultSheetPlan(5, 2)), { take: 2, skip: 3 }));
check('เก็บกวาด: ไม่ลบของใหม่กว่าวัน · ไม่ลบของงานในถัง', () => {
  const now = Date.parse('2026-10-31T12:00:00Z'), old = '2026-10-29T00:00:00Z', fresh = '2026-10-31T10:00:00Z';
  const objs = [{ name: 'fa.jpg', created_at: old }, { name: 'fb.jpg', created_at: old }, { name: 'fc.jpg', created_at: fresh }, { name: 'fd.jpg', created_at: old }];
  const tasks = [{ files: [{ id: 'fa' }] }, { deleted: true, files: [{ id: 'fd' }] }];
  assert.deepEqual(plain(vaultOrphans(objs, tasks, 'u1', now)), ['u1/fb.jpg']);
});
check('ช่องรูป: ในเครื่อง · บนคลาวด์ · รอเครื่องที่ถ่าย', () => {
  assert.equal(vaultThumbState({ up: false }, true), 'local');
  assert.equal(vaultThumbState({ up: true }, false), 'cloud');
  assert.equal(vaultThumbState({ up: false }, false), 'elsewhere');
});
check('เรียงคลัง: มีรูป/โน้ตก่อน → กำหนดส่งใกล้ → เสร็จแล้วท้าย · ไม่เอางานในถัง', () => {
  const ids = vaultSortTasks([
    { id: 'done', done: true, doneAt: '2026-10-30' }, { id: 'far', due: '2026-11-20' },
    { id: 'near', due: '2026-11-01' }, { id: 'pic', due: '2026-12-01', files: [{ id: 'x' }] },
    { id: 'memo', due: '2026-12-02', note: 'ถามครู' }, { id: 'bin', deleted: true, files: [{ id: 'y' }] },
  ]).map(t => t.id);
  assert.deepEqual(plain(ids), ['pic', 'memo', 'near', 'far', 'done']);
});
```
(`plain = x => JSON.parse(JSON.stringify(x))` — ค่าจาก vm คนละ realm)

- [ ] **Step 2: รันให้เห็นว่าตก** — `node alt/devtools/vault-check.cjs` · Expected: ตกเพราะไม่มี `alt/vault.js`
- [ ] **Step 3: เขียนฟังก์ชันตาม Interfaces ใน `alt/vault.js`** พร้อมหัวไฟล์ภาษาไทย (อ้างสเปก · ทำไมรายการรูปอยู่ในงาน)
- [ ] **Step 4: รันให้ผ่าน** — Expected: `คลังงาน (ALT): 7/7`
- [ ] **Step 5: commit** (ยังไม่ copy ไปราก — งาน 4 ทำพร้อมไฟล์ CSS)

---

### Task 3: ที่เก็บในเครื่อง · ส่งขึ้น · ลบ · เก็บกวาด · ต่อเข้ากับแอป

**Files:**
- Modify: `alt/vault.js` (ส่วนที่สอง: `VaultStore` + งานคลาวด์)
- Modify: `alt/app.js` — `purgeTask` · `emptyBin` · `purgeOldTrash` · `adoptAccountIfNeeded` (ทาง `!prev`) · จุดเปิดแอป/ล็อกอิน/`online`
- Modify: `alt/safety.js` — `deleteAccount()`
- Test: `alt/devtools/vault-check.cjs` (ต่อ) · `alt/devtools/syncbench.cjs` · `alt/devtools/account-switch-check.cjs`

**Interfaces:**
- Consumes: ทุกตัวจากงาน 2 · global ของแอป `state`, `save()`, `currentUser`, `sb`
- Produces:
  - `VaultStore` — วัตถุเดียวที่แตะ IndexedDB `studentos-files` v1 (stores: `blobs` keyPath `id` index `owner` · `deletes` keyPath `path` · `meta` keyPath `key`) · เมธอด async: `getBlob(id) -> {id, owner, blob, at, pending}|null` · `putBlob(rec)` · `delBlob(id)` · `blobsOf(owner) -> rec[]` · `queueDelete(path, owner)` · `deletesOf(owner) -> {path, owner}[]` · `doneDelete(path)` · `getMeta(key)` · `setMeta(key, value)` · เทสต์แทนที่ `VaultStore` ทั้งก้อนด้วยตัวจำลองใน `vm`
  - `vaultOwner() -> string` — `currentUser ? currentUser.id : 'guest'`
  - `vaultLocalBlob(id) -> Blob|null` — คืนเฉพาะของ owner ปัจจุบัน
  - `vaultAddPhotos(taskId, blobs: {blob, w, h}[], kind) -> Promise<{ saved: number, skipped: number }>` — เคารพ `vaultSheetPlan` · ใส่ IndexedDB (`pending: true`) + `vaultAddMeta(... up:false)` + `save()` แล้วเรียก `vaultSync()` ไม่รอ
  - `vaultSync() -> Promise<void>` — ทำทีละรายการ ไม่ซ้อนกัน (กันเรียกซ้อนด้วย flag): ส่งไฟล์ `up:false` ที่มีในเครื่อง → ลบตามคิวลบ → เก็บกวาด (วันละครั้งต่อบัญชี จด `meta` key `sweep:<uid>`) · ไม่ล็อกอิน/ไม่มี `sb` = ไม่ทำอะไร
  - `vaultDeleteFile(taskId, fileId) -> Promise<void>` — ทางเดียวของ "ลบรูป" (เอาออกจากงาน + `save()` + ลบในเครื่อง + ลบบนคลาวด์ ไม่ได้ = `queueDelete`)
  - `vaultForgetTasks(tasks: Task[]) -> Promise<void>` — เรียกก่อนเอางานออกจาก `state.tasks` ถาวร
  - `vaultAdoptGuest(uid) -> Promise<void>` — `blobs` owner `'guest'` → `uid`
  - `vaultWipeCloud() -> Promise<{ left: number }>` — ลิสต์ `<uid>/` แล้วลบทั้งหมด + ล้าง `blobs` ของ owner
  - `vaultUrl(meta) -> Promise<string|null>` — ในเครื่อง = `URL.createObjectURL` (จำไว้ต่อ id) · `up` = `createSignedUrl(path, 3600)` โหลดแล้วเก็บแคชในเครื่อง · ไม่ได้ = `null`

- [ ] **Step 1: เขียนเทสต์ (ต่อใน `vault-check.cjs` · ตัวจำลอง `VaultStore` ในหน่วยความจำ + `sb.storage.from(bucket)` จำลองที่จด `upload/remove/list/createSignedUrl`)**

ชื่อเคสและสิ่งที่ตรวจ:
- `เพิ่มรูปตอนไม่มีเน็ต = ค้าง up:false แล้วส่งเองรอบหน้า` — `upload` โยน → meta `up:false` + blob `pending` · เปลี่ยนให้ `upload` สำเร็จ แล้ว `vaultSync()` → `up:true`, `pending:false`, path `'u1/<id>.jpg'`, เรียก `save()`
- `ส่งซ้ำเจอ 409 = ถือว่าขึ้นแล้ว` — `upload` คืน `{ error: { statusCode: '409' } }` → `up:true`
- `สลับบัญชีระหว่างส่ง = ไม่เขียนลงงานของบัญชีใหม่` — `currentUser` เปลี่ยนเป็น u2 ระหว่าง `upload` (resolve ทีหลัง) → งานของ u2 ไม่มี meta นั้น · `state` ของ u2 ไม่ถูก `save()` เพราะเรื่องนี้
- `ไม่ล็อกอิน = ไม่ส่งอะไรขึ้น` — `currentUser = null` → `upload` ไม่ถูกเรียก
- `คลังเหลือ 2 เลือก 5 = เก็บ 2 บอกว่าข้าม 3` — `vaultAddPhotos` คืน `{ saved: 2, skipped: 3 }` และ `t.files.length === 2`
- `ลบรูปออฟไลน์ = จดคิว แล้วลบตามทีหลัง` — `remove` โยน → `deletesOf('u1')` มี path · รอบ `vaultSync()` ถัดไป `remove` สำเร็จ → คิวว่าง
- `ลบงานถาวร = ลบรูปทุกใบของงานนั้น` — `vaultForgetTasks([t])` เรียก `remove(['u1/f1.jpg','u1/f2.jpg'])`
- `เก็บกวาดวันละครั้ง` — `list` คืน 1 ไฟล์กำพร้าเก่า → ถูกลบ · เรียก `vaultSync()` ซ้ำวันเดิม → `list` ไม่ถูกเรียกอีก
- `ใช้แบบไม่ล็อกอินแล้วล็อกอิน = รูปตามขึ้นบัญชี` — blob owner `'guest'` → `vaultAdoptGuest('u1')` → `vaultLocalBlob(id)` (ตอน `currentUser = u1`) ได้ blob
- `บัญชีอื่นเห็นรูปในเครื่องไม่ได้` — blob owner `'u1'` · `currentUser = u2` → `vaultLocalBlob(id) === null`
- `ลบบัญชี = ลบทั้งโฟลเดอร์` — `list` คืน 3 ไฟล์ → `remove` ได้ครบ 3 · คืน `{ left: 0 }` · `remove` ล้ม → `{ left: 3 }`

เพิ่มใน `syncbench.cjs`: `งานที่มี t.files: เครื่องนี้เพิ่มรูป อีกเครื่องไม่ได้แตะงานนั้น → รูปอยู่หลังรวม` (ใช้ `syncMergeById` + base ตามเคสที่มีอยู่)
เพิ่มใน `account-switch-check.cjs`: `สลับบัญชีแล้ว t.files ของบัญชีเดิมไม่ติดมา · สลับกลับแล้วกลับมาครบ`

- [ ] **Step 2: รันให้เห็นว่าตก** — `node alt/devtools/vault-check.cjs` · `node alt/devtools/syncbench.cjs` · `node alt/devtools/account-switch-check.cjs` · Expected: เคสใหม่ตกทั้งหมด (ฟังก์ชันยังไม่มี) · เคสเดิมยังผ่าน
- [ ] **Step 3: เขียน `VaultStore` + ฟังก์ชันตาม Interfaces ใน `alt/vault.js`** — `navigator.storage.persist()` ครั้งแรกที่ `putBlob` · คอมเมนต์ทุกข้อที่เป็นเหตุผล (ทำไม 409 = สำเร็จ · ทำไมเก็บกวาดรอหนึ่งวัน)
- [ ] **Step 4: ต่อเข้ากับแอป** (`alt/app.js` · `alt/safety.js`)
  - `purgeTask` · `emptyBin` · `purgeOldTrash`: เรียก `vaultForgetTasks(<งานที่กำลังจะหายถาวร>)` ก่อนกรองออก (ไม่ต้อง await ใน `purgeOldTrash`)
  - `adoptAccountIfNeeded`: ทาง `!prev` เรียก `vaultAdoptGuest(uid)` ก่อน `return 'same'`
  - เรียก `vaultSync()` หลังเปิดแอปครั้งแรก (ที่เดียวกับที่ `purgeOldTrash` ถูกเรียก) · หลังล็อกอินสำเร็จ · ตอน `window` ได้ `online`
  - `deleteAccount()`: หลัง confirm สองครั้ง → `const r = await vaultWipeCloud()` → `r.left > 0` = แจ้ง "รูปในคลังงานลบไม่หมด N รูป · บัญชีจะถูกลบต่อ" (ไม่หยุดการลบบัญชี)
  - ทุกจุดต่อเช็ค `typeof vaultSync === 'function'` (ไฟล์เก่าในแคชอาจไม่มี `vault.js`)
- [ ] **Step 5: รันทุกชุดให้ผ่าน** — vault-check · syncbench · account-switch-check · push-claim · ctx-day · `node --check alt/app.js alt/safety.js alt/vault.js`
- [ ] **Step 6: commit**

---

### Task 4: จอคลัง · หน้างาน · แผ่นเพิ่มรูป · ดูเต็มจอ (+ ลงสายราก)

**Files:**
- Create: `alt/vault.css`
- Modify: `alt/vault.js` (ส่วน UI) · `alt/index.html` (สองจอ + แผ่น + ตัวดูรูป + `<input type=file>` สองตัว + `<link>`/`<script>` + symbol `#lu-archive`) · `alt/sw.js` (precache `vault.js`, `vault.css`)
- Copy: `alt/vault.js` → `vault.js` · `alt/vault.css` → `vault.css` · แก้ `index.html` · `app.js` · `safety.js` · `sw.js` ที่รากเหมือนกันทุกจุด (รวมจุดต่อของงาน 3)
- Test: `node alt/devtools/vault-check.cjs .` · `node devtools/main-sw-check.cjs` · `node alt/devtools/sw-check.cjs` · พรีวิว

**Interfaces:**
- Consumes: งาน 2–3 ทั้งหมด · `go(id)` · `startFocus(id)` · `icon(name)` · `allSubjects()` · สีวิชาเดิมของแอป
- Produces:
  - `vaultShrink(file: File) -> Promise<{ blob: Blob, w: number, h: number }>` — ขนาดจาก `vaultShrinkSize` · canvas → JPEG 0.82 · เกิน 1MB ทำซ้ำที่ 0.7 · อ่านรูปไม่ได้ = โยน error ที่ผู้เรียกจับแล้วข้ามรูปนั้น (บอกจำนวนที่ข้ามใน toast เดียวกับเพดาน)
  - `openVault(from: 'scr-menu'|'scr-profile')` — จำ `from` ให้ปุ่มกลับ แล้ว `renderVault()` + `go('scr-vault')`
  - `renderVault()` · `vaultPickSubject(name|null)`
  - `openVaultTask(id: string, hiKind?: 'q'|'done'|'note')` — `go('scr-vault-task')` · ไฮไลต์กลุ่มที่ส่งมา
  - `vaultPick(kind)` — เปิด `<input type=file accept="image/* multiple">` ต้องถูกเรียกจากการแตะเท่านั้น
  - `vaultView(fileId)` — ตัวดูรูปเต็มจอ ซ้อนได้ทั้งบนหน้างานและบนโหมดโฟกัส
  - `vaultPaintRow()` — เขียนบรรทัดรอง "N รูป · M งาน" ของแถวในแท็บ "ฉัน" (`#peVaultCt`)

- [ ] **Step 1: เขียนจอตามต้นแบบ** — markup/CSS ย้ายจาก `2026-10-31-task-vault-prototype.html` (คลาสขึ้นต้น `vt-` กันชนกับแอป · สีจากโทเคนธีมของแอป ไม่ใช่สีตายตัวของต้นแบบ · ปุ่มกลับใช้ `.sh-btn` ของแอป) · ย่อรูปทีละรูปใน `await` ลูป ปุ่มบันทึกขึ้น `กำลังย่อรูป i/n` (Review Focus 1) · ข้ามเกินเพดานขึ้น toast `คลังเต็ม · เก็บ 2 รูป ไม่ได้เก็บ 3 รูป` · ช่องรูปสถานะ `elsewhere` ขึ้นป้าย `รอส่งจากเครื่องที่ถ่าย` · ลบรูปแตะสองครั้ง (`แตะอีกครั้งเพื่อลบ`) · "จดไว้" บันทึกลง `t.note` หลังหยุดพิมพ์ 400ms แล้ว `save()`
- [ ] **Step 2: precache + symbol + ลำดับสคริปต์** — `vault.js` ต่อจาก `events.js` ก่อน `app.js` · `<link href="vault.css">` ต่อจาก `classrooms.css` · `#lu-archive` path จาก Lucide (ISC)
- [ ] **Step 3: copy ลงสายราก** แล้วตรวจ: `cmp alt/vault.js vault.js && cmp alt/vault.css vault.css` · diff ของ `app.js`/`index.html`/`safety.js` สมมาตร (คำสั่งใน Global Constraints)
- [ ] **Step 4: รันเทสต์** — `vault-check` ทั้งสองสาย · `sw-check` 14/14 · `main-sw-check` 14/14 · ชุดเดิมทั้งหมดตาม AGENTS.md
- [ ] **Step 5: ตรวจในพรีวิวทั้งสองสาย** (เรียก `openVault('scr-profile')` จากคอนโซลได้ เพราะทางเข้าทำในงาน 5) — เพิ่ม 3 รูป → รีโหลด → ยังอยู่ · ดูเต็มจอ ปัด ลบ · โน้ตรอดรีโหลด · bucket ยังไม่มี = รูปค้าง `up:false` ไม่มี error ค้างบนจอ · 375×812 และจอกว้าง · ภาพหน้าจอเป็นหลักฐาน
- [ ] **Step 6: commit**

---

### Task 5: ทางเข้า — ไทล์ 4×2 (+อันดับ +คลังงาน) · แถวแท็บ "ฉัน" · Feature Manager

**Files:**
- Modify: `alt/app.js` + `app.js` — `toolsGrid()`: **(แก้ 1 พ.ย. 69)** คงสถิติไว้ · เพิ่ม `['trophy', 'อันดับ', 'in', "openBoard('scr-menu')", '', false]` ต่อจากกล่องเข้า และ `['archive', 'คลังงาน', 'me', "openVault('scr-menu')", '', false, 'vault']` ต่อจากร้านค้า · กริดหน้าแรกเป็น 4 คอลัมน์ (คอมเมนต์คำเจ้าของ + ว่าสถิติยังอยู่ที่แท็บ "ฉัน") · `renderProfile()` เรียก `vaultPaintRow()`
- Modify: `alt/index.html` + `index.html` — แถว `<button class="pe" id="peVault" onclick="openVault('scr-profile')">` ไอคอน `#lu-archive` · ป้าย `คลังงาน` · `<em class="pe-v" id="peVaultCt">` วางต่อจาก "วิชาของฉัน"
- Modify: `alt/control.js` — `FEAT_META` เพิ่ม `['vault', 'คลังงาน', 'ปิด = ซ่อนไทล์และแถว "คลังงาน" · แถวดูโจทย์ · ปุ่มถ่ายงานที่ทำเสร็จ', 1]` (รากไม่มีไฟล์นี้)

- [ ] **Step 1: เพิ่มเคสใน `vault-check.cjs`** — ตัด `toolsGrid` จาก `app.js` ด้วย stub (`sosFeature`, `homeBlockOn`, `icon` …) แล้วตรวจ: `8 ไทล์ ลำดับ ข้อความ·เพื่อนฉัน·กล่องเข้า·อันดับ / สถิติ·ของสะสม·ร้านค้า·คลังงาน` · `ปิดฟีเจอร์ vault = ไม่มีไทล์คลังงาน` · ทั้งสองสาย
- [ ] **Step 2: รันให้เห็นว่าตก**
- [ ] **Step 3: แก้ตามรายการ Files** (แถวในแท็บ "ฉัน" ซ่อนด้วย `hidden` เมื่อ `!sosFeature('vault')` ตอน `vaultPaintRow`)
- [ ] **Step 4: รันให้ผ่าน + ตรวจพรีวิว** — หน้าแรกไม่ต้องเลื่อนที่ 375×812 ทุกธีม (วัด `scrollHeight <= clientHeight` ของ `scr-menu`) · ไทล์คลังงานอยู่แถวล่างใบแรก · แตะแล้วเปิดคลัง · ปุ่มกลับพากลับหน้าแรก/แท็บ "ฉัน" ตามที่มา
- [ ] **Step 5: commit**

---

### Task 6: โหมดโฟกัส — "ดูโจทย์" และ "ถ่ายงานที่ทำเสร็จ"

**Files:**
- Modify: `alt/vault.js` + `vault.js` — `vaultFocusPeek(t) -> string` (HTML แถว "ดูโจทย์": รูปแรกของ `q` + `โจทย์ N รูป` + ปุ่ม `ดูโจทย์` → `vaultView(id)` · ไม่มีรูป `q` หรือปิดฟีเจอร์ = `''`)
- Modify: `alt/app.js` + `app.js` — `renderFocus()` แทรก `vaultFocusPeek(t)` · จอเสร็จใน `finishFocus()` เพิ่มปุ่มรอง `ถ่ายงานที่ทำเสร็จ` เมื่อ `sosFeature('vault')` และงานยังไม่มีรูป `done` → `closeFocus(); openVaultTask(id, 'done'); vaultPick('done')`
- Test: `vault-check.cjs`

- [ ] **Step 1: เพิ่มเคส** — `ไม่มีรูปโจทย์ = จอโฟกัสเหมือนเดิม (คืน '')` · `มีโจทย์ 2 รูป = แถวบอก "โจทย์ 2 รูป"` · `ปิดฟีเจอร์ = ''`
- [ ] **Step 2: รันให้เห็นว่าตก**
- [ ] **Step 3: เขียน `vaultFocusPeek` + ต่อสองจุดใน `app.js`** — ปุ่มรองต้องไม่แทรกก่อนหรือแทนที่ "งานถัดไป" (ลูกโซ่หลักของวิสัยทัศน์) · ตัวชี้วัดของสเปกข้อ 1: แตะ "ดูโจทย์" = `state.settings.vaultStats.peek += 1` แล้ว `save()` (ไม่ส่งรูปหรือชื่องานไปไหน · เคสใน vault-check: `แตะดูโจทย์ = นับเพิ่มหนึ่ง`)
- [ ] **Step 4: รันให้ผ่าน + ตรวจพรีวิว** — เริ่มทำงานที่มีรูปโจทย์ → แถวดูโจทย์ → เปิดรูปแล้วเวลาไม่หยุด · กดเสร็จ → ปุ่ม "ถ่ายงานที่ทำเสร็จ" อยู่ใต้ "งานถัดไป" · งานไม่มีรูป = จอโฟกัสเหมือนก่อนทำทุกอย่าง (เทียบภาพหน้าจอก่อน/หลัง)
- [ ] **Step 5: commit**

---

### Task 8: พอร์ต + PDF (เพิ่ม 1 พ.ย. 69 · สเปกข้อ 10)

**Files:** `alt/vault.js` + `vault.js` (ส่วนพอร์ต) · `vault.css` · `index.html` สองสาย (จอ `scr-vault-port` · `scr-vault-item` · `scr-vault-pdf`) · `vault-check.cjs`

**Interfaces:**
- Produces: `PORT_CATS` (6 หมวด `essay·letter·project·activity·award·extra`) · `PORT_CAP = 40` · `PORT_PDF_MAX = 10` · `state.portfolio: Item[]` (`{ id, cat, title, date, role, desc, files: Meta[], from?, at }`) · `portAdd(fields) -> Item|null` · `portFromTask(taskId) -> Item|null` · `portCopyText(item) -> string` · `portPdfPages(n) -> number` (`n ? n + 1 : 0`) · `portBuildPdf(pages: {jpeg, w, h}[]) -> Blob`
- รูปพอร์ตใช้ `Meta` ชุดเดียวกับรูปงาน (`kind: 'port'`) · ส่งขึ้น/ลบ/เก็บกวาดผ่านคิวเดียวกัน · `vaultOrphans` นับรูปในพอร์ตว่ามีเจ้าของ

- [ ] **Step 1: เคสใน vault-check** — `พอร์ตเต็ม 40 = ไม่เพิ่ม` · `ส่งงานที่ทำเสร็จเข้าพอร์ต = ชื่องาน + รูป done` · `คัดลอกข้อความ = ชื่อ / วันที่ · บทบาท / เล่า` · `PDF ทุกตำแหน่งใน xref ชี้ "N 0 obj" · บรรทัดละ 20 ไบต์` · `เก็บกวาดไม่ลบรูปของพอร์ต`
- [ ] **Step 2: รันให้เห็นว่าตก**
- [ ] **Step 3: เขียนตามต้นแบบ** (จอ + PDF ลอกจากต้นแบบ · ชื่อในเครื่องสำหรับปกเก็บใน `state.settings.portName/portProg`)
- [ ] **Step 4: รันให้ผ่าน + ตรวจพรีวิว** (สร้าง PDF จริง 1 ไฟล์ ตรวจหัว/ท้าย/xref)
- [ ] **Step 5: commit**

---

### Task 7: ปิดงาน

- [ ] **Step 1: รันทุกชุดใน AGENTS.md ทั้งสองสาย** + เทียบตัวเลขกับก่อนเริ่ม (halloween 273 · ราก 106 · economy 23 · sync 36 · account 33 · ฯลฯ — ตัวเลขต้องไม่ลด)
- [ ] **Step 2: อัปเดต AGENTS.md** — แถว `vault-check.cjs` ในตารางเทสต์ · บรรทัดลำดับสคริปต์เพิ่ม `vault.js` · "Current Priority" ไม่แตะ
- [ ] **Step 3: แพตช์โน้ตภาษาไทย** ใน `alt/PATCHNOTES.md` และ `MAIN-PATCHNOTES.md` หัวข้อ "รุ่นถัดไป · รอชื่อจากเจ้าของ" (บอกตรง ๆ ว่ารูปยังไม่ขึ้นคลาวด์จนเจ้าของรัน migration)
- [ ] **Step 4: commit · ไม่ push** · บอกเจ้าของสามอย่าง: รัน `supabase/migrations/20261031120000_task_files.sql` · ตั้งชื่อรุ่น · สั่ง "ลง" เมื่อพร้อม
