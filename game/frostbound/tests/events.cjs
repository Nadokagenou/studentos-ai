const {test}=require("node:test");
const assert=require("node:assert/strict");
for(const name of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses","environment","regions","combat"]) require("../"+name);
const {Run,STEP}=FrostCombat;
const {DISCOVERY,SIDE}=FrostWorld;
function encounter(id) {
  const run=new Run("story",10);
  const route=run.route;
  route.rooms[route.index]={
    ...run.room,type:"event",eventId:id,enemies:[],waves:undefined,hazard:null,side:{type:"treasure"},
    secretRequiresReveal:id==="traveler"
  };
  run.preparing=false;
  run.pending=[];
  run.gateOpen=true;
  Object.assign(run.player,DISCOVERY);
  return run;
}
test("500 seeds permit only stage-eligible events and never repeat them on a playable route",()=>{
  const coverage=new Set();
  for(let seed=0;seed<500;seed++) {
    const rooms=FrostRegions.generate(seed%2?"story":"hardcore",Math.imul(seed,0x9E3779B9));
    const seen=new Set();
    for(const room of rooms) {
      for(const candidate of room.paths?Object.values(room.paths):[room]) {
        if(!candidate.eventId) continue;
        assert.ok(FrostEvents.EVENTS[candidate.eventId].stages.includes(room.stage));
        assert.equal(seen.has(candidate.eventId),false);
        seen.add(candidate.eventId);
        coverage.add(candidate.eventId);
      }
    }
  }
  assert.equal(coverage.size,Object.keys(FrostEvents.EVENTS).length);
});
test("event payment is atomic; a choice cannot spend again and cannot kill the player",()=>{
  const run=encounter("altar");
  run.inventory.crowns=29;
  assert.ok(run.eventChoice("crowns").error);
  assert.equal(run.inventory.crowns,29);
  assert.equal(run.eventsDone.size,0);
  run.player.hp=20;
  assert.ok(run.eventChoice("blood").error);
  assert.equal(run.player.hp,20);
  run.inventory.crowns=30;
  assert.match(run.eventChoice("crowns").text,/Rank 1/);
  assert.equal(run.inventory.crowns,0);
  assert.equal(run.eventChoice("crowns"),null);
  assert.equal(Object.values(run.build.ranks).reduce((sum,rank)=>sum+rank,0),1);
});
test("event duels close the gate and equipment, then produce three cards with the promised reward",()=>{
  const run=encounter("mirror");
  assert.ok(run.equipmentAccess.allowed);
  assert.equal(run.eventChoice("touch").reward,"event-epic");
  assert.equal(run.gateOpen,false);
  assert.equal(run.equipmentAccess.allowed,false);
  for(let i=0;i<230;i++) run.tick({x:0,y:0},STEP);
  assert.equal(run.enemies[0].type,"reflection");
  run.damageEnemy(run.enemies[0],999,0);
  run.tick({x:0,y:0},STEP);
  assert.equal(run.choices.length,3);
  assert.ok(run.choices.some(card=>card.type==="Passive"&&card.tier>=3));
  assert.equal(run.equipmentAccess.allowed,true);
  assert.equal(run.select(run.choices[0].id),true);
  assert.equal(run.gateOpen,true);
  assert.equal(run.safe,true);
});
test("temporary effects expire on encounter clears, forge spending is capped, and NPC reveals the side entrance",()=>{
  const traveler=encounter("traveler");
  Object.assign(traveler.player,SIDE);
  assert.equal(traveler.target,null);
  Object.assign(traveler.player,DISCOVERY);
  assert.ok(traveler.eventChoice("directions"));
  Object.assign(traveler.player,SIDE);
  assert.equal(traveler.target,"passage");
  const forge=encounter("forge");
  forge.inventory.crowns=120;
  forge.forge.edge=2;
  assert.ok(forge.eventChoice("weapon").error);
  assert.equal(forge.inventory.crowns,120);
  assert.ok(forge.eventChoice("armor"));
  assert.equal(forge.forge.coat,1);
  const fire=encounter("fire");
  fire.eventChoice("meditate");
  assert.equal(fire.encounterEffects.cooldown,2);
  for(let i=2;i>=1;i--) {
    fire.eventEncounter="normal";
    fire.gateOpen=false;
    fire.runWave=1;
    fire.tick({x:0,y:0});
    assert.equal(fire.encounterEffects.cooldown,i===1?undefined:1);
    fire.select(fire.choices.at(-1).id);
  }
});
test("an aimed Heavy opens a cracked wall and its chest rewards only once",()=>{
  const run=encounter("shrine");
  run.room.type="lore";
  delete run.room.eventId;
  run.room.secretClue="cracked";
  run.room.side={...run.room,type:"treasure",hidden:true,side:null};
  Object.assign(run.player,{x:SIDE.x+45,y:SIDE.y});
  run.tick({x:0,y:0,aim:Math.PI,action:"heavy"},STEP);
  for(let i=0;i<108;i++) run.tick({x:0,y:0,aim:Math.PI},STEP);
  assert.equal(run.wallBroken,true);
  assert.equal(run.target,"passage");
  run.enterSide();
  Object.assign(run.player,DISCOVERY);
  run.eventRandom=()=>.53;
  const old=run.inventory.potions.length;
  run.discover("treasure");
  assert.equal(run.inventory.potions.length,old+2);
  run.discover("treasure");
  assert.equal(run.inventory.potions.length,old+2);
});
