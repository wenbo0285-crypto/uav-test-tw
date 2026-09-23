import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const stage=process.argv[2]||'after';
const root=path.resolve(process.argv[3]||'.');
const output=path.resolve(process.argv[4]||`output/playwright/batch-b-${stage}`);fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'), file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
  res.setHeader('Content-Type',`${types[path.extname(file)]||'application/octet-stream'}; charset=utf-8`);fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try {
  for(const width of [390,1440])for(const dark of [false,true]){
    const page=await browser.newPage({viewport:{width,height:width===390?844:1000}});
    await page.route(/google-analytics|googletagmanager/,r=>r.abort());
    await page.addInitScript(dark=>{localStorage.setItem('darkMode',String(dark));Math.random=()=>.42;},dark);
    await page.goto(url);if(stage==='after')await page.waitForFunction(()=>window.learning&&!learning.busy);
    const capture=async name=>{await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${output}/${name}-${width}-${dark?'dark':'light'}.png`,fullPage:true});};
    await capture('home');
    if(stage==='after'&&width===390){const menu=page.getByRole('button',{name:'更多導覽選單',exact:true});if(await menu.isVisible()){await menu.click();await capture('menu');await menu.click();}}
    if(stage==='after'){
      await page.evaluate(async()=>{await app.selectCategory('normal');await app.startQuiz(1);});
      await page.locator('#q-options input[value=a]').check();await page.locator('#q-btn').click();
      await page.waitForFunction(()=>!learning.busy&&app.qState==='answered');await capture('feedback');
      await page.waitForFunction(()=>performance.now()>=app.actionReadyAt);await page.locator('#q-btn').click();await page.waitForFunction(()=>!learning.busy);
      await page.evaluate(()=>learning.history());await capture('history');
      await page.evaluate(()=>learning.review());await capture('review');
      await page.evaluate(async()=>{await app.selectCategory('normal');await app.startQuiz(20);});
      await page.locator('#q-options input[value=a]').check();await page.locator('#q-btn').click();await page.waitForFunction(()=>!learning.busy);
      await page.evaluate(()=>app.goHome());await capture('resume');
      await page.evaluate(async()=>{await app.selectCategory('normal');app.startReadingMode();});
      await page.locator('#reading-search').fill('Q123');await capture('reading');
    }
    await page.close();
  }
}finally{await browser.close();server.close();}
console.log(`Captured ${stage}: ${output}`);
