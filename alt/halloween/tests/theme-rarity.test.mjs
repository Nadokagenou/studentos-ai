import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),R=require('../rewards/theme-rarity.js'),C=require('../rewards/catalog.js');
const source={catalog:C,spinTable:[{kind:'skin',theme:'earth',rarity:'rare'},{kind:'skin',theme:'ocean',rarity:'legendary'},{kind:'skin',theme:'meta',rarity:'secret'}],shop:{warm:{}},craft:{earth2:{}}};
test('theme categories follow existing reward and draw metadata without changing unlock rules',()=>{
 for(const[id,tier]of Object.entries({system:'basic',light:'basic',dark:'basic',warm:'uncommon',earth:'rare',ocean:'legendary',meta:'secret','hw-vampire':'epic',halloween:'secret',moonlight:'secret',earth2:'secret',genesis:'mythical',astral:'secret','thai-ghost':'limited'}))assert.equal(R.classify(id,source),tier,id);
 const before=JSON.stringify(source);R.classify('future-theme',source);assert.equal(JSON.stringify(source),before);assert.equal(R.classify('future-theme',source),'basic');
});
test('visible groups count only the shown buttons and never disclose hidden secret IDs',()=>{
 const input=[{id:'light',visible:true},{id:'meta',visible:false},{id:'halloween',visible:true},{id:'thai-ghost',visible:true},{id:'future-theme',visible:true}],groups=R.groups(input,source);
 assert.deepEqual(groups.map(g=>g.tier),['basic','secret','limited']);assert.deepEqual(groups.flatMap(g=>g.ids),['light','future-theme','halloween','thai-ghost']);assert.ok(!JSON.stringify(groups).includes('meta'));assert.equal(groups.reduce((s,g)=>s+g.ids.length,0),4);
});
