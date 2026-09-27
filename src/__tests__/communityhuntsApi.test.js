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
  const GONE = { ...SUMMARY, id: 'gone' };
  global.fetch
    .mockResolvedValueOnce(upstream(200, { data: [LIVE] }))
    .mockResolvedValueOnce(upstream(200, { data: [GONE] }))
    .mockResolvedValueOnce(upstream(200, { data: LIVE }));
  const ok = mockRes();
  await handler(req({ view: 'hunt', id: 'live1' }), ok);
  expect(ok.body.hunt.id).toBe('live1');

  global.fetch.mockResolvedValueOnce(upstream(404, { error: { code: 'not_found' } }));
  const missing = mockRes();
  await handler(req({ view: 'hunt', id: 'gone' }), missing);
  expect(missing.statusCode).toBe(404);
  expect(missing.body).toEqual({ error: 'NOT_FOUND' });
});

// Review fix: arbitrary ids must not cost upstream reads on the shared Bean
// key (rate-limit drain) or proxy other owners' hunts.
test('hunt view refuses ids outside the owner overview without an upstream hunt read', async () => {
  global.fetch
    .mockResolvedValueOnce(upstream(200, { data: [] }))
    .mockResolvedValueOnce(upstream(200, { data: [SUMMARY] }));
  const res = mockRes();
  await handler(req({ view: 'hunt', id: 'someoneElse1' }), res);
  expect(res.statusCode).toBe(404);
  expect(res.body).toEqual({ error: 'NOT_FOUND' });
  const urls = global.fetch.mock.calls.map((c) => c[0]);
  expect(urls.some((u) => u.includes('/hunts/someoneElse1'))).toBe(false);

  // A second stranger id reuses the cached overview: still no upstream read.
  await handler(req({ view: 'hunt', id: 'someoneElse2' }), mockRes());
  expect(global.fetch).toHaveBeenCalledTimes(2);
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
