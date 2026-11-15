(() => {
  "use strict";
  const VERSION = "4.0";
  const SUPPORTED = ["4.0","3.0","2.0"];
  const KEY = "frostbound.records.v2";
  const DEMO = [
    { player:"FrostHunter", kind:"hardcore", won:false, time:492, progress:{stage:4,wave:2,time:474}, date:"2026-01-13", demo:true },
    { player:"WinterFox", kind:"hardcore", won:false, time:383, progress:{stage:3,wave:2,time:365}, date:"2026-01-09", demo:true },
    { player:"AshenKnight", kind:"hardcore", won:true, time:618, progress:{stage:5,wave:1,time:532}, damage:74, parries:20, date:"2026-01-11", demo:true },
    { player:"HollowPine", kind:"story", won:true, time:401, progress:{stage:5,wave:1,time:351}, damage:56, parries:14, date:"2026-01-12", demo:true },
    { player:"Glacier", kind:"boss", won:true, time:228, progress:{stage:3,wave:1,time:151}, damage:63, parries:11, date:"2026-01-15", demo:true }
  ].map(row=>({...row, version:VERSION, verified:false}));
  function rank(records, category, mode, version=VERSION) {
    const rows = records.filter(row => row.version === version
      && (category === "progress" ? row.kind === "hardcore" : row.kind === mode && row.won));
    return rows.sort((a,b) => {
      if (a.won !== b.won) return a.won ? -1 : 1;
      if (a.won) return a.time - b.time;
      return b.progress.stage-a.progress.stage || b.progress.wave-a.progress.wave || a.progress.time-b.progress.time;
    });
  }
  function fromResult(result, date = new Date().toISOString().slice(0,10)) {
    const { progress, won, time, kind, damage, parries, score, bossTime, kills, healing, potions, cleared, dashes } = result;
    return { progress:{...progress}, won, time, kind, damage, parries, score, bossTime, kills, healing, potions, cleared, dashes,
      date, player:"You", version:VERSION, verified:false };
  }
  // A verified provider must validate mode, version and a server-issued run before accepting completion data.
  class LocalRecordProvider {
    constructor(storage) {
      this.storage = storage;
      this.records = this.read();
      this.canSubmitVerified = false;
    }
    read() {
      try {
        const rows = JSON.parse(this.storage?.getItem(KEY));
        if (!Array.isArray(rows)) return [];
        return rows.filter(row => SUPPORTED.includes(row?.version) && ["story","hardcore","boss"].includes(row.kind)
          && Number.isFinite(row.time) && Number.isFinite(row.progress?.stage) && Number.isFinite(row.progress?.wave)
          && Number.isFinite(row.progress?.time) && typeof row.date === "string").slice(0,180)
          .map(row=>({...row, player:"You", demo:false, verified:false}));
      } catch { return []; }
    }
    record(result) {
      if (result.kind === "training") return;
      const rows = [fromResult(result), ...this.records];
      this.records = [...rows.filter(row=>row.version!==VERSION),...["story","hardcore","boss"].flatMap(kind=>{
        const entries = rows.filter(row=>row.kind===kind&&row.version===VERSION);
        const best = kind==="hardcore" ? rank(entries,"progress").slice(0,10) : rank(entries,"clear",kind).slice(0,10);
        return [...new Set([...entries.slice(0,20),...best])];
      })];
      try { this.storage?.setItem(KEY,JSON.stringify(this.records)); } catch {}
    }
    list({category,mode,source="local",version=VERSION}) {
      return rank(source === "demo" ? DEMO : this.records,category,mode,source==="demo"?VERSION:version);
    }
    submitVerified() { return Promise.resolve({ status:"unavailable" }); }
  }
  globalThis.FrostRecords = { VERSION, SUPPORTED, LocalRecordProvider, rank, fromResult };
})();
