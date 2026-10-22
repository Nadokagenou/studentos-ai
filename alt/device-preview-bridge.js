/* ALT-only layout inspection, independent of seasonal themes. */
(() => {
 'use strict';
 const framed=parent!==window;
 function report(){if(!framed)return;const current=document.querySelector('.screen.on');parent.postMessage({type:'studentos-device-preview-status',theme:document.documentElement.dataset.theme,viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,screen:current?.id,screenScroll:current?current.scrollHeight-current.clientHeight:0},location.origin);}
 function init(){
  if(!framed){const button=document.createElement('a');button.className='alt-device-preview';button.href='device-preview.html';button.setAttribute('aria-label','ตรวจหน้าจอ ALT: มือถือ แท็บเล็ต และคอม');button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2" y="3" width="16" height="12" rx="2"/><path d="M7 20h7m-3-5v5"/><rect x="15" y="9" width="7" height="12" rx="1.5"/></svg><span>ตรวจหน้าจอ</span>';document.body.append(button);}
  window.addEventListener('message',e=>{if(!framed||e.source!==parent||e.origin!==location.origin||e.data?.type!=='studentos-device-preview-control')return;const {action,value}=e.data;if(action==='theme'&&['light','dark','halloween'].includes(value)&&typeof setTheme==='function')setTheme(value);if(action==='screen'&&['scr-menu','scr-tasks','scr-profile','scr-shop','scr-room','scr-settings'].includes(value)&&typeof go==='function')go(value);requestAnimationFrame(report);});
  window.addEventListener('resize',()=>requestAnimationFrame(report));
  new MutationObserver(()=>requestAnimationFrame(report)).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-nav']});
  document.addEventListener('click',()=>requestAnimationFrame(report));report();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
