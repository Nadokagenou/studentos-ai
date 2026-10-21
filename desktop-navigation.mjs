// Navigation contracts only. Data, permissions and feature screens stay native.
export const DESKTOP_LINKS = Object.freeze([
  {id:'plan',label:'แผนวันนี้',icon:'plan',screen:'scr-plan'},
  {id:'calendar',label:'ปฏิทิน',icon:'calendar',screen:'scr-timeline'},
  {id:'board',label:'อันดับ',icon:'trophy',screen:'scr-board',feature:'social'},
  {id:'inbox',label:'กล่องเข้า',icon:'inbox',screen:'scr-inbox'},
  {id:'settings',label:'ตั้งค่า',icon:'cog',screen:'scr-settings'},
]);
export const SIDEBAR_KEY = 'studentos.desktop.sidebar';
export function readSidebarCollapsed(storage) {
  try {return storage.getItem(SIDEBAR_KEY)==='closed';} catch {return false;}
}
export function desktopLinkEnabled(link,featureEnabled) {
  return !link.feature || featureEnabled(link.feature);
}
export function navigateDesktop(id,api,from='scr-menu') {
  const link=DESKTOP_LINKS.find(item=>item.id===id);
  if (!link || !desktopLinkEnabled(link,feature=>typeof api.sosFeature!=='function'||api.sosFeature(feature))) return false;
  if (id==='board') {if(typeof api.openBoard!=='function')return false;api.openBoard(from);}
  else if (id==='calendar') {if(typeof api.goTlMode!=='function')return false;api.goTlMode('cal');}
  else {if(typeof api.go!=='function')return false;api.go(link.screen);}
  return true;
}
