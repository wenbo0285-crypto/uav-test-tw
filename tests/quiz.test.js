import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const banks = [['normal','普通操作證',388],['pro','專業操作證',588],['normal_renew','屆期換證 (簡易)',120],['pro_renew','屆期換證 (完整)',324]];
test.beforeEach(async ({page}) => {
  await page.route(/google-analytics|googletagmanager/, route => route.abort());
});
async function start(page, title) {
  await page.goto('/');
  await page.getByRole('button', {name:title, exact:false}).click();
  await page.getByRole('button', {name:/測驗模式/}).click();
  await page.getByRole('button', {name:/快速模擬/}).click();
}
async function ready(page) {
  await page.waitForFunction(() => performance.now() >= (app.actionReadyAt || 0));
}
for (const [bank,title,count] of banks) {
  test(`${bank}: reading, full attempt, wrong/correct, final, restart and back`, async ({page}) => {
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');
    await page.getByRole('button',{name:title}).click();
    await page.getByRole('button',{name:/閱讀模式/}).click();
    await expect(page.locator('#reading-content .read-card')).toHaveCount(40);
    await expect(page.locator('#reading-summary')).toContainText(`符合 ${count}／${count} 題`);
    await page.locator('.header').getByRole('button',{name:'回首頁',exact:true}).click();
    await start(page,title);
    await expect(page.locator('#q-btn')).toBeDisabled();
    await page.evaluate(()=>app.handleQuizAction());
    expect(await page.evaluate(()=>app.qAnswered)).toBe(0);
    const total = await page.evaluate(()=>app.quizQuestions.length);
    for (let i=0;i<total;i++) {
      await ready(page);
      const answer = await page.evaluate(()=>app.currentDB.data[app.quizQuestions[app.qIndex]].answer);
      const selected = i===1 ? ['a','b','c','d'].find(x=>x!==answer) : answer;
      await page.locator(`input[value="${selected}"]`).check();
      if(i===0) await page.locator('#q-btn').dblclick();
      else await page.locator('#q-btn').click();
      await expect(page.locator('#q-score')).toHaveText(`答對: ${i===0?1:i}`);
      await expect(page.locator('#q-feedback')).toContainText(i===1?'本題答錯':'答對了');
      await expect(page.locator('#q-feedback')).toContainText(`官方答案：${answer.toUpperCase()}`);
      await expect(page.locator('#q-options input:disabled')).toHaveCount(4);
      await page.keyboard.press('ArrowDown');
      await expect(page.locator(`input[value="${selected}"]`)).toBeChecked();
      expect(await page.evaluate(()=>app.qIndex)).toBe(i);
      if(i===total-1) await expect(page.locator('#q-bar')).toHaveAttribute('aria-valuenow','100');
      await ready(page); await page.locator('#q-btn').click();
      if(i<total-1) await expect(page.locator('#q-text')).toBeFocused();
    }
    await expect(page.locator('#res-stats')).toHaveText(`答對 ${total-1} 題／答錯 1 題／已完成 ${total} 題`);
    await expect(page.locator('#res-mistakes-list .read-card')).toHaveCount(1);
    await page.locator('#screen-result').getByRole('button',{name:'回首頁'}).click();
    await page.getByRole('button',{name:title}).click();
    await page.getByRole('button',{name:/測驗模式/}).click();
    await page.locator('#screen-quiz-options').getByRole('button',{name:'返回上一步'}).click();
    await expect(page.locator('#mode-title')).toBeFocused();
    await page.getByRole('button',{name:/測驗模式/}).click();
    await page.getByRole('button',{name:/快速模擬/}).click();
    await expect(page.locator('#q-score')).toHaveText('答對: 0');
    expect(await page.evaluate(()=>[app.qAnswered,app.qWrongList.length])).toEqual([0,0]);
    expect(await page.evaluate(()=>window.siteAnalyticsConfig.gaMeasurementId)).toBe('');
    expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);
    expect(errors).toEqual([]);
  });
  test(`${bank}: missing bank is isolated`, async ({page}) => {
    await page.route(`**/data_${bank}.js`,route=>route.abort());
    await page.goto('/');
    await page.getByRole('button',{name:title}).click();
    await expect(page.locator('#bank-status')).toContainText('其他題庫仍可使用');
    const other=banks.find(b=>b[0]!==bank);
    await page.getByRole('button',{name:other[1]}).click();
    await page.getByRole('button',{name:/測驗模式/}).click();
    await page.getByRole('button',{name:/快速模擬/}).click();
    await expect(page.locator('#q-options input')).toHaveCount(4);
  });
}
test('keyboard only completes a full attempt',async ({page})=>{
  await page.goto('/');
  // Reach the first bank through the real sequential tab order.
  for(let i=0;i<20;i++) {
    await page.keyboard.press('Tab');
    if(await page.locator('#screen-home .btn-card').first().evaluate(el=>el===document.activeElement)) break;
  }
  await expect(page.locator('#screen-home .btn-card').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#mode-title')).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  const total=await page.evaluate(()=>app.quizQuestions.length);
  for(let i=0;i<total;i++) {
    await ready(page);
    await expect(page.locator('#q-text')).toBeFocused();
    await page.keyboard.press('Tab'); await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    const value=await page.locator('input:checked').inputValue();
    expect(await page.evaluate(()=>app.qSelected)).toBe(value);
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await expect(page.locator('#q-feedback')).not.toBeEmpty();
    await ready(page); await page.keyboard.press('Enter');
  }
  await expect(page.locator('#screen-result')).toBeVisible();
});
for (const width of [320,390,768,1024,1440]) for (const dark of [false,true]) {
  test(`layout and contrast ${width} ${dark?'dark':'light'}`,async ({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    if(dark) await page.locator('#dark-mode-btn').click();
    await expect(page.locator('.header a[href="./friends.html"]')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const audit=async()=>{
      const results=await new AxeBuilder({page}).withRules(['color-contrast','button-name','label','aria-valid-attr-value']).analyze();
      expect(results.violations).toEqual([]);
    };
    await audit();
    await page.getByRole('button',{name:'普通操作證',exact:false}).click();
    await audit();
    await page.getByRole('button',{name:/測驗模式/}).click();
    await page.getByRole('button',{name:/快速模擬/}).click();
    const wrong = await page.evaluate(()=>['a','b','c','d'].find(x=>x!==app.currentDB.data[app.quizQuestions[app.qIndex]].answer));
    await page.locator(`input[value="${wrong}"]`).check(); await page.locator('#q-btn').click();
    await audit();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`output/playwright/quiz-${width}-${dark?'dark':'light'}.png`,fullPage:true});
    await page.addStyleTag({content:'html { font-size: 200%; }'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator('#q-btn')).toBeVisible();
    await page.screenshot({path:`output/playwright/zoom-${width}-${dark?'dark':'light'}.png`,fullPage:true});
  });
}
test('storage denied, shared theme, long questions and static contrast',async ({page})=>{
  await page.addInitScript(()=>{
    Storage.prototype.getItem=()=>{throw new Error('denied')};
    Storage.prototype.setItem=()=>{throw new Error('denied')};
  });
  await start(page,'專業操作證');
  await page.locator('#dark-mode-btn').click();
  await page.evaluate(()=>{
    const key=Object.keys(app.currentDB.data).sort((a,b)=>JSON.stringify(app.currentDB.data[b]).length-JSON.stringify(app.currentDB.data[a]).length)[0];
    app.quizQuestions[0]=key; app.loadQuestion();
  });
  await page.setViewportSize({width:320,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'output/playwright/long-question.png',fullPage:true});
  for(const path of ['/friends.html','/questions/normal-bank.html','/guide/basic-drone-license.html']) {
    await page.goto(path);
    for(const theme of ['light','dark']) {
      if(theme==='dark') await page.getByRole('button',{name:/深色模式/}).click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const results=await new AxeBuilder({page}).withRules(['color-contrast']).analyze();
      expect(results.violations).toEqual([]);
    }
  }
});
test('saved theme follows article links',async ({page})=>{
  await page.goto('/'); await page.locator('#dark-mode-btn').click();
  await page.locator('.header a[href="./friends.html"]').click();
  await expect(page.locator('html')).toHaveClass('dark-mode');
  await page.getByRole('button',{name:/淺色模式/}).click();
  await page.locator('.brand').click();
  await expect(page.locator('body')).not.toHaveClass(/dark-mode/);
});

test('perfect result has no stale mistakes; rapid repeated activation records once',async ({page})=>{
  await start(page,'普通操作證');
  await page.evaluate(()=>app.startQuiz(2));
  for(let i=0;i<2;i++) {
    await ready(page);
    const answer=await page.evaluate(()=>app.currentDB.data[app.quizQuestions[app.qIndex]].answer);
    await page.locator(`input[value="${answer}"]`).check();
    await page.locator('#q-btn').click();
    await page.evaluate(()=>{for(let j=0;j<10;j++) app.handleQuizAction();});
    expect(await page.evaluate(()=>app.qAnswered)).toBe(i+1);
    expect(await page.evaluate(()=>app.qIndex)).toBe(i);
    await ready(page); await page.locator('#q-btn').click();
  }
  await expect(page.locator('#res-percent')).toHaveText('100%');
  await expect(page.locator('#res-mistakes')).toBeHidden();
  await expect(page.locator('#res-stats')).toHaveText('答對 2 題／答錯 0 題／已完成 2 題');
});
