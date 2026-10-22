import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'../..');
const scenario=process.argv.includes('--empty')?'empty':process.argv.includes('--late')?'late':'normal';
const portArg=process.argv.find(a=>/^--port=\d+$/.test(a));
const port=portArg?Number(portArg.slice(7)):4196;
const sampleTime=scenario==='late'?'22:30':'19:00';
const themeArg=process.argv.find(a=>/^--theme=(light|dark|galaxy|magic|halloween)$/.test(a));
const theme=themeArg?themeArg.slice(8):'light';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.woff2':'font/woff2'};
const fixture=`<script>
(()=>{
 const key='studentos.alt.desktop.review.seeded';
 const RealDate=Date, target=RealDate.parse('2026-10-20T${sampleTime}:00+07:00'),offset=target-RealDate.now();
 window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[RealDate.now()+offset]))}static now(){return RealDate.now()+offset}};
 if(!localStorage.getItem(key)&&!Object.keys(localStorage).some(k=>/^sb-.*-auth-token$/.test(k))){
  const now=new Date(),due=new Date('2026-10-20T16:59:00Z');
  const base={type:'homework',teacher:'ครูตัวอย่าง',estMin:40,scorePct:15,done:false,progress:0,createdAt:now.toISOString()};
  const tasks=[{...base,id:'desktop-math',subject:'คณิตศาสตร์',detail:'แบบฝึกหัดฟังก์ชัน ข้อ 1–10',due:due.toISOString()},
  {...base,id:'desktop-bio',subject:'ชีววิทยา',detail:'สรุปบทระบบนิเวศ',estMin:30,scorePct:5,due:'2026-10-21T16:59:00Z'},
  {...base,id:'desktop-english',subject:'ภาษาอังกฤษ',detail:'A place I love — เขียนย่อหน้า',estMin:45,scorePct:5,due:'2026-10-22T16:59:00Z'},
  {...base,id:'desktop-done',subject:'ภาษาไทย',detail:'อ่านเรื่องสั้นและสรุปใจความ',done:true,doneAt:now.toISOString(),progress:100,due:due.toISOString()}];
  localStorage.setItem('studentos.alt.v1',JSON.stringify({tasks:${scenario==='empty'?'[]':'tasks'},settings:{name:'ผู้ทดสอบ',freeHours:2.5},marks:[],sessions:[],running:null}));
  localStorage.setItem('studentos.alt.skipLogin','1');localStorage.setItem('studentos.alt.onboardSkipped','1');localStorage.setItem('studentos.alt.lastScreen','scr-menu');
  localStorage.setItem('studentos.alt.checkinAsked',now.toISOString().slice(0,10));localStorage.setItem('studentos.alt.theme','${theme}');localStorage.setItem('studentos.alt.gfx','low');localStorage.setItem('studentos.alt.lite','1');localStorage.setItem(key,'1');
 }
 if(new URLSearchParams(location.search).has('halloween-preview')) { localStorage.setItem('studentos.alt.theme','halloween');localStorage.setItem('studentos.alt.gfx','high');localStorage.setItem('studentos.alt.lite','0'); }
 document.addEventListener('DOMContentLoaded',()=>{const note=document.createElement('span');note.textContent='ข้อมูลจำลอง · ${sampleTime} · ไม่เชื่อมบัญชีจริง';note.style.cssText='position:fixed;right:12px;bottom:6px;z-index:9999;background:#fff8df;color:#5d4931;padding:3px 8px;border-radius:6px;font:10px Sarabun,sans-serif;pointer-events:none';document.body.appendChild(note)});
})();
</script>`;
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  if(url.pathname==='/'){res.writeHead(302,{Location:'/alt/'});res.end();return}
  if(url.pathname==='/alt/config.js'){res.writeHead(200,{'Content-Type':types['.js'],'Cache-Control':'no-store'});res.end('window.SUPABASE_CONFIG={};');return}
  if(url.pathname==='/alt/sw.js'){res.writeHead(200,{'Content-Type':types['.js'],'Cache-Control':'no-store'});res.end("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));");return}
  const pathname=decodeURIComponent(url.pathname).replace(/\/$/,'/index.html');
  const target=path.resolve(root,'.'+(pathname==='/alt/desktop-baseline.html'?'/alt/index.html':pathname));
  if(!target.startsWith(root+path.sep)||pathname.split('/').some(s=>s.startsWith('.'))){res.writeHead(403);res.end();return}
  let content=await readFile(target);
  if(pathname==='/alt/index.html'||pathname==='/alt/desktop-baseline.html'){
   let html=content.toString().replace('<head>','<head>'+fixture);
   if(pathname==='/alt/desktop-baseline.html')html=html.replace(/<link[^>]+href="desktop\.css"[^>]*>/,'').replace(/<script[^>]+src="desktop(?:-entry)?\.js[^>]*><\/script>/g,'');
   content=Buffer.from(html);
  }
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404);res.end('Not found')}
}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port+'/alt/?desktop-review=1 ('+scenario+' sample data; cloud disabled)'));

