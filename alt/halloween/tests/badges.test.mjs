import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),B=require('../rewards/badges.js');
const earned=id=>({id,receipt:'server-receipt',permanent:true});
test('both event badges appear without granting them or changing the reward document',()=>{
 const doc={owner:'a',rewards:{'midnight-conqueror':earned('midnight-conqueror')}},before=JSON.stringify(doc),rows=B.entries({owner:'a',document:doc});
 assert.deepEqual(rows.map(x=>x.id),['midnight-conqueror','crown-of-midnight']);assert.deepEqual(rows.map(x=>x.owned),[true,false]);assert.equal(JSON.stringify(doc),before);
});
test('showroom, another owner, themes alone and malformed receipts never imply earned badges',()=>{
 const doc={owner:'a',rewards:{'midnight-conqueror':earned('midnight-conqueror'),'crown-of-midnight':earned('crown-of-midnight')}};
 for(const options of [{owner:'b',document:doc},{owner:null,document:doc},{owner:'a',document:doc,preview:true},{owner:'a',document:{owner:'a',rewards:{'theme-midnight-academy':earned('theme-midnight-academy')}}},{owner:'a',document:{owner:'a',rewards:{'midnight-conqueror':{id:'midnight-conqueror',permanent:true}}}}])assert.ok(B.entries(options).every(x=>!x.owned));
});
function harness(){let owner='a',reads=0,disposed=0,resolve;const jobs=[];const reader=B.createReader({owner:()=>owner,clock:()=>1000,create:()=>({refresh(){reads++;return new Promise(r=>{resolve=r;jobs.push(r);});},read:()=>({owner:'a',rewards:{'midnight-conqueror':earned('midnight-conqueror')}}),dispose(){disposed++;}})});return {reader,jobs,resolve:()=>resolve(),get reads(){return reads;},get disposed(){return disposed;},switchUser(id){owner=id;}};}
test('opening the page deduplicates reads and a recent verified snapshot is reused',async()=>{
 const h=harness();const a=h.reader.refresh(),b=h.reader.refresh();await Promise.resolve();assert.equal(h.reads,1);h.resolve();await Promise.all([a,b]);assert.equal(h.reader.view().status,'ready');assert.ok(h.reader.view().entries[0].owned);await h.reader.refresh();assert.equal(h.reads,1);
});
test('a delayed response from the previous account cannot paint the new account',async()=>{
 const h=harness(),p=h.reader.refresh();await Promise.resolve();h.switchUser('b');assert.equal(h.reader.view().status,'idle');h.resolve();await p;assert.ok(h.reader.view().entries.every(x=>!x.owned));assert.equal(h.disposed,1);
});
test('signed-out users do not call the account service and cannot see the old receipt',async()=>{
 const h=harness(),p=h.reader.refresh();await Promise.resolve();h.resolve();await p;h.switchUser(null);await h.reader.refresh();assert.equal(h.reads,1);assert.equal(h.reader.view().status,'login');assert.ok(h.reader.view().entries.every(x=>!x.owned));
});
test('switching accounts before a queued read starts never creates a reader for the old request',async()=>{
 const h=harness(),p=h.reader.refresh();h.switchUser('b');h.reader.view();await p;assert.equal(h.reads,0);assert.equal(h.reader.view().status,'idle');
});
test('an auth clear immediately removes the last verified badge without another network call',async()=>{
 let changed;const reader=B.createReader({owner:()=> 'a',create:cb=>{changed=cb;return {async refresh(){},read:()=>({owner:'a',rewards:{'midnight-conqueror':earned('midnight-conqueror')}}),dispose(){}};}});await reader.refresh();assert.ok(reader.view().entries[0].owned);changed(null);assert.equal(reader.view().status,'idle');assert.ok(reader.view().entries.every(x=>!x.owned));
});
test('an unavailable account service stays unverified and can retry',async()=>{
 let attempts=0;const reader=B.createReader({owner:()=> 'a',create:()=>({async refresh(){if(++attempts===1)throw Error('offline');},read:()=>({owner:'a',rewards:{}}),dispose(){}})});await reader.refresh();assert.equal(reader.view().status,'error');assert.ok(reader.view().entries.every(x=>!x.owned));await reader.refresh(true);assert.equal(reader.view().status,'ready');
});
