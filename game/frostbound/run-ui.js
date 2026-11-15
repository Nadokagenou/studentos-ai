(() => {
  "use strict";
  const { ITEMS, LIMIT, buy, resale, priceOf, comparison, strikeRate, getRarity, itemDetails } = FrostItems;
  const { PASSIVES, ACTIVES }=FrostLoot;
  const { MODES, TEXT, DIALOGUE } = FrostWorld;
  const labels = { weapon:"Main weapon", armor:"Chest armor", accessory:"Accessory", potion:"Consumable" };
  const escape = value => String(value ?? "—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const description = item => escape(item.description);
  const itemName = id => ITEMS[id]?.name ?? "Empty";
  const itemTitle = id => '<span class="item-icon" aria-hidden="true">'+ITEMS[id].icon+'</span> '+escape(ITEMS[id].name);
  const closeButton = '<button class="button secondary" data-ui="back">Back</button>';
  const menuHeader = title => '<header class="inventory-header"><h2 id="dialog-title">'+title+'</h2>'+closeButton+'</header>';
  const action = (id,label,primary=false) => '<button class="button '+(primary?"primary":"secondary")+'" data-ui="'+id+'">'+label+'</button>';
  const heading = title => '<h2 id="dialog-title">'+title+'</h2>';
  const group = (...buttons) => '<div class="panel-actions">'+buttons.join("")+'</div>';
  const money = count => '<strong class="money">'+count+' Frost Crowns</strong>';
  const percent = value => Math.round(value*100)+"%";
  const categories = {all:"All",weapon:"Weapons",armor:"Armor",accessory:"Accessories",potion:"Consumables"};
  const rarity = (id,label=getRarity(id)) => '<span class="rarity rarity-'+label.toLowerCase()+'">'+label+'</span>';
  const filterItems = (items,category) => Object.keys(items).filter(id=>category==="all" || ITEMS[id].slot===category);
  const tab = (id,label,selected) => '<button class="small-button" data-ui="'+id+'" aria-pressed="'+selected+'">'+label+'</button>';
  const categoryTabs = selected => '<div class="category-tabs" aria-label="Item categories">'+Object.entries(categories)
    .map(([id,label])=>tab("filter-"+id,label,id===selected)).join("")+'</div>';
  const packItems = inv => {
    const list={...inv.owned};
    for(const id of inv.potions) list[id]=(list[id]??0)+1;
    return list;
  };
  function selectControls(panel, selector) {
    const buttons=[...panel.querySelectorAll(selector)];
    for(const [index,button] of buttons.entries()) button.onkeydown=event=>{
      const step={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[event.key];
      if(!step) return;
      event.preventDefault();
      buttons[(index+step+buttons.length)%buttons.length].focus();
    };
  }

  class UI {
    constructor({open,close,getRun,start,time,provider,refresh,notify}) {
      Object.assign(this,{open,close,getRun,start,time,provider,refresh,notify});
      this.category = "progress";
      this.source = "local";
      this.rankingMode = "story";
      this.recordsVersion=FrostRecords.VERSION;
    }
    show(kind, markup, primary, wide = true) {
      this.panel = this.open(kind,markup,primary,wide);
    }
    wire(handlers) {
      for (const control of this.panel.querySelectorAll("[data-ui]")) {
        control.onclick = () => { if(control.isConnected) handlers[control.dataset.ui]?.(); };
      }
    }
    modes() {
      const cards = ["story","hardcore","boss"].map(id=>{
        const mode = MODES[id];
        return '<button class="technique mode-card" data-ui="'+id+'"><small>'+mode.difficulty+'</small><strong>'+mode.name+'</strong><span>'+mode.description+'</span></button>';
      }).join("");
      this.show("modes",heading("Choose a game mode")+'<p>Every run starts fresh. An active run cannot be saved or resumed after leaving.</p><div class="techniques">'+cards+'</div>'+group(closeButton),".mode-card");
      this.wire({story:()=>this.modeIntro("story"),hardcore:()=>this.modeIntro("hardcore"),boss:()=>this.modeIntro("boss"),back:this.close});
    }
    modeIntro(kind) {
      const details = {
        story:"Follow the lanterns through the borderlands. Eldric trades at safe stops, and lore and hidden supplies wait off the main route.",
        hardcore:"Healing is scarce and waves escalate. Read the shorter tells carefully. Your local record tracks the stage and wave you reach.",
        boss:"Fight the Gatekeeper, the Crystal Warden and the Frozen King. Recover a little between encounters and spend your Crowns at Eldric’s camp."
      };
      const presets = kind==="boss"
        ? '<label class="setting">Weapon preset <select id="boss-preset"><option value="edge">Frost Edge · Balanced</option><option value="fang">Winter Fang · Close range</option><option value="spear">Glacial Spear · Reach</option><option value="great">King’s Greatsword · Posture</option></select></label>'+
        '<label class="setting">Armor preset <select id="boss-armor"><option value="coat">Wanderer’s Coat</option><option value="frostguard">Frostguard Armor</option><option value="plate">Ironbound Plate</option><option value="mantle">Phantom Mantle</option></select></label>' : "";
      this.show("mode-intro",heading(MODES[kind].name)+'<div class="story-objective">'+MODES[kind].difficulty+'</div><p class="section-copy">'+details[kind]+'</p>'+presets+group(action("begin","Begin run",true),closeButton),'[data-ui="begin"]',false);
      this.wire({begin:()=>this.start(kind,kind==="boss"?{weapon:this.panel.querySelector("#boss-preset").value,armor:this.panel.querySelector("#boss-armor").value}:"edge"),back:()=>this.modes()});
    }
    glossary(back) {
      this.show("glossary",heading("Glossary")+'<dl class="controls-list">'+TEXT.glossary.map(([word,translation])=>'<div><dt>'+word+'</dt><dd lang="th">'+translation+'</dd></div>').join("")+'</dl>'+group(closeButton),'[data-ui="back"]');
      this.wire({back});
    }
    credits() {
      this.show("credits",heading("Credits")+'<p>Frostbound is a standalone winter action roguelike. Cover artwork was generated for Frostbound. Character art, environments and effects are drawn in Canvas, with original synthesized music and sound effects.</p>'+group(action("glossary","Glossary"),closeButton),'[data-ui="glossary"]',false);
      this.wire({back:this.close,glossary:()=>this.glossary(()=>this.credits())});
    }
    records() {
      const rows = this.provider.list({category:this.category,mode:this.rankingMode,source:this.source,version:this.recordsVersion});
      const progress = this.category === "progress";
      const title = progress ? "Hardcore · Farthest stage" : "Fastest clear";
      const tags = [
        ["progress","Hardcore progress"],["clear","Fastest clear"],["local","Local"],["demo","Demo"]
      ].map(([id,label])=>'<button class="small-button" data-ui="'+id+'" aria-pressed="'+(id===this.category||id===this.source)+'">'+label+'</button>').join("");
      const mode = progress ? "" : '<label class="setting">Mode <select id="record-mode">'+["story","hardcore","boss"].map(id=>'<option value="'+id+'"'+(id===this.rankingMode?" selected":"")+'>'+MODES[id].name+'</option>').join("")+'</select></label>';
      const columns = progress ? ["Rank","Player","Stage","Wave","Time","Run date"] : ["Rank","Player","Time","Difficulty","Damage","Parries","Run date"];
      const table = rows.length ? '<div class="table-wrap"><table><thead><tr>'+columns.map(cell=>'<th>'+cell+'</th>').join("")+'</tr></thead><tbody>'
        +rows.map((row,index)=>{
          const values = progress ? [index+1,row.player+(row.won?" · Clear":""),row.progress.stage,row.progress.wave,this.time(row.won?row.time:row.progress.time,true),row.date]
            : [index+1,row.player,this.time(row.time,true),MODES[row.kind].difficulty,row.damage,row.parries,row.date];
          return '<tr>'+values.map((value,index)=>'<td data-label="'+columns[index]+'">'+escape(value)+'</td>').join("")+'</tr>';
        }).join("")+'</tbody></table></div>' : '<p class="section-copy">No matching records yet.</p>';
      const version=this.source==="local"?'<label class="setting">Game version <select id="records-version">'+
        FrostRecords.SUPPORTED.map(v=>'<option value="'+v+'"'+(this.recordsVersion===v?" selected":"")+'>v'+v+'</option>').join("")+'</select></label>':"";
      this.show("records",heading("Records")+'<div class="record-filters">'+tags+'</div><h3>'+title+'</h3><p>'+
        (this.source==="demo"?"Demo records show fictional players.":"Personal results on this device. Online verification and submission are unavailable.")+'</p>'+version+mode+table+group(closeButton),'[data-ui="'+this.category+'"]');
      const filters = {};
      for (const key of ["progress","clear","local","demo"]) filters[key] = () => {
        if (key==="local"||key==="demo") this.source=key;
        else this.category=key;
        this.records();
      };
      this.wire({...filters,back:this.close});
      const select=this.panel.querySelector("#record-mode");
      if(select) select.onchange=()=>{this.rankingMode=select.value;this.records();this.panel.querySelector("#record-mode").focus();};
      const versions=this.panel.querySelector("#records-version");
      if(versions) versions.onchange=()=>{this.recordsVersion=versions.value;this.records();this.panel.querySelector("#records-version").focus();};
    }
    dialogue() {
      const run = this.getRun();
      if(!run.canTrade) return;
      const history = run.merchantHistory;
      history.visits++;
      this.shopPurchases = history.purchases;
      this.shopFeedback = "";
      const key = run.room.finalShop ? "final" : !history.purchases && history.visits >= 4 ? "again" :
        run.player.hp <= 45 ? "health" : history.potions >= 3 ? "potion" : history.visits === 1 ? "first" : run.kind === "boss" ? "after" : "welcome";
      this.dialogueLines = [...DIALOGUE[key]];
      if (Object.keys(run.inventory.owned).filter(id=>ITEMS[id].slot==="weapon").length>=3) {
        this.dialogueLines.push(["Eldric","All that steel, and only two hands. Quite the collector."]);
      } else if(run.room.stage>=3 && run.inventory.armor.defense===0) {
        this.dialogueLines.push(["Eldric","That armor won't last long out there."]);
      }
      this.conversation();
    }
    conversation() {
      const portrait='<canvas class="portrait-art" data-eldric width="98" height="88" aria-label="Portrait of Eldric"></canvas>';
      this.show("dialogue",heading("Eldric · Wandering Merchant")+'<div class="dialogue-layout">'+portrait+'<div class="conversation">'+this.dialogueLines.map(([speaker,line],i)=>
        '<p><strong>'+speaker+'</strong><span'+(i===this.dialogueLines.length-1?' class="spoken-line"':'')+'>'+line+'</span></p>').join("")+'</div></div>'+
        group(action("shop","Show me what you have.",true),action("kingdom","What happened to this kingdom?"),
          action("identity","Who are you?"),action("skip","Show full text"),action("back","I’ll be going.")),'[data-ui="shop"]');
      this.wire({shop:()=>this.shop(null,"buy"),back:()=>{this.close();this.notify("Eldric · Come back when the cold changes your mind.");},kingdom:()=>this.speak("kingdom"),identity:()=>this.speak("identity"),
        skip:()=>this.panel.querySelector(".spoken-line")?.classList.remove("spoken-line")});
    }
    speak(key) {
      this.dialogueLines.push(...DIALOGUE[key]);
      this.conversation();
      this.panel.querySelector(".conversation").scrollTop=this.panel.querySelector(".conversation").scrollHeight;
    }
    itemDetails(id, current, rarityLabel) {
      if(!id) return '<p>Select an item to inspect it.</p>';
      const item=ITEMS[id];
      const rows=comparison(item,current).map(row=>{
        const format = value => Number(value.toFixed(2))+row.unit;
        const change = row.impact>0 ? "Benefit" : row.impact<0 ? "Trade-off" : "Same";
        const delta = row.delta===0 ? "—" : (row.delta>0?"+":"")+format(row.delta);
        return '<div class="compare-row"><dt'+(row.description?' title="'+row.description+'"':'')+'>'+row.name+'</dt><dd>'+
          (current && current!==item ? format(row.before)+' <span aria-hidden="true">→</span> ' : '')+format(row.after)+
          (current && current!==item?'<small class="impact-'+row.impact+'">'+delta+' · '+change+'</small>':'')+'</dd></div>';
      }).join("");
      const preview = item.slot==="weapon" || item.slot==="armor"
        ? '<canvas class="gear-preview" data-gear-preview="'+id+'" width="160" height="82" aria-label="'+escape(item.name)+' preview"></canvas>' : "";
      return '<div class="item-heading"><h3>'+itemTitle(id)+'</h3>'+rarity(id,rarityLabel)+'</div>'+preview+
        '<p>'+escape(itemDetails(id))+'</p>'+(rows?'<p class="comparison-label">'+(current && current!==item?"Compared with "+escape(current.name ?? "empty slot"):"Attributes")+
          '</p><dl class="comparison-table">'+rows+'</dl>':'');
    }
    shop(selected = null, mode = "buy", message = "", confirm = false, filter = "all") {
      const run=this.getRun();
      if(!run?.canTrade) { this.close(); return; }
      const inv=run.inventory;
      const stock = mode==="buy" ? run.stock : packItems(inv);
      const ids=filterItems(stock,filter);
      selected=ids.includes(selected)?selected:ids[0];
      const item=ITEMS[selected];
      const held=item && (Object.values(inv.gear).includes(selected)||inv.quickSlot===selected&&inv.potionCount);
      const price=item?(mode==="buy"?priceOf(stock,selected):resale(selected,inv)):0;
      const reason = !item ? "" : mode==="sell" && held ? "Remove it from your loadout before selling." :
        mode==="buy" && stock[selected]===0 ? "Sold out" :
        mode==="buy" && inv.crowns<price ? "Not enough Frost Crowns" :
        mode==="buy" && !inv.canObtain(selected) ? item.slot==="potion"?"Potion belt or stack is full":"Already owned" : "";
      const currency=mode==="buy"?"Buy":"Sell";
      const offers=ids.map(id=>'<button class="shop-item" data-ui="item-'+id+'" aria-pressed="'+(id===selected)+'">'+itemTitle(id)+rarity(id,stock.rarities?.[id])+
         '<small>'+(stock[id]===0?"Sold out":stock[id]+(mode==="buy"?" in stock":" owned"))+' · '+(mode==="buy"?priceOf(stock,id):resale(id,inv))+' FC</small></button>').join("");
      const transaction=!item ? "" : reason ? '<p class="action-note">'+reason+'</p>' : confirm ?
        '<p class="action-note">Buy '+escape(item.name)+' for '+price+' Frost Crowns?</p>'+group(action("confirm","Confirm purchase",true),action("cancel","Cancel")) :
        group(action(mode,currency+" · "+price+" FC",true));
      const line=message || (Object.keys(run.stock).some(id=>getRarity(id)==="Legendary")?"Now that is something I don't show to just anyone.":
        Object.keys(run.build.ranks).length>=3?"You’re starting to look dangerous, wanderer.":DIALOGUE.shop[(run.seed+run.wave)%DIALOGUE.shop.length]);
      this.show("shop",menuHeader("Eldric’s shop")+'<div class="equipment-layout commerce-layout"><aside class="menu-column merchant-portrait">'+
        '<canvas class="portrait-art" data-eldric width="98" height="88" aria-label="Portrait of Eldric"></canvas>'+
        '<h3>Eldric</h3><p>'+escape(line)+'</p>'+money(inv.crowns)+'</aside>'+
        '<section class="menu-column items-column"><div class="shop-bar">'+tab("buy-tab","Buy",mode==="buy")+tab("sell-tab","Sell",mode==="sell")+'</div>'+
        categoryTabs(filter)+'<div class="item-grid">'+(offers||'<p>No items in this category.</p>')+'</div></section>'+
        '<section class="menu-column item-detail">'+this.itemDetails(selected,item&&ITEMS[inv.gear[item.slot]],stock.rarities?.[selected])+transaction+'</section></div>'+
        '<p class="menu-feedback" role="status">'+escape(this.shopFeedback??"")+'</p>'+group(action("pack","Open Inventory")),
        confirm?'[data-ui="confirm"]':selected?'[data-ui="item-'+selected+'"]':'[data-ui="filter-'+filter+'"]');
      const redraw = (line="", feedback="") => { this.shopFeedback=feedback; this.shop(selected,mode,line,false,filter); };
      const handlers = {
        "buy-tab":()=>{this.shopFeedback="";this.shop(null,"buy","",false,filter);},
        "sell-tab":()=>{this.shopFeedback="";this.shop(null,"sell","",false,filter);},
        back:()=>{
          if (run.merchantHistory.purchases===this.shopPurchases) this.notify("Eldric · Come back when the cold changes your mind.");
          this.shopFeedback="";
          this.close();
        },
        pack:()=>{
          if(!run.canTrade) return;
          this.inventory(()=>this.shop(selected,mode,"",false,filter),selected,"all",{message:"Eldric · Try it on. I won't charge you for looking."});
        },
        buy:()=>{if(run.canTrade && !reason) this.shop(selected,mode,line,true,filter);},
        cancel:()=>redraw(line),
        confirm:()=>{
          if(!run.canTrade || !confirm || reason) return;
          const result=buy(inv,run.stock,selected);
          if(result==="bought") {
            run.merchantHistory.purchases++;
            if(item.slot==="potion") run.merchantHistory.potions++;
            this.refresh();
            redraw(item.slot==="potion"?"Drink it before you’re too late to complain.":item.slot==="armor"?
              "Armor saves lives. Confidence gets them killed.":getRarity(selected)==="Epic"&&item.slot==="weapon"?
              "Careful. Powerful steel demands a steady hand.":"Good choice. Now make sure you actually wear it.","Item added to inventory.");
          } else {
            const failure={poor:"That costs more than you've got, wanderer.","sold-out":"Sold out",full:"Your potion belt is full.",owned:"You already carry one."};
            redraw(failure[result]);
          }
        },
        sell:()=>{
          if(!run.canTrade || reason) return;
          const ok=inv.sell(selected);
          this.refresh();
          redraw("Coins for the road.",ok?"Item sold.":"Item could not be sold.");
        }
      };
      for(const id of ids) handlers["item-"+id]=()=>this.shop(id,mode,line,false,filter);
      for(const id of Object.keys(categories)) handlers["filter-"+id]=()=>this.shop(null,mode,line,false,id);
      this.wire(handlers);
      selectControls(this.panel,".item-grid button");
    }
    inventory(back, selected = null, filter = "all", {readOnly=false,message=""} = {}) {
      const run=this.getRun(), inv=run.inventory;
      const stock=packItems(inv);
      const skills=Object.entries(run.build.ranks).map(([id,rank])=>'<div><dt>'+escape(PASSIVES[id].name)+' · '+rank+'/'+PASSIVES[id].ranks.length+'</dt><dd>'+
        escape(PASSIVES[id].text(PASSIVES[id].ranks[rank-1]))+'</dd></div>').join("");
      const active=ACTIVES[run.build.active];
      const ids=filterItems(stock,filter);
      selected=ids.includes(selected)?selected:ids[0];
      const rows=Object.entries(inv.gear).map(([slot,id])=>'<div><dt>'+labels[slot]+'</dt><dd>'+escape(itemName(id))+'</dd></div>').join("");
      const stats=[
        ["Attack",inv.weapon.light[0].damage+" light / "+inv.weapon.heavy.damage+" heavy"],
        ["Defense",percent(inv.armor.defense)],["Attack speed",strikeRate(inv.weapon.light[0]).toFixed(2)+"/s"],
        ["Movement",percent(inv.armor.speed*(inv.accessory.speed??1))],
        ["Stamina recovery",(30*inv.armor.regen*(inv.accessory.regen??1)).toFixed(1)+"/s"],
        ["Posture resistance",percent(1-(inv.armor.stability??1))]
      ];
      const statRows=stats.map(([name,value])=>'<div><dt>'+name+'</dt><dd>'+value+'</dd></div>').join("");
      const cards=ids.map(id=>{
        const item=ITEMS[id];
        const marker = item.slot==="potion" ? (inv.quickSlot===id?"Quick slot · ":"")+"×"+stock[id] :
          Object.values(inv.gear).includes(id)?"Equipped":labels[item.slot];
        return '<button class="shop-item" data-ui="item-'+id+'" aria-pressed="'+(id===selected)+'">'+itemTitle(id)+rarity(id)+'<small>'+marker+'</small></button>';
      }).join("");
      const item=ITEMS[selected];
      const equipped=item&&(item.slot==="potion"?inv.quickSlot===selected:inv.gear[item.slot]===selected);
      const access=run.equipmentAccess;
      const locked=readOnly||!access.allowed;
      const fixed=equipped && (item.slot==="weapon" || item.slot==="armor");
      let controls = "";
      if(item && !locked) {
        if(equipped && !fixed) controls=group(action("unequip",item.slot==="potion"?"Clear quick slot":"Unequip"));
        else if(!equipped) controls=group(action("equip",item.slot==="potion"?"Assign quick slot":"Equip",true));
        else controls='<p class="action-note">Equipped · Select another '+(item.slot==="armor"?"armor":"weapon")+' to replace it.</p>';
      }
      const state=locked?(access.reason||"Combat inspection · equipment is locked"):"Equipment changes available";
      this.show("inventory",menuHeader("Inventory")+'<div class="inventory-status"><span>'+escape(state)+'</span>'+money(inv.crowns)+'</div>'+
        '<div class="equipment-layout"><section class="menu-column loadout"><h3>Loadout</h3>'+
        '<canvas class="gear-preview loadout-preview" data-loadout-preview width="160" height="104" aria-label="Current loadout preview"></canvas>'+
        '<dl class="loadout-stats">'+rows+'</dl><h4>Combat stats</h4><dl class="loadout-stats">'+statRows+'</dl>'+
        '<details class="build-summary"><summary>Skills · '+Object.keys(run.build.ranks).length+' passive</summary>'+
        (active?'<p><strong>'+escape(active.name)+'</strong> · '+active.cost+' Stamina · '+active.cooldown+'s<br>'+escape(active.text)+'</p>':'<p>No active skill equipped.</p>')+
        (skills?'<dl>'+skills+'</dl>':'')+'</details></section>'+
        '<section class="menu-column items-column"><h3>Owned items <small>Potions '+inv.potions.length+'/'+LIMIT+'</small></h3>'+categoryTabs(filter)+
        '<div class="item-grid">'+(cards||'<p>No items in this category.</p>')+'</div></section>'+
        '<section class="menu-column item-detail">'+this.itemDetails(selected,item&&ITEMS[inv.gear[item.slot]])+controls+'</section></div>'+
        '<p class="menu-feedback" role="status">'+escape(message)+'</p>',
        selected?'[data-ui="item-'+selected+'"]':'[data-ui="filter-'+filter+'"]');
      this.panel.dataset.readOnly=String(readOnly);
      const redraw=(note="")=>this.inventory(back,selected,filter,{readOnly,message:note});
      const handlers={back,
        equip:()=>{
          if(locked) return;
          const ok=item.slot==="potion"?inv.selectPotion(selected):run.equip(selected);
          this.refresh();
          redraw(ok?(item.slot==="potion"?"Quick slot assigned.":"Equipment updated."):run.equipmentAccess.reason);
        },
        unequip:()=>{
          if(locked) return;
          const ok=item.slot==="potion"?inv.selectPotion(null):run.unequip(item.slot);
          this.refresh();
          redraw(ok?"Loadout updated.":run.equipmentAccess.reason);
        }
      };
      for(const id of ids) handlers["item-"+id]=()=>this.inventory(back,id,filter,{readOnly});
      for(const id of Object.keys(categories)) handlers["filter-"+id]=()=>this.inventory(back,null,id,{readOnly});
      this.wire(handlers);
      selectControls(this.panel,".item-grid button");
    }
  }
  globalThis.FrostRunUI = { UI, escape };
})();
