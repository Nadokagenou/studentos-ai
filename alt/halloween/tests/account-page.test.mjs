import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../event/experience.js',import.meta.url),'utf8');
test('an open gate refreshes on the server season transition, while guests are not repeatedly shown login errors',async()=>{
 const code=source.slice(source.indexOf('  const refreshAccount=async'),source.indexOf("  window.addEventListener('online'"));
 for(const [phase,playable,remote,fails,reloads,toasts] of [['upcoming',false,'active',false,1,0],['upcoming',false,'upcoming',true,0,0],['active',true,'active',true,0,1],['active',true,'ended',false,1,0]]){
  let reload=0,toast=0;const context={account:{refresh:async()=>{if(fails)throw Error('เข้าสู่ระบบ');return {phase:remote};}},phase,playable,location:{reload(){reload++;}},toast(){toast++;},updateWallet(){},updateDeathProgress(){},detail:{open:false},document:{getElementById:()=>({open:false})},render(){}};
  await vm.runInNewContext(code+'\nrefreshAccount();',context);assert.equal(reload,reloads,phase+' → '+remote);assert.equal(toast,toasts);
 }
});
