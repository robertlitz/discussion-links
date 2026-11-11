import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(path.join(root,'extension/manifest.json'),'utf8'));
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}return(crc^0xffffffff)>>>0;}
async function walk(relative=''){const rows=[];for(const entry of (await readdir(path.join(root,'extension',relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=path.posix.join(relative,entry.name);if(entry.name.startsWith('.'))throw new Error('Unexpected hidden extension file');if(entry.isDirectory())rows.push(...await walk(name));else if(entry.isFile())rows.push(name);else throw new Error('Symlinks are not packaged');}return rows;}
const files=await walk();const local=[],central=[];let offset=0,total=0;
// Fixed archive timestamp makes a package reproducible for the same source bytes.
const date=((2026-1980)<<9)|(11<<5)|11;
for(const name of files){
 const filename=Buffer.from(name),data=await readFile(path.join(root,'extension',name));total+=data.length;if(total>2_000_000)throw new Error('Unexpected extension package size');
 const crc=crc32(data),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(date,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);local.push(header,filename,data);
 const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(date,14);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(data.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);central.push(directory,filename);offset+=header.length+filename.length+data.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const output=path.join(root,'dist',`discussion-links-${manifest.version}.zip`);await mkdir(path.dirname(output),{recursive:true});await writeFile(output,Buffer.concat([...local,directory,end]));
console.log(`Packaged ${files.length} extension files (${total.toLocaleString()} source bytes): ${path.relative(root,output)}`);
