import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),G=require('../rewards/effect-games.js');
test('every Halloween effect has an interactive completion path',()=>{
 assert.equal(Object.keys(G.modes).length,8);assert.equal(G.controller('not-an-effect'),null);
 for(const id of Object.keys(G.modes)){const game=G.controller(id);assert.ok(!game.complete);for(let i=0;i<game.config.goal;i++)assert.ok(game.accept(i),id);assert.ok(game.complete,id);assert.equal(game.accept(0),false,id);}
});
test('the ship lights must be lit in order and duplicate flowers do not finish a game',()=>{
 const ship=G.controller('wake');assert.equal(ship.accept(2),false);assert.equal(ship.count,0);assert.ok(ship.accept(0));assert.equal(ship.accept(0),false);
 const garden=G.controller('bloom');assert.equal(garden.accept(5),false);assert.ok(garden.accept(2));assert.equal(garden.accept(2),false);assert.equal(garden.count,1);
});
test('a scythe swipe must cross the job and travel far enough; a tap or miss does not cut',()=>{
 const r={left:100,right:200,top:100,bottom:200};assert.ok(G.segmentHitsRect({x:50,y:150},{x:250,y:150},r));assert.ok(G.segmentHitsRect({x:150,y:50},{x:150,y:250},r));assert.ok(G.segmentHitsRect({x:50,y:50},{x:250,y:250},r));
 assert.equal(G.segmentHitsRect({x:50,y:40},{x:250,y:40},r),false);assert.equal(G.segmentHitsRect({x:150,y:150},{x:153,y:155},r),false);assert.equal(G.segmentHitsRect({x:150,y:150},{x:150,y:150},r),false);
 const jack=G.controller('verdict');assert.equal(jack.config.mode,'slash');assert.equal(jack.config.goal,3);
});
