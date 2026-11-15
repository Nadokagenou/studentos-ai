const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const script of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses",
  "environment","regions","combat","world-art"]) require("../"+script);
const {plan,themeFor,Scene}=FrostWorldArt;
const {generate,geometryValid,BOUNDS}=FrostRegions;

test("five themes have four named variants, six floors and distinct semantic prop groups",()=>{
  const ids=new Set();
  const looks=new Map();
  for(const mode of ["story","hardcore","boss"]) for(let seed=0;seed<50;seed++) {
    const rooms=generate(mode,seed);
    for(const room of rooms.flatMap(room=>[room,...Object.values(room.paths??{}),...(room.side?[room.side]:[])])) {
      const before=JSON.stringify(room);
      const p=plan(room,seed,"high");
      assert.deepEqual(p,plan(room,seed,"high"));
      assert.equal(JSON.stringify(room),before);
      assert.equal(p.pillars,room.pillars);
      assert(geometryValid(room),room.id);
      assert.equal(p.theme.floors.length,6);
      assert.equal(new Set(p.theme.patterns).size,6);
      assert.equal(p.theme.variants.length,4);
      assert.equal(p.theme.sets.length,3);
      assert.notEqual(p.primary,p.secondary);
      assert(p.props.every(prop=>Number.isFinite(prop.x)&&prop.y<BOUNDS.top));
      assert(p.anchors.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));
      ids.add(p.theme.id);
      const selections=looks.get(p.theme.id)??new Set();
      selections.add(p.variant);
      looks.set(p.theme.id,selections);
    }
    assert.deepEqual(rooms,generate(mode,seed));
  }
  assert.deepEqual([...ids],["outpost","forest","depths","capital","throne"]);
  for(const selections of looks.values()) assert.equal(selections.size,4);
  assert.equal(themeFor({theme:"bridge"}).id,"depths");
  assert.equal(themeFor({theme:"crypt"}).id,"capital");
});

function context() {
  let operations=0,stack=0;
  const gradient={addColorStop(){}};
  const methods={
    save(){stack++;},restore(){stack--;assert(stack>=0);},
    createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,
    counts:()=>({operations,stack}),
  };
  return new Proxy(methods,{
    get(target,key){
      if(key in target) return target[key];
      return (...args)=>{
        for(const value of args) if(typeof value==="number") assert(Number.isFinite(value),String(key));
        operations++;
      };
    },
  });
}

test("static cache holds a single surface over 100 room transitions, 100 quality swaps and 50 resizes",()=>{
  let canvases=0;
  const c=context();
  const scene=new Scene(()=>{canvases++;return {getContext:()=>c};});
  const run=new FrostCombat.Run("story",4212);
  const rooms=run.rooms;
  Object.defineProperty(run,"room",{get:()=>rooms[roomIndex]});
  let roomIndex=0;
  const first=scene.prepare(run,"high",960,600,0);
  assert.equal(scene.prepare(run,"high",960,600,1),first);
  assert.equal(scene.builds,1);
  for(let i=0;i<100;i++) {
    roomIndex=(i+1)%rooms.length;
    assert.equal(scene.prepare(run,"high",960,600,i+2),first);
  }
  for(let i=0;i<100;i++) scene.prepare(run,["medium","low","high"][i%3],960,600,i+102);
  for(let i=0;i<50;i++) scene.prepare(run,"high",961+i,601+i,i+202);
  assert.equal(scene.builds,251);
  assert.equal(canvases,1);
  assert.equal(c.counts().stack,0);
  assert(c.counts().operations<2_000_000);
  scene.reset();
  assert.equal(scene.ground,null);
  const next=new FrostCombat.Run("hardcore",4212);
  assert.notEqual(scene.prepare(next,"high",960,600,400),first);
  assert.equal(canvases,2);
});

test("footprints and snow are bounded, Reduced Motion clears them and lighting does not mutate a run",()=>{
  const c=context();
  const run=new FrostCombat.Run("story",4212);
  const scene=new Scene(()=>({getContext:()=>c}));
  scene.prepare(run,"high",960,600,10);
  for(let i=0;i<501;i++) {
    run.player.x=240+i%20*20;
    run.time=i/20;
    const before=JSON.stringify([run.player,run.environment,run.stats]);
    scene.draw(c,run,false,i%2===0,i*50+10);
    assert.equal(JSON.stringify([run.player,run.environment,run.stats]),before);
    assert(scene.stepCount<=24);
    assert(scene.particleCount<=49);
  }
  scene.draw(c,run,true,true,26100);
  assert.equal(scene.stepCount,0);
  assert.equal(scene.particleCount,0);
  const boss=new FrostCombat.Run("boss",1);
  Object.defineProperty(boss,"room",{value:boss.rooms.at(-1)});
  Object.defineProperty(boss,"boss",{value:{type:"king",phase:3}});
  scene.prepare(boss,"high",960,600,30000);
  scene.draw(c,boss,false,false,30100);
  const snowfall=scene.particleCount;
  boss.result={won:true};
  scene.draw(c,boss,false,false,30101);
  scene.draw(c,boss,false,false,31101);
  assert(scene.particleCount<snowfall);
});
