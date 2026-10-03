#!/usr/bin/env node
// Renders one GSN art candidate through a running ComfyUI (Desktop listens on
// :8000; override with COMFY_URL). The workflow is ComfyUI API format; nodes
// are found by class_type, so a template exported from the UI (Workflow →
// Export (API)) works too.
//
// usage: node scripts/gsn-art/render.mjs <workflow.json> <out.png> --prompt "..." [--seed N] [--width W --height H] [--image in.png]
import fs from 'node:fs/promises';
import path from 'node:path';

const HOST = process.env.COMFY_URL || 'http://127.0.0.1:8000';
const args = process.argv.slice(2);
const [wfPath, outPath] = args;
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const prompt = opt('prompt');
const seed = Number(opt('seed') ?? Math.floor(Math.random() * 2 ** 31));
const width = opt('width') ? Number(opt('width')) : null;
const height = opt('height') ? Number(opt('height')) : null;
const image = opt('image');
if (!wfPath || !outPath || !prompt) {
  console.error('usage: render.mjs <workflow.json> <out.png> --prompt "..." [--seed N] [--width W --height H] [--image in.png]');
  process.exit(1);
}

const wf = JSON.parse(await fs.readFile(wfPath, 'utf8'));
const nodes = Object.entries(wf);
const find = (pred) => nodes.find(([, n]) => pred(n));

const [, sampler] = find((n) => n.class_type === 'KSampler' || n.class_type === 'KSamplerAdvanced') || [];
if (!sampler) throw new Error('no KSampler in workflow');
const positive = wf[sampler.inputs.positive[0]];
if ('text' in positive.inputs) positive.inputs.text = prompt;
else if ('prompt' in positive.inputs) positive.inputs.prompt = prompt;
else throw new Error(`positive node ${positive.class_type} has no text/prompt input`);
if ('seed' in sampler.inputs) sampler.inputs.seed = seed;
else sampler.inputs.noise_seed = seed;

if (width && height) {
  const latent = find((n) => /^Empty.*LatentImage$/.test(n.class_type));
  if (!latent) throw new Error('no empty latent node to size');
  latent[1].inputs.width = width;
  latent[1].inputs.height = height;
}

if (image) {
  const loader = find((n) => n.class_type === 'LoadImage');
  if (!loader) throw new Error('no LoadImage node for --image');
  const form = new FormData();
  form.append('image', new Blob([await fs.readFile(image)]), path.basename(image));
  form.append('overwrite', 'true');
  const up = await fetch(`${HOST}/upload/image`, { method: 'POST', body: form });
  if (!up.ok) throw new Error(`upload failed: ${up.status}`);
  loader[1].inputs.image = (await up.json()).name;
}

const queued = await fetch(`${HOST}/prompt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: wf }),
});
const q = await queued.json();
if (!queued.ok) {
  console.error(JSON.stringify(q, null, 2));
  process.exit(1);
}

let outputs = null;
for (let i = 0; i < 600 && !outputs; i += 1) {
  await new Promise((r) => setTimeout(r, 1000));
  const history = await (await fetch(`${HOST}/history/${q.prompt_id}`)).json();
  if (history[q.prompt_id]) outputs = history[q.prompt_id].outputs;
}
if (!outputs) throw new Error('timed out waiting for ComfyUI');
const img = Object.values(outputs).flatMap((o) => o.images || [])[0];
const params = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
const buf = Buffer.from(await (await fetch(`${HOST}/view?${params}`)).arrayBuffer());
await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, buf);
console.log(`${outPath} (seed ${seed})`);
