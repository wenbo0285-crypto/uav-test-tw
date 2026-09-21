import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('generator is reproducible and CLI rejects static corruption',()=>{
  const root=process.cwd();
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'uav-0921-'));
  try {
    for(const name of fs.readdirSync(root)) {
      if(name.endsWith('.html') || name.endsWith('.js') || ['sitemap.xml','robots.txt'].includes(name)) fs.copyFileSync(name,path.join(temp,name));
    }
    for(const dir of ['questions','guide','assets']) fs.cpSync(dir,path.join(temp,dir),{recursive:true});
    const run=()=>spawnSync('pwsh',['-NoProfile','-File',path.join(root,'tools/generate-static-banks.ps1')],{cwd:temp,encoding:'utf8'});
    expect(run().status).toBe(0);
    const pages=['normal','pro','normal-renew','pro-renew'].map(n=>`questions/${n}-bank.html`);
    const first=pages.map(p=>fs.readFileSync(path.join(temp,p),'utf8'));
    expect(run().status).toBe(0);
    pages.forEach((p,i)=>{
      expect(fs.readFileSync(path.join(temp,p),'utf8')).toBe(first[i]);
      expect(first[i].replaceAll('\r\n','\n')).toBe(fs.readFileSync(p,'utf8').replaceAll('\r\n','\n'));
    });
    const validate=()=>spawnSync(process.execPath,[path.join(root,'tools/validate-site.mjs')],{cwd:temp,encoding:'utf8'});
    expect(validate().status).toBe(0);
    const target=path.join(temp,pages[0]);
    fs.writeFileSync(target,first[0].replace(/正確答案：[ABCD]/,'正確答案：X'));
    expect(validate().status).toBe(1);
    fs.writeFileSync(target,first[0].replace(/<article class="question-item">[\s\S]*?<\/article>/,''));
    expect(validate().status).toBe(1);
  } finally {
    // The only deletion target is this test's freshly created OS temporary directory.
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
