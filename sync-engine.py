# ============================================================
# ส่ง alt/engine.js ไปให้ Edge Function ใช้  —  ต้นทางมีที่เดียวเสมอ
# ------------------------------------------------------------
# ทำไมต้องก๊อป ไม่ import ข้ามโฟลเดอร์:
#   Supabase รวมไฟล์เฉพาะที่อยู่ใต้ supabase/functions/ เท่านั้น
#   ../../alt/engine.js จึงตามขึ้นไปไม่ได้ และการ import จาก GitHub Pages ตอนรัน
#   ก็แปลว่าเว็บล่มเมื่อไหร่ บอทแกะงานไม่ได้ทันที
#
# ทำไมไม่แก้ engine.js ให้มี export ไปเลย:
#   ฝั่งแอปโหลดด้วย <script src> ธรรมดา ซึ่งใช้ export ไม่ได้
#   ถ้าใส่ export ลงไป ต้องเปลี่ยนเป็น type="module" ทั้งสาย แล้วลำดับโหลด
#   ที่ห้ามสลับก็จะเปลี่ยนพฤติกรรมไปด้วย — ไม่คุ้มกับการได้ import สวย ๆ ที่เดียว
#
# ⚠️ ไฟล์ปลายทางเป็นของที่สร้างขึ้น ห้ามแก้ด้วยมือ แก้ที่ alt/engine.js แล้วรันสคริปต์นี้ใหม่
#    รันทุกครั้งก่อน  supabase functions deploy line-webhook
#
# วิธีใช้:  python sync-engine.py
# ============================================================
import os, sys, io

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'alt', 'engine.js')
DST_DIR = os.path.join(ROOT, 'supabase', 'functions', '_shared')
DST = os.path.join(DST_DIR, 'engine.js')

# สิ่งที่ฝั่งเซิร์ฟเวอร์ได้ใช้จริง — ตั้งใจให้สั้น
# ยิ่งเปิดออกไปน้อย ยิ่งรู้ชัดว่าถ้าแก้ engine.js แล้วอะไรฝั่งเซิร์ฟเวอร์จะกระเทือน
EXPORTS = ['parseAssignment', 'splitAssignments']

HEADER = (
    '// ====== ไฟล์นี้ถูกสร้างโดย sync-engine.py — ห้ามแก้ด้วยมือ ======\n'
    '// ต้นทาง: alt/engine.js  ·  แก้ที่นั่นแล้วรัน  python sync-engine.py\n'
    '// มีไว้ให้ supabase/functions/line-webhook ใช้ตัวแกะภาษาไทยตัวเดียวกับที่แอปใช้\n'
    '// ถ้าสองไฟล์นี้ไม่ตรงกันเมื่อไหร่ บอทจะแกะงานคนละอย่างกับที่แอปแสดง\n'
    '// ================================================================\n\n'
)


def main():
    # คอนโซล Windows ไทยเป็น cp874 พิมพ์อักษรอย่าง "·" ไม่ได้แล้วสคริปต์ตายทั้งตัว
    # ทั้งที่ไฟล์เขียนสำเร็จไปแล้ว — ล้มหลังทำงานเสร็จคือการล้มที่ทำให้เข้าใจผิดที่สุด
    # (วิธีเดียวกับ sync-to-root.py)
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    if not os.path.isfile(SRC):
        print('หา alt/engine.js ไม่เจอ — สคริปต์นี้ต้องอยู่ที่รากของ repo', file=sys.stderr)
        return 1

    with io.open(SRC, encoding='utf-8') as f:
        src = f.read()

    # กันพลาดแบบที่หาสาเหตุยากที่สุด: ฟังก์ชันถูกเปลี่ยนชื่อใน alt/engine.js
    # แล้ว export ตรงนี้ชี้ไปที่ชื่อที่ไม่มีอยู่ ผลคือ Edge Function พังตอน deploy
    # ด้วย error ที่ไม่ได้บอกเลยว่าเพราะไฟล์สองตัวหลุดจากกัน
    missing = [n for n in EXPORTS if ('function %s(' % n) not in src]
    if missing:
        print('alt/engine.js ไม่มีฟังก์ชัน: ' + ', '.join(missing), file=sys.stderr)
        print('ถ้าเปลี่ยนชื่อฟังก์ชัน ต้องแก้ EXPORTS ในไฟล์นี้ให้ตรงกันด้วย', file=sys.stderr)
        return 1

    out = HEADER + src.rstrip() + '\n\nexport { ' + ', '.join(EXPORTS) + ' };\n'

    if not os.path.isdir(DST_DIR):
        os.makedirs(DST_DIR)

    old = None
    if os.path.isfile(DST):
        with io.open(DST, encoding='utf-8') as f:
            old = f.read()
    if old == out:
        print('เหมือนเดิมอยู่แล้ว ไม่ต้องเขียนทับ')
        return 0

    with io.open(DST, 'w', encoding='utf-8', newline='\n') as f:
        f.write(out)

    lines = src.count('\n') + 1
    print('เขียนแล้ว: supabase/functions/_shared/engine.js (%d บรรทัด · export %s)'
          % (lines, ', '.join(EXPORTS)))
    print('อย่าลืม deploy:  supabase functions deploy line-webhook')
    return 0


if __name__ == '__main__':
    sys.exit(main())
