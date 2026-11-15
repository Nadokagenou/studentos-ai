const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const name of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses",
  "environment","regions","combat","records"]) require("../"+name);
const {Run,STEP}=FrostCombat;

test("each tab appends to current records rather than replacing a newer stored snapshot",()=>{
  const memory=new Map();
  const storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
  const result=time=>({kind:"story",won:true,time,progress:{stage:5,wave:1,time}});
  const legacy={...FrostRecords.fromResult(result(90)),version:"3.0"};
  memory.set("frostbound.records.v2",JSON.stringify([legacy]));
  const a=new FrostRecords.LocalRecordProvider(storage), b=new FrostRecords.LocalRecordProvider(storage);
  a.record(result(120));
  b.record(result(140));
  const reloaded=new FrostRecords.LocalRecordProvider(storage);
  assert.deepEqual(reloaded.list({category:"clear",mode:"story"}).map(row=>row.time),[120,140]);
  assert.deepEqual(reloaded.list({category:"clear",mode:"story",version:"3.0"}).map(row=>row.time),[90]);
  const offline=new FrostRecords.LocalRecordProvider({getItem(){throw Error("Blocked");},setItem(){throw Error("Blocked");}});
  offline.record(result(180));offline.record(result(190));
  assert.deepEqual(offline.list({category:"clear",mode:"story"}).map(row=>row.time),[180,190]);
});

test("100 merchant purchases and 100 reward choices reject retries without changing state twice",()=>{
  for(let n=0;n<100;n++) {
    const run=new Run(n%2?"story":"hardcore",n);
    const shop=FrostLoot.shop(run.seed,n%5,run.kind);
    const id=Object.keys(shop).find(key=>shop[key]===1&&FrostItems.ITEMS[key].slot==="weapon"&&run.inventory.canObtain(key));
    assert(id,"a seeded shop offers a single eligible weapon");
    const price=FrostItems.priceOf(shop,id);
    run.inventory.crowns=price+19;
    const {buy}=FrostItems;
    assert.equal(buy(run.inventory,shop,id),"bought");
    assert.equal(buy(run.inventory,shop,id),"sold-out");
    assert.equal(run.inventory.crowns,19);
    assert.equal(run.inventory.owned[id],1);
    run.pending=[];
    run.openReward("normal");
    const pick=run.choices[0];
    assert(run.select(pick.id,true),pick.id);
    const state=JSON.stringify([run.inventory.crowns,run.inventory.owned,run.inventory.potions,run.build.ranks,run.build.active]);
    assert.equal(run.select(pick.id,true),false);
    assert.equal(JSON.stringify([run.inventory.crowns,run.inventory.owned,run.inventory.potions,run.build.ranks,run.build.active]),state);
  }
});

test("50 Frozen King transitions permit exactly one phase event each and finish the run",()=>{
  for(let n=0;n<25;n++) {
    const run=new Run("story",4212+n);
    run.route.index=run.rooms.length-1;
    run.pending=[];
    run.preparing=false;
    run.gateOpen=false;
    run.addEnemy("king",480,295,0);
    const boss=run.boss;
    boss.state="chase";
    Object.assign(run.player,{x:480,y:400});
    for(const phase of [2,3]) {
      run.damageEnemy(boss,9999,0);
      assert.equal(boss.phase,phase);
      assert.equal(boss.state,"transition");
      const hp=boss.hp;
      for(let hit=0;hit<12;hit++) run.damageEnemy(boss,9999,0);
      assert.equal(boss.hp,hp);
      for(let i=0;i<184;i++) run.tick({x:0,y:0},STEP);
      assert.notEqual(boss.state,"transition");
    }
    assert.deepEqual(run.events.filter(event=>event.kind==="phase").map(event=>event.phase),[2,3]);
    run.damageEnemy(boss,9999,0);
    for(let step=0;step<160&&!run.result;step++) run.tick({x:0,y:0},STEP);
    assert.equal(run.result?.won,true);
  }
});
