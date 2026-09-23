import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {validatePublic} from '../tools/validate-public.mjs';
const files=JSON.parse(fs.readFileSync('tools/public-files.json','utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('published build is exactly the whitelist; non-HTML assets remain byte-identical',()=>{
  validatePublic(path.resolve('dist'),files,true);
  for(const file of files.filter(f=>!f.endsWith('.html')))expect(hash(path.join('dist',file)),file).toBe(hash(file));
  expect(files.some(file=>/^(tools|tests|output|node_modules|\.git)\//.test(file))).toBe(false);
});

test('release validation rejects broken canonical, missing local links and leaked files',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'uav-release-'));
  try{
    fs.cpSync('dist',temp,{recursive:true});
    const target=path.join(temp,'guide/basic-drone-license.html'),original=fs.readFileSync(target,'utf8');
    fs.writeFileSync(target,original.replace('https://uav-test.tw/guide/basic-drone-license.html','https://uav-test.tw/wrong.html'));
    expect(()=>validatePublic(temp,files,true)).toThrow(/canonical/);
    fs.writeFileSync(target,original.replace('../sources.html','../private-notes.md'));
    expect(()=>validatePublic(temp,files,true)).toThrow(/Unpublished local link/);
    fs.writeFileSync(target,original);fs.writeFileSync(path.join(temp,'private-notes.md'),'private');
    expect(()=>validatePublic(temp,files,true)).toThrow(/Unexpected/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('all sitemap URLs, legacy html and extensionless URLs resolve; private files return 404',async({request})=>{
  const urls=[...fs.readFileSync('sitemap.xml','utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
  for(const url of urls){
    const response=await request.get(url);expect(response.status(),url).toBe(200);
    if(url.endsWith('.html')){
      const alias=await request.get(url.slice(0,-5));expect(alias.status(),url).toBe(200);
      expect(await alias.text()).toBe(await response.text());
    }
  }
  for(const url of ['/tools/validate-site.mjs','/tests/release.test.js','/README.md','/package.json','/output/private.txt','/.git/config','/not-a-page']){
    const response=await request.get(url);expect(response.status(),url).toBe(404);expect(await response.text()).toContain('找不到這個頁面');
  }
  expect((await request.get('/favicon.ico')).status()).toBe(200);
  const redirect=await request.get('/guide?test=1',{maxRedirects:0});expect(redirect.status()).toBe(301);expect(redirect.headers().location).toBe('/guide/?test=1');
});

for(const [article,bank,title] of [['basic-drone-license','normal','普通操作證'],['pro-drone-license','pro','專業操作證']])
test(`guide ${article} opens correct bank and preserves navigation`,async({page})=>{
  await page.goto(`/guide/${article}.html`);
  await expect(page.locator('.content-meta')).toContainText('2026-09-21');
  await page.locator(`[data-guide-bank=${bank}]`).click();
  await expect(page.locator('#screen-reading')).toBeVisible();
  expect(await page.evaluate(()=>app.currentCategory)).toBe(bank);
  await expect(page.locator('#mode-title')).toHaveText(title);
  await page.getByRole('button',{name:'返回模式選擇',exact:true}).first().click();
  await expect(page.locator('#screen-mode')).toBeVisible();
});
