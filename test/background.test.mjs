import {test} from 'node:test';
import assert from 'node:assert/strict';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function event(){const listeners=[];return{addListener:f=>listeners.push(f),fire:(...args)=>listeners.forEach(f=>f(...args))};}
test('production worker: post-load scheduling, badges, cache, navigation, pause, private URLs and tabs',async()=>{
 const originalChrome=globalThis.chrome,originalFetch=globalThis.fetch;
 const tab={id:1,url:'https://example.com/article',active:true,status:'loading'};
 const records={requests:[],badges:[],titles:[],messages:[]};const session={};const local={};
 const tabs={onUpdated:event(),onActivated:event(),onRemoved:event(),get:async()=>({...tab}),query:async()=>[{...tab}]};
 const runtime={id:'test-extension',onMessage:event(),sendMessage:async x=>records.messages.push(structuredClone(x))};
 globalThis.chrome={tabs,runtime,storage:{session:{get:async()=>structuredClone(session),set:async x=>Object.assign(session,structuredClone(x))},local:{get:async()=>local,set:async x=>Object.assign(local,x)}},action:{setBadgeText:async x=>records.badges.push(x),setBadgeBackgroundColor:async()=>{},setTitle:async x=>records.titles.push(x)}};
 globalThis.fetch=async u=>{records.requests.push(u);return new Response(JSON.stringify(u.includes('algolia')?{hits:[{objectID:'123',title:'HN test',url:tab.url}],nbPages:1}:{data:{children:[{data:{id:'abc',title:'Reddit test',url:tab.url}}],after:null}}));};
 const message=(type,extra={})=>new Promise(resolve=>runtime.onMessage.fire({type,...extra},{id:'test-extension'},resolve));
 try {
  await import('../extension/background.js?worker-uat');
  tabs.onUpdated.fire(1,{status:'loading'},tab);await delay(380);assert.equal(records.requests.length,0,'loading must never start a request');
  tab.status='complete';tabs.onUpdated.fire(1,{status:'complete'},tab);await delay(100);assert.equal(records.requests.length,0,'post-load debounce');await delay(300);
  assert.equal(records.requests.length,2);assert.equal(records.badges.at(-1).text,'2');assert.match(records.titles.at(-1).title,/2 discussions/);
  let state=await message('getState');assert.equal(state.entry.posts.length,2);
  await message('refresh');await delay(400);assert.equal(records.requests.length,2,'refresh respects session cache');
  tab.url+='#section';tabs.onUpdated.fire(1,{url:tab.url},tab);await delay(380);assert.equal(records.requests.length,2,'hash-only navigation makes no requests');
  await message('setPaused',{paused:true});await delay(400);assert.equal(records.badges.at(-1).text,'');state=await message('getState');assert.equal(state.status,'paused');assert.equal(records.requests.length,2);
  await message('setPaused',{paused:false});await delay(400);assert.equal(records.badges.at(-1).text,'2');assert.equal(records.requests.length,2);
  tab.url='http://127.0.0.1/private';tabs.onUpdated.fire(1,{url:tab.url,status:'complete'},tab);await delay(400);state=await message('getState');assert.equal(state.status,'unsupported');assert.equal(records.badges.at(-1).text,'');assert.equal(records.requests.length,2);
  tab.url='https://example.com/new';tab.active=false;tabs.onUpdated.fire(1,{url:tab.url,status:'complete'},tab);await delay(380);assert.equal(records.requests.length,2,'inactive tabs stay quiet');
  tab.active=true;tabs.onActivated.fire({tabId:1});tab.status='loading';tabs.onUpdated.fire(1,{status:'loading'},tab);await delay(400);assert.equal(records.requests.length,2,'navigation cancels queued checks');
 } finally {tabs.onRemoved.fire(1);globalThis.chrome=originalChrome;globalThis.fetch=originalFetch;}
});
