import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicUrl,urlKey,parseResults,searchUrl,trimCache} from '../extension/core.js';
test('normalizes common link variants while preserving article identity', () => {
  assert.equal(urlKey('https://www.example.com/article/?utm_source=x#section'),urlKey('http://example.com/article'));
  assert.notEqual(urlKey('https://example.com/article?id=1'),urlKey('https://example.com/article?id=2'));
  assert.equal(urlKey('https://example.com/a?z=2&a=1'),urlKey('https://example.com/a?a=1&z=2'));
  assert.notEqual(urlKey('https://example.com/Article'),urlKey('https://example.com/article'));
});
test('private, unsupported and recognized sensitive URLs never become queries', () => {
  for (const u of ['chrome://extensions','file:///c:/x','http://localhost:3000','http://192.168.1.1/x','http://127.1/x','http://[::1]/','https://printer.local/a','https://intranet/a','https://x.internal/a','https://u:p@example.com','https://example.com/?access_token=x','https://example.com/?X-Amz-Signature=x']) assert.equal(publicUrl(u),null,u);
  assert.equal(publicUrl('https://example.com/a?utm_source=x#hi'),'https://example.com/a');
});
test('only exact linked submissions count; unsafe IDs and duplicates are discarded', () => {
  const hit = {objectID:'123',url:'http://www.example.com/a/',title:'<script>alert(1)</script>',num_comments:4};
  const result = parseResults('hn',{hits:[hit,hit,{...hit,objectID:'456',url:'https://example.com/ab'},{...hit,objectID:'1&evil=x'}],nbPages:1},'https://example.com/a');
  assert.equal(result.posts.length,1); assert.equal(result.posts[0].href,'https://news.ycombinator.com/item?id=123');
  assert.equal(result.posts[0].title,hit.title); assert.equal(result.next,null);
  const reddit = parseResults('reddit',{data:{children:[{data:{id:'abc',url:'https://example.com/a',subreddit:'test'}},{data:{url:'https://example.com/a'}}],after:'t3_x'}},'https://example.com/a');
  assert.equal(reddit.posts.length,1); assert.equal(reddit.next,'t3_x');
  assert.throws(() => parseResults('hn',{error:'no'},'https://example.com/a'));
});
test('query builders restrict search to submissions and URL fields', () => {
  const hn = new URL(searchUrl('hn','https://example.com/a')); assert.equal(hn.searchParams.get('restrictSearchableAttributes'),'url'); assert.equal(hn.searchParams.get('tags'),'story');
  const reddit = new URL(searchUrl('reddit','https://example.com/a')); assert.equal(reddit.searchParams.get('q'),'url:"example.com/a"');
});
test('cache bounded by both entry count and serialized bytes', () => {
  const cache = Object.fromEntries(Array.from({length:150},(_,i) => [String(i),{checked:i,posts:['x'.repeat(20_000)]}]));
  const trimmed = trimCache(cache); assert.ok(Object.keys(trimmed).length <= 100); assert.ok(Buffer.byteLength(JSON.stringify(trimmed)) < 1_510_000); assert.ok(trimmed['149']); assert.ok(!trimmed['0']);
});
test('manifest cannot inject code, intercept traffic or run a persistent background page', async () => {
  const m = JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url)));
  assert.equal(m.manifest_version,3); assert.equal(m.background.type,'module'); assert.ok(!m.content_scripts);
  assert.deepEqual(m.permissions,['tabs','storage']); assert.equal(m.host_permissions.length,2);
  assert.ok(!m.permissions.some(p => ['scripting','webRequest','debugger','offscreen','alarms'].includes(p)));
});
