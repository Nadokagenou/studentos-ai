/* Read-only release audit. node .../launch-assets.cjs [--live] [--report=path.json] */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),base=new URL('https://nadokagenou.github.io/studentos-ai/');
const paths=new Set(),missing=[],outside=[],external=new Set();
function add(ref,from){
 if(!ref||ref.startsWith('#')||ref.includes('${')||ref.includes('var('))return;
 if(/^(https?:|\/\/|data:|blob:|mailto:|javascript:)/i.test(ref)){if(/^https?:/i.test(ref))external.add(ref);return;}
 const clean=decodeURIComponent(ref.split(/[?#]/)[0]);if(!clean||clean.startsWith('#'))return;
 let file=path.resolve(root,path.dirname(from),clean);
 if(!file.startsWith(root+path.sep)){outside.push({from,ref});return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 const rel=path.relative(root,file).replaceAll(path.sep,'/');
 if(!fs.existsSync(file)){missing.push({from,ref,target:rel});return;}
 paths.add(rel);
}
const entries=['alt/index.html','alt/halloween/event/index.html','alt/halloween/event/rewards.html','alt/halloween/rewards/vault.html','alt/halloween/rewards/cinematic-preview.html'];
for(const entry of entries){paths.add(entry);const s=fs.readFileSync(path.join(root,entry),'utf8');for(const m of s.matchAll(/\b(?:src|href)=["']([^"']+)["']/g))add(m[1],entry);}
for(const dir of ['alt/halloween/event','alt/halloween/event/assets','alt/halloween/event/data','alt/halloween/rewards/assets','alt/halloween/rewards/theme-assets','alt/halloween/rewards/profile-assets']){
 for(const file of fs.readdirSync(path.join(root,dir),{withFileTypes:true}))if(file.isFile()&&/\.(?:js|css|json|svg|png|webp|html)$/.test(file.name))paths.add(dir+'/'+file.name);
}
const manifest=fs.readFileSync(path.join(root,'alt/halloween/cache-manifest.js'),'utf8');
for(const ref of JSON.parse(manifest.slice(manifest.indexOf('['),manifest.lastIndexOf(']')+1)))add(ref,'alt/index.html');
const catalog=require('../rewards/catalog.js');for(const item of catalog.items)add(item.asset||'assets/'+item.id+'.svg','alt/halloween/rewards/vault.html');
const scanned=new Set();for(const file of paths){if(!file.endsWith('.css')||scanned.has(file))continue;scanned.add(file);for(const m of fs.readFileSync(path.join(root,file),'utf8').matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g))add(m[1],file);}
async function main(){
 const live=process.argv.includes('--live'),rows=[],queue=[...paths].sort();let cursor=0;
 if(live)await Promise.all(Array.from({length:6},async()=>{while(cursor<queue.length){const file=queue[cursor++];try{const r=await fetch(new URL(file,base),{method:'HEAD',signal:AbortSignal.timeout(15000),redirect:'follow'});rows.push({file,status:r.status});}catch(error){rows.push({file,status:0,error:error.name});}}}));
 const failed=rows.filter(x=>x.status!==200),report={checkedAt:new Date().toISOString(),localFiles:paths.size,missing,outside,externalReferences:[...external],live,liveFiles:rows.length,failed};
 const output=process.argv.find(x=>x.startsWith('--report='))?.slice(9);if(output){const file=path.resolve(root,output);if(!file.startsWith(root+path.sep))throw Error('Report must stay inside repository');fs.writeFileSync(file,JSON.stringify({...report,rows},null,2)+'\n');}
 console.log(JSON.stringify(report,null,2));if(missing.length||outside.length||failed.length)process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
