/* Turn-based battles: the server-like core resolves moves, never accepts a win flag. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HalloweenCombat=factory();
})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const lanes=['ซ้าย','กลาง','ขวา'];
  function intent(rule,turn,hp,random){
    const phase=hp<=rule.hp/2?2:1,kind=turn%4===3?'hex':turn%4===1?'crush':'sweep';
    const lane=Math.floor(random()*3),danger=kind==='hex'?[0,1,2]:kind==='sweep'&&phase===2&&rule.hp>=200?[lane,(lane+1)%3]:[lane];
    return {kind,danger,phase,damage:rule.damage+(phase===2?5:0)};
  }
  function start(rule,weapon,session,at,random){
    return {id:rule.id,session,weapon,turn:0,hp:120,maxHp:120,bossHp:rule.hp,maxBossHp:rule.hp,mana:2,heals:2,finished:false,clear:false,startAt:at,intent:intent(rule,0,rule.hp,random),log:'อ่านสัญญาณโจมตี แล้วเลือกตอบโต้'};
  }
  function move(b,rule,weapon,action,at,random){
    if(b.finished)throw Error('การต่อสู้นี้จบแล้ว');
    if(action==='retreat'){b.finished=true;b.clear=false;b.endedAt=at;b.log='ถอยกลับมาตั้งหลัก อาวุธและของทั้งหมดอยู่ครบ';return;}
    if(!['strike','skill','guard','heal','dodge-0','dodge-1','dodge-2'].includes(action))throw Error('ไม่พบท่าต่อสู้');
    if(action==='skill'&&b.mana<2)throw Error('พลังเวทไม่พอ ตั้งรับหรือหลบเพื่อฟื้นพลัง');
    if(action==='heal'&&!b.heals)throw Error('ใช้ยาฟื้นพลังหมดแล้ว');
    const incoming=b.intent,power=weapon.power+(rule.weapon===b.weapon?5:0),before=b.hp;
    let hit=0,damage=incoming.damage,description='';
    if(action==='strike'){hit=power;description='ฟันโจมตี';}
    if(action==='skill'){hit=Math.round(power*2.1);b.mana-=2;description='ปล่อยพลังอาวุธ';}
    if(action==='guard'){hit=Math.ceil(power*.3);damage=incoming.kind==='crush'?damage:Math.ceil(damage*.18);b.mana=Math.min(4,b.mana+1);description='ตั้งรับและฟื้นเวท';}
    if(action.startsWith('dodge-')){
      const lane=Number(action.at(-1)),safe=!incoming.danger.includes(lane);
      damage=safe?0:incoming.kind==='hex'?Math.ceil(damage*1.25):damage;
      hit=safe?Math.ceil(power*.65):0;b.mana=Math.min(4,b.mana+1);description=safe?'หลบสำเร็จและสวนกลับ':'หลบเข้าจุดโจมตี';
    }
    if(action==='heal'){b.hp=Math.min(b.maxHp,b.hp+48);b.heals--;description='ดื่มยาฟื้นพลัง';}
    if(incoming.kind==='crush')damage=Math.ceil(damage*1.25);
    b.bossHp=Math.max(0,b.bossHp-hit);
    // A finishing blow lands before the announced enemy move.
    if(b.bossHp===0){b.finished=true;b.clear=true;b.endedAt=at;damage=0;}
    b.hp=Math.max(0,b.hp-damage);b.turn++;
    b.log=description+' · ทำ '+hit+' ดาเมจ · รับ '+damage+' ดาเมจ'+(b.hp>before?' · ฟื้นพลังแล้ว':'');
    if(b.hp===0){b.finished=true;b.clear=false;b.endedAt=at;}
    if(!b.finished)b.intent=intent(rule,b.turn,b.bossHp,random);
  }
  function hint(i){
    return i.kind==='hex'?'คำสาปครอบคลุมทุกช่อง · ตั้งรับเพื่อลดความเสียหาย':(i.kind==='crush'?'ทุบทะลุการตั้งรับ':'กวาดโจมตี')+'ทาง'+i.danger.map(n=>lanes[n]).join('และ')+' · หลบไปช่องที่ว่าง';
  }
  return {start,move,hint,lanes};
});
