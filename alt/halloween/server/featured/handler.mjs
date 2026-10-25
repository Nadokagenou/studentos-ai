/* A permanent profile preference. This service cannot grant event rewards. */
const BADGES=new Set(['midnight-conqueror','crown-of-midnight']);
export function create({authenticate,readReward,readSelection,writeSelection,clock=Date.now}){
 const origins=new Set(['https://nadokagenou.github.io','http://127.0.0.1:4201','http://127.0.0.1:4202']);
 return async request=>{
  const origin=request.headers.get('origin'),headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.has(origin))return reply({error:'ต้นทางนี้ไม่ได้รับอนุญาต'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'ใช้ POST เพื่อเลือกตรา'},405);
  try{
   const uid=await authenticate(request.headers.get('authorization')||'');if(!uid)return reply({error:'เข้าสู่ระบบ StudentOS ก่อนเลือกตรา'},401);
   const raw=await request.text();if(raw.length>1200)return reply({error:'คำสั่งยาวเกินไป'},413);
   let body;try{body=JSON.parse(raw);}catch{return reply({error:'รูปแบบคำสั่งไม่ถูกต้อง'},400);}
   if(body?.action==='read')return reply({selection:await readSelection(uid)});
   if(body?.action!=='equip'||(body.badgeId!==null&&!BADGES.has(body.badgeId)))return reply({error:'เลือกตราอีเวนต์ที่มีอยู่เท่านั้น'},400);
   if(body.badgeId===null){await writeSelection(null,uid);return reply({selection:null});}
   const id=body.badgeId,doc=await readReward(uid),r=doc?.rewards?.[id];
   if(doc?.owner!==uid||doc?.season!=='halloween-2026'||r?.id!==id||r.permanent!==true||typeof r.receipt!=='string'||!r.receipt)return reply({error:'บัญชีนี้ยังไม่ได้รับตรานี้'},403);
   const received=typeof r.receivedAt==='number'?r.receivedAt:Date.parse(r.receivedAt),prior=await readSelection(uid);
   const row={user_id:uid,season:'halloween-2026',badge_id:id,earned_at:Number.isFinite(received)?new Date(received).toISOString():null,selected_at:prior?.badge_id===id?prior.selected_at:new Date(clock()).toISOString()};
   return reply({selection:await writeSelection(row,uid)});
  }catch{return reply({error:'ยังยืนยันตราที่เลือกไม่ได้ กรุณาตรวจอีกครั้งเมื่อออนไลน์'},503);}
 };
}
