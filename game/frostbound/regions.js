(() => {
  "use strict";
  const {random}=FrostItems;
  const {route:legacyRoute,NPC,DISCOVERY,SIDE}=FrostWorld;
  const BOUNDS={left:66,right:894,top:112,bottom:536};
  const GATE={x:480,y:130};
  const SPAWNS=[[480,155],[797,155],[163,155],[235,370],[725,370],[480,480]];
  const ENTRY={x:480,y:469};
  const REGIONS=[
    {id:"outpost",name:"The Forgotten Outpost",theme:"courtyard"},
    {id:"forest",name:"Hollowpine Forest",theme:"forest"},
    {id:"depths",name:"Crystal Depths",theme:"crystal"},
    {id:"capital",name:"The Silent Capital",theme:"gallery"},
    {id:"throne",name:"The Frozen Throne",theme:"throne"}
  ];
  const WEIGHTS=Object.freeze({combat:45,elite:12,merchant:10,treasure:10,rest:8,lore:6,event:7,secret:2});
  const DESCRIPTIONS={
    combat:["Snowbound Passage","Wind presses snow into the tracks of a recent patrol."],
    elite:["The Broken Watch","The last watchman still stands at the barricade."],
    merchant:["A Light in the Snow","Eldric’s lantern shows through a crack in the wall."],
    treasure:["Supply Vault","A brass latch protrudes from a frozen supply chest."],
    rest:["Sheltered Hearth","A stone wall still holds enough heat to warm your hands."],
    lore:["Weathered Inscription","Scratched words show through the layers of frost."],
    event:["A Place to Decide","An object in this room offers a choice."],
    secret:["Hidden Cache","A damaged wall conceals a chamber."]
  };
  const PATHS={
    safe:{name:"The Quiet Trail",difficulty:"Low",description:"Follow the sheltered trail to a place to prepare.",reward:"Standard supplies"},
    danger:{name:"The Frozen Pass",difficulty:"High",description:"Take the exposed route and face an elite patrol.",reward:"Rare-or-higher equipment opportunity · +25% room Crowns"}
  };
  const optionalWeights=Object.entries(WEIGHTS);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const point=([x,y])=>({x,y});
  const place=(where,pillars,gap=18)=>pillars.every(([x,y,radius])=>distance(where,{x,y})>radius+gap);
  function weightedRoom(rng,mode) {
    const entries=optionalWeights.map(([id,value])=>[id,id==="elite"&&mode==="hardcore"?value*1.25:value]);
    let draw=rng()*entries.reduce((sum,[,weight])=>sum+weight,0);
    return entries.find(([,weight])=>(draw-=weight)<0)[0];
  }
  function withGeometry(room,id,region) {
    const points=SPAWNS.map(point).filter(spawn=>place(spawn,room.pillars,29)&&distance(spawn,ENTRY)>=195);
    const fallback=SPAWNS.map(point).filter(spawn=>place(spawn,room.pillars,29));
    const spawns=[...points,...fallback.filter(spawn=>!points.some(other=>distance(spawn,other)<1))];
    return {...room,id,region,entry:ENTRY,exit:GATE,spawns,
      ...(room.side?{side:withGeometry(room.side,id+"/secret",region)}:{})};
  }
  function template(region,stage,type,pillars,rng,slot) {
    const [name,story]=DESCRIPTIONS[type];
    const combat=type==="combat"||type==="elite";
    const enemies=combat?FrostEnemyAI.group(stage,rng,type==="elite"):[];
    if(!combat) rng();
    const obstacles=combat?pillars:pillars.filter(obstacle=>place(DISCOVERY,[obstacle],22)&&place(NPC,[obstacle],22));
    return {stage,type,name,story,theme:region.theme,pillars:obstacles,enemies,
      ...(combat?{hazard:FrostEnvironment.byRegion[stage-1]}:{}),
      objective:combat?"Clear the encounter to open the north gate.":"Continue through the north gate when ready.",
      ...(type==="lore"?{lore:"The watch recorded a winter with forty days of darkness. The next year, it left the count unfinished."}:{}),
      template:slot};
  }
  function generate(mode,seed) {
    const backbone=legacyRoute(mode,seed);
    if(mode==="boss") return backbone.map((room,index)=>withGeometry(room,"rush/"+index,room.name));
    const rng=random(seed^0x8FA01C29);
    const eventRng=random(seed^0x5C337DA2);
    const used=new Set();
    function eventRoom(room,stage,preferred) {
      const id=preferred&&!used.has(preferred)?preferred:FrostEvents.pickEvent(eventRng,stage,used);
      if(!id) return room;
      used.add(id);
      const event=FrostEvents.EVENTS[id];
      const side=id==="traveler"?{...template(REGIONS[stage-1],stage,"treasure",room.pillars,rng,"cache"),hidden:true}:room.side;
      return {...room,type:"event",eventId:id,name:event.name,story:event.text,enemies:[],waves:undefined,hazard:null,
        side,secretClue:id==="traveler"?"spoken":room.secretClue,secretRequiresReveal:id==="traveler",
        objective:"Approach the center marker to inspect the event."};
    }
    return REGIONS.flatMap((region,index)=>{
      const stage=index+1;
      const original=backbone.filter(room=>room.stage===stage).map(room=>{
        if(!room.enemies.length||room.type==="boss") return room;
        const encounterRng=random(seed^Math.imul(stage,0x6B9C65B5));
        const enemies=FrostEnemyAI.group(stage,encounterRng,room.type==="elite");
        const waves=room.waves.map((_,index)=>index===0?enemies:FrostEnemyAI.group(stage,encounterRng,room.type==="elite"));
        return {...room,enemies,waves,hazard:FrostEnvironment.byRegion[stage-1]};
      });
      const arena=original.find(room=>room.enemies.length);
      const rolled=weightedRoom(rng,mode);
      const type=stage!==5||["event","elite","secret"].includes(rolled)?rolled:"combat";
      let extra=template(region,stage,type,arena.pillars,rng,"detour");
      if(type==="event") extra=eventRoom(extra,stage);
      if(type==="secret") extra={...template(region,stage,"lore",arena.pillars,rng,"detour"),secretClue:"cracked",
        side:{...template(region,stage,"treasure",arena.pillars,rng,"cache"),hidden:true}};
      let rooms;
      if(stage===5) rooms=[extra,...original];
      else if(original.length===1) rooms=[arena,extra,rng()<.6?eventRoom(template(region,stage,"rest",arena.pillars,rng,"shelter"),stage,"traveler"):
        template(region,stage,"rest",arena.pillars,rng,"shelter")];
      else rooms=[...original,extra];
      if(stage===2) {
        const location=rooms[2].type==="rest"?2:1;
        rooms[location]={...rooms[location],side:rooms[location].side??miniRoom(stage,region,arena.pillars)};
      }
      if(stage===3) {
        const shrine=rooms.findIndex(room=>room.type==="rest");
        rooms[shrine]={...rooms[shrine],side:miniRoom(stage,region,arena.pillars)};
      }
      return rooms.map((room,number)=>{
        const id=region.id+"/"+number;
        if(room.template!=="detour"||stage===5) return withGeometry(room,id,region.name);
        const branch=random((seed^0x552E19A1)+stage*12091);
        const shelter=["merchant","rest","lore","treasure"];
        let protection=room.enemies.length?template(region,stage,shelter[Math.floor(branch()*shelter.length)],arena.pillars,branch,"detour"):room;
        if(room.side?.type==="mini") protection={...protection,side:room.side};
        if(stage===1&&protection.type!=="event") protection=eventRoom(protection,stage,"camp");
        if(stage===3&&protection.type!=="event"&&branch()<.55) protection=eventRoom(protection,stage,"resonance");
        if(stage===4&&protection.type!=="event"&&branch()<.55) protection=eventRoom(protection,stage,"decree");
        const danger={...template(region,stage,"elite",arena.pillars,branch,"danger"),hazard:arena.hazard,path:"danger",
          ...(room.side?.type==="mini"?{side:room.side}:{})};
        return {...withGeometry(room,id,region.name),paths:{
          safe:withGeometry({...protection,path:"safe"},id+"/safe",region.name),
          danger:withGeometry(danger,id+"/danger",region.name)
        }};
      });
    });
  }
  function miniRoom(stage,region,pillars) {
    const type=stage===2?"hollow":"heart";
    const fighter=FrostMiniBosses.fighters[type];
    return {stage,type:"mini",name:fighter.name,theme:region.theme,pillars,enemies:[type],
      story:stage===2?"The warden’s tracks break through an untouched drift.":"A scarred chamber pulses in time with the crystals.",
      objective:"Defeat the optional guardian to reopen the north gate."};
  }
  class Route {
    constructor(mode,seed) { this.rooms=generate(mode,seed); this.index=-1; this.secret=null; }
    get room() { return this.secret??this.rooms[Math.max(0,this.index)]; }
    get nextRoom() { return this.rooms[this.index+1]; }
    get options() { return this.nextRoom?.paths??null; }
    choose(path) {
      if(!this.options || !Object.hasOwn(this.options,path)) return false;
      this.rooms[this.index+1]=this.options[path];
      return true;
    }
    advance() {
      if(!this.nextRoom||this.options) return false;
      this.index++;
      this.secret=null;
      return true;
    }
    enterSecret() {
      if(this.secret||!this.room.side) return false;
      this.secret=this.room.side;
      return true;
    }
  }
  function geometryValid(room) {
    const inside=p=>p.x>=BOUNDS.left&&p.x<=BOUNDS.right&&p.y>=BOUNDS.top&&p.y<=BOUNDS.bottom;
    const anchors=[room.entry,room.exit,...room.spawns];
    if(room.type==="merchant") anchors.push(NPC);
    if(["rest","treasure","lore","event"].includes(room.type)) anchors.push(DISCOVERY);
    if(room.side) anchors.push(SIDE);
    return anchors.every(p=>inside(p)&&place(p,room.pillars))
      && room.spawns.length>=4 && room.pillars.every(([x,y,r])=>Math.abs(480-x)>r+24);
  }
  globalThis.FrostRegions={BOUNDS,GATE,ENTRY,SPAWNS,REGIONS,WEIGHTS,PATHS,generate,Route,geometryValid};
})();
