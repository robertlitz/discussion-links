import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LookupEngine} from '../extension/lookup.js';
const url = 'https://example.com/article';
export function fixtureResponse(raw) {
  return new Response(JSON.stringify(raw.includes('algolia') ? {hits:[{objectID:'123',title:'An article',url,num_comments:10}],nbPages:1,page:0} : {data:{children:[{data:{id:'abc',title:'Reddit article',url,num_comments:5}}],after:null}}),{headers:{'content-type':'application/json'}});
}
test('one lookup per URL across simultaneous tabs; warm cache makes zero requests', async () => {
  let calls = 0; const e = new LookupEngine({fetcher:async u => {calls++; return fixtureResponse(u);}});
  const results = await Promise.all(Array.from({length:20},() => e.lookup(url)));
  assert.equal(calls,2); assert.equal(results[0].posts.length,2);
  assert.ok(results.every(r => r === results[0])); await e.lookup(url); assert.equal(calls,2);
});
test('partial results arrive before a slow source and survive failures', async () => {
  let release; const pending = new Promise(r => {release = r;}); const updates=[];
  const e = new LookupEngine({fetcher:async u => {if (u.includes('reddit')) {await pending; return new Response('',{status:403});} return fixtureResponse(u);}});
  const job = e.lookup(url,{onProgress:x => updates.push(x)});
  await new Promise(r => setTimeout(r,10)); assert.equal(updates.length,1); assert.equal(updates[0].posts[0].source,'hn'); assert.equal(updates[0].loading,true);
  release(); const result=await job; assert.equal(result.posts.length,1); assert.equal(result.sources.reddit.state,'blocked');
});
test('rate limits persist across worker restart and Retry-After is honored', async () => {
  let data; let now=100_000; let redditCalls=0;
  const fetcher = async u => {if (u.includes('reddit')) {redditCalls++; return new Response('',{status:429,headers:{'retry-after':'180'}});} return fixtureResponse(u);};
  const e = new LookupEngine({fetcher,now:() => now,save:async x => {data=structuredClone(x);}});
  const first = await e.lookup(url); assert.equal(first.sources.reddit.retryAt,280_000);
  now += 61_000;
  const restarted = new LookupEngine({fetcher,now:() => now,load:async () => data});
  const second = await restarted.lookup('https://example.com/another'); assert.equal(redditCalls,1); assert.equal(second.sources.reddit.state,'cooldown');
});
test('deadlines stop hanging requests and failures are never successful zero matches', async () => {
  const e = new LookupEngine({timeout:15,fetcher:async (_u,{signal}) => new Promise((resolve,reject) => signal.addEventListener('abort',() => reject(new Error('aborted'))))});
  const r = await e.lookup(url); assert.equal(r.sources.hn.state,'timeout'); assert.equal(r.sources.reddit.state,'timeout');
});
test('navigation cancellation prevents queued requests and stale notifications', async () => {
  let calls=0; const e=new LookupEngine({fetcher:async u => {calls++; return fixtureResponse(u);}});
  assert.equal(await e.lookup(url,{valid:() => false}),null); assert.equal(calls,0);
});
test('pagination and response sizes have hard ceilings', async () => {
  let calls=0;
  const e=new LookupEngine({fetcher:async u => {calls++; return new Response(JSON.stringify(u.includes('algolia') ? {hits:[],nbPages:100,page:Number(new URL(u).searchParams.get('page'))} : {data:{children:[],after:'next'}}));}});
  const r=await e.lookup(url); assert.equal(calls,4); assert.equal(r.sources.hn.truncated,true); assert.equal(r.sources.reddit.truncated,true);
  const huge=new LookupEngine({fetcher:async () => new Response('x'.repeat(512_001))}); const h=await huge.lookup(url); assert.equal(h.sources.hn.state,'error');
});
test('network options exclude credentials and referrers', async () => {
  const e=new LookupEngine({fetcher:async (u,o) => {assert.equal(o.credentials,'omit'); assert.equal(o.referrerPolicy,'no-referrer'); assert.equal(o.redirect,'error'); return fixtureResponse(u);}}); await e.lookup(url);
});
test('queue is bounded under tab switching', async () => {
  let release; const gate=new Promise(r => {release=r;});
  const e=new LookupEngine({fetcher:async u => {await gate; return fixtureResponse(u);}});
  let valid=true;
  const jobs=Array.from({length:10},(_,i) => e.lookup(`${url}/${i}`,{valid:()=>i===0||valid}));
  await new Promise(r => setTimeout(r,10)); assert.equal(e.pending.size,8); valid=false; release();
  const results=await Promise.all(jobs); assert.equal(results.filter(r => r?.busy).length,2);
});
test('brief pacing defers once instead of losing results; storage failures are nonfatal', async () => {
  let calls=0;const e=new LookupEngine({load:async()=>{throw new Error('storage unavailable');},save:async()=>{throw new Error('quota');},fetcher:async u=>{calls++;return fixtureResponse(u);}});
  await e.ready;e.cooldown.hn=Date.now()+25;
  const r=await e.lookup(url);assert.equal(calls,2);assert.equal(r.posts.length,2);assert.equal(r.sources.hn.state,'ok');
});
test('abandoned in-flight requests abort promptly without failure backoff, and the same URL can resume', async () => {
  let active=true,now=100_000,hanging=true,aborted=0,started=0,ready;
  const bothStarted=new Promise(resolve=>{ready=resolve;});
  const e=new LookupEngine({now:()=>now,fetcher:async (u,{signal})=>{
    if (!hanging) return fixtureResponse(u);
    if (++started===2) ready();
    return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted++;reject(new Error('cancelled'));},{once:true}));
  }});
  const first=e.lookup(url,{valid:()=>active});await bothStarted;
  active=false;e.cancelInvalid();hanging=false;now+=1101;
  // Reopening while the aborted promise is settling must start a replacement lookup.
  const reopened=e.lookup(url);
  assert.equal(await first,null);const result=await reopened;
  assert.equal(aborted,2);assert.equal(result.posts.length,2);assert.equal(result.sources.hn.state,'ok');
  assert.ok(e.cooldown.hn-now<=1100,'cancellation is not a network failure');
});
test('one tab leaving does not abort a lookup another active subscriber still needs', async () => {
  let firstActive=true,secondActive=true,release,started=0,ready,aborted=0;
  const gate=new Promise(resolve=>{release=resolve;});const bothStarted=new Promise(resolve=>{ready=resolve;});
  const e=new LookupEngine({fetcher:async(u,{signal})=>{signal.addEventListener('abort',()=>{aborted++;},{once:true});if(++started===2)ready();await gate;return fixtureResponse(u);}});
  const first=e.lookup(url,{valid:()=>firstActive});const second=e.lookup(url,{valid:()=>secondActive});await bothStarted;
  firstActive=false;e.cancelInvalid();assert.equal(aborted,0);release();
  const results=await Promise.all([first,second]);assert.equal(results[1].posts.length,2);assert.equal(started,2);
});
