/* The reward fitting room uses memory storage and never connects a real account. */
(() => {
 let fittingRoom=new URLSearchParams(location.search).has('halloween-showroom');
 // The parent survives service-worker reloads even if the app cleans its URL.
 try{fittingRoom ||= window.parent!==window&&window.parent.__STUDENTOS_HALLOWEEN_COLLECTION__===true;}catch{}
 if(!fittingRoom)return;
 const makeStorage=()=>{const data=new Map();return {get length(){return data.size;},getItem:k=>data.get(String(k))??null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null};};
 try{
  Object.defineProperty(window,'SUPABASE_CONFIG',{configurable:false,get:()=>({}),set:()=>{}});
  const memory=makeStorage();
  Object.defineProperty(window,'localStorage',{configurable:true,get:()=>memory});
  const makeSession=makeStorage();
  Object.defineProperty(window,'sessionStorage',{configurable:true,get:()=>makeSession});
  const now=new Date(),due=new Date(now);due.setHours(23,59,0,0);
  const base={type:'homework',teacher:'ครูตัวอย่าง',done:false,progress:0,createdAt:now.toISOString()};
  memory.setItem('studentos.alt.v1',JSON.stringify({tasks:[{...base,id:'hw-sample-math',subject:'คณิตศาสตร์',detail:'แบบฝึกหัดฟังก์ชัน ข้อ 1–10',estMin:40,scorePct:15,due:due.toISOString()},{...base,id:'hw-sample-bio',subject:'ชีววิทยา',detail:'สรุปบทระบบนิเวศ',estMin:30,scorePct:5,due:new Date(+due+86400000).toISOString()}],settings:{name:'ห้องลองรางวัล',freeHours:2.5},marks:[],sessions:[],running:null}));
  for(const [k,v]of Object.entries({skipLogin:'1',onboardSkipped:'1',lastScreen:'scr-menu',checkinAsked:now.toISOString().slice(0,10),theme:new URLSearchParams(location.search).has('thai-ghost-preview')?'thai-ghost':'dark',gfx:'high',lite:'0'}))memory.setItem('studentos.alt.'+k,v);
  window.__HW_SHOWROOM__=true;document.documentElement.dataset.hwShowroom='true';
 }catch{document.documentElement.dataset.hwShowroom='unavailable';}
})();
