/* Short, untimed practice. No currency or ownership rewards depend on these games. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HalloweenBrainGames=factory();})(globalThis,()=>{
 'use strict';const kinds=['memory','math','path','odd','pattern','balance'],names={memory:'รูนในหมอก',math:'หม้อปรุงยามอรา',path:'สะพานเรือผี',odd:'ตราแวมไพร์ผิดเพี้ยน',pattern:'ลำดับเลขต้องคำสาป',balance:'ตาชั่งวิญญาณ'};
 const pick=(a,r)=>a[Math.floor(r()*a.length)],shuffle=(a,r)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 function reachable(walls){const todo=[0],seen=new Set(todo);for(const n of todo)for(const next of [n-4,n+4,n-1,n+1])if(next>=0&&next<16&&Math.abs(next%4-n%4)+Math.abs(Math.floor(next/4)-Math.floor(n/4))===1&&!walls.includes(next)&&!seen.has(next)){seen.add(next);todo.push(next);}return seen.has(15);}
 function question(g,at,r){g.message='';if(g.kind==='memory')return {sequence:shuffle([0,1,2,3,4,5],r).slice(0,3+g.round),board:shuffle([0,1,2,3,4,5],r),found:[],revealUntil:at+4500};
  if(g.kind==='math'){let a=2+Math.floor(r()*18),b=1+Math.floor(r()*9),op=pick(['+','−','×'],r);if(op==='×')a=2+Math.floor(r()*8);if(op==='−'&&b>a)[a,b]=[b,a];const answer=op==='+'?a+b:op==='−'?a-b:a*b,choices=shuffle([answer,...shuffle([-2,-1,1,2,3,4].map(n=>answer+n).filter(n=>n>=0),r).slice(0,3)],r);return {a,b,op,answer,choices};}
  if(g.kind==='path'){let walls;for(let tries=0;tries<30;tries++){walls=shuffle(Array.from({length:14},(_,i)=>i+1),r).slice(0,4);if(reachable(walls))break;}if(!reachable(walls))walls=[5,6,9,10];return {walls,path:[0],goal:15};}
  if(g.kind==='odd')return {odd:Math.floor(r()*9),asset:pick(['little-wisp','velvet-bat','crimson-candle','quiet-gravestone'],r)};
  const a=1+Math.floor(r()*12),step=1+Math.floor(r()*5),answer=g.kind==='balance'?a:a+step*4;return g.kind==='balance'?{b:step,sum:a+step,answer,choices:shuffle([a,a+1,a+2,a+3],r)}:{sequence:Array.from({length:4},(_,i)=>a+step*i),step,answer,choices:shuffle([answer,...shuffle([-2,-1,1,2,3,4].map(n=>answer+n).filter(n=>n>=0),r).slice(0,3)],r)};
 }
 function prepare(g,at,r){if(g.playback===2)return g;g.playback=2;g.lastInputAt=at;g.questions=Array.from({length:g.total},(_,round)=>round<=g.round?null:question({...g,round},0,r));return g;}
 function start(event,session,at,r){const recent=event.brainHistory||[],pool=kinds.filter(k=>!recent.slice(-2).includes(k)),weighted=pool.flatMap(k=>['math','balance','pattern'].includes(k)?[k,k]:[k]),kind=pick(weighted,r),g={session,kind,round:0,total:kind==='path'?1:3,startAt:at,finished:false,clear:false,mistakes:0};g.q=question(g,at,r);event.brainHistory=[...recent,kind].slice(-3);event.brainGame=g;return prepare(g,at,r);}
 function move(g,value,at,r){if(!g||g.finished)throw Error('เกมพักสมองรอบนี้จบแล้ว');if(value==='abandon'){g.finished=true;g.clear=false;return g;}const q=g.q;let success=false;
  if(g.kind==='memory'&&value==='hint'){q.revealUntil=at+4500;return g;}
  if(!Number.isInteger(value))throw Error('เลือกคำตอบบนหน้าจอ');
  if(g.kind==='memory'){if(at<q.revealUntil)throw Error('จำรูนก่อน แล้วค่อยตอบ');if(value<0||value>5)throw Error('ไม่พบรูน');if(value===q.sequence[q.found.length])q.found.push(value);else{q.found=[];q.revealUntil=at+4500;g.mistakes++;g.message='ดูอีกครั้งได้ ไม่เสียของหรือ Candy';}success=q.found.length===q.sequence.length;}
  else if(g.kind==='path'){const n=q.path.at(-1);if(value<0||value>15||q.walls.includes(value)||Math.abs(value%4-n%4)+Math.abs(Math.floor(value/4)-Math.floor(n/4))!==1)throw Error('เดินไปช่องติดกันที่ไม่ใช่คลื่น');const visited=q.path.indexOf(value);if(visited<0)q.path.push(value);else q.path=q.path.slice(0,visited+1);success=value===q.goal;}
  else {const allowed=g.kind==='odd'?value>=0&&value<9:q.choices.includes(value);if(!allowed)throw Error('ไม่พบตัวเลือก');success=value===(g.kind==='odd'?q.odd:q.answer);if(!success){g.mistakes++;g.message=g.kind==='math'?q.a+' '+q.op+' '+q.b+' = '+q.answer+' · ลองเลือกคำตอบนี้อีกครั้ง':g.kind==='balance'?'สองฝั่งต้องเท่ากัน: '+q.sum+' − '+q.b+' = '+q.answer:g.kind==='pattern'?'เพิ่มทีละ '+q.step+' · จำนวนถัดไปคือ '+q.answer:'ตราที่ต่างถูกหมุนไปอีกมุมหนึ่ง';}}
  if(success){g.round++;g.message='ถูกแล้ว!';if(g.round===g.total){g.finished=true;g.clear=true;g.endedAt=at;}else {g.q=g.questions?.[g.round]?JSON.parse(JSON.stringify(g.questions[g.round])):question(g,at,r);if(g.kind==='memory')g.q.revealUntil=at+4500;}}return g;
 }
 return Object.freeze({kinds,names,reachable,start,prepare,move});
});
