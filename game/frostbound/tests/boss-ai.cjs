const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const name of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses","environment","regions","combat"]) require("../"+name);
const {Run,STEP,BOUNDS,distance}=FrostCombat;
function kingFight() {
  const run=new Run("story",4096);
  run.route.index=run.rooms.length-1;
  run.pending=[];
  run.gateOpen=false;
  run.preparing=false;
  run.addEnemy("king",440,270,0);
  const boss=run.boss;
  boss.state="chase";
  Object.assign(run.player,{x:530,y:270});
  return {run,boss};
}
test("Frozen King cannot skip either phase and transitions remove live boss hazards for 1.5 seconds",()=>{
  const {run,boss}=kingFight();
  assert.equal(boss.maxHp,1200);
  assert.equal(boss.maxPosture,250);
  for(const [phase,threshold] of [[2,840],[3,420]]) {
    run.shots.push({owner:boss});
    run.damageEnemy(boss,9999,0);
    assert.equal(boss.phase,phase);
    assert.equal(boss.hp,threshold);
    assert.equal(boss.state,"transition");
    assert.equal(run.shots.length,0);
    assert.equal(boss.timer,1.5);
    run.damageEnemy(boss,9999,9999);
    assert.equal(boss.hp,threshold);
    for(let i=0;i<179;i++) run.tick({x:0,y:0},STEP);
    assert.equal(boss.state,"transition");
    assert.equal(run.player.hp,100);
    run.tick({x:0,y:0},STEP);
    run.tick({x:0,y:0},STEP);
  }
  assert.deepEqual(run.events.filter(e=>e.kind==="phase").map(e=>e.phase),[2,3]);
  run.damageEnemy(boss,9999,0);
  assert.equal(boss.state,"dead");
});
test("weighted boss AI uses phase, cooldown, distance, available routes and repetition limits",()=>{
  const {run,boss}=kingFight();
  run.bossRandom=()=>0;
  assert.equal(FrostBossAI.choose(run,boss,88).id,"kingSlash");
  assert.equal(FrostBossAI.choose(run,boss,160).id,"kingThrust");
  assert.equal(FrostBossAI.choose(run,boss,400),undefined);
  boss.lastPattern="kingSlash";
  boss.patternRepeats=2;
  assert.notEqual(FrostBossAI.choose(run,boss,88).id,"kingSlash");
  boss.phase=2;
  boss.patternCooldowns.kingPillars=10;
  assert.equal(FrostBossAI.choose(run,boss,195).id,"kingWave");
  run.shots.push({attack:{shape:"wave"}});
  assert.equal(FrostBossAI.choose(run,boss,195),undefined);
  assert.equal(FrostBossAI.choose(run,boss,110).id,"kingCombo");
});
test("pillar points are bounded, collapse leaves an accessible safe area, and wave moves at 240 px/s",()=>{
  const {run,boss}=kingFight();
  Object.assign(run.player,{x:760,y:280});
  run.startAttack(boss,"kingPillars");
  assert.ok(boss.attack.spots.length<=4);
  for(const spot of boss.attack.spots) {
    assert.ok(spot.x>BOUNDS.left&&spot.x<BOUNDS.right&&spot.y>BOUNDS.top&&spot.y<BOUNDS.bottom);
    assert.ok(run.room.pillars.every(([x,y,r])=>distance(spot,{x,y})>r+37));
  }
  run.startAttack(boss,"kingCollapse");
  assert.equal(run.inDanger(boss.attack.data,boss.attack.origin,null),true);
  run.player.x=240;
  assert.equal(run.inDanger(boss.attack.data,boss.attack.origin,null),false);
  run.startAttack(boss,"kingWave",0);
  run.updateAttack(boss,1.001);
  const shot=run.shots[0], x=shot.x;
  run.updateShots(.1);
  assert.equal(shot.x-x,24);
});
test("royal combination has three announced strikes and Frostbound Reversal answers only an attack",()=>{
  const {run,boss}=kingFight();
  run.startAttack(boss,"kingCombo",0);
  const names=[boss.attack.data.name];
  run.player.x=700;
  for(let i=0;i<2;i++) {
    const {windup,active}=boss.attack.data;
    run.updateAttack(boss,windup+active+.01);
    names.push(boss.attack.data.name);
  }
  assert.deepEqual(names.map(name=>name.split(" · ")[1]),["I of III","II of III","III of III"]);
  assert.equal(boss.attack.data.followUp,undefined);
  boss.attack=null;
  run.time=3;
  boss.phase=3;
  boss.hp=410;
  boss.state="defend";
  boss.defendUntil=run.time+1;
  run.player.x=530;
  run.room.pillars=[];
  run.updateEnemy(boss,STEP);
  assert.equal(boss.attack,null);
  run.damageEnemy(boss,10,0);
  assert.equal(boss.attack.id,"kingCounter");
  assert.equal(boss.state,"windup");
  assert.equal(run.player.hp,100);
});
test("100 seeded boss sequences select viable attacks in every phase and respect cooldowns",()=>{
  const coverage=new Set();
  for(let seed=0;seed<100;seed++) {
    const {run,boss}=kingFight();
    const rng=FrostItems.random(Math.imul(seed,0x9E3779B9));
    run.bossRandom=rng;
    for(let phase=1;phase<=3;phase++) {
      boss.phase=phase;
      boss.lastPattern=null;
      boss.patternRepeats=0;
      boss.patternCooldowns={};
      let attacks=0;
      for(let step=0;step<65;step++) {
        run.time+=.5;
        const reach=75+rng()*185;
        const next=FrostBossAI.choose(run,boss,reach);
        if(!next) continue;
        attacks++;
        coverage.add(next.id);
        const data=FrostBossAI.attacks[next.id];
        assert.ok(reach<=(data?.reach??data?.range??119));
        assert.ok((boss.patternCooldowns[next.id]??0)<=run.time);
        boss.patternCooldowns[next.id]=run.time+next.cooldown;
        boss.patternRepeats=next.id===boss.lastPattern?boss.patternRepeats+1:1;
        assert.ok(boss.patternRepeats<=2);
        boss.lastPattern=next.id;
      }
      assert.ok(attacks>=8);
    }
  }
  assert.equal(coverage.size,9);
});
