(() => {
  "use strict";
  const { Run, STEP, LESSONS, angle } = FrostCombat;
  const { PASSIVES, ACTIVES }=FrostLoot;
  const { MODES, TEXT } = FrostWorld;
  const { ITEMS } = FrostItems;
  const { escape } = FrostRunUI;
  const get = id => document.getElementById(id);
  const shell = document.querySelector(".shell");
  const title = get("title-screen"), field = get("playfield"), canvas = get("arena");
  const intro = get("intro");
  const veil = get("veil"), panel = get("panel"), stick = get("stick"), knob = get("knob");
  const renderer = new FrostRenderer(canvas);
  const debugEnabled=new URLSearchParams(location.search).get("debug")==="1";
  const diagnostics=new FrostStability.Diagnostics(debugEnabled);
  const debugPanel=get("diagnostics");
  const frameLoop=new FrostStability.FrameLoop(fn=>requestAnimationFrame(fn),id=>cancelAnimationFrame(id),loop,
    error=>failGame(error,"frame"));
  const defaults = { muted:false, volume:.55, music:.72, sfx:1, reduced:matchMedia("(prefers-reduced-motion: reduce)").matches,
    aimGuide:true, damageNumbers:true, shake:true, hints:true, uiScale:100, hudOpacity:94, quality:"high", best:0 };
  const storageKey = "frostbound.demo.v1";
  const settings = loadSettings();
  let storage;
  try { storage = localStorage; } catch {}
  const provider = new FrostRecords.LocalRecordProvider(storage);
  const keys = new Set();
  const pointer = { x: 0, y: 0, active: false };
  const joystick = { id: null, x: 0, y: 0 };
  const coarse = matchMedia("(pointer: coarse)");
  let run = null, modal = null, back = null, queued = null;
  let sinceBanner = 0, lastFrame = 0, accumulator = 0;
  let drawnAt=-Infinity;
  let combatNotice=null;
  let failure=null, introTimer=0, requestingFullscreen=false, lastState="TITLE", debugAt=0;
  let audio = null, gain = null, musicGain = null, sfxGain = null, musicStep = 0, nextNote = 0;
  let noiseBuffer=null, voices=0;
  const combatSound=FrostCombatAudio.create(tone,noise);
  let introPreset = "edge", runPreset = "edge", subtitleUntil = 0, hudAt = 0, toastUntil = 0, previewAt = 0;
  const paintedLoadouts = new WeakSet();
  let previousFocus = null;
  const screens = new FrostRunUI.UI({open,close:()=>run ? resume() : close(),getRun:()=>run,start:launch,time:timeLabel,provider,refresh:updateHUD,notify});

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || typeof saved !== "object") return { ...defaults };
      return {
        muted: typeof saved.muted === "boolean" ? saved.muted : defaults.muted,
        volume: Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : defaults.volume,
        music: Number.isFinite(saved.music) ? Math.max(0,Math.min(1,saved.music)) : defaults.music,
        sfx: Number.isFinite(saved.sfx) ? Math.max(0,Math.min(1,saved.sfx)) : defaults.sfx,
        reduced: typeof saved.reduced === "boolean" ? saved.reduced : defaults.reduced,
        aimGuide: typeof saved.aimGuide === "boolean" ? saved.aimGuide : defaults.aimGuide,
        damageNumbers: typeof saved.damageNumbers === "boolean" ? saved.damageNumbers : defaults.damageNumbers,
        shake: typeof saved.shake === "boolean" ? saved.shake : defaults.shake,
        hints: typeof saved.hints === "boolean" ? saved.hints : defaults.hints,
        uiScale:[90,100,110,120].includes(saved.uiScale)?saved.uiScale:defaults.uiScale,
        hudOpacity:Number.isFinite(saved.hudOpacity)?Math.max(50,Math.min(100,saved.hudOpacity)):defaults.hudOpacity,
        quality:["low","medium","high"].includes(saved.quality)?saved.quality:defaults.quality,
        best: Number.isSafeInteger(saved.best) && saved.best > 0 ? saved.best : 0
      };
    } catch {
      return { ...defaults };
    }
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch {}
    get("best").textContent = settings.best ? settings.best.toLocaleString("en-US") : "—";
    document.body.classList.toggle("reduce-motion", settings.reduced);
    document.body.classList.toggle("hide-hints",!settings.hints);
    document.documentElement.style.fontSize=settings.uiScale+"%";
    document.documentElement.style.setProperty("--hud-opacity",settings.hudOpacity/100);
    if (gain) {
      gain.gain.setTargetAtTime(settings.muted ? 0 : settings.volume, audio.currentTime, .03);
      musicGain.gain.setTargetAtTime(settings.music,audio.currentTime,.03);
      sfxGain.gain.setTargetAtTime(settings.sfx,audio.currentTime,.03);
    }
  }
  function unlock() {
    try {
      if (!audio) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        audio = new Context();
        gain = audio.createGain();
        gain.gain.value = settings.muted ? 0 : settings.volume;
        gain.connect(audio.destination);
        musicGain = audio.createGain();
        musicGain.gain.value = settings.music;
        musicGain.connect(gain);
        sfxGain = audio.createGain();
        sfxGain.gain.value = settings.sfx;
        sfxGain.connect(gain);
      }
      if (audio.state === "suspended") audio.resume().catch(() => {});
    } catch {}
  }
  function tone(start, end, length, volume, shape = "sine", delay = 0, channel = sfxGain) {
    if (!audio || !channel || settings.muted || audio.state !== "running"||voices>=24) return;
    const t = audio.currentTime + delay;
    const note = audio.createOscillator(), voice = audio.createGain();
    note.type = shape;
    note.frequency.setValueAtTime(start, t);
    note.frequency.exponentialRampToValueAtTime(end, t + length);
    voice.gain.setValueAtTime(.0001, t);
    voice.gain.exponentialRampToValueAtTime(volume, t + Math.min(.09, length * .35));
    voice.gain.exponentialRampToValueAtTime(.0001, t + length);
    note.connect(voice).connect(channel);
    voices++;
    note.onended=()=>{note.disconnect();voice.disconnect();voices--;};
    note.start(t);
    note.stop(t + length + .01);
  }
  function noise(frequency,length,volume,type="bandpass",delay=0) {
    if(!audio||!sfxGain||settings.muted||audio.state!=="running"||voices>=24) return;
    if(!noiseBuffer) {
      noiseBuffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.32),audio.sampleRate);
      const data=noiseBuffer.getChannelData(0);
      let seed=918473;
      for(let i=0;i<data.length;i++) {
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        data[i]=(seed/2147483648-1)*.72;
      }
    }
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),voice=audio.createGain();
    const start=audio.currentTime+delay;
    source.buffer=noiseBuffer;
    filter.type=type;
    filter.frequency.setValueAtTime(frequency,start);
    filter.Q.value=.76;
    voice.gain.setValueAtTime(volume,start);
    voice.gain.exponentialRampToValueAtTime(.0001,start+length);
    source.connect(filter).connect(voice).connect(sfxGain);
    voices++;
    source.onended=()=>{source.disconnect();filter.disconnect();voice.disconnect();voices--;};
    source.start(start);
    source.stop(start+length);
  }
  function soundtrack() {
    if (!audio || audio.state !== "running" || settings.muted || modal || !intro.hidden) return;
    if (audio.currentTime < nextNote) return;
    const region = run?.room.theme;
    const patterns = {forest:[55,73.42,82.4,65.4],crystal:[65.4,98,82.4,73.42],gallery:[49,65.4,87.31,65.4],crypt:[41.2,55,61.74,55]};
    const boss=run?.boss;
    const pattern = boss?.type==="king"&&boss.phase===3?[49,58.27,49,73.42,55,49,41.20,55]:
      boss ? [55, 55, 65.4, 49, 55, 82.4, 49, 55] :
      patterns[region] ?? (run ? [73.42, 55, 65.4, 55, 73.42, 87.31, 65.4, 55] : [55, 82.4, 65.4, 49, 55, 73.42, 65.4, 49]);
    const note = pattern[musicStep++ % pattern.length];
    const gap = run?.boss ? .63 : run ? 1.1 : 1.9;
    nextNote = audio.currentTime + gap;
    tone(note, note * .997, gap * 1.5, .045, "triangle",0,musicGain);
    tone(note * (musicStep % 2 ? 2 : 3), note * (musicStep % 2 ? 2 : 3), gap * 1.6, .016,"sine",0,musicGain);
  }
  function syncFullscreen() {
    const screen = get("screen-mode");
    if (screen) screen.textContent = document.fullscreenElement === shell ? "Exit fullscreen" : "Enter fullscreen";
  }
  async function enterFullscreen(showFeedback = false) {
    if (document.fullscreenElement === shell || requestingFullscreen) return;
    requestingFullscreen=true;
    try { await shell.requestFullscreen({ navigationUI: "hide" }); }
    catch {
      const feedback = get("screen-feedback");
      if (showFeedback && feedback) feedback.hidden = false;
    }
    finally { requestingFullscreen=false; }
    syncFullscreen();
  }
  async function toggleFullscreen() {
    if (document.fullscreenElement !== shell) {
      await enterFullscreen(true);
      return;
    }
    try { await document.exitFullscreen(); } catch {}
    syncFullscreen();
  }
  function playSound(event) {
    if(combatSound.play(event,audio?.currentTime??performance.now()/1000)) return;
    switch (event.kind) {
      case "drink": tone(242,440,.25,.07); break;
      case "pickup": tone(523,784,.22,.065,"triangle"); break;
      case "skill": tone(330,790,.35,.13,"triangle"); break;
      case "reward": tone(440,660,.25,.09); break;
      case "environment":
        if(event.id==="bell") tone(196,149,.7,.12,"sine");
        else if(event.id==="ice") tone(570,76,.28,.12,"triangle");
        else if(event.id==="resonance") tone(312,660,.45,.09,"sine");
        else if(event.id==="whiteout") tone(66,120,.62,.07,"triangle");
        break;
      case "clear":
      case "victory":
        [293.66, 440, 523.25, 587.33].forEach((frequency, i) => tone(frequency, frequency, .64, .08, "triangle", i * .12));
        break;
      case "death": tone(130.8, 48, .7, .12, "triangle"); break;
    }
  }

  function flushInput() {
    keys.clear();
    queued = null;
    pointer.active = false;
    const capture=joystick.id;
    joystick.id = null;
    if(capture!==null&&stick.hasPointerCapture(capture)) stick.releasePointerCapture(capture);
    joystick.x = 0;
    joystick.y = 0;
    knob.style.transform = "";
  }
  function gameState() {
    if(failure) return "ERROR";
    if(!intro.hidden) return "INTRO";
    if(modal==="results") return run?.result?.won?"VICTORY":"GAME_OVER";
    if(modal) return ({pause:"PAUSED",options:"SETTINGS",story:"ROOM_TRANSITION",paths:"ROUTE_SELECTION",
      choose:"REWARD_SELECTION",dialogue:"DIALOGUE",event:"DIALOGUE","event-result":"DIALOGUE",lore:"DIALOGUE"})[modal]??modal.toUpperCase();
    if(!run) return "TITLE";
    if(run.mode==="dying") return "DYING";
    if(run.enemies?.some(enemy=>enemy.boss&&enemy.state==="transition")) return "BOSS_TRANSITION";
    return run.mode?.toUpperCase()??"UNKNOWN";
  }
  function trackState() {
    if(!debugEnabled) return;
    const next=gameState();
    diagnostics.change(lastState,next);
    lastState=next;
  }
  function debugSnapshot() {
    const room=run?.room, player=run?.player;
    const enemies=run?.enemies?.filter(enemy=>enemy.state!=="dead")??[];
    const boss=enemies.find(enemy=>enemy.boss);
    return {...diagnostics.snapshot(),state:gameState(),seed:run?.seed,mode:run?.kind,region:room?.region??room?.name,
      room:room?.id??room?.name,wave:run?.runWave,roomNumber:run?.wave,playerState:player?.action?.type??"idle",
      player:player?{x:player.x,y:player.y,time:run.time}:null,enemyCount:enemies.length,
      overlay:modal,inputLocked:Boolean(failure||modal||!intro.hidden||run?.mode!=="playing"),inert:field.inert,
      pendingTransition:!intro.hidden?"intro":modal==="paths"?"route choice":run?.preparing?"room preparation":
        boss?.state==="transition"?"boss phase "+boss.phase:run?.reinforcing?"reinforcements":run?.mode==="choose"?"reward":null};
  }
  function failGame(error,origin) {
    if(failure) return;
    const subsystem=diagnostics.subsystem;
    const code=origin==="ui"?"FB-UI":subsystem==="render"?"FB-RENDER":
      ["simulation","combat-input","player","spawn","enemy-ai","combat-effects","encounter-completion","room-transition"].includes(subsystem)?"FB-SIM":"FB-FRAME";
    const snapshot=debugSnapshot();
    failure={code,snapshot};
    frameLoop.stop();
    clearTimeout(introTimer);
    intro.hidden=true;
    console.error("[FROSTBOUND "+code+"]",error,snapshot);
    diagnostics.note("failure",{code,message:error?.message??String(error)});
    open("failure",heading("This run cannot continue")+
      '<p>The game stopped after an unexpected error. You can return safely to the title screen.</p>'+
      '<p>Diagnostic code <strong>'+code+'</strong></p>'+
      actions(button("failure-home","Title screen",true)),"#failure-home");
    bind("failure-home",()=>{
      failure=null;
      home();
      lastFrame=0;
      accumulator=0;
      drawnAt=-Infinity;
      frameLoop.start();
    });
  }
  function open(kind, content, primary, wide = false) {
    if (!modal) previousFocus = document.activeElement;
    const previous = modal;
    modal = kind;
    flushInput();
    panel.dataset.screen = kind;
    delete panel.dataset.readOnly;
    panel.classList.toggle("entering",kind!==previous);
    panel.classList.toggle("wide", wide);
    panel.innerHTML = content;
    previewAt = 0;
    title.inert = true;
    field.inert = true;
    veil.hidden = false;
    trackState();
    if (primary) panel.querySelector(primary)?.focus({ preventScroll: true });
    if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return panel;
  }
  function close(restore = true) {
    modal = null;
    veil.hidden = true;
    panel.replaceChildren();
    title.inert = false;
    field.inert = false;
    trackState();
    if (restore && previousFocus instanceof HTMLElement && previousFocus.getClientRects().length) {
      previousFocus.focus({ preventScroll: true });
    }
    previousFocus = null;
  }
  const button = (id, text, primary = false) => '<button class="button ' + (primary ? 'primary' : 'secondary') + '" id="' + id + '">' + text + '</button>';
  const actions = (...items) => '<div class="panel-actions">' + items.join("") + '</div>';
  const heading = text => '<h2 id="dialog-title">' + text + '</h2>';
  function bind(id, handler) {
    const control=get(id);
    control.addEventListener("click",event=>{if(control.isConnected) handler(event);});
  }
  function setBanner(text, duration = 1.45) {
    get("announcement").textContent = text;
    get("live").textContent = text;
    sinceBanner = duration;
  }
  function launch(kind, preset = "edge") {
    enterFullscreen();
    if (kind !== "story" || settings.reduced) { start(kind,preset); return; }
    introPreset = preset;
    close(false);
    unlock();
    tone(74, 55, 2.6, .14, "triangle");
    tone(148, 110, 2.2, .05);
    title.hidden = true;
    intro.hidden = false;
    trackState();
    clearTimeout(introTimer);
    introTimer=setTimeout(finishIntro,7400);
    get("skip-intro").focus({ preventScroll: true });
  }
  function finishIntro() {
    clearTimeout(introTimer);
    if (!intro.hidden) start("story",introPreset);
  }
  function start(kind = "story", preset = "edge") {
    runPreset=preset;
    unlock();
    tone(440, 540, .18, .07, "triangle");
    flushInput();
    close(false);
    run = new Run(kind,crypto.getRandomValues(new Uint32Array(1))[0],preset);
    if(debugEnabled) {
      run.trace=subsystem=>diagnostics.mark(subsystem);
      diagnostics.note("run started",{seed:run.seed,mode:run.kind});
      console.info("FROSTBOUND run", { seed:run.seed, mode:run.kind });
    }
    subtitleUntil = 0;
    combatNotice=null;
    get("combat-notice").hidden=true;
    get("subtitle").hidden = true;
    get("toast").hidden = true;
    toastUntil=0;
    accumulator = 0;
    intro.hidden = true;
    title.hidden = true;
    field.hidden = false;
    setBanner(run.training ? "Training Room" : "", run.training ? 1.2 : 0);
    updateHUD();
    renderer.draw(run, settings);
    canvas.focus({ preventScroll: true });
    handleEvents();
    updateHUD();
  }
  function home() {
    flushInput();
    renderer.reset?.();
    run = null;
    intro.hidden=true;
    close(false);
    title.hidden = false;
    field.hidden = true;
    get("start").focus({ preventScroll: true });
  }
  function pause() {
    if (!run || run.mode !== "playing") return;
    open("pause", heading("Paused") + actions(
      button("resume", "Resume", true), button("pause-options", "Settings"),button("pause-pack",run.equipmentAccess.allowed?"Inventory":"Inspect loadout"),
      button("restart", "Restart"), button("exit", "Title screen")
    ), "#resume");
    bind("resume", resume);
    bind("pause-options", options);
    bind("pause-pack",()=>screens.inventory(pause,null,"all",{readOnly:!run.equipmentAccess.allowed}));
    bind("restart", () => confirmExit(true));
    bind("exit", () => confirmExit(false));
  }
  function confirmExit(restart) {
    const kind = run.kind;
    if (run.training) {
      if (restart) start("training");
      else home();
      return;
    }
    open("leave",heading("End this run?")+'<p>Leaving now will end your current run. All temporary progress will be lost.</p>'+
      actions(button("keep-playing","Continue Playing",true),button("end-run","End Run")),"#keep-playing");
    bind("keep-playing",resume);
    bind("end-run",()=>{
      if(run.abandon()) provider.record(run.result);
      if(restart && kind==="boss") { home(); screens.modeIntro("boss"); }
      else if(restart) start(kind);
      else home();
    });
  }
  function resume() {
    close(false);
    canvas.focus({ preventScroll: true });
  }
  function options() {
    back = run?.mode === "playing" ? "pause" : null;
    open("options", heading("Settings") + '<div class="options-grid">' +
      '<fieldset><legend>Display</legend>' +
      '<div class="setting"><span>Screen mode</span><button class="small-button" id="screen-mode"></button></div>' +
      '<p class="screen-feedback" id="screen-feedback" role="status" hidden>Fullscreen is unavailable in this browser. The game fills the available window.</p>' +
      '<label class="setting">Reduced motion <input id="motion-setting" type="checkbox"></label>' +
      '<label class="setting">Graphics quality <select id="quality"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low · 30 FPS</option></select></label>' +
      '<label class="setting">Damage numbers <input id="damage-setting" type="checkbox"></label>' +
      '<label class="setting">Camera shake <input id="shake-setting" type="checkbox"></label>' +
      '<label class="setting">Mouse aim arrow <input id="aim-setting" type="checkbox"></label>' +
      '<label class="setting">Control hints <input id="hints-setting" type="checkbox"></label>' +
      '<label class="setting">UI scale <select id="ui-scale">'+[90,100,110,120].map(value=>'<option value="'+value+'">'+value+'%</option>').join("")+'</select></label>' +
      '<label class="setting">HUD opacity <span class="volume-range"><input id="hud-opacity" type="range" min="50" max="100" step="1"><output id="hud-opacity-value"></output></span></label></fieldset>' +
      '<fieldset><legend>Audio</legend>' +
      '<label class="setting">Mute audio <input id="mute-setting" type="checkbox"></label>' +
      ["volume","music","sfx"].map(key=>'<label class="setting">'+({volume:"Master",music:"Music",sfx:"Sound effects"})[key]+
        ' <span class="volume-range"><input id="'+key+'-setting" type="range" min="0" max="100" step="1"><output id="'+key+'-value"></output></span></label>').join("")+'</fieldset>' +
      '<fieldset><legend>Controls</legend><dl class="controls-list">' +
      '<div><dt>Move</dt><dd>WASD / Arrows</dd></div><div><dt>Aim</dt><dd>Mouse</dd></div>' +
      '<div><dt>Strike</dt><dd>J / Left click</dd></div><div><dt>Heavy</dt><dd>K / Right click</dd></div>' +
      '<div><dt>Dash</dt><dd>Space</dd></div><div><dt>Parry</dt><dd>Q</dd></div><div><dt>Active skill</dt><dd>E</dd></div>' +
      '<div><dt>Pause</dt><dd>Esc / P</dd></div><div><dt>Interact</dt><dd>F</dd></div><div><dt>Inventory</dt><dd>I</dd></div><div><dt>Use potion</dt><dd>R</dd></div></dl></fieldset></div>' +
      actions(button("options-back", "Done", true)), "#screen-mode", true);
    for (const [id,key] of [["mute","muted"],["motion","reduced"],["aim","aimGuide"],["damage","damageNumbers"],["shake","shake"],["hints","hints"]]) {
      const control = get(id+"-setting");
      control.checked = settings[key];
      control.onchange = ()=>{settings[key]=control.checked;unlock();persist();};
    }
    const uiScale=get("ui-scale"), opacity=get("hud-opacity"), opacityValue=get("hud-opacity-value");
    const quality=get("quality");
    quality.value=settings.quality;
    quality.onchange=()=>{settings.quality=quality.value;drawnAt=-Infinity;persist();};
    uiScale.value=settings.uiScale;
    opacity.value=settings.hudOpacity;
    opacityValue.value=opacity.value+"%";
    uiScale.onchange=()=>{settings.uiScale=Number(uiScale.value);persist();};
    opacity.oninput=()=>{settings.hudOpacity=Number(opacity.value);opacityValue.value=opacity.value+"%";persist();};
    for (const key of ["volume","music","sfx"]) {
      const control=get(key+"-setting"), out=get(key+"-value");
      control.value=Math.round(settings[key]*100);
      out.value=control.value+"%";
      control.oninput=()=>{settings[key]=Number(control.value)/100;out.value=control.value+"%";unlock();persist();};
    }
    syncFullscreen();
    bind("screen-mode", toggleFullscreen);
    bind("options-back", optionsBack);
  }
  function optionsBack() {
    if (back === "pause") pause();
    else close();
  }
  function choose(selected=null) {
    const currentRun=run;
    const offer=run.offer;
    if(!offer) return;
    const active=ACTIVES[run.build.active];
    const destination=run.paths?"the fork ahead":run.nextRoom?.name;
    const recovery=run.rules.heal?" Claiming any card also restores up to "+run.rules.heal+" HP and refills Stamina.":" Claiming any card refills Stamina.";
    const tips=offer.context==="intro"?"Pick an active skill before entering the first arena.":offer.context==="treasure"?
      "Take one find from the cache. Equipment goes to your Inventory.":"Choose one reward, then prepare for "+destination+"."+recovery;
    const cards=offer.cards.map(card=>{
      const rarity=FrostItems.TIERS[card.tier];
      const action=card.type==="Active"?(active?"Replaces "+active.name+" if confirmed":"Equips in your empty skill slot"):
        card.next?"Rank "+(card.rank??0)+" → "+card.next:card.id.startsWith("item:")?
          (card.rank?"Rank "+card.rank+" · ":"")+"Adds to Inventory · No auto-equip":"";
      const effects=card.key&&card.type==="Passive"&&card.rank>0
        ?'<span class="reward-current">Current: '+escape(PASSIVES[card.key].text(PASSIVES[card.key].ranks[card.rank-1]))+'</span>':"";
      const unavailable=card.id==="upgrade"&&!run.inventory.canUpgrade(card.key)||card.id==="potion"&&!run.inventory.canObtain("flask");
      return '<button class="reward-card rarity-'+rarity.toLowerCase()+'" data-reward="'+escape(card.id)+'" aria-pressed="'+(selected===card.id)+'"'+(unavailable?' disabled':'')+'>'+
        '<span class="reward-icon" aria-hidden="true">'+card.icon+'</span><span class="reward-type">'+rarity+' · '+card.type+'</span>'+
        '<strong>'+escape(card.name)+'</strong><span class="reward-description">'+escape(card.description)+'</span>'+effects+
        (card.type==="Active"?'<span class="reward-cost">'+card.cost+' Stamina · '+card.cooldown+'s cooldown</span>':'')+
        (action?'<span class="reward-action">'+escape(action)+'</span>':'')+
        (unavailable?'<span class="reward-action">Unavailable with current Inventory.</span>':'')+'</button>';
    }).join("");
    const pick=offer.cards.find(card=>card.id===selected);
    const status=offer.context==="intro"?"Boss Rush preparation":offer.context==="treasure"?"Hidden treasure":"Room cleared";
    open("choose",'<div class="story-marker">'+status+'</div>'+heading("Choose your reward")+
      '<p>'+escape(tips)+'</p><div class="reward-grid">'+cards+'</div>'+
      (pick?.type==="Active"&&active?'<div class="reward-existing"><strong>Current · '+escape(active.name)+'</strong><p>'+escape(active.text)+
        ' '+active.cost+' Stamina · '+active.cooldown+'s cooldown. Choose a different reward to keep it.</p></div>':'')+
      '<div class="reward-footer">'+actions(button("reward-inventory","Inventory"),pick?button("reward-confirm",pick.type==="Active"&&active?"Replace active skill":"Claim reward",true):"")+'</div>',
      pick?"[aria-pressed=true]":".reward-card",true);
    for(const card of panel.querySelectorAll("[data-reward]")) {
      card.onclick=()=>{if(card.isConnected&&run===currentRun&&run.offer===offer) choose(card.dataset.reward);};
    }
    bind("reward-inventory",()=>screens.inventory(()=>choose(selected)));
    if(pick) bind("reward-confirm",()=>{
      if(run!==currentRun||run.offer!==offer) return;
      if(!run.select(pick.id,pick.type==="Active"&&Boolean(active))) {choose();return;}
      playSound({kind:"reward"});
      if(offer.context==="intro") showRoom();
      else { resume(); notify(pick.name+" acquired"); }
      updateHUD();
    });
  }
  function showRoom() {
    const room = run.room;
    const lines = room.enemies.includes("king") ? '<div class="conversation">'+TEXT.king.map(([speaker,line])=>'<p><strong>'+speaker+'</strong><span>'+line+'</span></p>').join("")+'</div>' : "";
    const mutation=FrostMutations.definitions[run.eliteMutation];
    const hazard=FrostEnvironment.HAZARDS[room.hazard];
    open("story", '<div class="story-marker">' + MODES[run.kind].name + ' · Stage ' + room.stage + ' · ' + room.type + '</div>' + heading(room.name) +
      (room.region && room.region!==room.name?'<p class="room-region">'+escape(room.region)+'</p>':'')+
      '<p class="story-text">' + room.story + '</p><div class="story-objective">' + room.objective + '</div>' +
      (hazard?'<p class="room-region">'+escape(hazard.name)+' · '+escape(hazard.note)+'</p>':'')+
      (mutation?'<p class="story-marker">'+mutation.icon+' '+mutation.name+' Elite · '+mutation.detail+'</p>':'')+
      lines + actions(button("enter-room", run.safe ? "Explore" : "Begin encounter", true),button("room-inventory","Inventory")), "#enter-room");
    bind("enter-room", ()=>{run.prepareEncounter();resume();updateHUD();});
    bind("room-inventory",()=>screens.inventory(showRoom));
  }
  function showPaths() {
    const current=run;
    const cards=Object.entries(run.paths??{}).map(([id,room])=>{
      const path=FrostRegions.PATHS[id];
      const hazard=FrostEnvironment.HAZARDS[room.hazard]?.name??"None known";
      return '<button class="reward-card path-card path-'+id+'" data-path="'+id+'"><span class="reward-type">Danger · '+path.difficulty+
        '</span><strong>'+path.name+'</strong><span class="reward-description">'+path.description+'</span><dl><div><dt>Room</dt><dd>'+room.type+
        '</dd></div><div><dt>Hazard</dt><dd>'+hazard+'</dd></div><div><dt>Reward</dt><dd>'+path.reward+'</dd></div></dl></button>';
    }).join("");
    open("paths",heading("Choose your route")+'<p>Both paths lead onward through '+escape(run.room.region)+'.</p><div class="route-grid">'+cards+
      '</div>'+actions(button("path-inventory","Inventory")),".path-card",true);
    bind("path-inventory",()=>screens.inventory(showPaths));
    for(const control of panel.querySelectorAll("[data-path]")) control.onclick=()=>{
      if(!control.isConnected||run!==current||modal!=="paths"||!run.choosePath(control.dataset.path)) return;
      handleEvents();
      updateHUD();
    };
  }
  function notify(message) {
    const toast=get("toast");
    toast.textContent=message;
    toast.hidden=false;
    toastUntil=performance.now()+2800;
  }
  function openInventory() {
    if(!run || modal) return;
    const access=run.equipmentAccess;
    if(!access.allowed) { notify(access.reason); return; }
    screens.inventory(resume);
  }
  function showRandomEvent() {
    const current=run, room=run.room, event=FrostEvents.EVENTS[room.eventId];
    const cards=event.choices.map(option=>{
      const reason=FrostEvents.reason(run,option);
      return '<button class="reward-card" data-event-choice="'+option.id+'"'+(reason?' disabled':'')+'><strong>'+
        escape(option.label)+'</strong><span class="reward-description">'+escape(option.detail)+'</span>'+
        (reason?'<span class="reward-type">'+escape(reason)+'</span>':'')+'</button>';
    }).join("");
    open("event",heading(event.name)+'<p>'+escape(event.text)+'</p><p>'+Math.ceil(run.player.hp)+' HP · '+
      run.inventory.crowns+' Frost Crowns</p><div class="reward-grid">'+cards+'</div>'+
      actions(button("event-back","Back")),"[data-event-choice]:not(:disabled)");
    bind("event-back",resume);
    for(const control of panel.querySelectorAll("[data-event-choice]")) control.onclick=()=>{
      if(!control.isConnected||run!==current||run.room!==room||modal!=="event") return;
      const result=run.eventChoice(control.dataset.eventChoice);
      if(result?.error) {showRandomEvent();notify(result.error);return;}
      if(!result) return;
      if(result.foes) {
        const mutation=FrostMutations.definitions[run.eliteMutation];
        resume();subtitle(result.text+(mutation?' '+mutation.name+' Elite. '+mutation.detail:''),4);updateHUD();return;
      }
      open("event-result",heading(event.name)+'<p>'+escape(result.text)+'</p>'+
        actions(button("event-continue","Continue",true)),"#event-continue");
      bind("event-continue",resume);
      updateHUD();
    };
  }
  function interact() {
    const type = run?.target;
    if (!type || modal) return;
    if (type === "merchant") { if(run.canTrade) screens.dialogue(); else notify(run.equipmentAccess.reason); return; }
    if (type === "event") { if(run.equipmentAccess.allowed) showRandomEvent(); else notify(run.equipmentAccess.reason); return; }
    if (type === "bell") { if(run.silenceBell()) {notify("Frozen bell silenced.");updateHUD();} return; }
    if (type === "passage") { run.enterSide(); handleEvents(); updateHUD(); return; }
    run.discover(type);
    if(type==="treasure") handleEvents();
    if (type === "lore") {
      open("lore",heading("The King’s Oath")+'<p>'+run.room.lore+'</p>'+actions(button("lore-back","Continue",true)),"#lore-back");
      bind("lore-back",resume);
    }
    updateHUD();
  }
  function subtitle(text, duration = 3) {
    const box = get("subtitle");
    box.textContent = text;
    box.hidden = false;
    subtitleUntil = run.time + duration;
  }
  function timeLabel(time, precise = false) {
    const seconds = Math.floor(time);
    const base = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
    return precise ? base + "." + String(Math.floor(time * 100) % 100).padStart(2,"0") : base;
  }
  function results() {
    const r = run.result;
    provider.record(r);
    if (r.score > settings.best) { settings.best = r.score; persist(); }
    const entries = [["Total time", timeLabel(r.time)], ["Foes slain", r.kills], ["Damage taken",r.damage],
      ["Perfect parries",r.parries], ["Healing items",r.healing], ["Potions used",r.potions]];
    if (r.kind==="hardcore") entries.push(["Farthest stage",r.progress.stage],["Farthest wave",r.progress.wave],["Time to progress",timeLabel(r.progress.time)]);
    else entries.push([r.kind==="boss"?"Bosses defeated":"Encounters cleared",r.cleared]);
    if (r.bossTime) entries.push([r.kind==="boss"?"Last boss time":"Boss defeat time",timeLabel(r.bossTime)]);
    const stats = entries.map(([label, value]) => "<div><dt>" + label + "</dt><dd>" + value + "</dd></div>").join("");
    const learned = Object.keys(run.build.ranks).map(id=>PASSIVES[id].name);
    const resultText = r.won ? r.kind === "boss" ? "The Gatekeeper, Crystal Warden, and Frozen King all fell. " + TEXT.ending : TEXT.ending
      : 'The winter claims another wanderer. Final blow · ' + escape(r.cause);
    open("results", '<div class="story-marker">'+MODES[r.kind].name+'</div>'+heading(r.won ? "THE WINTER ENDS" : "YOU HAVE FALLEN")
      + '<p>' + resultText + '</p>'
      + '<div class="result-summary"><span class="rank" aria-label="Rank ' + r.rank + '">' + r.rank + '</span><div><span class="score">'
      + r.score.toLocaleString("en-US") + '</span><span>Run score</span></div></div><dl class="result-stats">' + stats + '</dl>'
      + (learned.length ? '<p style="margin:12px 0 0">Passives · ' + learned.join(" · ") + '</p>' : '')
      + actions(button("retry", "Retry", true), button("result-home", "Title screen")), "#retry");
    bind("retry", () => { if(r.kind==="boss") { home(); screens.modeIntro("boss"); } else start(r.kind,runPreset); });
    bind("result-home", home);
    run.releaseResources();
  }
  function handleEvents() {
    for (const e of run.events.splice(0)) {
      if(debugEnabled&&["wave","paths","clear","gate","phase","reinforcements","victory","defeat","death"].includes(e.kind))
        diagnostics.note(e.kind,{room:run.room.id??run.room.name,wave:run.runWave,phase:e.phase});
      playSound(e);
      const category=e.kind==="perfect"?"perfect":e.kind==="dodge"?"dodge":e.kind==="stagger"?"posture":
        e.kind==="combat-notice"||e.kind==="hit"?e.category:null;
      const message=FrostFeedback.messages[category];
      if(message&&settings.hints&&(!combatNotice||run.time>=combatNotice.until||message.priority>=combatNotice.priority)) {
        combatNotice={...message,until:run.time+message.seconds};
        get("combat-notice").textContent=message.title;
        get("combat-notice").hidden=false;
      }
      if (e.kind === "wave") {
        combatNotice=null;
        get("combat-notice").hidden=true;
        setBanner("", 0);
        if(run.offer?.context!=="intro") showRoom();
      }
      if (e.kind === "gate") {
        tone(160, 82, .5, .12, "triangle");
        get("live").textContent = "North gate open. Walk to the top of the room.";
      }
      if (e.kind === "phase") {
        setBanner(e.phase === 2 ? "Phase II" : "Phase III",1.2);
        if(e.boss==="king") subtitle("Frozen King · "+TEXT.phases[e.phase-1]);
      }
      if (e.kind === "reinforcements") setBanner("Wave "+e.wave,1.6);
      if (e.kind === "clear") choose();
      if (e.kind === "paths" && modal!=="paths") showPaths();
      if (e.kind === "cache-note") subtitle(e.text,5);
      if(e.kind==="environment"&&e.id==="whiteout") subtitle("Whiteout approaching",2);
      if(e.kind==="environment"&&e.id==="bell") subtitle("Frozen Bell · Royal guards move faster",3);
      if(e.kind==="environment"&&e.id==="ice") subtitle("Ice cracking",1.2);
      if(e.kind==="enemy-defeat"&&e.type==="king") renderer.finishKing?.(e,performance.now());
      if (e.kind === "victory" || e.kind === "defeat") results();
    }
  }
  function updateHUD() {
    const p = run.player, boss = run.boss;
    const inv = run.inventory;
    if(combatNotice&&run.time>=combatNotice.until) {
      combatNotice=null;
      get("combat-notice").hidden=true;
    }
    const setText=(id,value)=>{const el=get(id);if(el.textContent!==value)el.textContent=value;};
    const setBar=(id,value)=>{const style=get(id).style;if(style.width!==value)style.width=value;};
    setBar("health",Math.round(p.hp/run.maxHp*100)+"%");
    setText("health-text",Math.ceil(p.hp)+" / "+run.maxHp);
    setBar("stamina",Math.round(p.stamina)+"%");
    setText("wave",run.training ? "Training" : "Stage " + run.room.stage + (run.safe ? " · Safe" : " · Wave "+run.runWave +"/"+run.waves));
    setText("weapon-name",inv.weapon.name);
    setText("weapon-icon",inv.weapon.icon);
    get("loadout-hud").hidden=run.training;
    setText("room-name",run.training ? "" : run.room.name);
    const hazard=FrostEnvironment.HAZARDS[run.room.hazard];
    get("region-hud").hidden=run.training||(!hazard&&run.room.region===run.room.name);
    setText("region-hud",[run.room.region,hazard&&(!run.gateOpen||run.room.hazard==="bell")?
      (run.room.hazard==="bell"&&run.bellSilenced?"Bell silenced":hazard.name):null].filter(Boolean).join(" · "));
    const remaining = run.remaining;
    setText("remaining",run.training ? "Practice sentinel" :
      run.gateOpen ? "Exit unlocked" : remaining + (remaining === 1 ? " foe" : " foes") + " · " + timeLabel(run.time));
    get("gate-guide").hidden = !run.gateOpen;
    const prompt = get("interact"), target = run.target;
    prompt.hidden = !target;
    if (target) setText("interact",({merchant:"Talk to Eldric",treasure:"Open chest",rest:"Rest at shrine",lore:"Read inscription",passage:"Enter hidden passage",event:"Inspect "+FrostEvents.EVENTS[run.room.eventId]?.name})[target] + (coarse.matches||!settings.hints?"":" [F]"));
    if(target==="passage"&&run.room.side?.type==="mini")
      setText("interact","Optional duel · "+run.room.side.name+(coarse.matches||!settings.hints?"":" [F]"));
    if(target==="passage"&&run.room.secretClue==="cracked"&&!run.wallBroken)
      setText("interact","Open cracked wall"+(coarse.matches||!settings.hints?"":" [F]"));
    if(target==="bell") setText("interact","Silence frozen bell"+(coarse.matches||!settings.hints?"":" [F]"));
    get("belt").hidden = run.training;
    get("crowns").hidden=run.training;
    setText("crowns","◈ "+inv.crowns);
    const safe=run.safe || run.encounterState==="CLEARED";
    const safeStatus=get("safe-status");
    safeStatus.hidden=!safe;
    if(safe) setText("safe-status",(run.safe?"Safe area":"Room cleared")+
      (run.equipmentAccess.allowed?" · Equipment changes available":""));
    get("inventory").hidden=!safe;
    const selected = ITEMS[inv.quickSlot];
    const drink = get("drink");
    drink.disabled = !inv.potion || p.action?.type==="potion";
    const hint=inv.potion ? selected.description : selected ? selected.name+" depleted. Reassign in a safe area." : "Quick slot empty. Assign a potion in Inventory.";
    if (drink.title!==hint) {
      drink.title=hint;
      drink.setAttribute("aria-label",inv.potion?"Drink "+selected.name:hint);
    }
    setText("potion-label",selected ? selected.icon+" ×"+inv.potionCount : "×0");
    const action = p.action;
    const skill=ACTIVES[run.build.active];
    const skillButton=get("skill");
    skillButton.hidden=!skill;
    skillButton.disabled=!skill||run.build.cooldown>0||p.stamina<skill.cost;
    if(skill) {
      skillButton.title=skill.name+" · "+skill.text;
      skillButton.setAttribute("aria-label",skill.name+(run.build.cooldown>0?" · Recharging":" · Active skill"));
      setText("skill-label",skill.icon+" "+(run.build.cooldown>0?Math.ceil(run.build.cooldown)+"s":"Ready"));
    }
    const timeLeft = action && ["dash","parry","potion"].includes(action.type) ? Math.max(0,action.duration-action.age) : 0;
    setText("cooldowns",timeLeft ? ({dash:"Dash",parry:"Parry",potion:"Potion"})[action.type]+" "+timeLeft.toFixed(1)+"s"
      : Object.keys(run.buffs).map(id=>(ITEMS[id]?.icon ?? "❄")+" "+Math.ceil(run.buffs[id])+"s").join(" "));
    if (subtitleUntil && run.time >= subtitleUntil) get("subtitle").hidden = true;
    get("boss-hud").hidden = !boss;
    if (boss) {
      setBar("boss-health",Math.round(boss.hp*100/boss.maxHp)+"%");
      setText("boss-name",boss.name);
      get("posture-line").hidden=!boss.posture && boss.state!=="stagger";
      setBar("boss-posture",boss.state==="stagger"?"100%":Math.round(boss.posture*100/boss.maxPosture)+"%");
      const phase=boss.mini?"Optional guardian":"Phase "+["I","II","III"][boss.phase-1];
      const tell=boss.state==="defend"?"Frostbound Reversal · Counter stance":boss.state==="stagger"?"Staggered":
        ["windup","active"].includes(boss.state)?boss.attack?.data.name:"";
      setText("phase",tell?phase+" · "+tell:phase);
    }
    const lesson = get("lesson");
    lesson.hidden = !run.training;
    if (run.training) {
      const [name, detail] = LESSONS[run.lesson] ?? ["Training complete", "Keep practicing or press Pause to return to the title screen."];
      get("lesson-title").textContent = name;
      get("lesson-body").textContent = detail;
      get("skip-lesson").hidden = run.lesson >= LESSONS.length;
    }
  }

  function mouseAim() {
    if (!pointer.active) return null;
    const player = run.player;
    const target = renderer.toWorld(pointer.x, pointer.y, player);
    if(!target) return null;
    return Math.hypot(player.x - target.x, player.y - target.y) < 3 ? player.dir : angle(player, target);
  }
  function gameInput() {
    const x = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) + joystick.x;
    const y = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) + joystick.y;
    const aim = mouseAim() ??
      (Math.hypot(x, y) > .08 ? Math.atan2(y, x) : null);
    const action = queued;
    queued = null;
    const aimPoint=pointer.active?renderer.toWorld(pointer.x,pointer.y,run.player):null;
    return { x, y, aim, aimPoint, action, assist: (coarse.matches || joystick.id !== null) && !pointer.active };
  }
  function loop(now) {
    diagnostics.begin(now);
    diagnostics.mark("audio");
    const frame = Math.min(.055,Math.max(0,(now-(lastFrame||now))/1000));
    lastFrame = now;
    soundtrack();
    if(toastUntil && performance.now()>=toastUntil) {get("toast").hidden=true;toastUntil=0;}
    if(run && (modal==="shop" && !run.canTrade || modal==="inventory" &&
      panel.dataset.readOnly!=="true" && !run.equipmentAccess.allowed)) {
      resume();
      if(run.result) handleEvents();
    }
    if((modal==="shop" || modal==="inventory" || modal==="dialogue") && now>=previewAt) {
      diagnostics.mark("menu-preview");
      previewAt=settings.reduced?Infinity:now+42;
      const portrait=panel.querySelector("[data-eldric]");
      if(portrait) FrostPortrait(portrait,now/1000,settings.reduced);
      const preview=panel.querySelector("[data-gear-preview]");
      if(preview) {
        const item=ITEMS[preview.dataset.gearPreview];
        const gear=run.inventory;
        FrostEquipmentPreview(preview,{weapon:item.slot==="weapon"?item:gear.weapon,armor:item.slot==="armor"?item:gear.armor},now/1000,settings.reduced);
      }
      const loadout=panel.querySelector("[data-loadout-preview]");
      if(loadout && !paintedLoadouts.has(loadout)) {
        FrostEquipmentPreview(loadout,run.inventory,now/1000,true);
        paintedLoadouts.add(loadout);
      }
    }
    if (run) {
      if (!modal && (run.mode === "playing" || run.mode === "dying")) {
        diagnostics.mark("simulation");
        accumulator += frame;
        for(let steps=0;steps<8&&accumulator>=STEP&&(run.mode==="playing"||run.mode==="dying");steps++) {
          const room=run.room, queuedEvents=run.events.length;
          run.tick(gameInput());
          accumulator -= STEP;
          if(run.room!==room||run.events.length>queuedEvents&&run.events.at(-1).kind==="paths") {
            accumulator=0;
            break;
          }
        }
        diagnostics.mark("scene-events");
        handleEvents();
        if (sinceBanner > 0 && (sinceBanner -= frame) <= 0) get("announcement").textContent = "";
        if(now >= hudAt || modal || run.mode !== "playing") {
          diagnostics.mark("hud");
          updateHUD();
          hudAt = now + 75;
        }
      } else accumulator = 0;
      if(settings.quality!=="low"||now-drawnAt>=31) {
        diagnostics.mark("render");
        renderer.draw(run,settings,modal || !settings.aimGuide || run.mode!=="playing" ? null : mouseAim(),now);
        drawnAt=now;
      }
    }
    if(debugEnabled) {
      trackState();
      if(!debugPanel.hidden&&now>=debugAt) {writeDebug();debugAt=now+250;}
    }
  }
  function writeDebug() {
    const {history,...current}=debugSnapshot();
    debugPanel.textContent=JSON.stringify({...current,recent:history.slice(-6)},null,2);
  }
  const actionKeys = { KeyJ:"light", KeyK:"heavy", Space:"dash", KeyE:"skill", KeyQ:"parry", KeyR:"potion" };
  const movement = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);
  window.addEventListener("keydown", e => {
    if(debugEnabled&&e.code==="F8"&&!e.repeat) {
      e.preventDefault();
      debugPanel.hidden=!debugPanel.hidden;
      if(!debugPanel.hidden) writeDebug();
      return;
    }
    if (!intro.hidden) {
      if (e.code === "Escape" || e.code === "Tab") e.preventDefault();
      if (e.code === "Escape" && !e.repeat) finishIntro();
      return;
    }
    if (modal && e.code === "Tab") {
      const focusable = [...panel.querySelectorAll("button:not(:disabled),input,select")].filter(el=>el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault(); last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first?.focus();
      }
      return;
    }
    if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) {
      if (modal === "options") { e.preventDefault(); optionsBack(); }
      else if (modal === "pause") { e.preventDefault(); resume(); }
      else if (modal && e.code==="Escape") {
        const cancel = panel.querySelector("#keep-playing, #enter-room, #lore-back, #event-back, #event-continue, [data-ui=back]");
        if(cancel) { e.preventDefault(); cancel.click(); }
      }
      else if (run && !modal) { e.preventDefault(); pause(); }
      return;
    }
    if (!e.repeat && e.code==="KeyI" && modal==="story") {
      e.preventDefault();
      get("room-inventory").click();
      return;
    }
    if (!run || modal || run.mode !== "playing") return;
    if (!e.repeat && e.code==="KeyF") { e.preventDefault(); interact(); return; }
    if (!e.repeat && e.code==="KeyI" && !run.training) { e.preventDefault(); openInventory(); return; }
    if (e.code === "Space" && document.activeElement instanceof HTMLButtonElement) return;
    if (movement.has(e.code)) {
      e.preventDefault();
      keys.add(e.code);
    }
    if (actionKeys[e.code]) {
      e.preventDefault();
      if (!e.repeat) { unlock(); queued = actionKeys[e.code]; }
    }
  });
  window.addEventListener("keyup", e => keys.delete(e.code));
  field.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse" || !run || modal) return;
    Object.assign(pointer, { x: e.clientX, y: e.clientY, active: true });
  });
  field.addEventListener("pointerleave", e => {
    if (e.pointerType === "mouse") pointer.active = false;
  });
  canvas.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse" || !run || modal || (e.button !== 0 && e.button !== 2)) return;
    e.preventDefault();
    unlock();
    Object.assign(pointer, { x: e.clientX, y: e.clientY, active: true });
    queued = e.button === 2 ? "heavy" : "light";
  });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  function moveStick(e) {
    if (joystick.id !== e.pointerId) return;
    const rect = stick.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 31;
    const y = (e.clientY - rect.top - rect.height / 2) / 31;
    const length = Math.max(1, Math.hypot(x, y));
    joystick.x = x / length;
    joystick.y = y / length;
    knob.style.transform = "translate(" + joystick.x * 25 + "px," + joystick.y * 25 + "px)";
  }
  stick.addEventListener("pointerdown", e => {
    if (!run || modal || joystick.id !== null) return;
    e.preventDefault();
    unlock();
    pointer.active = false;
    joystick.id = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  stick.addEventListener("pointermove", moveStick);
  const releaseStick = e => {
    if (joystick.id !== e.pointerId) return;
    joystick.id = null;
    joystick.x = 0;
    joystick.y = 0;
    knob.style.transform = "";
  };
  for (const event of ["pointercancel", "pointerup", "lostpointercapture"]) stick.addEventListener(event, releaseStick);
  for (const control of field.querySelectorAll("[data-action]")) {
    control.addEventListener("pointerdown", e => {
      if (!run || modal || e.button !== 0) return;
      e.preventDefault();
      unlock();
      pointer.active = false;
      queued = control.dataset.action;
    });
    control.addEventListener("click", e => {
      if (e.detail === 0 && run && !modal) { unlock(); queued = control.dataset.action; }
    });
  }
  window.addEventListener("blur", () => {
    flushInput();
    if (run && !modal) pause();
  });
  document.addEventListener("visibilitychange", () => {
    if(!document.hidden) return;
    flushInput();
    if(run&&!modal) pause();
  });
  window.addEventListener("beforeunload", e=>{
    if(!run || failure || run.training || run.result) return;
    e.preventDefault();
    e.returnValue = "";
  });

  bind("start",()=>screens.modes());
  bind("modes",()=>screens.modes());
  bind("records",()=>screens.records());
  bind("credits",()=>screens.credits());
  bind("skip-intro", finishIntro);
  intro.addEventListener("animationend", e => {
    if (e.animationName === "shot-gate") finishIntro();
  });
  bind("training", () => launch("training"));
  bind("options", options);
  let titleFullscreenRequested=false;
  title.addEventListener("click",event=>{
    if(titleFullscreenRequested||!event.target.closest("button")) return;
    titleFullscreenRequested=true;
    enterFullscreen();
  },{capture:true});
  document.addEventListener("fullscreenchange", () => {
    syncFullscreen();
    if (!document.fullscreenElement && run && !modal) {flushInput();pause();}
  });
  bind("pause", pause);
  bind("interact",interact);
  bind("inventory",openInventory);
  bind("drink",()=>{if(run && !modal && run.mode==="playing") queued="potion";});
  bind("skill",()=>{if(run && !modal && run.mode==="playing") queued="skill";});
  bind("skip-lesson", () => run?.skipLesson());
  get("intro-description").textContent=TEXT.opening.join(" ");
  document.querySelectorAll(".intro-caption p").forEach((caption,i)=>{caption.textContent=TEXT.opening.slice(i*2,i*2+2).join(" ");});
  const gameScripts=new Set([...document.scripts].map(script=>script.src));
  window.addEventListener("error",event=>{
    if(event.error&&gameScripts.has(event.filename)) failGame(event.error,"ui");
  });
  if(debugEnabled) globalThis.FrostDebug={snapshot:debugSnapshot};
  persist();
  frameLoop.start();
})();
