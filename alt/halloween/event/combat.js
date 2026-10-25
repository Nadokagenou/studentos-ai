/* Turn-based battles: the server-like core resolves moves, never accepts a win flag. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HalloweenCombat=factory();
})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const lanes=['ซ้าย','กลาง','ขวา'];
  const skills={
    spear:{name:'ยึดสมอ',description:'แทง 1.2 เท่า ลดการโจมตีที่กำลังมา 75% และลดอีก 50% ในเทิร์นถัดไป'},
    axe:{name:'ฟันสะเทือน',description:'ฟัน 1.5 เท่า ทำให้บอสเสียจังหวะและหยุดการโจมตีที่ประกาศไว้ในเทิร์นนี้'},
    quill:{name:'สัญญาโลหิต',description:'แทง 1.1 เท่า ฝากเลือดไหล 3 เทิร์น แต่ละเทิร์นดูดเลือดกลับ 6 หน่วย'},
    scythe:{name:'เก็บเกี่ยววิญญาณ',description:'ฟัน 1 เท่าและฟื้นชีวิต 16 ถ้าหลังฟันบอสเหลือไม่เกิน 25% จะปิดฉากทันที'}
  };
  const skillInfo=weapon=>skills[weapon.type]||{name:'ปล่อยพลัง',description:'โจมตี 2.1 เท่า'};
  function intent(rule,turn,hp,random){
    const patterns={admiral:['sweep','crush','sweep','hex'],pumpkin:['sweep','hex','crush','sweep'],vampire:['sweep','hex','sweep','crush'],reaper:['sweep','crush','hex','sweep'],sovereign:['sweep','crush','sweep','hex'],shadow:['sweep','hex','crush','hex']};
    const phase=hp<=rule.hp/2?2:1,kind=(patterns[rule.shape]||patterns.admiral)[turn%4];
    const lane=Math.floor(random()*3),danger=kind==='hex'?[0,1,2]:kind==='sweep'&&phase===2&&rule.hp>=200?[lane,(lane+1)%3]:[lane];
    return {kind,danger,phase,damage:rule.damage+(phase===2?5:0)};
  }
  function start(rule,weapon,session,at,random){
    return {id:rule.id,session,weapon,turn:0,hp:120,maxHp:120,bossHp:rule.hp,maxBossHp:rule.hp,mana:2,heals:2,effects:{anchor:0,bleed:0},finished:false,clear:false,startAt:at,intent:intent(rule,0,rule.hp,random),log:'อ่านสัญญาณโจมตี แล้วเลือกตอบโต้'};
  }
  function move(b,rule,weapon,action,at,random){
    if(b.finished)throw Error('การต่อสู้นี้จบแล้ว');
    if(action==='retreat'){b.finished=true;b.clear=false;b.endedAt=at;b.log='ถอยกลับมาตั้งหลัก อาวุธและของทั้งหมดอยู่ครบ';return;}
    if(!['strike','skill','guard','heal','dodge-0','dodge-1','dodge-2'].includes(action))throw Error('ไม่พบท่าต่อสู้');
    if(action==='skill'&&b.mana<2)throw Error('พลังเวทไม่พอ ตั้งรับหรือหลบเพื่อฟื้นพลัง');
    if(action==='heal'&&!b.heals)throw Error('ใช้ยาฟื้นพลังหมดแล้ว');
    const incoming=b.intent,power=weapon.power+(rule.weapon===b.weapon?5:0),before=b.hp;
    const effects=b.effects||=( {anchor:0,bleed:0} );
    let hit=0,damage=incoming.kind==='crush'?Math.ceil(incoming.damage*1.25):incoming.damage,description='';
    if(effects.anchor>0){damage=Math.ceil(damage*.5);effects.anchor--;}
    if(action==='strike'){hit=power;description='ฟันโจมตี';}
    if(action==='skill'){
      b.mana-=2;description=skillInfo(weapon).name;
      if(weapon.type==='spear'){hit=Math.round(power*1.2);damage=Math.ceil(damage*.25);effects.anchor=1;}
      else if(weapon.type==='axe'){hit=Math.round(power*1.5);damage=0;description+=' · หยุดท่าบอสแล้ว';}
      else if(weapon.type==='quill'){hit=Math.round(power*1.1);effects.bleed=3;}
      else if(weapon.type==='scythe'){hit=power;b.hp=Math.min(b.maxHp,b.hp+16);if(b.bossHp-hit<=b.maxBossHp*.25){hit=b.bossHp;description+=' · ปิดฉากวิญญาณ';}}
      else hit=Math.round(power*2.1);
    }
    if(action==='guard'){hit=Math.ceil(power*.3);damage=incoming.kind==='crush'?damage:Math.ceil(damage*.18);b.mana=Math.min(4,b.mana+1);description='ตั้งรับและฟื้นเวท';}
    if(action.startsWith('dodge-')){
      const lane=Number(action.at(-1)),safe=!incoming.danger.includes(lane);
      damage=safe?0:incoming.kind==='hex'?Math.ceil(damage*1.25):damage;
      hit=safe?Math.ceil(power*.65):0;b.mana=Math.min(4,b.mana+1);description=safe?'หลบสำเร็จและสวนกลับ':'หลบเข้าจุดโจมตี';
    }
    if(action==='heal'){b.hp=Math.min(b.maxHp,b.hp+48);b.heals--;description='ดื่มยาฟื้นพลัง';}
    if(effects.bleed>0){const drain=Math.ceil(power*.3);hit+=drain;effects.bleed--;b.hp=Math.min(b.maxHp,b.hp+6);description+=' · เลือดไหล '+drain+' / ดูดคืน 6';}
    b.bossHp=Math.max(0,b.bossHp-hit);
    // A finishing blow lands before the announced enemy move.
    if(b.bossHp===0){b.finished=true;b.clear=true;b.endedAt=at;damage=0;}
    b.hp=Math.max(0,b.hp-damage);b.turn++;
    b.log=description+' · ทำ '+hit+' ดาเมจ · รับ '+damage+' ดาเมจ'+(b.hp>before?' · ฟื้นพลังแล้ว':'');
    if(b.hp===0){b.finished=true;b.clear=false;b.endedAt=at;}
    if(!b.finished)b.intent=intent(rule,b.turn,b.bossHp,random);
    return {hit,damage};
  }
  function forecast(b,rule,weapon,action){const copy=JSON.parse(JSON.stringify(b));const outcome=move(copy,rule,weapon,action,b.startAt+copy.turn+1,()=>0);return {...outcome,hp:copy.hp,bossHp:copy.bossHp};}
  function hint(i){
    return i.kind==='hex'?'คำสาปครอบคลุมทุกช่อง · ตั้งรับเพื่อลดความเสียหาย':(i.kind==='crush'?'ทุบทะลุการตั้งรับ':'กวาดโจมตี')+'ทาง'+i.danger.map(n=>lanes[n]).join('และ')+' · หลบไปช่องที่ว่าง';
  }
  return {start,move,hint,lanes,skillInfo,forecast};
});
