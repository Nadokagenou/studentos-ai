(() => {
  const stage = document.getElementById('stage');
  const panel = document.getElementById('panel');
  const draft = document.getElementById('draft');
  let route = 'assistant';
  const info = {
    tile: ['เพิ่มงานได้จากแผงด่วน','ลากหน้าจอลงเหมือนเปิด Wi‑Fi แล้วแตะ “เพิ่มงาน Student OS” พิมพ์หรือพูดงานที่นึกขึ้นได้', ['ติดตั้งแอปทางลัดจากปุ่มดาวน์โหลด','เปิดแอป → เพิ่มปุ่มในแผงด่วน','Android รุ่นเก่า: เปิดแผงด่วน → แก้ไข → ลากปุ่มเข้ามา'], 'รองรับ Android 8 ขึ้นไป ระบบจะให้ปลดล็อกก่อนเปิดแผงเพิ่มงาน ตำแหน่งเมนูขึ้นกับยี่ห้อมือถือ'],
    assistant: ['เรียกผู้ช่วยจากขอบจอ','แผงเล็กด้านล่างสำหรับร่างคำถามหรือจดงาน แล้วเปิดต่อใน Student OS',['ติดตั้งแอปทางลัด → เลือกแอปผู้ช่วย','เลือก Student OS แทนผู้ช่วยเริ่มต้นเดิม','เรียกด้วยท่าทางหรือปุ่มผู้ช่วยที่เครื่องรองรับ'], 'การเปลี่ยนผู้ช่วยเป็นตัวเลือก ไม่บังคับ และเปลี่ยนกลับได้ วิธีเรียกกับการรองรับขึ้นอยู่กับมือถือ ยังไม่รองรับเรียกด้วยคำปลุก'],
    launcher: ['กดไอคอนค้างแล้วเลือกเลย','เลือกสิ่งที่จะทำได้ตรงจากหน้าจอหลัก ไม่ต้องไล่หาเมนูในแอป',['ติดตั้งแอปทางลัด หรือเพิ่มเว็บ Student OS เป็นแอปจาก Chrome','กดไอคอนค้าง → เลือกเมนู','บาง launcher ลากเมนูไปวางเป็นไอคอนแยกได้'], 'PWA ที่ติดตั้งอยู่ก่อนอัปเดตอาจต้องรอ Chrome อัปเดตเมนู กดไอคอน Student OS ทางลัดได้หลังติดตั้ง APK']
  };
  function show(mode) {
    document.querySelectorAll('[role=tab]').forEach(button => { const active=button.dataset.mode===mode;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1; });
    document.getElementById('feature').setAttribute('aria-labelledby','tab-'+mode);
    const [title,description,steps,limitation]=info[mode];
    document.getElementById('featureTitle').textContent=title;
    document.getElementById('description').textContent=description;
    document.getElementById('steps').replaceChildren(...steps.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    document.getElementById('limitation').textContent=limitation;
    if(mode==='tile')stage.innerHTML='<div class="clock">15:29</div><div class="tiles"><div class="tile">Wi‑Fi<span>เชื่อมต่อแล้ว</span></div><div class="tile">Bluetooth<span>ปิด</span></div><button class="tile student" data-panel="quick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2"/></svg>เพิ่มงาน Student OS<span>แตะเพื่อลองแผงเพิ่มงาน</span></button><div class="tile">ไฟฉาย</div><div class="tile">หมุนจอ</div></div><p class="hint">ภาพจำลองแผงด่วน<br>หน้าตาจริงขึ้นกับมือถือของคุณ</p>';
    else if(mode==='assistant')stage.innerHTML='<div class="clock">15:29</div><p class="hint">วันเรียนที่เบาลง<br>เริ่มจากรู้ว่าจะทำอะไรก่อน</p><button class="invoke" data-panel="assistant">ขอความช่วยเหลือจาก<br><strong>Student OS</strong><span>แตะเพื่อลองแผงผู้ช่วย →</span></button>';
    else stage.innerHTML='<p class="hint">ตัวอย่างเมนูกดไอคอนค้าง</p><div class="launcher"><img src="../icon-192.png" width="56" height="56" alt=""><strong>Student OS</strong></div><div class="launch-menu"><button data-panel="quick">＋ เพิ่มงานด่วน</button><button data-panel="assistant">✧ ถามผู้ช่วย</button><button data-go="tasks">▤ งานของฉัน</button><button data-go="today">◷ วันนี้ทำอะไร</button></div>';
  }
  function openPanel(mode) {
    route=mode;draft.maxLength=mode==='quick'?500:2000;
    document.getElementById('panelTitle').textContent=mode==='quick'?'เพิ่มงานด่วน':'ผู้ช่วย Student OS';
    draft.placeholder=mode==='quick'?'รายงานชีวะ ส่งวันศุกร์':'วันนี้ควรเริ่มงานไหนก่อน?';
    document.getElementById('voiceHint').textContent='ปุ่มไมค์ตัวอย่างจะแนะนำวิธีใช้บน Android';
    panel.showModal();
  }
  function navigate(target,withDraft=false){
    if(!['quick','assistant','tasks','today'].includes(target))return;
    const url=new URL('../',location.href);url.searchParams.set('go',target);
    const text=withDraft?draft.value.trim().slice(0,target==='quick'?500:2000):'';
    if(text)url.hash='sos-draft='+encodeURIComponent(text);
    location.assign(url.href);
  }
  document.addEventListener('click',event=>{
    const tab=event.target.closest('[data-mode]');if(tab)show(tab.dataset.mode);
    const launcher=event.target.closest('[data-panel]');if(launcher)openPanel(launcher.dataset.panel);
    const go=event.target.closest('[data-go]');if(go)navigate(go.dataset.go,go.dataset.go==='quick'&&panel.open);
  });
  document.querySelector('.tabs').addEventListener('keydown',event=>{
    const tabs=[...document.querySelectorAll('[role=tab]')];let index=tabs.indexOf(document.activeElement);
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    show(tabs[index].dataset.mode);tabs[index].focus();
  });
  document.getElementById('continue').addEventListener('click',()=>navigate(route,true));
  document.getElementById('mic').addEventListener('click',()=>{document.getElementById('voiceHint').textContent='หลังติดตั้งแอป Android กด “พูดแทนพิมพ์” ในแผงได้เลย หรือใช้ปุ่มไมค์บนคีย์บอร์ดมือถือในตัวอย่างนี้';});
  panel.addEventListener('click',event=>{if(event.target===panel){const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();}});
  show('tile');
})();
