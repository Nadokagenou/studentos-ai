// ============================================================
// ตัวเชื่อม · ICS — ปฏิทินที่ LMS ของโรงเรียนออกให้นักเรียนเองอยู่แล้ว
// ------------------------------------------------------------
// ทำไมตัวนี้มาก่อน Google Classroom ทั้งที่ดูโบราณกว่า:
//   Canvas · Moodle · Blackboard · พอร์ทัลโรงเรียนอีกมาก ออก "URL ปฏิทินลับ"
//   ให้นักเรียนแต่ละคนอยู่แล้ว **โดยที่ในนั้นมีกำหนดส่งงานครบ** เป็นช่องทางที่
//   เจ้าของระบบเปิดเองอย่างเป็นทางการ ไม่ใช่การแอบดูด — และไม่ต้องให้ IT ของโรงเรียน
//   อนุมัติอะไรเลยสักขั้น ซึ่งเป็นด่านที่ฆ่า integration ของ Teams ทั้งตัว
//
//   ตัวเชื่อมตัวเดียวจึงครอบได้หลายระบบพร้อมกัน และใช้ได้ "วันนี้"
//
// ข้อจำกัดที่รู้ตัวและตั้งใจไม่ข้าม:
//   · ปฏิทินบอกแค่ "ชื่อ + เวลา" ไม่มีคะแนน ไม่มีสถานะส่งแล้ว/ยังไม่ส่ง
//     (Classroom API มีครบกว่า — นี่คือเหตุผลที่ตัวนี้ไม่ได้มาแทน แค่มาก่อน)
//   · URL นี้คือความลับ ใครถือก็อ่านปฏิทินของเจ้าตัวได้ จึงถูกเข้ารหัสเก็บเหมือน token
//   · เหตุการณ์ที่เกิดซ้ำ (RRULE) ถูกข้ามทั้งหมด — ดูเหตุผลที่ตัวแปลงข้างล่าง
// ============================================================

import { clip, isoOrNull, zonedToUtc } from './integrations.ts';
import type { StandardTask } from './integrations.ts';

// ---------- ขอบเขตที่ยอมดาวน์โหลด ----------
// ปฏิทินของคนที่เรียนหลายคอร์สโตได้ถึงหลักร้อย KB แต่ไม่ถึงหลักสิบ MB
// เพดานนี้กันไฟล์ที่ใหญ่ผิดปกติ (หรือ URL ที่ชี้ไปที่อื่นที่ไม่ใช่ปฏิทิน) ไม่ให้กินหน่วยความจำจนฟังก์ชันตาย
const MAX_BYTES = 4_000_000;
const TIMEOUT_MS = 15_000;

// ---------- ด่านก่อนยิง ----------
// เซิร์ฟเวอร์ของเรายิง URL ที่ผู้ใช้พิมพ์มาเอง = ช่องโหว่ SSRF ถ้าไม่กรอง
// ใครใส่ URL ที่ชี้กลับเข้ามาในเครือข่ายภายใน จะใช้ฟังก์ชันเราเป็นบันไดยิงของที่คนนอกยิงไม่ถึง
// (ปลายทางยอดฮิตคือ endpoint ที่แจกข้อมูลลับของเครื่องในคลาวด์)
export function normalizeIcsUrl(input: string): string {
  const raw = String(input || '').trim();
  // webcal:// คือ URL ที่ปุ่ม "Subscribe" ของทุกเจ้าก๊อปให้ — มันคือ https ที่ใส่เสื้อคนละตัว
  const s = raw.replace(/^webcal:\/\//i, 'https://');
  let u: URL;
  try { u = new URL(s); } catch { throw new Error('ลิงก์ปฏิทินไม่ถูกต้อง'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('รับเฉพาะลิงก์ http/https');

  const host = u.hostname.toLowerCase();
  const bad = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')
    || host === '::1' || host === '0.0.0.0'
    || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)
    || /^169\.254\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (bad) throw new Error('ลิงก์นี้ชี้เข้าเครือข่ายภายใน ใช้ไม่ได้');
  return u.toString();
}

export type IcsFetch = {
  tasks: StandardTask[];
  calName: string;
  etag?: string | null;
  lastModified?: string | null;
  unchanged?: boolean;       // 304 — ต้นทางบอกเองว่าไม่มีอะไรเปลี่ยน
};

/** ดึงปฏิทินแล้วแปลงเป็นงาน · ส่ง etag/lastModified ของรอบก่อนมาด้วยได้ เพื่อไม่ต้องโหลดซ้ำ */
export async function fetchIcs(
  url: string, tz: string, prev?: { etag?: string | null; lastModified?: string | null },
): Promise<IcsFetch> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'User-Agent': 'StudentOS-AI/1.0 (+calendar-sync)' };
    // ปฏิทินส่วนใหญ่ไม่เปลี่ยนระหว่างสองรอบ sync — ถามแบบมีเงื่อนไขแล้วได้ 304
    // กลับมาเปล่า ๆ ประหยัดทั้งเน็ตของเราและของโรงเรียนที่ต้องเสิร์ฟให้เด็กทั้งโรงเรียน
    if (prev?.etag) headers['If-None-Match'] = prev.etag;
    if (prev?.lastModified) headers['If-Modified-Since'] = prev.lastModified;

    const r = await fetch(url, { headers, signal: ctl.signal, redirect: 'follow' });
    if (r.status === 304) return { tasks: [], calName: '', unchanged: true };
    if (r.status === 401 || r.status === 403 || r.status === 404) {
      // URL ปฏิทินถูกเปลี่ยน/เพิกถอน — ต้องให้คนไปก๊อปอันใหม่มา ลองใหม่เองไม่มีวันหาย
      throw Object.assign(new Error('ลิงก์ปฏิทินใช้ไม่ได้แล้ว ต้องเชื่อมใหม่'), { reauth: true });
    }
    if (!r.ok) throw new Error(`ต้นทางตอบ ${r.status}`);

    const len = Number(r.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) throw new Error('ไฟล์ปฏิทินใหญ่เกินไป');
    const text = await r.text();
    if (text.length > MAX_BYTES) throw new Error('ไฟล์ปฏิทินใหญ่เกินไป');
    // ต้นทางบางเจ้าตอบ 200 พร้อมหน้า login เมื่อลิงก์หมดอายุ — ไม่ใช่ปฏิทิน
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      throw Object.assign(new Error('ลิงก์นี้ไม่ได้คืนไฟล์ปฏิทิน'), { reauth: true });
    }

    const parsed = parseIcs(text, tz);
    return {
      ...parsed,
      etag: r.headers.get('etag'),
      lastModified: r.headers.get('last-modified'),
    };
  } finally { clearTimeout(timer); }
}

// ---------- ตัวแกะ ICS ----------
// เขียนเองแทนการลากไลบรารีเข้ามา เพราะ RFC 5545 ส่วนที่เราต้องใช้จริงมีไม่กี่ข้อ
// และไลบรารีที่ครบทั้ง RFC ลากโค้ดขยายเหตุการณ์ซ้ำเข้ามาด้วย ซึ่งเป็นส่วนที่เราตั้งใจไม่ใช้

type Prop = { name: string; params: Record<string, string>; value: string };

/** คลี่บรรทัดที่ถูกพับ — RFC 5545 พับบรรทัดยาวแล้วขึ้นบรรทัดใหม่ด้วยช่องว่างนำหน้า
 *  ไม่คลี่ก่อน = ชื่องานยาว ๆ จะขาดกลางคำทุกใบ */
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else out.push(line);
  }
  return out;
}

function parseProp(line: string): Prop | null {
  const colon = findColon(line);
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const bits = head.split(';');
  const params: Record<string, string> = {};
  for (let i = 1; i < bits.length; i++) {
    const eq = bits[i].indexOf('=');
    if (eq > 0) params[bits[i].slice(0, eq).toUpperCase()] = bits[i].slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: bits[0].toUpperCase(), params, value };
}

/** โคลอนตัวแรกที่อยู่นอกเครื่องหมายคำพูด — TZID="Asia/Bangkok" ใส่โคลอนในค่าพารามิเตอร์ได้ */
function findColon(line: string): number {
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (c === ':' && !q) return i;
  }
  return -1;
}

/** ถอดอักขระหนี — \n \, \; \\ ตามสเปก · ไม่ถอดแล้วจะเห็น "\," กลางชื่องานบนจอจริง */
function untext(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

function parseDate(p: Prop, tz: string): { iso: string | null; allDay: boolean } {
  const v = p.value.trim();
  const zone = p.params.TZID || tz;

  // 20260917 — ทั้งวัน ไม่มีเวลา
  const dOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dOnly) {
    const [, y, mo, d] = dOnly;
    // กำหนดส่งแบบ "ทั้งวัน" หมายถึงสิ้นวันเสมอในสายตานักเรียน ไม่ใช่เที่ยงคืนตอนเริ่มวัน
    // ตั้งเป็น 00:00 เมื่อไหร่ แอปจะขึ้นว่า "เลยกำหนดแล้ว" ตั้งแต่เช้าของวันที่ต้องส่งพอดี
    const dt = zonedToUtc(+y, +mo, +d, 23, 59, 0, zone);
    return { iso: dt.toISOString(), allDay: true };
  }

  const full = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!full) return { iso: isoOrNull(v), allDay: false };
  const [, y, mo, d, h, mi, s, z] = full;
  const dt = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    : zonedToUtc(+y, +mo, +d, +h, +mi, +s, zone);
  return { iso: dt.toISOString(), allDay: false };
}

// ---------- เดาว่าเป็นข้อสอบไหม ----------
// ไม่ใช่การเดาชนิดที่ห้ามทำ: ปฏิทินไม่มีช่อง "นี่คือข้อสอบ" ให้อ่าน แต่ความต่างระหว่าง
// การบ้านกับสอบเปลี่ยนวิธีที่ StudentOS วางแผนให้ทั้งสัปดาห์ · เลือกคำที่ผิดยาก
// และถ้าเดาพลาดผลเสียคือ "วางแผนอ่านหนังสือให้ทั้งที่เป็นการบ้าน" ซึ่งกู้คืนได้ด้วยการแก้ทีเดียว
const EXAM_RE = /\b(exam|midterm|final|quiz)\b|สอบ|ควิซ/i;

export function parseIcs(text: string, tz: string): { tasks: StandardTask[]; calName: string } {
  const lines = unfold(text);
  const tasks: StandardTask[] = [];
  let calName = '';
  let calCancel = false;      // METHOD:CANCEL = ทั้งไฟล์คือการยกเลิก

  let cur: Record<string, Prop> | null = null;
  let kind = '';

  for (const line of lines) {
    const p = parseProp(line);
    if (!p) continue;

    if (p.name === 'BEGIN' && (p.value === 'VEVENT' || p.value === 'VTODO')) {
      cur = {}; kind = p.value; continue;
    }
    if (p.name === 'END' && (p.value === 'VEVENT' || p.value === 'VTODO')) {
      if (cur) {
        const t = toTask(cur, kind, tz, calCancel);
        if (t) tasks.push(t);
      }
      cur = null; kind = ''; continue;
    }
    if (cur) { cur[p.name] = p; continue; }

    if (p.name === 'X-WR-CALNAME') calName = clip(untext(p.value), 80);
    if (p.name === 'METHOD' && p.value.toUpperCase() === 'CANCEL') calCancel = true;
  }
  return { tasks, calName };
}

function toTask(
  e: Record<string, Prop>, kind: string, tz: string, calCancel: boolean,
): StandardTask | null {
  const uid = (e.UID?.value || '').trim();
  const summary = clip(untext(e.SUMMARY?.value || ''), 140);
  if (!uid || !summary) return null;

  // ---------- เหตุการณ์ที่เกิดซ้ำ ถูกข้ามทั้งหมด ----------
  // RRULE ในปฏิทินโรงเรียนแทบทั้งหมดคือ "คาบเรียน" ไม่ใช่การบ้าน — และ StudentOS
  // มีตารางเรียนของตัวเองอยู่แล้ว · จะเอาเข้ามาก็ต้องขยายเป็นครั้ง ๆ ให้ถูกทั้ง EXDATE
  // และเขตเวลา ซึ่งเป็นโค้ดอีกก้อนใหญ่ที่แลกมาด้วยงาน 52 ใบชื่อ "คณิตศาสตร์" ต่อเทอม
  // เอาแค่ครั้งแรกมาใบเดียวยิ่งแย่กว่า เพราะมันจะขึ้นว่าเลยกำหนดไปแล้วตลอดกาล
  if (e.RRULE) return null;

  const dueProp = kind === 'VTODO' ? (e.DUE || e.DTSTART) : (e.DTSTART || e.DUE);
  const due = dueProp ? parseDate(dueProp, tz).iso : null;

  const status = (e.STATUS?.value || '').toUpperCase();
  const cancelled = calCancel || status === 'CANCELLED';

  // ---------- แยกชื่อวิชาออกจากชื่องาน ----------
  // Canvas เขียน SUMMARY เป็น "ชื่องาน [ชื่อคอร์ส]" ตายตัว · Moodle เขียนเป็น
  // "ชื่องาน is due" แล้วเอาคอร์สไว้ใน DESCRIPTION — เอาเท่าที่อ่านออกแน่ ๆ พอ
  // ที่เหลือปล่อยให้ subject ว่างไว้ ดีกว่าเดาแล้วได้ชื่อวิชาที่ไม่มีอยู่จริง
  let title = summary, subject = '';
  const m = /^(.*)\s\[([^\]]{1,60})\]\s*$/.exec(summary);
  if (m) { title = m[1].trim(); subject = m[2].trim(); }

  const detail = clip(untext(e.DESCRIPTION?.value || ''), 400);
  const url = (e.URL?.value || '').trim();

  return {
    // RECURRENCE-ID แยกครั้งหนึ่งออกจากชุด — ใส่ต่อท้ายเพื่อไม่ให้สองครั้งทับกันเป็นใบเดียว
    sourceId: e['RECURRENCE-ID'] ? `${uid}#${e['RECURRENCE-ID'].value}` : uid,
    title,
    detail,
    subject,
    due,
    url: /^https?:\/\//i.test(url) ? url : undefined,
    type: EXAM_RE.test(summary) ? 'exam' : 'homework',
    cancelled,
  };
}
