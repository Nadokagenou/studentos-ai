(() => {
  "use strict";
  const { WIDTH, HEIGHT, BOUNDS, GATE, clamp } = FrostCombat;
  const { NPC, DISCOVERY, SIDE } = FrostWorld;
  const TAU = Math.PI * 2;
  function polygon(ctx, color, points) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fill();
  }
  function box(ctx, color, x, y, width, height) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), width, height);
  }
  function circle(ctx, x, y, radius, fill, outline = "", line = 1) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = line; ctx.stroke(); }
  }

  function drawGate(c, time, reduced) {
    const glow = c.createRadialGradient(GATE.x, GATE.y - 35, 4, GATE.x, GATE.y - 27, 98);
    glow.addColorStop(0, "#b4eeffc9");
    glow.addColorStop(.43, "#6cd3fb60");
    glow.addColorStop(1, "#65cbfa00");
    c.fillStyle = glow;
    c.fillRect(GATE.x - 100, GATE.y - 125, 200, 195);
    polygon(c, "#091625", [[441,100],[441,63],[454,46],[480,27],[506,46],[519,63],[519,100]]);
    box(c, "#94e6fe", 445, 96, 70, 4);
    box(c, "#c7f4ff", 454, 100, 52, 2);
    const shift = reduced ? 0 : Math.sin(time*4) * 6;
    for (const offset of [0, 17, 34]) {
      const y = GATE.y + 16 + offset + shift;
      polygon(c, "#bdf3ffde", [[462,y+3],[480,y-7],[498,y+3],[498,y+7],[480,y-1],[462,y+7]]);
    }
  }

  function arc(c, origin, radius, cone) {
    c.beginPath();
    c.moveTo(origin.x, origin.y);
    c.arc(origin.x, origin.y, radius, origin.dir-cone, origin.dir+cone);
    c.closePath();
  }
  function telegraph(c, enemy) {
    if (!enemy.attack || (enemy.state !== "windup" && enemy.state !== "active")) return;
    const { data, origin, spots, age } = enemy.attack;
    const active = enemy.state === "active";
    const progress = Math.min(1, age / data.windup);
    const edge=data.parry?"#bef3ff":"#ff927c";
    c.save();
    c.fillStyle=data.parry?(active?"#5ac6e582":"#578fc444"):(active?"#ed645e85":"#c84c5856");
    c.strokeStyle = edge;
    c.lineWidth = active ? 3 : 1.8;
    if (!data.parry && !active) c.setLineDash([6, 4]);
    const finish = () => { c.fill(); c.stroke(); };
    if(data.zone) {
      const {x,y,width,height}=data.zone;
      if(enemy.attack.id==="kingCollapse") {
        const safe="#9de8fa5a";
        box(c,safe,BOUNDS.left,y,x-BOUNDS.left,height);
        box(c,safe,x+width,y,BOUNDS.right-x-width,height);
        box(c,"#b4f2ff",x-2,y,2,height);
        box(c,"#b4f2ff",x+width,y,2,height);
      }
      c.beginPath();c.rect(x,y,width,height);finish();
      c.strokeRect(x,y,width,height);
    } else if(data.shape==="wave") {
      c.translate(origin.x,origin.y);c.rotate(origin.dir);
      c.beginPath();c.rect(0,-data.width,data.range,data.width*2);finish();
      c.beginPath();c.moveTo(data.range*progress,-data.width);c.lineTo(data.range*progress,data.width);c.stroke();
    } else if (spots || data.shape === "ring") {
      for (const spot of spots ?? [origin]) {
        c.beginPath(); c.arc(spot.x, spot.y, data.range, 0, TAU); finish();
        c.beginPath(); c.arc(spot.x, spot.y, Math.max(2, data.range * progress), 0, TAU); c.stroke();
      }
    } else {
      arc(c, origin, data.range, data.cone); finish();
      c.globalAlpha = .62;
      arc(c, origin, Math.max(2, data.range * progress), data.cone); c.fill();
    }
    c.restore();
  }
  function drawKingPresence(c,enemy,time,reduced) {
    if(enemy.type!=="king"||enemy.state==="dead"||enemy.state==="spawn") return;
    const color=FrostEnemyAnimation.phaseColors[enemy.phase-1];
    const x=enemy.x,y=enemy.y;
    if(enemy.state==="transition") {
      const t=clamp((1.5-enemy.timer)/1.5,0,1);
      c.save();
      c.globalAlpha=.64-t*.24;
      circle(c,x,y,37+t*(reduced?30:134),"",color,3);
      if(!reduced) for(let i=0;i<8;i++) {
        const a=i*Math.PI*.25,far=38+t*145;
        c.strokeStyle=color;c.lineWidth=1.4;
        c.beginPath();c.moveTo(x+Math.cos(a)*30,y+Math.sin(a)*30);
        c.lineTo(x+Math.cos(a+.16)*far*.68,y+Math.sin(a+.16)*far*.68);
        c.lineTo(x+Math.cos(a)*far,y+Math.sin(a)*far);c.stroke();
      }
      c.restore();
    } else if(enemy.phase>1) {
      c.save();c.globalAlpha=.56;
      c.strokeStyle=color;c.lineWidth=enemy.phase===3?2.1:1.3;
      c.beginPath();c.ellipse(x,y+4,34,12,0,0,TAU);c.stroke();
      c.restore();
    }
    const attack=enemy.attack;
    if(attack?.id==="kingPillars"&&["windup","active"].includes(enemy.state)) {
      const rise=enemy.state==="active"?1:clamp(attack.age/attack.data.windup,0,1)*.49;
      for(const spot of attack.spots) {
        const sx=spot.x,sy=spot.y,h=rise*54;
        polygon(c,"#76b7db84",[[sx-13,sy],[sx-10,sy-h*.59],[sx,sy-h],[sx+12,sy-h*.65],[sx+13,sy]]);
        polygon(c,"#c2ebf8aa",[[sx,sy-h],[sx+12,sy-h*.65],[sx+4,sy],[sx,sy]]);
      }
    }
    if(!reduced&&!attack&&enemy.state!=="transition") {
      for(let i=0;i<3;i++) {
        const age=(time*.82+i*.31)%1;
        box(c,color,x+Math.cos(enemy.dir)*(17+i*4)-Math.sin(time+i)*4,y-23-age*20,2,2);
      }
    }
  }
  function tellMark(c,enemy) {
    if(enemy.state!=="windup"||!enemy.attack) return;
    const {data,age}=enemy.attack;
    const x=enemy.x,y=enemy.y-(enemy.boss?101:enemy.mutation?79:57);
    const color=data.parry?"#c8f4ff":"#ffbf9c";
    if(data.parry) {
      polygon(c,"#163147",[[x,y-7],[x+7,y],[x,y+7],[x-7,y]]);
      polygon(c,color,[[x,y-4],[x+4,y],[x,y+4],[x-4,y]]);
    } else {
      polygon(c,"#9b3e49",[[x,y-8],[x+9,y+5],[x-9,y+5]]);
      box(c,color,x-1,y-4,2,5);box(c,color,x-1,y+3,2,1);
    }
    box(c,"#172337",x-11,y+9,22,2);
    box(c,color,x-11,y+9,22*clamp(age/data.windup,0,1),2);
  }

  function drawAttackWeapon(c,fighter,action,motion,pose,quality,armor) {
    const first=FrostWeaponAnimation.blade(action,action.age);
    if(!first) return;
    if(pose.trailAction!==action) {
      pose.trailAction=action;
      pose.trails=[[],[]];
    }
    const draw=(part,hand)=>{
      if(motion) {
        const track=pose.trails[hand];
        if(part.primary&&part.phase==="active"&&track.at(-1)?.age!==action.age) {
          if(track.length===18) track.shift();
          track.push({x:fighter.x+part.tipX,y:fighter.y+part.tipY,age:action.age});
        }
        const limit=quality==="low"?2:quality==="medium"?5:10;
        const skip=Math.max(1,Math.floor(track.length/limit));
        c.save();
        c.strokeStyle=part.set.color;
        c.lineWidth=quality==="low"?1.2:part.key==="great"?3.5:2.2;
        for(let i=Math.max(1,track.length-limit*skip);i<track.length;i+=skip) {
          const from=track[i-1],to=track[i];
          const age=action.age-from.age;
          if(age>=part.set.trail) continue;
          c.globalAlpha=(1-age/part.set.trail)*.69;
          c.beginPath();c.moveTo(from.x,from.y);c.lineTo(to.x,to.y);c.stroke();
        }
        c.restore();
      }
      const reachX=fighter.x+part.x,reachY=fighter.y+part.y;
      const shoulderX=fighter.x+Math.cos(action.dir)*(hand?1:8),shoulderY=fighter.y-22;
      c.strokeStyle="#141e33";c.lineWidth=6;
      c.beginPath();c.moveTo(shoulderX,shoulderY);c.lineTo(reachX,reachY);c.stroke();
      c.strokeStyle=armor.color;c.lineWidth=3;
      c.stroke();
      c.save();
      c.translate(reachX,reachY);
      c.rotate(part.dir);
      const w=part.set.width,len=part.len;
      box(c,"#c4a492",-8,-2,9,4);
      if(part.key==="spear") {
        box(c,"#896d59",2,-1.4,len-13,2.8);
        polygon(c,part.set.color,[[len-17,-4],[len-4,-3],[len,0],[len-4,3],[len-17,4]]);
        box(c,part.set.edge,len-14,-.6,12,1.2);
      } else {
        polygon(c,part.set.color,[[0,-w],[len-7,-w*.8],[len,0],[len-7,w*.8],[0,w]]);
        box(c,part.set.edge,3,-.6,len-7,1.2);
        box(c,part.key==="moon"?"#ead3a5":"#aa8a63",-3,-w-2,3,w*2+4);
      }
      if(motion&&part.phase==="active"&&part.primary) box(c,part.set.edge,len-3,-1,3,2);
      c.restore();
    };
    if(first.set.hands===2) draw(FrostWeaponAnimation.blade(action,action.age,1),1);
    draw(first,0);
  }

  function drawFighter(c,fighter,time,gear,motion,pose=FrostAnimation.preview(fighter,time,motion),quality="high") {
    const isPlayer = Boolean(gear);
    const { x, y, dir } = fighter;
    const kind = fighter.type;
    const king = fighter.boss;
    const sentinel = ["sentinel","dummy","elite","keeper"].includes(kind);
    const enemyPose=isPlayer?null:FrostEnemyAnimation.posture(fighter,pose,motion);
    const archer=Boolean(enemyPose?.ranged);
    const spawn = fighter.state === "spawn";
    const dead = fighter.state === "dead" || (isPlayer && fighter.dead !== undefined);
    if (dead && !isPlayer && fighter.dead > .65) return;
    if(kind==="wisp") {
      c.save();
      c.globalAlpha=dead?Math.max(0,1-fighter.dead/.65):spawn?.35:1;
      const charge=pose.phase==="startup"?pose.progress:0;
      const lift=(motion?Math.sin(time*5+x)*3:0)-(pose.state==="stagger"?-6:charge*4);
      circle(c,x,y,13,"#10192d66");
      if(charge>0) circle(c,x,y-18+lift,16+charge*5,"#bb9aff24","#e6d1ff",1.7);
      const twist=motion?Math.sin(time*4.2+x)*2.5:0;
      polygon(c,fighter.flash>0?"#effaff":"#ad8ff9",[[x+twist,y-34+lift],[x+13,y-17+lift],[x-twist,y-4+lift],[x-13,y-17+lift]]);
      polygon(c,"#e1d6ff",[[x,y-30+lift],[x+4,y-16+lift],[x,y-8+lift],[x-5,y-16+lift]]);
      if(!dead&&!spawn) {
        box(c,"#10192d",x-15,y+14,30,4);
        box(c,"#ba91fa",x-15,y+14,30*fighter.hp/fighter.maxHp,4);
      }
      c.restore();
      return;
    }
    c.save();
    const action = fighter.action;
    const showWeapon=isPlayer&&action?.attack&&["light","heavy"].includes(pose.state)&&FrostWeaponAnimation.family(action.weapon);
    const dash=pose.state==="dash"&&action.age<.26;
    const guard=pose.state==="parry"||pose.state==="perfect";
    const parry=guard&&action.age<=(gear?.weapon.parry??.14);
    const scale=king?1.72:isPlayer?1.11:kind==="dummy"?1.14:enemyPose.form.scale;
    c.translate(Math.round(x), Math.round(y));
    if (spawn) {
      circle(c, 0, 0, 18 + fighter.timer * 16, "#abbce52a", "#bddff0a5", 2);
      box(c, "#b4d7ed", -2, -25, 4, 16);
      c.globalAlpha = .30;
    }
    if (dead) {
      c.globalAlpha = Math.max(isPlayer ? .65 : 0, 1 - fighter.dead / .65);
      c.rotate(Math.min(1, fighter.dead * (isPlayer ? 2.3 : 9)) * 1.3);
    }
    const flash=fighter.flash>0;
    const dashCharge=dash?Math.min(1,action.age/.07):0;
    if(dash&&motion) c.globalAlpha=.93;
    c.scale(scale, scale);
    c.fillStyle = "#0308129f";
    c.beginPath();
    c.ellipse(0, 2, 19, 7, 0, 0, TAU);
    c.fill();
    if (kind === "wolf") {
      const stride = motion ? Math.sin(time*22)*5 : 0;
      const side=Math.cos(dir)<0?-1:1;
      c.scale(side,1);
      polygon(c,flash?"#e5f5ff":"#586e8a",[[-22,-16],[-14,-20],[12,-17],[18,-23],[22,-17],[29,-10],[21,-8],[12,-11],[5,-8],[-12,-8]]);
      polygon(c,"#b2cbd9",[[-18,-16],[-10,-21],[10,-17],[16,-23],[23,-15],[8,-13]]);
      box(c,"#36455c",-14,-9,4,11+stride);
      box(c,"#36455c",8,-9,4,11-stride);
      box(c,"#ffb6b6",21,-15,3,2);
      c.restore();
      return;
    }
    if (isPlayer) {
      c.beginPath();
      c.ellipse(0, 0, 16, 8, 0, 0, TAU);
      c.strokeStyle = "#9fe7ffba"; c.lineWidth = 1.3; c.stroke();
    }
    const side = Math.cos(dir) < -.10 ? -1 : 1;
    const step=pose.step*(enemyPose?.form.step??1),bob=pose.bob;
    if (fighter.state==="stagger") c.rotate(.19);
    const runPose=pose.state==="run", walkPose=pose.state==="walk";
    const restDash=pose.state==="dash"&&!dash;
    const lean=!isPlayer?side*(enemyPose.lean+(kind==="soldier"&&motion?Math.sin(time*8)*.026:0)):dash?side*(.24+dashCharge*.15):runPose?side*.14:
      restDash?side*.11*(1-pose.progress):pose.state==="hurt"?-side*.23*(1-pose.progress):0;
    const crouch=isPlayer?(dash?2.8+dashCharge*2:restDash?2.3*(1-pose.progress):pose.state==="hurt"?2:0):enemyPose.bend;
    c.translate(-(enemyPose?.recoil??0)*side,bob+crouch);
    c.scale(side, 1);
    const edge = isPlayer ? "#7f9fb6" : king ? "#628cac" : "#586980";
    const coats={elite:"#745362",soldier:"#6b5b58",hunter:"#466866",burrower:"#6f61a0",remnant:"#706079",reflection:"#9b7cb4"};
    const metal = flash ? "#e5fbff" : isPlayer ? gear.armor.color :
      king ? ({keeper:"#705b5a",warden:"#567c94",king:"#385d81",hollow:"#426d67",heart:"#846eb0"})[kind] : coats[kind]??"#35475c";
    const shadow = flash ? "#93ceec" : "#172438";
    const eye = isPlayer ? "#ddf7ff" : archer ? "#99def8" : "#ffc3ba";
    const cape = isPlayer ? "#872f44" : king ? "#46263f" : archer ? "#30415c" : "#293246";
    const cloth=motion?(dash?7:runPose?3.7:walkPose?1.9:kind==="king"?Math.sin(time*2.6)*2.6:Math.sin(time*3.9)*.9):0;
    polygon(c,cape,[[-6,-28],[-13,-25],[-18-cloth,-8],[-17-cloth,2],[-11-cloth*.7,0],[-7,-4],[-5,0],[2,-6],[5,-24]]);
    polygon(c,isPlayer?"#b14b59":king?"#76526b":"#405975",[[-11,-24],[-15-cloth*.45,-16],[-17-cloth,-3],[-13-cloth*.6,-6],[-10,-22]]);
    const legReach=isPlayer?(dash?4:(runPose?step*1.45:step)*.75):step*.55;
    const lift=motion&&isPlayer&&!dash?Math.sin(pose.stride+Math.PI/2)*(runPose?2.8:walkPose?1.55:0):0;
    polygon(c,shadow,[[-7,-8],[-1,-8],[-1+legReach,3-Math.max(0,lift)],[-7+legReach,4-Math.max(0,lift)]]);
    box(c,metal,-8+legReach,2-Math.max(0,lift),8,4);
    polygon(c,shadow,[[2,-8],[8,-8],[8-legReach,4+Math.min(0,lift)],[2-legReach,3+Math.min(0,lift)]]);
    box(c,edge,2-legReach,2+Math.min(0,lift),8,4);
    if(lean&&motion) {
      c.translate(0,-7);
      c.rotate(lean*side);
      c.translate(0,7);
    }
    polygon(c, "#101b2b", [[-10,-25],[-5,-29],[5,-29],[11,-24],[9,-8],[4,-5],[-7,-8]]);
    polygon(c, metal, [[-8,-24],[-3,-28],[5,-26],[9,-22],[6,-11],[2,-8],[-6,-10]]);
    polygon(c, edge, [[-7,-25],[-2,-26],[3,-23],[7,-24],[6,-20],[1,-19],[-4,-22]]);
    box(c, shadow, -6, -14, 13, 3);
    box(c, "#a8a0a0", 1, -14, 3, 3);
    polygon(c, edge, [[-12,-26],[-7,-27],[-5,-23],[-8,-19],[-12,-21]]);
    polygon(c, edge, [[5,-27],[11,-26],[14,-22],[11,-18],[7,-21]]);
    box(c, metal, 8, -19, 7, 8);
    box(c, shadow, 9, -13, 7, 4);
    if (isPlayer) {
      polygon(c, "#dbebef", [[-8,-36],[-5,-42],[4,-43],[10,-38],[7,-32],[4,-29],[-4,-30],[-7,-27],[-6,-34]]);
      polygon(c, "#88aabf", [[-8,-36],[-1,-39],[6,-40],[10,-37],[3,-37],[-2,-32],[-7,-30]]);
      box(c, "#c2a4a6", 1, -34, 7, 5);
      box(c, "#32425c", 5, -34, 4, 2);
      box(c, cape, -6, -29, 15, 4);
      polygon(c,"#a84155",[[-6,-28],[-15,-26],[-23-cloth,-25+step*.4-cloth*.36],
        [-20-cloth,-22+step*.3-cloth*.36],[-10,-23],[2,-26]]);
    } else {
      polygon(c, shadow, [[-9,-31],[-7,-39],[0,-42],[7,-39],[10,-32],[6,-27],[-7,-28]]);
      polygon(c, metal, [[-7,-34],[-4,-39],[3,-39],[7,-36],[8,-30],[2,-27],[-3,-29],[-7,-30]]);
      box(c, eye, 1, -34, 3, 2); box(c, eye, 6, -34, 2, 2);
      if (king) {
        polygon(c, "#9fcde3", [[-9,-35],[-11,-46],[-5,-43],[-4,-52],[1,-44],[6,-53],[7,-43],[12,-47],[10,-36]]);
        box(c, "#516a9a", -7, -42, 16, 3);
        box(c,kind==="king"?FrostEnemyAnimation.phaseColors[fighter.phase-1]:"#d7f7ff",0,-44,3,4);
      } else if (archer) {
        polygon(c, "#4d6b83", [[-11,-34],[-10,-40],[-3,-45],[3,-43],[7,-39],[4,-37],[-5,-37],[-7,-29]]);
      } else {
        box(c, edge, -6, -39, 10, 3);
        box(c, shadow, -1, -31, 10, 3);
        if(kind==="stalker") polygon(c,"#8be2dc",[[-6,-38],[-10,-43],[-5,-46],[-1,-39]]);
        if(kind==="burrower") polygon(c,"#ae97eb",[[-11,-30],[-16,-39],[-9,-48],[-4,-33],[8,-46],[14,-40],[11,-32]]);
        if(kind==="remnant"||kind==="elite") box(c,"#b8a2c4",-7,-42,15,2);
      }
    }
    if (sentinel) {
      polygon(c, "#7893a7", [[-12,-23],[-20,-20],[-18,-8],[-12,-4],[-6,-9],[-5,-20]]);
      polygon(c, "#324861", [[-12,-20],[-17,-18],[-15,-9],[-12,-7],[-8,-11],[-8,-18]]);
      box(c, "#92c0d4", -13, -17, 2, 8);
    }
    c.save();
    c.translate((pose.state==="skill"?15:12)+(enemyPose?.push??0),pose.state==="potion"?-22:-11);
    if (action?.attack) {
      const progress=pose.phase==="startup"?0:pose.phase==="active"?pose.progress:1-pose.progress;
      c.rotate(action.weapon.style==="thrust" ? 1.4 : -.85+progress*(action.combo===1?-1.4:2.2));
      if(action.weapon.style==="thrust") c.translate(0,-10*progress);
    }
    else if(enemyPose) c.rotate(archer?-.55+enemyPose.weapon*.25:enemyPose.weapon);
    else if(guard) c.rotate(pose.state==="perfect"?-1.28:parry?-1.08:-1.08*(1-pose.progress));
    else if(pose.state==="skill") c.rotate(-.68+1.2*pose.progress);
    else if(dash) c.rotate(.56+dashCharge*.20);
    else c.rotate(.23 + step * .02);
    if (archer) {
      c.strokeStyle = "#b9a685"; c.lineWidth = 3; c.beginPath(); c.arc(0, -7, 12, -1.25, 1.25); c.stroke();
      const pull=enemyPose.draw*9;
      c.strokeStyle="#b7e7ff";c.lineWidth=1;c.beginPath();c.moveTo(4,-18);c.lineTo(4-pull,-7);c.lineTo(4,4);c.stroke();
      if(enemyPose.draw>.08) box(c,"#d5efff",4-pull,-7,16+pull,1.5);
    } else if (action?.type === "potion") {
      box(c,"#b8deeb",-3,-15,6,11);
      box(c,"#d67983",-2,-11,4,6);
      box(c,"#c5a783",-2,-17,4,2);
    } else if(!showWeapon) {
      const blade = gear?.weapon;
      const length=blade?.bladeLength??(king?34:kind==="hunter"?15:kind==="remnant"?33:28);
      const width = blade?.bladeWidth ?? 4;
      const tint=kind==="king"?(fighter.attack?.id==="kingJudgment"?"#ffc7ac":FrostEnemyAnimation.phaseColors[fighter.phase-1]):king?"#badcf0":"#8395a9";
      polygon(c,blade?.color??tint,[[-2,-6],[-2,-length+5],[2,-length],[width,-length+6],[width,-6]]);
      box(c, "#e4f8ff", 0, -length+5, 1, length-13);
      box(c, isPlayer ? "#b39471" : edge, -5, -7, 10, 2);
      box(c, "#232e42", 0, -5, 3, 7);
      if (blade?.style==="twin") polygon(c,blade.color,[[-25,4],[-20,-12],[-17,-15],[-16,-8],[-21,5]]);
    }
    c.restore();
    c.restore();
    if(showWeapon) drawAttackWeapon(c,fighter,action,motion,pose,quality,gear.armor);
    else if(pose.trailAction) {pose.trailAction=null;pose.trails=null;}
    if(pose.spotted&&motion) box(c,"#e5e5aa",x-1,y-53,3,6);
    if(kind==="burrower"&&pose.phase==="startup"&&fighter.attack?.id==="burrower") {
      polygon(c,"#dfacdbac",[[x-17,y+8],[x-6,y+3],[x+3,y+7],[x+9,y+1],[x+21,y+9],[x+10,y+5],[x+2,y+12],[x-5,y+7]]);
    }
    if (!isPlayer && !king && !dead && !spawn) {
      box(c, "#101827", x-17, y+11, 34, 6);
      const fill = Math.min(1, fighter.hp / fighter.maxHp || 1);
      box(c, "#c85d69", x-16, y+12, 32 * fill, 2);
      box(c, "#dcc08a", x-16, y+15, 32 * fighter.posture / fighter.maxPosture, 1);
    }
    if (parry || pose.state==="perfect"&&pose.progress<.72)
      circle(c,x,y-12,pose.state==="perfect"?29:23,pose.state==="perfect"?"#aeeaff36":"#8cdbf61b","#a5e7ff",1.6);
  }

  function drawEffect(c, fx, reduced, view) {
    const t = fx.age / fx.duration;
    c.save();
    c.globalAlpha = 1 - t;
    if(fx.kind==="impact") {
      const style=FrostFeedback.profiles[fx.category];
      if(style) {
        const r=style.r*(.38+t*.68),x=fx.x,y=fx.y;
        const color=fx.color??style.color;
        c.strokeStyle=color;
        c.lineWidth=fx.category==="light"?1:1.75;
        if(["posture","block","freeze"].includes(fx.category)) {
          const count=fx.category==="freeze"?6:5;
          for(let i=0;i<count;i++) {
            const a=i*Math.PI*2/count;
            c.beginPath();c.moveTo(x+Math.cos(a)*r*.23,y+Math.sin(a)*r*.23);
            c.lineTo(x+Math.cos(a+.20)*r*.6,y+Math.sin(a+.20)*r*.6);
            c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);c.stroke();
          }
        } else if(fx.category==="perfect") {
          circle(c,x,y,r,"","#b6f2ff",2);
          polygon(c,"#e8ffff",[[x-r,y],[x-3,y-3],[x,y-r],[x+3,y-3],[x+r,y],[x+3,y+3],[x,y+r],[x-3,y+3]]);
        } else {
          circle(c,x,y,r,"",color,1.5);
          if(t<.42) box(c,color,x-2,y-2,5,5);
        }
      }
      c.restore();
      return;
    }
    if (fx.kind === "slash") {
      const scale = fx.heavy ? 1.03 : 1;
      c.lineCap = "square";
      if(fx.style==="thrust") {
        c.translate(fx.x,fx.y);
        c.rotate(fx.dir);
        polygon(c,fx.color,[[fx.range*.2,-4],[fx.range*.77,-8],[fx.range,0],[fx.range*.77,8],[fx.range*.2,4]]);
        c.restore();
        return;
      }
      for (const [size, color, width] of [[1.04, "#385e8f", 9], [.99, fx.color ?? "#91cee8", 7], [.97, "#e1faff", 2]]) {
        c.beginPath();
        c.arc(fx.x, fx.y, fx.range * size * scale, fx.dir - fx.cone + t * .33, fx.dir + fx.cone - .1);
        c.strokeStyle = color; c.lineWidth = width; c.stroke();
      }
    } else if (fx.kind === "step") {
      if(!reduced) {
        box(c,"#bbd0e158",fx.x-4,fx.y-1,5,3);
        box(c,"#dbe8f262",fx.x+3+t*8,fx.y-2-t*5,2,2);
      }
    } else if (fx.kind === "trail") {
      if (!reduced) box(c, "#7abce3aa", fx.x-9, fx.y-26, 17, 26);
    } else if (fx.kind === "word") {
      const label=FrostI18n.translate(fx.label);
      const {scale,left,right,top,bottom}=view;
      c.font = `700 ${Math.max(12,12/scale)}px "Noto Sans Thai", "Leelawadee UI", "Segoe UI", Tahoma, sans-serif`;
      c.textAlign = "center"; c.lineWidth = Math.max(2,2/scale); c.strokeStyle = "#0b1523";
      const metrics=c.measureText(label), pad=c.lineWidth/2+2/scale;
      const x=clamp(fx.x,left+metrics.actualBoundingBoxLeft+pad,right-metrics.actualBoundingBoxRight-pad);
      const y=clamp(fx.y-t*26,top+metrics.actualBoundingBoxAscent+pad,bottom-metrics.actualBoundingBoxDescent-pad);
      c.fillStyle = fx.color;
      c.strokeText(label,x,y);
      c.fillText(label,x,y);
    } else {
      const base = fx.kind === "parry" ? 23 : 20;
      circle(c, fx.x, fx.y-10, base+57*t, "", "#c8eeff", 2);
      if (!reduced) {
        for (let i = 0; i < 14; i++) {
          const dir = i / 14 * TAU;
          box(c, i % 2 ? "#edf7ff" : "#80bde6", fx.x + Math.cos(dir) * (base+59*t),
            fx.y - 10 + Math.sin(dir) * (base+50*t), 3 + i % 3, 2 + i % 3);
        }
      }
    }
    c.restore();
  }

  function merchant(c,time,reduced,position=NPC,talking=false) {
    const {x,y} = position;
    c.save();
    c.translate(x,y);
    const rise = reduced ? 0 : Math.sin(time*2)*1.6;
    circle(c,18,-9,25,"#ffbd6229");
    polygon(c,"#4c403d",[[-17,-34],[-23,-6],[-15,1],[-8,-8],[-6,-39]]);
    polygon(c,"#6a6358",[[-8,-45+rise],[5,-48+rise],[14,-35],[12,-26],[19,-5],[-17,1],[-14,-28]]);
    polygon(c,"#414f57",[[-8,-26],[6,-29],[13,-18],[15,-3],[-14,0]]);
    polygon(c,"#bec1bd",[[-4,-34+rise],[4,-39+rise],[10,-33],[6,-22],[-1,-26]]);
    box(c,"#473b37",6,-35+rise,3,2);
    if(talking && (reduced || Math.sin(time*13)>0)) box(c,"#68605b",5,-29+rise,3,2);
    box(c,"#e0a858",16,-14+rise,8,10);
    box(c,"#fff0a3",18,-12+rise,4,6);
    box(c,"#8bc8c9",-14,-15,4,8);
    box(c,"#a7616b",-9,-12,3,6);
    c.restore();
  }
  function drawDiscovery(c,run) {
    const {x,y} = DISCOVERY;
    if(run.room.type==="treasure") {
      box(c,"#26232a",x-17,y-7,34,16);
      box(c,"#805949",x-17,y-(run.discovered?15:9),34,8);
      box(c,"#d0a96b",x-2,y-5,5,7);
    } else if(run.room.type==="rest") {
      circle(c,x,y,24,"#a3c4dd22","#81b9d6",2);
      polygon(c,"#7eb9d9",[[x,y-26],[x+12,y-10],[x,y+3],[x-12,y-10]]);
    } else if(run.room.type==="event"&&!run.eventsDone.has(run.room.eventId)) {
      circle(c,x,y,23,"#ac8edf20","#cbb0ef",2);
      polygon(c,"#dec2ff",[[x,y-20],[x+11,y-4],[x,y+12],[x-11,y-4]]);
      box(c,"#46375f",x-2,y-12,4,12);
      box(c,"#46375f",x-2,y+3,4,4);
    } else if(run.room.type==="lore") {
      box(c,"#1e3239",x-23,y-30,46,33);
      box(c,"#91aca9",x-20,y-30,40,5);
      for(let i=0;i<3;i++) box(c,"#719694",x-11,y-21+i*6,23-i*3,2);
    }
  }

  function drawAim(c, player, direction) {
    c.save();
    c.translate(player.x, player.y - 3);
    c.rotate(direction);
    const arrow = [[24,-2],[41,-2],[41,-7],[53,0],[41,7],[41,2],[24,2]];
    polygon(c, "#0c1828", [[22,-4],[39,-4],[39,-10],[57,0],[39,10],[39,4],[22,4]]);
    polygon(c, "#d6f6ff", arrow);
    c.restore();
  }
  function drawEnvironment(c,run,motion) {
    const env=run.environment;
    if(!env) return;
    for(const {x,y} of env.points) {
      if(env.id==="ice") {
        circle(c,x,y,43,"#93ccf326","#b3dcfd88",1.5);
        c.strokeStyle=run.hazard?.attack.data.name==="Cracked ice"?"#e3f4ff":"#c0dbf0";
        c.lineWidth=1.4;
        c.beginPath();c.moveTo(x-29,y-11);c.lineTo(x-11,y-4);c.lineTo(x+2,y-15);c.lineTo(x+7,y+3);
        c.lineTo(x+29,y+13);c.moveTo(x+7,y+3);c.lineTo(x-8,y+17);c.lineTo(x-13,y+32);c.stroke();
      } else if(env.id==="resonance") {
        const glow=run.hazard?.attack.spots.some(spot=>spot.x===x&&spot.y===y);
        circle(c,x,y,glow?23:16,"#af97ff2a",glow?"#ddd7ff":"#8373b6",1.5);
        polygon(c,glow?"#d9ceff":"#957eda",[[x,y-25],[x+10,y-10],[x,y+5],[x-10,y-10]]);
      } else if(env.id==="bell") {
        box(c,"#142235",x-15,y-32,30,28);
        const color=run.bellSilenced?"#728b9e":"#c89e67";
        polygon(c,color,[[x-9,y-23],[x+9,y-23],[x+11,y-12],[x+15,y-6],[x-15,y-6],[x-10,y-13]]);
        box(c,color,x-2,y-7,4,6);
        if(env.hasteUntil>env.time&&motion) circle(c,x,y-12,24+Math.sin(run.time*6)*6,"","#d4c199",1.5);
      }
    }
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.c = canvas.getContext("2d", { alpha: false });
      this.touch = matchMedia("(pointer: coarse)");
      this.ground = null;
      this.animation=new FrostAnimation.Scene();
      this.particles=new FrostFeedback.Particles();
      this.actors=[];
      this.art = new FrostWorldArt.Scene();
    }
    reset() {
      this.animation.reset();
      this.particles.reset();
      this.ground=null;
      this.art.reset();
      this.animatedRun=null;
      this.animatedRoom=null;
      this.kingFall=null;
      this.actors.length=0;
    }
    finishKing(event,now) {
      this.kingFall={actor:{...event,type:"king",boss:true,state:"dead",dead:0},time:now};
    }
    camera(w, h, player) {
      if(this.touch.matches&&w>h) return FrostLandscape.camera(w,h,WIDTH,HEIGHT);
      const tall = w / h < 1.2;
      const scale = tall ? h / (HEIGHT + 124) : Math.max(h/HEIGHT,Math.min(w/WIDTH,h/536));
      const x = Math.round(w >= WIDTH * scale ? (w - WIDTH * scale) / 2 :
        clamp(w / 2 - player.x * scale, w - WIDTH * scale, 0));
      const y = Math.round(tall ? (h - HEIGHT * scale) * .14 : (h - HEIGHT * scale) / 2);
      return { x, y, scale, tall };
    }
    toWorld(x, y, player) {
      const rect = this.canvas.getBoundingClientRect();
      const m = this.camera(this.canvas.clientWidth, this.canvas.clientHeight, player);
      if(!m.scale||!Number.isFinite(m.scale)) return null;
      return { x: (x - rect.left - m.x) / m.scale, y: (y - rect.top - m.y) / m.scale };
    }
    draw(run, settings, aim = null, now=performance.now()) {
      const {reduced,damageNumbers,shake,quality="high"} = settings;
      const canvas = this.canvas;
      const w = Math.round(canvas.clientWidth), h = Math.round(canvas.clientHeight);
      if (w < 1 || h < 1) return;
      const ratio = Math.min(quality==="low"?1:quality==="medium"?1.5:2,window.devicePixelRatio || 1);
      const pixelsW=Math.round(w*ratio), pixelsH=Math.round(h*ratio);
      if (canvas.width !== pixelsW || canvas.height !== pixelsH) { canvas.width = pixelsW; canvas.height = pixelsH; }
      const c = this.c;
      const { x, y, scale, tall } = this.camera(w, h, run.player);
      this.ground=this.art.prepare(run,quality,pixelsW,pixelsH,now);
      if(this.animatedRun!==run||this.animatedRoom!==run.room) {
        this.animatedRun=run;
        this.animatedRoom=run.room;
        this.animation.reset();
        this.particles.reset();
        this.kingFall=null;
      }
      const ground = this.ground;
      const jolt=FrostFeedback.impulse(run.fx,settings)||
        (shake&&!reduced&&run.player.flash>.09?Math.sin(run.time*140)*2:0);
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (x > 0 || y > 0 || x + WIDTH * scale < w || y + HEIGHT * scale < h) {
        box(c,this.art.picture.theme.dark,0,0,w,h);
      }
      c.setTransform(scale*ratio, 0, 0, scale*ratio, (x+jolt)*ratio, y*ratio);
      c.imageSmoothingEnabled = false;
      c.drawImage(ground, 0, 0);
      const storm=run.environment?.whiteout==="active";
      this.art.draw(c,run,reduced,storm,now);
      drawEnvironment(c,run,!reduced);
      if (run.gateOpen) drawGate(c, run.time, reduced);
      if (run.safe && !run.training) {
        const fire=c.createRadialGradient(480,334,5,480,334,112);
        fire.addColorStop(0,"#e5c59147");
        fire.addColorStop(.45,"#d5ab6b24");
        fire.addColorStop(1,"#d5ab6b00");
        box(c,fire,366,220,228,228);
        circle(c,480,334,23,"#6c665a65","#c9b78c9e",2);
        polygon(c,"#e9b978",[[474,335],[476,328],[478,330],[482,323],[486,333],[485,337],[477,338]]);
      }
      if (run.gateOpen && run.room.side && (!run.room.secretRequiresReveal||run.secretRevealed)) {
        const {x:sx,y:sy}=SIDE;
        if(run.room.secretClue==="tracks") {
          for(let i=0;i<5;i++) {
            box(c,"#bcd4dc9c",sx+i*8,sy+(i%2?4:-3),5,9);
            box(c,"#5c818d",sx+i*8,sy+(i%2?11:4),4,2);
          }
        } else if(run.room.secretClue==="cracked"&&!run.wallBroken) {
          box(c,"#607d95",sx-16,sy-26,20,46);
          polygon(c,"#afdce7",[[sx-12,sy-25],[sx-3,sy-16],[sx-10,sy-8],[sx-1,sy+6],[sx-10,sy+20],[sx-7,sy+6],[sx-14,sy-8],[sx-8,sy-16]]);
        } else {
          polygon(c,"#c7dff2",[[sx-9,sy],[sx+7,sy-7],[sx+1,sy],[sx+7,sy+7]]);
          box(c,"#647d92",sx+5,sy+6,4,13);
        }
      }
      if (run.room.type==="merchant") merchant(c,run.time,reduced);
      else if(run.safe && !run.training) drawDiscovery(c,run);
      if (run.hazard) {
        telegraph(c,run.hazard);
        if(run.build.relic==="lantern"&&run.hazard.attack.data.frost) for(const point of run.hazard.attack.spots)
          circle(c,point.x,point.y,run.hazard.attack.data.range+4,"","#fff0bf",2);
      }
      for(const zone of run.mutationHazards) telegraph(c,zone);
      if(run.crystalWall) {
        const [cx,cy,r]=run.crystalWall.pillar;
        circle(c,cx,cy,r,"#332a63af","#b7a5f5",2);
        polygon(c,"#8b80d4",[[cx-r,cy],[cx-12,cy-30],[cx,cy-62],[cx+15,cy-39],[cx+r,cy]]);
        polygon(c,"#cfc9ff",[[cx,cy-62],[cx+15,cy-39],[cx+5,cy-24],[cx-4,cy-35]]);
      }
      for(const zone of run.build.fields) circle(c,zone.x,zone.y,zone.r,"#76b8ec28","#9dc9ec",1);
      if(run.build.decoy) circle(c,run.build.decoy.x,run.build.decoy.y-12,19,"#8facd44d","#a6c9ed",2);
      if(run.build.barrier) {
        const ice=run.build.barrier;
        c.save(); c.translate(ice.x,ice.y); c.rotate(ice.dir);
        polygon(c,"#9fe1fbc9",[[3,-25],[10,-13],[10,13],[3,25],[-4,11],[-4,-11]]);
        c.restore();
      }
      for(const shot of run.build.shots) {
        c.save(); c.translate(shot.x,shot.y); c.rotate(shot.dir);
        polygon(c,"#d6f4ff",[[14,0],[-3,-6],[-15,0],[-3,6]]);
        c.restore();
      }
      if(run.warmth) circle(c,run.warmth.x,run.warmth.y,run.warmth.radius,"#ffb55e29","#ffd99c",2);
      for (const enemy of run.enemies) {
        drawKingPresence(c,enemy,run.time,reduced);
        telegraph(c,enemy);
        if(enemy.state==="defend") {
          circle(c,enemy.x,enemy.y,enemy.radius+12,"#f6b96d18","#f6bc80",2);
          box(c,"#ffd89e",enemy.x-2,enemy.y-58,4,13);
        }
      }
      const actors=this.actors;
      actors.length=0;
      actors.push(...run.enemies,run.player);
      actors.sort((a,b)=>a.y-b.y);
      if(storm) circle(c,run.player.x,run.player.y,run.player.radius+5,"","#e9faff",2);
      for (const actor of actors)
        drawFighter(c,actor,run.time,actor===run.player?run.inventory:null,!reduced,this.animation.pose(actor,run.time,!reduced),quality);
      if(this.kingFall&&run.result?.won&&!reduced) {
        const age=(now-this.kingFall.time)/1000;
        if(age>.65) this.kingFall=null;
        else if(age>=0) {
          const actor=this.kingFall.actor;
          actor.dead=age;
          drawFighter(c,actor,run.time,null,true);
        }
      }
      for(const enemy of run.enemies) {
        const mutation=FrostMutations.definitions[enemy.mutation];
        if(!mutation||enemy.state==="dead") continue;
        circle(c,enemy.x,enemy.y,enemy.radius+5,"",mutation.color,2);
        c.save();
        c.font="700 14px system-ui";
        c.textAlign="center";
        c.fillStyle="#10192d";
        c.fillRect(enemy.x-10,enemy.y-66,20,18);
        c.fillStyle=mutation.color;
        c.fillText(mutation.icon,enemy.x,enemy.y-52);
        c.restore();
      }
      for(const enemy of run.enemies) if(enemy.frost>0 && !["dead","spawn","transition"].includes(enemy.state)) {
        box(c,"#10223a",enemy.x-14,enemy.y+18,28,3);
        box(c,"#a7deff",enemy.x-14,enemy.y+18,28*Math.min(1,enemy.frost/100),3);
        if(enemy.frozenUntil>run.time) circle(c,enemy.x,enemy.y-14,21,"#a9dcfe35","#bce8ff",1.5);
      }
      const cast=run.player.action;
      if(cast?.type==="skill" && cast.id==="reversal") circle(c,run.player.x,run.player.y,25,"#f3ce8e25","#e0c58b",2);
      if(cast?.type==="skill" && cast.id==="judgment" && cast.age<.65) {
        const p=run.player;
        const point=cast.aimPoint&&Math.hypot(p.x-cast.aimPoint.x,p.y-cast.aimPoint.y)<=175?cast.aimPoint:
          {x:p.x+Math.cos(cast.dir)*133,y:p.y+Math.sin(cast.dir)*133};
        circle(c,point.x,point.y,62,"#9ac5f533","#beddff",2);
      }
      if(!reduced && !run.player.action && run.player.dead === undefined && run.time%2.8<.42) {
        const breath=run.time%2.8/.42, p=run.player;
        circle(c,p.x+Math.cos(p.dir)*(10+breath*12),p.y-26-breath*7,2+breath*5,"rgba(199,230,245,"+(.24*(1-breath))+")");
      }
      if (aim !== null) drawAim(c, run.player, aim);
      for (const shot of run.shots) {
        c.save(); c.translate(shot.x, shot.y); c.rotate(shot.dir);
        if(shot.attack.shape==="wave") {
          const w=shot.attack.width;
          polygon(c,"#9fe9ffbf",[[-12,-w],[8,-w*.58],[17,0],[8,w*.58],[-12,w],[-1,0]]);
          box(c,"#e7fbff",4,-w*.56,4,w*1.12);
        } else {
          polygon(c, "#c0f0ff", [[-17,0],[-3,-2],[4,-3],[9,0],[4,3],[-3,2]]);
          box(c, "#74abc6", -11, 0, 16, 2);
        }
        c.restore();
      }
      this.particles.expire(run.time);
      let textView;
      for(const fx of run.fx) {
        if(damageNumbers||!fx.damage) {
          if(fx.kind==="word"&&!textView) textView={
            scale,left:Math.max(0,-(x+jolt)/scale),right:Math.min(WIDTH,(w-x-jolt)/scale),
            top:Math.max(0,-y/scale),bottom:Math.min(HEIGHT,(h-y)/scale)
          };
          drawEffect(c,fx,reduced,textView);
        }
        if(!reduced&&fx.kind==="impact") this.particles.consume(fx,run.time,quality);
      }
      if(!reduced) for(const point of this.particles.active) {
        const age=run.time-point.start,t=age/point.duration;
        c.globalAlpha=Math.max(0,1-t)*.78;
        box(c,point.color,point.x+point.vx*age,point.y+point.vy*age+age*age*12,point.size,point.size);
      }
      c.globalAlpha=1;
      for(const enemy of run.enemies) tellMark(c,enemy);
      actors.length=0;
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (x < 0 || tall) {
        if (run.gateOpen) {
          const gateX = x + GATE.x * scale;
          if (gateX < 20 || gateX > w - 20) {
            const edge = gateX < 20 ? 14 : w - 14;
            const direction = gateX < 20 ? -1 : 1;
            const gateY = Math.max(113, y + GATE.y * scale);
            circle(c, edge, gateY, 12, "#102437", "#bdf3ff", 2);
            polygon(c, "#bdf3ff", [[edge+6*direction,gateY],[edge-3*direction,gateY-5],[edge-3*direction,gateY+5]]);
          }
        }
        for (const enemy of run.enemies) {
          const px = x + enemy.x * scale;
          if (enemy.state === "dead" || (px > 18 && px < w - 18)) continue;
          const py = clamp(y + enemy.y * scale, 106, h - 121);
          const edge = px < 18 ? 12 : w - 12;
          const direction = px < 18 ? -1 : 1;
          circle(c, edge, py, 10, "#162031", "#e6a1a7");
          polygon(c, "#ffb5b8", [[edge + 4 * direction, py], [edge - 2 * direction, py - 4], [edge - 2 * direction, py + 4]]);
        }
      }
    }
  }
  globalThis.FrostRenderer = Renderer;
  globalThis.FrostPortrait = (canvas,time,reduced) => {
    const c=canvas.getContext("2d");
    c.clearRect(0,0,canvas.width,canvas.height);
    c.save();
    c.scale(1.5,1.5);
    merchant(c,time,reduced,{x:canvas.width/3,y:canvas.height/1.5-4},true);
    c.restore();
  };
  globalThis.FrostEquipmentPreview = (canvas,gear,time,reduced) => {
    const c=canvas.getContext("2d");
    c.clearRect(0,0,canvas.width,canvas.height);
    const attack=gear.weapon.light[0];
    const age=reduced ? 0 : time%2.25;
    const preview={x:28,y:59,dir:0,action:age<attack.windup+attack.active+attack.recovery
      ? {type:"light",attack,weapon:gear.weapon,age,combo:0} : null};
    drawFighter(c,preview,time,gear,!reduced);
    if(age>=attack.windup && age<attack.windup+.22) {
      drawEffect(c,{kind:"slash",x:preview.x,y:preview.y,dir:0,range:Math.min(84,attack.range*.65),
        cone:attack.cone,color:gear.weapon.color,style:gear.weapon.style,age:age-attack.windup,duration:.22},reduced);
    }
  };
})();
