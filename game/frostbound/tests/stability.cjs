const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const module of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses",
  "environment","regions","combat","stability"]) require("../"+module);
const {Run,STEP}=FrostCombat;
const neutral={x:0,y:0};

test("forgetting a hidden target expires the old memory and permits a new decision", {timeout:1000},()=>{
  const run=new Run("story",4212);
  run.room.pillars=[[547,290,21]];
  run.pending=[];
  Object.assign(run.player,{x:507,y:290,moving:false});
  run.addEnemy("soldier",480,290,0);
  const enemy=run.enemies[0];
  Object.assign(enemy,{state:"chase",cooldown:10,dir:0});
  run.tick(neutral);
  assert.ok(enemy.memory>run.time);
  Object.assign(enemy,{x:497,y:290,moveDir:null});
  Object.assign(run.player,{x:621,y:290});
  for(let i=0;i<110;i++) run.tick(neutral);
  assert.equal(enemy.lastSeen,null);
  assert.equal(enemy.memory,0);
  assert.ok(run.time>.9);
  assert.ok(FrostEnemyAI.validPoint(enemy));
});

test("the original input-only Outpost replay passes the first v4.0 crash point", {timeout:1000},()=>{
  const seed=2654435769;
  const run=new Run("story",seed);
  const random=FrostItems.random(seed^0x71A36021);
  let direction=0, changeAt=0, stopped=false;
  for(let step=0;step<1150;step++) {
    if(step>=changeAt) {
      direction=random()*Math.PI*2;
      stopped=random()<.42;
      changeAt=step+15+Math.floor(random()*135);
    }
    let action=null;
    if(!run.player.action&&run.player.hp<57&&run.inventory.potion) action="potion";
    else if(!run.player.action&&random()<.022) action="dash";
    run.tick({x:stopped?0:Math.cos(direction),y:stopped?0:Math.sin(direction),aim:direction,action});
    run.events.splice(0);
  }
  assert.ok(run.time>9.3);
  assert.equal(run.mode,"playing");
});

test("dash during a frozen windup works and thaw cancels the old attack", {timeout:1000},()=>{
  const run=new Run("training",4212);
  const dummy=run.enemies[0];
  Object.assign(dummy,{x:470,y:314,state:"chase"});
  run.startAttack(dummy,"dummy");
  run.build.frost(dummy,100);
  assert.equal(dummy.state,"frozen");
  assert.equal(dummy.attack,null);
  run.tick({...neutral,aim:0,action:"dash"});
  assert.equal(run.player.action?.type,"dash");
  assert.equal(run.stats.dashes,1);
  for(let i=0;i<188;i++) run.tick(neutral);
  assert.notEqual(dummy.state,"frozen");
  assert.notEqual(dummy.lastAttack,undefined);
});

test("non-finite input and absent AI targets do not produce invalid movement", {timeout:1000},()=>{
  const run=new Run("story",12);
  run.addEnemy("stalker",440,330,0);
  const enemy=run.enemies[0];
  FrostEnemyAI.decision(run,enemy,null,FrostEnemyAI.attacks);
  FrostEnemyAI.decision(run,enemy,{x:NaN,y:Infinity},FrostEnemyAI.attacks);
  run.tick({x:NaN,y:Infinity,aim:Infinity});
  assert.ok(FrostEnemyAI.validPoint(run.player));
  assert.ok(Number.isFinite(run.player.dir));
  assert.equal(FrostBossAI.choose(run,{},NaN),undefined);
  run.player.x=NaN;
  assert.throws(()=>run.tick(neutral),/Invalid player position/);
});

test("an obstructed patrol keeps a bounded update and can return to a reachable destination", {timeout:1000},()=>{
  const run=new Run("story",77);
  run.room.pillars=[[450,300,34]];
  run.room.spawns=[{x:450,y:300},{x:260,y:190}];
  run.pending=[];
  run.addEnemy("soldier",395,300,0);
  const enemy=run.enemies[0];
  Object.assign(enemy,{state:"patrol",patrol:0});
  Object.assign(run.player,{x:800,y:360});
  for(let i=0;i<240;i++) run.tick(neutral,STEP);
  assert.ok(run.time>1.9);
  assert.ok(FrostEnemyAI.validPoint(enemy));
  assert.ok(!run.projectileBlocked(enemy));
  run.room.spawns[0]=run.room.spawns[1];
  for(let i=0;i<200;i++) run.tick(neutral,STEP);
  assert.notEqual(enemy.x,395);
});

test("an action from a cleared room cannot carry an input lock into secret-room preparation", {timeout:1000},()=>{
  const run=new Run("story",4212);
  run.route.index=run.rooms.findIndex(room=>room.side?.type==="mini");
  run.gateOpen=true;
  Object.assign(run.player,FrostWorld.SIDE,{action:{type:"dash",age:.1,duration:.4}});
  run.buffer={type:"heavy",until:1};
  run.enterSide();
  assert.equal(run.room.type,"mini");
  assert.equal(run.player.action,null);
  assert.equal(run.buffer,null);
  assert.equal(run.encounterState,"PREPARATION");
  assert.equal(run.equipmentAccess.allowed,true);
});

test("frame scheduling has one chain, reports a fatal frame and ignores callbacks from a stopped chain", {timeout:1000},()=>{
  const {FrameLoop}=FrostStability;
  const callbacks=new Map();
  const failures=[], frames=[];
  let id=0;
  const loop=new FrameLoop(fn=>{callbacks.set(++id,fn);return id;},key=>callbacks.delete(key),
    now=>{frames.push(now);if(now===3) throw new Error("frame fault");},error=>failures.push(error.message));
  const frame=now=>{
    assert.equal(callbacks.size,1);
    const [key,fn]=[...callbacks][0];
    callbacks.delete(key);
    fn(now);
  };
  loop.start();
  loop.start();
  frame(1);
  const stale=[...callbacks.values()][0];
  loop.stop();
  loop.start();
  stale(99);
  frame(2);
  frame(3);
  assert.equal(callbacks.size,0);
  assert.deepEqual(frames,[1,2,3]);
  assert.deepEqual(failures,["frame fault"]);
  loop.start();
  frame(4);
  loop.stop();
  assert.deepEqual(frames,[1,2,3,4]);
});

test("debug history stays bounded and disabled diagnostics keep no event history",()=>{
  const {Diagnostics}=FrostStability;
  const debug=new Diagnostics(true,3);
  for(let i=1;i<=100;i++) {debug.begin(i);debug.note("sample",i);}
  debug.change("PLAYING","PAUSED");
  assert.deepEqual(debug.snapshot().history.map(event=>event.label),["sample","sample","transition"]);
  assert.equal(debug.snapshot().lastTransition.to,"PAUSED");
  assert.equal(debug.snapshot().lastFrameTimestamp,100);
  const disabled=new Diagnostics(false);
  disabled.note("sample",1);
  assert.deepEqual(disabled.snapshot().history,[]);
});
