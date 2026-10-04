import { getTwitchClipsBetween, getTwitchVideos } from '../twitchApi';

const realFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'a' }] }) });
});

afterEach(() => {
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
