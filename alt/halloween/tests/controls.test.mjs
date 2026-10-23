import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../rewards/theme-main.js',import.meta.url),'utf8');
test('updating controls changes buttons while preserving the application root',()=>{
 const root={dataset:{},textContent:'APPLICATION',attrs:{},setAttribute(k,v){this.attrs[k]=v;}},button=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];}}),sound=button(),motion=button();
 const context={root,enabled:false,musicEnabled:true,motion:'full',window:{},document:{getElementById(){return null;},querySelectorAll(selector){if(selector==='[data-hw-motion]')return[root,motion];if(selector==='[data-hw-sound]')return[root,sound];return selector==='button[data-hw-motion]'?[motion]:selector==='button[data-hw-sound]'?[sound]:[];},querySelector(){return null;}}};context.parent=context.window;
 const from=source.indexOf('  function updateControls()'),to=source.indexOf('  function sound(',from);
 const program=process.env.HW_REGRESSION==='1'?source.slice(from,to).replaceAll('button[data-hw-motion]','[data-hw-motion]').replaceAll('button[data-hw-sound]','[data-hw-sound]'):source.slice(from,to);
 vm.runInNewContext(program+';updateControls();',context);
 assert.equal(root.textContent,'APPLICATION');assert.deepEqual(root.attrs,{});assert.equal(motion.textContent,'Ⅱ');assert.equal(sound.attrs['aria-pressed'],'false');
});
test('the tone toggle saves the choice and repaints the status bar only while Moon & Candle is active',()=>{
 const from=source.indexOf('  function setTone('),to=source.indexOf('  function toggleMotion(',from);
 const run=(active,theme='moonlight')=>{const root={dataset:{theme}},saved=[],meta={content:'#F7FAFF'};const context={root,active,isMoon:()=>root.dataset.theme==='moonlight',TONE_KEY:'studentos.alt.halloween.tone',TONE_BAR:{dark:'#170B36',light:'#F3EDFF'},write(k,v){saved.push([k,v]);},updateControls(){},document:{querySelector:s=>s==='meta[name=theme-color]'?meta:null}};
  vm.runInNewContext('let paletteTone="dark";'+source.slice(from,to)+';setTone("light");',context);return {root,saved,meta};};
 const on=run(true);
 assert.equal(on.root.dataset.hwTone,'light');assert.deepEqual(on.saved,[['studentos.alt.halloween.tone','light']]);assert.equal(on.meta.content,'#F3EDFF');
 assert.equal(run(false).meta.content,'#F7FAFF');
 assert.equal(run(true,'halloween').meta.content,'#F7FAFF','Halloween keeps its own status bar colour');
});
// A tiny DOM: enough for groupMe/ungroupMe (children, append, remove, :scope > selector).
class Node0{constructor(attrs={}){this.attrs=attrs;this.className=attrs.class||'';this.id=attrs.id||'';this.children=[];this.parentElement=null;this.textContent=attrs.text||'';}
 get classList(){return {contains:c=>this.className.split(/\s+/).includes(c)};}
 append(...nodes){for(const n of nodes){if(n.parentElement){const a=n.parentElement.children;a.splice(a.indexOf(n),1);}n.parentElement=this;this.children.push(n);}}
 remove(){const a=this.parentElement.children;a.splice(a.indexOf(this),1);this.parentElement=null;}
 matches(sel){let m;if((m=/^\.([\w-]+)$/.exec(sel)))return this.classList.contains(m[1]);if((m=/^#([\w-]+)$/.exec(sel)))return this.id===m[1];if((m=/^\[onclick\^="(.+)"\]$/.exec(sel)))return (this.attrs.onclick||'').startsWith(m[1]);if((m=/^\[onclick\*="(.+)"\]$/.exec(sel)))return (this.attrs.onclick||'').includes(m[1]);throw new Error('unsupported '+sel);}
 querySelector(sel){const inner=sel.replace(/^:scope > /,'');return this.children.find(c=>c.matches(inner))||null;}}
function meHarness(extra){
 const list=new Node0({class:'pf-entry'});
 const rows=[{class:'pe pe-shop',text:'shop'},{class:'pe',onclick:'openMySubjects()',text:'subjects'},{class:'pe',onclick:"openDmInbox('scr-profile')",text:'dm'},{class:'pe',onclick:"openFeed('friends')",text:'friends'},{class:'pe',onclick:"openBoard('scr-profile')",text:'board'},{class:'pe',id:'peCtx',text:'ctx'},{class:'pe',id:'peBugReports',text:'bugs'},{class:'pe',id:'peNews',text:'news'},{class:'pe',onclick:"location.href='feedback.html'",text:'feedback'},{class:'pe pe-soon',text:'community'},{class:'pe pe-pro',text:'pro'},...(extra||[])].map(a=>new Node0(a));
 list.append(...rows);
 const from=source.indexOf('  const ME_GROUPS'),to=source.indexOf('  function decorate(',from);
 const context={document:{querySelector:s=>s==='#scr-profile .pf-entry'?list:null,createElement:()=>new Node0()}};
 vm.runInNewContext(source.slice(from,to)+';globalThis.api={groupMe,ungroupMe};',context);
 return {list,rows,api:context.api};
}
const texts=box=>box.children.filter(c=>c.className.startsWith('pe')).map(c=>c.textContent);
test('Moon & Candle groups the Me list into a featured pair and three headstones, and restores the exact order',()=>{
 const {list,rows,api}=meHarness();
 api.groupMe(); api.groupMe();
 assert.deepEqual(list.children.map(c=>c.className),['hw-me-feat','hw-me-grp','hw-me-grp','hw-me-grp']);
 assert.deepEqual(list.children.map(texts),[['shop','pro'],['subjects','ctx'],['dm','friends','board','community'],['news','feedback','bugs']]);
 assert.deepEqual(list.children.slice(1).map(g=>g.children[0].textContent),['การเรียนของฉัน','เพื่อนและสังคม','จากทีม StudentOS']);
 api.ungroupMe();
 assert.deepEqual(list.children,rows);
});
test('a row no group knows about stays visible instead of disappearing',()=>{
 const {list,api}=meHarness([{class:'pe',onclick:'openSomethingNew()',text:'new'}]);
 api.groupMe();
 assert.equal(list.children.at(-1).textContent,'new');
 assert.equal(list.children.length,5);
});
