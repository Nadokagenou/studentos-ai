/* Verified event receipts in memory. Preferences never imply ownership. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./catalog.js'));else{root.HalloweenEntitlements=factory(root.StudentOSHalloweenRewards);root.HalloweenEntitlements.install();}})(globalThis,C=>{
 'use strict';
 const ids=new Set(C.items.map(x=>x.id));
 function receipt(doc,owner,id){const r=doc?.rewards?.[id];return !!owner&&doc?.owner===owner&&doc.season==='halloween-2026'&&ids.has(id)&&r?.id===id&&r.permanent===true&&typeof r.receipt==='string'&&r.receipt.length>0;}
 function create({owner,createAccount,onChange=()=>{},clock=Date.now}){
  let uid=null,account=null,rights=new Set(),status='login',pending=null,epoch=0,at=0;
  function identity(){const next=owner()||null;if(next!==uid){const old=account;uid=next;account=null;rights=new Set();pending=null;at=0;epoch++;status=uid?'idle':'login';old?.dispose();}}
  const view=()=>{identity();return {owner:uid,status,owned:[...rights]};};
  function owns(id){identity();return (status==='ready'||status==='refreshing')&&rights.has(id);}
  function refresh(force=false){identity();if(!uid)return Promise.resolve(view());if(pending)return pending;if(!force&&status==='ready'&&clock()-at<30000)return Promise.resolve(view());const who=uid,generation=epoch;status=status==='ready'?'refreshing':'loading';
   const job=Promise.resolve().then(async()=>{if(generation!==epoch||who!==owner())return view();try{account||=createAccount(()=>{if(generation!==epoch)return;rights=new Set();status='idle';onChange();});const current=account;await current.refresh();identity();if(generation!==epoch||who!==uid)return view();const doc=current.read();if(doc.owner!==who)throw Error('Account mismatch');rights=new Set([...ids].filter(id=>receipt(doc,who,id)));status='ready';at=clock();}catch{identity();if(generation===epoch){rights=new Set();status='error';}}finally{if(generation===epoch){pending=null;onChange();}}return view();});pending=job;onChange();return job;
  }
  return Object.freeze({view,owns,refresh});
 }
 function install(){if(typeof document==='undefined'||!C)return;const preview=window.__HW_SHOWROOM__===true,reader=create({owner:()=>typeof currentUser==='undefined'?null:currentUser?.id,createAccount:onChange=>{if(typeof sb==='undefined'||!sb||!window.HalloweenAccount)throw Error('Account unavailable');return window.HalloweenAccount.create({client:sb,onChange:value=>{if(value===null)onChange();}});},onChange:paint});
  function paint(){if(typeof applyTheme==='function')applyTheme();if(typeof renderFxPick==='function')renderFxPick();window.HalloweenCosmetics?.syncCostumes();if(typeof applyMascot==='function')applyMascot();if(document.querySelector('#scr-room.on')&&typeof renderRoom==='function')renderRoom();}
  function explain(){const s=reader.view();if(typeof showToast==='function')showToast({title:!s.owner?'เข้าสู่ระบบเพื่อใช้รางวัล':s.status==='error'?'ยังตรวจสิทธิ์ไม่ได้':'ยังไม่ได้รับรางวัลนี้',body:'รับจากอีเวนต์ก่อนเลือกใช้ · ของทดลองไม่เข้าสู่บัญชีจริง'});if(!preview)reader.refresh(true);}
  window.HalloweenRewardAccess=Object.freeze({owns:id=>preview&&ids.has(id)||reader.owns(id),view:()=>preview?{status:'preview',owned:[...ids]}:reader.view(),refresh:force=>preview?Promise.resolve():reader.refresh(force),explain});
  for(const name of ['go','renderProfileHead']){const original=window[name];if(typeof original==='function')window[name]=function(...args){const r=original.apply(this,args);reader.view();if(!preview)reader.refresh();return r;};}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!preview)reader.refresh(true);});
  let ownerSeen=null;setInterval(()=>{const current=typeof currentUser==='undefined'?null:currentUser?.id;if(current!==ownerSeen){ownerSeen=current;reader.view();paint();if(!preview)reader.refresh(true);}},1500);
  if(!preview)reader.refresh();
 }
 return Object.freeze({receipt,create,install});
});
