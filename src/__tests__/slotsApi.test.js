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
