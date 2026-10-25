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
