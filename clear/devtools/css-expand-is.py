# X :is(.a, .b.c, d)suffix  →  X .a<pad>suffix, X .b.c<pad>suffix, X d<pad>suffix
# Chrome จัดกฎลงถังตามส่วนขวาสุด · :is() หลายตัวเลือกลงถังรวม = ต้องลองกับทุก element ทุกครั้งที่คิดสไตล์
# ความเจาะจง (specificity) ของ :is() = ค่าสูงสุดในรายการ → เติม :not(#z)/:not(.z)/:not(z) ให้แต่ละตัวเท่าเดิมเป๊ะ
# ตัวเลือกที่มีตัวเชื่อม (ช่องว่าง > + ~) ไม่แตกออก — ความหมายเปลี่ยนได้ · คงไว้ใน :is() ก้อนเหลือ
import sys, re, tinycss2
def split_top(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        if ch == ',' and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    out.append(cur); return [x.strip() for x in out]
def close_paren(s, i):  # s[i] == '('
    d = 0
    for j in range(i, len(s)):
        if s[j] == '(': d += 1
        elif s[j] == ')':
            d -= 1
            if d == 0: return j
    return -1
def has_comb(s):
    d = 0
    for ch in s:
        if ch in '([': d += 1
        elif ch in ')]': d -= 1
        elif d == 0 and ch in ' >+~': return True
    return False
def spec(sel):
    a = b = c = 0; i = 0; s = sel; n = len(s)
    ident = re.compile(r'(?:\\.|[\w-])+')
    while i < n:
        ch = s[i]
        if ch == '#':
            a += 1; m = ident.match(s, i + 1); i = m.end() if m else i + 1
        elif ch == '.':
            b += 1; m = ident.match(s, i + 1); i = m.end() if m else i + 1
        elif ch == '[':
            b += 1; i = s.index(']', i) + 1
        elif s.startswith('::', i):
            c += 1; m = ident.match(s, i + 2); i = m.end() if m else i + 2
            if i < n and s[i] == '(': i = close_paren(s, i) + 1
        elif ch == ':':
            m = ident.match(s, i + 1); name = m.group(0) if m else ''; j = m.end() if m else i + 1
            if j < n and s[j] == '(':
                k = close_paren(s, j); inner = s[j+1:k]
                if name in ('is', 'not', 'has'):
                    sp = max((spec(x) for x in split_top(inner)), default=(0, 0, 0)); a += sp[0]; b += sp[1]; c += sp[2]
                elif name == 'where': pass
                elif name in ('nth-child', 'nth-last-child') and ' of ' in inner:
                    b += 1; sp = max(spec(x) for x in split_top(inner.split(' of ', 1)[1])); a += sp[0]; b += sp[1]; c += sp[2]
                elif name in ('before', 'after', 'first-line', 'first-letter'): c += 1
                else: b += 1
                i = k + 1
            else:
                if name in ('before', 'after', 'first-line', 'first-letter'): c += 1
                else: b += 1
                i = j
        elif ch.isalpha():
            c += 1; m = ident.match(s, i); i = m.end()
        else:
            i += 1
    return (a, b, c)
def pad(cur, want):
    return ':not(#z)' * (want[0]-cur[0]) + ':not(.z)' * (want[1]-cur[1]) + ':not(z)' * (want[2]-cur[2])
def ge(x, y): return all(p >= q for p, q in zip(x, y))
stats = {'expanded': 0, 'parts_out': 0}
def expand_part(p):
    # หาส่วนขวาสุด
    d = 0; last = 0
    for i, ch in enumerate(p):
        if ch in '([': d += 1
        elif ch in ')]': d -= 1
        elif d == 0 and ch in ' >+~': last = i + 1
    prefix, comp = p[:last], p[last:]
    if not comp.startswith(':is('): return [p]
    k = close_paren(comp, 3)
    inner, suffix = comp[4:k], comp[k+1:]
    if '&' in inner: return [p]
    items = split_top(inner)
    if len(items) < 2: return [p]
    specs = [spec(x) for x in items]
    mx = tuple(max(s[n] for s in specs) for n in range(3))
    simple = [(x, s) for x, s in zip(items, specs) if not has_comb(x) and not x.startswith('::')]
    complex_ = [x for x in items if has_comb(x) or x.startswith('::')]
    if not simple: return [p]
    out = [prefix + x + pad(s, mx) + suffix for x, s in simple]
    if complex_:
        rs = max(spec(x) for x in complex_); rest = ':is(' + ', '.join(complex_) + ')'
        out.append(prefix + rest + pad(rs, mx) + suffix)
    stats['expanded'] += 1; stats['parts_out'] += len(out)
    return out
def walk(rules):
    for r in rules:
        if r.type == 'qualified-rule':
            sel = tinycss2.serialize(r.prelude).strip()
            if ':is(' not in sel: continue
            parts = split_top(sel); newp = []
            for p in parts: newp += expand_part(p)
            if newp != parts: r.prelude = tinycss2.parse_component_value_list(', '.join(newp) + ' ')
        elif r.type == 'at-rule' and r.content is not None and r.lower_at_keyword in ('media', 'supports', 'layer', 'container'):
            inner = tinycss2.parse_rule_list(r.content, skip_whitespace=True, skip_comments=True)
            walk(inner)
            r.content = tinycss2.parse_component_value_list('\n' + '\n'.join(tinycss2.serialize([x]) for x in inner) + '\n')
# ตรวจตัวคิด specificity
assert spec('.a') == (0,1,0) and spec('#x .a:hover') == (1,2,0) and spec('button[aria-label^="x"]') == (0,1,1)
assert spec(':is(.a, #b)') == (1,0,0) and spec(':where(#a) p') == (0,0,1) and spec('.a::before') == (0,1,1)
for path in sys.argv[1:]:
    stats.update(expanded=0, parts_out=0)
    rules = tinycss2.parse_stylesheet(open(path, encoding='utf-8').read(), skip_whitespace=True, skip_comments=True)
    walk(rules)
    open(path, 'w', encoding='utf-8').write('\n'.join(tinycss2.serialize([r]) for r in rules) + '\n')
    print(path, stats)
