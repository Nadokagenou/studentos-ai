// Main URL offline shell and cache isolation. Run directly with Node.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const handlers={},removed=[],matches=[];let shell=[],selected='';
const caches={
 async keys(){return ['studentos-main-previous','studentos-1c57','studentos-alt-previous','other-app',selected];},
 async delete(key){removed.push(key);},
 async open(key){selected=key;return {async addAll(files){shell=files;},async match(request,options){matches.push({key,request,options});return 'main-desktop-css';}};}
};
vm.runInNewContext(source,{URL,location:{origin:'https://example.test'},caches,fetch:async()=>{throw Error('offline');},
 self:{addEventListener:(event,fn)=>{handlers[event]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}},registration:{scope:'https://example.test/studentos-ai/'}}});
const lifecycle=async event=>{const pending=[];handlers[event]({waitUntil(p){pending.push(p);}});await Promise.all(pending);};
(async()=>{
 await lifecycle('install');for(const file of ['desktop.css','desktop-entry.js','desktop.js','desktop-navigation.mjs'])assert.ok(shell.includes(file),file+' must install before going offline');console.log('PASS desktop stylesheet and controls are precached');
 // 31 Oct 2026 · Chrome rejects the whole addAll on a duplicate request, so the worker never installs (hit ALT live 25-31 Oct)
 {const dup=shell.filter((f,i)=>shell.indexOf(f)!==i);assert.equal(dup.length,0,'duplicate precache entries: '+dup.join(', '));console.log('PASS precache list has no duplicates');}
 for(const file of shell)assert.ok(fs.existsSync(path.join(root,file)),'Missing SHELL file: '+file);console.log('PASS all main shell files exist');
 await lifecycle('activate');assert.deepEqual(removed,['studentos-main-previous','studentos-1c57']);console.log('PASS update preserves ALT and other application caches');
 let response;handlers.fetch({request:{method:'GET',url:'https://example.test/studentos-ai/desktop.css?v=review'},respondWith(p){response=p;}});
 assert.equal(await response,'main-desktop-css');assert.equal(matches[0].key,selected);assert.equal(matches[0].options.ignoreSearch,true);console.log('PASS offline desktop uses the current main cache');
 handlers.fetch({request:{method:'GET',url:'https://example.test/studentos-ai/alt/index.html'},respondWith(){throw Error('Main must not intercept ALT');}});console.log('PASS main worker leaves ALT requests alone');
 let shared;handlers.fetch({request:{method:'GET',url:'https://example.test/studentos-ai/halloween/rewards/theme-main.js?rev=release'},respondWith(p){shared=p;}});
 assert.equal(await shared,'main-desktop-css');assert.equal(matches.at(-1).key,selected);console.log('PASS shared reward presentation can fall back to the current main offline cache');
 assert.ok(shell.includes('sai-face-sleepy.webp'));assert.ok(shell.includes('hook-hat-avatar.svg'));
 // 31 Oct 2026 · notifications like other apps: transparent status-bar badge, app icon count = notifications left in the tray
 const ph={},shown=[],badges=[];let tray=[{},{}];
 vm.runInNewContext(source,{URL,location:{origin:'https://example.test'},caches,fetch:async()=>{throw Error('offline');},
  self:{addEventListener:(event,fn)=>{ph[event]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}},
   navigator:{async setAppBadge(n){badges.push(n);},async clearAppBadge(){badges.push(0);}},
   registration:{scope:'https://example.test/studentos-ai/',async showNotification(t,o){shown.push({t,o});},async getNotifications(){return tray;}}}});
 const fire=async(event,extra)=>{const pending=[];ph[event](Object.assign({waitUntil(p){pending.push(p);}},extra));await Promise.all(pending);};
 await fire('push',{data:{json:()=>({title:'Physics worksheet',body:'Due tomorrow',tag:'task-1'})}});
 assert.equal(shown[0].o.badge,'badge-96.png');assert.equal(shown[0].o.tag,'task-1');assert.deepEqual(badges,[2]);console.log('PASS push uses the transparent status-bar badge and sets the app icon count');
 tray=[];await fire('notificationclose',{notification:{}});assert.deepEqual(badges,[2,0]);console.log('PASS dismissing the last notification clears the app icon count');
 assert.ok(shell.includes('badge-96.png'));console.log('PASS the badge icon is precached for offline');
 // 31 Oct 2026 · do-at reminders show as a system notification while the app is open; tapping one starts that task in the open page
 const clickRun=async taskId=>{const log=[],ch={};
  const win={url:'https://example.test/studentos-ai/',postMessage(m){log.push(['msg',m]);},async focus(){log.push(['focus']);return win;},async navigate(u){log.push(['nav',u]);return win;}};
  vm.runInNewContext(source,{URL,location:{origin:'https://example.test'},caches,fetch:async()=>{throw Error('offline');},
   self:{addEventListener:(event,fn)=>{ch[event]=fn;},skipWaiting:async()=>{},
    clients:{claim:async()=>{},async matchAll(){return [win];},async openWindow(u){log.push(['open',u]);}},
    registration:{scope:'https://example.test/studentos-ai/',async getNotifications(){return [];}}}});
  const pending=[];ch.notificationclick({waitUntil(p){pending.push(p);},notification:{close(){},data:Object.assign({url:'/studentos-ai/'},taskId?{taskId}:{})}});
  await Promise.all(pending);return JSON.parse(JSON.stringify(log));};
 assert.deepEqual(await clickRun('t-42'),[['msg',{type:'start-task',id:'t-42'}],['focus']]);console.log('PASS tapping a task notification posts start-task to the open page instead of reloading it');
 assert.equal((await clickRun(null))[0][0],'nav');console.log('PASS a plain notification still navigates to its url');
 // 31 Oct 2026 · do-at pushes from the server get the start button, stay on desktop, and carry the task id (no send-reminders deploy needed)
 {const ds=[],dh={},opened=[];
  vm.runInNewContext(source,{URL,location:{origin:'https://example.test'},caches,fetch:async()=>{throw Error('offline');},
   self:{addEventListener:(event,fn)=>{dh[event]=fn;},skipWaiting:async()=>{},
    clients:{claim:async()=>{},async matchAll(){return [];},async openWindow(u){opened.push(u);}},
    registration:{scope:'https://example.test/studentos-ai/',async showNotification(t,o){ds.push(JSON.parse(JSON.stringify(o)));},async getNotifications(){return [];}}}});
  const fire=async(ev,extra)=>{const pending=[];dh[ev](Object.assign({waitUntil(p){pending.push(p);}},extra));await Promise.all(pending);};
  await fire('push',{data:{json:()=>({title:'Physics',body:'Time to do it',tag:'do-t9',url:'./'})}});
  await fire('push',{data:{json:()=>({title:'Physics',body:'Due tomorrow',tag:'task-1',url:'./'})}});
  assert.deepEqual(ds[0].actions,[{action:'start',title:'เริ่มเลย'}]);assert.equal(ds[0].requireInteraction,true);assert.equal(ds[0].data.taskId,'t9');
  assert.deepEqual(ds[1].actions,[]);assert.equal(ds[1].requireInteraction,false);assert.equal(ds[1].data.taskId,undefined);
  console.log('PASS do-at pushes get the start button and stay on desktop; other reminders unchanged');
  await fire('notificationclick',{action:'start',notification:{close(){},data:{url:'/studentos-ai/',taskId:'t-42'}}});
  assert.equal(opened[0],'https://example.test/studentos-ai/?do=t-42');
  console.log('PASS tapping start with the app closed opens it with ?do=<task>');}
 console.log('Main service worker: 14/14');
})().catch(error=>{console.error(error);process.exitCode=1;});
