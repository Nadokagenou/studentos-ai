import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(
  new URL("../../staff-news.js", import.meta.url),
  "utf8",
);
function context(response) {
  const cache = new Map();
  let painted = 0;
  const c = {
    URLSearchParams,
    Date,
    AbortSignal,
    location: { search: "" },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    localStorage: { setItem: (k, v) => cache.set(k, v), getItem: k => cache.get(k) || null },
    window: {
      SUPABASE_CONFIG: {
        url: "https://example.supabase.co",
        anonKey: "public",
      },
    },
    newsItems: [{ id: "file-notice" }, { id: "staff-old" }],
    NEWS_CACHE_KEY: "cache",
    newsPaintRow() {
      painted++;
    },
    curScreen: "scr-menu",
    fetch: async () => response,
  };
  vm.createContext(c);
  vm.runInContext(source, c);
  return { c, cache, painted: () => painted };
}
test("missing backend leaves the existing news available", async () => {
  const { c } = context({ ok: false });
  await vm.runInContext("staffNewsLoad()", c);
  assert.equal(c.newsItems.length, 2);
});
test("server publications merge with file news and remove withdrawn server copy", async () => {
  const { c, cache, painted } = context({
    ok: true,
    json: async () => [
      {
        id: "new",
        title: "Published",
        body: "Approved",
        published_at: "2026-10-15T12:00:00Z",
        until_at: null,
      },
    ],
  });
  await vm.runInContext("staffNewsLoad()", c);
  assert.deepEqual(
    Array.from(c.newsItems, (x) => x.id),
    ["file-notice", "staff-new"],
  );
  assert.equal(c.newsItems[1].kind, "notice");
  assert.equal(painted(), 1);
  assert.ok(cache.has("cache"));
});
test("empty server publication list removes cached withdrawn notices", async () => {
  const { c } = context({ ok: true, json: async () => [] });
  await vm.runInContext("staffNewsLoad()", c);
  assert.deepEqual(
    Array.from(c.newsItems, (x) => x.id),
    ["file-notice"],
  );
});

test("refreshing file news within the throttle window preserves the current server notices", async () => {
  const { c } = context({ok:true,json:async()=>[{id:"live",title:"Live",body:"Visible",published_at:new Date().toISOString()}]});
  await vm.runInContext("staffNewsLoad()", c);
  c.newsItems = [{id:"file-new"}];
  await vm.runInContext("staffNewsLoad()", c);
  assert.deepEqual(Array.from(c.newsItems,x=>x.id),["file-new","staff-live"]);
});

for (const build of ["../..", "../../.."]) {
  const inbox = await readFile(new URL(build+"/inbox.js",import.meta.url),"utf8");
  test(`published notices appear safely in the notification center (${build})`, async () => {
    const {c} = context({ok:true,json:async()=>[{id:"live",title:"<script>test</script>",body:"Message & notice",published_at:new Date().toISOString()}]});
    c.state={inbox:[]}; c.dmRows=[]; c.currentUser=null;
    c.esc=x=>String(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    c.icon=()=>"";c.notifAgo=()=>"";c.notifKick=()=>{};c.notifPaintBell=()=>{};
    const body={innerHTML:""},sub={textContent:""};
    c.document={getElementById:id=>id==='notifBody'?body:id==='notifSub'?sub:null};
    vm.runInContext(inbox.slice(inbox.indexOf("const NOTIF_KEY"),inbox.indexOf("function notifUnread")),c);
    vm.runInContext(inbox.slice(inbox.indexOf("function renderNotif()")),c);
    await vm.runInContext("staffNewsLoad()",c);
    c.curScreen='scr-notif';
    vm.runInContext("renderNotif()",c);
    assert.match(body.innerHTML,/&lt;script&gt;test&lt;\/script&gt;/);
    assert.match(body.innerHTML,/Message &amp; notice/);
    assert.match(body.innerHTML,/staffNotifOpen/);
    vm.runInContext("notifFilter='work';renderNotif()",c);
    assert.doesNotMatch(body.innerHTML,/Message &amp; notice/);
  });
}

test("private credit notices never remain visible after switching accounts or signing out",async()=>{
  const {c}=context({ok:true,json:async()=>[]});
  c.currentUser={id:'recipient'};
  c.sb={rpc:()=>({abortSignal:async()=>({data:[{id:'credit',title:'Received 100 tokens',body:'For you',published_at:new Date().toISOString()}],error:null})})};
  await vm.runInContext('staffPersonalLoad(true)',c);
  assert.equal(vm.runInContext('staffNotifItems(0).length',c),1);
  assert.equal(vm.runInContext('staffNotifItems(0)[0].staff.personal',c),true);
  c.currentUser={id:'someone-else'};
  assert.equal(vm.runInContext('staffNotifItems(0).length',c),0);
  c.currentUser=null;
  assert.equal(vm.runInContext('staffNotifItems(0).length',c),0);
});
function walletContext(initial, saveOK = true) {
  let wallet = { ...initial };
  const values = new Map();
  const c = {
    URLSearchParams,
    Date,
    location: { search: "" },
    sessionStorage: { getItem: () => null },
    localStorage: {
      getItem: (k) => values.get(k),
      setItem: (k, v) => values.set(k, v),
    },
    VAULT_AT_KEY: "vault-at",
    rawTokenState: () => ({ ...wallet }),
    saveTokenState: (v) => {
      if (saveOK) wallet = { ...v };
      return saveOK;
    },
  };
  vm.createContext(c);
  vm.runInContext(source, c);
  return { c, read: () => wallet };
}
test("server credits preserve spending made while a sync request was in flight", () => {
  const { c, read } = walletContext({
    bal: 15.5,
    staffMinted: 0,
    skins: { owned: 1 },
  });
  c.remote = { at: Date.now(), tokens: { bal: 1020.5, staffMinted: 1000 } };
  vm.runInContext("staffApplyCredits(remote)", c);
  assert.equal(read().bal, 1015.5);
  assert.equal(read().skins.owned, 1);
});
test("replayed server receipts or imported receipts do not mint twice", () => {
  const { c, read } = walletContext({ bal: 1015.5, staffMinted: 1000 });
  c.remote = { tokens: { staffMinted: 1000 } };
  vm.runInContext("staffApplyCredits(remote)", c);
  vm.runInContext("staffApplyCredits(remote)", c);
  assert.equal(read().bal, 1015.5);
});
test("failed local storage does not advance a credit receipt", () => {
  const { c, read } = walletContext({ bal: 15.5, staffMinted: 0 }, false);
  c.remote = { tokens: { staffMinted: 1000 } };
  assert.equal(vm.runInContext("staffApplyCredits(remote)", c), false);
  assert.equal(read().bal, 15.5);
  assert.equal(read().staffMinted, 0);
});
