export const STORAGE_KEY = 'uav:v1:learning';
export const MAX_HISTORY = 50;
export const MAX_BYTES = 2 * 1024 * 1024;
export const BANK_HASHES = Object.freeze({
  normal: 'e0120e070c80dea8758aa248c94e1c18ddca2d816a0d830966dde163c53e0353',
  pro: '551a752a95c94c3720005655de0cbf8c15dcdd689f840af8945d4c876df56253',
  normal_renew: '0fa4aa94e65e637655a875985acd36204d8f460d2aeb0355f2a00655ca323298',
  pro_renew: 'dd2444454797f2bc91721937281036c4f1ebcd0ac2945d3164007c0dd67c29f9'
});
export const emptyState = () => ({ schemaVersion: 1, revision: 0, active: null, history: [], mistakes: [] });
export const identity = item => `${item.bankId}:${item.bankVersion}:${item.bankHash}`;
export const mistakeKey = item => `${identity(item)}:${item.questionId}`;
export function compatible(item, banks) {
  const bank = banks[item.bankId];
  return !!bank && bank.version === item.bankVersion && BANK_HASHES[item.bankId] === item.bankHash;
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const plain = x => x && typeof x === 'object' && !Array.isArray(x);
const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
const option = x => typeof x === 'string' && /^[abcd]$/.test(x);
const integer = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;
function checkIdentity(item) {
  assert(typeof item.bankId === 'string' && Object.hasOwn(BANK_HASHES, item.bankId), '未知的題庫類別');
  assert(typeof item.bankVersion === 'string' && item.bankVersion.length > 0 && item.bankVersion.length <= 80, '題庫版本無效');
  assert(typeof item.bankHash === 'string' && /^[a-f0-9]{64}$/.test(item.bankHash), '題庫雜湊無效');
}
function checkId(id, item, banks) {
  assert(typeof id === 'string' && /^Q[1-9]\d{0,5}$/.test(id), '題號格式無效');
  if (item.bankHash === BANK_HASHES[item.bankId]) assert(Number(id.slice(1)) <= {normal:388,pro:588,normal_renew:120,pro_renew:324}[item.bankId], '題號不在對應题庫內');
  if (compatible(item, banks)) assert(Object.hasOwn(banks[item.bankId].data, id), '題號不在對應題庫內');
}
export function validateAttempt(a, banks) {
  assert(plain(a) && a.schemaVersion === 1, '練習紀錄格式無效');
  checkIdentity(a);
  assert(typeof a.attemptId === 'string' && /^[\w-]{8,100}$/.test(a.attemptId), '練習識別碼無效');
  assert(['practice', 'review'].includes(a.mode), '練習模式無效');
  assert(['in_progress', 'completed', 'abandoned'].includes(a.status), '練習狀態無效');
  assert(Array.isArray(a.questionIds) && a.questionIds.length > 0 && a.questionIds.length <= 588, '題目清單無效');
  a.questionIds.forEach(id => checkId(id, a, banks));
  assert(new Set(a.questionIds).size === a.questionIds.length, '題號重複');
  assert(Array.isArray(a.answers) && a.answers.length <= a.questionIds.length, '答案清單無效');
  a.answers.forEach((answer, i) => {
    assert(plain(answer) && answer.questionId === a.questionIds[i] && option(answer.selected) && answer.submitted === true && date(answer.answeredAt), '作答順序或選項無效');
  });
  assert(integer(a.currentIndex, 0, a.questionIds.length - 1), '目前題次無效');
  assert(a.currentIndex === a.answers.length || a.currentIndex === a.answers.length - 1, '目前題次與答案不一致');
  assert(a.status !== 'completed' || a.answers.length === a.questionIds.length, '完成紀錄缺少答案');
  assert(integer(a.activeDurationMs, 0, 10 * 365 * 86400000), '練習時間無效');
  assert(date(a.startedAt) && date(a.updatedAt), '紀錄日期無效');
  return {
    schemaVersion: 1, attemptId: a.attemptId, bankId: a.bankId, bankVersion: a.bankVersion,
    bankHash: a.bankHash, mode: a.mode, questionIds: [...a.questionIds],
    answers: a.answers.map(x => ({questionId: x.questionId, selected: x.selected, submitted: true, answeredAt: x.answeredAt})),
    currentIndex: a.currentIndex, activeDurationMs: a.activeDurationMs, status: a.status,
    startedAt: a.startedAt, updatedAt: a.updatedAt
  };
}
export function validateState(input, banks) {
  assert(plain(input) && input.schemaVersion === 1 && integer(input.revision, 0, Number.MAX_SAFE_INTEGER), '不支援的紀錄格式或版本');
  assert(Array.isArray(input.history) && input.history.length <= MAX_HISTORY, '歷史紀錄超過 50 筆');
  assert(Array.isArray(input.mistakes) && input.mistakes.length <= 6000, '錯題紀錄數量無效');
  const active = input.active === null ? null : validateAttempt(input.active, banks);
  assert(!active || active.status === 'in_progress', '續做紀錄狀態無效');
  const history = input.history.map(a => validateAttempt(a, banks));
  assert(history.every(a => a.status !== 'in_progress'), '歷史紀錄仍在進行中');
  const ids = history.map(a => a.attemptId).concat(active ? active.attemptId : []);
  assert(new Set(ids).size === ids.length, '練習識別碼重複');
  const mistakes = input.mistakes.map(m => {
    assert(plain(m), '錯題格式無效'); checkIdentity(m); checkId(m.questionId, m, banks);
    assert(integer(m.wrongCount, 1, 1000000) && option(m.lastSelected) && date(m.lastAnsweredAt), '錯題次數或作答無效');
    assert(typeof m.lastCorrect === 'boolean' && ['pending', 'mastered'].includes(m.reviewStatus), '複習狀態無效');
    if (compatible(m,banks)) assert(m.lastCorrect === (banks[m.bankId].data[m.questionId].answer === m.lastSelected), '最近作答狀態不一致');
    return { bankId: m.bankId, bankVersion: m.bankVersion, bankHash: m.bankHash, questionId: m.questionId,
      wrongCount: m.wrongCount, lastSelected: m.lastSelected, lastAnsweredAt: m.lastAnsweredAt,
      lastCorrect: m.lastCorrect, reviewStatus: m.reviewStatus };
  });
  assert(new Set(mistakes.map(mistakeKey)).size === mistakes.length, '錯題索引重複');
  return { schemaVersion: 1, revision: input.revision, active, history, mistakes };
}
export function parseState(text, banks) {
  assert(new TextEncoder().encode(text).byteLength <= MAX_BYTES, '檔案超過 2 MB 上限');
  return validateState(JSON.parse(text), banks);
}
export function createAttempt(bankId, bank, ids, mode = 'practice') {
  const now = new Date().toISOString();
  return { schemaVersion: 1, attemptId: crypto.randomUUID(), bankId, bankVersion: bank.version,
    bankHash: BANK_HASHES[bankId], mode, questionIds: [...ids], answers: [], currentIndex: 0,
    activeDurationMs: 0, status: 'in_progress', startedAt: now, updatedAt: now };
}
export function resultFor(a, banks) {
  if (!compatible(a, banks)) return null;
  const bank = banks[a.bankId];
  const wrong = a.answers.filter(x => bank.data[x.questionId].answer !== x.selected);
  return { correct: a.answers.length - wrong.length, wrong, answered: a.answers.length };
}
export function archive(state, attempt, status) {
  const record = {...structuredClone(attempt), status, updatedAt: new Date().toISOString()};
  state.history = [record, ...state.history.filter(a => a.attemptId !== record.attemptId)].slice(0, MAX_HISTORY);
  state.active = null;
}
export function recordAnswer(state, attemptId, selected, banks, duration) {
  const a = state.active;
  assert(a?.attemptId === attemptId && compatible(a, banks), '目前練習或版本已變更');
  const questionId = a.questionIds[a.currentIndex];
  if (a.answers[a.currentIndex]) return false;
  assert(option(selected), '請先選擇答案');
  const now = new Date().toISOString();
  a.answers.push({questionId, selected, submitted: true, answeredAt: now});
  a.updatedAt = now; a.activeDurationMs = Math.round(duration);
  const correct = banks[a.bankId].data[questionId].answer === selected;
  const key = `${identity(a)}:${questionId}`;
  let m = state.mistakes.find(x => mistakeKey(x) === key);
  if (!correct && !m) {
    m = {bankId: a.bankId, bankVersion: a.bankVersion, bankHash: a.bankHash, questionId,
      wrongCount: 0, reviewStatus: 'pending'};
    state.mistakes.push(m);
  }
  if (m) {
    if (!correct) m.wrongCount++;
    Object.assign(m, {lastSelected: selected, lastAnsweredAt: now, lastCorrect: correct});
  }
  return true;
}
