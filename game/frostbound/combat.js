(() => {
  "use strict";

  const WIDTH = 960, HEIGHT = 584, STEP = 1 / 120;
  const {BOUNDS,GATE,SPAWNS,Route}=FrostRegions;
  const { MODES, NPC, DISCOVERY, SIDE, training: trainingRoom } = FrostWorld;
  const { Inventory, ITEMS, random } = FrostItems;
  const {profiles,attacks,clearSight,decision,spaceFor,reserve}=FrostEnemyAI;
  const mirroredAttacks={edge:"slash",fang:"wolf",spear:"thrust",great:"sentinel",ash:"elite",moon:"thrust"};
  const ENEMIES = {
    ...profiles,
    ...FrostMiniBosses.fighters,
    king: { name: "The Frozen King", hp: 1200, posture: 250, radius: 24, speed: 110, range: 189 },
    keeper: { name: "The Gatekeeper", hp: 255, posture: 100, radius: 22, speed: 95, range: 110 },
    warden: { name: "The Crystal Warden", hp: 345, posture: 110, radius: 23, speed: 83, range: 120 },
    elite: { ...profiles.remnant, name: "Elite Royal Remnant",radius:18 },
    wolf: { name: "Hollowpine Wolf", hp: 43, posture: 36, radius: 12, speed: 148, range: 95 },
    reflection: { name: "Winter Reflection", hp: 105, posture: 72, radius: 14, speed: 110, range: 102 },
    dummy: { name: "Training Sentinel", hp: Infinity, posture: 60, radius: 17, speed: 62, range: 93 }
  };
  const ATTACKS = {
    wolf: { name:"Wolf pounce", windup:.41, active:.16, recovery:.58, damage:10, range:98, cone:.46, parry:true },
    elite: { name:"Revenant cleave", windup:.62, active:.19, recovery:.72, damage:18, range:114, cone:1.05, parry:true },
    frost: { name:"Frost fissure", windup:1.08, active:.35, recovery:0, damage:12, range:54, shape:"spots", parry:false, frost:true },
    debris: { name:"Falling stone",windup:1.22,active:.24,recovery:0,damage:14,range:46,shape:"spots",parry:false },
    ...attacks,
    ...FrostBossAI.attacks,
    ...FrostMiniBosses.attacks,
    slash: { name: "Royal Slash", windup: .55, active: .18, recovery: .65, damage: 20, range: 132, cone: 1.10, parry: true },
    thrust: { name: "Frozen Thrust", windup: .70, active: .14, recovery: .70, damage: 23, range: 186, cone: .28, parry: true },
    shock: { name: "Ice Shockwave", windup: .90, active: .30, recovery: .85, damage: 23, range: 172, shape: "ring", parry: false },
    combo: { name: "King's Combo", windup: .48, active: .16, recovery: .76, damage: 18, range: 136, cone: 1.24, parry: true, followUp: true },
    comboEnd: { name: "King's Combo", windup: .38, active: .16, recovery: .76, damage: 21, range: 142, cone: 1.33, parry: true },
    collapse: { name: "Winter Collapse", windup: 1.20, active: .50, recovery: 1, damage: 26, range: 80, shape: "spots", parry: false },
    dummy: { name: "Training cleave", windup: .88, active: .16, recovery: .95, damage: 7, range: 108, cone: .93, parry: true }
  };
  const BOSSES = {
    keeper: [["sentinel","thrust"],["elite","combo","slash"],["combo","slash","thrust"]],
    warden: [["shock","thrust"],["slash","collapse","shock"],["thrust","collapse","shock"]],
    king: true
  };
  const FROST_ATTACKS = new Set(["archer","shock","collapse","frost"]);

  const LESSONS = [
    ["Find your footing", "Move around the courtyard."],
    ["Frost Edge", "Land a light strike on the sentinel."],
    ["Break their guard", "Hit the sentinel with a heavy strike."],
    ["Slip through", "Dash out of the marked strike zone."],
    ["Read the tell", "Tap Parry just as the sentinel's attack lands."]
  ];
  const clamp = (value, from, to) => Math.max(from, Math.min(to, value));
  const angle = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const difference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function contains(origin, point, range, cone, padding = 0) {
    const length = distance(origin, point);
    if (length > range + padding) return false;
    return length <= padding || Math.abs(difference(angle(origin, point), origin.dir)) <= cone + Math.asin(Math.min(1, padding / length));
  }

  function walk(actor, dx, dy, pillars) {
    const { radius } = actor;
    actor.x = clamp(actor.x + dx, BOUNDS.left + radius, BOUNDS.right - radius);
    actor.y = clamp(actor.y + dy, BOUNDS.top + radius, BOUNDS.bottom - radius);
    for (const [x, y, size] of pillars) {
      const length = Math.hypot(actor.x - x, actor.y - y);
      if (length >= radius + size) continue;
      const dir = length ? Math.atan2(actor.y - y, actor.x - x) : 0;
      actor.x = x + Math.cos(dir) * (radius + size);
      actor.y = y + Math.sin(dir) * (radius + size);
    }
  }

  function steer(actor, direction, pillars) {
    for (const [x, y, size] of pillars) {
      const offset = difference(angle(actor, { x, y }), direction);
      if (distance(actor, { x, y }) > actor.radius + size + 38 || Math.abs(offset) > .66) continue;
      return direction - Math.sign(offset || 1) * 1.13;
    }
    return direction;
  }

  function scoreRun(stats, won, time) {
    const skill = Math.min(600, stats.parries * 55);
    const speed = won ? Math.max(0, 550 - Math.floor(time * 1.6)) : 0;
    const score = Math.max(0, stats.kills * 100 + stats.cleared * 500 + (won ? 1500 : 0)
      + skill + speed - stats.damage * 4);
    if (won) {
      const rank = stats.damage === 0 && stats.parries >= 3 ? "SS" : stats.damage <= 35 ? "S" : "A";
      return { score, rank };
    }
    return { score, rank: stats.cleared >= 3 ? "B" : "C" };
  }

  class Run {
    constructor(kind = "story", seed = Date.now(), preset = "edge") {
      this.kind = kind === true ? "training" : MODES[kind] ? kind : "story";
      this.training = this.kind === "training";
      this.rules = MODES[this.kind];
      this.seed = seed >>> 0;
      this.random = random(this.seed);
      this.rewardRandom=random(this.seed^0x3152CF18);
      this.enemyRandom=random(this.seed^0x96AD55C3);
      this.mutationRandom=random(this.seed^0x29BE9C43);
      this.bossRandom=random(this.seed^0x8AEFD72B);
      this.mutationHazards=[];
      this.attackBegins=[];
      this.eventRandom=random(this.seed^0x2657AC31);
      this.eventsDone=new Set();
      this.encounterEffects={};
      this.forge={};
      this.rewardDrought=0;
      this.offer=null;
      this.route=this.training?null:new Route(this.kind,this.seed);
      this.rooms=this.route?.rooms??[trainingRoom];
      const inventory = new Inventory(preset, this.kind, () => this.inventory === inventory && this.equipmentAccess.allowed);
      this.inventory = inventory;
      this.build=new FrostBuild.Build(this);
      this.preparing = false;
      this.reinforcing = false;
      this.runWave = 0;
      this.progress = { stage: 0, wave: 0, time: 0 };
      this.merchants = {};
      this.merchantHistory = { visits:0, purchases:0, potions:0 };
      this.buffs = {};
      this.warmth = null;
      this.hazard = null;
      this.environment=null;
      this.bellSilenced=false;
      this.nextHazard = 6;
      this.bossTime = 0;
      this.bossElapsed = 0;
      this.mode = "playing";
      this.time = 0;
      this.wave = 0;
      this.lesson = 0;
      this.moved = 0;
      this.player = { x: 480, y: 385, radius: 12, dir: -Math.PI / 2, hp: 100, stamina: 100,
        action: null, combo: -1, comboUntil: 0, regen: 0, flash: 0, grace: 0 };
      this.stats = { kills: 0, cleared: 0, damage: 0, parries: 0, dashes: 0, potions: 0, healing: 0 };
      this.enemies = [];
      this.shots = [];
      this.fx = [];
      this.events = [];
      this.pending = [];
      this.nextSpawn = 0;
      this.gateOpen = false;
      this.parryStop = 0;
      this.buffer = null;
      this.spawnIndex = 0;
      this.enemyOffset=Math.floor(this.enemyRandom()*SPAWNS.length);
      if (this.training) this.addEnemy("dummy", 480, 240, .8);
      else {
        this.startWave();
        if(this.kind==="boss") this.openReward("intro");
      }
    }

    emit(kind, detail = {}) { this.events.push({ kind, ...detail }); }
    effect(kind, x, y, detail = {}) {
      const duration = detail.duration ?? .55;
      if(this.fx.length>=128) this.fx.shift();
      this.fx.push({ kind, x, y, age: 0, duration, ...detail });
    }
    impact(category,x,y,duration,detail={}) {
      this.effect("impact",x,y,{...detail,category,duration});
    }
    inputNotice(category) {
      if((this.nextInputNotice??0)>this.time) return;
      this.nextInputNotice=this.time+.55;
      this.emit("combat-notice",{category});
    }
    addEnemy(type, x, y, delay) {
      const data = ENEMIES[type];
      const danger=this.room.path==="danger"&&!BOSSES[type]?1.15:1;
      const hp = Math.ceil(data.hp * (this.kind==="hardcore"?1.10:this.rules.hp)*danger);
      const facing=profiles[type]||type==="elite"?{x:480,y:324}:this.player;
      const enemy={ ...data, hp, type, boss: Boolean(BOSSES[type]||data.mini), x, y, dir: angle({ x, y },facing),
        maxHp: hp, maxPosture: data.posture, posture: 0, flash: 0, attack: null,
        cooldown: .35, immunity: 0, dead: 0, state: "spawn", timer: delay, phase: 1, turn: 0,
        decisionAt:0, nearFor:0, patrol:(this.spawnIndex+2)%(this.room.spawns?.length||1),flank:this.spawnIndex%2?1:-1,
        defendUntil:0,nextDefend:this.time+2, memory:0,retreatUntil:0 };
      if(type==="elite") FrostMutations.prepare(enemy,this.eliteMutation??FrostMutations.pick(this.mutationRandom),this.time);
      if(type==="king") enemy.patternCooldowns={};
      this.enemies.push(enemy);
    }
    startWave() {
      if(!this.route?.advance()) return;
      this.wave++;
      this.offer=null;
      this.attackBegins=[];
      this.mutationHazards=[];
      this.crystalWall=null;
      this.build.resetRoom();
      this.mode = "playing";
      this.gateOpen = this.room.enemies.length === 0;
      this.preparing = !this.gateOpen;
      this.reinforcing = false;
      this.runWave = this.gateOpen ? 0 : 1;
      this.discovered = false;
      this.wallBroken=false;
      this.eventEncounter = null;
      this.secretRevealed = false;
      this.bossElapsed = 0;
      this.hazard = null;
      this.environment=FrostEnvironment.create(this.room);
      this.nextHazard = this.time + 6;
      if (!this.gateOpen) this.trackProgress();
      this.pending = this.room.enemies.slice();
      this.eliteMutation=(this.room.waves??[this.room.enemies]).flat().includes("elite")?FrostMutations.pick(this.mutationRandom):null;
      this.nextSpawn = .58;
      this.spawnIndex = 0;
      this.enemyOffset=Math.floor(this.enemyRandom()*SPAWNS.length);
      this.player.action = null;
      this.player.frost=0;
      this.player.x = this.room.entry?.x??480;
      this.player.y = this.wave === 1 ? 385 : this.room.entry?.y??469;
      this.player.dir = -Math.PI / 2;
      this.buffer = null;
      this.enemies = [];
      this.fx = [];
      this.shots = [];
      if(this.room.type==="merchant") void this.stock;
      this.emit("wave", { wave: this.wave });
    }
    get room() { return this.route?.room??this.rooms[0]; }
    get obstacles() { return this.crystalWall ? [...this.room.pillars,this.crystalWall.pillar] : this.room.pillars; }
    get nextRoom() { return this.route?.nextRoom; }
    get paths() { return this.route?.options; }
    choosePath(path) {
      if(this.mode!=="playing"||!this.gateOpen||!this.equipmentAccess.allowed||distance(this.player,this.room.exit??GATE)>=30) return false;
      if(!this.route?.choose(path)) return false;
      this.startWave();
      return true;
    }
    get waves() { return this.room.waves?.length ?? 1; }
    get safe() { return !this.room.enemies.length && !this.eventEncounter; }
    get encounterState() {
      if (this.result) return "RESULTS";
      if (this.mode === "choose" && !this.shots.length && !this.hazard && !this.mutationHazards.length &&
        !this.enemies.some(enemy=>enemy.state!=="dead")) return "REWARD";
      if (this.mode !== "playing" || this.reinforcing) return "TRANSITION";
      if (this.shots.length || this.hazard || this.mutationHazards.length) return this.boss ? "BOSS_COMBAT" : "COMBAT";
      if (this.enemies.some(enemy => enemy.state !== "dead")) return this.boss ? "BOSS_COMBAT" : "COMBAT";
      if (this.preparing) return "PREPARATION";
      if (this.safe) return "SAFE";
      if (this.gateOpen && !this.pending.length) return "CLEARED";
      return this.room.type === "boss" ? "BOSS_COMBAT" : "COMBAT";
    }
    get equipmentAccess() {
      const state = this.encounterState;
      if (!["PREPARATION","SAFE","CLEARED","REWARD"].includes(state)) {
        return { allowed:false, reason:state === "TRANSITION" ? "Inventory unavailable during a transition." :
          state === "RESULTS" ? "This run has ended." : "Inventory unavailable during combat." };
      }
      const action = this.player.action;
      if (action && action.age < action.duration) return { allowed:false, reason:"Finish your current action first." };
      return { allowed:true, reason:"" };
    }
    get canTrade() { return this.room.type === "merchant" && this.target === "merchant" && this.equipmentAccess.allowed; }
    get target() {
      if(FrostEnvironment.bellNearby(this)) return "bell";
      if (this.room.type === "merchant" && distance(this.player, NPC) < 70) return "merchant";
      if(this.safe && this.room.eventId && !this.eventsDone.has(this.room.eventId) && distance(this.player,DISCOVERY)<64) return "event";
      if (this.safe && ["treasure","rest","lore"].includes(this.room.type) && distance(this.player, DISCOVERY) < 64
        && (!this.discovered || this.room.type === "lore")) return this.room.type;
      if (this.gateOpen && this.room.side && (!this.room.secretRequiresReveal||this.secretRevealed) && distance(this.player,SIDE)<58) return "passage";
      return null;
    }
    silenceBell() {
      if(this.target!=="bell"||!this.equipmentAccess.allowed) return false;
      this.bellSilenced=true;
      this.emit("environment",{id:"silenced"});
      return true;
    }
    eventChoice(id) {
      const result=FrostEvents.resolve(this,id);
      if(result?.foes) {
        this.eventEncounter=result.reward;
        this.eliteMutation=result.foes.includes("elite")?FrostMutations.pick(this.mutationRandom):null;
        this.gateOpen=false;
        this.pending=result.foes.slice();
        this.nextSpawn=.85;
        this.runWave=1;
        this.player.action=null;
        this.buffer=null;
      }
      return result;
    }
    trackProgress() {
      if(this.room.stage===this.progress.stage&&this.runWave<=this.progress.wave) return;
      this.progress = { stage:this.room.stage, wave:this.runWave, time:this.time };
    }
    get stock() {
      return this.merchants[this.wave] ??= FrostLoot.shop(this.seed,this.room,this.kind,this.wave);
    }
    enterSide() {
      if (this.target !== "passage") return;
      if(!this.route.enterSecret()) return;
      this.enemies = [];
      this.shots = [];
      this.fx = [];
      this.hazard=null;
      this.environment=FrostEnvironment.create(this.room);
      this.crystalWall=null;
      this.attackBegins=[];
      this.mutationHazards=[];
      this.nextHazard=this.time+6;
      this.pending=this.room.enemies.slice();
      this.nextSpawn=.6;
      this.spawnIndex=0;
      this.gateOpen=!this.pending.length;
      this.preparing=!this.gateOpen;
      this.runWave=this.gateOpen?0:1;
      this.eventEncounter=null;
      this.eliteMutation=null;
      this.bossElapsed=0;
      this.player.x = 480;
      this.player.y = 469;
      this.player.action=null;
      this.buffer=null;
      this.discovered = false;
      this.build.resetRoom();
      this.emit("wave");
    }
    discover(type) {
      if (type !== this.target || this.discovered || !["treasure","rest","lore"].includes(type)) return;
      this.discovered = true;
      if (type === "treasure") {
        if(this.room.hidden) this.openSecretCache();
        else {
          this.cacheCrowns();
          this.openReward("treasure");
        }
      } else if (type === "rest") {
        this.player.hp = Math.min(this.maxHp,this.player.hp + (this.kind === "hardcore" ? 12 : 28));
        this.player.stamina = 100;
      }
      this.effect("burst", DISCOVERY.x, DISCOVERY.y, { duration:.68 });
      this.emit("pickup");
    }
    cacheCrowns() {
      const reward=15+Math.floor(this.random()*36);
      this.inventory.crowns+=reward;
      this.effect("word",DISCOVERY.x,DISCOVERY.y-26,{label:"+"+reward+" crowns",color:"#ffe1a2",duration:1.2});
    }
    openSecretCache() {
      const roll=this.eventRandom();
      if(roll<.40) this.cacheCrowns();
      else if(roll<.65) {
        const supplies=["flask","azure"].filter(id=>this.inventory.obtain(id));
        if(!supplies.length) this.cacheCrowns();
        else this.emit("cache-note",{text:supplies.map(id=>ITEMS[id].name).join(" and ")+" added to Inventory."});
      } else if(roll<.85) this.openReward("secret-gear");
      else if(roll<.95) this.openReward("event-relic");
      else this.emit("cache-note",{text:"A watchman carved a message into the lid. The western wall once held a passage to the forest."});
    }
    get remaining() { return this.pending.length + this.enemies.filter(enemy => enemy.state !== "dead").length; }
    get boss() { return this.enemies.find(enemy => enemy.boss && enemy.state !== "dead"); }
    get choices() {
      return this.offer?.cards ?? [];
    }
    openReward(context) {
      if(this.offer) return;
      const cards=FrostLoot.offer(this,context);
      this.offer={context,cards};
      if(context==="normal") this.rewardDrought=cards.some(c=>c.tier>=3)?0:this.rewardDrought+1;
      this.player.action=null;
      this.buffer=null;
      this.mode="choose";
      this.emit("clear");
    }
    select(id,replace=false) {
      if(this.mode!=="choose" || !this.equipmentAccess.allowed) return false;
      const card=this.choices.find(option=>option.id===id);
      if(!card) return false;
      if(card.type==="Passive" || card.type==="Active") {
        if(!this.build.learn(card,replace)) return false;
      } else if(id.startsWith("item:")) {
        if(!this.inventory.obtain(card.key)) return false;
      } else if(id==="upgrade") {
        const next=this.inventory.upgradeTarget(card.key);
        if(!this.inventory.upgrade(card.key)) return false;
        if(this.forge[card.key]) {
          this.forge[next]=this.forge[card.key];
          delete this.forge[card.key];
        }
      } else if(id==="potion") {
        if(!this.inventory.obtain("flask")) return false;
      } else if(id==="heal") {
        this.player.hp=Math.min(this.maxHp,this.player.hp+(this.kind==="hardcore"?12:20));
      } else {
        this.inventory.crowns+=id==="reserve"?25:id==="supply-crowns"?40:35;
      }
      const context=this.offer.context;
      this.offer=null;
      if(!this.eventEncounter&&!["intro","treasure","secret-gear","event-relic"].includes(context)) this.player.hp=Math.min(this.maxHp,this.player.hp+this.rules.heal);
      this.eventEncounter=null;
      this.player.stamina = 100;
      this.player.action = null;
      this.buffer = null;
      this.mode = "playing";
      if(context!=="intro") {
        this.gateOpen = true;
        this.emit("gate");
      }
      return true;
    }
    equip(id) {
      const ok = this.inventory.equip(id);
      if (ok) { this.player.combo = -1; this.build.equipmentChanged(); this.player.hp=Math.min(this.maxHp,this.player.hp); }
      return ok;
    }
    unequip(slot) {
      if(!this.inventory.unequip(slot)) return false;
      this.build.equipmentChanged();
      this.player.hp=Math.min(this.maxHp,this.player.hp);
      return true;
    }
    prepareEncounter() {
      if (!this.preparing) return;
      this.preparing = false;
      this.buffer = null;
    }
    get speed() {
      return Math.min(1.30,this.inventory.armor.speed * (this.inventory.accessory.speed ?? 1)+this.build.movement)
        * (this.buffs.iron ? .85 : 1) * (this.buffs.chill ? .85 : 1);
    }
    get regen() {
      return 30 * this.inventory.armor.regen * (this.inventory.accessory.regen ?? 1) * (this.buffs.focus ? 1.2 : 1);
    }
    get maxHp() { return 100+(this.inventory.accessory.maxHp??0); }
    moveSkill(dir,amount) {
      for(let i=0;i<amount;i+=8) walk(this.player,Math.cos(dir)*Math.min(amount-i,8),Math.sin(dir)*Math.min(amount-i,8),this.obstacles);
    }
    skillContains(enemy,dir,range,cone,origin=this.player) { return contains({...origin,dir},enemy,range,cone,enemy.radius*.3); }
    projectileBlocked(point) {
      return point.x<BOUNDS.left||point.x>BOUNDS.right||point.y<BOUNDS.top||point.y>BOUNDS.bottom||
        this.obstacles.some(([x,y,size])=>Math.hypot(point.x-x,point.y-y)<size);
    }
    drink() {
      const id = this.inventory.take();
      if (!id) return;
      const item = ITEMS[id];
      const p = this.player;
      this.stats.potions++;
      if (id === "flask") {
        p.hp = Math.min(this.maxHp, p.hp + 40);
        this.stats.healing++;
      }
      if (id === "azure") p.stamina = Math.min(100,p.stamina + 50);
      if (item.duration) this.buffs[id] = item.duration;
      if (id === "draught") delete this.buffs.chill;
      if (id === "ember") this.warmth = { x:p.x,y:p.y,radius:88 };
      this.impact("potion",p.x,p.y-16,.36);
      this.emit("drink");
    }
    skipLesson() {
      if (this.training && this.lesson < LESSONS.length) this.lesson++;
    }
    learn(index) {
      if (this.training && index === this.lesson) this.skipLesson();
    }
    request(type, input) {
      if(this.mode!=="playing") return false;
      const p = this.player;
      const action = p.action;
      const recovering = action?.attack && action.age >= action.attack.windup + action.attack.active;
      const cancel = recovering && action.type === "light" && (type === "dash" || type === "parry");
      if (action && !cancel) return false;
      if(type==="skill") {
        if(this.build.cooldown>0) this.inputNotice("recharging");
        const skill=FrostLoot.ACTIVES[this.build.active];
        if(skill&&p.stamina<skill.cost) this.inputNotice("tired");
        let dir=typeof input.aim==="number"?input.aim:p.dir;
        if(input.assist) {
          const target=this.enemies.filter(e=>!["dead","spawn","transition"].includes(e.state)).sort((a,b)=>distance(a,p)-distance(b,p))[0];
          if(target) dir=angle(p,target);
        }
        return this.build.activate(dir,input.aimPoint);
      }
      if (type === "potion" && !this.inventory.potion) return false;
      const weapon = this.inventory.weapon;
      const combo = this.time <= p.comboUntil ? (p.combo + 1) % weapon.light.length : 0;
      const strike = type === "heavy" ? weapon.heavy : type === "light" ? weapon.light[combo] : null;
      const cost = this.build.cost(type,strike?.cost ?? (type === "dash" ? weapon.dashCost ?? 25 : type === "parry" ? 15 : 0));
      if (p.stamina < cost) {this.inputNotice("tired");return false;}
      if (typeof input.aim === "number") p.dir = input.aim;
      if (input.assist && (type === "light" || type === "heavy")) {
        const target = this.enemies.filter(e => e.state !== "dead" && e.state !== "spawn" && distance(e, p) < 144)
          .sort((a, b) => distance(a, p) - distance(b, p))[0];
        if (target) p.dir = angle(p, target);
      }
      p.stamina -= cost;
      if (cost) p.regen = .45;
      if (type === "dash") {
        this.build.consume("footwork");
        const dir = Math.hypot(input.x, input.y) > .1 ? Math.atan2(input.y, input.x) : p.dir;
        const escaping = this.training && this.enemies.some(enemy => enemy.state === "windup" && enemy.attack
          && this.inDanger(enemy.attack.data, enemy.attack.origin, enemy.attack.spots));
        p.action = { type, age: 0, duration: .44, dir, refunded: false, escaping };
        this.stats.dashes++;
        this.emit("dash",{x:p.x,y:p.y,dir});
      } else if (type === "parry") {
        p.action = { type, age: 0, duration: .35, dir: p.dir, used: false };
        this.emit("guard");
      } else if (type === "potion") {
        p.action = { type, age:0, duration:.80, dir:p.dir, consumed:false };
      } else if (strike) {
        const attack = this.build.strikeTiming(strike);
        const duration = attack.windup + attack.active + attack.recovery;
        p.action = { type, attack, weapon, combo, age: 0, duration, dir: p.dir, hits: new Set(), swung: false };
        if(this.build.weapon==="moon"&&this.build.live("moon")) p.action.counterPose=true;
        p.combo = type === "light" ? combo : -1;
        p.comboUntil = this.time + duration + .30;
      }
      return true;
    }
    tick(input, dt = STEP) {
      if (this.mode === "dying") {
        this.player.dead += dt;
        if (this.player.dead >= .86) {
          this.mode = "result";
          this.emit("defeat");
        }
        return;
      }
      if (this.mode !== "playing") return;
      if(!FrostEnemyAI.validPoint(this.player)||!Number.isFinite(this.player.dir))
        throw new RangeError("Invalid player position or facing");
      if(!Number.isFinite(input.x)||!Number.isFinite(input.y)||input.aim!=null&&!Number.isFinite(input.aim))
        input={...input,x:Number.isFinite(input.x)?input.x:0,y:Number.isFinite(input.y)?input.y:0,
          aim:Number.isFinite(input.aim)?input.aim:null};
      this.prepareEncounter();
      if (input.action) this.buffer = { type: input.action, until: this.time + .14 };
      if (this.parryStop > 0) {
        this.parryStop -= dt;
        return;
      }
      this.time += dt;
      if(this.crystalWall?.until<=this.time) this.crystalWall=null;
      if (this.boss) this.bossElapsed += dt;
      for (const id of Object.keys(this.buffs)) {
        this.buffs[id] -= dt;
        if (this.buffs[id] <= 0) delete this.buffs[id];
      }
      if (!this.buffs.ember) this.warmth = null;
      const p = this.player;
      p.flash = Math.max(0, p.flash - dt);
      p.grace = Math.max(0, p.grace - dt);
      p.regen -= dt;
      if (p.regen <= 0) p.stamina = Math.min(100, p.stamina + this.regen * dt);
      if (p.action && p.action.age >= p.action.duration) p.action = null;
      if (!p.action && typeof input.aim === "number") p.dir = input.aim;
      this.trace?.("combat-input");
      if (this.buffer && (this.time > this.buffer.until || this.request(this.buffer.type, input))) this.buffer = null;
      this.trace?.("player");
      this.updatePlayer(input, dt);
      if (this.gateOpen && distance(p, this.room.exit??GATE) < 30) {
        this.trace?.("room-transition");
        if(this.paths) {
          this.player.action=null;
          this.buffer=null;
          this.emit("paths");
        } else this.startWave();
        return;
      }
      this.trace?.("spawn");
      this.updateSpawns(dt);
      this.trace?.("enemy-ai");
      for (const enemy of this.enemies) {
        if (this.mode !== "playing") break;
        this.updateEnemy(enemy, dt);
      }
      if(this.enemies.some(enemy=>enemy.state==="dead"&&enemy.dead>.65))
        this.enemies=this.enemies.filter(enemy=>enemy.state!=="dead"||enemy.dead<=.65);
      if (this.mode !== "playing") return;
      this.trace?.("combat-effects");
      this.separate();
      this.updateShots(dt);
      this.updateHazard(dt);
      this.mutationHazards=this.mutationHazards.filter(zone=>this.advanceHazard(zone,dt));
      if(this.mode==="playing") this.build.tick(dt);
      let liveFx=0;
      for(const fx of this.fx) {
        fx.age+=dt;
        if(fx.age<fx.duration) this.fx[liveFx++]=fx;
      }
      this.fx.length=liveFx;
      if (!this.training && !this.gateOpen && this.remaining === 0 && this.mode === "playing" &&
        !this.shots.length && !this.hazard && !this.mutationHazards.length) {
        this.trace?.("encounter-completion");
        if (this.runWave < this.waves) {
          this.runWave++;
          this.reinforcing = true;
          this.pending = this.room.waves[this.runWave - 1].slice();
          this.nextSpawn = 1.25;
          this.trackProgress();
          this.emit("reinforcements", { wave:this.runWave });
          return;
        }
        this.stats.cleared++;
        for(const effect of Object.keys(this.encounterEffects))
          if(--this.encounterEffects[effect]<=0) delete this.encounterEffects[effect];
        this.inventory.crowns += Math.round((this.room.type==="elite"?50:30)*(this.room.path==="danger"?1.25:1));
        this.build.event("ON_ROOM_CLEARED");
        if (!this.nextRoom) this.finish(true);
        else {
          this.openReward(this.eventEncounter??(this.room.type==="boss"?"boss":["elite","mini"].includes(this.room.type)?"elite":"normal"));
        }
      }
    }
    updatePlayer(input, dt) {
      const p = this.player;
      const action = p.action;
      const length = Math.hypot(input.x, input.y);
      p.moving = length > .06 && !action;
      if (action?.type === "dash" && action.age < .26) {
        walk(p, Math.cos(action.dir) * 550 * dt, Math.sin(action.dir) * 550 * dt, this.obstacles);
        if (action.escaping && this.enemies.every(enemy => !enemy.attack
          || !this.inDanger(enemy.attack.data, enemy.attack.origin, enemy.attack.spots))) this.learn(3);
        if (Math.floor(action.age * 50) !== Math.floor((action.age + dt) * 50)) this.effect("trail", p.x, p.y, { dir: action.dir, duration: .24 });
      } else if (length > .06 && action?.type !== "dash" && action?.type !== "hurt") {
        const speed = (!action ? 180 : action.type === "potion" ? 24 : action.type === "heavy" ? 32 : 79) * this.speed;
        walk(p, input.x * speed * dt / Math.max(1, length), input.y * speed * dt / Math.max(1, length), this.obstacles);
        const cadence = length > .7 ? 6 : 3;
        if (p.moving && Math.floor(this.time*cadence) !== Math.floor((this.time-dt)*cadence)) {
          this.effect("step",p.x,p.y,{duration:.34});
          this.emit("step");
        }
        this.moved += speed * dt;
        if (this.moved >= 55) this.learn(0);
      }
      if (!action) return;
      action.age += dt;
      if(action.type==="parry"&&!action.used&&!action.finishedGuard&&action.age>=(this.inventory.weapon.parry??.14)+.025) {
        action.finishedGuard=true;
        this.emit("guard-miss");
      }
      if(action.type==="skill") this.build.advanceSkill(action,input);
      if (action.type === "potion" && !action.consumed && action.age >= .47) {
        action.consumed = true;
        this.drink();
      }
      const attack = action.attack;
      if (attack && !action.miss && !action.hits.size && action.age >= attack.windup + attack.active) {
        action.miss = true;
        if(this.build.weapon==="ash") action.duration += attack.recovery*.15;
        this.build.event("ON_ATTACK_MISS");
      }
      if (!attack || action.age < attack.windup || action.age >= attack.windup + attack.active) return;
      if (!action.swung) {
        action.swung = true;
        this.emit(action.type,{pitch:action.weapon.pitch,family:this.build.weapon,combo:action.combo});
        if(action.type==="heavy"&&this.gateOpen&&this.room.secretClue==="cracked"&&!this.wallBroken&&
          contains({...p,dir:action.dir},SIDE,attack.range,attack.cone,18)) {
          this.wallBroken=true;
          this.effect("burst",SIDE.x,SIDE.y,{duration:.58});
          this.emit("cache-note",{text:"The cracked wall opens onto a hidden passage."});
        }
      }
      const spear=action.type==="heavy"&&this.build.weapon==="spear";
      const targets=spear?[...this.enemies].sort((a,b)=>distance(p,a)-distance(p,b)):this.enemies;
      for (const enemy of targets) {
        if(spear&&(action.hits.size>=2||[...action.hits].some(e=>e.boss))) break;
        if(spear&&action.hits.size&&enemy.boss) continue;
        if (["dead", "spawn", "transition"].includes(enemy.state) || action.hits.has(enemy) || !clearSight(p,enemy,this.obstacles)
          || !contains({ ...p, dir: action.dir }, enemy, attack.range, attack.cone, enemy.radius * .3)) continue;
        action.hits.add(enemy);
        const heavy = action.type === "heavy";
        const counter = enemy.state === "recover" || enemy.state === "stagger";
        const frontal=Math.abs(difference(angle(enemy,p),enemy.dir))<1.05;
        const guarded = enemy.type === "sentinel" && !counter && !heavy && frontal;
        const hit=this.build.event(heavy?"ON_HEAVY_ATTACK_HIT":"ON_ATTACK_HIT",{action,enemy});
        this.learn(heavy ? 2 : 1);
        const category=guarded?"block":enemy.boss?(heavy?"bossHeavy":"bossHit"):(heavy?"heavy":"light");
        this.build.hit(enemy,Math.round(hit.damage*(guarded?.48:1)),hit.posture,hit.frost,false,
          {category,dir:action.dir,color:action.weapon.color});
      }
    }
    updateSpawns(dt) {
      if (!this.pending.length) return;
      this.nextSpawn -= dt;
      if (this.nextSpawn > 0) return;
      const active = this.enemies.filter(enemy => enemy.state !== "dead");
      const type = this.pending[0];
      if (active.length >= (this.wave === 1 ? 2 : 3)) return;
      const candidates=this.room.spawns??SPAWNS.map(([x,y])=>({x,y}));
      const spots = BOSSES[type] ? candidates
        : candidates.map((_, i) => candidates[(this.spawnIndex * 2 + i + (this.wave > 1 ? this.enemyOffset : 0)) % candidates.length]);
      const spot = spots.find(({x,y}) => distance({ x, y }, this.player) > 195
        && this.obstacles.every(([px, py, radius]) => Math.hypot(x - px, y - py) > radius + ENEMIES[type].radius)
        && active.every(enemy => distance({ x, y }, enemy) > 74));
      if (!spot) return;
      this.pending.shift();
      this.reinforcing = false;
      this.spawnIndex++;
      this.addEnemy(type, spot.x,spot.y, BOSSES[type] ? 1.2 : .7);
      this.nextSpawn = this.wave === 1 ? 1.45 : this.room.hazard === "ambush" ? .54 : .82;
    }
    startAttack(enemy, id, direction = angle(enemy, this.player),target=this.player) {
      const base = ATTACKS[id];
      reserve(this,base);
      const data = { ...base, windup:base.windup * this.rules.windup,
        damage:base.damage*(this.kind==="hardcore"?1.15:1),
        recovery:base.recovery * (this.kind === "hardcore" ? .84 : 1), frost:base.frost??FROST_ATTACKS.has(id) };
      FrostMutations.empower(enemy,data);
      const origin = { x: enemy.x, y: enemy.y, dir: direction };
      const p = target;
      const spots = id==="kingPillars"?FrostBossAI.pillarSpots(p,BOUNDS,this.obstacles):data.shape === "spots" ? [
        { x: p.x, y: p.y },
        { x: clamp(p.x - 151, BOUNDS.left, BOUNDS.right), y: clamp(p.y + 65, BOUNDS.top, BOUNDS.bottom) },
        { x: clamp(p.x + 151, BOUNDS.left, BOUNDS.right), y: clamp(p.y - 65, BOUNDS.top, BOUNDS.bottom) }
      ].slice(0,data.count??3) : null;
      enemy.dir = direction;
      enemy.lastAttack=id;
      enemy.attack = { id, data, origin, spots, hit: false, age: 0 };
      if(data.shape==="sector") data.zone=FrostBossAI.collapseZone(p,BOUNDS);
      enemy.state = "windup";
      this.emit("tell", { heavy: !data.parry, boss: enemy.boss });
    }
    updateEnemy(enemy, dt) {
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.immunity = Math.max(0, enemy.immunity - dt);
      if (enemy.state === "dead") { enemy.dead += dt; return; }
      FrostMutations.regenerate(enemy,this.time);
      if(enemy.frozenUntil>this.time) return;
      if(enemy.frozenUntil) {this.build.endFreeze(enemy);if(!["stagger","transition"].includes(enemy.state))enemy.state="chase";}
      if (enemy.state === "spawn" || enemy.state === "stagger" || enemy.state === "transition") {
        enemy.timer -= dt;
        if (enemy.timer > 0) return;
        enemy.state = "chase";
        enemy.cooldown = .25;
      }
      if (enemy.attack) { this.updateAttack(enemy, dt); return; }
      enemy.cooldown -= dt;
      const p = !enemy.boss && FrostEnemyAI.validPoint(this.build.decoy) ? this.build.decoy : this.player;
      if(enemy.type==="king") {
        this.updateKing(enemy,dt);
        return;
      }
      if(enemy.mini) {
        const length=distance(enemy,p), dir=angle(enemy,p);
        const id=FrostMiniBosses.choose(enemy,length);
        const attack=ATTACKS[id];
        enemy.dir=dir;
        if(enemy.cooldown<=0&&length<=(attack.reach??attack.range)&&clearSight(enemy,p,this.obstacles)&&spaceFor(this,attack)) {
          this.startAttack(enemy,id);
        } else if(length>(enemy.type==="hollow"?68:156)||enemy.type==="heart"&&length<79) {
          const course=steer(enemy,dir+(enemy.type==="heart"&&length<79?Math.PI:0),this.obstacles);
          walk(enemy,Math.cos(course)*enemy.speed*dt,Math.sin(course)*enemy.speed*dt,this.obstacles);
        }
        return;
      }
      if(profiles[enemy.type]||enemy.type==="elite") {
        if(enemy.decisionAt<=this.time) {
          enemy.decisionInterval=enemy.type==="elite"?.10+this.enemyRandom()*.08:.15+this.enemyRandom()*.10;
          enemy.decisionAt=this.time+enemy.decisionInterval;
          decision(this,enemy,p,ATTACKS);
        }
        if(!enemy.attack&&Number.isFinite(enemy.moveDir)) {
          const route=steer(enemy,enemy.moveDir,this.obstacles);
          const speed=enemy.speed*FrostEnvironment.speed(this,enemy)*(1-this.build.slow(enemy))*(enemy.state==="patrol"?.58:1);
          if(enemy.state==="patrol"||enemy.state==="investigate") enemy.dir=route;
          walk(enemy,Math.cos(route)*speed*dt,Math.sin(route)*speed*dt,this.obstacles);
        }
        return;
      }
      const length = distance(enemy, p);
      enemy.dir = angle(enemy, p);
      const blockers = this.enemies.some(other => other !== enemy && (other.state === "windup" || other.state === "active"));
      if (enemy.cooldown <= 0 && length < enemy.range && !blockers && clearSight(enemy,p,this.obstacles)) {
        const sequence = BOSSES[enemy.type]?.[enemy.phase - 1];
        const turn = enemy.turn++;
        const id=enemy.type==="reflection" ? (mirroredAttacks[FrostItems.familyOf(this.inventory.gear.weapon)]??"stalker") :
          sequence ? sequence[turn % sequence.length] :
          this.kind==="hardcore"&&enemy.type==="stalker"&&turn%3===2 ? "wolf" : enemy.type;
        if(length<=(ATTACKS[id].reach??ATTACKS[id].range)) {
          this.startAttack(enemy,id,angle(enemy,p),p);
          return;
        }
      }
      const targetSpace=enemy.type==="reflection"?43:56+enemy.radius*.55;
      if (length > targetSpace) {
        const route = steer(enemy,enemy.dir,this.obstacles);
        const speed=enemy.speed*(1-this.build.slow(enemy));
        walk(enemy, Math.cos(route) * speed * dt, Math.sin(route) * speed * dt, this.obstacles);
      }
    }
    updateKing(enemy,dt) {
      if(enemy.state==="defend") {
        if(this.time<enemy.defendUntil) return;
        enemy.state="chase";
        enemy.cooldown=.68;
      }
      enemy.dir=angle(enemy,this.player);
      if(enemy.decisionAt<=this.time) {
        enemy.decisionAt=this.time+.08+this.bossRandom()*.07;
        FrostBossAI.decide(this,enemy);
      }
      if(enemy.attack||enemy.state==="defend") return;
      const length=distance(enemy,this.player);
      if(length>81||!clearSight(enemy,this.player,this.obstacles)) {
        const dir=steer(enemy,enemy.dir,this.obstacles);
        const speed=enemy.speed*(1-this.build.slow(enemy));
        walk(enemy,Math.cos(dir)*speed*dt,Math.sin(dir)*speed*dt,this.obstacles);
      }
    }
    updateAttack(enemy, dt) {
      const attack = enemy.attack;
      const { data, origin, spots } = attack;
      attack.age += dt;
      if (attack.age < data.windup) return;
      if (attack.age < data.windup + data.active) {
        enemy.state = "active";
        if(data.trail) walk(enemy,Math.cos(origin.dir)*220*dt,Math.sin(origin.dir)*220*dt,this.obstacles);
        if(!attack.fieldLaid&&(data.trail||data.barrier)) {
          attack.fieldLaid=true;
          if(data.trail) FrostMiniBosses.leaveTrail(this,attack,BOUNDS);
          if(data.barrier) FrostMiniBosses.raiseBarrier(this,enemy,spots[0],BOUNDS);
        }
        if (["arrow","wave"].includes(data.shape) && !attack.hit) {
          attack.hit = true;
          const offset=data.shape==="wave"?0:17;
          this.shots.push({ x:origin.x+offset*Math.cos(origin.dir),y:origin.y+offset*Math.sin(origin.dir),
            dir:origin.dir,age:0,traveled:offset,attack:data,owner:enemy });
          this.emit("arrow");
        } else if (!attack.hit && (spots||clearSight(origin,this.player,this.obstacles)) && this.inDanger(data, origin, spots)) {
          attack.hit = true;
          this.receiveHit(data, enemy, origin);
        }
        return;
      }
      if (data.followUp) {
        const next=data.followUp===true?"comboEnd":data.followUp;
        const planned=ATTACKS[next];
        const continuation=next.startsWith("kingCombo");
        if(continuation||distance(enemy,this.player)<=planned.range&&clearSight(enemy,this.player,this.obstacles)&&spaceFor(this,planned)) {
          const aim=continuation&&distance(enemy,this.player)>planned.range?origin.dir:angle(enemy,this.player);
          this.startAttack(enemy,next,aim);
          return;
        }
        data.followUp=false;
      }
      enemy.state = "recover";
      if (attack.age < data.windup + data.active + data.recovery) return;
      enemy.attack = null;
      if(data.retreat&&!attack.hit) enemy.retreatUntil=this.time+.55;
      enemy.cooldown = enemy.boss ? .32 : .43;
      enemy.state = "chase";
    }
    inDanger(data, origin, spots) {
      const p = this.player;
      if(data.zone) {
        const {x,y,width,height}=data.zone;
        return p.x>=x&&p.x<=x+width&&p.y>=y&&p.y<=y+height;
      }
      if(data.shape==="wave") {
        const {forward,across}=FrostBossAI.wavePoint(origin,p);
        return forward>=0&&forward<=data.range&&Math.abs(across)<=data.width;
      }
      if (spots) return spots.some(spot => distance(p, spot) < data.range + p.radius * .35);
      if (data.shape === "ring") return distance(p, origin) < data.range + p.radius * .35;
      return contains(origin, p, data.range, data.cone, p.radius * .35);
    }
    updateShots(dt) {
      for (const shot of this.shots) {
        if (this.mode !== "playing") break;
        shot.age += dt;
        const movement=(shot.attack.speed??315)*dt;
        shot.x += Math.cos(shot.dir)*movement;
        shot.y += Math.sin(shot.dir)*movement;
        shot.traveled=(shot.traveled??0)+movement;
        if(shot.attack.range&&shot.traveled>shot.attack.range+5) {shot.age=Infinity;continue;}
        if(shot.attack.shape==="wave") {
          const {forward,across}=FrostBossAI.wavePoint(shot,this.player);
          if(Math.abs(forward)<19&&Math.abs(across)<shot.attack.width) {
            shot.age=Infinity;
            this.receiveHit(shot.attack,shot.owner,shot);
          }
          continue;
        }
        if (this.projectileBlocked(shot)) {
          shot.age = Infinity;
          continue;
        }
        if(this.build.barrier&&distance(shot,this.build.barrier)<25) {
          this.effect("parry",shot.x,shot.y,{duration:.32});
          this.build.barrier=null;
          shot.age=Infinity;
          continue;
        }
        if (distance(shot, this.player) < this.player.radius + 5) {
          shot.age = Infinity;
          this.receiveHit(shot.attack, shot.owner, shot);
        }
      }
      this.shots = this.shots.filter(shot => shot.age < 2.8 && shot.x > 35 && shot.x < WIDTH - 35 && shot.y > 60 && shot.y < HEIGHT - 25);
    }
    updateHazard(dt) {
      FrostEnvironment.tick(this,dt);
      const hazard = ATTACKS[this.room.hazard];
      if(this.gateOpen||this.training||this.mode!=="playing") return;
      const bossArea=["ring","spots","sector","wave"].includes(this.boss?.attack?.data.shape);
      if(hazard&&!this.hazard&&this.time>=this.nextHazard&&!bossArea&&
        !this.shots.some(shot=>shot.attack.shape==="wave")&&FrostEnemyAI.spaceFor(this,hazard)) {
        if(!this.remaining) return;
        const p = this.player;
        this.hazard = { state:"windup", attack:{ data:hazard, age:0, hit:false, spots:[{x:p.x,y:p.y}] } };
        FrostEnemyAI.reserve(this,hazard);
        this.nextHazard = this.time + (this.kind === "hardcore" ? 5.8 : 7.7)*(this.room.path==="danger"?.78:1);
        this.emit("environment",{id:this.room.hazard});
      }
      if(!this.hazard) return;
      if (!this.hazard) return;
      if(!this.advanceHazard(this.hazard,dt)) this.hazard=null;
    }
    advanceHazard(zone,dt) {
      const attack=zone.attack;
      attack.age += dt;
      if(attack.age<attack.data.windup) return true;
      if(attack.age>=attack.data.windup+attack.data.active) return false;
      zone.state="active";
      if(this.mode==="playing"&&!attack.hit&&this.inDanger(attack.data,attack.spots[0],attack.spots)) {
        attack.hit = true;
        this.receiveHit(attack.data, null, attack.spots[0]);
      }
      return true;
    }
    receiveHit(data, source, impact) {
      const p = this.player;
      const action = p.action;
      if (action?.type === "dash" && action.age <= .16) {
        this.learn(3);
        if (!action.refunded) {
          action.refunded = true;
          this.build.event("ON_PERFECT_DODGE");
          this.impact("dodge",p.x,p.y-16,.16,{dir:action.dir});
          this.emit("dodge");
        }
        return;
      }
      if (p.grace > 0) return;
      if(this.build.specialCounter(data,source)) return;
      if (action?.type === "parry" && !action.used && action.age <= (this.inventory.weapon.parry ?? .14) && data.parry) {
        action.used = true;
        this.stats.parries++;
        p.stamina = Math.min(100,p.stamina + (this.inventory.accessory.parryStamina ?? 0));
        this.learn(4);
        const contact=Number.isFinite(impact?.x)?angle(p,impact):p.dir;
        this.impact("perfect",p.x+Math.cos(contact)*19,p.y+Math.sin(contact)*19-15,.24,{dir:contact});
        this.parryStop = .045;
        this.build.event("ON_PERFECT_PARRY",source);
        if (source && !["dead","transition"].includes(source.state)) {
          if(source.mutation==="vengeful") source.vengeful=true;
          if (source.state === "active" && source.attack) {
            source.attack.age = data.windup + data.active;
            if(data.followUp&&!String(data.followUp).startsWith("kingCombo"))
              source.attack={...source.attack,data:{...data,followUp:false}};
            source.state = "recover";
          }
          this.damageEnemy(source,7,30,{quiet:true});
        }
        this.emit("perfect");
        return;
      }
      const armor = this.inventory.armor;
      const accessory=this.inventory.accessory;
      const mitigation=Math.min(.50,armor.defense+(this.forge[this.inventory.gear.armor]??0)*.03+(this.buffs.iron?.20:0)+(this.build.live("plate")?.20:0)+(data.frost?(armor.frost??0)+(accessory.frost??0):0));
      const raw = Math.max(1,Math.round(data.damage * (1-mitigation) * (1+(accessory.risk??0))
        * (data.damage >= 18 ? 1+(armor.heavy ?? 0) : 1)));
      const damage=Math.max(0,raw-(this.travelBlessing??0));
      this.travelBlessing=0;
      if(!damage) {this.build.ping("TRAVELER’S BLESSING");return;}
      const before = p.hp;
      p.hp = Math.max(this.training ? 40 : 0, p.hp - damage);
      this.stats.damage += before-p.hp;
      this.build.event("ON_DAMAGE_TAKEN",data);
      if(data.frost||data.extraFrost) {
        const warm=this.warmth&&distance(p,this.warmth)<this.warmth.radius;
        const reduction=Math.min(.75,(this.buffs.draught?.40:0)+(warm?.50:0)+(accessory.frostBuildup??0)
          +(this.build.live("royal")?.35:0)+(this.build.has("Frostproof")?.10:0));
        p.frost=(p.frost??0)+((data.frost?40:0)+(data.extraFrost??0))*(1-reduction);
        if(p.frost>=100) {p.frost=0;this.buffs.chill=2.2;this.build.ping("CHILLED");}
      }
      p.flash = .20;
      p.grace = .49;
      const resistance=(this.build.live("royal")?10:0)+(this.build.live("sturdy")?4:0);
      const stagger = data.damage>=18+resistance;
      if(action?.type!=="potion" || stagger || p.hp<=0)
        p.action = { type:"hurt",age:0,duration:.24*(armor.stability??1)*(1-resistance*.01),dir:p.dir };
      const away = angle(impact, p);
      walk(p, Math.cos(away) * 15, Math.sin(away) * 15, this.obstacles);
      this.effect("word", p.x, p.y - 17, { label: String(damage), color: "#ff9a9e", damage:true });
      this.emit("hurt",{boss:Boolean(source?.boss),heavy:data.damage>=18});
      if (p.hp <= 0) this.finish(false, data.name);
    }
    damageEnemy(enemy, damage, posture, presentation) {
      if(["dead","spawn","transition"].includes(enemy.state)) return;
      if(enemy.boss&&!enemy.mini&&enemy.phase<3) {
        const threshold=Math.floor(enemy.maxHp*(enemy.phase===1?.70:.35));
        damage=Math.min(damage,Math.max(0,enemy.hp-threshold));
      }
      enemy.hp = Math.max(0, enemy.hp - damage);
      enemy.flash = .12;
      this.effect("word", enemy.x, enemy.y - enemy.radius - 8, { label: String(damage), color: "#e6f4ff", damage:true });
      if(!presentation?.quiet) {
        const category=presentation?.category??(enemy.boss?"bossHit":"light");
        const dir=presentation?.dir??angle(this.player,enemy);
        const duration=category==="block"?.16:category==="heavy"||category==="bossHeavy"?.14:.10;
        this.impact(category,enemy.x-Math.cos(dir)*enemy.radius*.35,enemy.y-Math.sin(dir)*enemy.radius*.35-16,duration,
          {dir,color:category==="block"?undefined:presentation?.color});
        this.emit("hit",{category});
      }
      if (!enemy.hp) {
        enemy.state = "dead";
        enemy.attack = null;
        FrostMutations.onDeath(this,enemy);
        this.stats.kills++;
        this.inventory.crowns += enemy.boss ? 80 : enemy.type === "elite" ? 15 + Math.floor(this.random()*11) : 3 + Math.floor(this.random()*6);
        if (enemy.boss) {
          this.bossTime = this.bossElapsed;
          if(enemy.mini) this.crystalWall=null;
          this.build.event("ON_BOSS_DEFEATED",enemy);
        }
        this.build.event("ON_ENEMY_DEFEATED",enemy);
        this.impact(enemy.boss?"bossDefeat":"defeat",enemy.x,enemy.y-15,enemy.boss?.46:.27);
        this.emit("enemy-defeat",{boss:enemy.boss,type:enemy.type,x:enemy.x,y:enemy.y,dir:enemy.dir,phase:enemy.phase});
        return;
      }
      if (enemy.boss&&!enemy.mini) {
        const ratio = enemy.hp / enemy.maxHp;
        const phase = ratio <= .35 ? 3 : ratio <= .70 ? 2 : 1;
        if (phase > enemy.phase) {
          enemy.phase = phase;
          enemy.turn = 0;
          enemy.attack = null;
          enemy.state = "transition";
          enemy.timer = enemy.type==="king"?1.5:1.1;
          enemy.posture = 0;
          enemy.immunity = enemy.type==="king"?2:1.6;
          if(enemy.type==="king") {
            enemy.patternRepeats=0;
            enemy.lastPattern=null;
            this.hazard=null;
            this.shots=this.shots.filter(shot=>shot.owner!==enemy);
            this.nextHazard=Math.max(this.nextHazard,this.time+enemy.timer+2);
          }
          this.impact("phase",enemy.x,enemy.y-22,.45,{color:phase===3?"#ffa5bf":undefined});
          this.emit("phase", { phase, boss:enemy.type });
          return;
        }
      }
      if (enemy.immunity > 0 || enemy.state === "stagger") return;
      enemy.posture = Math.min(enemy.maxPosture, enemy.posture + posture);
      if (enemy.posture >= enemy.maxPosture) {
        enemy.posture = 0;
        enemy.state = "stagger";
        enemy.attack = null;
        enemy.timer = enemy.boss ? 1 : 1.5;
        enemy.immunity = enemy.boss ? 3.5 : 2.6;
        this.effect("word", enemy.x, enemy.y - 38, { label: "STAGGER", color: "#f4d594" });
        this.impact("posture",enemy.x,enemy.y-18,.27);
        this.build.event("ON_ENEMY_STAGGERED",enemy);
        this.emit("stagger");
      }
      if(enemy.state==="defend"&&damage>0) {
        const id=enemy.type==="king"?"kingCounter":"remnantCounter";
        if(distance(enemy,this.player)<=ATTACKS[id].range&&clearSight(enemy,this.player,this.obstacles)&&spaceFor(this,ATTACKS[id])) {
          enemy.defendUntil=0;
          this.startAttack(enemy,id);
        }
      }
    }
    separate() {
      const live = this.enemies.filter(enemy => ["chase","recover","position","investigate","patrol","idle"].includes(enemy.state));
      const bodies = [this.player, ...this.enemies.filter(enemy => !["dead", "spawn", "transition"].includes(enemy.state))];
      for (const enemy of live) {
        for (const body of bodies) {
          if (body === enemy) continue;
          const length = distance(enemy, body), minimum = enemy.radius + body.radius;
          if (length >= minimum) continue;
          const dir = length < .01 ? enemy.dir + Math.PI / 2 : angle(body, enemy);
          const push = (minimum - length) * .40;
          walk(enemy, Math.cos(dir) * push, Math.sin(dir) * push, this.obstacles);
        }
      }
    }
    finish(won, cause = "") {
      this.mode = won ? "result" : "dying";
      this.player.dead = won ? undefined : 0;
      this.result = { won, cause, kind:this.kind, time:this.time, bossTime:this.bossTime, seed:this.seed, progress:{...this.progress},
        ...this.stats, ...scoreRun(this.stats, won, this.time) };
      this.emit(won ? "victory" : "death");
    }
    abandon() {
      if (this.training || this.result) return false;
      this.finish(false,"Run ended");
      this.mode = "result";
      return true;
    }
    releaseResources() {
      this.inventory = new Inventory("edge",this.kind,()=>false);
      this.inventory.crowns = 0;
      this.inventory.potions = [];
      this.inventory.potionPrices = [];
      this.player.hp=Math.min(100,this.player.hp);
      this.merchants = {};
      this.buffs = {};
      this.warmth = null;
      this.hazard = null;
      this.mutationHazards=[];
      this.crystalWall=null;
      this.shots=[];
      this.enemies=[];
      this.pending=[];
      this.fx=[];
      this.attackBegins=[];
      this.buffer=null;
      this.offer=null;
      this.build=new FrostBuild.Build(this);
    }
  }

  globalThis.FrostCombat = { Run, WIDTH, HEIGHT, STEP, BOUNDS, GATE, LESSONS, clamp, angle, distance, scoreRun };
})();
