import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {emptyState,createAttempt,recordAnswer,archive,validateState,parseState,resultFor,compatible,BANK_HASHES,MAX_BYTES,STORAGE_KEY} from '../assets/js/learning-model.js';

const banks={};
for(const [id,name] of Object.entries({normal:'dataNormal',pro:'dataPro',normal_renew:'dataNormalRenew',pro_renew:'dataProRenew'}))
  banks[id]=vm.runInNewContext(`${readFileSync(new URL(`../data_${id}.js`,import.meta.url),'utf8')}\n${name}`);
const wrongFor=q=>['a','b','c','d'].find(x=>x!==q.answer);
test.beforeEach(async({page})=>{await page.route(/google-analytics|googletagmanager/,route=>route.abort());});
async function home(page){await page.goto('/');await page.waitForFunction(()=>document.documentElement.dataset.learningReady==='true');}
async function start(page,count=10,bank='normal'){
  await page.evaluate(async({count,bank})=>{await app.selectCategory(bank);await app.startQuiz(count);},{count,bank});
  await expect(page.locator('#screen-quiz')).toBeVisible();
}
async function ready(page){await page.waitForFunction(()=>!learning.busy&&performance.now()>=(app.actionReadyAt||0));}
async function answer(page,correct=true){
  await ready(page);
  const selected=await page.evaluate(correct=>{const q=app.currentDB.data[app.quizQuestions[app.qIndex]];return correct?q.answer:['a','b','c','d'].find(x=>x!==q.answer);},correct);
  await page.locator(`#q-options input[value=${selected}]`).check();await page.locator('#q-btn').click();
  await expect(page.locator('#q-options input:disabled')).toHaveCount(4);await ready(page);
}
async function next(page){await ready(page);await page.locator('#q-btn').click();await ready(page);}
async function stored(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);}
async function back(page){await page.locator('.header').getByRole('button',{name:'回首頁',exact:true}).click();}

test('model validates imports, separates identities and caps history',()=>{
  const state=emptyState();state.active=createAttempt('normal',banks.normal,['Q1','Q2']);
  const id=state.active.attemptId;
  expect(recordAnswer(state,id,wrongFor(banks.normal.data.Q1),banks,1200)).toBe(true);
  expect(recordAnswer(state,id,'a',banks,1300)).toBe(false);
  expect(state.mistakes[0].wrongCount).toBe(1);
  expect(resultFor(state.active,banks).answered).toBe(1);
  expect(()=>validateState(state,banks)).not.toThrow();
  for(const mutation of [s=>s.schemaVersion=9,s=>s.active.questionIds[0]='Q999999',s=>s.active.answers[0].selected='x',s=>s.active.answers[0].selected=['a'],s=>s.active.bankId=['normal'],s=>s.active.currentIndex=1.5,s=>s.active.questionIds=['Q1','Q1'],s=>s.mistakes[0].wrongCount=-1,s=>s.active.bankId='__proto__']){
    const bad=structuredClone(state);mutation(bad);expect(()=>validateState(bad,banks)).toThrow();
  }
  expect(()=>parseState(' '.repeat(MAX_BYTES+1),banks)).toThrow(/2 MB/);
  const old=structuredClone(state);old.active.bankHash='a'.repeat(64);old.active.bankVersion='old';
  expect(()=>validateState(old,banks)).not.toThrow();expect(compatible(old.active,banks)).toBe(false);expect(resultFor(old.active,banks)).toBeNull();
  archive(state,state.active,'abandoned');
  state.active=createAttempt('normal',banks.normal,['Q1']);recordAnswer(state,state.active.attemptId,wrongFor(banks.normal.data.Q1),banks,0);
  expect(state.mistakes).toHaveLength(1);expect(state.mistakes[0].wrongCount).toBe(2);
  archive(state,state.active,'completed');
  state.mistakes[0].reviewStatus='mastered';
  state.active=createAttempt('normal',banks.normal,['Q1']);recordAnswer(state,state.active.attemptId,banks.normal.data.Q1.answer,banks,0);
  expect(state.mistakes[0]).toMatchObject({wrongCount:2,lastCorrect:true,reviewStatus:'mastered'});archive(state,state.active,'completed');
  state.active=createAttempt('pro',banks.pro,['Q1']);recordAnswer(state,state.active.attemptId,wrongFor(banks.pro.data.Q1),banks,0);
  expect(state.mistakes.map(x=>x.bankId)).toEqual(['normal','pro']);
  for(let i=0;i<60;i++){const a=createAttempt('normal',banks.normal,['Q1']);archive(state,a,'abandoned');}
  expect(validateState(state,banks).history).toHaveLength(50);
});

test('refresh at answer 8 preserves exact order, locks and counts; completion is singular',async({page})=>{
  await home(page);await start(page);
  for(let i=0;i<8;i++){await answer(page,i!==2);if(i<7)await next(page);}
  const before=await stored(page);expect(before.active.answers).toHaveLength(8);
  await page.reload();await page.waitForFunction(()=>window.learning);
  await page.evaluate(()=>{window.events=[];window.trackEvent=(name)=>events.push(name);});
  await page.getByRole('button',{name:'繼續上次練習',exact:true}).click();
  await expect(page.locator('#screen-quiz')).toBeVisible();
  expect(await page.evaluate(()=>app.quizQuestions)).toEqual(before.active.questionIds);
  await expect(page.locator('#q-options input:disabled')).toHaveCount(4);
  await expect(page.locator('#q-score')).toHaveText('答對: 7');
  await expect(page.locator('#q-progress')).toContainText('已作答 8 題');
  expect(await page.evaluate(()=>events)).toEqual(['quiz_resume']);
  await next(page);await answer(page);await next(page);await answer(page);await next(page);
  await expect(page.locator('#res-stats')).toContainText('答對 9 題／答錯 1 題');
  const state=await stored(page);expect(state.active).toBeNull();expect(state.history).toHaveLength(1);expect(state.mistakes).toHaveLength(1);
  await page.reload();await page.locator('#open-history').click();await expect(page.locator('#history-list article')).toHaveCount(1);
  expect((await stored(page)).history).toHaveLength(1);
});

test('wrong notebook persists; review events and mastered status stay separate',async({page})=>{
  await home(page);await start(page,1);await answer(page,false);await next(page);await back(page);
  await page.reload();await page.locator('#open-mistakes').click();
  await expect(page.locator('#review-summary')).toContainText('符合條件 1 題');
  const first=(await stored(page)).mistakes[0];
  await page.evaluate(()=>{window.events=[];window.trackEvent=name=>events.push(name);});
  await page.getByRole('button',{name:'再練篩選錯題',exact:true}).click();await answer(page);await next(page);
  expect(await page.evaluate(()=>events.filter(x=>/^(quiz|review)_/.test(x)))).toEqual(['review_start','review_answer','review_complete']);
  let state=await stored(page);expect(state.history.map(a=>a.mode)).toEqual(['review','practice']);
  expect(state.mistakes[0]).toMatchObject({questionId:first.questionId,wrongCount:1,lastCorrect:true,reviewStatus:'pending'});
  await back(page);await page.locator('#open-mistakes').click();
  await page.locator('#review-list select').selectOption('mastered');
  await expect(page.locator('#review-summary')).toContainText('符合條件 0 題');
  await page.locator('#review-status').selectOption('mastered');await expect(page.locator('#review-list article')).toHaveCount(1);
  await page.reload();expect((await stored(page)).mistakes[0].reviewStatus).toBe('mastered');
});

test('storage denied, quota exceeded and corrupt storage degrade without breaking answers',async({browser})=>{
  for(const failure of ['denied','quota','corrupt','no-locks','denied-locks']){
    const context=await browser.newContext();const page=await context.newPage();
    await page.addInitScript(({key,failure})=>{
      if(failure==='corrupt')localStorage.setItem(key,'{"broken":');
      if(failure==='denied')Storage.prototype.getItem=()=>{throw new DOMException('Denied','SecurityError');};
      if(failure==='quota')Storage.prototype.setItem=()=>{throw new DOMException('Full','QuotaExceededError');};
      if(failure==='no-locks')Object.defineProperty(navigator,'locks',{value:undefined});
      if(failure==='denied-locks')navigator.locks.request=()=>Promise.reject(new DOMException('Denied','SecurityError'));
    },{key:STORAGE_KEY,failure});
    await home(page);await start(page,1);await answer(page,false);await next(page);
    await expect(page.locator('#res-stats')).toContainText('答錯 1 題');await expect(page.locator('#learning-notice')).toBeVisible();
    expect(await page.evaluate(()=>learning.store.state.history.length)).toBe(1);
    if(failure==='corrupt')expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe('{"broken":');
    await context.close();
  }
});

test('multiple tabs stop stale writes and restore newest answer without overwriting',async({page,context})=>{
  await home(page);await start(page,3);
  const second=await context.newPage();await home(second);await second.getByRole('button',{name:'繼續上次練習'}).click();
  await answer(page,false);
  await expect(second.locator('#learning-notice')).toContainText('另一個分頁');
  const latest=await stored(page);
  await second.locator('#q-options input').first().check();await second.locator('#q-btn').click();
  expect(await stored(second)).toEqual(latest);
  await second.getByRole('button',{name:'載入其他分頁最新紀錄'}).click();
  await expect(second.locator('#q-options input:disabled')).toHaveCount(4);
  expect(await second.evaluate(()=>app.qAnswered)).toBe(1);
  await second.close();
});

test('imports reject unsafe data; export, restore and clear work; old version is preserved',async({page})=>{
  await home(page);await start(page,1);await answer(page,false);await next(page);await back(page);await page.locator('#open-history').click();
  const baseline=await stored(page);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'匯出學習紀錄',exact:true}).click();
  const exported=JSON.parse(readFileSync(await (await download).path(),'utf8'));expect(exported).toEqual(baseline);
  const upload=async data=>page.locator('#learning-import').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(typeof data==='string'?data:JSON.stringify(data))});
  for(const bad of ['{', {...baseline,schemaVersion:99}, ' '.repeat(MAX_BYTES+1)]){
    await upload(bad);await expect(page.locator('#import-status')).toContainText('匯入失敗');expect(await stored(page)).toEqual(baseline);
  }
  page.on('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'清除全部學習資料',exact:true}).click();await expect(page.locator('#history-list article')).toHaveCount(0);
  await upload(exported);await expect(page.locator('#import-status')).toHaveText('已匯入備份。');expect((await stored(page)).mistakes).toEqual(baseline.mistakes);
  const old=emptyState();old.active=createAttempt('normal',banks.normal,['Q1']);old.active.bankHash='b'.repeat(64);old.active.bankVersion='old';
  await upload(old);await expect(page.locator('#import-status')).toHaveText('已匯入備份。');await back(page);
  await expect(page.locator('#resume-panel')).toContainText('版本不符');await expect(page.getByRole('button',{name:'繼續上次練習'})).toHaveCount(0);
  await start(page,1);expect((await stored(page)).history[0].bankVersion).toBe('old');
});

test('simultaneous tab answers commit only once; reading restores scroll and filtering',async({page,context})=>{
  await home(page);await start(page,3);const second=await context.newPage();await home(second);await second.getByRole('button',{name:'繼續上次練習'}).click();
  const selected=await page.evaluate(()=>['a','b','c','d'].find(x=>x!==app.currentDB.data[app.quizQuestions[0]].answer));
  await page.locator(`input[value=${selected}]`).check();await second.locator(`input[value=${selected}]`).check();
  await Promise.all([page.locator('#q-btn').click(),second.locator('#q-btn').click()]);
  await expect.poll(async()=>(await stored(page)).active.answers.length).toBe(1);
  expect((await stored(page)).mistakes[0].wrongCount).toBe(1);
  await second.close();await page.reload();await page.evaluate(async()=>{await app.selectCategory('normal');app.startReadingMode();});
  await page.locator('#reading-paging').getByRole('button',{name:'下一頁',exact:true}).click();
  await page.locator('#reading-Q50').scrollIntoViewIfNeeded();const position=await page.evaluate(()=>scrollY);
  await page.evaluate(()=>app.goHome());await page.evaluate(async()=>{await app.selectCategory('normal');app.startReadingMode();});
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(position,0);
  await page.reload();await expect(page.locator('#reading-content article').first()).toHaveAttribute('data-question-id','Q41');
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(position,0);
});

for(const bank of Object.keys(banks))test(`${bank}: reading original order, page bounds, search, sections, answers and deep link`,async({page})=>{
  await home(page);await page.evaluate(async bank=>{await app.selectCategory(bank);app.startReadingMode();},bank);
  await expect(page.locator('#reading-content article')).toHaveCount(40);
  expect(await page.locator('#reading-content article').evaluateAll(nodes=>nodes.map(n=>n.dataset.questionId))).toEqual(Object.keys(banks[bank].data).slice(0,40));
  await page.locator('#reading-paging').getByRole('button',{name:'下一頁',exact:true}).click();await expect(page.locator('#reading-content article').first()).toHaveAttribute('data-question-id','Q41');
  await back(page);await page.evaluate(async()=>{await app.selectCategory(app.currentCategory);app.startReadingMode();});
  await expect(page.locator('#reading-content article').first()).toHaveAttribute('data-question-id','Q41');
  await page.locator('#reading-search').fill('Q123');
  const valid=!!banks[bank].data.Q123;
  await expect(page.locator('#reading-content article')).toHaveCount(valid?1:0);
  await page.getByRole('button',{name:'清除篩選',exact:true}).click();
  const query=banks[bank].data.Q1.options.a.slice(0,6);await page.locator('#reading-search').fill(query);
  const matches=Object.keys(banks[bank].data).filter(id=>[banks[bank].data[id].description,...Object.values(banks[bank].data[id].options)].some(x=>x.includes(query)));
  await expect(page.locator('#reading-summary')).toContainText(`符合 ${matches.length}／`);
  await page.getByRole('button',{name:'清除篩選',exact:true}).click();
  const section=(Object.keys(banks[bank].sectionTitle)[1]||Object.keys(banks[bank].sectionTitle)[0]).slice(1);
  await page.locator('#reading-section').selectOption(section);
  const sectionIds=Object.keys(banks[bank].data).filter(id=>String(banks[bank].data[id].section)===section);
  expect(await page.locator('#reading-content article').evaluateAll(nodes=>nodes.map(n=>n.dataset.questionId))).toEqual(sectionIds.slice(0,40));
  await page.locator('#reading-search').fill(sectionIds[0]);await expect(page.locator('#reading-content article')).toHaveCount(1);
  await page.reload();await expect(page.locator('#reading-search')).toHaveValue(sectionIds[0]);await expect(page.locator('#reading-section')).toHaveValue(section);
  await page.locator('#reading-show-answers').uncheck();await expect(page.locator('#reading-content .read-correct, #reading-content .reading-answer')).toHaveCount(0);
  await page.locator('#reading-search').fill('不存在的航空題目zzz');await expect(page.locator('#reading-content')).toContainText('找不到');
  await page.getByRole('button',{name:'重設搜尋與章節',exact:true}).click();await expect(page.locator('#reading-content article')).toHaveCount(40);
  await page.goto(`/?bank=${bank}&mode=reading&q=Q80`);await expect(page.locator('#reading-Q80')).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`bank=${bank}&mode=reading&q=Q80`));
  await expect(page.locator('#reading-Q80 .read-q')).toHaveText(banks[bank].data.Q80.description);
  await page.goto(`/?bank=${bank}&mode=reading&q=Q999999`);await expect(page.locator('#learning-notice')).toContainText('連結的題庫或題號無效');await expect(page.locator('#screen-home')).toBeVisible();
});

test('new screens keyboard, light/dark, narrow widths and 200% text remain usable',async({page})=>{
  test.setTimeout(180000);
  await home(page);await start(page,1);await answer(page,false);await next(page);await back(page);
  for(const dark of [false,true]){
    await page.evaluate(dark=>{document.documentElement.classList.toggle('dark-mode',dark);document.body.classList.toggle('dark-mode',dark);},dark);
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});
      for(const screen of ['review','history','reading']){
        await page.evaluate(async screen=>{if(screen==='reading'){await app.selectCategory('normal');app.startReadingMode();}else await learning[screen]();},screen);
        await page.evaluate(()=>document.documentElement.style.fontSize='200%');
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        const audit=await new AxeBuilder({page}).withRules(['color-contrast','label','button-name','aria-valid-attr-value']).analyze();expect(audit.violations).toEqual([]);
        if(width===390||width===1440)await page.screenshot({path:`output/playwright/batch-b/${screen}-${width}-${dark?'dark':'light'}-200.png`,fullPage:screen!=='reading'});
        await page.evaluate(()=>document.documentElement.style.fontSize='');
      }
    }
  }
  await page.locator('#reading-search').focus();await page.keyboard.type('Q1');await page.keyboard.press('Tab');await expect(page.locator('#reading-section')).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('#reading-show-answers')).toBeFocused();await page.keyboard.press('Space');await expect(page.locator('#reading-content .read-correct')).toHaveCount(0);
});
