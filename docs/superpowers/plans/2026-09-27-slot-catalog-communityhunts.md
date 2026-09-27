# Slot Catalog from communityhunts.gg Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bundled 2.2 MB static slot list with the communityhunts.gg slot catalogue for Slot Picker and the slot search box.

**Architecture:**
- `/api/slots` (rewritten; it was an unused slotslaunch proxy) fetches the whole catalogue through `api/_lib/communityHunts.js` and caches it for 6h in memory plus one day on the CDN, with stale-on-error.
- The client normalizes rows in a pure `src/utils/slotCatalog.js` and loads them once per page session through `src/hooks/useSlotCatalog.js`, which both components share.

**Tech Stack:** Create React App (React 19, Jest + Testing Library), Vercel serverless functions (ESM), communityhunts.gg public API v1.

**Spec:** [docs/superpowers/specs/2026-09-27-slot-catalog-communityhunts-design.md](../specs/2026-09-27-slot-catalog-communityhunts-design.md)

## Global Constraints

- **Key handling:** `COMMUNITYHUNTS_API_KEY` is server-only. Never log it or put it in a URL. It is already set in Vercel and `.env.local`.
- **Upstream:** `GET https://api.communityhunts.gg/api/public/v1/slots` returns the whole catalogue as `{ data: Row[], pagination }`. A row is `{ name, provider, slug, rainbetSlug, thumb, bonusBuy, rtp, volatility, maxWin }`, where `provider` is a lowercase slug and `bonusBuy`, `rtp`, `volatility` and `maxWin` may be null.
- **Import boundary:** client code must never import from `api/`, because CRA blocks it. Tests under `src/` may.
- **Unchanged behavior:** the `SlotAutocomplete` props, and the fact that `onSelect(slot)` passes an object with at least `{ id, name, provider, thumbnail }`. `provider` is the display name, and `thumbnail` is an **unencoded** URL, because `AdminGiveawaysPage` calls `encodeURI(thumbnail)`.
- **Copy:** PRODUCT.md voice rules (no em dashes in copy, no three-item rhythm, sentence case).
- **Test command:** `CI=true npx react-scripts test --watchAll=false --testPathPattern=<name>`. CRA sets `resetMocks: true`, so use plain functions in `jest.mock` factories or set implementations inside each test.
- **Build command:** `CI=true npx react-scripts build`. It must compile with no ESLint warnings.
- **Commits:** conventional subjects (`feat(slots): …`, `chore(slots): …`), and check the branch in the same command: `test "$(git branch --show-current)" = feat/slot-catalog && git commit …`. **No `Co-Authored-By` trailer.**
- **Branch:** `feat/slot-catalog` (already created from `main`; the spec is committed there).

## Review Focus

1. **Pre-encoded thumbnails.** 3,701 of 7,625 live catalogue thumbnails contain `%20`. If they reach `AdminGiveawaysPage.saveSlot`'s `encodeURI` still encoded, they become `%2520` and the giveaway overlay image breaks. The normalizer decodes them. Pinned in Task 1 (`normalizeSlot` decodes the thumbnail) and Task 4 (`onSelect` receives the decoded thumbnail).
2. **A malformed percent sequence** in a thumbnail must not throw. `decodeURI` raises `URIError`; the normalizer keeps the raw string instead. Pinned in Task 1.
3. **Catalogue fetch fails:**
   - Slot Picker shows "Slot list is offline, try again in a bit." with its filters still rendered.
   - The search box still accepts free typing.
   - The next mount retries.
   - Pinned in Task 3 (retry), Task 4 (free typing) and Task 5 (offline line).
4. **Upstream down after the cache expires** serves the stale copy. With an empty cache it returns a fast 502 JSON. Pinned in Task 2.
5. **Slots arrive after the user has already typed** in the search box. Suggestions should appear without retyping. Pinned in Task 4.

---

### Task 1: Slot catalogue normalizer

**Files:**
- Create: `src/utils/slotCatalog.js`
- Test: `src/utils/__tests__/slotCatalog.test.js`

**Interfaces:**
- Produces (named exports from `src/utils/slotCatalog.js`):
  - `canonicalProvider(slug) → string` (`'unknown'` when empty)
  - `providerDisplayName(slug) → string|null`
  - `volatilityBucket(v) → 'low'|'medium'|'high'|null`
  - `isMegaways(name) → boolean`
  - `decodeThumb(url) → string|null`
  - `normalizeSlot(row) → Slot`
  - `normalizeCatalog(rows) → Slot[]`
  - `providersFrom(slots) → { name, slug }[]`
  - `Slot = { id, slug, name, provider, providerSlug, thumbnail, rtp, volatility, bonusBuy, megaways, maxWin }`

- [ ] **Step 1: Write the failing tests**

```js
import {
  canonicalProvider,
  providerDisplayName,
  volatilityBucket,
  isMegaways,
  decodeThumb,
  normalizeSlot,
  normalizeCatalog,
  providersFrom,
} from '../slotCatalog';

test('provider display names: overrides, title-case, aliases', () => {
  expect(providerDisplayName('playn-go')).toBe("Play'n GO");
  expect(providerDisplayName('play-n-go')).toBe("Play'n GO");
  expect(providerDisplayName('pgsoft')).toBe('PG Soft');
  expect(providerDisplayName('isoftbet')).toBe('iSoftBet');
  expect(providerDisplayName('nolimit')).toBe('Nolimit City');
  expect(providerDisplayName('hacksaw-gaming')).toBe('Hacksaw Gaming');
  expect(providerDisplayName('pragmatic-play')).toBe('Pragmatic Play');
  expect(providerDisplayName('big-time-gaming')).toBe('Big Time Gaming');
  expect(providerDisplayName('3-oaks')).toBe('3 Oaks');
  expect(providerDisplayName('')).toBeNull();
  expect(providerDisplayName(null)).toBeNull();
  expect(canonicalProvider('kitsune-studios')).toBe('kitsune');
  expect(canonicalProvider(null)).toBe('unknown');
});

test('volatility buckets cover every observed upstream value', () => {
  const cases = {
    high: 'high', 'very-high': 'high', 'very high': 'high', extreme: 'high', High: 'high',
    medium: 'medium', 'medium-high': 'medium', med: 'medium', Medium: 'medium',
    low: 'low', 'medium-low': 'low', 'low-medium': 'low',
    variable: null,
  };
  for (const [input, bucket] of Object.entries(cases)) {
    expect(volatilityBucket(input)).toBe(bucket);
  }
  expect(volatilityBucket(null)).toBeNull();
  expect(volatilityBucket(undefined)).toBeNull();
});

test('megaways is detected from the name', () => {
  expect(isMegaways('Bonanza Megaways')).toBe(true);
  expect(isMegaways('Extra Chilli MEGAWAYS')).toBe(true);
  expect(isMegaways('Gates of Olympus')).toBe(false);
});

// Review Focus 1 + 2: pre-encoded thumbs come back unencoded; bad escapes don't throw.
test('decodeThumb unencodes, and keeps a malformed URL as-is', () => {
  expect(decodeThumb('https://cdn.rainbet.com/slots/1%20Reel%20-%20Aztec%20Spell.png'))
    .toBe('https://cdn.rainbet.com/slots/1 Reel - Aztec Spell.png');
  expect(decodeThumb('https://cdn.rainbet.com/slots/bad%E0%A4%A.png'))
    .toBe('https://cdn.rainbet.com/slots/bad%E0%A4%A.png');
  expect(decodeThumb(null)).toBeNull();
});

test('normalizeSlot maps a catalogue row to the UI shape', () => {
  expect(
    normalizeSlot({
      name: 'Bonanza Megaways', provider: 'big-time-gaming', slug: 'bonanza-megaways',
      rainbetSlug: 'big-time-gaming-bonanza-megaways',
      thumb: 'https://cdn.rainbet.com/slots/Bonanza%20Megaways.png',
      bonusBuy: null, rtp: 96, volatility: 'very-high', maxWin: 12000,
    })
  ).toEqual({
    id: 'big-time-gaming-bonanza-megaways',
    slug: 'big-time-gaming-bonanza-megaways',
    name: 'Bonanza Megaways',
    provider: 'Big Time Gaming',
    providerSlug: 'big-time-gaming',
    thumbnail: 'https://cdn.rainbet.com/slots/Bonanza Megaways.png',
    rtp: 96,
    volatility: 'high',
    bonusBuy: false,
    megaways: true,
    maxWin: 12000,
  });
});

test('normalizeCatalog drops unnamed rows and dedupes by id', () => {
  const rows = [
    { name: 'A', provider: 'bgaming', rainbetSlug: 'bgaming-a' },
    { name: 'A again', provider: 'bgaming', rainbetSlug: 'bgaming-a' },
    { name: '', provider: 'bgaming', rainbetSlug: 'bgaming-x' },
    { name: 'B', provider: 'netent', slug: 'b' },
  ];
  const out = normalizeCatalog(rows);
  expect(out.map((s) => s.id)).toEqual(['bgaming-a', 'b']);
  expect(out[0].name).toBe('A');
  expect(normalizeCatalog(null)).toEqual([]);
});

test('providersFrom gives unique, sorted providers with aliases merged', () => {
  const slots = normalizeCatalog([
    { name: 'x1', provider: 'hacksaw', rainbetSlug: '1' },
    { name: 'x2', provider: 'hacksaw-gaming', rainbetSlug: '2' },
    { name: 'x3', provider: 'bgaming', rainbetSlug: '3' },
    { name: 'x4', provider: null, rainbetSlug: '4' },
  ]);
  expect(providersFrom(slots)).toEqual([
    { name: 'BGaming', slug: 'bgaming' },
    { name: 'Hacksaw Gaming', slug: 'hacksaw' },
  ]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=slotCatalog.test`
Expected: FAIL with `Cannot find module '../slotCatalog'`.

- [ ] **Step 3: Write `src/utils/slotCatalog.js`**

```js
// Normalizes the communityhunts.gg slot catalogue (GET /api/slots) into the
// shape Slot Picker and SlotAutocomplete use. communityhunts sends provider
// slugs and free-form volatility; this is the one place that turns them into
// display names and the picker's low / medium / high buckets.

// Same provider under two slugs upstream.
const PROVIDER_ALIASES = {
  'play-n-go': 'playn-go',
  'hacksaw-gaming': 'hacksaw',
  'ace-roll': 'aceroll',
  'kitsune-studios': 'kitsune',
  'clutch-gaming': 'clutch',
};

// Display names where title-casing the slug gets it wrong.
const PROVIDER_NAMES = {
  'playn-go': "Play'n GO",
  bgaming: 'BGaming',
  netent: 'NetEnt',
  pgsoft: 'PG Soft',
  isoftbet: 'iSoftBet',
  nolimit: 'Nolimit City',
  'elk-studios': 'ELK Studios',
  '1spin4win': '1spin4win',
  avatarux: 'AvatarUX',
  gameart: 'GameArt',
  onetouch: 'OneTouch',
  'peter-sons': 'Peter & Sons',
  hacksaw: 'Hacksaw Gaming',
  relax: 'Relax Gaming',
  truelab: 'TrueLab',
  nownow: 'NowNow',
  blueprint: 'Blueprint Gaming',
  fantasma: 'Fantasma Games',
  aceroll: 'Ace Roll',
  kitsune: 'Kitsune Studios',
  clutch: 'Clutch Gaming',
};

const VOLATILITY_BUCKETS = {
  low: 'low',
  'medium-low': 'low',
  'low-medium': 'low',
  medium: 'medium',
  med: 'medium',
  'medium-high': 'medium',
  high: 'high',
  'very-high': 'high',
  extreme: 'high',
};

export function canonicalProvider(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return 'unknown';
  return PROVIDER_ALIASES[s] || s;
}

export function providerDisplayName(slug) {
  const canonical = canonicalProvider(slug);
  if (canonical === 'unknown') return null;
  if (PROVIDER_NAMES[canonical]) return PROVIDER_NAMES[canonical];
  return canonical
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function volatilityBucket(v) {
  if (v == null) return null;
  const key = String(v).trim().toLowerCase().replace(/\s+/g, '-');
  return VOLATILITY_BUCKETS[key] || null;
}

export function isMegaways(name) {
  return /megaways/i.test(String(name || ''));
}

// communityhunts sends Rainbet art URLs percent-encoded ("1%20Reel…").
// Consumers (AdminGiveawaysPage.saveSlot) encodeURI() the thumbnail, so hand
// them the unencoded form, like the old static list. Malformed escapes stay raw.
export function decodeThumb(url) {
  if (!url) return null;
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

const finiteOrNull = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null);

export function normalizeSlot(row) {
  const id = row.rainbetSlug || row.slug || row.name;
  return {
    id,
    slug: id,
    name: row.name,
    provider: providerDisplayName(row.provider),
    providerSlug: canonicalProvider(row.provider),
    thumbnail: decodeThumb(row.thumb),
    rtp: finiteOrNull(row.rtp),
    volatility: volatilityBucket(row.volatility),
    bonusBuy: row.bonusBuy === true,
    megaways: isMegaways(row.name),
    maxWin: finiteOrNull(row.maxWin),
  };
}

export function normalizeCatalog(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row || !row.name) continue;
    const slot = normalizeSlot(row);
    if (seen.has(slot.id)) continue;
    seen.add(slot.id);
    out.push(slot);
  }
  return out;
}

export function providersFrom(slots) {
  const bySlug = new Map();
  for (const s of slots || []) {
    if (!s.provider || s.providerSlug === 'unknown' || bySlug.has(s.providerSlug)) continue;
    bySlug.set(s.providerSlug, { name: s.provider, slug: s.providerSlug });
  }
  return Array.from(bySlug.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=slotCatalog.test`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/slot-catalog && git add src/utils/slotCatalog.js src/utils/__tests__/slotCatalog.test.js && git commit -m "feat(slots): normalize the communityhunts slot catalogue"
```

---

### Task 2: `/api/slots` serves the catalogue

**Files:**
- Modify: `api/_lib/communityHunts.js` (add `getSlotCatalog`)
- Rewrite: `api/slots.js`
- Modify: `src/setupProxy.js` (replace the slotslaunch dev handler)
- Modify: `.env.example` (remove `SLOTSLAUNCH_API_KEY`)
- Test: `src/__tests__/slotsApi.test.js`

**Interfaces:**
- Consumes: `chGet`, `CommunityHuntsError` (existing, in `api/_lib/communityHunts.js`).
- Produces:
  - `getSlotCatalog() → Promise<Row[]>`
  - `GET /api/slots` → `200 { slots: Row[] }`; errors `503 { error: 'NOT_CONFIGURED' }` and `502 { error: 'UPSTREAM_UNAVAILABLE' }`
  - named export `__resetCacheForTests()`

- [ ] **Step 1: Write the failing tests**

```js
/**
 * @jest-environment node
 */
import handler, { __resetCacheForTests } from '../../api/slots';

const ROWS = [
  { name: 'Gates of Olympus', provider: 'pragmatic-play', slug: 'gates-of-olympus', rainbetSlug: 'pragmatic-play-gates-of-olympus', thumb: 'https://cdn.rainbet.com/slots/gates.png', bonusBuy: true, rtp: 96.5, volatility: 'very-high', maxWin: 5000 },
  { name: 'Sugar Mix', provider: 'bgaming', slug: 'sugar-mix', rainbetSlug: 'bgaming-sugar-mix', thumb: null, bonusBuy: null, rtp: null, volatility: 'low', maxWin: null },
];

function mockRes() {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}
const req = (method = 'GET') => ({ method, query: {} });
const upstream = (status, body) => ({ ok: status < 300, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  __resetCacheForTests();
  process.env.COMMUNITYHUNTS_API_KEY = 'ch_live_test';
  global.fetch = jest.fn();
});
afterEach(() => {
  delete process.env.COMMUNITYHUNTS_API_KEY;
});

test('returns 503 when the key is unset', async () => {
  delete process.env.COMMUNITYHUNTS_API_KEY;
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(503);
  expect(res.body).toEqual({ error: 'NOT_CONFIGURED' });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('serves the whole catalogue with long CDN caching, then from memory', async () => {
  global.fetch.mockResolvedValueOnce(upstream(200, { data: ROWS, pagination: { total: 2 } }));
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ slots: ROWS });
  expect(global.fetch.mock.calls[0][0]).toBe('https://api.communityhunts.gg/api/public/v1/slots');
  expect(res.headers['Cache-Control']).toBe('public, s-maxage=86400, stale-while-revalidate=604800');

  const again = mockRes();
  await handler(req(), again);
  expect(again.headers['X-Cache']).toBe('HIT');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('rejects non-GET methods', async () => {
  const res = mockRes();
  await handler(req('POST'), res);
  expect(res.statusCode).toBe(405);
});

// Review Focus 4.
test('upstream failure with no cache returns 502', async () => {
  global.fetch.mockResolvedValue(upstream(500, { error: { code: 'boom' } }));
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(502);
  expect(res.body).toEqual({ error: 'UPSTREAM_UNAVAILABLE' });
});

// Review Focus 4.
test('serves the stale copy when upstream fails after expiry', async () => {
  const realNow = Date.now;
  global.fetch.mockResolvedValueOnce(upstream(200, { data: ROWS }));
  await handler(req(), mockRes());
  Date.now = () => realNow() + 7 * 60 * 60 * 1000;
  try {
    global.fetch.mockRejectedValue(new TypeError('fetch failed'));
    const res = mockRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['X-Cache']).toBe('STALE');
    expect(res.body.slots).toHaveLength(2);
  } finally {
    Date.now = realNow;
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=slotsApi`
Expected: FAIL. The current `api/slots.js` is the slotslaunch proxy: it has no `__resetCacheForTests` export, and a GET with no `path` returns 400.

- [ ] **Step 3: Add `getSlotCatalog` to `api/_lib/communityHunts.js`**

Insert directly after the `getCurrentHunt` function:

```js
// The whole Rainbet slot catalogue (not per-community; communityhunts re-syncs
// it nightly and sends it with public caching). One response, ~7.6k rows.
export async function getSlotCatalog() {
  const body = await chGet('/slots');
  return body && Array.isArray(body.data) ? body.data : [];
}
```

- [ ] **Step 4: Rewrite `api/slots.js`**

Replace the whole file with:

```js
import { getSlotCatalog } from './_lib/communityHunts.js';

// Slot catalogue for Slot Picker and the slot search box, re-served from the
// communityhunts.gg /slots endpoint (the Rainbet list, re-synced nightly).
// The rows change at most daily, so cache hard: 6h in memory per instance,
// a day on the CDN, and serve the last good copy if communityhunts is down.
//
// GET /api/slots -> { slots: Row[] }

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=604800';

let cache = null; // { data, expiresAt }; expired entries stay as the stale fallback

export function __resetCacheForTests() {
  cache = null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.COMMUNITYHUNTS_API_KEY) {
    console.error('slots: COMMUNITYHUNTS_API_KEY is not set.');
    return res.status(503).json({ error: 'NOT_CONFIGURED' });
  }

  if (cache && Date.now() < cache.expiresAt) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json(cache.data);
  }

  try {
    const data = { slots: await getSlotCatalog() };
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json(data);
  } catch (err) {
    if (cache) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache.data);
    }
    console.error('slots proxy error:', (err && err.code) || (err && err.message));
    return res.status(502).json({ error: 'UPSTREAM_UNAVAILABLE' });
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=slotsApi`
Expected: PASS (5 tests).

- [ ] **Step 6: Replace the dev mirror in `src/setupProxy.js`**

- Replace the header comment lines 3–4 with:

```js
// Dev-only secrets — read from env (.env.local), no longer committed. Set
// COMMUNITYHUNTS_API_KEY in .env.local for the local API mirrors.
```

- Delete these three lines:

```js
const SLOTS_API_KEY  = process.env.SLOTSLAUNCH_API_KEY || '';
const SLOTS_BASE_URL = 'https://slotslaunch.com/api';
const SLOTS_ORIGIN   = 'goofer.tv';
```

- Replace the startup warning block (`if (!SLOTS_API_KEY || !process.env.COMMUNITYHUNTS_API_KEY) { … }`) with:

```js
if (!process.env.COMMUNITYHUNTS_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[setupProxy] COMMUNITYHUNTS_API_KEY not set in .env.local — ' +
      '/api/communityhunts and /api/slots dev mirrors will fail until it is.'
  );
}
```

- Replace the whole `// Dev handler for /api/slots (mirrors the Vercel function)` block, from its comment through its closing `});`, with:

```js
  // Dev handler for /api/slots (mirrors the Vercel function): the
  // communityhunts.gg slot catalogue.
  app.get('/api/slots', async (_req, res) => {
    try {
      const body = await chDevGet('/slots');
      res.status(200).json({ slots: body.data || [] });
    } catch (e) {
      res.status(502).json({ error: 'UPSTREAM_UNAVAILABLE' });
    }
  });
```

Run: `node --check src/setupProxy.js && grep -nE "SLOTS|slotslaunch" src/setupProxy.js`
Expected: no output after the syntax check.

- [ ] **Step 7: Remove `SLOTSLAUNCH_API_KEY` from `.env.example`**

Delete the line `SLOTSLAUNCH_API_KEY=your_slotslaunch_api_key  # api/slots.js (slotslaunch.com)`.

Run: `grep -rn "SLOTSLAUNCH\|slotslaunch" api src .env.example`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
test "$(git branch --show-current)" = feat/slot-catalog && git add api/_lib/communityHunts.js api/slots.js src/setupProxy.js .env.example src/__tests__/slotsApi.test.js && git commit -m "feat(slots): serve the communityhunts slot catalogue from /api/slots"
```

---

### Task 3: Shared catalogue loader hook

**Files:**
- Create: `src/hooks/useSlotCatalog.js`
- Test: `src/hooks/__tests__/useSlotCatalog.test.js`

**Interfaces:**
- Consumes (Task 1): `normalizeCatalog`. Consumes (Task 2): `GET /api/slots` → `{ slots: Row[] }`.
- Produces:
  - default export `useSlotCatalog() → { slots: Slot[], loading: boolean, error: string|null }`
  - named export `__resetSlotCatalogForTests()`

- [ ] **Step 1: Write the failing tests**

```js
import { render, waitFor } from '@testing-library/react';
import useSlotCatalog, { __resetSlotCatalogForTests } from '../useSlotCatalog';

const ROWS = [
  { name: 'Gates of Olympus', provider: 'pragmatic-play', rainbetSlug: 'pp-gates', thumb: 'https://cdn.rainbet.com/slots/gates.png', volatility: 'very-high' },
  { name: 'Sugar Mix', provider: 'bgaming', rainbetSlug: 'bg-sugar', thumb: null, volatility: 'low' },
];
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = () => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: 'UPSTREAM_UNAVAILABLE' }) });

function Probe({ onState }) {
  onState(useSlotCatalog());
  return null;
}

beforeEach(() => {
  __resetSlotCatalogForTests();
});

test('two consumers share one fetch and get normalized slots', async () => {
  global.fetch = jest.fn(() => ok({ slots: ROWS }));
  let a;
  let b;
  render(
    <>
      <Probe onState={(s) => { a = s; }} />
      <Probe onState={(s) => { b = s; }} />
    </>
  );
  expect(a.loading).toBe(true);
  await waitFor(() => expect(a.loading).toBe(false));
  await waitFor(() => expect(b.loading).toBe(false));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith('/api/slots');
  expect(a.slots[0]).toMatchObject({ name: 'Gates of Olympus', provider: 'Pragmatic Play', volatility: 'high' });
  expect(b.slots).toHaveLength(2);
});

test('a later mount reuses the loaded catalogue without refetching', async () => {
  global.fetch = jest.fn(() => ok({ slots: ROWS }));
  let first;
  const { unmount } = render(<Probe onState={(s) => { first = s; }} />);
  await waitFor(() => expect(first.loading).toBe(false));
  unmount();
  let second;
  render(<Probe onState={(s) => { second = s; }} />);
  expect(second.loading).toBe(false);
  expect(second.slots).toHaveLength(2);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

// Review Focus 3: a failed load reports an error and the next mount retries.
test('a failed load sets error, and a remount retries', async () => {
  global.fetch = jest.fn().mockReturnValueOnce(fail()).mockReturnValueOnce(ok({ slots: ROWS }));
  let first;
  const { unmount } = render(<Probe onState={(s) => { first = s; }} />);
  await waitFor(() => expect(first.error).toBeTruthy());
  expect(first.slots).toEqual([]);
  unmount();
  let second;
  render(<Probe onState={(s) => { second = s; }} />);
  await waitFor(() => expect(second.loading).toBe(false));
  expect(second.error).toBeNull();
  expect(second.slots).toHaveLength(2);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=useSlotCatalog`
Expected: FAIL with `Cannot find module '../useSlotCatalog'`.

- [ ] **Step 3: Write `src/hooks/useSlotCatalog.js`**

```js
import { useEffect, useState } from 'react';
import { normalizeCatalog } from '../utils/slotCatalog';

// Loads the slot catalogue (/api/slots) once per page session and shares it
// between Slot Picker and every SlotAutocomplete. A failed load clears the
// shared promise so the next mount retries.

let catalogPromise = null;
let catalogCache = null; // normalized Slot[] once loaded

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('/api/slots')
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || !Array.isArray(body.slots)) {
          throw new Error((body && body.error) || `HTTP ${res.status}`);
        }
        catalogCache = normalizeCatalog(body.slots);
        return catalogCache;
      })
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

export function __resetSlotCatalogForTests() {
  catalogPromise = null;
  catalogCache = null;
}

export default function useSlotCatalog() {
  const [state, setState] = useState(() =>
    catalogCache
      ? { slots: catalogCache, loading: false, error: null }
      : { slots: [], loading: true, error: null }
  );

  useEffect(() => {
    if (catalogCache) return undefined;
    let cancelled = false;
    loadCatalog().then(
      (slots) => {
        if (!cancelled) setState({ slots, loading: false, error: null });
      },
      (err) => {
        if (!cancelled) setState({ slots: [], loading: false, error: err.message || 'Failed' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=useSlotCatalog`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/slot-catalog && git add src/hooks/useSlotCatalog.js src/hooks/__tests__/useSlotCatalog.test.js && git commit -m "feat(slots): shared slot catalogue loader hook"
```

---

### Task 4: Slot search box uses the catalogue

**Files:**
- Modify: `src/components/SlotAutocomplete.js`
- Test: `src/components/__tests__/SlotAutocomplete.test.js`

**Interfaces:**
- Consumes (Task 3): `useSlotCatalog`.
- Produces: unchanged props. `onSelect(slot)` receives the normalized `Slot`, a superset of `{ id, name, provider, thumbnail }`, with `thumbnail` unencoded.

- [ ] **Step 1: Write the failing tests**

```js
import { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SlotAutocomplete from '../SlotAutocomplete';
import { __resetSlotCatalogForTests } from '../../hooks/useSlotCatalog';

const ROWS = [
  { name: 'Gates of Olympus', provider: 'pragmatic-play', rainbetSlug: 'pp-gates', thumb: 'https://cdn.rainbet.com/slots/Gates%20of%20Olympus.png' },
  { name: 'Sugar Mix', provider: 'bgaming', rainbetSlug: 'bg-sugar', thumb: null },
];

function Harness({ onSelect }) {
  const [value, setValue] = useState('');
  return <SlotAutocomplete value={value} onChange={setValue} onSelect={onSelect} aria-label="Slot" />;
}

beforeEach(() => {
  __resetSlotCatalogForTests();
});

// Review Focus 1: the selected slot carries the unencoded thumbnail.
test('suggests fetched slots and selects one with display provider and unencoded art', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ slots: ROWS }) })
  );
  const onSelect = jest.fn();
  render(<Harness onSelect={onSelect} />);
  const input = screen.getByLabelText('Slot');
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/slots'));
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'gates' } });
  const option = await screen.findByText('Gates of Olympus');
  expect(screen.getByText('Pragmatic Play')).toBeTruthy();
  fireEvent.mouseDown(option);
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Gates of Olympus',
      provider: 'Pragmatic Play',
      thumbnail: 'https://cdn.rainbet.com/slots/Gates of Olympus.png',
    })
  );
  expect(input.value).toBe('Gates of Olympus');
});

// Review Focus 5: typed before the list arrived → suggestions appear on arrival.
test('suggestions appear when the catalogue arrives after typing', async () => {
  let resolveFetch;
  global.fetch = jest.fn(
    () => new Promise((resolve) => { resolveFetch = resolve; })
  );
  render(<Harness onSelect={() => {}} />);
  const input = screen.getByLabelText('Slot');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'sugar' } });
  expect(screen.queryByText('Sugar Mix')).toBeNull();
  await act(async () => {
    resolveFetch({ ok: true, status: 200, json: () => Promise.resolve({ slots: ROWS }) });
  });
  expect(await screen.findByText('Sugar Mix')).toBeTruthy();
});

// Review Focus 3: offline catalogue still allows free typing.
test('free typing works when the catalogue fails to load', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: 'UPSTREAM_UNAVAILABLE' }) })
  );
  render(<Harness onSelect={() => {}} />);
  const input = screen.getByLabelText('Slot');
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'My custom slot' } });
  expect(input.value).toBe('My custom slot');
  expect(screen.queryByRole('listbox')).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=SlotAutocomplete`
Expected: FAIL. The component still uses the static list, so `fetch` is never called (the `waitFor(... toHaveBeenCalledWith('/api/slots'))` times out), and "Pragmatic Play" / the decoded thumbnail don't match static data.

- [ ] **Step 3: Edit `src/components/SlotAutocomplete.js`**

Replace lines 3–10:

```js
import rawSlots from '../data/slots';

const ALL_SLOTS = rawSlots.map((g) => ({
  id: g.id,
  name: g.name,
  provider: g.provider,
  thumbnail: g.image,
}));
```

with:

```js
import useSlotCatalog from '../hooks/useSlotCatalog';
```

Directly after `const listId = useId();`, add:

```js
  const { slots } = useSlotCatalog();
```

In the suggestions effect, replace `const matches = ALL_SLOTS` with `const matches = slots`, and replace its dependency array `}, [value, focused]);` with `}, [value, focused, slots]);`.

Run: `grep -nE "ALL_SLOTS|rawSlots|data/slots" src/components/SlotAutocomplete.js`
Expected: no output.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=SlotAutocomplete`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/slot-catalog && git add src/components/SlotAutocomplete.js src/components/__tests__/SlotAutocomplete.test.js && git commit -m "feat(slots): slot search box reads the communityhunts catalogue"
```

---

### Task 5: Slot Picker uses the catalogue

**Files:**
- Modify: `src/components/SlotPicker.js`
- Test: `src/components/__tests__/SlotPicker.test.js`

**Interfaces:**
- Consumes (Task 1): `providersFrom`. Consumes (Task 3): `useSlotCatalog`.
- Produces: no new exports. The default export `SlotPicker` is unchanged.

- [ ] **Step 1: Write the failing tests**

```js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SlotPicker from '../SlotPicker';
import { __resetSlotCatalogForTests } from '../../hooks/useSlotCatalog';

const ROWS = [
  { name: 'Gates of Olympus', provider: 'pragmatic-play', rainbetSlug: 'pp-gates', thumb: 'https://cdn.rainbet.com/slots/gates.png', bonusBuy: true, rtp: 96.5, volatility: 'very-high', maxWin: 5000 },
  { name: 'Bonanza Megaways', provider: 'big-time-gaming', rainbetSlug: 'btg-bonanza', thumb: 'https://cdn.rainbet.com/slots/Bonanza%20Megaways.png', bonusBuy: false, rtp: 96, volatility: 'high', maxWin: 12000 },
  { name: 'Sugar Mix', provider: 'bgaming', rainbetSlug: 'bg-sugar', thumb: null, bonusBuy: null, rtp: null, volatility: 'low', maxWin: null },
  { name: 'Book of Dead', provider: 'playn-go', rainbetSlug: 'png-book', thumb: 'https://cdn.rainbet.com/slots/book.png', bonusBuy: false, rtp: 96.21, volatility: 'medium-high', maxWin: 5000 },
];

function mockCatalog(ok = true) {
  global.fetch = jest.fn(() =>
    Promise.resolve(
      ok
        ? { ok: true, status: 200, json: () => Promise.resolve({ slots: ROWS }) }
        : { ok: false, status: 502, json: () => Promise.resolve({ error: 'UPSTREAM_UNAVAILABLE' }) }
    )
  );
}

async function openCatalog() {
  render(<SlotPicker />);
  fireEvent.click(screen.getByRole('button', { name: /catalog/i }));
}

beforeEach(() => {
  __resetSlotCatalogForTests();
});

test('catalog shows fetched slots with display providers and a max win badge', async () => {
  mockCatalog();
  await openCatalog();
  expect(await screen.findByText('Gates of Olympus')).toBeTruthy();
  expect(screen.getByText('Pragmatic Play')).toBeTruthy();
  expect(screen.getByText("Play'n GO")).toBeTruthy();
  expect(screen.getByText('12,000x')).toBeTruthy();
});

test('volatility high shows only high-bucket slots', async () => {
  mockCatalog();
  await openCatalog();
  await screen.findByText('Gates of Olympus');
  fireEvent.click(screen.getByRole('button', { name: 'high' }));
  expect(screen.getByText('Gates of Olympus')).toBeTruthy();
  expect(screen.getByText('Bonanza Megaways')).toBeTruthy();
  expect(screen.queryByText('Sugar Mix')).toBeNull();
  expect(screen.queryByText('Book of Dead')).toBeNull();
});

test('megaways filter uses name detection and the progressive filter is gone', async () => {
  mockCatalog();
  await openCatalog();
  await screen.findByText('Gates of Olympus');
  expect(screen.queryByRole('button', { name: /progressive/i })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /megaways/i }));
  expect(screen.getByText('Bonanza Megaways')).toBeTruthy();
  expect(screen.queryByText('Gates of Olympus')).toBeNull();
});

// Review Focus 3: offline catalogue shows the offline line, filters still render.
test('catalog shows the offline line when the slot list fails', async () => {
  mockCatalog(false);
  await openCatalog();
  expect(await screen.findByText(/slot list is offline, try again in a bit/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /megaways/i })).toBeTruthy();
});

test('spinner candidates come from the catalogue', async () => {
  mockCatalog();
  render(<SlotPicker />);
  await waitFor(() => expect(screen.getAllByText('Gates of Olympus').length).toBeGreaterThan(0));
  expect(screen.getByText('004')).toBeTruthy();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=SlotPicker`
Expected: FAIL. The picker still renders the static list: no fetch, the Progressive button exists, and there is no "12,000x" badge or offline line.

- [ ] **Step 3: Edit `src/components/SlotPicker.js`**

3a. **Imports and module data.** In the lucide import list, delete `TrendingUp,`. Replace everything from `import rawSlots from '../data/slots';` through the end of the `ALL_PROVIDERS` declaration (line 44, `).sort((a, b) => a.name.localeCompare(b.name));`) with:

```js
import useSlotCatalog from '../hooks/useSlotCatalog';
import { providersFrom } from '../utils/slotCatalog';

function formatMaxWin(x) {
  return `${Math.round(x).toLocaleString('en-US')}x`;
}

// Loading / offline line shown in place of results while the catalogue loads.
function CatalogStatus({ loading, error }) {
  if (!loading && !error) return null;
  return (
    <div className="text-center py-16 border border-white/8 bg-zinc-card/30 font-mono">
      <p className="text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase text-white/65">
        {error ? 'Slot list is offline, try again in a bit.' : 'Acquiring slot list…'}
      </p>
    </div>
  );
}
```

3b. **`SlotSearch` state.** Delete `const [filterProgressive, setFilterProgressive] = useState(false);`. Directly after `const PER_PAGE = 24;`, add:

```js
  const { slots, loading, error } = useSlotCatalog();
  const providers = useMemo(() => providersFrom(slots), [slots]);
```

3c. **`SlotSearch` filter.** Replace the whole `const filteredGames = useMemo(() => { … }, [ … ]);` block with:

```js
  const filteredGames = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return slots.filter((g) => {
      if (
        term &&
        !g.name.toLowerCase().includes(term) &&
        !(g.provider || '').toLowerCase().includes(term)
      )
        return false;
      if (filterBonusBuy && !g.bonusBuy) return false;
      if (filterMegaways && !g.megaways) return false;
      if (volatility !== 'all' && g.volatility !== volatility) return false;
      if (
        selectedProviders.length > 0 &&
        !selectedProviders.includes(g.providerSlug)
      )
        return false;
      return true;
    });
  }, [slots, searchTerm, filterBonusBuy, filterMegaways, volatility, selectedProviders]);
```

3d. **Active filter count.** In `activeFilters`, delete the line `    filterProgressive,`.

3e. **Provider dropdown.** Replace `{ALL_PROVIDERS.map((p) => (` (inside the provider dropdown) with `{providers.map((p) => (`.

3f. **Progressive toggle.** Delete this object from the feature-toggle array:

```js
          {
            label: 'Progressive',
            icon: TrendingUp,
            active: filterProgressive,
            toggle: () => setFilterProgressive((v) => !v),
            tone: 'purple',
          },
```

In the "Clear all" handler, delete `setFilterProgressive(false);`.

3g. **Catalog card.** Replace `{game.providerName}` in the catalog card with `{game.provider}`. Replace the progressive badge block

```jsx
                    {game.progressive && (
                      <MonoBadge tone="yellow">
                        <TrendingUp size={9} aria-hidden="true" /> PROG
                      </MonoBadge>
                    )}
```

with

```jsx
                    {game.maxWin != null && (
                      <MonoBadge tone="yellow">{formatMaxWin(game.maxWin)}</MonoBadge>
                    )}
```

3h. **Catalog states.** Replace the empty-state condition `{filteredGames.length === 0 && (` with `{!loading && !error && filteredGames.length === 0 && (`. Directly above the `{/* Empty state */}` comment, add:

```jsx
      <CatalogStatus loading={loading} error={error} />
```

3i. **`SlotRandomizer` data.** Directly after `const SPIN_MS = 4200;`, add:

```js
  const { slots, loading, error } = useSlotCatalog();
  const providers = useMemo(() => providersFrom(slots), [slots]);
```

Replace the `candidates` memo with:

```js
  const candidates = useMemo(() => {
    return slots.filter((g) => {
      if (excludedProviders.has(g.providerSlug)) return false;
      if (filterBonusBuyOnly && !g.bonusBuy) return false;
      if (filterMegawaysOnly && !g.megaways) return false;
      return true;
    });
  }, [slots, excludedProviders, filterBonusBuyOnly, filterMegawaysOnly]);
```

3j. **Reel empty state.** Inside the `candidates.length === 0 ? (` branch, replace the two inner `<span>` lines (the "No signal" label and "Adjust filters to acquire candidates.") with:

```jsx
                    <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/65">
                      {loading ? 'Acquiring slot list…' : error ? 'Slot list is offline' : 'No signal'}
                    </span>
                    <span className="text-sm text-white/75">
                      {loading
                        ? 'Tuning in.'
                        : error
                          ? 'Try again in a bit.'
                          : 'Adjust filters to acquire candidates.'}
                    </span>
```

3k. **Remaining labels.** Replace `{game.providerName}` in the reel row with `{game.provider}`, and `{selectedGame.providerName}` in the result panel with `{selectedGame.provider}`. Replace `{ALL_PROVIDERS.map((p) => {` in the provider exclusion list with `{providers.map((p) => {`.

3l. **Verify:**

Run: `grep -nE "ALL_SLOTS|ALL_PROVIDERS|rawSlots|providerName|progressive|Progressive|TrendingUp" src/components/SlotPicker.js`
Expected: no output.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=SlotPicker`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/slot-catalog && git add src/components/SlotPicker.js src/components/__tests__/SlotPicker.test.js && git commit -m "feat(slots): slot picker reads the communityhunts catalogue"
```

---

### Task 6: Remove the static list, docs, end-to-end verification

**Files:**
- Delete: `src/data/slots.js`, `scripts/gen-slots.js`, `scripts/data/rainbet_slots_clean.json`
- Modify: `src/pages/GambaPage.js:10-13`, `src/pages/AdminGiveawaysPage.js:65`, `CLAUDE.md`

**Interfaces:** none.

- [ ] **Step 1: Delete the static data and its generator**

```bash
git rm -q src/data/slots.js scripts/gen-slots.js scripts/data/rainbet_slots_clean.json
```

Run: `grep -rnE "data/slots|gen-slots|rainbet_slots" src scripts api package.json`
Expected: no output. If `scripts/data/` is now empty, git no longer tracks it.

- [ ] **Step 2: Update the lazy-loading comments**

In `src/pages/GambaPage.js`, replace the comment block

```js
// Code-split the two tools that pull in the slot DB (~874KB via ../data/slots).
// SlotPicker imports it directly; BonusBattle reaches it through SlotAutocomplete.
// Both must be lazy or the data stays in the main bundle. The data now lives in
// its own chunk and only downloads when one of these tools is opened.
```

with

```js
// Code-split the heavier tools so they only download when opened. The slot
// catalogue itself is fetched from /api/slots on first use (useSlotCatalog).
```

In `src/pages/AdminGiveawaysPage.js`, replace `// The slot database is ~2 MB; only load it once a bonus is being played.` with `// Slot search pulls the slot catalogue on first use; only load it once a bonus is being played.`

- [ ] **Step 3: Update `CLAUDE.md`**

- Replace the Serverless API bullet `- \`slots.js\` — proxies slotslaunch.com with allowlisted path param (\`games|providers|types|themes\`).` with:

```
- `slots.js` — the slot catalogue for Slot Picker and `SlotAutocomplete`, re-served from communityhunts.gg `/slots` (Rainbet list, re-synced nightly): 6h in-memory cache + CDN `s-maxage` of a day, stale-on-error. The client normalizes rows in `src/utils/slotCatalog.js` (provider display names, volatility buckets, Megaways by name, unencoded thumbnails) and loads them once per session via `src/hooks/useSlotCatalog.js`.
```

- In the Gotchas third-party keys bullet, replace `Third-party API keys (communityhunts.gg, SlotsLaunch)` with `Third-party API keys (communityhunts.gg)`, and delete `` `SLOTSLAUNCH_API_KEY`, ``.

Run: `grep -nE "slotslaunch|SlotsLaunch|SLOTSLAUNCH|data/slots" CLAUDE.md`
Expected: no output.

Append to `docs/superpowers/specs/2026-09-27-slot-catalog-communityhunts-design.md`:

```markdown

## Addendum (implementation)

- **Thumbnails are decoded.** 3,701 of 7,625 live catalogue thumbnails arrive percent-encoded (`%20`). `AdminGiveawaysPage.saveSlot` calls `encodeURI(thumbnail)`, which would turn them into `%2520` and break the giveaway overlay art. So `normalizeSlot` returns `decodeThumb(row.thumb)`, the unencoded form the old static list used. A malformed escape keeps the raw string.
```

- [ ] **Step 4: Full suite and build**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS (all suites).

Run: `CI=true npx react-scripts build`
Expected: `Compiled successfully.`, with no warnings. The build output no longer has a ~874 KB slot data chunk.

- [ ] **Step 5: Live smoke against the real API**

The `.env.local` key is required.

```bash
set -a; . <(grep -E '^COMMUNITYHUNTS_' .env.local | tr -d '\r'); set +a
node --no-warnings -e '
import("./api/slots.js").then(async ({ default: handler }) => {
  const res = await new Promise((resolve) => {
    const r = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b, headers: this.headers }); return this; }, end() { resolve({ code: this.code }); } };
    handler({ method: "GET", query: {} }, r);
  });
  console.log("status", res.code, "rows", res.body.slots && res.body.slots.length, "cache-control", res.headers["Cache-Control"]);
  return res.body.slots;
});'
```

Expected: `status 200 rows ~7600 cache-control public, s-maxage=86400, stale-while-revalidate=604800`.

- [ ] **Step 6: Commit**

```bash
test "$(git branch --show-current)" = feat/slot-catalog && git add -A src/pages/GambaPage.js src/pages/AdminGiveawaysPage.js CLAUDE.md docs/superpowers/specs/2026-09-27-slot-catalog-communityhunts-design.md && git commit -m "chore(slots): drop the static slot list and slotslaunch config"
```

- [ ] **Step 7: Hand off rollout to the user (don't run these)**

1. Push `feat/slot-catalog` and open the PR (the user merges).
2. After the merge, remove `SLOTSLAUNCH_API_KEY` from Vercel.
