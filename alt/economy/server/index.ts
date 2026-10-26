import {Engine,Handler} from './engine.mjs';
import rules from './rules.json' with {type:'json'};
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const engine=Engine.create({rules,random:()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296});
async function database(path,body){const r=await fetch(url+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!r.ok){const fault=await r.json().catch(()=>({}));throw Object.assign(Error(fault.message==='economy rate limit'?'ทำรายการถี่เกินไป รอหนึ่งนาทีแล้วลองใหม่':'ยังเชื่อมคลังไม่ได้ ลองตรวจรายการเดิมอีกครั้ง'),{status:503});}return r.json();}
async function authenticate(authorization){if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization))return null;const r=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});if(!r.ok)return null;const u=await r.json();if(!u.id||u.is_anonymous)return null;const allowed=await fetch(url+'/rest/v1/rpc/staff_account_allowed',{method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:'{}'});if(!allowed.ok||await allowed.json()!==true)return null;return {uid:u.id,admin:(await database('studentos_economy_admins?user_id=eq.'+u.id+'&select=user_id&limit=1')).length===1};}
async function staff(uid){const x=await database('rpc/studentos_economy_staff',{p_user:uid});return x;}
const db={
 async active(){return (await database('studentos_economy_release?id=eq.true&select=active'))[0]?.active===true;},
 async read(uid){return (await database('studentos_economy_states?user_id=eq.'+uid+'&select=document'))[0];},
 async baseline(uid){const x=(await database('studentos_economy_baselines?user_id=eq.'+uid+'&select=data,at,staff_minted,staff_debited'))[0];return x?{data:x.data,at:x.at,staffMinted:x.staff_minted,staffDebited:x.staff_debited}:null;},
 async receipt(uid,id){return (await database('studentos_economy_requests?user_id=eq.'+uid+'&request_id=eq.'+id+'&select=action,result'))[0];},
 async staff(uid){return staff(uid);},
 async task(uid,id){const list=(await database('user_state?id=eq.'+uid+'&select=tasks:data->tasks'))[0]?.tasks;return Array.isArray(list)?list.find(t=>t.id===id):null;},
 async invites(_uid,authorization){const r=await fetch(url+'/rest/v1/rpc/my_invite',{method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error('ยังตรวจคำเชิญไม่ได้');const x=await r.json(),row=Array.isArray(x)?x[0]:x;return row?.used;},
 async feedback(uid){return (await database('tester_feedback?user_id=eq.'+uid+'&kind=eq.main&select=user_id&limit=1')).length>0;},
 async board(_uid,season,authorization){if(!/^\d{4}-Q[1-4]$/.test(season||''))return null;const r=await fetch(url+'/rest/v1/rpc/board',{method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({p_scope:'all',p_season:season})});if(!r.ok)return null;const data=await r.json();return data?.me?{...data.me,hidden:data.hidden===true}:null;},
 async commit(x){return database('rpc/studentos_economy_commit',{p_user:x.uid,p_expected:x.expected,p_request:x.tx,p_action:x.action,p_document:x.document,p_result:x.result});}
};
Deno.serve(Handler.create({engine,db,authenticate,hash}));
