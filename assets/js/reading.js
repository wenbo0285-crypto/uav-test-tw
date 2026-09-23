import { catalog, loadBank } from './bank-loader.js';
const PAGE_SIZE = 40;
const POSITION_KEY = 'uav:v1:reading';
const $ = id => document.getElementById(id);

export class ReadingView {
  constructor(app, banks, title, node, button, notice) {
    Object.assign(this, {app, banks, title, node, button, notice, positions: {}, bankId: null});
    try {
      const raw = localStorage.getItem(POSITION_KEY);
      if (raw && raw.length < 16000) {
        const data = JSON.parse(raw);
        if (data.schemaVersion === 1) for (const id of Object.keys(catalog)) {
          const p = data.positions?.[id];
          if (p && typeof p.query === 'string' && p.query.length <= 200 && typeof p.chapter === 'string'
              && Number.isInteger(p.page) && p.page >= 0 && p.page < 100 && typeof p.showAnswers === 'boolean'
              && Number.isFinite(p.scroll) && p.scroll >= 0 && p.scroll < 1000000) this.positions[id] = p;
        }
      }
    } catch { /* Reading still works when position storage is unavailable. */ }
    window.addEventListener('popstate', () => {
      if (new URL(location.href).searchParams.has('mode')) this.fromUrl();
      else this.app.goHome();
    });
    window.addEventListener('pagehide',()=>this.remember());
  }
  persist() {
    try { localStorage.setItem(POSITION_KEY, JSON.stringify({schemaVersion:1, positions:this.positions})); }
    catch { /* Position is retained in memory for this visit. */ }
  }
  clearPositions() {
    this.positions={};this.bankId=null;
    try{localStorage.removeItem(POSITION_KEY);}catch{this.notice('無法清除瀏覽器中的閱讀位置，請使用瀏覽器設定清除本站資料。');}
  }
  remember() {
    if (this.bankId && $('screen-reading').style.display !== 'none') {
      this.positions[this.bankId].scroll = window.scrollY;
      this.persist();
    }
  }
  clearUrl() {
    const url = new URL(location.href);
    if (url.searchParams.get('mode') === 'reading') {
      ['bank','mode','q'].forEach(key => url.searchParams.delete(key));
      history.replaceState(null,'',url);
    }
  }
  link(id) {
    const url = new URL(location.href);
    url.searchParams.set('bank',this.bankId); url.searchParams.set('mode','reading');
    if (id) url.searchParams.set('q',id); else url.searchParams.delete('q');
    url.hash = ''; return url;
  }
  async fromUrl() {
    const params = new URL(location.href).searchParams;
    if (!['mode','bank','q'].some(key => params.has(key))) return;
    const bank = params.get('bank'), q = params.get('q');
    if (params.getAll('bank').length !== 1 || params.getAll('mode').length !== 1 || params.getAll('q').length > 1
        || params.get('mode') !== 'reading' || !Object.hasOwn(catalog,bank)
        || (q !== null && (!/^Q[1-9]\d{0,5}$/.test(q) || Number(q.slice(1))>catalog[bank].count))) {
      this.notice('閱讀連結的題庫或題號無效，請從四種題庫入口重新選擇。'); return;
    }
    await window.learning.load(bank,data=>{
      this.app.currentCategory=bank;this.app.currentDB=data;$('mode-title').textContent=this.title(bank);
      this.open(this.positions[bank]?.linkQuestion === q ? null : q);
    });
  }
  open(questionId = null) {
    this.app.hideAllScreens();
    this.bankId = this.app.currentCategory;
    const bank = this.banks[this.bankId];
    if (!bank) return this.notice('題庫尚未載入，請重新整理或選擇其他題庫。');
    this.state = this.positions[this.bankId] ||= {query:'',chapter:'',page:0,showAnswers:true,scroll:0};
    if (questionId) Object.assign(this.state,{query:'',chapter:'',page:Math.floor(Object.keys(bank.data).indexOf(questionId)/PAGE_SIZE),scroll:0});
    const {node,button} = this;
    const screen = $('screen-reading'); screen.replaceChildren(); screen.style.display = 'block';
    screen.append(node('h2',`${this.title(this.bankId)} · 閱讀模式`,'title-main'));
    screen.append(node('p','依官方原題序閱讀，每頁 40 題。可搜尋原題號、題目或選項，並搭配章節篩選。','local-note'));
    const controls = node('div','','learning-filters');
    const searchLabel = node('label','搜尋題號／題目／選項'); const search = node('input');
    search.id='reading-search'; search.type='search'; search.maxLength=200; search.value=this.state.query;
    search.placeholder='例如 Q123 或關鍵字'; searchLabel.append(search);
    const chapterLabel = node('label','章節'); const chapter=node('select'); chapter.id='reading-section';
    chapter.add(new Option('全部章節',''));
    Object.entries(bank.sectionTitle).forEach(([key,name])=>chapter.add(new Option(name,key.slice(1))));
    chapter.value=this.state.chapter; if(chapter.selectedIndex<0) chapter.value=''; this.state.chapter=chapter.value;
    chapterLabel.append(chapter); controls.append(searchLabel,chapterLabel); screen.append(controls);
    const actions=node('div','','learning-actions');
    const answerLabel=node('label','顯示官方答案','check-label'); const show=node('input');show.type='checkbox';show.id='reading-show-answers';show.checked=this.state.showAnswers;answerLabel.prepend(show);
    const reset=()=>{search.value='';chapter.value='';Object.assign(this.state,{query:'',chapter:'',page:0,scroll:0});this.render();search.focus();};
    actions.append(answerLabel,button('清除篩選',reset),button('返回模式選擇',()=>{this.clearUrl();this.app.goModeSelect();}));screen.append(actions);
    const summary=node('p');summary.id='reading-summary';summary.tabIndex=-1;summary.setAttribute('role','status');screen.append(summary);
    const paging=node('nav','','learning-actions');paging.id='reading-paging';paging.setAttribute('aria-label','閱讀分頁');screen.append(paging);
    const content=node('div');content.id='reading-content';screen.append(content);
    search.oninput=()=>{this.state.query=search.value;this.state.page=0;this.state.scroll=0;this.render();};
    chapter.onchange=()=>{this.state.chapter=chapter.value;this.state.page=0;this.state.scroll=0;this.render();};
    show.onchange=()=>{this.state.showAnswers=show.checked;this.render();};
    this.reset=reset;
    this.render();
    if(questionId){this.state.linkQuestion=questionId;history.replaceState(null,'',this.link(questionId));this.persist();}
    this.app.focusScreen('screen-reading');
    const scroll=this.state.scroll;
    requestAnimationFrame(()=>{
      if(questionId) { const target=$( `reading-${questionId}` );target?.focus();target?.scrollIntoView({block:'start'}); }
      else window.scrollTo(0,scroll);
    });
    this.app.readingTrackedDepths=new Set();this.app.bindReadingProgress();
    trackEvent('reading_mode_start',{question_bank:this.bankId,question_count:Object.keys(bank.data).length});
  }
  render() {
    const {node,button,state} = this, bank=this.banks[this.bankId];
    const query=state.query.trim().toLocaleLowerCase(), exact=/^q?[1-9]\d*$/.test(query)?`Q${query.replace(/^q/,'')}`:null;
    const ids=Object.keys(bank.data).filter(id=>{
      const q=bank.data[id];return (!state.chapter||String(q.section)===state.chapter)&&(!query||(exact?id===exact:[q.description,...Object.values(q.options)].some(text=>text.toLocaleLowerCase().includes(query))));
    });
    const pages=Math.max(1,Math.ceil(ids.length/PAGE_SIZE));state.page=Math.min(state.page,pages-1);
    $('reading-summary').textContent=`符合 ${ids.length}／${Object.keys(bank.data).length} 題 · 第 ${state.page+1}／${pages} 頁`;
    const navigate=delta=>{state.page+=delta;state.scroll=0;this.render();$('reading-summary').focus();$('reading-summary').scrollIntoView({block:'start'});};
    const prev=button('上一頁',()=>navigate(-1));prev.disabled=state.page===0;
    const next=button('下一頁',()=>navigate(1));next.disabled=state.page===pages-1;
    $('reading-paging').replaceChildren(prev,node('span',`${state.page+1}／${pages} 頁`),next);
    $('reading-paging').style.display=pages>1?'flex':'none';
    const content=$('reading-content');content.replaceChildren();
    if(!ids.length) { const empty=node('div','','empty-state');empty.append(node('p','找不到符合條件的題目。'),button('重設搜尋與章節',this.reset));content.append(empty); }
    for(const id of ids.slice(state.page*PAGE_SIZE,(state.page+1)*PAGE_SIZE)) {
      const q=bank.data[id],card=node('article','','read-card');card.id=`reading-${id}`;card.tabIndex=-1;card.dataset.questionId=id;
      card.append(node('p',`${id} · 第 ${q.section} 章 · ${bank.sectionTitle[`s${q.section}`]}`,'q-meta'),node('p',q.description,'read-q'));
      for(const key of ['a','b','c','d']) card.append(node('div',`(${key.toUpperCase()}) ${q.options[key]}`,state.showAnswers&&key===q.answer?'read-opt read-correct':'read-opt'));
      if(state.showAnswers) card.append(node('p',`官方答案：${q.answer.toUpperCase()}`,'reading-answer'));
      const link=node('a',`${id} 本題連結`,'question-link');link.href=this.link(id);card.append(link);content.append(card);
    }
    if(pages>1){
      const bottom=node('nav','','learning-actions');bottom.setAttribute('aria-label','頁尾閱讀分頁');
      const prev=button('上一頁',()=>navigate(-1));prev.disabled=state.page===0;
      const next=button('下一頁',()=>navigate(1));next.disabled=state.page===pages-1;
      bottom.append(prev,node('span',`${state.page+1}／${pages} 頁`),next,button('返回模式選擇',()=>{this.clearUrl();this.app.goModeSelect();}));content.append(bottom);
    }
    state.linkQuestion=ids[state.page*PAGE_SIZE] || null;
    history.replaceState(null,'',this.link(state.linkQuestion));this.persist();
  }
}
