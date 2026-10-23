/* เสียงสังเคราะห์ในเกม เปิดด้วยการกดของผู้เล่นเท่านั้น ไม่โหลดเสียงภายนอก */
(function(root,factory){
  const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.HalloweenEventSound=api;
})(typeof globalThis==='undefined'?this:globalThis,root=>{
  'use strict';
  function create(env={}){
    const Context=env.AudioContext||root.AudioContext||root.webkitAudioContext;
    const later=env.setTimer||root.setTimeout.bind(root),cancel=env.clearTimer||root.clearTimeout.bind(root);
    let enabled=false,visible=true,context=null,master=null,wind=null,timer=0,scene='hub',epoch=0;
    const voices=new Set();
    function stop(){
      epoch++;cancel(timer);timer=0;
      if(wind){try{wind.stop();wind.disconnect();}catch{}wind=null;}
      for(const voice of voices){try{voice.stop();voice.disconnect();}catch{}}
      voices.clear();
    }
    function tone(frequency,at,length,volume,type='sine'){
      if(!context||!master)return;
      const osc=context.createOscillator(),gain=context.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,at);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.025);gain.gain.exponentialRampToValueAtTime(.0001,at+length);
      osc.connect(gain);gain.connect(master);voices.add(osc);osc.onended=()=>{voices.delete(osc);try{osc.disconnect();gain.disconnect();}catch{}};
      osc.start(at);osc.stop(at+length+.02);
    }
    function score(mark){
      if(mark!==epoch||!enabled||!visible||!context||context.state!=='running')return;
      const base=({hub:130.81,garden:146.83,shop:164.81,cauldron:138.59,ritual:123.47,biome:110})[scene]||130.81,t=context.currentTime;
      tone(base/2,t,2.9,.13);[2,2.3784,2.9966,2.6697].forEach((ratio,i)=>tone(base*ratio,t+i*.72,1.1,.065,'triangle'));
      timer=later(()=>score(mark),2800);
    }
    async function start(){
      if(!enabled||!visible||!Context)return false;
      if(!context){context=new Context();master=context.createGain();master.gain.value=.09;master.connect(context.destination);}
      const current=context;try{await current.resume();}catch{return false;}
      if(current!==context||!enabled||!visible||timer||wind)return false;
      const mark=++epoch,buffer=current.createBuffer(1,current.sampleRate*2,current.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.12;
      wind=current.createBufferSource();wind.buffer=buffer;wind.loop=true;
      const filter=current.createBiquadFilter();filter.type='lowpass';filter.frequency.value=360;wind.connect(filter);filter.connect(master);wind.start();
      score(mark);return true;
    }
    async function setEnabled(value){enabled=value===true;if(!enabled){stop();try{await context?.suspend();}catch{}return false;}return start();}
    function setVisible(value){visible=value===true;if(!visible){stop();try{context?.suspend()?.catch(()=>{});}catch{}}else if(enabled)start();}
    function setScene(value){scene=value;}
    function play(kind='tap'){
      if(!enabled||!visible||!context||context.state!=='running')return false;
      const notes=({tap:[390],door:[98,146.83],npc:[261.63,311.13],coins:[523.25,659.25,783.99],water:[440,329.63,261.63],harvest:[329.63,440,659.25],magic:[164.81,246.94,369.99,493.88],ghost:[196,146.83,110],error:[130.81,123.47]})[kind]||[390];
      notes.forEach((f,i)=>tone(f,context.currentTime+i*.075,kind==='door'?.5:.22,kind==='tap'?.09:.3,kind==='door'?'triangle':'sine'));return true;
    }
    function dispose(){enabled=false;stop();const old=context;context=null;master=null;try{old?.close()?.catch(()=>{});}catch{}}
    return {setEnabled,setVisible,setScene,play,dispose,state:()=>({enabled,visible,playing:!!timer,voices:voices.size,scene})};
  }
  return {create};
});
