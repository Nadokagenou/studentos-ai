const {test}=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const gameRoot=path.resolve(__dirname,"..");
const read=name=>readFileSync(path.join(gameRoot,name),"utf8");

// Exercises the main loop and menu callbacks without a Canvas or a browser.
function fixture(reduced=true) {
  const frames=new Map(), timers=new Map(), storage=new Map(), errors=[];
  let time=100,handle=0, active, run, renderer;
  class Element {
    constructor(tag="",attributes={}) {
      this.tag=tag;
      this.attributes=attributes;
      this.hidden=Object.hasOwn(attributes,"hidden");
      this.disabled=Object.hasOwn(attributes,"disabled");
      this.isConnected=true;
      this.inert=false;
      this.dataset=Object.fromEntries(Object.entries(attributes).filter(([key])=>key.startsWith("data-"))
        .map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]));
      this.style={setProperty(){}};
      const classes=new Set((attributes.class??"").split(" "));
      this.classList={toggle(name,on){if(on) classes.add(name);else classes.delete(name);},
        contains:name=>classes.has(name),remove:name=>classes.delete(name)};
      this.listeners={};
      this.children=[];
    }
    addEventListener(name,fn) { (this.listeners[name]??=[]).push(fn); }
    dispatch(name,event={}) { for(const fn of this.listeners[name]??[]) fn(event); }
    focus() { active=this; }
    getClientRects() {return this.isConnected&&!this.hidden?[{}]:[];}
    hasPointerCapture() { return false; }
    contains(node) {return this.children.includes(node);}
    setAttribute(name,value) {this.attributes[name]=value;}
    replaceChildren() { this.innerHTML=""; }
    set innerHTML(value) {
      for(const child of this.children) child.isConnected=false;
      this.children=parse(value);
    }
    querySelectorAll(selector) {
      return this.children.filter(node=>selector.split(",").some(part=>node.matches(part.trim())));
    }
    querySelector(selector) {return this.querySelectorAll(selector)[0]??null;}
    matches(selector) {
      if(selector.startsWith("#")) return this.attributes.id===selector.slice(1);
      if(selector.endsWith(":not(:disabled)")) return !this.disabled&&this.matches(selector.slice(0,-15));
      if(selector.startsWith(".")) return this.classList.contains(selector.slice(1));
      const attr=selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
      if(attr) return Object.hasOwn(this.attributes,attr[1])&&(attr[2]===undefined||this.attributes[attr[1]]===attr[2]);
      return this.tag===selector;
    }
    click() {
      assert.ok(this.isConnected&&!this.disabled,"expected available control "+JSON.stringify(this.attributes));
      this.dispatch("click",{target:this,detail:0});
      this.onclick?.();
    }
  }
  function parse(markup) {
    return Array.from(markup.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi),([,tag,source])=>{
      const attributes=Object.fromEntries(Array.from(source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g),
        ([,key,value])=>[key,value??""]));
      return new Element(tag.toLowerCase(),attributes);
    });
  }
  const document=new Element("document");
  document.innerHTML=read("index.html");
  const panel=document.querySelector("#panel"), field=document.querySelector("#playfield");
  document.body=document.querySelector("body");
  document.documentElement=document.querySelector("html");
  document.scripts=[];
  document.fullscreenElement=null;
  document.getElementById=id=>panel.querySelector("#"+id)??document.querySelector("#"+id);
  Object.defineProperty(document,"activeElement",{get:()=>active});
  const shell=document.querySelector(".shell");
  shell.requestFullscreen=async()=>{document.fullscreenElement=shell;};
  const win=new Element("window");
  const context=vm.createContext({window:win,document,HTMLElement:Element,HTMLButtonElement:Element,
    location:{search:"?debug=1"},URLSearchParams,
    crypto:{getRandomValues(values){values[0]=4212;return values;}},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    matchMedia:query=>({matches:reduced&&query.includes("reduced-motion")}),
    setTimeout(callback){timers.set(++handle,callback);return handle;},
    clearTimeout:id=>timers.delete(id),
    performance:{now:()=>time},requestAnimationFrame(fn){frames.set(++handle,fn);return handle;},
    cancelAnimationFrame:id=>frames.delete(id),
    console:{info(){},error(...args){errors.push(args);}},
    FrostRenderer:class {
      constructor(){renderer=this;}
      draw(){if(this.fail) throw new Error("test render fault");}
    },
    FrostPortrait(){},FrostEquipmentPreview(){}
  });
  for(const file of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses","environment",
    "regions","records","combat","feedback","combat-audio","run-ui","stability"]) vm.runInContext(read(file+".js"),context,{filename:file+".js"});
  const Base=context.FrostCombat.Run;
  context.FrostCombat.Run=class extends Base {constructor(...args){super(...args);run=this;}};
  vm.runInContext(read("main.js"),context,{filename:"main.js"});
  function frame(count=1) {
    for(let i=0;i<count;i++) {
      assert.equal(frames.size,1,"exactly one frame scheduled");
      const [id,callback]=[...frames][0];
      frames.delete(id);
      callback(time+=33);
    }
  }
  const click=id=>document.getElementById(id).click();
  const menu=id=>panel.querySelector('[data-ui="'+id+'"]').click();
  const key=code=>win.dispatch("keydown",{code,repeat:false,preventDefault(){}});
  const snapshot=()=>context.FrostDebug.snapshot();
  const start=mode=>{click("start");menu(mode);menu("begin");};
  const inputOpen=()=>{
    assert.equal(snapshot().inputLocked,false);
    assert.equal(field.inert,false);
  };
  function completeEncounter() {
    run.pending=[];
    run.enemies=[];
    run.shots=[];
    run.hazard=null;
    run.mutationHazards=[];
    run.runWave=run.waves;
    frame();
  }
  function claim() {
    const previous=run.offer;
    panel.querySelector(".reward-card").click();
    const stale=document.getElementById("reward-confirm");
    stale.click();
    assert.equal(run.offer,null);
    assert.notEqual(previous,null);
    const crowns=run.inventory.crowns;
    stale.dispatch("click");
    assert.equal(run.inventory.crowns,crowns);
  }
  return {frame,click,menu,key,snapshot,start,inputOpen,completeEncounter,claim,panel,context,win,
    renderer,storage,errors,frames,timers,get run(){return run;}};
}

test("100 pause and inventory cycles, reward claim, dialogue and shop resume the real UI loop", {timeout:5000},()=>{
  const game=fixture();
  game.start("story");
  game.click("enter-room");
  game.frame();
  for(let count=0;count<100;count++) {
    game.key("KeyP");
    assert.equal(game.snapshot().state,"PAUSED");
    game.click("pause-pack");
    assert.equal(game.snapshot().overlay,"inventory");
    game.menu("back");
    assert.equal(game.snapshot().state,"PAUSED");
    game.click("resume");
    game.inputOpen();
    game.frame();
  }
  game.completeEncounter();
  assert.equal(game.snapshot().state,"REWARD_SELECTION");
  game.claim();
  game.inputOpen();
  Object.assign(game.run.player,game.context.FrostRegions.GATE);
  game.frame();
  game.click("enter-room");
  Object.assign(game.run.player,game.context.FrostWorld.NPC);
  game.key("KeyF");
  assert.equal(game.snapshot().state,"DIALOGUE");
  game.menu("back");
  game.inputOpen();
  game.key("KeyF");
  game.menu("shop");
  assert.equal(game.snapshot().overlay,"shop");
  game.menu("back");
  game.inputOpen();
  game.win.dispatch("blur");
  assert.equal(game.snapshot().state,"PAUSED");
  game.key("KeyP");
  const time=game.run.time;
  game.frame(10);
  assert.ok(game.run.time>time);
  assert.equal(game.errors.length,0);
});

test("a fatal frame provides a diagnostic and only returns to title after explicit input", {timeout:5000},()=>{
  const game=fixture();
  game.start("story");
  game.click("enter-room");
  game.frame();
  const old=game.run;
  const crowns=old.inventory.crowns;
  game.renderer.fail=true;
  game.frame();
  assert.equal(game.snapshot().state,"ERROR");
  assert.equal(game.frames.size,0);
  assert.match(game.errors[0][0],/FB-RENDER/);
  assert.equal(game.run,old);
  assert.equal(old.inventory.crowns,crowns);
  assert.equal(old.result,undefined);
  assert.equal(game.storage.has("frostbound.records.v2"),false);
  game.renderer.fail=false;
  game.click("failure-home");
  game.frame(3);
  assert.equal(game.snapshot().state,"TITLE");
  game.start("story");
  game.click("enter-room");
  game.frame();
  assert.notEqual(game.run,old);
  assert.equal(game.run.inventory.crowns,crowns);
  assert.equal(game.errors.length,1);
});

test("100 rapid room transitions use fresh callbacks and result screens clean up", {timeout:5000},()=>{
  const game=fixture();
  game.frame(2);
  let transitions=0;
  while(transitions<100) {
    game.start("story");
    for(let rooms=0;rooms<20;rooms++) {
      assert.equal(game.snapshot().state,"ROOM_TRANSITION");
      const oldRoom=game.run.room;
      const begin=game.panel.querySelector("#enter-room");
      begin.click();
      if(game.run.remaining) game.completeEncounter();
      if(game.run.result) {
        assert.equal(game.snapshot().state,"VICTORY");
        assert.equal(game.run.enemies.length,0);
        game.click("result-home");
        break;
      }
      if(game.run.offer) game.claim();
      Object.assign(game.run.player,game.context.FrostRegions.GATE);
      game.frame();
      if(game.snapshot().state==="ROUTE_SELECTION") game.panel.querySelector("[data-path]").click();
      assert.notEqual(game.run.room,oldRoom);
      const saved=game.snapshot();
      begin.dispatch("click");
      assert.equal(game.snapshot().state,saved.state);
      assert.equal(game.snapshot().room,saved.room);
      transitions++;
    }
  }
  assert.ok(transitions>=100);
  assert.equal(game.errors.length,0);
});

test("the prologue completes if animationend never arrives and ignores a late completion", {timeout:5000},()=>{
  const game=fixture(false);
  game.start("story");
  assert.equal(game.snapshot().state,"INTRO");
  assert.equal(game.timers.size,1);
  const timeout=[...game.timers.values()][0];
  timeout();
  assert.equal(game.snapshot().state,"ROOM_TRANSITION");
  const run=game.run;
  timeout();
  assert.equal(game.run,run);
  assert.equal(game.timers.size,0);
});
