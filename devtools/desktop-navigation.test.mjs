import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {DESKTOP_LINKS,SIDEBAR_KEY,readSidebarCollapsed,navigateDesktop} from '../desktop-navigation.mjs';

test('new shortcuts open the native application routes',()=>{
 const calls=[],api={go:id=>calls.push(id)};
 for(const id of ['plan','inbox','settings'])assert.equal(navigateDesktop(id,api),true);
 assert.deepEqual(calls,['scr-plan','scr-inbox','scr-settings']);
});
test('calendar uses the native calendar mode, not a second implementation',()=>{
 const calls=[];navigateDesktop('calendar',{goTlMode:mode=>calls.push(mode)});assert.deepEqual(calls,['cal']);
});
test('ranking keeps its native permission gate and return screen',()=>{
 const calls=[];assert.equal(navigateDesktop('board',{openBoard:from=>calls.push(from)},'scr-tasks'),true);assert.deepEqual(calls,['scr-tasks']);
 assert.equal(navigateDesktop('board',{sosFeature:()=>false,openBoard:()=>assert.fail('disabled ranking must not open')}),false);
});
test('unknown or unavailable native actions cannot navigate somewhere else',()=>{
 assert.equal(navigateDesktop('unknown',{go:()=>assert.fail()}),false);assert.equal(navigateDesktop('board',{}),false);assert.equal(navigateDesktop('calendar',{}),false);
 assert.equal(DESKTOP_LINKS.filter(item=>item.id==='board').length,1);
});
test('sidebar preference is separate from existing application data and tolerates blocked storage',()=>{
 assert.equal(SIDEBAR_KEY,'studentos.desktop.sidebar');
 assert.equal(readSidebarCollapsed({getItem:()=>{throw Error('blocked');}}),false);
 assert.equal(readSidebarCollapsed({getItem:()=>null}),false);assert.equal(readSidebarCollapsed({getItem:()=> 'closed'}),true);
});
test('phones and narrow tablets do not load desktop controls; resizing loads them once',()=>{
 const source=fs.readFileSync(new URL('../desktop-entry.js',import.meta.url),'utf8');
 const created=[],listeners=[],media={matches:false,addEventListener:(event,fn)=>listeners.push(fn)};
 vm.runInNewContext(source,{matchMedia:query=>{assert.equal(query,'(min-width:1025px) and (hover:hover) and (pointer:fine)');return media;},document:{createElement:()=>({}),body:{appendChild:node=>created.push(node)}}});
 assert.equal(created.length,0);listeners[0]();assert.equal(created.length,0);
 media.matches=true;listeners[0]();assert.equal(created.length,1);assert.equal(created[0].type,'module');assert.match(created[0].src,/^desktop\.js/);
 media.matches=false;listeners[0]();media.matches=true;listeners[0]();assert.equal(created.length,1);
});
test('wide touch-only screens also fail the desktop loading gate',()=>{
 const source=fs.readFileSync(new URL('../desktop-entry.js',import.meta.url),'utf8');
 for(const device of [{width:375,hover:false,fine:false},{width:768,hover:false,fine:false},{width:1366,hover:false,fine:false},{width:1280,hover:true,fine:true}]){
  const created=[];
  vm.runInNewContext(source,{matchMedia:query=>({matches:device.width>=1025&&device.hover&&device.fine,addEventListener:()=>{}}),document:{createElement:()=>({}),body:{appendChild:node=>created.push(node)}}});
  assert.equal(created.length,device.width>=1025&&device.hover&&device.fine?1:0);
 }
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<link[^>]+href="desktop\.css(?:\?[^"]*)?"[^>]+media="\(min-width:1025px\) and \(hover:hover\) and \(pointer:fine\)"/);
});
