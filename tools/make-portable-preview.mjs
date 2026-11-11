import {readFile,writeFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const [html,css,popup,core,bridge,shell]=await Promise.all(['../extension/popup.html','../extension/popup.css','../extension/popup.js','../extension/core.js','bridge.js','preview.html'].map(read));
const states={};
for(const scenario of ['populated','empty','partial','loading','private','long','many']){
  const scenarioBridge=bridge.replace("new URLSearchParams(location.search).get('scenario')||'populated'",JSON.stringify(scenario));
  states[scenario]=html.replace('<link rel="stylesheet" href="popup.css">',`<style>${css}</style>`).replace('<script type="module" src="popup.js"></script>',`<script>${scenarioBridge}</script><script type="module">${core.replaceAll('export ','')}\n${popup.replace("import {manualSearch, SOURCES} from './core.js';",'')}</script>`);
}
const json=JSON.stringify(states).replaceAll('<','\\u003c');
const output=shell.replace('src="/popup.html?scenario=populated"','').replace(/<p><a href="\/benchmark.html">[\s\S]*?<\/p>/,'<p>Portable fixture preview. No server, extension installation, or automatic external requests.</p>').replace(/<script>[\s\S]*<\/script>/,`<script>const states=${json};const popup=document.getElementById('popup');popup.srcdoc=states.populated;document.getElementById('scenario').addEventListener('change',e=>popup.srcdoc=states[e.target.value]);</script>`);
await writeFile(new URL('../artifacts/preview.html',import.meta.url),output);
console.log('Saved self-contained popup fixture preview.');
