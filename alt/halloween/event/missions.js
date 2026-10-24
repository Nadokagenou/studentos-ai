/* Preview-only progress from existing StudentOS records. Never writes to the main application. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HalloweenStudentMissions=factory();
})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const STORE_KEY='studentos.alt.v1',DAY=86400000,THAI_OFFSET=7*3600000;
  const definitions=[
    {id:'add-task',title:'เขียนคำสัญญาของวันนี้',text:'เพิ่มงานใน StudentOS ให้ตัวเองอย่างน้อย 1 งาน',target:1,unit:'งาน',symbol:'✎',href:'../../?go=quick',action:'ไปเพิ่มงาน'},
    {id:'focus-15',title:'จุดโคมด้วยเวลาของเธอ',text:'จับเวลาทำงานสะสม 15 นาที แล้วกดพักหรือทำเสร็จเพื่อบันทึก',target:15,unit:'นาที',symbol:'◷',href:'../../?go=today',action:'ไปเริ่มโฟกัส'},
    {id:'finish-task',title:'ปิดงานก่อนคืนจะผ่าน',text:'ทำงานใน StudentOS เสร็จอย่างน้อย 1 งานในวันนี้',target:1,unit:'งาน',symbol:'✓',href:'../../?go=tasks',action:'ไปดูงานของฉัน'}
  ];
  const stamp=v=>typeof v==='number'?v:typeof v==='string'?Date.parse(v):NaN;
  function dayKey(at){return new Date(at+THAI_OFFSET).toISOString().slice(0,10);}
  function read(storage){try{const value=storage.getItem(STORE_KEY);return value?JSON.parse(value):null;}catch{return null;}}
  function assess(state,at){
    const available=!!state&&typeof state==='object'&&Array.isArray(state.tasks),day=dayKey(at);
    const start=Math.floor((at+THAI_OFFSET)/DAY)*DAY-THAI_OFFSET;
    const today=v=>{const t=stamp(v);return Number.isFinite(t)&&t>=start&&t<=at;};
    const tasks=new Map();
    if(available)for(const t of state.tasks){
      if(!t||typeof t.id!=='string'||!t.id||t.deleted||t.draft||t.sample||t.demo||tasks.has(t.id))continue;
      const created=stamp(t.createdAt);if(Number.isFinite(created)&&created>at)continue;
      tasks.set(t.id,t);
    }
    const intervals=[],seen=new Set();
    for(const s of available&&Array.isArray(state.sessions)?state.sessions:[]){
      if(!s||typeof s.id!=='string'||seen.has(s.id)||!tasks.has(s.taskId))continue;
      seen.add(s.id);const begin=stamp(s.start),end=stamp(s.end),minutes=Number(s.min);
      if(!Number.isFinite(begin)||!Number.isFinite(end)||end<=begin||end>at||end-begin>4*3600000||!Number.isFinite(minutes)||minutes<1)continue;
      const a=Math.max(start,begin),b=Math.min(end,begin+minutes*60000);
      if(b>a)intervals.push([a,b]);
    }
    intervals.sort((a,b)=>a[0]-b[0]);let ms=0,left=null,right=null;
    for(const [a,b]of intervals){if(left===null){left=a;right=b;}else if(a<=right)right=Math.max(right,b);else{ms+=right-left;left=a;right=b;}}
    if(left!==null)ms+=right-left;
    const values={'add-task':[...tasks.values()].filter(t=>today(t.createdAt)).length,'finish-task':[...tasks.values()].filter(t=>t.done===true&&today(t.doneAt)&&(!Number.isFinite(stamp(t.createdAt))||stamp(t.doneAt)>=stamp(t.createdAt))).length,'focus-15':Math.floor(ms/60000)};
    return {available,day,rows:definitions.map(d=>({...d,value:values[d.id],complete:available&&values[d.id]>=d.target}))};
  }
  const claimKey=(day,id)=>'studentos:'+day+':'+id;
  return {STORE_KEY,definitions,dayKey,read,assess,claimKey};
});
