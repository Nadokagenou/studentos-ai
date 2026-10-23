const fs=require('node:fs'),path=require('node:path');
const catalog=require('../rewards/catalog.js'),{art}=require('../rewards/art.cjs');
const folder=path.resolve(__dirname,'../rewards/assets');fs.mkdirSync(folder,{recursive:true});
for(const item of catalog.items){if(item.kind==='costume')continue;fs.writeFileSync(path.join(folder,item.id+'.svg'),art(item));}
console.log('Built '+catalog.items.filter(x=>x.kind!=='costume').length+' SVG rewards.');
