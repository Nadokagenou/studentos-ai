const assert=require("node:assert/strict");
const {chromium,devices}=require("playwright");
const fs=require("node:fs");
const path=require("node:path");
const controller=require("../stress/pilot.cjs");
const {translationAudit}=require("./translation-audit.cjs");
const {polishChecks}=require("./polish-checks.cjs");
const root=path.resolve(process.argv[2]||path.join(__dirname,"../.."));
const out=path.resolve(process.argv[3]||"visual-qa/campaign");
fs.mkdirSync(out,{recursive:true});
const publicUrl=process.argv.slice(4).find(arg=>/^https?:/.test(arg));
const auditThai=process.argv.includes("--thai");
const audit=auditThai?translationAudit(out):null;
const polish=auditThai?polishChecks(out,false):null;
const url=publicUrl?new URL("?debug=1",publicUrl).href:"http://frostbound.test/frostbound-game/index.html?debug=1";
const types={".js":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".woff2":"font/woff2",".webp":"image/webp"};
(async()=>{
 const b=await chromium.launch({executablePath:process.env.FROST_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--disable-background-networking"]});
 const errors=[];
 let completed=false;
 try{
 const touchPages=new WeakSet(); async function page(touch=false,seed=4212,locale="en-US"){
   const profile=touch?{...devices["iPhone 13 landscape"],viewport:{width:844,height:390}}:{viewport:{width:1440,height:900}};
   const p=await b.newPage({...profile,locale});
   if(touch) touchPages.add(p); p.on("pageerror",error=>errors.push(error.message));
   p.on("console",entry=>{if(entry.type()==="error"&&entry.text().includes("[FROSTBOUND FB-")) errors.push(entry.text());});
   if(!publicUrl) await p.route("**/*",async route=>{
    const uri=new URL(route.request().url());
    if(uri.origin!=="http://frostbound.test"||!uri.pathname.startsWith("/frostbound-game/")) return route.abort();
    const file=path.resolve(root,uri.pathname.slice("/frostbound-game/".length));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)) return route.abort();
    await route.fulfill({contentType:types[path.extname(file)]??"application/octet-stream",body:fs.readFileSync(file)});
   });
   await p.addInitScript(({source,seed,auditThai})=>{
    const control=eval("("+source+")");
    let callback, time=100, core;
    crypto.getRandomValues=a=>(a[0]=seed,a);
    window.requestAnimationFrame=fn=>{callback=fn;};
    window.frames=n=>{for(let i=0;i<n;i++)callback(time+=50);};
    if(auditThai) {
      const drawWord=CanvasRenderingContext2D.prototype.fillText;
      window.drawnGameWords=new Set();
      CanvasRenderingContext2D.prototype.fillText=function(text,...args){
        window.drawnGameWords.add(text);
        return drawWord.call(this,text,...args);
      };
    }
    Object.defineProperty(window,"FrostCombat",{get:()=>core,set:v=>{
      core=v;
      const original=v.Run.prototype.tick; const emit=v.Run.prototype.emit; window.kingPhases=[]; v.Run.prototype.emit=function(kind,detail){if(kind==="phase"&&detail.boss==="king")window.kingPhases.push(detail.phase); return emit.apply(this,arguments);};
      const start=v.Run.prototype.startWave;
      v.Run.prototype.startWave=function(){window.r=this;return start.apply(this,arguments);};
      v.Run.prototype.tick=function(input,dt){
        if(window.destination){
          let d=v.angle(this.player,window.destination);
          const obstacle=this.obstacles.find(([x,y,r])=>v.distance(this.player,{x,y})<r+52&&Math.abs(Math.atan2(Math.sin(v.angle(this.player,{x,y})-d),Math.cos(v.angle(this.player,{x,y})-d)))<.68);
          if(obstacle) d+=1.32;
          input={...input,x:Math.cos(d),y:Math.sin(d),aim:d};
        }else if(window.auto) {
          input=control(this);
          const enemy=this.enemies.find(e=>e.state==="recover"&&v.distance(e,this.player)<145);
          if(enemy&&this.build.active==="lance"&&this.build.cooldown===0&&!this.player.action&&this.player.stamina>=33) input={...input,action:"skill",aim:v.angle(this.player,enemy)};
          if(this.safe&&this.inventory.potion==="flask"&&this.player.hp<68)input.action="potion";
        }
        return original.call(this,input,dt);
      };
    }});
   },{seed,source:controller.toString(),auditThai});
   await p.goto(url);
   return p;
  }
  const click=(p,id)=>p.locator("#"+id+":visible")[touchPages.has(p)?"tap":"click"]();
  const ui=(p,id)=>p.locator('[data-ui="'+id+'"]:visible')[touchPages.has(p)?"tap":"click"]();
  const check=async(p,screen)=>{
    if(!audit) return;
    await audit.check(p,screen);
    await polish.inspect(p,screen,".shell");
  };
  const expectText=(thai,english)=>auditThai?thai:english;
  const step=(p,n=2)=>p.evaluate(n=>frames(n),n);
  const until=async(p,selector,count=240)=>{
    for(let i=0;i<count&&!await p.locator(selector).count();i++)await step(p,16);
    assert.ok(await p.locator(selector).count(),selector);
  };
  const start=async(p,mode)=>{
    if(!auditThai) await p.evaluate(()=>FrostI18n.setLanguage("en"));
    await click(p,"start");await check(p,"mode selection");
    await ui(p,mode);await check(p,mode+" setup");await ui(p,"begin");
    if(mode==="story") {
      await check(p,"story prologue");
      if(auditThai) await p.screenshot({path:out+"/intro.png"});
      await click(p,"skip-intro");
    }
  };
  const reward=async(p,id)=>{
    const card=id?p.locator('[data-reward="'+id+'"]:visible'):p.locator(".reward-card:visible").last();
    await card.click();await check(p,"selected reward");await click(p,"reward-confirm");
  };

  const p=await page(true,4212,"en-US");
  await check(p,"phone title");
  await p.screenshot({path:out+"/title.png",animations:"disabled"});
  await click(p,"options"); await check(p,"settings"); await p.locator("#quality").selectOption("low"); await p.screenshot({path:out+"/settings.png"}); await p.locator("#quality").selectOption("high"); await click(p,"options-back"); await start(p,"story");
  await click(p,"enter-room");
  await p.keyboard.press("i");
  assert.match(await p.locator("#toast").innerText(),expectText(/เปิดกระเป๋าไม่ได้ระหว่างต่อสู้/,/combat/i));
  if(auditThai) {
    await p.evaluate(()=>{document.getElementById("wave").textContent="English DOM overwrite";});
    assert.match(await p.locator("#wave").innerText(),/ด่าน 1 · ระลอก/);
  }
  await check(p,"first combat HUD");
  await p.evaluate(()=>{window.auto=true;});
  await step(p,38); await p.screenshot({path:out+"/enemy.png"}); await until(p,".reward-card:visible,#retry:visible");
  const initialCards=await p.evaluate(()=>r.choices.map(card=>card.id));
  await p.evaluate(()=>FrostI18n.setLanguage("en"));
  assert.equal(await p.locator("#dialog-title").innerText(),"Choose your reward");
  assert.deepEqual(await p.evaluate(()=>r.choices.map(card=>card.id)),initialCards);
  if(auditThai) {
    await p.evaluate(()=>FrostI18n.setLanguage("th"));
    assert.equal(await p.locator("#dialog-title").innerText(),"เลือกรางวัล");
    await check(p,"room reward");
  }
  assert.equal(await p.locator(".reward-card").count(),3);
  for(const card of await p.locator(".reward-card").all()){
    assert.ok(await card.locator(".reward-description").innerText());
    assert.ok(await card.locator(".reward-type").innerText());
  }
  await p.waitForTimeout(200);
  await p.screenshot({path:out+"/rewards.png"});
  const offers=await p.evaluate(()=>r.choices.map(c=>c.id));
  await click(p,"reward-inventory");
  assert.match(await p.locator(".inventory-status").innerText(),expectText(/เปลี่ยนอุปกรณ์/,/changes available/));
  await p.locator(".build-summary summary").click();
  await check(p,"inventory and skills");
  await ui(p,"back");
  assert.deepEqual(await p.evaluate(()=>r.choices.map(c=>c.id)),offers);
  const item=await p.evaluate(()=>r.choices.find(c=>c.type==="Weapon"||c.type==="Armor")?.key);
  assert.ok(item);
  await reward(p,"item:"+item);
  await click(p,"inventory");
  await ui(p,"item-"+item);await ui(p,"equip");
  await check(p,"equipped inventory");
  await p.waitForTimeout(180);
  await p.screenshot({path:out+"/build.png"});
  await ui(p,"back");
  const seen=[]; let secretFound=false; const captured=new Set();
  for(let room=1;room<24;room++){
   await until(p,"#enter-room:visible,[data-path]:visible"); if(await p.locator("[data-path]:visible").count()){ await check(p,"route options"); await p.waitForTimeout(180); if(room<3) await p.screenshot({path:out+"/fork.png"}); await p.locator("[data-path=safe]").tap(); }
   if(await p.evaluate(()=>Boolean(r.eliteMutation))){
    assert.match(await p.locator("#panel").innerText(),expectText(/ชั้นยอด/,/UNSTABLE ELITE|SWIFT ELITE|ARMORED ELITE|FROSTBORN ELITE|REGENERATIVE ELITE|VENGEFUL ELITE/i));
    await p.waitForTimeout(180);
    await p.screenshot({path:out+"/mutation.png"});
   }
   seen.push(await p.locator("#dialog-title").innerText());
   await check(p,"Story room "+room);
   await click(p,"enter-room");
   const type=await p.evaluate(()=>r.room.type);
   const region=await p.evaluate(()=>({stage:r.room.stage,hazard:r.room.hazard}));
   if(region.hazard&&!captured.has(region.stage)){
     await step(p,26);
     assert.ok(await p.locator("#region-hud").isVisible());
     await check(p,"region "+region.stage+" HUD");
     await p.screenshot({path:out+"/region-"+region.stage+".png"});
     captured.add(region.stage);
   }
   if(type==="merchant"&&room===1){
    await p.evaluate(()=>{window.auto=false;window.destination=FrostWorld.NPC;});
    await until(p,"#interact:visible");
    await p.evaluate(()=>window.destination=null);
    await click(p,"interact");await check(p,"merchant conversation");
    if(auditThai){await ui(p,"kingdom");await check(p,"merchant kingdom");await ui(p,"identity");await check(p,"merchant identity");}
    await ui(p,"shop");await check(p,"shop");
    const potions=await p.evaluate(()=>Object.keys(r.stock).filter(id=>FrostItems.ITEMS[id].slot==="potion"));
    assert.equal(potions.length,2);
    await p.waitForTimeout(180);
    await p.screenshot({path:out+"/merchant.png"});
    const itemToBuy=await p.evaluate(()=>Object.keys(r.stock).find(id=>FrostItems.priceOf(r.stock,id)<=r.inventory.crowns&&r.inventory.canObtain(id)));
    if(itemToBuy){await ui(p,"item-"+itemToBuy);await ui(p,"buy");await check(p,"purchase confirmation");await ui(p,"confirm");assert.match(await p.locator(".menu-feedback").innerText(),expectText(/เข้ากระเป๋า/,/Item added/));}
    if(auditThai){await ui(p,"sell-tab");await check(p,"shop sell");}
    await ui(p,"back");await p.evaluate(()=>window.auto=true);
   }
   if(type==="event"){
    await p.evaluate(()=>{window.destination=FrostWorld.DISCOVERY;});
    await until(p,"#interact:visible");
    await p.evaluate(()=>{window.destination=null;});
    await click(p,"interact");
    await check(p,"random event");
    assert.ok(await p.locator("[data-event-choice]").count()>=2);
    if(await p.locator("[data-event-choice=journal]").count()){
     await p.waitForTimeout(180);
     await p.screenshot({path:out+"/event.png"});
    }
    await p.locator("[data-event-choice=journal], [data-event-choice=leave], [data-event-choice=read], [data-event-choice=pray]").first().click();
    await check(p,"random event result");
    await click(p,"event-continue");
    assert.equal(await p.evaluate(()=>r.eventsDone.has(r.room.eventId)),true);
   }
   if(type==="rest"){ await p.evaluate(()=>{window.auto=false;window.destination=FrostWorld.DISCOVERY;}); await until(p,"#interact:visible"); await p.evaluate(()=>window.destination=null); await click(p,"interact"); await p.evaluate(()=>window.auto=true); }
   if(type==="elite") {
    for(let i=0;i<100;i++) {
     if(await p.evaluate(()=>r.enemies.some(enemy=>enemy.type==="elite"&&enemy.state==="windup"))){
      await check(p,"elite attack");
      await p.screenshot({path:out+"/elite-tell.png",scale:"css"});
      break;
     }
     if(await p.locator(".reward-card:visible,#retry:visible").count()) break;
     await step(p,2);
    }
   }
   if(type==="boss"&&await p.evaluate(()=>r.room.enemies.includes("king"))){
    await until(p,"#boss-hud:visible");
    assert.match(await p.locator("#phase").innerText(),expectText(/เฟส I\b/,/Phase I\b/i));
    await check(p,"Frozen King phase I");
    for(const phase of [2,3]) {
     let seen=false;
     for(let i=0;i<500;i++) {
      const live=await p.evaluate(phase=>r.boss?.phase===phase&&r.boss.state==="transition",phase);
      if(live){
        const numeral=phase===2?"II":"III";
        assert.match(await p.locator("#phase").innerText(),new RegExp(expectText("เฟส ","Phase ")+numeral+"\\b","i"));
        await check(p,"Frozen King phase "+phase);
        await p.screenshot({path:out+"/phase-"+phase+".png",scale:"css"});seen=true;break;
      }
      await step(p,3);
     }
     assert.ok(seen,"live visual phase "+phase);
    }
   }
   if(["combat","elite","boss"].includes(type)){
    if(await p.evaluate(()=>r.room.enemies.includes("king"))) { await until(p,"#boss-hud:visible"); assert.ok(await p.locator(".touch-actions").isVisible()); await p.screenshot({path:out+"/king.png"}); } await until(p,".reward-card:visible,#retry:visible",390);
    if(await p.locator("#retry:visible").count())break;
    await reward(p);
    if(await p.evaluate(()=>r.room.side?.hidden&&r.room.stage===2)){
     await p.evaluate(()=>{window.destination=FrostWorld.SIDE;});
     await until(p,"#interact:visible");
     assert.match(await p.locator("#interact").innerText(),expectText(/ทางลับ/,/hidden passage/i));
     await p.evaluate(()=>{window.destination=null;});
     await click(p,"interact");
     assert.match(await p.locator("#dialog-title").innerText(),expectText(/หีบลับใต้สน/,/Hollow Cache/));
     await check(p,"secret room");
     await click(p,"enter-room");
     await p.evaluate(()=>{window.destination=FrostWorld.DISCOVERY;});
     await until(p,"#interact:visible");
     await p.evaluate(()=>{window.destination=null;});
     await click(p,"interact");
     assert.ok(await p.evaluate(()=>r.discovered));
     await p.screenshot({path:out+"/secret.png"});
     if(await p.locator("[data-reward]:visible").count())await reward(p);
     secretFound=true;
    }
   }
  }
  assert.equal(secretFound,true); assert.equal(captured.size,4); assert.ok(seen.includes(expectText("ค่ายร้าง","The Abandoned Camp"))); const story=await p.evaluate(()=>r.result);
  console.log("Story",seen,story);
  assert.equal(story.won,true); assert.deepEqual(await p.evaluate(()=>kingPhases),[2,3]);
  await check(p,"Story victory");
  await p.screenshot({path:out+"/story-result.png"});
  await p.close();

  const rush=await page(true);
  await start(rush,"boss");
  assert.equal(await rush.locator(".reward-card").count(),3);
  await check(rush,"Boss Rush active skills");
  await rush.screenshot({path:out+"/mobile-rewards.png",scale:"css"});
  await reward(rush,"active:lance");
  await click(rush,"enter-room");
  await step(rush,50);
  await rush.locator("#touch-skill").tap();
  await step(rush,8);
  assert.ok(await rush.evaluate(()=>r.build.cooldown>0&&r.player.stamina<100));
  assert.equal(await rush.locator("#touch-skill").isDisabled(),true);
  await check(rush,"skill cooldown HUD");
  await rush.evaluate(()=>window.auto=true);
  for(let room=0;room<6;room++){
   await until(rush,".reward-card:visible,#retry:visible",390);
   if(await rush.locator("#retry:visible").count())break;
   assert.ok(await rush.evaluate(()=>r.choices.every(c=>c.type==="Passive")));
   await reward(rush);
   await until(rush,"#enter-room:visible");
   await click(rush,"enter-room");
   await rush.evaluate(()=>{window.destination=FrostWorld.NPC;});
   await until(rush,"#interact:visible");
   await rush.evaluate(()=>{window.destination=null;});
   await click(rush,"interact"); await ui(rush,"shop");
   if(await rush.locator('[data-ui="item-flask"]').count()){
    await ui(rush,"item-flask");await ui(rush,"buy");await ui(rush,"confirm");
    assert.match(await rush.locator(".menu-feedback").innerText(),expectText(/เข้ากระเป๋า/,/Item added/));
   }
   await ui(rush,"back");
   await until(rush,"#enter-room:visible");
   await click(rush,"enter-room");
  }
  const boss=await rush.evaluate(()=>r.result);
  console.log("Boss Rush",boss);
  assert.equal(boss.won,true);
  assert.equal(boss.kills,3); assert.deepEqual(await rush.evaluate(()=>new FrostRecords.LocalRecordProvider(localStorage).list({category:"progress"})),[]);
  await check(rush,"Boss Rush victory");
  await rush.close();

  const hc=await page();
  hc.on("dialog",dialog=>dialog.accept());
  await start(hc,"hardcore");
  await click(hc,"enter-room");
  await hc.evaluate(()=>{window.auto=true;});
  await until(hc,"[data-reward]:visible,#retry:visible",390);
  await reward(hc);
  await until(hc,"#enter-room:visible");
  await click(hc,"enter-room");
  await until(hc,"[data-path=danger]:visible");
  await hc.locator("[data-path=danger]").click();
  assert.equal(await hc.evaluate(()=>r.room.path),"danger");
  assert.match(await hc.locator("#panel").innerText(),expectText(/ชั้นยอด/,/Elite/i));
  await check(hc,"Hardcore danger");
  await hc.screenshot({path:out+"/hardcore-danger.png"});
  await click(hc,"enter-room");
  await until(hc,"#interact:visible,#retry:visible",1).catch(()=>{});
  await step(hc,60);
  assert.ok(await hc.evaluate(()=>r.enemies.some(e=>e.mutation)));
  await hc.evaluate(()=>{window.auto=false;});
  await until(hc,"#retry:visible",390);
  assert.match(await hc.locator(".panel").innerText(),expectText(/ระลอกที่ไปได้ไกลสุด/,/Farthest wave/));
  await check(hc,"Hardcore defeat");
  await click(hc,"result-home");await click(hc,"records");
  assert.match(await hc.locator("table").innerText(),expectText(/คุณ/,/You/));
  await check(hc,"local records");
  await hc.screenshot({path:out+"/records.png"});
  if(auditThai) {
    await ui(hc,"demo");await check(hc,"demo progress records");
    await ui(hc,"clear");await check(hc,"demo clear records");
  }
  await ui(hc,"back");await start(hc,"hardcore");
  assert.ok(await hc.evaluate(()=>r.wave===1&&r.inventory.crowns===34&&r.inventory.potions.length===0&&r.eventsDone.size===0&& r.mutationHazards.length===0));
  await hc.reload();
  assert.ok(await hc.locator("#title-screen").isVisible());
  assert.equal(await hc.locator("#playfield").isVisible(),false);
  assert.deepEqual(errors,[]);
  completed=true;
  console.log("PASS reward choice and safe management, Story clear, touch active and Boss Rush clear, Hardcore ending and records.");
 }finally{await b.close();audit?.finish(completed);polish?.finish(completed);}
})().catch(e=>{console.error(e);process.exitCode=1});
