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
  revealAt,
  settleRevealAt,
  spoilerSafe,
  withScratched,
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
  const hunt = { bonuses: [{ slot: 'Gates of Olympus', multiplier: 50, win: 50 }, { slot: 'Sugar Rush', multiplier: 120, win: 120 }] };
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

describe('spoilerSafe', () => {
  const draw = (n, ms, extra = {}) => e(n, { drawnAt: at(ms), ...extra });
  const DUE = DRAW_REVEAL_MS + 3000;

  test('revealAt and settleRevealAt are the chat line times', () => {
    expect(revealAt(draw(1, T))).toBe(T + DUE);
    expect(settleRevealAt({ settledAt: at(T) })).toBe(T + 3000);
    expect(settleRevealAt({})).toBeNull();
  });

  test('a draw inside the delay leaves the rack and its ball goes back in the drum', () => {
    const round = { id: 'r', status: 'open', rack: [draw(1, T - 60_000), draw(2, T - 2000)] };
    const balls = [
      { id: 'a', status: 'drawn', drawNo: 1 },
      { id: 'b', status: 'drawn', drawNo: 2 },
      { id: 'c', status: 'drum', drawNo: null },
    ];
    const out = spoilerSafe({ round, balls, past: [] }, T);
    expect(out.round.rack.map((x) => x.drawNo)).toEqual([1]);
    expect(out.balls[1]).toEqual({ id: 'b', status: 'drum', drawNo: null });
    expect(out.balls[0].status).toBe('drawn');
    expect(out.nextAt).toBe(T - 2000 + DUE);
    const later = spoilerSafe({ round, balls, past: [] }, T + 12_000);
    expect(later.round.rack).toHaveLength(2);
    expect(later.balls[1].status).toBe('drawn');
    expect(later.nextAt).toBeNull();
  });

  test('a fresh settle shows as closed without winner or results; old past rounds filter out', () => {
    const settled = { id: 'r', status: 'settled', rack: [], settledAt: at(T - 1000), winner: { drawNo: 1 }, results: { 1: {} } };
    const out = spoilerSafe({ round: settled, balls: [], past: [settled, { id: 'old', status: 'settled', settledAt: at(T - 99_000), winner: {} }] }, T);
    expect(out.round.status).toBe('closed');
    expect(out.round.winner).toBeUndefined();
    expect(out.round.results).toBeUndefined();
    expect(out.past.map((r) => r.id)).toEqual(['old']);
    expect(out.nextAt).toBe(T - 1000 + 3000);
    expect(spoilerSafe({ round: settled, balls: [], past: [settled] }, T + 2000).round.status).toBe('settled');
  });

  test('null and undefined rounds pass through', () => {
    expect(spoilerSafe({ round: undefined, balls: [], past: [] }, T).round).toBeUndefined();
    expect(spoilerSafe({ round: null, balls: [], past: [] }, T).nextAt).toBeNull();
  });
});

test('withScratched merges scratched draws in draw order', () => {
  const round = { rack: [e(1), e(2, { scratched: true }), e(3)] };
  const rows = [{ drawNo: 1, multiplier: 5 }, { drawNo: 3, multiplier: null }];
  expect(withScratched(round, rows).map((r) => [r.drawNo, !!r.scratched])).toEqual([[1, false], [2, true], [3, false]]);
  expect(withScratched({ rack: [e(1)] }, rows)).toBe(rows);
});

describe('anchored moments (clock skew)', () => {
  const local = 5_000_000;
  const anchored = (drawNo, ms) => ({ draws: new Map([[drawNo, ms]]), settle: null });

  test('an anchored draw plays from its anchor even when drawnAt is 20s in the past', () => {
    const round = { id: 'r1', rack: [e(1, { drawnAt: at(local - 20_000) })] };
    expect(drawMoment(round, local + 1000)).toBeNull();
    expect(drawMoment(round, local + 1000, anchored(1, local))).toMatchObject({ key: 'r1:1', at: local, endsAt: local + DRAW_REVEAL_MS });
  });

  test('an anchored draw plays even when drawnAt is 9s in the future', () => {
    const round = { id: 'r1', rack: [e(1, { drawnAt: at(local + 9_000) })] };
    expect(drawMoment(round, local + 500, anchored(1, local))).toMatchObject({ at: local });
    expect(drawMoment(round, local + DRAW_REVEAL_MS, anchored(1, local))).toBeNull();
  });

  test('an unanchored draw up to 10s in the future starts now; further out is null', () => {
    expect(drawMoment({ id: 'r1', rack: [e(1, { drawnAt: at(local + 5_000) })] }, local)).toMatchObject({ key: 'r1:1' });
    expect(drawMoment({ id: 'r1', rack: [e(1, { drawnAt: at(local + 15_000) })] }, local)).toBeNull();
  });

  test('the winner card anchors to the local settle time', () => {
    const settled = { id: 'r1', status: 'settled', settledAt: at(local - 30_000), winner: { drawNo: 1 } };
    expect(winnerMoment(settled, local + 1000)).toBeNull();
    expect(winnerMoment(settled, local + 1000, { draws: new Map(), settle: local })).toMatchObject({ at: local, endsAt: local + WINNER_HOLD_MS });
    const ahead = { ...settled, settledAt: at(local + 9_000) };
    expect(winnerMoment(ahead, local + 500, { draws: new Map(), settle: local })).toMatchObject({ at: local });
  });
});

test('takenSlots also counts rack entries that are not scratched', () => {
  const map = takenSlots({ rack: [e(4, { slotId: 's4', displayName: 'D' })] }, []);
  expect(map.get('s4')).toEqual({ holder: 'D', scratched: false });
});
