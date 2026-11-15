const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium,devices}=require("playwright");
const root=path.resolve(process.argv[2]??path.join(__dirname,"../.."));
const baseline=process.argv.includes("--baseline");
const origin="http://frostbound.test",prefix="/frostbound-game/";
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2",".webp":"image/webp"};

async function pageFor(browser,kind,options={}) {
  const page=await browser.newPage(options);
  const errors=[];
  page.setDefaultTimeout(8000);
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/*",route=>{
    const url=new URL(route.request().url());
    assert.equal(url.origin,origin);
    assert(url.pathname.startsWith(prefix));
    const file=path.resolve(root,url.pathname.slice(prefix.length)||"index.html");
    assert(file.startsWith(root+path.sep)&&fs.existsSync(file),file);
    return route.fulfill({path:file,contentType:mime[path.extname(file)]});
  });
  await page.addInitScript(kind=>{
    if(kind==="pointer") return;
    if(kind==="native"){
      const Audio=window.AudioContext;
      window.audioAudit={master:null,notes:0,context:null};
      window.AudioContext=class extends Audio{
        constructor(){super();audioAudit.context=this;}
        createGain(){const gain=super.createGain();audioAudit.master??=gain;return gain;}
        createOscillator(){audioAudit.notes++;return super.createOscillator();}
      };
      return;
    }
    const param={value:0,setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){}};
    window.AudioContext=class{
      constructor(){this.state=kind==="resume"?"suspended":"running";this.currentTime=0;this.count=0;this.destination={};}
      createGain(){
        if(++this.count===2&&kind==="graph") throw Error("Injected audio graph failure");
        return {connect(){return this;},disconnect(){},gain:{...param}};
      }
      createOscillator(){
        window.oscillators=(window.oscillators??0)+1;
        if(kind==="oscillator") throw Error("Injected oscillator failure");
        return {frequency:{...param},connect(node){return node;},disconnect(){},start(){},stop(){this.onended?.();}};
      }
      resume(){return Promise.reject(Error("Injected browser resume rejection"));}
      close(){this.state="closed";window.contextCloses=(window.contextCloses??0)+1;return Promise.resolve();}
    };
  },kind);
  await page.goto(origin+prefix+"?debug=1");
  return {page,errors};
}
async function audio(browser,kind) {
  const {page,errors}=await pageFor(browser,kind);
  if(kind==="graph"){
    await page.locator("#options").click();
    await page.locator("#mute-setting").click();
  } else {
    await page.locator("#training").click();
  }
  if(baseline&&kind!=="resume"){
    await page.locator("#failure-home").waitFor();
    assert(errors.length);
    console.log(kind,"reproduced",errors[0]);
  } else {
    if(kind==="graph"){
      assert(await page.locator("#mute-setting").isChecked());
      assert(await page.evaluate(()=>JSON.parse(localStorage.getItem("frostbound.demo.v1")).muted));
      await page.locator("#options-back").click();
      await page.locator("#training").click();
    }
    await page.waitForFunction(()=>FrostDebug.snapshot().player?.time>.08);
    assert.deepEqual(errors,[]);
    assert.notEqual(await page.evaluate(()=>FrostDebug.snapshot().state),"ERROR");
    if(kind!=="resume") assert.equal(await page.evaluate(()=>contextCloses),1);
    console.log(kind,"run and input stayed available");
  }
  await page.close();
}
async function pointer(browser) {
  const {page,errors}=await pageFor(browser,"pointer",devices["iPhone 13 landscape"]);
  await page.locator("#training").tap();
  await page.evaluate(()=>{
    const stick=document.querySelector("#stick"), capture=stick.setPointerCapture;
    stick.setPointerCapture=id=>{
      stick.setPointerCapture=capture;
      throw new DOMException("Injected pointer disappearance before capture","NotFoundError");
    };
  });
  const session=await page.context().newCDPSession(page);
  const box=await page.locator("#stick").boundingBox();
  const x=Math.round(box.x+box.width/2),y=Math.round(box.y+box.height/2);
  const start=()=>session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:0}]});
  const end=()=>session.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]});
  await start();
  await end();
  if(baseline){
    assert.match(errors.join(" "),/pointer disappearance/);
    console.log("pointer reproduced an uncaught exception during capture");
  } else {
    const before=await page.evaluate(()=>FrostDebug.snapshot().player.x);
    await start();
    await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+27,y:y-7,id:0}]});
    await page.waitForFunction(prior=>FrostDebug.snapshot().player.x>prior+5,before);
    await end();
    assert.equal(await page.locator("#knob").evaluate(node=>node.style.transform),"");
    assert.deepEqual(errors,[]);
    console.log("pointer cancellation allows the next gesture");
  }
  await page.close();
}
async function nativeAudio(browser) {
  const {page,errors}=await pageFor(browser,"native");
  await page.locator("#training").click();
  await page.waitForFunction(()=>audioAudit.context?.state==="running"&&audioAudit.notes>0);
  await page.keyboard.press("j");
  await page.locator("#pause").click();
  await page.locator("#pause-options").click();
  await page.locator("#volume-setting").evaluate(control=>{
    control.value="37";
    control.dispatchEvent(new Event("input",{bubbles:true}));
  });
  await page.locator("#mute-setting").check();
  const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem("frostbound.demo.v1")));
  assert.equal(prefs.volume,.37);
  assert.equal(prefs.muted,true);
  await page.waitForFunction(()=>audioAudit.master.gain.value<.015);
  await page.reload();
  await page.locator("#options").click();
  assert(await page.locator("#mute-setting").isChecked());
  assert.equal(await page.locator("#volume-setting").inputValue(),"37");
  assert.deepEqual(errors,[]);
  await page.close();
  console.log("native AudioContext starts on input; mute and volume restored after reload");
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.FROST_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe"});
  try {
    for(const scenario of ["graph","oscillator","resume"]) await audio(browser,scenario);
    await pointer(browser);
    if(!baseline) await nativeAudio(browser);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
