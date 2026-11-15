(() => {
  "use strict";
  const profiles={
    edge:[800,206,.093,.068],fang:[1360,444,.061,.058],spear:[1600,288,.082,.063],
    great:[375,75,.205,.115],ash:[629,131,.119,.077],moon:[1940,657,.071,.052]
  };
  const keys=new Set(["light","heavy","hit","guard","guard-miss","perfect","stagger","dash","dodge","step","hurt","enemy-defeat","tell","arrow","phase"]);
  const spacing={step:.055,hit:.035,"enemy-defeat":.05,arrow:.048,tell:.045};

  function create(tone,noise) {
    const times=new Map();
    let serial=0;
    function play(event,time) {
      if(!keys.has(event.kind)) return false;
      const last=times.get(event.kind)??-Infinity;
      if(time-last<(spacing[event.kind]??.028)) return true;
      times.set(event.kind,time);
      const variation=1+((serial++%5)-2)*.036;
      const tap=(a,b,d,v,shape="triangle",offset=0)=>tone(a*variation,b*variation,d,v,shape,offset);
      const grit=(frequency,duration,level,type="bandpass",offset=0)=>noise(frequency*variation,duration,level,type,offset);
      switch(event.kind) {
        case "light":case "heavy": {
          const [from,to,length,level]=profiles[event.family]??profiles.edge;
          const heavy=event.kind==="heavy";
          const combo=1+(event.combo??0)*.026;
          tap(from*combo,to*combo,length*(heavy?1.42:1),level, event.family==="moon"?"sine":"triangle");
          grit(from*(event.family==="spear"?.88:1.6),length,.043*(heavy?1.6:1),"bandpass");
          if(event.family==="fang"&&heavy) tap(from*.92,to,length*.7,.047,"triangle",.037);
          if(event.family==="great"&&heavy) tap(108,42,.20,.067,"sine");
          break;
        }
        case "hit":
          if(event.category==="block") {tap(510,260,.15,.10);tap(1030,701,.10,.034,"sine");grit(490,.11,.068);}
          else if(event.category==="heavy"||event.category==="bossHeavy") {
            tap(146,55,.23,.12,"sine");grit(665,.16,.088);tap(876,366,.093,.042,"triangle");
          } else {tap(272,91,.104,.072);grit(event.category==="bossHit"?859:1390,.082,.039);}
          break;
        case "guard":tap(372,496,.072,.042);break;
        case "guard-miss":tap(225,134,.105,.026,"sine");break;
        case "perfect":
          tap(1861,1216,.24,.103);tap(2488,1876,.36,.071,"sine",.012);
          tap(934,674,.23,.073,"triangle",.027);grit(2700,.12,.088,"highpass");break;
        case "stagger":tap(741,168,.29,.113);grit(1450,.21,.112);tap(119,44,.2,.074,"sine");break;
        case "dash":grit(940,.158,.105);tap(234,70,.14,.069,"sine");break;
        case "dodge":tap(740,1183,.13,.042,"sine");break;
        case "step":grit(312,.075,.027);tap(78,44,.058,.013,"sine");break;
        case "hurt":
          tap(event.boss&&event.heavy?86:130,43,.245,event.boss&&event.heavy?.17:.11,"sine");
          grit(event.heavy?420:610,.13,.064);break;
        case "enemy-defeat":
          tap(event.boss?183:164,47,event.boss?.62:.24,.081,"sine");grit(event.boss?320:500,.27,.078);
          if(event.boss) tap(513,248,.52,.075,"sine",.095);
          break;
        case "tell":
          if(event.heavy) {tap(event.boss?102:149,80,.21,.092,"triangle");grit(257,.15,.026);}
          else {tap(438,674,.15,.058,"triangle");if(event.boss) tap(152,199,.19,.045,"sine",.012);}
          break;
        case "arrow":grit(1877,.115,.040,"highpass");tap(447,229,.10,.039,"sine");break;
        case "phase":
          tap(event.phase===3?55:79,39,.84,.139,"sine");tap(331,219,.54,.068,"triangle",.07);
          grit(event.phase===3?850:1800,.30,.088);break;
      }
      return true;
    }
    return {play};
  }
  globalThis.FrostCombatAudio={create,profiles};
})();
