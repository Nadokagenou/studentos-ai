/* Physical counter UI. Picking, dropping and changing quantity never write a save. */
(() => {
  'use strict';
  function create({Core,config,read,now,detail,refresh,perform,audio,onRewards,esc,asset,name,duration,portrait,cropArt}) {
    let mode='buy',held=null,placed=false,quantity=1,quote=null,busy=false,message='',epoch=null;
    const reset=()=>{held=null;placed=false;quantity=1;quote=null;};
    const stock=()=>Core.shopStock(read(),config(),Date.now());
    function setMode(next){mode=next;reset();message='';}
    function product(id){
      const cfg=config(),doc=read();
      if(mode==='buy'){
        const item=cfg.rewards[id],left=stock().remaining[id]||0;
        return item&&cfg.proposals.shop[id]?{id,label:item.name,price:cfg.proposals.shop[id],left,owned:!!doc.rewards[id],tier:item.rarity,art:'<img src="'+asset(item)+'" alt="" draggable="false">'}:null;
      }
      const c=cfg.proposals.crops[id];
      return c?{id,label:c.name,price:c.sellCandy,left:Math.min(doc.event.grown[c.harvest]||0,doc.event.inventory[c.harvest]||0),tier:'ผลผลิตปลูกเอง',art:'<span class="produce-art">'+cropArt(Core.BIOMES.indexOf(id))+'</span>'}:null;
    }
    const control=(action,label,extra='')=>'<button data-market="'+action+'" '+extra+'>'+label+'</button>';
    function view(){
      const cfg=config(),doc=read(),s=stock();epoch=s.epoch;
      const products=(mode==='buy'?Object.keys(cfg.proposals.shop):Core.BIOMES).map(product),p=held&&product(held);
      if(p&&(p.owned||!p.left)){reset();message='ของชิ้นนี้เปลี่ยนไปแล้ว หยิบชิ้นใหม่ได้เลย';}
      if(quote&&mode==='sell'&&held){const harvest=cfg.proposals.crops[held].harvest;if(quote.expectedGrown!==(doc.event.grown[harvest]||0)||quote.expectedInventory!==(doc.event.inventory[harvest]||0)){reset();message='ผลผลิตเปลี่ยนไปแล้ว กรุณาหยิบมาชั่งใหม่';}}
      const chosen=held&&product(held),total=chosen?quantity*chosen.price:0,after=doc.event.candy+(mode==='buy'?-total:total),ready=placed&&chosen&&!doc.event.closed&&after>=0&&!busy;
      const quantityUI=!chosen?'':mode==='buy'?'<p class="fixed-quantity">จำนวน 1 ชิ้น · รางวัลถาวรซื้อได้ครั้งเดียว</p>':'<div class="quantity-control">'+control('minus','−','aria-label="ลดจำนวน" '+(quantity<=1||busy?'disabled':''))+'<output aria-live="polite">'+quantity+' ชิ้น</output>'+control('plus','+','aria-label="เพิ่มจำนวน" '+(quantity>=chosen.left||busy?'disabled':''))+'</div>';
      const visible=products.filter(p=>mode==='sell'||p.left>0||p.owned);
      const timeLabel=new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Bangkok'}).format(new Date(s.nextAt));
      return '<section class="market-scene" data-market-mode="'+mode+'" aria-label="เคาน์เตอร์ตาชั่งของมอร์โร">'+
        '<div class="market-top"><div><span class="eyebrow">THE MIDNIGHT EMPORIUM</span><h3>หยิบ · ชั่ง · ตกลง</h3></div><span class="market-wallet">◈ '+doc.event.candy.toLocaleString('th-TH')+' Candy</span></div>'+
        '<nav class="counter-tabs" aria-label="ซื้อหรือขาย">'+control('buy','ซื้อสินค้า','aria-pressed="'+(mode==='buy')+'"')+control('sell','ขายผลผลิต','aria-pressed="'+(mode==='sell')+'"')+'</nav>'+(mode==='buy'?'<p class="stock-clock top-stock-clock">เติมรอบหน้า '+timeLabel+' น. · อีก <b data-market-countdown data-until="'+s.nextAt+'">'+duration(s.nextAt-now())+'</b></p>':'')+
        '<div class="merchant-counter"><div class="npc-portrait">'+portrait('morro')+'</div><p role="status" aria-live="polite" class="merchant-response">'+esc(message||(chosen?(placed?'ข้าชั่งให้แล้ว ตรวจราคาแล้วค่อยตกลงนะ':'ถือไว้แล้ว แตะจานตาชั่งเพื่อวางได้เลย'):mode==='buy'?'เลือกของบนชั้น แล้วแตะจานตาชั่ง ข้าจะบอกราคาให้':'ข้ารับเฉพาะผลผลิตที่ปลูกและเก็บเอง เลือกจากตะกร้าได้เลย'))+'</p></div>'+
        '<div class="counter-layout"><div class="counter-shelves"><p class="shelf-label">'+(mode==='buy'?'ชั้นสินค้าของมอร์โร':'ตะกร้าผลผลิตของฉัน')+'</p>'+
        '<p class="shelf-help">'+(mode==='buy'?'ของรอบนี้ '+Object.values(s.remaining).reduce((a,n)=>a+n,0)+' ชิ้น · เติมทุก 1 ชม.':'ตะกร้าจากสวน · แตะหยิบทีละชนิด')+'</p>'+
        '<div class="physical-shelf">'+visible.map(p=>'<button class="shelf-product '+(held===p.id?'product-held':'')+'" data-market="pick" data-product="'+p.id+'" draggable="'+(!p.owned&&p.left>0&&!doc.event.closed)+'" '+(p.owned||!p.left||doc.event.closed?'disabled':'')+' aria-label="หยิบ '+esc(p.label)+' · '+p.price+' Candy · เหลือ '+p.left+' ชิ้น"><span class="shelf-art">'+p.art+'</span><b>'+esc(p.label)+'</b><small>'+esc(p.tier)+' · ◈ '+p.price+'</small><span class="shelf-remaining">'+(p.owned?'มีในคลังแล้ว':p.left?'เหลือ '+p.left+' ชิ้น':'ยังไม่มีผลผลิต')+'</span></button>').join('')+'</div>'+
        (mode==='buy'?'<details class="stock-empty"><summary>สินค้าที่ไม่เข้ารอบนี้ '+products.filter(p=>!p.left&&!p.owned).length+' แบบ</summary><p>'+products.filter(p=>!p.left&&!p.owned).map(p=>esc(p.label)).join(' · ')+'</p></details>':'<p class="stock-clock">ฟักทองปลูกเอง 3 ชิ้นใช้ส่ง Jack Q2 ได้ เผื่อไว้ก่อนขาย</p>')+'</div>'+
        '<div class="weighing-counter '+(placed?'scale-loaded':'')+'"><button class="scale-drop" data-market="place" '+(!chosen||placed||busy?'disabled':'')+' aria-label="วางของบนตาชั่ง"><span class="scale-object '+(chosen&&!placed?'carrying':'')+'">'+(chosen?chosen.art:'')+'</span><svg viewBox="0 0 260 155" preserveAspectRatio="none" aria-hidden="true" shape-rendering="crispEdges"><path d="M124 25h12v111h-12zM88 138h84v9H88zM108 128h44v12h-44z" fill="#b99760"/><g class="scale-beam"><path d="M28 28h204v7H28z" fill="#d9bd84"/><path d="M45 35v55m170-55v55" stroke="#b99760" stroke-width="3"/><path d="M12 90h68l-10 12H22zm168 0h68l-10 12h-48z" fill="#b99760"/></g><path d="M123 8h14v18h-14z" fill="#d9bd84"/></svg><span class="scale-prompt">'+(placed?'ชั่งเรียบร้อย':chosen?'แตะที่นี่เพื่อวาง':'หยิบของจากชั้นก่อน')+'</span></button>'+
        '<div class="counter-receipt"><h4>'+(chosen?esc(chosen.label):'จานตาชั่งว่าง')+'</h4>'+(chosen?'<p>'+esc(chosen.tier)+' · '+chosen.price+' Candy / ชิ้น</p>'+quantityUI+'<p>เหลือ'+(mode==='buy'?'บนชั้น':'ในกระเป๋า')+' '+chosen.left+' ชิ้น · หลังตกลง '+(chosen.left-quantity)+' ชิ้น</p><div class="weighed-total"><span>'+(mode==='buy'?'จ่าย':'รับ')+' Candy</span><strong>◈ '+total+'</strong></div><p class="wallet-after">ยอด '+doc.event.candy+' → '+after+' Candy</p>'+(after<0?'<p class="counter-error">Candy ยังไม่พอ เก็บไว้ก่อนได้</p>':''):'<p>มือถือ: แตะหยิบ แล้วแตะจาน<br>คอม: ลากจากชั้นมาวางได้</p>')+'</div>'+
        '<div class="counter-actions">'+control('return',placed?'เอาคืนจากตาชั่ง':'ยกเลิกการหยิบ','class="secondary" '+(!chosen||busy?'disabled':''))+control('confirm',busy?'กำลังบันทึก…':mode==='buy'?'ยืนยันซื้อ':'ยืนยันขาย','class="primary" '+(!ready?'disabled':''))+'</div><p class="counter-note">หยิบหรือวางยังไม่หักของ ยืนยันจึงบันทึก</p></div></div>'+
        '<details class="market-rules"><summary>กติกาสต็อกทดลอง · '+doc.event.purchases.length+'/12 สะสมร้าน</summary><p>'+esc(cfg.proposals.shopStock.notice)+'</p><p>สต็อกเฉพาะเซฟห้องลองนี้ เติมรอบตามต้นชั่วโมงเวลาไทย ไม่มีของ Mystical หรือของเฉพาะเควส เรทบ้าน 60% และ 40/30/15/10/4/1 คงเดิม ซื้อครบ 12 แบบได้เหรียญผู้สะสม</p></details></section>';
    }
    function redraw(focus){refresh();if(focus)detail.querySelector('[data-market="'+focus+'"]')?.focus({preventScroll:false});}
    function pick(id){const p=product(id);if(busy||!p||!p.left||p.owned||read().event.closed)return false;held=id;placed=false;quantity=1;quote=null;message='';return true;}
    function place(){if(!held||busy)return;const p=product(held),doc=read();if(!p||!p.left||p.owned){reset();message='ของเปลี่ยนไปแล้ว กรุณาหยิบใหม่';return;}placed=true;quote={stockEpoch:stock().epoch,expectedGrown:doc.event.grown[config().proposals.crops[held]?.harvest]||0,expectedInventory:doc.event.inventory[config().proposals.crops[held]?.harvest]||0};audio.play('tap');}
    async function handle(button){
      const action=button.dataset.market;if(!action)return false;if(busy)return true;
      if(action==='buy'||action==='sell'){setMode(action);redraw();}
      else if(action==='pick'){if(pick(button.dataset.product)){audio.play('tap');redraw('place');}}
      else if(action==='place'){place();redraw('confirm');}
      else if(action==='return'){reset();message='คืนของแล้ว ไม่มีการหัก Candy หรือผลผลิต';redraw();}
      else if(action==='plus'||action==='minus'){const p=held&&product(held);if(p&&mode==='sell')quantity=Math.max(1,Math.min(p.left,quantity+(action==='plus'?1:-1)));redraw(action);}
      else if(action==='confirm'){
        const p=held&&product(held);if(!placed||!quote||!p||quantity>p.left||read().event.closed)return true;
        busy=true;const captured=mode;redraw();
        const result=await perform(mode==='buy'?{type:'buy',item:held,stockEpoch:quote.stockEpoch}:{type:'sell-crop',biome:held,quantity,expectedGrown:quote.expectedGrown,expectedInventory:quote.expectedInventory},{silent:true});
        busy=false;reset();message=result?(captured==='buy'?'ตกลงแล้ว ข้าห่อของใส่กระเป๋าให้เรียบร้อย':'รับผลผลิตแล้ว นี่ Candy '+result.candy+' ตามที่ชั่งไว้'):'ยังไม่ได้ทำรายการ กรุณาหยิบและชั่งอีกครั้ง';redraw();
        if(result){audio.play('coins');if(result.rewards.length)onRewards(result.rewards,'shop');}
      }
      return true;
    }
    let drag=null,suppressClickUntil=0;
    detail.addEventListener('close',()=>{drag?.ghost?.remove();drag=null;detail.classList.remove('market-dragging');reset();message='';});
    detail.addEventListener('dragstart',e=>{if(e.target.closest('[data-market="pick"]'))e.preventDefault();});
    detail.addEventListener('pointerdown',e=>{
      const b=e.target.closest('[data-market="pick"]');if(!b||b.disabled||busy||e.button!==0)return;
      drag={id:b.dataset.product,x:e.clientX,y:e.clientY,pointer:e.pointerId,active:false,ghost:null};
    });
    detail.addEventListener('pointermove',e=>{
      if(!drag||drag.pointer!==e.pointerId||busy)return;
      if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8){
        if(!pick(drag.id)){drag=null;return;}
        drag.active=true;detail.setPointerCapture?.(e.pointerId);detail.classList.add('market-dragging');
        const ghost=document.createElement('span');ghost.className='market-drag-ghost';ghost.innerHTML=product(drag.id).art;detail.append(ghost);drag.ghost=ghost;
        const drop=detail.querySelector('.scale-drop');if(drop)drop.disabled=false;
      }
      if(drag.active){e.preventDefault();drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';}
    });
    function finishDrag(e,cancelled=false){
      if(!drag||drag.pointer!==e.pointerId)return;
      const d=drag;drag=null;d.ghost?.remove();detail.classList.remove('market-dragging');
      if(!d.active)return;
      suppressClickUntil=Date.now()+400;
      const drop=detail.querySelector('.scale-drop'),r=drop?.getBoundingClientRect();
      if(!cancelled&&r&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)place();
      redraw(placed?'confirm':'place');
    }
    detail.addEventListener('pointerup',e=>finishDrag(e));detail.addEventListener('pointercancel',e=>finishDrag(e,true));
    detail.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();}},true);
    function tick(){
      if(detail.dataset.scenePanel!=='counter'||!detail.open||busy)return;
      const s=stock();if(epoch!==s.epoch){reset();message='รถสินค้าเติมรอบใหม่แล้ว หยิบของจากชั้นได้เลย';audio.play('door');redraw();}
      detail.querySelectorAll('[data-market-countdown]').forEach(el=>el.textContent=duration(Number(el.dataset.until)-now()));
    }
    return {view,setMode,handle,tick};
  }
  window.HalloweenMarket=Object.freeze({create});
})();
