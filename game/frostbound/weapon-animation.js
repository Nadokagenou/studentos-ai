(() => {
  "use strict";
  const {clamp,phase}=FrostAnimation;
  const {ITEMS}=FrostItems;
  const slash=(start,end,lift,weight=1)=>({start,end,lift,weight});
  const thrust=(start,end,lift,reach)=>({start,end,lift,reach,weight:1});
  const sets={
    edge:{color:"#a4e9ff",edge:"#deffff",length:37,width:3,trail:.15,
      light:[slash(1.09,-.96,2),slash(-1.12,.92,-4),slash(.66,-.37,6)],heavy:slash(.43,-.40,15,1.32)},
    fang:{color:"#aaffdf",edge:"#effff4",length:22,width:2.5,trail:.105,hands:2,
      light:[slash(.91,-.69,3),slash(-.92,.63,-3)],heavy:slash(1.02,-.83,5)},
    spear:{color:"#77c8ff",edge:"#e7f7ff",length:62,width:2,trail:.13,
      light:[thrust(-.12,0,2,19),thrust(.18,.055,3,21)],heavy:thrust(-.05,0,5,29)},
    great:{color:"#ffc986",edge:"#ffedd2",length:53,width:5.2,trail:.176,
      light:[slash(1.29,-1.17,6,1.58)],heavy:slash(.58,-.84,23,1.84)},
    ash:{color:"#f65d76",edge:"#fdd2cd",length:38,width:3.7,trail:.14,
      light:[slash(-.88,.79,-3),slash(.97,-.65,8),slash(-.84,.68,1)],heavy:thrust(.15,-.06,6,25)},
    moon:{color:"#d8cfff",edge:"#fbf4ff",length:46,width:1.35,trail:.12,
      light:[thrust(.13,.01,0,17),thrust(-.18,-.055,3,19)],heavy:thrust(-.1,.005,5,29)}
  };
  const byName=Object.fromEntries(Object.keys(sets).map(id=>[ITEMS[id].name,id]));
  const family=weapon=>weapon?.family??byName[weapon?.name];
  const mix=(a,b,t)=>a+(b-a)*t;
  const ease=value=>value*value*(3-2*value);

  function blade(action,age,hand=0) {
    const key=family(action.weapon),set=sets[key];
    if(!set) return null;
    const strike=action.attack,heavy=action.type==="heavy";
    const combo=action.combo??0;
    const move=heavy?set.heavy:set.light[((combo%set.light.length)+set.light.length)%set.light.length];
    const [part,t]=phase(age,strike.windup,strike.active,Math.max(strike.recovery,action.duration-strike.windup-strike.active));
    const lead=hand===0;
    const primary=key!=="fang"||heavy||hand===combo%2;
    const swing=move.reach!==undefined;
    const activeT=key==="fang"&&heavy?clamp(t*(lead?1.72:1.78)-(lead?0:.66)):t;
    const stroke=Math.pow(activeT,move.weight);
    const ready=key==="moon"&&action.counterPose ? .47 : 1.03;
    let heading=part==="startup"?mix(ready,move.start,ease(t)):part==="active"?mix(move.start,move.end,stroke):mix(move.end,1.03,ease(t));
    if(!primary) heading=.86;
    if(key==="fang"&&(!lead||combo===1&&!heavy)) heading=-heading;
    if(part==="active") heading=clamp(heading,-strike.cone,strike.cone);
    const extension=swing?(part==="startup"?-6*t:part==="active"?mix(-6,move.reach,Math.sin(t*Math.PI*.77)):mix(move.reach*.56,0,ease(t))):
      part==="active"?Math.sin(t*Math.PI)*8:0;
    const elevation=part==="startup"?move.lift*t:part==="active"?move.lift*(1-t*1.27):move.lift*-.27*(1-t);
    const dir=action.dir+heading;
    const lateral=key==="fang"?(lead?8:-9):0;
    const grip=Math.max(8,16+extension);
    const x=Math.cos(action.dir)*grip-Math.sin(action.dir)*lateral;
    const y=Math.sin(action.dir)*grip+Math.cos(action.dir)*lateral-15-elevation;
    const len=Math.min(set.length,strike.range-grip-Math.abs(lateral)-3);
    return {x,y,tipX:x+Math.cos(dir)*len,tipY:y+Math.sin(dir)*len,dir,len,set,key,primary,phase:part};
  }
  globalThis.FrostWeaponAnimation={sets,family,blade};
})();
