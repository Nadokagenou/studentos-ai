# ตัดกฎ CSS ของธีมที่ Clear ไม่มี (เหลือ light/dark) + Halloween season
# ทิ้ง "ส่วนของ selector list" ที่อ้างธีมอื่นแบบบวกเท่านั้น · มี :not( หรืออ้างธีมที่เก็บไว้ด้วย = เก็บไว้ (ระวังไว้ก่อน)
import sys, re, tinycss2
KEEP = {'light', 'dark'}
THEME_RE = re.compile(r'\[data-theme(\^|\*|\$)?=\s*"?([a-z0-9-]+)"?\s*\]')
HW_RE = re.compile(r'\.hw-season\b|\[data-hw-tone')
def split_top(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        if ch == ',' and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    out.append(cur); return out
def strip_not(p):
    out, i = '', 0
    while i < len(p):
        if p.startswith(':not(', i):
            depth, j = 0, i + 4
            while j < len(p):
                if p[j] == '(': depth += 1
                elif p[j] == ')':
                    depth -= 1
                    if depth == 0: break
                j += 1
            i = j + 1; continue
        out += p[i]; i += 1
    return out
def drop_part(p):
    q = strip_not(p)                    # ธีมใน :not(...) ไม่นับ — มันคือ "ไม่ใช่ธีมนี้" ซึ่งยังจริงกับ light/dark
    if HW_RE.search(q): return True
    if ':has(' in q and THEME_RE.search(q): return False
    refs = THEME_RE.findall(q)
    if not refs: return False
    for op, name in refs:
        if op == '^':  # [data-theme^="hw-"] — ไม่มีธีมที่เก็บไว้ขึ้นต้นแบบนี้
            if any(k.startswith(name) for k in KEEP): return False
        elif op in ('*', '$'): return False
        elif name in KEEP: return False
    return True
stats = {'rules': 0, 'dropped': 0, 'parts_dropped': 0}
def walk(rules):
    out = []
    for r in rules:
        if r.type == 'qualified-rule':
            stats['rules'] += 1
            sel = tinycss2.serialize(r.prelude).strip()
            parts = split_top(sel)
            keep = [p for p in parts if not drop_part(p)]
            stats['parts_dropped'] += len(parts) - len(keep)
            if not keep: stats['dropped'] += 1; continue
            if len(keep) != len(parts):
                r.prelude = tinycss2.parse_component_value_list(','.join(p.strip() for p in keep) + ' ')
            out.append(r)
        elif r.type == 'at-rule' and r.content is not None and r.lower_at_keyword in ('media', 'supports', 'layer', 'container'):
            inner = walk(tinycss2.parse_rule_list(r.content, skip_whitespace=True, skip_comments=True))
            if not inner: continue
            r.content = tinycss2.parse_component_value_list('\n' + '\n'.join(tinycss2.serialize([x]) for x in inner) + '\n')
            out.append(r)
        elif r.type in ('comment', 'whitespace'): continue
        else: out.append(r)
    return out
for path in sys.argv[1:]:
    src = open(path, encoding='utf-8').read()
    before = len(src.encode())
    stats.update(rules=0, dropped=0, parts_dropped=0)
    rules = tinycss2.parse_stylesheet(src, skip_whitespace=True, skip_comments=True)
    errs = [r for r in rules if r.type == 'error']
    kept = walk(rules)
    out = '\n'.join(tinycss2.serialize([r]) for r in kept) + '\n'
    open(path, 'w', encoding='utf-8').write(out)
    print(f"{path:28} {before//1024:5}KB -> {len(out.encode())//1024:5}KB  rules {stats['rules']} dropped {stats['dropped']} parts {stats['parts_dropped']} parse-errors {len(errs)}")
