// ข่าวที่ทีมเผยแพร่จาก Control Room ใช้เฉพาะ RPC สาธารณะที่คืนประกาศเผยแพร่แล้ว
// ข้อความทั้งหมดผ่าน renderer ข่าวเดิมที่ escape HTML ก่อนแสดง
let staffNewsAt = 0,
  staffNewsBusy = false;
let staffPublicNews = null, staffPersonalRows = [], staffPersonalUser = null,
  staffPersonalAt = 0, staffPersonalBusy = false;
function staffRefreshNotifs() {
  if (typeof notifPaintBell === "function") notifPaintBell();
  if (typeof curScreen !== "undefined" && curScreen === "scr-notif" && typeof renderNotif === "function") renderNotif();
}
function staffMergeNews() {
  if (!staffPublicNews) return;
  newsItems = [...(newsItems || []).filter(x => !x.id.startsWith("staff-")), ...staffPublicNews];
}
async function staffPersonalLoad(force = false) {
  const user = typeof currentUser !== "undefined" ? currentUser?.id : null;
  if (user !== staffPersonalUser) {
    staffPersonalUser = user; staffPersonalRows = []; staffPersonalAt = 0;
  }
  if (!user || typeof sb === "undefined" || !sb || staffPersonalBusy || (!force && Date.now() - staffPersonalAt < 30000)) return;
  staffPersonalBusy = true; staffPersonalAt = Date.now();
  try {
    const { data, error } = await sb.rpc("staff_personal_notices").abortSignal(AbortSignal.timeout(5000));
    if (!error && Array.isArray(data) && user === staffPersonalUser && user === currentUser?.id) staffPersonalRows = data;
  } catch {} finally {
    staffPersonalBusy = false; staffRefreshNotifs();
    if (user !== staffPersonalUser) void staffPersonalLoad(true);
  }
}
function staffNotifItems(cut) {
  const user = typeof currentUser !== "undefined" ? currentUser?.id : null;
  const publicRows = (typeof newsItems !== "undefined" ? newsItems || [] : []).filter(x => x.id.startsWith("staff-"))
    .map(x => ({...x, published_at: x.published_at || x.date, until_at: x.until, personal: false}));
  const personal = user && user === staffPersonalUser ? staffPersonalRows.map(x => ({...x, personal: true})) : [];
  return [...publicRows, ...personal].filter(x => !x.until_at || Date.parse(x.until_at) > Date.now()).map(x => ({
    kind: "staff", at: Date.parse(x.published_at), unread: Date.parse(x.published_at) > cut,
    staff: {id:x.id,title:x.title,body:x.body,personal:x.personal}
  })).filter(x => Number.isFinite(x.at));
}
function staffNotifOpen(id) {
  const item = staffNotifItems(0).find(x => x.staff.id === id);
  if (item?.staff.personal) { if (typeof go === "function") go("scr-shop"); }
  else if (typeof go === "function") go("scr-news");
}
// รับเฉพาะส่วนต่างเครดิตจาก ledger ลงยอดล่าสุดในเครื่อง ไม่ทับยอดที่ผู้ใช้
// เพิ่งใช้ไประหว่างรอคำขอซิงก์ และใช้ตัวนับสะสมกันบวกซ้ำเมื่อ retry
function staffApplyCredits(vault) {
  const minted = Number(vault?.tokens?.staffMinted);
  if (!Number.isSafeInteger(minted) || minted < 0) return false;
  const local = rawTokenState();
  const seen = Number.isSafeInteger(Number(local.staffMinted))
    ? Number(local.staffMinted)
    : 0;
  if (minted <= seen) return false;
  const balance = Number(local.bal);
  const next = {
    ...local,
    bal:
      (Number.isFinite(balance) && balance >= 0 ? balance : 0) + minted - seen,
    staffMinted: minted,
  };
  if (!saveTokenState(next, true)) return false;
  try {
    localStorage.setItem(
      VAULT_AT_KEY,
      String(
        Math.max(
          Date.now(),
          Number(localStorage.getItem(VAULT_AT_KEY)) || 0,
          Number(vault.at) || 0,
        ) + 1,
      ),
    );
  } catch {}
  return true;
}
async function staffNewsLoad() {
  if (
    staffNewsBusy ||
    Date.now() - staffNewsAt < 60000 ||
    !window.SUPABASE_CONFIG?.url
  ) {
    if (staffPublicNews) {
      staffMergeNews(); newsPaintRow(); staffRefreshNotifs();
      if (typeof curScreen !== "undefined" && curScreen === "scr-news") renderNews();
    }
    return;
  }
  staffNewsBusy = true;
  staffNewsAt = Date.now();
  try {
    const r = await fetch(
      window.SUPABASE_CONFIG.url + "/rest/v1/rpc/staff_public_notices",
      {
        method: "POST",
        cache: "no-store",
        headers: {
          apikey: window.SUPABASE_CONFIG.anonKey,
          "content-type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!r.ok) return; // ยังไม่ได้ติดตั้งหลังบ้าน: ข่าวจากไฟล์เดิมยังทำงานตามปกติ
    const rows = await r.json();
    if (!Array.isArray(rows)) return;
    const notices = rows
      .filter(
        (x) =>
          x &&
          typeof x.id === "string" &&
          typeof x.title === "string" &&
          typeof x.body === "string" &&
          Number.isFinite(Date.parse(x.published_at)),
      )
      .map((x) => ({
        id: "staff-" + x.id,
        kind: "notice",
        title: x.title,
        body: x.body,
        date: new Date(x.published_at).toISOString().slice(0, 10),
        published_at: x.published_at,
        until: x.until_at || undefined,
        by: "ทีม Student OS",
        evidence: [
          {
            source: "staff-console",
            quote: "เผยแพร่โดยผู้ร่วมพัฒนาที่ผ่านการตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์",
          },
        ],
      }));
    staffPublicNews = notices;
    staffMergeNews();
    try {
      localStorage.setItem(
        NEWS_CACHE_KEY,
        JSON.stringify({ at: Date.now(), items: newsItems }),
      );
    } catch {}
    newsPaintRow();
    staffRefreshNotifs();
    if (typeof curScreen !== "undefined" && curScreen === "scr-news")
      renderNews();
  } catch {
  } finally {
    staffNewsBusy = false;
  }
}
let staffNewsRequested = false, staffNotifRequested = false;
try {
  if (new URLSearchParams(location.search).get("go") === "staff-news")
    sessionStorage.setItem("studentos.alt.staffNewsOpen", "1");
  staffNewsRequested =
    sessionStorage.getItem("studentos.alt.staffNewsOpen") === "1";
  if (new URLSearchParams(location.search).get("go") === "staff-notif") sessionStorage.setItem("studentos.alt.staffNotifOpen", "1");
  staffNotifRequested = sessionStorage.getItem("studentos.alt.staffNotifOpen") === "1";
} catch {}
function staffNewsRoute() {
  if ((!staffNewsRequested && !staffNotifRequested) || ["scr-login", "scr-onboard"].includes(curScreen))
    return;
  staffNewsRequested = false;
  try {
    sessionStorage.removeItem("studentos.alt.staffNewsOpen");
    sessionStorage.removeItem("studentos.alt.staffNotifOpen");
  } catch {}
  const screen = staffNotifRequested ? "scr-notif" : "scr-news";
  staffNotifRequested = false;
  go(screen);
}
