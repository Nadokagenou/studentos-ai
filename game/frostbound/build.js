(() => {
  "use strict";
  const {PASSIVES,ACTIVES}=FrostLoot;
  const {familyOf}=FrostItems;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const eligible=e=>!["dead","spawn","transition"].includes(e.state);
  class Build {
    constructor(run) { this.run=run; this.ranks={}; this.active=null; this.cooldown=0; this.dispatching=new Set(); this.resetRoom(); }
    resetRoom() {
      this.buffs={};this.timers={};this.lightChain=0;this.chain=0;this.frostCuts=0;
      this.healed={};this.delays=[];this.fields=[];this.shots=[];this.barrier=null;this.decoy=null;this.stand=false;
    }
    equipmentChanged() {
      this.miss();
      this.frostCuts=0;
      for(const name of ["moon","fang","ash","wolf","coat","crimson","plate","royal","signature","sturdy","relentless"]) delete this.buffs[name];
      this.decoy=null;
    }
    rank(id) { return PASSIVES[id].ranks[(this.ranks[id]??0)-1]; }
    get weapon() { return familyOf(this.run.inventory.gear.weapon); }
    get armor() { return familyOf(this.run.inventory.gear.armor); }
    get relic() { return familyOf(this.run.inventory.gear.accessory); }
    has(id) { return this.run.inventory.weapon.affixes?.includes(id)||this.run.inventory.armor.affixes?.includes(id); }
    ready(id,interval) {
      if((this.timers[id]??0)>this.run.time) return false;
      this.timers[id]=this.run.time+interval;
      return true;
    }
    buff(id,duration) { this.buffs[id]=this.run.time+duration; }
    live(id) { return (this.buffs[id]??0)>this.run.time; }
    consume(id) { if(!this.live(id)) return false; delete this.buffs[id]; return true; }
    ping(text,point=this.run.player) {
      this.run.effect("word",point.x,point.y-34,{label:text,color:"#aee8ff",duration:.75});
    }
    learn(card,replace) {
      if(card.type==="Passive") { this.ranks[card.key]=card.next; return true; }
      if(card.type!=="Active" || this.active&&!replace) return false;
      const busy=this.cooldown>0;
      this.active=card.key;
      if(busy) this.cooldown=Math.max(this.cooldown,ACTIVES[card.key].cooldown);
      return true;
    }
    regen(value) { const p=this.run.player;p.stamina=Math.min(100,p.stamina+value); }
    heal(id,value,cap) {
      const current=this.healed[id]??0;
      const amount=Math.min(value,cap-current,this.run.maxHp-this.run.player.hp);
      if(amount<=0 || this.run.player.hp<=0) return;
      this.healed[id]=current+amount;
      this.run.player.hp+=amount;
      this.ping("+"+amount+" HP");
    }
    get movement() {
      return clamp((this.live("momentum")?this.rank("momentum"):0)+(this.live("coat")?.08:0)
        +(this.live("fang")?.10:0)+(this.live("wolf")?.10:0),0,.30);
    }
    strikeTiming(attack) {
      const speed=clamp(this.live("tempo")?this.rank("tempo"):0,0,.35);
      if(!speed) return attack;
      return {...attack,windup:attack.windup/(1+speed),active:attack.active/(1+speed),recovery:attack.recovery/(1+speed)};
    }
    cost(type,raw) {
      let modifier=type==="heavy"&&this.rank("discipline")?.08:0;
      if(type==="dash"&&this.live("footwork")) modifier-=this.rank("footwork");
      if(type==="parry"&&this.has("Efficient Guard")) modifier-=.08;
      return Math.ceil(raw*Math.max(.60,1+modifier));
    }
    parry(enemy) {
      const level=this.rank("counter");
      if(level) { this.buff("counter",3);this.ping("COUNTER READY"); }
      if(this.weapon==="moon") this.buff("moon",1.5);
      if(this.run.inventory.weapon.signature) this.buff("signature",1.5);
      if(this.rank("rhythm")&&this.ready("rhythm",4)) this.regen(this.rank("rhythm"));
      if(this.rank("defiance")&&enemy?.boss&&this.ready("defiance",12)) this.buff("defiance",3);
      if(this.has("Sturdy")) this.buff("sturdy",3);
      if(this.relic==="fragment"&&this.ready("fragment",5)) this.heal("fragment",5,20);
      const pulse=this.rank("reversal");
      if(pulse&&this.ready("reversal",5)) this.pulse(this.run.player,92,pulse[0],pulse[1]);
      if(this.armor==="frostguard"&&this.ready("frostguard",6)) {
        this.pulse(this.run.player,80,10,15);
        this.armorSignature();
      }
    }
    armorSignature() {
      const p=this.run.player;
      this.run.impact("armor",p.x,p.y-17,.21);
      if(this.run.inventory.armor.signature) this.regen(4);
    }
    dodge() {
      const p=this.run.player;
      if(this.rank("footwork")) this.buff("footwork",Infinity);
      if(this.rank("momentum")) this.buff("momentum",2.5);
      if(this.has("Relentless")) this.buff("relentless",5);
      if(this.rank("echo")&&this.ready("echo",6)) this.delays.push({x:p.x,y:p.y,due:this.run.time+.8});
      if(this.armor==="coat"&&this.ready("coat",5)) {this.buff("coat",2);this.armorSignature();}
      if(this.armor==="crimson"&&this.ready("crimson",5)) {this.buff("crimson",2);this.armorSignature();}
      if(this.armor==="mantle"&&this.ready("mantle",12)) {this.decoy={x:p.x,y:p.y,until:this.run.time+1};this.armorSignature();}
      if(this.relic==="hunter"&&this.ready("hunter",5)) this.regen(8);
    }
    onDamage(data) {
      delete this.buffs.ash;
      if(this.armor==="plate"&&data.damage>=20&&this.ready("plate",18)) {this.buff("plate",2);this.ping("UNYIELDING");this.armorSignature();}
      if(this.armor==="royal"&&data.frost&&this.ready("royal",10)) {this.buff("royal",3);this.ping("KING’S RESISTANCE");this.armorSignature();}
    }
    strike(action,enemy) {
      const {attack,type,hits}=action, heavy=type==="heavy";
      const stagger=enemy.state==="stagger";
      let damage=(stagger?(this.rank("execution")??0)+(this.run.inventory.accessory.staggerDamage??0)+(action.weapon.riposte??1)-1:0)
        +(this.stand?.18:0)+(this.live("ash")?.15:0)+(this.relic==="blood"&&this.run.player.hp<this.run.maxHp*.35?.15:0);
      if(enemy.state==="recover") damage+=(this.has("Precise")?.10:0)+(this.has("Retaliating")?.08:0);
      let posture=(this.has("Piercing")?.10:0)+(heavy?(this.rank("discipline")??0):0);
      let frost=heavy?(this.rank("frostbite")??0)+(this.has("Frost-Touched")?6:0):0;
      let extra=0;
      if(heavy&&this.weapon==="great"&&enemy.state==="recover") posture+=.20;
      if(hits.size===1) {
        if(!heavy&&this.consume("signature")) this.regen(4);
        if(!heavy&&this.consume("counter")) damage+=this.rank("counter");
        if(!heavy&&this.consume("relentless")) damage+=.12;
        if(this.consume("moon")) damage+=.25;
        if(this.consume("crimson")) damage+=.18;
        if(heavy&&this.consume("defiance")) posture+=.45;
        this.chain++;
        if(this.weapon==="fang"&&this.chain%3===0) this.buff("fang",2);
        if(this.relic==="wolf"&&this.chain%3===0) this.buff("wolf",3);
        if(this.weapon==="ash"&&this.chain%5===0) {
          this.buff("ash",3);
          const p=this.run.player;
          this.run.impact("ash",p.x,p.y-17,.22);
          this.ping("CRIMSON RESOLVE");
        }
        if(!heavy) {
          if(this.rank("tempo")&&++this.lightChain%3===0) this.buff("tempo",4);
          if(this.weapon==="edge"&&++this.frostCuts%4===0) frost+=15;
        }
      }
      const shatter=this.rank("shatter");
      if(heavy&&shatter&&enemy.frozenUntil>this.run.time&&this.ready("shatter",4)) {
        this.endFreeze(enemy);
        extra=shatter[0];
      }
      if(heavy&&shatter&&enemy.boss&&(enemy.frost??0)+frost>=100&&this.ready("shatter",4)) {
        extra=0;
        enemy.shatter=shatter[1];
      }
      const pierce=heavy&&this.weapon==="spear"&&hits.size===2?.65:1;
      const forged=(this.run.forge[this.run.inventory.gear.weapon]??0)*.08;
      return {damage:Math.round(attack.damage*(1+clamp(damage+forged,0,enemy.boss?.40:.65))*pierce+extra),
        posture:Math.round(attack.posture*(1+clamp(posture,0,.65))*pierce),frost};
    }
    miss() { this.chain=0;this.lightChain=0; }
    pulse(point,radius,damage,frost) {
      this.run.effect("parry",point.x,point.y,{duration:.46});
      for(const enemy of this.run.enemies) {
        if(eligible(enemy)&&near(point,enemy)<radius) this.hit(enemy,damage,0,frost,true);
      }
    }
    hit(enemy,damage,posture,frost,reactive=false,presentation) {
      if(!eligible(enemy)) return;
      if(reactive&&enemy.boss) damage=Math.round(damage*.55);
      if(frost>0) enemy.frostSource=true;
      this.run.damageEnemy(enemy,damage,posture,presentation);
      if(frost>0&&eligible(enemy)) this.frost(enemy,frost);
      else if(!eligible(enemy)) enemy.shatter=0;
    }
    skillHit(enemy,damage,posture,frost) {
      this.hit(enemy,Math.round(damage*(this.run.encounterEffects.power?1.10:1)),posture,frost);
    }
    frost(enemy,value) {
      const t=this.run.time;
      if((enemy.frostLock??0)>t||enemy.frozenUntil>t||!eligible(enemy)) return;
      enemy.frost=Math.min(100,(enemy.frost??0)+value);
      if(enemy.frost<100) {
        this.run.impact("frost",enemy.x,enemy.y-21,.14);
        return;
      }
      this.run.impact("freeze",enemy.x,enemy.y-16,.3);
      if(enemy.boss) {
        enemy.frost=0;
        enemy.frostLock=t+8;
        this.run.damageEnemy(enemy,0,15+(enemy.shatter??0),{quiet:true});
        enemy.shatter=0;
        if(this.rank("zero")&&this.ready("zero",10)) enemy.frostSlow=t+2;
        this.event("ON_STATUS_APPLIED",{type:"frost-break",enemy});
        this.ping("FROST BREAK",enemy);
      } else {
        enemy.frozenUntil=t+1.5;
        enemy.attack=null;
        if(["windup","active","recover"].includes(enemy.state)) enemy.state="frozen";
        this.event("ON_STATUS_APPLIED",{type:"freeze",enemy});
        this.ping("FROZEN",enemy);
        if(this.rank("zero")&&this.ready("zero",10)) this.fields.push({x:enemy.x,y:enemy.y,r:88,until:t+3});
      }
    }
    endFreeze(enemy) {
      enemy.frozenUntil=0;
      enemy.frost=0;
      enemy.frostLock=this.run.time+4;
      if(enemy.state==="frozen") enemy.state="chase";
    }
    slow(enemy) {
      if(enemy.boss) return enemy.frostSlow>this.run.time?.15:0;
      return this.fields.some(f=>near(f,enemy)<f.r)?.30:0;
    }
    defeat(enemy) {
      if(this.rank("embrace")&&enemy.frostSource&&(enemy.frost>0||enemy.frozenUntil>this.run.time||enemy.frostLock>this.run.time)) this.heal("embrace",6,24);
    }
    activate(direction,aimPoint) {
      const skill=ACTIVES[this.active],p=this.run.player;
      if(!skill || this.cooldown>0 || p.stamina<skill.cost || p.action || !["COMBAT","BOSS_COMBAT"].includes(this.run.encounterState)) return false;
      p.stamina-=skill.cost;p.regen=.45;this.cooldown=skill.cooldown;
      p.action={type:"skill",id:this.active,dir:direction,age:0,aimPoint,duration:this.active==="reversal"?.50:this.active==="rush"?.66:skill.charge+.34,step:0};
      this.run.impact("skill",p.x,p.y-14,.25,{dir:direction});
      this.run.emit("skill");
      this.event("ON_SKILL_ACTIVATED",this.active);
      this.ping(skill.name);
      return true;
    }
    advanceSkill(action,input) {
      const {id,dir,age}=action, r=this.run,p=r.player;
      const profile=ACTIVES[id];
      if(age<profile.charge || action.step>0&&id!=="rush" || id==="reversal") return;
      if(id==="rush"&&action.step>0) {
        if(action.step>1 || age<.37) return;
        action.dir=typeof input.aim==="number"?input.aim:dir;
      }
      action.step++;
      if(id==="lance") {this.shots.push({x:p.x,y:p.y,dir,age:0});return;}
      if(id==="barrier") {this.barrier={x:p.x+Math.cos(dir)*44,y:p.y+Math.sin(dir)*44,dir,until:r.time+2};return;}
      if(id==="judgment") {
        const aim=action.aimPoint;
        const point=aim&&near(p,aim)<=175?aim:{x:p.x+Math.cos(dir)*133,y:p.y+Math.sin(dir)*133};
        r.effect("burst",point.x,point.y,{duration:.48});
        for(const e of r.enemies) if(near(e,point)<63) this.skillHit(e,70,35,20);
        return;
      }
      const origin={x:p.x,y:p.y,dir:action.dir};
      r.moveSkill(action.dir,id==="rush"?49:75);
      r.effect("slash",p.x,p.y,{dir:action.dir,range:84,cone:.7,color:id==="rush"?"#b8d0ff":"#ff909a",duration:.22});
      for(const enemy of r.enemies) {
        const crossed=r.skillContains(enemy,action.dir,near(origin,p)+26,.34,origin);
        if(crossed || r.skillContains(enemy,action.dir,84,.70)) this.skillHit(enemy,id==="rush"?22:45,9,0);
      }
    }
    specialCounter(data,enemy) {
      const action=this.run.player.action;
      if(action?.type!=="skill"||action.id!=="reversal"||action.step||action.age>=.5||!data.parry||!enemy||!eligible(enemy)) return false;
      action.step=1;
      this.skillHit(enemy,65,20,0);
      this.ping("KING’S REVERSAL");
      return true;
    }
    tick(dt) {
      const r=this.run, t=r.time;
      const rate=clamp((this.has("Focused")?.06:0)+(r.inventory.accessory.cooldown??0)+(r.encounterEffects.cooldown?.10:0),0,.25);
      this.cooldown=Math.max(0,this.cooldown-dt*(1+rate));
      const hp=r.player.hp/r.maxHp;
      this.stand=Boolean(this.rank("stand")&&(hp<.30||this.stand&&hp<=.35));
      if(this.barrier?.until<=t) this.barrier=null;
      if(this.decoy?.until<=t) this.decoy=null;
      this.fields=this.fields.filter(field=>field.until>t);
      this.delays=this.delays.filter(echo=>{if(echo.due>t)return true;this.pulse(echo,69,20,0);return false;});
      for(const shot of this.shots) {
        shot.age+=dt;shot.x+=Math.cos(shot.dir)*440*dt;shot.y+=Math.sin(shot.dir)*440*dt;
        if(r.projectileBlocked(shot)) {shot.age=99;continue;}
        const enemy=r.enemies.find(e=>eligible(e)&&near(e,shot)<e.radius+6);
        if(enemy) {this.skillHit(enemy,35,5,25);shot.age=99;}
      }
      this.shots=this.shots.filter(shot=>shot.age<1.6);
    }
  }
  const handlers={
    ON_PERFECT_PARRY:(build,data)=>build.parry(data),ON_PERFECT_DODGE:build=>build.dodge(),
    ON_DAMAGE_TAKEN:(build,data)=>build.onDamage(data),ON_ATTACK_MISS:build=>build.miss(),
    ON_ATTACK_HIT:(build,{action,enemy})=>build.strike(action,enemy),
    ON_HEAVY_ATTACK_HIT:(build,{action,enemy})=>build.strike(action,enemy),
    ON_ENEMY_DEFEATED:(build,enemy)=>build.defeat(enemy),
    ON_ROOM_CLEARED:build=>{build.shots=[];build.delays=[];}
  };
  Build.prototype.event=function(name,data) {
    const handler=handlers[name];
    if(!handler || this.dispatching.has(name)) return;
    this.dispatching.add(name);
    try { return handler(this,data); } finally { this.dispatching.delete(name); }
  };
  globalThis.FrostBuild={Build};
})();
