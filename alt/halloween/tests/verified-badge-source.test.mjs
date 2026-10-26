import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {coreAvailable} from '../server/featured/handler.mjs';
test('editable task and vault data never authorize a profile medal',()=>{
 assert.deepEqual(coreAvailable({tasks:[{done:true}],vault:{allBadges:true,genesis:true,tokens:{skins:{glitch:1}}}}),[]);
 assert.deepEqual(coreAvailable({verifiedBadgeIds:['hello','genesis','hello','midnight-conqueror','__proto__']}),['hello','genesis']);
});
test('deployed profile adapter reads only private wallet or frozen baseline',()=>{
 const src=fs.readFileSync(new URL('../server/featured/index.ts',import.meta.url),'utf8');
 assert.ok(!src.includes("database('user_state"));assert.ok(src.includes('studentos_economy_states'));assert.ok(src.includes('studentos_economy_baselines'));
});
