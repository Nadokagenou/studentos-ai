/* เสียงสังเคราะห์ในเกม เปิดด้วยการกดของผู้เล่นเท่านั้น ไม่โหลดเสียงภายนอก */
(function(root,factory){
  const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.HalloweenEventSound=api;
})(typeof globalThis==='undefined'?this:globalThis,root=>{
  'use strict';
  function create(env={}){
    const Context=env.AudioContext||root.AudioContext||root.webkitAudioContext;
    const later=env.setTimer||root.setTimeout.bind(root),cancel=env.clearTimer||root.clearTimeout.bind(root);
    let enabled=false,visible=true,context=null,master=null,wind=null,timer=0,scene='hub',epoch=0;
    const voices=new Set(),speechVoices=new Set();let lastSyllable=-Infinity;
    function stop(){
      epoch++;cancel(timer);timer=0;
      if(wind){try{wind.stop();wind.disconnect();}catch{}wind=null;}
      for(const voice of voices){try{voice.stop();voice.disconnect();}catch{}}
      voices.clear();speechVoices.clear();lastSyllable=-Infinity;
    }
    function tone(frequency,at,length,volume,type='sine'){
      if(!context||!master)return;
      const osc=context.createOscillator(),gain=context.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,at);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.025);gain.gain.exponentialRampToValueAtTime(.0001,at+length);
      osc.connect(gain);gain.connect(master);voices.add(osc);osc.onended=()=>{voices.delete(osc);speechVoices.delete(osc);try{osc.disconnect();gain.disconnect();}catch{}};
      osc.start(at);osc.stop(at+length+.02);return osc;
    }
    // เสียงกดของ HUD ดันเจี้ยน (24 ต.ค. 69) — สังเคราะห์สด ไม่โหลดไฟล์ · ทุกเสียงลงทะเบียนใน voices จึงหยุดพร้อมกันตอนปิดเสียง/ออกจากหน้า
    let noiseBuffer=null;
    function noise(at,length,volume,frequency,type='bandpass'){
      if(!context||!master)return;
      if(!noiseBuffer){noiseBuffer=context.createBuffer(1,Math.max(1,Math.floor(context.sampleRate*.5)),context.sampleRate);const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
      const src=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
      src.buffer=noiseBuffer;filter.type=type;filter.frequency.setValueAtTime(frequency,at);
      gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+length);
      src.connect(filter);filter.connect(gain);gain.connect(master);voices.add(src);src.onended=()=>{voices.delete(src);try{src.disconnect();filter.disconnect();gain.disconnect();}catch{}};
      src.start(at);src.stop(at+length+.02);
    }
    // เสียงไถลระดับ (บานพับเหล็กเอี๊ยด) — ผ่าน lowpass ให้คลื่นฟันเลื่อยไม่บาดหู
    function glide(from,to,at,length,volume,cutoff=700){
      if(!context||!master)return;
      const osc=context.createOscillator(),filter=context.createBiquadFilter(),gain=context.createGain();
      osc.type='sawtooth';osc.frequency.setValueAtTime(from,at);osc.frequency.exponentialRampToValueAtTime(to,at+length);
      filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,at);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.08);gain.gain.exponentialRampToValueAtTime(.0001,at+length);
      osc.connect(filter);filter.connect(gain);gain.connect(master);voices.add(osc);osc.onended=()=>{voices.delete(osc);try{osc.disconnect();filter.disconnect();gain.disconnect();}catch{}};
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
      if(!context){context=new Context();noiseBuffer=null;master=context.createGain();master.gain.value=.09;master.connect(context.destination);}
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
      const t=context.currentTime;
      // หินกระทบหิน: เสียงแตกสั้น ๆ + ทุ้มหนึ่งที (ปุ่มบน · ปุ่มในหน้าต่าง)
      if(kind==='stone'){noise(t,.07,.5,1700);tone(82,t,.13,.32);return true;}
      // รูนเรือง: เคาะเบา ๆ + ระฆังสองเสียงห่าง tritone (ช่วงเสียงที่ฟังแล้วไม่สบายใจ) (แถบล่าง)
      if(kind==='rune'){noise(t,.05,.3,2300);tone(440,t+.02,.45,.15,'triangle');tone(622.25,t+.06,.55,.11,'triangle');return true;}
      // ประตูเหล็ก: บานพับเอี๊ยดลากยาว แล้วกระแทกตัวหยุด (เปิดประตู · จุดเดียวของหน้าที่ยาวกว่าครึ่งวินาที)
      if(kind==='gate'){glide(150,92,t,.78,.22);glide(305,190,t+.04,.7,.07,1100);noise(t+.6,.24,.6,900);[233,587,1046,1611].forEach((f,i)=>tone(f,t+.6,.6-.1*i,.2-.04*i,'triangle'));return true;}
      const notes=({tap:[390],door:[98,146.83],npc:[261.63,311.13],coins:[523.25,659.25,783.99],water:[440,329.63,261.63],harvest:[329.63,440,659.25],magic:[164.81,246.94,369.99,493.88],ghost:[196,146.83,110],error:[130.81,123.47]})[kind]||[390];
      notes.forEach((f,i)=>tone(f,context.currentTime+i*.075,kind==='door'?.5:.22,kind==='tap'?.09:.3,kind==='door'?'triangle':'sine'));return true;
    }
    function syllable(character='vesper',step=0){
      if(!enabled||!visible||!context||context.state!=='running'||context.currentTime-lastSyllable<.105)return false;
      lastSyllable=context.currentTime;
      const [base,type]=({tang:[145,'triangle'],jack:[220,'square'],dech:[185,'sine'],win:[105,'triangle'],morro:[165,'triangle'],mora:[285,'sine'],vesper:[235,'sine']})[character]||[210,'sine'];
      const f=base*[1,1.125,1,.89,1.25][step%5];
      for(const [ratio,volume]of [[1,.22],[2.02,.055]]){const voice=tone(f*ratio,context.currentTime,.085,volume,type);if(voice)speechVoices.add(voice);}
      return true;
    }
    function stopDialogue(){for(const voice of speechVoices){try{voice.stop();voice.disconnect();}catch{}voices.delete(voice);}speechVoices.clear();}
    function dispose(){enabled=false;stop();const old=context;context=null;master=null;noiseBuffer=null;try{old?.close()?.catch(()=>{});}catch{}}
    return {setEnabled,setVisible,setScene,play,syllable,stopDialogue,dispose,state:()=>({enabled,visible,playing:!!timer,voices:voices.size,scene})};
  }
  return {create};
});
