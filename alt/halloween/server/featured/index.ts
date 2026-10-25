import {create} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
async function database(route,method='GET',body=undefined){
 const r=await fetch(url+'/rest/v1/'+route,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!r.ok)throw Error('Database unavailable');return r.status===204?null:r.json();
}
const authenticate=async authorization=>{
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization))return null;
 const r=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});if(!r.ok)return null;const user=await r.json();
 if(typeof user.id!=='string'||!/^[0-9a-f-]{36}$/i.test(user.id)||user.is_anonymous)return null;
 const allowed=await fetch(url+'/rest/v1/rpc/staff_account_allowed',{method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:'{}'});
 return allowed.ok&&await allowed.json()===true?user.id:null;
};
Deno.serve(create({authenticate,
 async readReward(uid){return (await database('halloween_states?user_id=eq.'+uid+'&season=eq.halloween-2026&select=document'))[0]?.document;},
 async readSelection(uid){return (await database('halloween_featured_badges?user_id=eq.'+uid+'&select=user_id,season,badge_id,earned_at,selected_at'))[0]||null;},
 async writeSelection(row,uid){if(!row){await database('halloween_featured_badges?user_id=eq.'+uid,'DELETE');return null;}return (await database('halloween_featured_badges?on_conflict=user_id','POST',row))[0];}
}));
