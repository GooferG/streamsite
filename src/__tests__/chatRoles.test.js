/**
 * @jest-environment node
 */
import { isFollower, rolesFromBadges } from '../../api/_lib/chatRoles.js';
import { getBroadcasterAccessToken, helix } from '../../api/_lib/twitchBroadcasterToken.js';

jest.mock('../../api/_lib/twitchBroadcasterToken.js', () => ({
  helix: jest.fn(),
  getBroadcasterAccessToken: jest.fn(),
}));

beforeEach(() => {
  process.env.TWITCH_BROADCASTER_ID = 'b1';
  getBroadcasterAccessToken.mockResolvedValue('tok');
  helix.mockResolvedValue({ data: [{ user_id: 'v1' }] });
});

test('rolesFromBadges', () => {
  expect(rolesFromBadges([{ set_id: 'founder' }, { set_id: 'vip' }])).toEqual({ isTwitchSub: true, isVip: true, isMod: false });
  expect(rolesFromBadges([{ set_id: 'broadcaster' }]).isMod).toBe(true);
  expect(rolesFromBadges(undefined)).toEqual({ isTwitchSub: false, isVip: false, isMod: false });
});

test('isFollower asks Helix once per chatter per call', async () => {
  const cache = new Map();
  expect(await isFollower('v1', cache)).toBe(true);
  expect(await isFollower('v1', cache)).toBe(true);
  expect(helix).toHaveBeenCalledTimes(1);
  helix.mockRejectedValue(new Error('boom'));
  expect(await isFollower('v2', cache)).toBeNull();
});
