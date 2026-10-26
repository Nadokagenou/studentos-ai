# AI ขยายภาพ 4 เท่า (Real-ESRGAN · RRDBNet) แบบไฟล์เดียว ไม่ต้องติดตั้ง basicsr
# โครงตรงกับ RRDBNet ของ basicsr จึงโหลดน้ำหนักทางการ (.pth) ได้ตรง ๆ
# ใช้กับ build-cursed-ship-art.py --sr <model.pth> · ต้องมี: pip install torch numpy pillow
# น้ำหนักที่ใช้ทำภาพชุดปัจจุบัน (ภาพวาด เส้นคมกว่ารุ่นทั่วไป):
#   https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth  (blocks=6)
# ใช้เดี่ยว: python esrgan.py model.pth in.png out.png [blocks]
import sys, torch, numpy as np
import torch.nn as nn, torch.nn.functional as F
from PIL import Image

class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.conv1 = nn.Conv2d(nf, gc, 3, 1, 1); s.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        s.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1); s.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        s.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1); s.lrelu = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        x1 = s.lrelu(s.conv1(x)); x2 = s.lrelu(s.conv2(torch.cat((x, x1), 1)))
        x3 = s.lrelu(s.conv3(torch.cat((x, x1, x2), 1))); x4 = s.lrelu(s.conv4(torch.cat((x, x1, x2, x3), 1)))
        return s.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x

class RRDB(nn.Module):
    def __init__(s, nf, gc=32):
        super().__init__(); s.rdb1 = RDB(nf, gc); s.rdb2 = RDB(nf, gc); s.rdb3 = RDB(nf, gc)
    def forward(s, x): return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x

class RRDBNet(nn.Module):
    def __init__(s, nb=23, nf=64, gc=32):
        super().__init__()
        s.conv_first = nn.Conv2d(3, nf, 3, 1, 1)
        s.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        s.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        s.lrelu = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        f = s.conv_first(x); f = f + s.conv_body(s.body(f))
        f = s.lrelu(s.conv_up1(F.interpolate(f, scale_factor=2, mode='nearest')))
        f = s.lrelu(s.conv_up2(F.interpolate(f, scale_factor=2, mode='nearest')))
        return s.conv_last(s.lrelu(s.conv_hr(f)))

def load(path, nb):
    m = RRDBNet(nb=nb); sd = torch.load(path, map_location='cpu')
    m.load_state_dict(sd.get('params_ema', sd.get('params', sd)), strict=True); m.eval()
    torch.set_num_threads(4)
    return m

def upscale(m, img, tile=160, pad=10):
    a = np.asarray(img.convert('RGB')).astype(np.float32) / 255.
    t = torch.from_numpy(a).permute(2, 0, 1)[None]
    _, _, h, w = t.shape
    out = torch.zeros(1, 3, h * 4, w * 4)
    with torch.no_grad():
        for y in range(0, h, tile):
            for x in range(0, w, tile):
                y0, x0 = max(y - pad, 0), max(x - pad, 0)
                y1, x1 = min(y + tile + pad, h), min(x + tile + pad, w)
                o = m(t[:, :, y0:y1, x0:x1]).clamp(0, 1)
                oy, ox = (y - y0) * 4, (x - x0) * 4
                th, tw = min(tile, h - y) * 4, min(tile, w - x) * 4
                out[:, :, y * 4:y * 4 + th, x * 4:x * 4 + tw] = o[:, :, oy:oy + th, ox:ox + tw]
    return Image.fromarray((out[0].permute(1, 2, 0).numpy() * 255).round().astype(np.uint8))

if __name__ == '__main__':
    model, src, dst = sys.argv[1:4]
    nb = int(sys.argv[4]) if len(sys.argv) > 4 else 23
    m = load(model, nb)
    upscale(m, Image.open(src)).save(dst)
    print('ok', dst)
