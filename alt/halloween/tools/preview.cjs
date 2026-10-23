/* พรีวิวในเครื่อง ไม่ต่อบัญชีหรือใช้ service worker ของเว็บจริง */
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const root = path.resolve(__dirname,'../../..');
const port = Number(process.argv.find(x => /^--port=\d+$/.test(x))?.split('=')[1] || 4199);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp','.png':'image/png','.mjs':'text/javascript; charset=utf-8'};
http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://127.0.0.1:'+port);
    if (url.pathname==='/') { res.writeHead(302,{Location:'/alt/halloween/event/?preview=1'}); res.end(); return; }
    if (url.pathname==='/alt/config.js') { res.writeHead(200,{'Content-Type':mime['.js']}); res.end('window.SUPABASE_CONFIG={};'); return; }
    if (url.pathname==='/alt/sw.js') { res.writeHead(200,{'Content-Type':mime['.js'],'Cache-Control':'no-store'}); res.end("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));"); return; }
    const pathname = decodeURIComponent(url.pathname).replace(/\/$/,'/index.html');
    const target = path.resolve(root,'.'+pathname);
    if (!target.startsWith(root+path.sep) || pathname.split('/').some(x => x.startsWith('.'))) { res.writeHead(403); res.end(); return; }
    const body = await fs.readFile(target);
    res.writeHead(200,{'Content-Type':mime[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port,'127.0.0.1',() => console.log('Halloween preview: http://127.0.0.1:'+port+'/alt/halloween/event/?preview=1'));
