import { LearningStore } from './learning-storage.js';
import { emptyState, createAttempt, compatible, resultFor, recordAnswer, archive, mistakeKey, parseState, MAX_BYTES } from './learning-model.js';
import { ReadingView } from './reading.js';
import { banks, catalog, loadBank } from './bank-loader.js';
import { BANK_HASHES } from './learning-model.js';

const $ = id => document.getElementById(id);
export function node(tag, text = '', className = '') {
  const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n;
}
function button(text, action, style = 'btn btn-outline') {
  const n = node('button', text, style); n.type = 'button'; n.onclick = action; return n;
}
const versionMatches = a => catalog[a.bankId]?.version === a.bankVersion && BANK_HASHES[a.bankId] === a.bankHash;
const title = id => categoryConfigs[id]?.title || id;
const formatDate = value => new Date(value).toLocaleString('zh-TW');
const duration = ms => `${Math.floor(ms / 60000)} 分 ${Math.floor(ms / 1000) % 60} 秒`;

const banner = node('div', '', 'storage-banner'); banner.id = 'learning-notice'; banner.hidden = true; banner.setAttribute('role','status');
document.querySelector('.container').prepend(banner);
const bankStatus=node('div','','storage-banner');bankStatus.id='bank-status';bankStatus.hidden=true;bankStatus.setAttribute('role','status');bankStatus.tabIndex=-1;banner.after(bankStatus);
const homePanel = node('section', '', 'learning-home'); homePanel.setAttribute('aria-label','我的學習');
homePanel.innerHTML = `<div id="resume-panel" hidden></div><div class="learning-shortcuts"><button type="button" class="btn btn-outline" id="open-mistakes">我的錯題</button><button type="button" class="btn btn-outline" id="open-history">歷史與資料管理</button></div><p class="local-note">學習紀錄只儲存在此瀏覽器；不會自動跨裝置同步。可在資料管理匯出備份。</p>`;
document.querySelector('.data-strip').after(homePanel);
for (const id of ['review','history']) {
  const screen = node('section', '', 'card learning-screen'); screen.id = `screen-${id}`; screen.style.display = 'none';
  document.querySelector('.container').append(screen);
}
const savedLabel = node('p', '', 'save-status'); savedLabel.id = 'save-status'; savedLabel.setAttribute('role','status'); $('screen-quiz').append(savedLabel);
const original = Object.fromEntries(['startQuiz','handleQuizAction','hideAllScreens','goHome','loadQuestion'].map(key => [key,app[key].bind(app)]));

const learning = {
  navigationId:0,
  async load(id, action) {
    const navigation=++this.navigationId;
    bankStatus.replaceChildren(node('p',`正在載入${title(id)}…`));bankStatus.hidden=false;
    if(!banks[id])bankStatus.focus();
    try {
      const bank=await loadBank(id);
      if(navigation!==this.navigationId)return false;
      bankStatus.hidden=true;
      await action(bank);return true;
    } catch(error) {
      if(navigation!==this.navigationId)return false;
      bankStatus.replaceChildren(node('p',error.message),button('重試載入',()=>this.load(id,action)),button('回首頁',()=>app.goHome()));
      bankStatus.hidden=false;return false;
    }
  },
  select(id) {
    return this.load(id,bank=>{
      app.currentCategory=id;app.currentDB=bank;$('mode-title').textContent=title(id);
      trackEvent('question_bank_select',{question_bank:id,question_bank_label:title(id),question_count:Object.keys(bank.data).length,placement:'home_bank'});
      app.goModeSelect();
    });
  },
  banks, busy: false, attempt: null, elapsed: 0, activityAt: Date.now(), lastTick: Date.now(),
  notice(message, conflict = false) {
    banner.replaceChildren(node('p',message)); banner.hidden = false;
    if (conflict) banner.append(button('載入其他分頁最新紀錄', () => this.loadLatest()));
  },
  storageNotice(kind) {
    if (kind === 'conflict') this.notice('另一個分頁已更新學習紀錄。此頁暫停儲存與作答，請先載入最新紀錄，避免覆蓋。',true);
    else if (kind === 'corrupt') this.notice('原有學習紀錄格式損壞，已保留原始資料。本次只能暫存在此頁；請到資料管理匯出原始資料後再清除。');
    else if (kind === 'unavailable') this.notice('無法安全儲存到此瀏覽器（權限、容量限制或缺少多分頁鎖定支援）。仍可練習，但關閉或重新整理可能失去本次進度；請匯出備份。');
    else if (kind === 'saved') banner.hidden = true;
    this.updateSaved();
  },
  updateSaved() {
    if (!this.store) return;
    savedLabel.textContent = this.busy ? '正在儲存…' : this.store.problem ? '本次進度尚未可靠保存，請查看上方提示。' : this.attempt ? '已保存於此瀏覽器，可回首頁或稍後繼續。' : '';
  },
  async write(change, options) {
    try {
      const ok = await this.store.commit(change,options);
      if (ok) this.home();
      return ok;
    } catch (error) { this.notice(`紀錄未能更新：${error.message}。請先匯出備份再處理。`); return false; }
  },
  home() {
    const panel = $('resume-panel'), a = this.store.state.active;
    panel.replaceChildren(); panel.hidden = !a;
    if (!a) return;
    panel.append(node('strong',`${title(a.bankId)} · ${a.mode === 'review' ? '錯題複習' : '一般練習'}`));
    panel.append(node('p',`已作答 ${a.answers.length}／${a.questionIds.length} 題 · ${formatDate(a.updatedAt)}`));
    if (versionMatches(a)) panel.append(button('繼續上次練習',()=>this.resume(),'btn btn-primary'));
    else panel.append(node('p','這筆紀錄的題庫版本不符或未載入，暫時無法續做。舊紀錄仍保留，可匯出；開始新練習時會將它保留在歷史中。'));
  },
  async start(num, ids = null, mode = 'practice') {
    if (this.busy) return;
    if (this.store.problem === 'conflict') return this.storageNotice('conflict');
    const active = this.store.state.active;
    if (active?.answers.length && !confirm('開始新練習會停止目前續做，並將目前紀錄保留在歷史中。要繼續嗎？')) return;
    this.busy = true;
    try {
      original.startQuiz(num,ids,mode,true);
      app.actionReadyAt = Infinity;
      const a = createAttempt(app.currentCategory,app.currentDB,app.quizQuestions,mode);
      const ok = await this.write(state => { if (state.active) archive(state,state.active,'abandoned'); state.active = a; });
      if (ok) {
        this.attempt = this.store.state.active; this.elapsed = 0; this.lastTick = Date.now(); this.activityAt = Date.now();
        trackEvent(mode === 'review' ? 'review_start' : 'quiz_start',{question_bank:app.currentCategory,requested_question_count:num,question_count:a.questionIds.length});
      }
      else { this.attempt = null; app.goHome(); }
    } finally { if(app.actionReadyAt === Infinity) app.actionReadyAt = 0; this.busy = false; this.updateSaved(); }
  },
  async action(event) {
    if (this.busy || event?.detail > 1 || event?.repeat || performance.now() < (app.actionReadyAt || 0)) return;
    if (!this.attempt || this.store.problem === 'conflict') { this.storageNotice(this.store.problem || 'conflict'); return; }
    if (app.qState === 'waiting' && !app.qSelected) return;
    if (!['waiting','answered'].includes(app.qState)) return;
    this.busy = true; this.updateSaved();
    // Reserve the existing debounce gate synchronously while the atomic save waits.
    // Keyboard callers must not observe an expired gate before the new question loads.
    const previousReadyAt = app.actionReadyAt;
    app.actionReadyAt = Infinity;
    try {
      const id = this.attempt.attemptId;
      const selected = app.qSelected;
      let completed = null;
      const ok = await this.write(state => {
        if (state.active?.attemptId !== id) throw new Error('練習已在其他位置變更');
        if (app.qState === 'waiting') recordAnswer(state,id,selected,banks,this.elapsed);
        else if (app.qIndex === app.quizQuestions.length - 1) {
          state.active.activeDurationMs = Math.round(this.elapsed);
          archive(state,state.active,'completed'); completed = state.history[0];
        } else {
          state.active.currentIndex = app.qIndex + 1;
          state.active.activeDurationMs = Math.round(this.elapsed);
          state.active.updatedAt = new Date().toISOString();
        }
      });
      if (!ok) return;
      this.attempt = completed || this.store.state.active;
      app.qSelected = selected;
      if (selected) $('q-options').querySelector(`input[value="${selected}"]`).checked = true;
      app.actionReadyAt = previousReadyAt;
      original.handleQuizAction(event);
    } finally { if(app.actionReadyAt === Infinity) app.actionReadyAt = previousReadyAt; this.busy = false; this.updateSaved(); }
  },
  resume() {
    const a=this.store.state.active;
    if(!a||!versionMatches(a))return this.notice('紀錄版本不符，請保留備份並開始新的練習。');
    return this.load(a.bankId,()=>this.restore());
  },
  restore() {
    if (this.busy || this.store.problem === 'conflict') return this.storageNotice('conflict');
    const a = this.store.state.active;
    if (!a || !compatible(a,banks)) return this.notice('紀錄版本不符或題庫未載入，請保留備份並開始新的練習。');
    this.attempt = a; this.elapsed = a.activeDurationMs; this.lastTick = Date.now(); this.activityAt = Date.now();
    app.currentCategory = a.bankId; app.currentDB = banks[a.bankId]; app.practiceMode = a.mode;
    $('mode-title').textContent = title(a.bankId);
    const result = resultFor(a,banks);
    app.quizQuestions = [...a.questionIds]; app.qIndex = a.currentIndex; app.qAnswered = a.answers.length;
    app.qCorrect = result.correct; app.qWrongList = result.wrong.map(x => ({data: app.currentDB.data[x.questionId],userPicked: x.selected}));
    app.actionReadyAt = 0;
    app.hideAllScreens(); $('screen-quiz').style.display = 'block'; app.loadQuestion();
    const answer = a.answers[a.currentIndex];
    if (answer) {
      const official = app.currentDB.data[answer.questionId].answer;
      app.qSelected = answer.selected; app.qState = 'answered';
      $('q-options').querySelectorAll('input').forEach(input => { input.disabled = true; input.checked = input.value === answer.selected; input.parentElement.classList.add('disabled'); });
      $(`opt-${official}`).classList.add('is-correct');
      if (answer.selected !== official) $(`opt-${answer.selected}`).classList.add('is-wrong');
      $('q-feedback').textContent = answer.selected === official ? `答對了。官方答案：${official.toUpperCase()}` : `本題答錯。你選 ${answer.selected.toUpperCase()}；官方答案：${official.toUpperCase()}`;
      $('q-btn').disabled = false; $('q-btn').textContent = app.qIndex === a.questionIds.length - 1 ? '查看測驗結果' : '下一題';
    }
    this.updateSaved();
    trackEvent('quiz_resume',{question_bank:a.bankId,mode:a.mode,answered_count:a.answers.length});
  },
  loadLatest() {
    this.store.reload(); this.attempt = null; banner.hidden = true;
    if (this.store.problem) this.storageNotice(this.store.problem);
    app.goHome();
    if (this.store.state.active && versionMatches(this.store.state.active)) this.resume();
  },
  openScreen(name, heading) {
    app.hideAllScreens(); const screen = $(`screen-${name}`); screen.replaceChildren(node('h2',heading,'title-main'));
    screen.style.display = 'block'; app.focusScreen(screen.id); return screen;
  },
  review() {
    const id=this.reviewBank||app.currentCategory||'normal';
    return this.load(id,()=>this.renderReview());
  },
  renderReview() {
    const screen = this.openScreen('review','我的錯題');
    screen.append(node('p','只記錄此功能啟用後的作答，無法回補以前的錯題。答對一次仍保留紀錄，由你標記「已掌握」。','local-note'));
    const filters = node('div','','learning-filters');
    const select = (id,label,values,current) => {
      const wrap = node('label',label); const input = node('select'); input.id = id;
      values.forEach(([value,text]) => { const option=node('option',text); option.value=value; input.append(option); });
      input.value = current; wrap.append(input); filters.append(wrap); return input;
    };
    const bank = select('review-bank','題庫',Object.keys(catalog).map(id=>[id,title(id)]),this.reviewBank || app.currentCategory || 'normal');
    const chapter = select('review-section','章節',[['','全部章節']], '');
    const status = select('review-status','狀態',[['pending','待複習'],['mastered','已掌握'],['','全部狀態']],this.reviewStatus ?? 'pending');
    const fillChapters=()=>{
      chapter.replaceChildren(new Option('全部章節',''));
      Object.entries(banks[bank.value]?.sectionTitle || {}).forEach(([key,name])=>chapter.add(new Option(name,key.slice(1))));
      chapter.value = this.reviewSection || '';
    };
    fillChapters(); screen.append(filters);
    const summary=node('p'); summary.id='review-summary'; summary.setAttribute('role','status'); screen.append(summary);
    const actions=node('div','','learning-actions');
    const practice=button('再練篩選錯題',()=>{
      const list=this.filteredMistakes(); if(!list.length)return;
      app.currentCategory=bank.value; app.currentDB=banks[bank.value]; $('mode-title').textContent=title(bank.value);
      this.start(list.length,list.map(m=>m.questionId),'review');
    },'btn btn-primary'); actions.append(practice,button('回首頁',()=>app.goHome())); screen.append(actions);
    const list=node('div'); list.id='review-list'; screen.append(list);
    this.filteredMistakes=()=>this.store.state.mistakes.filter(m=>m.bankId===bank.value&&compatible(m,banks)&&(!chapter.value||banks[m.bankId].data[m.questionId].section===Number(chapter.value))&&(!status.value||m.reviewStatus===status.value)).sort((a,b)=>Number(a.questionId.slice(1))-Number(b.questionId.slice(1)));
    const render=()=>{
      this.reviewBank=bank.value; this.reviewSection=chapter.value; this.reviewStatus=status.value;
      const all=this.filteredMistakes(); const stale=this.store.state.mistakes.filter(m=>!versionMatches(m)).length;
      summary.textContent=`符合條件 ${all.length} 題${stale ? `；另有 ${stale} 題舊版本紀錄保留在備份中，未混入目前題庫` : ''}`;
      practice.disabled=!all.length; list.replaceChildren();
      if(!all.length) list.append(node('p','目前沒有符合條件的錯題，可調整篩選或開始一般練習。','empty-state'));
      // Bounded DOM even when a learner has accumulated the entire bank.
      const size=30, pages=Math.max(1,Math.ceil(all.length/size)); this.reviewPage=Math.min(this.reviewPage||0,pages-1);
      const paging=node('div','','learning-actions');
      const prev=button('上一頁',()=>{this.reviewPage--;render();summary.focus();});prev.disabled=this.reviewPage===0;
      const next=button('下一頁',()=>{this.reviewPage++;render();summary.focus();});next.disabled=this.reviewPage===pages-1;
      summary.tabIndex=-1; paging.append(prev,node('span',`${this.reviewPage+1}／${pages} 頁`),next); if(pages>1)list.append(paging);
      all.slice(this.reviewPage*size,(this.reviewPage+1)*size).forEach(m=>{
        const q=banks[m.bankId].data[m.questionId]; const card=node('article','','read-card');
        card.append(node('p',`${m.questionId} · ${banks[m.bankId].sectionTitle[`s${q.section}`]}`,'q-meta'),node('p',q.description,'read-q'));
        card.append(node('p',`累計答錯 ${m.wrongCount} 次 · 最近選 ${m.lastSelected.toUpperCase()} · ${m.lastCorrect?'最近已答對':'最近答錯'} · ${formatDate(m.lastAnsweredAt)}`,'local-note'));
        const label=node('label',`${m.questionId} 複習狀態`); const control=node('select'); control.add(new Option('待複習','pending'));control.add(new Option('已掌握','mastered'));control.value=m.reviewStatus;
        control.onchange=async()=>{const ok=await this.write(state=>{state.mistakes.find(x=>mistakeKey(x)===mistakeKey(m)).reviewStatus=control.value;});if(ok){render();summary.focus();}};
        label.append(control);card.append(label);
        for(const key of ['a','b','c','d'])card.append(node('div',`(${key.toUpperCase()}) ${q.options[key]}`,key===q.answer?'read-opt read-correct':'read-opt'));
        card.append(node('p',`官方答案：${q.answer.toUpperCase()}`));list.append(card);
      });
    };
    bank.onchange=()=>{const id=bank.value;practice.disabled=true;this.reviewBank=id;this.reviewSection='';this.reviewPage=0;this.load(id,()=>this.renderReview());};
    chapter.onchange=status.onchange=()=>{this.reviewPage=0;render();}; render();
  },
  async history() {
    const ids=[...new Set(this.store.state.history.filter(versionMatches).map(a=>a.bankId))];
    // The management screen remains available for backup even if a bank is offline.
    const navigation=++this.navigationId;
    if(ids.some(id=>!banks[id])){
      const screen=this.openScreen('history','歷史與資料管理');
      const loading=node('p','正在載入歷史紀錄所需題庫…');loading.setAttribute('role','status');
      screen.append(loading,button('匯出學習紀錄',()=>this.export()),button('回首頁',()=>app.goHome()));
    }
    await Promise.allSettled(ids.map(loadBank));
    if(navigation!==this.navigationId)return;
    this.renderHistory();
  },
  renderHistory() {
    const screen=this.openScreen('history','歷史與資料管理');
    screen.append(node('p','最多保留最近 50 次結果。練習與錯題複習分開標示；分數以紀錄所屬版本的答案計算。資料只在本機，可匯出後於另一裝置手動匯入。','local-note'));
    const actions=node('div','','learning-actions');
    actions.append(button('匯出學習紀錄',()=>this.export()),button('回首頁',()=>app.goHome()));
    if(this.store.problem==='corrupt')actions.append(button('匯出損壞原始資料',()=>this.download(this.store.raw,'uav-original-record.txt')));
    screen.append(actions);
    const label=node('label','匯入備份（JSON，最多 2 MB；會取代本機紀錄）');const file=node('input');file.type='file';file.accept='.json,application/json';file.id='learning-import';label.append(file);screen.append(label);
    const importStatus=node('p');importStatus.id='import-status';importStatus.setAttribute('role','status');screen.append(importStatus);
    file.onchange=async()=>{
      const chosen=file.files[0];if(!chosen)return;
      try {
        if(chosen.size>MAX_BYTES)throw new Error('檔案超過 2 MB 上限');
        const raw=await chosen.text();const preview=parseState(raw,banks);
        const ids=[...new Set([preview.active,...preview.history,...preview.mistakes].filter(Boolean).filter(versionMatches).map(a=>a.bankId))];
        await Promise.all(ids.map(loadBank));
        const data=parseState(raw,banks);
        importStatus.textContent=`驗證通過：${data.history.length} 筆歷史、${data.mistakes.length} 題錯題、${data.active?'1':'0'} 筆續做。`;
        if(!confirm(`${importStatus.textContent}\n確定以此備份取代目前本機紀錄？建議先匯出現有資料。`))return;
        const ok=await this.write(state=>Object.assign(state,data),{reset:true});
        if(ok){this.attempt=null;banner.hidden=!this.store.problem;this.renderHistory();$('import-status').textContent='已匯入備份。';}
      }catch(error){importStatus.textContent=`匯入失敗：${error.message}`;}finally{file.value='';}
    };
    const clear=node('div','','learning-actions');
    clear.append(button('清除歷史紀錄',async()=>{if(confirm('確定清除歷史結果？續做與錯題會保留。')){if(await this.write(state=>{state.history=[];}))this.history();}}));
    clear.append(button('清除錯題本',async()=>{if(confirm('確定清除全部版本的錯題紀錄？這不會刪除續做與歷史結果。')){if(await this.write(state=>{state.mistakes=[];}))this.history();}}));
    clear.append(button('清除全部學習資料',async()=>{if(confirm('確定清除續做、歷史、錯題與閱讀位置？無法復原，請先匯出備份。')){if(await this.write(state=>Object.assign(state,emptyState()),{reset:true})){this.attempt=null;banner.hidden=!this.store.problem;reading.clearPositions();this.history();}}}));screen.append(clear);
    const list=node('div');list.id='history-list';screen.append(list);
    if(!this.store.state.history.length)list.append(node('p','目前尚無歷史結果。','empty-state'));
    this.store.state.history.forEach(a=>{
      const result=resultFor(a,banks),card=node('article','','read-card');
      card.append(node('h3',`${title(a.bankId)} · ${a.mode==='review'?'錯題複習':'一般練習'}`));
      card.append(node('p',`${formatDate(a.updatedAt)} · ${a.status==='completed'?'已完成':'已停止'} · 題庫版本 ${a.bankVersion}`,'local-note'));
      card.append(node('p',result?`答對 ${result.correct} 題／答錯 ${result.wrong.length} 題／已答 ${result.answered}／${a.questionIds.length} 題 · 有效練習 ${duration(a.activeDurationMs)}`:'此紀錄屬舊版本或題庫未載入，保留作答資料，但不套用現在的答案重算。'));
      list.append(card);
    });
  },
  download(text,name) {
    const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));
    const a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  export() { this.download(JSON.stringify(this.store.state,null,2),`uav-learning-${new Date().toISOString().slice(0,10)}.json`); }
};
learning.store = new LearningStore(banks,kind=>learning.storageNotice(kind));
window.learning=learning;
const reading = new ReadingView(app,banks,title,node,button,message=>learning.notice(message));
app.hideAllScreens=function(){reading.remember();original.hideAllScreens();$('screen-review').style.display='none';$('screen-history').style.display='none';};
app.goHome=function(){learning.navigationId++;bankStatus.hidden=true;this.hideAllScreens();original.goHome();reading.clearUrl();learning.home();};
app.startQuiz=(num,ids=null,mode='practice')=>learning.start(num,ids,mode);
app.handleQuizAction=event=>learning.action(event);
app.loadQuestion=function(){original.loadQuestion();const q=this.currentDB.data[this.quizQuestions[this.qIndex]];$('q-meta').textContent=`${title(this.currentCategory)}｜原題號 Q${q.number}｜${$('q-meta').textContent}`;};
app.startReadingMode=()=>reading.open();
$('open-mistakes').onclick=()=>learning.review();$('open-history').onclick=()=>learning.history();
learning.home();if(learning.store.problem)learning.storageNotice(learning.store.problem);
for(const type of ['pointerdown','keydown','touchstart'])document.addEventListener(type,()=>{learning.activityAt=Date.now();},{passive:true});
setInterval(()=>{
  const now=Date.now();if(!document.hidden&&now-learning.activityAt<60000&&$('screen-quiz').style.display!=='none'&&app.qState!=='complete'&&learning.attempt)learning.elapsed+=Math.min(2000,now-learning.lastTick);
  learning.lastTick=now;
},1000);
if(window.siteAnalytics)window.siteAnalytics.context=()=>{
  const a=learning.attempt;if(!a)return {};
  return {attempt_id:a.attemptId,question_bank:a.bankId,bank_version:a.bankVersion,mode:a.mode,active_duration_ms:Math.round(learning.elapsed),placement:a.mode==='review'?'mistake_notebook':'quiz'};
};
window.resolveLearningReady();
reading.fromUrl();
document.documentElement.dataset.learningReady='true';
