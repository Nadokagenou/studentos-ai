(() => {
 'use strict';
 const sizes={mobile:[375,812],tablet:[820,1180],desktop:[1440,900]},frame=document.getElementById('appPreview'),shell=document.getElementById('frameShell'),stage=document.getElementById('previewStage'),dims=document.getElementById('dimensions');
 let device='mobile';try{const saved=localStorage.getItem('studentos.alt.preview.device');if(sizes[saved])device=saved;}catch{}
 function send(action,value){frame.contentWindow.postMessage({type:'studentos-device-preview-control',action,value},location.origin);}
 function fit(){const [width,height]=sizes[device],style=getComputedStyle(stage),available=stage.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-2,scale=Math.min(1,available/width);Object.assign(frame.style,{width:width+'px',height:height+'px',transform:'scale('+scale+')'});Object.assign(shell.style,{width:width*scale+'px',height:height*scale+'px'});shell.className=device;dims.textContent=width+' × '+height;document.getElementById('fitLabel').textContent='แสดงผล '+Math.round(scale*100)+'% · ขนาดหน้าจอจริง '+width+' × '+height;document.querySelectorAll('[data-device]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.device===device)));}
 document.querySelectorAll('[data-device]').forEach(b=>b.addEventListener('click',()=>{device=b.dataset.device;try{localStorage.setItem('studentos.alt.preview.device',device);}catch{}fit();}));
 document.getElementById('theme').addEventListener('change',e=>{if(e.target.value!=='current')send('theme',e.target.value);});
 document.getElementById('screen').addEventListener('change',e=>send('screen',e.target.value));
 const motionButton=document.getElementById('previewMotion');
 motionButton.addEventListener('click',()=>send('motion',motionButton.getAttribute('aria-pressed')==='true'?'still':'full'));
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='studentos-device-preview-status')return;motionButton.setAttribute('aria-pressed',String(!!e.data.moving));motionButton.textContent=e.data.moving?'หยุดแอนิเมชัน':'เปิดแอนิเมชัน';});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='studentos-device-preview-status')return;dims.dataset.actual=e.data.viewport.join('x');dims.dataset.overflow=String(e.data.overflow);dims.dataset.screenScroll=String(e.data.screenScroll);const picker=document.getElementById('theme');picker.value=[...picker.options].some(o=>o.value===e.data.theme)?e.data.theme:'current';document.getElementById('screen').value=e.data.screen;});
 new ResizeObserver(fit).observe(stage);fit();
})();
