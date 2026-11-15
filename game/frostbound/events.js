(() => {
  "use strict";
  const {random,ITEMS,getRarity,familyOf}=FrostItems;
  const {PASSIVES}=FrostLoot;
  const leave={id:"leave",label:"Leave",detail:"Continue with your current supplies.",effect:"leave"};
  const choice=(id,label,detail,effect,cost={})=>({id,label,detail,effect,cost});
  const EVENTS={
    altar:{name:"The Frozen Altar",stages:[1,2,4,5],weight:10,text:"The altar seems to respond to your presence.",choices:[
      choice("crowns","Offer 30 Frost Crowns","Learn one eligible Rare Passive.","passive",{crowns:30}),
      choice("blood","Offer 20 HP","Receive an available Rare-or-higher Relic.","relic",{hp:20}),leave]},
    wager:{name:"The Stranger’s Wager",stages:[2,3,4],weight:8,text:"“Care to test your luck?” The masked wanderer places a coin on the broken parapet.",choices:[
      choice("wager","Wager 40 Frost Crowns","Equal chance to receive 80 Crowns or lose the wager.","wager",{crowns:40}),
      choice("duel","Challenge the Stranger","Fight a duel for a Rare equipment opportunity.","duel"),leave]},
    shrine:{name:"The Broken Shrine",stages:[1,2,3,4,5],weight:9,text:"The stone is cracked, but something within it still glows.",choices:[
      choice("pray","Pray","Restore up to 20 HP.","heal20"),
      choice("read","Examine the symbols","Reveal a lore passage and gain 20 Crowns.","symbols"),
      choice("destroy","Destroy the shrine","Fight its guardian for a Rare Relic opportunity.","guardian")]},
    forge:{name:"The Abandoned Forge",stages:[1,3,4,5],weight:9,text:"“Steel remembers the hands that shaped it,” says the Forgebound Spirit.",choices:[
      choice("weapon","Strengthen current weapon","Add 8% base damage. Maximum two improvements per weapon.","forgeWeapon",{crowns:60}),
      choice("armor","Reinforce current armor","Add 3 defense points. Maximum two improvements per armor.","forgeArmor",{crowns:60}),leave]},
    mirror:{name:"The Mirror of Winter",stages:[2,3,4,5],weight:7,text:"The reflection raises its weapon before you do.",choices:[
      choice("touch","Touch the mirror","Duel a reflection carrying your weapon family. Victory offers an Epic Passive.","mirror"),
      choice("examine","Examine the mirror","Learn what the reflection was guarding.","mirrorLore"),leave]},
    fire:{name:"The Last Fire",stages:[1,2,3,4,5],weight:10,text:"For a moment, the world feels warm.",choices:[
      choice("rest","Rest","Restore up to 35 HP.","heal35"),
      choice("meditate","Meditate","Active cooldowns recover 10% faster for the next two encounters.","meditate"),leave]},
    camp:{name:"The Abandoned Camp",stages:[1],weight:6,text:"The fire died long before the soldiers did.",choices:[
      choice("search","Search the supplies","65% chance of Crowns, 25% chance of a Flask, 10% chance of an ambush.","camp"),
      choice("journal","Examine the journal","Read the final watch report.","journal"),leave]},
    traveler:{name:"The Lost Traveler",stages:[2],weight:6,text:"“I've been walking for three days. Every path leads back here.”",choices:[
      choice("flask","Give a Crimson Flask","The next damaging hit is reduced by up to 15.","blessing",{potion:"flask"}),
      choice("directions","Ask for the way forward","Reveal a hidden route in this room.","reveal"),leave]},
    resonance:{name:"The Resonance Chamber",stages:[3],weight:6,text:"The crystal hums as you approach.",choices:[
      choice("touch","Touch the crystal","Restore 30 Stamina. Active attacks deal 10% more damage for two encounters.","resonance"),
      choice("break","Break the crystal","Gain 30–55 Crowns, then fight an elite guardian.","resonanceFight"),leave]},
    decree:{name:"The King’s Decree",stages:[4],weight:6,text:"“By order of the Crown, the winter shall be preserved until the kingdom is restored.”",choices:[
      choice("read","Read the decree","Reveal the scribe’s final note.","decree"),
      choice("burn","Burn the decree","Reveal a cache of 25 Frost Crowns.","cache"),leave]}
  };
  function pickEvent(rng,stage,used) {
    const eligible=Object.keys(EVENTS).filter(id=>EVENTS[id].stages.includes(stage)&&!used.has(id));
    let roll=rng()*eligible.reduce((sum,id)=>sum+EVENTS[id].weight,0);
    return eligible.find(id=>(roll-=EVENTS[id].weight)<0);
  }
  const pick=(r,options)=>options[Math.floor(r.eventRandom()*options.length)];
  const relics=Object.keys(ITEMS).filter(id=>ITEMS[id].slot==="accessory"&&["Rare","Epic","Legendary"].includes(getRarity(id)));
  const canLearn=r=>Object.keys(PASSIVES).filter(id=>PASSIVES[id].tier===2&&(r.build.ranks[id]??0)<PASSIVES[id].ranks.length);
  function reason(r,option) {
    const cost=option.cost??{};
    if(r.inventory.crowns<(cost.crowns??0)) return "Not enough Frost Crowns.";
    if(r.player.hp<=(cost.hp??0)) return "You must survive the offering.";
    if(cost.potion&&!r.inventory.potions.includes(cost.potion)) return "No Crimson Flask.";
    if(option.effect==="passive"&&!canLearn(r).length) return "All eligible Passives are at maximum rank.";
    if(option.effect==="relic"&&!relics.some(id=>r.inventory.canObtain(id))) return "All eligible Relics are already owned.";
    if(option.effect==="forgeWeapon"||option.effect==="forgeArmor") {
      const slot=option.effect==="forgeWeapon"?"weapon":"armor";
      if((r.forge[r.inventory.gear[slot]]??0)>=2) return "This item is already reinforced twice.";
    }
    return "";
  }
  function resolve(r,id) {
    const event=EVENTS[r.room.eventId], option=event?.choices.find(item=>item.id===id);
    if(!option||r.target!=="event"||!r.equipmentAccess.allowed||r.eventsDone.has(r.room.eventId)) return null;
    const error=reason(r,option);
    if(error) return {error};
    const cost=option.cost??{};
    r.eventsDone.add(r.room.eventId);
    r.inventory.crowns-=cost.crowns??0;
    r.player.hp-=cost.hp??0;
    if(cost.potion) r.inventory.take(r.inventory.potions.indexOf(cost.potion));
    const heal=amount=>{const gain=Math.min(amount,r.maxHp-r.player.hp);r.player.hp+=gain;return {text:"Recovered "+gain+" HP."};};
    const money=amount=>{r.inventory.crowns+=amount;return {text:"Gained "+amount+" Frost Crowns."};};
    const duel=(foes,reward)=>({foes,reward,text:"An enemy answers the challenge. Read its telegraph."});
    switch(option.effect) {
      case "leave":return {text:"You continue through the snow."};
      case "heal20":return heal(20);
      case "heal35":return heal(35);
      case "cache":return money(25);
      case "symbols":return {...money(20),text:"The symbols mark a guardian who stayed behind voluntarily. You take 20 Crowns from the offering bowl."};
      case "wager":return r.eventRandom()<.5?money(80):{text:"The coin lands on ice. You lost 40 Crowns."};
      case "duel":return duel(["elite"],"elite");
      case "guardian":return duel(["sentinel"],"event-relic");
      case "mirror":return duel(["reflection"],"event-epic");
      case "reveal":r.secretRevealed=true;return {text:"“Follow the silence.” A hidden passage opens at the west wall."};
      case "journal":return {text:"“Close the eastern gate. Do not wait for us.” The rest of the page is empty."};
      case "decree":return {text:"The scribe’s note reads: “The gates must remain shut, even to our own.”"};
      case "mirrorLore":return {text:"The glass was made to remember the faces of those the crown had forgotten."};
      case "blessing":r.travelBlessing=15;return {text:"The traveler’s blessing will protect you from the next damaging hit."};
      case "meditate":r.encounterEffects.cooldown=2;return {text:"Active skill cooldown recovery is improved for the next two encounters."};
      case "resonance":r.player.stamina=Math.min(100,r.player.stamina+30);r.encounterEffects.power=2;return {text:"Your skill carries the crystal’s resonance for two encounters."};
      case "resonanceFight":money(30+Math.floor(r.eventRandom()*26));return duel(["elite"],"elite");
      case "camp":{
        const roll=r.eventRandom();
        if(roll<.65) return money(20+Math.floor(r.eventRandom()*21));
        if(roll<.90) return r.inventory.obtain("flask")?{text:"You found one Crimson Flask."}:money(20);
        return duel(["stalker","stalker"],"normal");
      }
      case "passive":{
        const key=pick(r,canLearn(r));
        r.build.ranks[key]=(r.build.ranks[key]??0)+1;
        return {text:"Learned "+PASSIVES[key].name+" · Rank "+r.build.ranks[key]+"."};
      }
      case "relic":{
        const key=pick(r,relics.filter(key=>r.inventory.canObtain(key)));
        r.inventory.obtain(key);
        return {text:ITEMS[key].name+" added to Inventory."};
      }
      case "forgeWeapon":case "forgeArmor":{
        const slot=option.effect==="forgeWeapon"?"weapon":"armor", key=r.inventory.gear[slot];
        r.forge[key]=(r.forge[key]??0)+1;
        return {text:ITEMS[key].name+" reinforced · "+r.forge[key]+"/2."};
      }
      default:return null;
    }
  }
  globalThis.FrostEvents={EVENTS,pickEvent,reason,resolve};
})();
