# ============================================================
# ก๊อปงานจาก alt/ ขึ้นบิลด์ตัวจริงที่ราก แล้วคืน "ตัวตน" ของตัวจริงกลับ
# ------------------------------------------------------------
# สองบิลด์นี้ต่างกันแค่ชื่อกับไอคอน ไม่ได้ต่างกันที่ฟีเจอร์ การซิงก์จึงเป็นการ
# ก๊อปทับแล้วแก้กลับไม่กี่จุด — แต่ "ไม่กี่จุด" นั้นพลาดแล้วเจ็บทุกจุด
#
# ⚠️ บทเรียนจากรอบ 1A7V2 → 1A9f (ตัวจริงค้างอยู่ 8 รุ่น โดยไม่มีอะไรบอก):
#    รายชื่อไฟล์เคยเขียนตายตัวไว้ในสคริปต์ พอ alt/ มีไฟล์ใหม่ (today.css, planner.js)
#    รายชื่อก็ไม่ตามไปด้วย · ซิงก์แล้วตัวจริงจะได้ index.html ที่อ้างไฟล์ที่ไม่มีอยู่
#    ตอนนี้จึงอ่านรายชื่อจาก <script src> / <link href> ใน alt/index.html เอาเอง
#    ไฟล์ใหม่ที่หน้าเรียกใช้ ถูกก๊อปตามอัตโนมัติโดยไม่ต้องมาแก้สคริปต์อีก
#
# ไฟล์ที่ไม่ยุ่ง: manifest.json · config.js (แต่ละสายมีตัวตน/คีย์ของตัวเอง)
#                sw.js ก๊อปไม่ได้ (SHELL คนละชุด) แต่สคริปต์ขึ้นเลข cache ให้
# ⛔ ปิดแล้ว (21 ต.ค. 69 · เจ้าของสั่ง "อย่าเอา alt ไปรวมกับแอปหลัก")
#    รันเฉย ๆ จะหยุดทันทีโดยไม่เขียนไฟล์ไหนเลย — ALT กับแอปหลักแยกกันเดินแล้ว
#    เหลือไว้แค่ --dry-run (ดูอย่างเดียว) · จะเปิดกลับต้องให้เจ้าของสั่งเท่านั้น
# วิธีใช้:  python sync-to-root.py --dry-run   ← ดูว่าจะก๊อปอะไร + ชื่อ cache โดยไม่เขียนไฟล์ไหนเลย
# ============================================================
import io, os, re, sys, time

ROOT = os.path.dirname(os.path.abspath(__file__))
ALT = os.path.join(ROOT, 'alt')

# แต่ละสายมีของตัวเอง — ห้ามก๊อปทับ
PER_CHANNEL = {'manifest.json', 'config.js', 'sw.js'}
# มีเฉพาะบิลด์ทดลอง — ตัวจริงไม่มีไฟล์ (ก๊อปขึ้นไปก็ได้ปุ่มลอย "แก้ดีไซน์" ติดมาด้วย)
# icon-alt-* คือไอคอนที่มีแถบ ALT คาด — ตัวจริงต้องได้ icon-*.png ธรรมดาแทน
# (index.html ถูกแก้กลับให้อ้าง icon-192.png อยู่แล้วในตาราง IDENTITY ข้างล่าง)
ALT_ONLY = {'visual-editor.js', 'icon-alt-192.png', 'icon-alt-512.png'}
# ของที่ตัวจริงเป็นเจ้าของเอง — มีทั้งสองฝั่งแต่ห้ามก๊อปทับ
# เจ้าของเลือกเก็บโต๊ะทำงานจอใหญ่ (desktop workspace) ของ ALT ไว้นอกเว็บหลัก (ดู 6c1813f)
# ตัวจริงจึงใช้เลย์เอาต์จอใหญ่ชุดของตัวเอง · แต่ alt/index.html เรียก desktop.css กับ
# desktop-entry.js อยู่ สคริปต์เลยเคยก๊อปสองตัวนั้นทับของตัวจริงเงียบ ๆ ทุกรอบ
# (desktop.js กับ desktop-navigation.mjs ใส่ไว้ด้วย กันวันที่ alt เริ่มเรียกมันตรง ๆ)
ROOT_OWNED = {'desktop.css', 'desktop.js', 'desktop-entry.js', 'desktop-navigation.mjs'}
SKIP = PER_CHANNEL | ALT_ONLY | ROOT_OWNED

# ⚠️ บทเรียนจากรอบ ca2694b (โลโก้ใหม่ขึ้นแต่ alt/ ตัวจริงค้างโลโก้เก่า 6 วัน):
#    สคริปต์เคยก๊อปแค่ .js กับ .css รูปจึงไม่เคยตามขึ้นไป — และรูปเป็นของที่
#    "ชื่อไฟล์เดิมทุกไฟล์" เวลาเปลี่ยน จึงไม่มีอะไรบนหน้าจอบอกว่ามันค้าง
#    ตอนนี้รูปที่หน้าเรียกใช้ถูกก๊อปตามอัตโนมัติแล้ว ส่วนสองตัวข้างล่างต้องระบุเอง
#    เพราะตัวจริงอ้างถึงมันผ่าน IDENTITY เท่านั้น (ฝั่ง alt เขียนว่า icon-alt-*)
#    logo-mark.png ก็เช่นกัน — ไม่มีหน้าไหนอ้างถึงแล้ว แต่ยังอยู่ใน SHELL ของ sw.js
#    ทั้งสองสาย มันจึงถูกโหลดลงแคชจริง ปล่อยค้างไว้ = เสิร์ฟไฟล์เก่าโดยไม่มีใครเห็น
ALWAYS = ['icon-192.png', 'icon-512.png', 'logo-mark.png',
          # ประตูภายนอก — เข้าจาก URL ตรง/QR/bio เท่านั้น ไม่มีที่ไหนในแอปลิงก์ถึง
          # จึงไม่โดนกลไก linked_pages() ตามเจอ ต้องระบุตรงนี้ไว้ตายตัว
          'hub.html',
          # นโยบายความเป็นส่วนตัว — Google เปิดจากหน้าขอสิทธิ์ (OAuth consent screen)
          # ไม่มีหน้าไหนในแอปลิงก์ถึง จึงไม่เคยถูกก๊อปขึ้นราก ทั้งที่เว็บหลักคือราก
          'privacy.html']

# (ไฟล์, ข้อความในเวอร์ชัน alt, ข้อความที่ตัวจริงต้องได้)
# ที่เหลืออยู่มีแค่ไอคอน — <title>, ชื่อแอปบนจอโฮม, APP_CHANNEL และคำว่า
# "รุ่นทดลองฟีเจอร์" ตรงกันสองสายแล้วตั้งแต่ 1A7V2 จึงไม่ต้องแก้กลับอีก
IDENTITY = [
    ('index.html',
     '<link rel="icon" href="icon-alt-192.png">',
     '<link rel="icon" href="icon-192.png">'),
    ('index.html',
     '<link rel="apple-touch-icon" href="icon-alt-192.png">',
     '<link rel="apple-touch-icon" href="icon-192.png">'),
    # ไอคอนบนซองแจ้งเตือน — ค้างเป็น icon-alt-* มาตั้งแต่ก่อน 1A9w
    # ตัวจริงไม่มีไฟล์นั้น (อยู่ใน ALT_ONLY) การแจ้งเตือนจึงขอไฟล์ที่ไม่มีอยู่มาตลอด
    # ไม่เคยมีอะไรฟ้อง เพราะเบราว์เซอร์เงียบ ๆ ใช้ไอคอนสำรองแทนให้
    ('app.js',
     "icon: 'icon-alt-192.png', badge: 'icon-alt-192.png',",
     "icon: 'icon-192.png', badge: 'icon-192.png',"),
    # ข่าวสารจากทีม (15 ต.ค. 69) — ไฟล์ข่าวอยู่ที่ alt/news/ ที่เดียว ตัวจริงต้องอ่านข้ามโฟลเดอร์
    # ไม่ก๊อป news/ ขึ้นราก: สองชุด = เพิ่มข่าวทีต้องซิงก์ทุกครั้ง ไม่งั้นมือถือเห็นข่าวไม่ตรงกับเว็บ
    ('news.js',
     "const NEWS_BASE = '';",
     "const NEWS_BASE = 'alt/';"),
]


# นามสกุลที่ถือว่าเป็น "ของที่หน้าเรียกใช้" — รูปอยู่ในนี้ด้วย ไม่ใช่แค่โค้ด
ASSETS = ('.js', '.css', '.png', '.svg', '.webp', '.ico', '.jpg', '.jpeg')



# ---------- ของที่ถูกอ้างจาก .js ไม่ใช่จาก index.html ----------
# local_refs() มองเห็นเฉพาะ src="/href=" ในหน้า HTML · ไฟล์ที่โค้ดเรียกเองตอนรัน
# (เช่น 'sai-chibi.webp' ที่เป็นสตริงอยู่ใน sai.js) จึงไม่เคยถูกก๊อปขึ้นราก
# อาการคือรูปแตกเฉพาะบนตัวจริง โดยที่ alt/ ปกติดีทุกอย่าง — ซึ่งเป็นบั๊กพันธุ์เดียวกับ
# ที่สคริปต์นี้เจ็บมาแล้วสองรอบ (โลโก้ค้างหกวัน · land.html อ้าง logo-lockup.svg)
# ครั้งก่อนแก้ด้วยการเติมชื่อไฟล์ลง ALWAYS ทีละตัว ซึ่งพังอีกแน่ตอนมีไฟล์ใหม่
# รอบนี้สแกนหาเอง: สตริงในเครื่องหมายคำพูดที่ลงท้ายด้วยนามสกุลสื่อ และมีไฟล์อยู่จริงใน alt/
def js_assets(js):
    out = []
    for m in re.finditer(r"['\"]([A-Za-z0-9_.-]+\.(?:png|svg|webp|jpg|jpeg|ico|gif))['\"]", js):
        out.append(m.group(1))
    return out

# ไฟล์สื่อที่ CSS เรียกผ่าน url() — สคริปต์เคยมองแค่ index.html กับสตริงใน .js
# ภาพพื้นหลังของธีม (astral-bg.png ใน alt.css) จึงไม่เคยถูกก๊อปขึ้นราก แล้วตัวจริงได้ธีมไม่มีภาพ
# โดยไม่มีอะไรฟ้อง — บั๊กพันธุ์เดียวกับโลโก้ค้างหกวันที่หัวไฟล์นี้เล่าไว้
def css_assets(css):
    out = []
    for m in re.finditer(r"url\(\s*['\"]?([A-Za-z0-9_.-]+\.(?:png|svg|webp|jpg|jpeg|gif))['\"]?\s*\)", css):
        out.append(m.group(1))
    return out

def local_refs(html):
    """ชื่อไฟล์ในโฟลเดอร์เดียวกันที่หน้านี้เรียกใช้จริง (ไม่นับที่คอมเมนต์ทิ้ง)"""
    live = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    out = []
    for m in re.finditer(r'(?:src|href)="([^"]+)"', live):
        v = m.group(1)
        if '/' in v or v.startswith(('http', '#', 'data:')):
            continue
        # ⚠️ บทเรียน 21 ต.ค. 69: alt/index.html เรียก app.js?v=20261016-main-notifications
        #    ตัว ?v= ทำให้ไม่ลงท้ายด้วย .js แล้ว app.js ถูกข้ามไปทั้งไฟล์ (การแก้ IDENTITY ก็ข้ามตาม)
        #    ตัวจริงจึงได้ index.html ใหม่คู่กับ app.js เก่า · ตัด ?… และ #… ทิ้งก่อนเทียบ
        #    แล้วคืนแค่ชื่อไฟล์เปล่า — ส่วน ?v= ใน index.html ยังอยู่เหมือนเดิม (ไม่ได้แก้หน้าเว็บ)
        v = re.split(r'[?#]', v, maxsplit=1)[0]
        if v.endswith(ASSETS):
            out.append(v)
    return out


# หน้าเว็บอื่นที่ index.html ลิงก์ถึง (ตอนนี้คือหน้าแนะนำ land.html)
# ต้องขึ้นรากตามด้วย ไม่งั้นลิงก์ "แอปนี้คืออะไร" บนจอล็อกอินของตัวจริงจะพาไป 404
# — ซึ่งเป็นความพลาดพันธุ์เดียวกับที่สคริปต์นี้เคยเจ็บมาแล้วสองรอบ: หน้าอ้างของ
# ที่ไม่ได้ถูกก๊อปตามขึ้นไป แล้วไม่มีอะไรบอกจนกว่าจะมีคนกดจริง
def linked_pages(html):
    live = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    return [m.group(1) for m in re.finditer(r'href="([^"/#]+\.html)"', live)]


# ชื่อ cache ของตัวจริง — ต้องขึ้นต้นด้วย studentos-main- เสมอ
# ⚠️ บทเรียน 21 ต.ค. 69: สคริปต์เคยเขียนทับเป็น studentos-<รุ่น> (เช่น studentos-1c60)
#    แต่ sw.js ของตัวจริงใช้คำนำหน้า studentos-main- ไว้แยกตัวเองออกจาก studentos-alt-*
#    ที่อยู่โดเมนเดียวกัน (devtools/main-sw-check.cjs เช็คข้อนี้) · ชื่อผิดคำนำหน้า =
#    รอบหน้าตัวจริงอาจลบแคชผิดตัว หรือไม่ลบแคชเก่าของตัวเอง
# ต่อท้ายด้วยวันที่ซิงก์ — รุ่นเดิมแต่ซิงก์ข้ามวัน ชื่อก็ยังเปลี่ยน เครื่องที่ติดตั้งไว้จึงได้ของใหม่
def cache_name(app_js):
    ver = re.search(r"APP_VERSION\s*=\s*'([^']+)'", app_js)
    code = re.search(r"APP_CODENAME\s*=\s*'([^']*)'", app_js)   # ว่างได้ — รุ่นที่เจ้าของไม่ตั้งชื่อเล่น
    if not (ver and code):
        return None
    parts = (ver.group(1).lower(), code.group(1).lower(), time.strftime('%Y%m%d'))
    return 'studentos-main-' + '-'.join(x for x in parts if x)


def main():
    # คอนโซล Windows ไทยเป็น cp874 พิมพ์คอมเมนต์ที่มีอักขระนอกตารางแล้วสคริปต์ตายกลางทาง
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    dry = '--dry-run' in sys.argv[1:]
    if not dry:
        # ด่านนี้ต้องอยู่ก่อนบรรทัดไหนก็ตามที่เขียนไฟล์ — ห้ามย้ายลงไปข้างล่าง
        print('⛔ sync-to-root.py ถูกปิดแล้ว (21 ต.ค. 69): เจ้าของไม่ให้เอา ALT ไปรวมกับแอปหลัก')
        print('   ไม่ได้ก๊อปหรือแก้ไฟล์ไหนเลย · ดูอย่างเดียวได้ด้วย --dry-run')
        sys.exit(2)
    alt_html = io.open(os.path.join(ALT, 'index.html'), encoding='utf-8', newline='').read()
    files = ['index.html'] + ALWAYS + [f for f in local_refs(alt_html)
                                       if f not in SKIP]

    # หน้าที่ถูกลิงก์ + ของที่หน้านั้นเรียกใช้เอง (เช่น land.html ใช้ logo-lockup.svg
    # ซึ่ง index.html ไม่ได้อ้างถึงเลย จึงไม่เคยถูกก๊อปตามขึ้นไป)
    for pg in linked_pages(alt_html):
        src = os.path.join(ALT, pg)
        if not os.path.exists(src):
            continue
        files.append(pg)
        files += [f for f in local_refs(io.open(src, encoding='utf-8').read())
                  if f not in SKIP]

    # ไฟล์สื่อที่โค้ดเรียกเองตอนรัน — ต้องหาให้เจอก่อนเริ่มก๊อป
    for js in [f for f in files if f.endswith('.js')]:
        src = os.path.join(ALT, js)
        if not os.path.exists(src):
            continue
        for a in js_assets(io.open(src, encoding='utf-8', errors='replace').read()):
            if a in SKIP:
                continue
            if os.path.exists(os.path.join(ALT, a)):
                files.append(a)

    for css in [f for f in files if f.endswith('.css')]:
        src = os.path.join(ALT, css)
        if not os.path.exists(src):
            continue
        for a in css_assets(io.open(src, encoding='utf-8', errors='replace').read()):
            if a in SKIP:
                continue
            if os.path.exists(os.path.join(ALT, a)):
                files.append(a)

    if dry:
        # ดูอย่างเดียว ไม่เขียนอะไรลงดิสก์ · ชื่อ cache คิดจาก alt/app.js
        # เพราะรอบจริง app.js ของรากจะถูกก๊อปทับด้วยตัวนี้ก่อนถึงขั้นขึ้นเลข cache
        names = [n for n in dict.fromkeys(files) if os.path.exists(os.path.join(ALT, n))]
        print('[dry-run] จะก๊อป %d ไฟล์ (ไม่ได้เขียนจริง):' % len(names))
        for n in names:
            print('   ' + n + ('' if os.path.exists(os.path.join(ROOT, n)) else '   ← ไฟล์ใหม่ที่ราก'))
        print('[dry-run] ไม่ก๊อป (ตัวจริงเป็นเจ้าของ): ' + ', '.join(sorted(ROOT_OWNED)))
        want = cache_name(io.open(os.path.join(ALT, 'app.js'), encoding='utf-8', newline='').read())
        print('[dry-run] cache ของตัวจริงจะเป็น: ' + (want or '(หา APP_VERSION/APP_CODENAME ไม่เจอ — จะไม่ขึ้นเลข)'))
        return

    copied, added = [], []
    for name in dict.fromkeys(files):          # กันชื่อซ้ำ แต่คงลำดับไว้
        src = os.path.join(ALT, name)
        if not os.path.exists(src):
            continue
        dst = os.path.join(ROOT, name)
        if not os.path.exists(dst):
            added.append(name)
        open(dst, 'wb').write(open(src, 'rb').read())
        copied.append(name)

    problems = []
    for name, alt_text, root_text in IDENTITY:
        if name not in copied:
            continue
        p = os.path.join(ROOT, name)
        s = io.open(p, encoding='utf-8', newline='').read()
        # ไฟล์ในโปรเจกต์นี้ลงท้ายบรรทัดด้วย CRLF แต่สตริงในสคริปต์เป็น LF
        # ข้อความหลายบรรทัดจึงหากันไม่เจอถ้าไม่แปลงก่อน (พลาดมาแล้วรอบแรก)
        if '\r\n' in s:
            alt_text = alt_text.replace('\n', '\r\n')
            root_text = root_text.replace('\n', '\r\n')
        if alt_text not in s and root_text in s:
            # ฝั่ง alt เลิกเขียนแบบ alt ไปแล้ว (เช่น icon-alt-* ถูกถอดตั้งแต่ QA 6 ต.ค. 69)
            # และไฟล์ที่ก๊อปมาก็มีหน้าตาของตัวจริงอยู่แล้ว = ไม่มีอะไรต้องแก้กลับ ไม่ใช่ปัญหา
            # (15 ต.ค. 69 · เดิมฟ้องสามข้อนี้ทุกรอบแล้วจบด้วย exit 1 ทั้งที่ผลถูก — ฟ้องผิดบ่อย ๆ = วันหนึ่งคนเลิกอ่าน)
            continue
        if alt_text not in s:
            # ของที่หาไม่เจอแปลว่าไฟล์ฝั่ง alt เปลี่ยนหน้าตาไปแล้ว — ต้องรู้ทันที
            # ไม่ใช่ปล่อยผ่านเงียบ ๆ แล้วไปเจอตอนตัวจริงขึ้นชื่อว่า ALT บนเว็บ
            problems.append(name + ' ยังหาข้อความที่ต้องแก้กลับไม่เจอ: ' + alt_text[:60])
            continue
        io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(alt_text, root_text))

    # ---------- sw.js: ขึ้นเลข cache + SHELL ต้องครบ ----------
    # ก๊อปไฟล์ทับแล้วแต่ไม่ขึ้นเลข cache = เครื่องที่ติดตั้งแอปไว้แล้วเสิร์ฟของเก่าต่อไป
    # เงียบ ๆ ซึ่งคือ "แก้แล้วแต่บนมือถือเหมือนเดิม" ที่หาสาเหตุยากที่สุดในโปรเจกต์นี้
    want = cache_name(io.open(os.path.join(ROOT, 'app.js'), encoding='utf-8', newline='').read())
    swp = os.path.join(ROOT, 'sw.js')
    sw = io.open(swp, encoding='utf-8', newline='').read()
    if want:
        sw2 = re.sub(r"(const CACHE = ')[^']+(')", lambda m: m.group(1) + want + m.group(2), sw, count=1)
        if sw2 != sw:
            io.open(swp, 'w', encoding='utf-8', newline='').write(sw2)
            sw = sw2
        print('cache ของตัวจริง: ' + want)

    root_html = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8', newline='').read()
    shell = re.search(r'const SHELL = \[(.*?)\];', sw, flags=re.S)
    listed = set(re.findall(r"'([^']+)'", shell.group(1))) if shell else set()

    # ---------- เติมไฟล์ใหม่ลง SHELL ให้เอง ----------
    # ⚠️ บทเรียนรอบที่สาม (13 ก.ย. 2569): สคริปต์เคย "ฟ้องแล้วจบ" ตรงนี้ แล้วคนที่รัน
    #    ต้องไปไล่เติมชื่อไฟล์ทีละตัวในมือเอง — สิบเก้าไฟล์ในรอบ 1B15→1B91
    #    ขั้นตอนมือที่ต้องทำทุกครั้งคือขั้นตอนที่วันหนึ่งจะถูกลืม แล้วผลของการลืมคือ
    #    "เปิดแอปตอนไม่มีเน็ตแล้วจอขาว" ซึ่งไม่มีอะไรบนหน้าจอบอกสาเหตุเลย
    #
    #    เติมได้อย่างปลอดภัยเพราะเงื่อนไขแคบมาก: ต้องเป็นไฟล์ที่ index.html ของตัวจริง
    #    อ้างถึงจริง **และ** มีอยู่จริงที่ราก (เช็คไปแล้วในลูปข้างล่าง) — สองข้อนี้คือ
    #    นิยามของ "ไฟล์ที่ต้องอยู่ใน SHELL" พอดี ไม่ได้เดาแทนคน
    #    splash-* ยังถูกยกเว้นเหมือนเดิม (iOS โหลดตอนติดตั้ง ไม่ได้โหลดผ่านหน้าเว็บ)
    #    เติมของที่ .js เรียกเองด้วย (ดู js_assets) — ไฟล์พวกนี้ index.html ไม่ได้อ้างถึง
    #    แต่แอปขอมันตอนรัน ถ้าไม่อยู่ใน SHELL = เปิดตอนไม่มีเน็ตแล้วรูปแตกเป็นกรอบเปล่า
    want_shell = list(local_refs(root_html))
    for js in [f for f in copied if f.endswith('.js')]:
        jp = os.path.join(ROOT, js)
        if os.path.exists(jp):
            want_shell += js_assets(io.open(jp, encoding='utf-8', errors='replace').read())
    missing = [f for f in dict.fromkeys(want_shell)
               if f not in listed and not f.startswith('splash-')
               and f not in ALT_ONLY
               and os.path.exists(os.path.join(ROOT, f))]
    if missing and shell:
        # แทรกก่อน manifest.json ถ้ามี ไม่งั้นต่อท้ายบรรทัดแรกของลิสต์
        add = ''.join("'%s', " % f for f in missing)
        body = shell.group(1)
        if "'manifest.json'" in body:
            body2 = body.replace("'manifest.json'", add + "'manifest.json'", 1)
        else:
            body2 = body.rstrip() + ',{}  '.format(chr(10)) + add.rstrip(', ')
        sw = sw.replace(shell.group(0), 'const SHELL = [' + body2 + '];', 1)
        io.open(swp, 'w', encoding='utf-8', newline='').write(sw)
        listed |= set(missing)
        print('เติมลง SHELL ให้แล้ว: ' + ', '.join(missing))

    for f in local_refs(root_html):
        # addAll ล้มทั้งก้อนถ้ามีตัวใดตัวหนึ่ง 404 แล้วแอปจะไม่มีแคชเลยโดยไม่มี error โผล่
        if not os.path.exists(os.path.join(ROOT, f)):
            problems.append('index.html ของตัวจริงอ้าง %s แต่ไฟล์ไม่มีอยู่ที่ราก' % f)
        elif f.startswith('splash-'):
            # จอคั่นเป็นข้อยกเว้นเดียวที่ไม่ต้องอยู่ใน SHELL: iOS โหลดไฟล์พวกนี้ตอน
            # ติดตั้งแอป ไม่ได้โหลดผ่านหน้าเว็บ และเครื่องหนึ่งใช้แค่ไฟล์เดียวจากสิบเอ็ดไฟล์
            # เอาเข้า SHELL = ดาวน์โหลด 700KB ทิ้งทุกเครื่องเพื่อใช้จริง 70KB
            continue
        elif f not in listed:
            problems.append('%s ไม่อยู่ใน SHELL ของ sw.js — ออฟไลน์แล้วไฟล์นี้จะหายไปเงียบ ๆ' % f)
    for bad in re.findall(r'icon-alt-[\w.]+', root_html):
        problems.append('index.html ของตัวจริงยังอ้าง %s ซึ่งเป็นไอคอนของบิลด์ทดลอง' % bad)

    print('ก๊อปแล้ว: ' + ', '.join(copied))
    if added:
        print('ไฟล์ใหม่ที่เพิ่งขึ้นราก: ' + ', '.join(added) + '  (git add ด้วย)')
    if problems:
        print('\n!! ยังไม่เรียบร้อย:')
        for x in problems:
            print('   - ' + x)
        sys.exit(1)
    print('คืนตัวตนของตัวจริงครบทุกจุดแล้ว')


if __name__ == '__main__':
    main()
