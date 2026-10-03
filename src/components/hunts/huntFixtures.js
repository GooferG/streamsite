// Dev-only fixtures for /gamba/hunts?fixture=… (HuntsPage strips them from
// production builds). Figures reproduce the On Air handoff: 37 bonuses,
// start cost $2,421.82, total bet $22.20 (109.1x), final payout $2,046.12.

const SLOTS = [
  ['Wanted Dead or a Wild', 0.6, 812],
  ['Gates of Olympus', 0.8, 41.5],
  ['Sweet Bonanza', 0.6, 12.2],
  ['Mental', 0.4, 268],
  ['Sugar Rush', 0.6, 3.1],
  ['Chaos Crew', 0.6, 74],
  ['The Dog House', 0.8, 0],
  ['Fruit Party', 0.6, 28.4],
  ['Starlight Princess', 0.4, 156],
  ['Big Bass Bonanza', 0.6, 9.6],
];
const LATER_MULTIS = [35, 120, 8, 52, 0, 61, 15, 210, 44];
const START_COST = 2421.82;
const ACTUAL = 2046.12;
const round2 = (n) => Math.round(n * 100) / 100;

function finalBonuses() {
  const list = Array.from({ length: 37 }, (_, i) => {
    const [slot, bet0, multi0] = SLOTS[i % SLOTS.length];
    const bet = i === 36 ? 0.6 : bet0;
    const multiplier = i < 10 ? multi0 : LATER_MULTIS[(i - 10) % LATER_MULTIS.length];
    return { slot, bet, win: round2(bet * multiplier), multiplier, thumb: null };
  });
  // The last bonus closes the gap to the handoff's final payout exactly.
  const last = list[36];
  last.win = round2(ACTUAL - list.slice(0, 36).reduce((a, b) => a + b.win, 0));
  last.multiplier = round2(last.win / last.bet);
  return list;
}

const FINAL = finalBonuses();
const UNOPENED = FINAL.map((b) => ({ ...b, win: null, multiplier: null }));
const OPENING = FINAL.map((b, i) => (i < 12 ? b : { ...b, win: null, multiplier: null }));

const ago = (minutes) => new Date(Date.now() - minutes * 60 * 1000);
const GUESSES = [
  ['skillsytv', 1855, 12],
  ['G4KUR4', 3663, 9],
  ['GRUMPZILLA12', 3100, 7],
  ['RYGARTEARROW', 2777, 5],
  ['Xilentdrifter', 2122, 3],
  ['JESSEJEK', 3333, 1],
];
const ENTRIES = GUESSES.map(([name, payoutGuess, min]) => ({
  id: name,
  twitchId: name,
  displayName: name,
  profileImageUrl: null,
  payoutGuess,
  submittedAt: ago(min),
}));
const VIEWER = { twitchId: 'fx-viewer', displayName: 'vonbrandt' };
const MY_ENTRY = { id: 'fx-viewer', twitchId: 'fx-viewer', displayName: 'vonbrandt', payoutGuess: 2450, submittedAt: ago(0.2) };

const HUNT = { id: 'fx-hunt', huntType: 'community', currency: null, pot: START_COST, bonusCount: 37, startedAt: ago(90).toISOString() };
const EPISODES = [
  { id: 'fx-ep1', huntType: 'community', currency: null, pot: 1800, totalWon: 3084.4, averageMultiple: 128.5, bonusCount: 24, endedAt: '2026-09-27T23:30:00', bonuses: FINAL.slice(0, 24) },
  { id: 'fx-ep2', huntType: 'solo', currency: null, pot: 600, totalWon: 487.95, averageMultiple: 40.6, bonusCount: 12, endedAt: '2026-09-24T23:30:00', bonuses: FINAL.slice(0, 12) },
  { id: 'fx-ep3', huntType: 'vip', currency: null, pot: 1500, totalWon: 2142.9, averageMultiple: 97.4, bonusCount: 22, endedAt: '2026-09-20T23:30:00', bonuses: FINAL.slice(0, 22) },
];
const TIERS = [
  { place: 1, tickets: 500, prize: null },
  { place: 2, tickets: 100, prize: null },
];
const ROUND = {
  id: 'fx-round',
  title: 'Thursday Comm Hunt',
  acceptPredictions: true,
  acceptSuggestions: false,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'fx-hunt', totalCost: START_COST, currency: null, bonusCount: 37 },
  rewards: { tiers: TIERS },
};

export const HUNT_FIXTURES = {
  open: {
    round: { ...ROUND, status: 'open', entryCount: 7 },
    entries: [],
    sealed: true,
    myEntry: MY_ENTRY,
    viewer: VIEWER,
    live: { ...HUNT, status: 'live', totalWon: 0, bonuses: UNOPENED },
    recent: EPISODES,
  },
  'open-staff': {
    round: { ...ROUND, status: 'open', entryCount: 6 },
    entries: ENTRIES,
    sealed: false,
    myEntry: null,
    viewer: null,
    live: { ...HUNT, status: 'live', totalWon: 0, bonuses: UNOPENED },
    recent: EPISODES,
  },
  locked: {
    round: { ...ROUND, status: 'locked', entryCount: 7 },
    entries: [...ENTRIES, MY_ENTRY],
    sealed: false,
    myEntry: MY_ENTRY,
    viewer: VIEWER,
    live: { ...HUNT, status: 'live', bonuses: OPENING },
    recent: EPISODES,
  },
  settled: {
    round: {
      ...ROUND,
      status: 'settled',
      entryCount: 6,
      actual: { payout: ACTUAL },
      settledAt: new Date(2026, 9, 1, 23, 42),
      winners: [
        { place: 1, twitchId: 'Xilentdrifter', displayName: 'Xilentdrifter', profileImageUrl: null, payoutGuess: 2122, diff: 75.88, prize: { tickets: 500 } },
        { place: 2, twitchId: 'skillsytv', displayName: 'skillsytv', profileImageUrl: null, payoutGuess: 1855, diff: 191.12, prize: { tickets: 100 } },
      ],
    },
    entries: ENTRIES,
    sealed: false,
    myEntry: null,
    viewer: null,
    live: null,
    recent: [{ ...HUNT, status: 'archived', totalWon: ACTUAL, averageMultiple: round2(ACTUAL / 22.2), endedAt: '2026-10-01T23:40:00', bonuses: FINAL }, ...EPISODES],
  },
  offair: {
    round: null,
    entries: [],
    sealed: false,
    myEntry: null,
    viewer: null,
    live: null,
    recent: [{ ...HUNT, status: 'archived', totalWon: ACTUAL, averageMultiple: round2(ACTUAL / 22.2), endedAt: '2026-10-01T23:40:00', bonuses: FINAL }, ...EPISODES],
  },
};
