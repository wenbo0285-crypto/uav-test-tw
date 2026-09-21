import { emptyState, parseState, validateState, STORAGE_KEY, MAX_BYTES } from './learning-model.js';

// One atomic localStorage envelope keeps active answers, history and mistakes together.
// Web Locks serializes cooperating tabs; the raw snapshot also detects stale writers.
export class LearningStore {
  constructor(banks, notify = () => {}) {
    this.banks = banks; this.notify = notify; this.state = emptyState();
    this.raw = null; this.problem = null; this.queue = Promise.resolve();
    this.reload();
    window.addEventListener('storage', event => {
      if ((event.key === STORAGE_KEY || event.key === null) && event.newValue !== this.raw) {
        this.problem = 'conflict'; this.notify('conflict');
      }
    });
  }
  reload() {
    try {
      this.raw = localStorage.getItem(STORAGE_KEY);
      this.state = this.raw === null ? emptyState() : parseState(this.raw, this.banks);
      this.problem = null;
    } catch (error) {
      this.problem = this.raw === null ? 'unavailable' : 'corrupt';
      this.state = emptyState();
    }
    return this.state;
  }
  commit(change, {reset = false} = {}) {
    const work = (memoryOnly = false) => {
      if (this.problem === 'conflict') { this.notify('conflict'); return false; }
      const next = structuredClone(this.state);
      change(next);
      next.revision++;
      const checked = validateState(next, this.banks);
      const text = JSON.stringify(checked);
      if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new Error('本機紀錄已超過 2 MB，請先匯出並清理歷史或錯題');
      if (this.problem === 'corrupt' && !reset) {
        this.state = checked; this.notify('corrupt'); return true;
      }
      // Without cross-tab serialization, use memory instead of risking lost writes.
      if (memoryOnly || !navigator.locks?.request) {
        this.state = checked; this.problem = 'unavailable'; this.notify('unavailable'); return true;
      }
      try {
        const current = localStorage.getItem(STORAGE_KEY);
        if (current !== this.raw) { this.problem = 'conflict'; this.notify('conflict'); return false; }
        localStorage.setItem(STORAGE_KEY, text);
        this.raw = text; this.problem = null; this.state = checked; this.notify('saved');
      } catch {
        this.state = checked; this.problem = 'unavailable'; this.notify('unavailable');
      }
      return true;
    };
    const run = async () => {
      if (!navigator.locks?.request) return work(true);
      let entered = false;
      try { return await navigator.locks.request(STORAGE_KEY, () => { entered = true; return work(); }); }
      catch (error) { if (entered) throw error; return work(true); }
    };
    this.queue = this.queue.catch(() => {}).then(run);
    return this.queue;
  }
}
