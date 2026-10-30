import { renderIssues, renderBugs } from './report-ui.mjs';
import { createStaffSessionStorage, STAFF_AUTH_KEY } from './staff-auth.mjs';
import { pushStatusHTML } from './push-status-ui.mjs';
import { demoInsights } from './insights-demo.mjs';
import { sendsHTML, sendSummary, audienceLabel, FILTER_TO_AUDIENCE } from './send-ui.mjs';
import { overviewHTML, usageHTML, outcomesHTML, peopleRowsHTML, peopleChipsHTML, personHTML } from './insights-ui.mjs';
const $ = (id) => document.getElementById(id);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (v) =>
  Number(v || 0).toLocaleString("th-TH", { maximumFractionDigits: 1 });
const when = (v) =>
  v
    ? new Date(v).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "ยังไม่มีข้อมูล";
const titles = {
  overview: "ภาพรวม",
  usage: "การใช้งาน",
  outcomes: "ผลของแอป",
  users: "ผู้ใช้",
  tokens: "โทเคนและการแบน",
  notices: "ข่าวสารและแจ้งเตือน",
  issues: "รายงานและปัญหาแอป",
  audit: "ประวัติการจัดการ",
  push_status: 'สถานะแจ้งเตือน',
};
const labels = {
  grant: "เพิ่มโทเคน",
  deduct: "หักโทเคน",
  ban: "แบนบัญชี",
  unban: "ปลดแบนบัญชี",
  draft: "บันทึกร่าง",
  publish: "เผยแพร่ประกาศ",
  withdraw: "ถอนประกาศ",
  triage: "เปลี่ยนสถานะรายงาน",
  bug_triage: "อัปเดตปัญหาแอป",
  report_trash: "ย้ายรายงานไปถังขยะ",
  report_restore: "กู้คืนรายงาน",
};
const demo = location.pathname.endsWith("/preview.html");
const reportWrites = new Set(['triage', 'bug_triage', 'report_trash', 'report_restore']);
if (window.top !== window.self) {
  document.body.textContent = "กรุณาเปิด Control Room โดยตรง";
  throw Error("Embedding is disabled");
}
let client,
  session,
  providerToken,
  view = "overview",
  page = 0,
  target = null,
  busy = false;
let pending = null;
let pushPage=0,pushLoadSeq=0;
let staffAuth, authEpoch = 0;
let bugPage = 0, issuePage = 0, reportBucket = 'pending', reportLoadSeq = 0;
let days = 7, peopleFilter = 'all', person = null, personSeq = 0, insightSeq = 0;
let picked = [], audSeq = 0, audTimer = 0, lastAud = null;
// Renderers are looked up when a page loads, not at module start.
const insightViews = { overview: 'overviewBody', usage: 'usageBody', outcomes: 'outcomesBody' };
const renderInsight = (name, r) => (name === 'usage' ? usageHTML : name === 'outcomes' ? outcomesHTML : overviewHTML)(r);
const data = { users: [], notices: [], issues: [], audit: [] };
const demoUsers = Array.from({ length: 12 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  display_name: `นักเรียนตัวอย่าง ${i + 1}`,
  handle: `demo_student${i + 1}`,
  last_sync: new Date(Date.now() - (i * 8 + 1) * 3600000).toISOString(),
  balance: 36.5 + i * 12,
}));
let demoNotices = [
  {
    id: "demo-notice",
    title: "ขอต้อนรับสู่ Student OS",
    body: "พื้นที่เล็ก ๆ ที่ช่วยให้รู้ว่าควรเริ่มงานไหนก่อน",
    status: "draft",
    created_at: new Date().toISOString(),
    push_requested: false,
  },
];
let demoSends = [
  { id: "00000000-0000-4000-8000-0000000000a1", title: "ภารกิจฮาโลวีนเหลือ 2 วัน", body: "ทำงานให้เสร็จ 3 ชิ้นวันนี้ รับของตกแต่งธีมฟักทองฟรี", audience: "ทุกคน", public: true, recipients: 0, status: "scheduled", scheduled_at: new Date(Date.now() + 5 * 3600000).toISOString(), push: true, push_total: 0, push_accepted: 0, push_failed: 0 },
  { id: "00000000-0000-4000-8000-0000000000a2", title: "คิดถึงนะ กลับมาดูงานที่ค้างไว้", body: "มีงานใกล้ส่ง 2 ชิ้น เปิดแอปดูได้เลย", audience: "หายไปเกิน 3 วัน", public: false, recipients: 5, status: "published", published_at: new Date(Date.now() - 86400000).toISOString(), push: true, push_total: 2, push_accepted: 2, push_failed: 0 },
];
let demoIssues = [
  {
    id: 1,
    kind: "user",
    reason: "spam",
    note: "ตัวอย่างรายงาน: มีข้อความส่งซ้ำหลายครั้ง",
    status: "open",
    created_at: new Date().toISOString(),
  },
];
let demoAudit = [
  {
    action: "draft",
    actor_login: "demo_developer",
    detail: "ขอต้อนรับสู่ Student OS",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

function message(text, error = false) {
  $("message").textContent = text;
  $("message").hidden = !text;
  $("message").classList.toggle("error", error);
}
function gate(text) {
  $("console").hidden = true;
  $("gate").hidden = false;
  $("gateMessage").textContent = text;
}
function requestId(action, payload) {
  const key = JSON.stringify([action, payload]);
  if (!pending || pending.key !== key)
    pending = { key, id: crypto.randomUUID() };
  return pending.id;
}
async function api(action, payload = {}) {
  if (demo) return demoApi(action, payload);
  // Read through the SDK so an expired access token is refreshed before use.
  const { data: current, error } = await client.auth.getSession();
  if (error) throw Error('ต่ออายุการเข้าสู่ระบบไม่ได้ กรุณาลองใหม่');
  adoptSession(current.session);
  if (!session || !providerToken)
    throw Error("กรุณาเข้าสู่ระบบด้วย GitHub อีกครั้ง");
  const epoch = authEpoch;
  const r = await fetch(
    `${window.SUPABASE_CONFIG.url}/functions/v1/staff-console`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        apikey: window.SUPABASE_CONFIG.anonKey,
        authorization: `Bearer ${session.access_token}`,
        "x-github-token": providerToken,
      },
      body: JSON.stringify({ action, ...payload }),
    },
  );
  let body;
  try {
    body = await r.json();
  } catch {
    throw Error("หลังบ้านยังไม่พร้อมใช้งาน กรุณาตรวจการติดตั้ง staff-console");
  }
  if (epoch !== authEpoch) throw Error('บัญชีเปลี่ยนแล้ว กรุณาเปิดรายการใหม่');
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) {
      if (r.status === 401) staffAuth.forgetProvider();
      gate(body.error || "บัญชีนี้เข้า Control Room ไม่ได้");
    }
    throw Error(body.error || "ทำรายการไม่ได้ กรุณาลองใหม่");
  }
  return body;
}
async function demoApi(action, p) {
  if (['insights', 'people', 'person'].includes(action)) return demoInsights(action, p);
  if (action === 'audience') { const n = { all: 24, active: 14, gone: 5, new: 3, old: 3, stuck: 1, grade: 10, pick: p.audience.ids?.length || 0 }[p.audience.kind]; return { recipients: n, push_ready: Math.round(n * 0.3) }; }
  if (action === 'sends') return { items: demoSends };
  if (action === 'send') { demoSends.unshift({ id: crypto.randomUUID(), title: p.title, body: p.body, audience: p.label, public: p.audience.kind === 'all', recipients: p.audience.kind === 'all' ? 0 : 5, status: p.at ? 'scheduled' : 'published', scheduled_at: p.at, published_at: p.at ? null : new Date().toISOString(), until_at: p.until, push: p.push, push_total: p.push && !p.at ? 2 : 0, push_accepted: 0, push_failed: 0 }); demoLog('send', p.title + ' · ' + p.label); return { id: p.request_id }; }
  if (action === 'cancel_send') { const x = demoSends.find(y => y.id === p.batch_id); if (x) x.status = 'withdrawn'; demoLog('cancel_send', x?.title || ''); return { ok: true }; }
  if(action==='push_status') return {metrics:{pending:0,sending:0,accepted_24h:0,failed:0},items:[],generated_at:new Date().toISOString(),has_more:false};
  if (action === "session")
    return { login: "demo_developer", repo: "Nadokagenou/studentos-ai" };
  if (action === "overview")
    return {
      users: 12,
      synced_24h: 3,
      open_reports: demoIssues.filter((x) => x.status !== "closed").length,
      tokens_today: demoAudit
        .filter((x) => x.action === "grant")
        .reduce((n, x) => n + x.amount, 0),
      issues: demoIssues.slice(0, 3),
      audit: demoAudit.slice(0, 4),
    };
  if (action === "users")
    return {
      items: demoUsers.filter((x) =>
        [x.id, x.handle, x.display_name]
          .join(" ")
          .toLowerCase()
          .includes((p.query || "").replace(/^@/, "").toLowerCase()),
      ),
      has_more: false,
    };
  if (action === "notices") return { items: demoNotices };
  if (action === 'reports' && !window.StudentOSBugDemo) {
    const [bugs, issues] = await Promise.allSettled([
      demoApi('bugs', { bucket: p.bucket, offset: p.bug_offset }),
      demoApi('issues', { bucket: p.bucket, offset: p.issue_offset }),
    ]);
    return { ...p, bugs, issues };
  }
  if (['reports','bugs','issues','triage','bug_triage','report_trash','report_restore'].includes(action) && window.StudentOSBugDemo) return window.StudentOSBugDemo.staff(action,p);
  if (action === "issues") { const bucket = p.bucket || 'pending'; return { items: demoIssues.filter(x => bucket === 'trash' ? x.deleted_at : !x.deleted_at && (bucket === 'resolved' ? x.status === 'closed' : x.status !== 'closed')) }; }
  if (action === "bugs" || action === "bug_triage") return window.StudentOSBugDemo?.staff(action, p) || { items: [], open_count: 0 };
  if (action === "audit") return { items: demoAudit };
  if (['ban','unban'].includes(action)) {
    const u = demoUsers.find(x => x.id === p.target);
    u.banned = action === 'ban'; u.ban_reason = p.reason;
    u.ban_until = action === 'ban' && p.duration !== 'permanent' ? new Date(Date.now() + (p.duration === '2d' ? 2 : 1) * 86400000).toISOString() : null;
    demoLog(action, `@${u.handle} · ${p.reason}`);
    return { ban_until: u.ban_until };
  }
  if (action === "grant" || action === 'deduct') {
    const u = demoUsers.find((x) => x.id === p.target);
    if (action === 'deduct' && u.balance < p.amount) throw Error('ยอดโทเคนไม่พอ');
    u.balance += (action === 'deduct' ? -1 : 1) * p.amount;
    demoAudit.unshift({
      action,
      amount: p.amount,
      actor_login: "demo_developer",
      detail: `@${u.handle} ${action === 'deduct' ? '-' : '+'}${p.amount} · ${p.reason}`,
      created_at: new Date().toISOString(),
    });
    return { balance: u.balance };
  }
  if (action === "draft") {
    const n = {
      ...p,
      id: crypto.randomUUID(),
      status: "draft",
      created_at: new Date().toISOString(),
    };
    demoNotices.unshift(n);
    demoLog(action, p.title);
    return n;
  }
  if (action === "publish" || action === "withdraw") {
    const n = demoNotices.find((x) => x.id === p.id);
    n.status = action === "publish" ? "published" : "withdrawn";
    n.push_requested = !!p.push;
    n.push_status = p.push ? "ข้อมูลจำลอง · ไม่ส่งจริง" : "ไม่ส่ง Push";
    demoLog(action, n.title);
    return n;
  }
  if (action === "triage") {
    const i = demoIssues.find((x) => String(x.id) === String(p.id));
    i.status = p.status;
    i.staff_note = p.note;
    demoLog(action, `รายงาน #${p.id} → ${p.status}`);
    return i;
  }
  throw Error("ไม่พบคำสั่ง");
}
function demoLog(action, detail) {
  demoAudit.unshift({
    action,
    detail,
    actor_login: "demo_developer",
    created_at: new Date().toISOString(),
  });
}
function empty(text = "ยังไม่มีรายการ") {
  return `<p class="empty">${esc(text)}</p>`;
}
function auditHTML(items) {
  return items.length
    ? items
        .map(
          (x) =>
            `<div class="item"><h3>${esc(labels[x.action] || x.action)}</h3><p>${esc(x.detail || "")}</p><p>@${esc(x.actor_login)} · ${esc(when(x.created_at))}</p></div>`,
        )
        .join("")
    : empty();
}
function issuesHTML(items, compact = false) { return renderIssues(items, { compact, bucket: reportBucket }); }
function currentReportView() {
  return { bucket: reportBucket, bug_offset: bugPage * 20, issue_offset: issuePage * 20 };
}
function paintReports(result) {
  const bucket = reportBucket;
  const sections = [
    { result: result.bugs, list: 'bugIssueList', count: 'bugCount', prev: 'staffBugsPrev', next: 'staffBugsNext', page: bugPage, render: items => renderBugs(items, bucket) },
    { result: result.issues, list: 'issueList', count: 'contentReportCount', prev: 'staffIssuesPrev', next: 'staffIssuesNext', page: issuePage, render: items => renderIssues(items, { bucket }) },
  ];
  for (const section of sections) {
    $(section.prev).disabled = section.page === 0;
    if (section.result?.status === 'fulfilled') {
      const result = section.result.value;
      $(section.list).innerHTML = section.render(result.items || []);
      $(section.count).textContent = (result.counts?.[bucket] ?? result.items?.length ?? 0) + ' เรื่อง';
      $(section.next).disabled = !result.has_more;
    } else {
      $(section.list).textContent = 'ยังโหลดรายงานส่วนนี้ไม่ได้ กรุณาลองรีเฟรชอีกครั้ง';
      $(section.count).textContent = ''; $(section.next).disabled = true;
    }
  }
  $('reportSections').setAttribute('aria-busy', 'false');
}
async function loadReports() {
  const context = currentReportView(), seq = ++reportLoadSeq;
  $('reportSections').setAttribute('aria-busy', 'true');
  for (const id of ['bugIssueList', 'issueList']) $(id).innerHTML = empty('กำลังโหลดรายงาน…');
  for (const id of ['bugCount', 'contentReportCount']) $(id).textContent = '';
  for (const id of ['staffBugsPrev', 'staffBugsNext', 'staffIssuesPrev', 'staffIssuesNext']) $(id).disabled = true;
  let result;
  try { result = await api('reports', context); }
  catch { result = {}; }
  if (seq !== reportLoadSeq) return;
  paintReports(result);
}
async function loadPushStatus() {
  const seq=++pushLoadSeq;
  $('pushRows').textContent='กำลังอ่านสถานะแจ้งเตือน…';
  let result;
  try { result=await api('push_status',{status:$('pushStatusFilter').value||'all',offset:pushPage*20}); }
  catch(error) {
    if(seq===pushLoadSeq && view==='push_status') $('pushRows').textContent='อ่านสถานะไม่ได้ กดรีเฟรชเพื่อลองอีกครั้งครับ';
    throw error;
  }
  if(seq!==pushLoadSeq || view!=='push_status') return;
  const html=pushStatusHTML(result);
  $('pushMetrics').innerHTML=html.metrics; $('pushRows').innerHTML=html.rows;
  $('pushUpdated').textContent=html.updated; $('pushHint').textContent=html.hint;
  $('pushPrev').disabled=pushPage===0; $('pushNext').disabled=!result.has_more;
}
async function refreshAfterReportSave(result) {
  if (!result || view !== 'issues') return;
  const context = currentReportView(), reports = result.reports;
  if (reports && Object.keys(context).every(key => context[key] === reports[key])) {
    ++reportLoadSeq; // Discard any list request started before this committed save.
    paintReports(reports);
  } else {
    await loadReports();
  }
}
async function load() {
  if(view==='push_status') return loadPushStatus();
  if (insightViews[view]) {
    const id = insightViews[view], seq = ++insightSeq, shown = view;
    if (!$(id).innerHTML) $(id).innerHTML = empty("กำลังคำนวณตัวเลข…");
    const r = await api("insights", { days });
    if (seq !== insightSeq || view !== shown) return;
    $(id).innerHTML = renderInsight(shown, r);
    $("updatedAt").textContent = "อัปเดต " + when(r.generated_at);
  }
  if (view === "users") {
    const r = await api("people", {
      filter: peopleFilter,
      query: $("userQuery").value.trim(),
      offset: page * 50,
    });
    data.users = r.items || [];
    data.today = r.today || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    $("peopleChips").innerHTML = peopleChipsHTML(r.counts, peopleFilter);
    $("messageGroup").dataset.messageGroup = peopleFilter;
    $("messageGroup").hidden = !FILTER_TO_AUDIENCE[peopleFilter];
    $("usersRows").innerHTML = peopleRowsHTML(data.users, data.today);
    $("usersPage").textContent = `หน้า ${page + 1}`;
    $("usersPrev").disabled = page === 0;
    $("usersNext").disabled = !r.has_more;
  }
  if (view === "audit") {
    data.audit = (await api("audit")).items || [];
    $("auditList").innerHTML = auditHTML(data.audit);
  }
  if (view === "issues") {
    await loadReports();
  }
  if (view === "notices") {
    const [notices, sends] = await Promise.allSettled([api("notices"), api("sends")]);
    $("sendList").innerHTML = sends.status === "fulfilled" ? sendsHTML(sends.value.items || []) : empty("ยังโหลดรายการข่าวที่ส่งไม่ได้ กดรีเฟรชเพื่อลองใหม่");
    if (notices.status === "rejected") throw notices.reason;
    // Sends made from the new form are listed above; keep this list for drafts and older notices.
    data.notices = (notices.value.items || []).filter((x) => !x.batch_id);
    refreshAudience();
    $("noticeList").innerHTML = data.notices.length
      ? data.notices
          .map(
            (x) =>
              `<div class="item"><h3>${esc(x.title)} <span class="tag ${x.status === "draft" ? "dim" : ""}">${esc({ draft: "ร่าง", published: "เผยแพร่แล้ว", withdrawn: "ถอนแล้ว" }[x.status] || x.status)}</span></h3><p>${esc(x.body)}</p><p>${esc(when(x.published_at || x.created_at))}${x.push_status ? " · " + esc(x.push_status) : ""}</p><div class="actions">${x.status === "draft" ? `<button data-publish="${esc(x.id)}">เผยแพร่เป็นข่าวในแอป</button><button data-push="${esc(x.id)}">เผยแพร่พร้อมแจ้งเตือน Push</button>` : ""}${x.status !== "withdrawn" ? `<button data-withdraw="${esc(x.id)}">ถอนประกาศ</button>` : ""}</div></div>`,
          )
          .join("")
      : empty("ยังไม่มีร่างหรือประกาศแบบเดิม");
  }
}
async function openPerson(id) {
  const seq = ++personSeq;
  $("personBody").innerHTML = empty("กำลังโหลด…");
  $("personDrawer").hidden = false;
  try {
    const p = await api("person", { id });
    if (seq !== personSeq) return;
    person = p;
    $("personBody").innerHTML = personHTML(p, data.today);
  } catch (e) {
    if (seq === personSeq) $("personBody").innerHTML = empty(e.message);
  }
}
function closePerson() {
  ++personSeq;
  $("personDrawer").hidden = true;
}
async function show(next) {
  if (!titles[next]) return;
  view = next;
  closePerson();
  $("range").hidden = !insightViews[next];
  if (!insightViews[next]) $("updatedAt").textContent = "";
  document
    .querySelectorAll(".view")
    .forEach((e) => (e.hidden = e.id !== `view-${next}`));
  document
    .querySelectorAll("nav button")
    .forEach((e) => e.classList.toggle("selected", e.dataset.view === next));
  $("pageTitle").textContent = titles[next];
  message("");
  try {
    await load();
  } catch (e) {
    message(e.message, true);
  }
}
async function reloadData() {
  try {
    await load();
  } catch (e) {
    message(e.message, true);
  }
}
async function confirm(title, body, button = "ยืนยัน") {
  $("confirmTitle").textContent = title;
  $("confirmBody").textContent = body;
  $("confirmAction").textContent = button;
  const d = $("confirmDialog");
  d.returnValue = "cancel";
  return new Promise((resolve) => {
    d.addEventListener("close", () => resolve(d.returnValue === "confirm"), {
      once: true,
    });
    d.showModal();
  });
}
async function mutate(action, payload, success) {
  if (busy) return;
  busy = true;
  const req = requestId(action, payload);
  message('กำลังบันทึก…');
  const buttons = [...document.querySelectorAll('form button, [data-report-action], [data-triage]')].map(button => ({ button, disabled: button.disabled }));
  buttons.forEach(({button}) => button.disabled = true);
  try {
    const r = await api(action, { ...payload, request_id: req,
      ...(reportWrites.has(action) && view === 'issues' ? { report_view: currentReportView() } : {}),
    });
    pending = null;
    message(success);
    return r;
  } catch (e) {
    message(e.message, true);
    return null;
  } finally {
    busy = false;
    buttons.forEach(({button, disabled}) => button.disabled = disabled);
  }
}
document.addEventListener("click", async (e) => {
  if (e.target.id === "personDrawer") return closePerson();
  const row = e.target.closest("tr[data-person]");
  if (row) return openPerson(row.dataset.person);
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.closePerson !== undefined) return closePerson();
  if (b.dataset.messagePerson) {
    const p = person?.id === b.dataset.messagePerson ? person : data.users.find((x) => x.id === b.dataset.messagePerson);
    if (p && !picked.some((x) => x.id === p.id)) picked.push({ id: p.id, name: p.display_name || "@" + (p.handle || p.id.slice(0, 8)) });
    await show("notices");
    document.querySelector('input[name="aud"][value="pick"]').checked = true;
    return refreshAudience();
  }
  if (b.dataset.messageGroup) {
    await show("notices");
    const input = document.querySelector(`input[name="aud"][value="${FILTER_TO_AUDIENCE[b.dataset.messageGroup] || "all"}"]`);
    if (input) input.checked = true;
    return refreshAudience();
  }
  if (b.dataset.cancelSend) {
    const scheduled = b.textContent.includes("ยกเลิก");
    if (!(await confirm(scheduled ? "ยกเลิกข่าวที่ตั้งเวลาไว้?" : "ถอนข่าวนี้?",
      scheduled ? "ข่าวนี้จะไม่ถูกส่ง" : "ข่าวจะหายจากแอปของผู้รับ และยกเลิกแจ้งเตือนที่ยังไม่ได้ส่ง แจ้งเตือนที่เด้งไปแล้วเรียกคืนไม่ได้",
      scheduled ? "ยกเลิกการตั้งเวลา" : "ถอนข่าว"))) return;
    if (await mutate("cancel_send", { batch_id: b.dataset.cancelSend }, scheduled ? "ยกเลิกแล้ว" : "ถอนข่าวแล้ว")) await reloadData();
    return;
  }
  if (b.dataset.days) {
    days = Number(b.dataset.days);
    document.querySelectorAll("[data-days]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    return show(insightViews[view] ? view : "overview");
  }
  if (b.dataset.peopleFilter) {
    peopleFilter = b.dataset.peopleFilter;
    page = 0;
    return show("users");
  }
  if (b.dataset.view || b.dataset.jump)
    return show(b.dataset.view || b.dataset.jump);
  if (b.dataset.reportBucket) {
    reportBucket = b.dataset.reportBucket; bugPage = 0; issuePage = 0;
    document.querySelectorAll('[data-report-bucket]').forEach(el => el.setAttribute('aria-selected', String(el.dataset.reportBucket === reportBucket)));
    $('reportBucketHint').textContent = { pending: 'เรื่องที่ยังต้องตรวจหรือรอข้อมูลเพิ่มเติม', resolved: 'เรื่องที่แก้เสร็จแล้ว ดูประวัติ เปิดตรวจใหม่ หรือลบจากรายการได้', trash: 'รายการที่ลบจาก Control Room กู้คืนไปหมวดแก้เสร็จแล้วได้ ประวัติของผู้รายงานยังอยู่' }[reportBucket];
    return loadReports();
  }
  if (b.dataset.reportAction) {
    if (busy) return;
    const kind = b.dataset.reportKind, id = kind === 'content' ? Number(b.dataset.reportId) : b.dataset.reportId;
    if (b.dataset.reportAction === 'reopen') {
      const action = kind === 'bug' ? 'bug_triage' : 'triage';
      const payload = kind === 'bug' ? { id, status: 'reviewing', reply: 'ทีมเปิดตรวจเรื่องนี้เพิ่มเติมอีกครั้งครับ' } : { id, status: 'reviewing', note: 'เปิดตรวจเรื่องนี้เพิ่มเติม' };
      const result = await mutate(action, payload, 'เปิดตรวจใหม่แล้ว ดูได้ที่หมวดรอดำเนินการ');
      await refreshAfterReportSave(result); return;
    }
    const trash = b.dataset.reportAction === 'trash';
    if (trash && !(await confirm('ลบเรื่องที่แก้เสร็จแล้วออกจากรายการ?', 'เรื่องนี้จะย้ายไปถังขยะและกู้คืนได้ ไม่ลบโพสต์ บัญชี หรือประวัติของผู้รายงาน', 'ย้ายไปถังขยะ'))) return;
    const result = await mutate(trash ? 'report_trash' : 'report_restore', { kind, id }, trash ? 'ย้ายไปถังขยะแล้ว' : 'กู้คืนไปหมวดแก้เสร็จแล้ว');
    await refreshAfterReportSave(result); return;
  }
  if (b.dataset.target) {
    if (busy) return;
    target = data.users.find((x) => x.id === b.dataset.target) || (person?.id === b.dataset.target ? person : null);
    if (!target) return;
    $("grantTarget").value =
      `${target.display_name || ""} · @${target.handle || target.id}`;
    $('banCurrent').textContent = `${target.display_name || ''} · @${target.handle || target.id} · ${target.banned ? (target.ban_until ? 'แบนถึง ' + when(target.ban_until) : 'แบนถาวร') : 'ใช้งานปกติ'}`;
    $('banAction').value = target.banned ? 'unban' : '1d';
    $('banReason').value = ''; $('grantReason').value = '';
    return show("tokens");
  }
  if (b.dataset.publish || b.dataset.push) {
    const id = b.dataset.publish || b.dataset.push;
    const n = data.notices.find((x) => x.id === id);
    const push = !!b.dataset.push;
    if (
      !(await confirm(
        "ตรวจประกาศก่อนเผยแพร่",
        `${n.title}\n\n${n.body}\n\n${push ? "ส่งเป็นข่าวบนเว็บหลักและ ALT และเข้าคิว Push ให้เครื่องที่อนุญาตไว้" : "เผยแพร่เป็นข่าวบนเว็บหลักและ ALT โดยไม่ส่ง Push"}`,
        "เผยแพร่",
      ))
    )
      return;
    await mutate(
      "publish",
      { id, push },
      "เผยแพร่ข่าวแล้ว" + (push ? " และเข้าคิวแจ้งเตือนแล้ว" : ""),
    );
    return reloadData();
  }
  if (b.dataset.withdraw) {
    if (
      !(await confirm(
        "ถอนประกาศนี้?",
        "ประกาศจะหยุดแสดงบนเว็บหลักและ ALT และยกเลิก Push ที่ยังไม่เริ่มส่ง การแจ้งเตือนที่ส่งไปแล้วเรียกคืนไม่ได้",
        "ถอนประกาศ",
      ))
    )
      return;
    await mutate("withdraw", { id: b.dataset.withdraw }, "ถอนประกาศแล้ว");
    return reloadData();
  }
  if (b.dataset.triage) {
    const result = await mutate(
      "triage",
      {
        id: Number(b.dataset.triage),
        status: b.dataset.status,
        note: $("triageNote" + b.dataset.triage).value,
      },
      "บันทึกสถานะแล้ว",
    );
    if (view === 'issues') await refreshAfterReportSave(result);
    else if (result) await reloadData();
    return;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("personDrawer").hidden) closePerson();
  const row = e.target.closest?.("tr[data-person]");
  if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPerson(row.dataset.person); }
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-bug-form]');
  if (!form) return;
  e.preventDefault();
  const status = form.elements.status.value, reply = form.elements.reply.value.trim();
  if (['needs_info', 'resolved'].includes(status) && reply.length < 5) {
    message('กรุณาเขียนข้อความถึงผู้รายงานอย่างน้อย 5 ตัวอักษร', true); return;
  }
  const result = await mutate('bug_triage', { id: form.dataset.bugForm, status, reply }, 'บันทึกแล้ว ผู้รายงานดูข้อความได้ในเรื่องของฉัน');
  // Keep a failed response draft and retry key intact.
  await refreshAfterReportSave(result);
});
$('staffBugsPrev').onclick = () => { bugPage = Math.max(0, bugPage - 1); loadReports(); };
$('staffBugsNext').onclick = () => { bugPage++; loadReports(); };
$('staffIssuesPrev').onclick = () => { issuePage = Math.max(0, issuePage - 1); loadReports(); };
$('staffIssuesNext').onclick = () => { issuePage++; loadReports(); };
$("searchUsers").addEventListener("submit", (e) => {
  e.preventDefault();
  page = 0;
  show("users");
});
$("usersPrev").onclick = () => {
  if (page) page--;
  show("users");
};
$("usersNext").onclick = () => {
  page++;
  show("users");
};
$("refresh").onclick = () => show(view);
$('pushStatusFilter').onchange=()=>{pushPage=0;show('push_status');};
$('pushPrev').onclick=()=>{pushPage=Math.max(0,pushPage-1);show('push_status');};
$('pushNext').onclick=()=>{pushPage++;show('push_status');};
$("grantForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  if (!target) {
    message("เลือกผู้รับจากหน้าผู้ใช้งานก่อนครับ", true);
    return;
  }
  const amount = Number($("grantAmount").value),
    reason = $("grantReason").value.trim();
  const action = $('tokenAction').value === 'deduct' ? 'deduct' : 'grant';
  const verb = action === 'deduct' ? 'หัก' : 'เพิ่ม';
  if (
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > 10000 ||
    reason.length < 5
  ) {
    message("ตรวจจำนวนและเหตุผลอีกครั้ง", true);
    return;
  }
  if (
    !(await confirm(
      `ยืนยัน${verb}โทเคน`,
      `บัญชี: ${target.display_name} (@${target.handle || target.id})\nรหัส: ${target.id}\n${verb}: ${fmt(amount)} โทเคน\nเหตุผล: ${reason}\nผู้ใช้จะได้รับข้อความส่วนตัวและเข้าคิว Push หากเปิดไว้`,
      `${verb}โทเคน`,
    ))
  )
    return;
  const r = await mutate(
    action,
    { target: target.id, amount, reason },
    `บันทึก${verb} ${fmt(amount)} โทเคนแล้ว ผู้รับจะเห็นเมื่อซิงก์ข้อมูล`,
  );
  if (r) { $("grantReason").value = ''; if (Number.isFinite(r.balance)) target.balance = r.balance; }
});
$('banForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (busy) return;
  if (!target) return message('เลือกบัญชีจากหน้าผู้ใช้งานก่อนครับ', true);
  const duration = $('banAction').value, reason = $('banReason').value.trim();
  if (!['1d','2d','permanent','unban'].includes(duration) || reason.length < 5 || reason.length > 300)
    return message('ตรวจระยะเวลาและเหตุผลอีกครั้ง', true);
  const action = duration === 'unban' ? 'unban' : 'ban';
  const label = { '1d':'แบน 1 วัน', '2d':'แบน 2 วัน', permanent:'แบนถาวร', unban:'ปลดแบน' }[duration];
  if (!(await confirm(`ยืนยัน${label}`, `บัญชี: ${target.display_name} (@${target.handle || target.id})\nรหัส: ${target.id}\nเหตุผล: ${reason}\nผู้ใช้จะได้รับข้อความส่วนตัวและเข้าคิว Push หากเปิดไว้\nงานที่เก็บในเครื่องยังอยู่`, label))) return;
  const r = await mutate(action, { target: target.id, reason, ...(action === 'ban' ? { duration } : {}) }, `บันทึก${label}แล้ว`);
  if (r) {
    target.banned = action === 'ban'; target.ban_until = r.ban_until;
    $('banCurrent').textContent = `${target.display_name || ''} · @${target.handle || target.id} · ${target.banned ? (target.ban_until ? 'แบนถึง ' + when(target.ban_until) : 'แบนถาวร') : 'ใช้งานปกติ'}`;
    $('banReason').value = ''; $('banAction').value = target.banned ? 'unban' : '1d';
  }
});
function currentAudience() {
  const kind = document.querySelector('input[name="aud"]:checked')?.value || "all";
  if (kind === "grade") return { kind, grade: $("audGrade").value };
  if (kind === "pick") return { kind, ids: picked.map((x) => x.id) };
  return { kind };
}
// Datetime inputs are read as Thai wall-clock time whatever the device's own time zone is.
const thaiTime = (v) => (v ? new Date(v + ":00+07:00").toISOString() : null);
function refreshAudience() {
  clearTimeout(audTimer);
  const aud = currentAudience(), seq = ++audSeq;
  $("pickedNames").textContent = picked.length ? picked.map((x) => x.name).join(", ") : 'เลือกจากหน้าผู้ใช้ → กดชื่อ → "ส่งข่าวหาคนนี้"';
  if (aud.kind === "pick" && !picked.length) { lastAud = null; $("audCount").textContent = "ยังไม่ได้เลือกใคร"; return; }
  $("audCount").textContent = "กำลังนับผู้รับ…";
  audTimer = setTimeout(async () => {
    try {
      const r = await api("audience", { audience: aud });
      if (seq !== audSeq) return;
      lastAud = { key: JSON.stringify(aud), ...r };
      $("audCount").textContent = `จะถึง ${fmt(r.recipients)} คน · ในนั้นเด้งบนมือถือได้ ${fmt(r.push_ready)} คน`;
    } catch (e) {
      if (seq === audSeq) $("audCount").textContent = "นับผู้รับไม่ได้: " + e.message;
    }
  }, 250);
}
function sendDraftPayload() {
  return {
    title: $("noticeTitle").value.trim(),
    body: $("noticeBody").value.trim(),
    until: thaiTime($("noticeUntil").value),
  };
}
function resetCompose() {
  $("noticeForm").reset(); picked = []; preview(); refreshAudience(); $("sendAtWrap").hidden = true;
}
$("noticeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const base = sendDraftPayload(), aud = currentAudience();
  if (base.title.length < 4 || !base.body) return message("กรอกหัวข้อ (อย่างน้อย 4 ตัวอักษร) และข้อความให้ครบ", true);
  if (aud.kind === "pick" && !picked.length) return message("ยังไม่ได้เลือกผู้รับ เลือกจากหน้าผู้ใช้ก่อนครับ", true);
  const later = $("sendWhen").value === "later";
  const at = later ? thaiTime($("sendAt").value) : null;
  if (later && !at) return message("เลือกวันเวลาที่จะส่ง", true);
  const label = audienceLabel(aud, picked), push = $("sendPush").checked;
  const counts = lastAud?.key === JSON.stringify(aud) ? lastAud : {};
  if (!(await confirm(later ? "ตรวจข่าวก่อนตั้งเวลา" : "ตรวจข่าวก่อนส่ง",
    sendSummary({ ...base, aud, label, recipients: counts.recipients, pushReady: counts.push_ready, at, push }),
    later ? "ตั้งเวลาส่ง" : "ส่งเลย"))) return;
  const r = await mutate("send", { ...base, at, push, audience: aud, label },
    later ? "ตั้งเวลาแล้ว ข่าวจะออกตามเวลาที่เลือก" : "ส่งข่าวแล้ว");
  if (r) { resetCompose(); await load(); }
});
$("draftBtn").onclick = async () => {
  const payload = sendDraftPayload();
  if (payload.title.length < 4 || !payload.body) return message("กรอกหัวข้อและข้อความให้ครบ", true);
  if (await mutate("draft", payload, "บันทึกร่างแล้ว ยังไม่ได้ส่งให้ผู้ใช้ · ร่างส่งได้ถึงทุกคนเท่านั้น")) { resetCompose(); await load(); }
};
$("audience").addEventListener("change", refreshAudience);
$("sendWhen").onchange = () => { $("sendAtWrap").hidden = $("sendWhen").value !== "later"; };
function preview() {
  $("bodyCount").textContent = `${$("noticeBody").value.length}/280`;
  $("previewTitle").textContent = $("noticeTitle").value || "หัวข้อประกาศ";
  $("previewBody").textContent =
    $("noticeBody").value || "ข้อความที่เขียนจะแสดงตรงนี้";
}
["noticeTitle", "noticeBody"].forEach((id) =>
  $(id).addEventListener("input", preview),
);
$("signIn").onclick = async () => {
  if (!client) return;
  const { error } = await client.auth.signInWithOAuth({
    provider: "github",
    options: {
      scopes: "read:user user:email",
      redirectTo: new URL("./", location.href).href,
    },
  });
  if (error)
    $("gateMessage").textContent =
      "เปิด GitHub เข้าสู่ระบบไม่ได้ กรุณาตรวจ GitHub Provider ใน Supabase";
};
$("signOut").onclick = async () => {
  if (demo) return location.reload();
  adoptSession(null);
  gate('ออกจากระบบแล้ว');
  try { await client.auth.signOut({ scope: 'local' }); }
  finally { staffAuth.clear(); }
};
function adoptSession(next) {
  const previous = session?.user?.id || null;
  const changed = previous !== (next?.user?.id || null);
  if (changed) { ++authEpoch; ++reportLoadSeq; ++pushLoadSeq; pushPage=0; }
  if (changed && previous) {
    target = null; pending = null;
    for(const id of ['pushMetrics','pushRows','pushUpdated','pushHint']) $(id).textContent='';
    for (const key of Object.keys(data)) data[key] = [];
    person = null; ++personSeq; ++insightSeq; $('personDrawer').hidden = true;
    picked = []; lastAud = null; ++audSeq;
    for (const id of ['identity', 'sendList', 'audCount', 'overviewBody', 'usageBody', 'outcomesBody', 'peopleChips', 'personBody', 'updatedAt', 'usersRows', 'noticeList', 'bugIssueList', 'issueList', 'auditList']) $(id).innerHTML = '';
    document.querySelectorAll('form input, form textarea').forEach(el => el.value = '');
    gate('บัญชีเปลี่ยนแล้ว กรุณาเปิด Control Room อีกครั้ง');
  }
  session = next;
  providerToken = staffAuth?.providerToken(next) || null;
}
async function start() {
  if (demo) {
    $("demoBanner").hidden = false;
    $("modeBadge").textContent = "ข้อมูลจำลอง";
    $("identity").textContent = "@demo_developer";
    $("gate").hidden = true;
    $("console").hidden = false;
    return show("overview");
  }
  if (!window.supabase || !window.SUPABASE_CONFIG?.url) {
    gate("โหลดระบบเข้าสู่ระบบไม่ได้ กรุณาตรวจการเชื่อมต่อ");
    return;
  }
  const callback = new URL(location.href);
  const callbackHash = new URLSearchParams(callback.hash.slice(1));
  const callbackError =
    callback.searchParams.get("error") || callbackHash.get("error");
  if (callbackError) {
    gate(
      callbackError === "access_denied"
        ? "ยังไม่ได้อนุญาตให้เข้าสู่ระบบ GitHub กดเข้าสู่ระบบเพื่อลองใหม่ได้ครับ"
        : "เชื่อม GitHub ไม่สำเร็จ ให้ผู้ดูแลตรวจ Client ID และ Client Secret ใน Supabase แล้วลองใหม่ครับ",
    );
    // Show a fixed explanation, never reflect provider error text or keep it in the URL.
    history.replaceState(null, "", location.pathname);
  }
  let persistent, tab;
  try { persistent = window.localStorage; } catch {}
  try { tab = window.sessionStorage; } catch {}
  staffAuth = createStaffSessionStorage({ persistent, tab });
  $('sessionHint').textContent = staffAuth.persistentAvailable
    ? 'จำการเข้าสู่ระบบบนเครื่องนี้ · กดออกจากระบบเมื่อเลิกใช้เครื่องร่วมกัน'
    : 'เบราว์เซอร์นี้จำการเข้าสู่ระบบได้เฉพาะแท็บที่เปิดอยู่';
  client = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey,
    {
      auth: {
        storage: staffAuth.storage,
        storageKey: STAFF_AUTH_KEY,
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  );
  // Register before awaiting session recovery, and keep this callback synchronous.
  client.auth.onAuthStateChange((event, s) => {
    adoptSession(s);
    if (event === 'SIGNED_OUT') {
      staffAuth.clear();
      gate('ออกจากระบบแล้ว');
    }
  });
  const { data: r, error } = await client.auth.getSession();
  if (error) {
    gate("ตรวจการเข้าสู่ระบบไม่ได้ กรุณาลองใหม่");
    return;
  }
  adoptSession(r.session);
  if (!session) {
    try {
      const settings = await fetch(
        window.SUPABASE_CONFIG.url + "/auth/v1/settings",
        {
          headers: { apikey: window.SUPABASE_CONFIG.anonKey },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (settings.ok && !(await settings.json()).external?.github) {
        $("signIn").disabled = true;
        gate(
          "ยังไม่ได้เปิดเข้าสู่ระบบ GitHub ใน Supabase ให้เจ้าของโปรเจกต์ติดตั้งตามคู่มือก่อนครับ",
        );
      }
    } catch {}
    return;
  }
  if (!providerToken) {
    gate("กรุณาเข้าสู่ระบบด้วย GitHub อีกครั้งเพื่อตรวจสิทธิ์รีโป");
    return;
  }
  try {
    const me = await api("session");
    $("identity").textContent = `@${me.login}`;
    $("gate").hidden = true;
    $("console").hidden = false;
    await show("overview");
  } catch (e) {
    gate(e.message);
  }
}
start().catch(() => gate("เริ่ม Control Room ไม่สำเร็จ กรุณารีเฟรช"));
