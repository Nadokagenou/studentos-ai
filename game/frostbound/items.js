(() => {
  "use strict";
  const hit = (windup, active, recovery, damage, posture, range, cone, cost) =>
    ({ windup, active, recovery, damage, posture, range, cone, cost });
  const weapon = (name, icon, price, description, color, pitch, light, heavy, extra = {}) =>
    ({ name, icon, price, description, color, pitch, light, heavy, slot: "weapon", ...extra });
  const armor = (name, icon, price, description, color, speed, defense, regen, extra = {}) =>
    ({ name, icon, price, description, color, speed, defense, regen, slot: "armor", ...extra });
  const potion = (name, icon, price, description, duration = 0) =>
    ({ name, icon, price, description, duration, slot: "potion" });
  const BASE_ITEMS = {
    edge: weapon("Frost Edge", "⚔", 30, "A balanced longsword with a three-cut combo and a forgiving parry.", "#d9f5ff", 520,
      [hit(.11,.11,.16,14,7,82,.95,0),hit(.12,.11,.18,15,8,87,1.15,0),hit(.14,.11,.21,19,12,94,1.28,0)],hit(.45,.13,.55,35,37,105,.97,18), { parry: .15 }),
    fang: weapon("Winter Fang", "⋔", 30, "Twin daggers cut twice at close range. Dash costs 5 less stamina.", "#b6ffe6", 830,
      [hit(.07,.09,.10,11,5,65,1.05,1),hit(.08,.10,.12,12,6,69,1.08,1)],hit(.23,.14,.28,23,22,74,1.20,12), { dashCost: 20, style:"twin", bladeLength:17 }),
    spear: weapon("Glacial Spear", "↟", 36, "Long, narrow thrusts. Keep opponents in front of you.", "#8fdfff", 380,
      [hit(.16,.11,.20,18,10,128,.23,3),hit(.17,.12,.20,19,11,136,.27,3)],hit(.40,.17,.44,36,30,160,.29,18), { style:"thrust", bladeLength:44, bladeWidth:2 }),
    great: weapon("King’s Greatsword", "†", 48, "A slow, broad sweep with massive posture damage.", "#f3d6a3", 250,
      [hit(.26,.15,.28,28,23,101,1.30,7)],hit(.55,.17,.59,53,63,125,1.44,28),{bladeLength:36,bladeWidth:7}),
    ash: weapon("Ashen Blade", "♦", 44, "Consecutive hits build damage. Missing resets the streak and extends recovery.", "#ff7283", 315,
      [hit(.13,.11,.18,17,10,85,.91,3),hit(.13,.11,.20,18,10,91,1.03,3),hit(.16,.12,.20,21,13,95,1.21,4)],hit(.39,.14,.42,37,34,106,1.02,20), { streak:true }),
    moon: weapon("Moonpiercer", "‡", 42, "A precise rapier. Deal 40% more damage against staggered foes.", "#e5c4ff", 710,
      [hit(.10,.09,.14,14,7,103,.29,2),hit(.12,.09,.16,16,8,112,.30,2)],hit(.27,.13,.30,29,23,130,.34,16), { style:"thrust", riposte:1.4,bladeLength:34,bladeWidth:2 }),
    coat: armor("Wanderer’s Coat", "♧", 12, "Light armor with modest protection and faster movement.", "#647d92", 1.06, .05, 1),
    frostguard: armor("Frostguard Armor", "⬟", 32, "Blue and silver armor with steady stamina recovery.", "#729fbe", 1, .12, 1.06),
    plate: armor("Ironbound Plate", "■", 40, "Thick plate absorbs blows at the cost of speed and stamina recovery.", "#8d8e9b", .92, .20, .90),
    crimson: armor("Crimson Hunter", "◆", 39, "Light armor for dodge counters. Heavy blows hit harder.", "#9f3851", 1.10, .07, 1, { heavy:.19 }),
    royal: armor("Royal Frost Armor", "♜", 57, "Royal plate resists frost and shortens hit stagger.", "#b094c0", .95, .18, .94, { frost:.30, stability:.68 }),
    mantle: armor("Phantom Mantle","◒",32,"Perfect Dodge creates a decoy for 1 second. Bosses ignore it. Cooldown 12s.","#68768e",1.04,.04,1),
    charm: { name:"Bell Shard", icon:"◈", price:24, description:"Perfect parries restore 6 stamina.", slot:"accessory", parryStamina:6 },
    emberstone: { name:"Hearthstone", icon:"◇", price:26, description:"Reduces frost damage by 18%.", slot:"accessory", frost:.18 },
    feather: { name:"Pine Feather", icon:"⌁", price:24, description:"Move 5% faster and recover stamina 8% faster.", slot:"accessory", speed:1.05, regen:1.08 },
    flask: potion("Crimson Flask", "✚", 14, "A bitter mixture that restores 40 health."),
    azure: potion("Azure Tonic", "≋", 10, "Restores 50 stamina."),
    heart: {name:"Frozen Heart",icon:"♥",price:33,description:"Maximum HP +15. Equipping it does not heal.",slot:"accessory",maxHp:15},
    hunter: {name:"Hunter’s Charm",icon:"◇",price:66,description:"Perfect Dodge restores 8 Stamina. Cooldown 5s.",slot:"accessory"},
    broken: {name:"Broken Crown",icon:"♕",price:121,description:"+12% damage against staggered enemies.",slot:"accessory",staggerDamage:.12},
    wolf: {name:"Wolf Talisman",icon:"◈",price:121,description:"Three consecutive hits grant +10% movement for 3s.",slot:"accessory"},
    lantern: {name:"Winter Lantern",icon:"✧",price:66,description:"15% less incoming Frost buildup and clearer frost hazard warnings.",slot:"accessory",frostBuildup:.15},
    hourglass: {name:"Shattered Hourglass",icon:"⧖",price:220,description:"+12% active skill cooldown recovery.",slot:"accessory",cooldown:.12},
    fragment: {name:"King’s Fragment",icon:"♜",price:385,description:"Perfect Parry heals 5 HP, up to 20 per encounter. Cooldown 5s.",slot:"accessory"},
    blood: {name:"Blood Moon Sigil",icon:"☾",price:220,description:"Below 35% HP, gain +15% attack damage. Take 8% more damage at all times.",slot:"accessory",risk:.08},
    draught: potion("Frost Resistance Draught", "❄", 12, "40% less incoming Frost buildup for 12s.",12),
    focus: potion("Hunter’s Focus", "⌖", 12, "+20% Stamina regeneration for 10s.",10),
    iron: potion("Ironheart Elixir", "⬢", 15, "20% less damage and 15% less movement speed for 6s.",6),
    ember: potion("Ember Vial", "✴", 16, "Warming field for 5s. Halves Frost buildup inside. Boss attacks still hit.",5)
  };
  const LIMIT = 4;
  const RARITY = {
    edge:"Common", coat:"Common", flask:"Common", azure:"Common",
    fang:"Uncommon", spear:"Uncommon", frostguard:"Uncommon", feather:"Uncommon", charm:"Uncommon", draught:"Uncommon", focus:"Uncommon",
    great:"Rare", moon:"Rare", plate:"Rare", crimson:"Rare", emberstone:"Rare", iron:"Rare", ember:"Rare",
    ash:"Epic", royal:"Epic", mantle:"Uncommon", heart:"Common",hunter:"Uncommon",broken:"Rare",wolf:"Rare",
    lantern:"Uncommon",hourglass:"Epic",fragment:"Legendary",blood:"Epic"
  };
  const TIERS = ["Common","Uncommon","Rare","Epic","Legendary"];
  const PRICES = [30,60,110,200,350];
  const SIGNATURES = ["Swift","Piercing","Frost-Touched","Precise","Efficient","Relentless","Sturdy","Focused"];
  const ARMOR_AFFIXES = ["Reinforced","Lightweight","Enduring","Frostproof","Retaliating","Efficient Guard"];
  const AFFIX_TEXT = {
    Swift:"6% shorter recovery",Piercing:"+10% posture damage","Frost-Touched":"+6 Frost on Heavy hit",Precise:"+10% recovery-window damage",
    Efficient:"8% lower Light Stamina cost",Relentless:"Perfect Dodge primes +12% on the next Light hit",Sturdy:"Perfect Parry grants 4 posture resistance for 3s",
    Focused:"+6% active cooldown recovery",Reinforced:"+3 defense",Lightweight:"+4% movement",Enduring:"+6% Stamina recovery",
    Frostproof:"10% less incoming Frost buildup",Retaliating:"+8% recovery-window damage","Efficient Guard":"8% lower Parry cost"
  };
  const SPECIAL = {
    edge:"Frost Cut · Every fourth landed Light adds 15 Frost.",
    fang:"Predator’s Rhythm · Three consecutive hits grant +10% movement for 2s.",
    spear:"Piercing Frost · Heavy pierces two aligned foes; second takes 65% damage.",
    great:"Royal Breaker · Heavy into enemy recovery adds +20% posture damage.",
    ash:"Crimson Resolve · Five consecutive hits grant +15% damage for 3s. Damage taken ends it. Misses add 15% recovery.",
    moon:"Precision Thrust · The first hit within 1.5s of Perfect Parry gains +25% damage.",
    coat:"Traveler’s Step · Perfect Dodge grants +8% movement for 2s (5s cooldown).",
    frostguard:"Frozen Retaliation · Perfect Parry pulses 10 damage and 15 Frost nearby (6s cooldown).",
    plate:"Unyielding · A hit of 20+ raw damage grants 20% reduction for the next 2s (18s cooldown).",
    crimson:"Hunter’s Instinct · Perfect Dodge primes +18% damage on your next hit within 2s (5s cooldown).",
    royal:"King’s Resistance · A Frost hit grants 35% buildup resistance and 10 posture resistance for 3s (10s cooldown).",
    mantle:BASE_ITEMS.mantle.description
  };
  const variantCache=new Map();
  function variant(id) {
    const [family,tier,roll,rank,shop] = id.split("~");
    const base=BASE_ITEMS[family];
    if(!base || !TIERS[tier] || !/^[0-9]+$/.test(roll) || !/^[0-2]$/.test(rank)) return;
    const level=Number(tier), upgrade=Number(rank);
    const affixes=[];
    if(base.slot==="weapon" || base.slot==="armor") {
      const pool=(base.slot==="weapon"?SIGNATURES:ARMOR_AFFIXES).slice();
      const rng=random(Number(roll));
      for(let i=0;i<[0,1,1,2,3][level];i++) affixes.push(pool.splice(Math.floor(rng()*pool.length),1)[0]);
    }
    const has=name=>affixes.includes(name);
    const tuned={...base,family,rarity:TIERS[level],affixes,rank:upgrade+1,signature:level===4 ? SPECIAL[family] : null,
      price:Math.round(PRICES[level]*(base.slot==="potion"?.4:base.slot==="accessory"?1.1:1)),
      stockItem:shop==="s"};
    if(base.slot==="weapon") {
      const tune=hit=>({...hit,damage:Math.round(hit.damage*(1+level*.05+upgrade*.025)),recovery:hit.recovery*(has("Swift")?.94:1),
        cost:hit===base.heavy?hit.cost*(level===4?1.08:1):hit.cost*(has("Efficient")?.92:1)});
      tuned.light=base.light.map(tune);
      tuned.heavy=tune(base.heavy);
    }
    if(base.slot==="armor") {
      tuned.defense=base.defense+level*.02+upgrade*.01+(has("Reinforced")?.03:0);
      tuned.speed=base.speed+(has("Lightweight")?.04:0);
      tuned.regen=base.regen+(has("Enduring")?.06:0);
    }
    return tuned;
  }
  const ITEMS=new Proxy(BASE_ITEMS,{get(target,id){
    if(Object.hasOwn(target,id)) return target[id];
    if(typeof id!=="string"||!id.includes("~")) return;
    if(variantCache.has(id)) return variantCache.get(id);
    const value=variant(id);
    if(value) {
      if(variantCache.size>=192) variantCache.delete(variantCache.keys().next().value);
      variantCache.set(id,value);
    }
    return value;
  }});
  const getRarity=id=>ITEMS[id]?.rarity ?? RARITY[id] ?? "Common";
  const familyOf=id=>ITEMS[id]?.family ?? id;
  const itemId=(family,tier,roll=0,rank=0,shop=false)=>[family,tier,roll,rank,shop?"s":"r"].join("~");
  const itemDetails=id=> {
    const item=ITEMS[id], family=familyOf(id);
    if(!item) return "";
    return [item.description,SPECIAL[family]===item.description?null:SPECIAL[family],
      item.signature ? (item.slot==="weapon"?"Legendary signature · Land a Light hit within 1.5s of Perfect Parry to refund 4 Stamina. Heavy costs 8% more.":"Legendary signature · Armor reaction restores 4 Stamina. Its cooldown still applies.") : null,
      item.affixes?.length ? item.affixes.map(name=>name+" · "+AFFIX_TEXT[name]).join(" / ") : null,
      item.slot==="weapon" ? "Light "+item.light[0].damage+" damage / "+item.light[0].range+" reach · Heavy "+item.heavy.damage+
        " damage / "+item.heavy.posture+" posture / "+item.heavy.range+" reach · "+Math.ceil(item.light[0].cost)+
        " / "+Math.ceil(item.heavy.cost)+" Stamina." : null,
      item.slot==="armor" ? Math.round(item.defense*100)+"% defense · "+Math.round(item.speed*100)+"% movement · "+Math.round(item.regen*100)+"% Stamina recovery." : null].filter(Boolean).join(" ");
  };
  const strikeRate = strike => 1 / (strike.windup + strike.active + strike.recovery);
  function comparison(item, current) {
    const rows = [];
    const add = (name,before,after,unit="",direction=1,description="") => {
      const delta = Math.round((after-before)*100)/100;
      rows.push({name,before,after,unit,delta,impact:Math.sign(delta*direction),description});
    };
    if (item.slot === "weapon") {
      const next = item.light[0], old = (current ?? item).light[0];
      const heavy = item.heavy, oldHeavy = (current ?? item).heavy;
      add("Light damage",old.damage,next.damage);
      add("Heavy damage",oldHeavy.damage,heavy.damage);
      add("Attack speed",strikeRate(old),strikeRate(next),"/s",1,"First light strike, including recovery.");
      add("Light reach",old.range,next.range);
      add("Heavy stamina",oldHeavy.cost,heavy.cost,"",-1,"Lower cost leaves more stamina to defend.");
      add("Heavy recovery",oldHeavy.recovery*1000,heavy.recovery*1000," ms",-1,"Shorter recovery lets you act sooner.");
    } else if(item.slot === "armor") {
      const old = current ?? item;
      add("Defense",old.defense*100,item.defense*100,"%");
      add("Movement",old.speed*100,item.speed*100,"%");
      add("Stamina recovery",old.regen*100,item.regen*100,"%");
      add("Posture resistance",(1-(old.stability??1))*100,(1-(item.stability??1))*100,"%",1,"Reduces time spent staggered after a hit.");
      add("Frost resistance",(old.frost??0)*100,(item.frost??0)*100,"%");
    } else if(item.slot === "accessory") {
      add("Parry stamina",current?.parryStamina??0,item.parryStamina??0);
      add("Frost resistance",(current?.frost??0)*100,(item.frost??0)*100,"%");
      add("Movement",(current?.speed??1)*100,(item.speed??1)*100,"%");
      add("Stamina recovery",(current?.regen??1)*100,(item.regen??1)*100,"%");
    }
    return rows;
  }
  class Inventory {
    #gear;
    #quickSlot;
    #mayChange;
    constructor(preset = "edge", mode = "story", mayChange = () => true) {
      const weapon=ITEMS[preset?.weapon ?? preset]?.slot==="weapon"?preset?.weapon ?? preset:"edge";
      const chest=ITEMS[preset?.armor]?.slot==="armor"?preset.armor:"coat";
      this.#gear = Object.freeze({ weapon, armor: chest, accessory: null });
      this.owned = { [weapon]: 1, [chest]: 1 };
      this.paid={};
      this.potions = mode === "hardcore" ? [] : ["flask"];
      this.potionPrices=this.potions.map(id=>ITEMS[id].price);
      this.crowns = mode === "boss" ? 40 : 34;
      this.#quickSlot = this.potions[0] ?? null;
      this.#mayChange = mayChange;
    }
    get gear() { return this.#gear; }
    get weapon() { return ITEMS[this.gear.weapon]; }
    get armor() { return ITEMS[this.gear.armor]; }
    get accessory() { return ITEMS[this.gear.accessory] ?? {}; }
    get quickSlot() { return this.#quickSlot; }
    get potionCount() { return this.potions.filter(id => id === this.#quickSlot).length; }
    get potion() { return this.potionCount ? this.#quickSlot : null; }
    canObtain(id) {
      const item=ITEMS[id];
      if(!item) return false;
      if(item.slot==="potion") return this.potions.length<LIMIT && this.potions.filter(key=>key===id).length<3;
      return !this.owned[id] && (item.slot!=="accessory" || !Object.keys(this.owned).some(key=>familyOf(key)===familyOf(id)));
    }
    obtain(id,price=ITEMS[id]?.price) {
      const item = ITEMS[id];
      if (!this.canObtain(id)) return false;
      if (item.slot === "potion") {
        if (this.potions.length >= LIMIT) return false;
        this.potions.push(id);
        this.potionPrices.push(price);
      } else {
        if (this.owned[id]) return false;
        this.owned[id] = 1;
        this.paid[id]=price;
      }
      return true;
    }
    equip(id) {
      if (!this.#mayChange() || !this.owned[id] || !ITEMS[id]) return false;
      this.#gear = Object.freeze({ ...this.#gear, [ITEMS[id].slot]: id });
      return true;
    }
    unequip(slot) {
      if (!this.#mayChange() || slot !== "accessory" || !this.#gear[slot]) return false;
      this.#gear = Object.freeze({ ...this.#gear, [slot]: null });
      return true;
    }
    selectPotion(id) {
      if (!this.#mayChange() || (id !== null && !this.potions.includes(id))) return false;
      this.#quickSlot = id;
      return true;
    }
    upgradeTarget(id) {
      const item=ITEMS[id];
      if(!this.owned[id] || !["weapon","armor"].includes(item?.slot) || (item.rank??1)>=3) return null;
      const [,level="0",roll="0"]=id.split("~");
      return itemId(familyOf(id),Number(level),Number(roll),item.rank??1,item.stockItem);
    }
    canUpgrade(id) {
      const next=this.upgradeTarget(id);
      return Boolean(next&&!this.owned[next]);
    }
    upgrade(id) {
      if(!this.#mayChange()||!this.canUpgrade(id)) return false;
      const item=ITEMS[id];
      const upgraded=this.upgradeTarget(id);
      delete this.owned[id];
      this.owned[upgraded]=1;
      if(this.paid[id]!==undefined) {
        this.paid[upgraded]=this.paid[id];
        delete this.paid[id];
      }
      if(this.#gear[item.slot]===id) this.#gear=Object.freeze({...this.#gear,[item.slot]:upgraded});
      return true;
    }
    take(index = this.potions.indexOf(this.#quickSlot)) {
      if (!Number.isInteger(index) || index < 0 || index >= this.potions.length) return;
      const [id] = this.potions.splice(index, 1);
      this.potionPrices.splice(index,1);
      return id;
    }
    sell(id) {
      if (!this.#mayChange() || !ITEMS[id] || Object.values(this.gear).includes(id) || id===this.#quickSlot) return false;
      const value=resale(id,this);
      if (ITEMS[id].slot === "potion") {
        const index = this.potions.indexOf(id);
        if (index < 0) return false;
        this.take(index);
      } else {
        if (!this.owned[id]) return false;
        delete this.owned[id];
        delete this.paid[id];
      }
      this.crowns += value;
      return true;
    }
  }
  const resale = (id,inventory) => {
    const price=ITEMS[id].slot==="potion"?inventory?.potionPrices[inventory.potions.indexOf(id)]:inventory?.paid[id];
    return Math.floor((price??ITEMS[id].price)*.4);
  };
  const priceOf=(stock,id)=>stock.prices?.[id] ?? ITEMS[id].price;
  function buy(inventory, stock, id) {
    if (!ITEMS[id] || !(stock[id] > 0)) return "sold-out";
    const price=priceOf(stock,id);
    if (inventory.crowns < price) return "poor";
    if (!inventory.obtain(id,price)) return ITEMS[id].slot === "potion" ? "full" : "owned";
    inventory.crowns -= price;
    stock[id]--;
    return "bought";
  }
  function random(seed) {
    let state = seed >>> 0;
    return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  function market(seed, index, mode) {
    const rng = random(seed + index * 91771);
    const weapons = ["fang","spear","great","ash","moon"];
    const armor = ["frostguard","plate","crimson",index >= 5 ? "royal" : "coat"];
    const potions = ["azure","draught","focus","iron","ember"];
    const pick = list => list.splice(Math.floor(rng()*list.length),1)[0];
    const offers = { [pick(weapons)]:1, [pick(weapons)]:1, [pick(armor)]:1, [pick(potions)]:1, [pick(potions)]:1 };
    if (mode !== "hardcore" || rng() > .45) offers.flask = mode === "story" ? 2 : 1;
    if (index > 2 || rng() > .65) offers[pick(["charm","emberstone","feather"])] = 1;
    return offers;
  }
  globalThis.FrostItems = { ITEMS, LIMIT, RARITY, TIERS, PRICES, Inventory, resale, priceOf, buy, random, market, strikeRate, comparison, getRarity, familyOf, itemId, itemDetails };
})();
