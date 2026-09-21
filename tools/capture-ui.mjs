import { chromium } from '@playwright/test';
import fs from 'node:fs';
const stage=process.argv[2] || 'after';
const out=`output/playwright/ui-${stage}`;
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
for(const width of [390,1440]) for(const dark of [false,true]) {
  const page=await browser.newPage({viewport:{width,height:width===390?844:1000}});
  await page.addInitScript(({dark})=>{localStorage.setItem('darkMode',String(dark)); Math.random=()=>0.42;},{dark});
  await page.route(/google-analytics|googletagmanager/,r=>r.abort());
  await page.goto('http://127.0.0.1:4173');
  const name=`${width}-${dark?'dark':'light'}`;
  await page.screenshot({path:`${out}/home-${name}.png`,fullPage:true});
  await page.screenshot({path:`${out}/home-viewport-${name}.png`});
  await page.getByRole('button',{name:'普通操作證',exact:false}).click();
  await page.getByRole('button',{name:/測驗模式/}).click();
  await page.getByRole('button',{name:/快速模擬/}).click();
  await page.locator('input[value="a"]').check();
  await page.locator('#q-btn').click();
  await page.screenshot({path:`${out}/quiz-${name}.png`,fullPage:true});
  await page.close();
}
await browser.close();
console.log(`Captured ${stage} desktop/mobile, both themes, homepage and quiz.`);
