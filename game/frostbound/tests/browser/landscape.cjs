const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium,devices}=require("playwright");
const {translationAudit}=require("./translation-audit.cjs");
const {polishChecks}=require("./polish-checks.cjs");
const root=path.resolve(process.argv[2]??path.join(__dirname,"../.."));
const output=path.resolve(process.argv[3]??"qa/landscape");
const publicUrl=process.argv.slice(4).find(arg=>/^https?:/.test(arg));
const repeated=process.argv.includes("--extended")?50:12;
const baseline=process.argv.includes("--baseline");
const audit=translationAudit(output);
const polish=polishChecks(output,baseline);
const origin="http://frostbound.test";
const prefix="/frostbound-game/";
const type={".html":"text/html",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".webp":"image/webp"};
const snap=page=>page.evaluate(()=>FrostDebug.snapshot());
const step=(page,count=4)=>page.evaluate(count=>window.step(count),count);
const click=(page,selector)=>page.locator(selector).click();
async function screenshot(page,name) {
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(output,name+".jpg"),type:"jpeg",quality:83,scale:"css",
    animations:name.includes("menu")||name==="desktop-thai"?"disabled":"allow"});
}
const rotationTimes=[];

async function setup(browser,options,{blockFonts=false}={}) {
  const page=await browser.newPage(options);
  page.setDefaultTimeout(8500);
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
  page.on("response",response=>{if(response.status()>=400)errors.push(response.status()+" "+response.url());});
  page.on("dialog",dialog=>dialog.accept());
  if(!publicUrl)await page.route("**/*",route=>{
    const url=new URL(route.request().url());
    assert.equal(url.origin,origin);
    assert(url.pathname.startsWith(prefix));
    const file=path.resolve(root,url.pathname.slice(prefix.length)||"index.html");
    assert(file.startsWith(root+path.sep)&&fs.existsSync(file),file);
    if(blockFonts&&path.extname(file)===".woff2") return route.abort();
    return route.fulfill({contentType:type[path.extname(file)],path:file});
  });
  await page.addInitScript(()=>{
    let combat,render,next,time=100,count=0;
    crypto.getRandomValues=array=>{array[0]=4212;return array;};
    requestAnimationFrame=callback=>{assertFrame();next=callback;return ++count;};
    cancelAnimationFrame=()=>{next=null;};
    function assertFrame(){if(next)throw Error("Second frame scheduled before the first ran");}
    window.step=n=>{for(let i=0;i<n;i++){const callback=next;next=null;callback(time+=17);}};
    Object.defineProperty(window,"FrostCombat",{get:()=>combat,set:value=>{
      combat=value;value.Run=class extends value.Run {constructor(...args){super(...args);window.run=this;}};
    }});
    Object.defineProperty(window,"FrostRenderer",{get:()=>render,set:Type=>{
      render=class extends Type {constructor(canvas){super(canvas);window.drawGame=this;}};
    }});
  });
  await page.goto((publicUrl??origin+prefix)+"?debug=1");
  assert.match(await page.title(),baseline?/FROSTBOUND v4\.5\.1/:/FROSTBOUND v4\.5\.2/);
  return {page,errors};
}
async function story(page) {
  await click(page,"#start");
  await polish.inspect(page,"mode selection","#veil");
  await click(page,"[data-ui=story]");
  await click(page,"[data-ui=begin]");
  if(await page.locator("#skip-intro:visible").count()) await polish.inspect(page,"intro","#intro");
  await click(page,"#skip-intro");
  if(await page.locator("#portrait-continue:visible").count()) await click(page,"#portrait-continue");
  await click(page,"#enter-room");
  await step(page,5);
}
async function verifyBounds(page) {
  const boxes=await page.evaluate(()=>{
    const arena=document.getElementById("arena");
    const size=drawGame.camera(arena.clientWidth,arena.clientHeight,run.player);
    const mapped=drawGame.toWorld(size.x+run.player.x*size.scale,size.y+run.player.y*size.scale,run.player);
    const controls=[...document.querySelectorAll(".touch-actions button")].map(button=>button.getBoundingClientRect().toJSON());
    return {size,mapped,player:{x:run.player.x,y:run.player.y},controls,
      w:innerWidth,h:innerHeight,scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]};
  });
  assert(boxes.size.scale>0&&Number.isFinite(boxes.size.scale));
  assert(Math.abs(boxes.mapped.x-boxes.player.x)<1&&Math.abs(boxes.mapped.y-boxes.player.y)<1);
  assert(boxes.controls.every(r=>r.width>=44&&r.height>=44&&r.left>=0&&r.top>=0&&r.right<=boxes.w+1&&r.bottom<=boxes.h+1));
  assert(boxes.scroll[0]<=boxes.w&&boxes.scroll[1]<=boxes.h);
}
async function rotate(page,{count=1,finished=false}={}) {
  const start=await snap(page);
  const landscape=page.viewportSize();
  await page.evaluate(()=>{window.beforeRotation=run;});
  for(let i=0;i<count;i++) {
    const startAt=performance.now();
    await page.setViewportSize({width:390,height:844});
    await page.locator("#orientation-guide").waitFor({state:finished?"hidden":"visible"});
    rotationTimes.push(performance.now()-startAt);
    if(!finished) await step(page,6);
    const blocked=await snap(page);
    assert.equal(blocked.overlay,start.overlay);
    assert.equal(blocked.player.time,start.player.time);
    await page.setViewportSize(landscape);
    await page.locator("#orientation-guide").waitFor({state:"hidden"});
    const restored=await snap(page);
    assert.equal(restored.room,start.room);
    assert.equal(restored.seed,start.seed);
    assert.equal(restored.overlay,start.overlay);
    assert(await page.evaluate(()=>run===beforeRotation));
  }
}
async function simultaneous(page) {
  const cd=await page.context().newCDPSession(page);
  const elbow=await page.locator("#stick").boundingBox();
  const center={x:Math.round(elbow.x+elbow.width/2),y:Math.round(elbow.y+elbow.height/2),id:0};
  const diagonal={x:center.x+23,y:center.y-19,id:0};
  for(const action of ["light","heavy","dash","parry","skill","potion"]) {
    await page.evaluate(()=>{
      run.pending=[];run.enemies=[];
      run.addEnemy("dummy",782,170,99);
      run.build.active="lance";
      run.build.cooldown=0;
      Object.assign(run.player,{x:470,y:390,hp:65,action:null,stamina:100});
    });
    await step(page,7);
    const button=page.locator(`[data-action=${action}]`);
    const target=await button.boundingBox();
    assert(target&&!await button.isDisabled(),action);
    await cd.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[center]});
    await cd.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[diagonal]});
    await step(page,7);
    assert(await page.evaluate(()=>run.player.x>474&&run.player.y<387),"diagonal + "+action);
    await cd.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[diagonal,
      {x:Math.round(target.x+target.width/2),y:Math.round(target.y+target.height/2),id:1}]});
    await step(page,3);
    assert.equal((await snap(page)).playerState,action);
    await cd.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]});
    assert.equal(await page.locator("#knob").evaluate(node=>node.style.transform),"");
  }
  await cd.detach();
}
async function roomTo(page,predicate,beforeEnter) {
  await page.evaluate(predicate=>{
    const n=run.rooms.findIndex(room=>room.type===predicate||room.enemies.includes(predicate));
    if(n<1) throw Error("No test room "+predicate);
    run.route.index=n-1;run.startWave();
  },predicate);
  await step(page,3);
  if(beforeEnter) await beforeEnter();
  await click(page,"#enter-room");
}
async function finishTestRun(page,won) {
  await page.evaluate(won=>{
    const tick=run.tick;
    run.tick=function(){
      this.tick=tick;
      this.finish(won,won?"":"Ice Shockwave");
    };
  },won);
  await step(page,won?5:100);
  await page.locator("#retry").waitFor({state:"visible"});
  await rotate(page,{finished:true});
}

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({
    executablePath:process.env.FROST_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",
    args:["--disable-background-networking"],
  });
  let completed=false;
  try {
    const desktop=await setup(browser,{locale:"en-US",viewport:{width:1440,height:900}});
    const d=desktop.page;
    assert.match(await d.locator("#start").innerText(),/เริ่มการเดินทาง/);
    assert.equal(await d.locator("#title-lang-th").getAttribute("aria-pressed"),"true");
    await audit.check(d,"desktop title");
    await polish.inspect(d,"desktop Thai menu","#title-screen");
    await polish.font(d,"UI Thai","#start .start-label","Noto Sans Thai");
    await screenshot(d,"desktop-thai");
    await click(d,"#title-lang-en");
    assert.match(await d.locator("#start").innerText(),/New Run/);
    await polish.inspect(d,"desktop English menu","#title-screen");
    await polish.font(d,"UI English","#start .start-label","Noto Sans Thai");
    await screenshot(d,"desktop-en");
    await d.reload();
    assert.equal(await d.locator("html").getAttribute("lang"),"en");
    assert.equal(await d.locator("#title-lang-en").getAttribute("aria-pressed"),"true");
    await click(d,"#title-lang-th");
    await d.reload();
    assert.equal(await d.locator("html").getAttribute("lang"),"th");
    await click(d,"#options");
    assert.match(await d.locator("#dialog-title").innerText(),/ตั้งค่า/);
    await polish.inspect(d,"Settings","#veil");
    await screenshot(d,"desktop-settings-thai");
    await d.evaluate(async()=>{
      if(document.fullscreenElement) await document.exitFullscreen();
      document.querySelector(".shell").requestFullscreen=()=>Promise.reject(new Error("Test browser restriction"));
    });
    await click(d,"#screen-mode");
    await d.locator("#screen-feedback").waitFor({state:"visible"});
    assert.match(await d.locator("#screen-feedback").innerText(),/เปิดเต็มจอไม่ได้/);
    await d.locator("#language-setting").selectOption("en");
    assert.equal(await d.locator("#dialog-title").innerText(),"Settings");
    await d.reload();
    assert.match(await d.locator("#start").innerText(),/New Run/);
    await click(d,"#records");
    assert.equal(await d.locator("#dialog-title").innerText(),"Records");
    await polish.inspect(d,"records","#veil");
    await click(d,"[data-ui=back]");
    await click(d,"#credits");
    await polish.inspect(d,"credits","#veil");
    await click(d,"a[href='playtest.html']");
    await d.locator("#report").waitFor();
    assert.match(await d.locator("#report").inputValue(),baseline?/FROSTBOUND v4\.5\.1/:/FROSTBOUND v4\.5\.2/);
    assert.match(await d.locator("#report").inputValue(),/Game version/);
    assert.equal(await d.locator("#play-heading").innerText(),"Getting started");
    await d.evaluate(()=>FrostI18n.setLanguage("th"));
    assert.match(await d.locator("#report").inputValue(),/เวอร์ชันเกม/);
    await audit.check(d,"Team Beta guide");
    await screenshot(d,"guide-thai");
    assert.deepEqual(desktop.errors,[]);
    await d.close();
    if(!baseline&&!publicUrl) {
      const {page:fallback}=await setup(browser,{locale:"en-US",viewport:{width:1000,height:640}},{blockFonts:true});
      await polish.font(fallback,"blocked web fonts","#start .start-label");
      await click(fallback,"#start");
      assert.equal(await fallback.locator("#dialog-title").innerText(),"เลือกโหมดเกม");
      await fallback.close();
    }
    const mobile=await setup(browser,{...devices["iPhone 13 landscape"],locale:"th-TH",viewport:{width:844,height:390}});
    const p=mobile.page;
    await screenshot(p,"landscape-menu-thai");
    await story(p);
    await verifyBounds(p);
    await polish.inspect(p,"combat HUD","#playfield");
    await polish.docks(p,"Story HUD");
    await screenshot(p,"landscape-story-thai");
    const memory=await p.context().newCDPSession(p);
    await memory.send("HeapProfiler.collectGarbage");
    const beforeRotation=await memory.send("Runtime.getHeapUsage");
    await rotate(p,{count:repeated});
    await memory.send("HeapProfiler.collectGarbage");
    const afterRotation=await memory.send("Runtime.getHeapUsage");
    await memory.detach();
    await simultaneous(p);
    await pagePause(p);
    await polish.inspect(p,"pause","#veil");
    await polish.language(p,"pause","#dialog-title",/หยุดชั่วคราว/,/Paused/);
    await rotate(p);
    assert.equal((await snap(p)).overlay,"pause");
    await click(p,"#pause-options");
    await p.locator("#language-setting").selectOption("en");
    assert.equal((await snap(p)).overlay,"options");
    await click(p,"#options-back");
    await click(p,"#resume");
    await p.evaluate(()=>{
      run.pending=[];run.enemies=[];run.shots=[];run.hazard=null;
      run.mutationHazards=[];run.runWave=run.waves;run.gateOpen=false;
    });
    await step(p,10);
    await p.locator(".reward-card").first().click();
    const offer=await p.locator("[aria-pressed=true][data-reward]").getAttribute("data-reward");
    await rotate(p);
    await p.evaluate(()=>FrostI18n.setLanguage("th"));
    assert.equal(await p.locator("[aria-pressed=true][data-reward]").getAttribute("data-reward"),offer);
    await screenshot(p,"landscape-rewards-thai");
    await audit.check(p,"landscape rewards");
    await polish.inspect(p,"reward cards","#veil");
    await polish.language(p,"rewards","#dialog-title",/เลือกรางวัล/,/Choose your reward/);
    await click(p,"#reward-confirm");
    assert(await p.evaluate(()=>run.offer===null));
    await roomTo(p,"merchant");
    await click(p,"#inventory");
    await rotate(p);
    await screenshot(p,"landscape-inventory-thai");
    await audit.check(p,"landscape inventory");
    await polish.inspect(p,"inventory and equipment","#veil");
    await polish.language(p,"inventory","#dialog-title",/กระเป๋า/,/Inventory/);
    await click(p,"[data-ui=back]");
    await p.evaluate(()=>Object.assign(run.player,FrostWorld.NPC));
    await step(p,6);
    await click(p,"#interact");
    await rotate(p);
    assert.match(await p.locator(".conversation").innerText(),/[ก-๙]/);
    await polish.inspect(p,"story dialogue","#veil");
    await polish.font(p,"narrative Thai",".conversation p > span","Noto Serif Thai");
    await screenshot(p,"landscape-dialogue-thai");
    await click(p,"[data-ui=shop]");
    await rotate(p);
    assert.match(await p.locator(".item-detail").innerText(),/[ก-๙]/);
    await polish.inspect(p,"merchant","#veil");
    await polish.language(p,"merchant","#dialog-title",/ร้าน/,/shop/i);
    await screenshot(p,"landscape-merchant-thai");
    const flask=p.locator("[data-ui=item-flask]");
    if(await flask.count()) {
      await flask.click();
      if(await p.locator("[data-ui=buy]").count()) {
        await click(p,"[data-ui=buy]");
        await rotate(p);
        const old=await p.evaluate(()=>{
          window.purchaseButton=document.querySelector("[data-ui=confirm]");
          return run.merchantHistory.purchases;
        });
        await click(p,"[data-ui=confirm]");
        assert.equal(await p.evaluate(()=>run.merchantHistory.purchases),old+1);
        await p.evaluate(()=>purchaseButton.click());
        assert.equal(await p.evaluate(()=>run.merchantHistory.purchases),old+1);
      }
    }
    await click(p,"[data-ui=back]");
    await roomTo(p,"king",async()=>{
      await polish.inspect(p,"boss dialogue","#veil");
      await polish.language(p,"Story room",".story-marker",/ด่าน/,/Stage/i);
      await screenshot(p,"landscape-boss-dialogue-thai");
    });
    await step(p,118);
    await p.locator("#boss-hud").waitFor({state:"visible"});
    await p.evaluate(()=>run.damageEnemy(run.boss,430,0));
    await step(p,2);
    assert.equal((await snap(p)).state,"BOSS_TRANSITION");
    if(!baseline) assert.match(await p.locator("#phase").innerText(),/เฟส II\b/);
    await rotate(p);
    await verifyBounds(p);
    await p.evaluate(()=>{
      const toast=document.getElementById("toast");
      FrostI18n.setText(toast,"Eldric · Come back when the cold changes your mind.");
      toast.hidden=false;
    });
    await polish.docks(p,"boss phase with subtitle and notification");
    await polish.inspect(p,"boss subtitle and HUD","#playfield");
    await screenshot(p,"landscape-boss-thai");
    await finishTestRun(p,true);
    await polish.inspect(p,"victory","#veil");
    await screenshot(p,"landscape-victory-thai");
    await click(p,"#result-home");
    await click(p,"#start");await click(p,"[data-ui=hardcore]");await click(p,"[data-ui=begin]");
    await click(p,"#enter-room");
    await finishTestRun(p,false);
    await polish.inspect(p,"defeat","#veil");
    await screenshot(p,"landscape-defeat-thai");
    assert.deepEqual(mobile.errors,[]);
    await p.close();
    for(const [width,height] of [[740,360],[568,320],[932,430],[1024,768],[390,844]]) {
      const size=await setup(browser,{...devices["iPhone 13 landscape"],locale:height>width?"th-TH":"en-US",viewport:{width,height}});
      const q=size.page;
      const titlePicker=await q.locator("#title-languages").boundingBox();
      assert.ok(titlePicker.x>=0&&titlePicker.y>=0&&titlePicker.x+titlePicker.width<=width+1&&titlePicker.y+titlePicker.height<=height+1,
        "language buttons fit "+width+"×"+height);
      if(height>width) {
        await click(q,"#training");
        await q.locator("#orientation-guide").waitFor({state:"visible"});
        await audit.check(q,"orientation guide");
        await screenshot(q,"portrait-guidance");
        await click(q,"#portrait-continue");
        await step(q);
        assert(!(await snap(q)).orientationPaused);
      } else {
        if(width===1024) {
          await click(q,"#training");
          await step(q,8);
          await screenshot(q,"landscape-training");
          const lessons=await q.evaluate(()=>FrostCombat.LESSONS.length);
          for(let index=0;index<=lessons;index++) {
            await audit.check(q,"training "+(index+1));
            await polish.inspect(q,"training "+(index+1),"#playfield");
            await polish.docks(q,"training "+(index+1));
            if(index<lessons) { await click(q,"#skip-lesson"); await step(q,8); }
          }
        }
        else await story(q);
        await verifyBounds(q);
        await polish.docks(q,width+"x"+height);
        if(width===568) {
          await polish.canvas(q);
          await screenshot(q,"narrow-combat-feedback");
          await roomTo(q,"king");
          await step(q,118);
          await q.evaluate(()=>run.damageEnemy(run.boss,430,0));
          await step(q,2);
          await polish.docks(q,"narrow boss phase",{safeArea:true});
          await screenshot(q,"narrow-landscape");
        }
      }
      assert.deepEqual(size.errors,[]);
      await q.close();
    }
    const samples=[...rotationTimes].sort((a,b)=>a-b);
    const rotation={samples:samples.length,p95Ms:samples[Math.floor((samples.length-1)*.95)],
      heapBefore:beforeRotation.usedSize,heapAfter:afterRotation.usedSize};
    fs.writeFileSync(path.join(output,"rotation.json"),JSON.stringify(rotation,null,2)+"\n");
    completed=true;
    console.log("PASS locale, subpath, 6 viewports, diagonal + 6 actions, rotation checks including results.",rotation);
  } finally {await browser.close();audit.finish(completed);polish.finish(completed);}
})().catch(error=>{console.error(error);process.exitCode=1;});

function pagePause(page) {return click(page,"#pause");}
