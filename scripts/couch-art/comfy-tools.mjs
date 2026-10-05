#!/usr/bin/env node
// Couch art helpers on the owner's ComfyUI (Desktop on :8000; COMFY_URL overrides).
//   node scripts/couch-art/comfy-tools.mjs mask    <in.png> <out.png> "<what>" [--separate] [--threshold 0.5]
//        SAM 3 by name (ComfyUI-RMBG SAM3Segment): a white-on-black mask. With
//        --separate, one mask per instance: <out>-1.png, <out>-2.png, …
//   node scripts/couch-art/comfy-tools.mjs erase   <in.png> <mask.png> <out.png>   LaMa fill where the mask is white
//   node scripts/couch-art/comfy-tools.mjs upscale <in.png> <out.png>              4x-AnimeSharp
import fs from 'node:fs/promises';
import path from 'node:path';

const HOST = process.env.COMFY_URL || 'http://127.0.0.1:8000';
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? fallback : rest[i + 1];
};

async function upload(file) {
  const form = new FormData();
  form.append('image', new Blob([await fs.readFile(file)]), path.basename(file));
  form.append('overwrite', 'true');
  const res = await fetch(`${HOST}/upload/image`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return (await res.json()).name;
}

async function run(prompt) {
  const res = await fetch(`${HOST}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
  const q = await res.json();
  if (!res.ok) {
    console.error(JSON.stringify(q, null, 2));
    process.exit(1);
  }
  for (let i = 0; i < 900; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    const h = (await (await fetch(`${HOST}/history/${q.prompt_id}`)).json())[q.prompt_id];
    if (h) return h.outputs;
  }
  throw new Error('timed out waiting for ComfyUI');
}

async function save(outputs, nodeId, nameFor) {
  const images = (outputs[nodeId] && outputs[nodeId].images) || [];
  for (let i = 0; i < images.length; i += 1) {
    const img = images[i];
    const params = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
    const buf = Buffer.from(await (await fetch(`${HOST}/view?${params}`)).arrayBuffer());
    const out = nameFor(i, images.length);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, buf);
    console.log(out);
  }
  if (!images.length) throw new Error('ComfyUI returned no image (nothing matched?)');
}

const save1 = (out) => (i, n) => (n === 1 ? out : out.replace(/\.png$/, `-${i + 1}.png`));

if (cmd === 'mask') {
  const [input, out, what] = rest;
  const outputs = await run({
    1: { class_type: 'LoadImage', inputs: { image: await upload(input) } },
    2: {
      class_type: 'SAM3Segment',
      inputs: {
        image: ['1', 0],
        model_name: 'sam3.1_multiplex_fp16',
        prompt: what,
        output_mode: flag('separate') ? 'Separate' : 'Merged',
        confidence_threshold: Number(opt('threshold', '0.5')),
      },
    },
    3: { class_type: 'SaveImage', inputs: { images: ['2', 2], filename_prefix: 'couch-mask' } },
  });
  await save(outputs, '3', save1(out));
} else if (cmd === 'erase') {
  const [input, mask, out] = rest;
  const outputs = await run({
    1: { class_type: 'LoadImage', inputs: { image: await upload(input) } },
    2: { class_type: 'LoadImageMask', inputs: { image: await upload(mask), channel: 'red' } },
    3: { class_type: 'AILab_LamaRemover', inputs: { images: ['1', 0], masks: ['2', 0], removal_strength: 230, edge_smoothness: 8 } },
    4: { class_type: 'SaveImage', inputs: { images: ['3', 0], filename_prefix: 'couch-erase' } },
  });
  await save(outputs, '4', () => out);
} else if (cmd === 'upscale') {
  const [input, out] = rest;
  const outputs = await run({
    1: { class_type: 'LoadImage', inputs: { image: await upload(input) } },
    2: { class_type: 'UpscaleModelLoader', inputs: { model_name: '4x-AnimeSharp.safetensors' } },
    3: { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['2', 0], image: ['1', 0] } },
    4: { class_type: 'SaveImage', inputs: { images: ['3', 0], filename_prefix: 'couch-up' } },
  });
  await save(outputs, '4', () => out);
} else {
  console.error('usage: comfy-tools.mjs mask|erase|upscale …');
  process.exit(1);
}
