import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../event/experience.js',import.meta.url),'utf8');
test('NPC dialogue shows Thai characters while its matching voice runs; reduced motion shows the full line',()=>{
 const code=source.slice(source.indexOf('  function typeDialogue(){'),source.indexOf('  function showPanel('));
 for(const still of [false,true]){
  let frame,finished=false,voice;const row={textContent:'ออกเดินทางกัน',style:{},dataset:{},getBoundingClientRect:()=>({height:24}),replaceChildren(a,b){this.shown=b;}};
  const context={detail:{querySelector(s){return s==='[data-npc-sprite]'?{dataset:{npcSprite:'tang'}}:s==='h2'?{textContent:'Tang The Sailor'}:s==='.dialog-footer'?{before(){}}:row;},querySelectorAll:()=>[row]},audio:{syllable(id){voice=id;}},window:{HalloweenNPCs:{characters:{}}},reduced:()=>still,dialogueEpoch:0,typingLines:[],typingFrame:0,document:{hidden:false,createElement:()=>({setAttribute(){},addEventListener(){}})},Intl,performance:{now:()=>0},requestAnimationFrame:fn=>{frame=fn;return 1;},finishTyping:()=>{finished=true;}};
  vm.runInNewContext(code+'\ntypeDialogue();',context);assert.equal(voice,'tang');if(still){assert.equal(frame,undefined);assert.equal(row.textContent,'ออกเดินทางกัน');}else{frame(36);assert.ok(row.shown.textContent.length>0);frame(9999);assert.ok(finished);}
 }
});
