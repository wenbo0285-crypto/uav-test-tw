import { load } from 'cheerio';

// Collapse only HTML display whitespace; never normalize punctuation or wording.
const display = value => String(value).replace(/[\t\n\r\f ]+/g, ' ').trim();
export function compareStaticBank(html, bank) {
  const $ = load(html);
  const errors = [];
  const equal = (actual, expected, label) => {
    if (display(actual) !== display(expected)) errors.push(`${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  };
  equal($('meta[name="question-bank-version"]').attr('content'), bank.version, 'version');
  const questions = Object.values(bank.data).sort((a,b) => a.number-b.number);
  const items = $('.question-list > .question-item');
  equal(items.length, questions.length, 'question count');
  equal($('.bank-stat').first().find('strong').text(), questions.length, 'summary count');
  questions.forEach((q, i) => {
    const item = items.eq(i);
    const chapter = bank.sectionTitle?.[`s${q.section}`];
    if (!chapter) errors.push(`Q${q.number}: missing chapter name`);
    equal(item.find('.question-meta').text(), `第 ${q.section} 章 - ${chapter} / 題號 ${q.number}`, `Q${q.number} number/chapter`);
    equal(item.find('.question-title').text(), q.description, `Q${q.number} description`);
    const options = item.find('.option-list > li');
    equal(options.length, 4, `Q${q.number} option count`);
    ['a','b','c','d'].forEach((key,j) => {
      equal(options.eq(j).text(), `(${key.toUpperCase()}) ${q.options[key]}`, `Q${q.number} ${key}`);
      if (options.eq(j).hasClass('correct') !== (key === q.answer)) errors.push(`Q${q.number} ${key}: incorrect answer styling`);
    });
    equal(item.find('.answer').text(), `正確答案：${q.answer.toUpperCase()}`, `Q${q.number} answer`);
  });
  return errors;
}
