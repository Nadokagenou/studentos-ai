const fs=require("node:fs"),path=require("node:path"),{chromium,devices}=require("playwright");
const assert=require("node:assert/strict");
const root=path.resolve(process.argv[2]||path.join(__dirname,"../..")), out=path.resolve(process.argv[3]||"visual-qa/controls");
fs.mkdirSync(out,{recursive:true});
const contentTypes={".js":"application/javascript; charset=utf-8",".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp"};
async function setup(browser, options) {
 const page=await browser.newPage(options), errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",entry=>{if(entry.type()==="error") errors.push(entry.text());});
 await page.route("**/*",async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=="http://frostbound.test"||!url.pathname.startsWith("/frostbound-game/")) return route.abort();
  const filename=path.resolve(root,url.pathname.slice("/frostbound-game/".length));
  if(!filename.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(filename))return route.abort();
  await route.fulfill({contentType:contentTypes[path.extname(filename)]??"application/octet-stream",body:fs.readFileSync(filename)});
 });
 await page.addInitScript(()=>{
  let combat,f,now=100,id=0;
  crypto.getRandomValues=a=>(a[0]=4212,a);
  window.requestAnimationFrame=callback=>(f=callback,++id);
  window.cancelAnimationFrame=()=>{f=null;};
  window.step=count=>{for(let i=0;i<count;i++){const next=f;f=null;next(now+=1000/60);}};
  Object.defineProperty(window,"FrostCombat",{get:()=>combat,set:value=>{
   combat=value;
   value.Run=class extends value.Run { constructor(...args){super(...args);window.r=this;} };
  }});
 });
 await page.goto("http://frostbound.test/frostbound-game/index.html?debug=1");
 return {page,errors};
}
const capture=(p,name)=>p.screenshot({path:path.join(out,name+".png"),scale:"css",animations:"disabled"});
const step=(p,n)=>p.evaluate(n=>window.step(n),n);
(async()=>{
 const b=await chromium.launch({executablePath:process.env.FROST_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--disable-background-networking"]});
 try {
  const {page:p,errors}=await setup(b,devices["iPhone 13"]);
  const tap=id=>p.locator(id).tap();
  await tap("#start");await tap("[data-ui=story]");await tap("[data-ui=begin]");await tap("#skip-intro");await tap("#enter-room");
  await step(p,3);
  await p.evaluate(()=>{
   r.pending=[];r.enemies=[];r.addEnemy("dummy",760,190,30);
   Object.assign(r.player,{x:480,y:460,hp:81});
  });
  await p.waitForTimeout(350);
  if(await p.locator("#resume:visible").count()) await tap("#resume");
  const cd=await p.context().newCDPSession(p);
  const stick=await p.locator("#stick").boundingBox();
  const x=Math.round(stick.x+stick.width/2),y=Math.round(stick.y+stick.height/2);
  await cd.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:0}]});
  await cd.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+27,y:y}]});
  await step(p,12);
  assert.ok(await p.evaluate(()=>r.player.x>495));
  const strike=await p.locator("[data-action=light]").boundingBox();
  const sx=Math.round(strike.x+strike.width/2),sy=Math.round(strike.y+strike.height/2);
  const previous=await p.evaluate(()=>r.player.x);

  await cd.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:x+27,y,id:0},{x:sx,y:sy,id:1}]});
  await step(p,3);
  assert.ok(await p.evaluate(previous=>r.player.x>previous,previous));
  assert.equal(await p.evaluate(()=>r.player.action?.type),"light");
  await cd.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await step(p,28);
  await tap("[data-action=heavy]");await step(p,3);
  assert.equal(await p.evaluate(()=>r.player.action?.type),"heavy");
  await step(p,72);
  await tap("[data-action=dash]");await step(p,3);
  assert.equal(await p.evaluate(()=>r.player.action?.type),"dash");
  await step(p,28);
  await tap("[data-action=parry]");await step(p,3);
  assert.equal(await p.evaluate(()=>r.player.action?.type),"parry");
  await step(p,23);
  await tap("#drink");await step(p,36);
  assert.deepEqual(await p.evaluate(()=>[r.stats.potions,r.player.hp,r.inventory.potions.length]),[1,100,0]);
  assert.deepEqual(errors,[]);
  await capture(p,"touch-controls");
  console.log("Touch: joystick + light, heavy, dash, parry, potion and frame advancement passed.");
  await p.close();
  const {page:desktop,errors:desktopErrors}=await setup(b,{viewport:{width:1440,height:900}});
  await desktop.locator("#training").click();
  await step(desktop,4);
  const startX=await desktop.evaluate(()=>r.player.x);
  await desktop.keyboard.down("d");
  await step(desktop,12);
  await desktop.keyboard.up("d");
  assert(await desktop.evaluate(startX=>r.player.x>startX+10,startX));
  for(const weapon of ["edge","fang","spear","great","ash","moon"]) {
    await desktop.evaluate(weapon=>{
      r.enemies=[];r.gateOpen=true;
      r.player.action=null;
      if(!r.inventory.owned[weapon]) r.inventory.obtain(weapon);
      if(!r.equip(weapon)) throw Error("Unable to equip "+weapon);
      r.gateOpen=false;
      Object.assign(r.player,{x:480,y:355});
      r.addEnemy("dummy",553,355,0);
      r.enemies[0].state="stagger";r.enemies[0].timer=20;
    },weapon);
    for(const [key,attack] of [["j","light"],["k","heavy"]]) {
      await desktop.evaluate(()=>Object.assign(r.player,{action:null,stamina:100,combo:-1}));
      await desktop.keyboard.press(key);
      await step(desktop,3);
      assert.equal(await desktop.evaluate(()=>r.player.action?.type),attack);
      for(let frame=0;frame<60;frame++) {
        if(await desktop.evaluate(()=>r.player.action?.age>=r.player.action?.attack?.windup+.025)) break;
        await step(desktop,1);
      }
      assert(await desktop.evaluate(()=>r.player.action?.age>=r.player.action?.attack?.windup+.025));
      if(weapon==="great") await capture(desktop,`great-${attack}`);
    }
  }
  await desktop.evaluate(()=>{
    r.enemies=[];r.addEnemy("dummy",550,355,0);
    Object.assign(r.player,{x:480,y:355,action:null,stamina:100});
    const enemy=r.enemies[0];
    r.startAttack(enemy,"dummy",Math.PI);
    enemy.attack.age=enemy.attack.data.windup-.018;
  });
  await desktop.keyboard.press("q");
  await step(desktop,3);
  assert.equal(await desktop.evaluate(()=>r.stats.parries),1);
  await capture(desktop,"perfect-parry");
  assert.deepEqual(desktopErrors,[]);
  console.log("Keyboard: movement, all 6 light/heavy weapon families, and Perfect Parry passed.");
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
