// Deterministic mock leaderboard data.
// 20 players with a log-style wagered distribution. P01 is engineered to be
// at least 2x P02 so the leader-takeover banner visually earns its scale.

const NAMES = [
  'Neverleavehome',
  'midnightowl1',
  'maximumoverdriveo',
  'minorthreats',
  'reefermadnessH',
  'dustywindow',
  'yellowpages',
  'channel47at3am',
  'staticnoise',
  'thelastpayphone',
  'busstoplarry',
  'cathoderay',
  'velvetropes',
  'sundayspecial',
  'graveyardshift',
  'parkinglotpoet',
  'dialup_dave',
  'crttvfanclub',
  'roadsidediner',
  'closingcredits',
];

const BASE_WAGERED = [
  23434853, 9256889, 7198825, 6430844, 6376767,
  5123400, 4890210, 4321000, 3987654, 3654321,
  3200000, 2987600, 2754100, 2500000, 2300000,
  2050000, 1820000, 1500000, 1200000, 1012000,
];

export function getBaselinePlayers() {
  return NAMES.map((username, i) => ({
    id: `mock-${i + 1}`,
    username,
    wagered: BASE_WAGERED[i],
  }));
}

export function applyDeltas(players, deltasById) {
  const next = players.map((p) => {
    const delta = deltasById[p.id];
    if (!delta) return { ...p };
    return { ...p, wagered: p.wagered + delta };
  });
  next.sort((a, b) => b.wagered - a.wagered);
  return next;
}

// Mulberry32 — small deterministic PRNG so seeded calls match across runs.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generatePollDeltas(players, { seed } = {}) {
  const rand = seed !== undefined ? mulberry32(seed) : Math.random;
  const count = 1 + Math.floor(rand() * 3); // 1, 2, or 3
  const picked = new Set();
  const result = {};
  let safety = 0;
  while (picked.size < count && safety < 50) {
    safety += 1;
    const idx = Math.floor(rand() * players.length);
    const player = players[idx];
    if (picked.has(player.id)) continue;
    picked.add(player.id);
    // Weighted delta: 10k–500k, biased toward smaller amounts.
    const u = rand();
    const delta = Math.floor(10000 + Math.pow(u, 2) * 490000);
    result[player.id] = delta;
  }
  return result;
}
