import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../event/core.js'),Catalog=require('../rewards/catalog.js');
const load=file=>JSON.parse(fs.readFileSync(new URL('../event/data/'+file,import.meta.url),'utf8'));
const config=Core.build({materials:load('materials.json'),chains:['dutchman','jack','vampire','graveyard'].map(n=>load('quests.'+n+'.json')),catalog:Catalog,proposals:load('preview-rules.json'),preview:true});
function harness({preview=true,clockSkew=0}={}){
 let clock=Date.parse('2026-10-24T10:20:00+07:00'),doc=Core.initial(config,'review',clock,42),calls=0,hold=null,market;
 doc.event.candy=1000;doc.event.location={kind:'room',room:'shop'};
 const listeners={},root={dataset:{scenePanel:'counter'},open:true,addEventListener:(n,fn)=>listeners[n]=fn,querySelector:()=>({focus(){},getBoundingClientRect:()=>({left:200,right:400,top:100,bottom:300})}),querySelectorAll:()=>[],classList:{add(){},remove(){}},append(){},setPointerCapture(){}};
 const context={window:{},Date:class extends Date{static now(){return clock+clockSkew;}},Intl,Math,document:{createElement:()=>({style:{},remove(){}})}};
 let source=fs.readFileSync(new URL('../event/market.js',import.meta.url),'utf8');
 if(process.env.HW_COUNTER_REGRESSION)source=source.replace('if(busy)return true;','');
 vm.runInNewContext(source,context);
 market=context.window.HalloweenMarket.create({Core,preview,clock:()=>clock,config:()=>config,read:()=>structuredClone(doc),now:()=>Core.moment(doc,clock),detail:root,refresh:()=>market.view(),audio:{play(){}},onRewards(){},esc:String,asset:i=>i.id+'.svg',name:id=>id,duration:String,portrait:()=>'',cropArt:()=>'',perform:async action=>{calls++;if(hold)await hold;const next=structuredClone(doc);try{const r=Core.dispatch(next,config,action,{now:clock,tx:'ui-'+calls});doc=next;return r;}catch{return null;}}});
 const click=(action,id)=>market.handle({dataset:{market:action,product:id}});
 return {market,click,listeners,doc:()=>doc,calls:()=>calls,advance:()=>clock+=Core.HOUR,pause:()=>{let resolve;hold=new Promise(r=>resolve=r);return resolve;}};
}

test('live shop labels account stock while trial shop stays explicitly isolated',()=>{
 const live=harness({preview:false}).market.view(),trial=harness({preview:true}).market.view();
 assert.doesNotMatch(live,/ห้องลอง|ทดลอง/);assert.match(live,/บัญชี/);assert.match(trial,/ห้องลอง/);assert.match(trial,/ทดลอง/);
});
test('shop shelf and its quote use the calibrated clock even when device time is an hour ahead',async()=>{
 for(const offset of [0,Core.HOUR]){const h=harness({preview:false,clockSkew:Core.HOUR});h.doc().event.timeOffset=offset;const stock=Core.shopStock(h.doc(),config,h.doc().event.clock),id=Object.keys(stock.remaining).find(id=>stock.remaining[id]);
 await h.click('pick',id);await h.click('place');await h.click('confirm');assert.ok(h.doc().rewards[id]);assert.equal(h.calls(),1);}
});
test('pick, quantity, place and return never spend; mobile confirmation commits only once while busy',async()=>{
 const h=harness(),s=Core.shopStock(h.doc(),config,h.doc().event.clock),id=Object.keys(s.remaining).find(id=>s.remaining[id]);
 await h.click('pick',id);await h.click('place');assert.equal(h.calls(),0);assert.match(h.market.view(),/เอาคืนจากตาชั่ง/);
 await h.click('return');assert.equal(h.calls(),0);assert.equal(h.doc().event.candy,1000);
 await h.click('pick',id);await h.click('place');const release=h.pause(),first=h.click('confirm'),second=h.click('confirm'),count=h.calls();release();await Promise.all([first,second]);assert.equal(count,1);
 assert.equal(h.doc().event.candy,1000-config.proposals.shop[id]);assert.ok(h.doc().rewards[id]);await h.click('confirm');assert.equal(h.calls(),1);
});
test('sell flow caps quantity to homegrown stock, requires placement and updates both inventories once',async()=>{
 const h=harness(),biome=Core.BIOMES[1],crop=config.proposals.crops[biome];h.doc().event.inventory[crop.harvest]=8;h.doc().event.grown[crop.harvest]=2;
 h.market.setMode('sell');await h.click('pick',biome);await h.click('plus');await h.click('plus');await h.click('confirm');assert.equal(h.calls(),0);
 await h.click('place');assert.match(h.market.view(),/◈ 20/);await h.click('confirm');assert.equal(h.calls(),1);assert.equal(h.doc().event.candy,1020);assert.equal(h.doc().event.inventory[crop.harvest],6);assert.equal(h.doc().event.grown[crop.harvest],0);
});
test('restocking clears the old scale quote without changing ownership or Candy',async()=>{
 const h=harness(),s=Core.shopStock(h.doc(),config,h.doc().event.clock),id=Object.keys(s.remaining).find(id=>s.remaining[id]);h.market.view();await h.click('pick',id);await h.click('place');h.advance();h.market.tick();
 assert.match(h.market.view(),/รถสินค้าเติมรอบใหม่/);await h.click('confirm');assert.equal(h.calls(),0);assert.equal(h.doc().event.candy,1000);
});
test('desktop pointer drop stages the item and suppresses its trailing click without auto-purchasing',async()=>{
 const h=harness(),s=Core.shopStock(h.doc(),config,h.doc().event.clock),id=Object.keys(s.remaining).find(id=>s.remaining[id]),button={disabled:false,dataset:{product:id}},target={closest:()=>button};
 h.market.view();h.listeners.pointerdown({target,button:0,pointerId:1,clientX:20,clientY:20});h.listeners.pointermove({pointerId:1,clientX:250,clientY:150,preventDefault(){}});h.listeners.pointerup({pointerId:1,clientX:250,clientY:150});
 assert.match(h.market.view(),/เอาคืนจากตาชั่ง/);assert.equal(h.calls(),0);let stopped=false;h.listeners.click({preventDefault(){},stopPropagation(){stopped=true;}});assert.ok(stopped);
 await h.click('confirm');assert.equal(h.calls(),1);
});
test('cancelled pointer drag leaves the scale unconfirmed and the save untouched',()=>{
 const h=harness(),s=Core.shopStock(h.doc(),config,h.doc().event.clock),id=Object.keys(s.remaining).find(id=>s.remaining[id]),target={closest:()=>({disabled:false,dataset:{product:id}})};
 h.listeners.pointerdown({target,button:0,pointerId:2,clientX:20,clientY:20});h.listeners.pointermove({pointerId:2,clientX:250,clientY:150,preventDefault(){}});h.listeners.pointercancel({pointerId:2,clientX:250,clientY:150});
 assert.match(h.market.view(),/data-market="confirm" class="primary" disabled/);h.listeners.close();assert.match(h.market.view(),/จานตาชั่งว่าง/);assert.equal(h.calls(),0);assert.equal(h.doc().event.candy,1000);
});
