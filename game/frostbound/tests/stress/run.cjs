const assert=require("node:assert/strict");
const path=require("node:path");
const {performance}=require("node:perf_hooks");
const {spawnSync}=require("node:child_process");
if(!process.argv.includes("--worker")) {
 const result=spawnSync(process.execPath,[...process.execArgv,__filename,"--worker"],{stdio:"inherit",timeout:45000});
 if(result.error) console.error(result.error.message);
 process.exitCode=result.status??1;
 return;
}
const root=path.resolve(__dirname,"../..");
for(const file of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses","environment","regions","combat"])
 require(path.join(root,file+".js"));
const autopilot=require("./pilot.cjs");
const {Run,GATE}=FrostCombat;
const modes=[["story",20],["hardcore",20],["boss",10]];
const seeds=[4212,1,87,53,101,144,29,77,111,198,74,4100,564,4294967295,563,75318,1337,611,125987,348291];
const elapsedStart=performance.now();
const stats={};const memories=[];const failures=[];
const STEP_LIMIT=120*420;
const secs=n=>Number(n.toFixed(2));
function validate(r){
 assert.ok(FrostEnemyAI.validPoint(r.player)&&Number.isFinite(r.player.dir), "invalid player coordinates");
 for(const e of r.enemies){
  assert.ok(FrostEnemyAI.validPoint(e)&&Number.isFinite(e.dir),"invalid enemy coordinates");
  assert.ok(!["windup","active"].includes(e.state)||e.attack,"attack in invalid state");
 }
 assert.ok(r.mode!=="choose"||r.choices.length,"reward without cards");
}
function drive(r){
 const p=r.player, here=FrostCombat.distance;
 if(r.mode==="choose"){
  const prefer=r.offer.context==="intro"?r.choices.find(c=>c.key==="lance"):
   (p.hp<55&&r.choices.find(c=>c.id==="heal"))||r.choices.find(c=>c.type==="Armor")||r.choices.find(c=>c.type==="Passive")||r.choices.at(-1);
  assert.ok(r.select(prefer.id,true));
  if(prefer.type==="Armor"&&FrostItems.ITEMS[prefer.key].defense>r.inventory.armor.defense)r.equip(prefer.key);
 }
 if(r.gateOpen&&!r.result&&here(p,r.room.exit??GATE)<29&&r.paths)
  assert.ok(r.choosePath(r.kind==="hardcore"||((r.seed+r.room.stage)%3===0)?"danger":"safe"));
 const input=autopilot(r);
 if(r.gateOpen&&r.inventory.potion==="flask"&&p.hp<64) input.action="potion";
 if(!p.action&&r.build.active==="lance"&&r.build.cooldown===0&&p.stamina>=40&&r.enemies.some(e=>e.state==="recover"&&here(e,p)<165))
  input.action="skill";
 return input;
}
for(const [mode,count] of modes){
 const summary=stats[mode]={runs:0,wins:0,losses:0,transitions:0,seconds:0,wallMsP95:0,maxStepMs:0};
 const intervals=[];
 for(let i=0;i<count;i++){
  const seed=seeds[i];
  const run=new Run(mode,seed);
  let tick=0, t=0, stale=0, prev=run.wave, advanceAt=0;
  try{
   for(;tick<STEP_LIMIT&&run.mode!=="result";tick++){
    const started=performance.now();
    const input=run.mode==="dying"?{x:0,y:0}:drive(run);
    run.tick(input);
    const spent=performance.now()-started;
    if(tick%80===0) intervals.push(spent);
    summary.maxStepMs=Math.max(summary.maxStepMs,spent);
    if(tick%24===0)validate(run);
    if(run.time===t&&run.mode==="playing")stale++;else stale=0;
    assert.ok(stale<60,"simulation clock stopped");
    t=run.time;
    if(run.wave!==prev) {summary.transitions++;prev=run.wave;advanceAt=t;}
    run.events.splice(0);
   }
   assert.ok(run.result&&run.mode==="result","pilot reached 420 s run limit without a result");
   run.releaseResources();
   assert.ok(!run.pending.length&&!run.enemies.length&&!run.shots.length);
   summary.runs++;
   summary[run.result.won?"wins":"losses"]++;
   summary.seconds+=run.time;
   if(global.gc) global.gc();
   memories.push(Math.round(process.memoryUsage().heapUsed/1e5)/10);
  }catch(error){
   failures.push({mode,seed,tick,room:run.room.name,state:run.encounterState,progress:run.progress,time:run.time,
    player:[run.player.x,run.player.y,run.player.hp],foes:run.enemies.map(e=>[e.type,e.state,e.x,e.y,e.hp]),
    pending:run.pending,atRoom:advanceAt,error:error.stack});
  }
 }
 intervals.sort((a,b)=>a-b);
 summary.wallMsP95=+intervals[Math.floor(intervals.length*.95)].toFixed(3);
 summary.maxStepMs=+summary.maxStepMs.toFixed(1);
 summary.seconds=secs(summary.seconds);
}
console.log(JSON.stringify({stats,failures,memory:{firstMB:memories[0],lastMB:memories.at(-1),maxMB:Math.max(...memories)},elapsedMs:Math.round(performance.now()-elapsedStart)},null,2));
process.exitCode=failures.length?1:0;
