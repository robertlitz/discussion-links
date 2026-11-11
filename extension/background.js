import {publicUrl, urlKey} from './core.js';
import {LookupEngine} from './lookup.js';

const engine = new LookupEngine({load:() => chrome.storage.session.get(['cache','cooldown']), save:data => chrome.storage.session.set(data)});
const tabs = new Map();
const timers = new Map();
const selected = new Map();
let paused = false;
const settingsReady = chrome.storage.local.get('paused').then(s => {paused = !!s.paused;});

async function display(tabId, entry, status = 'ready') {
  const count = entry?.posts?.length || 0;
  const partial = entry && Object.values(entry.sources).some(s => s.state !== 'ok' || s.truncated);
  const text = count ? (count > 999 ? '999+' : String(count)) : status === 'loading' ? '…' : partial ? '!' : '';
  const title = count ? `${count} discussion${count === 1 ? '' : 's'} found${partial ? ' · some results unavailable' : ''}` : status === 'loading' ? 'Looking for discussions…' : status === 'paused' ? 'Discussion Links paused' : status === 'unsupported' ? 'This page is not checked' : partial ? 'Some sources unavailable · open for details' : 'No linked discussions found';
  await Promise.all([chrome.action.setBadgeText({tabId,text}), chrome.action.setBadgeBackgroundColor({tabId,color:partial && !count ? '#9b620a' : '#24665a'}), chrome.action.setTitle({tabId,title})]).catch(() => {});
}
function notify(tabId, state) {chrome.runtime.sendMessage({type:'state',tabId,state}).catch(() => {});}
async function check(tabId) {
  await settingsReady;
  let tab;
  try {tab = await chrome.tabs.get(tabId);} catch {return;}
  if (!tab.active || tab.status !== 'complete') return;
  markActive(tabId,tab.windowId);
  const url = publicUrl(tab.url);
  const previous = tabs.get(tabId);
  if (previous?.current && previous.status === 'loading' && urlKey(previous.url) === urlKey(url)) return;
  const state = {url,current:true,status:paused ? 'paused' : url ? 'loading' : 'unsupported',entry:null};
  tabs.set(tabId,state);
  if (tabs.size > 200) tabs.delete(tabs.keys().next().value);
  engine.cancelInvalid();
  const valid = () => tabs.get(tabId) === state && state.current && !paused;
  if (paused || !url) {await display(tabId,null,state.status); if (tabs.get(tabId) === state) notify(tabId,state); return;}
  const cached = await engine.peek(url);
  if (!valid()) return;
  state.entry = cached;
  await display(tabId,cached,'loading'); if (!valid()) return; notify(tabId,state);
  const entry = await engine.lookup(url, {valid, onProgress:entry => {
    if (!valid()) return;
    state.entry = entry;
    display(tabId,entry,entry.loading ? 'loading' : 'ready'); notify(tabId,state);
  }});
  if (!valid()) return;
  state.status = 'ready'; state.entry = entry;
  await display(tabId,entry); if (valid()) notify(tabId,state);
}
function schedule(tabId) {
  clearTimeout(timers.get(tabId));
  timers.set(tabId,setTimeout(() => {timers.delete(tabId); check(tabId).catch(() => {});},350));
}
function markActive(tabId,windowId) {
  const previousId = selected.get(windowId);
  if (previousId !== undefined && previousId !== tabId) {
    const previous = tabs.get(previousId);
    if (previous) previous.current = false;
    clearTimeout(timers.get(previousId));timers.delete(previousId);
  }
  selected.set(windowId,tabId);
  engine.cancelInvalid();
}
chrome.tabs.onUpdated.addListener((id,change,tab) => {
  if (change.url && !change.status && tabs.has(id) && urlKey(change.url) === urlKey(tabs.get(id).url)) return;
  if (change.status === 'loading' || change.url) {
    const state = tabs.get(id);
    if (change.status === 'loading' || urlKey(change.url) !== urlKey(state?.url)) {
      tabs.delete(id); clearTimeout(timers.get(id)); timers.delete(id);
      engine.cancelInvalid();
      display(id,null,'loading');
      notify(id,{url:publicUrl(change.url || tab.url),status:'loading',entry:null});
    }
  }
  if (tab.active && tab.status === 'complete' && (change.status === 'complete' || change.url)) schedule(id);
});
chrome.tabs.onActivated.addListener(({tabId,windowId}) => {markActive(tabId,windowId);schedule(tabId);});
chrome.tabs.onRemoved.addListener(id => {
  tabs.delete(id);clearTimeout(timers.get(id));timers.delete(id);engine.cancelInvalid();
  for (const [windowId,tabId] of selected) if (tabId === id) selected.delete(windowId);
});
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (!['getState','setPaused','refresh'].includes(message?.type)) return;
  (async () => {
    await settingsReady;
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab) return {status:'unsupported',entry:null};
    if (message.type === 'setPaused') {
      paused = !!message.paused;
      // Invalidate every subscriber so in-flight results cannot restore a paused badge.
      const ids = [...tabs.keys()]; tabs.clear();
      engine.cancelInvalid();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      for (const id of ids) {clearTimeout(timers.get(id)); timers.delete(id); await display(id,null,paused ? 'paused' : 'ready');}
      await chrome.storage.local.set({paused}).catch(() => {});
    }
    const state = tabs.get(tab.id);
    if (!state || message.type !== 'getState' || urlKey(tab.url) !== urlKey(state.url)) schedule(tab.id);
    return {tabId:tab.id,paused,url:publicUrl(tab.url),status:paused ? 'paused' : publicUrl(tab.url) ? state?.status || (tab.status === 'complete' ? 'loading' : 'waiting') : 'unsupported',entry:state?.entry || null};
  })().then(reply).catch(() => reply({status:'error',entry:null}));
  return true;
});
