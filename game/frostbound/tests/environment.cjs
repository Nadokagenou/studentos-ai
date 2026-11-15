const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const name of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses","environment","regions","combat"]) require("../"+name);
const {Run,STEP}=FrostCombat;
function stage(hazard) {
  const run=new Run("story",1245);
  run.room.hazard=hazard;
  run.environment=FrostEnvironment.create(run.room);
  run.gateOpen=false;
  return run;
}
test("cracked ice waits for .8 seconds of occupation and .7 more of warning",()=>{
  const run=stage("ice");
  Object.assign(run.player,run.environment.points[0]);
  for(let i=0;i<94;i++) run.updateHazard(STEP);
  assert.equal(run.hazard,null);
  for(let i=0;i<25;i++) run.updateHazard(STEP);
  assert.equal(run.hazard.state,"windup");
  for(let i=0;i<56;i++) run.updateHazard(STEP);
  assert.equal(run.player.hp,100);
  for(let i=0;i<15;i++) run.updateHazard(STEP);
  assert.equal(run.hazard.state,"active");
  assert.ok(run.player.hp<100);
  run.player.x=480;
  for(let i=0;i<430;i++) run.updateHazard(STEP);
  assert.equal(run.hazard,null);
});
test("whiteout warns then clears, resonance is a marked fixed-area pulse, and the bell can be silenced safely",()=>{
  const storm=stage("whiteout");
  storm.updateHazard(12.01);
  assert.equal(storm.environment.whiteout,"warning");
  storm.updateHazard(2);
  assert.equal(storm.environment.whiteout,"active");
  storm.updateHazard(6);
  assert.equal(storm.environment.whiteout,"clear");
  assert.equal(storm.player.hp,100);
  const crystal=stage("resonance");
  crystal.environment.time=5;
  crystal.updateHazard(STEP);
  assert.ok(crystal.environment.points.includes(crystal.hazard.attack.spots[0]));
  assert.equal(crystal.hazard.attack.data.windup,1.20);
  const bell=stage("bell");
  Object.assign(bell.player,bell.environment.points[0]);
  bell.updateHazard(18);
  assert.equal(FrostEnvironment.speed(bell,{type:"elite"}),1.10);
  assert.equal(bell.silenceBell(),false);
  bell.pending=[];
  bell.gateOpen=true;
  bell.preparing=false;
  assert.equal(bell.silenceBell(),true);
  assert.equal(bell.silenceBell(),false);
  assert.equal(FrostEnvironment.speed(bell,{type:"elite"}),1);
});
test("generated hazard markers stay inside walkable geometry and keep the gate approach open",()=>{
  for(let seed=0;seed<300;seed++) for(const room of FrostRegions.generate("story",Math.imul(seed,0x9E3779B9))) {
    const env=FrostEnvironment.create(room);
    if(!env||!["ice","resonance","bell"].includes(env.id)) continue;
    assert.ok(env.points.length>0);
    for(const p of env.points) {
      assert.ok(FrostCombat.distance(p,room.exit)>130);
      assert.ok(room.pillars.every(([x,y,r])=>FrostCombat.distance(p,{x,y})>r+34));
    }
  }
});
