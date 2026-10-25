import {Core,Catalog,Death,Season,Authority,Handler} from './engine.mjs';
import rules from './rules.json' with {type:'json'};
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const config=Core.build({...rules,catalog:Catalog,authoritative:true,season:{id:Season.id,startAt:Season.startAt,endAt:Season.endAt,timezone:Season.timezone,claimingEnabled:true}});
const authority=Authority.create({Core,Death,Season,config,randomSeed:()=>crypto.getRandomValues(new Uint32Array(1))[0]||1});
async function database(route,body){
 const response=await fetch(url+'/rest/v1/'+route,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok){const fault=await response.json().catch(()=>({}));if(fault.message==='event rate limit')throw Object.assign(new Error('ทำรายการถี่เกินไป รอหนึ่งนาทีแล้วลองใหม่'),{status:429});throw Object.assign(new Error('เชื่อมเซฟไม่สำเร็จ กรุณาลองอีกครั้งโดยใช้รหัสรายการเดิม'),{status:503});}
 return response.json();
}
const db={
 async studyTask(uid,id){const rows=await database('user_state?id=eq.'+uid+'&select=tasks:data->tasks');const task=(rows[0]?.tasks||[]).find(t=>t.id===id);if(!task)return null;return {id:task.id,type:task.type,done:task.done,deleted:task.deleted,draft:task.draft,sample:task.sample,demo:task.demo,halloweenDeathQuest:task.halloweenDeathQuest};},
 async read(uid,season){return (await database('halloween_states?user_id=eq.'+uid+'&season=eq.'+season+'&select=document'))[0];},
 async receipt(uid,season,tx){return (await database('halloween_requests?user_id=eq.'+uid+'&season=eq.'+season+'&request_id=eq.'+tx+'&select=action,result'))[0];},
 async commit(x){return database('rpc/halloween_commit',{p_user:x.uid,p_season:x.season,p_expected:x.expected,p_request:x.tx,p_action:x.action,p_document:x.document,p_result:x.result});}
};
const authenticate=async(authorization)=>{
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization))return null;
 const r=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});
 if(!r.ok)return null;const user=await r.json();
 return typeof user.id==='string'&&/^[0-9a-f-]{36}$/i.test(user.id)&&!user.is_anonymous?user.id:null;
};
Deno.serve(Handler.create({authority,db,authenticate,season:Season}));
