import { PAGE_LOADERS, __resetPrefetchForTests, prefetchRoute, routeKey } from '../loaders';

beforeEach(() => __resetPrefetchForTests());

test('routeKey reads the first path segment', () => {
  expect(routeKey('/gamba/hunts?fixture=open')).toBe('gamba');
  expect(routeKey('/vods')).toBe('vods');
  expect(routeKey('/')).toBeNull();
  expect(routeKey('https://twitch.tv/GooferG')).toBeNull();
});

test('prefetchRoute starts a page chunk once', async () => {
  const spy = jest.spyOn(PAGE_LOADERS, 'vods').mockResolvedValue({ default: () => null });
  const a = prefetchRoute('/vods');
  const b = prefetchRoute('/vods?tape=1');
  expect(a).toBe(b);
  await a;
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

test('eager pages and external links resolve without loading anything', async () => {
  const spy = jest.spyOn(PAGE_LOADERS, 'vods');
  await prefetchRoute('/gamba/hunts');
  await prefetchRoute('https://twitch.tv/GooferG');
  await prefetchRoute('/');
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

test('a failed load is retried on the next prefetch and never rejects', async () => {
  const spy = jest
    .spyOn(PAGE_LOADERS, 'store')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ default: () => null });
  await expect(prefetchRoute('/store')).resolves.toBeUndefined();
  await prefetchRoute('/store');
  expect(spy).toHaveBeenCalledTimes(2);
  spy.mockRestore();
});
