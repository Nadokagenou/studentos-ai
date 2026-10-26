import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../../../',import.meta.url);
test('both app entries deny reward writes even when the transport cannot load',()=>{
 for(const file of ['index.html','alt/index.html']){
  const html=fs.readFileSync(new URL(file,root),'utf8'),match=html.match(/<script data-economy-guard>([\s\S]*?)<\/script>/);
  assert.ok(match,file+' must contain its own fail-closed guard');
  assert.ok(html.indexOf(match[0])<html.indexOf('src="app.js"'));
  const window={};vm.runInNewContext(match[1],{window});
  assert.equal(window.StudentOSEconomy.tokens().bal,0);assert.equal(window.StudentOSEconomy.admin(),false);
  assert.equal(window.StudentOSEconomy.ownsBadge('genesis'),false);
  assert.equal(window.StudentOSEconomy.ownsTheme('meta'),false);
  assert.equal(window.StudentOSEconomy.ownsTheme('light'),null);
  assert.ok(html.includes('economy/client.js'));assert.ok(html.includes('economy/focus-checkpoints.js'));
 }
});
test('preview guard preserves the isolated showroom without granting account rights',()=>{
 const html=fs.readFileSync(new URL('alt/index.html',root),'utf8'),source=html.match(/<script data-economy-guard>([\s\S]*?)<\/script>/)?.[1];assert.ok(source);
 const window={__HW_SHOWROOM__:true};vm.runInNewContext(source,{window});assert.equal(window.StudentOSEconomy,undefined);
});
