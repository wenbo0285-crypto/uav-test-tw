import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {load} from 'cheerio';
const files=JSON.parse(fs.readFileSync('tools/public-files.json','utf8'));

test('all public SEO metadata describes visible content and retains canonical URLs',()=>{
  for(const file of files.filter(f=>f.endsWith('.html')&&!f.startsWith('google')&&f!=='404.html')){
    const $=load(fs.readFileSync('dist/'+file,'utf8'));
    expect($('script[type="application/ld+json"]')).toHaveLength(1);
    const data=JSON.parse($('script[type="application/ld+json"]').text());
    expect(data['@context']).toBe('https://schema.org');
    const canonical=$('link[rel=canonical]').attr('href'),page=data['@graph'].find(x=>['WebPage','Article'].includes(x['@type']));
    expect(page.url).toBe(canonical);expect(page.headline).toBe($('h1').first().text().trim());
    expect($('meta[property="og:url"]').attr('content')).toBe(canonical);
    expect($('meta[property="og:title"]').attr('content')).toBe($('title').text());
    expect($('meta[property="og:description"]').attr('content')).toBe($('meta[name=description]').attr('content'));
    expect($('meta[property="og:image"]').attr('content')).toBe('https://uav-test.tw/assets/social-card.png');
    expect(data['@graph'].some(x=>['FAQPage','Review','AggregateRating'].includes(x['@type']))).toBe(false);
    if(page['@type']==='Article'){
      expect(page.dateModified).toBe($('.content-meta time').attr('datetime'));
      expect(page.author.url).toBe('https://uav-test.tw/about.html');
      expect(page.citation).toEqual($('.editorial-source a[href^="https://"]').map((_,el)=>$(el).attr('href')).get());
    }
    if(file!=='index.html')expect($('.breadcrumbs [aria-current=page]').text()).toBe(page.headline);
  }
  expect(fs.readFileSync('dist/404.html','utf8')).not.toContain('application/ld+json');
});

test('all 1420 static question anchors are unique and preserve original IDs',()=>{
  let total=0;
  for(const name of ['normal','pro','normal-renew','pro-renew']){
    const $=load(fs.readFileSync(`dist/questions/${name}-bank.html`,'utf8'));
    const ids=$('.question-meta[id]').map((_,el)=>$(el).attr('id')).get();
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id,i)=>expect(id).toBe('Q'+(i+1)));total+=ids.length;
  }
  expect(total).toBe(1420);
});

test('static deep link and visible breadcrumbs work without JavaScript',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4175/questions/normal-bank.html#Q123');
  await expect(page.locator('#Q123')).toContainText('題號 123');
  const bounds=await page.locator('#Q123').boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeLessThan(844);
  await page.goto('http://127.0.0.1:4175/guide/basic-drone-license.html');
  await page.getByRole('navigation',{name:'麵包屑導覽'}).getByRole('link',{name:'教學文章'}).click();
  await expect(page).toHaveURL(/\/guide\/$/);
  await context.close();
});
