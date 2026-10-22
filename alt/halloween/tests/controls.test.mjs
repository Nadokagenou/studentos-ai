import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../rewards/theme-main.js',import.meta.url),'utf8');
test('updating controls changes buttons while preserving the application root',()=>{
 const root={dataset:{},textContent:'APPLICATION',attrs:{},setAttribute(k,v){this.attrs[k]=v;}},button=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];}}),sound=button(),motion=button();
 const context={root,enabled:false,musicEnabled:true,motion:'full',window:{},document:{getElementById(){return null;},querySelectorAll(selector){if(selector==='[data-hw-motion]')return[root,motion];if(selector==='[data-hw-sound]')return[root,sound];return selector==='button[data-hw-motion]'?[motion]:selector==='button[data-hw-sound]'?[sound]:[];},querySelector(){return null;}}};context.parent=context.window;
 const from=source.indexOf('  function updateControls()'),to=source.indexOf('  function sound(',from);
 const program=process.env.HW_REGRESSION==='1'?source.slice(from,to).replaceAll('button[data-hw-motion]','[data-hw-motion]').replaceAll('button[data-hw-sound]','[data-hw-sound]'):source.slice(from,to);
 vm.runInNewContext(program+';updateControls();',context);
 assert.equal(root.textContent,'APPLICATION');assert.deepEqual(root.attrs,{});assert.equal(motion.textContent,'Ⅱ');assert.equal(sound.attrs['aria-pressed'],'false');
});
test('the tone toggle saves the choice and repaints the status bar only while Halloween is active',()=>{
 const from=source.indexOf('  function setTone('),to=source.indexOf('  function toggleMotion(',from);
 const run=active=>{const root={dataset:{}},saved=[],meta={content:'#F7FAFF'};const context={root,active,TONE_KEY:'studentos.alt.halloween.tone',TONE_BAR:{dark:'#170B36',light:'#F3EDFF'},write(k,v){saved.push([k,v]);},updateControls(){},document:{querySelector:s=>s==='meta[name=theme-color]'?meta:null}};
  vm.runInNewContext('let paletteTone="dark";'+source.slice(from,to)+';setTone("light");',context);return {root,saved,meta};};
 const on=run(true);
 assert.equal(on.root.dataset.hwTone,'light');assert.deepEqual(on.saved,[['studentos.alt.halloween.tone','light']]);assert.equal(on.meta.content,'#F3EDFF');
 assert.equal(run(false).meta.content,'#F7FAFF');
});
