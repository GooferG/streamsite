import { pillCounter, pillState, tabLeds, tallies } from '../panelStatus';

const NOW = 1_700_000_000_000;
const at = (ms) => ({ toMillis: () => ms });

test('an open timed giveaway shows its countdown and entries', () => {
  const g = { status: 'open', closesAt: at(NOW + 42_000), entryCount: 128 };
  expect(pillState({ giveaway: g, now: NOW })).toEqual({ label: 'GVW 00:42 · 128 IN', tone: 'live' });
});

// Review Focus 4: no timer, no countdown.
test('an open giveaway without a timer says OPEN', () => {
  const g = { status: 'open', closesAt: null, entryCount: 3 };
  expect(pillState({ giveaway: g, now: NOW })).toEqual({ label: 'GVW OPEN · 3 IN', tone: 'live' });
});

test('an unconfirmed pick needs attention; a confirmed one does not', () => {
  const pick = { status: 'rolling', winnerTwitchId: 'tw', winners: [], winner: { displayName: 'SlotGoblin' } };
  expect(pillState({ giveaway: pick, now: NOW })).toEqual({ label: 'GVW PICK · SLOTGOBLIN', tone: 'attention' });
  const done = { ...pick, winners: [{ twitchId: 'tw' }] };
  expect(pillState({ giveaway: done, now: NOW }).tone).toBe('live');
});

test('closed, playing, rounds and idle', () => {
  expect(pillState({ giveaway: { status: 'closed', entryCount: 9 } }).label).toBe('GVW CLOSED · 9 IN');
  expect(pillState({ giveaway: { status: 'playing', playing: { twitchName: 'bean' } } }).label).toBe('GVW PLAYING · BEAN');
  expect(pillState({ round: { status: 'locked', entryCount: 212 } })).toEqual({ label: 'PRD LOCKED · 212', tone: 'attention' });
  expect(pillState({ round: { status: 'open', entryCount: 5 } }).tone).toBe('live');
  expect(pillState({})).toEqual({ label: 'CONTROL ROOM', tone: 'idle' });
});

test('warnings or lost data turn the tone red', () => {
  expect(pillState({ warnings: [{ id: 1 }] }).tone).toBe('error');
  expect(pillState({ dataLost: true }).tone).toBe('error');
});

test('tallies and tab LEDs', () => {
  expect(tallies({ isLive: true, giveaway: null, activeRound: { status: 'open' } })).toEqual({ live: true, gvw: false, prd: true, red: 0 });
  expect(tabLeds({ giveaway: null, activeRound: null })).toEqual({ giveaway: 'off', predict: 'off', redeem: 'off' });
  expect(tabLeds({ giveaway: { status: 'open' }, activeRound: { status: 'locked' } })).toEqual({ giveaway: 'on', predict: 'pulse', redeem: 'off' });
  expect(tabLeds({ giveaway: { status: 'rolling', winnerTwitchId: 'tw', winners: [] }, activeRound: null }).giveaway).toBe('pulse');
});

test('redemptions: the tally counts, the LED pulses only while something is unseen', () => {
  expect(tallies({ redeem: { pending: 3, unseen: 0 } }).red).toBe(3);
  expect(tabLeds({ redeem: { pending: 3, unseen: 0 } }).redeem).toBe('on');
  expect(tabLeds({ redeem: { pending: 3, unseen: 1 } }).redeem).toBe('pulse');
  expect(tabLeds({ redeem: { pending: 0, unseen: 0 } }).redeem).toBe('off');
});

test('the pill counter shows only when something is pending', () => {
  expect(pillCounter(undefined)).toBeNull();
  expect(pillCounter({ pending: 0, unseen: 0 })).toBeNull();
  expect(pillCounter({ pending: 2, unseen: 0 })).toEqual({ label: 'RED 2', pulse: false });
  expect(pillCounter({ pending: 2, unseen: 1 })).toEqual({ label: 'RED 2', pulse: true });
});
