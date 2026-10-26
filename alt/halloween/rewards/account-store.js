/* Permanent account reader; no dependency on the removable event directory. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HalloweenAccount=factory();})(globalThis,()=>{
 'use strict';
 function create({client,onChange=()=>{},uuid=()=>crypto.randomUUID(),clock=Date.now,endpoint="halloween-event"}){
  let snapshot=null,uid=null,offset=0,pending=null,queue=Promise.resolve();
  const clear=()=>{snapshot=null;uid=null;pending=null;onChange(null);};
  async function identity(){const {data,error}=await client.auth.getSession();if(error||!data.session)throw Object.assign(Error('เข้าสู่ระบบ StudentOS ก่อนเล่นกิจกรรม'),{definitive:true});return data.session;}
  async function send(body){
   const session=await identity(),owner=session.user.id;if(uid&&uid!==owner)clear();uid=owner;
   const {data,error}=await client.functions.invoke(endpoint,{body,headers:{Authorization:'Bearer '+session.access_token}});
   if(error){let message='เชื่อมเซิร์ฟเวอร์ไม่ได้ รายการยังรอยืนยัน กลับมาออนไลน์แล้วตรวจเซฟอีกครั้ง';try{const json=await error.context?.json();if(json?.error)message=json.error;}catch{}throw Object.assign(Error(message),{definitive:error.context?.status>=400&&error.context?.status<500});}
   if(data?.error)throw Error(data.error);
   if(!data?.document||data.document.owner!==owner||owner!==(await identity()).user.id)throw Error('บัญชีเปลี่ยนระหว่างบันทึก กรุณาเปิดกิจกรรมใหม่');
   snapshot=data.document;offset=data.serverNow-clock();onChange(snapshot);return data;
  }
  const serial=job=>{const next=queue.then(job);queue=next.catch(()=>{});return next;};
  async function resolve(){if(!pending)return null;const body=pending;try{const data=await send(body);if(pending===body)pending=null;return data;}catch(error){if(error.definitive&&pending===body)pending=null;throw error;}}
  function dispatch(action,requestId=uuid()){
   return serial(async()=>{
    if(pending){if(JSON.stringify(pending.action)!==JSON.stringify(action))throw Error('รายการก่อนหน้ายังรอยืนยัน กดตรวจเซฟก่อนทำรายการใหม่');return resolve();}
    pending={action,requestId};
    try{return await resolve();}catch(first){
     if(first.definitive)throw first;
     // A lost response must retry the same receipt, never generate a second grant.
     try{return await resolve();}catch{throw first;}
    }
   });
  }
  const refresh=()=>serial(async()=>{if(pending)await resolve();return send({action:{type:'read'}});});
  const subscription=client.auth.onAuthStateChange?.((_event,session)=>{if(uid&&uid!==session?.user?.id)clear();});
  return Object.freeze({read:()=>{if(!snapshot)throw Error('กำลังเชื่อมเซฟบัญชี');return snapshot;},ready:()=>!!snapshot,refresh,dispatch,now:()=>clock()+offset,clear,dispose(){clear();subscription?.data?.subscription?.unsubscribe();}});
 }
 function client(){const cfg=globalThis.SUPABASE_CONFIG;if(!globalThis.supabase||!cfg?.url||!cfg?.anonKey)throw Error('ยังเชื่อมระบบบัญชีไม่ได้');return globalThis.supabase.createClient(cfg.url,cfg.anonKey);}
 return Object.freeze({create,client});
});
