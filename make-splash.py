# ============================================================
# สร้างจอคั่นตอนเปิดแอป (apple-touch-startup-image) ให้ทั้งสองสาย
# ------------------------------------------------------------
# iOS ไม่ได้อ่านโลโก้จาก manifest มาทำจอคั่นให้เอง ถ้าไม่มี <link rel="apple-touch-
# startup-image"> ที่ "ขนาดตรงกับเครื่องเป๊ะ ๆ" มันจะขึ้นจอเปล่าสี background_color
# แล้วรอจนหน้าเว็บโหลดเสร็จ — ซึ่งคือสิ่งที่แอปนี้เป็นอยู่ก่อนหน้านี้
#
# ทำไมต้องมีหลายไฟล์: iOS จับคู่ด้วย media query ที่ต้องตรงทั้ง device-width,
# device-height และ pixel ratio ถ้าไม่ตรงสักตัวมันข้ามไปใช้จอเปล่าเหมือนเดิม
# ไฟล์เดียวครอบทุกเครื่องไม่ได้ จึงต้องไล่ทีละรุ่น
#
# หน้าตา: พื้นเข้มเท่าสีพื้นแอป + แผ่นขาวมนรองโลโก้ ตามแบบเดียวกับหน้าล็อกอิน
# (.login-plate) — ตราเป็นกรมท่าเข้ม วางบนพื้นมืดตรง ๆ แล้วจม จึงต้องมีแผ่นรอง
#
# วิธีใช้:  python make-splash.py     แล้วค่อย python sync-to-root.py
# ============================================================
import io, os, re, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
ALT = os.path.join(ROOT, 'alt')

BG = (13, 18, 32)          # #0D1220 — ตรงกับ background_color ใน manifest ทั้งสองสาย
PLATE = (255, 255, 255)    # แผ่นรองสีขาว เหมือน .login-plate ที่หน้าล็อกอิน

# (css_w, css_h, ratio) — เรียงจากรุ่นใหม่ไปเก่า ครอบ iPhone ที่ยังได้รับอัปเดตอยู่
# แนวตั้งอย่างเดียว เพราะ manifest ล็อก orientation ไว้ที่ portrait แล้ว
DEVICES = [
    (440, 956, 3),   # iPhone 16 Pro Max
    (430, 932, 3),   # 14 Pro Max · 15/16 Plus
    (428, 926, 3),   # 12/13 Pro Max · 14 Plus
    (402, 874, 3),   # iPhone 16 Pro
    (393, 852, 3),   # 14 Pro · 15/16
    (390, 844, 3),   # 12/13/14
    (375, 812, 3),   # X · XS · 11 Pro · 13 mini
    (414, 896, 3),   # XS Max · 11 Pro Max
    (414, 896, 2),   # XR · 11
    (414, 736, 3),   # 6+ · 7+ · 8+
    (375, 667, 2),   # 6 · 7 · 8 · SE2 · SE3
]


def rounded(size, radius, fill):
    """แผ่นมุมมน วาดที่ 4 เท่าแล้วย่อลง — ขอบเรียบโดยไม่ต้องพึ่ง anti-alias ของ PIL"""
    s = 4
    im = Image.new('RGBA', (size * s, size * s), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle(
        [0, 0, size * s - 1, size * s - 1], radius=radius * s, fill=fill)
    return im.resize((size, size), Image.LANCZOS)


def build(w, h, mark):
    im = Image.new('RGB', (w, h), BG)
    # แผ่นรองกินพื้นที่ประมาณหนึ่งในสามของด้านสั้น — ใหญ่พอให้เป็นของหลักของจอ
    # แต่ไม่ถึงกับเต็มจอจนดูเหมือนภาพพื้นหลัง
    plate_px = int(min(w, h) * 0.34)
    plate = rounded(plate_px, int(plate_px * 0.27), PLATE)
    mk = mark.resize((int(plate_px * 0.72),) * 2, Image.LANCZOS)
    plate.paste(mk, ((plate_px - mk.width) // 2, (plate_px - mk.height) // 2), mk)
    # วางสูงกว่ากลางจอเล็กน้อย — กลางเป๊ะบนจอสูง ๆ จะดูเหมือนตกลงข้างล่าง
    im.paste(plate, ((w - plate_px) // 2, int(h * 0.44) - plate_px // 2), plate)
    return im


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    mark = Image.open(os.path.join(ALT, 'logo-mark.png')).convert('RGBA')
    links, made = [], []
    for cw, ch, r in DEVICES:
        w, h = cw * r, ch * r
        name = 'splash-%dx%d.png' % (w, h)
        img = build(w, h, mark)
        for base in (ALT, ROOT):
            img.save(os.path.join(base, name), 'PNG', optimize=True)
        made.append('%s (%dKB)' % (name, os.path.getsize(os.path.join(ALT, name)) // 1024))
        links.append(
            '  <link rel="apple-touch-startup-image" href="%s"'
            ' media="(device-width: %dpx) and (device-height: %dpx)'
            ' and (-webkit-device-pixel-ratio: %d) and (orientation: portrait)">' % (name, cw, ch, r))

    block = ('  <!-- จอคั่นตอนเปิดแอปบน iOS — ไม่มีชุดนี้ = จอเปล่าสีพื้นจนกว่าหน้าเว็บจะโหลดเสร็จ\n'
             '       ขนาดต้องตรงกับเครื่องเป๊ะทั้งสามค่า ไม่งั้น iOS ข้ามไปใช้จอเปล่าเหมือนเดิม\n'
             '       สร้างด้วย python make-splash.py — อย่าแก้บล็อกนี้ด้วยมือ -->\n'
             + '\n'.join(links))

    # เย็บเข้า index.html ของฝั่ง alt เท่านั้น — ตัวจริงรับต่อผ่าน sync-to-root.py
    p = os.path.join(ALT, 'index.html')
    s = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    b = block.replace('\n', nl)
    old = re.search(r'[ \t]*<!-- จอคั่นตอนเปิดแอปบน iOS.*?startup-image[^>]*>', s, flags=re.S)
    if old:
        s = s[:old.start()] + b + s[old.end():]
    else:
        anchor = '  <meta name="apple-mobile-web-app-title"'
        i = s.index(anchor)
        j = s.index('>', i) + 1
        s = s[:j] + nl + b + s[j:]
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

    print('สร้างแล้ว %d ไฟล์ (ลงทั้ง alt/ และราก):' % len(made))
    for m in made:
        print('   ' + m)
    print('เย็บ <link> เข้า alt/index.html แล้ว — ต่อไปรัน python sync-to-root.py')


main()
