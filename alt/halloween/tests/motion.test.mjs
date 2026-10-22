import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../rewards/theme-main.js',import.meta.url),'utf8');
const start=source.indexOf('  function setMotion('),end=source.indexOf('  function burst(',start);
function harness(lite='1',quality='low'){
 const root={dataset:{hwMotion:'full',lite,quality}},saved=[];
 const context={root,write(k,v){saved.push([k,v]);},MOTION_KEY:'studentos.alt.halloween.motion',updateControls(){},window:{setGfx(level,byUser){assert.equal(byUser,true);if(level==='high'){delete root.dataset.lite;delete root.dataset.quality;}}}};
 vm.runInNewContext('let motion="full";'+source.slice(start,end)+';globalThis.api={setMotion,toggleMotion};',context);
 return {...context,saved};
}
test('opening motion explicitly leaves the graphics mode that froze the scene',()=>{const h=harness();h.api.setMotion('full');assert.equal(h.root.dataset.hwMotion,'full');assert.equal(h.root.dataset.lite,undefined);assert.equal(h.root.dataset.quality,undefined);});
test('the first tap from nominal full motion but low graphics enables movement',()=>{const h=harness();h.api.toggleMotion();assert.equal(h.root.dataset.hwMotion,'full');assert.equal(h.root.dataset.lite,undefined);});
test('tapping again pauses and preserves the saved preference',()=>{const h=harness();h.api.toggleMotion();h.api.toggleMotion();assert.equal(h.root.dataset.hwMotion,'still');assert.equal(h.saved.at(-1)[1],'still');});
test('the first tap while high graphics are already running pauses',()=>{const h=harness(undefined,undefined);delete h.root.dataset.lite;delete h.root.dataset.quality;h.api.toggleMotion();assert.equal(h.root.dataset.hwMotion,'still');});
