import {readFile,readdir,access,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
async function files(relative){const result=[];for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){const next=path.join(relative,entry.name);if(entry.isDirectory())result.push(...await files(next));else if(entry.isFile())result.push(next);else throw new Error(`Unsupported filesystem entry: ${next}`);}return result;}
const manifest=JSON.parse(await readFile(path.join(root,'extension/manifest.json'),'utf8'));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
assert.equal(manifest.manifest_version,3);assert.equal(manifest.version,pkg.version);
for(const relative of [manifest.background.service_worker,manifest.action.default_popup,...Object.values(manifest.icons),...Object.values(manifest.action.default_icon)]){
 const target=path.resolve(root,'extension',relative);assert.ok(target.startsWith(path.resolve(root,'extension')+path.sep));await access(target);
}
const source=[...await files('extension'),...await files('test'),...await files('tools'),...await files('scripts')];
for(const file of source.filter(name=>/\.m?js$/.test(name)))execFileSync(process.execPath,['--check',path.join(root,file)],{timeout:10_000,windowsHide:true,stdio:'pipe'});
const documents=['README.md','CONTRIBUTING.md',...(await files('docs')).filter(name=>name.endsWith('.md'))];
let links=0;
for(const file of documents){const text=await readFile(path.join(root,file),'utf8');for(const match of text.matchAll(/(?:\]\(|src=")([^\s)"<>]+)/g)){
 const href=match[1];if(/^[a-z]+:|^#|^\/\//i.test(href))continue;
 const relative=decodeURIComponent(href.split('#')[0]);if(!relative)continue;
 await access(path.resolve(root,path.dirname(file),relative));links++;
}}
console.log(`Checked manifest assets, ${source.filter(name=>/\.m?js$/.test(name)).length} JavaScript files and ${links} local documentation links.`);
