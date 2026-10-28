// Run the existing synchronization scenarios against the main entry's actual code.
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../alt/devtools');
const source=fs.readFileSync(path.join(dir,'syncbench.cjs'),'utf8');
const before="path.join(repo, 'alt/app.js')",after="path.join(repo, 'app.js')";
if(!source.includes(before))throw Error('Synchronization harness source selector changed');
new Function('require','__dirname','process',source.replace(before,after))(require,dir,process);
