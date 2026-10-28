/* Atmosphere follows a saved result. It never grants items or blocks input. */
(()=>{
 'use strict';let layer=null,timer=0;
 const marks={plant:['❧','เมล็ดหยั่งราก'],water:['♧','หยดน้ำปลุกสวน'],harvest:['✧','เก็บผลผลิตแล้ว'],'sell-crop':['◈','ผลผลิตถึงมือพ่อค้า'],quest:['✦','เรื่องราวเดินต่อ'],'equip-weapon':['✧','อาวุธพร้อมแล้ว'],totem:['☾','เส้นทางตอบรับ'],repair:['⚒','เรือพร้อมออกเดินทาง']};
 function clear(){clearTimeout(timer);layer?.remove();layer=null;}
 function present(action,result,reduced){
  const mark=marks[action.type];if(!mark||!result)return;clear();
  layer=document.createElement('div');layer.className='event-moment moment-'+action.type+(reduced?' moment-still':'');layer.setAttribute('aria-hidden','true');
  const seal=document.createElement('span');seal.className='moment-seal';seal.textContent=mark[0];layer.append(seal);
  const text=document.createElement('span');text.className='moment-caption';text.textContent=mark[1];layer.append(text);
  for(let i=0;i<10;i++){const particle=document.createElement('i');particle.style.setProperty('--piece',String(i));particle.style.setProperty('--angle',i*36+'deg');layer.append(particle);}
  document.body.append(layer);timer=setTimeout(clear,reduced?650:1150);
 }
 document.addEventListener('pointerdown',e=>{const b=e.target.closest('button:not(:disabled),a.primary');if(b)b.classList.add('event-pressed');},{passive:true});
 document.addEventListener('animationend',e=>{if(e.animationName==='event-press')e.target.classList.remove('event-pressed');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});window.addEventListener('pagehide',clear);
 window.HalloweenEventFeedback={present,clear};
})();
