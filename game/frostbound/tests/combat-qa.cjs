const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const name of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses",
  "environment","regions","combat","animation"]) require("../"+name);
const {Run,STEP}=FrostCombat;
const idle={x:0,y:0,aim:0};
const tick=(run,count)=>{for(let i=0;i<count;i++) run.tick(idle,STEP);};

test("100 attack and dash sequences retain recovery cancels and release input", {timeout:3000},()=>{
  const weapons=["edge","fang","spear","great","ash","moon"];
  for(let attempt=0;attempt<100;attempt++) {
    const run=new Run("training",attempt,weapons[attempt%weapons.length]);
    run.enemies=[];
    assert.ok(run.request("light",idle));
    const move=run.player.action;
    assert.equal(run.request("dash",{...idle,x:1}),false);
    tick(run,Math.ceil((move.attack.windup+move.attack.active)*120)+1);
    assert.ok(run.request("dash",{...idle,x:1}));
    const start=run.player.x;
    assert.equal(run.player.action.duration,.44);
    tick(run,66);
    assert.equal(run.player.action,null);
    assert.ok(run.player.x>start+135);
    assert.equal(run.stats.dashes,1);
  }
});

test("50 parries against normal foes, an elite and the King apply once, with approved windows", {timeout:3000},()=>{
  const threats=[
    ["stalker","stalker"],["soldier","soldier"],["archer","archer"],["wisp","wisp"],["sentinel","sentinel"],
    ["hunter","huntingKnife"],["burrower","spike"],["remnant","remnant"],["elite","remnant"],["king","kingThrust"]
  ];
  for(let attempt=0;attempt<50;attempt++) {
    const [type,id]=threats[attempt%threats.length];
    const run=new Run("training",attempt);
    run.enemies=[];
    run.addEnemy(type,545,380,0);
    const foe=run.enemies[0];
    run.startAttack(foe,id);
    const data=foe.attack.data;
    assert.ok(run.request("parry",idle));
    run.player.action.age=.095;
    const before=run.player.hp;
    run.receiveHit(data,foe,foe);
    if(data.parry) {
      assert.equal(run.player.hp,before);
      assert.equal(run.stats.parries,1);
      if(foe.maxPosture<=30) assert.equal(foe.state,"stagger");
      else assert.equal(foe.posture,30);
      assert.equal(run.fx.filter(fx=>fx.category==="perfect").length,1);
    } else {
      assert.ok(run.player.hp<before);
      assert.equal(run.stats.parries,0);
    }
    tick(run,55);
    assert.ok(run.parryStop<=0&&run.time>.39);
  }
});

test("20 Frozen King sequences animate both transitions once and return to live combat", {timeout:3000},()=>{
  for(let seed=0;seed<20;seed++) {
    const run=new Run("boss",seed);
    run.select(run.choices[0].id);
    run.pending=[];
    run.addEnemy("king",310,281,0);
    const boss=run.boss;
    boss.state="chase";
    const scene=new FrostAnimation.Scene();
    for(const phase of [2,3]) {
      run.damageEnemy(boss,9999,50);
      assert.equal(scene.pose(boss,run.time).state,"transition");
      assert.equal(boss.phase,phase);
      assert.equal(boss.timer,1.5);
      run.damageEnemy(boss,9999,50);
      assert.equal(boss.phase,phase);
      tick(run,182);
      assert.notEqual(scene.pose(boss,run.time).state,"transition");
    }
    assert.deepEqual(run.events.filter(e=>e.kind==="phase").map(e=>e.phase),[2,3]);
  }
});
