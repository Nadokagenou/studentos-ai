(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HalloweenSeason=factory();})(globalThis,()=>{
 'use strict';
 const START='2026-10-28T00:00:00+07:00',END='2026-12-01T00:00:00+07:00';
 function state(at=Date.now()){return at<Date.parse(START)?'upcoming':at<Date.parse(END)?'active':'ended';}
 return Object.freeze({id:'halloween-2026',startAt:START,endAt:END,timezone:'Asia/Bangkok',state,label:'28 ตุลาคม – 30 พฤศจิกายน 2569'});
});
