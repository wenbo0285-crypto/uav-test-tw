import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const baseline=process.argv[2];if(!baseline)throw new Error('Provide the pre-C source directory');
const browser=await chromium.launch(),results=[];
try{
  for(const [stage,source] of [['before',baseline],['after',process.cwd()]]){
    const root=path.resolve(source);
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
      res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
      res.setHeader('Cache-Control','public,max-age=3600');fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
      for(let run=1;run<=3;run++){
        const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
        const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
        const url=`http://127.0.0.1:${server.address().port}`;
        const started=performance.now();await page.goto(url);await page.waitForFunction(()=>document.documentElement.dataset.learningReady==='true');
        const coldMs=Math.round(performance.now()-started);
        const homeBanks=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/\/data_.*\.js/.test(r.name)).map(r=>({name:new URL(r.name).pathname,decodedBytes:r.decodedBodySize})));
        const selected=performance.now();await page.getByRole('button',{name:/專業操作證 商用/}).click();await page.getByRole('button',{name:/測驗模式/}).click();await page.getByRole('button',{name:/快速模擬/}).click();
        await page.waitForFunction(()=>!learning.busy&&document.querySelectorAll('#q-options input').length===4);
        const firstQuizMs=Math.round(performance.now()-selected);
        const reading=performance.now();await page.evaluate(()=>app.startReadingMode());await page.waitForFunction(()=>document.querySelectorAll('#reading-content article').length===40);
        const readingMs=Math.round(performance.now()-reading);
        const revisit=performance.now();await page.goto(url);await page.waitForFunction(()=>document.documentElement.dataset.learningReady==='true');
        results.push({stage,run,coldMs,firstQuizMs,readingMs,revisitMs:Math.round(performance.now()-revisit),homeBanks});
        await context.close();
      }
    }finally{server.close();}
  }
}finally{await browser.close();}
fs.mkdirSync('output/playwright/batch-c',{recursive:true});
fs.writeFileSync('output/playwright/batch-c/loading-measurements.json',JSON.stringify({conditions:{viewport:'390x844',latencyMs:150,downloadBytesPerSecond:200000,uploadBytesPerSecond:93750,runs:3,note:'Local Chromium laboratory timings; no field CWV claim.'},results},null,2));
console.log(JSON.stringify(results,null,2));
