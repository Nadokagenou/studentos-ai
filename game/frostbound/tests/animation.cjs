const {test}=require("node:test");
const assert=require("node:assert/strict");
require("../animation");
require("../items");
require("../weapon-animation");
require("../enemy-animation");
const {Scene,state,phase}=FrostAnimation;

test("presentation priority follows gameplay without cancelling or mutating an action",()=>{
  const action={type:"light",duration:.38,age:.14,attack:{windup:.11,active:.11,recovery:.16}};
  const actor={x:20,y:40,dir:0,moving:true,action};
  assert.equal(state(actor,0,155),"light");
  const scene=new Scene();
  assert.equal(scene.pose(actor,.14).phase,"active");
  actor.state="stagger";
  assert.equal(scene.pose(actor,.15).state,"stagger");
  actor.dead=0;
  assert.equal(scene.pose(actor,.16).state,"death");
  assert.equal(actor.action,action);
  assert.equal(action.age,.14);
});

test("attack phases use authoritative age and agree at 30, 45, 60 and 120 FPS",()=>{
  const poses=[30,45,60,120].map(fps=>{
    const scene=new Scene();
    const fighter={x:0,y:0,dir:0,action:{type:"heavy",age:0,duration:1,attack:{windup:.2,active:.2,recovery:.6}}};
    for(let frame=0;frame<=fps;frame++) {
      fighter.action.age=frame/fps;
      scene.pose(fighter,frame/fps);
    }
    fighter.action.age=.33;
    const pose=scene.pose(fighter,1.05);
    return [pose.phase,pose.progress];
  });
  for(const pose of poses) assert.deepEqual(pose,phase(.33,.2,.2,.6));
  assert.deepEqual(phase(.1,.2,.2,.6),["startup",.5]);
  assert.equal(phase(.67,.2,.2,.6)[0],"recovery");
});

test("animation history clears on room change and follows actual travel",()=>{
  const scene=new Scene(),actor={x:0,y:0,dir:0,moving:true};
  const first=scene.pose(actor,0);
  actor.x=19;
  const moving=scene.pose(actor,.1);
  assert.notEqual(moving.step,0);
  scene.reset();
  const reset=scene.pose(actor,.1);
  assert.notEqual(reset,first);
  assert.equal(reset.step,0);
  assert.equal(reset.speed,0);
});

test("player pose reflects dodge, guard, successful parry, hit and the two movement speeds",()=>{
  const actor={x:50,y:40,dir:0,moving:true};
  assert.equal(state(actor,0,60),"walk");
  assert.equal(state(actor,0,164),"run");
  for(const [action,expected] of [[{type:"dash"},"dash"],[{type:"parry"},"parry"],
    [{type:"parry",used:true},"perfect"],[{type:"hurt"},"hurt"],[{type:"potion"},"potion"],[{type:"skill"},"skill"]]) {
    actor.action=action;
    assert.equal(state(actor,0,178),expected);
  }
});

test("all weapon families have a distinct blade path, clipped to actual attack data during active frames",()=>{
  const signatures=new Set();
  for(const key of ["edge","fang","spear","great","ash","moon"]) {
    const weapon=FrostItems.ITEMS[key],attack=weapon.heavy;
    const action={type:"heavy",dir:0,combo:0,attack,weapon,duration:attack.windup+attack.active+attack.recovery};
    const start=FrostWeaponAnimation.blade(action,0);
    const active=FrostWeaponAnimation.blade(action,attack.windup+attack.active*.55);
    const done=FrostWeaponAnimation.blade(action,action.duration);
    assert.equal(active.key,key);
    assert.notEqual(active.tipY,start.tipY);
    assert.ok(Math.abs(active.dir)<=attack.cone);
    assert.ok(active.tipX<=attack.range);
    assert.equal(done.phase,"recovery");
    signatures.add([active.len,active.dir,active.tipX,active.tipY].join(","));
  }
  assert.equal(signatures.size,6);
});

test("enemy preparation and recovery are distinct poses for every archetype",()=>{
  const profiles=FrostEnemyAnimation.forms;
  assert.equal(Object.keys(profiles).length,8);
  const poses=new Set();
  for(const type of Object.keys(profiles)) {
    const fighter={type,attack:{id:type==="stalker"?"leap":type,data:{shape:type==="archer"?"arrow":undefined}}};
    const start=FrostEnemyAnimation.posture(fighter,{state:"enemy-attack",phase:"startup",progress:.85},true);
    const end=FrostEnemyAnimation.posture(fighter,{state:"enemy-attack",phase:"recovery",progress:.5},true);
    if(type!=="wisp") assert.notEqual(start.weapon,end.weapon);
    poses.add([start.form.scale,start.bend,start.weapon,start.draw].join(","));
  }
  assert.equal(poses.size,8);
});

test("the Frozen King's strike poses use distinct preparation, including all combo strikes",()=>{
  const keys=Object.keys(FrostEnemyAnimation.kingMoves);
  assert.equal(keys.length,11);
  const figures=new Set();
  for(const id of keys) {
    const enemy={type:"king",attack:{id,data:{}},phase:2};
    const windup=FrostEnemyAnimation.posture(enemy,{state:"enemy-attack",phase:"startup",progress:.85},true);
    const hit=FrostEnemyAnimation.posture(enemy,{state:"enemy-attack",phase:"active",progress:.58},true);
    assert.notEqual(windup.weapon,hit.weapon);
    figures.add([windup.weapon,windup.bend,hit.push].join(","));
  }
  assert.equal(figures.size,keys.length);
  assert.equal(new Set(FrostEnemyAnimation.phaseColors).size,3);
});
