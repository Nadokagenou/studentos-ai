(() => {
  "use strict";
  const languages=["en","th"];
  const storageKey="frostbound.language.v1";
  const messages={
    "title.page":["FROSTBOUND v4.5.2 | The Final Trial","FROSTBOUND v4.5.2 | บททดสอบสุดท้าย"],
    "title.version":["The Final Trial · v4.5.2 Team Beta","บททดสอบสุดท้าย · v4.5.2 Team Beta"],
    "title.motto":["Master the Frost. Win by Skill.","ฝ่าเหมันต์ด้วยฝีมือ"],
    "title.new":["New Run","เริ่มการเดินทาง"],
    "title.best":["Best score","คะแนนสูงสุด"],
    "controls.modes":["Game Modes","โหมดเกม"],
    "controls.chooseMode":["Choose a game mode","เลือกโหมดเกม"],
    "controls.training":["Training","ฝึกฝน"],
    "controls.records":["Records","สถิติ"],
    "controls.settings":["Settings","ตั้งค่า"],
    "controls.credits":["Credits","เครดิต"],
    "controls.back":["Back","ย้อนกลับ"],
    "controls.begin":["Begin run","เริ่มรอบ"],
    "controls.inventory":["Inventory","กระเป๋า"],
    "controls.explore":["Explore","สำรวจ"],
    "controls.encounter":["Begin encounter","เริ่มการต่อสู้"],
    "controls.retry":["Retry","ลองใหม่"],
    "controls.home":["Title screen","หน้าแรก"],
    "controls.guide":["Team Beta guide and feedback","คู่มือและแบบรายงาน Team Beta"],
    "touch.light":["Strike","โจมตี"],
    "touch.dash":["Dash","พุ่ง"],
    "touch.parry":["Parry","ปัด"],
    "orientation.title":["Rotate your device to play","หมุนหน้าจอเพื่อเริ่มการต่อสู้"],
    "orientation.help":["FROSTBOUND is designed for landscape gameplay.","FROSTBOUND ออกแบบมาเพื่อการเล่นแนวนอน"],
    "orientation.continue":["Continue in Portrait","เล่นในแนวตั้งต่อ"],
    "controls.language":["Language","ภาษา"],
    "fullscreen.unavailable":["Fullscreen is unavailable in this browser. The game fills the available window.","เบราว์เซอร์นี้เปิดเต็มจอไม่ได้ เกมจะใช้พื้นที่หน้าต่างที่มีอยู่"],
    "hud.stage":["Stage {n}","ด่าน {n}"],
    "hud.stageRoom":["{mode} · Stage {n} · {type}","{mode} · ด่าน {n} · {type}"],
    "hud.stageSafe":["Stage {n} · Safe","ด่าน {n} · ปลอดภัย"],
    "hud.stageWave":["Stage {n} · Wave {wave}/{total}","ด่าน {n} · ระลอก {wave}/{total}"],
    "hud.wave":["Wave {n}","ระลอก {n}"],
    "hud.singleFoe":["{n} foe · {time}","ศัตรู {n} ตัว · {time}"],
    "hud.foes":["{n} foes · {time}","ศัตรู {n} ตัว · {time}"],
    "hud.exit":["Exit unlocked","ปลดล็อกทางออกแล้ว"],
    "hud.sentinel":["Practice sentinel","หุ่นผู้พิทักษ์ฝึกซ้อม"],
    "hud.phase":["Phase {phase}","เฟส {phase}"],
    "hud.phaseTell":["Phase {phase} · {tell}","เฟส {phase} · {tell}"],
    "hud.guardian":["Optional guardian","ผู้พิทักษ์ทางเลือก"],
    "hud.guardianTell":["Optional guardian · {tell}","ผู้พิทักษ์ทางเลือก · {tell}"],
    "hud.prompt":["{action}{hint}","{action}{hint}"],
    "hud.inspect":["Inspect {name}{hint}","สำรวจ {name}{hint}"],
    "hud.duel":["Optional duel · {name}{hint}","ท้าดวล {name}{hint}"],
    "hud.potionEmpty":["Quick slot empty. Assign a potion in Inventory.","ช่องลัดว่างอยู่ เลือกยาใส่ช่องลัดได้ในกระเป๋า"],
    "hud.potionDepleted":["{name} depleted. Reassign in a safe area.","{name} หมดแล้ว จัดช่องลัดใหม่ได้ในพื้นที่ปลอดภัย"],
    "hud.drink":["Drink {name}","ดื่ม {name}"],
    "hud.ready":["{icon} Ready","{icon} พร้อมใช้"],
    "hud.seconds":["{icon} {seconds}s","{icon} {seconds} วิ"],
    "hud.actionSeconds":["{action} {seconds}s","{action} {seconds} วิ"],
    "hud.kingLine":["Frozen King · {line}","The Frozen King · {line}"],
    "hud.elite":["{name} Elite · {detail}","ศัตรูชั้นยอด · {name} · {detail}"],
    "event.elite":["{result} {name} Elite. {detail}","{result} ศัตรูชั้นยอด · {name} · {detail}"],
    "reward.heading":["Choose your reward","เลือกรางวัล"],
    "reward.destination":["Choose one reward, then prepare for {place}.","เลือกรางวัลหนึ่งอย่าง แล้วเตรียมตัวสำหรับ {place}"],
    "reward.refill":["Claiming any card refills Stamina.","รับการ์ดใบใดก็เติมความอึดเต็ม"],
    "reward.heal":["Claiming any card also restores up to {n} HP and refills Stamina.","รับการ์ดใบใดก็ฟื้นพลังชีวิตได้ถึง {n} และเติมความอึดเต็ม"],
    "reward.replaces":["Replaces {name} if confirmed","ยืนยันเพื่อแทนที่ {name}"],
    "reward.rank":["Rank {from} → {to}","ระดับ {from} → {to}"],
    "reward.item":["Adds to Inventory · No auto-equip","เก็บเข้ากระเป๋า · สวมใส่เองเมื่อพร้อม"],
    "reward.itemRank":["Rank {rank} · Adds to Inventory · No auto-equip","ระดับ {rank} · เก็บเข้ากระเป๋า · สวมใส่เองเมื่อพร้อม"],
    "reward.currentEffect":["Current: {effect}","ผลปัจจุบัน: {effect}"],
    "reward.cost":["{cost} Stamina · {seconds}s cooldown","ใช้ความอึด {cost} · พักสกิล {seconds} วินาที"],
    "reward.keepSkill":["{cost} Stamina · {seconds}s cooldown. Choose a different reward to keep it.","ใช้ความอึด {cost} · พักสกิล {seconds} วินาที เลือกรางวัลอื่นเพื่อเก็บสกิลเดิม"],
    "reward.acquired":["{name} acquired","ได้รับ {name}"],
    "route.region":["Both paths lead onward through {region}.","ทั้งสองเส้นทางพาเดินหน้าผ่าน {region}"],
    "event.vitals":["{hp} HP · {crowns} Frost Crowns","พลังชีวิต {hp} · {crowns} Frost Crowns"],
    "equipment.compared":["Compared with {name}","เทียบกับ {name}"],
    "equipment.preview":["{name} preview","ภาพตัวอย่าง {name}"],
    "equipment.attacks":["{light} light / {heavy} heavy","เบา {light} / หนัก {heavy}"],
    "equipment.perSecond":["{value}/s","{value}/วิ"],
    "equipment.milliseconds":["{value} ms","{value} มิลลิวินาที"],
    "equipment.impact":[" · {change}"," · {change}"],
    "equipment.replaceArmor":["Equipped · Select another armor to replace it.","สวมอยู่ · เลือกเกราะชิ้นอื่นเพื่อเปลี่ยน"],
    "equipment.replaceWeapon":["Equipped · Select another weapon to replace it.","สวมอยู่ · เลือกอาวุธชิ้นอื่นเพื่อเปลี่ยน"],
    "equipment.skills":["Skills · {n} passive","สกิล · ติดตัว {n}"],
    "equipment.potions":["Potions {count}/{limit}","ยา {count}/{limit}"],
    "equipment.skillCost":["{cost} Stamina · {seconds}s","ใช้ความอึด {cost} · {seconds} วินาที"],
    "shop.crowns":["{count} Frost Crowns","{count} Frost Crowns"],
    "shop.stock":["{count} in stock","เหลือ {count} ชิ้น"],
    "shop.owned":["{count} owned","มี {count} ชิ้น"],
    "shop.price":["{action} · {price} FC","{action} · {price} FC"],
    "shop.purchase":["Buy {name} for {price} Frost Crowns?","ซื้อ {name} ด้วย {price} Frost Crowns หรือไม่"],
    "result.loss":["The winter claims another wanderer. Final blow · {cause}","เหมันต์พรากผู้พเนจรไปอีกคน · การโจมตีสุดท้าย: {cause}"],
    "result.seed":["Run seed {n}","เลข seed ของรอบ {n}"],
    "result.rank":["Rank {rank}","ระดับ {rank}"],
    "guide.page":["FROSTBOUND v4.5.2 | Team Beta Guide","FROSTBOUND v4.5.2 | คู่มือ Team Beta"],
    "guide.title":["Playtest FROSTBOUND","ทดสอบ FROSTBOUND"],
    "guide.subtitle":["Team Beta guide for the SOS team","คู่มือ Team Beta สำหรับทีม SOS"],
    "guide.play":["Open game ↗","เปิดเกม ↗"],
    "guide.start":["Getting started","เริ่มเล่น"],
    "guide.chooseLanguage":["Choose Thai or English on the title screen or in Settings. In Training, practice moving, striking, dashing and parrying.",
      "เลือกภาษาไทยหรืออังกฤษที่หน้าแรกหรือในตั้งค่า แล้วลองฝึกเดิน ฟัน พุ่ง และปัดป้องให้ครบ"],
    "guide.story":["Start Story Run and play at your own pace. Try collecting a reward and changing gear in a safe area.",
      "เริ่มโหมดเนื้อเรื่อง เล่นตามปกติ ลองเก็บรางวัลและเปลี่ยนอุปกรณ์เมื่ออยู่ในพื้นที่ปลอดภัย"],
    "guide.otherModes":["Try Hardcore or Boss Rush if you like. Temporary gear is lost when a run ends. Settings and records stay in the same browser.",
      "ลอง Hardcore หรือ Boss Rush ได้ตามสะดวก เมื่อจบหรือออกจากรอบ อุปกรณ์ชั่วคราวจะหายไป ส่วนการตั้งค่าและสถิติจะอยู่ในเบราว์เซอร์เดิม"],
    "guide.testers":["Copy the short report below when you finish. Start with three to eight people across desktop and mobile, including new players and action-game players.",
      "กรอกแบบรายงานสั้น ๆ ด้านล่าง ทีมทดสอบรอบแรกควรมี 3–8 คน ทั้งผู้เล่นใหม่ ผู้เล่นเกมแอ็กชัน และผู้ใช้มือถือกับเดสก์ท็อป"],
    "guide.desktop":["Desktop","เดสก์ท็อป"],
    "guide.desktopControls":["WASD or arrows to move · J/K light/heavy · Space dash · Q parry · E active skill · R potion · F interact · I inventory",
      "WASD หรือปุ่มลูกศรเพื่อเดิน · J/K ฟันเบา/หนัก · Space พุ่ง · Q ปัดป้อง · E สกิล · R ดื่มยา · F โต้ตอบ · I กระเป๋า"],
    "guide.mobile":["Mobile","มือถือ"],
    "guide.mobileControls":["Play in landscape. Move with the left stick and use the buttons on the right. You can hold the stick while using an action. Skill and potion buttons only activate when available.",
      "หมุนเครื่องแนวนอน ใช้จอยซ้ายและปุ่มขวา กดจอยพร้อมปุ่มต่อสู้ได้ ปุ่มสกิลและยาจะเปิดเมื่อมีของและพร้อมใช้"],
    "guide.devices":["Checks on physical phones","เช็กบนมือถือเครื่องจริง"],
    "guide.cutouts":["Open in Safari on iPhone or Chrome on Android. Check that cutouts and navigation bars leave buttons reachable and that Pause works.",
      "เปิดบน Safari ใน iPhone หรือ Chrome ใน Android ตรวจว่าปุ่มไม่ชิดรอยบากหรือแถบนำทาง และกดพักเกมได้"],
    "guide.multitouch":["While moving, try light, heavy, dash, parry, skill and potion. Release both fingers and try moving again.",
      "ลองเดินพร้อมฟันเบา ฟันหนัก พุ่ง ปัดป้อง สกิล และยา จากนั้นปล่อยนิ้วพร้อมกันแล้วลองจับจอยใหม่"],
    "guide.rotate":["Rotate landscape → portrait → landscape during combat and while shopping. Check that the same room and menu return.",
      "หมุนแนวนอน → แนวตั้ง → แนวนอน ระหว่างต่อสู้และขณะซื้อของ ตรวจว่ากลับมาที่ห้องและเมนูเดิม"],
    "guide.audio":["Try entering and leaving fullscreen when supported. Listen for attacks over ambience and check that the current language is easy to read.",
      "ลองเปิดและออกจากเต็มจอถ้าเครื่องรองรับ ฟังสัญญาณโจมตีในฉากที่มีเสียงบรรยากาศ และตรวจว่าข้อความอ่านง่าย"],
    "guide.feedback":["Feedback and bug reports","ส่งผลทดสอบและแจ้งบั๊ก"],
    "guide.share":["Copy the report to the usual SOS team channel or","คัดลอกแบบรายงานไปส่งในช่องเดิมของทีม SOS หรือ"],
    "guide.issue":["open a GitHub Issue","เปิดรายการแจ้งปัญหาบน GitHub"],
    "guide.privacy":["GitHub Issues are public. Remove real names, student information and account details from text and images before submitting.",
      "รายการแจ้งปัญหาบน GitHub เป็นสาธารณะ กรุณาตัดชื่อจริง ข้อมูลนักเรียน และข้อมูลบัญชีออกจากข้อความหรือภาพก่อนส่ง"],
    "guide.copy":["Report template","แบบรายงานสำหรับคัดลอก"],
    "guide.report":[`Game version: FROSTBOUND v4.5.2 Team Beta
Device / OS / browser:
Mode / region / room:
Run seed (if available, on the results screen):
Did the game launch and controls work?
Control ease (1–5):
Difficulty (easy / about right / hard):
Enjoyment (1–5):
Favorite weapon or mechanic:
What happened / what did you expect?
Steps to reproduce / screenshot (optional):
What would you change first?`,`เวอร์ชันเกม: FROSTBOUND v4.5.2 Team Beta
อุปกรณ์ / ระบบปฏิบัติการ / เบราว์เซอร์:
โหมด / ภูมิภาค / ห้อง:
เลข seed (ถ้ามี จากหน้าผลการเล่น):
เกมเปิดและควบคุมได้ปกติไหม:
ความง่ายในการควบคุม (1–5):
ความยาก (ง่าย / พอดี / ยาก):
ความสนุก (1–5):
ระบบหรืออาวุธที่ชอบที่สุด:
สิ่งที่เกิดขึ้น / ผลที่คาดไว้:
ขั้นตอนให้เกิดซ้ำ / ภาพประกอบ (ถ้ามี):
สิ่งที่อยากให้แก้มากที่สุด:`],
  };
  const regionSubtitles={
    "The Forgotten Outpost":"ด่านชายแดนที่ถูกลืม",
    "Hollowpine Forest":"ป่าสนไร้แสง",
    "Crystal Depths":"ถ้ำผลึกใต้พิภพ",
    "The Silent Capital":"นครหลวงไร้เสียง",
    "The Frozen Throne":"บัลลังก์เยือกแข็ง",
  };
  let locale="th", documentRoot, storage, observer;
  const records=new WeakMap(), bindings=new WeakMap(), cached=new Map(), missingKeys=new Set();
  const listeners=new Set();
  const normalize=value=>value.replaceAll("’","'").replace(/\s+/g," ").trim();
  const shared=["orientation.title","orientation.help","orientation.continue","controls.language","fullscreen.unavailable","hud.stage"];
  const entries=[...shared.map(key=>messages[key]),...globalThis.FrostThai.trim().split("\n").map(line=>line.split("\t"))];
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
    if(!pair?.[1]) missingKeys.add(key);
    if(!pair) return "";
    const localized=locale==="th"?Object.fromEntries(Object.entries(params).map(([name,value])=>[name,translate(value)])):params;
    return interpolate(locale==="th"?pair[1]??pair[0]:pair[0],localized);
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
  const keyAttribute="data-i18n-key", paramsAttribute="data-i18n-params";
  const boundSelector="["+keyAttribute+"]";
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function markup(key,params={}) {
    return '<span '+keyAttribute+'="'+escape(key)+'" '+paramsAttribute+'="'+escape(JSON.stringify(params))+'">'+escape(t(key,params))+'</span>';
  }
  function renderBinding(node,field,binding) {
    if(binding.language!==locale) {
      binding.text=t(binding.key,binding.params);
      binding.language=locale;
    }
    const text=binding.text;
    if(field==="text") {
      if(node.textContent!==text) node.textContent=text;
    } else if(node.getAttribute(field)!==text) node.setAttribute(field,text);
  }
  function setMessage(node,key,params={},field="text") {
    let fields=bindings.get(node);
    if(!fields) {fields=new Map();bindings.set(node,fields);}
    let binding=fields.get(field);
    if(binding?.key!==key||!sameParams(binding.params,params)) {
      binding={key,params};
      fields.set(field,binding);
    }
    renderBinding(node,field,binding);
  }
  function sameParams(before,after) {
    const names=Object.keys(after);
    return names.length===Object.keys(before).length&&names.every(name=>Object.hasOwn(before,name)&&before[name]===after[name]);
  }
  function clearBinding(node,field) {
    bindings.get(node)?.delete(field);
  }
  function localizeRecord(node,field,current,write) {
    let fields=records.get(node);
    if(!fields) {fields=new Map();records.set(node,fields);}
    const previous=fields.get(field);
    if(previous?.language===locale&&previous.rendered===current) return;
    const source=previous?.rendered===current?previous.source:current;
    const rendered=translate(source);
    fields.set(field,{source,rendered,language:locale});
    if(current!==rendered) write(rendered);
  }
  function localize(node) {
    if(node.nodeType===3) {
      if(!node.parentElement?.closest(omit+","+boundSelector)&&!bindings.get(node.parentElement)?.has("text")&&/[a-z\u0e00-\u0e7f]/i.test(node.data))
        localizeRecord(node,"text",node.data,value=>{node.data=value;});
      return;
    }
    if(node.nodeType!==1||node.closest(omit)) return;
    const fields=bindings.get(node);
    for(const attribute of attributes) {
      if(fields?.has(attribute)) {
        renderBinding(node,attribute,fields.get(attribute));
        continue;
      }
      const value=node.getAttribute(attribute);
      if(value!==null) localizeRecord(node,attribute,value,text=>node.setAttribute(attribute,text));
    }
    if(fields?.has("text")) {
      renderBinding(node,"text",fields.get("text"));
      return;
    }
    const key=node.getAttribute(keyAttribute);
    if(key) {
      setMessage(node,key,JSON.parse(node.getAttribute(paramsAttribute)||"{}"));
      return;
    }
    for(const child of node.childNodes) localize(child);
  }
  function setText(element,source) {
    clearBinding(element,"text");
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
    clearBinding(element,attribute);
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
    if(!next) return locale;
    try {storage?.setItem(storageKey,next);} catch {}
    if(next===locale) return locale;
    locale=next;
    if(documentRoot) {
      documentRoot.lang=locale;
      localize(documentRoot);
    }
    for(const listener of listeners) listener(locale);
    return locale;
  }
  function init(root,preference) {
    observer?.disconnect();
    observer=null;
    storage=preference;
    let saved;
    try {saved=storage?.getItem(storageKey);} catch {}
    locale=pick(saved)??"th";
    documentRoot=root?.documentElement;
    if(!documentRoot) return;
    documentRoot.lang=locale;
    localize(documentRoot);
    observer=new MutationObserver(mutations=>{
      for(const mutation of mutations) {
        if(mutation.type==="attributes") {
          const node=mutation.target, attribute=mutation.attributeName;
          const binding=bindings.get(node)?.get(attribute);
          if(binding) {renderBinding(node,attribute,binding);continue;}
          const value=node.getAttribute(attribute);
          if(value!==null&&!node.closest(omit))
            localizeRecord(node,attribute,value,text=>node.setAttribute(attribute,text));
        } else {
          const owner=mutation.type==="characterData"?mutation.target.parentElement:mutation.target;
          const binding=bindings.get(owner)?.get("text");
          if(binding) renderBinding(owner,"text",binding);
          else if(mutation.type==="characterData") localize(mutation.target);
          else for(const node of mutation.addedNodes) if(node.isConnected) localize(node);
        }
      }
    });
    observer.observe(documentRoot,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  }
  globalThis.FrostI18n={init,t,markup,translate,localize,setText,setMessage,setAttribute,setLanguage,getLanguage:()=>locale,
    onLanguageChange:listener=>listeners.add(listener),missingKeys:()=>[...missingKeys],
    regionSubtitle:name=>regionSubtitles[name]??"",getAvailableLanguages:()=>languages.slice()};
})();
