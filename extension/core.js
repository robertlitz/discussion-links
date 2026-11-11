export const SOURCES = ['reddit', 'hn'];
export const CACHE_LIMIT = 100;
export const TTL = 15 * 60_000;
export const EMPTY_TTL = 5 * 60_000;
export const FAILURE_TTL = 60_000;
const TRACKING = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid)$/i;
const SECRET = /^(access_token|refresh_token|token|auth|authorization|api[_-]?key|password|passwd|secret|signature|sig|code|session|sessionid|x-amz-.+|x-goog-.+)$/i;

export function publicUrl(raw) {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || raw.length > 2048) return null;
    const host = u.hostname.toLowerCase();
    if (!host.includes('.') || /(^|\.)(localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(host) || host.endsWith('.localhost')) return null;
    // Conservative: never transmit IP-literal or local-network addresses.
    if (/^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return null;
    for (const [key] of u.searchParams) if (SECRET.test(key)) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return u.href;
  } catch { return null; }
}

export function urlKey(raw) {
  const safe = publicUrl(raw);
  if (!safe) return null;
  const u = new URL(safe);
  const host = u.hostname.replace(/^www\./, '');
  return `${host}${u.port ? ':' + u.port : ''}${u.pathname.replace(/\/$/, '')}${u.search}`;
}

export function searchUrl(source, url, cursor) {
  const u = new URL(source === 'hn' ? 'https://hn.algolia.com/api/v1/search' : 'https://www.reddit.com/search.json');
  if (source === 'hn') {
    u.search = new URLSearchParams({query: urlKey(url), tags: 'story', restrictSearchableAttributes: 'url', hitsPerPage: '100', page: String(cursor || 0), typoTolerance: 'false', attributesToRetrieve: 'objectID,title,url,points,num_comments,created_at_i'});
  } else {
    u.search = new URLSearchParams({q:`url:"${urlKey(url)}"`, type:'link', sort:'relevance', t:'all', limit: '100', raw_json: '1'});
    if (cursor) u.searchParams.set('after', cursor);
  }
  return u.href;
}

export function manualSearch(source, url) {
  const u = new URL(source === 'hn' ? 'https://hn.algolia.com/' : 'https://www.reddit.com/search/');
  u.search = new URLSearchParams(source === 'hn' ? {query: urlKey(url), type: 'story'} : {q: `url:"${url}"`, type: 'link'});
  return u.href;
}

export function parseResults(source, payload, url) {
  const key = urlKey(url);
  const rows = source === 'hn' ? payload?.hits : payload?.data?.children;
  if (!Array.isArray(rows)) throw new Error('Unexpected search response');
  const seen = new Set();
  const posts = [];
  for (const row of rows) {
    const p = source === 'hn' ? row : row?.data;
    if (!p || urlKey(p.url_overridden_by_dest || p.url) !== key) continue;
    const rawId = source === 'hn' ? p.objectID : p.id;
    if (rawId == null) continue;
    const id = String(rawId);
    if (!(source === 'hn' ? /^\d+$/ : /^[a-z0-9]+$/).test(id) || seen.has(id)) continue;
    seen.add(id);
    posts.push({id: `${source}:${id}`, source, title: String(p.title || 'Untitled discussion').slice(0, 400),
      href: source === 'hn' ? `https://news.ycombinator.com/item?id=${id}` : `https://www.reddit.com/comments/${id}/`,
      community: source === 'hn' ? 'Hacker News' : `r/${String(p.subreddit || 'reddit').slice(0, 80)}`,
      score: Number(p.points ?? p.score) || 0, comments: Number(p.num_comments) || 0,
      created: Number(p.created_at_i ?? p.created_utc) || 0});
  }
  const next = source === 'hn' ? ((payload.page ?? 0) + 1 < payload.nbPages ? (payload.page ?? 0) + 1 : null) : payload.data.after || null;
  return {posts, next};
}

export function combine(sources) {
  return [...new Map(SOURCES.flatMap(s => sources[s]?.posts || []).map(p => [p.id, p])).values()]
    .sort((a,b) => b.comments - a.comments || b.score - a.score || b.created - a.created);
}

export function fresh(entry, now) { return !!entry && entry.expires > now; }
export function trimCache(cache, limit = CACHE_LIMIT) {
  const entries = Object.entries(cache).sort((a,b) => b[1].checked - a[1].checked).slice(0, limit);
  let bytes = 0;
  return Object.fromEntries(entries.filter(([key,value]) => {bytes += new TextEncoder().encode(key + JSON.stringify(value)).byteLength; return bytes <= 1_500_000;}));
}
