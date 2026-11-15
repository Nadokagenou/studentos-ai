(() => {
  "use strict";
  const languages=["en","th"];
  const storageKey="frostbound.language.v1";
  const messages={
    "orientation.title":["Rotate your device to play","หมุนหน้าจอเพื่อเริ่มการต่อสู้"],
    "orientation.help":["FROSTBOUND is designed for landscape gameplay.","FROSTBOUND ออกแบบมาเพื่อการเล่นแนวนอน"],
    "orientation.continue":["Continue in Portrait","เล่นในแนวตั้งต่อ"],
    "controls.language":["Language","ภาษา"],
    "fullscreen.unavailable":["Fullscreen is unavailable in this browser. The game fills the available window.","เบราว์เซอร์นี้เปิดเต็มจอไม่ได้ เกมจะใช้พื้นที่หน้าต่างที่มีอยู่"],
    "hud.stage":["Stage {n}","ด่าน {n}"],
  };
  const regionSubtitles={
    "The Forgotten Outpost":"ด่านชายแดนที่ถูกลืม",
    "Hollowpine Forest":"ป่าสนไร้แสง",
    "Crystal Depths":"ถ้ำผลึกใต้พิภพ",
    "The Silent Capital":"นครหลวงไร้เสียง",
    "The Frozen Throne":"บัลลังก์เยือกแข็ง",
  };
  let locale="en", documentRoot, storage;
  const records=new WeakMap(), cached=new Map();
  const normalize=value=>value.replaceAll("’","'").replace(/\s+/g," ").trim();
  const entries=[...Object.values(messages),...globalThis.FrostThai.trim().split("\n").map(line=>line.split("\t"))];
  const phrases=new Map(), patterns=[];
  const wantsNumber=/^(n\d*|amount|count)$/;
  const regexEscape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  for(const [source,target] of entries) {
    const key=normalize(source);
    if(!key.includes("{")) {phrases.set(key,target);continue;}
    const names=[];
    const matcher=key.split(/(\{\w+\})/).map(part=>{
      if(!part.startsWith("{")) return regexEscape(part);
      const name=part.slice(1,-1);names.push(name);
      return wantsNumber.test(name)?"([+-]?\\d+(?:[.,]\\d+)*)":"(.+?)";
    }).join("");
    const first=key.split("{")[0];
    patterns.push({matcher:new RegExp("^"+matcher+"$"),first,names,target});
  }
  function interpolate(template,params) {
    return template.replace(/\{(\w+)\}/g,(_,name)=>params[name]??"");
  }
  function t(key, params={}) {
    const pair=messages[key];
    return pair?interpolate(pair[locale==="th"?1:0]??pair[0],params):"";
  }
  function lookup(key,depth=0) {
    if(depth>6||!key) return key;
    const exact=phrases.get(key);
    if(exact!==undefined) return exact;
    for(const {matcher,first,names,target} of patterns) {
      if(!key.startsWith(first)) continue;
      const match=matcher.exec(key);
      if(!match) continue;
      return interpolate(target,Object.fromEntries(names.map((name,index)=>[name,lookup(match[index+1],depth+1)])));
    }
    for(const [separator,join] of [[/ · /," · "], [/(?<=[.!?]) (?=[A-Z“])/," "], [/ \/ (?=[A-Za-z+])/," / "]]) {
      const parts=key.split(separator);
      if(parts.length===1) continue;
      const translated=parts.map(part=>lookup(part,depth+1));
      if(translated.some((part,i)=>part!==parts[i]))
        return translated.join(join);
    }
    return key;
  }
  function translate(value) {
    if(locale!=="th"||typeof value!=="string"||!/[a-z]/i.test(value)) return value;
    const key=normalize(value);
    if(!cached.has(key)) {
      if(cached.size>=768) cached.delete(cached.keys().next().value);
      cached.set(key,lookup(key));
    }
    const result=cached.get(key);
    if(result===key) return value;
    return value.match(/^\s*/)[0]+result+value.match(/\s*$/)[0];
  }
  const attributes=["aria-label","title","alt","placeholder","data-label"];
  const omit="script,style,pre,[data-no-translate]";
  function localizeRecord(node,field,current,write) {
    let fields=records.get(node);
    if(!fields) {fields=new Map();records.set(node,fields);}
    const previous=fields.get(field);
    const source=previous?.rendered===current?previous.source:current;
    const rendered=translate(source);
    fields.set(field,{source,rendered});
    if(current!==rendered) write(rendered);
  }
  function localize(node) {
    if(node.nodeType===3) {
      if(!node.parentElement?.closest(omit)&&/[a-z\u0e00-\u0e7f]/i.test(node.data))
        localizeRecord(node,"text",node.data,value=>{node.data=value;});
      return;
    }
    if(node.nodeType!==1||node.closest(omit)) return;
    for(const attribute of attributes) {
      const value=node.getAttribute(attribute);
      if(value!==null) localizeRecord(node,attribute,value,text=>node.setAttribute(attribute,text));
    }
    for(const child of node.childNodes) localize(child);
  }
  function setText(element,source) {
    const old=element.firstChild&&records.get(element.firstChild)?.get("text");
    if(old&&old.source===source&&old.rendered===element.firstChild.data) return;
    const text=translate(source);
    if(element.textContent===text&&element.firstChild?.nodeType===3) {
      const node=element.firstChild, fields=records.get(node)??new Map();
      fields.set("text",{source,rendered:text});
      records.set(node,fields);
      return;
    }
    element.textContent=text;
    if(element.firstChild) records.set(element.firstChild,new Map([["text",{source,rendered:text}]]));
  }
  function setAttribute(element,attribute,source) {
    const previous=records.get(element)?.get(attribute);
    if(previous&&previous.source===source&&previous.rendered===element.getAttribute(attribute)) return;
    const rendered=translate(source);
    if(element.getAttribute(attribute)!==rendered) element.setAttribute(attribute,rendered);
    const fields=records.get(element)??new Map();
    fields.set(attribute,{source,rendered});
    records.set(element,fields);
  }
  const pick=value=>languages.find(language=>language===String(value??"").toLowerCase().split("-")[0]);
  function setLanguage(value) {
    const next=pick(value);
    if(!next||next===locale) return locale;
    locale=next;
    try {storage?.setItem(storageKey,locale);} catch {}
    if(documentRoot) {
      documentRoot.lang=locale;
      localize(documentRoot);
    }
    return locale;
  }
  function init(root,preference,system=[]) {
    storage=preference;
    let saved;
    try {saved=storage?.getItem(storageKey);} catch {}
    locale=pick(saved)??system.map(pick).find(Boolean)??"en";
    if(!root) return;
    documentRoot=root.documentElement;
    documentRoot.lang=locale;
    localize(documentRoot);
    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations) {
        if(mutation.type==="attributes") {
          const node=mutation.target, attribute=mutation.attributeName;
          const value=node.getAttribute(attribute);
          if(value!==null&&!node.closest(omit))
            localizeRecord(node,attribute,value,text=>node.setAttribute(attribute,text));
        } else if(mutation.type==="characterData") localize(mutation.target);
        else for(const node of mutation.addedNodes) if(node.isConnected) localize(node);
      }
    });
    observer.observe(documentRoot,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  }
  globalThis.FrostI18n={init,t,translate,localize,setText,setAttribute,setLanguage,getLanguage:()=>locale,
    regionSubtitle:name=>regionSubtitles[name]??"",getAvailableLanguages:()=>languages.slice()};
})();
