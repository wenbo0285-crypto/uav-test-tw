import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const boot=async page=>{await page.goto('/');await page.waitForFunction(()=>window.learning&&document.documentElement.dataset.learningReady==='true');};
test('homepage requests no banks; loads only chosen bank and caches concurrent selections',async({page})=>{
  const requests=[];page.on('request',r=>{if(/data_.*\.js/.test(r.url()))requests.push(new URL(r.url()).pathname);});
  await boot(page);expect(requests).toEqual([]);
  await page.evaluate(()=>Promise.all([app.selectCategory('normal'),app.selectCategory('normal')]));
  expect(requests).toEqual(['/data_normal.js']);
  await page.evaluate(()=>app.goHome());await page.evaluate(()=>app.selectCategory('normal'));
  expect(requests).toHaveLength(1);await expect(page.locator('#mode-title')).toHaveText('普通操作證');
});
test('delayed stale bank selection and going home do not replace latest screen',async({page})=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/data_pro.js',async route=>{await gate;await route.continue();});
  await boot(page);await page.getByRole('button',{name:/專業操作證 商用/}).click();
  await expect(page.locator('#bank-status')).toContainText('正在載入專業');
  await page.getByRole('button',{name:/普通操作證 適合/}).click();await expect(page.locator('#mode-title')).toHaveText('普通操作證');
  release();await page.waitForFunction(()=>learning.banks.pro);
  expect(await page.evaluate(()=>app.currentCategory)).toBe('normal');
  await page.evaluate(()=>app.goHome());await expect(page.locator('#screen-home')).toBeVisible();
});
test('bank failure supports retry; offline stays understandable; other bank is usable',async({page,context})=>{
  let fail=true;await page.route('**/data_pro.js',r=>fail?r.abort():r.continue());
  await boot(page);await page.evaluate(()=>app.selectCategory('pro'));await expect(page.locator('#bank-status')).toContainText('其他題庫仍可使用');
  fail=false;await page.getByRole('button',{name:'重試載入',exact:true}).click();await expect(page.locator('#mode-title')).toHaveText('專業操作證');
  await page.evaluate(()=>app.goHome());await context.setOffline(true);await page.evaluate(()=>app.selectCategory('normal'));
  await expect(page.locator('#bank-status')).toContainText('目前離線');
  await page.evaluate(()=>app.selectCategory('pro'));await expect(page.locator('#screen-mode')).toBeVisible();
  await context.setOffline(false);
});
for(const width of [320,390,768,1440])for(const dark of [false,true])test(`navigation ${width} ${dark?'dark':'light'} and text zoom`,async({page})=>{
  await page.setViewportSize({width,height:900});
  for(const route of ['/','/friends.html','/guide/basic-drone-license.html']){
    await page.goto(route);
    if(dark)await page.getByRole('button',{name:'深色模式',exact:true}).click();
    await expect(page.locator('header a[href$="friends.html"]')).toBeVisible();
    const menu=page.getByRole('button',{name:'更多導覽選單',exact:true});
    if(width<=1150){
      await menu.focus();await page.keyboard.press('Enter');await expect(menu).toHaveAttribute('aria-expanded','true');
      await page.keyboard.press('Tab');await expect(page.locator('#secondary-navigation a').first()).toBeFocused();
      await page.keyboard.press('Escape');await expect(menu).toBeFocused();await expect(menu).toHaveAttribute('aria-expanded','false');
      await menu.click();
    }
    await page.addStyleTag({content:'html{font-size:200%}'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const audit=await new AxeBuilder({page}).withRules(['color-contrast','button-name','aria-valid-attr-value']).analyze();expect(audit.violations).toEqual([]);
    if(route==='/')await page.screenshot({path:`output/playwright/batch-c/menu-${width}-${dark?'dark':'light'}-200.png`,fullPage:false});
    await page.evaluate(()=>{try{localStorage.removeItem('darkMode');}catch{}});
  }
});
test('every public content page includes shared analytics; local traffic never loads GA',async({page})=>{
  const files=[...fs.readdirSync(root).filter(f=>f.endsWith('.html')),...['guide','questions'].flatMap(dir=>fs.readdirSync(dir).filter(f=>f.endsWith('.html')).map(f=>`${dir}/${f}`))].filter(f=>fs.readFileSync(path.join(root,f),'utf8').includes('<head>'));
  for(const file of files){const source=fs.readFileSync(path.join(root,file),'utf8');expect(source.match(/assets\/js\/analytics\.js/g),file).toHaveLength(1);}
  const requests=[];page.on('request',r=>{if(/google-analytics|googletagmanager/.test(r.url()))requests.push(r.url());});
  for(const file of ['index.html','friends.html','guide/basic-drone-license.html','questions/pro-bank.html']){
    await page.goto('/'+file);expect(await page.evaluate(()=>siteAnalytics.events.filter(e=>e.name==='page_view').length)).toBe(1);
  }
  expect(requests).toEqual([]);
});
test('event funnel has attempt context and no duplicates; friend click is an actual external link',async({page})=>{
  await boot(page);await page.evaluate(async()=>{await app.selectCategory('normal');await app.startQuiz(1);});
  const selected=await page.evaluate(()=>app.currentDB.data[app.quizQuestions[0]].answer);
  await page.locator(`input[value=${selected}]`).check();await page.locator('#q-btn').click();
  await page.waitForFunction(()=>!learning.busy&&performance.now()>=app.actionReadyAt);await page.reload();
  await page.getByRole('button',{name:'繼續上次練習',exact:true}).click();await expect(page.locator('#q-options input:disabled')).toHaveCount(4);
  await page.locator('#q-btn').click();await expect(page.locator('#screen-result')).toBeVisible();
  await page.evaluate(()=>app.showResult());
  const events=await page.evaluate(()=>siteAnalytics.events);
  expect(events.filter(e=>e.name==='quiz_start')).toHaveLength(0);expect(events.filter(e=>e.name==='quiz_answer')).toHaveLength(0);expect(events.filter(e=>e.name==='quiz_complete')).toHaveLength(1);
  expect(events.find(e=>e.name==='quiz_complete').params).toMatchObject({question_bank:'normal',mode:'practice',bank_version:'latest',question_count:1});
  expect(events.find(e=>e.name==='quiz_complete').params.attempt_id).toMatch(/^[\w-]+$/);
  await page.goto('/friends.html');
  await page.evaluate(()=>document.querySelector('main a[rel*=external]').addEventListener('click',e=>e.preventDefault()));
  await page.locator('main a[rel*=external]').click();
  const friend=await page.evaluate(()=>siteAnalytics.events.filter(e=>e.name==='friend_link_click'));
  expect(friend).toHaveLength(1);expect(friend[0].params).toMatchObject({destination_host:'nsn18201.webnode.tw',placement:'friends_content'});
  expect(JSON.stringify(friend)).not.toMatch(/link_text|link_url|email|phone/);
});
test('production snippet uses explicit single pageview with tracking blocked',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}));
  await page.route('https://uav-test.tw/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;const file=path.join(root,pathname==='/'?'index.html':pathname);
    if(!fs.existsSync(file))return route.abort();
    const ext=path.extname(file);await route.fulfill({body:fs.readFileSync(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[ext]||'application/octet-stream'});
  });
  await page.route(/googletagmanager|google-analytics/,r=>r.abort());
  await page.goto('https://uav-test.tw/');await page.waitForFunction(()=>window.learning);
  expect(await page.evaluate(()=>dataLayer.filter(x=>x[0]==='config')[0][2].send_page_view)).toBe(false);
  expect(await page.evaluate(()=>dataLayer.filter(x=>x[0]==='event'&&x[1]==='page_view').length)).toBe(1);
  await page.evaluate(async()=>{await app.selectCategory('normal');await app.startQuiz(1);});
  await expect(page.locator('#q-options input')).toHaveCount(4);
});
test('blocking the shared analytics file still allows answering',async({page})=>{
  await page.route('**/assets/js/analytics.js',r=>r.abort());await boot(page);
  await page.evaluate(async()=>{await app.selectCategory('normal');await app.startQuiz(1);});
  await page.locator('#q-options input').first().check();await page.locator('#q-btn').click();await expect(page.locator('#q-feedback')).not.toBeEmpty();
});
