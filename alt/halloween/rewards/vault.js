/* ไม่มี import หรือ fetch ไป event/ เพื่อให้ดูของที่ได้ต่อหลังถอดกิจกรรมได้ */
(() => {
  'use strict';
  const C=window.StudentOSHalloweenRewards, O=window.HalloweenOwnership;
  const preview=new URLSearchParams(location.search).get('preview')==='1',appHref=new URLSearchParams(location.search).get('entry')==='main'?'../../../':'../../';
  const key='studentos.alt.halloween.preview.v1', owner='halloween-review-only', season='halloween-2026';
  const content=document.getElementById('permanentVault'),dialog=document.getElementById('permanentDetail');
  const kinds={all:'ทั้งหมด',room:'ห้อง',costume:'ชุด',theme:'ธีม',effect:'เอฟเฟกต์',relic:'Mystical',badge:'เหรียญ'};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset=item=>item.asset||'assets/'+item.id+'.svg';
  let account=null,kind='all',rewards={},cleanup=()=>{};
  function render(){
    document.getElementById('vaultMode').textContent=preview?'คลังห้องลอง · แยกจากบัญชีจริง':'คลังรางวัล StudentOS';
    if(!preview&&!account?.ready()){document.getElementById('vaultCount').textContent='เชื่อมคลังบัญชี StudentOS';content.innerHTML='<p class="empty">เข้าสู่ระบบเพื่อดูรางวัลของบัญชีนี้<br><a href="'+appHref+'?go=login">ไปเข้าสู่ระบบ StudentOS →</a></p>';return;}
    try{if(preview){const raw=localStorage.getItem(key);rewards=raw?O.validate(JSON.parse(raw),owner,season).rewards:{};}else rewards=account.read().rewards;}
    catch(error){document.getElementById('vaultStatus').textContent=error.message;return;}
    const owned=Object.keys(rewards).map(id=>C.find(id)).filter(Boolean);
    document.getElementById('vaultCount').textContent=owned.length+' / '+C.items.length+' ความทรงจำ';
    document.getElementById('vaultFilters').innerHTML=Object.entries(kinds).map(([id,label])=>'<button data-kind="'+id+'" aria-pressed="'+(kind===id)+'">'+label+'</button>').join('');
    const filtered=owned.filter(x=>kind==='all'||x.kind===kind);
    content.innerHTML=filtered.length?filtered.map(item=>'<button class="memory-card" data-item="'+item.id+'" style="--tier:'+C.tiers[item.rarity].color+'"><div class="art"><img src="'+asset(item)+'" alt="'+esc(item.name)+'" loading="lazy"></div><div class="copy"><small>'+item.rarity+'</small><h2>'+esc(item.name)+'</h2><p>'+esc(C.biomes[item.biome].name)+(rewards[item.id].restriction?' · Restricted':'')+'</p></div></button>').join(''):'<p class="empty">ยังไม่มีความทรงจำในหมวดนี้<br>'+(preview?'ของที่ได้รับในห้องลองจะถูกเก็บไว้ที่นี่':'รางวัลที่ได้รับระหว่างกิจกรรมจะเก็บไว้ในบัญชีนี้')+'</p>';
  }
  if(!preview){try{account=window.HalloweenAccount.create({client:window.HalloweenAccount.client(),onChange:render});account.refresh().catch(error=>{document.getElementById('vaultStatus').textContent=error.message;});}catch(error){document.getElementById('vaultStatus').textContent=error.message;}}
  function inspect(id){
    cleanup();cleanup=()=>{};
    const item=C.find(id),owned=rewards[id];if(!item||!owned)return;
    dialog.innerHTML='<div class="detail-top"><h2 id="permanentHeading">'+esc(item.name)+'</h2><button data-close aria-label="ปิดรายละเอียด">×</button></div><img class="detail-art" src="'+asset(item)+'" alt="'+esc(item.name)+'"><div class="detail-body"><p>'+esc(item.description)+'</p><small class="'+(owned.restriction?'restriction':'')+'">'+(owned.restriction?'Restricted · ยังถือไม่ได้ รอปลดผนึกกับ Win':item.id==='dullahan-scythe'?'ปลดผนึกแล้ว · ใช้ได้ทุกไบโอม':'รางวัลถาวร · เก็บไว้หลังจบอีเวนต์')+'</small></div><div class="detail-actions"><button data-reveal="'+id+'">ชมฉากรางวัล</button>'+(['room','costume','theme','effect'].includes(item.kind)?'<button data-try="'+id+'">ลองใน StudentOS ↗</button>':'')+'</div>';
    if(!dialog.open)dialog.showModal();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.kind){kind=b.dataset.kind;render();}
    else if(b.dataset.item)inspect(b.dataset.item);
    else if(b.hasAttribute('data-close'))dialog.close();
    else if(b.dataset.reveal){const item=C.find(b.dataset.reveal);dialog.close();window.HalloweenAcquisition.open(item,{asset:asset(item),color:C.tiers[item.rarity].color,presentationOnly:true,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches});}
    else if(b.dataset.try){
      const item=C.find(b.dataset.try);window.__STUDENTOS_HALLOWEEN_COLLECTION__=true;
      dialog.innerHTML='<div class="detail-top"><h2 id="permanentHeading">'+esc(item.name)+'</h2><button data-close aria-label="ปิดห้องลอง">×</button></div><iframe class="preview-frame" src="../../?halloween-showroom=1" title="ลองรางวัลใน StudentOS"></iframe>';
      const frame=dialog.querySelector('iframe');
      const send=()=>frame.contentWindow.postMessage({type:'studentos-halloween-reward-preview',id:item.id,request:crypto.randomUUID()},location.origin);
      const ready=e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data?.type==='studentos-halloween-reward-ready')send();};
      frame.addEventListener('load',send);window.addEventListener('message',ready);
      cleanup=()=>{window.removeEventListener('message',ready);frame.removeAttribute('src');};
    }
  });
  dialog.addEventListener('close',()=>{cleanup();cleanup=()=>{};});
  window.addEventListener('storage',e=>{if(e.key===key)render();});
  render();
})();
