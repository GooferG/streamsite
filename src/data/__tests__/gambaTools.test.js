import {
  GAMBA_CHANNELS,
  GAMBA_HUB,
  GAMBA_TOOLS,
  channelForPath,
  channelLabel,
  subchannelLabel,
} from '../gambaTools';

test('tools carry the handoff channel numbers and their paths', () => {
  expect(GAMBA_TOOLS.map((t) => [t.id, t.channel, t.path])).toEqual([
    ['leaderboard', 1, '/gamba/leaderboard'],
    ['hunts', 2, '/gamba/hunts'],
    ['bonus-battle', 3, '/gamba/bonus-battle'],
    ['wheel', 4, '/gamba/wheel'],
  ]);
});

test('the hub is channel 00 and leads the channel list', () => {
  expect(GAMBA_HUB).toMatchObject({ id: 'hub', label: 'Hub', channel: 0, path: '/gamba' });
  expect(GAMBA_CHANNELS.map((c) => c.channel)).toEqual([0, 1, 2, 3, 4]);
});

test('channelLabel pads to two digits', () => {
  expect(channelLabel(GAMBA_HUB)).toBe('CH 00');
  expect(channelLabel(GAMBA_TOOLS[1])).toBe('CH 02');
});

test('subchannelLabel prefixes the parent nav code', () => {
  expect(subchannelLabel(GAMBA_HUB, '04')).toBe('4-0');
  expect(subchannelLabel(GAMBA_TOOLS[3], '04')).toBe('4-4');
});

test('channelForPath maps /gamba routes to their channel', () => {
  expect(channelForPath('/gamba')).toBe(GAMBA_HUB);
  expect(channelForPath('/gamba/')).toBe(GAMBA_HUB);
  expect(channelForPath('/gamba/hunts').id).toBe('hunts');
  expect(channelForPath('/gamba/nope')).toBeNull();
  expect(channelForPath('/schedule')).toBeNull();
  expect(channelForPath('/')).toBeNull();
});
