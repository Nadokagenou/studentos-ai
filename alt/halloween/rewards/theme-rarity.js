/* จัดชั้นสะสมจากข้อมูลเดิม ย้ายปุ่มจริงเพื่อคงสิทธิ์และการกดหาอีสเตอร์เอ้ก */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.StudentOSThemeRarity=api;api.install();}})(globalThis,()=>{
 'use strict';
 const tiers=Object.freeze([{id:'basic',name:'พื้นฐาน',en:'Basic',color:'#A9B6C8'},{id:'uncommon',name:'พิเศษ',en:'Uncommon',color:'#91C7A6'},{id:'rare',name:'หายาก',en:'Rare',color:'#8FB9EB'},{id:'epic',name:'มหากาพย์',en:'Epic',color:'#C5A3E1'},{id:'legendary',name:'ตำนาน',en:'Legendary',color:'#E7BD79'},{id:'secret',name:'ลับ',en:'Secret',color:'#E5A1BA'},{id:'mythical',name:'มหัศจรรย์',en:'Mythical',color:'#83D6CF'},{id:'limited',name:'คอลเลกชันพิเศษ',en:'Limited',color:'#D7C293'}]);
 function classify(id,{catalog,spinTable=[],shop={},craft={}}={}){
  if(id==='thai-ghost')return 'limited';if(id==='genesis')return 'mythical';if(id==='astral'||craft[id]||['deepocean','earth2','sweet'].includes(id))return 'secret';
  const event=catalog?.items.find(x=>x.kind==='theme'&&x.theme===id);if(event)return String(event.rarity).toLowerCase();
  const draw=spinTable.find(x=>x.kind==='skin'&&x.theme===id);if(draw)return draw.rarity;if(shop[id])return 'uncommon';return 'basic';
 }
 function groups(entries,source){return tiers.map(t=>({tier:t.id,ids:entries.filter(e=>e.visible&&classify(e.id,source)===t.id).map(e=>e.id)})).filter(g=>g.ids.length);}
 function install(){if(typeof document==='undefined')return;const picker=document.getElementById('themePick');if(!picker)return;
  picker.classList.add('th-catalog');const source=()=>({catalog:window.StudentOSHalloweenRewards,spinTable:typeof SPIN_TABLE==='undefined'?[]:SPIN_TABLE,shop:typeof THEME_SHOP==='undefined'?{}:THEME_SHOP,craft:typeof THEME_CRAFT==='undefined'?{}:THEME_CRAFT});
  const sections=new Map();for(const t of tiers){const box=document.createElement('section');box.className='th-rarity';box.dataset.rarity=t.id;box.style.setProperty('--rarity-color',t.color);box.hidden=true;const h=document.createElement('h3');h.innerHTML='<span>'+t.en+' <small>· '+t.name+'</small></span><em></em>';const grid=document.createElement('div');grid.className='th-grid';box.append(h,grid);picker.append(box);sections.set(t.id,{box,grid,h});}
  let queued=false;function paint(){queued=false;const data=source();for(const b of picker.querySelectorAll('button[data-th]')){const tier=classify(b.dataset.th,data),group=sections.get(tier)||sections.get('basic');if(b.parentElement!==group.grid)group.grid.append(b);}
   for(const {box,grid,h}of sections.values()){const n=[...grid.children].filter(b=>!b.hidden&&getComputedStyle(b).display!=='none').length;if(box.hidden===(n>0))box.hidden=!n;const text=n+' ธีม';if(h.querySelector('em').textContent!==text)h.querySelector('em').textContent=text;}}
  const queue=()=>{if(!queued){queued=true;requestAnimationFrame(paint);}};new MutationObserver(queue).observe(picker,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});new MutationObserver(queue).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class','data-deep','data-earth2','data-sweet','data-genesis']});paint();
 }
 return Object.freeze({tiers,classify,groups,install});
});
