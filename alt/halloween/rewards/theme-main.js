/* Seasonal presentation layer. Does not grant rewards or change task/plan data. */
(() => {
  'use strict';
  const root = document.documentElement;
  const SOUND_KEY = 'studentos.alt.halloween.sound';
  const VOLUME_KEY = 'studentos.alt.halloween.volume';
  const MOTION_KEY = 'studentos.alt.halloween.motion';
  const MUSIC_KEY = 'studentos.alt.halloween.music';
  // Night (dark) is the default tone; light swaps the palette tokens only. index.html reads the same key before first paint.
  const TONE_KEY = 'studentos.alt.halloween.tone';
  const TONE_BAR = { dark: '#170B36', light: '#F3EDFF' };
  // Moon & Candle (theme-moonlight.css) is a separate sample theme that reuses this scene and runtime.
  // Only it gets the light tone and the grouped Me list; Halloween itself keeps its original look.
  const FAMILY = ['halloween', 'moonlight'];
  const isMoon = () => root.dataset.theme === 'moonlight';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const read = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };
  let enabled = read(SOUND_KEY, '0') === '1';
  let volume = Math.max(0, Math.min(1, Number(read(VOLUME_KEY, '.35')) || 0));
  let motion = read(MOTION_KEY, reduced.matches ? 'still' : 'full');
  let musicEnabled = read(MUSIC_KEY, '1') === '1';
  let paletteTone = read(TONE_KEY, 'dark') === 'light' ? 'light' : 'dark';
  let active = false, scene, controls, context, master, wind, windGain;
  let musicBus, musicTimer = 0, nextBarAt = 0, musicBar = 0;
  const musicVoices = new Set();
  let queued = false, lastTap = { x: innerWidth / 2, y: innerHeight / 2 }, lastSound = 0;
  const originals = new Map(), iconOriginals = new Map(), brandOriginals = new Map();
  root.dataset.hwMotion = motion;
  root.dataset.hwTone = paletteTone;
  root.dataset.hwFramed = String(parent !== window);
  const ghost = '<svg viewBox="0 0 60 80" fill="none"><path d="M8 69V30a22 22 0 1 1 44 0v39l-9-7-9 9-10-8-8 9z" fill="#d7cfe8"/><ellipse cx="23" cy="34" rx="3" ry="5" fill="#362b49"/><ellipse cx="39" cy="34" rx="3" ry="5" fill="#362b49"/><ellipse cx="31" cy="49" rx="4" ry="5" fill="#6b577e"/></svg>';
  const soundSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m11 4-6 5H2v6h3l6 5zM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>';
  const icons = {
    home: '<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7M7 8l-1-5 4 2"/><path d="M7 11h2m6 0h2"/>',
    grid: '<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7M7 8l-1-5 4 2"/>',
    tasks: '<path d="M7 3h10l3 4v14H4V3zM7 8h8M8 12l1 1 2-3m-3 7 1 1 2-3m3-3h3m-3 5h3"/>',
    calendar: '<path d="M4 5h16v16H4zM7 2v5m10-5v5M4 10h16M8 13h2m4 0h2m-8 4h2m4 0h2"/><path d="m18 3 2-2 2 2"/>',
    plus: '<path d="M5 19 19 5m-5-2 7 7M4 3v5M1.5 5.5h5M18 16v6m-3-3h6"/>',
    user: '<path d="M5 21v-2a7 7 0 0 1 14 0v2M5 11l7-10 6 10zM9 12a3 3 0 0 0 6 0M4 11h16"/>',
    bag: '<path d="m6 8-2 13h16L18 8zM8 8V6a4 4 0 0 1 8 0v2M8 15l2-2m4 0 2 2M9 18q3 3 6 0"/>',
    medal: '<path d="m6 2 3 7m9-7-3 7M5 2h5l2 6 2-6h5"/><circle cx="12" cy="15" r="7"/><path d="m12 10 1.5 3 3.5.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4L7 13.5l3.5-.5z"/>',
    bell: '<path d="M5 17v-6a7 7 0 0 1 14 0v6l2 2H3zM9 22h6M9 11h.1m5.8 0h.1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 5v7l4 3M4 4 2 2m18 2 2-2M7 1h10"/>',
    book: '<path d="M3 4q5-2 9 1 4-3 9-1v15q-5-2-9 1-4-3-9-1zM12 5v15M6 8h3m-3 4h3m6-4h3m-3 4h3"/>',
    settings: '<path d="m12 2 2 4 5-1-1 5 4 2-4 2 1 5-5-1-2 4-2-4-5 1 1-5-4-2 4-2-1-5 5 1z"/><circle cx="12" cy="12" r="3"/>',
    sparkles: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3zM4 2v4M2 4h4m14 14v4m-2-2h4"/>',
    owl: '<path d="m3 4 6 3a9 9 0 0 1 6 0l6-3v10a9 9 0 0 1-18 0zM3 9l18 5M3 15l17-5M4 18l15-2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><path d="m10 16 2 2 2-2"/>',
    check: '<path d="m4 12 5 6L21 4M2 3v5M.5 5.5h4M19 18v5m-2.5-2.5h5"/>',
  };
  function mount() {
    if (scene) return;
    const phone = document.querySelector('.phone');
    if (!phone) return;
    scene = document.createElement('div'); scene.className = 'hw-scene'; scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML = '<div class="hw-night"></div><div class="hw-haze"></div><div class="hw-mist"></div><div class="hw-mist second"></div><div class="hw-ghost">' + ghost + '</div><div class="hw-ghost second">' + ghost + '</div><svg class="hw-bats" viewBox="0 0 130 60"><path d="m5 24 18-13 14 5 9-16 10 19 16-7 20 18-26-4-19 18-19-17zM83 46l11-8 9 3 6-10 6 11 9-3 6 11-15-3-12 11-10-10z" fill="#080712"/></svg><div class="hw-candle"></div><div class="hw-candle right"></div>';
    for (let i = 1; i <= 12; i++) { const dot = document.createElement('i'); dot.className = 'hw-spark'; dot.style.setProperty('--i', i); scene.append(dot); }
    phone.prepend(scene);
    const graves=document.createElement('div');graves.className='hw-graveyard';scene.append(graves);
    for(let i=0;i<2;i++){const walker=document.createElement('div');walker.className='hw-wanderer'+(i?' distant':'');walker.innerHTML=ghost;scene.append(walker);}
    const groundFog=document.createElement('div');groundFog.className='hw-ground-fog';scene.append(groundFog);
    const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sprite.setAttribute('aria-hidden', 'true'); sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    sprite.innerHTML = '<defs>' + Object.entries(icons).map(([name, paths]) => '<g id="hw-' + name + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + paths + '</g>').join('') + '</defs>';
    document.body.append(sprite);
    controls = document.createElement('div'); controls.className = 'hw-controls';
    controls.innerHTML = '<button type="button" data-hw-motion aria-label="เปิดภาพเคลื่อนไหว Halloween" title="เปิดภาพเคลื่อนไหว Halloween">▶</button><button type="button" data-hw-sound aria-label="เปิดเสียง Halloween" title="เปิดเสียง Halloween">' + soundSvg + '</button>';
    controls.querySelector('[data-hw-sound]').addEventListener('click', () => sound(!enabled));
    controls.querySelector('[data-hw-motion]').addEventListener('click', toggleMotion);
    document.body.append(controls);
  }
  function preferences() {
    const picker = document.getElementById('themePick');
    if (!picker || document.getElementById('hwPreferences')) return;
    const box = document.createElement('div'); box.id = 'hwPreferences'; box.className = 'hw-preferences';
    box.innerHTML = '<div><span><b>บรรยากาศ Halloween</b><small>เปิดเสียงเพื่อฟังเพลงและเสียงประกอบ</small></span><button type="button" data-hw-pref-sound></button></div><label>ระดับเสียง <input aria-label="ระดับเสียง Halloween" type="range" min="0" max="100" value="' + Math.round(volume * 100) + '"></label><div><span>เพลงพื้นหลัง<small>Midnight Waltz · กล่องดนตรี</small></span><button type="button" data-hw-pref-music></button></div><div><span>ฉากเคลื่อนไหว</span><button type="button" data-hw-pref-motion></button></div><div><span>โทนสี<small>กลางคืน (มืด) หรือแสงจันทร์ (สว่าง)</small></span><button type="button" data-hw-pref-tone></button></div>';
    box.querySelector('[data-hw-pref-tone]').addEventListener('click', () => setTone(paletteTone === 'light' ? 'dark' : 'light'));
    box.querySelector('[data-hw-pref-sound]').addEventListener('click', () => sound(!enabled));
    box.querySelector('[data-hw-pref-motion]').addEventListener('click', toggleMotion);
    box.querySelector('[data-hw-pref-music]').addEventListener('click', () => setMusic(!musicEnabled));
    box.querySelector('input').addEventListener('input', e => setVolume(Number(e.target.value) / 100));
    picker.after(box); updateControls();
  }
  // Me list, Moon & Candle only: a featured pair and three engraved headstones. Every other theme keeps
  // the equal rows the owner chose (1C06). Rows are moved, never cloned, so ids, handlers and live counters
  // keep working, and leaving the theme puts every row back in its original order.
  const ME_GROUPS = [
    ['hw-me-feat', '', ['.pe-shop', '.pe-pro']],
    ['hw-me-grp', 'การเรียนของฉัน', ['[onclick^="openMySubjects"]', '#peCtx']],
    ['hw-me-grp', 'เพื่อนและสังคม', ['[onclick^="openDmInbox"]', '[onclick^="openFeed"]', '[onclick^="openBoard"]', '.pe-soon']],
    ['hw-me-grp', 'จากทีม StudentOS', ['#peNews', '[onclick*="feedback.html"]', '#peBugReports']],
  ];
  let meOrder = null;
  function groupMe() {
    const list = document.querySelector('#scr-profile .pf-entry');
    if (!list || meOrder) return;
    meOrder = [...list.children];
    for (const [cls, label, picks] of ME_GROUPS) {
      const rows = picks.map(sel => list.querySelector(':scope > ' + sel)).filter(Boolean);
      if (!rows.length) continue;
      const box = document.createElement('div'); box.className = cls;
      if (label) { const head = document.createElement('div'); head.className = 'hw-me-h'; head.textContent = label; box.append(head); }
      box.append(...rows); list.append(box);
    }
    // A row no group claims (added later in index.html) stays visible after the groups.
    for (const row of meOrder) if (row.parentElement === list) list.append(row);
  }
  function ungroupMe() {
    const list = document.querySelector('#scr-profile .pf-entry');
    if (!list || !meOrder) return;
    list.append(...meOrder);
    for (const box of [...list.children]) if (box.classList.contains('hw-me-feat') || box.classList.contains('hw-me-grp')) box.remove();
    meOrder = null;
  }
  function decorate() {
    queued = false;
    if (!active) return;
    mount(); preferences(); if (isMoon()) groupMe();
    document.querySelectorAll('.td-now,.td-clear,.tn-cta,.tc-cta,.tk-cta,.fm-start,.main-btn,.btn-primary,.qa-save,.on-next,.td-rail,.sai-day,.sd-task,.as-card,.as-hero,.as-row,#scr-profile .shw,#scr-profile .pe,#scr-profile .pe-daily,#scr-profile .pf-me,#scr-profile .fb-promo,#scr-profile .pri,#scr-tasks .tb-focus,#scr-tasks .tk.sw-card,#scr-tasks .wk-row,#scr-tasks button:not(.tk-tick):not(.tk-sb):not(.fr-clear)').forEach(card => {
      card.classList.add('hw-art-host');
      if (card.querySelector(':scope > .hw-ornament')) return;
      const art = document.createElement('span'); art.className = 'hw-ornament'; art.setAttribute('aria-hidden', 'true');
      if (card.matches('.as-row,#scr-profile .shw,#scr-profile .pe,#scr-profile .pe-daily,#scr-profile .fb-promo,#scr-profile .pri,#scr-tasks button')) art.classList.add('hw-ornament-mini');
      art.innerHTML = '<i class="hw-card-smoke"></i><i class="hw-card-blood"></i><i class="hw-card-ghost">' + ghost + '</i>';
      card.append(art);
    });
    document.querySelectorAll('svg image.brand-light,svg image.brand-dark').forEach(mark => { if (!brandOriginals.has(mark)) brandOriginals.set(mark, mark.getAttribute('href')); mark.setAttribute('href', 'halloween/rewards/theme-assets/app-icon.webp'); });
    for (const [img] of originals) if (!img.isConnected) originals.delete(img);
    for (const [use] of iconOriginals) if (!use.isConnected) iconOriginals.delete(use);
    document.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || '';
      let target;
      if (/(?:^|\/)hook-(?:body|face)\.webp$|(?:^|\/)hook-avatar\.png$/.test(src)) target = 'halloween/rewards/theme-assets/hook-mummy.webp';
      if (/(?:^|\/)sai-(?:chibi|face-[\w-]+)\.webp$|(?:^|\/)sai-avatar\.png$/.test(src)) target = 'halloween/rewards/theme-assets/sai-witch.webp';
      if (/(?:^|\/)(?:logo-splash(?:-light)?|logo-mark|icon-(?:alt-)?192)\.png$/.test(src)) target = 'halloween/rewards/theme-assets/app-icon.webp';
      if (target) { if (!originals.has(img)) originals.set(img, src); img.setAttribute('src', target); img.dataset.hwCharacter = 'true'; }
    });
    document.querySelectorAll('svg use').forEach(use => {
      const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
      const aliases = {'tb-home':'home','tb-home-f':'home','tb-tasks':'tasks','tb-tasks-f':'tasks','tb-plus':'plus','tb-ai':'owl','tb-ai-f':'owl','tb-profile':'user','tb-profile-f':'user','lu-plan':'book','lu-message':'book','lu-users':'user','lu-scan':'grid','lu-inbox':'bag','lu-chart':'sparkles'};
      const name = aliases[href.slice(1)] || href.replace('#lu-', '');
      if (!icons[name] || (!href.startsWith('#lu-') && !aliases[href.slice(1)])) return;
      if (!iconOriginals.has(use)) iconOriginals.set(use, href);
      use.setAttribute('href', '#hw-' + name);
    });
  }
  function queue() { if (!queued && active) { queued = true; requestAnimationFrame(decorate); } }
  function restore() {
    ungroupMe();
    for (const [img, src] of originals) { if (img.isConnected) { img.setAttribute('src', src); delete img.dataset.hwCharacter; } }
    for (const [use, href] of iconOriginals) if (use.isConnected) use.setAttribute('href', href);
    for (const [mark, href] of brandOriginals) if (mark.isConnected) mark.setAttribute('href', href);
    brandOriginals.clear();
    originals.clear(); iconOriginals.clear();
  }
  // Original eight-bar music-box waltz in A minor, with a bass and quiet chords.
  // Schedule against the audio clock; the timer only fills the next short horizon.
  const MUSIC_SCORE = [
    { bass:45, chord:[57,60,64], melody:[81,null,84,83,81,76] },
    { bass:41, chord:[53,57,60], melody:[77,null,81,79,77,76] },
    { bass:38, chord:[50,53,57], melody:[74,null,77,76,74,72] },
    { bass:40, chord:[52,56,59], melody:[76,80,83,null,81,80] },
    { bass:45, chord:[57,60,64], melody:[81,84,88,84,83,81] },
    { bass:41, chord:[53,57,60], melody:[81,null,79,77,76,72] },
    { bass:38, chord:[50,53,57], melody:[74,77,81,79,77,74] },
    { bass:40, chord:[52,56,59], melody:[76,80,83,80,76,null] },
  ];
  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = 0;
    for (const voice of musicVoices) { try { voice.stop(); } catch {} voice.disconnect(); }
    musicVoices.clear();
    if (musicBus) musicBus.disconnect();
    musicBus = null;
    root.dataset.hwMusic = 'off';
  }
  function musicNote(midi, at, duration, gain, type = 'sine') {
    if (!context || !musicBus) return;
    const voice = context.createOscillator(), envelope = context.createGain();
    voice.type = type;
    voice.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), at);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + Math.min(.035, duration / 5));
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    voice.connect(envelope).connect(musicBus);
    musicVoices.add(voice);
    voice.onended = () => { musicVoices.delete(voice); voice.disconnect(); envelope.disconnect(); };
    voice.start(at); voice.stop(at + duration + .03);
  }
  function startMusic() {
    if (musicTimer || !musicEnabled || !context || !master || !active || !enabled || document.hidden) return;
    musicBus = context.createGain(); musicBus.gain.value = .8; musicBus.connect(master);
    const eighth = 60 / 70 / 2, barLength = eighth * 6;
    musicBar = 0; nextBarAt = context.currentTime + .1;
    const schedule = () => {
      if (!context || document.hidden || !active || !enabled || !musicEnabled) { stopMusic(); return; }
      // A throttled background timer must never replay a backlog of bars.
      if (nextBarAt < context.currentTime) nextBarAt = context.currentTime + .05;
      if (nextBarAt > context.currentTime + .45) return;
      const bar = MUSIC_SCORE[musicBar++ % MUSIC_SCORE.length];
      musicNote(bar.bass, nextBarAt, barLength * .85, .025, 'triangle');
      bar.chord.forEach(note => musicNote(note, nextBarAt, barLength * .9, .009));
      bar.melody.forEach((note, step) => {
        if (note == null) return;
        const at = nextBarAt + step * eighth;
        musicNote(note, at, eighth * 1.6, step === 0 ? .075 : .06);
        musicNote(note + 12, at, eighth * .8, .012);
      });
      nextBarAt += barLength;
    };
    schedule(); musicTimer = setInterval(schedule, 200);
    root.dataset.hwMusic = 'playing';
  }
  function setMusic(value) {
    musicEnabled = !!value; write(MUSIC_KEY, musicEnabled ? '1' : '0');
    if (musicEnabled) audio(); else stopMusic();
    updateControls();
  }
  function stopAudio() {
    stopMusic();
    if (wind) { try { wind.stop(); } catch {} wind = null; }
    if (context) { context.close().catch(() => {}); context = null; master = null; }
    root.dataset.hwAudio = 'off';
  }
  function audio() {
    if (!active || !enabled || document.hidden) return false;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    if (!context) { context = new Ctx(); const current = context; context.onstatechange = () => { if (context !== current) return; root.dataset.hwAudio = current.state; updateControls(); }; master = context.createGain(); master.gain.value = volume; master.connect(context.destination); }
    if (context.state === 'suspended') context.resume().catch(() => {});
    root.dataset.hwAudio = context.state;
    if (!wind) {
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate), data = buffer.getChannelData(0);
      let previous = 0; for (let i = 0; i < data.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .025) / 1.025; data[i] = previous * 3; }
      wind = context.createBufferSource(); wind.buffer = buffer; wind.loop = true;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 360;
      windGain = context.createGain(); windGain.gain.value = .008;
      wind.connect(filter).connect(windGain).connect(master); wind.start();
    }
    startMusic();
    return true;
  }
  function tone(freq, start, duration, gain = .055, type = 'sine', end) {
    if (!context || !master) return;
    const oscillator = context.createOscillator(), envelope = context.createGain();
    const at = context.currentTime + start;
    oscillator.type = type; oscillator.frequency.setValueAtTime(freq, at);
    if (end) oscillator.frequency.exponentialRampToValueAtTime(end, at + duration);
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(gain, at + .012); envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope).connect(master); oscillator.start(at); oscillator.stop(at + duration + .02);
  }
  function play(kind) {
    if (!audio()) return;
    const now = performance.now(); if (kind === 'tap' && now - lastSound < 80) return; lastSound = now;
    if (kind === 'done') { [392, 523.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * .075, .7, .06)); tone(196, 0, .7, .035, 'sine', 392); }
    else if (kind === 'page') { tone(261.63, 0, .32, .035); tone(392, .07, .48, .025); }
    else if (kind === 'enable') { tone(440, 0, .7); tone(523.25, .14, .8); tone(659.25, .28, 1.1, .035); }
    else tone(440, 0, .085, .022, 'sine', 240);
  }
  function updateControls() {
    document.querySelectorAll('button[data-hw-sound]').forEach(button => { button.setAttribute('aria-label', enabled ? 'ปิดเสียง Halloween' : 'เปิดเสียง Halloween'); button.title = enabled ? 'ปิดเสียง Halloween' : 'เปิดเสียง Halloween'; button.setAttribute('aria-pressed', String(enabled)); });
    const s = document.querySelector('[data-hw-pref-sound]'); if (s) s.textContent = enabled ? 'เสียงเปิดอยู่' : 'เปิดเสียง';
    const music = document.querySelector('[data-hw-pref-music]'); if (music) { music.textContent = musicEnabled ? 'เปิดไว้' : 'ปิดไว้'; music.setAttribute('aria-pressed', String(musicEnabled)); music.setAttribute('aria-label', musicEnabled ? 'ปิดเพลงพื้นหลัง Halloween' : 'เปิดเพลงพื้นหลัง Halloween'); }
    const moving = motion === 'full' && root.dataset.lite !== '1' && root.dataset.quality !== 'low';
    const m = document.querySelector('[data-hw-pref-motion]'); if (m) { m.textContent = moving ? 'หยุดภาพ' : 'เปิดภาพเคลื่อนไหว'; m.setAttribute('aria-pressed', String(moving)); }
    document.querySelectorAll('button[data-hw-motion]').forEach(button=>{const label=moving?'หยุดภาพเคลื่อนไหว Halloween':'เปิดภาพเคลื่อนไหว Halloween';button.textContent=moving?'Ⅱ':'▶';button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(moving));});
    const t = document.querySelector('[data-hw-pref-tone]'); if (t) { t.parentElement.hidden = !isMoon(); const light = root.dataset.hwTone === 'light'; t.textContent = light ? 'แสงจันทร์' : 'กลางคืน'; t.setAttribute('aria-pressed', String(light)); t.setAttribute('aria-label', light ? 'เปลี่ยนเป็นโทนกลางคืน' : 'เปลี่ยนเป็นโทนแสงจันทร์'); }
    const prefs = document.getElementById('hwPreferences'); if (prefs) prefs.hidden = !active;
    root.dataset.hwSound = enabled ? 'on' : 'off';
    if (parent !== window) { const screen = document.querySelector('.screen.on'); parent.postMessage({ type: 'studentos-halloween-status', sound: enabled, motion, active, audio: root.dataset.hwAudio || 'off', moving: active && getComputedStyle(document.querySelector('.hw-haze')).animationName !== 'none', ornaments: document.querySelectorAll('.hw-ornament').length, viewport: [innerWidth, innerHeight], overflow: document.documentElement.scrollWidth > innerWidth, screen: screen?.id, screenScroll: screen ? screen.scrollHeight - screen.clientHeight : 0 }, location.origin); }
  }
  function sound(value) { enabled = !!value; write(SOUND_KEY, enabled ? '1' : '0'); if (enabled) play('enable'); else stopAudio(); updateControls(); }
  function setVolume(value) { volume = Math.max(0, Math.min(1, value)); write(VOLUME_KEY, volume); if (master && context) master.gain.setTargetAtTime(volume, context.currentTime, .03); }
  function setMotion(value) {
    motion = value === 'still' ? 'still' : 'full'; write(MOTION_KEY, motion); root.dataset.hwMotion = motion;
    // Choosing motion explicitly also leaves the graphics mode that freezes it.
    if (motion === 'full' && typeof window.setGfx === 'function') window.setGfx('high', true);
    updateControls();
  }
  function setTone(value) {
    paletteTone = value === 'light' ? 'light' : 'dark'; write(TONE_KEY, paletteTone); root.dataset.hwTone = paletteTone;
    paintBar(); updateControls();
  }
  function paintBar() {
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta && active && isMoon()) meta.content = TONE_BAR[paletteTone];
  }
  function toggleMotion() { setMotion(motion === 'full' && root.dataset.lite !== '1' && root.dataset.quality !== 'low' ? 'still' : 'full'); }
  function burst(x = lastTap.x, y = lastTap.y, count = 12) {
    if (!active || motion === 'still' || root.dataset.lite === '1' || root.dataset.quality === 'low') return;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('i'); dot.className = 'hw-burst'; const angle = Math.PI * 2 * i / count;
      dot.style.cssText = '--x:' + x + 'px;--y:' + y + 'px;--dx:' + Math.cos(angle) * (35 + i * 4) + 'px;--dy:' + (Math.sin(angle) * (35 + i * 4) - 25) + 'px';
      document.body.append(dot); setTimeout(() => dot.remove(), 900);
    }
    const ring = document.createElement('i'); ring.className = 'hw-ring'; ring.style.cssText = '--x:' + x + 'px;--y:' + y + 'px'; document.body.append(ring); setTimeout(() => ring.remove(), 900);
  }
  function sync() {
    const next = FAMILY.includes(root.dataset.theme);
    if (next !== active) { active = next; if (active) { mount(); decorate(); } else { restore(); stopAudio(); } }
    // Switching straight between the two family themes keeps the scene but must regroup or ungroup the list.
    if (active && isMoon()) groupMe(); else ungroupMe();
    if (scene) scene.hidden = !active;
    paintBar(); updateControls();
  }
  function init() {
    mount(); preferences(); sync();
    new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme','data-lite','data-quality'] });
    document.addEventListener('pointerdown', e => { lastTap = { x: e.clientX, y: e.clientY }; if (active && e.target.closest('button,a,[role=button]')) play('tap'); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio(); });
    window.addEventListener('resize', () => requestAnimationFrame(updateControls));
    const originalGo = window.go;
    if (typeof originalGo === 'function') window.go = function (id) { const before = document.querySelector('.screen.on')?.id; const result = originalGo.apply(this, arguments); if (active && before !== id) { play('page'); queue(); } requestAnimationFrame(updateControls); return result; };
    const originalHaptic = window.haptic;
    if (typeof originalHaptic === 'function') window.haptic = function (kind) { const result = originalHaptic.apply(this, arguments); if (active && kind === 'done') { play('done'); burst(); } return result; };
    window.addEventListener('message', e => {
      if (e.origin !== location.origin || e.source !== parent || e.data?.type !== 'studentos-halloween-control') return;
      if (e.data.action === 'sound') sound(e.data.value);
      if (e.data.action === 'motion') setMotion(e.data.value);
      if (e.data.action === 'tone') setTone(e.data.value);
      if (e.data.action === 'theme' && typeof window.setTheme === 'function') window.setTheme(e.data.value === 'light' ? 'light' : 'halloween');
      if (e.data.action === 'celebrate') { play('done'); burst(innerWidth / 2, innerHeight / 2, 20); }
      if (e.data.action === 'screen' && ['scr-menu','scr-tasks','scr-profile','scr-settings','scr-shop','scr-badges','scr-room'].includes(e.data.value)) window.go(e.data.value);
    });
    window.HalloweenTheme = Object.freeze({ sound, music: setMusic, volume: setVolume, motion: setMotion, tone: setTone, celebrate: () => { play('done'); burst(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
