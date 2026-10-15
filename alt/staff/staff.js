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
  users: "ผู้ใช้งาน",
  tokens: "เพิ่มโทเคน",
  notices: "ข่าวสารและแจ้งเตือน",
  issues: "รายงานที่รอตรวจ",
  audit: "ประวัติการจัดการ",
};
const labels = {
  grant: "เพิ่มโทเคน",
  draft: "บันทึกร่าง",
  publish: "เผยแพร่ประกาศ",
  withdraw: "ถอนประกาศ",
  triage: "เปลี่ยนสถานะรายงาน",
};
const demo = location.pathname.endsWith("/preview.html");
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
  if (!session || !providerToken)
    throw Error("กรุณาเข้าสู่ระบบด้วย GitHub อีกครั้ง");
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
  if (!r.ok) {
    if (r.status === 401 || r.status === 403)
      gate(body.error || "บัญชีนี้เข้า Control Room ไม่ได้");
    throw Error(body.error || "ทำรายการไม่ได้ กรุณาลองใหม่");
  }
  return body;
}
async function demoApi(action, p) {
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
  if (action === "issues") return { items: demoIssues };
  if (action === "audit") return { items: demoAudit };
  if (action === "grant") {
    const u = demoUsers.find((x) => x.id === p.target);
    u.balance += p.amount;
    demoAudit.unshift({
      action: "grant",
      amount: p.amount,
      actor_login: "demo_developer",
      detail: `@${u.handle} +${p.amount} · ${p.reason}`,
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
function issuesHTML(items, compact = false) {
  return items.length
    ? items
        .map(
          (x) =>
            `<div class="item"><h3>รายงาน #${esc(x.id)} <span class="tag ${x.status === "closed" ? "dim" : "warn"}">${esc({ open: "รอตรวจ", reviewing: "กำลังตรวจ", closed: "ปิดเรื่อง" }[x.status] || "รอตรวจ")}</span></h3><p>${esc(x.kind)} · ${esc(x.reason)}</p><p>${esc(x.note || "ไม่มีหมายเหตุ")}</p><p>${esc(when(x.created_at))}</p>${compact ? "" : `<label class="issue-note">หมายเหตุทีม<input id="triageNote${esc(x.id)}" maxlength="300" value="${esc(x.staff_note || "")}" placeholder="สิ่งที่ตรวจพบหรือสิ่งที่ทีมถัดไปควรรู้"></label><div class="actions"><button data-triage="${esc(x.id)}" data-status="reviewing">รับเรื่อง</button><button data-triage="${esc(x.id)}" data-status="closed">ปิดเรื่อง</button><button data-triage="${esc(x.id)}" data-status="open">เปิดตรวจใหม่</button></div>`}</div>`,
        )
        .join("")
    : empty("ไม่มีรายงานที่รอตรวจ");
}
async function load() {
  if (view === "overview") {
    const r = await api("overview");
    $("metrics").innerHTML = [
      ["บัญชีที่เคยซิงก์", r.users, "ยังไม่นับผู้ใช้แบบไม่ล็อกอิน"],
      ["ซิงก์ใน 24 ชั่วโมง", r.synced_24h, "นับเวลาซิงก์ล่าสุด"],
      ["รายงานที่ยังไม่ปิด", r.open_reports, "รับเรื่องและติดตามต่อได้"],
      ["เพิ่มโทเคนวันนี้", r.tokens_today, "ยอดรวมจากรายการแอดมิน"],
    ]
      .map(
        ([l, n, s]) =>
          `<article class="metric"><span>${esc(l)}</span><b>${fmt(n)}</b><small>${esc(s)}</small></article>`,
      )
      .join("");
    $("overviewIssues").innerHTML = issuesHTML(r.issues || [], true);
    $("overviewAudit").innerHTML = auditHTML(r.audit || []);
  }
  if (view === "users") {
    const r = await api("users", {
      query: $("userQuery").value.trim(),
      offset: page * 20,
    });
    data.users = r.items || [];
    $("usersRows").innerHTML = data.users.length
      ? data.users
          .map(
            (x) =>
              `<tr><td><b>${esc(x.display_name || "ยังไม่มีชื่อ")}</b><small>@${esc(x.handle || x.id.slice(0, 8))}</small></td><td>${esc(when(x.last_sync))}</td><td>${fmt(x.balance)}</td><td><button data-target="${esc(x.id)}">เพิ่มโทเคน</button></td></tr>`,
          )
          .join("")
      : '<tr><td colspan="4">ไม่พบผู้ใช้</td></tr>';
    $("usersPage").textContent = `หน้า ${page + 1}`;
    $("usersPrev").disabled = page === 0;
    $("usersNext").disabled = !r.has_more;
  }
  if (view === "audit") {
    data.audit = (await api("audit")).items || [];
    $("auditList").innerHTML = auditHTML(data.audit);
  }
  if (view === "issues") {
    data.issues = (await api("issues")).items || [];
    $("issueList").innerHTML = issuesHTML(data.issues);
  }
  if (view === "notices") {
    data.notices = (await api("notices")).items || [];
    $("noticeList").innerHTML = data.notices.length
      ? data.notices
          .map(
            (x) =>
              `<div class="item"><h3>${esc(x.title)} <span class="tag ${x.status === "draft" ? "dim" : ""}">${esc({ draft: "ร่าง", published: "เผยแพร่แล้ว", withdrawn: "ถอนแล้ว" }[x.status] || x.status)}</span></h3><p>${esc(x.body)}</p><p>${esc(when(x.published_at || x.created_at))}${x.push_status ? " · " + esc(x.push_status) : ""}</p><div class="actions">${x.status === "draft" ? `<button data-publish="${esc(x.id)}">เผยแพร่เป็นข่าวในแอป</button><button data-push="${esc(x.id)}">เผยแพร่พร้อมแจ้งเตือน Push</button>` : ""}${x.status !== "withdrawn" ? `<button data-withdraw="${esc(x.id)}">ถอนประกาศ</button>` : ""}</div></div>`,
          )
          .join("")
      : empty("ยังไม่มีประกาศ เริ่มจากบันทึกเป็นร่าง");
  }
}
async function show(next) {
  if (!titles[next]) return;
  view = next;
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
  document.querySelectorAll("form button").forEach((b) => (b.disabled = true));
  try {
    const r = await api(action, { ...payload, request_id: req });
    pending = null;
    message(success);
    return r;
  } catch (e) {
    message(e.message, true);
    return null;
  } finally {
    busy = false;
    document
      .querySelectorAll("form button")
      .forEach((b) => (b.disabled = false));
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.view || b.dataset.jump)
    return show(b.dataset.view || b.dataset.jump);
  if (b.dataset.target) {
    target = data.users.find((x) => x.id === b.dataset.target);
    $("grantTarget").value =
      `${target.display_name || ""} · @${target.handle || target.id}`;
    return show("tokens");
  }
  if (b.dataset.publish || b.dataset.push) {
    const id = b.dataset.publish || b.dataset.push;
    const n = data.notices.find((x) => x.id === id);
    const push = !!b.dataset.push;
    if (
      !(await confirm(
        "ตรวจประกาศก่อนเผยแพร่",
        `${n.title}\n\n${n.body}\n\n${push ? "ส่งเป็นข่าวใน ALT และเข้าคิว Push ให้เครื่องที่อนุญาตไว้" : "เผยแพร่เป็นข่าวใน ALT โดยไม่ส่ง Push"}`,
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
        "ประกาศจะหยุดแสดงใน ALT และยกเลิก Push ที่ยังไม่เริ่มส่ง การแจ้งเตือนที่ส่งไปแล้วเรียกคืนไม่ได้",
        "ถอนประกาศ",
      ))
    )
      return;
    await mutate("withdraw", { id: b.dataset.withdraw }, "ถอนประกาศแล้ว");
    return reloadData();
  }
  if (b.dataset.triage) {
    await mutate(
      "triage",
      {
        id: Number(b.dataset.triage),
        status: b.dataset.status,
        note: $("triageNote" + b.dataset.triage).value,
      },
      "บันทึกสถานะแล้ว",
    );
    return reloadData();
  }
});
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
$("grantForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!target) {
    message("เลือกผู้รับจากหน้าผู้ใช้งานก่อนครับ", true);
    return;
  }
  const amount = Number($("grantAmount").value),
    reason = $("grantReason").value.trim();
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
      "ยืนยันเพิ่มโทเคน",
      `ผู้รับ: ${target.display_name} (@${target.handle || target.id})\nรหัส: ${target.id}\nจำนวน: ${fmt(amount)} โทเคน\nเหตุผล: ${reason}`,
      "เพิ่มโทเคน",
    ))
  )
    return;
  const r = await mutate(
    "grant",
    { target: target.id, amount, reason },
    `บันทึกเพิ่ม ${fmt(amount)} โทเคนแล้ว ผู้รับจะเห็นเมื่อซิงก์ข้อมูล`,
  );
  if (r) $("grantReason").value = "";
});
$("noticeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    title: $("noticeTitle").value.trim(),
    body: $("noticeBody").value.trim(),
    until: $("noticeUntil").value
      ? new Date($("noticeUntil").value).toISOString()
      : null,
  };
  if (payload.title.length < 4 || !payload.body) {
    message("กรอกหัวข้อและข้อความให้ครบ", true);
    return;
  }
  if (await mutate("draft", payload, "บันทึกร่างแล้ว ยังไม่ได้ส่งให้ผู้ใช้")) {
    e.target.reset();
    preview();
    await load();
  }
});
function preview() {
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
  sessionStorage.removeItem("studentos.staff.github");
  await client.auth.signOut({ scope: "local" });
  session = null;
  providerToken = null;
  gate("ออกจากระบบแล้ว");
};
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
  client = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey,
    {
      auth: {
        storage: sessionStorage,
        storageKey: "studentos.staff.auth",
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
      },
    },
  );
  const { data: r, error } = await client.auth.getSession();
  if (error) {
    gate("ตรวจการเข้าสู่ระบบไม่ได้ กรุณาลองใหม่");
    return;
  }
  session = r.session;
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
  providerToken =
    session.provider_token || sessionStorage.getItem("studentos.staff.github");
  if (session.provider_token)
    sessionStorage.setItem("studentos.staff.github", session.provider_token);
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
  client.auth.onAuthStateChange((event, s) => {
    session = s;
    if (event === "SIGNED_OUT") {
      providerToken = null;
      gate("ออกจากระบบแล้ว");
    }
  });
}
start().catch(() => gate("เริ่ม Control Room ไม่สำเร็จ กรุณารีเฟรช"));
