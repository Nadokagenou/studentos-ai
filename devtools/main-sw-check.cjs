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
 for(const file of shell)assert.ok(fs.existsSync(path.join(root,file)),'Missing SHELL file: '+file);console.log('PASS all main shell files exist');
 await lifecycle('activate');assert.deepEqual(removed,['studentos-main-previous','studentos-1c57']);console.log('PASS update preserves ALT and other application caches');
 let response;handlers.fetch({request:{method:'GET',url:'https://example.test/studentos-ai/desktop.css?v=review'},respondWith(p){response=p;}});
 assert.equal(await response,'main-desktop-css');assert.equal(matches[0].key,selected);assert.equal(matches[0].options.ignoreSearch,true);console.log('PASS offline desktop uses the current main cache');
 handlers.fetch({request:{method:'GET',url:'https://example.test/studentos-ai/alt/index.html'},respondWith(){throw Error('Main must not intercept ALT');}});console.log('PASS main worker leaves ALT requests alone');
 let shared;handlers.fetch({request:{method:'GET',url:'https://example.test/studentos-ai/halloween/rewards/theme-main.js?rev=release'},respondWith(p){shared=p;}});
 assert.equal(await shared,'main-desktop-css');assert.equal(matches.at(-1).key,selected);console.log('PASS shared reward presentation can fall back to the current main offline cache');
 assert.ok(shell.includes('sai-face-sleepy.webp'));assert.ok(shell.includes('hook-hat-avatar.svg'));
 console.log('Main service worker: 6/6');
})().catch(error=>{console.error(error);process.exitCode=1;});
