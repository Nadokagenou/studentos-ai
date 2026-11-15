const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, devices } = require("playwright");

const root = path.resolve(process.argv[2] || path.join(__dirname, "../.."));
const output = path.resolve(process.argv[3] || "visual-qa");
const prefix = "/frostbound-game/";
const origin = "http://frostbound.test";
const mime = {".js":"text/javascript", ".css":"text/css", ".woff2":"font/woff2",".webp":"image/webp", ".html":"text/html"};
const seed = 4212;
const profileOnly=process.argv.includes("--profile-only");
const regions = ["outpost", "forest", "depths", "capital", "throne"];
const extra = ["merchant", "rest", "elite", "secret", "boss"];

async function capture(browser, name, viewport) {
  const page = await browser.newPage(viewport);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", entry => {
    if (entry.type() === "error") errors.push(entry.text());
  });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, origin);
    assert(url.pathname.startsWith(prefix));
    const file = path.resolve(root, url.pathname.slice(prefix.length) || "index.html");
    assert(file.startsWith(root + path.sep) && fs.existsSync(file), file);
    return route.fulfill({contentType:mime[path.extname(file)],path:file});
  });
  await page.addInitScript(() => {
    let renderType,combat,localeApi,uiSpent=0;
    window.qaUiSamples=[];
    Object.defineProperty(window,"FrostI18n",{get:()=>localeApi,set:value=>{
      localeApi=value;
      for(const method of ["setText","setMessage","setAttribute"]) {
        const original=value[method];
        value[method]=function(...args){
          if(!window.qaLive) return original.apply(this,args);
          const start=performance.now();
          const result=original.apply(this,args);
          uiSpent+=performance.now()-start;
          return result;
        };
      }
    }});
    Object.defineProperty(window,"FrostRenderer",{get:()=>renderType,set:Type=>{
      renderType=class extends Type { constructor(canvas) { super(canvas); window.qaRenderer=this; } };
    }});
    const raf=window.requestAnimationFrame;
    window.qaRAF=raf.bind(window);
    let first=true;
    window.requestAnimationFrame=callback=>{
      if(first||window.qaLive) {
        first=false;
        return raf(time=>{
          uiSpent=0;
          callback(time);
          if(uiSpent>0) window.qaUiSamples.push(uiSpent);
        });
      }
      window.qaPending=callback;
      return 0;
    };
    Object.defineProperty(window,"FrostCombat",{get:()=>combat,set:value=>{
      combat=value;
      const request=value.Run.prototype.request;
      value.Run.prototype.request=function(action,input) {
        const accepted=request.call(this,action,input);
        if(accepted&&action==="light"&&Number.isFinite(window.qaInput)) {
          window.qaDelays.push(performance.now()-window.qaInput);
          window.qaInput=null;
        }
        return accepted;
      };
    }});
    window.qaDelays=[];
    window.addEventListener("keydown",event=>{if(event.code==="KeyJ")window.qaInput=performance.now();},true);
    window.addEventListener("pointerdown",event=>{
      if(event.target.closest("[data-action=light]")) window.qaInput=performance.now();
    },true);
  });
  await page.goto(origin + prefix + "?debug=1");
  const initial=await page.evaluate(async()=>{
    await document.fonts.ready;
    await new Promise(resolve=>qaRAF(()=>qaRAF(resolve)));
    const nav=performance.getEntriesByType("navigation")[0];
    return {firstContentfulPaint:performance.getEntriesByName("first-contentful-paint")[0]?.startTime??null,
      domContentLoaded:nav.domContentLoadedEventEnd,
      fonts:performance.getEntriesByType("resource").filter(entry=>entry.name.endsWith(".woff2"))
        .map(({name,duration,responseEnd})=>({name:name.split("/").at(-1),duration,responseEnd}))};
  });
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth));
  await page.locator("#training").click();
  if(await page.locator("#portrait-continue:visible").count()) await page.locator("#portrait-continue").click();
  await page.evaluate(seed => {
    const rooms=FrostRegions.generate("story",seed);
    const elite=FrostRegions.generate("hardcore",seed).flatMap(room=>Object.values(room.paths??{})).find(room=>room.type==="elite");
    window.qaScenes=[
      ...[1,2,3,4,5].map(stage=>rooms.find(room=>room.stage===stage&&room.enemies.length&&(![4,5].includes(stage)||room.type===(stage===5?"boss":"elite")))),
      rooms.find(room=>room.type==="merchant"), rooms.find(room=>room.type==="rest"),
      elite, rooms.find(room=>room.side?.type==="treasure")?.side,
      FrostRegions.generate("boss",seed).find(room=>room.theme==="crystal"),
    ];
    window.qaShow=(index, quality="high")=>{
      const room=qaScenes[index], run=new FrostCombat.Run("story",seed);
      Object.defineProperty(run,"room",{value:room});
      run.startWave();
      if (run.preparing) {
        run.prepareEncounter();
        for (let i=0;i<146;i++) run.tick({x:0,y:0});
      }
      Object.assign(run.player,{x:480,y:408});
      run.time=3.25;
      qaRenderer.reset();
      qaRenderer.draw(run,{quality,reduced:false,shake:false,damageNumbers:true},null,0);
      qaRenderer.draw(run,{quality,reduced:false,shake:false,damageNumbers:true},null,260);
      window.qaRun=run;
      document.getElementById("remaining").textContent=room.name;
      return {id:room.id,type:room.type,theme:room.theme};
    };
    document.getElementById("wave").textContent="";
    document.getElementById("region-hud").hidden=true;
    document.getElementById("room-name").textContent="";
    document.getElementById("announcement").textContent="";
    document.getElementById("lesson").hidden=true;
  }, seed);
  const captures = name==="desktop" ? [...regions,...extra] : regions;
  const rows = [];
  for (const [index,scene] of (profileOnly?[]:captures.entries())) {
    const detail = await page.evaluate(index=>qaShow(index),index);
    rows.push([scene,detail]);
    await page.screenshot({path:path.join(output,`${name}-${scene}.jpg`),type:"jpeg",quality:84,scale:"css"});
  }
  if(!profileOnly) {
    await page.evaluate(() => qaShow(1,"low"));
    await page.screenshot({path:path.join(output,`${name}-forest-low.jpg`),type:"jpeg",quality:84,scale:"css"});
  }
  if(!profileOnly&&name==="desktop") for(const phase of [2,3]) {
    await page.evaluate(phase=>{
      qaShow(4);
      qaRun.boss.phase=phase;
      qaRenderer.draw(qaRun,{quality:"high",reduced:false,shake:false,damageNumbers:true},null,290);
      qaRenderer.draw(qaRun,{quality:"high",reduced:false,shake:false,damageNumbers:true},null,800);
    },phase);
    await page.screenshot({path:path.join(output,`desktop-throne-phase-${phase}.jpg`),type:"jpeg",quality:84,scale:"css"});
  }
  let profiles = {};
  for (const quality of ["high","low"]) {
    const cdp=await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.collectGarbage");
    profiles[quality]=await page.evaluate(async quality => {
      const records=[], frames=[], tasks=[];
      const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(entry=>entry.duration)));
      observer.observe({type:"longtask"});
      qaShow(1,quality);
      qaRun.fx=[{kind:"word",label:"PERFECT PARRY",x:500,y:335,age:.2,duration:.7,color:"#e5fbff"},
        {kind:"word",label:"CHILLED",x:430,y:360,age:.35,duration:.7,color:"#d9eaff"}];
      const settings={quality,reduced:false,shake:false,damageNumbers:true};
      let previous=0, rendered=0;
      await new Promise(resolve=>{
        function step(now) {
          if (previous && now-previous<(quality==="low"?30:12)) { qaRAF(step); return; }
          if (rendered++>=108) { resolve(); return; }
          if (rendered>9) frames.push(now-previous);
          qaRun.time+=.016;
          const start=performance.now();
          qaRenderer.draw(qaRun,settings,null,now);
          if (rendered>9) records.push(performance.now()-start);
          previous=now;
          qaRAF(step);
        }
        qaRAF(step);
      });
      observer.disconnect();
      const percentile=(samples,fraction)=>[...samples].sort((a,b)=>a-b)[Math.floor(fraction*(samples.length-1))];
      return {
        fps:1000*frames.length/frames.reduce((a,b)=>a+b,0),
        p50:percentile(frames,.5),p95:percentile(frames,.95),p99:percentile(frames,.99),
        drawP95:percentile(records,.95),tasks,
        cacheBytes:qaRenderer.ground.width*qaRenderer.ground.height*4,
        particleCount:qaRenderer.art?.particleCount??(quality==="low"?18:102),
      };
    }, quality);
    await cdp.send("HeapProfiler.collectGarbage");
    const heap=await cdp.send("Runtime.getHeapUsage");
    profiles[quality].heap=heap.usedSize;
    await cdp.detach();
  }
  const stress=await page.evaluate(()=>{
    const art=qaRenderer.art;
    if(!art) return null;
    const start=art.builds;
    for(let i=0;i<100;i++) art.prepare(qaRun,["high","medium","low"][i%3],800,600,i);
    for(let i=0;i<50;i++) art.prepare(qaRun,"high",801+i,600+i,i);
    return {builds:art.builds-start,cacheBytes:art.ground.width*art.ground.height*4};
  });
  await page.evaluate(()=>{
    window.qaLive=true;
    if(window.qaPending) qaRAF(window.qaPending);
  });
  for(let i=0;i<(profileOnly?12:8);i++) {
    if(name==="desktop") await page.keyboard.press("j");
    else await page.locator("[data-action=light]").tap();
    await page.waitForTimeout(520);
  }
  const input=await page.evaluate(()=>qaDelays);
  const ui=await page.evaluate(()=>qaUiSamples);
  assert.deepEqual(errors,[]);
  assert(input.length>=4,name+" had "+input.length+" accepted input samples");
  await page.close();
  return {rows,profiles,input,stress,initial,ui,errors};
}

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({
    executablePath:process.env.FROST_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args:["--disable-background-networking"],
  });
  try {
    const desktop=await capture(browser,"desktop",{viewport:{width:1440,height:900}});
    const mobile=await capture(browser,"mobile",devices[process.argv.includes("--landscape")?"iPhone 13 landscape":"iPhone 13"]);
    const report={seed,desktop,mobile};
    fs.writeFileSync(path.join(output,"metrics.json"),JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({desktop:desktop.profiles,mobile:mobile.profiles,
      input:[desktop.input,mobile.input],stress:[desktop.stress,mobile.stress]}));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
