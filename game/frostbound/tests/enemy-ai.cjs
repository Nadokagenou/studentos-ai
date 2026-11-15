const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const name of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses","environment","regions","combat"]) require("../"+name);
const {Run,STEP}=FrostCombat;
const {clearSight,group,budgets,threats,profiles}=FrostEnemyAI;
function setup(type) {
  const run=new Run("story",11);
  run.preparing=false;
  run.pending=[];
  run.room.pillars=[];
  Object.assign(run.player,{x:500,y:300});
  run.addEnemy(type,400,300,0);
  const enemy=run.enemies[0];
  enemy.dir=0;
  enemy.state="chase";
  enemy.cooldown=0;
  return {run,enemy};
}
test("500 seeded compositions use all eight profiles and respect each region budget",()=>{
  const coverage=new Set();
  for(let seed=0;seed<500;seed++) {
    const rng=FrostItems.random(Math.imul(seed,0x9E3779B9));
    for(const [index,[min,max]] of budgets.entries()) {
      const pack=group(index+1,rng);
      for(const enemy of pack) coverage.add(enemy);
      const value=pack.reduce((sum,type)=>sum+threats[type],0);
      assert.ok(value>=min&&value<=max);
      assert.ok(group(index+1,rng,true).reduce((sum,type)=>sum+threats[type],0)<=max*1.25);
    }
  }
  assert.equal(coverage.size,Object.keys(profiles).length);
});
test("a pillar blocks perception, attacks start in range and committed direction stays fixed",()=>{
  const {run,enemy}=setup("archer");
  run.room.pillars=[[445,300,22]];
  assert.equal(clearSight(enemy,run.player,run.room.pillars),false);
  run.updateEnemy(enemy,STEP);
  assert.equal(enemy.attack,null);
  assert.ok(enemy.decisionInterval>=.15&&enemy.decisionInterval<=.25);
  run.room.pillars=[];
  run.player.x=695;
  run.time+=.3;
  run.updateEnemy(enemy,STEP);
  assert.equal(enemy.attack,null);
  run.player.x=550;
  enemy.dir=0;
  run.time+=.3;
  run.updateEnemy(enemy,STEP);
  assert.ok(enemy.attack);
  const {origin}=enemy.attack;
  run.player.y=420;
  for(let i=0;i<72;i++) run.updateEnemy(enemy,STEP);
  assert.equal(enemy.attack.origin,origin);
  assert.ok(Math.abs(enemy.attack.origin.dir)<.01);
});
test("attack reservations cap melee and major area starts in a half-second window",()=>{
  const {run,enemy}=setup("stalker");
  const melee=FrostEnemyAI.attacks.stalker, area=FrostEnemyAI.attacks.pulse;
  run.startAttack(enemy,"stalker");
  run.startAttack(enemy,"stalker");
  assert.equal(FrostEnemyAI.spaceFor(run,melee),false);
  run.startAttack(enemy,"pulse");
  assert.equal(FrostEnemyAI.spaceFor(run,area),false);
  run.time+=.501;
  assert.equal(FrostEnemyAI.spaceFor(run,melee),true);
  assert.equal(FrostEnemyAI.spaceFor(run,area),true);
});
test("dead foes cannot start attacks and melee cannot damage a player behind a pillar",()=>{
  const {run,enemy}=setup("stalker");
  run.player.x=455;
  run.room.pillars=[[428,300,16]];
  run.startAttack(enemy,"stalker");
  for(let i=0;i<100;i++) run.updateEnemy(enemy,STEP);
  assert.equal(run.player.hp,100);
  const count=run.attackBegins.length;
  enemy.state="dead";
  enemy.attack=null;
  run.updateEnemy(enemy,STEP);
  assert.equal(run.attackBegins.length,count);
});
