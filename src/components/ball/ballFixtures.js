// Dev-only Goofer Ball fixtures (stripped from production builds, like
// huntFixtures): the overlay's ?fixture= and CH 42's ?fixture=. Timestamps
// are relative to `now` so the draw and winner moments actually play.
const at = (ms) => ({ toMillis: () => ms });
const NAMES = ['CoolGuy', 'BigWinz', 'Pupper', 'SugarFan', 'NightOwl', 'ReelRat', 'Mossy', 'LuckyLou'];
const SLOTS = ['Gates of Olympus', 'Wanted Dead or a Wild', 'The Dog House', 'Sugar Rush 1000', 'Big Bass Bonanza', 'Zeus vs Hades', 'Le Bandit', 'Fire Portals'];

export const FIXTURE_PRIZE = { tickets: 200, prize: { kind: 'cash', amount: 5 } };

export function fixtureBalls(now, { drawn = 0, count = 8 } = {}) {
  return NAMES.slice(0, count).map((name, i) => ({
    id: `fx${i}`,
    twitchId: `fx${i}`,
    twitchName: name.toLowerCase(),
    displayName: name,
    slotId: `fx-slot-${i}`,
    slotName: SLOTS[i],
    thumb: null,
    status: i < drawn ? 'drawn' : 'drum',
    drawNo: i < drawn ? i + 1 : null,
    enteredAt: at(now - (count - i) * 60_000),
  }));
}

export function fixtureRack(now, drawn, { lastAt = now - 600_000 } = {}) {
  return Array.from({ length: drawn }, (_, i) => ({
    drawNo: i + 1,
    twitchId: `fx${i}`,
    twitchName: NAMES[i].toLowerCase(),
    displayName: NAMES[i],
    slotId: `fx-slot-${i}`,
    slotName: SLOTS[i],
    thumb: null,
    drawnAt: at(i === drawn - 1 ? lastAt : now - (drawn - i) * 900_000),
    scratched: false,
  }));
}

export function fixtureRound(now, extra = {}) {
  return { id: 'fx-round', status: 'open', prize: FIXTURE_PRIZE, huntId: null, rack: [], openedAt: at(now - 3_600_000), ...extra };
}

export const FIXTURE_HUNT = {
  id: 'fx-hunt',
  bonuses: [
    { slot: 'Gates of Olympus', bet: 1, win: 412, multiplier: 412 },
    { slot: 'Wanted Dead or a Wild', bet: 2, win: 176, multiplier: 88 },
    { slot: 'The Dog House', bet: 1, win: 12, multiplier: 12 },
    { slot: 'Sugar Rush 1000', bet: 1, win: null, multiplier: null },
  ],
};

export function overlayFixture(key, now) {
  const feed = (round, balls, hunt = null) => ({ round, balls, ready: true, hunt, stale: false });
  if (key === 'open') return feed(fixtureRound(now, { rack: fixtureRack(now, 3) }), fixtureBalls(now, { drawn: 3 }));
  if (key === 'draw') return feed(fixtureRound(now, { rack: fixtureRack(now, 4, { lastAt: now }) }), fixtureBalls(now, { drawn: 4 }));
  if (key === 'rack') return feed(fixtureRound(now, { huntId: 'fx-hunt', rack: fixtureRack(now, 4) }), fixtureBalls(now, { drawn: 4 }), FIXTURE_HUNT);
  if (key === 'winner') {
    const rack = fixtureRack(now, 4);
    const round = fixtureRound(now, {
      status: 'settled',
      rack,
      settledAt: at(now),
      results: { 1: { multiplier: 412, win: 412, bet: 1, source: 'hunt' } },
      winner: { ...rack[0], multiplier: 412, win: 412, redemptionId: null },
    });
    return feed(round, fixtureBalls(now, { drawn: 4 }));
  }
  return null;
}

function pastRound(now, i, multi, prize) {
  const day = now - i * 86_400_000;
  const rack = fixtureRack(day, 3);
  return {
    id: `fx-past-${i}`,
    status: 'settled',
    prize,
    rack,
    settledAt: at(day),
    results: {
      1: { multiplier: multi, win: multi, bet: 1, source: 'hunt' },
      2: { multiplier: 12, win: 12, bet: 1, source: 'hunt' },
      3: { multiplier: 3.5, win: 3.5, bet: 1, source: 'manual' },
    },
    winner: { ...rack[0], multiplier: multi, win: multi, redemptionId: null },
  };
}

export function fixturePast(now) {
  return [
    pastRound(now, 1, 412, FIXTURE_PRIZE),
    pastRound(now, 3, 96, { tickets: 300, prize: null }),
    pastRound(now, 6, 1204, { tickets: 200, prize: { kind: 'bonus', amount: 10 } }),
  ];
}

// CH 42 (BallFront props) for /gamba/ball?fixture=...
export function frontFixture(key, now) {
  const base = { roundError: false, hunt: null, stale: false, me: null, past: fixturePast(now), pastLoading: false, pastError: false, hasMore: false, ballsReady: true, still: true };
  if (key === 'open') return { ...base, round: fixtureRound(now, { rack: fixtureRack(now, 2) }), balls: fixtureBalls(now, { drawn: 2 }), me: 'fx4' };
  if (key === 'rack') return { ...base, round: fixtureRound(now, { huntId: 'fx-hunt', rack: fixtureRack(now, 4) }), balls: fixtureBalls(now, { drawn: 4 }), hunt: FIXTURE_HUNT };
  if (key === 'closed') {
    return { ...base, round: fixtureRound(now, { status: 'closed', huntId: 'fx-hunt', rack: fixtureRack(now, 4) }), balls: fixtureBalls(now, { drawn: 4 }), hunt: FIXTURE_HUNT };
  }
  if (key === 'settled' || key === 'offair') return { ...base, round: base.past[0], balls: [] };
  if (key === 'empty') return { ...base, round: null, balls: [], past: [] };
  if (key === 'loading') return { ...base, round: undefined, balls: [], past: [], pastLoading: true };
  return null;
}
