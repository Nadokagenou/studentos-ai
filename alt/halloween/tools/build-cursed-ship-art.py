# สร้างภาพฉาก THE CURSED SHIP จากสตอรีบอร์ด 12 ช่องของเจ้าของ (25 ต.ค. 69)
# ใช้:   python alt/halloween/tools/build-cursed-ship-art.py <สตอรีบอร์ด 1312×1199>
# ต้องมี: pip install pillow numpy opencv-python-headless
# ผล:    alt/halloween/season/cursed-ship/*.webp (ทับของเดิม) · ตัวสตอรีบอร์ดไม่เก็บใน repo
#
# ทุกช่องถูกลบป้ายเลขช่อง/คำบรรยายออก (inpaint) และลบการ์ดเดิมที่วาดไว้ในภาพ — การ์ดจริงเป็น HTML ที่วางทับ
# ถ้าได้ภาพต้นฉบับความละเอียดสูงแยกช่อง: ลบป้ายเองแล้ววางทับชื่อไฟล์เดิมได้เลย
# (สัดส่วนต้องเท่าเดิม ไม่งั้นแก้ --ar ใน cursed-ship.css และจุดบนภาพใน cursed-ship.js ให้ตรง)
import os, sys
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'season', 'cursed-ship')

def panels(src):
    im = cv2.imread(src)
    assert im is not None and im.shape[:2] == (1199, 1312), 'ตำแหน่งตัดช่องวัดจากสตอรีบอร์ดขนาด 1312×1199'
    cols = [(0, 435), (439, 874), (878, 1312)]
    rows = [(0, 310), (314, 599), (603, 898), (904, 1199)]
    return [im[r0:r1, c0:c1].copy() for r0, r1 in rows for c0, c1 in cols]   # ช่อง 1 → index 0

def label_mask(img):
    """วงเลขช่องมุมซ้ายบน + ตัวหนังสือหัวช่อง (เฉพาะพิกเซลสว่าง — เสากระโดงที่สูงถึงแถบนี้จึงไม่หาย)"""
    m = np.zeros(img.shape[:2], np.uint8)
    m[8:48, 8:48] = 255
    g = cv2.cvtColor(img[8:58, 48:430], cv2.COLOR_BGR2GRAY)
    m[8:58, 48:430] |= ((g > 120) * 255).astype(np.uint8)
    return cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=2)

def inpaint(img, extra=None, r=6):
    m = label_mask(img)
    if extra is not None:
        m |= extra
    return cv2.inpaint(img, m, r, cv2.INPAINT_TELEA)

def box(img, x0, y0, x1, y1):
    m = np.zeros(img.shape[:2], np.uint8); m[y0:y1, x0:x1] = 255; return m

def feather_paste(img, patch, x0, y0, f):
    h, w = patch.shape[:2]
    a = np.ones((h, w))
    for i in range(f):
        v = (i + 1) / f
        a[i, :] = np.minimum(a[i, :], v); a[:, i] = np.minimum(a[:, i], v)
    reg = img[y0:y0 + h, x0:x0 + w].astype(float)
    img[y0:y0 + h, x0:x0 + w] = (reg * (1 - a[..., None]) + patch.astype(float) * a[..., None]).astype(np.uint8)

def build(p):
    art = {}
    # ช่อง 2 · หมอกม่วง — ลบการ์ดจาง ๆ กลางภาพ
    fog = p[1]; art['fog'] = inpaint(fog, box(fog, 110, 95, 330, 250), 15)
    # ช่อง 3 · เรือผี — ตัดที่เส้นน้ำ (การ์ดเดิมอยู่ใต้เส้นน้ำ) · ทะเลข้างล่างเป็นหมอก CSS
    art['ship'] = inpaint(p[2])[0:252]
    # ช่อง 4 · ดาดฟ้า — รอยลบการ์ดถูกการ์ดจริงทับพอดี (จุด .556, .516 ใน cursed-ship.js)
    deck = p[3]; art['deck'] = inpaint(deck, box(deck, 150, 80, 335, 215), 12)[0:285]
    # ช่อง 6 · เรือแล่นไกล · ช่อง 11 · จันทร์กับป่าช้า
    art['far'] = inpaint(p[5]); art['yard'] = inpaint(p[10])

    # ช่อง 5 · ตราขี้ผึ้ง — วงกลมขอบนุ่ม + หยดสีแดงรอบวง
    s = p[4]; cx, cy, r = 245, 152, 92
    crop = s[cy - r - 20:cy + r + 20, cx - r - 20:cx + r + 20]
    hh, ww = crop.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww]; d = np.hypot(xx - ww / 2, yy - hh / 2)
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    red = ((hsv[..., 0] < 12) | (hsv[..., 0] > 165)) & (hsv[..., 1] > 110) & (hsv[..., 2] > 60)
    alpha = np.maximum(np.clip((r + 2 - d) / 6, 0, 1), red.astype(float) * np.clip((r + 20 - d) / 10, 0, 1))
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    seal = np.dstack([crop, (alpha * 255).astype(np.uint8)])

    # ช่อง 9 · ผืนผ้าแขวน — ลบตัวหนังสือ วงติ๊ก และฮูก แล้วสะท้อนมุมซ้ายล่าง (มีเทียน) ไปปิดมุมที่ฮูกเคยนั่ง
    b = p[8]; g = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
    m = label_mask(b)
    y0, y1, x0, x1 = 72, 250, 92, 350
    sub = g[y0:y1, x0:x1]; blur = cv2.GaussianBlur(sub, (0, 0), 6)
    m[y0:y1, x0:x1] |= ((((sub.astype(int) - blur.astype(int)) > 14) | (sub > 135)) * 255).astype(np.uint8)
    cv2.circle(m, (219, 108), 26, 255, -1)
    m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=2)
    m[222:300, 338:435] = 255
    ban = cv2.inpaint(b, m, 7, cv2.INPAINT_TELEA)
    x0, y0 = 335, 215
    feather_paste(ban, cv2.flip(ban[y0:, 0:ban.shape[1] - x0], 1), x0, y0, 18)
    return art, seal, ban[62:272, 40:420]

def pil(bgr):
    return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGRA2RGBA if bgr.shape[2] == 4 else cv2.COLOR_BGR2RGB))

# คุณภาพ webp 92 (เดิม 80): ภาพต้นทางเล็ก บล็อกบีบอัดเห็นชัดบนจอ 3x ของ iPhone
def up(im):
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=2))

def main():
    art, seal, ban = build(panels(sys.argv[1]))
    os.makedirs(OUT, exist_ok=True)
    for k, bgr in art.items():
        im = pil(bgr)
        up(im).save(os.path.join(OUT, k + '.webp'), quality=92, method=6)
        bg = im.resize((96, int(96 * im.height / im.width)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(5))
        ImageEnhance.Brightness(bg).enhance(.7).save(os.path.join(OUT, k + '-bg.webp'), quality=70)
    up(pil(ban)).save(os.path.join(OUT, 'banner.webp'), quality=92, method=6)
    up(pil(seal)).save(os.path.join(OUT, 'seal.webp'), quality=92, method=6)
    for f in sorted(os.listdir(OUT)):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')

if __name__ == '__main__':
    main()
