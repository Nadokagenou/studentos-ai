/* ฉากรับรางวัลถาวร: แสดงหลังธุรกรรมสำเร็จเท่านั้น ไม่เพิ่มของหรือหัก Candy */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HalloweenAcquisition = factory();
})(typeof globalThis === 'undefined' ? this : globalThis, () => {
  'use strict';
  const profiles = Object.freeze({
    Common:{duration:1600, particles:7, rings:0, title:'ประกายเล็ก ๆ จากหม้อเวท', note:'แสงอุ่นและไอหมอกบาง'},
    Uncommon:{duration:2200, particles:12, rings:1, title:'บางสิ่งกำลังตื่นขึ้น', note:'ละอองแสงประจำไบโอม'},
    Rare:{duration:2900, particles:16, rings:2, title:'เสียงตอบรับจากอีกฟาก', note:'วงอัญเชิญและเงาตัวละคร'},
    Epic:{duration:3400, particles:20, rings:2, title:'เปิดประตูสู่โลกอีกใบ', note:'ฉากไบโอมและวงเวทซ้อน'},
    Legendary:{duration:4300, particles:28, rings:3, title:'ตำนานตอบรับคำเรียก', note:'วงเวทสามชั้นและดาวสีทอง'},
    Secret:{duration:5200, particles:36, rings:4, title:'เที่ยงคืนเปลี่ยนโลกทั้งใบ', note:'ท้องฟ้ารัตติกาลและจันทราคราส'},
    Mystical:{duration:4400, particles:28, rings:3, title:'พันธสัญญาแห่งวิญญาณ', note:'ตราผนึกและพลังของวัตถุศักดิ์สิทธิ์'},
    Collector:{duration:3600, particles:24, rings:3, title:'ทั้งสี่โลกจดจำชื่อเธอ', note:'ตราสี่ไบโอมหลอมเป็นเหรียญเดียว'}
  });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cauldron = '<svg viewBox="0 0 240 220" aria-hidden="true"><defs><linearGradient id="hw-pot-body" x2=".2" y2="1"><stop stop-color="#51435e"/><stop offset=".35" stop-color="#241d32"/><stop offset="1" stop-color="#0c0b17"/></linearGradient><radialGradient id="hw-pot-liquid"><stop stop-color="#fff4d4"/><stop offset=".45" stop-color="var(--acq-color)"/><stop offset="1" stop-color="#55406c"/></radialGradient></defs><path d="M63 170 50 204M177 170l13 34" stroke="#76617d" stroke-width="14" stroke-linecap="round"/><path d="M42 84C15 94 20 144 46 139m152-55c27 10 22 60-4 55" stroke="#817087" stroke-width="11" fill="none"/><path d="M46 86C25 178 56 196 120 197s96-20 74-111" fill="url(#hw-pot-body)" stroke="#8b7697" stroke-width="2"/><path d="M65 111c-9 44-2 60 9 67" fill="none" stroke="#a58cba" stroke-width="4" opacity=".25"/><ellipse cx="120" cy="86" rx="77" ry="25" fill="#181320" stroke="#9b80a4" stroke-width="4"/><ellipse class="acq-liquid" cx="120" cy="84" rx="66" ry="17" fill="url(#hw-pot-liquid)"/><path d="m120 126 7 14 15 2-11 11 3 16-14-7-14 7 3-16-11-11 15-2z" fill="none" stroke="var(--acq-color)" stroke-width="1.5" opacity=".7"/><path d="m77 206 10-15 9 15 11-20 12 20 13-17 10 17 12-13 9 13" fill="none" stroke="var(--acq-color)" stroke-width="4" stroke-linecap="round"/><circle class="acq-bubble b1" cx="94" cy="75" r="5" fill="var(--acq-color)"/><circle class="acq-bubble b2" cx="135" cy="72" r="3" fill="#fff4d4"/><circle class="acq-bubble b3" cx="152" cy="82" r="4" fill="var(--acq-color)"/></svg>';
  let current = null;
  function profile(tier) { return profiles[tier] || profiles.Common; }
  function motionReduced(preference, systemReduced) { return preference?.motionChosen ? preference.motion !== 'full' : !!systemReduced || preference?.motion === 'still'; }
  function open(item, {asset, color = '#d9b789', channel = 'shop', reduced = null, sound = false, presentationOnly = false, onClose} = {}) {
    if (!item?.id || typeof document === 'undefined') return false;
    reduced = reduced == null ? matchMedia('(prefers-reduced-motion: reduce)').matches : !!reduced;
    if (current) current.close(false);
    const p = profile(item.rarity), previous = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;
    const dialog = document.createElement('dialog');
    dialog.className = 'hw-acquisition'; dialog.dataset.tier = item.rarity;
    dialog.dataset.phase = reduced ? 'revealed' : 'brewing';
    dialog.setAttribute('aria-label', 'รับรางวัล ' + item.name);
    dialog.style.setProperty('--acq-color', color);
    dialog.classList.add(reduced ? 'acq-still' : 'acq-full');
    const source = channel === 'ritual' ? 'SUMMONING RITUAL' : channel === 'cauldron' ? 'THE WITCH’S CAULDRON' : channel === 'quest' ? 'A PROMISE KEPT' : 'THE MIDNIGHT EMPORIUM';
    dialog.innerHTML = '<div class="acq-world" aria-hidden="true"></div><div class="acq-halo" aria-hidden="true"></div>' +
      '<div class="acq-stars" aria-hidden="true">' + Array.from({length:p.particles}, (_,i) => '<i style="--i:' + i + ';--angle:' + (i*137.508) + 'deg;--reach:' + (90+i%6*19) + 'px;--delay:' + (i%7*.08) + 's">✦</i>').join('') + '</div>' +
      '<div class="acq-top"><span>' + source + '</span><button type="button" class="acq-close" aria-label="ปิดฉากรับรางวัล">×</button></div>' +
      '<div class="acq-stage"><div class="acq-runes" aria-hidden="true">' + Array.from({length:p.rings},(_,i) => '<i style="--ring:' + i + '"></i>').join('') + '</div>' +
      '<div class="acq-beam" aria-hidden="true"></div><div class="acq-steam" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="acq-ingredients" aria-hidden="true"><span>✧</span><span>◈</span><span>✦</span></div>' +
      '<div class="acq-pot">' + cauldron + '</div><div class="acq-art"><img src="' + esc(asset || '') + '" alt="' + esc(item.name) + '"></div></div>' +
      '<div class="acq-copy" aria-live="polite"><p class="acq-brewing-title">' + esc(p.title) + '</p><div class="acq-result"><span class="acq-tier">' + esc(item.rarity) + '</span><h2>' + esc(item.name) + '</h2><p>' + (presentationOnly ? 'ฉากตัวอย่าง · ไม่เพิ่มสิทธิ์รางวัลหรือหัก Candy' : 'เก็บไว้ในคลังแล้ว · ใช้ต่อได้หลังจบอีเวนต์') + '</p></div></div>' +
      '<div class="acq-bottom"><button type="button" class="acq-skip">เผยรางวัลเลย</button><button type="button" class="acq-continue">เก็บความทรงจำนี้</button><small>' + esc(p.note) + '</small></div>';
    let timer, audio, closed = false;
    const reveal = () => {
      clearTimeout(timer);
      dialog.dataset.phase = 'revealed';
      dialog.querySelector('.acq-continue').focus({preventScroll:true});
      if (sound && !audio && !document.hidden) {
        try {
          const Audio = window.AudioContext || window.webkitAudioContext;
          if (Audio) {
            audio = new Audio();
            [261.63,329.63,392,523.25].slice(0, item.rarity === 'Common' ? 2 : 4).forEach((frequency,i) => {
              const o = audio.createOscillator(), g = audio.createGain(), at = audio.currentTime+i*.12;
              o.type = 'sine'; o.frequency.value = frequency; g.gain.setValueAtTime(0,at); g.gain.linearRampToValueAtTime(.035,at+.02); g.gain.exponentialRampToValueAtTime(.0001,at+.8); o.connect(g); g.connect(audio.destination); o.start(at); o.stop(at+.85);
            });
          }
        } catch {}
      }
    };
    const visibility = () => { if (document.hidden) { reveal(); if (audio) { audio.close().catch(() => {}); audio = null; } } };
    const close = (continueQueue = true) => {
      if (closed) return; closed = true; clearTimeout(timer); document.removeEventListener('visibilitychange',visibility);
      if (audio) audio.close().catch(() => {});
      dialog.close(); dialog.remove(); current = null;
      document.documentElement.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus({preventScroll:true});
      if (continueQueue !== false && typeof onClose === 'function') onClose();
    };
    dialog.querySelector('.acq-close').addEventListener('click',close);
    dialog.querySelector('.acq-skip').addEventListener('click',reveal);
    dialog.querySelector('.acq-continue').addEventListener('click',close);
    dialog.addEventListener('cancel',e => { e.preventDefault(); if (dialog.dataset.phase !== 'revealed') reveal(); else close(); });
    document.addEventListener('visibilitychange',visibility);
    document.body.append(dialog); document.documentElement.style.overflow = 'hidden'; dialog.showModal();
    current = {close,reveal};
    if (reduced) reveal(); else { timer = setTimeout(reveal,p.duration); dialog.querySelector('.acq-skip').focus({preventScroll:true}); }
    return true;
  }
  return Object.freeze({profiles, profile, motionReduced, cauldron, open, close:() => current?.close()});
});
