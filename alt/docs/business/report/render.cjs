const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + process.argv[2], { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  // overflow check
  const of = await p.evaluate(() => [...document.querySelectorAll('.page')].map((pg,i) => { const f = pg.querySelector('.foot'); const kids=[...pg.children].filter(c=>!c.classList.contains('foot')); const last=Math.max(...kids.map(k=>k.getBoundingClientRect().bottom)); return (i+1)+':'+Math.round((f?f.getBoundingClientRect().top:pg.getBoundingClientRect().bottom)-last); }).join(' '));
  console.log('gap to footer(px):', of);
  await p.pdf({ path: process.argv[3], format: 'A4', printBackground: true, margin: {top:0,right:0,bottom:0,left:0} });
  await b.close();
})();
