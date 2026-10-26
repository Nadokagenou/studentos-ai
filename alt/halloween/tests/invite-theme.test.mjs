import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
function harness(){
 const data=new Map(),ctx=vm.createContext({URL,URLSearchParams,location:{search:'',origin:'https://example.test',pathname:'/alt/'},document:{currentScript:null},localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},window:{},currentUser:{id:'owner'},state:{tasks:[],funnel:{}},setTimeout,console});
 vm.runInContext(read('../invite-friend/invite-friend.js'),ctx);
 vm.runInContext("let opened=0;openInvite=()=>opened++;",ctx);
 return {ctx,data,run:s=>vm.runInContext(s,ctx)};
}
test('the invitation gate belongs to the Thai theme and never blocks either final-boss theme',()=>{
 const h=harness();assert.equal(h.run('INVITE_THEME'),'thai-ghost');
 for(const id of ['halloween','moonlight'])assert.equal(h.run(`inviteThemeGate('${id}')`),false);
 assert.equal(h.run("inviteThemeGate('thai-ghost')"),true);assert.equal(h.run('opened'),1);
});
test('existing verified invitation counts and completed-work proof unlock the replacement reward without restarting progress',()=>{
 const h=harness();h.run("ivData={used:3};state.funnel.hwTaskAt='2026-10-24T10:00:00Z'");assert.equal(h.run('inviteUnlocked()'),true);assert.equal(h.run("inviteThemeGate('thai-ghost')"),false);
 h.run('ivData.used=2');assert.equal(h.run('inviteUnlocked()'),false);
 h.run('ivData.used=3;state.funnel={};state.tasks=[]');assert.equal(h.run('inviteUnlocked()'),false);
 h.data.set('studentos.alt.inviteCache',JSON.stringify({uid:'other',data:{used:3}}));h.run('ivData=null');assert.equal(h.run('inviteCount()'),0);
});
test('the isolated fitting room can show the Thai theme without unlocking the real reward',()=>{
 const h=harness();h.run('window.__HW_SHOWROOM__=true');assert.equal(h.run("inviteThemeGate('thai-ghost')"),false);assert.equal(h.run('inviteUnlocked()'),false);assert.equal(h.data.size,0);
});
test('the limited Thai theme is registered consistently and every invitation surface names the replacement',()=>{
 const app=read('../../app.js'),html=read('../../index.html'),inv=read('../invite-friend/invite-friend.js'),events=read('../../events.js');
 assert.ok(/'thai-ghost':\s*'#0B1817'/.test(app));assert.ok(/'thai-ghost':\s*'เรือนลับแล'/.test(app));assert.ok(/data-th="thai-ghost"/.test(html));assert.ok(/'thai-ghost':\s*'#0B1817'/.test(html));
 assert.doesNotMatch(inv,/ชวนเพื่อน ปลดล็อกธีม Halloween|รางวัล: ธีม Halloween|รับธีม Halloween/);
 assert.doesNotMatch(events,/name: 'ธีม Halloween'|<h2>ธีม Halloween/);
 assert.match(read('../invite-friend/thai-theme.js'),/prefers-reduced-motion/);
});
test('Thai theme text, secondary labels and primary controls remain readable against all solid surfaces',()=>{
 const css=read('../../alt.css'),body=css.split(':root[data-theme="thai-ghost"]{')[1]?.split('}')[0];assert.ok(body);
 const tokens=Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6});/gi)].map(m=>[m[1],m[2]]));
 const lum=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 for(const fg of ['--ink','--muted','--faint','--blue'])for(const bg of ['--scr','--card','--card2'])assert.ok(ratio(tokens[fg],tokens[bg])>=4.5,fg+' on '+bg);
 assert.ok(ratio(tokens['--on-fill'],tokens['--fill'])>=4.5);
});
test('Jade Moon: painted night scene, one solid forest-green hero block, no ghosts and no ornaments on controls',()=>{
 const css=read('../../alt.css'),js=read('../invite-friend/thai-theme.js'),body=css.split(':root[data-theme="thai-ghost"]{')[1]?.split('}')[0];
 const tokens=Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6});/gi)].map(m=>[m[1],m[2]]));
 const lum=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 // the scene is the owner's painting, loaded only after the theme mounts
 assert.match(js,/jade-moon\.webp/);assert.ok(fs.existsSync(new URL('../invite-friend/jade-moon.webp',import.meta.url)));
 assert.match(read('../cache-manifest.js'),/"halloween\/invite-friend\/jade-moon\.webp"/);
 // owner: "เอาผีออกได้" — no ghost figures, hanging talisman or lotus ornaments left in the theme
 assert.doesNotMatch(js,/tg-visitor|tg-hanging|tg-ornament|function decorate/);
 assert.doesNotMatch(css,/\.tg-visitor|\.tg-hanging|\.tg-ornament/);
 // at most three moving lanterns, never clickable
 const lanterns=(js.match(/tg-lanterns[\s\S]*?length:(\d)/)||[])[1];assert.ok(Number(lanterns)>0&&Number(lanterns)<=3,'lanterns '+lanterns);
 assert.match(css,/\.tg-scene\{[^}]*pointer-events:none/);
 // 1B28: the hero head is the only solid block — forest green with white text
 assert.match(css,/data-theme="thai-ghost"\] #menuBody \.td-now \.tn-head\{[^}]*#174E39/);
 assert.ok(ratio('#FFFFFF','#174E39')>=4.5&&ratio('#D8E8C9','#174E39')>=4.5);
 assert.match(css,/data-theme="thai-ghost"\] #menuBody \.td-now \.tk-line i\{[^}]*background:#174E39/);
 // glass cards stay dark enough over the brightest part of the painting, and drop the blur on weak devices
 const glass=(css.match(/--tg-glass:(#[0-9A-F]{8})/i)||[])[1];assert.ok(glass,'glass token');
 const a=parseInt(glass.slice(7),16)/255,mix=c=>Math.round(parseInt(glass.slice(c,c+2),16)*a+255*(1-a)).toString(16).padStart(2,'0');
 const worst='#'+mix(1)+mix(3)+mix(5);assert.ok(ratio(tokens['--muted'],worst)>=4.5,'muted on glass over white '+worst);
 assert.match(css,/data-theme="thai-ghost"\]:is\(\[data-lite="1"\],\[data-quality="low"\]\)[^{]*\{[^}]*backdrop-filter:none/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)\{[^@]*thai-ghost/);
 assert.match(css,/data-theme="thai-ghost"\] \.set-card \.set-row\{[^}]*background:transparent/);
});
test('accounts the owner granted by hand use the Thai theme without the quest; everyone else still needs 3 friends and 1 task',()=>{
 const h=harness();
 for(const id of ['d824e935-0929-4330-a2e8-98a56c171b57','cba92754-b051-4a3b-ad13-06eef10064dd','bcc25fe2-7b6c-460a-a623-e10a7ab66995']){
  h.run(`currentUser={id:'${id}'};ivData={used:0};state.funnel={};state.tasks=[]`);
  assert.equal(h.run('inviteUnlocked()'),true,id);assert.equal(h.run("inviteThemeGate('thai-ghost')"),false);
 }
 h.run("currentUser={id:'someone-else'};ivData={used:2};state.funnel={hwTaskAt:'2026-10-24T10:00:00Z'}");assert.equal(h.run('inviteUnlocked()'),false);
 h.run('currentUser=null');assert.equal(h.run('inviteUnlocked()'),false);
});
