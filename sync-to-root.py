# ============================================================
# ก๊อปงานจาก alt/ ขึ้นบิลด์ตัวจริงที่ราก แล้วคืน "ตัวตน" ของตัวจริงกลับ
# ------------------------------------------------------------
# สองบิลด์นี้ต่างกันแค่ชื่อกับไอคอน ไม่ได้ต่างกันที่ฟีเจอร์ การซิงก์จึงเป็นการ
# ก๊อปทับแล้วแก้กลับไม่กี่จุด — แต่ "ไม่กี่จุด" นั้นพลาดแล้วเจ็บทุกจุด
# โดยเฉพาะแท็ก visual-editor.js ที่รากไม่มีไฟล์ (404) และปุ่มลอย "แก้ดีไซน์"
# ของมันไม่ควรไปโผล่หน้าคนที่เปิดแอปมาทำการบ้านจริง
#
# ไฟล์ที่ไม่ยุ่ง: sw.js (ชื่อ cache + SHELL คนละชุด) · manifest.json · config.js
# วิธีใช้:  python sync-to-root.py
# ============================================================
import io, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FILES = ['app.js', 'engine.js', 'style.css', 'alt.css', 'index.html', 'context.js']

# (ไฟล์, ข้อความในเวอร์ชัน alt, ข้อความที่ตัวจริงต้องได้)
IDENTITY = [
    ('app.js',
     "const APP_CHANNEL = 'ALT';",
     "const APP_CHANNEL = 'AI';"),
    ('app.js',
     "+ ' “' + APP_CODENAME + '” · รุ่นทดลองฟีเจอร์';",
     "+ ' “' + APP_CODENAME + '”';"),
    ('index.html',
     '<title>StudentOS ALT — รุ่นทดลองฟีเจอร์ (Sandbox)</title>',
     '<title>students OS — รู้ว่าต้องทำอะไรก่อน เสมอ</title>'),
    ('index.html',
     '<link rel="icon" href="icon-alt-192.png">',
     '<link rel="icon" href="icon-192.png">'),
    ('index.html',
     '<link rel="apple-touch-icon" href="icon-alt-192.png">',
     '<link rel="apple-touch-icon" href="icon-192.png">'),
    ('index.html',
     '<meta name="apple-mobile-web-app-title" content="StudentOS ALT">',
     '<meta name="apple-mobile-web-app-title" content="students OS">'),
    ('index.html',
     '''<!-- ── Visual Editor (เครื่องมือแก้ UI ตอนออกแบบ) ──────────────
     ลบ 1 บรรทัดข้างล่างนี้เมื่อทำดีไซน์เสร็จ แล้วจะไม่เหลือร่องรอยใด ๆ
     ไฟล์นี้ไม่แก้ style.css / app.js เดิมเลย -->
<script src="visual-editor.js"></script>''',
     '''<!-- ตัวแก้ดีไซน์ (visual-editor.js) อยู่เฉพาะในบิลด์ทดลองที่ /alt/ เท่านั้น
     ตัวจริงไม่โหลด — ไฟล์ไม่มีอยู่ที่นี่ (จะได้ 404) และปุ่มลอย "แก้ดีไซน์"
     ของมันไม่ควรไปโผล่หน้าคนที่ใช้แอปจริง -->'''),
]


def main():
    # คอนโซล Windows ไทยเป็น cp874 พิมพ์คอมเมนต์ที่มีอักขระนอกตารางแล้วสคริปต์ตายกลางทาง
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    copied = []
    for name in FILES:
        src = os.path.join(ROOT, 'alt', name)
        if not os.path.exists(src):
            continue                      # ไฟล์ที่ยังไม่ได้ทำ (เช่น context.js ตอนยังไม่เสร็จ)
        data = open(src, 'rb').read()
        open(os.path.join(ROOT, name), 'wb').write(data)
        copied.append(name)

    missing = []
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
            missing.append((name, alt_text[:60]))
            continue
        io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(alt_text, root_text))

    print('ก๊อปแล้ว: ' + ', '.join(copied))
    if missing:
        print('\n!! หาข้อความที่ต้องแก้กลับไม่เจอ — ตัวจริงอาจยังมีร่องรอยของ ALT ติดอยู่:')
        for name, frag in missing:
            print('   ' + name + ' : ' + frag)
        sys.exit(1)
    print('คืนตัวตนของตัวจริงครบทุกจุดแล้ว')


if __name__ == '__main__':
    main()
