import {writeFile,readFile,readdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {LookupEngine} from '../extension/lookup.js';
import {urlKey,parseResults} from '../extension/core.js';
const target='https://example.com/article';let calls=0;
const engine=new LookupEngine({fetcher:async u=>{calls++;return new Response(JSON.stringify(u.includes('algolia')?{hits:[],nbPages:1}:{data:{children:[],after:null}}));}});
await engine.lookup(target);
const times=[];
for(let i=0;i<2000;i++){const start=performance.now();await engine.lookup(target);times.push(performance.now()-start);}
times.sort((a,b)=>a-b);
const sample={hits:Array.from({length:100},(_,i)=>({objectID:String(i+1),url:target,title:'Article discussion',num_comments:i})),nbPages:1};
const parseTimes=[];for(let i=0;i<100;i++){const start=performance.now();parseResults('hn',sample,target);parseTimes.push(performance.now()-start);}parseTimes.sort((a,b)=>a-b);
let bytes=0;async function size(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=new URL(f.name+(f.isDirectory()?'/':''),dir);if(f.isDirectory())await size(p);else bytes+=(await readFile(p)).length;}}await size(new URL('../extension/',import.meta.url));
const report={at:new Date().toISOString(),runtime:process.version,kind:'Node microbenchmark, not installed browser load impact',warmCache:{iterations:times.length,medianMs:times[1000],p95Ms:times[1900],p99Ms:times[1980],additionalRequests:calls-2},parse100Candidates:{iterations:100,medianMs:parseTimes[50],p95Ms:parseTimes[95]},extensionBytes:bytes,architecture:{contentScripts:0,webRequestHooks:0,pollingIntervals:0,initialLookupDelayAfterTabCompleteMs:350,maxConcurrentUrls:1,maxConcurrentSources:2,maxPagesPerSource:2,sourceDeadlineMs:6000,maxResponseBytes:512000,cacheEntries:100,cacheSerializedBudgetBytes:1500000}};
await writeFile(new URL('../artifacts/microbenchmark.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
