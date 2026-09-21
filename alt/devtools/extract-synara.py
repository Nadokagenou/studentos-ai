# ตัดน้องไซออกจาก character sheet — พื้นหลังโปร่ง ไม่ขยายภาพ
#
# สองกฎที่ห้ามแหก:
#   1. ห้าม resize ขึ้น — ต้นฉบับใบหน้ากว้าง ~130px การอัป 2 เท่าคือความเบลอที่
#      เจ้าของเห็นแล้วทัก · ปล่อยขนาดเดิมแล้วให้ CSS ย่อลงแทน คมกว่าเสมอ
#   2. flood fill จากขอบเท่านั้น ไม่ใช่เทียบสีทั้งภาพ — ผมสีเงินกับพื้นหลังฟ้าอ่อน
#      ห่างกันแค่ ~24 การเทียบทั้งภาพจะกินผมไปด้วย (ลองมาแล้ว หัวแหว่ง)
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1]
OUT = sys.argv[2]

src = Image.open(SRC).convert('RGB')


def flood(im, tol):
    """คืน mask ของพื้นหลัง — ลามจากขอบภาพเข้ามา หยุดเมื่อสีกระโดดเกิน tol"""
    a = np.asarray(im).astype(np.int16)
    h, w, _ = a.shape
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        c = a[y, x]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                if np.abs(a[ny, nx] - c).sum() <= tol:
                    seen[ny, nx] = True
                    q.append((ny, nx))
    return seen


def cutout(box, tol, circle=False, feather=1.0, erode=0, despeckle=False,
           decontaminate=False, bleed=2):
    im = src.crop(box)
    w, h = im.size
    alpha = np.where(flood(im, tol), 0, 255).astype(np.uint8)

    if circle:
        # วงกลมกินขอบบนที่หัวถูกตัดขาดไปพอดี — ใบหน้าในชีตถูกครอปที่กรอบอยู่แล้ว
        # ปล่อยเป็นรูปทรงอิสระจะได้ผมแบนตัดตรงด้านบน ซึ่งอ่านออกทันทีว่าเป็นรูปถูกครอป
        yy, xx = np.mgrid[0:h, 0:w]
        cx, cy, r = w / 2, h / 2, min(w, h) / 2
        d = np.sqrt(((xx - cx) / r) ** 2 + ((yy - cy) / r) ** 2)
        alpha = np.where(d <= 1.0, alpha, 0).astype(np.uint8)

    for _ in range(erode):
        # ⚠️ ขั้นนี้คือขั้นที่ขาดไปรอบแรก และเป็นที่มาของ "ขอบขาว ๆ รอบตัว"
        # flood fill หยุดตรงพิกเซลที่สีเริ่มต่าง ซึ่งคือพิกเซลลูกครึ่ง (antialias)
        # ที่เป็นสีพื้นหลังผสมสีตัวละคร — มันถูกเก็บไว้ทั้งแถบ
        # บนพื้นขาวมองไม่ออกเพราะสีใกล้กัน บนธีมมืดมันกลายเป็นเส้นขอบเรืองแสงทันที
        # กัดเข้าไปกี่พิกเซลก็เสียรายละเอียดเท่านั้น จึงกัดแค่ 1 รอบ
        am0 = Image.fromarray(alpha, 'L')
        alpha = np.asarray(am0.filter(ImageFilter.MinFilter(3))).copy()

    if despeckle:
        # เศษประกาย/พิกเซลตกแต่งที่ลอยอยู่ห่างตัว — flood fill เข้าไม่ถึงเพราะมันไม่ติดขอบ
        # ปล่อยไว้จะกลายเป็นจุดฟ้าลอยรอบตัวเธอโดยไม่มีใครรู้ว่าคืออะไร
        keep = alpha > 0
        h2, w2 = keep.shape
        lab = np.zeros((h2, w2), np.int32)
        cur = 0
        sizes = {}
        for y0 in range(h2):
            for x0 in range(w2):
                if not keep[y0, x0] or lab[y0, x0]:
                    continue
                cur += 1
                st = [(y0, x0)]
                lab[y0, x0] = cur
                n = 0
                while st:
                    yy, xx = st.pop()
                    n += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = yy + dy, xx + dx
                        if 0 <= ny < h2 and 0 <= nx < w2 and keep[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = cur
                            st.append((ny, nx))
                sizes[cur] = n
        if sizes:
            big = max(sizes, key=sizes.get)
            alpha = np.where(lab == big, alpha, 0).astype(np.uint8)

    rgb = np.asarray(im).astype(np.float32)
    if decontaminate:
        # ⚠️ ขั้นที่ขาดไปสองรอบแรก และเป็นรากของ "ขอบขาว ๆ รอบตัว"
        #
        # รอบที่แล้วกัดแค่ **อัลฟ่า** ให้แคบลง ซึ่งไม่ได้แก้อะไรเลย เพราะพิกเซลที่เหลือ
        # ตรงขอบยังมี **สี** เป็นสีพื้นหลังผสมสีตัวละครอยู่เหมือนเดิม
        # พอวางบนพื้นดำ สีฟ้าอ่อนที่ติดมากับขอบก็ยังเรืองอยู่ดี — แค่บางลงนิดเดียว
        #
        # ทางแก้จริงคือเปลี่ยน "สี" ของแถบขอบให้เป็นสีของเนื้อในแทน
        # ลามสีจากเนื้อในออกมาทับทีละชั้น จนคลุมทั้งแถบที่เคยเป็นลูกครึ่ง
        inner = np.asarray(Image.fromarray(
            np.where(alpha > 0, 255, 0).astype(np.uint8), 'L'
        ).filter(ImageFilter.MinFilter(2 * bleed + 1))) > 0
        fixed = inner.copy()
        for _ in range(bleed + 1):
            # ห้ามตั้งชื่อว่า src — ชนกับ src ระดับโมดูล (ภาพต้นฉบับ) แล้วทั้งฟังก์ชัน
            # จะมองมันเป็นตัวแปรท้องถิ่น ทำให้ im = src.crop(box) ข้างบนพังตั้งแต่บรรทัดแรก
            known = fixed.copy()
            acc = np.zeros_like(rgb)
            cnt = np.zeros(alpha.shape, np.float32)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                sh = np.roll(np.roll(rgb, dy, 0), dx, 1)
                m = np.roll(np.roll(known, dy, 0), dx, 1)
                acc += sh * m[..., None]
                cnt += m
            need = (~fixed) & (alpha > 0) & (cnt > 0)
            rgb[need] = (acc[need] / cnt[need][..., None])
            fixed |= need

    am = Image.fromarray(alpha, 'L')
    if feather:
        am = am.filter(ImageFilter.GaussianBlur(feather))
    out = Image.fromarray(rgb.clip(0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    out.putalpha(am)
    return out


FACES = {
    'normal':  (101, 1118, 232, 1236),
    'happy':   (284, 1118, 416, 1236),
    'wow':     (466, 1118, 593, 1236),
    'serious': (643, 1118, 771, 1236),
    'sleepy':  (811, 1118, 951, 1236),
    'sulk':    (994, 1118, 1120, 1236),
}

# ⚠️ ใบหน้า **ไม่** ตัดพื้นหลัง — ลองแล้วผมสีเงินถูก flood fill กินจนแหว่ง
# (พื้นหลังกรมท่ากับเส้นผมที่มีแสงตกกระทบอยู่ในระยะเดียวกัน) ภาพออกมาขอบแหว่งใช้ไม่ได้
# ปล่อยพื้นหลังไว้แล้วให้ CSS ครอปเป็นวงกลมแทน — วงกลมคือรูปทรงที่ทุกแอปใช้กับ
# รูปโปรไฟล์อยู่แล้ว มันจึงไม่ได้อ่านว่า "รูปถูกแปะ" แบบกรอบสี่เหลี่ยม
for name, box in FACES.items():
    img = src.crop(box)
    img.save(f'{OUT}/sai-face-{name}.webp', 'WEBP', quality=90, method=6)
    print('face', name, img.size)

chibi = cutout((988, 612, 1178, 940), tol=45, feather=0.5,
                erode=2, despeckle=True, decontaminate=True, bleed=3)
chibi.save(f'{OUT}/sai-chibi.webp', 'WEBP', quality=90, method=6)
print('chibi', chibi.size)
