/* Local playback of server-issued boards. Only the server saves proofs and rewards. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HalloweenGamePlayback=factory();})(globalThis,()=>{
 'use strict';const clone=x=>JSON.parse(JSON.stringify(x));
 function create({id,brain=false,Core,config,read,now,perform,onChange=()=>{},onError=()=>{}}){
  const readGame=()=>brain?read().event.brainGame:read().event.games[id];
  let game=clone(readGame()),inputs=[],retryPacket=null,flight=null,error='',closed=false;
  let session=game.session;
  const state=()=>({game,pending:!!flight||!!retryPacket||inputs.length>0,error});
  const notify=()=>{if(!closed)onChange(state());};
  function project(base,row){
   // A move only writes these event containers. Keep the rest of the verified save shared and untouched.
   const saved=read(),e=saved.event,doc={...saved,event:{...e,games:{...e.games},proofs:{...e.proofs},inventory:{...e.inventory},ledger:[...e.ledger]}},inputAt=base.startAt+row[1];if(brain)doc.event.brainGame=clone(base);else doc.event.games[id]=clone(base);doc.event.clock=Math.min(doc.event.clock,inputAt);
   Core.dispatch(doc,config,{type:brain?'brain-move':'game-move',...(!brain?{game:id}:{}),session,move:row[0]},{now:inputAt-doc.event.timeOffset,tx:'local-playback'});
   return brain?doc.event.brainGame:doc.event.games[id];
  }
  function flush(){
   if(flight)return flight;
   if(!retryPacket&&!inputs.length)return Promise.resolve();
   error='';
   const job=(async()=>{
    while(retryPacket||inputs.length){
     const packet=retryPacket||{type:brain?'brain-inputs':'game-inputs',...(!brain?{game:id}:{}),session,inputs:inputs.splice(0,48)};retryPacket=packet;
     let result;try{result=await perform(packet,{silent:true});}catch{}
     if(!result){error='ยังยืนยันผลไม่ได้ ตรวจการเชื่อมต่อแล้วส่งลำดับเดิมอีกครั้ง';onError(error);break;}
     const saved=readGame();
     if(!saved||saved.session!==session){error='รอบเกมเปลี่ยนแล้ว อ่านผลจากเซฟล่าสุดก่อนเล่นต่อ';onError(error);break;}
     retryPacket=null;game=clone(saved);
     try{for(const row of inputs)game=project(game,row);}catch{error='ลำดับการเล่นเปลี่ยนไป อ่านผลจากเซฟล่าสุดก่อนเล่นต่อ';onError(error);break;}
    }
   })();
   flight=job;const settled=()=>{if(flight===job)flight=null;notify();};job.then(settled,settled);notify();return job;
  }
  function tap(move){
   if(closed||error||game.finished)return false;
   const row=[move,Math.max(game.lastInputAt||game.startAt,Math.floor(now()))-game.startAt];
   try{game=project(game,row);}catch(e){if(!closed)onError(e.message);return false;}
   inputs.push(row);if(game.finished||inputs.length>=48)void flush();else notify();return true;
  }
  function reset(){game=clone(readGame());session=game.session;inputs=[];retryPacket=null;error='';notify();}
  return Object.freeze({state,tap,flush,reset,settling:()=>flight,close(){closed=true;return flush();}});
 }
 return Object.freeze({create});
});
