import { dropTwitchToken, getTwitchAccessToken, getTwitchClipsBetween, getTwitchUserId, getTwitchVideos, resetTwitchApiCache } from '../twitchApi';

const realFetch = global.fetch;

beforeEach(() => {
  resetTwitchApiCache();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'a' }] }) });
});

afterEach(() => {
  jest.useRealTimers();
  global.fetch = realFetch;
});

test('getTwitchVideos asks for the whole archive', async () => {
  await getTwitchVideos('tok', '42');
  expect(global.fetch.mock.calls[0][0]).toBe('https://api.twitch.tv/helix/videos?user_id=42&first=100&type=archive');
});

test('getTwitchClipsBetween sends both ends of the window', async () => {
  const clips = await getTwitchClipsBetween('tok', '42', '2026-08-05T19:00:00.000Z', '2026-10-04T19:00:00.000Z');
  const url = new URL(global.fetch.mock.calls[0][0]);
  expect(url.origin + url.pathname).toBe('https://api.twitch.tv/helix/clips');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    broadcaster_id: '42',
    first: '50',
    started_at: '2026-08-05T19:00:00.000Z',
    ended_at: '2026-10-04T19:00:00.000Z',
  });
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  expect(clips).toEqual([{ id: 'a' }]);
});

test('getTwitchClipsBetween throws on a Helix error', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
  await expect(getTwitchClipsBetween('tok', '42', 'a', 'b')).rejects.toThrow('429');
});

const tokenResponse = (token = 'tok', expires = 3600) => ({ ok: true, status: 200, json: async () => ({ access_token: token, expires_in: expires }) });

test('concurrent token callers share one request', async () => {
  global.fetch.mockResolvedValue(tokenResponse('abc'));
  const [a, b] = await Promise.all([getTwitchAccessToken(), getTwitchAccessToken()]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(a).toBe('abc');
  expect(b).toBe('abc');
  await getTwitchAccessToken();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('a token is fetched again once its lifetime has passed', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  global.fetch.mockResolvedValue(tokenResponse('abc', 3600));
  await getTwitchAccessToken();
  jest.setSystemTime(new Date('2026-10-04T12:54:00Z'));
  await getTwitchAccessToken();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  jest.setSystemTime(new Date('2026-10-04T12:56:00Z'));
  await getTwitchAccessToken();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('a failed token request throws and is not cached', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
  await expect(getTwitchAccessToken()).rejects.toThrow('twitch-token 500');
  global.fetch.mockResolvedValueOnce(tokenResponse('ok'));
  expect(await getTwitchAccessToken()).toBe('ok');
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('the user id is looked up once', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: '42' }] }) });
  expect(await getTwitchUserId('tok')).toBe('42');
  expect(await getTwitchUserId('tok')).toBe('42');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('dropping the token makes the next call fetch a fresh one', async () => {
  global.fetch.mockResolvedValue(tokenResponse('abc'));
  await getTwitchAccessToken();
  dropTwitchToken();
  await getTwitchAccessToken();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('a hung token request times out after 10s and is not cached', async () => {
  jest.useFakeTimers();
  global.fetch.mockImplementationOnce(
    (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
  );
  const first = getTwitchAccessToken();
  const settled = expect(first).rejects.toThrow('aborted');
  jest.advanceTimersByTime(10000);
  await settled;
  global.fetch.mockResolvedValueOnce(tokenResponse('again'));
  expect(await getTwitchAccessToken()).toBe('again');
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('a hung user lookup times out after 10s and is retried', async () => {
  jest.useFakeTimers();
  global.fetch.mockImplementationOnce(
    (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
  );
  const first = getTwitchUserId('tok');
  const settled = expect(first).rejects.toThrow('aborted');
  jest.advanceTimersByTime(10000);
  await settled;
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '7' }] }) });
  expect(await getTwitchUserId('tok')).toBe('7');
});

test('a missing user id throws and is not cached', async () => {
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
  await expect(getTwitchUserId('tok')).rejects.toThrow('twitch-user');
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '9' }] }) });
  expect(await getTwitchUserId('tok')).toBe('9');
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test.each([
  ['a real 5011271s expires_in', 5011271],
  ['a missing expires_in', undefined],
])('%s caps the lifetime at an hour', async (name, expires) => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  global.fetch.mockResolvedValue(
    expires === undefined ? { ok: true, status: 200, json: async () => ({ access_token: 'abc' }) } : tokenResponse('abc', expires)
  );
  await getTwitchAccessToken();
  jest.setSystemTime(new Date('2026-10-04T12:59:00Z'));
  await getTwitchAccessToken();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  jest.setSystemTime(new Date('2026-10-04T13:01:00Z'));
  await getTwitchAccessToken();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
