const assert=require("node:assert/strict");
const path=require("node:path");
const root=path.resolve(process.argv[2]??path.join(__dirname,"../.."));
for(const name of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses",
  "environment","regions","combat"]) require(path.join(root,name));
const {Run,STEP}=FrostCombat;
const ids=["edge","fang","spear","great","ash","moon"];

function contact(id,action,target) {
  const run=new Run("story",4212,id);
  if(target==="king") run.route.index=run.rooms.length-1;
  run.pending=[];run.preparing=false;
  run.room.pillars=[];
  run.updateEnemy=()=>{}; // Hold the target still to isolate attack contact.
  Object.assign(run.player,{x:480,y:322,dir:0});
  run.addEnemy(target,534,322,0);
  const foe=run.enemies[0];
  foe.state="chase";
  assert(run.request(action,{x:0,y:0,aim:0}));
  const stamina=100-run.player.stamina;
  const attack=run.player.action.attack;
  for(let frame=0;frame<240&&run.player.action;frame++) run.tick({x:0,y:0,aim:0},STEP);
  assert(foe.hp<foe.maxHp&&foe.posture>0,[id,action,target].join(" "));
  return {
    damage:foe.maxHp-foe.hp,posture:foe.posture,stamina,range:attack.range,
    windupMs:Math.round(attack.windup*1000),
    commitmentMs:Math.round((attack.windup+attack.active+attack.recovery)*1000),
  };
}
const weapons=Object.fromEntries(ids.map(id=>[FrostItems.ITEMS[id].name,{
  soldier:{light:contact(id,"light","soldier"),heavy:contact(id,"heavy","soldier")},
  king:{light:contact(id,"light","king"),heavy:contact(id,"heavy","king")},
}]));
const rng=FrostItems.random(4212);
const rarityCounts=[0,0,0,0,0];
for(let trial=0;trial<10000;trial++) rarityCounts[FrostLoot.tier(rng,FrostLoot.WEIGHTS.normal)]++;
const modes=Object.fromEntries(["story","hardcore","boss"].map(id=>{
  const mode=FrostWorld.MODES[id];
  return [id,{clearHealing:mode.heal,enemyHealthMultiplier:mode.hp,windupMultiplier:mode.windup}];
}));
console.log(JSON.stringify({weapons,rarityCounts,rarityWeights:FrostLoot.WEIGHTS,modes,
  crimsonFlaskBaseCost:FrostItems.ITEMS.flask.price},null,2));
