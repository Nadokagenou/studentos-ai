const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const name of ["items","loot","world","events","enemy-ai","mutations","boss-ai","mini-bosses",
  "environment","regions","localization/th","localization/i18n","landscape"]) require("../"+name);
const i18n=FrostI18n;

test("language auto-detects, persists, falls back to English and preserves placeholders",()=>{
  const saved=new Map();
  const storage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
  i18n.init(null,storage,["fr-CA"]);
  assert.equal(i18n.getLanguage(),"en");
  assert.deepEqual(i18n.getAvailableLanguages(),["en","th"]);
  assert.equal(i18n.t("hud.stage",{n:12}),"Stage 12");
  i18n.init(null,storage,["th-TH"]);
  assert.equal(i18n.t("hud.stage",{n:12}),"ด่าน 12");
  assert.equal(i18n.translate("Untranslated English sentence."),"Untranslated English sentence.");
  assert.equal(i18n.t("missing.key"),"");
  assert.equal(i18n.translate("Recovered 35 HP."),"ฟื้นพลังชีวิต 35");
  assert.equal(i18n.translate("18 Stamina · 12s cooldown"),"ใช้ความอึด 18 · พักสกิล 12 วินาที");
  assert.equal(i18n.setLanguage("en-US"),"en");
  i18n.init(null,storage,["th-TH"]);
  assert.equal(i18n.getLanguage(),"en");
  assert.equal(i18n.setLanguage("fr"),"en");
});

test("Thai catalog covers legacy equipment, skill ranks, story and event data without changing game strings",()=>{
  const all=new Set();
  const add=(...values)=>values.forEach(value=>{if(typeof value==="string"&&value.length) all.add(value);});
  for(const mode of ["story","hardcore","boss"]) for(let seed=0;seed<50;seed++)
    for(const room of FrostRegions.generate(mode,seed).flatMap(r=>[r,...Object.values(r.paths??{}),r.side].filter(Boolean)))
      add(room.name,room.story,room.objective,room.lore);
  for(const [id,item] of Object.entries(FrostItems.ITEMS)) {
    add(item.name,...FrostItems.itemDetailParts(id));
    if(["weapon","armor"].includes(item.slot))
      for(let k=0;k<4;k++) add(...FrostItems.itemDetailParts(FrostItems.itemId(id,4,k)));
  }
  for(const {name,text} of Object.values(FrostLoot.ACTIVES)) add(name,text);
  for(const {name,ranks,text} of Object.values(FrostLoot.PASSIVES)) add(name,...ranks.map(text));
  for(const {name,text,choices} of Object.values(FrostEvents.EVENTS)) {
    add(name,text);
    for(const {label,detail} of choices) add(label,detail);
  }
  for(const lines of Object.values(FrostWorld.DIALOGUE))
    add(...lines.map(line=>Array.isArray(line)?line[1]:line));
  const story=FrostWorld.TEXT;
  add(...story.opening,...story.king.map(([,line])=>line),...story.phases,story.ending);
  for(const attack of [...Object.values(FrostEnemyAI.attacks),...Object.values(FrostBossAI.attacks),...Object.values(FrostMiniBosses.attacks)])
    add(attack.name);
  for(const hazard of Object.values(FrostEnvironment.HAZARDS)) add(hazard.name,hazard.note);
  const proper=new Set(["The Forgotten Outpost","Hollowpine Forest","Crystal Depths","The Silent Capital","The Frozen Throne",
    "The Gatekeeper","The Crystal Warden","Frost Edge","Winter Fang","Glacial Spear","King’s Greatsword","Ashen Blade","Moonpiercer"]);
  assert(all.size>340);
  for(const source of all) assert.equal(i18n.translate(source),source);
  i18n.setLanguage("th");
  for(const source of all) {
    const shown=i18n.translate(source);
    if(proper.has(source)) assert.equal(shown,source);
    else assert.match(shown,/[ก-๙]/u,source);
  }
  assert.equal(FrostItems.ITEMS.edge.description,"A balanced longsword with a three-cut combo and a forgiving parry.");
  assert.equal(i18n.regionSubtitle("Hollowpine Forest"),"ป่าสนไร้แสง");
  i18n.setLanguage("en");
});

test("landscape camera preserves the entire logical arena at phone and tablet aspect ratios",()=>{
  for(const [width,height] of [[844,390],[740,360],[568,320],[1024,768]]) {
    const camera=FrostLandscape.camera(width,height,960,584);
    assert(camera.scale>0&&Number.isFinite(camera.scale));
    assert(camera.x>=0&&camera.y>=0);
    assert(camera.x+960*camera.scale<=width&&camera.y+584*camera.scale<=height+.51);
  }
  const gate=new FrostLandscape.OrientationGate();
  const active={touch:true,portrait:true,running:true,finished:false};
  assert(gate.blocks(active));
  assert(!gate.blocks({...active,portrait:false}));
  assert(!gate.blocks({...active,finished:true}));
  assert(!gate.blocks({...active,touch:false}));
  gate.allow();
  assert(!gate.blocks(active));
  gate.reset();
  assert(gate.blocks(active));
});
