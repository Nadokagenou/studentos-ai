/* ALT task form adapter. Reuses the existing vault; never starts upload or sync. */
(()=>{
 'use strict';
 const staged=new Map(),managed=new Map(),MAX_TEXT=10000,MAX_IMAGES=6,MAX_IMAGE_BYTES=1048576;
 const key=(owner,id)=>JSON.stringify([owner,id]);
 function checkOwner(owner){if(owner!==vaultOwner())throw Error('บัญชีเปลี่ยนแล้ว เปิดงานอีกครั้งก่อนบันทึก');}
 async function get(owner,taskId){checkOwner(owner);const task=vaultFindHolder(taskId),images=[];
  // Remote-only and excess photos stay in the vault; opening a form never downloads them.
  for(const meta of vaultFiles(task).filter(m=>m.kind==='q')){if(images.length>=MAX_IMAGES)break;const record=await VaultStore.getBlob(meta.id);checkOwner(owner);if(!record||record.owner!==owner||!record.blob)continue;images.push({id:meta.id,name:meta.name||'รูปโจทย์',blob:record.blob,width:meta.w,height:meta.h,origin:meta.source,meta});}
  managed.set(key(owner,taskId),new Set(images.map(i=>i.id)));
  return {owner,taskId,text:task?.note||'',images,updatedAt:task&&(task.note||vaultFiles(task).length)?Date.now():null};
 }
 async function save(owner,taskId,value){checkOwner(owner);const text=String(value.text||''),images=value.images||[];
  if(text.length>MAX_TEXT||images.length>MAX_IMAGES)throw Error('รายละเอียดหรือจำนวนรูปเกินขนาดที่รองรับ');
  const holder=vaultFindHolder(taskId),known=new Map(vaultFiles(holder).map(m=>[m.id,m])),ids=managed.get(key(owner,taskId))||new Set();
  const added=images.filter(i=>!known.has(i.id));if(added.length>vaultCapLeft(vaultHolders())+vaultFiles(holder).filter(m=>ids.has(m.id)&&!images.some(i=>i.id===m.id)).length)throw Error('คลังงานเต็มแล้ว');
  const metas=[];
  for(const image of images){checkOwner(owner);if(known.has(image.id)){metas.push(known.get(image.id));continue;}
   if(!image.blob||image.blob.type!=='image/jpeg'||image.blob.size>MAX_IMAGE_BYTES)throw Error('รูปไม่พร้อมเก็บในคลังงาน');
   const at=Date.now();await VaultStore.putBlob({id:image.id,owner,blob:image.blob,at,pending:false,localOnly:true});checkOwner(owner);
   metas.push({id:image.id,kind:'q',w:image.width,h:image.height,bytes:image.blob.size,at,up:false,localOnly:true,name:image.name,source:image.origin});
  }
  staged.set(key(owner,taskId),{owner,taskId,text,metas,managed:ids});return {owner,taskId,text,images,updatedAt:Date.now()};
 }
 function applyTo(task){const k=key(vaultOwner(),task.id),value=staged.get(k);if(!value)return;checkOwner(value.owner);
  task.note=value.text;
  const replace=new Set([...value.managed,...value.metas.map(m=>m.id)]),files=vaultFiles(task).filter(m=>!replace.has(m.id)).concat(value.metas);
  if(files.length)task.files=files;else delete task.files;
  managed.set(k,new Set(value.metas.map(m=>m.id)));staged.delete(k);
 }
 window.StudentOSTaskDetailsStore=Object.freeze({create:()=>Object.freeze({get,save}),applyTo,MAX_TEXT,MAX_IMAGES,MAX_IMAGE_BYTES});
})();
