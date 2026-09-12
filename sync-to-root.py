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
# วิธีใช้:  python sync-to-root.py
# ============================================================
import io, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
ALT = os.path.join(ROOT, 'alt')

# แต่ละสายมีของตัวเอง — ห้ามก๊อปทับ
PER_CHANNEL = {'manifest.json', 'config.js', 'sw.js'}

# ============================================================
# ⚠️ ชั้นสังคมไม่ขึ้นบิลด์ตัวจริง — ถูกถอดออกมาแล้วสามรอบ
# ============================================================
# 0336a6d · ab13556 · และรอบนี้ (12 ก.ย. 2569) เจ้าของเปิดแอปบนเครื่องจริง
# แล้วเจอรูปแผลเย็บในฟีด ซึ่งชนกับเส้นที่เขาตั้งเองเรื่องความปลอดภัยเด็ก
#
# สองรอบแรกถอดออกด้วยมือ แล้วสคริปต์นี้ก็เอากลับขึ้นไปใหม่ในการซิงก์ครั้งถัดมา
# เพราะมันก๊อป alt/index.html ทับทั้งไฟล์ — ไม่มีอะไรฟ้อง ไม่มีใครสังเกต
# จนกระทั่งเจ้าของเปิดแอปเจอเอง · รอบนี้จึงเขียนกฎลงในสคริปต์เลย:
# ก๊อปเสร็จแล้ว **ถอดออกทุกครั้ง** โดยอัตโนมัติ แล้วตรวจซ้ำว่าไม่เหลือทางเข้าที่กดได้
#
# ฝั่ง alt/ ไม่ถูกแตะ — ยังมีครบทุกอย่างเหมือนเดิม
# **จะเอากลับเข้าบิลด์ตัวจริง ต้องให้เจ้าของสั่งเอง แล้วค่อยลบบล็อกนี้ทิ้ง**
# room.js ไม่อยู่ในรายการ — ตรวจแล้วว่ามันไม่เรียกอะไรของชั้นสังคมเลยสักตัว
# และไม่แตะเซิร์ฟเวอร์แม้แต่ครั้งเดียว (0 การเรียก supabase) มันคือห้องของตัวเองล้วน ๆ
# ไม่มีเนื้อหาจากคนอื่นไหลเข้ามาได้ จึงไม่ใช่พื้นผิวสังคม
SOCIAL_SCRIPTS = ['social.js', 'feed.js', 'hw.js', 'topic.js']
# แผ่นสไตล์ **ไม่ถอด** — CSS ไม่เคยสร้างพื้นผิวสังคมด้วยตัวมันเอง มันแค่จัดหน้าตา
# และตั้งแต่ 1B70 จอ "ฉัน" ใช้คลาสร่วมกับหน้าที่เพื่อนเปิดดู (feed.css / social.css)
# ถอดออกแล้วจอโปรไฟล์พังทันที — ไอคอนกุญแจยักษ์ ตัวหนังสือไม่มีสไตล์ (เจอจริง 12 ก.ย.)
SOCIAL_STYLES = []

# หัวข้อ "สังคม" ในแท็บ "ฉัน" — พอถอดสองแถวใต้มันออกแล้ว เหลือหัวข้อลอยไม่มีอะไรอยู่ข้างล่าง
# หัวข้อว่างเปล่าอ่านแล้วเหมือนแอปโหลดไม่ครบ ไม่ใช่เหมือนฟีเจอร์ที่ถูกปิด
SOCIAL_SECTION = ('[ TAB]*<div class="pf-sec">\u0e2a\u0e31\u0e07\u0e04\u0e21</div>CRLF'
                  '[ TAB]*<div class="pf-entry">.*?</div>CRLF')
SOCIAL_SCREENS = ['scr-mates', 'scr-people', 'scr-compose', 'scr-user', 'scr-post',
                  'scr-chat', 'scr-hw', 'scr-topic', 'scr-tthread', 'scr-dm']
# safety.css / safety.js ไม่อยู่ในรายการ — จอ "เราเก็บอะไรของคุณบ้าง" กับตัวกรองใช้มัน
# และทั้งคู่ไม่ใช่พื้นผิวสังคม

# แท็บที่ห้าของแถบล่าง — ตัวจริงใช้ "น้องไซ" แทน "เพื่อน"
# ต้องเหลือห้าช่อง ไม่งั้นปุ่ม + ไม่อยู่กึ่งกลางจริง (ดูหมายเหตุ 1B41 ใน index.html)
AI_TAB = (
    '      <button class="tab" data-scr="scr-ai" onclick="go(&#39;scr-ai&#39;)">NL'
    '        <svg class="ic ic-l" viewBox="0 0 24 24"><use href="#tb-ai"/></svg>NL'
    '        <svg class="ic ic-f" viewBox="0 0 24 24"><use href="#tb-ai-f"/></svg>'
    '<span>น้องไซ</span></button>'
).replace('NL', chr(10)).replace('&#39;', chr(39))

TAB_RE = '[ TAB]*<button class="tab" data-scr="scr-mates" onclick="openFeed\\(\\)">.*?</button>'
SCRIPT_RE = '[ TAB]*<script src="%s"></script>CRLF'
STYLE_RE = '[ TAB]*<link rel="stylesheet" href="%s">CRLF'
ENTRY_RES = [
    '[ TAB]*<!-- ALT 1A6M3: [^N]*CRLF[ TAB]*<button class="top-friends".*?</button>CRLF',
    '[ TAB]*<button class="pe" onclick="openFeed\\([^)]*\\)">.*?</button>CRLF',
    '[ TAB]*<button type="button" onclick="openFeed\\([^)]*\\)">CRLF[ TAB]*<svg[^N]*</button>CRLF',
]


def _rx(pat):
    """แปลงตัวย่อในแพตเทิร์นข้างบนให้เป็น regex จริง — เลี่ยงแบ็กสแลชในซอร์สไฟล์นี้"""
    bs = chr(92)
    return (pat.replace('TAB', bs + 't')
               .replace('CRLF', bs + 'r?' + bs + 'n')
               .replace('[^N]', '[^' + bs + 'n]'))


def strip_social(html):
    """ถอดชั้นสังคมออกจาก index.html ของบิลด์ตัวจริง · คืน (html, จำนวนที่ถอด)"""
    n = 0
    # จอทั้งก้อน — นับ <div> เข้า-ออกเพื่อหาปลายบล็อก ไม่ใช่เดาจาก </div> ตัวแรก
    for sid in SOCIAL_SCREENS:
        m = re.search(_rx('[ TAB]*<div class="screen[^"]*" id="%s">') % re.escape(sid), html)
        if not m:
            continue
        i, j, depth = m.start(), m.end(), 1
        for t in re.finditer(_rx('<div' + chr(92) + 'b|</div>'), html[j:]):
            depth += 1 if t.group(0) != '</div>' else -1
            if depth == 0:
                j = j + t.end()
                break
        while j < len(html) and html[j] in (chr(13) + chr(10)):
            j += 1
        html = html[:i] + html[j:]
        n += 1

    for f in SOCIAL_SCRIPTS:
        html, k = re.subn(_rx(SCRIPT_RE) % re.escape(f), '', html)
        n += k
    for f in SOCIAL_STYLES:
        html, k = re.subn(_rx(STYLE_RE) % re.escape(f), '', html)
        n += k

    # หัวข้อ "สังคม" ที่เหลือว่างหลังถอดสองแถวใต้มันออก
    html, k = re.subn(_rx(SOCIAL_SECTION), '', html, flags=re.S)
    n += k
    html, k = re.subn(_rx(TAB_RE), AI_TAB.replace(chr(92), chr(92) * 2), html, flags=re.S)
    n += k

    for pat in ENTRY_RES:
        html, k = re.subn(_rx(pat), '', html, flags=re.S)
        n += k
    return html, n
# มีเฉพาะบิลด์ทดลอง — ตัวจริงไม่มีไฟล์ (ก๊อปขึ้นไปก็ได้ปุ่มลอย "แก้ดีไซน์" ติดมาด้วย)
# icon-alt-* คือไอคอนที่มีแถบ ALT คาด — ตัวจริงต้องได้ icon-*.png ธรรมดาแทน
# (index.html ถูกแก้กลับให้อ้าง icon-192.png อยู่แล้วในตาราง IDENTITY ข้างล่าง)
ALT_ONLY = {'visual-editor.js', 'icon-alt-192.png', 'icon-alt-512.png'}

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
          'hub.html']

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
]


# นามสกุลที่ถือว่าเป็น "ของที่หน้าเรียกใช้" — รูปอยู่ในนี้ด้วย ไม่ใช่แค่โค้ด
ASSETS = ('.js', '.css', '.png', '.svg', '.webp', '.ico', '.jpg', '.jpeg')


def local_refs(html):
    """ชื่อไฟล์ในโฟลเดอร์เดียวกันที่หน้านี้เรียกใช้จริง (ไม่นับที่คอมเมนต์ทิ้ง)"""
    live = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    out = []
    for m in re.finditer(r'(?:src|href)="([^"]+)"', live):
        v = m.group(1)
        if '/' in v or v.startswith(('http', '#', 'data:')):
            continue
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


def main():
    # คอนโซล Windows ไทยเป็น cp874 พิมพ์คอมเมนต์ที่มีอักขระนอกตารางแล้วสคริปต์ตายกลางทาง
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    alt_html = io.open(os.path.join(ALT, 'index.html'), encoding='utf-8', newline='').read()
    files = ['index.html'] + ALWAYS + [f for f in local_refs(alt_html)
                                       if f not in PER_CHANNEL and f not in ALT_ONLY]

    # หน้าที่ถูกลิงก์ + ของที่หน้านั้นเรียกใช้เอง (เช่น land.html ใช้ logo-lockup.svg
    # ซึ่ง index.html ไม่ได้อ้างถึงเลย จึงไม่เคยถูกก๊อปตามขึ้นไป)
    for pg in linked_pages(alt_html):
        src = os.path.join(ALT, pg)
        if not os.path.exists(src):
            continue
        files.append(pg)
        files += [f for f in local_refs(io.open(src, encoding='utf-8').read())
                  if f not in PER_CHANNEL and f not in ALT_ONLY]

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
        if alt_text not in s:
            # ของที่หาไม่เจอแปลว่าไฟล์ฝั่ง alt เปลี่ยนหน้าตาไปแล้ว — ต้องรู้ทันที
            # ไม่ใช่ปล่อยผ่านเงียบ ๆ แล้วไปเจอตอนตัวจริงขึ้นชื่อว่า ALT บนเว็บ
            problems.append('index.html ยังหาข้อความที่ต้องแก้กลับไม่เจอ: ' + alt_text[:60])
            continue
        io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(alt_text, root_text))

    # ---------- ถอดชั้นสังคมออกจากบิลด์ตัวจริง ----------
    # ต้องทำหลังก๊อปเสร็จ เพราะ index.html เพิ่งถูกทับด้วยของฝั่ง alt ไปหมาด ๆ
    ip = os.path.join(ROOT, 'index.html')
    ih = io.open(ip, encoding='utf-8', newline='').read()
    ih, nstrip = strip_social(ih)
    io.open(ip, 'w', encoding='utf-8', newline='').write(ih)
    print('ถอดชั้นสังคมออกจากตัวจริง %d จุด' % nstrip)
    if re.search('onclick="openFeed', ih):
        problems.append('ยังเหลือทางเข้าชั้นสังคมที่กดได้ในบิลด์ตัวจริง')
    # ---------- sw.js: ขึ้นเลข cache + SHELL ต้องครบ ----------
    # ก๊อปไฟล์ทับแล้วแต่ไม่ขึ้นเลข cache = เครื่องที่ติดตั้งแอปไว้แล้วเสิร์ฟของเก่าต่อไป
    # เงียบ ๆ ซึ่งคือ "แก้แล้วแต่บนมือถือเหมือนเดิม" ที่หาสาเหตุยากที่สุดในโปรเจกต์นี้
    app = io.open(os.path.join(ROOT, 'app.js'), encoding='utf-8', newline='').read()
    ver = re.search(r"APP_VERSION\s*=\s*'([^']+)'", app)
    code = re.search(r"APP_CODENAME\s*=\s*'([^']+)'", app)
    swp = os.path.join(ROOT, 'sw.js')
    sw = io.open(swp, encoding='utf-8', newline='').read()
    if ver and code:
        want = 'studentos-%s-%s' % (ver.group(1).lower(), code.group(1).lower())
        sw2 = re.sub(r"(const CACHE = ')[^']+(')", lambda m: m.group(1) + want + m.group(2), sw, count=1)
        if sw2 != sw:
            io.open(swp, 'w', encoding='utf-8', newline='').write(sw2)
            sw = sw2
        print('cache ของตัวจริง: ' + want)

    root_html = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8', newline='').read()
    shell = re.search(r'const SHELL = \[(.*?)\];', sw, flags=re.S)
    listed = set(re.findall(r"'([^']+)'", shell.group(1))) if shell else set()
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
