# CommunityHunts Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Hunt Tracker and the bonushunt.gg-backed Bonus Hunts tab with a single communityhunts.gg-powered **Hunts** tab, rewire prediction rounds to communityhunts.gg as payout-only, and delete the tracker.

**Architecture:**
- All communityhunts.gg access goes through one server module, `api/_lib/communityHunts.js`, which holds the Bean community API key.
- A cached public endpoint, `api/communityhunts.js`, feeds the browser. The admin predictions endpoint calls the module directly.
- The client gets a polling hook plus small presentational components under `src/components/hunts/`.
- Prediction UI moves from `BonusHunts.js` into the new `HuntsPage.js`.

**Tech Stack:** Create React App (React 19, react-scripts 5, Jest + Testing Library), Tailwind, Vercel serverless functions (ESM `export default handler`), Firebase (Firestore + firebase-admin).

**Spec:** [docs/superpowers/specs/2026-09-27-communityhunts-integration-design.md](../specs/2026-09-27-communityhunts-integration-design.md)

## Global Constraints

- **Key handling:** the API key lives in `COMMUNITYHUNTS_API_KEY`. It is server-only: never use a `REACT_APP_` prefix, never log it, never put it in a URL.
- **Defaults:** API base `https://api.communityhunts.gg/api/public/v1` (override `COMMUNITYHUNTS_API_URL`); owner id `usr_IT8I88O03xF3QHqHzqme95` (override `COMMUNITYHUNTS_OWNER_ID`).
- **Rate limit:** 300 reads/min, shared with beantwitch.com. The server caches for 30s and the client polls every 60s. Don't add other polling.
- **Import boundary:** client code (`src/`) must never import from `api/`, because CRA blocks imports outside `src/`. Tests under `src/` may import `api/` modules.
- **Predictions are payout-only.** No `kinds`, no `topSlot*`, no `manualSlots`, and no compatibility code for old `bonushunt` rounds.
- **Money** renders through `formatMoney(value, currency)` from `src/utils/money.js`, using the hunt's or round's `currency` when known.
- **Visual language:** `/gamba/*` is product register; read `PRODUCT.md` before UI tasks. communityhunts.gg gold is not used anywhere; its wordmark logo is the only communityhunts.gg brand element.
- **Test command:** `CI=true npx react-scripts test --watchAll=false --testPathPattern=<name>`. CRA sets `resetMocks: true`, so inside `jest.mock` factories use plain functions, or set `jest.fn` implementations inside each test.
- **Build command:** `CI=true npx react-scripts build`. With `CI=true`, ESLint warnings fail the build, so it must pass clean.
- **Commits:** conventional subjects (`feat(hunts): …`, `fix(predictions): …`, `chore(hunts): …`). **No `Co-Authored-By` trailer** (user's global rule).
- **Branch:** `feat/communityhunts` (already created from `main`; the spec is committed there).

## Review Focus

These are inputs the spec implies but no feature test naturally hits. Each has a pinned test in the task that owns the code.

1. **Potless hunt** (`pot` 0 or null): start cost and P/L show "—", never `$0.00` or `NaN`. Pinned in Task 7 (`CurrentHuntCard` potless test).
2. **Unopened bonus in a live hunt** (`win`/`multiplier` null): the bonus row shows "—" instead of `NaN`, and the multiplier bar doesn't break. Pinned in Task 7 (`BonusReel` test).
3. **Currency code Intl rejects** (e.g. `USDT`): money falls back to `USDT 1,234.00` instead of throwing and blanking the page. Pinned in Task 3 (`formatMoney` test).
4. **Upstream down with an empty cache:** the endpoint returns 502 JSON quickly, and the Hunts tab still shows the promo band and the prediction blocks. Pinned in Task 2 (handler test) and Task 8 (page test).
5. **Settling with an empty payout field:** it is blocked with "Actual payout required". The old code turned `''` into `0` and settled at zero. Fill-from-hunt on a deleted hunt shows a readable error and leaves the field alone. Pinned in Task 6 (`SettleModal` tests).

---

### Task 1: communityhunts server client

**Files:**
- Create: `api/_lib/communityHunts.js`
- Test: `src/__tests__/communityHunts.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `api/_lib/communityHunts.js`):
  - `DEFAULT_API_URL: string`, `DEFAULT_OWNER_ID: string`
  - `class CommunityHuntsError extends Error { code: string; status: number }`
  - `chGet(path: string, params?: object) → Promise<object>`: parsed JSON body; throws `CommunityHuntsError`
  - `getLiveHunt() → Promise<Hunt|null>` (full view)
  - `getRecentHunts(limit = 10) → Promise<Hunt[]>` (summary view, newest first)
  - `getHunt(id: string) → Promise<Hunt>` (full view)
  - `getCurrentHunt() → Promise<Hunt|null>` (live, else newest summary)
  - `toRoundSnapshot(hunt, now = new Date()) → { huntId, totalCost, currency, bonusCount, snapshotAt } | null`
  - `huntResult(hunt) → { payout: number, currency: string|null, status: string|null, ended: boolean }`
  - `trimHunt(hunt) → TrimmedHunt|null`: fields `id, status, huntType, currency, startedAt, endedAt, updatedAt, bonusCount, pot, totalWon, averageMultiple`, plus `bonuses[{slot, bet, win, multiplier, thumb}]` only when the input has a `bonuses` array
- `Hunt` is the communityhunts public shape. Summary: `id, owner{id,name}, status ('live'|'ended'|'archived'), huntType, currency, startedAt, endedAt, updatedAt, bonusCount, totalWon, pot, averageMultiple`. Full adds `bonuses[{slot, bet, win, multiplier, thumb}], calls[], equity[]`.
- Errors come back as `{ "error": { "code": "not_found", "message": "Hunt not found" } }`.

- [ ] **Step 1: Write the failing tests**

```js
/**
 * @jest-environment node
 */
import {
  chGet,
  getLiveHunt,
  getRecentHunts,
  getHunt,
  getCurrentHunt,
  toRoundSnapshot,
  huntResult,
  trimHunt,
  CommunityHuntsError,
  DEFAULT_API_URL,
  DEFAULT_OWNER_ID,
} from '../../api/_lib/communityHunts';

const SUMMARY = {
  id: '6f94703b792758ccd662',
  owner: { id: DEFAULT_OWNER_ID, name: 'Goofer' },
  status: 'archived',
  huntType: 'community',
  currency: 'ARS',
  startedAt: '2026-09-26T20:29:31.749Z',
  endedAt: '2026-09-26T22:19:56.312Z',
  updatedAt: '2026-09-26T22:19:56.312Z',
  bonusCount: 33,
  totalWon: 57686.03,
  pot: 76344.23,
  averageMultiple: 71.92,
};
const FULL = {
  ...SUMMARY,
  bonuses: [{ slot: 'Pug Life', bet: 0.4, win: 5.2, multiplier: 13, thumb: 'https://cdn/x.png' }],
  calls: [{ slot: 'Le Viking', user: 'Folo' }],
  equity: [{ name: 'Goofer', amount: 282.21 }],
};

function mockFetchOnce(status, body) {
  global.fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  process.env.COMMUNITYHUNTS_API_KEY = 'ch_live_test';
  delete process.env.COMMUNITYHUNTS_API_URL;
  delete process.env.COMMUNITYHUNTS_OWNER_ID;
  global.fetch = jest.fn();
});
afterEach(() => {
  delete process.env.COMMUNITYHUNTS_API_KEY;
});

test('chGet sends the bearer key and drops empty params', async () => {
  mockFetchOnce(200, { data: [] });
  await chGet('/hunts', { status: 'live', ownerId: 'usr_x', empty: '', nope: null });
  const [url, opts] = global.fetch.mock.calls[0];
  expect(url).toBe(`${DEFAULT_API_URL}/hunts?status=live&ownerId=usr_x`);
  expect(opts.headers.Authorization).toBe('Bearer ch_live_test');
});

test('chGet throws NOT_CONFIGURED (503) without a key and never calls fetch', async () => {
  delete process.env.COMMUNITYHUNTS_API_KEY;
  await expect(chGet('/me')).rejects.toMatchObject({ code: 'NOT_CONFIGURED', status: 503 });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('chGet maps an upstream error body to CommunityHuntsError', async () => {
  mockFetchOnce(404, { error: { code: 'not_found', message: 'Hunt not found' } });
  const err = await chGet('/hunts/nope').catch((e) => e);
  expect(err).toBeInstanceOf(CommunityHuntsError);
  expect(err).toMatchObject({ code: 'not_found', status: 404 });
  expect(err.message).not.toContain('ch_live_test');
});

test('chGet maps a network failure to NETWORK (502)', async () => {
  global.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
  await expect(chGet('/me')).rejects.toMatchObject({ code: 'NETWORK', status: 502 });
});

test('getLiveHunt queries the owner live hunt in full view', async () => {
  mockFetchOnce(200, { data: [FULL] });
  const hunt = await getLiveHunt();
  expect(hunt.id).toBe(FULL.id);
  expect(global.fetch.mock.calls[0][0]).toBe(
    `${DEFAULT_API_URL}/hunts?status=live&ownerId=${DEFAULT_OWNER_ID}&view=full&limit=1`
  );
});

test('getLiveHunt returns null when nothing is live', async () => {
  mockFetchOnce(200, { data: [] });
  await expect(getLiveHunt()).resolves.toBeNull();
});

test('getRecentHunts honours COMMUNITYHUNTS_OWNER_ID and limit', async () => {
  process.env.COMMUNITYHUNTS_OWNER_ID = 'usr_other';
  mockFetchOnce(200, { data: [SUMMARY] });
  const list = await getRecentHunts(5);
  expect(list).toHaveLength(1);
  expect(global.fetch.mock.calls[0][0]).toBe(
    `${DEFAULT_API_URL}/hunts?ownerId=usr_other&view=summary&limit=5`
  );
});

test('getHunt fetches one hunt by encoded id', async () => {
  mockFetchOnce(200, { data: FULL });
  const hunt = await getHunt('abc_123');
  expect(hunt.bonuses).toHaveLength(1);
  expect(global.fetch.mock.calls[0][0]).toBe(`${DEFAULT_API_URL}/hunts/abc_123`);
});

test('getCurrentHunt prefers the live hunt, else the newest summary', async () => {
  mockFetchOnce(200, { data: [] });
  mockFetchOnce(200, { data: [SUMMARY] });
  await expect(getCurrentHunt()).resolves.toMatchObject({ id: SUMMARY.id });

  mockFetchOnce(200, { data: [] });
  mockFetchOnce(200, { data: [] });
  await expect(getCurrentHunt()).resolves.toBeNull();
});

test('toRoundSnapshot maps pot/currency/bonusCount', () => {
  const now = new Date('2026-09-27T10:00:00.000Z');
  expect(toRoundSnapshot(SUMMARY, now)).toEqual({
    huntId: SUMMARY.id,
    totalCost: 76344.23,
    currency: 'ARS',
    bonusCount: 33,
    snapshotAt: '2026-09-27T10:00:00.000Z',
  });
  expect(toRoundSnapshot(null)).toBeNull();
  expect(toRoundSnapshot({ id: 'x', pot: null }, now).totalCost).toBe(0);
});

test('huntResult flags live hunts as not ended and rounds the payout', () => {
  expect(huntResult({ ...SUMMARY, status: 'live', totalWon: 10.005 })).toEqual({
    payout: 10.01,
    currency: 'ARS',
    status: 'live',
    ended: false,
  });
  expect(huntResult(SUMMARY).ended).toBe(true);
  expect(huntResult({ ...SUMMARY, status: 'ended' }).ended).toBe(true);
});

test('trimHunt drops calls/equity and keeps bonuses only when present', () => {
  const full = trimHunt(FULL);
  expect(full).not.toHaveProperty('calls');
  expect(full).not.toHaveProperty('equity');
  expect(full).not.toHaveProperty('owner');
  expect(full.bonuses).toEqual(FULL.bonuses);
  expect(trimHunt(SUMMARY)).not.toHaveProperty('bonuses');
  expect(trimHunt(SUMMARY).totalWon).toBe(57686.03);
  expect(trimHunt(null)).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=communityHunts.test`
Expected: FAIL with `Cannot find module '../../api/_lib/communityHunts'`.

- [ ] **Step 3: Write the implementation**

```js
// Server-side client for the communityhunts.gg public API. The ONLY module in
// this repo that talks to communityhunts.gg; everything else calls these
// helpers. The key is the Bean community key (read scope) and must stay
// server-side: never log it, never put it in a URL.
//
// Config is read per call (not at module load) so tests and env changes work.

export const DEFAULT_API_URL = 'https://api.communityhunts.gg/api/public/v1';
// GooferG ("Goofer") in the Bean community.
export const DEFAULT_OWNER_ID = 'usr_IT8I88O03xF3QHqHzqme95';

const TIMEOUT_MS = 8000;

export class CommunityHuntsError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.name = 'CommunityHuntsError';
    this.code = code;
    this.status = status;
  }
}

function config() {
  return {
    key: process.env.COMMUNITYHUNTS_API_KEY || '',
    base: (process.env.COMMUNITYHUNTS_API_URL || DEFAULT_API_URL).replace(/\/+$/, ''),
    ownerId: process.env.COMMUNITYHUNTS_OWNER_ID || DEFAULT_OWNER_ID,
  };
}

export async function chGet(path, params = {}) {
  const { key, base } = config();
  if (!key) {
    throw new CommunityHuntsError('NOT_CONFIGURED', 503, 'COMMUNITYHUNTS_API_KEY is not set');
  }
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString();
  const url = `${base}${path}${qs ? `?${qs}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    throw new CommunityHuntsError(
      timedOut ? 'TIMEOUT' : 'NETWORK',
      timedOut ? 504 : 502,
      timedOut ? 'communityhunts.gg timed out' : 'communityhunts.gg unreachable'
    );
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const code = (body && body.error && body.error.code) || `HTTP_${res.status}`;
    const message = (body && body.error && body.error.message) || `communityhunts.gg ${res.status}`;
    throw new CommunityHuntsError(code, res.status, message);
  }
  return body;
}

export async function getLiveHunt() {
  const { ownerId } = config();
  const body = await chGet('/hunts', { status: 'live', ownerId, view: 'full', limit: 1 });
  return (body && Array.isArray(body.data) && body.data[0]) || null;
}

export async function getRecentHunts(limit = 10) {
  const { ownerId } = config();
  const body = await chGet('/hunts', { ownerId, view: 'summary', limit });
  return body && Array.isArray(body.data) ? body.data : [];
}

export async function getHunt(id) {
  const body = await chGet(`/hunts/${encodeURIComponent(id)}`);
  return body ? body.data : null;
}

// The hunt a new prediction round should snapshot: the live one, else the
// newest. Summary fields are enough for toRoundSnapshot.
export async function getCurrentHunt() {
  const live = await getLiveHunt();
  if (live) return live;
  const [latest] = await getRecentHunts(1);
  return latest || null;
}

const round2 = (n) => Math.round(n * 100) / 100;

export function toRoundSnapshot(hunt, now = new Date()) {
  if (!hunt) return null;
  return {
    huntId: hunt.id ?? null,
    totalCost: Number(hunt.pot) || 0,
    currency: hunt.currency ?? null,
    bonusCount: Number(hunt.bonusCount) || 0,
    snapshotAt: now.toISOString(),
  };
}

export function huntResult(hunt) {
  return {
    payout: round2(Number(hunt && hunt.totalWon) || 0),
    currency: (hunt && hunt.currency) ?? null,
    status: (hunt && hunt.status) ?? null,
    ended: !hunt || hunt.status !== 'live',
  };
}

const HUNT_FIELDS = [
  'id',
  'status',
  'huntType',
  'currency',
  'startedAt',
  'endedAt',
  'updatedAt',
  'bonusCount',
  'pot',
  'totalWon',
  'averageMultiple',
];

// Only what the Hunts tab renders. calls/equity (viewer names) and owner are
// dropped; bonuses are kept only when the source hunt is a full view.
export function trimHunt(hunt) {
  if (!hunt) return null;
  const out = {};
  for (const f of HUNT_FIELDS) out[f] = hunt[f] ?? null;
  if (Array.isArray(hunt.bonuses)) {
    out.bonuses = hunt.bonuses.map((b) => ({
      slot: b.slot ?? null,
      bet: b.bet ?? null,
      win: b.win ?? null,
      multiplier: b.multiplier ?? null,
      thumb: b.thumb ?? null,
    }));
  }
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=communityHunts.test`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/communityHunts.js src/__tests__/communityHunts.test.js
git commit -m "feat(hunts): communityhunts.gg server client"
```

---

### Task 2: Public `/api/communityhunts` endpoint + dev mirror

**Files:**
- Create: `api/communityhunts.js`
- Modify: `src/setupProxy.js` (add a dev mirror)
- Modify: `.env.example` (add the communityhunts vars)
- Test: `src/__tests__/communityhuntsApi.test.js`

**Interfaces:**
- Consumes (Task 1): `getLiveHunt`, `getRecentHunts`, `getHunt`, `trimHunt`, `CommunityHuntsError`.
- Produces: `GET /api/communityhunts?view=overview` → `200 { live: TrimmedHunt|null, recent: TrimmedHunt[] }`. `GET /api/communityhunts?view=hunt&id=<id>` → `200 { hunt: TrimmedHunt }`.
  - Errors: `400 { error: 'INVALID_VIEW' | 'INVALID_ID' }`, `503 { error: 'NOT_CONFIGURED' }`, `404 { error: 'NOT_FOUND' }`, `502 { error: 'UPSTREAM_UNAVAILABLE' }`.
  - Named export `__resetCacheForTests()`.

- [ ] **Step 1: Write the failing tests**

```js
/**
 * @jest-environment node
 */
import handler, { __resetCacheForTests } from '../../api/communityhunts';

const LIVE = {
  id: 'live1', status: 'live', huntType: 'solo', currency: 'CAD', bonusCount: 2, pot: 100, totalWon: 40,
  bonuses: [{ slot: 'A', bet: 1, win: null, multiplier: null, thumb: null }],
  calls: [{ user: 'x' }], equity: [{ name: 'y' }], owner: { id: 'usr', name: 'Goofer' },
};
const SUMMARY = { id: 'old1', status: 'archived', huntType: 'community', currency: 'ARS', bonusCount: 33, pot: 76344.23, totalWon: 57686.03 };

function mockRes() {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}
const req = (query, method = 'GET') => ({ method, query });
const upstream = (status, body) => ({ ok: status < 300, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  __resetCacheForTests();
  process.env.COMMUNITYHUNTS_API_KEY = 'ch_live_test';
  global.fetch = jest.fn();
});
afterEach(() => {
  delete process.env.COMMUNITYHUNTS_API_KEY;
});

test('rejects unknown views and bad ids with 400', async () => {
  const r1 = mockRes();
  await handler(req({ view: 'me' }), r1);
  expect(r1.statusCode).toBe(400);
  expect(r1.body).toEqual({ error: 'INVALID_VIEW' });

  const r2 = mockRes();
  await handler(req({ view: 'hunt', id: '../me' }), r2);
  expect(r2.statusCode).toBe(400);
  expect(r2.body).toEqual({ error: 'INVALID_ID' });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('returns 503 when the key is unset', async () => {
  delete process.env.COMMUNITYHUNTS_API_KEY;
  const res = mockRes();
  await handler(req({ view: 'overview' }), res);
  expect(res.statusCode).toBe(503);
  expect(res.body).toEqual({ error: 'NOT_CONFIGURED' });
});

test('overview returns trimmed live + recent and caches for 30s', async () => {
  global.fetch
    .mockResolvedValueOnce(upstream(200, { data: [LIVE] }))
    .mockResolvedValueOnce(upstream(200, { data: [SUMMARY] }));
  const res = mockRes();
  await handler(req({ view: 'overview' }), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.live.id).toBe('live1');
  expect(res.body.live).not.toHaveProperty('calls');
  expect(res.body.live).not.toHaveProperty('equity');
  expect(res.body.live.bonuses).toHaveLength(1);
  expect(res.body.recent[0].id).toBe('old1');
  expect(res.headers['Cache-Control']).toBe('public, s-maxage=30, stale-while-revalidate=60');

  const again = mockRes();
  await handler(req({ view: 'overview' }), again);
  expect(again.headers['X-Cache']).toBe('HIT');
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('hunt view returns one trimmed hunt; upstream 404 becomes 404', async () => {
  global.fetch.mockResolvedValueOnce(upstream(200, { data: LIVE }));
  const ok = mockRes();
  await handler(req({ view: 'hunt', id: 'live1' }), ok);
  expect(ok.body.hunt.id).toBe('live1');

  global.fetch.mockResolvedValueOnce(upstream(404, { error: { code: 'not_found' } }));
  const missing = mockRes();
  await handler(req({ view: 'hunt', id: 'gone' }), missing);
  expect(missing.statusCode).toBe(404);
  expect(missing.body).toEqual({ error: 'NOT_FOUND' });
});

// Review Focus 4: upstream down with an empty cache → fast 502 JSON.
test('upstream failure with no cache returns 502', async () => {
  global.fetch.mockResolvedValue(upstream(429, { error: { code: 'rate_limited' } }));
  const res = mockRes();
  await handler(req({ view: 'overview' }), res);
  expect(res.statusCode).toBe(502);
  expect(res.body).toEqual({ error: 'UPSTREAM_UNAVAILABLE' });
});

test('serves the last good response when upstream fails after expiry', async () => {
  const realNow = Date.now;
  global.fetch
    .mockResolvedValueOnce(upstream(200, { data: [] }))
    .mockResolvedValueOnce(upstream(200, { data: [SUMMARY] }));
  await handler(req({ view: 'overview' }), mockRes());

  Date.now = () => realNow() + 31 * 1000;
  try {
    global.fetch.mockRejectedValue(new TypeError('fetch failed'));
    const res = mockRes();
    await handler(req({ view: 'overview' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['X-Cache']).toBe('STALE');
    expect(res.body.recent[0].id).toBe('old1');
  } finally {
    Date.now = realNow;
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=communityhuntsApi`
Expected: FAIL with `Cannot find module '../../api/communityhunts'`.

- [ ] **Step 3: Write the endpoint**

```js
import {
  getLiveHunt,
  getRecentHunts,
  getHunt,
  trimHunt,
  CommunityHuntsError,
} from './_lib/communityHunts.js';

// Public read endpoint behind the Hunts tab. The browser never talks to
// communityhunts.gg directly: this keeps the key server-side and, with a 30s
// cache plus CDN s-maxage, keeps us well under the Bean community's shared
// 300 reads/min.
//
// GET ?view=overview        -> { live, recent }
// GET ?view=hunt&id=<id>    -> { hunt }

const CACHE_TTL_MS = 30 * 1000;
const CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=60';
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// key -> { data, expiresAt }. Expired entries stay as the stale fallback.
const cache = new Map();

export function __resetCacheForTests() {
  cache.clear();
}

async function load(view, id) {
  if (view === 'overview') {
    const [live, recent] = await Promise.all([getLiveHunt(), getRecentHunts(10)]);
    return { live: trimHunt(live), recent: recent.map(trimHunt) };
  }
  return { hunt: trimHunt(await getHunt(id)) };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const view = req.query && req.query.view;
  const id = req.query && req.query.id;
  if (view !== 'overview' && view !== 'hunt') {
    return res.status(400).json({ error: 'INVALID_VIEW' });
  }
  if (view === 'hunt' && !ID_RE.test(String(id || ''))) {
    return res.status(400).json({ error: 'INVALID_ID' });
  }
  if (!process.env.COMMUNITYHUNTS_API_KEY) {
    console.error('communityhunts: COMMUNITYHUNTS_API_KEY is not set.');
    return res.status(503).json({ error: 'NOT_CONFIGURED' });
  }

  const key = view === 'hunt' ? `hunt:${id}` : 'overview';
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json(cached.data);
  }

  try {
    const data = await load(view, id);
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json(data);
  } catch (err) {
    if (err instanceof CommunityHuntsError && err.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cached.data);
    }
    console.error('communityhunts proxy error:', (err && err.code) || (err && err.message));
    return res.status(502).json({ error: 'UPSTREAM_UNAVAILABLE' });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=communityhuntsApi`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the dev mirror to `src/setupProxy.js`**

Under `npm start`, Vercel functions don't run. The `api/` files are ESM and setupProxy is CommonJS, so the mirror duplicates the small fetch logic, like the other mirrors do. It returns untrimmed shapes, and the client only reads fields that exist in both.

Add these constants below the `SLOTS_ORIGIN` line:

```js
// communityhunts.gg dev mirror (see api/communityhunts.js). Reads the same
// server-only COMMUNITYHUNTS_* vars from .env.local.
const CH_BASE = (
  process.env.COMMUNITYHUNTS_API_URL || 'https://api.communityhunts.gg/api/public/v1'
).replace(/\/+$/, '');
const CH_OWNER = process.env.COMMUNITYHUNTS_OWNER_ID || 'usr_IT8I88O03xF3QHqHzqme95';

async function chDevGet(path) {
  const upstream = await fetch(`${CH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.COMMUNITYHUNTS_API_KEY || ''}` },
  });
  if (!upstream.ok) {
    const err = new Error(`communityhunts ${upstream.status}`);
    err.status = upstream.status;
    throw err;
  }
  return upstream.json();
}
```

Inside `module.exports = function (app) {`, add this handler before the `/api/leaderboard` handler:

```js
  // Dev handler for /api/communityhunts (mirrors the Vercel function).
  app.get('/api/communityhunts', async (req, res) => {
    const { view, id } = req.query;
    try {
      if (view === 'overview') {
        const [live, recent] = await Promise.all([
          chDevGet(`/hunts?status=live&ownerId=${CH_OWNER}&view=full&limit=1`),
          chDevGet(`/hunts?ownerId=${CH_OWNER}&view=summary&limit=10`),
        ]);
        return res.status(200).json({ live: live.data[0] || null, recent: recent.data });
      }
      if (view === 'hunt' && /^[A-Za-z0-9_-]{1,64}$/.test(String(id || ''))) {
        const hunt = await chDevGet(`/hunts/${id}`);
        return res.status(200).json({ hunt: hunt.data });
      }
      return res.status(400).json({ error: 'INVALID_VIEW' });
    } catch (e) {
      return res
        .status(e.status === 404 ? 404 : 502)
        .json({ error: e.status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE' });
    }
  });
```

- [ ] **Step 6: Add the vars to `.env.example`**

Directly below the `BONUSHUNT_API_KEY=...` line (Task 8 deletes that line), add:

```
COMMUNITYHUNTS_API_KEY=ch_live_your_key        # api/_lib/communityHunts.js — Bean community key, read scope
# COMMUNITYHUNTS_OWNER_ID=usr_IT8I88O03xF3QHqHzqme95   # optional: whose hunts to show (default GooferG)
# COMMUNITYHUNTS_API_URL=https://api.communityhunts.gg/api/public/v1   # optional
```

- [ ] **Step 7: Commit**

```bash
git add api/communityhunts.js src/__tests__/communityhuntsApi.test.js src/setupProxy.js .env.example
git commit -m "feat(hunts): cached /api/communityhunts endpoint and dev mirror"
```

---

### Task 3: Money + prediction-round helpers

**Files:**
- Create: `src/utils/money.js`
- Create: `src/utils/predictionRound.js`
- Test: `src/utils/__tests__/money.test.js`

**Interfaces:**
- Produces:
  - `formatMoney(value, currency = null, { decimals = 2 } = {}) → string`: `'—'` for null, empty or non-finite values. With a currency it uses Intl (`'CA$1,318.80'`); if Intl rejects the code it falls back to `'<CODE> 1,318.80'`. Without a currency it gives `'$1,318.80'`, and `'-$5.00'` for negatives.
  - `formatMoneyCompact(value, currency = null) → string`: e.g. `'$1.2k'` / `'$950'` without a currency (matches the old NumberLine format); `Intl` compact notation with a currency.
  - `roundCurrency(round) → string|null`: `round.bonusHuntSnapshot.currency` for `source === 'communityhunts'`, otherwise `null`.
  - `roundTotalCost(round) → number`: the snapshot `totalCost` for communityhunts rounds, `manualTotalCost` otherwise, `0` when missing.

- [ ] **Step 1: Write the failing tests**

```js
import { formatMoney, formatMoneyCompact } from '../money';
import { roundCurrency, roundTotalCost } from '../predictionRound';

test('formatMoney without currency keeps the site $ format', () => {
  expect(formatMoney(1318.8)).toBe('$1,318.80');
  expect(formatMoney(-5)).toBe('-$5.00');
  expect(formatMoney(1234.4, null, { decimals: 0 })).toBe('$1,234');
});

test('formatMoney with a currency uses Intl', () => {
  expect(formatMoney(1318.8, 'CAD')).toBe('CA$1,318.80');
  expect(formatMoney(76344.23, 'ARS')).toMatch(/ARS\s?76,344\.23/);
});

test('formatMoney returns an em dash for missing values', () => {
  expect(formatMoney(null)).toBe('—');
  expect(formatMoney(undefined, 'CAD')).toBe('—');
  expect(formatMoney('')).toBe('—');
  expect(formatMoney('abc')).toBe('—');
});

// Review Focus 3: a code Intl rejects must not throw.
test('formatMoney falls back when Intl rejects the currency code', () => {
  expect(formatMoney(1234, 'USDT')).toBe('USDT 1,234.00');
});

test('formatMoneyCompact matches the old number-line format without currency', () => {
  expect(formatMoneyCompact(1234)).toBe('$1.2k');
  expect(formatMoneyCompact(950)).toBe('$950');
  expect(formatMoneyCompact(null)).toBe('—');
  expect(formatMoneyCompact(76344, 'ARS')).toMatch(/ARS\s?76\.3K/);
});

test('roundCurrency / roundTotalCost read the right source', () => {
  const ch = { source: 'communityhunts', bonusHuntSnapshot: { currency: 'CAD', totalCost: 3103.62 } };
  const manual = { source: 'manual', manualTotalCost: 500 };
  expect(roundCurrency(ch)).toBe('CAD');
  expect(roundTotalCost(ch)).toBe(3103.62);
  expect(roundCurrency(manual)).toBeNull();
  expect(roundTotalCost(manual)).toBe(500);
  expect(roundTotalCost(null)).toBe(0);
  expect(roundTotalCost({ source: 'manual', manualTotalCost: null })).toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=money.test`
Expected: FAIL with `Cannot find module '../money'`.

- [ ] **Step 3: Write `src/utils/money.js`**

```js
// Money formatting shared by predictions and the Hunts tab. communityhunts
// hunts carry their own currency (ARS, CAD, …); with a code we use Intl,
// without one we keep the site's historical "$1,234.00" format.

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(value, currency = null, { decimals = 2 } = {}) {
  const n = toNumber(value);
  if (n == null) return '—';
  const digits = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  if (currency) {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, ...digits }).format(n);
    } catch {
      return `${currency} ${n.toLocaleString('en-US', digits)}`;
    }
  }
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', digits)}`;
}

export function formatMoneyCompact(value, currency = null) {
  const n = toNumber(value);
  if (n == null) return '—';
  if (currency) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(n);
    } catch {
      return `${currency} ${Math.round(n)}`;
    }
  }
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 100) / 10}k`;
  return `$${Math.round(n)}`;
}
```

- [ ] **Step 4: Write `src/utils/predictionRound.js`**

```js
// Read helpers for prediction round docs (Firestore hunts/{id}). A round's
// money context comes from its communityhunts snapshot, or from the manual
// start cost the admin typed.

export function roundCurrency(round) {
  if (!round || round.source !== 'communityhunts') return null;
  return (round.bonusHuntSnapshot && round.bonusHuntSnapshot.currency) || null;
}

export function roundTotalCost(round) {
  if (!round) return 0;
  const raw =
    round.source === 'communityhunts'
      ? round.bonusHuntSnapshot && round.bonusHuntSnapshot.totalCost
      : round.manualTotalCost;
  return Number(raw) || 0;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=money.test`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/utils/money.js src/utils/predictionRound.js src/utils/__tests__/money.test.js
git commit -m "feat(predictions): currency-aware money and round helpers"
```

---

### Task 4: Predictions server — communityhunts snapshot, payout-only

**Files:**
- Create: `api/_lib/predictions.js`
- Modify: `api/admin/hunts.js`
- Modify: `api/predictions/submit.js`
- Modify: `api/admin/users.js:116`
- Test: `src/__tests__/predictions.test.js`

**Interfaces:**
- Consumes (Task 1): `getCurrentHunt`, `getHunt`, `toRoundSnapshot`, `huntResult`, `CommunityHuntsError`.
- Produces:
  - `pickWinners(entries, round) → Array<Entry & { payoutDiff: number } | null>`, one slot per `round.rewards.tiers` place, sorted by place.
  - **Admin actions (`POST /api/admin/hunts`):**
    - `preview_hunt` → `{ ok, snapshot }`
    - `create { title, contextNote, acceptPredictions, acceptSuggestions, suggestionCap, source: 'communityhunts'|'manual', manualTotalCost, rewards }` → `{ ok, id }`
    - **new** `hunt_result { id }` → `{ ok, result: { payout, currency, status, ended } }`
    - `settle { id, actualPayout }` → `{ ok, winners }`
  - **Errors:** `400 NO_CURRENT_HUNT`, `400 NOT_COMMUNITYHUNTS_ROUND`, `404 HUNT_NOT_FOUND`, `502 COMMUNITYHUNTS_UNAVAILABLE` (with `detail: <code>`).
  - **Round doc:** `source: 'communityhunts'|'manual'`, `bonusHuntSnapshot: { huntId, totalCost, currency, bonusCount, snapshotAt }|null`, `manualTotalCost: number|null`, `actual: { payout }`. It no longer has `kinds` or `manualSlots`.
  - **Entries and winners:** no `topSlotGuess` or `topSlotMatch`.

- [ ] **Step 1: Write the failing tests for `pickWinners`**

```js
import { pickWinners } from '../../api/_lib/predictions';

const ts = (ms) => ({ toMillis: () => ms });
const round = (payout, places = [1, 2]) => ({
  actual: { payout },
  rewards: { tiers: places.map((place) => ({ place })) },
});

test('closest payout guess wins, in tier order', () => {
  const entries = [
    { twitchId: 'a', payoutGuess: 900, submittedAt: ts(1) },
    { twitchId: 'b', payoutGuess: 1010, submittedAt: ts(2) },
    { twitchId: 'c', payoutGuess: 2000, submittedAt: ts(3) },
  ];
  const [first, second] = pickWinners(entries, round(1000));
  expect(first.twitchId).toBe('b');
  expect(first.payoutDiff).toBe(10);
  expect(second.twitchId).toBe('a');
});

test('a tie goes to the earlier submission', () => {
  const entries = [
    { twitchId: 'late', payoutGuess: 1100, submittedAt: ts(20) },
    { twitchId: 'early', payoutGuess: 900, submittedAt: ts(10) },
  ];
  expect(pickWinners(entries, round(1000))[0].twitchId).toBe('early');
});

test('entries without a numeric guess are excluded; short lists pad with null', () => {
  const entries = [
    { twitchId: 'x', payoutGuess: null, submittedAt: ts(1) },
    { twitchId: 'y', payoutGuess: 50, submittedAt: ts(2) },
  ];
  const result = pickWinners(entries, round(100, [1, 2, 3]));
  expect(result).toHaveLength(3);
  expect(result[0].twitchId).toBe('y');
  expect(result[1]).toBeNull();
  expect(result[2]).toBeNull();
});

test('no actual payout means no winners', () => {
  const entries = [{ twitchId: 'a', payoutGuess: 1, submittedAt: ts(1) }];
  expect(pickWinners(entries, { actual: {}, rewards: { tiers: [{ place: 1 }] } })).toEqual([null]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=predictions.test`
Expected: FAIL with `Cannot find module '../../api/_lib/predictions'`.

- [ ] **Step 3: Write `api/_lib/predictions.js`**

```js
// Payout-only winner picking for prediction rounds. Pure (no firebase-admin)
// so it can be unit tested. Rules match the previous payout path: closest
// guess to the actual payout wins, a tie goes to the earlier submission,
// entries without a numeric guess are ignored, one slot per reward tier.

function submittedMs(entry) {
  return entry.submittedAt && entry.submittedAt.toMillis ? entry.submittedAt.toMillis() : 0;
}

export function pickWinners(entries, round) {
  const tierPlaces = ((round && round.rewards && round.rewards.tiers) || [])
    .map((t) => t.place)
    .sort((a, b) => a - b);
  const actual = round && round.actual && round.actual.payout;
  if (typeof actual !== 'number' || !Number.isFinite(actual)) {
    return tierPlaces.map(() => null);
  }
  const ranked = entries
    .filter((e) => typeof e.payoutGuess === 'number' && Number.isFinite(e.payoutGuess))
    .map((e) => ({ ...e, payoutDiff: Math.abs(e.payoutGuess - actual) }))
    .sort((a, b) => a.payoutDiff - b.payoutDiff || submittedMs(a) - submittedMs(b));
  return tierPlaces.map((_, i) => ranked[i] || null);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=predictions.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewire `api/admin/hunts.js`**

5a. **Imports.** Replace the top-of-file block (the imports, header comment, `BONUSHUNT_API`, `BONUSHUNT_KEY`, and the whole `fetchCurrentHunt` and `snapshotHunt` functions, currently lines 1–43) with:

```js
import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';
import {
  getCurrentHunt,
  getHunt,
  toRoundSnapshot,
  huntResult,
  CommunityHuntsError,
} from '../_lib/communityHunts.js';
import { pickWinners } from '../_lib/predictions.js';

// Admin prediction-round lifecycle. A round can have payout predictions and/or
// slot suggestions enabled. Predictions go open -> locked -> settled. Rounds
// snapshot GooferG's current communityhunts.gg hunt (or take a manual cost).
//
// POST { action, ...payload }
```

5b. **Delete** the local `function pickWinners(entries, round) { … }` (currently lines 74–131, directly after `sanitizeRewards`). It now lives in `api/_lib/predictions.js`.

5c. **`preview_hunt`.** Replace the action body:

```js
    if (action === 'preview_hunt') {
      const hunt = await getCurrentHunt();
      if (!hunt) return res.status(404).json({ error: 'NO_CURRENT_HUNT' });
      return res.status(200).json({ ok: true, snapshot: toRoundSnapshot(hunt) });
    }
```

5d. **`create`.** Inside `if (action === 'create') {`, replace everything from `const acceptPredictions = …` through the end of the `if (source === 'bonushunt') { … } else { … }` block with:

```js
      const acceptPredictions = payload.acceptPredictions !== false;
      const acceptSuggestions = !!payload.acceptSuggestions;
      if (!acceptPredictions && !acceptSuggestions) {
        return res.status(400).json({ error: 'enable predictions or suggestions' });
      }

      const suggestionCapRaw = Number(payload.suggestionCap);
      const suggestionCap = acceptSuggestions
        ? (Number.isInteger(suggestionCapRaw) && suggestionCapRaw >= 1
            ? Math.min(20, suggestionCapRaw)
            : 3)
        : 0;

      const source = payload.source === 'manual' ? 'manual' : 'communityhunts';
      let bonusHuntSnapshot = null;
      let manualTotalCost = null;

      if (source === 'communityhunts') {
        const hunt = await getCurrentHunt();
        if (!hunt) return res.status(400).json({ error: 'NO_CURRENT_HUNT' });
        bonusHuntSnapshot = toRoundSnapshot(hunt);
      } else {
        manualTotalCost =
          payload.manualTotalCost === '' || payload.manualTotalCost == null
            ? null
            : Number(payload.manualTotalCost);
      }
```

In the `adminDb.collection('hunts').add({ … })` object that follows, delete the `manualSlots,` line (under `// Source data`) and the `kinds,` line (under `// Prediction config`). Keep `rewards,`.

5e. **New `hunt_result` action.** Insert it directly after `const round = snap.data();` and before `if (action === 'lock')`:

```js
    if (action === 'hunt_result') {
      const huntId = round.bonusHuntSnapshot && round.bonusHuntSnapshot.huntId;
      if (round.source !== 'communityhunts' || !huntId) {
        return res.status(400).json({ error: 'NOT_COMMUNITYHUNTS_ROUND' });
      }
      const hunt = await getHunt(huntId);
      return res.status(200).json({ ok: true, result: huntResult(hunt) });
    }
```

5f. **`settle`.** Replace the block from `const actualPayout = round.kinds.payout ? …` through `const placements = pickWinners(entries, updatedRound);` with:

```js
      const actualPayout = Number(payload.actualPayout);
      if (payload.actualPayout === '' || payload.actualPayout == null || !Number.isFinite(actualPayout)) {
        return res.status(400).json({ error: 'actualPayout required' });
      }

      const entriesSnap = await ref.collection('entries').get();
      const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const placements = pickWinners(entries, { ...round, actual: { payout: actualPayout } });
```

In the `winnerObj` literal, delete the `topSlotGuess: e.topSlotGuess || null,` and `topSlotMatch: e.topSlotMatch === true,` lines.

In the final `batch.update(ref, { … })`, change `actual: { payout: actualPayout, topSlotName: actualTopSlot },` to `actual: { payout: actualPayout },`.

5g. **Error mapping.** In the outer `catch (err) {` at the bottom of the handler, insert as the first statements:

```js
    if (err instanceof CommunityHuntsError) {
      const notFound = err.status === 404;
      return res
        .status(notFound ? 404 : 502)
        .json({ error: notFound ? 'HUNT_NOT_FOUND' : 'COMMUNITYHUNTS_UNAVAILABLE', detail: err.code });
    }
```

5h. **Verify nothing stale remains:**

Run: `grep -nE "kinds|topSlot|manualSlots|bonushunt|BONUSHUNT|actualTopSlot" api/admin/hunts.js`
Expected: no output.

- [ ] **Step 6: Make `api/predictions/submit.js` payout-only**

Replace `const { roundId, payoutGuess, topSlotGuess } = req.body || {};` with:

```js
  const { roundId, payoutGuess } = req.body || {};
```

Replace the block from `const { kinds } = round;` through the end of the `if (kinds.topSlot) { … }` block with:

```js
      const n = Number(payoutGuess);
      if (!Number.isFinite(n) || n < 0) throw new Error('INVALID_PAYOUT');
      const normalizedPayout = Math.round(n * 100) / 100; // 2-decimal precision
```

Delete both `topSlotGuess: normalizedSlot,` lines (in `tx.update` and `tx.set`). In the `catch`, delete the `INVALID_SLOT` and `SLOT_NOT_IN_LIST` lines.

Run: `grep -nE "topSlot|kinds|normalizedSlot|SLOT" api/predictions/submit.js`
Expected: no output.

- [ ] **Step 7: Drop `topSlotGuess` from `api/admin/users.js`**

Delete line 116: `        topSlotGuess: data.topSlotGuess ?? null,`

- [ ] **Step 8: Run the full suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS. Nothing imported the deleted local `pickWinners`.

- [ ] **Step 9: Commit**

```bash
git add api/_lib/predictions.js api/admin/hunts.js api/predictions/submit.js api/admin/users.js src/__tests__/predictions.test.js
git commit -m "feat(predictions): snapshot communityhunts hunts, payout-only rounds"
```

---

### Task 5: Prediction viewer UI — fix entry path, payout-only, currency

**Files:**
- Modify: `src/components/PredictionSlip.js`
- Modify: `src/components/PredictionWall.js`
- Modify: `src/components/PredictionNumberLine.js`
- Modify: `src/components/PredictionWinnersReveal.js`
- Modify: `src/pages/AdminUsersPage.js:302-304`
- Test: `src/components/__tests__/PredictionSlip.test.js`

**Background:** the server writes entries to `hunts/{roundId}/entries`, but these three components read `prediction_rounds/{roundId}/entries`. That legacy collection has no Firestore rule, so reads are denied and viewers never see their own slip, the wall or the number line. This task fixes the path.

**Interfaces:**
- Consumes (Task 3): `formatMoney`, `formatMoneyCompact`, `roundCurrency`, `roundTotalCost`. Consumes (Task 4): the round doc shape without `kinds`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

```js
import { render, screen } from '@testing-library/react';
import PredictionSlip from '../PredictionSlip';
import { doc } from 'firebase/firestore';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  onSnapshot: () => () => {},
}));
jest.mock('../../contexts/TwitchAuthContext', () => ({
  useTwitchAuth: () => ({ twitchUser: { twitchId: 'viewer1' }, loginWithTwitch: () => {} }),
}));
jest.mock('../../utils/authedFetch', () => ({ authedFetch: () => Promise.resolve({ ok: true, json: () => ({}) }) }));

const ROUND = {
  id: 'round1',
  title: 'Sunday hunt',
  status: 'open',
  acceptPredictions: true,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h1', totalCost: 3103.62, currency: 'CAD', bonusCount: 18 },
};

// Regression: entries live under hunts/{id}/entries, not prediction_rounds.
test('subscribes to the viewer entry under hunts/{id}/entries', () => {
  doc.mockReturnValue({});
  render(<PredictionSlip round={ROUND} />);
  expect(doc).toHaveBeenCalledWith({}, 'hunts', 'round1', 'entries', 'viewer1');
});

test('payout-only slip shows cost in the hunt currency and no top-slot picker', () => {
  doc.mockReturnValue({});
  render(<PredictionSlip round={ROUND} />);
  expect(screen.getByText(/Final payout guess/i)).toBeTruthy();
  expect(screen.getByText(/Cost CA\$3,103\.62/)).toBeTruthy();
  expect(screen.queryByText(/Top slot pick/i)).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=PredictionSlip`
Expected: FAIL. `doc` was called with `'prediction_rounds'`, and the cost renders as `$3,103.62` or not at all, because `kinds` is undefined and the payout block is hidden.

- [ ] **Step 3: Edit `src/components/PredictionSlip.js`**

3a. **Imports.** Replace line 1 `import { useEffect, useMemo, useState } from 'react';` with `import { useEffect, useState } from 'react';`. After the `authedFetch` import, add:

```js
import { formatMoney } from '../utils/money';
import { roundCurrency, roundTotalCost } from '../utils/predictionRound';
```

3b. **Delete** the local `function formatCurrency(val) { … }` (lines 8–11) and the whole `function SlotTile({ slot, selected, onSelect, disabled }) { … }` component (lines 42–81).

3c. **State.** In the component body, delete `const [slotInput, setSlotInput] = useState('');`.

3d. **Totals.** Replace both `useMemo` blocks (`const slots = useMemo(…)` and `const totalCost = useMemo(…)`) with:

```js
  const currency = roundCurrency(round);
  const totalCost = roundTotalCost(round);
```

3e. **Entry subscription.** Replace the whole viewer-entry `useEffect` with:

```js
  // Subscribe to the viewer's own entry.
  useEffect(() => {
    if (!twitchUser?.twitchId || !round?.id) {
      setEntry(null);
      return undefined;
    }
    const ref = doc(db, 'hunts', round.id, 'entries', twitchUser.twitchId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setEntry(data);
      if (data) {
        if (data.payoutGuess != null) setPayoutInput(String(data.payoutGuess));
        if (data.lastEditAt?.toMillis) {
          const next = data.lastEditAt.toMillis() + 30 * 1000;
          if (next > Date.now()) setCooldownUntil(next);
        }
      }
    });
    return unsub;
  }, [twitchUser?.twitchId, round?.id]);
```

3f. **Submit body.** In `submit`, replace the three `body` lines with:

```js
      const body = { roundId: round.id, payoutGuess: Number(payoutInput) };
```

In the error-message map, delete the `INVALID_SLOT:` and `SLOT_NOT_IN_LIST:` entries.

3g. **Render.**
- Delete the whole `{/* Top slot tiles */}` block (`{round?.kinds?.topSlot && ( … )}`).
- Replace the payout block's opening `{round?.kinds?.payout && (` and its matching closing `)}` so the block always renders (keep its inner `<div className="mt-5">…</div>`).
- Inside that block, replace the numbering span `{round.kinds.topSlot ? '02' : '01'}` with `01`.
- Replace the input prefix `<span className="text-2xl font-black text-emerald-signal font-mono">$</span>` with:

```jsx
              <span className="text-2xl font-black text-emerald-signal font-mono">
                {currency || '$'}
              </span>
```

- Replace `Cost {formatCurrency(totalCost)}` with `Cost {formatMoney(totalCost, currency)}`.

3h. **Settled result.** In the `{settled && entry && (` block:
- Replace the inner `{round.kinds.payout && (<> … </>)}` wrapper with its fragment contents only, so the guess/actual line always renders.
- Replace the two `formatCurrency(` calls there with `formatMoney(…, currency)`: `formatMoney(entry.payoutGuess, currency)` and `formatMoney(round.actual?.payout, currency)`.
- Delete the whole `{round.kinds.topSlot && ( … )}` fragment.

3i. **Verify:**

Run: `grep -nE "kinds|topSlot|slotInput|SlotTile|formatCurrency|prediction_rounds|useMemo" src/components/PredictionSlip.js`
Expected: no output.

- [ ] **Step 4: Edit `src/components/PredictionWall.js`**

- **Imports:** replace the local `function formatCurrency(val) { … }` (lines 14–17) with nothing, and add after the `db` import:

```js
import { formatMoney } from '../utils/money';
import { roundCurrency } from '../utils/predictionRound';
```

- **In `Card`:** replace the two `show*` lines with:

```js
  const showPayout = typeof entry.payoutGuess === 'number';
```

- Replace `{formatCurrency(entry.payoutGuess)}` with `{formatMoney(entry.payoutGuess, roundCurrency(round), { decimals: 0 })}`.
- Delete the whole `{showSlot && ( … )}` block.
- **In the entries query**, replace `collection(db, 'prediction_rounds', round.id, 'entries'),` with `collection(db, 'hunts', round.id, 'entries'),`.

Run: `grep -nE "kinds|topSlot|showSlot|formatCurrency|prediction_rounds" src/components/PredictionWall.js`
Expected: no output.

- [ ] **Step 5: Edit `src/components/PredictionNumberLine.js`**

- Delete the local `function fmt(val) { … }` (lines 10–14) and add after the `db` import:

```js
import { formatMoneyCompact } from '../utils/money';
import { roundCurrency } from '../utils/predictionRound';
```

- Update the doc comment line to `* Only renders when the round accepts predictions and at least 2 entries exist.`
- As the first line inside `export default function PredictionNumberLine({ round }) {`, add:

```js
  const fmt = (val) => formatMoneyCompact(val, roundCurrency(round));
```

- Replace every `round?.kinds?.payout` with `round?.acceptPredictions` (in the effect guard, the effect deps, the `useMemo` guard and the final `return null` guard).
- Replace `collection(db, 'prediction_rounds', round.id, 'entries'),` with `collection(db, 'hunts', round.id, 'entries'),`.

Run: `grep -nE "kinds|prediction_rounds" src/components/PredictionNumberLine.js`
Expected: no output.

- [ ] **Step 6: Edit `src/components/PredictionWinnersReveal.js`**

- Replace the local `function formatCurrency(val) { … }` (lines 3–6) with these imports placed after line 1:

```js
import { formatMoney } from '../utils/money';
import { roundCurrency } from '../utils/predictionRound';
```

- In `WinnerCard`, replace the ternary

```jsx
            {round.kinds.payout && typeof winner.payoutGuess === 'number'
              ? <>guess {formatCurrency(winner.payoutGuess)}{typeof winner.diff === 'number' ? ` · off by ${formatCurrency(winner.diff)}` : ''}</>
              : winner.topSlotGuess
                ? `picked ${winner.topSlotGuess}`
                : null}
```

with

```jsx
            {typeof winner.payoutGuess === 'number' ? (
              <>
                guess {formatMoney(winner.payoutGuess, roundCurrency(round))}
                {typeof winner.diff === 'number'
                  ? ` · off by ${formatMoney(winner.diff, roundCurrency(round))}`
                  : ''}
              </>
            ) : null}
```

- In the header, replace

```jsx
          actual {round.actual?.payout != null ? formatCurrency(round.actual.payout) : '—'}
          {round.actual?.topSlotName ? ` · ${round.actual.topSlotName}` : ''}
```

with

```jsx
          actual {formatMoney(round.actual?.payout, roundCurrency(round))}
```

Run: `grep -nE "kinds|topSlot|formatCurrency" src/components/PredictionWinnersReveal.js`
Expected: no output.

- [ ] **Step 7: Edit `src/pages/AdminUsersPage.js`**

Delete these lines (302–304):

```jsx
                  {p.topSlotGuess && (
                    <span className="ml-2 text-white/40">{p.topSlotGuess}</span>
                  )}
```

- [ ] **Step 8: Run the tests**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=PredictionSlip`
Expected: PASS (2 tests).

Run: `grep -rnE "topSlot|prediction_rounds|kinds\." src --include=*.js | grep -vE "__tests__|src/components/hunt/|HuntTracker|AdminHuntsPage"`
Expected: no output (AdminHuntsPage is Task 6).

- [ ] **Step 9: Commit**

```bash
git add src/components/PredictionSlip.js src/components/PredictionWall.js src/components/PredictionNumberLine.js src/components/PredictionWinnersReveal.js src/pages/AdminUsersPage.js src/components/__tests__/PredictionSlip.test.js
git commit -m "fix(predictions): read entries from hunts/, payout-only slip, hunt currency"
```

---

### Task 6: Admin predictions page — communityhunts source, Fill from hunt

**Files:**
- Modify: `src/pages/AdminHuntsPage.js`
- Modify: `src/pages/AdminHubPage.js:77`
- Test: `src/pages/__tests__/AdminHuntsPage.test.js`

**Interfaces:**
- Consumes (Task 3): `formatMoney`, `roundCurrency`. Consumes (Task 4): the admin actions `preview_hunt`, `create`, `hunt_result` and `settle` with the shapes above.
- Produces: named export `SettleModal({ round, onClose, onSettled })` for tests. The default export is unchanged.

- [ ] **Step 1: Write the failing tests**

```js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettleModal } from '../AdminHuntsPage';
import { authedFetch } from '../../utils/authedFetch';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  onSnapshot: () => () => {},
  orderBy: () => ({}),
  query: () => ({}),
  limit: () => ({}),
}));
jest.mock('../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const ROUND = {
  id: 'r1',
  title: 'Sunday',
  source: 'communityhunts',
  acceptPredictions: true,
  bonusHuntSnapshot: { huntId: 'h1', currency: 'CAD', totalCost: 3103.62, bonusCount: 18 },
};
const reply = (ok, body) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

test('Fill from hunt prefills the final payout', async () => {
  authedFetch.mockReturnValue(reply(true, { ok: true, result: { payout: 1318.8, ended: true } }));
  render(<SettleModal round={ROUND} onClose={() => {}} onSettled={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /fill from hunt/i }));
  const input = screen.getByLabelText(/actual final payout/i);
  await waitFor(() => expect(input.value).toBe('1318.8'));
  expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({ action: 'hunt_result', id: 'r1' });
  expect(screen.queryByText(/still live/i)).toBeNull();
});

test('Fill from hunt warns when the hunt is still live', async () => {
  authedFetch.mockReturnValue(reply(true, { ok: true, result: { payout: 200, ended: false } }));
  render(<SettleModal round={ROUND} onClose={() => {}} onSettled={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /fill from hunt/i }));
  await waitFor(() => expect(screen.getByText(/still live/i)).toBeTruthy());
});

// Review Focus 5: a deleted hunt gives a readable error and leaves the field alone.
test('Fill from hunt on a missing hunt shows a readable error', async () => {
  authedFetch.mockReturnValue(reply(false, { error: 'HUNT_NOT_FOUND' }));
  render(<SettleModal round={ROUND} onClose={() => {}} onSettled={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /fill from hunt/i }));
  await waitFor(() => expect(screen.getByText(/not found on communityhunts\.gg/i)).toBeTruthy());
  expect(screen.getByLabelText(/actual final payout/i).value).toBe('');
});

// Review Focus 5: an empty payout must not settle at 0.
test('settling with an empty payout is blocked', () => {
  render(<SettleModal round={ROUND} onClose={() => {}} onSettled={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /reveal winners/i }));
  expect(screen.getByText(/actual payout required/i)).toBeTruthy();
  expect(authedFetch).not.toHaveBeenCalled();
});

test('manual rounds have no Fill from hunt button', () => {
  render(<SettleModal round={{ ...ROUND, source: 'manual', bonusHuntSnapshot: null }} onClose={() => {}} onSettled={() => {}} />);
  expect(screen.queryByRole('button', { name: /fill from hunt/i })).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=AdminHuntsPage`
Expected: FAIL. `SettleModal` is not exported (`Element type is invalid … got: undefined`).

- [ ] **Step 3: Edit `src/pages/AdminHuntsPage.js`**

3a. **Imports and formatter.** Add after the `SuggestionList` import:

```js
import { formatMoney } from '../utils/money';
import { roundCurrency } from '../utils/predictionRound';
```

Delete the local `function formatCurrency(val) { … }`.

3b. **Default form.** In `DEFAULT_FORM`, replace these four lines

```js
  kinds: { payout: true, topSlot: false },
  source: 'bonushunt',
  manualSlots: '',
  manualTotalCost: '',
```

with

```js
  source: 'communityhunts',
  manualTotalCost: '',
```

3c. **Preview effect.** Change `if (form.source === 'bonushunt' && !preview && !previewing) fetchPreview();` to `if (form.source === 'communityhunts' && !preview && !previewing) fetchPreview();`.

3d. **Submit validation and body.** In `submit`, delete:

```js
    if (form.acceptPredictions && !form.kinds.payout && !form.kinds.topSlot) {
      return setError('At least one prediction kind');
    }
```

In the `create` request body, delete the `kinds: form.kinds,` and `manualSlots: …` lines.

3e. **Source toggle and preview.** Replace `{['bonushunt', 'manual'].map((s) => (` with `{['communityhunts', 'manual'].map((s) => (`, and replace `{s === 'bonushunt' ? 'bonushunt.gg snapshot' : 'Manual entry'}` with `{s === 'communityhunts' ? 'communityhunts.gg snapshot' : 'Manual entry'}`.

Replace `{form.source === 'bonushunt' && (` with `{form.source === 'communityhunts' && (`. Inside that preview, replace

```jsx
                      <p className="font-bold text-white-body truncate">{preview.huntName || 'Untitled hunt'}</p>
                      <p className="text-white/45 tracking-eyebrow-md uppercase mt-0.5">
                        {preview.casino || '—'} · cost {formatCurrency(preview.totalCost)} · {preview.slots?.length || 0} slots
                      </p>
```

with

```jsx
                      <p className="font-bold text-white-body truncate">Your current communityhunts.gg hunt</p>
                      <p className="text-white/45 tracking-eyebrow-md uppercase mt-0.5">
                        {preview.currency || '—'} · cost {formatMoney(preview.totalCost, preview.currency)} · {preview.bonusCount} bonuses
                      </p>
```

and map the preview error codes to readable text by replacing `{previewError}` with:

```jsx
                    {{
                      NO_CURRENT_HUNT: 'No communityhunts.gg hunt found yet.',
                      COMMUNITYHUNTS_UNAVAILABLE: 'communityhunts.gg is unavailable. Try refresh or use manual entry.',
                    }[previewError] || previewError}
```

3f. **Manual source.** Delete the `{form.kinds.topSlot && ( … )}` slot-list textarea block inside `{form.source === 'manual' && (`.

3g. **Kinds section.** Delete the whole `{/* Kinds (only if predictions enabled) */}` block (`{form.acceptPredictions && ( … "05 Prediction kinds" … )}`). In the Rewards block that follows, renumber `06` to `05`.

3h. **`SettleModal`.** Replace the entire `function SettleModal({ round, onClose, onSettled }) { … }` with:

```jsx
export function SettleModal({ round, onClose, onSettled }) {
  const [actualPayout, setActualPayout] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filling, setFilling] = useState(false);
  const [liveWarning, setLiveWarning] = useState(false);
  const [error, setError] = useState(null);
  const currency = roundCurrency(round);
  const canFill = round.source === 'communityhunts' && !!round.bonusHuntSnapshot?.huntId;

  const fillFromHunt = async () => {
    setFilling(true);
    setError(null);
    try {
      const res = await authedFetch('/api/admin/hunts', {
        method: 'POST',
        body: JSON.stringify({ action: 'hunt_result', id: round.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          {
            HUNT_NOT_FOUND: 'Hunt not found on communityhunts.gg. Enter the payout by hand.',
            COMMUNITYHUNTS_UNAVAILABLE: 'communityhunts.gg is unavailable. Enter the payout by hand.',
          }[data.error] || data.error || 'Failed'
        );
      } else {
        setActualPayout(String(data.result.payout));
        setLiveWarning(data.result.ended === false);
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setFilling(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (actualPayout === '' || !Number.isFinite(Number(actualPayout))) {
      return setError('Actual payout required');
    }
    setSubmitting(true);
    try {
      const res = await authedFetch('/api/admin/hunts', {
        method: 'POST',
        body: JSON.stringify({ action: 'settle', id: round.id, actualPayout: Number(actualPayout) }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed');
      else onSettled(data);
    } catch (e) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md border border-orange-admin/40 bg-zinc-card">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <Trophy size={11} aria-hidden="true" />
            Settle round
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25">
            <X size={12} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label htmlFor="settle-actual-payout" className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono">
                Actual final payout{currency ? ` (${currency})` : ''} <span className="text-emerald-signal">*</span>
              </label>
              {canFill && (
                <button
                  type="button"
                  onClick={fillFromHunt}
                  disabled={filling}
                  className="inline-flex items-center gap-1.5 px-2 py-1 border border-white/15 text-white/65 hover:text-white-body hover:border-white/30 disabled:opacity-50"
                >
                  <RefreshCcw size={11} aria-hidden="true" className={filling ? 'animate-spin' : ''} />
                  <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Fill from hunt</span>
                </button>
              )}
            </div>
            <input
              id="settle-actual-payout"
              type="number"
              min="0"
              step="0.01"
              value={actualPayout}
              onChange={(e) => {
                setActualPayout(e.target.value);
                setLiveWarning(false);
              }}
              className={inputCls}
              placeholder="0.00"
            />
            {liveWarning && (
              <p className="mt-1.5 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-orange-admin font-mono">
                Hunt is still live. The payout may change.
              </p>
            )}
          </div>
          {error && <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150">
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Cancel</span>
          </button>
          <button type="submit" disabled={submitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50">
            <Trophy size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">{submitting ? 'Settling…' : 'Reveal winners'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
```

3i. **`RoundRow` label.** Replace

```jsx
            round.acceptPredictions && (round.kinds?.payout || round.kinds?.topSlot)
              ? `PREDICT (${[round.kinds?.payout && 'payout', round.kinds?.topSlot && 'top-slot'].filter(Boolean).join('+')})`
              : null,
```

with

```jsx
            round.acceptPredictions && 'PREDICT',
```

3j. **Verify.** The preview line was the only `formatCurrency` call and 3a deleted the definition.

Run: `grep -nE "kinds|topSlot|manualSlots|bonushunt|formatCurrency|preview\.slots|preview\.casino|huntName" src/pages/AdminHuntsPage.js`
Expected: no output.

- [ ] **Step 4: Edit `src/pages/AdminHubPage.js`**

Replace the Predictions card description (line 77) with:

```js
      'Run prediction rounds on the final payout, with optional slot suggestions. Snapshot your communityhunts.gg hunt, settle winners, manage the suggestion queue.',
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=AdminHuntsPage`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminHuntsPage.js src/pages/AdminHubPage.js src/pages/__tests__/AdminHuntsPage.test.js
git commit -m "feat(predictions): communityhunts snapshot and fill-from-hunt in admin"
```

---

### Task 7: Hunts tab data hook + components

**Files:**
- Create: `src/utils/huntFormat.js`
- Create: `src/hooks/useCommunityHunts.js`
- Create: `src/components/hunts/ProfitBadge.js`
- Create: `src/components/hunts/BonusReel.js`
- Create: `src/components/hunts/CurrentHuntCard.js`
- Create: `src/components/hunts/RecentHunts.js`
- Create: `src/components/hunts/CommunityHuntsPromo.js`
- Create: `public/brand/communityhunts-logo.png` (copied)
- Test: `src/components/hunts/__tests__/huntsTab.test.js`

Read `PRODUCT.md` first. The markup below reuses the slate/mono language of the old `BonusHunts.js` cards (eyebrow strips, `font-mono` labels, emerald accents), so it already fits the site. Don't introduce communityhunts gold.

**Interfaces:**
- Consumes (Task 2): `GET /api/communityhunts?view=overview|hunt`. Consumes (Task 3): `formatMoney`.
- Produces:
  - **`src/utils/huntFormat.js`:** `profitLoss(hunt) → number|null` (null when `pot <= 0` or the values are missing), `huntTypeLabel(type) → string`, `formatHuntDate(iso) → string`, `formatMultiplier(x) → string` (`'—'` for null).
  - **`useCommunityHunts() → { live: Hunt|null, recent: Hunt[], loading: boolean, error: string|null }`:** fetches on mount, then every 60s while the document is visible, and refetches when the tab becomes visible again. After a failed poll it keeps the last good data.
  - **Default-export components:**
    - `ProfitBadge({ value, currency })`
    - `BonusReel({ bonuses, currency })`
    - `CurrentHuntCard({ hunt, isLive })`
    - `RecentHunts({ hunts })`: expands a row by fetching `view=hunt&id=`
    - `CommunityHuntsPromo()`

- [ ] **Step 1: Copy the logo**

```bash
mkdir -p public/brand
cp "../claudeProjects/community-bonusthunts/communityhunts-frontend/public/communityhunts-logo.png" public/brand/communityhunts-logo.png
```

Expected: `public/brand/communityhunts-logo.png` exists (600×121 wordmark).

- [ ] **Step 2: Write the failing tests**

```js
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { profitLoss, huntTypeLabel, formatMultiplier } from '../../../utils/huntFormat';
import CurrentHuntCard from '../CurrentHuntCard';
import BonusReel from '../BonusReel';
import RecentHunts from '../RecentHunts';
import CommunityHuntsPromo from '../CommunityHuntsPromo';
import useCommunityHunts from '../../../hooks/useCommunityHunts';

const ARCHIVED = {
  id: 'h1', status: 'archived', huntType: 'community', currency: 'CAD',
  startedAt: '2026-09-24T21:02:45.765Z', endedAt: '2026-09-24T23:06:49.441Z',
  bonusCount: 18, pot: 3103.62, totalWon: 1318.8, averageMultiple: 30.44,
};
const LIVE = {
  ...ARCHIVED, id: 'live1', status: 'live', endedAt: null,
  bonuses: [
    { slot: 'Pug Life', bet: 0.4, win: 5.2, multiplier: 13, thumb: null },
    { slot: 'Le Viking', bet: 0.4, win: null, multiplier: null, thumb: null },
  ],
};

test('huntFormat helpers', () => {
  expect(profitLoss(ARCHIVED)).toBe(-1784.82);
  expect(profitLoss({ pot: 0, totalWon: 50 })).toBeNull();
  expect(profitLoss({ pot: null, totalWon: 50 })).toBeNull();
  expect(huntTypeLabel('toplb')).toBe('Top LB');
  expect(huntTypeLabel('mystery')).toBe('Mystery');
  expect(formatMultiplier(null)).toBe('—');
  expect(formatMultiplier(30.44)).toBe('30.4x');
});

test('CurrentHuntCard shows a live hunt with its bonus reel', () => {
  render(<CurrentHuntCard hunt={LIVE} isLive />);
  expect(screen.getByText(/live hunt/i)).toBeTruthy();
  expect(screen.getByText('CA$3,103.62')).toBeTruthy();
  expect(screen.getByText('Pug Life')).toBeTruthy();
});

test('CurrentHuntCard shows the latest hunt without a reel', () => {
  render(<CurrentHuntCard hunt={ARCHIVED} isLive={false} />);
  expect(screen.getByText(/latest hunt/i)).toBeTruthy();
  expect(screen.getByText('-CA$1,784.82')).toBeTruthy();
});

// Review Focus 1: potless hunt.
test('CurrentHuntCard renders a potless hunt without NaN', () => {
  const { container } = render(
    <CurrentHuntCard hunt={{ ...ARCHIVED, pot: 0 }} isLive={false} />
  );
  expect(container.textContent).not.toMatch(/NaN/);
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
});

// Review Focus 2: unopened bonus in a live hunt.
test('BonusReel renders an unopened bonus as em dashes', () => {
  const { container } = render(<BonusReel bonuses={LIVE.bonuses} currency="CAD" />);
  expect(container.textContent).not.toMatch(/NaN/);
  expect(screen.getByText('Le Viking')).toBeTruthy();
});

test('RecentHunts expands a row and loads its bonuses', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ hunt: { ...ARCHIVED, bonuses: LIVE.bonuses } }) })
  );
  render(<RecentHunts hunts={[ARCHIVED]} />);
  fireEvent.click(screen.getByRole('button', { name: /community/i }));
  await waitFor(() => expect(screen.getByText('Pug Life')).toBeTruthy());
  expect(global.fetch).toHaveBeenCalledWith('/api/communityhunts?view=hunt&id=h1');
});

test('CommunityHuntsPromo links to the Bean hub and add-community', () => {
  render(<CommunityHuntsPromo />);
  const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
  expect(hrefs).toContain('https://communityhunts.gg/bean');
  expect(hrefs).toContain('https://communityhunts.gg/add-community');
});

function HookProbe({ onState }) {
  onState(useCommunityHunts());
  return null;
}

test('useCommunityHunts loads the overview and keeps data after a failed poll', async () => {
  jest.useFakeTimers();
  try {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ live: null, recent: [ARCHIVED] }) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: () => Promise.resolve({ error: 'UPSTREAM_UNAVAILABLE' }) });
    let state;
    render(<HookProbe onState={(s) => { state = s; }} />);
    await waitFor(() => expect(state.loading).toBe(false));
    expect(state.recent).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/communityhunts?view=overview');

    await act(async () => {
      jest.advanceTimersByTime(60 * 1000);
    });
    await waitFor(() => expect(state.error).toBeTruthy());
    expect(state.recent).toHaveLength(1);
  } finally {
    jest.useRealTimers();
  }
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=huntsTab`
Expected: FAIL with `Cannot find module '../../../utils/huntFormat'`.

- [ ] **Step 4: Write `src/utils/huntFormat.js`**

```js
// Display helpers for communityhunts.gg hunts on the Hunts tab. P/L follows
// communityhunts' own rule: only hunts that recorded a starting pot have one.

const HUNT_TYPE_LABELS = {
  community: 'Community',
  solo: 'Solo',
  vip: 'VIP',
  affiliate: 'Affiliate',
  streamer: 'Streamer',
  toplb: 'Top LB',
};

export function huntTypeLabel(type) {
  if (!type) return 'Hunt';
  return HUNT_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

export function profitLoss(hunt) {
  const pot = Number(hunt && hunt.pot);
  const won = Number(hunt && hunt.totalWon);
  if (!(pot > 0) || hunt.totalWon == null || !Number.isFinite(won)) return null;
  return Math.round((won - pot) * 100) / 100;
}

export function formatHuntDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatMultiplier(x) {
  if (x == null || x === '') return '—';
  const n = Number(x);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(n >= 100 ? 0 : 1)}x`;
}
```

- [ ] **Step 5: Write `src/hooks/useCommunityHunts.js`**

```js
import { useEffect, useState } from 'react';

// Polls /api/communityhunts for GooferG's live + recent hunts. 60s cadence
// (the server caches 30s); skips polls while the tab is hidden and refreshes
// when it becomes visible. A failed poll keeps the last good data.
const POLL_MS = 60 * 1000;

export default function useCommunityHunts() {
  const [state, setState] = useState({ live: null, recent: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/api/communityhunts?view=overview');
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error((data && data.error) || `HTTP ${res.status}`);
        if (!cancelled) {
          setState({
            live: data.live || null,
            recent: Array.isArray(data.recent) ? data.recent : [],
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: err.message || 'Failed' }));
        }
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return state;
}
```

- [ ] **Step 6: Write `src/components/hunts/ProfitBadge.js`**

```jsx
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatMoney } from '../../utils/money';

// Signed P/L in the hunt's currency. null (potless hunt) renders an em dash.
export default function ProfitBadge({ value, currency }) {
  if (value == null) {
    return <span className="text-white/45 font-bold text-sm tabular-nums">—</span>;
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-signal font-bold text-sm tabular-nums">
        <TrendingUp size={13} aria-hidden="true" /> +{formatMoney(value, currency)}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-destructive font-bold text-sm tabular-nums">
        <TrendingDown size={13} aria-hidden="true" /> {formatMoney(value, currency)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-white/70 font-bold text-sm tabular-nums">
      <Minus size={13} aria-hidden="true" /> {formatMoney(0, currency)}
    </span>
  );
}
```

- [ ] **Step 7: Write `src/components/hunts/BonusReel.js`**

```jsx
import { formatMoney } from '../../utils/money';
import { formatMultiplier } from '../../utils/huntFormat';

function MultiplierBar({ value, max }) {
  const n = Number(value);
  const pct = Number.isFinite(n) && max > 0 ? Math.min((n / max) * 100, 100) : 0;
  // Semantic data viz — gradient fill encodes magnitude (intentional).
  const color =
    n >= 100
      ? 'from-emerald-signal to-emerald-bright'
      : n >= 50
        ? 'from-yellow-500 to-yellow-400'
        : 'from-red-destructive to-red-destructive/70';
  return (
    <div className="flex-1 h-1 bg-white/10 overflow-hidden">
      <div className={`h-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Per-bonus rows. Unopened bonuses (win/multiplier null) render as em dashes.
export default function BonusReel({ bonuses, currency }) {
  const list = Array.isArray(bonuses) ? bonuses : [];
  if (list.length === 0) return null;
  const max = Math.max(1, ...list.map((b) => (Number.isFinite(Number(b.multiplier)) ? Number(b.multiplier) : 0)));
  return (
    <div>
      <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/65 mb-3 font-mono">
        Bonus reel · {list.length}
      </p>
      <div className="space-y-1.5">
        {list.map((b, i) => (
          <div key={`${b.slot}-${i}`} className="flex items-center gap-3 px-3 py-2.5 bg-zinc-broadcast/40 border border-white/5">
            {b.thumb ? (
              <img
                src={b.thumb}
                alt=""
                loading="lazy"
                className="w-9 h-9 object-cover flex-shrink-0 bg-white/5 border border-white/10"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-9 h-9 flex-shrink-0 bg-white/5 border border-white/10" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white-body text-sm truncate leading-tight">{b.slot || `Bonus ${i + 1}`}</p>
              <p className="text-[0.625rem] tracking-eyebrow-sm uppercase text-white/65 truncate mt-0.5 font-mono">
                Bet {formatMoney(b.bet, currency)}
              </p>
            </div>
            <div className="w-32 hidden sm:flex items-center">
              <MultiplierBar value={b.multiplier} max={max} />
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-sm text-white-body tabular-nums">{formatMoney(b.win, currency)}</p>
              <p className="text-[0.625rem] tracking-eyebrow-sm text-white/65 tabular-nums font-mono">
                {formatMultiplier(b.multiplier)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Write `src/components/hunts/CurrentHuntCard.js`**

```jsx
import { formatMoney } from '../../utils/money';
import { huntTypeLabel, profitLoss, formatHuntDate, formatMultiplier } from '../../utils/huntFormat';
import ProfitBadge from './ProfitBadge';
import BonusReel from './BonusReel';

function Stat({ label, children }) {
  return (
    <div>
      <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono">{label}</p>
      <div className="font-bold text-white-body text-sm tabular-nums">{children}</div>
    </div>
  );
}

// GooferG's live hunt (with its bonus reel), or his most recent one.
export default function CurrentHuntCard({ hunt, isLive }) {
  if (!hunt) return null;
  const currency = hunt.currency || null;
  const pot = Number(hunt.pot) > 0 ? hunt.pot : null;
  return (
    <section className="border border-white/8 bg-zinc-card/30" aria-label={isLive ? 'Live hunt' : 'Latest hunt'}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className={`inline-flex items-center gap-2 ${isLive ? 'text-emerald-signal' : 'text-white/70'}`}>
          <span className="relative flex w-1.5 h-1.5">
            {isLive && <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />}
            <span className={`relative w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-signal' : 'bg-white/50'}`} />
          </span>
          <span>{isLive ? 'Live hunt' : 'Latest hunt'}</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">{huntTypeLabel(hunt.huntType)}</span>
        <span className="text-white/15">·</span>
        <span className="text-white/45">{formatHuntDate(isLive ? hunt.startedAt : hunt.endedAt || hunt.startedAt)}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-4 sm:px-5 py-4">
        <Stat label="Bonuses">{hunt.bonusCount ?? '—'}</Stat>
        <Stat label="Start cost">{pot == null ? '—' : formatMoney(pot, currency)}</Stat>
        <Stat label="Won">{formatMoney(hunt.totalWon, currency)}</Stat>
        <Stat label="Avg multi">{formatMultiplier(hunt.averageMultiple)}</Stat>
        <Stat label="Result">
          <ProfitBadge value={profitLoss(hunt)} currency={currency} />
        </Stat>
      </div>
      {isLive && Array.isArray(hunt.bonuses) && hunt.bonuses.length > 0 && (
        <div className="border-t border-white/8 px-4 sm:px-5 pb-5 pt-4">
          <BonusReel bonuses={hunt.bonuses} currency={currency} />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 9: Write `src/components/hunts/RecentHunts.js`**

```jsx
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatMoney } from '../../utils/money';
import { huntTypeLabel, profitLoss, formatHuntDate } from '../../utils/huntFormat';
import ProfitBadge from './ProfitBadge';
import BonusReel from './BonusReel';

function HuntRow({ hunt, index }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const currency = hunt.currency || null;
  const pot = Number(hunt.pot) > 0 ? hunt.pot : null;
  const tape = String(index + 1).padStart(3, '0');

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || detail) return;
    setLoadError(null);
    try {
      const res = await fetch(`/api/communityhunts?view=hunt&id=${encodeURIComponent(hunt.id)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.hunt) throw new Error('Failed');
      setDetail(data.hunt);
    } catch {
      setLoadError('Could not load this hunt’s bonuses.');
    }
  };

  return (
    <div className={`border bg-zinc-card/40 transition-colors duration-200 ${open ? 'border-emerald-signal/30' : 'border-white/8 hover:border-emerald-signal/25'}`}>
      <button type="button" onClick={toggle} aria-expanded={open} className="w-full text-left px-4 sm:px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="mt-1 text-[0.625rem] font-bold tracking-eyebrow-md tabular-nums text-emerald-signal/80 font-mono">#{tape}</span>
            <div className="min-w-0">
              <p className="font-bold text-white-body text-base leading-tight tracking-tight truncate">
                {huntTypeLabel(hunt.huntType)} hunt
              </p>
              <p className="mt-1 text-[0.6875rem] tracking-eyebrow-sm uppercase text-white/65 truncate font-mono">
                {formatHuntDate(hunt.endedAt || hunt.startedAt)} · {hunt.bonusCount ?? '—'} bonuses{hunt.status === 'live' ? ' · live' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono">Cost</p>
              <p className="font-bold text-white-body text-sm tabular-nums">{pot == null ? '—' : formatMoney(pot, currency)}</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono">Won</p>
              <p className="font-bold text-white-body text-sm tabular-nums">{formatMoney(hunt.totalWon, currency)}</p>
            </div>
            <div className="text-right">
              <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono">Result</p>
              <ProfitBadge value={profitLoss(hunt)} currency={currency} />
            </div>
            <span className="text-white/60">{open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</span>
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-white/8 px-4 sm:px-5 pb-5 pt-4">
          {loadError ? (
            <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive/80 font-mono">{loadError}</p>
          ) : detail ? (
            <BonusReel bonuses={detail.bonuses} currency={currency} />
          ) : (
            <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">Loading bonuses…</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function RecentHunts({ hunts }) {
  const list = Array.isArray(hunts) ? hunts : [];
  if (list.length === 0) return null;
  return (
    <div className="border border-white/8 bg-zinc-card/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
          <span>Hunt archive</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/70 tabular-nums">{String(list.length).padStart(3, '0')}</span>
      </div>
      <div className="p-3 space-y-2">
        {list.map((h, i) => (
          <HuntRow key={h.id} hunt={h} index={i} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Write `src/components/hunts/CommunityHuntsPromo.js`**

```jsx
import { ArrowUpRight } from 'lucide-react';

// The one place communityhunts.gg branding appears: its wordmark. Everything
// else stays in this site's own slate/mono language (PRODUCT.md: no casino
// gold). Always renders, even when hunt data is down.
export default function CommunityHuntsPromo() {
  const linkCls =
    'inline-flex items-center gap-1.5 px-3 py-2 border border-white/15 text-white/75 hover:text-white-body hover:border-emerald-signal/50 transition-colors duration-150 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono';
  return (
    <section className="border border-white/8 bg-zinc-card/30 px-4 sm:px-6 py-5" aria-label="communityhunts.gg">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <img src="/brand/communityhunts-logo.png" alt="communityhunts.gg" width="600" height="121" className="h-7 w-auto self-start" />
        <p className="text-sm text-white/70 leading-relaxed flex-1">
          Every hunt on this channel runs on communityhunts.gg. Call your slot, claim your cut, and watch it open live.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="https://communityhunts.gg/bean" target="_blank" rel="noopener noreferrer" className={linkCls}>
            Watch the hub <ArrowUpRight size={12} aria-hidden="true" />
          </a>
          <a href="https://communityhunts.gg/add-community" target="_blank" rel="noopener noreferrer" className={linkCls}>
            Bring your community <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=huntsTab`
Expected: PASS (9 tests).

- [ ] **Step 12: Commit**

```bash
git add src/utils/huntFormat.js src/hooks/useCommunityHunts.js src/components/hunts public/brand/communityhunts-logo.png
git commit -m "feat(hunts): communityhunts hook, hunt card, archive and promo components"
```

---

### Task 8: Hunts tab page + wiring, remove bonushunt.gg

**Files:**
- Create: `src/pages/HuntsPage.js`
- Delete: `src/pages/BonusHunts.js`, `api/bonus-hunts.js`
- Modify: `src/pages/GambaPage.js`
- Modify: `src/data/gambaTools.js`
- Modify: `src/App.js:260-262`
- Modify: `src/components/HomeGambaTools.js:8-9`
- Modify: `src/setupProxy.js` (remove the bonushunt.gg proxy and mirror)
- Modify: `.env.example` (remove `BONUSHUNT_API_KEY`)
- Test: `src/pages/__tests__/HuntsPage.test.js`

**Interfaces:**
- Consumes (Task 7): `useCommunityHunts`, `CurrentHuntCard`, `RecentHunts`, `CommunityHuntsPromo`. Consumes (Task 5): the prediction components (unchanged props `round`).
- Produces: default export `HuntsPage()`; tool id `hunts` at `/gamba/hunts`.

- [ ] **Step 1: Write the failing tests**

```js
import { render, screen, waitFor } from '@testing-library/react';
import HuntsPage from '../HuntsPage';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  onSnapshot: () => () => {},
  orderBy: () => ({}),
  query: () => ({}),
  limit: () => ({}),
  where: () => ({}),
}));
jest.mock('../../contexts/TwitchAuthContext', () => ({
  useTwitchAuth: () => ({ twitchUser: null, loginWithTwitch: () => {} }),
}));

const ARCHIVED = { id: 'h1', status: 'archived', huntType: 'solo', currency: 'ARS', bonusCount: 48, pot: 150000, totalWon: 84221.4, averageMultiple: 20 };

test('shows the latest hunt card and the promo band', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ live: null, recent: [ARCHIVED] }) })
  );
  render(<HuntsPage />);
  await waitFor(() => expect(screen.getByText(/latest hunt/i)).toBeTruthy());
  expect(screen.getByLabelText('communityhunts.gg')).toBeTruthy();
  // The card's hunt is not repeated in the archive list.
  expect(screen.queryByText(/hunt archive/i)).toBeNull();
});

// Review Focus 4: API down → promo still renders, no hunt sections.
test('API failure hides hunt sections but keeps the promo band', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: 'UPSTREAM_UNAVAILABLE' }) })
  );
  const { container } = render(<HuntsPage />);
  // Loading spinner first, then it must disappear once the failed fetch settles.
  expect(container.querySelector('.animate-spin')).toBeTruthy();
  await waitFor(() => expect(container.querySelector('.animate-spin')).toBeNull());
  expect(screen.getByLabelText('communityhunts.gg')).toBeTruthy();
  expect(screen.queryByText(/latest hunt/i)).toBeNull();
  expect(screen.queryByText(/live hunt/i)).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=HuntsPage`
Expected: FAIL with `Cannot find module '../HuntsPage'`.

- [ ] **Step 3: Write `src/pages/HuntsPage.js`**

`PredictionModeBanner` and `usePredictionRound` move verbatim from `BonusHunts.js`.

```jsx
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { RefreshCcw } from 'lucide-react';
import { db } from '../config/firebase';
import useTuningPhrase from '../hooks/useTuningPhrase';
import useCommunityHunts from '../hooks/useCommunityHunts';
import PredictionSlip from '../components/PredictionSlip';
import PredictionWall from '../components/PredictionWall';
import PredictionNumberLine from '../components/PredictionNumberLine';
import PredictionWinnersReveal from '../components/PredictionWinnersReveal';
import SuggestionSubmit from '../components/SuggestionSubmit';
import SuggestionList from '../components/SuggestionList';
import CurrentHuntCard from '../components/hunts/CurrentHuntCard';
import RecentHunts from '../components/hunts/RecentHunts';
import CommunityHuntsPromo from '../components/hunts/CommunityHuntsPromo';

function PredictionModeBanner({ round }) {
  if (!round) return null;
  const tone =
    round.status === 'open'
      ? 'text-emerald-signal border-emerald-signal/40'
      : round.status === 'locked'
        ? 'text-orange-admin border-orange-admin/50'
        : 'text-white-body border-white/30';

  const features = [
    round.acceptPredictions && 'PREDICT',
    round.acceptSuggestions && 'SUGGEST',
  ].filter(Boolean).join(' + ') || 'HUNT';
  const statusLabel =
    round.status === 'open' ? 'OPEN'
      : round.status === 'locked' ? 'LOCKED'
      : 'SETTLED';
  const label = `${features} · ${statusLabel}`;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border ${tone} bg-zinc-card/30 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono`}>
      <span className="inline-flex items-center gap-2">
        <span className="relative flex w-1.5 h-1.5">
          {round.status === 'open' && (
            <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
          )}
          <span
            className={`relative w-1.5 h-1.5 rounded-full ${
              round.status === 'open'
                ? 'bg-emerald-signal'
                : round.status === 'locked'
                  ? 'bg-orange-admin'
                  : 'bg-white-body'
            }`}
          />
        </span>
        <span>{label}</span>
      </span>
      <span className="text-white/15">·</span>
      <span className="text-white/55 truncate max-w-[40ch]">{round.title}</span>
      <span className="ml-auto text-white/40 tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1">
        {round.acceptPredictions && (
          <span>{String(round.entryCount ?? 0).padStart(4, '0')} ENTRIES</span>
        )}
        {round.acceptSuggestions && (
          <span>{String(round.suggestionCount ?? 0).padStart(3, '0')} SUGG.</span>
        )}
      </span>
    </div>
  );
}

function usePredictionRound() {
  const [round, setRound] = useState(null);
  useEffect(() => {
    // Most recent non-deleted round. Show settled rounds too (last result lingers).
    const q = query(
      collection(db, 'hunts'),
      orderBy('createdAt', 'desc'),
      fLimit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setRound(null);
      } else {
        const d = snap.docs[0];
        setRound({ id: d.id, ...d.data() });
      }
    });
    return unsub;
  }, []);
  return round;
}

// /gamba/hunts: the current prediction round (and its suggestions), then
// GooferG's communityhunts.gg hunts, then the communityhunts.gg promo band.
export default function HuntsPage() {
  const round = usePredictionRound();
  const { live, recent, loading } = useCommunityHunts();
  const current = live || recent[0] || null;
  const archive = current ? recent.filter((h) => h.id !== current.id) : recent;
  const tuningPhrase = useTuningPhrase(loading && !current);

  const mode =
    !round
      ? 'no_round'
      : round.status === 'open'
        ? 'predicting'
        : round.status === 'locked'
          ? 'opening'
          : 'settled';

  return (
    <div className="space-y-6">
      {round && <PredictionModeBanner round={round} />}

      {/* PREDICTING mode — slip + wall hero (only if predictions enabled) */}
      {mode === 'predicting' && round?.acceptPredictions && (
        <>
          <PredictionSlip round={round} />
          <PredictionNumberLine round={round} />
          <PredictionWall round={round} />
        </>
      )}

      {/* OPENING mode (predictions locked, hunt is being opened) */}
      {mode === 'opening' && round?.acceptPredictions && (
        <>
          <PredictionSlip round={round} />
          <PredictionWall round={round} />
        </>
      )}

      {/* SETTLED mode — winners hero */}
      {mode === 'settled' && round?.acceptPredictions && (
        <>
          <PredictionWinnersReveal round={round} />
          <PredictionNumberLine round={round} />
          <PredictionWall round={round} />
          <PredictionSlip round={round} />
        </>
      )}

      {/* Suggestion sections — render whenever the round accepts suggestions */}
      {round?.acceptSuggestions && (
        <>
          <SuggestionSubmit hunt={round} />
          <SuggestionList huntId={round.id} adminMode={false} />
        </>
      )}

      {/* communityhunts.gg hunts. Hidden entirely when there is no data. */}
      {loading && !current ? (
        <div className="border border-white/8 bg-zinc-card/30 py-12 flex flex-col items-center gap-3 text-white/65">
          <RefreshCcw size={20} className="animate-spin" aria-hidden="true" />
          <p className="text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase font-mono">{tuningPhrase}</p>
        </div>
      ) : current ? (
        <>
          <CurrentHuntCard hunt={current} isLive={!!live} />
          <RecentHunts hunts={archive} />
        </>
      ) : null}

      <CommunityHuntsPromo />
    </div>
  );
}
```

- [ ] **Step 4: Wire the tool**

4a. `src/data/gambaTools.js`: replace the file body with:

```js
import { Gamepad2, Layers, Radio, Swords } from 'lucide-react';

// Canonical Gamba tool list. Single source of truth for the in-page tool tabs
// (GambaPage) and the nav dropdown (Navigation). Routes are /gamba/${id}.
export const GAMBA_TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Radio },
  { id: 'hunts', label: 'Hunts', icon: Layers },
  { id: 'bonus-battle', label: 'Bonus Battle', icon: Swords },
  { id: 'wheel', label: 'Slot Picker', icon: Gamepad2 },
];
```

4b. `src/pages/GambaPage.js`:
- Replace `import BonusHuntsPage from './BonusHunts';` with `import HuntsPage from './HuntsPage';`.
- Delete `const HuntTracker = lazy(() => import('../components/HuntTracker'));`.
- In the comment above the lazy imports, replace `// SlotPicker imports it directly; HuntTracker reaches it through SlotAutocomplete.` with `// SlotPicker imports it directly; BonusBattle reaches it through SlotAutocomplete.`
- In the tool surface, replace these lines

```jsx
              {activeTool === 'bonus-hunts' && <BonusHuntsPage />}
              {activeTool === 'hunt-tracker' && (
                <Suspense fallback={<ToolLoading label="Loading hunt tracker…" />}>
                  <HuntTracker />
                </Suspense>
              )}
```

with

```jsx
              {activeTool === 'hunts' && <HuntsPage />}
```

4c. `src/App.js`: replace

```jsx
            <Route path="hunt" element={null} />
            <Route path="bonus-hunts" element={null} />
            <Route path="hunt-tracker" element={null} />
```

with

```jsx
            <Route path="hunts" element={null} />
```

4d. `src/components/HomeGambaTools.js`: replace the `'hunt-tracker': …` and `'bonus-hunts': …` entries with:

```js
  hunts: 'Every hunt on communityhunts.gg, live and logged.',
```

- [ ] **Step 5: Remove bonushunt.gg**

```bash
git rm src/pages/BonusHunts.js api/bonus-hunts.js
```

**`src/setupProxy.js`:**
- Delete the `const BONUS_HUNT_API_KEY = …` line.
- Change the header comment to `// Dev-only secrets — read from env (.env.local), no longer committed. Set` / `// SLOTSLAUNCH_API_KEY and COMMUNITYHUNTS_API_KEY in .env.local for local API mirrors.`
- Replace the warning block with:

```js
if (!SLOTS_API_KEY || !process.env.COMMUNITYHUNTS_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[setupProxy] SLOTSLAUNCH_API_KEY / COMMUNITYHUNTS_API_KEY not set in .env.local — ' +
      '/api/slots and /api/communityhunts dev mirrors will fail until they are.'
  );
}
```

- Delete the whole `// Dev proxy for direct /api/public calls` `app.use('/api/public', …)` block, and the whole `// Dev handler for /api/bonus-hunts` `app.get('/api/bonus-hunts', …)` block.

**`.env.example`:** delete the `BONUSHUNT_API_KEY=your_bonushunt_api_key      # api/bonus-hunts.js, api/admin/hunts.js` line.

Verify:

Run: `grep -rnE "bonushunt|BONUSHUNT|bonus-hunts|BonusHunts" src api .env.example vercel.json | grep -v __tests__`
Expected: no output.

- [ ] **Step 6: Run the tests**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=HuntsPage`
Expected: PASS. The pattern also matches `AdminHuntsPage.test.js`, so two suites run: 2 tests from `HuntsPage.test.js` plus Task 6's 5.

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src/pages/HuntsPage.js src/pages/__tests__/HuntsPage.test.js src/pages/GambaPage.js src/data/gambaTools.js src/App.js src/components/HomeGambaTools.js src/setupProxy.js .env.example
git commit -m "feat(hunts): communityhunts Hunts tab replaces Bonus Hunts, drop bonushunt.gg"
```

---

### Task 9: Remove the Hunt Tracker

**Files:**
- Delete: the files listed in Step 1
- Modify: `src/App.js`, `src/components/AdminLayout.js`, `src/pages/AdminHubPage.js`, `src/pages/MyAccountPage.js`, `vercel.json`, `package.json` (+ `package-lock.json`), `firestore.rules`, `src/setupProxy.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing. After this task nothing imports a deleted file, and the build is clean.

- [ ] **Step 1: Delete the tracker files**

This list was computed from the import graph: the roots plus everything only they import, plus tests of deleted subjects.

```bash
git rm -r src/components/hunt
git rm src/components/HuntTracker.js src/components/HuntHistory.js src/components/HuntLinkControls.js \
  src/components/HuntStartScreen.js src/components/HuntTour.js src/components/SuggestionsPanel.js \
  src/components/SuggestionBoard.js src/components/CappedScroll.js src/components/Modal.js \
  src/components/ScatterPill.js src/components/StatCell.js \
  src/hooks/useHuntStore.js src/hooks/useFirstVisit.js \
  src/pages/LiveHuntPage.js src/pages/HuntSuggestPage.js src/pages/AdminCommunityHuntsPage.js \
  src/utils/huntExport.js src/utils/scatterTier.js src/utils/suggestionBoard.js src/utils/suggestionsParse.js \
  src/components/__tests__/HuntTour.test.js src/components/__tests__/StatCell.test.js \
  src/components/__tests__/SuggestionBoard.test.js src/hooks/__tests__/useFirstVisit.test.js \
  src/pages/__tests__/HuntSuggestPage.test.js src/utils/__tests__/scatterTier.test.js \
  src/utils/__tests__/suggestionBoard.test.js src/__tests__/livePreviewFormat.test.js \
  src/__tests__/ogCardProps.test.js
git rm -r api/hunt-suggest api/og api/roster
git rm api/live-preview.js api/_lib/livePreviewFormat.js api/admin/community-hunts.js \
  api/me/slot-profile.js api/me/payout-profile.js
```

Expected: every path is removed. If `git rm` reports `did not match any files` for a path, stop and re-check the path with `git ls-files` before continuing.

- [ ] **Step 2: `src/App.js`**

Delete these three lazy imports:

```js
const AdminCommunityHuntsPage = lazy(() => import('./pages/AdminCommunityHuntsPage'));
const LiveHuntPage = lazy(() => import('./pages/LiveHuntPage'));
const HuntSuggestPage = lazy(() => import('./pages/HuntSuggestPage'));
```

Delete these three routes:

```jsx
            <Route path="community-hunts" element={<AdminCommunityHuntsPage />} />
          <Route path="/live/:shareId" element={<LiveHuntPage />} />
          <Route path="/hunt-suggest/:linkId" element={<HuntSuggestPage />} />
```

`PRODUCT_PREFIXES` (around line 67) contains neither path, so nothing else changes there.

Run: `grep -nE "/live|hunt-suggest|CommunityHunts" src/App.js`
Expected: no output.

- [ ] **Step 3: Admin nav + hub**

- `src/components/AdminLayout.js`: delete the line `  { to: '/admin/community-hunts', label: 'Community Hunts', code: 'CHT', icon: Megaphone },` and the `Megaphone,` import (it has no other use).
- `src/pages/AdminHubPage.js`: delete the whole `{ to: '/admin/community-hunts', icon: Megaphone, code: 'CHT', … }` card object and the `Megaphone,` import.

Run: `grep -nE "Megaphone|community-hunts" src/components/AdminLayout.js src/pages/AdminHubPage.js`
Expected: no output.

- [ ] **Step 4: `src/pages/MyAccountPage.js`**

- Delete `const MAX_SLOTS = 6;`, the whole `function SlotProfileCard({ user }) { … }` and the whole `function PayoutProfileCard({ user }) { … }` (everything from `const MAX_SLOTS` down to the line before `const REASON_LABELS = {`).
- Delete the render block:

```jsx
        {/* key re-inits the card's local state once the user doc streams in
            (useUserDoc is async; the card derives initial values from `user`). */}
        <SlotProfileCard key={user?.slotProfile ? 'loaded' : 'empty'} user={user} />

        {/* key re-inits the card's local state once the user doc streams in. */}
        <PayoutProfileCard key={user?.payoutProfile ? 'payout-loaded' : 'payout-empty'} user={user} />
```

- Delete the now-unused imports `ListPlus,`, `Wallet,` and `import SlotAutocomplete from '../components/SlotAutocomplete';`. Keep `authedFetch` (claim-daily) and `CheckCircle2` (still used at the top of the file).

Run: `grep -nE "SlotProfileCard|PayoutProfileCard|MAX_SLOTS|SlotAutocomplete|ListPlus|Wallet|slot-profile|payout-profile" src/pages/MyAccountPage.js`
Expected: no output.

- [ ] **Step 5: `vercel.json`**

Replace the file with:

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "crons": [
    { "path": "/api/cron/award-watchtime", "schedule": "0 0 * * *" }
  ]
}
```

- [ ] **Step 6: Drop `@vercel/og`**

```bash
npm uninstall @vercel/og
```

Expected: `package.json` no longer lists `@vercel/og`, and `package-lock.json` is updated.

Run: `grep -rn "@vercel/og" src api package.json`
Expected: no output.

- [ ] **Step 7: `firestore.rules`**

Inside `match /users/{uid} { … }`, delete the two tracker subcollection blocks:

```
      // Bonus tracker — single in-progress hunt.
      match /active_hunt/{docId} {
        allow read, write: if isSelf(uid) || isStaff();
      }
      // Bonus tracker — completed hunts (track record).
      match /hunts/{huntId} {
        allow read, write: if isSelf(uid) || isStaff();
      }
```

In the comment above `match /users/{uid}`, replace the line `// below are client-writable by the owner (self-gated, like suggestions).` so that it reads just `// The user doc itself is server-only.` (drop the sentence about viewer-owned hunt subcollections).

Delete the whole `// Suggestion intake links. …` comment plus the `match /suggestion_intakes/{linkId} { … }` block, and the whole `// Live-shared bonus hunt snapshots. …` comment plus the `match /shared_hunts/{shareId} { … }` block.

Keep `match /hunts/{id}` (prediction rounds, with its `entries` and `suggestions`) and `match /bonus_battles/…`.

Run: `grep -nE "active_hunt|suggestion_intakes|shared_hunts|Bonus tracker" firestore.rules`
Expected: no output.

- [ ] **Step 8: `src/setupProxy.js`**

- Rename `HUNT_SUGGEST_TARGET` to `DEPLOYED_API_TARGET` and its env override from `HUNT_SUGGEST_PROXY_TARGET` to `API_PROXY_TARGET`.
- Replace its comment with: `// /api/me/* (daily claim) needs Firebase admin, which can't run in the CRA dev` / `// server. Proxy it to the deployed functions. Override with API_PROXY_TARGET.`
- Delete the `app.use('/api/hunt-suggest', …)` block with its comment, and the `app.use('/api/roster', …)` block.
- Keep the `app.use('/api/me', …)` block; change its comment to `// /api/me/* needs Firebase admin — proxy to the deployed functions.` and its `target:` to `DEPLOYED_API_TARGET`.

Run: `grep -nE "hunt-suggest|roster|HUNT_SUGGEST" src/setupProxy.js`
Expected: no output.

- [ ] **Step 9: Verify nothing references deleted code, then run the tests and the build**

Run: `grep -rnE "HuntTracker|useHuntStore|LiveHuntPage|HuntSuggestPage|AdminCommunityHuntsPage|components/hunt/|StatCell|ScatterPill|scatterTier|suggestionBoard|SuggestionBoard|livePreviewFormat|api/og|/api/roster|slot-profile|payout-profile|components/Modal'" src api`
Expected: no output.

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS (all suites).

Run: `CI=true npx react-scripts build`
Expected: `Compiled successfully.`, with no ESLint warnings.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore(hunts): remove the hunt tracker, share pages and profile cards"
```

---

### Task 10: Docs + end-to-end verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-27-communityhunts-integration-design.md` (addendum)

**Interfaces:** none.

- [ ] **Step 1: Update `CLAUDE.md`**

- **Commands** (line 11): replace the `npm start` bullet with:

```
- `npm start` — dev server on `localhost:3000` with proxy (`src/setupProxy.js`) providing dev mirrors of `/api/communityhunts`, `/api/leaderboard`, `/api/btc` and `/api/slots`, and forwarding `/api/me/*` to the deployed functions. Vercel serverless functions in `/api` only run in production unless you use `vercel dev`.
```

- **Serverless API:** replace the `bonus-hunts.js — …` bullet with:

```
- `communityhunts.js` — public read endpoint for the Hunts tab (`?view=overview` → `{ live, recent }`, `?view=hunt&id=` → `{ hunt }`), 30s in-memory cache + CDN `s-maxage`, stale-on-error. All communityhunts.gg access goes through `api/_lib/communityHunts.js`.
```

- **Dev vs prod proxying:** replace the `src/setupProxy.js` bullet with:

```
- `src/setupProxy.js` only runs under `npm start`. It mirrors the production Vercel handlers for `/api/communityhunts`, `/api/leaderboard`, `/api/btc` and `/api/slots`, and proxies `/api/me/*` to the deployed site (`API_PROXY_TARGET`). Keep it in sync when changing the matching `/api/*.js` function.
```

- **Gotchas:** in the third-party keys bullet, replace `Third-party API keys (BonusHunt, SlotsLaunch)` with `Third-party API keys (communityhunts.gg, SlotsLaunch)`, and replace `` `BONUSHUNT_API_KEY` `` with `` `COMMUNITYHUNTS_API_KEY` ``. Then add a new Gotchas bullet:

```
- Hunts + predictions run on communityhunts.gg (bonushunt.gg is gone). `COMMUNITYHUNTS_API_KEY` is the **Bean community** key (partner plan, read scope). communityhunts issues one key per community, so regenerating it breaks beantwitch.com, and both sites share Bean's 300 reads/min, which is why the server caches 30s and the tab polls 60s. GooferG's hunts are filtered by owner id (`COMMUNITYHUNTS_OWNER_ID`, default `usr_IT8I88O03xF3QHqHzqme95`). Prediction rounds (`hunts/{id}`, entries under `hunts/{id}/entries`) are payout-only: `source: 'communityhunts'|'manual'`, snapshot `{ huntId, totalCost, currency, bonusCount }`, and the admin settle modal's "Fill from hunt" reads the final `totalWon`. The old viewer Hunt Tracker, `/live/*` and `/hunt-suggest/*` share pages were removed.
```

- [ ] **Step 2: Add the spec addendum**

Append to the spec:

```markdown
## Addendum (implementation)

- **Entry path fix:** `PredictionSlip`, `PredictionWall` and `PredictionNumberLine` read entries from a legacy `prediction_rounds/{id}/entries` path that had no Firestore rule, while the server writes `hunts/{id}/entries`. All three now read `hunts/{id}/entries`.
- **`profitLoss` is client-side** (`src/utils/huntFormat.js`), not in `api/_lib/communityHunts.js`. The `npm start` dev mirror returns raw communityhunts shapes, and CRA can't import from `api/`, so the tab computes P/L itself from `pot`/`totalWon`.
- **Settling** now rejects an empty payout. It previously coerced `''` to `0`.
```

- [ ] **Step 3: Live smoke against the real API**

The `.env.local` key is required. Node 22+ loads the ESM `api/` files directly.

```bash
set -a; . <(grep -E '^COMMUNITYHUNTS_' .env.local | tr -d '\r'); set +a
node -e '
import("./api/communityhunts.js").then(async ({ default: handler }) => {
  const run = (query) => new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); return this; }, end() { resolve({ code: this.code }); } };
    handler({ method: "GET", query }, res);
  });
  const o = await run({ view: "overview" });
  console.log("overview", o.code, "live:", !!o.body.live, "recent:", o.body.recent && o.body.recent.length, "keys:", o.body.recent && Object.keys(o.body.recent[0] || {}).join(","));
  const id = o.body.recent && o.body.recent[0] && o.body.recent[0].id;
  if (id) { const h = await run({ view: "hunt", id }); console.log("hunt", h.code, "bonuses:", h.body.hunt && h.body.hunt.bonuses && h.body.hunt.bonuses.length, "calls stripped:", !("calls" in (h.body.hunt || {}))); }
});'
```

Expected:
- `overview 200 live: <bool> recent: <n>`, with keys including `id,status,huntType,currency,…,averageMultiple`.
- `hunt 200 bonuses: <n> calls stripped: true`.

- [ ] **Step 4: Final full verification**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS (all suites).

Run: `CI=true npx react-scripts build`
Expected: `Compiled successfully.`

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-27-communityhunts-integration-design.md
git commit -m "docs(hunts): CLAUDE.md and spec addendum for communityhunts integration"
```

- [ ] **Step 6: Hand off rollout to the user (don't run these)**

1. Add `COMMUNITYHUNTS_API_KEY` (and optionally `COMMUNITYHUNTS_OWNER_ID`) in Vercel before merging.
2. Push `feat/communityhunts` and open the PR (the user merges).
3. After the merge: `firebase deploy --only firestore:rules --project goofer-website`.
4. After the deploy is verified: remove `BONUSHUNT_API_KEY` from Vercel.
