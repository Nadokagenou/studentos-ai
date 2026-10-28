import {DESKTOP_LINKS,SIDEBAR_KEY,readSidebarCollapsed,desktopLinkEnabled,navigateDesktop} from './desktop-navigation.mjs';

const wide=matchMedia('(min-width:1025px) and (hover:hover) and (pointer:fine)');
const root=document.documentElement;
let mounted=null,collapsed=false;
try {collapsed=readSidebarCollapsed(localStorage);} catch { /* Storage can be unavailable. */ }
const currentScreen=()=>document.querySelector('.screen.on')?.id||'scr-menu';
const icon=name=>typeof window.icon==='function'?window.icon(name):'';

function syncLinks() {
  if (!mounted) return;
  const screen=currentScreen();
  for (const link of DESKTOP_LINKS) {
    const button=mounted.extras.querySelector(`[data-desktop-link="${link.id}"]`);
    button.hidden=!desktopLinkEnabled(link,feature=>typeof window.sosFeature!=='function'||window.sosFeature(feature));
    const active=screen===link.screen||(link.id==='settings'&&screen==='scr-setopt');
    button.classList.toggle('is-current',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
}

function applySidebar() {
  if (!mounted) return;
  root.dataset.desktopSidebar=collapsed?'closed':'open';
  mounted.bar.inert=collapsed;
  mounted.toggle.setAttribute('aria-expanded',String(!collapsed));
  mounted.toggle.setAttribute('aria-label',collapsed?'เปิดเมนูข้าง':'ซ่อนเมนูข้าง');
  mounted.toggle.title=collapsed?'เปิดเมนูข้าง':'ซ่อนเมนูข้าง';
  mounted.toggle.querySelector('span').textContent=collapsed?'เปิดเมนู':'';
  // Recalculate native timeline markers after the content width changes.
  requestAnimationFrame(()=>{if(mounted&&typeof window.syncTimelineNow==='function')window.syncTimelineNow();});
}

function mount() {
  if(mounted)return;
  const bar=document.querySelector('.tabbar'),phone=document.querySelector('.phone');
  if(!bar||!phone)return;
  const originalId=bar.getAttribute('id'),originalInert=bar.inert;
  if(!originalId)bar.id='desktopSidebar';
  const extras=document.createElement('div');
  extras.id='desktopExtraNav';extras.className='desktop-extra-nav';
  extras.setAttribute('aria-label','ทางลัดบนคอมพิวเตอร์');
  extras.innerHTML=`<p>ทางลัด</p>${DESKTOP_LINKS.map(link=>`<button type="button" class="desktop-link" data-desktop-link="${link.id}">${icon(link.icon)}<span>${link.label}</span></button>`).join('')}`;
  extras.addEventListener('click',event=>{
    const button=event.target.closest('[data-desktop-link]');
    if(button&&!button.hidden)navigateDesktop(button.dataset.desktopLink,window,currentScreen());
  });
  bar.insertBefore(extras,bar.querySelector('[data-scr="scr-profile"]'));
  const toggle=document.createElement('button');
  toggle.id='desktopNavToggle';toggle.type='button';toggle.className='desktop-nav-toggle';
  toggle.setAttribute('aria-controls',bar.id);
  toggle.innerHTML=`${icon('panel')}<span></span>`;
  toggle.addEventListener('click',()=>{
    collapsed=!collapsed;
    try {localStorage.setItem(SIDEBAR_KEY,collapsed?'closed':'open');} catch { /* The button still works without storage. */ }
    applySidebar();
  });
  phone.appendChild(toggle);
  const observer=new MutationObserver(syncLinks);
  document.querySelectorAll('.screen').forEach(screen=>observer.observe(screen,{attributes:true,attributeFilter:['class']}));
  mounted={bar,phone,extras,toggle,observer,originalId,originalInert};
  applySidebar();syncLinks();
}

function unmount() {
  if(!mounted)return;
  const {bar,extras,toggle,observer,originalId,originalInert}=mounted;
  const focusWasDesktop=extras.contains(document.activeElement)||document.activeElement===toggle;
  observer.disconnect();extras.remove();toggle.remove();
  bar.inert=originalInert;
  if(originalId===null)bar.removeAttribute('id');else bar.id=originalId;
  root.removeAttribute('data-desktop-sidebar');
  mounted=null;
  if(focusWasDesktop){const active=document.querySelector('.screen.on');if(active){active.setAttribute('tabindex','-1');active.focus();}}
}

function syncWidth(){if(wide.matches&&!document.body.classList.contains('login-mode'))mount();else unmount();}
wide.addEventListener('change',syncWidth);
window.addEventListener('sos-config',syncLinks);
new MutationObserver(syncWidth).observe(document.body,{attributes:true,attributeFilter:['class']});
syncWidth();
