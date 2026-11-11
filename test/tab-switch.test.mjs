import {test} from 'node:test';
import assert from 'node:assert/strict';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function event(){const listeners=[];return{addListener:fn=>listeners.push(fn),fire:(...args)=>listeners.forEach(fn=>fn(...args))};}
test('switching active tabs cancels real worker requests and services the new page',async()=>{
 const savedChrome=globalThis.chrome,savedFetch=globalThis.fetch;
 const pages=new Map([[1,{id:1,windowId:7,active:true,status:'complete',url:'https://example.com/slow'}],[2,{id:2,windowId:7,active:false,status:'complete',url:'https://example.com/fast'}]]);
 const events={onUpdated:event(),onActivated:event(),onRemoved:event()};let requests=0,aborts=0;
 const tabs={...events,get:async id=>({...pages.get(id)}),query:async()=>[...pages.values()].filter(p=>p.active)};
 const store={get:async()=>({}),set:async()=>{}};const badges=[];
 globalThis.chrome={tabs,storage:{local:store,session:store},runtime:{id:'tab-switch-test',onMessage:event(),sendMessage:async()=>{}},action:{setBadgeText:async x=>badges.push(x),setBadgeBackgroundColor:async()=>{},setTitle:async()=>{}}};
 globalThis.fetch=async(raw,{signal})=>{
  requests++;const u=new URL(raw);const q=u.searchParams.get('q')||u.searchParams.get('query');
  if(q.includes('/slow'))return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborts++;reject(new Error('aborted'));},{once:true}));
  return new Response(JSON.stringify(raw.includes('algolia')?{hits:[],nbPages:1}:{data:{children:[],after:null}}));
 };
 try{
  await import('../extension/background.js?tab-switch-uat');
  events.onActivated.fire({tabId:1,windowId:7});await delay(425);assert.equal(requests,2);
  pages.get(1).active=false;pages.get(2).active=true;
  events.onActivated.fire({tabId:2,windowId:7});await delay(25);assert.equal(aborts,2,'abandoned fetches must be cancelled before the next debounce');
  await delay(1200);assert.equal(requests,4,'new page must not wait for the old source deadline or error backoff');
  assert.equal(badges.at(-1).tabId,2);assert.equal(badges.at(-1).text,'');
 } finally {events.onRemoved.fire(1);events.onRemoved.fire(2);globalThis.chrome=savedChrome;globalThis.fetch=savedFetch;}
});
