const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const name of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses","environment","regions","combat"])require("../"+name);

test("seeded world preserves the five-stage spine and validates at least 1,000 rooms",()=>{
  const {generate,geometryValid}=FrostRegions;
  const variants=new Set();
  let total=0;
  for(const mode of ["story","hardcore"])for(let seed=0;seed<80;seed++){
    const rooms=generate(mode,seed);
    assert.deepEqual(rooms,generate(mode,seed));
    assert.equal(rooms[0].name,"The Forgotten Outpost");
    assert.deepEqual(rooms.at(-1).enemies,["king"]);
    assert.equal(new Set(rooms.map(room=>room.id)).size,rooms.length);
    variants.add(rooms.map(room=>room.type).join());
    for(let stage=1;stage<=5;stage++) {
      const area=rooms.filter(room=>room.stage===stage);
      assert.ok(area.length>=3&&area.length<=5);
      assert.ok(area.some(room=>room.enemies.length));
    }
    for(const room of rooms) {
      total++;
      assert.ok(geometryValid(room),room.id);
      for(const branch of Object.values(room.paths??{})) assert.ok(geometryValid(branch),branch.id);
      if(room.side) assert.ok(geometryValid(room.side),room.side.id);
      if(["merchant","rest","lore","treasure"].includes(room.type)) assert.equal(room.enemies.length,0);
    }
  }
  assert.ok(total>=1000);
  assert.ok(variants.size>12);
});

test("route exits are traversable and entering a secret does not advance the spine",()=>{
  const route=new FrostRegions.Route("story",53);
  assert.ok(route.advance());
  const advance=()=>{if(route.options)route.choose("safe");return route.advance();};
  while(!route.room.side)assert.ok(advance());
  if(route.options) route.choose("safe");
  const next=route.nextRoom;
  assert.ok(route.enterSecret());
  assert.equal(route.room.type,"treasure");
  assert.strictEqual(route.nextRoom,next);
  assert.ok(route.advance());
  assert.strictEqual(route.room,next);
  while(route.nextRoom)assert.ok(advance());
  assert.equal(route.room.enemies[0],"king");
  assert.equal(route.advance(),false);
});

test("safe and danger alternatives rejoin the spine and reject mid-room selection",()=>{
  const a=new FrostRegions.Route("story",53);
  const b=new FrostRegions.Route("story",53);
  while(!a.options){a.advance();b.advance();}
  assert.equal(a.advance(),false);
  assert.equal(a.choose("unavailable"),false);
  assert.ok(a.choose("safe"));
  assert.ok(b.choose("danger"));
  assert.equal(a.choose("danger"),false);
  assert.ok(a.advance()&&b.advance());
  assert.equal(a.room.enemies.length,0);
  assert.equal(b.room.type,"elite");
  assert.equal(b.room.path,"danger");
  assert.deepEqual(a.nextRoom,b.nextRoom);

  const run=new FrostCombat.Run("story",53);
  while(!run.paths)run.startWave();
  assert.equal(run.choosePath("danger"),false);
  Object.assign(run.player,FrostRegions.GATE);
  assert.ok(run.choosePath("danger"));
  run.addEnemy("stalker",480,155,0);
  assert.equal(run.enemies[0].hp,Math.ceil(FrostEnemyAI.profiles.stalker.hp*1.15));
});

test("Boss Rush retains boss and shop order; later rooms cannot regress Hardcore progress",()=>{
  assert.deepEqual(FrostRegions.generate("boss",2).map(room=>room.type),["boss","merchant","boss","merchant","boss"]);
  const run=new FrostCombat.Run("hardcore",13);
  run.time=20;run.runWave=2;run.trackProgress();
  run.time=30;run.runWave=1;run.trackProgress();
  assert.deepEqual(run.progress,{stage:1,wave:2,time:20});
});
