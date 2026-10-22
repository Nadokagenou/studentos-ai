const fs=require('node:fs'),path=require('node:path'),C=require('../rewards/catalog.js');
const prefix='halloween/rewards/';
const files=['halloween/cache-manifest.js',...['preview-mode.js','catalog.js','runtime.js','integration.js','effect-games.js','effect-games.css','theme-main.css','theme-main.js','biome-themes.css'].map(x=>prefix+x),...['night-academy.svg','graveyard.svg','sai-witch.webp','hook-mummy.webp','app-icon.webp'].map(x=>prefix+'theme-assets/'+x),...C.items.filter(x=>x.kind!=='costume').map(x=>prefix+'assets/'+x.id+'.svg')];
fs.writeFileSync(path.resolve(__dirname,'../cache-manifest.js'),'// Permanent rewards only. event/ can be removed without breaking installation.\nself.HALLOWEEN_SHELL = '+JSON.stringify(files,null,2)+';\n');
console.log(files.length+' permanent Halloween resources.');
