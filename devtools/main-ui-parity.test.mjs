import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8').replaceAll('\r\n','\n'),html=read('index.html');
test('main has the complete ALT boot, login, event and reward presentation',()=>{
 for(const s of ['class="hb-sky"','id="hw-bat"','class="lg-hw"','id="scr-events"','id="themePick"','data-th="thai-ghost"','data-th="halloween"','data-th="moonlight"'])assert.ok(html.includes(s),s);
 for(const s of ['season/season.css','season/cursed-ship.js','season/biome-finishes.js','rewards/runtime.js','rewards/entitlements.js','rewards/badges.js','rewards/featured-badge.js','rewards/theme-rarity.js','invite-friend/thai-ranat.js'])assert.ok(html.includes('alt/halloween/'+s),s);
 assert.match(read('today.css'),/home-v2/);assert.match(read('app.js'),/function eventSlot\(/);
 assert.doesNotMatch(html,/<a class="alt-lab-entry"|<script src="device-preview-bridge/);
});
test('root keeps main identity, storage keys and notification ownership',()=>{
 assert.match(read('app.js'),/const ALT_SYSTEM_NOTIFICATIONS = true/);
 assert.match(read('app.js'),/const STORE_KEY = 'studentos.alt.v1'/);
 assert.match(read('app.js'),/const OWNER_KEY = 'studentos.alt.owner'/);
 assert.match(html,/window.StudentOSMainEntry = true/);
 assert.match(html,/<link rel="canonical" href="https:\/\/nadokagenou.github.io\/studentos-ai\/">/);
 assert.match(html,/href="manifest.json"/);
 const at=s=>html.indexOf(s);assert.ok(at('src="config.js"')<at('src="engine.js"'));assert.ok(at('src="context.js"')<at('src="app.js"'));
 assert.ok(at('data-economy-guard')<at('src="app.js"'));
});
test('main local resource references exist and preserve shared source locations',()=>{
 const live=html.replace(/<!--[\s\S]*?-->/g,'');
 for(const m of live.matchAll(/(?:src|href)="([^"]+)"/g)){const p=m[1].split(/[?#]/)[0];if(!p||/^(https?:|data:|#)/.test(p))continue;if(!/\.(js|css|png|svg|webp|json|mjs)$/.test(p))continue;assert.ok(fs.existsSync(path.join(root,p)),p);}
 assert.match(html,/src="alt\/halloween\/rewards\/preview-mode.js"/);assert.match(html,/src="alt\/economy\/client.js/);
});
test('main event and study links explicitly return to the main app',()=>{
 assert.match(read('alt/halloween/rewards/runtime.js'),/StudentOSMainEntry/);
 assert.match(read('alt/halloween/rewards/runtime.js'),/searchParams.set\('entry','main'\)/);
 assert.match(read('alt/halloween/study-pact-main.js'),/new URL\('event\/',document.currentScript.src\)/);
 assert.match(read('alt/halloween/study-pact-main.js'),/StudentOSMainEntry/);
});
