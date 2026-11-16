/* วงระนาดสังเคราะห์ ทำนองใหม่ ไม่ใช้เสียงบันทึกหรือเพลงของผู้อื่น */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.StudentOSThaiRanat=factory();})(globalThis,()=>{
 'use strict';
 // 26 ต.ค. 69 · เจ้าของฟังรุ่นเช้า (ตี 3–5 ตัวแล้วเงียบ ไซน์ล้วน) ว่า "เพลงมันกาก" แล้วว่าวงเต็ม "ไม่น่ากลัวเลย"
 // ฟังหลายแบบในห้องลองเสียงแล้วสั่ง: เอา ก "เรือนร้าง" + 2 "วงเต็ม" + ข "ปี่ผีเรียก" มาผสมให้ลงตัว ยาว ~1:30 · วงเต็มเดิม 1:41 ยาวจน "คนไม่ทันฟัง ข"
 // หนึ่งรอบ ≈ 1:29 แล้ววน: เรือนร้าง 19 วิ → วงเต็ม 51 วิ → ปี่ผี 19 วิ (จบที่หัวใจเต้นในความเงียบ ต่อเข้าเสียงหึ่งของเรือนร้างพอดี)
 // ช่วงหลอนใช้บันไดเสียงไทย 7 เสียงเท่า (ขั้นละ ~171 เซนต์) หูที่ชินเพลงสากลได้ยินว่าเพี้ยน = ไม่สบายใจโดยไม่รู้ตัว แต่ยังเป็นเสียงไทย
 // ระนาด = ไม้กระทบ ("ก๊อก" ซ่าสั้น) + โอเวอร์โทนไม่ลงตัว + ตีคู่แปด · ห้องสะท้อนสร้างจากซ่า ไม่ใช้ไฟล์
 const _=null;
 // เรือนร้าง: ขั้นเสียงไทย (0 = D3) · ช่องละ 0.6 วิ · ไล่ลงช้า ๆ แล้วจบที่ D4 (ขั้น 7)
 const ruin=Object.freeze([[14,_,13,_,11,_,_,_,10,9,_,_,7,_,_,_],[7,_,_,_,6,_,_,_,7,_,_,_,_,_,_,_]].map(a=>Object.freeze(a)));
 // วงเต็ม "โคมลอย" D–E–G–A–B · ห้องละ 8 ตัวเขบ็ต · '~' = กรอ (ตีรัวค้างโน้ตก่อนหน้า) · ท่อน A แล้ว B
 const A=[[69,71,74,76,79,76,74,'~'],[76,74,71,69,71,'~',69,'~'],[74,76,79,81,83,81,79,'~'],[81,79,76,74,76,'~',74,'~'],
  [79,'~',76,79,81,79,76,74],[71,74,76,74,71,69,67,'~'],[69,71,74,71,69,67,64,67],[69,'~','~','~',62,'~','~','~']];
 const B=[[79,81,83,81,79,76,79,'~'],[81,79,76,74,76,'~','~','~'],[74,76,74,71,69,71,74,'~'],[76,74,71,69,67,'~',69,'~'],
  [71,74,76,79,76,74,71,74],[76,'~',74,71,69,71,69,67],[64,67,69,71,74,71,69,67],[69,'~','~','~',62,'~','~','~']];
 const score=Object.freeze([...A,...B].map(a=>Object.freeze(a.slice())));
 // ปี่ผี: [จังหวะที่เริ่ม, ขั้นเสียงไทยตอนต้น, ขั้นตอนท้าย, ยาวกี่จังหวะ] · 24 จังหวะ จังหวะละ 0.8 วิ · 4 จังหวะสุดท้ายเหลือแค่หัวใจ
 const ghost=Object.freeze([[0,14,14,3],[3.5,16,15,2.5],[7,13,11,4],[12,17,14,3.5],[16,11,7,4]].map(a=>Object.freeze(a)));
 const RUIN_DT=.6,EIGHTH=60/76/2,GHOST_DT=.2,BASE=146.83,tf=k=>BASE*2**(k/7);
 const RUIN_STEPS=ruin.length*16,BAND_STEPS=score.length*8,GHOST_STEPS=24*4,CYCLE=RUIN_STEPS+BAND_STEPS+GHOST_STEPS;
 // LEVEL: เล่นต่อเนื่องดังกว่ารุ่นเว้นช่วง ~11dB ที่สไลเดอร์เดิม · คูณครึ่งให้ peak ใกล้ของเดิม คนที่ตั้งระดับไว้แล้วจะได้ไม่สะดุ้ง
 const REVERB={ruin:.5,band:.2,ghost:.42},LEVEL=.5;
 function create({AudioContext,canPlay=()=>false,onStatus=()=>{},setInterval:clock=globalThis.setInterval,clearInterval:cancel=globalThis.clearInterval}={}){
  let context=null,master=null,dry=null,wet=null,noise=null,timer=null,next=0,step=0,volume=.24,pending=null,generation=0,state='off';const voices=new Set(),bus=new Set();
  const notify=s=>{state=s;onStatus(s);};
  function stop(){generation++;pending=null;if(timer!==null)cancel(timer);timer=null;for(const {voice,gain}of voices){try{voice.stop();}catch{}voice.disconnect();gain.disconnect();}voices.clear();for(const n of bus)n.disconnect();bus.clear();master=dry=wet=noise=null;const old=context;context=null;if(old)old.close().catch(()=>{});notify('off');}
  function wire(){const c=context,n=c.sampleRate;master=c.createGain();master.gain.value=volume*LEVEL;master.connect(c.destination);dry=c.createGain();dry.connect(master);
   const nb=c.createBuffer(1,n,n),nd=nb.getChannelData(0);for(let i=0;i<n;i++)nd[i]=Math.random()*2-1;noise=nb;
   const len=Math.floor(n*2.4),rb=c.createBuffer(2,len,n);for(let ch=0;ch<2;ch++){const d=rb.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
   const conv=c.createConvolver();wet=c.createGain();conv.buffer=rb;wet.gain.value=REVERB[section(step%CYCLE)];dry.connect(conv);conv.connect(wet).connect(master);[master,dry,conv,wet].forEach(x=>bus.add(x));}
  function track(voice,gain,end){const entry={voice,gain};voices.add(entry);voice.onended=()=>{voices.delete(entry);voice.disconnect();gain.disconnect();};voice.start(end[0],end[2]);voice.stop(end[1]);}
  function env(g,t,peak,a,d){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);}
  function sine(hz,t,peak,a,d,bend=1){if(hz>14000)return;const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.setValueAtTime(hz,t);if(bend!==1)o.frequency.exponentialRampToValueAtTime(hz*bend,t+a+d);env(g,t,peak,a,d);o.connect(g).connect(dry);track(o,g,[t,t+a+d+.05]);}
  function hiss(type,hz,q,peak,d,t){const s=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();s.buffer=noise;f.type=type;f.frequency.value=hz;f.Q.value=q;env(g,t,peak,.001,d);s.connect(f).connect(g).connect(dry);track(s,g,[t,t+d+.05,Math.random()*.8]);}
  // ลูกเสียงสูงดังสั้นกว่าลูกต่ำเหมือนของจริง · มือคนไม่ตรงจังหวะเป๊ะ ±6ms
  function bar(midi,t,v){const hz=440*2**((midi-69)/12),len=Math.max(.28,1.1-(midi-50)*.022);for(const[r,a,k]of [[1,1,1],[2.76,.34,.32],[5.4,.13,.13],[8.93,.05,.06]])sine(hz*r,t,.17*v*a,.002,len*k);hiss('bandpass',Math.min(5200,hz*4.2),1.4,.11*v,.014,t);}
  function ranat(midi,t,v){const h=(Math.random()-.5)*.012;bar(midi,t+h,v);bar(midi-12,t+h+.004,v*.55);}
  // ระนาดทุ้มไม้นวม: ไม่มีเสียงไม้กระทบ ดังยาวกว่า
  function low(hz,t,v){sine(hz,t,.15*v,.01,2.2);sine(hz*2.76,t,.03*v,.006,.55);}
  function ching(t,open,v){for(const[hz,a]of [[2490,1],[3735,.6],[5121,.45],[6410,.25]])sine(hz,t,.022*v*a,.001,open?1.4:.07);hiss('highpass',6500,.7,(open?.04:.09)*v,open?.05:.06,t);}
  function gong(midi,t,v){const hz=440*2**((midi-69)/12);sine(hz,t,.2*v,.012,2.2,.992);sine(hz*2,t,.06*v,.01,1.2,.995);sine(hz*2.92,t,.03*v,.01,.6);}
  // เสียงหึ่งลากยาว: ค่อย ๆ ดังขึ้น ค้าง แล้วค่อย ๆ หาย
  function drone(hz,t,peak,att,hold,rel){const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.setValueAtTime(hz,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+att);g.gain.setValueAtTime(peak,t+att+hold);g.gain.linearRampToValueAtTime(0,t+att+hold+rel);o.connect(g).connect(dry);track(o,g,[t,t+att+hold+rel+.05]);}
  // ลมหวีดลอดฝาไม้: ซ่ากรองแคบ เลื่อนความถี่ขึ้นลง
  function wind(t,dur,f0,f1,peak){const s=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();s.buffer=noise;s.loop=true;f.type='bandpass';f.Q.value=7;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur*.55);f.frequency.exponentialRampToValueAtTime(f0*.8,t+dur);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+dur*.45);g.gain.linearRampToValueAtTime(0,t+dur);s.connect(f).connect(g).connect(dry);track(s,g,[t,t+dur+.05,Math.random()*.5]);}
  // ปี่ = ลิ้นคู่: ฟันเลื่อยกรองให้ทึบ + ยกย่านเสียงจมูก · ลูกคอค่อย ๆ กว้าง · ครึ่งหลังโหยตกลง
  function pi(f0,f1,t,dur){const o=context.createOscillator(),lfo=context.createOscillator(),lg=context.createGain(),lp=context.createBiquadFilter(),nasal=context.createBiquadFilter(),g=context.createGain();
   o.type='sawtooth';o.frequency.setValueAtTime(f0,t);o.frequency.setValueAtTime(f0,t+dur*.55);o.frequency.exponentialRampToValueAtTime(f1,t+dur);
   lfo.frequency.value=5.2;lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(f0*.018,t+dur*.7);lfo.connect(lg).connect(o.frequency);
   lp.type='lowpass';lp.frequency.value=1900;nasal.type='peaking';nasal.frequency.value=1100;nasal.Q.value=1.5;nasal.gain.value=8;
   g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.05,t+.25);g.gain.setValueAtTime(.05,t+dur-.5);g.gain.linearRampToValueAtTime(0,t+dur);
   o.connect(lp).connect(nasal).connect(g).connect(dry);track(o,g,[t,t+dur+.05]);track(lfo,lg,[t,t+dur+.05]);}
  // ตะโพน "ตุบ…ตับ" เหมือนหัวใจ
  function heart(t,v){sine(110,t,.35*v,.004,.22,.5);hiss('lowpass',380,1,.18*v,.08,t);sine(95,t+.24,.25*v,.004,.2,.55);hiss('lowpass',320,1,.12*v,.07,t+.24);}
  function section(p){return p<RUIN_STEPS?'ruin':p<RUIN_STEPS+BAND_STEPS?'band':'ghost';}
  function haunted(i,t){const ph=Math.floor(i/16),s=i%16,k=ruin[ph][s];
   if(i===0){wet.gain.setTargetAtTime(REVERB.ruin,t,1.2);drone(BASE,t,.05,3,7,4);drone(BASE*1.009,t,.045,3,7,4);drone(tf(4),t+1,.02,3,5,4);}
   if(k!==null)low(tf(k),t,ph?.8:1);if(s===0)gong(50,t,.55);if(i===20)wind(t,6,500,1100,.06);if(i===12)ching(t,true,.5);}
  function held(i){for(let k=i-1;k>i-64;k--){const n=score[((Math.floor(k/8)%score.length)+score.length)%score.length][((k%8)+8)%8];if(n!=='~')return n;}return null;}
  function band(i,t){const b=Math.floor(i/8),s=i%8,n=score[b][s];
   if(i===0)wet.gain.setTargetAtTime(REVERB.band,t,1.2);
   if(n==='~'){const m=held(i);if(m!==null){ranat(m,t,.42);ranat(m,t+EIGHTH/2,.36);}}else if(n!==null)ranat(n,t,s%2?.78:1);
   if(s===0||s===4)ching(t,true,s===0?1:.7);if(s===2||s===6)ching(t,false,.9);
   if(s===0)gong(b%2?57:50,t,1);if(b%8===7&&s===4)gong(50,t,.8);}
  // q = ตัวเขบ็ตสองชั้น (0.2 วิ) · 80 ขึ้นไป = ปี่กับฆ้องเงียบ เหลือหัวใจเบา ๆ ก่อนวนกลับเข้าเรือนร้าง
  function ghostly(q,t){if(q===0){wet.gain.setTargetAtTime(REVERB.ghost,t,1.2);wind(t,6,350,900,.07);}
   for(const[at,k0,k1,d]of ghost)if(at*4===q)pi(tf(k0),tf(k1),t,d*.8);
   if(q%8===0)heart(t,q>=80?.6:(q%32===0?1:.8));if(q%16===0&&q<80)gong(45,t,.9);}
  function play(i,t){const p=i%CYCLE;if(p<RUIN_STEPS){haunted(p,t);return RUIN_DT;}if(p<RUIN_STEPS+BAND_STEPS){band(p-RUIN_STEPS,t);return EIGHTH;}ghostly(p-RUIN_STEPS-BAND_STEPS,t);return GHOST_DT;}
  // จองล่วงหน้าแค่ 0.35 วิ · กลับจากพักแท็บแล้วเริ่มจากตอนนี้ ไม่ไล่ตีโน้ตที่ค้าง
  function schedule(){if(!context||!canPlay()){stop();return;}if(next<context.currentTime)next=context.currentTime+.06;while(next<=context.currentTime+.35)next+=play(step++,next);}
  function start(){if(!AudioContext||!canPlay())return Promise.resolve(false);if(pending)return pending;if(timer!==null)return Promise.resolve(true);const ticket=generation;
   try{if(!context){context=new AudioContext();wire();}const current=context;notify('starting');const job=Promise.resolve(current.resume()).then(()=>{if(ticket!==generation||context!==current||!canPlay()){if(context===current)stop();return false;}next=current.currentTime+.08;schedule();timer=clock(schedule,120);notify('playing');return true;}).catch(()=>{if(context===current)stop();return false;}).finally(()=>{if(pending===job)pending=null;});pending=job;return job;}catch{stop();return Promise.resolve(false);}
  }
  function setVolume(v){volume=Math.max(0,Math.min(.45,Number(v)||0));if(master&&context)master.gain.setTargetAtTime(volume*LEVEL,context.currentTime,.04);}
  return Object.freeze({start,stop,setVolume,status:()=>state});
 }
 return Object.freeze({score,ruin,ghost,create});
});
