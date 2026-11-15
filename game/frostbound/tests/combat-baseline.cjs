const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const readCombat=require("./fixtures/read-combat.cjs");

test("v4.0.1 attack timings, collision parameters, stamina, recovery and active cooldowns are preserved",()=>{
  assert.deepEqual(readCombat(path.resolve(__dirname,"..")),require("./fixtures/combat-v401.json"));
});
