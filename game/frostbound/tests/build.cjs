const assert=require("node:assert/strict");
const {test}=require("node:test");
for(const module of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses","environment","regions","combat"]) require("../"+module);
const {Run,STEP}=FrostCombat;
const {ITEMS,itemId,random,buy,familyOf}=FrostItems;
const {PASSIVES,ACTIVES,WEIGHTS,tier,shop}=FrostLoot;
const idle={x:0,y:0};
const tick=(run,count,input=idle)=>{for(let i=0;i<count;i++)run.tick(input);};
const enemy=(run,type="stalker",x=520,y=385)=>{
  run.addEnemy(type,x,y,0);
  const e=run.enemies.at(-1);
  e.state="chase";
  e.cooldown=99;
  return e;
};
const hit={name:"Test strike",damage:20,parry:true};

test("weighted draws are reproducible and within sampling tolerance",()=>{
  const rng=random(4411);
  const amounts=[0,0,0,0,0];
  for(let i=0;i<1000;i++)amounts[tier(rng,WEIGHTS.normal)]++;
  amounts.forEach((n,i)=>assert.ok(Math.abs(n-WEIGHTS.normal[i]*10)<45));
  assert.ok(amounts[4]>0);
  for(const kind of ["elite","boss"]) {
    const draws=Array.from({length:100},()=>tier(rng,WEIGHTS[kind]));
    assert.ok(draws.every(i=>i>=(kind==="elite"?2:3)));
  }
  const aliases=()=>{const r=new Run("story",17);r.openReward("normal");return r.choices;};
  assert.deepEqual(aliases(),aliases());
});

test("100 seeded runs produce valid, single-choice offers without exceeding rank caps",()=>{
  for(let seed=0;seed<100;seed++){
    const r=new Run("story",seed);
    for(let round=0;round<12;round++){
      const mode=round%4===0?"elite":"normal";
      r.openReward(mode);
      const cards=r.choices;
      assert.equal(new Set(cards.map(card=>card.id)).size,3);
      if(mode==="elite") assert.ok(cards.some(card=>card.tier>=2));
      const card=cards[round%3];
      assert.ok(r.select(card.id,true));
      assert.equal(r.select(card.id,true),false);
      if(card.type==="Passive") assert.ok(r.build.ranks[card.key]<=PASSIVES[card.key].ranks.length);
    }
  }
  const r=new Run("story",1);
  r.rewardDrought=5;
  r.build.ranks.counter=3;
  r.openReward("normal");
  assert.ok(r.choices.some(c=>c.tier===3));
  assert.ok(r.choices.every(c=>c.id!=="passive:counter"));
  assert.equal(r.rewardDrought,0);
});

test("200 seeded merchants stay diverse, cap potion stock, and use exact sale prices",()=>{
  const varieties=new Set();
  for(let seed=0;seed<200;seed++){
    const goods=shop(seed,{stage:2},"story",2);
    assert.deepEqual(goods,shop(seed,{stage:2},"story",2));
    assert.equal(Object.keys(goods).length,6);
    assert.equal(Object.keys(goods).filter(id=>ITEMS[id].slot==="potion").length,2);
    varieties.add(Object.keys(goods).map(familyOf).join());
    const hard=shop(seed,{stage:2},"hardcore",2);
    assert.equal(Object.keys(hard).filter(id=>ITEMS[id].slot==="potion").length,1);
  }
  assert.ok(varieties.size>100);
  const r=new Run("story",47);
  const goods=shop(47,{stage:2},"story",2);
  const lot=Object.keys(goods).find(id=>ITEMS[id].slot==="weapon");
  r.inventory.crowns=1000;
  assert.equal(buy(r.inventory,goods,lot),"bought");
  assert.equal(r.inventory.gear.weapon,"edge");
  assert.equal(buy(r.inventory,goods,lot),"sold-out");
  assert.ok(r.inventory.sell(lot));
  assert.equal(r.inventory.crowns,1000-goods.prices[lot]+Math.floor(goods.prices[lot]*.40));
  assert.equal(r.inventory.sell(lot),false);
  for(let i=0;i<2;i++)assert.ok(r.inventory.obtain("flask"));
  assert.ok(!r.inventory.obtain("flask"));
  assert.ok(r.inventory.obtain("azure"));
  assert.ok(!r.inventory.obtain("iron"));
  assert.ok(r.inventory.obtain("heart"));
  assert.ok(!r.inventory.obtain(itemId("heart",4,9)));
});

test("arrows resolve before a reward, reward gear is safe, and cooldown cannot be reset by swapping",()=>{
  const r=new Run("story",29);
  r.pending=[];
  r.shots=[{x:700,y:477,age:0,dir:0,attack:hit}];
  r.inventory.obtain("fang");
  tick(r,1);
  assert.equal(r.mode,"playing");
  assert.equal(r.equip("fang"),false);
  tick(r,100);
  assert.equal(r.mode,"choose");
  assert.ok(r.equip("fang"));
  const active={id:"active:barrier",type:"Active",key:"barrier"};
  r.build.active="lance";r.build.cooldown=3;
  r.offer={context:"normal",cards:[active]};
  assert.equal(r.select(active.id),false);
  assert.ok(r.select(active.id,true));
  assert.equal(r.build.cooldown,18);
  assert.equal(r.select(active.id,true),false);
  r.releaseResources();
  assert.equal(r.build.active,null);
  assert.deepEqual(r.build.ranks,{});
});

test("normal Freeze, capped slow, and boss immunity preserve mandatory phases",()=>{
  const r=new Run("story",2);
  const normal=enemy(r);
  r.build.ranks.zero=1;
  r.build.hit(normal,1,0,100);
  assert.equal(normal.frozenUntil,1.5);
  assert.equal(r.build.slow(normal),.30);
  r.time=1.6;
  r.updateEnemy(normal,STEP);
  assert.equal(normal.frost,0);
  r.build.frost(normal,100);
  assert.equal(normal.frozenUntil,0);
  const boss=enemy(r,"king");
  r.build.hit(boss,1,0,100);
  assert.equal(boss.frozenUntil,undefined);
  assert.equal(boss.posture,15);
  r.build.frost(boss,100);
  assert.equal(boss.posture,15);
  r.damageEnemy(boss,9000,9000);
  assert.equal(boss.phase,2);
  assert.equal(boss.state,"transition");
  const hp=boss.hp;
  r.damageEnemy(boss,9000,9000);
  assert.equal(boss.hp,hp);
  boss.state="chase";
  r.damageEnemy(boss,9000,9000);
  assert.equal(boss.phase,3);
});

test("active skills require input, resource, target and cooldown; no active grants general invulnerability",()=>{
  for(const id of Object.keys(ACTIVES)){
    const r=new Run("story",9);
    r.prepareEncounter();
    const e=enemy(r,"sentinel",id==="judgment"?600:557);
    r.build.active=id;
    tick(r,15);
    assert.equal(e.hp,e.maxHp);
    const before=r.player.stamina;
    assert.ok(r.request("skill",{...idle,aim:0,aimPoint:{x:600,y:385}}),id);
    assert.equal(r.player.stamina,before-ACTIVES[id].cost);
    if(id==="reversal") {
      r.receiveHit(hit,e,r.player);
      assert.equal(e.hp,e.maxHp-65);
      r.receiveHit({...hit,parry:false},e,r.player);
      assert.ok(r.player.hp<100);
    } else {
      tick(r,100);
      if(id==="barrier") assert.ok(r.build.barrier);
      else assert.ok(e.hp<e.maxHp,id);
    }
    r.player.action=null;
    assert.ok(!r.request("skill",idle));
  }
});

test("parry and dodge effects use cooldowns, healing caps, additive modifiers and reset",()=>{
  const r=new Run("story",71,{weapon:"edge",armor:"frostguard"});
  r.inventory.obtain("fragment");assert.ok(r.equip("fragment"));
  Object.assign(r.build.ranks,{counter:3,reversal:2,rhythm:2,embrace:1,footwork:3,momentum:2});
  const e=enemy(r,"sentinel");
  r.player.stamina=5;r.player.hp=45;
  r.build.event("ON_PERFECT_PARRY",e);
  assert.equal(r.player.stamina,27);
  assert.equal(e.frost,45);
  r.build.event("ON_PERFECT_PARRY",e);
  assert.equal(e.frost,45);
  for(let i=1;i<=7;i++){r.time=i*5;r.build.event("ON_PERFECT_PARRY",null);}
  assert.equal(r.build.healed.fragment,20);
  r.build.event("ON_PERFECT_DODGE");
  assert.equal(r.build.cost("dash",25),15);
  assert.ok(r.speed<=1.30);
  for(let i=0;i<8;i++)r.build.defeat({frostSource:true,frost:3});
  assert.equal(r.build.healed.embrace,24);
  r.build.resetRoom();
  assert.deepEqual(r.build.healed,{});
});

test("reference builds keep tactical tradeoffs and do zero idle boss damage",()=>{
  const combinations=[
    ["edge","frostguard","fragment","lance",["reversal","frostbite"]],
    ["fang","mantle","wolf","rush",["footwork","momentum"]],
    ["great","plate","heart","barrier",["discipline","rhythm"]],
    ["ash","crimson","blood","assault",["stand","execution"]],
    ["spear","royal","broken","judgment",["shatter","zero"]]
  ];
  for(const [weapon,armor,relic,active,passives] of combinations){
    const r=new Run("story",33,{weapon,armor});
    r.inventory.obtain(relic);assert.ok(r.equip(relic));
    r.build.active=active;
    passives.forEach(id=>r.build.ranks[id]=1);
    r.prepareEncounter();
    r.pending=[];
    const targets=[enemy(r,"king"),enemy(r,"archer",590),enemy(r,"sentinel",560),enemy(r,"wolf",625)];
    tick(r,120);
    assert.ok(targets.every(e=>e.hp===e.maxHp),weapon);
    r.receiveHit({...hit,parry:false},targets[0],r.player);
    assert.ok(r.player.hp<100,weapon);
    assert.ok(r.player.stamina<=100);
  }
});

test("reactive armor has bounded windows and tradeoffs",()=>{
  for(const [armor,buff] of [["coat","coat"],["crimson","crimson"],["mantle",null]]) {
    const r=new Run("story",1,{armor});
    r.build.dodge();
    const until=buff?r.build.buffs[buff]:r.build.decoy.until;
    r.time=.2;
    r.build.dodge();
    assert.equal(buff?r.build.buffs[buff]:r.build.decoy.until,until);
  }
  const plate=new Run("story",2,{armor:"plate"});
  plate.buffs.iron=3;
  plate.receiveHit({name:"Heavy",damage:40,parry:false},null,plate.player);
  assert.ok(plate.build.live("plate"));
  plate.player.grace=0;
  const hp=plate.player.hp;
  plate.receiveHit({name:"Heavy",damage:40,parry:false},null,plate.player);
  assert.equal(hp-plate.player.hp,20);
  const royal=new Run("story",4,{armor:"royal"});
  royal.receiveHit({...hit,frost:true},null,royal.player);
  assert.ok(royal.build.live("royal"));
  assert.equal(royal.player.frost,26);
});

test("affixes stay unique; equip and rank do not repeatedly scale damage",()=>{
  const r=new Run("story",1);
  const id=itemId("great",4,123);
  assert.equal(ITEMS[id].affixes.length,new Set(ITEMS[id].affixes).size);
  assert.ok(r.inventory.obtain(id));
  for(let repeat=0;repeat<4;repeat++) {
    assert.ok(r.equip(id));
    assert.equal(r.inventory.weapon.heavy.damage,Math.round(ITEMS.great.heavy.damage*1.2));
  }
  assert.ok(r.inventory.upgrade(id));
  const upgraded=r.inventory.gear.weapon;
  assert.deepEqual(ITEMS[upgraded].affixes,ITEMS[id].affixes);
  assert.ok(r.inventory.upgrade(upgraded));
  assert.equal(r.inventory.upgrade(r.inventory.gear.weapon),false);
  assert.equal(r.inventory.weapon.rank,3);
});
