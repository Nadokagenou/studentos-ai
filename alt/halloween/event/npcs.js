(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HalloweenNPCs=factory();
})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const characters={
    tang:{id:'tang',sprite:0,name:'Tang The Sailor',role:'คนเรือแห่งม่านหมอก'},
    jack:{id:'jack',sprite:1,name:'Jack’o Tigger',role:'เจ้าของสวนฟักทอง'},
    dech:{id:'dech',sprite:2,name:'Mr. Dech',role:'เจ้าของคฤหาสน์'},
    win:{id:'win',sprite:3,name:'Win, the Soul Reaper',role:'ผู้เฝ้าสุสาน'},
    morro:{id:'morro',sprite:4,name:'มอร์โร',role:'พ่อค้าแห่งรัตติกาล',room:'shop',greeting:'เข้ามาสิ… ของบางชิ้นรอเจ้าของมานานกว่าที่คิด ถ้ามีผลผลิตจากสวน ข้าก็รับซื้อด้วยนะ',topics:{garden:{label:'ถามเรื่องรับซื้อผลผลิต',line:'เมล็ดต้องได้จากการช่วยเหลือผู้คนในไบโอมก่อน เอาไปปลูกในสวนรัตติกาล รดน้ำ รอให้โต แล้วเก็บมาขายข้าที่นี่ ข้ารับเฉพาะของที่เจ้าปลูกเองนะ'},rumor:{label:'ถามเรื่องร้านนี้',line:'ข้าเปิดร้านเมื่อหมอกลง ส่วนจะปิดตอนไหนน่ะหรือ… จนกว่าลูกค้าคนสุดท้ายจะหาทางกลับพบ'}},actions:[{route:'shop-stock',label:'ขอดูสินค้า'},{action:'sell',label:'ขายผลผลิตจากสวน'}]},
    mora:{id:'mora',sprite:5,name:'แม่มดมอรา',role:'ผู้ดูแลเตาผสม',room:'cauldron',greeting:'อย่าเพิ่งแตะขวดนั้นล่ะ… อ้อ เป็นเจ้านี่เอง มีวัตถุดิบมาหรือยัง? เลือกสูตร แล้วเรามาปลุกเวทมนตร์ในหม้อกัน',topics:{how:{label:'ผสมของอย่างไร',line:'เลือกสูตรที่อยากได้ ดูวัตถุดิบกับ Candy ให้ครบ แล้วใส่ลงหม้อ ข้าจะช่วยดูไฟให้ ของที่สำเร็จจะถูกเก็บในกระเป๋าของเจ้าก่อนฉากเวทมนตร์จบเสียอีก'},rumor:{label:'เสียงในหม้อคืออะไร',line:'บางคืนมันเล่าเรื่อง บางคืนมันหัวเราะ… คืนที่มันเงียบต่างหากที่ข้าไม่ค่อยสบายใจ'}},actions:[{route:'cauldron-recipes',label:'เลือกสูตรผสม'},{action:'potion',label:'น้ำยาสุ่มเปลี่ยนไบโอม'}]},
    vesper:{id:'vesper',sprite:6,name:'พ่อมดเวสเปอร์',role:'ผู้รักษาวงเวท',room:'ritual',greeting:'หยุดตรงขอบอักขระก่อน นักเดินทาง… อีกฟากได้ยินเสียงเจ้าแล้ว จะเชื้อเชิญใครข้ามวงเวทมาหรือ?',topics:{how:{label:'ถามเรื่องพิธีอัญเชิญ',line:'วงเวทนี้ใช้เรียกชุด Rare และของในพิธี ตรวจสิ่งที่ต้องถวายให้ครบก่อนเริ่ม เมื่ออีกฟากตอบรับ สิ่งที่ได้รับจะอยู่ในคลังของเจ้า'},rumor:{label:'ถามเรื่องอักขระ',line:'อย่านับวงแหวนตอนเที่ยงคืน จำนวนที่เห็นอาจมากกว่าตอนที่ข้าเป็นคนวาดไว้'}},actions:[{route:'ritual-recipes',label:'เลือกพิธีอัญเชิญ'}]}
  };
  const biomeCharacters=['tang','jack','dech','win'];
  const rooms={shop:{name:'ร้านยามเที่ยงคืน',npc:'morro'},cauldron:{name:'ห้องปรุงยาของมอรา',npc:'mora'},ritual:{name:'ห้องวงเวทโบราณ',npc:'vesper'},garden:{name:'สวนรัตติกาล'}};
  return {characters,biomeCharacters,rooms};
});
