(() => {
  "use strict";
  const { WIDTH, HEIGHT, BOUNDS, GATE } = FrostCombat;
  const { NPC, DISCOVERY, SIDE } = FrostWorld;
  const TAU = Math.PI * 2;
  const LEVELS = {
    low:{ detail:0, flakes:12, steps:10, light:0 },
    medium:{ detail:1, flakes:28, steps:16, light:.65 },
    high:{ detail:2, flakes:49, steps:24, light:1 },
  };
  const THEMES = {
    courtyard: {
      id:"outpost", base:"#344652", dark:"#151f2a", stone:"#566874", pale:"#b0c5d0", trim:"#af7857", accent:"210,153,106",
      floors:["packed snow","cracked ice","stone path","frozen mud","military floor","buried road"],
      patterns:["snow","vein","cobble","soil","tile","road"],
      variants:["military courtyard","broken barracks","frozen supply route","ruined watch"],
      sets:[["watchtower","banner","rack"],["shelter","crate","fire","map"],["barricade","brokenWall","crate","rack"]],
      landmark:"watchtower", outside:["shelter","brokenWall"], light:"fire", wind:1.05, snow:"#d1e4ed80", sound:[240,54,5.4],
    },
    forest: {
      id:"forest", base:"#334c4a", dark:"#111f23", stone:"#425e59", pale:"#adc9c6", trim:"#83705f", accent:"151,199,190",
      floors:["deep snow","frozen soil","root path","pine needles","frozen stream","buried stone trail"],
      patterns:["snow","soil","roots","needles","vein","road"],
      variants:["dense woodland","ancient shrine","frozen creek","hunter path"],
      sets:[["shrine","marker","lantern"],["fallen","bridge","stag"],["hunter","pine","lantern","marker"]],
      landmark:"shrine", outside:["pine","pine"], light:"lantern", wind:1.65, snow:"#c2ded869", sound:[380,43,6.6],
    },
    crystal: {
      id:"depths", base:"#293a51", dark:"#0d1528", stone:"#4c6077", pale:"#abc3d7", trim:"#8d8bb8", accent:"127,183,219",
      floors:["dark stone","fractured rock","buried ruins","ancient mosaic","ice-coated stone","crystal dust"],
      patterns:["tile","vein","road","mosaic","snow","shards"],
      variants:["crystal chamber","ancient bridge","buried ruin","deep cavern"],
      sets:[["crystal","resonator","rune"],["bridge","stair","arch"],["statue","pillar","arch","rune"]],
      landmark:"bridge", outside:["crystal","arch"], light:"crystal", wind:.34, snow:"#b3cbed60", sound:[145,174,7.2],
    },
    gallery: {
      id:"capital", base:"#414554", dark:"#1b1c26", stone:"#646575", pale:"#b5bcc7", trim:"#a08865", accent:"200,180,143",
      floors:["royal cobblestone","cracked plaza","snow-covered road","noble district","canal stone","cathedral courtyard"],
      patterns:["cobble","vein","road","tile","snow","mosaic"],
      variants:["market street","noble plaza","cathedral approach","royal gate"],
      sets:[["shop","stall","notice","lamp"],["fountain","royalStatue","balcony"],["bell","cathedral","arch","royalGate"]],
      landmark:"bell", outside:["shop","cathedral"], light:"lamp", wind:.65, snow:"#ccd5e180", sound:[280,98,7.8],
    },
    throne: {
      id:"throne", base:"#343e54", dark:"#111625", stone:"#596984", pale:"#b8c9de", trim:"#9a5969", accent:"145,181,237",
      floors:["royal marble","throne floor","ceremonial stone","royal mosaic","ice veins","broken palace tiles"],
      patterns:["tile","road","cobble","mosaic","vein","shards"],
      variants:["royal corridor","ceremonial hall","frozen gallery","throne approach"],
      sets:[["window","royalPillar","royalBanner"],["chandelier","relief","frozenStatue","grandStair"],["throne","throneArch","crown","royalPillar"]],
      landmark:"throne", outside:["window","royalPillar"], light:"window", wind:.25, snow:"#d9e9ff65", sound:[115,61,8],
    },
  };
  const themeFor = room => THEMES[room.theme==="bridge"?"crystal":room.theme==="crypt"?"gallery":room.theme] ?? THEMES.courtyard;
  const typeBias = {merchant:2,rest:1,elite:3,boss:3,lore:2,treasure:1,mini:3,event:2};

  function hash(seed,key) {
    let state=(seed^0x63c89a41)>>>0;
    for(let i=0;i<key.length;i++) state=Math.imul(state^key.charCodeAt(i),16777619)>>>0;
    return state;
  }
  function random(seed) {
    let n=seed;
    return ()=>{
      n=(Math.imul(n,1664525)+1013904223)>>>0;
      return n/4294967296;
    };
  }
  function plan(room,seed,quality) {
    const theme=themeFor(room);
    const key=hash(seed,room.id??room.name??room.theme);
    const mainRoom=room.id?.endsWith("/0")||room.type==="boss";
    const selection=((typeBias[room.type]??0)+(key>>>3)%theme.variants.length)%theme.variants.length;
    const primary=room.type==="boss"?3:(selection+(key>>>10)%3)%theme.floors.length;
    const set=theme.sets[(mainRoom?(theme.id==="forest"?0:2):selection+(key>>>7)%2)%theme.sets.length];
    const featured=mainRoom?[theme.landmark,...set.filter(kind=>kind!==theme.landmark)]:set;
    const props=featured.map((kind,i)=>({kind,x:[351,617,252,713,184][i],y:104,
      variant:(key>>>(i*3))&3,scale:mainRoom&&i===0?1.13:1}));
    // Large scenic silhouettes only occupy the bands outside the collision rectangle.
    const anchors=[room.entry,room.exit??GATE,NPC,DISCOVERY,SIDE,...(room.spawns??[])].filter(Boolean);
    return {theme,key,variant:theme.variants[selection],primary,
      secondary:(primary+1+(key>>>17)%5)%theme.floors.length,props,anchors,
      detail:LEVELS[quality]??LEVELS.high,pillars:room.pillars??[],type:room.type};
  }
  const rect=(c,color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
  function poly(c,color,points) {
    c.fillStyle=color;
    c.beginPath();
    c.moveTo(...points[0]);
    for(let i=1;i<points.length;i++) c.lineTo(...points[i]);
    c.closePath();
    c.fill();
  }
  function line(c,color,width,points) {
    c.strokeStyle=color;
    c.lineWidth=width;
    c.beginPath();
    c.moveTo(...points[0]);
    for(let i=1;i<points.length;i++) c.lineTo(...points[i]);
    c.stroke();
  }
  function oval(c,color,x,y,rx,ry,outline) {
    c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);
    if(color) {c.fillStyle=color;c.fill();}
    if(outline) {c.strokeStyle=outline;c.lineWidth=1.5;c.stroke();}
  }
  function glow(c,color,x,y,r,intensity) {
    const light=c.createRadialGradient(x,y,1,x,y,r);
    light.addColorStop(0,`rgba(${color},${intensity})`);
    light.addColorStop(.42,`rgba(${color},${intensity*.49})`);
    light.addColorStop(1,`rgba(${color},0)`);
    rect(c,light,x-r,y-r,r*2,r*2);
  }
  function stone(c,t,x,y,w,h,dense=1) {
    rect(c,t.dark,x,y,w,h);
    for(let row=2;row<h-1;row+=8) {
      for(let col=-(row%3)*5;col<w-1;col+=15) {
        const from=Math.max(1,col+1),to=Math.min(w-1,col+13);
        if(to<=from) continue;
        rect(c,t.stone,x+from,y+row,to-from,Math.min(h-row,6));
        if(dense) rect(c,"#d2e5ea35",x+from,y+row,to-from,1);
      }
    }
    rect(c,t.pale,x,y,w,2);
  }
  function arch(c,t,w,h,glass=false) {
    poly(c,t.stone,[[-w,0],[-w,-h*.59],[-w*.7,-h*.79],[0,-h],[w*.7,-h*.79],[w,-h*.59],[w,0]]);
    poly(c,t.dark,[[-w+6,0],[-w+6,-h*.55],[-w*.51,-h*.76],[0,-h+8],[w*.51,-h*.76],[w-6,-h*.55],[w-6,0]]);
    line(c,t.pale,1.5,[[-w,-3],[-w,-h*.59],[-w*.7,-h*.79],[0,-h],[w*.7,-h*.79],[w,-h*.59],[w,-3]]);
    if(glass) {
      poly(c,t.trim,[[0,-h+13],[w*.54,-h*.63],[w*.66,-5],[-w*.66,-5],[-w*.52,-h*.63]]);
      line(c,t.dark,3,[[0,-h+12],[0,-5]]);
      line(c,t.pale,1,[[-w*.52,-7],[-3,-h*.27],[9,-h*.48],[2,-h*.65],[4,-h*.82]]);
    }
  }
  function pine(c,t,variant) {
    const lean=[-9,5,11,-3][variant], height=[94,110,76,99][variant], width=[33,27,31,42][variant];
    rect(c,t.trim,-4,-height*.50,8,height*.50);
    for(let i=4;i>=0;i--) {
      const y=-height+i*height*.14, x=lean*(1-i*.17), span=width*(.29+i*.17);
      poly(c,i%2?"#20373d":"#14262d",[[x,y],[x-span,y+height*.31],[x-span*.56,y+height*.29],[x-span*.91,y+height*.36],[x+span,y+height*.34],[x+span*.58,y+height*.28]]);
      poly(c,i%2?"#77989a":"#8ca9ac",[[x,y+2],[x-span*.87,y+height*.31],[x-span*.44,y+height*.25],[x+3,y+height*.16],[x+span*.58,y+height*.29]]);
    }
  }
  function crystals(c,t,variant) {
    const styles=[[[0,49,14],[-18,25,10],[15,31,9]],[[2,66,12],[-15,24,7]],[[0,44,23],[17,21,10]],[[-12,29,11],[5,34,17],[24,18,7]]];
    for(const [x,h,w] of styles[variant]) {
      const lean=h*.13;
      poly(c,t.trim,[[x-w,0],[x-w*.72,-h*.55],[x+lean,-h],[x+w,-h*.44],[x+w*.64,0]]);
      poly(c,t.stone,[[x-w,0],[x+lean,-h],[x+4,-h*.36],[x+1,0]]);
      poly(c,"#9ac3dc",[[x+lean,-h],[x+w,-h*.44],[x+4,-h*.36],[x-w*.72,-h*.55]]);
      line(c,t.pale,1,[[x+w*.64,0],[x+4,-h*.36],[x+lean,-h]]);
    }
  }
  function figure(c,t,kind) {
    const royal=kind==="royalStatue"||kind==="frozenStatue";
    stone(c,t,-23,-12,46,12);
    poly(c,t.stone,[[-17,-12],[-12,-41],[-7,-52],[8,-52],[15,-36],[18,-12]]);
    poly(c,t.pale,[[-9,-48],[-7,-60],[6,-62],[10,-55],[5,-48]]);
    poly(c,"#0f1b2c74",[[1,-49],[10,-53],[17,-13],[5,-13]]);
    line(c,t.trim,2,[[10,-38],[19,-47],[23,-22],[23,-13]]);
    if(royal) poly(c,t.trim,[[-8,-60],[-10,-67],[-4,-64],[0,-70],[5,-63],[9,-67],[7,-60]]);
  }
  function wood(c,t,w,h,slant=0) {
    poly(c,"#272630",[[-w,0],[-w+slant,-h],[w+slant,-h],[w,0]]);
    poly(c,t.trim,[[-w+3,0],[-w+slant+3,-h+3],[w+slant-3,-h+3],[w-3,0]]);
    for(let i=-w+8;i<w-3;i+=9) line(c,"#2626308c",2,[[i,0],[i+slant,-h]]);
    line(c,t.pale,2,[[-w+slant,-h],[w+slant,-h]]);
  }
  function emblem(c,t,y,s=1) {
    poly(c,t.trim,[[-14*s,y],[14*s,y],[11*s,y-12*s],[5*s,y-7*s],[0,y-16*s],[-5*s,y-7*s],[-11*s,y-12*s]]);
    line(c,t.pale,1.3,[[-11*s,y-2*s],[10*s,y-2*s]]);
  }
  function floorInsignia(c,t) {
    c.save();c.translate(480,320);
    if(t.id==="throne") {
      c.scale(2,2);emblem(c,t,6,.95);
    } else if(t.id==="depths") {
      for(let i=0;i<6;i++) {
        line(c,t.trim,1.5,[[0,-11],[-10,-23],[0,-36],[10,-23],[0,-11]]);
        c.rotate(TAU/6);
      }
    } else {
      for(let i=0;i<8;i++) {
        poly(c,"#b6a38b48",[[0,-62],[-7,-53],[0,-41],[7,-53]]);
        c.rotate(TAU/8);
      }
    }
    c.restore();
  }
  function prop(c,t,item,detail) {
    const {kind,x,y,variant=0,scale=1}=item;
    c.save();
    c.translate(x,y);
    c.scale(scale,scale);
    switch(kind) {
      case "watchtower":
        stone(c,t,-30,-48,60,48,detail);
        line(c,t.trim,7,[[-25,-22],[-24,-86],[-6,-78],[-3,-49],[29,-47]]);
        line(c,t.pale,2,[[-29,-24],[-28,-87],[-22,-89],[-3,-82],[1,-50]]);
        wood(c,t,27,12,-27);
        line(c,"#272732",5,[[-12,-58],[25,-34],[53,-32]]);
        poly(c,t.dark,[[-9,-19],[-5,-37],[9,-37],[13,-19]]);
        break;
      case "shelter": case "hunter": case "shop": case "stall":
        stone(c,t,-27,-39,54,39,detail);
        wood(c,t,21,26,0);
        poly(c,t.trim,[[-36,-29],[-29,-51],[-8,-62],[8,kind==="shelter"?-49:-64],[34,-43],[37,-31]]);
        poly(c,t.pale,[[-32,-48],[-8,-63],[7,-63],[29,-50],[16,-54],[4,-50],[-17,-55]]);
        rect(c,t.dark,-8,-24,16,24);
        if(kind==="shop"||kind==="stall") {
          rect(c,t.trim,-22,-26,44,12);
          for(let i=-20;i<22;i+=8) rect(c,t.pale,i,-25,3,8);
        }
        break;
      case "barricade": case "rack": case "fallen":
        c.rotate(kind==="fallen"?-.24:0);
        wood(c,t,29,kind==="rack"?15:22,kind==="barricade"?6:0);
        for(let x=-24;x<=24;x+=12) line(c,"#30313d",3,[[x-5,1],[x,-37-(x&7)]]);
        break;
      case "banner": case "royalBanner":
        line(c,t.stone,4,[[-23,-72],[23,-72]]);
        line(c,t.pale,2,[[0,-72],[0,1]]);
        poly(c,kind==="royalBanner"?t.trim:"#684854",[[-18,-69],[18,-69],[18,-15],[9,-9],[3,-20],[-7,-12],[-15,-16]]);
        emblem(c,t,-29,.77);
        break;
      case "crate": case "map": case "notice":
        wood(c,t,kind==="crate"?21:16,kind==="crate"?22:27,3);
        if(kind==="crate") line(c,t.dark,3,[[-18,-4],[20,-20]]);
        else {
          rect(c,"#bbb092",-10,-24,19,15);
          line(c,t.trim,1,[[-7,-20],[-2,-22],[2,-17],[6,-19]]);
          line(c,t.dark,1,[[-6,-13],[6,-13]]);
        }
        break;
      case "brokenWall": case "cathedral": case "royalGate": case "throneArch":
        stone(c,t,-39,kind==="brokenWall"?-36:-64,78,kind==="brokenWall"?36:64,detail);
        if(kind==="brokenWall") {
          poly(c,t.dark,[[-3,-38],[7,-38],[3,-29],[18,-23],[1,-14],[-4,0],[-9,0],[2,-17],[-5,-23]]);
          line(c,t.pale,2,[[-38,-36],[-21,-39],[-11,-34],[-3,-37]]);
        } else arch(c,t,26,69,kind==="cathedral");
        break;
      case "fire":
        oval(c,t.stone,0,-4,19,6,t.pale);
        line(c,t.trim,3,[[-10,-2],[11,-10],[-8,-11],[10,-3]]);
        poly(c,"#e5a46b",[[-7,-7],[-5,-15],[-2,-12],[3,-20],[7,-8],[3,-5]]);
        break;
      case "pine": pine(c,t,variant);break;
      case "shrine":
        stone(c,t,-34,-51,68,51,detail);
        poly(c,t.pale,[[-39,-47],[0,-69],[39,-47],[34,-42],[0,-60],[-34,-42]]);
        arch(c,t,17,50,true);
        oval(c,t.trim,0,-4,17,4,t.pale);
        break;
      case "marker": case "rune": case "resonator":
        poly(c,t.stone,[[-17,0],[-11,-35],[4,-42],[15,-32],[17,0]]);
        line(c,t.pale,2,[[-17,0],[-11,-35],[4,-42],[15,-32]]);
        line(c,t.trim,2,[[0,-33],[0,-13],[-8,-25],[7,-25],[0,-13]]);
        if(kind==="resonator") oval(c,"#92bbd6",0,-36,5,5,t.trim);
        break;
      case "lantern": case "lamp":
        line(c,t.dark,4,[[0,0],[0,-38],[9,-45],[14,-40]]);
        rect(c,t.trim,10,-39,9,13);
        rect(c,t.pale,12,-36,4,7);
        break;
      case "bridge":
        poly(c,t.dark,[[-40,0],[-34,-33],[-18,-46],[15,-47],[33,-34],[40,0]]);
        stone(c,t,-39,-28,78,16,detail);
        arch(c,t,25,49);
        line(c,t.pale,2,[[-39,-8],[-27,-23],[-26,-36],[-12,-46],[1,-47],[8,-43]]);
        break;
      case "arch": case "window": arch(c,t,kind==="window"?30:24,kind==="window"?79:63,kind==="window");break;
      case "crystal": crystals(c,t,variant); break;
      case "pillar": case "royalPillar":
        stone(c,t,-15,-66,30,66,detail);
        rect(c,t.dark,-19,-8,38,8);
        rect(c,t.trim,-20,-65,40,4);
        line(c,t.pale,2,[[-17,-68],[17,-68]]);
        break;
      case "statue": case "royalStatue": case "frozenStatue": figure(c,t,kind);break;
      case "stag":
        poly(c,t.stone,[[-29,-4],[-25,-17],[-2,-22],[12,-20],[18,-39],[26,-45],[32,-39],[24,-30],[16,-9],[13,-1],[4,-1],[1,-10],[-17,-8],[-22,0]]);
        line(c,t.pale,2,[[20,-37],[22,-50],[15,-58],[17,-44],[10,-51]]);
        break;
      case "stair": case "grandStair":
        for(let i=0;i<7;i++) {
          const w=68-i*7;
          rect(c,t.dark,-w/2,-i*6-6,w,6);
          rect(c,t.stone,-w/2,-i*6-6,w,3);
          rect(c,t.pale,-w/2,-i*6-6,w,1);
        }
        break;
      case "bell":
        stone(c,t,-32,-74,64,74,detail);
        arch(c,t,22,71);
        poly(c,t.trim,[[-15,-27],[-10,-35],[-8,-48],[7,-48],[11,-36],[17,-27]]);
        oval(c,t.pale,1,-26,12,2);
        poly(c,t.pale,[[-34,-73],[0,-101],[33,-73],[19,-73],[-2,-85],[-21,-76]]);
        break;
      case "fountain":
        oval(c,t.dark,0,-6,33,12,t.stone);
        oval(c,t.pale,0,-10,26,7,t.stone);
        rect(c,t.trim,-3,-34,6,25);
        oval(c,t.stone,0,-33,15,5,t.pale);
        break;
      case "balcony":
        stone(c,t,-32,-35,64,35,detail);
        for(let x=-27;x<30;x+=8) line(c,t.dark,3,[[x,-35],[x,-18]]);
        rect(c,t.trim,-33,-36,66,4);
        break;
      case "throne":
        arch(c,t,44,94);
        poly(c,t.trim,[[-24,-8],[-20,-51],[0,-64],[20,-51],[24,-8],[14,-8],[14,-18],[-14,-18],[-14,-8]]);
        rect(c,t.stone,-31,-13,62,8);
        emblem(c,t,-34);
        break;
      case "chandelier":
        line(c,t.stone,3,[[0,-76],[0,-39]]);
        oval(c,null,0,-35,28,7,t.trim);
        for(let x=-24;x<=24;x+=12) rect(c,t.pale,x,-46,3,10);
        break;
      case "relief": case "crown":
        stone(c,t,-23,-43,46,43,detail);
        emblem(c,t,-16);
        break;
    }
    c.restore();
  }

  function floorTexture(c,p,rng) {
    const t=p.theme;
    const floor=c.createRadialGradient(480,335,40,480,330,545);
    floor.addColorStop(0,t.base);
    floor.addColorStop(1,t.dark);
    rect(c,floor,48,91,864,456);
    c.save();
    c.beginPath();c.rect(54,105,852,436);c.clip();
    // The central aisle is a color landmark on the floor, with no artificial edge.
    const road=c.createLinearGradient(335,0,625,0);
    road.addColorStop(0,"#a5bacc00");road.addColorStop(.45,"#a5bacc25");road.addColorStop(1,"#a5bacc00");
    rect(c,road,335,109,290,430);
    const size=p.detail.detail===0?45:34;
    for(let row=0,y=110;y<550;y+=size*.63,row++) {
      for(let x=59-(row%2)*size*.5;x<908;x+=size) {
        const chance=rng(), offset=rng()*size, drift=rng()*10;
        const center=480+Math.sin(y*.011+p.key%4)*20;
        const pattern=t.patterns[Math.abs(x-center)<115+chance*26?p.primary:p.secondary];
        if(pattern==="tile"||pattern==="cobble"||pattern==="road"||pattern==="mosaic") {
          const w=size-(pattern==="cobble"?5:2), h=size*.63-2;
          rect(c,chance>.55?"#b8c9d223":"#080d1932",x,y,w,h);
          line(c,"#d9e4ef26",1.2,[[x,y+h],[x,y],[x+w,y]]);
          if(pattern==="mosaic"&&chance>.62) poly(c,t.stone,[[x+7,y+6],[x+13,y+1],[x+19,y+6],[x+13,y+10]]);
        } else if(pattern==="vein"||pattern==="roots") {
          if(chance>.36) line(c,pattern==="vein"?"#a1c0da43":"#141b2799",pattern==="vein"?1.2:3,
            [[x,y+12],[x+offset*.38,y+5],[x+offset*.6,y+drift],[x+size,y+10]]);
        } else if(pattern==="snow"||pattern==="soil") {
          const inset=chance*7;
          poly(c,pattern==="snow"?"#b8d8e32b":"#1c202e3e",[[x+inset,y+4],[x+11,y-drift*.35],
            [x+size+inset,y+drift],[x+size-3,y+13],[x+12,y+17-inset]]);
        } else if(chance>.42) {
          line(c,pattern==="needles"?"#91a99a50":"#b5c9e36a",1,[[x+offset*.5,y],[x+offset*.5+7,y+3]]);
        }
      }
    }
    if(t.id==="throne"||t.id==="capital"||t.id==="depths") {
      const radius=t.id==="throne"?112:t.id==="capital"?81:62;
      oval(c,null,480,320,radius,radius*.82,"#a8bfd154");
      oval(c,"#64768f1c",480,320,radius-9,(radius-9)*.82,"#a8bfd13d");
      floorInsignia(c,t);
    }
    const count=[90,215,345][p.detail.detail];
    for(let i=0;i<count;i++) {
      const x=61+rng()*837,y=112+rng()*426,w=1+rng()*10;
      if(i%9===0&&p.anchors.some(a=>(x-a.x)**2+(y-a.y)**2<24**2)) continue;
      rect(c,i%3===0?"#0b142c38":"#d0e3f12d",x,y,i%9===0?w*2:w,1+i%3);
    }
    const traces=t.id==="outpost"?["#584c4e70","#829daa5c"]:
      t.id==="forest"?["#162a2a91","#68887771"]:["#1a284331","#849db32f"];
    for(let i=0;i<(p.detail.detail===0?7:15);i++) {
      const x=117+rng()*735,y=133+rng()*374;
      if(p.anchors.some(a=>Math.hypot(x-a.x,y-a.y)<38)||p.pillars.some(([px,py,r])=>Math.hypot(x-px,y-py)<r+18)) continue;
      if(t.id==="forest"||t.id==="outpost") {
        line(c,traces[0],2,[[x-12,y+4],[x-3,y],[x+6,y+2],[x+12,y-2]]);
        line(c,traces[1],1,[[x-9,y+7],[x+4,y+4],[x+13,y+1]]);
      } else {
        oval(c,traces[0],x,y,12,4);
        line(c,traces[1],1,[[x-10,y],[x,y-3],[x+11,y]]);
      }
    }
    c.restore();
  }
  const lightPoints=[[314,101],[643,100]];
  function silhouette(c,t,rng,detail) {
    if(t.id==="forest") {
      for(let x=-24;x<=WIDTH;x+=detail?51:78) {
        const scale=.48+rng()*.47;
        c.save();c.translate(x,87+rng()*17);c.scale(scale,scale);
        c.globalAlpha=.49;
        pine(c,t,Math.floor(rng()*4));c.restore();
      }
    } else if(t.id==="capital"||t.id==="throne") {
      for(let x=4;x<WIDTH;x+=detail?62:91) {
        const h=25+rng()*45;
        poly(c,"#6d748f3f",[[x,91],[x,91-h],[x+19,76-h],[x+46,91-h],[x+46,91]]);
        rect(c,"#171d30",x+9,101-h,6,13);
        rect(c,"#a9b1c238",x+27,102-h,5,10);
      }
    } else {
      for(let x=0;x<WIDTH;x+=27) {
        const rise=18+rng()*55;
        poly(c,t.id==="depths"?"#8b9bd131":"#9eb3cc19",[[x,96],[x+9,96-rise],[x+23,92-rise*.64],[x+40,96]]);
      }
    }
  }
  function boundary(c,t,detail) {
    if(t.id==="forest"||t.id==="depths") {
      const colors=t.id==="forest"?["#2a4548","#546c69","#93aaa4"]:["#222c47","#4b5778","#8296b3"];
      for(let x=18;x<WIDTH-12;x+=31) {
        const hi=12+(x%5)*2;
        poly(c,colors[0],[[x-7,112],[x-3,101],[x+8,106-hi],[x+23,100-hi],[x+39,111]]);
        poly(c,colors[1],[[x-3,101],[x+8,106-hi],[x+23,100-hi],[x+29,105],[x+13,104]]);
        line(c,colors[2],1,[[x+1,100],[x+8,106-hi],[x+23,100-hi]]);
      }
      for(const edge of [24,901]) {
        rect(c,colors[0],edge,103,35,445);
        for(let y=108;y<545;y+=26) {
          poly(c,colors[1],[[edge,y+7],[edge+14,y],[edge+34,y+4],[edge+38,y+19],[edge+28,y+25],[edge+2,y+23]]);
          line(c,colors[2],1,[[edge+2,y+7],[edge+14,y+1],[edge+31,y+5]]);
        }
      }
      rect(c,colors[0],44,540,873,16);
      line(c,colors[2],2,[[44,541],[917,541]]);
      return;
    }
    stone(c,t,0,89,WIDTH,21,detail);
    stone(c,t,20,95,43,449,detail);
    stone(c,t,896,95,43,449,detail);
    stone(c,t,44,540,873,19,detail);
  }
  function bake(c,p) {
    const { theme:t,detail,pillars }=p;
    const rng=random(p.key);
    rect(c,t.dark,0,0,WIDTH,HEIGHT);
    silhouette(c,t,rng,detail.detail);
    floorTexture(c,p,rng);
    boundary(c,t,detail.detail);
    for(const side of [-1,1]) {
      const start=side<0?47:912;
      c.save();c.beginPath();c.rect(side<0?0:BOUNDS.right,110,
        side<0?BOUNDS.left:WIDTH-BOUNDS.right,HEIGHT-110);c.clip();
      for(let i=0;i<4;i++) {
        const kind=t.outside[i%t.outside.length];
        prop(c,t,{kind,x:start+side*8,y:174+i*116,variant:i,scale:detail.detail?.68:.50},detail.detail);
      }
      c.restore();
      prop(c,t,{kind:t.outside[0],x:480+side*166,y:598,variant:side<0?2:3,scale:.47},detail.detail);
    }
    for(const item of p.props) prop(c,t,item,detail.detail);
    c.save();c.translate(GATE.x,111);
    arch(c,t,t.id==="throne"?49:42,t.id==="throne"?104:87);
    for(let x=-30;x<32;x+=9) rect(c,"#9aaec257",x,-43+Math.abs(x)*.48,3,38-Math.abs(x)*.48);
    if(t.id==="throne"||t.id==="capital") emblem(c,t,-61,.83);
    c.restore();
    for(const [x,y,r] of pillars) {
      if(detail.detail) poly(c,"#070f2262",[[x-r,y],[x+r,y-3],[x+r+25,y+25],[x-3,y+29]]);
      oval(c,t.dark,x,y,r,Math.max(7,r*.44),t.stone);
      prop(c,t,{kind:t.id==="throne"?"royalPillar":"pillar",x,y,scale:r/25,variant:0},detail.detail);
      rect(c,t.pale,x-r*.56,y-2,r*1.12,1.2);
    }
    for(const [x,y] of lightPoints) {
      glow(c,t.accent,x,y,detail.light?80:48,.13+detail.light*.11);
      prop(c,t,{kind:t.light,x,y:y+1,scale:.50,variant:1},detail.detail);
    }
    const shade=c.createLinearGradient(0,0,0,HEIGHT);
    shade.addColorStop(0,"#070b185b");shade.addColorStop(.21,"#0b122513");
    shade.addColorStop(.78,"#0a132400");shade.addColorStop(1,"#05091570");
    rect(c,shade,0,0,WIDTH,HEIGHT);
  }

  class Scene {
    constructor(makeCanvas=()=>document.createElement("canvas")) {
      this.makeCanvas=makeCanvas;
      this.builds=0;
      this.steps=new Float32Array(24*4);
      const rng=random(12231);
      this.flakes=Array.from({length:49},()=>[rng()*WIDTH,rng()*HEIGHT,7+rng()*24,1+rng()*1.8]);
      this.reset();
    }
    reset() {
      this.ground=null;this.room=null;this.run=null;this.picture=null;this.size="";
      this.stepCount=0;this.stepIndex=0;this.particleCount=0;this.phase=1;this.phaseAt=0;
    }
    prepare(run,quality,width,height,now) {
      const roomChanged=this.room!==run.room||this.run!==run;
      const size=`${width}x${height}:${quality}`;
      if(!roomChanged&&this.size===size) return this.ground;
      if(roomChanged) {
        this.started=now;
        this.preparing=run.preparing;
        this.stepCount=0;this.stepIndex=0;this.lastX=run.player.x;this.lastY=run.player.y;
        this.phase=1;this.phaseAt=now;this.wonAt=null;
      }
      this.room=run.room;this.run=run;this.size=size;
      this.picture=plan(run.room,run.seed,quality);
      const canvas=this.ground??this.makeCanvas();
      canvas.width=WIDTH;canvas.height=HEIGHT;
      bake(canvas.getContext("2d"),this.picture);
      this.ground=canvas;
      this.builds++;
      return canvas;
    }
    draw(c,run,reduced,storm,now) {
      const p=this.picture,t=p.theme;
      const {x,y,dir}=run.player;
      if(this.preparing&&!run.preparing) this.started=now;
      this.preparing=run.preparing;
      const phase=run.boss?.phase??this.phase;
      if(phase!==this.phase) {this.phase=phase;this.phaseAt=now;}
      if(run.result?.won&&this.wonAt==null) this.wonAt=now;
      const peace=this.wonAt==null?1:1-Math.min(.85,(now-this.wonAt)/900);
      if(t.id==="throne"&&phase>1)
        rect(c,phase===3?"#661f373a":"#536ea925",52,110,856,429);
      if(t.id==="throne"&&peace<1)
        rect(c,`rgba(7,13,26,${(1-peace)*.28})`,0,0,WIDTH,HEIGHT);
      if(storm) rect(c,p.detail.detail>0?"#c4dced37":"#c4dced21",53,108,854,432);
      this.particleCount=0;
      if(reduced) {this.stepCount=0;this.lastX=x;this.lastY=y;return;}
      const dx=x-this.lastX,dy=y-this.lastY;
      if(dx*dx+dy*dy>16*16) {
        const offset=this.stepIndex*4;
        this.steps[offset]=x;this.steps[offset+1]=y;this.steps[offset+2]=dir;this.steps[offset+3]=run.time;
        this.stepIndex=(this.stepIndex+1)%24;
        this.stepCount=Math.min(24,this.stepCount+1);
        this.lastX=x;this.lastY=y;
      }
      const life=p.detail.detail?3.2:2.1;
      for(let i=0;i<Math.min(p.detail.steps,this.stepCount);i++) {
        const j=((this.stepIndex+23-i)%24)*4,age=run.time-this.steps[j+3];
        if(age>life) break;
        const sx=this.steps[j],sy=this.steps[j+1],angle=this.steps[j+2];
        const ox=Math.sin(angle)*3,oy=Math.cos(angle)*3;
        c.globalAlpha=(1-age/life)*.50;
        rect(c,"#111c2c",sx+ox,sy-oy,4,2);rect(c,t.pale,sx-ox-3,sy+oy,4,2);
      }
      c.globalAlpha=1;
      if(p.detail.light) for(let i=0;i<lightPoints.length;i++) {
        const [lx,ly]=lightPoints[i];
        const wave=(Math.sin(run.time*(t.id==="depths"?2.1:3.4)+i*2.33)+1)/2;
        c.globalAlpha=(.27+wave*.31)*peace;
        rect(c,t.pale,lx+(t.id==="outpost"?0:3),ly-6,2,2+wave*2);
      }
      if(p.detail.detail===2) for(const item of p.props) {
        if(item.kind!=="banner"&&item.kind!=="royalBanner") continue;
        const sway=Math.sin(run.time*1.8+item.x)*3;
        c.globalAlpha=.36;
        line(c,t.pale,1,[[item.x+12,item.y-39],[item.x+12+sway,item.y-22],[item.x+13+sway,item.y-15]]);
      }
      const count=Math.round(p.detail.flakes*peace),wind=t.wind*(storm?2.8:1);
      c.globalAlpha=.55;
      for(let i=0;i<count;i++) {
        const [fx,fy,speed,width]=this.flakes[i],time=run.time*speed;
        rect(c,t.snow,(fx+time*wind)%WIDTH,(fy+time)%HEIGHT,width*(storm?2.1:1),width*.65);
      }
      this.particleCount=count;
      c.globalAlpha=1;
      const entrance=1-(now-this.started)/185;
      if(entrance>0) rect(c,`rgba(14,25,42,${entrance*.24})`,0,0,WIDTH,HEIGHT);
      if(t.id==="throne"&&phase>1&&p.detail.light) {
        const intensity=Math.min(1,(now-this.phaseAt)/420)*peace;
        c.globalAlpha=.48*intensity;
        rect(c,phase===3?"#aa4563":"#81a3e4",357,104,246,2);
        c.globalAlpha=1;
      }
    }
  }
  globalThis.FrostWorldArt={Scene,plan,themeFor};
})();
