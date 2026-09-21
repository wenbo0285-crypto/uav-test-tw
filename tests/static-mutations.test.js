import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import { load } from 'cheerio';
import { compareStaticBank } from '../tools/static-bank-check.mjs';
for (const [name, variable] of [['normal','dataNormal'],['pro','dataPro'],['normal_renew','dataNormalRenew'],['pro_renew','dataProRenew']]) {
  test(`${name}: mutation guards`, () => {
    const bank = vm.runInNewContext(`${fs.readFileSync(`data_${name}.js`,'utf8')}; ${variable}`);
    const html = fs.readFileSync(`questions/${name.replaceAll('_','-')}-bank.html`, 'utf8');
    expect(compareStaticBank(html, bank)).toEqual([]);
    for (const mutate of [
      $ => $('.answer').first().text('正確答案：X'),
      $ => $('.question-item').first().remove(),
      $ => $('.question-title').first().append('。'),
      $ => $('.option-list li').first().append('變更'),
      $ => $('.question-meta').first().text('題號 9999'),
      $ => $('meta[name="question-bank-version"]').attr('content','bad')
    ]) {
      const $ = load(html); mutate($);
      expect(compareStaticBank($.html(), bank).length).toBeGreaterThan(0);
    }
    const bad = structuredClone(bank); bad.sectionTitle = {};
    expect(compareStaticBank(html,bad).length).toBeGreaterThan(0);
  });
}
