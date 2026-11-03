/* Application extraction rules and a device-only, owner-bound photo draft. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.StudentOSTaskScan=factory();})(globalThis,()=>{
 'use strict';
 const clean=s=>String(s??'').replace(/\r\n?/g,'\n').trim(),norm=s=>clean(s).replace(/\s+/g,' ');
 function fields(title,details='',raw=''){
  const full=clean(title),first=full.split('\n')[0],headline=first.split(/\s+[—–]\s+|\s*(?:คำสั่ง|วิธีทำ|สิ่งที่ต้องส่ง|ข้อกำหนด)\s*[:：]|\s+ข้อ(?:ที่)?\s*(?=[\d๐-๙])|\s+พร้อม(?:แสดง|เขียน)|\s+ส่ง(?:เป็น|ผ่าน|ใน|ภายใน)|\s+แบ่งกลุ่ม/)[0].trim();
  const short=Array.from(headline||first).slice(0,60).join('').trim()||'งานจากรูป';
  const strip=s=>clean(s).split('\n').filter(l=>norm(l)!==norm(short)).join('\n').trim();
  const blocks=[];
  for(const part of [full!==short?full:'',details,raw]){const value=strip(part);if(!value)continue;if(blocks.some(b=>norm(b).includes(norm(value))))continue;for(let i=blocks.length-1;i>=0;i--)if(norm(value).includes(norm(blocks[i])))blocks.splice(i,1);blocks.push(value);}
  return {title:short,note:blocks.join('\n\n')};
 }
 function localFields(parsedTitle,raw){const lines=clean(raw).split('\n').map(l=>l.trim()).filter(Boolean);const heading=lines.find(l=>/ใบงาน|แบบฝึก|โครงงาน|รายงาน|กิจกรรม|บทที่|เรื่อง/.test(l)&&!/^(?:คำสั่ง|คำชี้แจง|วิธีทำ|กำหนดส่ง)/.test(l));return fields(heading||parsedTitle,'',raw);}
 function batch(owner){let pages=[],who=null,busy=null,serial=0;
  function valid(){if(who!==null&&who!==owner())throw Error('บัญชีเปลี่ยนแล้ว กรุณาเริ่มชุดรูปใหม่');}
  function editable(){valid();if(busy)throw Error('กำลังอ่านรูปชุดนี้อยู่');}
  return Object.freeze({
   add(page){editable();if(pages.length>=6)throw Error('หนึ่งงานอ่านรวมได้สูงสุด 6 รูป');who=owner();pages.push(page);},
   list:()=>pages.slice(),
   remove(i){editable();pages.splice(i,1);},
   move(i,d){editable();const j=i+d;if(i>=0&&i<pages.length&&j>=0&&j<pages.length)[pages[i],pages[j]]=[pages[j],pages[i]];},
   start(){editable();if(!pages.length)throw Error('เพิ่มรูปของงานก่อนนะครับ');busy='scan-'+(++serial);return Object.freeze({id:busy,owner:who,pages:Object.freeze(pages.slice())});},
   finish(id){if(busy===id)busy=null;},
   clear(){if(busy)throw Error('รออ่านรูปให้เสร็จก่อน');pages=[];who=null;},
   get busy(){return !!busy;},get owner(){return who;},
  });
 }
 function imageBlob(source){const m=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(source);if(!m)throw Error('รูปไม่พร้อมอ่าน');return new Blob([Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0))],{type:m[1]});}
 async function readPages(sources,{read,decode,onPage=()=>{}}){const pages=Array.isArray(sources)?sources:[sources];if(!pages.length||pages.length>6)throw Error('เลือก 1–6 รูปของงานเดียวกัน');const results=[];
  for(let i=0;i<pages.length;i++){onPage(i+1,pages.length);const decoded=typeof pages[i]==='string'?await decode(imageBlob(pages[i])):pages[i];try{const r=await read(decoded);if(String(r.text||'').trim().length<5)throw Error('อ่านรูปที่ '+(i+1)+' ไม่ครบ กรุณาถ่ายใหม่หรือเอารูปนี้ออก');results.push(r);}finally{if(decoded!==pages[i])decoded.close?.();}}
  return {...results[0],text:results.map(r=>r.text).join('\n\n'),conf:Math.min(...results.map(r=>r.conf)),lowWords:results.flatMap(r=>r.lowWords||[]),fields:results.reduce((n,r)=>n+(r.fields||0),0),ms:results.reduce((n,r)=>n+(r.ms||0),0),passes:results.reduce((n,r)=>n+(r.passes||1),0)};
 }
 return Object.freeze({fields,localFields,batch,imageBlob,readPages});
});
