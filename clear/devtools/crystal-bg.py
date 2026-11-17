# ลายพื้นหลังคริสตัลของ Clear (เฟส R1 · 17 พ.ย. 69) — สร้างไฟล์ crystal-light.svg / crystal-dark.svg
# ตารางจุดเขย่าแบบสุ่มคงที่ (seed) → แบ่งเป็นสามเหลี่ยม → ความสว่างของแต่ละหน้าตามทิศแสงจากมุมซ้ายบน
# ภาพนิ่ง ไม่มีเบลอ ไม่มีอนิเมชัน — วาดครั้งเดียว ไม่กินเครื่อง · รันซ้ำได้ผลเท่าเดิม: python3 devtools/crystal-bg.py
import random, math
W, H, COLS, ROWS = 390, 844, 7, 13
def build(seed, base, face, shade, edge, glint):
    rnd = random.Random(seed)
    pts = [[(x * W / COLS + (rnd.uniform(-.38, .38) * W / COLS if 0 < x < COLS else 0),
             y * H / ROWS + (rnd.uniform(-.38, .38) * H / ROWS if 0 < y < ROWS else 0))
            for x in range(COLS + 1)] for y in range(ROWS + 1)]
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">',
           f'<rect width="{W}" height="{H}" fill="{base}"/>']
    lx, ly = -.6, -.8                                   # แสงมาจากซ้ายบน
    for y in range(ROWS):
        for x in range(COLS):
            a, b, c, d = pts[y][x], pts[y][x + 1], pts[y + 1][x + 1], pts[y + 1][x]
            for tri in ((a, b, c), (a, c, d)) if rnd.random() < .5 else ((a, b, d), (b, c, d)):
                (x1, y1), (x2, y2), (x3, y3) = tri
                nx, ny = (y2 - y1) - (y3 - y1), (x3 - x1) - (x2 - x1)       # ทิศเอียงหลอก ๆ ของหน้า
                n = math.hypot(nx, ny) or 1
                lit = max(0, (nx * lx + ny * ly) / n) * .7 + rnd.random() * .3
                fade = 1 - (y1 + y2 + y3) / 3 / H * .55          # บนสว่างกว่าล่าง
                pts_s = ' '.join(f'{p[0]:.1f},{p[1]:.1f}' for p in tri)
                # หน้าที่รับแสง = สีสว่าง · หน้าที่หันหนีแสง = สีเงา → เห็นเป็นเหลี่ยมคริสตัล ไม่ใช่แค่เส้นบาง ๆ
                col, op = (face[0], face[1] * (lit - .45) / .55 * fade) if lit > .45 else (shade[0], shade[1] * (.45 - lit) / .45)
                out.append(f'<polygon points="{pts_s}" fill="{col}" fill-opacity="{round(op, 3)}" stroke="{edge[0]}" stroke-opacity="{edge[1]}" stroke-width=".7"/>')
    # ประกายสองเส้นตามแนวสันคริสตัล
    for (x1, y1, x2, y2) in ((40, 40, 210, 300), (250, 120, 380, 420)):
        out.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{glint[0]}" stroke-opacity="{glint[1]}" stroke-width="1"/>')
    out.append('</svg>')
    return '\n'.join(out)
open('crystal-light.svg', 'w').write(build(7, '#e9f0f8', ('#ffffff', .95), ('#a9c0de', .38), ('#ffffff', .75), ('#ffffff', .9)))
open('crystal-dark.svg', 'w').write(build(7, '#0c1424', ('#8fb4ff', .13), ('#000000', .35), ('#cfe0ff', .07), ('#bcd2ff', .16)))
