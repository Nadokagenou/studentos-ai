/* ระนาดสังเคราะห์ ทำนองใหม่ ไม่ใช้เสียงบันทึกหรือเพลงของผู้อื่น */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.StudentOSThaiRanat=factory();})(globalThis,()=>{
 'use strict';
 const score=Object.freeze([[76,null,79,83,null,81],[79,null,76,74,null,null],[71,null,74,76,79,null],[74,71,null,69,null,null],[76,79,null,83,86,null],[83,null,81,79,null,76],[74,null,71,69,67,null],[71,null,null,64,null,null],[76,null,79,81,83,null],[86,83,null,81,null,79],[76,null,74,71,null,69],[67,null,null,71,null,null],[74,76,79,null,76,null],[71,null,69,67,null,64],[67,71,null,74,null,71],[64,null,null,null,null,null]].map(a=>Object.freeze(a)));
 function create({AudioContext,canPlay=()=>false,onStatus=()=>{},setInterval:clock=globalThis.setInterval,clearInterval:cancel=globalThis.clearInterval}={}){
  let context=null,master=null,timer=null,next=0,bar=0,volume=.24,pending=null,generation=0,state='off';const voices=new Set();
  const notify=s=>{state=s;onStatus(s);};
  function stop(){generation++;pending=null;if(timer!==null)cancel(timer);timer=null;for(const {voice,gain}of voices){try{voice.stop();}catch{}voice.disconnect();gain.disconnect();}voices.clear();if(master)master.disconnect();master=null;const old=context;context=null;if(old)old.close().catch(()=>{});notify('off');}
  function note(midi,at,strength=1){const hz=440*2**((midi-69)/12);for(const[ratio,amp,decay]of [[1,.13,1.45],[2.98,.042,.42],[5.97,.018,.19],[8.91,.006,.075]]){
    if(hz*ratio>17000)continue;const voice=context.createOscillator(),gain=context.createGain(),entry={voice,gain};voice.type='sine';voice.frequency.setValueAtTime(hz*ratio,at);gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(amp*strength,at+.003);gain.gain.exponentialRampToValueAtTime(.0001,at+decay);voice.connect(gain).connect(master);voices.add(entry);voice.onended=()=>{voices.delete(entry);voice.disconnect();gain.disconnect();};voice.start(at);voice.stop(at+decay+.03);
   }}
  function schedule(){if(!context||!canPlay()){stop();return;}if(next<context.currentTime)next=context.currentTime+.06;if(next>context.currentTime+.35)return;const eighth=60/58/2,line=score[bar++%score.length];line.forEach((n,i)=>{if(n!==null)note(n,next+i*eighth,i%3===0?1:.7);});if(bar%4===1)note(40,next,.35);next+=eighth*6;}
  function start(){if(!AudioContext||!canPlay())return Promise.resolve(false);if(pending)return pending;if(timer!==null)return Promise.resolve(true);const ticket=generation;
   try{if(!context){context=new AudioContext();master=context.createGain();master.gain.value=volume;master.connect(context.destination);}const current=context;notify('starting');const job=Promise.resolve(current.resume()).then(()=>{if(ticket!==generation||context!==current||!canPlay()){if(context===current)stop();return false;}next=current.currentTime+.08;schedule();timer=clock(schedule,150);notify('playing');return true;}).catch(()=>{if(context===current)stop();return false;}).finally(()=>{if(pending===job)pending=null;});pending=job;return job;}catch{stop();return Promise.resolve(false);}
  }
  function setVolume(v){volume=Math.max(0,Math.min(.45,Number(v)||0));if(master&&context)master.gain.setTargetAtTime(volume,context.currentTime,.04);}
  return Object.freeze({start,stop,setVolume,status:()=>state});
 }
 return Object.freeze({score,create});
});
