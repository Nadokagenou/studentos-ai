import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Sound=require('../event/sound.js');
function harness(){
  const timers=new Map(),nodes=[],contexts=[];let sequence=0;
  const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  class Node{constructor(){this.frequency=param();this.gain=param();nodes.push(this);}connect(){}disconnect(){this.disconnected=true;}start(at=0){this.started=at;}stop(at=0){this.stopped=at;}}
  class Context{constructor(){this.state='suspended';this.currentTime=4;this.sampleRate=100;this.destination={};contexts.push(this);}async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}createGain(){return new Node();}createOscillator(){const n=new Node();n.osc=true;return n;}createBufferSource(){const n=new Node();n.source=true;return n;}createBiquadFilter(){return new Node();}createBuffer(c,l){const data=new Float32Array(l);return{getChannelData:()=>data};}}
  const audio=Sound.create({AudioContext:Context,setTimer:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimer:id=>timers.delete(id)});
  return{audio,timers,nodes,contexts};
}
test('event audio stays silent until enabled and repeated interactions keep one score and one wind loop',async()=>{
  const h=harness();assert.equal(h.audio.play('door'),false);h.audio.setScene('shop');h.audio.setVisible(true);assert.equal(h.contexts.length,0);
  await h.audio.setEnabled(true);for(let i=0;i<8;i++)await h.audio.setEnabled(true);
  assert.equal(h.contexts.length,1);assert.equal(h.timers.size,1);assert.equal(h.nodes.filter(n=>n.source).length,1);
  assert.equal(h.audio.state().playing,true);assert.equal(h.audio.play('water'),true);
  const voices=h.nodes.filter(n=>n.osc);assert.ok(voices.length>=8);assert.ok(voices.every(n=>Number.isFinite(n.stopped)&&n.stopped>n.started&&n.stopped-n.started<=3));
  await h.audio.setEnabled(false);assert.equal(h.timers.size,0);assert.equal(h.audio.state().voices,0);assert.equal(h.audio.play('coins'),false);assert.equal(h.contexts[0].state,'suspended');
});
test('hiding or leaving clears audio, and returning cannot duplicate its clocks',async()=>{
  const h=harness();await h.audio.setEnabled(true);h.audio.setVisible(false);assert.equal(h.timers.size,0);assert.equal(h.audio.state().voices,0);
  h.audio.setVisible(true);await Promise.resolve();assert.equal(h.timers.size,1);
  h.audio.dispose();assert.equal(h.timers.size,0);assert.equal(h.audio.state().playing,false);assert.equal(h.contexts[0].state,'closed');
});
