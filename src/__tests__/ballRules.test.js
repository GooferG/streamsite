/**
 * @jest-environment node
 */
import {
  ACTIVE_STATUSES,
  DRAW_REVEAL_MS,
  ballPrizeLabel,
  drawKey,
  drawLine,
  entryDecision,
  formatMulti,
  hasPrize,
  openedLine,
  replyText,
  resultsLine,
  sanitizeBallPrize,
  scratchLine,
  slotKey,
} from '../../api/_lib/ballRules.js';

test('constants', () => {
  expect(DRAW_REVEAL_MS).toBe(8000);
  expect(ACTIVE_STATUSES).toEqual(['open', 'closed']);
  expect(drawKey(3)).toBe('d3');
});

test('prize: tickets clamp to whole numbers, money goes through the prediction sanitizer', () => {
  expect(sanitizeBallPrize({ tickets: '200.7', prize: { kind: 'cash', amount: '5' } })).toEqual({
    tickets: 200,
    prize: { kind: 'cash', amount: 5 },
  });
  expect(sanitizeBallPrize({ tickets: -4, prize: { kind: 'gold', amount: 5 } })).toEqual({ tickets: 0, prize: null });
  expect(sanitizeBallPrize(null)).toEqual({ tickets: 0, prize: null });
  expect(hasPrize({ tickets: 0, prize: null })).toBe(false);
  expect(hasPrize({ tickets: 1, prize: null })).toBe(true);
  expect(hasPrize({ tickets: 0, prize: { kind: 'bonus', amount: 10 } })).toBe(true);
});

test('prize label', () => {
  expect(ballPrizeLabel({ tickets: 200, prize: { kind: 'cash', amount: 5 } })).toBe('200 tickets + $5');
  expect(ballPrizeLabel({ tickets: 1500, prize: null })).toBe('1,500 tickets');
  expect(ballPrizeLabel({ tickets: 0, prize: { kind: 'bonus', amount: 10 } })).toBe('Bonus buy $10');
  expect(ballPrizeLabel(null)).toBe('');
});

test('formatMulti', () => {
  expect(formatMulti(412)).toBe('412x');
  expect(formatMulti(12.456)).toBe('12.46x');
  expect(formatMulti(1204)).toBe('1,204x');
  expect(formatMulti(null)).toBe('—');
});

test('slotKey always makes a legal Firestore doc id', () => {
  expect(slotKey('gates-of-olympus')).toBe('gates-of-olympus');
  for (const id of ['a/b', '.', '..', '__x__', 'big.bass', 'Fire & Roses']) {
    const key = slotKey(id);
    expect(key).not.toMatch(/\//);
    expect(key).not.toBe('.');
    expect(key).not.toBe('..');
    expect(key).not.toMatch(/^__.*__$/);
    expect(key.length).toBeGreaterThan(0);
  }
  expect(slotKey('a/b')).not.toBe(slotKey('a_b'));
});

describe('entryDecision', () => {
  const me = 'v1';
  test('a first call is NEW', () => {
    expect(entryDecision({ ball: null, claim: null, slotId: 's1', twitchId: me })).toEqual({ code: 'NEW' });
  });
  test('a drawn ball is locked', () => {
    const ball = { status: 'drawn', slotId: 's1', slotName: 'Sugar Rush' };
    expect(entryDecision({ ball, claim: null, slotId: 's2', twitchId: me })).toEqual({ code: 'ALREADY_DRAWN', slotName: 'Sugar Rush' });
  });
  test('someone else holds the slot', () => {
    const claim = { twitchId: 'v2', displayName: 'First', scratched: false };
    expect(entryDecision({ ball: null, claim, slotId: 's1', twitchId: me })).toEqual({ code: 'TAKEN', holder: 'First' });
  });
  test('a scratched slot is blocked for everyone, owner included', () => {
    expect(entryDecision({ ball: null, claim: { twitchId: 'v2', scratched: true }, slotId: 's1', twitchId: me }).code).toBe('SCRATCHED');
    const ball = { status: 'scratched', slotId: 's1' };
    expect(entryDecision({ ball, claim: { twitchId: me, scratched: true }, slotId: 's1', twitchId: me }).code).toBe('SCRATCHED');
  });
  test('a scratched ball frees its owner to call a new slot', () => {
    const ball = { status: 'scratched', slotId: 's1' };
    expect(entryDecision({ ball, claim: null, slotId: 's2', twitchId: me })).toEqual({ code: 'NEW' });
  });
  test('swap and same', () => {
    const ball = { status: 'drum', slotId: 's1' };
    expect(entryDecision({ ball, claim: null, slotId: 's2', twitchId: me })).toEqual({ code: 'SWAP', oldSlotId: 's1' });
    expect(entryDecision({ ball, claim: { twitchId: me, scratched: false }, slotId: 's1', twitchId: me })).toEqual({ code: 'SAME' });
  });
});

test('bot replies match the spec outcomes table', () => {
  const name = 'Viewer1';
  expect(replyText('GUESS', { name, slotName: 'Gates of Olympus 1000' })).toBe('@Viewer1 → Gates of Olympus 1000 is in the drum');
  expect(replyText('SWAP', { name, slotName: 'Sugar Rush' })).toBe('@Viewer1 swapped to Sugar Rush');
  expect(
    replyText('AMBIGUOUS', {
      name,
      options: [{ name: 'Sweet Bonanza 1000' }, { name: 'Sweet Bonanza Xmas' }, { name: 'Sweet Bonanza Super Scatter' }],
    })
  ).toBe('@Viewer1 did you mean 1. Sweet Bonanza 1000 · 2. Sweet Bonanza Xmas · 3. Sweet Bonanza Super Scatter? Type !slot 1-3');
  expect(replyText('NOT_FOUND', { name, query: 'xyz' })).toBe('@Viewer1 couldn\'t find "xyz". Exact names: goofer.tv/gamba/ball');
  expect(replyText('NOT_FOUND', { name, query: 'x'.repeat(300) })).toBe(`@Viewer1 couldn't find "${'x'.repeat(40)}…". Exact names: goofer.tv/gamba/ball`);
  expect(replyText('NO_BONUS_BUY', { name, slotName: 'Book of Dead' })).toBe('@Viewer1 Book of Dead has no bonus buy. Pick another.');
  expect(replyText('TAKEN', { name, slotName: 'Gates of Olympus', holder: 'first' })).toBe('@Viewer1 Gates of Olympus is taken by @first. Pick another.');
  expect(replyText('SCRATCHED', { name, slotName: 'Gates of Olympus' })).toBe('@Viewer1 Gates of Olympus was scratched tonight. Pick another.');
  expect(replyText('ALREADY_DRAWN', { name, slotName: 'Sugar Rush' })).toBe("@Viewer1 your ball's already on the rack: Sugar Rush.");
  expect(replyText('NOT_FOLLOWING', { name })).toBe('@Viewer1 follow the channel to call a slot in.');
  expect(replyText('STATUS', { name, slotName: 'Sugar Rush', status: 'drum' })).toBe('@Viewer1 your ball: Sugar Rush (in the drum)');
  expect(replyText('HOW_TO', { name })).toBe('@Viewer1 type !slot <slot name> to call one in');
  expect(replyText('BAD_PICK', { name })).toBe('@Viewer1 that pick list expired. Type !slot <slot name>.');
  expect(replyText('CATALOG_DOWN', { name })).toBe('@Viewer1 slot list is down, try again in a minute.');
});

test('chat lines', () => {
  const round = { prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } } };
  expect(openedLine(round)).toBe(
    '🎱 Goofer Ball is open! Type !slot <slot name> to call one in. Top multi wins 200 tickets + $5. Exact names: goofer.tv/gamba/ball'
  );
  const entry = { drawNo: 3, slotName: 'Gates of Olympus', displayName: 'CoolGuy', twitchName: 'coolguy' };
  expect(drawLine(entry)).toBe('🎱 Ball 3: Gates of Olympus, called in by @CoolGuy');
  expect(scratchLine(entry)).toBe("🎱 Ball 3 scratched (Gates of Olympus isn't available tonight). @CoolGuy, call another slot.");
  expect(resultsLine({ ...round, winner: { ...entry, multiplier: 412 } })).toBe(
    "🎱 Tonight's winning ball: Gates of Olympus at 412x. @CoolGuy wins 200 tickets + $5."
  );
});
