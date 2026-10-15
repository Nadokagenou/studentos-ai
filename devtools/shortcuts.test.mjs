import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../',import.meta.url);
const source = fs.readFileSync(new URL('shortcut-draft.js',root),'utf8');
function harness({route='assistant',text='เซต A ∪ B <script>alert(1)</script>',cached=null,storageFails=false}={}) {
  const records = new Map(cached ? [['studentos.shortcutDraft',JSON.stringify(cached)]] : []);
  const nodes={};const changes=[];
  const ctx={URLSearchParams,Event,Date,Number,JSON,location:{pathname:'/studentos-ai/',search:'?go='+route,hash:text===null?'':'#sos-draft='+encodeURIComponent(text)},history:{state:null,replaceState(...args){changes.push(args[2]);}},document:{getElementById:id=>nodes[id]||null},sessionStorage:{setItem(k,v){if(storageFails)throw Error('disabled');records.set(k,v);},getItem(k){if(storageFails)throw Error('disabled');return records.get(k)||null;},removeItem(k){records.delete(k);}}};ctx.window=ctx;vm.runInNewContext(source,ctx);return {ctx,nodes,changes,records};
}
test('assistant draft remains plain text and is never sent automatically',()=>{
 const h=harness();assert.equal(h.ctx.shortcutDraftRoute(),'assistant');assert.equal(h.changes[0],'/studentos-ai/?go=assistant');
 let inputs=0;h.nodes.aiInput={value:'',disabled:false,dispatchEvent(){inputs++;}};
 assert.equal(h.ctx.shortcutDraftApply('quick'),false);assert.equal(h.ctx.shortcutDraftApply('assistant'),true);
 assert.match(h.nodes.aiInput.value,/<script>/);assert.equal(inputs,1);assert.equal(h.ctx.shortcutDraftApply('assistant'),false);assert.equal(h.records.size,0);
});
test('quick draft waits for login and sheet, then caps at 500 characters',()=>{
 const h=harness({route:'quick',text:'ก'.repeat(700)});assert.equal(h.ctx.shortcutDraftApply('quick'),false);
 h.nodes.qaIn={value:'',dispatchEvent(){}};assert.equal(h.ctx.shortcutDraftApply('quick'),true);assert.equal(h.nodes.qaIn.value.length,500);
});
test('do not overwrite existing text or disabled AI while loading',()=>{
 const h=harness();h.nodes.aiInput={value:'งานที่ฉันพิมพ์เอง',dispatchEvent(){}};assert.equal(h.ctx.shortcutDraftApply('assistant'),false);
 h.nodes.aiInput.value='';h.nodes.aiInput.disabled=true;assert.equal(h.ctx.shortcutDraftApply('assistant'),false);
});
test('draft survives reload without URL and expires after ten minutes',()=>{
 const cached={route:'quick',text:'เคมีส่งพรุ่งนี้',at:Date.now()-10000};
 const h=harness({route:'today',text:null,cached});assert.equal(h.ctx.shortcutDraftRoute(),'quick');
 const expired=harness({text:null,cached:{...cached,at:Date.now()-610000}});assert.equal(expired.ctx.shortcutDraftRoute(),null);assert.equal(expired.records.size,0);
});
test('storage disabled still allows a one-time draft in memory',()=>{
 const h=harness({storageFails:true});h.nodes.aiInput={value:'',dispatchEvent(){}};assert.equal(h.ctx.shortcutDraftApply('assistant'),true);
});
test('unknown route or malformed draft must not redirect or execute',()=>{
 const h=harness({route:'https://evil.example',text:'hello'});assert.equal(h.ctx.shortcutDraftRoute(),null);
 const invalid=harness({text:null,cached:{route:'javascript:alert(1)',text:'hi',at:Date.now()}});assert.equal(invalid.ctx.shortcutDraftRoute(),null);
});
test('manifest routes resolve and after-login preserves the shortcut',()=>{
 const app=fs.readFileSync(new URL('app.js',root),'utf8');
 const block=app.slice(app.indexOf('const SHORTCUT_SCREENS'),app.indexOf('// หน้าแนะนำ (land.html)',app.indexOf('const SHORTCUT_SCREENS')));
 for (const item of JSON.parse(fs.readFileSync(new URL('manifest.json',root),'utf8')).shortcuts) {
   const route=new URL(item.url,'https://example.test/').searchParams.get('go');
   const ctx={BOOT_Q:new URLSearchParams('go='+route),sessionStorage:{getItem(){return null},setItem(){}},Date,setTimeout(fn){fn()},quickOpen(){ctx.opened=true}};
   vm.runInNewContext(block+';globalThis.target=shortcutTarget();globalThis.second=shortcutTarget();',ctx);
   assert.ok(['scr-menu','scr-tasks','scr-ai'].includes(ctx.target));assert.equal(ctx.second,null);
   if(route==='quick')assert.equal(ctx.opened,true);
 }
 const after=app.slice(app.indexOf('function routeAfterLogin()'),app.indexOf('function openOnboard()'));
 assert.match(after,/go\(shortcutTarget\(\) \|\| 'scr-menu'\)/);
});
test('main service worker preserves ALT caches and ignores ALT requests',async()=>{
 const handlers={};const deleted=[];const opened=[];let handled=false;
 const caches={async keys(){return ['studentos-alt-1c57','studentos-1c57','studentos-main-1c57-old','unrelated'];},async delete(k){deleted.push(k);},async open(k){opened.push(k);return {match(){return 'main-only';}}}};
 const ctx={URL,Promise,location:{origin:'https://example.test'},self:{registration:{scope:'https://example.test/studentos-ai/'},addEventListener(k,v){handlers[k]=v;},clients:{claim(){}}},caches};
 vm.runInNewContext(fs.readFileSync(new URL('sw.js',root),'utf8'),ctx);
 let completion;handlers.activate({waitUntil(p){completion=p;}});await completion;
 assert.deepEqual(deleted,['studentos-1c57','studentos-main-1c57-old']);
 handlers.fetch({request:{method:'GET',url:'https://example.test/studentos-ai/alt/app.js'},respondWith(){handled=true;}});assert.equal(handled,false);
});
test('quick entry failure keeps input and sheet open for retry',()=>{
 const source=fs.readFileSync(new URL('quickadd.js',root),'utf8');
 const send=source.slice(source.indexOf('function quickSend()'),source.indexOf('function quickToast('));
 let closed=false;let rendered=false;const input={value:'รายงานชีวะ ส่งพรุ่งนี้'};
 const ctx={document:{getElementById(){return input}},inboxAdd(){return {status:'failed'}},quickToast(){return {}},showToast(){},quickClose(){closed=true},renderAll(){rendered=true},quickPlusDraft:input.value};
 vm.runInNewContext(send+';quickSend();',ctx);assert.equal(closed,false);assert.equal(rendered,false);assert.equal(input.value,'รายงานชีวะ ส่งพรุ่งนี้');assert.equal(ctx.quickPlusDraft,input.value);
});
test('accepted inline capture clears draft and closes once without navigating',()=>{
 const source=fs.readFileSync(new URL('quickadd.js',root),'utf8');const send=source.slice(source.indexOf('function quickSend()'),source.indexOf('function quickToast('));
 let closed=0;let saved=0;const ctx={document:{getElementById(){return {value:'รายงานชีวะ ส่งพรุ่งนี้'}}},inboxAdd(){saved++;return {status:'accepted'}},quickToast(){return {}},showToast(){},quickClose(){closed++},renderAll(){},quickPlusDraft:'old'};
 vm.runInNewContext(send+';quickSend();',ctx);assert.equal(saved,1);assert.equal(closed,1);assert.equal(ctx.quickPlusDraft,'');
});
