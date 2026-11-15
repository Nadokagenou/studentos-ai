(() => {
  "use strict";
  const {ITEMS,TIERS,PRICES,random,itemId,getRarity,itemDetails,familyOf}=FrostItems;
  const p=(name,tier,icon,ranks,text)=>({name,tier,icon,ranks,text,type:"Passive"});
  const a=(name,tier,icon,cooldown,cost,charge,text)=>({name,tier,icon,cooldown,cost,charge,text,type:"Active"});
  const PASSIVES={
    counter:p("Counter Instinct",0,"↶",[.20,.30,.40],v=>"Perfect Parry primes the next Light hit within 3s for +"+Math.round(v*100)+"% damage."),
    rhythm:p("Iron Rhythm",1,"≋",[15,22],v=>"Perfect Parry restores "+v+" Stamina. Cooldown 4s."),
    reversal:p("Frost Reversal",2,"❄",[[12,20],[18,30]],v=>"Perfect Parry pulses "+v[0]+" damage and "+v[1]+" Frost nearby. Cooldown 5s."),
    defiance:p("Royal Defiance",4,"♜",[.45],()=>"Parry a boss, then land Heavy within 3s for +45% posture damage. Cooldown 12s. Respects boss immunity."),
    footwork:p("Phantom Footwork",0,"◇",[.20,.30,.40],v=>"Perfect Dodge discounts the next Dash by "+Math.round(v*100)+"% Stamina."),
    momentum:p("Cold Momentum",1,"➝",[.12,.18],v=>"Perfect Dodge grants +"+Math.round(v*100)+"% movement for 2.5s."),
    echo:p("Echo Step",3,"◈",[20],()=>"Perfect Dodge leaves an echo that bursts for 20 damage after 0.8s. Cooldown 6s."),
    tempo:p("Blade Tempo",0,"≡",[.08,.12,.16],v=>"Three consecutive landed Lights grant +"+Math.round(v*100)+"% attack speed for 4s. A miss resets the count."),
    discipline:p("Heavy Discipline",1,"◆",[.15,.25],v=>"Heavy hits deal +"+Math.round(v*100)+"% posture damage. Heavy attacks cost 8% more Stamina."),
    execution:p("Execution Window",2,"†",[.20,.30],v=>"Deal +"+Math.round(v*100)+"% damage to staggered enemies."),
    stand:p("Last Stand",3,"♥",[.18],()=>"Below 30% HP, gain +18% damage until health exceeds 35%."),
    frostbite:p("Frostbite",0,"✧",[12,18,24],v=>"Landed Heavy attacks apply "+v+" Frost."),
    shatter:p("Shattered Ice",2,"✦",[[25,15],[35,22]],v=>"Heavy breaks Freeze for "+v[0]+" extra damage. Against bosses at 100 Frost, gain "+v[1]+" extra posture damage. Cooldown 4s."),
    embrace:p("Winter’s Embrace",3,"✚",[6],()=>"Defeating a foe you affected with Frost heals 6 HP, capped at 24 per encounter."),
    zero:p("Absolute Zero",4,"✵",[.30],()=>"Freezing a foe creates a 3s field with 30% slow. Boss Frost Break applies brief 15% slow. Cooldown 10s.")
  };
  const ACTIVES={
    lance:a("Frost Lance",0,"↟",8,15,.20,"Aim a straight shot. It stops at a wall or the first foe, dealing 35 damage and 25 Frost."),
    assault:a("Crimson Assault",1,"➤",12,25,.18,"Lunge forward for 45 damage. No invulnerability; recovery can be interrupted."),
    barrier:a("Glacial Barrier",2,"⬟",18,20,.18,"Place a frontal barrier for 2s. It blocks one projectile. Area attacks still hit."),
    rush:a("Phantom Rush",2,"⋔",14,30,.16,"Two aimed strikes for 22 damage each. Redirect once between hits. No invulnerability."),
    judgment:a("Winter Judgment",3,"✵",25,40,.65,"Charge an interruptible strike at the cursor or aimed area. Deals 70 damage and 35 posture."),
    reversal:a("King’s Reversal",4,"♜",28,25,0,"Counter one parryable attack within 0.5s for 65 damage. A miss still spends the cooldown.")
  };
  const WEIGHTS={
    normal:[45,30,17,7,1],elite:[0,0,75,22,3],boss:[0,0,0,85,15],
    shop:[40,35,20,4,1],late:[20,35,30,13,2]
  };
  const pools = {
    weapon:["edge","fang","spear","great","ash","moon"],armor:["coat","frostguard","plate","crimson","royal","mantle"],
    relic:["heart","hunter","broken","wolf","lantern","hourglass","fragment","blood","charm","feather","emberstone"],
    potion:["flask","azure","draught","focus","iron","ember"]
  };
  function tier(rng,weights) {
    const total=weights.reduce((sum,w)=>sum+w,0);
    let point=rng()*total;
    return weights.findIndex(w=>(point-=w)<0);
  }
  const pick=(rng,values)=>values[Math.floor(rng()*values.length)];
  function skillCards(run) {
    return [
      ...Object.entries(PASSIVES).flatMap(([id,s])=>{
        const rank=run.build.ranks[id]??0;
        return rank<s.ranks.length?[{...s,id:"passive:"+id,key:id,rank,next:rank+1,description:s.text(s.ranks[rank])}]:[];
      }),
      ...Object.entries(ACTIVES).filter(([id])=>id!==run.build.active).map(([id,s])=>({...s,id:"active:"+id,key:id,description:s.text}))
    ];
  }
  function gearCard(run,rng,level,families) {
    const eligible=families.filter(f=>{
      if(ITEMS[f].slot!=="accessory") return true;
      return TIERS[level]===getRarity(f) && !Object.keys(run.inventory.owned).some(id=>familyOf(id)===f);
    });
    const family=pick(rng,eligible.length?eligible:families.filter(f=>ITEMS[f].slot!=="accessory"));
    if(!family) return;
    const id=ITEMS[family].slot==="accessory"?family:itemId(family,level,Math.floor(rng()*0xffffff));
    if(!run.inventory.canObtain(id)) return;
    const item=ITEMS[id];
    return {id:"item:"+id,key:id,tier:level,name:item.name,icon:item.icon,type:item.slot==="accessory"?"Relic":item.slot==="armor"?"Armor":"Weapon",
      description:itemDetails(id),rank:item.rank,affixes:item.affixes};
  }
  const cash = {id:"crowns",type:"Utility",tier:0,name:"Frost Crowns",icon:"◈",description:"Gain 35 Frost Crowns."};
  function utility(run,rng) {
    const choices=[cash];
    if(run.player.hp+8<run.maxHp) choices.push({id:"heal",type:"Utility",tier:0,name:"Winter’s Rest",icon:"✚",description:"Restore "+(run.kind==="hardcore"?12:20)+" HP."});
    if(run.inventory.canObtain("flask") && run.kind!=="hardcore") choices.push({id:"potion",type:"Utility",tier:1,name:"Field Supplies",icon:"✚",description:"Add one Crimson Flask to Inventory. Restore Stamina."});
    const items=Object.keys(run.inventory.owned).filter(id=>run.inventory.canUpgrade(id));
    if(items.length) {
      const key=pick(rng,items);
      const armor=ITEMS[key].slot==="armor";
      choices.push({id:"upgrade",key,type:"Utility",tier:1,name:"Smith’s Whetstone",icon:"◈",
        rank:ITEMS[key].rank??1,next:(ITEMS[key].rank??1)+1,
        description:ITEMS[key].name+" gains one rank ("+(armor?"+1 defense point":"+2.5% base damage before rounding") +"). Explicitly upgrades this piece; keeps its affixes."});
    }
    return pick(rng,choices);
  }
  function offer(run,context) {
    const rng=run.rewardRandom, cards=skillCards(run);
    const weights=WEIGHTS[context]??WEIGHTS.normal;
    if(context==="intro") return ["lance","assault","barrier"].map(key=>cards.find(c=>c.id==="active:"+key));
    const skills=(level,onlyPassive=false)=>pick(rng,cards.filter(c=>c.tier===level&&(!onlyPassive||c.type==="Passive"))) ??
      pick(rng,cards.filter(c=>c.tier>=level&&(!onlyPassive||c.type==="Passive")));
    const gear=(level,families,chosen=[])=>{
      for(let n=0;n<10;n++) {
        const card=gearCard(run,rng,level,families);
        if(card&&!chosen.some(c=>familyOf(c.key)===familyOf(card.key))) return card;
      }
      return cash;
    };
    const all=[...pools.weapon,...pools.armor,...pools.relic].filter(id=>{
      const slot=ITEMS[id].slot;
      return slot==="accessory"||run.room.type==="elite"||run.inventory.gear[slot]!==id;
    });
    if(context==="treasure"||context==="secret-gear") {
      const level=()=>context==="secret-gear"?tier(rng,WEIGHTS.elite):tier(rng,weights);
      const first=gear(level(),all), second=gear(level(),all,[first]);
      return [first,second].filter((card,i,array)=>array.findIndex(c=>c.id===card.id)===i);
    }
    if(context==="event-epic"||context==="event-relic") {
      const first=context==="event-epic"?skills(3,true):pick(rng,[2,3,4].map(level=>gearCard(run,rng,level,pools.relic)).filter(Boolean));
      const second=gear(2,[...pools.weapon,...pools.armor]);
      return [first??{...cash,id:"reserve",name:"Travel Reserve",description:"Gain 25 Frost Crowns."},second,
        {...cash,id:"supply-crowns",name:"Supply Purse",description:"Gain 40 Frost Crowns."}];
    }
    if(run.kind==="boss") {
      let available=cards.filter(c=>c.type==="Passive"&&c.tier>=3);
      return Array.from({length:3},(_,i)=>{
        const level=tier(rng,weights);
        const card=pick(rng,available.filter(c=>c.tier===level)) ?? pick(rng,available);
        available=available.filter(c=>c!==card);
        return card ?? (i===0?gear(level,all):i===1?{...cash,id:"reserve",name:"Travel Reserve",description:"Gain 25 Frost Crowns."}:cash);
      }).filter((c,i,list)=>list.findIndex(other=>other.id===c.id)===i);
    }
    const level=tier(rng,weights);
    const pity=context==="normal" && run.rewardDrought>=5;
    const next=gear(pity?3:tier(rng,weights),run.room.path==="danger"&&context==="elite"?[...pools.weapon,...pools.armor]:all);
    return [skills(level)??{...cash,id:"reserve",name:"Travel Reserve",description:"Gain 25 Frost Crowns."},next,utility(run,rng)]
      .map((card,i,array)=>i===2&&array.slice(0,2).some(c=>c.id===card.id)?{...cash,id:"supply-crowns",name:"Supply Purse",description:"Gain 40 Frost Crowns."}:card);
  }
  function shop(seed,room,mode,index) {
    const rng=random((seed^0x9E3779B9)+index*91771);
    const late=room.stage>=4||room.finalShop;
    const weights=late?WEIGHTS.late:WEIGHTS.shop;
    const stock={};
    const prices={};
    const rarities={};
    Object.defineProperty(stock,"prices",{value:prices});
    Object.defineProperty(stock,"rarities",{value:rarities});
    const slots=["weapon","armor","relic","potion",pick(rng,["weapon","armor","relic"]),mode==="hardcore"?pick(rng,["armor","relic"]):"potion"];
    for(const category of slots) {
      const level=tier(rng,weights);
      const options=pools[category].filter(id=>!Object.keys(stock).some(key=>familyOf(key)===id));
      const family=pick(rng,options);
      const id=category==="potion"?family:itemId(family,level,Math.floor(rng()*0xffffff),0,true);
      stock[id]=1;
      prices[id]=Math.round(PRICES[level]*(category==="potion"?.4:category==="relic"?1.1:1));
      rarities[id]=TIERS[level];
    }
    return stock;
  }
  globalThis.FrostLoot={PASSIVES,ACTIVES,WEIGHTS,tier,offer,shop};
})();
