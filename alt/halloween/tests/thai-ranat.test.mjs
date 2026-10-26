import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),M=require('../invite-friend/thai-ranat.js');
function harness(){const timers=new Map(),contexts=[];let allowed=false,seq=0,resumeHook=null;const param=()=>({value:0,events:[],setValueAtTime(v,t){this.events.push([v,t]);},linearRampToValueAtTime(v,t){this.events.push([v,t]);},exponentialRampToValueAtTime(v,t){this.events.push([v,t]);},setTargetAtTime(v,t){this.events.push([v,t]);}});
 class Node{constructor(){this.gain=param();this.frequency=param();this.stops=[];}connect(n){return n;}disconnect(){this.disconnected=true;}start(t){this.at=t;}stop(t){this.stops.push(t);}}
 class Audio{constructor(){this.currentTime=0;this.sampleRate=8000;this.state='running';this.voices=[];this.sources=[];contexts.push(this);}createGain(){return new Node();}createOscillator(){const n=new Node();this.voices.push(n);return n;}createBufferSource(){const n=new Node();this.sources.push(n);return n;}createBiquadFilter(){const n=new Node();n.Q=param();return n;}createConvolver(){return new Node();}createBuffer(ch,len){const d=[...Array(ch)].map(()=>new Float32Array(len));return {getChannelData:i=>d[i]};}resume(){return resumeHook?resumeHook():Promise.resolve();}close(){this.state='closed';return Promise.resolve();}}
 const p=M.create({AudioContext:Audio,canPlay:()=>allowed,setInterval(fn){timers.set(++seq,fn);return seq;},clearInterval(id){timers.delete(id);}});return {p,timers,contexts,allow:v=>allowed=v,resumeWith:f=>resumeHook=f};}
test('ranat creates no audio before explicit activation and repeated starts use one clock',async()=>{const h=harness();assert.equal(await h.p.start(),false);assert.equal(h.contexts.length,0);h.allow(true);await h.p.start();await h.p.start();assert.equal(h.contexts.length,1);assert.equal(h.timers.size,1);assert.equal(h.p.status(),'playing');});
test('wooden-bar notes use bounded finite envelopes and stop completely on theme exit',async()=>{const h=harness();h.allow(true);await h.p.start();const c=h.contexts[0];assert.ok(c.voices.length>=3);for(const v of c.voices){assert.ok(v.stops[0]>v.at);assert.ok(v.frequency.events.every(([hz,t])=>Number.isFinite(hz)&&hz>20&&hz<18000&&Number.isFinite(t)));}h.p.setVolume(1000);h.p.stop();assert.equal(h.timers.size,0);assert.equal(c.state,'closed');assert.equal(h.p.status(),'off');assert.ok(c.voices.every(v=>v.disconnected));assert.ok(c.sources.every(v=>v.disconnected&&v.stops[0]>v.at));});
test('a background timer cancels sound and never catches up a backlog',async()=>{const h=harness();h.allow(true);await h.p.start();h.contexts[0].currentTime=3600;for(const f of h.timers.values())f();assert.ok(h.contexts[0].voices.length<40);h.allow(false);for(const f of h.timers.values())f();assert.equal(h.timers.size,0);assert.equal(h.p.status(),'off');});
test('canceling a pending browser resume cannot revive old audio or cancel a newer session',async()=>{const h=harness();h.allow(true);let resolve;h.resumeWith(()=>new Promise(r=>resolve=r));const old=h.p.start();h.p.stop();h.resumeWith(null);assert.equal(await h.p.start(),true);resolve();assert.equal(await old,false);assert.equal(h.contexts.length,2);assert.equal(h.timers.size,1);assert.equal(h.p.status(),'playing');});
test('the lantern melody stays in D–E–G–A–B, every roll sustains a struck note and each section comes home to D',()=>{
 const pc=new Set([2,4,7,9,11]),lines=M.score;
 assert.equal(lines.length,16);
 for(const l of lines){assert.equal(l.length,8);for(const n of l)if(typeof n==='number'){assert.ok(pc.has(n%12),'note '+n);assert.ok(n>=62&&n<=84,'range '+n);}}
 // a roll ('~') never opens a bar, so there is always a struck note in the same bar to keep ringing
 lines.forEach((l,i)=>assert.notEqual(l[0],'~','bar '+i));
 // the melody moves: no bar is silent, and every 8th bar (end of a section) lands on low D
 lines.forEach((l,i)=>{assert.ok(l.some(n=>typeof n==='number'),'empty bar '+i);if(i%8===7)assert.equal(l.filter(n=>typeof n==='number').at(-1),62,'cadence '+i);});
});
test('one ~1:30 cycle goes ruin → band → wailing pi, then the ruin drone returns',async()=>{
 const h=harness();h.allow(true);await h.p.start();const c=h.contexts[0];const tick=()=>{for(const f of h.timers.values())f();};
 const saw=[],drone=[],a4=[];let t=0;
 // walk real time in 0.1 s steps through more than one full cycle
 while(t<100){t+=.1;c.currentTime=t;tick();}
 for(const v of c.voices){const hz=v.frequency.events[0]?.[0];if(v.type==='sawtooth')saw.push(v.at);if(Math.abs(hz-146.83)<.01)drone.push(v.at);if(Math.abs(hz-440)<.01)a4.push(v.at);}
 for(const x of [saw,drone,a4])x.sort((p,q)=>p-q);
 assert.ok(c.sources.length>0&&c.sources.every(v=>v.stops[0]>v.at),'knocks, wind and heartbeat are bounded');
 assert.ok(drone[0]<1,'opens in the ruin drone');
 assert.ok(a4[0]>18&&a4[0]<21,'band enters after ~19 s, at '+a4[0]);
 assert.ok(saw[0]>68&&saw[0]<72,'pi enters after the band, at '+saw[0]);
 assert.ok(saw.at(-1)<84,'pi finishes before the heartbeat tail, at '+saw.at(-1));
 const back=drone.find(x=>x>80);assert.ok(back>87&&back<92,'cycle ≈ 1:30, ruin returns at '+back);
 for(const v of c.voices)assert.ok(v.frequency.events.every(([hz,t])=>Number.isFinite(hz)&&hz>20&&hz<18000&&Number.isFinite(t)));
 // haunted parts use Thai seven-equal steps around D3/D4
 for(const l of M.ruin)for(const k of l)if(k!==null)assert.ok(k>=0&&k<=21);
 for(const[at,k0,k1,d]of M.ghost){assert.ok(k0>=7&&k0<=21&&k1>=7&&k1<=21);assert.ok(at+d<=20,'leaves a heartbeat-only tail');}
 h.p.stop();assert.ok(c.voices.every(v=>v.disconnected)&&c.sources.every(v=>v.disconnected));
});
