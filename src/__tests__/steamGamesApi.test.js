import handler from '../../api/steam-games';

test('steam-games is cached at the CDN', async () => {
  process.env.STEAM_API_KEY = 'k';
  process.env.STEAM_ID = 'id';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ response: { games: [{ appid: 1, name: 'X', playtime_forever: 120, playtime_2weeks: 60, img_icon_url: 'a' }] } }),
  });
  const res = { setHeader: jest.fn(), status: jest.fn(() => res), json: jest.fn(), end: jest.fn() };
  await handler({ method: 'GET' }, res);
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
  expect(res.json.mock.calls[0][0].games[0]).toMatchObject({ appid: 1, name: 'X', playtime_2weeks: 1 });
});
