#!/usr/bin/env node
/*
 * gen-slots.js — regenerate src/data/slots.js from the Rainbet export.
 *
 * Source : scripts/data/rainbet_slots_clean.json  ({ rainbetSlug, name, thumb })
 * Output : src/data/slots.js  (array of { id, name, provider, image, volatility,
 *          rtp, bonusBuy, megaways, progressive })
 *
 * Rules:
 *  - Provider is derived from the rainbetSlug prefix (longest match against
 *    PROVIDER_PREFIXES); unmatched prefixes fall back to a title-cased token.
 *  - Slots with no image or no derivable provider are dropped.
 *  - volatility / rtp / bonusBuy / megaways / progressive are carried over from
 *    the EXISTING src/data/slots.js by case-insensitive name match; otherwise
 *    defaults (volatility 'high', rtp null, flags false).
 *  - Duplicate names are de-duped (first occurrence wins), ids reassigned 1..n,
 *    sorted by name to match the previous file's ordering.
 *
 * Run: node scripts/gen-slots.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(__dirname, 'data', 'rainbet_slots_clean.json');
const OUT_PATH = path.join(ROOT, 'src', 'data', 'slots.js');

// ── Provider slug-prefix → display name. Longest prefix wins. ────────────────
// Keys are hyphen-joined leading tokens of rainbetSlug. Order doesn't matter;
// matching tries the most tokens first.
const PROVIDER_PREFIXES = {
  'pragmatic-play': 'Pragmatic Play',
  'playn-go': "Play'n GO",
  'red-tiger': 'Red Tiger',
  'voltent-wazdan': 'Wazdan',
  'mascot-gaming': 'Mascot Gaming',
  'penguin-king': 'Penguin King',
  'elk-studios': 'ELK Studios',
  'amigo-gaming': 'Amigo Gaming',
  'big-time-gaming': 'Big Time Gaming',
  '3-oaks': '3 Oaks',
  'peter-sons': 'Peter & Sons',
  'retro-gaming': 'Retro Gaming',
  'backseat-gaming': 'Backseat Gaming',
  'bullshark-games': 'Bullshark Games',
  'print-studios': 'Print Studios',
  spinomenal: 'Spinomenal',
  voltent: 'VoltEnt',
  habanero: 'Habanero',
  wazdan: 'Wazdan',
  bgaming: 'BGaming',
  endorphina: 'Endorphina',
  betsoft: 'Betsoft',
  '1spin4win': '1Spin4Win',
  hacksaw: 'Hacksaw',
  pgsoft: 'PG Soft',
  yggdrasil: 'Yggdrasil',
  relax: 'Relax Gaming',
  nolimit: 'Nolimit City',
  quickspin: 'Quickspin',
  belatra: 'Belatra',
  thunderkick: 'Thunderkick',
  platipus: 'Platipus',
  avatarux: 'AvatarUX',
  popiplay: 'Popiplay',
  zillion: 'Zillion',
  clawbuster: 'Clawbuster',
  onetouch: 'OneTouch',
  truelab: 'TrueLab',
  slotmill: 'Slotmill',
  fantasma: 'Fantasma',
  netent: 'NetEnt',
  netgame: 'NetGame',
  bullshark: 'Bullshark Games',
  nownow: 'NowNow',
  print: 'Print Studios',
  hacksawgaming: 'Hacksaw',
};

// Title-case fallback for unmatched single tokens.
function titleCase(tok) {
  return tok
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function providerFromSlug(slug) {
  if (!slug) return null;
  const toks = slug.split('-');
  // try longest prefix (up to 3 tokens) down to 1
  for (let n = Math.min(3, toks.length - 1); n >= 1; n--) {
    const key = toks.slice(0, n).join('-');
    if (PROVIDER_PREFIXES[key]) return PROVIDER_PREFIXES[key];
  }
  // fallback: first token title-cased (only if it leaves a real game name)
  if (toks.length >= 2) return titleCase(toks[0]);
  return null;
}

// ── Carry-over metadata from the existing file, keyed by lowercased name. ────
function loadOldMeta() {
  const map = new Map();
  if (!fs.existsSync(OUT_PATH)) return map;
  const src = fs.readFileSync(OUT_PATH, 'utf8');
  // Pull each object literal's fields. Robust-enough regex for the generated shape.
  const objRe = /\{\s*id:[^}]*?\}/g;
  const objs = src.match(objRe) || [];
  const field = (s, name, isStr) => {
    const re = isStr
      ? new RegExp(name + ':\\s*"((?:[^"\\\\]|\\\\.)*)"')
      : new RegExp(name + ':\\s*([^,}]+)');
    const m = s.match(re);
    return m ? m[1].trim() : null;
  };
  for (const o of objs) {
    const name = field(o, 'name', true);
    if (!name) continue;
    const rtpRaw = field(o, 'rtp', false);
    map.set(name.toLowerCase().trim(), {
      volatility: field(o, 'volatility', true),
      rtp: rtpRaw && rtpRaw !== 'null' ? Number(rtpRaw) : null,
      bonusBuy: field(o, 'bonusBuy', false) === 'true',
      megaways: field(o, 'megaways', false) === 'true',
      progressive: field(o, 'progressive', false) === 'true',
    });
  }
  return map;
}

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function main() {
  const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const oldMeta = loadOldMeta();

  const seen = new Set();
  const out = [];
  let droppedNoImage = 0;
  let droppedNoProvider = 0;
  let droppedDup = 0;
  let carried = 0;

  for (const s of raw) {
    const name = (s.name || '').trim();
    const image = (s.thumb || '').trim();
    if (!image) { droppedNoImage++; continue; }
    const provider = providerFromSlug(s.rainbetSlug);
    if (!provider) { droppedNoProvider++; continue; }
    const key = name.toLowerCase();
    if (!name || seen.has(key)) { droppedDup++; continue; }
    seen.add(key);

    const meta = oldMeta.get(key);
    if (meta) carried++;
    out.push({
      name,
      provider,
      image,
      volatility: meta?.volatility ?? 'high',
      rtp: meta?.rtp ?? null,
      bonusBuy: meta?.bonusBuy ?? false,
      megaways: meta?.megaways ?? false,
      progressive: meta?.progressive ?? false,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  out.forEach((s, i) => { s.id = i + 1; });

  // ── Emit, column-aligned like the original. ──
  const w = {
    id: Math.max(...out.map((s) => String(s.id).length)),
    name: Math.max(...out.map((s) => esc(s.name).length)) + 2,
    prov: Math.max(...out.map((s) => esc(s.provider).length)) + 2,
    img: Math.max(...out.map((s) => esc(s.image).length)) + 2,
  };
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));

  const lines = out.map((s) => {
    const id = pad(String(s.id) + ',', w.id + 1);
    const nm = pad('"' + esc(s.name) + '",', w.name + 1);
    const pv = pad('"' + esc(s.provider) + '",', w.prov + 1);
    const im = pad('"' + esc(s.image) + '",', w.img + 1);
    const vol = pad('"' + s.volatility + '",', 9);
    const rtp = pad((s.rtp === null ? 'null' : s.rtp) + ',', 6);
    return `  { id: ${id} name: ${nm} provider: ${pv} image: ${im} volatility: ${vol} rtp: ${rtp} bonusBuy: ${s.bonusBuy}, megaways: ${s.megaways}, progressive: ${s.progressive} },`;
  });

  const header = `// Slot database — regenerated from Rainbet export (scripts/data/rainbet_slots_clean.json).
// Regenerate with: node scripts/gen-slots.js
// Fields: id, name, provider, image, volatility, rtp, bonusBuy, megaways, progressive
// volatility: 'low' | 'medium' | 'high' | null if unknown
// rtp: number or null if unknown
// bonusBuy / megaways / progressive: true | false
// Metadata (volatility/rtp/flags) carried over from prior slots.js by name match.

const slots = [
${lines.join('\n')}
];

export default slots;
`;

  fs.writeFileSync(OUT_PATH, header, 'utf8');

  console.log('input slots      :', raw.length);
  console.log('dropped no image :', droppedNoImage);
  console.log('dropped no prov  :', droppedNoProvider);
  console.log('dropped dup name :', droppedDup);
  console.log('metadata carried :', carried);
  console.log('OUTPUT slots     :', out.length);
}

main();
