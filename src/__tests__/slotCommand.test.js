/**
 * @jest-environment node
 */
import { __resetSlotCommandForTests, handleSlotCommand, parseSlotCommand } from '../../api/_lib/slotCommand.js';
import { __fake } from '../../api/_lib/firebaseAdmin.js';
import { sendChannelMessage } from '../../api/_lib/twitchChat.js';
import { getSlotCatalog } from '../../api/_lib/communityHunts.js';
import { isFollower } from '../../api/_lib/chatRoles.js';
import { CHOICE_TTL_MS } from '../../api/_lib/ballRules.js';

jest.mock('../../api/_lib/firebaseAdmin.js', () => {
  const { createFakeFirestore } = require('../test/fakeFirestore');
  const fake = createFakeFirestore();
  return { adminDb: fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp, __fake: fake };
});
jest.mock('../../api/_lib/twitchChat.js', () => ({ sendChannelMessage: jest.fn() }));
jest.mock('../../api/_lib/communityHunts.js', () => ({ getSlotCatalog: jest.fn() }));
jest.mock('../../api/_lib/chatRoles.js', () => ({
  ...jest.requireActual('../../api/_lib/chatRoles.js'),
  isFollower: jest.fn(),
}));

const NOW = 2_000_000;
const ROWS = [
  { rainbetSlug: 'gates-of-olympus', name: 'Gates of Olympus', thumb: 'https://img/goo.png', bonusBuy: true },
  { rainbetSlug: 'gates-of-olympus-1000', name: 'Gates of Olympus 1000', bonusBuy: true },
  { rainbetSlug: 'sugar-rush', name: 'Sugar Rush', bonusBuy: true },
  { rainbetSlug: 'book-of-dead', name: 'Book of Dead', bonusBuy: false },
  { rainbetSlug: 'big-bass-bonanza', name: 'Big Bass Bonanza', bonusBuy: true },
  { rainbetSlug: 'big-bass-splash', name: 'Big Bass Splash', bonusBuy: true },
];

const event = (text, over = {}) => ({
  chatter_user_id: 'v1',
  chatter_user_login: 'viewer1',
  chatter_user_name: 'Viewer1',
  message_id: 'msg1',
  message: { text },
  badges: [],
  ...over,
});
const run = (text, over, now = NOW) => handleSlotCommand(event(text, over), { now });
const replies = () => sendChannelMessage.mock.calls.map(([text]) => text);
const ball = (id = 'v1') => __fake.read(`ball_rounds/r1/balls/${id}`);
const claimIds = () => __fake.paths('ball_rounds/r1/claims').map((p) => p.split('/').pop());

function seedOpen(extra = {}) {
  __fake.seed('ball_rounds/r1', { status: 'open', requireFollow: true, rack: [], prize: { tickets: 200, prize: null }, ...extra });
}
function seedBall(id, data) {
  __fake.seed(`ball_rounds/r1/balls/${id}`, { twitchId: id, displayName: id, status: 'drum', drawNo: null, ...data });
}

beforeEach(() => {
  __fake.reset();
  __resetSlotCommandForTests();
  sendChannelMessage.mockResolvedValue({ ok: true });
  getSlotCatalog.mockResolvedValue(ROWS);
  isFollower.mockResolvedValue(true);
});

test('parseSlotCommand', () => {
  expect(parseSlotCommand('!slot gates')).toBe('gates');
  expect(parseSlotCommand('  !SLOT   Gates  ')).toBe('Gates');
  expect(parseSlotCommand('!slot')).toBe('');
  expect(parseSlotCommand('!slots gates')).toBeNull();
  expect(parseSlotCommand('hello !slot gates')).toBeNull();
  expect(parseSlotCommand(`!slot ${'x'.repeat(300)}`)).toHaveLength(80);
});

test('not the command, or no open round: nothing happens', async () => {
  expect(await run('hello')).toEqual({ handled: false });
  expect(await run('!slot gates of olympus')).toMatchObject({ handled: true, outcome: 'NO_ROUND' });
  seedOpen({ status: 'closed' });
  expect(await run('!slot gates of olympus')).toMatchObject({ outcome: 'NO_ROUND' });
  expect(replies()).toEqual([]);
  expect(__fake.paths('ball_rounds/r1/balls')).toEqual([]);
});

test('an exact name enters silently and never writes the round doc', async () => {
  seedOpen();
  const before = __fake.read('ball_rounds/r1');
  expect(await run('!slot Gates of Olympus')).toMatchObject({ outcome: 'NEW', replied: false });
  expect(ball()).toMatchObject({
    twitchId: 'v1',
    twitchName: 'viewer1',
    displayName: 'Viewer1',
    slotId: 'gates-of-olympus',
    slotName: 'Gates of Olympus',
    thumb: 'https://img/goo.png',
    status: 'drum',
    drawNo: null,
  });
  expect(claimIds()).toEqual(['gates-of-olympus']);
  expect(__fake.read('ball_rounds/r1/claims/gates-of-olympus')).toMatchObject({ twitchId: 'v1', scratched: false });
  expect(replies()).toEqual([]);
  expect(__fake.read('ball_rounds/r1')).toEqual(before);
});

test('a guess is confirmed in a threaded reply', async () => {
  seedOpen();
  await run('!slot gates olympus');
  expect(ball().slotName).toBe('Gates of Olympus');
  expect(sendChannelMessage).toHaveBeenCalledWith('@Viewer1 → Gates of Olympus is in the drum', { replyTo: 'msg1' });
});

test('the follow gate: followers in, others told, mods and VIPs and open rounds skip it', async () => {
  seedOpen();
  isFollower.mockResolvedValue(false);
  expect(await run('!slot sugar rush')).toMatchObject({ outcome: 'NOT_FOLLOWING' });
  expect(replies()).toEqual(['@Viewer1 follow the channel to call a slot in.']);
  expect(ball()).toBeUndefined();
  isFollower.mockClear();
  await run('!slot sugar rush', { chatter_user_id: 'm1', badges: [{ set_id: 'moderator' }] });
  expect(isFollower).not.toHaveBeenCalled();
  expect(ball('m1').slotName).toBe('Sugar Rush');
  __fake.reset();
  seedOpen({ requireFollow: false });
  await run('!slot sugar rush', { chatter_user_id: 'v9' });
  expect(isFollower).not.toHaveBeenCalled();
  expect(ball('v9').slotName).toBe('Sugar Rush');
});

test('ambiguous: a numbered list, then !slot 2 picks from it; a stale or missing list is refused', async () => {
  seedOpen();
  await run('!slot big bass');
  expect(replies()).toEqual(['@Viewer1 did you mean 1. Big Bass Splash · 2. Big Bass Bonanza? Type !slot 1-2']);
  expect(ball()).toBeUndefined();
  await run('!slot 2', {}, NOW + 11_000);
  expect(ball().slotName).toBe('Big Bass Bonanza');

  await run('!slot 1', { chatter_user_id: 'v2' }, NOW + 30_000);
  expect(replies()).toContain('@Viewer1 that pick list expired. Type !slot <slot name>.');
  await run('!slot big bass', { chatter_user_id: 'v3' }, NOW);
  await run('!slot 1', { chatter_user_id: 'v3' }, NOW + CHOICE_TTL_MS + 1);
  expect(ball('v3')).toBeUndefined();
});

test('no bonus buy, unknown names, emoji and very long input', async () => {
  seedOpen();
  await run('!slot book of dead', {}, NOW);
  await run('!slot 🎰🎰🎰', { chatter_user_id: 'v2' });
  await run(`!slot ${'x'.repeat(300)}`, { chatter_user_id: 'v3' });
  expect(replies()).toEqual([
    '@Viewer1 Book of Dead has no bonus buy. Pick another.',
    '@Viewer1 couldn\'t find "🎰🎰🎰". Exact names: goofer.tv/gamba/ball',
    `@Viewer1 couldn't find "${'x'.repeat(40)}…". Exact names: goofer.tv/gamba/ball`,
  ]);
  expect(__fake.paths('ball_rounds/r1/balls')).toEqual([]);
});

test('taken, scratched, and a drawn ball is locked', async () => {
  seedOpen();
  __fake.seed('ball_rounds/r1/claims/gates-of-olympus', { twitchId: 'v2', displayName: 'First', scratched: false });
  __fake.seed('ball_rounds/r1/claims/sugar-rush', { twitchId: 'v2', displayName: 'First', scratched: true });
  await run('!slot gates of olympus');
  await run('!slot sugar rush', {}, NOW + 11_000);
  seedBall('v4', { slotId: 'gates-of-olympus-1000', slotName: 'Gates of Olympus 1000', status: 'drawn', drawNo: 1 });
  await run('!slot book of dead', { chatter_user_id: 'v4' });
  await run('!slot big bass bonanza', { chatter_user_id: 'v4' }, NOW + 11_000);
  expect(replies()).toEqual([
    '@Viewer1 Gates of Olympus is taken by @First. Pick another.',
    '@Viewer1 Sugar Rush was scratched tonight. Pick another.',
    '@Viewer1 Book of Dead has no bonus buy. Pick another.',
    "@Viewer1 your ball's already on the rack: Gates of Olympus 1000.",
  ]);
  expect(ball('v4').slotName).toBe('Gates of Olympus 1000');
});

test('swap moves the claim; the same slot again is a silent no-op; a scratched ball may call again', async () => {
  seedOpen();
  await run('!slot gates of olympus');
  await run('!slot sugar rush', {}, NOW + 11_000);
  expect(claimIds()).toEqual(['sugar-rush']);
  expect(ball().slotName).toBe('Sugar Rush');
  expect(replies()).toEqual(['@Viewer1 swapped to Sugar Rush']);
  expect(await run('!slot sugar rush', {}, NOW + 30_000)).toMatchObject({ outcome: 'SAME', replied: false });

  seedBall('v5', { slotId: 'big-bass-splash', slotName: 'Big Bass Splash', status: 'scratched', drawNo: 2 });
  __fake.seed('ball_rounds/r1/claims/big-bass-splash', { twitchId: 'v5', scratched: true });
  await run('!slot gates of olympus', { chatter_user_id: 'v5' });
  expect(ball('v5')).toMatchObject({ slotName: 'Gates of Olympus', status: 'drum' });
  expect(claimIds()).toEqual(['big-bass-splash', 'gates-of-olympus', 'sugar-rush']);
});

test('a bare !slot reports your ball or how to enter', async () => {
  seedOpen();
  await run('!slot');
  seedBall('v2', { slotName: 'Sugar Rush', status: 'drum' });
  await run('!slot', { chatter_user_id: 'v2' });
  expect(replies()).toEqual(['@Viewer1 type !slot <slot name> to call one in', '@Viewer1 your ball: Sugar Rush (in the drum)']);
});

test('one reply per viewer per 10s; a failed reply never undoes the entry', async () => {
  seedOpen();
  await run('!slot zzzz qqqq');
  await run('!slot zzzz qqqq', {}, NOW + 1000);
  expect(sendChannelMessage).toHaveBeenCalledTimes(1);
  sendChannelMessage.mockRejectedValue(new Error('CHAT_DROPPED:x'));
  await expect(run('!slot gates olympus', { chatter_user_id: 'v7' })).resolves.toMatchObject({ outcome: 'GUESS' });
  expect(ball('v7').slotName).toBe('Gates of Olympus');
});

test('catalogue down: refused with a retry line', async () => {
  seedOpen();
  getSlotCatalog.mockRejectedValue(new Error('down'));
  await run('!slot gates of olympus');
  expect(replies()).toEqual(['@Viewer1 slot list is down, try again in a minute.']);
});
