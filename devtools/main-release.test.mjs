import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Access=require('../halloween/rewards/entitlements.js');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
const receipt=owner=>({owner,season:'halloween-2026',rewards:{'theme-ghostship':{id:'theme-ghostship',permanent:true,receipt:'verified-test'}}});

test('same-account refresh retains verified themes until an authoritative answer arrives',async()=>{
 let release,slow=false,fail=false,owner='a';
 const reader=Access.create({owner:()=>owner,createAccount:()=>({refresh:()=>slow?new Promise((r,j)=>release=()=>fail?j(Error('offline')):r()):Promise.resolve(),read:()=>receipt(owner),dispose(){}})});
 await reader.refresh();assert.equal(reader.owns('theme-ghostship'),true);
 slow=true;const job=reader.refresh(true);assert.equal(reader.owns('theme-ghostship'),true);await Promise.resolve();release();await job;
 fail=true;const failure=reader.refresh(true);await Promise.resolve();release();await failure;assert.equal(reader.owns('theme-ghostship'),false);
 fail=false;slow=false;await reader.refresh(true);slow=true;const old=reader.refresh(true);await Promise.resolve();owner='b';assert.equal(reader.owns('theme-ghostship'),false);release();await old;assert.equal(reader.owns('theme-ghostship'),false);
});
