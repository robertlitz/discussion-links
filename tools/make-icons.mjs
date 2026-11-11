import {mkdir,writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
function crc32(b){let c=0xffffffff;for(const n of b){c^=n;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),b=Buffer.concat([t,data]),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length);b.copy(out,4);out.writeUInt32BE(crc32(b),8+data.length);return out;}
await mkdir(new URL('../extension/icons/',import.meta.url),{recursive:true});
for(const size of [16,32,48,128]){
  const rows=Buffer.alloc(size*(1+size*4));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const nx=x/size,ny=y/size,i=y*(1+size*4)+1+x*4;
    const bubble=nx>.18&&nx<.82&&ny>.22&&ny<.68;
    const tail=ny>=.68&&ny<.83&&nx>.23&&nx<.23+(.83-ny);
    const inside=nx>.28&&nx<.72&&ny>.32&&ny<.57;
    const white=(bubble||tail)&&!inside;
    rows.set(white?[245,250,244,255]:[36,102,90,255],i);
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  await writeFile(new URL(`../extension/icons/${size}.png`,import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
}
console.log('Created four small local PNG icons.');
