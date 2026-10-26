/* Short, server-timed focus checkpoints. This limits unattended credit, not proof of learning. */
'use strict';
const WINDOW=180000,TTL=90000;
function gate(p,at,random){
 const a=p.attention||=( {verifiedAt:at} );
 if(at-a.verifiedAt<WINDOW)return true;
 p.lastAt=0;p.session=null;
 if(a.cooldownUntil>at)return false;
 if(!a.challenge||a.challenge.expiresAt<at){const x=2+Math.floor(random()*18),y=2+Math.floor(random()*18),answer=x+y,options=[answer,answer+1,answer-1,answer+2];for(let i=3;i>0;i--){const j=Math.floor(random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}a.expected=options.indexOf(answer);a.challenge={id:'focus-'+at+'-'+Math.floor(random()*4294967296),question:'แสงเทียน '+x+' ดวง เพิ่มอีก '+y+' ดวง รวมกี่ดวง?',options,expiresAt:at+TTL};}
 return false;
}
function answer(p,id,index,at){const a=p?.attention,c=a?.challenge;if(!c||c.id!==id||c.expiresAt<at||!Number.isInteger(index)||index<0||index>=c.options.length)throw Error('จุดยืนยันหมดอายุ เปิดโฟกัสแล้วลองอีกครั้ง');const correct=index===a.expected;delete a.challenge;delete a.expected;p.lastAt=0;p.session=null;if(correct){a.verifiedAt=at;delete a.cooldownUntil;}else a.cooldownUntil=at+30000;return correct;}
function publicProof(p){if(p?.attention)delete p.attention.expected;return p;}
module.exports={gate,answer,publicProof,WINDOW,TTL};
