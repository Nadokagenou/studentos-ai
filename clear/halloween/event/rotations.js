/* Shared public hourly timetable. Refreshing never rerolls a door. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HalloweenRotations=factory();})(globalThis,()=>{
 'use strict';const HOUR=3600000,ANCHOR=Date.parse('2026-10-01T00:00:00+07:00'),cache=new Map([[0,[3,0,1,2]]]);
 const permutations=a=>a.length?a.flatMap((n,i)=>permutations(a.filter((_,k)=>k!==i)).map(p=>[n,...p])):[[]],all=permutations([0,1,2,3]);
 function order(block){block=Math.max(0,block);if(cache.has(block))return cache.get(block);let last=cache.size-1;
  for(let b=last+1;b<=block;b++){const previous=cache.get(b-1),pool=all.filter(p=>p[0]!==previous[3]&&p.every((id,i)=>i-previous.indexOf(id)<=1));let seed=Math.imul(b+20261028,2654435761)>>>0;seed^=seed>>>16;cache.set(b,pool[(seed>>>0)%pool.length]);}return cache.get(block);
 }
 function window(at){const slot=Math.floor((at-ANCHOR)/HOUR),block=Math.floor(slot/4),index=((slot%4)+4)%4;return {index:order(block)[index],startAt:ANCHOR+slot*HOUR,endAt:ANCHOR+(slot+1)*HOUR};}
 function upcoming(at,count=8){const first=window(at).startAt;return Array.from({length:count},(_,i)=>window(first+i*HOUR));}
 function next(at,index,later=false){if(!later&&window(at).index===index)return at;return upcoming(window(at).endAt,6).find(w=>w.index===index)?.startAt??null;}
 return Object.freeze({HOUR,window,upcoming,next});
});
