/* วงระนาดสังเคราะห์ ทำนองใหม่ ไม่ใช้เสียงบันทึกหรือเพลงของผู้อื่น */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.StudentOSThaiRanat=factory();})(globalThis,()=>{
 'use strict';
 // 26 ต.ค. 69 รอบสอง · เจ้าของฟังรุ่นเช้าแล้วบอกว่า "เพลงมันกาก" — เลือกแบบ 2 จากห้องลองเสียง
 // รุ่นเช้าตีวลีละ 3–5 ตัวแล้วเงียบ 3–6 วิ (ฟังเป็นติ๊งสุ่ม) · ไซน์ล้วนขึ้นช้า 12ms (เป็นบี๊บ ไม่ใช่ไม้) · เบส D2 ลำโพงมือถือเล่นไม่ออก
 // รุ่นนี้: ทำนอง "โคมลอย" D–E–G–A–B เดินต่อเนื่องทีละตัวเขบ็ต · '~' = กรอ (ตีรัวค้างโน้ตเดิม) · ท่อน A A B B ≈ 1 นาทีครึ่งแล้ววน
 // ระนาด = ไม้กระทบ ("ก๊อก" ซ่าสั้น) + โอเวอร์โทนไม่ลงตัว + ตีคู่แปด · ฉิ่ง/ฉับคุมจังหวะ · ฆ้องลงหัวห้อง · ห้องสะท้อนสร้างจากซ่า ไม่ใช้ไฟล์
 const A=[[69,71,74,76,79,76,74,'~'],[76,74,71,69,71,'~',69,'~'],[74,76,79,81,83,81,79,'~'],[81,79,76,74,76,'~',74,'~'],
  [79,'~',76,79,81,79,76,74],[71,74,76,74,71,69,67,'~'],[69,71,74,71,69,67,64,67],[69,'~','~','~',62,'~','~','~']];
 const B=[[79,81,83,81,79,76,79,'~'],[81,79,76,74,76,'~','~','~'],[74,76,74,71,69,71,74,'~'],[76,74,71,69,67,'~',69,'~'],
  [71,74,76,79,76,74,71,74],[76,'~',74,71,69,71,69,67],[64,67,69,71,74,71,69,67],[69,'~','~','~',62,'~','~','~']];
 const score=Object.freeze([...A,...A,...B,...B].map(a=>Object.freeze(a.slice())));
 // LEVEL: วงเต็มเล่นต่อเนื่อง ดังกว่ารุ่นเว้นช่วง ~11dB ที่สไลเดอร์เดิม · คูณครึ่งให้ peak ใกล้ของเดิม คนที่ตั้งระดับไว้แล้วจะได้ไม่สะดุ้ง
 const BPM=76,EIGHTH=60/BPM/2,REVERB=.2,LEVEL=.5;
 function create({AudioContext,canPlay=()=>false,onStatus=()=>{},setInterval:clock=globalThis.setInterval,clearInterval:cancel=globalThis.clearInterval}={}){
  let context=null,master=null,dry=null,noise=null,timer=null,next=0,step=0,volume=.24,pending=null,generation=0,state='off';const voices=new Set(),bus=new Set();
  const notify=s=>{state=s;onStatus(s);};
  function stop(){generation++;pending=null;if(timer!==null)cancel(timer);timer=null;for(const {voice,gain}of voices){try{voice.stop();}catch{}voice.disconnect();gain.disconnect();}voices.clear();for(const n of bus)n.disconnect();bus.clear();master=dry=noise=null;const old=context;context=null;if(old)old.close().catch(()=>{});notify('off');}
  function wire(){const c=context,n=c.sampleRate;master=c.createGain();master.gain.value=volume*LEVEL;master.connect(c.destination);dry=c.createGain();dry.connect(master);
   const nb=c.createBuffer(1,n,n),nd=nb.getChannelData(0);for(let i=0;i<n;i++)nd[i]=Math.random()*2-1;noise=nb;
   const len=Math.floor(n*2.4),rb=c.createBuffer(2,len,n);for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
   const conv=c.createConvolver(),wet=c.createGain();conv.buffer=rb;wet.gain.value=REVERB;dry.connect(conv);conv.connect(wet).connect(master);[master,dry,conv,wet].forEach(x=>bus.add(x));}
  function track(voice,gain,end){const entry={voice,gain};voices.add(entry);voice.onended=()=>{voices.delete(entry);voice.disconnect();gain.disconnect();};voice.start(end[0],end[2]);voice.stop(end[1]);}
  function env(g,t,peak,a,d){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);}
  function sine(hz,t,peak,a,d,bend=1){if(hz>14000)return;const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.setValueAtTime(hz,t);if(bend!==1)o.frequency.exponentialRampToValueAtTime(hz*bend,t+a+d);env(g,t,peak,a,d);o.connect(g).connect(dry);track(o,g,[t,t+a+d+.05]);}
  function hiss(type,hz,q,peak,d,t){const s=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();s.buffer=noise;f.type=type;f.frequency.value=hz;f.Q.value=q;env(g,t,peak,.001,d);s.connect(f).connect(g).connect(dry);track(s,g,[t,t+d+.05,Math.random()*.8]);}
  // ลูกเสียงสูงดังสั้นกว่าลูกต่ำเหมือนของจริง · มือคนไม่ตรงจังหวะเป๊ะ ±6ms
  function bar(midi,t,v){const hz=440*2**((midi-69)/12),len=Math.max(.28,1.1-(midi-50)*.022);for(const[r,a,k]of [[1,1,1],[2.76,.34,.32],[5.4,.13,.13],[8.93,.05,.06]])sine(hz*r,t,.17*v*a,.002,len*k);hiss('bandpass',Math.min(5200,hz*4.2),1.4,.11*v,.014,t);}
  function ranat(midi,t,v){const h=(Math.random()-.5)*.012;bar(midi,t+h,v);bar(midi-12,t+h+.004,v*.55);}
  function ching(t,open,v){for(const[hz,a]of [[2490,1],[3735,.6],[5121,.45],[6410,.25]])sine(hz,t,.022*v*a,.001,open?1.4:.07);hiss('highpass',6500,.7,(open?.04:.09)*v,open?.05:.06,t);}
  function gong(midi,t,v){const hz=440*2**((midi-69)/12);sine(hz,t,.2*v,.012,2.2,.992);sine(hz*2,t,.06*v,.01,1.2,.995);sine(hz*2.92,t,.03*v,.01,.6);}
  function held(i){for(let k=i-1;k>i-64;k--){const n=score[((Math.floor(k/8)%score.length)+score.length)%score.length][((k%8)+8)%8];if(n!=='~')return n;}return null;}
  function play(i,t){const b=Math.floor(i/8)%score.length,s=i%8,n=score[b][s];
   if(n==='~'){const m=held(i);if(m!==null){ranat(m,t,.42);ranat(m,t+EIGHTH/2,.36);}}else if(n!==null)ranat(n,t,s%2?.78:1);
   if(s===0||s===4)ching(t,true,s===0?1:.7);if(s===2||s===6)ching(t,false,.9);
   if(s===0)gong(b%2?57:50,t,1);if(b%8===7&&s===4)gong(50,t,.8);}
  // จองล่วงหน้าแค่ 0.35 วิ · กลับจากพักแท็บแล้วเริ่มจากตอนนี้ ไม่ไล่ตีโน้ตที่ค้าง
  function schedule(){if(!context||!canPlay()){stop();return;}if(next<context.currentTime)next=context.currentTime+.06;while(next<=context.currentTime+.35){play(step++,next);next+=EIGHTH;}}
  function start(){if(!AudioContext||!canPlay())return Promise.resolve(false);if(pending)return pending;if(timer!==null)return Promise.resolve(true);const ticket=generation;
   try{if(!context){context=new AudioContext();wire();}const current=context;notify('starting');const job=Promise.resolve(current.resume()).then(()=>{if(ticket!==generation||context!==current||!canPlay()){if(context===current)stop();return false;}next=current.currentTime+.08;schedule();timer=clock(schedule,120);notify('playing');return true;}).catch(()=>{if(context===current)stop();return false;}).finally(()=>{if(pending===job)pending=null;});pending=job;return job;}catch{stop();return Promise.resolve(false);}
  }
  function setVolume(v){volume=Math.max(0,Math.min(.45,Number(v)||0));if(master&&context)master.gain.setTargetAtTime(volume*LEVEL,context.currentTime,.04);}
  return Object.freeze({start,stop,setVolume,status:()=>state});
 }
 return Object.freeze({score,create});
});
