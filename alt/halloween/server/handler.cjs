'use strict';
function create({authority,db,authenticate,clock=Date.now,season}){
 const origins=new Set(['https://nadokagenou.github.io','http://127.0.0.1:4201','http://127.0.0.1:4202']);
 return async function handler(request){
  const origin=request.headers.get('origin'),headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.has(origin))return reply({error:'ต้นทางนี้ไม่ได้รับอนุญาต'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'ใช้ POST เพื่ออ่านหรือทำรายการ'},405);
  try{
   const raw=await request.text();if(raw.length>6000)return reply({error:'คำสั่งยาวเกินไป'},413);
   const receivedAt=clock();
   const uid=await authenticate(request.headers.get('authorization')||'');
   if(!uid)return reply({error:'เข้าสู่ระบบ StudentOS ก่อนเล่นกิจกรรม'},401);
   let body;try{body=JSON.parse(raw);}catch{return reply({error:'รูปแบบคำสั่งไม่ถูกต้อง'},400);}
   const snapshot=async()=>{const row=await db.read(uid,season.id);return row?.document||authority.initial(uid,clock());};
   if(body.action?.type==='read')return reply({document:authority.publicDocument(await snapshot()),serverNow:clock(),phase:season.state(clock())});
   if(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId))return reply({error:'ไม่มีรหัสธุรกรรมที่ถูกต้อง'},400);
   const action=authority.clean(body.action),tx=body.requestId;
   const [previous,first]=await Promise.all([db.receipt(uid,season.id,tx),snapshot()]);
   if(previous){if(JSON.stringify(Object.entries(previous.action).sort())!==JSON.stringify(Object.entries(action).sort()))return reply({error:'รหัสธุรกรรมนี้ถูกใช้กับรายการอื่นแล้ว'},409);return reply({result:previous.result,document:authority.publicDocument(await snapshot()),serverNow:clock(),replay:true});}
   const studyTask=action.type==='study-enroll'?await db.studyTask(uid,action.taskId):undefined;
   for(let attempt=0;attempt<4;attempt++){
    const current=attempt===0?first:await snapshot(),next=authority.apply(current,action,{uid,at:clock(),tx,studyTask,receivedAt});
    const saved=await db.commit({uid,season:season.id,expected:current.revision,tx,action,...next});
    if(saved.committed)return reply({result:saved.result,document:authority.publicDocument(saved.replay?await snapshot():next.document),serverNow:clock(),replay:saved.replay});
   }
   return reply({error:'เซฟเปลี่ยนจากอีกเครื่อง กรุณาลองรายการนี้อีกครั้ง'},409);
  }catch(error){return reply({error:error.publicMessage||error.message||'เชื่อมกิจกรรมไม่สำเร็จ ยังไม่ได้ยืนยันรายการ'},error.status||400);}
 };
}
module.exports={create};
