'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../..'),seen=new Map();
function collect(id){if(seen.has(id))return;seen.set(id,'');const s=fs.readFileSync(path.join(root,id),'utf8').replace(/require\(['"]([^'"]+)['"]\)/g,(_,ref)=>{if(!ref.startsWith('.'))throw Error('Local modules only');const next=path.posix.normalize(path.posix.join(path.posix.dirname(id),ref));collect(next);return 'require('+JSON.stringify(next)+')';});seen.set(id,s);}
collect('economy/server/engine.cjs');collect('economy/server/handler.cjs');
const bundle='// Generated from tested modules.\nconst factories={'+[...seen].map(([id,s])=>JSON.stringify(id)+':function(module,exports,require){\n'+s+'\n}').join(',')+'};const cache={};function load(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;factories[id](m,m.exports,load);return m.exports;}\nexport const Engine=load("economy/server/engine.cjs"),Handler=load("economy/server/handler.cjs");\n';
fs.writeFileSync(path.join(__dirname,'engine.mjs'),bundle);console.log('Bundled '+seen.size+' economic modules.');
const featured=path.join(root,'halloween/server/featured');
fs.writeFileSync(path.join(featured,'economy.mjs'),bundle);
fs.copyFileSync(path.join(__dirname,'rules.json'),path.join(featured,'economy-rules.json'));
