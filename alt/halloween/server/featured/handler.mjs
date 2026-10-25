/* A permanent profile preference. This service cannot grant badges or event rewards. */
export const CORE_BADGES=[{id:'hello',goal:1},{id:'try',goal:10},{id:'hard',goal:25},{id:'nah',goal:75},{id:'unstoppable',goal:100},{id:'deep',secret:'ocean'},{id:'tree',secret:'earth'},{id:'sophyra',secret:'galaxy'},{id:'genesis',genesis:true},{id:'metaworld',skin:'meta'},{id:'err404',skin:'glitch'}];
const EVENT_BADGES=['midnight-conqueror','crown-of-midnight'],BADGES=new Set([...CORE_BADGES.map(x=>x.id),...EVENT_BADGES]);
export function coreAvailable(data){const v=data?.vault||{},done=(Array.isArray(data?.tasks)?data.tasks:[]).filter(t=>t&&!t.deleted&&t.done).length;return CORE_BADGES.filter(b=>b.skin?Number(v.tokens?.skins?.[b.skin])>0:v.allBadges===true?true:b.genesis?v.genesis===true:b.secret?Array.isArray(v.badgeSecrets)&&v.badgeSecrets.includes(b.secret):done>=b.goal).map(b=>b.id);}
function eventReceipt(doc,id,uid){const r=doc?.rewards?.[id];return doc?.owner===uid&&doc?.season==='halloween-2026'&&r?.id===id&&r.permanent===true&&typeof r.receipt==='string'&&r.receipt?r:null;}
export function create({authenticate,readReward,readCoreData=async()=>null,readSelection,writeSelection,clock=Date.now}){
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
   if(body?.action!=='read'&&(body?.action!=='equip'||(body.badgeId!==null&&!BADGES.has(body.badgeId))))return reply({error:'เลือกตราที่มีอยู่เท่านั้น'},400);
   const [doc,data]=await Promise.all([readReward(uid),readCoreData(uid)]),available=[...coreAvailable(data),...EVENT_BADGES.filter(id=>eventReceipt(doc,id,uid))];
   if(body.action==='read')return reply({selection:await readSelection(uid),available});
   if(body.badgeId===null){await writeSelection(null,uid);return reply({selection:null,available});}
   const id=body.badgeId;if(!available.includes(id))return reply({error:'บัญชีนี้ยังไม่ได้รับตรานี้'},403);
   const r=eventReceipt(doc,id,uid),received=typeof r?.receivedAt==='number'?r.receivedAt:Date.parse(r?.receivedAt),prior=await readSelection(uid);
   const row={user_id:uid,season:EVENT_BADGES.includes(id)?'halloween-2026':'studentos',badge_id:id,earned_at:r&&Number.isFinite(received)?new Date(received).toISOString():null,selected_at:prior?.badge_id===id?prior.selected_at:new Date(clock()).toISOString()};
   return reply({selection:await writeSelection(row,uid),available});
  }catch{return reply({error:'ยังยืนยันตราที่เลือกไม่ได้ กรุณาตรวจอีกครั้งเมื่อออนไลน์'},503);}
 };
}
