(()=>{
 'use strict';
 const core=window.StudentOSTaskScan,draft=core.batch(()=>vaultOwner());let files=[],cropping=false,picking=false,pickOwner=null,active=null,error='';
 const root=()=>document.getElementById('taskScanPages');
 function message(e){error=e?.message||String(e);paint();}
 function button(label,fn,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=fn;return b;}
 function paint(){const r=root();if(!r)return;if(draft.owner!==null&&draft.owner!==vaultOwner()&&!draft.busy){draft.clear();files=[];cropping=false;active=null;error='บัญชีเปลี่ยนแล้ว กรุณาเริ่มชุดรูปใหม่';}const pages=draft.list();r.hidden=!pages.length&&!files.length&&!error;r.innerHTML='';if(r.hidden)return;
  const head=document.createElement('h3');head.textContent='รูปของงานนี้ · '+pages.length+' / 6';const hint=document.createElement('p');hint.textContent='เพิ่มทุกหน้าของงานเดียวกัน แล้วค่อยกดอ่านรวม';r.append(head,hint);const grid=document.createElement('div');grid.className='ts-pages';
  pages.forEach((page,i)=>{const card=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=page.source;img.alt='รูปที่ '+(i+1);caption.textContent='รูปที่ '+(i+1);card.append(img,caption,button('นำรูป '+(i+1)+' ออก',()=>{active=null;draft.remove(i);paint();},draft.busy),button('เลื่อนรูป '+(i+1)+' ขึ้น',()=>{active=null;draft.move(i,-1);paint();},draft.busy||i===0));grid.append(card);});r.append(grid);
  const actions=document.createElement('div');actions.className='ts-actions';actions.append(button('ถ่ายเพิ่ม',()=>openShot(),draft.busy||pages.length+files.length>=6),button('เพิ่มรูปจากเครื่อง',()=>document.getElementById('galleryInput').click(),draft.busy||pages.length+files.length>=6),button(draft.busy?'กำลังอ่านทุกหน้า…':'อ่าน '+pages.length+' รูปรวมเป็นงานเดียว',analyze,draft.busy||picking||cropping||!!files.length||!pages.length),button('เริ่มชุดรูปใหม่',clear,draft.busy));r.append(actions);
  const info=document.createElement('p');info.className='ts-status';info.setAttribute('role','status');info.textContent=error||'ขณะนี้อ่านในเครื่อง · รูปจะเก็บพร้อมงานเมื่อกดบันทึก';r.append(info);
 }
 async function next(){if(cropping||picking||!files.length)return;active=null;cropping=true;await openCropFor(files[0],'ocr');}
 async function pick(selected){try{if(draft.busy||cropping||picking)throw Error('เตรียมรูปปัจจุบันให้เสร็จก่อนนะครับ');const incoming=Array.from(selected||[]);if(!incoming.length)return;if(incoming.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)))throw Error('เลือกภาพ JPG, PNG หรือ WebP นะครับ');if(draft.list().length+files.length+incoming.length>6)throw Error('หนึ่งงานอ่านรวมได้สูงสุด 6 รูป');pickOwner=vaultOwner();files.push(...incoming);error='';paint();await next();}catch(e){message(e);}}
 async function accept(canvas){if(picking)return;picking=true;try{if(pickOwner!==vaultOwner())throw Error('บัญชีเปลี่ยนแล้ว กรุณาเริ่มชุดรูปใหม่');const captured=await StudentOSTaskDetails.captureScan(canvas).ready;if(captured.error)throw Error(captured.error);const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('เปิดรูปไม่ได้'));reader.readAsDataURL(captured.image.blob);});if(pickOwner!==vaultOwner())throw Error('บัญชีเปลี่ยนแล้ว กรุณาเริ่มชุดรูปใหม่');draft.add({id:captured.image.id,source});files.shift();cropping=false;error='';}catch(e){message(e);}finally{picking=false;go('scr-scan');paint();if(!error)await next();}}
 function cancelCrop(){files.shift();cropping=false;go('scr-scan');paint();next();}
 function clear(){try{draft.clear();files=[];cropping=false;pickOwner=null;error='';active=null;paint();}catch(e){message(e);}}
 async function analyze(){let ticket;try{if(files.length||cropping||picking)throw Error('เตรียมรูปทุกหน้าให้เสร็จก่อน');ticket=draft.start();active=ticket;const sources=ticket.pages.map(p=>p.source);sources.batchId=ticket.id;error='';paint();
   // Supabase is suspended. Read the entire batch locally; never probe a cloud endpoint.
   await runOcrOn(sources,'หลายหน้าของงานเดียว');
  }catch(e){message(e);}finally{if(ticket)draft.finish(ticket.id);paint();}}
 function saved(batchId){if(batchId&&active&&active.id===batchId){active=null;clear();}}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)paint();});
 window.StudentOSTaskScanUI=Object.freeze({pick,accept,cancelCrop,analyze,saved,clear,paint});
})();
