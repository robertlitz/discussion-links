import {SOURCES, TTL, EMPTY_TTL, FAILURE_TTL, searchUrl, parseResults, combine, urlKey, fresh, trimCache} from './core.js';

export class LookupEngine {
  constructor({fetcher = fetch, now = Date.now, load = async () => ({}), save = async () => {}, timeout = 6000} = {}) {
    this.fetcher = fetcher; this.now = now; this.save = save; this.timeout = timeout;
    this.cache = {}; this.cooldown = {}; this.pending = new Map(); this.tail = Promise.resolve();
    this.ready = load().then(data => {this.cache = trimCache(data.cache || {}); this.cooldown = data.cooldown || {};}).catch(() => {});
  }
  async persist() {
    this.cache = trimCache(this.cache);
    await this.save({cache: this.cache, cooldown: this.cooldown}).catch(() => {});
  }
  async peek(url) { await this.ready; return this.cache[urlKey(url)] || null; }
  cancelInvalid() {
    for (const job of this.pending.values()) {
      if (!job.clients.some(client => client.valid())) job.controller.abort();
    }
  }
  async lookup(url, {valid = () => true, onProgress = () => {}} = {}) {
    await this.ready;
    const key = urlKey(url);
    if (!key) return null;
    if (fresh(this.cache[key], this.now())) return this.cache[key];
    if (this.pending.has(key)) {
      const job = this.pending.get(key);
      if (job.controller.signal.aborted) {
        await job.promise.catch(() => {});
        return valid() ? this.lookup(url, {valid,onProgress}) : null;
      }
      job.clients.push({valid, onProgress}); return job.promise;
    }
    // Bound queued work even under rapid tab switching. No busy waits or automatic retries.
    if (this.pending.size >= 8) return {url, posts: [], sources: {}, checked: this.now(), expires: 0, busy: true};
    const job = {clients: [{valid, onProgress}], controller: new AbortController()};
    job.promise = this.tail.then(async () => {
      if (!job.clients.some(c => c.valid())) return null;
      const sources = {};
      const old = this.cache[key];
      await Promise.all(SOURCES.map(async source => {
        const previous = old?.sources[source];
        if (previous?.state === 'ok' && previous.expires > this.now()) sources[source] = previous;
        else sources[source] = await this.request(source, url, () => job.clients.some(c => c.valid()), job.controller.signal);
        const entry = {url, sources: {...sources}, posts: combine(sources), checked: this.now(), expires: 0, loading: Object.keys(sources).length < SOURCES.length};
        for (const client of job.clients) if (client.valid()) client.onProgress(entry);
      }));
      if (!job.clients.some(c => c.valid())) return null;
      const posts = combine(sources);
      const checked = this.now();
      const ok = SOURCES.every(s => sources[s].state === 'ok');
      const entry = {url, sources, posts, checked, expires: checked + (ok ? (posts.length ? TTL : EMPTY_TTL) : FAILURE_TTL)};
      this.cache[key] = entry;
      await this.persist();
      return entry;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, job);
    this.tail = job.promise.catch(() => {});
    return job.promise;
  }
  async request(source, url, valid, signal) {
    const wait = (this.cooldown[source] || 0) - this.now();
    if (wait > 1100) return {state:'cooldown', posts:[], retryAt:this.cooldown[source]};
    // A short pacing gap is deferred once instead of caching a missed lookup for a minute.
    if (wait > 0 && !signal?.aborted) await new Promise(resolve => {
      const done = () => {clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();};
      const timer = setTimeout(done,wait);signal?.addEventListener('abort',done,{once:true});
    });
    if (!valid() || signal?.aborted) return {state:'cancelled', posts:[]};
    const now = this.now();
    // Pace consecutive URL lookups; pagination is separately capped at two requests.
    this.cooldown[source] = now + 1100;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort',cancel,{once:true});
    const timer = setTimeout(() => controller.abort(), this.timeout);
    const posts = new Map();
    let cursor = null;
    try {
      for (let page = 0; page < 2; page++) {
        if (!valid() || signal?.aborted) return {state:'cancelled', posts:[]};
        const response = await this.fetcher(searchUrl(source, url, cursor), {signal:controller.signal, credentials:'omit', referrerPolicy:'no-referrer', cache:'no-store', redirect:'error', headers:{Accept:'application/json'}});
        if (!response.ok) {
          const seconds = Number(response.headers.get('retry-after'));
          const until = Date.parse(response.headers.get('retry-after'));
          const retry = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Number.isFinite(until) ? until - this.now() : 0;
          this.cooldown[source] = this.now() + Math.min(3600_000, Math.max(response.status === 403 ? 15 * 60_000 : 60_000, retry));
          return {state: response.status === 429 ? 'limited' : response.status === 403 || response.status === 401 ? 'blocked' : 'error', posts:[...posts.values()], retryAt:this.cooldown[source]};
        }
        const length = Number(response.headers.get('content-length'));
        if (length > 512_000) throw new Error('Search response too large');
        // Streaming cap prevents unusually large API responses from growing memory without bound.
        const reader = response.body.getReader();
        const decoder = new TextDecoder(); let text = ''; let bytes = 0;
        try {
          while (true) { const {value,done} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 512_000) throw new Error('Search response too large'); text += decoder.decode(value, {stream:true}); }
          text += decoder.decode();
        } finally { await reader.cancel().catch(() => {}); }
        const parsed = parseResults(source, JSON.parse(text), url);
        for (const post of parsed.posts) posts.set(post.id, post);
        cursor = parsed.next;
        if (cursor === null) break;
      }
      return {state:'ok', posts:[...posts.values()], truncated:cursor !== null, expires:this.now() + (posts.size ? TTL : EMPTY_TTL)};
    } catch (error) {
      if (signal?.aborted) return {state:'cancelled', posts:[]};
      this.cooldown[source] = this.now() + FAILURE_TTL;
      return {state:controller.signal.aborted ? 'timeout' : 'error', posts:[...posts.values()], retryAt:this.cooldown[source]};
    } finally {clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  }
}
