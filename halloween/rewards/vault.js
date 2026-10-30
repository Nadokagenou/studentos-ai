/* ไม่มี import หรือ fetch ไป event/ เพื่อให้ดูของที่ได้ต่อหลังถอดกิจกรรมได้ */
(() => {
  'use strict';
  const C=window.StudentOSHalloweenRewards, O=window.HalloweenOwnership;
  const preview=new URLSearchParams(location.search).get('preview')==='1',appHref=new URLSearchParams(location.search).get('entry')==='main'?'../../':'../../';document.querySelectorAll('[data-app-link]').forEach(a=>{a.href=appHref;});{const q=new URLSearchParams(location.search),x=document.querySelector('[data-exit-link]');if(x)x.href=q.get('from')==='event'?'../event/'+(q.get('entry')==='main'?'?entry=main':''):appHref;}/* ปุ่ม "ออก": เปิดจากจอเข้าสู่ระบบของอีเวนต์ (from=event) = กลับจอนั้น · ที่อื่นกลับแอป *//* 28 ต.ค. 69 · ปุ่ม "ออก" + โลโก้ กลับไปหน้าที่มา (เว็บหลักเมื่อ entry=main) แบบเดียวกับปุ่มเข้าสู่ระบบ */
  const key='studentos.alt.halloween.preview.v1', owner='halloween-review-only', season='halloween-2026';
  const content=document.getElementById('permanentVault'),dialog=document.getElementById('permanentDetail');
  const kinds={all:'ทั้งหมด',room:'ห้อง',costume:'ชุด',theme:'ธีม',effect:'เอฟเฟกต์',relic:'Mystical',badge:'เหรียญ'};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset=item=>item.asset||'assets/'+item.id+'.svg';
  let account=null,kind='all',rewards={},cleanup=()=>{};
  function render(){
    document.getElementById('vaultMode').textContent=preview?'คลังห้องลอง · แยกจากบัญชีจริง':'คลังรางวัล StudentOS';
    if(!preview&&!account?.ready()){document.getElementById('vaultCount').textContent='เชื่อมคลังบัญชี StudentOS';content.innerHTML='<div class="empty vault-signin"><span class="vs-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg></span><b>เข้าสู่ระบบเพื่อดูรางวัลของบัญชีนี้</b><a class="vs-go" href="'+appHref+'?go=login">เข้าสู่ระบบ StudentOS</a></div>';/* 28 ต.ค. 69 · ตกแต่งใหม่ (เจ้าของ: "ตกแต่งใหม่เลย") · ปุ่มเดียวกับจออีเวนต์ */return;}
    try{if(preview){const raw=localStorage.getItem(key);rewards=raw?O.validate(JSON.parse(raw),owner,season).rewards:{};}else rewards=account.read().rewards;}
    catch(error){document.getElementById('vaultStatus').textContent=error.message;return;}
    const owned=Object.keys(rewards).map(id=>C.find(id)).filter(Boolean);
    document.getElementById('vaultCount').textContent=owned.length+' / '+C.items.length+' ความทรงจำ';
    document.getElementById('vaultFilters').innerHTML=Object.entries(kinds).map(([id,label])=>'<button data-kind="'+id+'" aria-pressed="'+(kind===id)+'">'+label+'</button>').join('');
    const filtered=owned.filter(x=>kind==='all'||x.kind===kind);
    content.innerHTML=filtered.length?filtered.map(item=>'<button class="memory-card" data-item="'+item.id+'" style="--tier:'+C.tiers[item.rarity].color+'"><div class="art"><img src="'+asset(item)+'" alt="'+esc(item.name)+'" loading="lazy"></div><div class="copy"><small>'+item.rarity+'</small><h2>'+esc(item.name)+'</h2><p>'+esc(C.biomes[item.biome].name)+(rewards[item.id].restriction?' · Restricted':'')+'</p></div></button>').join(''):'<p class="empty">ยังไม่มีความทรงจำในหมวดนี้<br>'+(preview?'ของที่ได้รับในห้องลองจะถูกเก็บไว้ที่นี่':'รางวัลที่ได้รับระหว่างกิจกรรมจะเก็บไว้ในบัญชีนี้')+'</p>';
  }
  if(!preview){try{account=window.HalloweenAccount.create({client:window.HalloweenAccount.client(),onChange:render});account.refresh().catch(error=>{if(!error.signedOut)document.getElementById('vaultStatus').textContent=error.message;});/* ยังไม่ล็อกอิน = การ์ดบอกพร้อมปุ่มอยู่แล้ว ไม่ต้องพิมพ์ซ้ำท้ายหน้า */}catch(error){document.getElementById('vaultStatus').textContent=error.message;}}
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
