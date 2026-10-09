import {
  AUTO_POST_WINDOW_MS,
  DRAW_REVEAL_MS,
  WINNER_HOLD_MS,
  arrivals,
  ballSignature,
  drawAnnounceDueAt,
  drawMoment,
  drawPhase,
  drawnEntries,
  drumBalls,
  formatMulti,
  hasResults,
  isActive,
  leaderRow,
  liveRows,
  pendingDrawAnnounces,
  prizeText,
  recentBalls,
  takenSlots,
  winnerMoment,
} from '../ball';

const at = (ms) => ({ toMillis: () => ms });
const T = 1_000_000;
const e = (drawNo, extra = {}) => ({
  drawNo,
  twitchId: `v${drawNo}`,
  displayName: `V${drawNo}`,
  slotId: `s${drawNo}`,
  slotName: `Slot ${drawNo}`,
  drawnAt: at(T + drawNo * 20_000),
  scratched: false,
  ...extra,
});

test('constants', () => {
  expect(DRAW_REVEAL_MS).toBe(8000);
  expect(WINNER_HOLD_MS).toBe(12000);
});

test('drawPhase follows the takeover beats', () => {
  expect([0, 599, 600, 2999, 3000, 4199, 4200, 5199, 5200, 7399, 7400, 7999].map(drawPhase)).toEqual([
    'cut', 'cut', 'blower', 'blower', 'tube', 'tube', 'spin', 'spin', 'hold', 'hold', 'out', 'out',
  ]);
  expect(drawPhase(8000)).toBeNull();
  expect(drawPhase(null)).toBeNull();
});

test('drawMoment: only the latest unscratched draw, only while it plays', () => {
  const round = { id: 'r1', rack: [e(1), e(2)] };
  const drawnAt = T + 40_000;
  expect(drawMoment(round, drawnAt + 1000)).toMatchObject({ kind: 'draw', key: 'r1:2', at: drawnAt, endsAt: drawnAt + 8000 });
  expect(drawMoment(round, drawnAt - 500)).toMatchObject({ key: 'r1:2' });
  expect(drawMoment(round, drawnAt + DRAW_REVEAL_MS)).toBeNull();
  expect(drawMoment({ id: 'r1', rack: [e(1), e(2, { scratched: true })] }, drawnAt + 1000)).toBeNull();
  expect(drawMoment({ id: 'r1', rack: [] }, T)).toBeNull();
  expect(drawMoment(null, T)).toBeNull();
});

test('winnerMoment', () => {
  const settled = { id: 'r1', status: 'settled', settledAt: at(T), winner: { drawNo: 1 } };
  expect(winnerMoment(settled, T + 1000)).toEqual({ kind: 'winner', key: 'r1:winner', at: T, endsAt: T + 12000 });
  expect(winnerMoment(settled, T + WINNER_HOLD_MS)).toBeNull();
  expect(winnerMoment({ ...settled, status: 'closed' }, T + 1000)).toBeNull();
});

test('lists', () => {
  expect(isActive({ status: 'open' })).toBe(true);
  expect(isActive({ status: 'closed' })).toBe(true);
  expect(isActive({ status: 'settled' })).toBe(false);
  expect(isActive(null)).toBe(false);
  const balls = [
    { id: 'a', status: 'drum', enteredAt: at(3) },
    { id: 'b', status: 'drawn', enteredAt: at(1) },
    { id: 'c', status: 'drum', enteredAt: at(5) },
  ];
  expect(drumBalls(balls).map((b) => b.id)).toEqual(['a', 'c']);
  expect(recentBalls(balls, 2).map((b) => b.id)).toEqual(['c', 'a']);
  expect(drawnEntries({ rack: [e(1), e(2, { scratched: true })] }).map((x) => x.drawNo)).toEqual([1]);
});

test('prizeText and formatMulti match the server', () => {
  expect(prizeText({ tickets: 200, prize: { kind: 'cash', amount: 5 } })).toBe('200 tickets + $5');
  expect(prizeText({ tickets: 0, prize: { kind: 'bonus', amount: 10 } })).toBe('Bonus buy $10');
  expect(prizeText(null)).toBe('');
  expect(formatMulti(1204)).toBe('1,204x');
  expect(formatMulti(null)).toBe('—');
});

test('takenSlots: the drum and the rack hold slots; scratches are marked', () => {
  const balls = [
    { slotId: 's1', status: 'drum', displayName: 'A' },
    { slotId: 's2', status: 'drawn', displayName: 'B' },
    { slotId: 's3', status: 'scratched', displayName: 'C' },
  ];
  const map = takenSlots({ rack: [e(3, { slotId: 's3', displayName: 'C', scratched: true })] }, balls);
  expect(map.get('s1')).toEqual({ holder: 'A', scratched: false });
  expect(map.get('s2')).toEqual({ holder: 'B', scratched: false });
  expect(map.get('s3')).toEqual({ holder: 'C', scratched: true });
});

test('liveRows, leaderRow, hasResults', () => {
  const round = { id: 'r1', status: 'open', rack: [e(1, { slotName: 'Gates of Olympus' }), e(2, { slotName: 'Sugar Rush' })] };
  const hunt = { bonuses: [{ slot: 'Gates of Olympus', multiplier: 50 }, { slot: 'Sugar Rush', multiplier: 120 }] };
  const rows = liveRows(round, hunt);
  expect(rows.map((r) => r.multiplier)).toEqual([50, 120]);
  expect(leaderRow(rows).drawNo).toBe(2);
  expect(hasResults(liveRows(round, null))).toBe(false);
  const settled = { ...round, status: 'settled', results: { 1: { multiplier: 9, win: 9, bet: 1, source: 'manual' } } };
  expect(liveRows(settled, hunt).map((r) => r.multiplier)).toEqual([9, null]);
});

test('draw lines: due after the reveal plus the stream delay; every unannounced fresh draw is pending', () => {
  expect(drawAnnounceDueAt(e(1))).toBe(T + 20_000 + 8000 + 3000);
  const round = { rack: [e(1), e(2), e(3, { scratched: true })], announced: { draws: { d1: at(5) } } };
  expect(pendingDrawAnnounces(round, T + 50_000).map((x) => x.drawNo)).toEqual([2]);
  expect(pendingDrawAnnounces(round, T + 40_000 + AUTO_POST_WINDOW_MS + 1)).toEqual([]);
});

test('arrivals: new balls and swaps, never drawn or unchanged ones', () => {
  const before = ballSignature([
    { id: 'a', status: 'drum', slotId: 's1' },
    { id: 'b', status: 'drum', slotId: 's2' },
    { id: 'c', status: 'scratched', slotId: 's3' },
  ]);
  const after = [
    { id: 'a', status: 'drum', slotId: 's1', displayName: 'A', slotName: 'One' },
    { id: 'b', status: 'drum', slotId: 's9', displayName: 'B', slotName: 'Nine' },
    { id: 'c', status: 'drum', slotId: 's4', displayName: 'C', slotName: 'Four' },
    { id: 'd', status: 'drum', slotId: 's5', displayName: 'D', slotName: 'Five' },
    { id: 'e', status: 'drawn', slotId: 's6', displayName: 'E', slotName: 'Six' },
  ];
  expect(arrivals(before, after)).toEqual([
    { id: 'b:s9', name: 'B', slotName: 'Nine', kind: 'swap' },
    { id: 'c:s4', name: 'C', slotName: 'Four', kind: 'new' },
    { id: 'd:s5', name: 'D', slotName: 'Five', kind: 'new' },
  ]);
});
