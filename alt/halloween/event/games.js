/* เกมอีเวนต์แยกจากเอฟเฟกต์ตอนงานเสร็จ; ส่งการกระทำเข้าธุรกรรม ไม่ส่งคำว่า "ชนะ" */
(() => {
  'use strict';
  const names = {'ghost-ship-hunt':'Ghost Ship Hunt','clear-jacks-garden-vines':'สวนเถาวัลย์ของ Jack','dech-house-spot-difference':'จับผิดภาพในบ้านเดช','grave-digging':'ขุดหลุมศพ','catch-all-ghosts':'จับวิญญาณหลงทาง'};
  const arrows = ['↑','←','→'], directions = ['หน้า','ซ้าย','ขวา'];
  const esc = s => String(s).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mansion(altered,selected=[0,1,2,3,4],variant=0) {
    const changed=i=>altered&&selected.includes(i),palette=[['#21192e','#463448'],['#142733','#394c56'],['#2e1923','#5b3540']][variant%3];
    return '<svg viewBox="0 0 300 330" aria-label="ภาพคฤหาสน์' + (altered ? 'ที่เปลี่ยนไป' : 'ต้นฉบับ') + '" role="img"><rect width="300" height="330" fill="'+palette[0]+'"/><circle cx="238" cy="46" r="25" fill="#d2b697"/>'+(changed(5)?'<path d="M238 21a25 25 0 0 1 0 50z" fill="'+palette[0]+'"/>':'')+'<path d="M0 270 300 250v80H0z" fill="#151721"/><path d="m35 140 115-97 115 97v145H35z" fill="'+palette[1]+'" stroke="#856379" stroke-width="2"/><path d="M24 143 150 31l126 112-12 6L150 51 38 151z" fill="#271f32"/><path d="M112 285v-72a38 38 0 0 1 76 0v72" fill="#1b1726" stroke="#9b718a" stroke-width="2"/><path d="M150 184v102" stroke="#72586c"/><circle cx="'+(changed(6)?164:143)+'" cy="246" r="3" fill="#d2aa78"/>' +
      '<path d="M58 184v-36a17 17 0 0 1 34 0v36zM208 184v-36a17 17 0 0 1 34 0v36z" fill="#bc9368"/>' +
      '<path d="M75 132v52M58 160h34M225 132v52M208 160h34" stroke="#4c3346" stroke-width="3"/>' +
      (changed(0) ? '<path d="M208 172h34" stroke="#4c3346" stroke-width="3"/>' : '') +
      '<circle cx="150" cy="110" r="18" fill="#c8a57c" stroke="#39243c" stroke-width="4"/><path d="M150 95v15l' + (changed(1) ? '-10 9' : '10 0') + '" stroke="#503d4d" stroke-width="3" fill="none"/>' +
      '<path d="M54 64q12-12 24 0l-12 5zm32-10q10-10 20 0l-10 5z" fill="#100d1a"/>' +
      (!changed(2) ? '<path d="M56 227v37m-10-16 10 8 12-15" stroke="#648866" stroke-width="3" fill="none"/><circle cx="56" cy="225" r="8" fill="#bd647f"/>' : '<path d="M56 227v37m-10-16 10 8 12-15" stroke="#648866" stroke-width="3" fill="none"/>') +
      '<path d="M213 251h33l-7 25h-19z" fill="'+(changed(7)?'#bd9271':'#7c5962')+'"/><path d="M229 251v-35m-1 17-12-13m13 20 12-13" stroke="#678867" stroke-width="3"/>' +
      '<rect x="91" y="288" width="118" height="8" rx="3" fill="#665365"/><rect x="80" y="298" width="140" height="8" rx="3" fill="#4c3e54"/>' +
      (changed(3) ? '<path d="m269 212 8-15 8 15z" fill="#a78a62"/>' : '<circle cx="277" cy="206" r="8" fill="#a78a62"/>') +
      '<path d="M275 213v56" stroke="#6a5265" stroke-width="3"/>' +
      '<rect x="112" y="18" width="16" height="44" fill="' + (changed(4) ? '#bc9c7b' : '#4e3b4d') + '"/></svg>';
  }
  let active = null;
  async function open(id, {perform, read, now, reduced, toast, onClose}) {
    const dialog = document.getElementById('gameDialog');
    if (active) return;
    let timer, busy = false, localError = '', closed = false,comparisonView='altered',previousSteps=0;
    const getGame = () => read().event.games[id];
    let game = getGame();
    if (!game || game.finished) {
      const result = await perform({type:'start-game',game:id}, {silent:true});
      if (!result) return;
      game = getGame();
    }
    const session = game.session;
    const cleanup = () => { clearInterval(timer); active = null; dialog.innerHTML = ''; if (onClose) onClose(); };
    const close = async () => {
      if (closed || busy) return;
      const g = getGame();
      if (g && !g.finished) {
        busy = true;
        const saved = await perform({type:'game-move',game:id,session,move:'abandon'}, {silent:true});
        busy = false;
        if (!saved) return;
      }
      closed = true; dialog.close(); cleanup();
    };
    const move = async value => {
      if (busy || closed) return;
      busy = true;
      const result = await perform({type:'game-move',game:id,session,move:value}, {silent:true});
      busy = false;
      if (!result) localError = 'ยังไม่ใช่จุดนั้น ลองสังเกตอีกครั้ง'; else localError = '';
      render();
    };
    function arena(g) {
      if (g.finished) {
        const win = g.clear;
        const art = id === 'ghost-ship-hunt' ? 'theme-ghostship' : id.includes('jack') ? 'laughing-pumpkin' : id.includes('dech') ? 'theme-vampire' : 'little-wisp';
        return '<div class="game-end"><img src="../rewards/assets/' + art + '.svg" alt=""><h3>' + (win ? 'เรื่องเล่าบทนี้สำเร็จแล้ว' : g.abandoned ? 'กลับมาลองใหม่ได้เสมอ' : 'ครั้งหน้าต้องไปได้ไกลกว่าเดิม') + '</h3><p>' + (win ? 'บันทึกผลเรียบร้อย กลับไปหา NPC เพื่อส่งเควสต่อได้เลย' : id === 'ghost-ship-hunt' && !g.abandoned ? 'เรือคว่ำกลับฝั่ง · ซ่อมเรือ ' + read().event.repairs + ' Candy แล้วลองใหม่' : 'ยังไม่ได้ผ่านด่านนี้ · กลับมาลองใหม่ได้') + '</p><button class="primary" data-game-close>กลับไปสำรวจ</button></div>';
      }
      if (id === 'ghost-ship-hunt') return '<div class="game-arena ship"><div class="voyage-stage" aria-hidden="true" style="--ship-step:'+g.steps+';--ship-from:'+previousSteps+'"><span class="voyage-wave back"></span><img class="voyage-ship" src="../rewards/assets/ghostship-vessel.svg" alt=""><span class="voyage-wave"></span></div><div class="ship-cue"><span class="cue-arrow">' + arrows[g.target] + '</span>แสงโคมกะพริบจากด้าน' + directions[g.target] + '</div><div class="ship-choices">' + [1,0,2].map(i => '<button data-game-move="' + i + '"><span>' + arrows[i] + '</span>' + directions[i] + '</button>').join('') + '</div></div>';
      if (id === 'clear-jacks-garden-vines') return '<div class="game-arena"><p class="game-hint">ถางเถาวัลย์ตามลำดับอักขระ 1 → ' + g.total + '</p><div class="vines-board">' + (g.board||[3,0,5,2,4,1]).slice(0,g.total).map(i => '<button class="' + (g.found.includes(i) ? 'found' : i===g.found.length?'vine-next':'') + '" data-game-move="' + i + '" ' + (g.found.includes(i) ? 'disabled' : '') + ' aria-label="ถางเถาวัลย์หมายเลข ' + (i+1) + '">' + '<svg class="vine-art" viewBox="0 0 100 95" aria-hidden="true" shape-rendering="crispEdges"><path d="M44 92V65H32V49H20V28h13V15h23v13H43v13h15v17h14V37h12V24H72V12h17v13h6v24H82v22H64v21z" fill="#416f52" stroke="#163a2e" stroke-width="3"/><path d="M44 72H24V59h-9v-9h21v13h8zm14-27h15V31H59zM44 85h20V73H44z" fill="#7f9f68"/><path d="M35 33h9v8h-9zM77 42h9v8h-9z" fill="#b0bc7a"/></svg><span class="vine-rune">' + (i+1) + '</span></button>').join('') + '</div></div>';
      if (id === 'grave-digging') return '<div class="game-arena"><p class="game-hint">ตามรอยพลั่ว เก็บชั้นดินให้ครบ ' + g.total + ' ชั้น</p><div class="dig-board">' + (g.board||Array.from({length:g.total},(_,i)=>i)).map(i => '<button data-game-move="' + i + '" class="' + (g.found.includes(i) ? 'found' : '') + '" ' + (g.found.includes(i) ? 'disabled' : '') + ' aria-label="ขุดชั้นดิน ' + (i+1) + '">' + '<svg class="dig-art" viewBox="0 0 100 80" aria-hidden="true" shape-rendering="crispEdges"><path d="M4 15h92v58H4z" fill="#443830"/><path d="M4 14h92v8H4zM4 44h92v5H4zM15 64h26v5H15zM70 32h19v5H70z" fill="#77634a"/>'+(g.found.includes(i)?'<path d="M30 31h10v8h20v-8h10v20H60v-6H40v6H30z" fill="#bcb5a2"/>':i===g.found.length?'<path d="M57 4h6v38h-6z" fill="#c4a56f"/><path d="M48 37h24v18h-6v8H54v-8h-6z" fill="#9cabad"/>':'<path d="M25 33h12v5H25zm35 20h13v5H60z" fill="#5d5041"/>')+'</svg><span class="dig-depth">'+(i+1)+'</span>' + '</button>').join('') + '</div></div>';
      if (id === 'catch-all-ghosts') return '<div class="game-arena"><p class="game-hint">จับวิญญาณทั้งหมดให้ทัน 30 วินาที</p><div class="ghost-board">' + Array.from({length:g.total},(_,i) => '<button class="catch-ghost" style="--x:' + (g.spawnSlots?[8,39,70][g.spawnSlots[i]%3]:[15,68,38,12,68,40][i]) + '%;--y:' + (g.spawnSlots?[3,34,65][Math.floor(g.spawnSlots[i]/3)]:[3,6,32,58,59,73][i]) + '%;--delay:-' + (i*.3) + 's" data-game-move="' + i + '" aria-label="จับวิญญาณ ' + (i+1) + '" ' + (g.found.includes(i) ? 'disabled' : '') + '><svg viewBox="0 0 60 80" aria-hidden="true"><path d="M8 69V30a22 22 0 1 1 44 0v39l-9-7-9 9-10-8-8 9z" fill="#d7cfe8"/><ellipse cx="23" cy="34" rx="3" ry="5" fill="#362b49"/><ellipse cx="39" cy="34" rx="3" ry="5" fill="#362b49"/><ellipse cx="31" cy="49" rx="4" ry="5" fill="#6b577e"/></svg></button>').join('') + '<small class="caught-label">' + g.found.length + ' / ' + g.total + ' วิญญาณ</small></div></div>';
      const selected=g.differences||[0,1,2,3,4],variant=g.variant||0;
      const spotPool = [{x:67,y:44,name:'หน้าต่างขวา'},{x:42,y:26,name:'นาฬิกา'},{x:10,y:64,name:'ดอกไม้'},{x:85,y:57,name:'โคมไฟ'},{x:32,y:7,name:'ปล่องไฟ'},{x:72,y:4,name:'พระจันทร์'},{x:42,y:67,name:'ลูกบิดประตู'},{x:65,y:73,name:'กระถางต้นไม้'}];
      const spots=selected.map(i=>spotPool[i]);
      return '<div class="game-arena"><div class="comparison-controls"><button data-compare="original" aria-pressed="'+(comparisonView==='original')+'">ดูต้นฉบับ</button><button data-compare="altered" aria-pressed="'+(comparisonView==='altered')+'">ดูภาพที่เปลี่ยนไป</button></div><p class="game-hint">ภาพที่เปลี่ยนไปต่างจากต้นฉบับ ' + g.total + ' จุด · กดสลับภาพเพื่อเทียบ แล้วแตะจุดที่ต่าง</p><div class="difference-pair" data-view="'+comparisonView+'"><div class="difference-picture"><span>ต้นฉบับ</span>' + mansion(false,selected,variant) + '</div><div class="difference-picture"><span>ภาพที่เปลี่ยนไป</span>' + mansion(true,selected,variant) + spots.slice(0,g.total).map((s,i) => '<button class="difference-hit ' + (g.found.includes(i) ? 'found' : '') + '" style="left:' + s.x + '%;top:' + s.y + '%" data-game-move="' + i + '" aria-label="ตรวจ' + s.name + '" ' + (g.found.includes(i) ? 'disabled' : '') + '></button>').join('') + '<button class="difference-hit decoy" style="left:9%;top:85%" data-game-decoy aria-label="ตรวจพื้นทางเดิน"></button><button class="difference-hit decoy" style="left:17%;top:20%" data-game-decoy aria-label="ตรวจค้างคาว"></button></div></div></div>';
    }
    function render() {
      const g = getGame();
      if (!g) return;
      const previousMove = dialog.querySelector(':focus')?.dataset.gameMove;
      const previousCompare=dialog.querySelector(':focus')?.dataset.compare;
      const total = id === 'ghost-ship-hunt' ? 6 : g.total;
      const count = id === 'ghost-ship-hunt' ? g.steps : g.found.length;
      dialog.dataset.still = String(reduced());dialog.dataset.variant=String(g.variant||0);
      dialog.innerHTML = '<div class="game-top"><div><small>HALLOWEEN · MINIGAME · ฉาก '+((g.variant||0)+1)+'</small><h2 id="gameHeading">' + esc(names[id]) + '</h2></div><a class="dialog-studentos" href="../../">← StudentOS</a><button class="dialog-x" data-game-close aria-label="ออกจากมินิเกม">×</button></div><div class="game-stats"><span>' + count + ' / ' + total + (id === 'ghost-ship-hunt' ? ' ทิศที่ถูก' : ' สำเร็จ') + '</span>' + (id === 'ghost-ship-hunt' ? '<span>ผิด + หมดเวลา ' + g.mistakes + ' / 3</span>' : '') + '<span class="game-timer" data-game-clock></span></div>' + arena(g) + '<p class="game-note" role="status">' + esc(localError || (id === 'ghost-ship-hunt' ? 'ถูกครบ 6 ทิศถึงเกาะ · ผิดหรือหมดเวลารวม 3 ครั้ง เรือคว่ำกลับฝั่ง' : 'ผลเกมผูกกับรอบปัจจุบันและบันทึกอัตโนมัติ')) + '</p>';
      dialog.querySelectorAll('[data-compare]').forEach(b=>b.addEventListener('click',()=>{comparisonView=b.dataset.compare;render();}));
      dialog.querySelectorAll('[data-game-close]').forEach(b => b.addEventListener('click',close));
      dialog.querySelectorAll('[data-game-move]').forEach(b => b.addEventListener('click',() => move(Number(b.dataset.gameMove))));
      dialog.querySelectorAll('[data-game-decoy]').forEach(b => b.addEventListener('click',() => { localError = 'ตรงนี้เหมือนเดิม ลองดูรายละเอียดอื่น'; const note = dialog.querySelector('.game-note'); if (note) note.textContent = localError; }));
      previousSteps=g.steps||0;updateClock();
      if (dialog.open) {
        const previous = previousMove == null ? null : dialog.querySelector('[data-game-move="' + previousMove + '"]:not(:disabled)');
        (dialog.querySelector('[data-compare="'+previousCompare+'"]') || previous || dialog.querySelector('[data-game-move]:not(:disabled)') || dialog.querySelector('.primary'))?.focus({preventScroll:true});
      }
    }
    function updateClock() {
      const g = getGame(), counter = dialog.querySelector('[data-game-clock]');
      if (counter) counter.textContent = g && !g.finished && g.deadline ? Math.max(0,Math.ceil((g.deadline-now())/1000)) + 's' : '—';
      if (g && !g.finished && g.deadline && now() >= g.deadline && !busy) move('timeout');
    }
    const cancel = e => { e.preventDefault(); close(); };
    dialog.oncancel = cancel;
    active = {close}; render(); dialog.showModal();
    timer = setInterval(updateClock,250);
  }
  window.HalloweenEventGames = Object.freeze({open, names, close:() => active?.close()});
})();
