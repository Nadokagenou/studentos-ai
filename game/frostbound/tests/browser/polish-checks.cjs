const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

function polishChecks(output,baseline) {
  const report={screens:{},docks:[],fonts:{},canvas:[],switches:[]};
  async function inspect(page,name,scope) {
    const problems=await page.evaluate(scope=>{
      const root=document.querySelector(scope);
      if(!root) throw Error("Missing layout scope "+scope);
      const visible=element=>element&&!element.closest("[hidden],.sr-only,[aria-hidden=true]")&&element.getClientRects().length;
      const problems=[];
      const describe=element=>element.id||element.className||element.tagName;
      for(const element of root.querySelectorAll("button,.panel,.menu-column,.item-inspection,.reward-card,.subtitle,.lesson,.hud-toast,.combat-notice,.encounter,#phase,.intro-caption")) {
        if(!visible(element)) continue;
        if(element.scrollWidth>element.clientWidth+2) problems.push(describe(element)+" has horizontal overflow");
        if(element.matches("button,.subtitle,.hud-toast,.combat-notice")&&element.scrollHeight>element.clientHeight+2)
          problems.push(describe(element)+" has vertical clipping");
      }
      const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      for(let node=walk.nextNode();node;node=walk.nextNode()) {
        if(!/[a-zก-๙]/i.test(node.data)||!visible(node.parentElement)) continue;
        const owner=node.parentElement.closest("button,.reward-card,.menu-column,.subtitle,.lesson,.hud-toast,.encounter,.boss-hud,.intro-caption");
        if(!owner||!owner.clientWidth) continue;
        const rect=owner.getBoundingClientRect();
        const range=document.createRange();
        range.selectNodeContents(node);
        if([...range.getClientRects()].some(line=>line.left<rect.left-2||line.right>rect.right+2))
          problems.push(describe(owner)+" clips text: "+node.data.trim().slice(0,80));
      }
      return [...new Set(problems)];
    },scope);
    report.screens[name]=problems;
  }

  async function docks(page,name,{safeArea=false}={}) {
    const problems=await page.evaluate(safeArea=>{
      const field=document.querySelector("#playfield");
      const margins=safeArea?{top:18,left:32,right:38,bottom:16}:null;
      if(margins) for(const [edge,value] of Object.entries(margins)) field.style.setProperty("--landscape-"+edge,value+"px");
      try {
        const selectors=["#stick",".touch-actions button","#subtitle","#toast","#interact","#lesson","#boss-hud","#combat-notice","#safe-status","#gate-guide",".hud .encounter","#announcement"];
        const views=[...field.querySelectorAll(selectors.join(","))].filter(node=>node.getClientRects().length&&
          (!node.matches("#announcement")||node.textContent.trim())).map(node=>[node.id||node.dataset.action||"encounter",node.getBoundingClientRect()]);
        const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
        const result=[];
        for(let i=0;i<views.length;i++){
          const [name,r]=views[i];
          const edges=margins??{top:0,left:0,right:0,bottom:0};
          if(r.left<edges.left-1||r.top<edges.top-1||r.right>innerWidth-edges.right+1||r.bottom>innerHeight-edges.bottom+1)
            result.push(name+" leaves the safe area");
          for(const [other,b] of views.slice(i+1)) if(overlaps(r,b)) result.push(name+" overlaps "+other);
        }
        return result;
      } finally {
        if(margins) for(const edge of Object.keys(margins)) field.style.removeProperty("--landscape-"+edge);
      }
    },safeArea);
    report.docks.push({name,safeArea,problems});
  }

  async function font(page,name,selector,family) {
    await page.evaluate(()=>document.fonts.ready);
    const cdp=await page.context().newCDPSession(page);
    try {
      await cdp.send("DOM.enable");
      await cdp.send("CSS.enable");
      const {root:{nodeId}}=await cdp.send("DOM.getDocument");
      const selected=await cdp.send("DOM.querySelector",{nodeId,selector});
      const {fonts}=await cdp.send("CSS.getPlatformFontsForNode",selected);
      report.fonts[name]=fonts;
      if(!baseline) {
        if(family) assert(fonts.some(face=>face.isCustomFont&&face.familyName===family&&face.glyphCount>0),name+": "+JSON.stringify(fonts));
        else assert(fonts.length&&fonts.every(face=>!face.isCustomFont),name+" should use installed fallback");
      }
    } finally {await cdp.detach();}
  }

  async function language(page,screen,selector,thai,english) {
    const before=await page.locator(selector).innerText();
    assert.match(before,thai,screen);
    await page.evaluate(()=>{window.qaSameRun=run;FrostI18n.setLanguage("en");});
    assert.match(await page.locator(selector).innerText(),english,screen);
    await page.evaluate(()=>FrostI18n.setLanguage("th"));
    assert.equal(await page.locator(selector).innerText(),before,screen);
    assert(await page.evaluate(()=>run===window.qaSameRun),screen+" preserved run");
    report.switches.push(screen);
  }

  async function canvas(page) {
    const result=await page.evaluate(()=>{
      const ctx=drawGame.c, original=ctx.fillText, drawn=[];
      ctx.fillText=function(text,x,y){
        if(/Perfect Parry|ปัดป้องสมบูรณ์แบบ/i.test(text)){
          const m=this.measureText(text), t=this.getTransform(), pad=this.lineWidth/2;
          drawn.push({text,font:this.font,inside:t.a*(x-m.actualBoundingBoxLeft-pad)+t.e>=0&&
            t.a*(x+m.actualBoundingBoxRight+pad)+t.e<=this.canvas.width&&t.d*(y-m.actualBoundingBoxAscent-pad)+t.f>=0&&
            t.d*(y+m.actualBoundingBoxDescent+pad)+t.f<=this.canvas.height});
        }
        return original.call(this,text,x,y);
      };
      const saved=run.fx;
      try {
        const word=(x,y)=>({kind:"word",label:"PERFECT PARRY",x,y,age:.65,duration:1,color:"#fff"});
        run.fx=[word(5,5),word(955,5)];
        for(const lang of ["en","th"]){
          FrostI18n.setLanguage(lang);
          drawGame.draw(run,{quality:"high",reduced:true,damageNumbers:true});
        }
      } finally {ctx.fillText=original;run.fx=saved;}
      return drawn;
    });
    assert.equal(result.length,4);
    assert(result.some(label=>label.text==="ปัดป้องสมบูรณ์แบบ")&&result.some(label=>label.text==="PERFECT PARRY"));
    if(!baseline) assert(result.every(label=>label.inside&&label.font.includes("Noto Sans Thai")),JSON.stringify(result));
    report.canvas=result;
  }

  function finish(strict) {
    fs.writeFileSync(path.join(output,"polish.json"),JSON.stringify(report,null,2)+"\n");
    if(strict&&!baseline){
      const problems=[...Object.entries(report.screens).flatMap(([screen,issues])=>issues.map(issue=>screen+": "+issue)),
        ...report.docks.flatMap(({name,problems})=>problems.map(problem=>name+": "+problem))];
      assert.deepEqual(problems,[],"Text overflow or overlay collision");
    }
  }
  return {inspect,docks,font,language,canvas,finish};
}

module.exports={polishChecks};
