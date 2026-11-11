import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../extension/',import.meta.url));
const toolsRoot=fileURLToPath(new URL('./',import.meta.url));
const server=http.createServer(async (req,res) => {
  try {
    const u=new URL(req.url,'http://127.0.0.1');
    if (req.method==='POST' && u.pathname==='/results') {
      let data=''; for await (const b of req) {data+=b; if (data.length>100_000) {res.writeHead(413).end();return;}}
      const parsed=JSON.parse(data); await writeFile(new URL('../artifacts/browser-benchmark.json',import.meta.url),JSON.stringify(parsed,null,2)); res.end('saved'); return;
    }
    let name=u.pathname==='/'?'preview.html':u.pathname.slice(1);
    const allowed=['preview.html','bridge.js','live-result.json','benchmark.html','benchmark-frame.html','benchmark.js'];
    let base=allowed.includes(name)?toolsRoot:root;
    const file=path.resolve(base,name);
    if (!file.startsWith(path.resolve(base)+path.sep)) throw new Error('Invalid path');
    if (name.includes('..') || !/^[a-z0-9/._-]+$/i.test(name)) throw new Error('Invalid path');
    let content=await readFile(file);
    if (name==='popup.html') content=Buffer.from(content.toString().replace('<script type="module"','<script src="/bridge.js"></script><script type="module"'));
    const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'}[path.extname(name)] || 'text/plain';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(content);
  } catch {res.writeHead(404).end('Not found');}
});
server.requestTimeout=10_000; server.headersTimeout=10_000;
server.listen(0,'127.0.0.1',async () => {
  const info={pid:process.pid,url:`http://127.0.0.1:${server.address().port}`,purpose:'Finite Discussion Links popup UAT and browser benchmark',expires:new Date(Date.now()+1200_000).toISOString()};
  await writeFile(new URL('../artifacts/preview-process.json',import.meta.url),JSON.stringify(info,null,2)); console.log(JSON.stringify(info));
});
const timer=setTimeout(() => server.closeAllConnections() || server.close(),1200_000);
function stop(){clearTimeout(timer);server.closeAllConnections();server.close();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
