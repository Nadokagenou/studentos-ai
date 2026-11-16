// Private group rooms. No chat content or invite codes are stored on this device.
const classroomState={owner:null,epoch:0,room:null,messages:[],readSeq:0,reading:false,pending:new Map(),writing:false};
const classEl=id=>document.getElementById(id);
const classEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const classWhen=v=>v?new Date(v).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}):'ไม่ระบุกำหนด';
function classroomMessage(text,error=false){classEl('classMessage').textContent=text;classEl('classMessage').classList.toggle('class-error',error);}
function classroomAccountChanged(){
 const owner=typeof currentUser!=='undefined'?currentUser?.id||null:null;
 if(owner===classroomState.owner)return;
 Object.assign(classroomState,{owner,epoch:classroomState.epoch+1,room:null,messages:[],readSeq:classroomState.readSeq+1,reading:false,writing:false});
 classroomState.pending.clear();
 for(const id of ['classRooms','classMessages','classMembers','classInvite','classRoomName','classRoomStatus'])classEl(id).replaceChildren();
 for(const id of ['classCreateForm','classJoinForm','classTextForm','classTaskForm'])classEl(id).reset();
 classEl('classListView').hidden=false;classEl('classRoomView').hidden=true;classEl('classTaskBox').hidden=true;
 classroomMessage('');
}
function classroomGuard(owner,epoch){if(!owner||owner!==currentUser?.id||owner!==classroomState.owner||epoch!==classroomState.epoch)throw Error('CLASS_ACCOUNT_CHANGED');}
function classroomError(error){
 const text=String(error?.message||'');
 const labels={CLASS_AUTH:'กรุณาเข้าสู่ระบบก่อนครับ',CLASS_ACCOUNT_CHANGED:'บัญชีเปลี่ยนแล้ว กรุณาเปิดห้องอีกครั้ง',CLASS_BANNED:'บัญชีนี้ถูกระงับการใช้งานออนไลน์',CLASS_NOT_MEMBER:'คุณไม่ได้อยู่ในห้องนี้แล้ว',CLASS_REMOVED:'เจ้าของนำบัญชีนี้ออกจากห้องแล้ว',CLASS_NOT_OWNER:'เฉพาะเจ้าของห้องเท่านั้น',CLASS_CLOSED:'ห้องนี้ปิดแล้ว อ่านประวัติได้แต่ส่งเพิ่มไม่ได้',CLASS_INVALID_CODE:'ไม่พบรหัสห้อง หรือห้องปิดแล้ว',CLASS_RATE_LIMIT:'ทำรายการถี่เกินไป กรุณารอสักครู่',CLASS_NEED_SYNC:'กรุณารอซิงก์บัญชีให้เสร็จก่อนรับงาน',CLASS_ROOM_LIMIT:'ห้องหรือสมาชิกเต็มตามจำนวนที่รองรับ',CLASS_OWNER_CANNOT_LEAVE:'เจ้าของต้องปิดห้องแทนการออกจากห้อง',CLASS_BAD_INPUT:'กรุณาตรวจข้อมูลที่กรอก',CLASS_REQUEST_MISMATCH:'ข้อมูลรายการเปลี่ยนแล้ว กรุณาลองใหม่'};
 return Object.entries(labels).find(([key])=>text.includes(key))?.[1]||'เชื่อมต่อไม่ได้ ข้อความที่พิมพ์ยังอยู่ ลองใหม่ได้ครับ';
}
async function classroomRpc(action,payload={},owner=classroomState.owner,epoch=classroomState.epoch){
 classroomGuard(owner,epoch);if(!sb)throw Error('CLASS_AUTH');
 const {data,error}=await sb.rpc('classroom_command',{p_action:action,p_payload:{...payload,expected_user:owner}}).abortSignal(AbortSignal.timeout(10000));
 classroomGuard(owner,epoch);if(error)throw error;if(data?.error)throw Error(data.error);return data;
}
async function classroomWrite(action,payload){
 if(classroomState.writing)return null;
 const owner=classroomState.owner,epoch=classroomState.epoch;
 const key=JSON.stringify([action,payload]);
 if(!classroomState.pending.has(key))classroomState.pending.set(key,crypto.randomUUID());
 classroomState.writing=true;classroomMessage('กำลังบันทึก…');
 document.querySelectorAll('#scr-classrooms form button').forEach(b=>b.disabled=true);
 try{
  const result=await classroomRpc(action,{...payload,request_id:classroomState.pending.get(key)},owner,epoch);
  classroomState.pending.delete(key);return result;
 }catch(error){if(owner===currentUser?.id&&epoch===classroomState.epoch)classroomMessage(classroomError(error),true);return null;}
 finally{if(owner===currentUser?.id&&epoch===classroomState.epoch){classroomState.writing=false;classroomToggleForms();}}
}
function classroomToggleForms(){
 document.querySelectorAll('#scr-classrooms form button').forEach(b=>b.disabled=!classroomState.owner||classroomState.writing);
 const closed=!!classroomState.room?.closed;
 for(const id of ['classTextSend','classTaskSend','classTaskOpen'])classEl(id).disabled=!classroomState.owner||closed||classroomState.writing;
}
function openClassrooms(){go('scr-classrooms');}
function classroomsEnter(){classroomAccountChanged();void classroomList();}
async function classroomList(){
 if(classroomState.writing)return;
 classroomAccountChanged();classEl('classListView').hidden=false;classEl('classRoomView').hidden=true;classroomState.room=null;classroomState.readSeq++;
 classroomToggleForms();
 if(!classroomState.owner){classEl('classRooms').textContent='เข้าสู่ระบบก่อนสร้างหรือเข้าร่วมห้องครับ';return;}
 const epoch=classroomState.epoch;
 classEl('classRooms').textContent='กำลังอ่านห้องของคุณ…';
 try{
  const result=await classroomRpc('list');if(epoch!==classroomState.epoch||classroomState.room)return;
  classEl('classRooms').innerHTML=(result.items||[]).map(r=>`<button class="class-room-card" data-class-open="${classEsc(r.id)}"><b>${classEsc(r.name)}</b><span>${r.kind==='classroom'?'ห้องเรียน':'แชตกลุ่ม'} · ${Number(r.member_count)} คน${r.closed_at?' · ปิดห้องแล้ว':''}${Number(r.unread)?' · ใหม่ '+Number(r.unread):''}</span></button>`).join('')||'<p>ยังไม่มีห้อง สร้างห้องหรือขอรหัสจากเจ้าของห้องได้ครับ</p>';
 }catch(e){if(epoch===classroomState.epoch)classEl('classRooms').textContent=classroomError(e);}
}
async function classroomOpen(id){
 if(classroomState.writing)return;
 classroomAccountChanged();classroomState.room={id};classroomState.messages=[];
 classEl('classListView').hidden=true;classEl('classRoomView').hidden=false;classEl('classTaskBox').hidden=true;
 classEl('classTextForm').reset();classEl('classTaskForm').reset();classEl('classMembers').replaceChildren();classEl('classInvite').textContent='';
 classEl('classRoomName').textContent='กำลังเปิดห้อง…';classEl('classMessages').replaceChildren();classroomMessage('');
 await classroomRead(true);
}
function classroomRenderMessages(){
 const list=classEl('classMessages');const nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<100;
 list.innerHTML=classroomState.messages.map(m=>`<article class="class-bubble ${m.mine?'class-mine':''}"><p class="class-by">${classEsc(m.sender)} · ${classEsc(classWhen(m.created_at))}</p>${m.deleted?'<p>ข้อความถูกลบแล้ว</p>':`<p class="class-text">${classEsc(m.body)}</p>${m.task?`<section class="class-task"><b>${classEsc(m.task.subject)}</b><p class="class-text">${classEsc(m.task.detail)}</p><p>กำหนดส่ง ${classEsc(classWhen(m.task.due))} · ประมาณ ${Number(m.task.estMin)} นาที</p><button class="class-button" data-class-accept="${classEsc(m.id)}" ${m.accepted?'disabled':''}>${m.accepted?'รับเข้าแผนแล้ว':'รับเข้าแผนของฉัน'}</button></section>`:''}${m.can_delete?`<button class="class-text-button" data-class-delete="${classEsc(m.id)}">ลบข้อความ</button>`:''}`}</article>`).join('')||'<p>เริ่มคุยหรือส่งการ์ดงานให้สมาชิกได้เลยครับ</p>';
 if(nearBottom)list.scrollTop=list.scrollHeight;
}
async function classroomRead(full=false,before=null){
 const room=classroomState.room;if(!room||!classroomState.owner)return;
 if(!full&&!before&&classroomState.reading)return;
 const seq=++classroomState.readSeq,epoch=classroomState.epoch;
 classroomState.reading=true;
 const last=classroomState.messages.at(-1)?.id;
 try{
  const result=await classroomRpc('room',{room:room.id,limit:Math.max(50,Math.min(classroomState.messages.length,200)),...(before?{before}:!full&&room.revision?{revision:room.revision}:{})});
  if(seq!==classroomState.readSeq||epoch!==classroomState.epoch||room.id!==classroomState.room?.id)return;
  if(result.unchanged)return;
  classroomState.room=result.room;
  const merged=new Map((before?classroomState.messages:[]).map(m=>[m.id,m]));for(const m of result.messages)merged.set(m.id,m);
  classroomState.messages=[...merged.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
  classroomRenderMessages();classEl('classRoomName').textContent=result.room.name;
  classEl('classRoomStatus').textContent=`${result.members.filter(m=>m.status==='active').length} คน · ${result.room.closed?'ห้องปิดแล้ว':'ข้อความอัปเดตอัตโนมัติขณะเปิดห้อง'}`;
  classEl('classInvite').textContent=result.room.invite_code?'รหัสเชิญ: '+result.room.invite_code+' · แชร์รหัสนี้ให้คนที่ต้องการเชิญเท่านั้น':'';
  classEl('classOwnerTools').hidden=!result.room.is_owner||result.room.closed;classEl('classLeave').hidden=result.room.is_owner;
  classEl('classMembers').innerHTML=result.members.map(m=>`<li><span>${classEsc(m.name)}${m.owner?' · เจ้าของ':''}${m.status!=='active'?' · ออกจากห้องแล้ว':''}</span>${result.room.is_owner&&!m.owner&&!result.room.closed?`<button class="class-text-button" data-class-member="${classEsc(m.id)}" data-class-action="${m.status==='active'?'remove_member':'restore_member'}">${m.status==='active'?'นำออก':'ให้กลับเข้าห้อง'}</button>`:''}</li>`).join('');
  classEl('classOlder').hidden=!result.has_older;
  classroomToggleForms();
 }catch(e){if(seq===classroomState.readSeq&&epoch===classroomState.epoch){classroomMessage(classroomError(e),true);if(/CLASS_NOT_MEMBER|CLASS_BANNED/.test(String(e.message)))void classroomList();}}
 finally{if(seq===classroomState.readSeq)classroomState.reading=false;}
}
async function classroomAccept(message){
 if(classroomState.writing||!classroomState.room)return;
 const owner=classroomState.owner,epoch=classroomState.epoch,room=classroomState.room.id;
 classroomState.writing=true;classroomToggleForms();classroomMessage('กำลังรับงานและซิงก์แผน…');let committed=false;
 try{
  await syncSerial(async()=>{
   classroomGuard(owner,epoch);
   if(typeof cloudWritableFor==='function'&&!cloudWritableFor(owner))throw Error('CLASS_NEED_SYNC');
   await pushRound();classroomGuard(owner,epoch);
   await classroomRpc('accept',{room,message},owner,epoch);committed=true;
   await cloudPull();classroomGuard(owner,epoch);
  });
  if(typeof renderAll==='function')renderAll();
  classroomMessage('รับงานไว้ในแผนของคุณแล้วครับ');await classroomRead(true);
 }catch(e){if(epoch===classroomState.epoch)classroomMessage(committed?'รับงานไว้แล้ว แต่ยังอัปเดตแผนในเครื่องไม่ได้ ลองซิงก์บัญชีอีกครั้งครับ':classroomError(e),true);}
 finally{if(epoch===classroomState.epoch){classroomState.writing=false;classroomToggleForms();}}
}
function classroomTaskFormOpen(){
 if(classroomState.writing)return;
 classEl('classTaskBox').hidden=false;classEl('classTaskForm').reset();
 classEl('classTaskFrom').innerHTML='<option value="">เขียนงานใหม่</option>'+(state.tasks||[]).filter(t=>!t.done).map(t=>`<option value="${classEsc(t.id)}">${classEsc(t.subject+' · '+t.detail)}</option>`).join('');
}
classEl('classCreateForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!e.target.reportValidity())return;
 const result=await classroomWrite('create',{name:classEl('className').value.trim(),kind:classEl('classKind').value});
 if(result){e.target.reset();await classroomOpen(result.id);}
});
classEl('classJoinForm').addEventListener('submit',async e=>{
 e.preventDefault();const result=await classroomWrite('join',{code:classEl('classCode').value.trim()});
 if(result){e.target.reset();await classroomOpen(result.id);}
});
classEl('classTextForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!e.target.reportValidity()||!classroomState.room)return;
 const input=classEl('classText'),body=input.value.trim();if(!body)return;
 const result=await classroomWrite('post',{room:classroomState.room.id,kind:'text',body});
 if(result){if(input.value.trim()===body)input.value='';classroomMessage('ส่งแล้วครับ');await classroomRead();}
});
classEl('classTaskForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!e.target.reportValidity()||!classroomState.room)return;
 const due=classEl('classTaskDue').value;
 const task={subject:classEl('classTaskSubject').value.trim(),detail:classEl('classTaskDetail').value.trim(),estMin:Number(classEl('classTaskMinutes').value),due:due?new Date(due).toISOString():null};
 const result=await classroomWrite('post',{room:classroomState.room.id,kind:'task',body:'',task});
 if(result){e.target.reset();classEl('classTaskBox').hidden=true;classroomMessage('ส่งการ์ดงานแล้ว สมาชิกเลือกกดรับเข้าแผนได้ครับ');await classroomRead();}
});
classEl('classTaskFrom').onchange=e=>{
 const t=(state.tasks||[]).find(t=>t.id===e.target.value);if(!t)return;
 classEl('classTaskSubject').value=t.subject||'';classEl('classTaskDetail').value=t.detail||'';classEl('classTaskMinutes').value=t.estMin||30;
 const d=t.due?new Date(t.due):null;classEl('classTaskDue').value=d&&!Number.isNaN(d.getTime())?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16):'';
};
classEl('classTaskOpen').onclick=classroomTaskFormOpen;
classEl('classTaskCancel').onclick=()=>{classEl('classTaskBox').hidden=true;};
classEl('classBack').onclick=()=>void classroomList();
classEl('classRefresh').onclick=()=>classroomState.room?void classroomRead(true):void classroomList();
classEl('classOlder').onclick=()=>void classroomRead(false,classroomState.messages[0]?.id);
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||classroomState.writing)return;
 if(b.dataset.classOpen)return void classroomOpen(b.dataset.classOpen);
 if(b.dataset.classAccept)return void classroomAccept(b.dataset.classAccept);
 const room=classroomState.room?.id;if(!room)return;
 if(b.dataset.classDelete){
  if(!window.confirm('ลบข้อความนี้? การ์ดที่สมาชิกกดรับไว้แล้วจะยังอยู่ในแผนของเขา'))return;
  if(await classroomWrite('delete_message',{room,message:b.dataset.classDelete})){classroomMessage('ลบข้อความแล้ว');await classroomRead(true);}return;
 }
 if(b.dataset.classMember){
  if(!window.confirm(b.dataset.classAction==='remove_member'?'นำสมาชิกคนนี้ออกจากห้อง? เขาจะอ่านและส่งในห้องไม่ได้จนกว่าจะให้กลับเข้า':'ให้สมาชิกคนนี้กลับเข้าห้อง?'))return;
  if(await classroomWrite(b.dataset.classAction,{room,target:b.dataset.classMember})){classroomMessage('อัปเดตสมาชิกแล้ว');await classroomRead(true);}return;
 }
 const action={classRotate:'rotate',classClose:'close',classLeave:'leave'}[b.id];if(!action)return;
 if(!window.confirm({rotate:'เปลี่ยนรหัสเชิญ? รหัสเดิมจะเข้าห้องไม่ได้',close:'ปิดห้องนี้? สมาชิกยังอ่านประวัติได้ แต่ส่งเพิ่มไม่ได้',leave:'ออกจากห้องนี้? งานที่รับไว้ในแผนของคุณยังอยู่'}[action]))return;
 if(await classroomWrite(action,{room})){classroomMessage('บันทึกแล้ว');if(action==='leave')await classroomList();else await classroomRead(true);}
});
setInterval(()=>{
 if(document.hidden||typeof curScreen==='undefined'||curScreen!=='scr-classrooms')return;
 classroomAccountChanged();if(classroomState.room)void classroomRead();
},4000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&typeof curScreen!=='undefined'&&curScreen==='scr-classrooms'){classroomAccountChanged();if(classroomState.room)void classroomRead(true);else void classroomList();}});
