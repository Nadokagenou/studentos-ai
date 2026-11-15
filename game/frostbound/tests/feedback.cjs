const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const name of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses",
  "environment","regions","combat","feedback","combat-audio"]) require("../"+name);
const {Run,STEP}=FrostCombat;
const neutral={x:0,y:0,aim:0};
const step=(r,n)=>{for(let i=0;i<n;i++) r.tick(neutral,STEP);};

test("only a validated weapon hit creates a contact effect, with no duplicate contact or damage",()=>{
  const run=new Run("training",27);
  const foe=run.enemies[0];
  Object.assign(foe,{x:530,y:385,state:"stagger",timer:10});
  run.request("light",neutral);
  step(run,23);
  assert.equal(run.events.filter(e=>e.kind==="hit").length,1);
  assert.equal(run.fx.filter(fx=>fx.category==="light").length,1);
  assert.equal(foe.maxPosture,60);
  step(run,45);
  run.events.length=0;
  foe.x=770;
  run.request("heavy",neutral);
  step(run,77);
  assert.equal(run.events.filter(e=>e.kind==="hit").length,0);
  assert.equal(run.fx.filter(fx=>fx.category==="heavy").length,0);
  assert.equal(run.events.filter(e=>e.kind==="heavy").length,1);
});

test("parry and posture feedback appear once and the previous simulation pause still expires",()=>{
  const run=new Run("training",27);
  const foe=run.enemies[0];
  foe.state="chase";
  foe.posture=45;
  run.player.action={type:"parry",age:.1,duration:.35,used:false};
  run.receiveHit({damage:22,parry:true},foe,foe);
  assert.equal(run.stats.damage,0);
  assert.equal(run.stats.parries,1);
  assert.equal(run.fx.filter(fx=>fx.category==="perfect").length,1);
  assert.equal(run.fx.filter(fx=>fx.category==="posture").length,1);
  assert.equal(run.parryStop,.045);
  step(run,45);
  assert.ok(run.parryStop<=0&&run.time>.2);
});

test("particles and camera feedback are bounded and expire without affecting combat",()=>{
  const effects=new FrostFeedback.Particles(12);
  const fx={kind:"impact",category:"bossHeavy",x:20,y:45,age:.03,duration:.15};
  effects.consume(fx,5,"high");
  effects.consume(fx,5,"high");
  assert.equal(effects.active.length,7);
  for(let i=0;i<50;i++) effects.consume({...fx},5,"high");
  assert.equal(effects.active.length,12);
  effects.expire(6);
  assert.equal(effects.active.length,0);
  assert.equal(effects.free.length,12);
  assert.ok(Math.abs(FrostFeedback.impulse([fx],{shake:true,reduced:false}))<=4);
  assert.equal(FrostFeedback.impulse([fx],{shake:true,reduced:true}),0);
  assert.equal(FrostFeedback.impulse([{...fx,age:1}],{shake:true}),0);
});

test("six distinct swings, guard, block, parry and impact cues use bounded positive audio parameters",()=>{
  const calls=[];
  const audio=FrostCombatAudio.create((...args)=>calls.push(["tone",...args]),(...args)=>calls.push(["noise",...args]));
  const sets=new Set();
  for(const [index,family] of Object.keys(FrostCombatAudio.profiles).entries()) {
    calls.length=0;
    assert.equal(audio.play({kind:"light",family,combo:0},index),true);
    sets.add(calls[0][1]);
    const count=calls.length;
    audio.play({kind:"light",family},index+.001);
    assert.equal(calls.length,count);
  }
  assert.equal(sets.size,6);
  assert.equal(audio.play({kind:"gate"},20),false);
  for(const [index,kind] of ["perfect","guard","guard-miss","stagger","dash","arrow","phase","enemy-defeat","hit"].entries()) {
    calls.length=0;
    audio.play({kind,category:"block",boss:true},20+index);
    assert.ok(calls.length>0);
    assert.ok(calls.every(call=>call[1]>0&&call[2]>0&&call[3]>0));
  }
});
