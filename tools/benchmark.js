const run=document.getElementById('run'),status=document.getElementById('status'),output=document.getElementById('output');
run.addEventListener('click',async()=>{
 run.disabled=true;const samples=[];
 for(let i=0;i<60;i++){
  const mode=(i%4===0||i%4===3)?'baseline':'lookup';
  const result=await new Promise((resolve,reject)=>{const frame=document.createElement('iframe');const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(new Error('Sample timed out'));},5000);
   const listener=e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data.type!=='sample')return;clearTimeout(timer);window.removeEventListener('message',listener);resolve(e.data);};
   window.addEventListener('message',listener);frame.src='/benchmark-frame.html?mode='+mode+'&n='+i;document.getElementById('frame').replaceChildren(frame);
  }).catch(e=>({error:e.message,mode}));
  samples.push(result);status.textContent=`Measured ${i+1} / 60 navigations`;
 }
 const percentile=(a,p)=>a.sort((a,b)=>a-b)[Math.floor((a.length-1)*p)];
 const summary=Object.fromEntries(['baseline','lookup'].map(mode=>{const s=samples.filter(x=>x.mode===mode&&!x.error);return[mode,{samples:s.length,medianLoadMs:percentile(s.map(x=>x.loadMs),.5),p95LoadMs:percentile(s.map(x=>x.loadMs),.95),medianDOMMs:percentile(s.map(x=>x.domMs),.5),medianLookupMs:percentile(s.map(x=>x.lookupMs),.5),p95LookupMs:percentile(s.map(x=>x.lookupMs),.95)}];}));
 const report={at:new Date().toISOString(),kind:'browser page harness, extension not installed',summary,samples,allLookupsAfterLoad:samples.filter(s=>s.mode==='lookup').every(s=>s.lookupStarted>s.loadMs)};
 output.textContent=JSON.stringify(report,null,2);status.textContent='Completed 30 pairs · results saved';await fetch('/results',{method:'POST',body:JSON.stringify(report)});run.disabled=false;
});
