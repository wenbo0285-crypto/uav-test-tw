import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const width of [320,390,768,1024,1440]) for (const dark of [false,true]) {
  test(`visual homepage ${width} ${dark?'dark':'light'} and 200% text`,async ({page})=>{
    await page.setViewportSize({width,height:900});
    await page.addInitScript(dark=>localStorage.setItem('darkMode',String(dark)),dark);
    await page.route(/google-analytics|googletagmanager/,r=>r.abort());
    await page.goto('/');
    await expect(page.locator('.header a[href$="friends.html"], .header a[href$="/friends"]')).toBeVisible();
    await expect(page.locator('.bank-grid .btn-card')).toHaveCount(4);
    expect(await page.locator('.bank-count').allTextContents()).toEqual(['388 題','588 題','120 題','324 題']);
    expect(await page.locator('.hero-visual img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe(dark?'rgb(11, 28, 37)':'rgb(248, 244, 235)');
    for(const zoom of [false,true]) {
      if(zoom) await page.addStyleTag({content:'html { font-size: 200%; }'});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const friend=page.locator('.header a[href="./friends.html"]');
      await expect(friend).toBeVisible();
      for(const element of await page.locator('.header a:visible, .header button:visible, .hero-actions a, .bank-grid .btn-card').all()) {
        const b=await element.boundingBox();
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x+b.width).toBeLessThanOrEqual(width+1);
      }
      const audit=await new AxeBuilder({page}).withRules(['color-contrast','button-name','label','aria-valid-attr-value','link-name']).analyze();
      expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
      await page.screenshot({path:`output/playwright/ui-after/home-${width}-${dark?'dark':'light'}${zoom?'-200':''}.png`,fullPage:true});
    }
    await page.getByRole('link',{name:'開始練習'}).click();
    expect(await page.evaluate(()=>location.hash)).toBe('#bank-entry');
  });
}
