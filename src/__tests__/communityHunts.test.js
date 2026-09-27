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
