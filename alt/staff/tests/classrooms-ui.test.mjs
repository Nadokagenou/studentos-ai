import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
const source=await readFile(new URL('../../classrooms.js',import.meta.url),'utf8');
function fixture(responder){
 const elements=new Map(),calls=[],order=[];
 const get=id=>{
  if(!elements.has(id))elements.set(id,{value:'',hidden:false,textContent:'',innerHTML:'',disabled:false,scrollHeight:0,scrollTop:0,clientHeight:0,
   classList:{toggle(){}},replaceChildren(){this.innerHTML='';this.textContent='';},reset(){this.value='';},addEventListener(){},reportValidity:()=>true});
  return elements.get(id);
 };
 const c=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[],addEventListener(){},hidden:false},window:{confirm:()=>true},
  currentUser:{id:'account-a'},state:{tasks:[]},curScreen:'scr-classrooms',crypto:{randomUUID},AbortSignal,Date,BigInt,setInterval(){},
  syncSerial:async fn=>fn(),cloudWritableFor:()=>true,pushRound:async()=>order.push('push'),cloudPull:async()=>order.push('pull'),renderAll:()=>order.push('render'),go(){},
  sb:{rpc:(name,args)=>({abortSignal:async()=>{calls.push({name,args});order.push(args.p_action);return responder(args);}})},
 });
 vm.runInContext(source,c);vm.runInContext('classroomAccountChanged()',c);
 return {c,get,calls,order,run:s=>vm.runInContext(s,c)};
}
const room={id:'room-a',name:'Test room',is_owner:true,revision:'1',closed:false,invite_code:'ABCD12345678'};
const snapshot={room,members:[],messages:[],has_older:false};
test('account changes wipe room text, cards, invitation and in-flight results',async()=>{
 let resolve;
 const f=fixture(()=>new Promise(r=>resolve=r));
 f.run("classroomState.room={id:'room-a'}");const loading=f.run('classroomRead(true)');
 f.get('classMessages').innerHTML='private message';f.get('classInvite').textContent='private code';
 f.c.currentUser={id:'account-b'};f.run('classroomAccountChanged()');
 resolve({data:{...snapshot,messages:[{id:'1',body:'previous account',created_at:new Date().toISOString()}]},error:null});await loading;
 assert.equal(f.get('classMessages').innerHTML,'');assert.equal(f.get('classInvite').textContent,'');assert.equal(f.run('classroomState.room'),null);
});
test('failed writes keep the same idempotency key and bind the authenticated account',async()=>{
 const f=fixture(async()=>({error:{message:'network'}}));
 await f.run("classroomWrite('post',{room:'room-a',kind:'text',body:'hello'})");
 await f.run("classroomWrite('post',{room:'room-a',kind:'text',body:'hello'})");
 assert.equal(f.calls[0].args.p_payload.request_id,f.calls[1].args.p_payload.request_id);
 assert.equal(f.calls[0].args.p_payload.expected_user,'account-a');
 assert.match(f.get('classMessage').textContent,/ข้อความที่พิมพ์ยังอยู่/);
});
test('accept serializes local push, server acceptance and cloud pull before rendering',async()=>{
 const f=fixture(async a=>({data:a.p_action==='room'?snapshot:{task_id:'new-task',present:true},error:null}));
 f.run("classroomState.room={id:'room-a'}");await f.run("classroomAccept('1')");
 assert.deepEqual(f.order.slice(0,4),['push','accept','pull','render']);
 assert.equal(f.calls.find(x=>x.args.p_action==='accept').args.p_payload.expected_user,'account-a');
});
test('an unchanged room refresh preserves typed text and does not redraw messages',async()=>{
 const f=fixture(async()=>({data:{unchanged:true},error:null}));
 f.run("classroomState.room={id:'room-a',revision:'7'}");f.get('classText').value='draft text';f.get('classMessages').innerHTML='existing messages';
 await f.run('classroomRead()');
 assert.equal(f.get('classText').value,'draft text');assert.equal(f.get('classMessages').innerHTML,'existing messages');
 assert.equal(f.calls[0].args.p_payload.revision,'7');
});
test('chat and task cards escape all member-provided text',()=>{
 const f=fixture(async()=>({data:snapshot,error:null}));
 f.c.example={id:'1',sender:'<img onerror=bad>',body:'<script>bad</script>',created_at:new Date().toISOString(),task:{subject:'<b>math</b>',detail:'<img src=x>',estMin:30}};
 f.run('classroomState.messages=[example];classroomRenderMessages()');
 const html=f.get('classMessages').innerHTML;assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;b&gt;math/);
});
test('room navigation while saving cannot discard or redirect the current draft',async()=>{
 let resolve;
 const f=fixture(()=>new Promise(r=>resolve=r));
 f.run("classroomState.room={id:'room-a'}");f.get('classText').value='draft in room-a';
 const writing=f.run("classroomWrite('post',{room:'room-a',kind:'text',body:'draft in room-a'})");
 await f.run("classroomOpen('room-b')");await f.run('classroomList()');
 assert.equal(f.run('classroomState.room.id'),'room-a');assert.equal(f.get('classText').value,'draft in room-a');
 resolve({data:{id:'1'},error:null});await writing;
 assert.equal(f.run('classroomState.writing'),false);
});
