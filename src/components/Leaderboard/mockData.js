// Deterministic mock leaderboard data.
// 20 players with a log-style wagered distribution. P01 is engineered to be
// at least 2x P02 so the leader-takeover banner visually earns its scale.

const NAMES = [
  'Nikshotmom',
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
  1464622.96, 1034104.98, 790547.86, 703037.66, 584398.66, 264991.93,
  243842.27, 220580.21, 218940.73, 199706.01, 194481.82, 187465.35,
  183261.85, 149599.53, 135194.83, 95487.09, 94087.37, 82543.59,
  79000.32, 77163.89,
];

export function getBaselinePlayers() {
  return NAMES.map((username, i) => ({
    id: `mock-${i + 1}`,
    username,
    wagered: BASE_WAGERED[i],
  })).sort((a, b) => b.wagered - a.wagered);
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
    a = (a + 0x6d2b79f5) >>> 0;
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
