import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../rewards/theme-main.js', import.meta.url), 'utf8');
const musicSource = source.slice(source.indexOf('  const MUSIC_SCORE ='), source.indexOf('  function tone('));
function harness() {
  const intervals = new Map(), contexts = [], writes = [];
  let timerId = 0;
  const parameter = () => ({value:0, values:[], setValueAtTime(v,t){this.values.push([v,t]);}, linearRampToValueAtTime(v,t){this.values.push([v,t]);}, exponentialRampToValueAtTime(v,t){this.values.push([v,t]);}});
  class AudioNode {
    constructor(){this.gain=parameter();this.frequency=parameter();this.stops=[];}
    connect(next){this.connected=next;return next;}
    disconnect(){this.disconnected=true;}
    start(at){this.started=at??0;}
    stop(at){this.stops.push(at??0);}
  }
  class AudioContext {
    constructor(){this.currentTime=0;this.sampleRate=40;this.state='running';this.voices=[];contexts.push(this);}
    createGain(){return new AudioNode();}
    createOscillator(){const n=new AudioNode();this.voices.push(n);return n;}
    createBuffer(){return {getChannelData(){return new Float32Array(80);}};}
    createBufferSource(){this.wind=new AudioNode();return this.wind;}
    createBiquadFilter(){return new AudioNode();}
    resume(){this.state='running';return Promise.resolve();}
    close(){this.state='closed';return Promise.resolve();}
  }
  const sandbox={window:{AudioContext},document:{hidden:false},root:{dataset:{}},Math,Set,
    updateControls(){},write(k,v){writes.push([k,v]);},
    setInterval(fn){intervals.set(++timerId,fn);return timerId;},clearInterval(id){intervals.delete(id);}};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(`let active=true, enabled=false, volume=.35, musicEnabled=true;
    let context,master,wind,windGain,musicBus,musicTimer=0,nextBarAt=0,musicBar=0;
    const musicVoices=new Set(),MUSIC_KEY='studentos.alt.halloween.music';
    ${musicSource}
    globalThis.api={audio,stopAudio,setMusic,
      enable(v){enabled=v;},activate(v){active=v;},
      state(){return {musicTimer,voices:musicVoices.size,bar:musicBar,scoreBars:MUSIC_SCORE.length};}};`,ctx);
  return {api:ctx.api,root:sandbox.root,document:sandbox.document,intervals,contexts,writes};
}

test('music never starts before sound is enabled or while hidden',()=>{
  const h=harness();assert.equal(h.api.audio(),false);assert.equal(h.contexts.length,0);
  h.api.enable(true);h.document.hidden=true;assert.equal(h.api.audio(),false);assert.equal(h.intervals.size,0);
});
test('one music clock and one wind source survive repeated taps',()=>{
  const h=harness();h.api.enable(true);assert.equal(h.api.audio(),true);
  const voices=h.api.state().voices;assert.ok(voices>4);assert.equal(h.api.state().scoreBars,8);
  for(let i=0;i<20;i++)h.api.audio();
  assert.equal(h.intervals.size,1);assert.equal(h.contexts.length,1);assert.equal(h.api.state().voices,voices);
  assert.equal(h.root.dataset.hwMusic,'playing');
});
test('the score schedules bass, chords and pitched melody with finite envelopes',()=>{
  const h=harness();h.api.enable(true);h.api.audio();
  const voices=h.contexts[0].voices;
  assert.ok(voices.some(v=>v.type==='triangle'));
  assert.ok(voices.some(v=>v.frequency.values.some(([hz])=>Math.abs(hz-880)<.01)));
  for(const voice of voices){assert.ok(voice.started>=0);assert.ok(voice.stops[0]>voice.started);assert.ok(voice.frequency.values.every(([hz,at])=>Number.isFinite(hz)&&hz>0&&Number.isFinite(at)));}
});
test('turning music off cancels queued notes but keeps effects available',()=>{
  const h=harness();h.api.enable(true);h.api.audio();const audio=h.contexts[0];
  h.api.setMusic(false);assert.equal(h.intervals.size,0);assert.equal(h.api.state().voices,0);
  assert.ok(audio.voices.every(v=>v.stops.length===2&&v.disconnected));
  assert.equal(audio.state,'running');assert.equal(audio.wind.stops.length,0);
  h.api.audio();assert.equal(h.intervals.size,0);
  h.api.setMusic(true);assert.equal(h.intervals.size,1);assert.equal(h.contexts.length,1);
});
test('theme exit or hiding closes audio and clears the music timer',()=>{
  const h=harness();h.api.enable(true);h.api.audio();h.document.hidden=true;h.api.stopAudio();
  assert.equal(h.contexts[0].state,'closed');assert.equal(h.intervals.size,0);assert.equal(h.api.state().voices,0);
  assert.equal(h.root.dataset.hwAudio,'off');assert.equal(h.root.dataset.hwMusic,'off');
  h.document.hidden=false;h.api.activate(false);assert.equal(h.api.audio(),false);
  assert.match(source,/visibilitychange[^\n]+document\.hidden\) stopAudio\(\)/);
  assert.match(source,/restore\(\); stopAudio\(\)/);
});
test('a delayed scheduler skips missed time without a burst of old bars',()=>{
  const h=harness();h.api.enable(true);h.api.audio();const audio=h.contexts[0];
  const before=audio.voices.length;audio.currentTime=200;[...h.intervals.values()][0]();
  assert.equal(h.api.state().bar,2);assert.ok(audio.voices.slice(before).every(v=>v.started>=200));
  assert.ok(audio.voices.length-before<=16);
});
test('an old context closing cannot overwrite the new audio status',()=>{
  const h=harness();h.api.enable(true);h.api.audio();const old=h.contexts[0];
  h.api.stopAudio();h.api.audio();old.onstatechange();
  assert.equal(h.contexts.length,2);assert.equal(h.root.dataset.hwAudio,'running');assert.equal(h.intervals.size,1);
});
