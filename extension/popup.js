import {manualSearch, SOURCES} from './core.js';
const $ = id => document.getElementById(id);
let state = {status:'loading',entry:null};
let filter = 'all'; let currentTab;
const labels = {ok:'checked',blocked:'unavailable',limited:'rate limited',timeout:'timed out',error:'unavailable',cooldown:'waiting to retry',cancelled:'cancelled'};
function render() {
  const {url,entry,status} = state;
  const posts = entry?.posts || [];
  const inactive = ['paused','unsupported','error','waiting'].includes(status);
  const searching = status === 'loading' || entry?.loading;
  $('pause').checked = status === 'paused' || !!state.paused;
  $('page').textContent = url ? url.replace(/^https?:\/\//,'') : 'This page is not checked';
  $('page').title = url || '';
  $('count').textContent = inactive ? '—' : String(posts.length);
  $('headline').textContent = status === 'paused' ? 'Automatic checks paused' : status === 'unsupported' ? 'This page stays private' : status === 'waiting' ? 'Waiting for the page to load' : status === 'error' ? 'Could not connect' : posts.length ? `linked discussion${posts.length === 1 ? '' : 's'}` : searching ? 'Looking for discussions' : 'No discussions found';
  $('refresh').disabled = inactive || searching;
  for (const source of SOURCES) {
    const result = entry?.sources?.[source]; const el = $(`${source}-status`);
    el.textContent = `${source === 'hn' ? 'Hacker News' : 'Reddit'} · ${inactive ? status === 'paused' ? 'paused' : 'skipped' : result ? labels[result.state] : searching ? 'searching' : 'waiting'}`;
    el.className = !inactive && result ? result.state === 'ok' ? 'ok' : 'warning' : '';
    $(`${source}-total`).textContent = String(posts.filter(p => p.source === source).length);
  }
  $('all-total').textContent = String(posts.length);
  const unavailable = Object.values(entry?.sources || {}).some(s => s.state !== 'ok');
  const truncated = Object.values(entry?.sources || {}).some(s => s.truncated);
  $('notice').textContent = inactive ? '' : entry?.busy ? 'Checks are busy. Try again shortly.' : unavailable ? 'Some sources could not be checked. The count includes confirmed results only.' : truncated ? 'Search limit reached. The count is a lower bound; search directly for more.' : '';
  $('results').replaceChildren();
  const visible = inactive ? [] : posts.filter(p => filter === 'all' || p.source === filter);
  const fragment = document.createDocumentFragment();
  for (const post of visible) {
    const li = document.createElement('li'); const a = document.createElement('a');
    a.className = 'post'; a.href = post.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    const top = document.createElement('div'); top.className = 'post-top';
    const mark = document.createElement('span'); mark.className = `source-mark ${post.source}`; mark.textContent = post.source === 'hn' ? 'Y' : 'r'; mark.setAttribute('aria-hidden','true');
    const community = document.createElement('span'); community.textContent = post.community;
    top.append(mark,community);
    const title = document.createElement('div'); title.className = 'post-title'; title.textContent = post.title;
    const meta = document.createElement('div'); meta.className = 'post-meta';
    for (const text of [`${post.comments.toLocaleString()} comments`, `${post.score.toLocaleString()} points`, post.created ? new Date(post.created * 1000).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}) : '']) {const span = document.createElement('span'); span.textContent = text; meta.append(span);}
    a.append(top,title,meta); li.append(a); fragment.append(li);
  }
  $('results').append(fragment);
  $('empty').hidden = visible.length > 0;
  $('empty-title').textContent = status === 'paused' ? 'Take a quiet moment' : status === 'unsupported' ? 'No lookup for this page' : status === 'waiting' ? 'Your page comes first' : status === 'error' ? 'Reopen the extension to retry' : posts.length ? 'No discussions in this community' : searching ? 'Checking both communities' : unavailable ? 'Search is partly unavailable' : 'No linked submissions yet';
  $('empty-copy').textContent = status === 'paused' ? 'Turn off Pause to resume automatic checks.' : status === 'unsupported' ? 'Browser pages, local addresses, and URLs with recognized secrets are skipped.' : status === 'waiting' ? 'Automatic searches start after loading finishes.' : status === 'error' ? 'The background worker did not respond.' : searching ? 'Results appear here as each search finishes.' : unavailable ? 'Try a direct search below. Failed checks are never counted as zero results.' : 'Try a direct search, or return when a new conversation starts.';
  $('searches').hidden = !url || inactive;
  if (url) for (const source of SOURCES) $(`${source}-search`).href = manualSearch(source,url);
  $('footnote').textContent = entry?.checked && !searching ? `Checked ${new Date(entry.checked).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})} · session cache` : 'Runs after your page loads';
}
async function request(type, extra = {}) {
  try {const reply = await chrome.runtime.sendMessage({type,...extra}); currentTab = reply.tabId; state = reply; render();}
  catch {state = {status:'error',entry:null}; render();}
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click',() => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => {b.classList.toggle('selected',b === button); b.setAttribute('aria-pressed',String(b === button));}); render();
}));
$('pause').addEventListener('change',() => request('setPaused',{paused:$('pause').checked}));
$('refresh').addEventListener('click',() => request('refresh'));
if (globalThis.chrome?.runtime?.id) {
  chrome.runtime.onMessage.addListener(message => {if (message?.type === 'state' && message.tabId === currentTab) {state = {...message.state,paused:message.state.status === 'paused'}; render();}});
  request('getState');
} else {state = {status:'error',entry:null}; render();}
