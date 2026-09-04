import { mapBeanBoard, periodLabelFor, weekLabelFor } from '../beanLeaderboard';

const NOW = Date.parse('2026-09-04T15:20:00.000Z');

const board = {
  id: '1',
  title: '$250,000 Leaderboard',
  prizePool: 250000,
  rankingField: 'Weighted Wager',
  closesAt: '2026-09-12T00:00:00.000Z',
  fetchedAt: '2026-09-04T15:16:05.990Z',
  paidPlaces: 30,
  tierCount: 20,
  entries: [
    { rank: 1, maskedHandle: '2A***r', playerId: 'dd9d', weightedWager: 10676153.455, prize: 70000, delta: 0, tier: 19 },
    { rank: 2, maskedHandle: 've***y', playerId: 'ae8b', weightedWager: 4203537.43, prize: 40000, delta: 1, tier: 15 },
    { rank: 3, maskedHandle: '***', playerId: '099a', weightedWager: 3001884.1, prize: 0, delta: -2, tier: null },
    { rank: 4, maskedHandle: 'Th***r', playerId: 'f3f4', weightedWager: 2024817.515, prize: 17000, delta: null, tier: 11 },
  ],
};

describe('mapBeanBoard', () => {
  it('maps entries onto the theme player shape without re-masking handles', () => {
    const out = mapBeanBoard(board, { now: NOW });
    expect(out.players).toHaveLength(4);
    expect(out.players[0]).toMatchObject({
      id: 'dd9d',
      username: '2A***r',
      maskedUsername: '2A***r',
      wagered: 10676153.455,
      prize: 70000,
      position: 1,
      previousPosition: 1,
      delta: 0,
      tier: 19,
    });
  });

  it('turns bean movement (places, positive = up) into previousPosition', () => {
    const out = mapBeanBoard(board, { now: NOW });
    expect(out.players[1].previousPosition).toBe(3); // moved up 1 → was 3rd
    expect(out.players[2].previousPosition).toBe(1); // moved down 2 → was 1st
    expect(out.players[3].previousPosition).toBe(4); // unknown → no arrow
  });

  it('computes wager gained since the previous poll by player id', () => {
    const first = mapBeanBoard(board, { now: NOW });
    const next = {
      ...board,
      entries: board.entries.map((e) =>
        e.playerId === 'ae8b' ? { ...e, weightedWager: e.weightedWager + 12345 } : e,
      ),
    };
    const out = mapBeanBoard(next, { previousPlayers: first.players, now: NOW });
    expect(out.players[1].delta).toBe(12345);
    expect(out.players[0].delta).toBe(0);
  });

  it('exposes board-level fields as timestamps and labels', () => {
    const out = mapBeanBoard(board, { now: NOW });
    expect(out.prizePool).toBe(250000);
    expect(out.paidPlaces).toBe(30);
    expect(out.endsAt).toBe(Date.parse('2026-09-12T00:00:00.000Z'));
    expect(out.lastUpdatedAt).toBe(Date.parse('2026-09-04T15:16:05.990Z'));
    expect(out.periodLabel).toBe('SEPTEMBER 2026');
    expect(out.weekLabel).toBe('8D LEFT');
  });

  it('tolerates a period with no published close date', () => {
    const out = mapBeanBoard({ ...board, closesAt: null }, { now: NOW });
    expect(out.endsAt).toBeNull();
    expect(out.periodLabel).toBe('CURRENT PERIOD');
    expect(out.weekLabel).toBe('LIVE');
  });
});

describe('labels', () => {
  it('reads FINAL once the close date has passed', () => {
    expect(weekLabelFor(NOW - 1000, NOW)).toBe('FINAL');
  });
  it('names the period by its closing month', () => {
    expect(periodLabelFor(Date.parse('2026-10-13T00:00:00.000Z'))).toBe('OCTOBER 2026');
  });
});
