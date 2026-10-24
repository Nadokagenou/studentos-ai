'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const entries=['event/core.js','rewards/catalog.js','event/season.js','server/authority.cjs','server/handler.cjs'],seen=new Map();
function collect(id){if(seen.has(id))return;let source=fs.readFileSync(path.join(root,id),'utf8');seen.set(id,'');source=source.replace(/require\(['"]([^'"]+)['"]\)/g,(_,ref)=>{if(!ref.startsWith('.'))throw Error('Only local dependencies');const target=path.posix.normalize(path.posix.join(path.posix.dirname(id),ref));collect(target);return 'require('+JSON.stringify(target)+')';});seen.set(id,source);}
entries.forEach(collect);
let bundle='// Generated from the tested shared engine. Run node alt/halloween/server/build.cjs.\nconst factories={\n'+[...seen].map(([id,source])=>JSON.stringify(id)+':function(module,exports,require){\n'+source+'\n}').join(',\n')+'\n};\nconst cache={};\nfunction load(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;factories[id](m,m.exports,load);return m.exports;}\n';
bundle+='export const Core=load("event/core.js"),Catalog=load("rewards/catalog.js"),Death=load("death-quests.js"),Season=load("event/season.js"),Authority=load("server/authority.cjs"),Handler=load("server/handler.cjs");\n';
fs.writeFileSync(path.join(__dirname,'engine.mjs'),bundle);
const json=name=>JSON.parse(fs.readFileSync(path.join(root,'event/data',name+'.json'),'utf8'));
const proposals=json('preview-rules');proposals.status='owner-confirmed-2026-10-24';proposals.notice='กติกาอีเวนต์ ALT ตรวจและบันทึกผ่านบริการบัญชีเท่านั้น';proposals.shopStock.status='owner-confirmed-2026-10-24';proposals.shopStock.scope='account-season';
fs.writeFileSync(path.join(__dirname,'rules.json'),JSON.stringify({materials:json('materials'),chains:['dutchman','jack','vampire','graveyard'].map(n=>json('quests.'+n)),proposals}));
console.log('Bundled '+seen.size+' tested modules for the event service.');
