const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Established names and abbreviations displayed verbatim by the game and its guide.
const intentional = [
  "FROSTBOUND", "The Final Trial", "Team Beta", "Eldric", "Hardcore", "Boss Rush",
  "The Forgotten Outpost", "Hollowpine Forest", "Crystal Depths", "The Silent Capital", "The Frozen Throne",
  "The Gatekeeper", "Gatekeeper", "The Crystal Warden", "Crystal Warden", "The Frozen King", "Frozen King",
  "Frost Edge", "Winter Fang", "Glacial Spear", "King's Greatsword", "Ashen Blade", "Moonpiercer",
  "Frost Crowns", "Frost Crown", "HP", "FC", "FPS", "WASD", "Esc", "Space", "Shift",
  "SOS", "Canvas", "iPhone", "Android", "Chrome", "Safari", "GitHub", "seed", "Windows", "macOS",
  "FrostHunter", "WinterFox", "AshenKnight", "HollowPine", "Glacier",
];

function translationAudit(output) {
  const checked = new Set();
  const remaining = new Map();
  const kept = new Set();
  let completed = false;

  async function check(page, screen) {
    const result = await page.evaluate(intentional => {
      const root = document.documentElement;
      const missing = FrostI18n.missingKeys();
      const excluded = "script,style,pre,[hidden],[data-no-translate]";
      const hasText = value => /[a-z]/i.test(value);
      const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      const normalize = value => value.trim().replaceAll("’","'").replace(/\s+/g," ");
      const terms = intentional.map(name=>[name,new RegExp("\\b"+escape(name)+"\\b","gi")]);
      const ignore = /\bv\d+(?:\.\d+)+\b|\b(?:[A-Z]|SS|I{1,3}|IV|VI{1,3}|IX|X)\b/g;
      const kept = new Set(), remaining = new Set();
      function inspect(value) {
        if(!hasText(value)) return;
        let text = normalize(value);
        for(const [name,pattern] of terms) text=text.replace(pattern,()=>{kept.add(name);return "";});
        if(hasText(text.replace(ignore,""))) remaining.add(normalize(value));
      }
      function visible(element) {
        return element && !element.closest(excluded) && element.getClientRects().length > 0;
      }
      inspect(document.title);
      const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      for(let node=walk.nextNode();node;node=walk.nextNode()) {
        if(visible(node.parentElement)) inspect(node.data);
      }
      for(const node of document.querySelectorAll("[aria-label],[title],[alt],[placeholder],[data-label]")) {
        if(!visible(node)) continue;
        for(const attr of ["aria-label","title","alt","placeholder","data-label"]) inspect(node.getAttribute(attr)??"");
      }
      for(const value of window.drawnGameWords??[]) inspect(value);
      window.drawnGameWords?.clear();
      return {lang:root.lang,remaining:[...remaining],kept:[...kept],missing};
    }, intentional);
    assert.equal(result.lang,"th",screen);
    checked.add(screen);
    for(const value of result.kept) kept.add(value);
    for(const value of [...result.remaining,...result.missing.map(key=>"Missing key: "+key)]) {
      if(!remaining.has(value)) remaining.set(value,new Set());
      remaining.get(value).add(screen);
    }
  }

  function finish(strict=true) {
    if(completed) return;
    completed = true;
    const report={screens:[...checked],intentional:[...kept].sort(),
      remaining:Object.fromEntries([...remaining].sort(([a],[b])=>a.localeCompare(b)).map(([text,uses])=>[text,[...uses]]))};
    fs.writeFileSync(path.join(output,"thai-audit.json"),JSON.stringify(report,null,2)+"\n");
    if(strict) assert.equal(remaining.size,0,`${remaining.size} Thai localization issues in ${path.join(output,"thai-audit.json")}`);
  }
  return {check,finish};
}

module.exports = {translationAudit};
