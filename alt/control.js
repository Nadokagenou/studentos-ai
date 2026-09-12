/* ============================================================
   StudentOS Control Center — ตรรกะ
   ------------------------------------------------------------
   หน้าต่างเดียวที่เจ้าของระบบใช้เปลี่ยนพฤติกรรมแอปโดยไม่ต้องแตะโค้ด
   ค่าทั้งหมดอยู่ในตาราง app_config ช่อง 'live' · แอปอ่านผ่าน remote-config.js

   สองอย่างที่ยึดไว้ตลอดไฟล์:
   • "แก้" กับ "เผยแพร่" เป็นคนละก้าว — ลากสไลเดอร์ไม่ได้ทำให้แอปของเด็ก 127 คนเปลี่ยนทันที
     ต้องกดเผยแพร่อีกที · ก้าวเดียวจบคือที่ที่อุบัติเหตุเกิด
   • ช่องที่ยังไม่มีผลจริง ต้องเขียนไว้ตรง ๆ ว่ายังไม่มีผล
     ช่องที่แก้แล้วไม่เกิดอะไรขึ้น ทำให้เลิกเชื่อทั้งหน้า ไม่ใช่แค่ช่องนั้น
   ============================================================ */
(function () {
  'use strict';

  /* ---------- หน้านี้ต้องไม่ถูกทาสีด้วยธีมที่กำลังแก้ ----------
     remote-config.js ฉีด CSS ทับ :root ให้แอป ซึ่งถูกต้องสำหรับแอป
     แต่ถ้าเผลอตั้งสีพื้นเป็นสีเดียวกับสีตัวอักษร แล้วหน้าแอดมินก็พังตามไปด้วย
     จะไม่เหลือทางกลับ · โทเคนของหน้านี้จึงขึ้นต้น --c* และไม่แชร์กับแอป */
  window.sosApplyTheme = function () {};
  var ghost = document.getElementById('sos-remote-theme');
  if (ghost) ghost.remove();

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  var DEFAULTS = window.SOSCFG_DEFAULTS;   // แหล่งความจริงเดียวกับที่แอปใช้
  var sb = null, me = null;
  var draft = null;        // ก้อนที่กำลังแก้
  var published = null;    // ก้อนที่อยู่บนเซิร์ฟเวอร์ตอนนี้
  var meta = { version: 0, at: null };
  var dirty = false;

  /* ==================== ป้ายข้อความ ==================== */
  var BLOCK_META = {
    todayHead:  ['หัวจอ', 'วันที่ · ทักทาย · เวลาที่เหลือ'],
    todayStats: ['แถบตัวเลข', 'ค้าง · เสร็จ · ว่างอีกกี่ชั่วโมง'],
    askBar:     ['ถามน้องไซ', 'ช่องพิมพ์คำถาม'],
    nowCard:    ['การ์ด "ตอนนี้"', 'คำตอบว่าควรทำอะไร — และจอว่างเมื่อไม่มีงาน'],
    dayRail:    ['รางที่เหลือของวันนี้', 'งานถัดไป · ถึงกี่โมง'],
    hwNowBlock: ['เพื่อนกำลังทำอะไร', 'ว่างเองเมื่อไม่มีใครออนไลน์'],
    toolsLink:  ['ฟีเจอร์อื่น ๆ', 'บรรทัดเดียวปิดท้าย'],
  };
  // ชิ้นส่วนของการ์ด "ตอนนี้" · zone ต้องตรงกับ NOW_PARTS ใน app.js เป๊ะ
  // lock = ถอดไม่ได้ เพราะการ์ดใบนี้มีอยู่เพื่อตอบว่า "ทำอะไร" แล้ว "กดตรงไหน"
  var NOW_META = [
    ['top',      'head', 0, 'แถวบน',            'ไอคอน + ชื่อวิชา + ป้ายความด่วน'],
    ['title',    'head', 1, 'ชื่องาน',           'จุดโฟกัสของการ์ด'],
    ['route',    'head', 0, 'ช่วงเวลา',          'เริ่มกี่โมง → จบกี่โมง'],
    ['why',      'head', 0, 'เหตุผล + คะแนน',    'ทำไมถึงเป็นใบนี้'],
    ['progress', 'body', 0, 'แถบความคืบหน้า',    'ขึ้นเฉพาะตอนทำไปแล้วบางส่วน'],
    ['actions',  'body', 1, 'ปุ่มเริ่ม + เสร็จ + เลื่อน', 'สิ่งเดียวที่ต้องกด'],
    ['askDue',   'body', 0, 'ถามวันส่ง',         'ขึ้นเฉพาะงานที่ยังไม่รู้กำหนด'],
    ['whyGo',    'body', 0, 'ลิงก์ “ทำไมใบนี้”',  'ทางเข้าจอเทียบทางเลือก'],
  ];
  var NOW_ZONE_NAME = { head: 'หัวการ์ด', body: 'ตัวการ์ด' };

  var PRIO_META = [
    ['deadline', 'ความด่วนของกำหนดส่ง', 'เส้นโค้ง urgencyScore() — ยิ่งใกล้ยิ่งพุ่ง'],
    ['exam',     'น้ำหนักการสอบ',        'ทำให้เวลาของงานที่ต้องเตรียมล่วงหน้าเดินเร็วกว่าจริง · 0 = สอบถูกคิดเหมือนงานส่งธรรมดา'],
    ['score',    'คะแนนเก็บ',            'เสียหายแค่ไหนถ้าไม่ทำ'],
    ['hard',     'ความยาก',              'ในแอปนี้ความยาก = ดาวที่เจ้าตัวกดเอง · ตัวคูณนี้คือ "ให้เสียงของผู้ใช้ดังแค่ไหน"'],
    ['size',     'เวลาที่ต้องใช้',        'งานใหญ่ควรเริ่มก่อน'],
    ['overdue',  'เลยกำหนดแล้ว',         'ต้องอยู่เหนือสุดเสมอ ไม่งั้นงานที่พลาดไปแล้วจะหล่นหาย'],
  ];
  var FEAT_META = [
    ['ocr',    'OCR ถ่ายรูปใบงาน', 'ปิด = ถอดท่า "ถ่ายรูปใบงาน" ออกจากแผ่นเพิ่มงาน', 1],
    ['social', 'เพื่อน · ชั้นสังคม', 'ปิด = ซ่อนทั้งไทล์ "เพื่อนฉัน" และแท็บ "เพื่อน" บนแถบล่าง — แถบจะเหลือสี่ช่อง ปุ่ม + จึงไม่อยู่กึ่งกลางเป๊ะอีกต่อไป', 1],
    ['ttscan', 'สแกนตารางเรียน',    'ปิด = ซ่อนไทล์ "สแกนตารางเรียน"', 1],
    ['shop',   'ร้านโทเคน',         'ปิด = ซ่อนไทล์ "ร้านค้า"', 1],
    ['cloud',  'ซิงก์ขึ้นคลาวด์',    'ยังไม่ต่อสาย — ต้องกันที่จอบัญชีด้วย ไม่งั้นปิดแล้วล็อกอินค้าง', 0],
    ['wheel',  'กงล้อเสี่ยงดวง',     'ยังไม่ต่อสาย — ทางเข้าอยู่หลายที่ในระบบโทเคน', 0],
    ['line',   'บอท LINE ในกลุ่มห้อง', 'ยังไม่ต่อสาย — ฝั่งเซิร์ฟเวอร์ต้องเช็คด้วย', 0],
  ];
  var NOTI_META = [
    ['exam',    'เตือนก่อนสอบ',      'ล่วงหน้าตามจำนวนวันที่ตั้งไว้'],
    ['urgent',  'เตือนงานด่วน',      'เหลือน้อยกว่า 24 ชั่วโมง'],
    ['overdue', 'เตือนงานเลยกำหนด', 'วันละครั้ง'],
    ['daily',   'สรุปแผนตอนเช้า',    'วันนี้ควรทำอะไร'],
    ['streak',  'เตือนก่อนสตรีคขาด', ''],
  ];
  var TPL_META = [
    ['exam',    'ก่อนสอบ',      'สอบ {{subject}} อีก {{days}} วัน — เริ่มอ่านวันนี้ได้แล้ว'],
    ['urgent',  'งานด่วน',      '{{task}} ส่ง {{time}} — เหลือเวลาไม่มากแล้ว'],
    ['overdue', 'เลยกำหนด',     '{{task}} เลยกำหนดแล้ว ยังส่งได้อยู่ไหม'],
    ['daily',   'สรุปตอนเช้า',  'วันนี้ควรเริ่มที่ {{task}}'],
  ];
  var OCR_META = [
    ['autoRetry', 'ลองใหม่อัตโนมัติ',      'ยิงซ้ำเมื่อผู้ให้บริการล้ม (ไม่ใช่ตอนรูปเบลอ — รูปเบลอยิงซ้ำก็เบลอเท่าเดิม)'],
    ['autoFile',  'บันทึกเองเมื่อมั่นใจพอ', 'ปิดที่นี่ = ปิดทั้งระบบ · ผู้ใช้ยังปิดของตัวเองเพิ่มได้ ต้องเปิดทั้งสองฝั่งถึงจะบันทึกเอง'],
    ['keepImg',   'เก็บรูปต้นฉบับ',        'ยังไม่ต่อสาย'],
  ];
  var COLOR_META = [
    ['blue',  'สีเน้นหลัก', '#9E5B04'],
    ['good',  'สำเร็จ',     '#1C6B3B'],
    ['warn',  'ระวัง',      '#8A6206'],
    ['alert', 'อันตราย',    '#C42B1F'],
    ['scr',   'พื้นหลัง',    '#FCFBF7'],
    ['card',  'การ์ด',      '#FFFFFF'],
    ['ink',   'ตัวอักษร',   '#1F2430'],
  ];
  // เฉพาะข้อความที่ app.js เรียก sosText() ไว้จริงแล้วเท่านั้น
  var TEXT_META = [
    ['askPh',     'ช่องถามน้องไซ',    'ถามน้องไซ…'],
    ['railTitle', 'หัวรางของวันนี้',   'ที่เหลือของวันนี้'],
    ['toolsLink', 'บรรทัดปิดท้ายหน้าแรก', 'ฟีเจอร์อื่น ๆ'],
  ];
  var GAPS = [
    ['เพดานคำถามต่อคนต่อวัน', 'ask-sai ไม่ได้อ่านว่าใครเป็นคนถาม (แอปยิงด้วย anon key) และคนที่ยังไม่ล็อกอินก็นับไม่ได้ — ต้องมีตารางนับก่อน'],
    ['เลือกผู้ให้บริการ AI / OCR', 'ตัวเลือกผูกกับ secret ที่ตั้งไว้บนเซิร์ฟเวอร์ (ASK_PROVIDER · OCR_PROVIDER) เปลี่ยนจากหน้านี้แล้วกุญแจไม่ตามไปด้วย'],
    ['เตือนก่อนสตรีคขาด · สรุปแผนตอนเช้า', 'ยังไม่มีตัวส่งสองแบบนี้ใน send-reminders'],
    ['ผลการทดลอง A/B', 'แบ่งกลุ่มได้ แต่ไม่มีตารางเก็บ event จึงวัดไม่ได้ว่ากลุ่มไหนดีกว่า'],
    ['บล็อกหน้าแรกที่ยังไม่มี', 'ปฏิทิน · ความคืบหน้า · จับเวลา ยังไม่ได้เขียนในแอป จึงไม่มีให้เปิด'],
    ['ฟีเจอร์ cloud · wheel · line', 'ทางเข้ากระจายหลายที่ และต้องกันฝั่งเซิร์ฟเวอร์ด้วย'],
  ];

  /* ==================== ทางเข้า ==================== */
  function gateMsg(t, cls) {
    var el = $('#gateMsg');
    el.textContent = t || '';
    el.className = 'gate-msg' + (cls ? ' ' + cls : '');
  }

  function showGate(mode, sub) {
    $('#gate').hidden = false;
    $('#shell').hidden = true;
    $('#savebar').hidden = true;
    $('#gateSub').textContent = sub || '';
    $('#gateForm').hidden = mode !== 'login';
    $('#gateDenied').hidden = mode !== 'denied';
  }

  async function boot() {
    var c = window.SUPABASE_CONFIG || {};
    if (!c.url || !c.anonKey || typeof supabase === 'undefined') {
      showGate('none', 'ยังไม่ได้ตั้งค่า Supabase ใน config.js — Control Center ทำงานไม่ได้');
      return;
    }
    sb = supabase.createClient(c.url, c.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
              storage: window.localStorage },
    });

    var session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) {}
    if (!session) { showGate('login', 'ล็อกอินด้วยบัญชีที่มีสิทธิ์แอดมิน'); return; }
    me = session.user;

    // เช็คสิทธิ์กับเซิร์ฟเวอร์ ไม่ใช่เช็คในเครื่อง — และถึงจะปลอมผ่านหน้านี้ได้
    // RLS ก็ปฏิเสธการเขียนอยู่ดี หน้านี้แค่ทำให้ "เขียนไม่ได้" ไม่กลายเป็นความประหลาดใจ
    var isAdmin = false;
    try {
      var r = await sb.from('app_admins').select('user_id').eq('user_id', me.id).maybeSingle();
      isAdmin = !!(r.data && r.data.user_id);
    } catch (e) {}

    if (!isAdmin) {
      showGate('denied', esc(me.email || '') + ' ล็อกอินแล้ว แต่ยังไม่มีสิทธิ์');
      $('#gateSql').textContent =
        "insert into public.app_admins (user_id, note)\nvalues ('" + me.id + "', 'เจ้าของระบบ');";
      return;
    }

    $('#gate').hidden = true;
    $('#shell').hidden = false;
    $('#savebar').hidden = false;
    $('#brandSub').textContent = me.email || 'แอดมิน';
    await loadConfig();
    renderAll();
    // เสียบแอปจริงเข้าจอที่เปิดอยู่ (Home Builder) แล้วปล่อยให้มันบูตขนานไปกับ
    // การโหลดประวัติ/สถิติ — ไม่มีอะไรในสองอันนั้นที่พรีวิวต้องรอ
    pvMoveTo('home');
    pvTag();
    loadVersions();
    loadStats();
  }

  /* ---------- ล็อกอิน ---------- */
  var otpSent = false;
  $('#gateSend').onclick = async function () {
    var email = $('#gateEmail').value.trim();
    if (!email) { gateMsg('ใส่อีเมลก่อน', 'bad'); return; }
    this.disabled = true;
    try {
      if (!otpSent) {
        var r = await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false } });
        if (r.error) throw r.error;
        otpSent = true;
        $('#gateOtpWrap').hidden = false;
        $('#gateSend').textContent = 'ยืนยันรหัส';
        gateMsg('ส่งรหัสไปที่อีเมลแล้ว', 'ok');
      } else {
        var code = $('#gateOtp').value.trim();
        var v = await sb.auth.verifyOtp({ email: email, token: code, type: 'email' });
        if (v.error) throw v.error;
        location.reload();
      }
    } catch (e) {
      gateMsg(e.message || 'ล็อกอินไม่สำเร็จ', 'bad');
    }
    this.disabled = false;
  };
  $('#gateGoogle').onclick = function () {
    sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } })
      .catch(function (e) { gateMsg(e.message || 'เปิด Google ไม่สำเร็จ', 'bad'); });
  };
  function signOut() { sb.auth.signOut().then(function () { location.reload(); }); }
  $('#gateOut').onclick = signOut;
  $('#btnOut').onclick = signOut;

  /* ==================== ค่าตั้ง ==================== */
  function merge(base, over) {
    if (over === null || over === undefined) return base;
    if (Array.isArray(base) || Array.isArray(over)) return over;
    if (typeof base !== 'object' || typeof over !== 'object') return over;
    var out = {}, k;
    for (k in base) out[k] = base[k];
    for (k in over) out[k] = (k in base) ? merge(base[k], over[k]) : over[k];
    return out;
  }

  async function loadConfig() {
    var stored = {};
    try {
      var r = await sb.from('app_config').select('data,version,updated_at')
        .eq('channel', 'live').maybeSingle();
      if (r.data) {
        stored = r.data.data || {};
        meta.version = r.data.version;
        meta.at = r.data.updated_at;
      }
    } catch (e) { msg('อ่านค่าตั้งจากเซิร์ฟเวอร์ไม่สำเร็จ: ' + (e.message || e), 'bad'); }
    published = merge(clone(DEFAULTS), stored);
    draft = clone(published);
    syncLive();
    dirty = false;
    updateBar();
  }

  // ให้ prioWeight() ของ remote-config อ่านค่าที่กำลังแก้อยู่ เพื่อให้ตัวอย่างลำดับงาน
  // คิดด้วยเอนจินตัวจริงโดยไม่ต้องเขียนสูตรซ้ำ (สูตรที่เขียนซ้ำคือสูตรที่จะเพี้ยนวันหนึ่ง)
  function syncLive() { window.SOSCFG = clone(draft); }

  function touch(what) {
    dirty = true;
    syncLive();
    msg('แก้' + (what ? ' ' + what : '') + 'แล้ว — ยังไม่ได้เผยแพร่');
    updateBar();
    dash();
    pvPush();
    pvTag();
  }
  function msg(t, cls) {
    var el = $('#saveMsg');
    el.textContent = t;
    el.className = 'msg' + (cls ? ' ' + cls : '');
  }
  function updateBar() {
    $('#btnPublish').disabled = !dirty;
    $('#btnRevert').disabled = !dirty;
  }

  async function publish() {
    var btn = $('#btnPublish');
    btn.disabled = true;
    msg('กำลังเผยแพร่…');
    try {
      var body = clone(draft);
      var r = await sb.from('app_config')
        .upsert({ channel: 'live', data: body }, { onConflict: 'channel' })
        .select('version,updated_at').maybeSingle();
      if (r.error) throw r.error;
      if (r.data) { meta.version = r.data.version; meta.at = r.data.updated_at; }
      published = clone(draft);
      dirty = false;
      updateBar();
      pvTag();
      msg('เผยแพร่แล้ว · เครื่องผู้ใช้จะได้ค่าใหม่ตอนเปิดแอปครั้งถัดไป', 'ok');
      dash();
      loadVersions();
    } catch (e) {
      msg('เผยแพร่ไม่สำเร็จ: ' + (e.message || e), 'bad');
      btn.disabled = false;
    }
  }
  $('#btnPublish').onclick = publish;
  $('#btnRevert').onclick = function () {
    if (!confirm('ทิ้งสิ่งที่แก้ไว้ กลับไปเป็นค่าที่เผยแพร่อยู่ตอนนี้?')) return;
    draft = clone(published);
    syncLive();
    dirty = false;
    renderAll();
    updateBar();
    pvMoveTo(($('.nav.on') || {}).dataset ? $('.nav.on').dataset.go : 'home');
    pvTag();
    msg('กลับไปเป็นค่าที่เผยแพร่อยู่');
  };
  $('#btnExport').onclick = function () {
    var blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'studentos-config-v' + meta.version + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };
  $('#btnDark').onclick = function () {
    var d = document.documentElement;
    var on = d.getAttribute('data-cc') === 'dark';
    d.setAttribute('data-cc', on ? 'light' : 'dark');
    this.textContent = on ? 'โหมดมืด' : 'โหมดสว่าง';
  };

  /* ==================== ประวัติ ==================== */
  async function loadVersions() {
    var el = $('#verList');
    try {
      var r = await sb.from('app_config_versions')
        .select('id,version,label,created_at,data')
        .eq('channel', 'live').order('version', { ascending: false }).limit(15);
      if (r.error) throw r.error;
      var rows = r.data || [];
      if (!rows.length) { el.innerHTML = '<p class="hint">ยังไม่เคยเผยแพร่</p>'; return; }
      el.innerHTML = '';
      rows.forEach(function (v) {
        var d = document.createElement('div');
        d.className = 'ver';
        var when = new Date(v.created_at);
        d.innerHTML = '<span class="n">v' + v.version + '</span>'
          + '<div class="tx"><b>' + esc(v.label || 'ไม่ได้ตั้งชื่อ') + '</b>'
          + '<small>' + esc(when.toLocaleString('th-TH')) + '</small></div>';
        var b = document.createElement('button');
        b.className = 'btn sm';
        b.textContent = v.version === meta.version ? 'ใช้อยู่' : 'ย้อนมาที่นี่';
        b.disabled = v.version === meta.version;
        b.onclick = function () {
          if (!confirm('ดึงค่าตั้งของ v' + v.version + ' มาแก้?\n(ยังไม่เผยแพร่จนกว่าจะกดเผยแพร่อีกที)')) return;
          draft = merge(clone(DEFAULTS), v.data || {});
          syncLive();
          dirty = true;
          renderAll();
          updateBar();
          msg('ดึง v' + v.version + ' มาแล้ว — กดเผยแพร่เพื่อให้มีผลจริง');
        };
        d.appendChild(b);
        el.appendChild(d);
      });
    } catch (e) {
      el.innerHTML = '<p class="hint">อ่านประวัติไม่ได้: ' + esc(e.message || e) + '</p>';
    }
  }

  /* ==================== Analytics ==================== */
  var STAT_META = [
    ['users', 'ผู้ใช้ที่มีข้อมูลบนคลาวด์', 'แถวใน user_state'],
    ['push', 'เครื่องที่เปิดแจ้งเตือน', 'push_subscriptions'],
    ['profiles', 'โปรไฟล์สาธารณะ', 'profiles'],
    ['hw_rooms', 'ห้องการบ้าน', 'hw_rooms'],
    ['posts', 'โพสต์', 'posts'],
    ['inbox', 'ของที่ไหลเข้ากล่องเข้า', 'inbox_items'],
    ['versions', 'ครั้งที่เผยแพร่ค่าตั้ง', 'app_config_versions'],
  ];
  async function loadStats() {
    var el = $('#anaTiles');
    try {
      var r = await sb.rpc('admin_stats');
      if (r.error) throw r.error;
      if (!r.data) throw new Error('ฟังก์ชันคืนค่าว่าง (ไม่ใช่แอดมิน?)');
      el.innerHTML = STAT_META.map(function (s) {
        var v = r.data[s[0]];
        return '<div class="stat"><div class="k">' + esc(s[1]) + '</div>'
          + '<div class="v">' + (v == null ? '—' : Number(v).toLocaleString('th-TH')) + '</div>'
          + '<div class="s mono">' + esc(s[2]) + '</div></div>';
      }).join('');
      $('#anaWhy').innerHTML =
        'ตัวเลขข้างบนนับจากฐานข้อมูลจริงผ่านฟังก์ชัน <code>admin_stats()</code> '
        + 'ซึ่งคืนเฉพาะ "ยอดรวม" — ไม่มีแถวของผู้ใช้คนไหนหลุดออกมาสักแถว เพราะ RLS '
        + 'ของทุกตารางเป็น "อ่านได้เฉพาะของตัวเอง" และนั่นถูกแล้ว<br><br>'
        + 'สิ่งที่ยังตอบไม่ได้คือ <b>พฤติกรรม</b> — ทำงานเสร็จกี่ชิ้น · ใช้ OCR กี่ครั้ง · '
        + 'ฟีเจอร์ไหนถูกเปิดบ่อยสุด · ทั้งหมดนี้ต้องมีตารางเก็บ event ซึ่งยังไม่มี '
        + 'และการเดาตัวเลขมาโชว์แย่กว่าการไม่โชว์';
    } catch (e) {
      el.innerHTML = '<div class="stat" style="grid-column:1/-1"><div class="k">อ่านไม่ได้</div>'
        + '<div class="v" style="font-size:15px;line-height:1.6">' + esc(e.message || e) + '</div>'
        + '<div class="s">ยังไม่ได้รัน migration app_config หรือยังไม่มีฟังก์ชัน admin_stats()</div></div>';
      $('#anaWhy').textContent = 'รัน migration 20260912120000_app_config.sql ก่อน แล้วรีเฟรชหน้านี้';
    }
  }

  /* ==================== ส่วนประกอบที่ใช้ซ้ำ ==================== */
  function toggleRow(name, sub, get, set, disabled) {
    var d = document.createElement('div');
    d.className = 'tg';
    d.innerHTML = '<div class="tx"><b>' + esc(name) + '</b>'
      + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
    var sw = document.createElement('button');
    sw.className = 'sw';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', get() ? 'true' : 'false');
    if (disabled) { sw.disabled = true; sw.style.opacity = '.4'; sw.style.cursor = 'not-allowed'; }
    sw.onclick = function () {
      set(!get());
      sw.setAttribute('aria-checked', get() ? 'true' : 'false');
    };
    d.appendChild(sw);
    return d;
  }

  function slider(box, opts) {
    var d = document.createElement('div');
    d.className = 'sl';
    d.innerHTML = '<div class="lb"><b>' + esc(opts.name) + '</b><span>' + opts.fmt(opts.get()) + '</span></div>'
      + (opts.sub ? '<em>' + opts.sub + '</em>' : '');
    var r = document.createElement('input');
    r.type = 'range'; r.min = opts.min; r.max = opts.max; r.step = opts.step || 1;
    r.value = opts.get();
    r.oninput = function () {
      opts.set(+r.value);
      d.querySelector('span').textContent = opts.fmt(+r.value);
      if (opts.live) opts.live();
    };
    r.onchange = function () { touch(opts.what); };
    d.appendChild(r);
    box.appendChild(d);
  }

  /* ==================== Home Builder ==================== */
  function layout() {
    var saved = draft.home && draft.home.blocks;
    var seen = {}, out = [];
    (Array.isArray(saved) ? saved : []).forEach(function (b) {
      if (!b || !BLOCK_META[b.id] || seen[b.id]) return;
      seen[b.id] = 1;
      out.push({ id: b.id, on: b.on !== false });
    });
    DEFAULTS.home.blocks.forEach(function (b) {
      if (!seen[b.id]) out.push({ id: b.id, on: true });
    });
    draft.home.blocks = out;
    return out;
  }

  function drawBlocks() {
    var el = $('#blkList');
    el.innerHTML = '';
    var list = layout();
    list.forEach(function (b, i) {
      var m = BLOCK_META[b.id];
      var d = document.createElement('div');
      d.className = 'blk' + (b.on ? '' : ' hid');
      d.dataset.i = i;
      d.innerHTML = '<span class="gr" draggable="true" title="ลากเพื่อสลับ">⠿</span>'
        + '<div class="nm"><b>' + esc(m[0]) + '</b><small>' + esc(m[1]) + '</small></div>';

      // ปุ่ม ↑↓ ไม่ใช่ของสำรอง — บนมือถือการลากในลิสต์ที่เลื่อนได้คือท่าที่พลาดบ่อยที่สุด
      var up = document.createElement('button');
      up.className = 'mv'; up.textContent = '↑'; up.disabled = i === 0;
      up.setAttribute('aria-label', 'เลื่อนขึ้น');
      up.onclick = function () { move(i, i - 1); };
      var dn = document.createElement('button');
      dn.className = 'mv'; dn.textContent = '↓'; dn.disabled = i === list.length - 1;
      dn.setAttribute('aria-label', 'เลื่อนลง');
      dn.onclick = function () { move(i, i + 1); };
      d.appendChild(up); d.appendChild(dn);

      var sw = document.createElement('button');
      sw.className = 'sw';
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', b.on ? 'true' : 'false');
      sw.onclick = function () {
        b.on = !b.on;
        drawBlocks();
        touch('หน้าแรก');
      };
      d.appendChild(sw);

      var grip = d.querySelector('.gr');
      grip.ondragstart = function (e) {
        d.classList.add('drag');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
      };
      grip.ondragend = function () { d.classList.remove('drag'); };
      d.ondragover = function (e) { e.preventDefault(); d.classList.add('over'); };
      d.ondragleave = function () { d.classList.remove('over'); };
      d.ondrop = function (e) {
        e.preventDefault();
        d.classList.remove('over');
        var from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!isNaN(from)) move(from, i);
      };
      el.appendChild(d);
    });
    pvPush();
  }
  function move(from, to) {
    var l = draft.home.blocks;
    if (from === to || from < 0 || to < 0 || from >= l.length || to >= l.length) return;
    l.splice(to, 0, l.splice(from, 1)[0]);
    drawBlocks();
    touch('ลำดับหน้าแรก');
  }
  /* ---------- ชิ้นส่วนในการ์ด "ตอนนี้" ---------- */
  function nowLayout() {
    var saved = (draft.cards && draft.cards.now) || [];
    var seen = {}, out = [];
    saved.forEach(function (p) {
      if (!p || seen[p.id]) return;
      var m = NOW_META.filter(function (x) { return x[0] === p.id; })[0];
      if (!m) return;
      seen[p.id] = 1;
      out.push({ id: p.id, on: m[2] ? true : p.on !== false });
    });
    NOW_META.forEach(function (m) { if (!seen[m[0]]) out.push({ id: m[0], on: true }); });
    if (!draft.cards) draft.cards = {};
    draft.cards.now = out;
    return out;
  }

  function drawNowParts() {
    var el = $('#nowList');
    if (!el) return;
    el.innerHTML = '';
    var list = nowLayout();
    var metaOf = function (id) { return NOW_META.filter(function (x) { return x[0] === id; })[0]; };
    var lastZone = '';

    list.forEach(function (p, i) {
      var m = metaOf(p.id);
      var zone = m[1], locked = !!m[2];

      if (zone !== lastZone) {
        lastZone = zone;
        var h = document.createElement('div');
        h.className = 'navsec';
        h.style.padding = '10px 2px 4px';
        h.textContent = NOW_ZONE_NAME[zone] || zone;
        el.appendChild(h);
      }

      // เพื่อนบ้านในโซนเดียวกันเท่านั้น — ย้ายข้ามโซนไม่ได้
      var sameZone = list.map(function (x, j) { return metaOf(x.id)[1] === zone ? j : -1; })
                         .filter(function (j) { return j >= 0; });
      var pos = sameZone.indexOf(i);

      var d = document.createElement('div');
      d.className = 'blk' + (p.on ? '' : ' hid');
      d.innerHTML = '<span class="gr" draggable="true" title="ลากเพื่อสลับ">⠿</span>'
        + '<div class="nm"><b>' + esc(m[3]) + '</b><small>' + esc(m[4]) + '</small></div>';

      var up = document.createElement('button');
      up.className = 'mv'; up.textContent = '↑'; up.disabled = pos === 0;
      up.setAttribute('aria-label', 'เลื่อนขึ้น');
      up.onclick = function () { nowMove(i, sameZone[pos - 1]); };
      var dn = document.createElement('button');
      dn.className = 'mv'; dn.textContent = '↓'; dn.disabled = pos === sameZone.length - 1;
      dn.setAttribute('aria-label', 'เลื่อนลง');
      dn.onclick = function () { nowMove(i, sameZone[pos + 1]); };
      d.appendChild(up); d.appendChild(dn);

      if (locked) {
        var lk = document.createElement('span');
        lk.className = 'pill off';
        lk.textContent = 'ถอดไม่ได้';
        lk.title = 'การ์ดใบนี้มีอยู่เพื่อตอบว่าทำอะไร แล้วกดตรงไหน — ถอดออกแล้วมันไม่เหลืออะไร';
        d.appendChild(lk);
      } else {
        var sw = document.createElement('button');
        sw.className = 'sw';
        sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-checked', p.on ? 'true' : 'false');
        sw.onclick = function () { p.on = !p.on; drawNowParts(); touch('การ์ดตอนนี้'); };
        d.appendChild(sw);
      }

      var grip = d.querySelector('.gr');
      grip.ondragstart = function (e) {
        d.classList.add('drag');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
      };
      grip.ondragend = function () { d.classList.remove('drag'); };
      d.ondragover = function (e) { e.preventDefault(); d.classList.add('over'); };
      d.ondragleave = function () { d.classList.remove('over'); };
      d.ondrop = function (e) {
        e.preventDefault();
        d.classList.remove('over');
        var from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(from)) return;
        // ปล่อยข้ามโซน = ไม่ทำอะไร ดีกว่าย้ายไปแล้วจอพัง
        if (metaOf(list[from].id)[1] !== zone) { msg('ย้ายข้ามโซนไม่ได้ — หัวการ์ดกับตัวการ์ดคนละพื้นหลัง'); return; }
        nowMove(from, i);
      };
      el.appendChild(d);
    });
  }

  function nowMove(from, to) {
    var l = draft.cards.now;
    if (from === to || from < 0 || to < 0 || from >= l.length || to >= l.length) return;
    l.splice(to, 0, l.splice(from, 1)[0]);
    drawNowParts();
    touch('ลำดับในการ์ด');
  }

  /* ==================== Priority Engine ==================== */
  // ---------- งานที่เอามาเรียงให้ดู ----------
  // **ของจริงก่อนเสมอ** — Control Center อยู่โดเมนเดียวกับแอป จึงอ่าน state ก้อนเดียวกันได้ตรง ๆ
  // งานตัวอย่างที่แต่งขึ้นบอกได้แค่ว่าสูตรทำงาน แต่ไม่ได้บอกสิ่งที่เจ้าของระบบอยากรู้จริง ๆ
  // ซึ่งคือ "ลากแล้ว **งานของฉัน** สลับที่ไหม" · ถ้าไม่มีงานค้างเลยค่อยถอยไปใช้ตัวอย่าง
  // เพื่อไม่ให้จอว่างจนปรับอะไรแล้วไม่เห็นผล
  var STORE_KEY = 'studentos.alt.v1';

  function realTasks() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var st = JSON.parse(raw);
      var list = (st && Array.isArray(st.tasks)) ? st.tasks : [];
      // เรียงเหมือนที่หน้าแรกเรียง: เฉพาะที่ยังไม่เสร็จและไม่ได้ลบ
      list = list.filter(function (t) { return t && !t.done && !t.deleted; });
      return list.length ? list : null;
    } catch (e) { return null; }
  }

  // ตัวอย่างสำรอง — ครอบสี่กรณีที่เถียงกันบ่อยที่สุดในโปรเจกต์นี้:
  // สอบไกลแต่ใหญ่ · การบ้านใกล้แต่เล็ก · ของที่เลยกำหนดไปแล้ว · งานที่ผู้ใช้ปักดาวเอง
  function samples() {
    var H = 36e5, D = 864e5, now = Date.now();
    return [
      { id: 's1', subject: 'ฟิสิกส์', detail: 'อ่านสอบบทที่ 4', type: 'exam',
        due: new Date(now + 3 * D).toISOString(), scorePct: 30, estMin: 150 },
      { id: 's2', subject: 'อังกฤษ', detail: 'ส่งรายงาน', type: 'homework',
        due: new Date(now + 20 * H).toISOString(), scorePct: 15, estMin: 60 },
      { id: 's3', subject: 'เคมี', detail: 'ใบงานที่เลยกำหนด', type: 'homework',
        due: new Date(now - 2 * D).toISOString(), scorePct: 10, estMin: 30 },
      { id: 's4', subject: 'คณิตศาสตร์', detail: 'การบ้าน ข้อ 1–20', type: 'homework',
        due: new Date(now + 4 * D).toISOString(), scorePct: 5, estMin: 40 },
      { id: 's5', subject: 'ศิลปะ', detail: 'ส่งชิ้นงาน (ปักดาวเอง)', type: 'homework',
        due: new Date(now + 6 * D).toISOString(), estMin: 90, userStars: 5 },
      { id: 's6', subject: 'ชีววิทยา', detail: 'อ่านล่วงหน้า', type: 'homework',
        due: new Date(now + 9 * D).toISOString(), scorePct: 8, estMin: 45 },
    ];
  }

  // ชื่อที่คนอ่านแล้วรู้ว่าใบไหน — งานจริงบางใบไม่มีวิชา บางใบไม่มีรายละเอียด
  function taskName(t) {
    var sub = String(t.subject || '').trim();
    var det = String(t.detail || '').trim();
    if (sub && sub !== 'อื่น ๆ' && det) return sub + ' — ' + det;
    return sub && sub !== 'อื่น ๆ' ? sub : (det || 'งานที่ไม่มีชื่อ');
  }

  function rankPv() {
    var el = $('#prioPv');
    if (typeof priorityInfo !== 'function') {
      el.innerHTML = '<p class="hint">engine.js ไม่ได้โหลด — แสดงลำดับตัวอย่างไม่ได้</p>';
      return;
    }
    var now = new Date();
    var mine = realTasks();
    var list = mine || samples();
    var rows = list.map(function (t) {
      var info = priorityInfo(t, now);
      return { t: t, s: info.score, stars: info.stars };
    }).sort(function (a, b) { return b.s - a.s; }).slice(0, 8);

    var src = $('#prioSrc');
    if (src) {
      src.textContent = mine
        ? 'งานค้างจริงของคุณ ' + mine.length + ' ใบ' + (mine.length > 8 ? ' (แสดง 8 อันดับแรก)' : '')
        : 'ยังไม่มีงานค้างในเครื่องนี้ — แสดงงานตัวอย่างแทน';
      src.className = 'hint' + (mine ? ' real' : '');
    }

    el.innerHTML = rows.map(function (r, i) {
      return '<div class="tg"><b style="width:22px;flex:none;font-size:15px;color:'
        + (i === 0 ? 'var(--cacc)' : 'var(--cfaint)') + '">' + (i + 1) + '</b>'
        + '<div class="tx"><b>' + esc(taskName(r.t)) + '</b>'
        + '<small>' + '★'.repeat(r.stars) + '</small></div>'
        + '<span class="mono" style="color:var(--cmuted);font-size:12px">' + r.s + '</span></div>';
    }).join('');
  }
  function drawPrio() {
    var el = $('#slList');
    el.innerHTML = '';
    PRIO_META.forEach(function (p) {
      slider(el, {
        name: p[1], sub: esc(p[2]), what: 'น้ำหนัก', min: 0, max: 200,
        fmt: function (v) {
          var mul = DEFAULTS.prio[p[0]] ? v / DEFAULTS.prio[p[0]] : 1;
          return v + '  (' + (Math.round(mul * 100) / 100) + '×)';
        },
        get: function () { return draft.prio[p[0]]; },
        set: function (v) { draft.prio[p[0]] = v; syncLive(); },
        live: rankPv,
      });
    });
    rankPv();
  }
  $('#prioReset').onclick = function () {
    draft.prio = clone(DEFAULTS.prio);
    drawPrio();
    touch('น้ำหนัก');
  };

  /* ==================== Theme Studio ==================== */
  function drawColors() {
    var el = $('#colList');
    el.innerHTML = '';
    draft.theme.colors = draft.theme.colors || {};
    COLOR_META.forEach(function (c) {
      var d = document.createElement('div');
      d.className = 'tg';
      var cur = draft.theme.colors[c[0]];
      d.innerHTML = '<div class="tx"><b>' + esc(c[1]) + '</b>'
        + '<small class="mono">' + esc(cur || 'ตามเดิม (' + c[2] + ')') + '</small></div>';
      var inp = document.createElement('input');
      inp.type = 'color'; inp.className = 'swatch'; inp.value = cur || c[2];
      inp.oninput = function () {
        draft.theme.colors[c[0]] = inp.value;
        d.querySelector('small').textContent = inp.value;
        themePv();
      };
      inp.onchange = function () { touch('สี'); };
      var clr = document.createElement('button');
      clr.className = 'mv'; clr.textContent = '✕';
      clr.title = 'กลับไปใช้สีของธีม';
      clr.onclick = function () {
        delete draft.theme.colors[c[0]];
        drawColors(); themePv(); touch('สี');
      };
      d.appendChild(inp); d.appendChild(clr);
      el.appendChild(d);
    });
  }
  // ธีมไม่ต้องวาดตัวอย่างเองแล้ว — แอปจริงในกรอบข้าง ๆ คือตัวอย่างที่ดีที่สุดที่มีได้
  // เหลือไว้เป็นชื่อเดิมเพื่อให้ทุกจุดที่เคยเรียกยังเรียกได้เหมือนเดิม
  function themePv() { pvPush(); }

  /* ==================== Content ==================== */
  function drawTexts() {
    var el = $('#txtList');
    el.innerHTML = '';
    draft.texts = draft.texts || {};
    TEXT_META.forEach(function (t) {
      var l = document.createElement('label');
      l.className = 'fld';
      l.innerHTML = '<span>' + esc(t[1]) + '</span><em>เดิม: ' + esc(t[2]) + '</em>';
      var i = document.createElement('input');
      i.className = 'in';
      i.placeholder = t[2];
      i.value = draft.texts[t[0]] || '';
      i.oninput = function () {
        if (i.value.trim()) draft.texts[t[0]] = i.value;
        else delete draft.texts[t[0]];
      };
      i.onchange = function () { touch('ข้อความ'); };
      l.appendChild(i);
      el.appendChild(l);
    });
  }

  /* ==================== Notifications ==================== */
  function drawTimes() {
    var el = $('#timeList');
    el.innerHTML = '';
    draft.noti.times = draft.noti.times || [];
    draft.noti.times.forEach(function (t, i) {
      var d = document.createElement('div');
      d.className = 'row';
      d.style.marginBottom = '8px';
      var inp = document.createElement('input');
      inp.type = 'time'; inp.className = 'in'; inp.style.width = '150px'; inp.value = t;
      inp.onchange = function () { draft.noti.times[i] = inp.value; touch('เวลาส่ง'); };
      var rm = document.createElement('button');
      rm.className = 'btn sm danger'; rm.textContent = 'ลบ';
      rm.onclick = function () { draft.noti.times.splice(i, 1); drawTimes(); touch('เวลาส่ง'); };
      d.appendChild(inp); d.appendChild(rm);
      el.appendChild(d);
    });
    if (!draft.noti.times.length) {
      el.innerHTML = '<p class="hint">ไม่ได้ตั้งเวลา = ส่งตามจังหวะของงานเหมือนเดิม · ตั้งเวลาเมื่อไหร่ = ส่งเฉพาะ ±15 นาทีรอบเวลานั้น</p>';
    }
  }
  $('#addTime').onclick = function () {
    draft.noti.times.push('18:00');
    drawTimes();
    touch('เวลาส่ง');
  };
  function drawTemplates() {
    var el = $('#tplList');
    el.innerHTML = '';
    draft.noti.templates = draft.noti.templates || {};
    TPL_META.forEach(function (t) {
      var l = document.createElement('label');
      l.className = 'fld';
      l.innerHTML = '<span>' + esc(t[1]) + '</span><em>เดิม: ' + esc(t[2]) + '</em>';
      var i = document.createElement('input');
      i.className = 'in';
      i.placeholder = t[2];
      i.value = draft.noti.templates[t[0]] || '';
      i.oninput = function () {
        if (i.value.trim()) draft.noti.templates[t[0]] = i.value;
        else delete draft.noti.templates[t[0]];
      };
      i.onchange = function () { touch('ข้อความแจ้งเตือน'); };
      l.appendChild(i);
      el.appendChild(l);
    });
  }

  /* ==================== ช่องค่าเดี่ยว ==================== */
  function getPath(o, p) {
    var parts = p.split('.'), cur = o, i;
    for (i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function setPath(o, p, v) {
    var parts = p.split('.'), cur = o, i;
    for (i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  }
  function bindFields() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-cfg]'), function (el) {
      var k = el.dataset.cfg;
      if (el.type === 'range') return;   // สไลเดอร์มีตัวจัดการของตัวเอง
      var v = getPath(draft, k);
      el.value = (v === null || v === undefined) ? '' : v;
      el.oninput = function () {
        var val = el.value;
        if (el.type === 'number') val = val === '' ? null : +val;
        else if (val === '') val = null;
        setPath(draft, k, val);
        syncLive();
      };
      el.onchange = function () { touch('ค่าตั้ง'); };
    });
  }

  /* ==================== Dashboard ==================== */
  function countOverrides(def, cur, path) {
    var n = 0, k;
    if (JSON.stringify(def) === JSON.stringify(cur)) return 0;
    if (typeof def !== 'object' || def === null || Array.isArray(def)) return 1;
    for (k in cur) {
      if (!(k in def)) { n++; continue; }
      n += countOverrides(def[k], cur[k], (path || '') + '.' + k);
    }
    return n;
  }
  function dash() {
    if (!draft) return;
    $('#dVer').textContent = meta.version ? 'v' + meta.version : '—';
    $('#dVerAt').textContent = meta.at ? new Date(meta.at).toLocaleString('th-TH') : 'ยังไม่เคยเผยแพร่';
    $('#dOver').textContent = countOverrides(DEFAULTS, draft, '');
    var f = draft.features || {};
    var keys = Object.keys(DEFAULTS.features);
    $('#dFeat').textContent = keys.filter(function (k) { return f[k] !== false; }).length + '/' + keys.length;
    $('#dBlk').textContent = (draft.home.blocks || []).filter(function (b) { return b.on; }).length;
  }
  function drawGaps() {
    $('#gapList').innerHTML = GAPS.map(function (g) {
      return '<div class="tg"><div class="tx"><b>' + esc(g[0]) + '</b><small>' + esc(g[1])
        + '</small></div><span class="pill todo">ยังไม่ต่อสาย</span></div>';
    }).join('');
  }

  /* ==================== วาดทั้งหมด ==================== */
  function renderAll() {
    drawBlocks();
    drawNowParts();
    drawPrio();

    var fl = $('#featList');
    fl.innerHTML = '';
    FEAT_META.forEach(function (f) {
      fl.appendChild(toggleRow(f[1],
        esc(f[2]) + (f[3] ? '' : ' <b style="color:var(--cwarn)">· ยังไม่มีผล</b>'),
        function () { return draft.features[f[0]] !== false; },
        function (v) { draft.features[f[0]] = v; touch('ฟีเจอร์'); }));
    });

    var nl = $('#notiList');
    nl.innerHTML = '';
    NOTI_META.forEach(function (n) {
      nl.appendChild(toggleRow(n[1], esc(n[2]),
        function () { return draft.noti.flags[n[0]] === true; },
        function (v) { draft.noti.flags[n[0]] = v; touch('การเตือน'); }));
    });

    var ol = $('#ocrList');
    ol.innerHTML = '';
    OCR_META.forEach(function (o) {
      ol.appendChild(toggleRow(o[1], esc(o[2]),
        function () { return draft.ocr[o[0]] === true; },
        function (v) { draft.ocr[o[0]] = v; touch('OCR'); }));
    });

    var xl = $('#expOn');
    xl.innerHTML = '';
    xl.appendChild(toggleRow('เปิดการทดลองนี้',
      'ปิด = ทุกคนได้กลุ่ม A',
      function () { return draft.exp.on === true; },
      function (v) { draft.exp.on = v; touch('การทดลอง'); }));

    drawColors(); themePv(); drawTexts(); drawTimes(); drawTemplates();
    bindFields();
    drawGaps();

    // สไลเดอร์ที่ผูกกับ data-cfg โดยตรง
    bindSlider('#rConf', 'ocr.confidence', '#vConf', function (v) { return v + '%'; }, function (v) {
      $('#confWarn').hidden = v >= 80;
    });
    // ค่าสำรองสามตัวนี้คือค่าที่แอปใช้จริงตอนที่ยังไม่มีใครตั้งอะไร
    // (--r-card: 20px ใน style.css · ระยะและขนาดตัวอักษรคูณ 1.00×)
    bindSlider('#rRad', 'theme.radius', '#vRad', function (v) { return v + 'px'; }, themePv, 0, 20);
    bindSlider('#rSp', 'theme.spacing', '#vSp', function (v) { return (v / 100).toFixed(2) + '×'; }, null, 100, 1);
    bindSlider('#rFs', 'theme.fontScale', '#vFs', function (v) { return (v / 100).toFixed(2) + '×'; }, themePv, 100, 1);
    bindSlider('#rSplit', 'exp.split', '#vSplit', function (v) { return v + '%'; }, function (v) {
      $('#sA').textContent = (100 - v) + '%';
      $('#sB').textContent = v + '%';
    });

    $('#sysPrompt').value = draft.ai.prompt || '';
    $('#rulesTx').value = draft.ai.rules || '';
    $('#promptLen').textContent = ($('#sysPrompt').value || '').length;
    dash();
  }

  // scale = ตัวหาร เมื่อค่าจริงเป็นทศนิยมแต่สไลเดอร์เดินเป็นจำนวนเต็ม
  // fb    = ตำแหน่งที่หัวสไลเดอร์ควรยืนเมื่อ "ยังไม่ได้ตั้งค่า"
  //         ต้องเป็นค่าที่แอปใช้อยู่จริง ไม่ใช่ค่าสุดขอบของสไลเดอร์ —
  //         หัวที่ยืนผิดที่คือหน้าจอที่โกหกว่าตอนนี้ตั้งไว้เท่าไหร่ ก่อนใครจะแตะมันด้วยซ้ำ
  function bindSlider(sel, path, out, fmt, after, scale, fb) {
    var el = $(sel);
    if (!el) return;
    var raw = getPath(draft, path);
    var def = getPath(DEFAULTS, path);
    var base = (raw !== null && raw !== undefined) ? raw
             : (def !== null && def !== undefined) ? def
             : fb;
    var val = (base === null || base === undefined) ? +el.min : base * (scale || 1);
    el.value = val;
    var paint = function () {
      if (out) $(out).textContent = fmt(+el.value);
      if (after) after(+el.value);
    };
    el.oninput = function () {
      setPath(draft, path, scale ? (+el.value / scale) : +el.value);
      syncLive();
      paint();
    };
    el.onchange = function () { touch('ค่าตั้ง'); };
    paint();
  }

  $('#sysPrompt').oninput = function () {
    draft.ai.prompt = this.value;
    $('#promptLen').textContent = this.value.length;
  };
  $('#sysPrompt').onchange = function () { touch('พรอมป์'); };
  $('#rulesTx').oninput = function () { draft.ai.rules = this.value; };
  $('#rulesTx').onchange = function () { touch('กติกา'); };

  /* ==================== แอปจริงที่ฝังไว้ ====================
     เหตุผลที่ต้องมี: พรีวิวที่วาดเองเป็นภาพวาดของแอป ไม่ใช่แอป
     ลากบล็อกแล้วเห็นกล่องเขียนว่า "การ์ดตอนนี้" ไม่ได้บอกอะไรเลยว่าของจริงจะออกมายังไง
     — และถ้าพรีวิวกับของจริงไม่ตรงกันวันไหน พรีวิวจะกลายเป็นสิ่งที่ทำให้ตัดสินใจผิด

     ตัวส่งค่าเป็น postMessage ทางเดียว: หน้านี้ส่ง draft เข้าไป · ฝั่งโน้นไม่เขียนแคช
     (ดูโหมดพรีวิวใน remote-config.js — ข้อ 2 คือข้อที่พลาดแล้วเจ็บที่สุด)
     ========================================================= */
  // ธงที่ iframe อ่านได้ (โดเมนเดียวกัน) — ต้องตั้งก่อน iframe เริ่มโหลด
  // และต้องอยู่รอดการที่ service worker สั่ง iframe รีโหลดตัวเอง ซึ่งคิวรีไม่รอด
  window.__SOS_CONTROL_PREVIEW__ = true;

  var pvReady = false, pvTimer = null;

  function pvFrame() { return $('#pvFrame'); }

  function pvBoot() {
    var f = pvFrame();
    if (!f || f.src) return;
    // cache-bust ไม่ได้ใส่โดยตั้งใจ — service worker เป็น network-first อยู่แล้ว
    // และการยัด timestamp ทุกครั้งแปลว่าแอปบูตใหม่หมดทุกการสลับจอ
    f.src = 'index.html?sosPreview=1';
  }

  // ส่งถี่เท่าที่ลากได้ = แอปวาดใหม่ทุกเฟรม · หน่วงสั้น ๆ พอให้ลากลื่นแต่ยังรู้สึกว่าทันที
  function pvPush() {
    if (!pvReady || !draft) return;
    clearTimeout(pvTimer);
    pvTimer = setTimeout(function () {
      var f = pvFrame();
      if (!f || !f.contentWindow) return;
      try {
        f.contentWindow.postMessage(
          { type: 'sos-preview-config', config: clone(draft) }, location.origin);
      } catch (e) {}
    }, 60);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    if (!e.data) return;

    if (e.data.type === 'sos-preview-ready') {
      pvReady = true;
      pvPush();
      var on = $('.nav.on');
      if (on && on.dataset.go) pvMoveTo(on.dataset.go);
      return;
    }

    /* งานที่แก้ด้วยมือในตัวแก้ดีไซน์ ไหลกลับมาเป็นส่วนหนึ่งของ draft
       ยังไม่ถึงใครจนกว่าจะกดเผยแพร่ เหมือนทุกอย่างในหน้านี้ */
    if (e.data.type === 'sos-preview-ui' && e.data.ui && draft) {
      draft.ui = e.data.ui;
      dirty = true;
      syncLive();
      msg('แก้ดีไซน์แล้ว — ยังไม่ได้เผยแพร่');
      updateBar();
      dash();
      pvTag();
      // ไม่เรียก pvPush() ตรงนี้ — จอในกรอบทาสีของมันเองไปแล้ว
      // ส่งกลับไปอีกรอบคือการเขียนทับสิ่งที่เขากำลังแก้อยู่กลางคัน
    }
  });

  // จอในแอปที่ตรงกับสิ่งที่กำลังแก้อยู่ · ไม่มีในตาราง = ปล่อยให้อยู่จอเดิม
  var PV_SCREEN = {
    home: 'scr-menu',      // บล็อกหน้าแรก + ชิ้นส่วนการ์ด "ตอนนี้"
    theme: 'scr-menu',     // สีกับรูปทรงเห็นชัดที่สุดบนหน้าแรก
    content: 'scr-menu',   // ข้อความทั้งสามจุดที่ต่อสายไว้อยู่บนหน้าแรก
    feat: 'scr-tools',     // ไทล์ที่ถูกซ่อนอยู่จอนี้
  };

  // เปิด/ปิดด้วยคลาสบนกริด **ไม่ย้าย DOM** — ย้าย iframe เมื่อไหร่ เบราว์เซอร์รีโหลดมันทันที
  // แล้วแอปเด้งกลับไปจอที่จำไว้ ทั้งที่เราเพิ่งสั่งให้ไปอีกจอ (เจอมาแล้วตอนทดสอบ)
  var PV_PAGES = { home: 1, theme: 1, content: 1, feat: 1 };

  function pvMoveTo(pageId) {
    var live = $('#livePv'), main = document.querySelector('.main');
    if (!live || !main) return;
    var want = !!PV_PAGES[pageId];
    live.hidden = !want;
    main.classList.toggle('with-pv', want);
    if (!want) return;

    pvBoot();
    pvPush();

    var scr = PV_SCREEN[pageId];
    if (scr && pvReady) {
      var f = pvFrame();
      try { f.contentWindow.postMessage({ type: 'sos-preview-screen', id: scr }, location.origin); }
      catch (e) {}
    }
  }

  function pvTag() {
    var t = $('#liveTag');
    if (!t) return;
    t.textContent = dirty ? 'ยังไม่เผยแพร่' : 'ตรงกับที่เผยแพร่';
    t.className = 'live-tag' + (dirty ? '' : ' clean');
  }

  $('#pvReload').onclick = function () {
    var f = pvFrame();
    if (!f) return;
    pvReady = false;
    f.src = 'index.html?sosPreview=1';
  };
  $('#pvOpen').onclick = function () { window.open('index.html', '_blank', 'noopener'); };

  /* ==================== เมนู ==================== */
  Array.prototype.forEach.call(document.querySelectorAll('.nav[data-go]'), function (b) {
    b.onclick = function () {
      Array.prototype.forEach.call(document.querySelectorAll('.nav'), function (x) { x.classList.remove('on'); });
      Array.prototype.forEach.call(document.querySelectorAll('.page'), function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      var p = $('#p-' + b.dataset.go);
      if (p) p.classList.add('on');
      pvMoveTo(b.dataset.go);
      window.scrollTo(0, 0);
    };
  });

  // ปิดแท็บทั้งที่ยังไม่ได้เผยแพร่ = เสียงานที่ลากมาทั้งหน้า
  window.addEventListener('beforeunload', function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  boot();
})();
