(() => {
  "use strict";
  const forms={
    stalker:{scale:.92,crouch:5,step:1.5,windup:-1.18,stroke:1.22,tilt:.18},
    soldier:{scale:1,crouch:1.3,step:1.13,windup:-1.53,stroke:1.18,tilt:.11},
    archer:{scale:.94,crouch:1,step:1.12,windup:-.85,stroke:.28,tilt:.09},
    wisp:{scale:1,crouch:0,step:1,windup:0,stroke:0,tilt:0},
    sentinel:{scale:1.24,crouch:1,step:.78,windup:-1.46,stroke:1.33,tilt:.17},
    hunter:{scale:.99,crouch:2.3,step:1.31,windup:-1.02,stroke:.84,tilt:.12},
    burrower:{scale:1.17,crouch:4,step:.76,windup:-.72,stroke:1,tilt:.20},
    remnant:{scale:1.12,crouch:.2,step:.94,windup:-1.69,stroke:1.21,tilt:.14}
  };
  const fallback={scale:1,crouch:0,step:1,windup:-1.05,stroke:1.04,tilt:.11};
  const kingMoves={
    kingSlash:[-1.12,1.33,.16,3,0],kingThrust:[.68,1.60,.28,3,13],kingSweep:[-1.79,1.43,.22,7,0],
    kingPillars:[-2.14,-.16,.08,3,0],kingWave:[-1.97,.19,.19,7,0],
    kingCombo:[-.92,1.22,.15,3,0],kingComboTwo:[1.47,-1.31,.17,4,0],kingComboThree:[-2.02,1.52,.30,7,0],
    kingCollapse:[-2.62,-.27,.11,3,0],kingJudgment:[-2.34,1.18,.32,13,0],kingCounter:[.61,1.55,.24,4,9]
  };
  const phaseColors=["#aedcf5","#99e6ff","#f49cae"];
  const blend=(from,to,amount)=>from+(to-from)*amount;
  function posture(enemy,pose,motion) {
    const ids=enemy.type==="elite"?"remnant":enemy.type;
    const form=forms[ids]??fallback;
    const t=pose.progress, state=pose.state;
    const ranged=enemy.type==="archer"||enemy.type==="hunter"&&(!enemy.attack||enemy.attack.data.shape==="arrow");
    let bend=form.crouch,lean=0,weapon=.23,draw=0;
    let push=0;
    if(state==="enemy-attack") {
      if(pose.phase==="startup") {
        bend+=t*(ids==="stalker"?7:ids==="burrower"?8:3);
        lean=-form.tilt*t;weapon=blend(.18,form.windup,t);
        draw=ranged?t:0;
      } else if(pose.phase==="active") {
        lean=blend(-form.tilt,form.tilt,t);
        weapon=blend(form.windup,form.stroke,t);
        bend+=ids==="stalker"&&enemy.attack?.id==="leap"?-6*Math.sin(t*Math.PI):0;
        draw=ranged?(1-t)*.28:0;
      } else {
        bend+=(ids==="soldier"?7:4)*(1-t);
        lean=form.tilt*(1-t);weapon=blend(form.stroke,.26,t);
      }
    } else if(state==="defend") {
      bend+=2;lean=-.07;weapon=-1.08;
    } else if(state==="stagger") {
      bend+=8;lean=.36;weapon=1.3;
    }
    if(enemy.type==="king") {
      const move=kingMoves[enemy.attack?.id];
      if(move&&state==="enemy-attack") {
        const [start,end,weight,dip,reach]=move;
        weapon=pose.phase==="startup"?blend(.14,start,t):pose.phase==="active"?blend(start,end,t):blend(end,.24,t);
        lean=pose.phase==="startup"?-weight*t:pose.phase==="active"?blend(-weight,weight,t):weight*(1-t);
        bend=pose.phase==="startup"?dip*t*.45:pose.phase==="active"?dip*Math.sin(t*Math.PI):dip*(1-t)*.6;
        push=pose.phase==="active"?reach*Math.sin(t*Math.PI*.85):0;
      } else if(state==="defend") {weapon=-1.22;bend=2;lean=-.13;}
      else if(state==="transition") {weapon=-2.2;lean=0;bend=0;}
    }
    const recoil=motion&&enemy.flash>0&&state!=="stagger"?Math.min(1,enemy.flash/.12)*3:0;
    return {form,bend,lean,weapon,draw,ranged,recoil,push};
  }
  globalThis.FrostEnemyAnimation={forms,posture,kingMoves,phaseColors};
})();
