import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { mkdtemp, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const sha=b=>createHash('sha256').update(b).digest('hex');
const temp=await mkdtemp(join(tmpdir(),'simfly-turbine-'));
const dest=resolve('public/media/jet-finale');
try {
  const response=await fetch('https://d2ol7oe51mr4n9.cloudfront.net/user_3JLfCZ2sSxSIbIdwwrCH6q94ve0/cdab234d-7e00-42aa-81bf-ed277b0f705e.zip',{signal:AbortSignal.timeout(60000)});
  if(!response.ok) throw Error('Turbine archive download failed: '+response.status);
  const zip=Buffer.from(await response.arrayBuffer());
  if(sha(zip)!=='c25a5c10805a65a4f4a446d71898600e082f3672442e22002be0cf9e8abb0444') throw Error('Archive checksum mismatch');
  let end=zip.length-22; while(end>=0&&zip.readUInt32LE(end)!==0x06054b50)end--;
  if(end<0||zip.readUInt16LE(end+10)!==1)throw Error('Unexpected ZIP entries');
  const c=zip.readUInt32LE(end+16);
  if(zip.readUInt32LE(c)!==0x02014b50||zip.readUInt16LE(c+10)!==8)throw Error('Invalid ZIP');
  const size=zip.readUInt32LE(c+20), off=zip.readUInt32LE(c+42);
  if(zip.readUInt32LE(off)!==0x04034b50)throw Error('Invalid ZIP entry');
  const start=off+30+zip.readUInt16LE(off+26)+zip.readUInt16LE(off+28);
  const gif=inflateRawSync(zip.subarray(start,start+size),{maxOutputLength:18000000});
  if(sha(gif)!=='66fa3b012ab004d0a025463164404f8a56a4c2e80dc8e9f998469c2668bc4507')throw Error('GIF checksum mismatch');
  const input=join(temp,'loop.gif');
  await writeFile(input,gif);
  let ffmpeg='ffmpeg';
  try {execFileSync(ffmpeg,['-version'],{stdio:'ignore'});} catch {
    const pack=execFileSync('npm',['pack','@ffmpeg-installer/linux-x64@4.1.0','--ignore-scripts','--silent','--pack-destination',temp],{encoding:'utf8'}).trim().split('\n').pop();
    execFileSync('tar',['-xzf',join(temp,pack),'-C',temp]);
    ffmpeg=join(temp,'package','ffmpeg');
  }
  await mkdir(dest,{recursive:true});
  const run=args=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',input,...args],{stdio:'inherit'});
  run(['-vf','fps=24,scale=960:960:flags=lanczos,format=yuva420p','-c:v','libvpx-vp9','-b:v','0','-crf','27','-deadline','good','-cpu-used','4','-threads','4','-an','-auto-alt-ref','0',join(dest,'turbofan-optimized.webm')]);
  run(['-frames:v','1','-c:v','libwebp','-quality','85',join(dest,'turbofan-optimized-poster.webp')]);
  const video=await stat(join(dest,'turbofan-optimized.webm'));
  if(video.size>2000000)throw Error('Turbine exceeds 2MB budget: '+video.size);
  console.log('SIMFLY optimized turbine loop: '+video.size+' bytes; verified source GIF.');
} finally { await rm(temp,{recursive:true,force:true}); }
