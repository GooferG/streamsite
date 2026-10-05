#!/usr/bin/env node
// Builds the couch TV's video reel (spec: The reel script) from clips the owner
// downloaded from the Twitch creator dashboard into scripts/tv-reel/source/
// (gitignored). reel.json lists them in playing order:
//   [{ "file": "chat-called-it.mp4", "title": "chat called it", "start": 2 }]
// Each becomes an 8 s, 360p, silent H.264 .mp4 loop plus a poster, in
// public/tv/reel/ with manifest.json. H.264 only: phones decode it in
// hardware, and AV1 came out bigger for most clips. Needs ffmpeg on PATH.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SOURCE = path.join(HERE, 'source');
const OUT = path.join(ROOT, 'public', 'tv', 'reel');
const SECONDS = 8;
const LOOP_KB = 600;
const REEL_KB = 4096;
const POSTER_KB = 30;

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const kb = (f) => fs.statSync(f).size / 1024;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('ffmpeg is not on PATH');
  process.exit(1);
}

const list = JSON.parse(fs.readFileSync(path.join(HERE, 'reel.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
const over = [];
let total = 0;

for (const item of list) {
  const src = path.join(SOURCE, item.file);
  if (!fs.existsSync(src)) {
    console.error(`missing ${src}`);
    process.exit(1);
  }
  const id = slug(item.id || path.parse(item.file).name);
  const ss = String(item.start || 0);
  const vf = 'scale=-2:360,fps=24';
  const mp4 = path.join(OUT, `${id}.mp4`);
  const poster = path.join(OUT, `${id}.jpg`);
  // Busy clips (confetti, coin showers) can blow the budget: step the quality
  // down until each file fits, a few times at most.
  for (let crf = 28; crf <= 37; crf += 3) {
    ff(['-ss', ss, '-t', String(SECONDS), '-i', src, '-vf', vf, '-an', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', String(crf), '-preset', 'slow', '-movflags', '+faststart', mp4]);
    if (kb(mp4) <= LOOP_KB) break;
  }
  for (let q = 6; q <= 18; q += 3) {
    ff(['-ss', String(Number(ss) + 1), '-i', src, '-frames:v', '1', '-vf', 'scale=-2:360', '-q:v', String(q), poster]);
    if (kb(poster) <= POSTER_KB) break;
  }
  for (const [file, cap] of [[mp4, LOOP_KB], [poster, POSTER_KB]]) {
    if (kb(file) > cap) over.push(`${path.basename(file)} ${kb(file).toFixed(0)} KB > ${cap} KB`);
  }
  total += kb(mp4) + kb(poster);
  manifest.push({
    id,
    title: item.title || '',
    sources: { h264: `/tv/reel/${id}.mp4` },
    poster: `/tv/reel/${id}.jpg`,
    seconds: SECONDS,
  });
}

if (total > REEL_KB) over.push(`reel ${total.toFixed(0)} KB > ${REEL_KB} KB`);
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
if (over.length) {
  console.error(`Over budget:\n  ${over.join('\n  ')}`);
  process.exit(1);
}
console.log(`${manifest.length} loops, ${total.toFixed(0)} KB (H.264 + posters)`);
