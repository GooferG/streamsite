// Server-side client for the communityhunts.gg public API. The ONLY module in
// this repo that talks to communityhunts.gg; everything else calls these
// helpers. The key is the Bean community key (read scope) and must stay
// server-side: never log it, never put it in a URL.
//
// Config is read per call (not at module load) so tests and env changes work.

export const DEFAULT_API_URL = 'https://api.communityhunts.gg/api/public/v1';
// GooferG ("Goofer") in the Bean community.
export const DEFAULT_OWNER_ID = 'usr_IT8I88O03xF3QHqHzqme95';

const TIMEOUT_MS = 8000;

export class CommunityHuntsError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.name = 'CommunityHuntsError';
    this.code = code;
    this.status = status;
  }
}

function config() {
  return {
    key: process.env.COMMUNITYHUNTS_API_KEY || '',
    base: (process.env.COMMUNITYHUNTS_API_URL || DEFAULT_API_URL).replace(/\/+$/, ''),
    ownerId: process.env.COMMUNITYHUNTS_OWNER_ID || DEFAULT_OWNER_ID,
  };
}

export async function chGet(path, params = {}) {
  const { key, base } = config();
  if (!key) {
    throw new CommunityHuntsError('NOT_CONFIGURED', 503, 'COMMUNITYHUNTS_API_KEY is not set');
  }
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString();
  const url = `${base}${path}${qs ? `?${qs}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    throw new CommunityHuntsError(
      timedOut ? 'TIMEOUT' : 'NETWORK',
      timedOut ? 504 : 502,
      timedOut ? 'communityhunts.gg timed out' : 'communityhunts.gg unreachable'
    );
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const code = (body && body.error && body.error.code) || `HTTP_${res.status}`;
    const message = (body && body.error && body.error.message) || `communityhunts.gg ${res.status}`;
    throw new CommunityHuntsError(code, res.status, message);
  }
  return body;
}

export async function getLiveHunt() {
  const { ownerId } = config();
  const body = await chGet('/hunts', { status: 'live', ownerId, view: 'full', limit: 1 });
  return (body && Array.isArray(body.data) && body.data[0]) || null;
}

export async function getRecentHunts(limit = 10) {
  const { ownerId } = config();
  const body = await chGet('/hunts', { ownerId, view: 'summary', limit });
  return body && Array.isArray(body.data) ? body.data : [];
}

export async function getHunt(id) {
  const body = await chGet(`/hunts/${encodeURIComponent(id)}`);
  return body ? body.data : null;
}

// The hunt a new prediction round should snapshot: the live one, else the
// newest. Summary fields are enough for toRoundSnapshot.
export async function getCurrentHunt() {
  const live = await getLiveHunt();
  if (live) return live;
  const [latest] = await getRecentHunts(1);
  return latest || null;
}

// The whole Rainbet slot catalogue (not per-community; communityhunts re-syncs
// it nightly and sends it with public caching). One response, ~7.6k rows.
export async function getSlotCatalog() {
  const body = await chGet('/slots');
  return body && Array.isArray(body.data) ? body.data : [];
}

const round2 = (n) => Math.round(n * 100) / 100;

export function toRoundSnapshot(hunt, now = new Date()) {
  if (!hunt) return null;
  return {
    huntId: hunt.id ?? null,
    totalCost: Number(hunt.pot) || 0,
    currency: hunt.currency ?? null,
    bonusCount: Number(hunt.bonusCount) || 0,
    // Status + times let the admin see (and settle-time checks catch) a round
    // that snapshotted an already-ended hunt because nothing was live.
    status: hunt.status ?? null,
    startedAt: hunt.startedAt ?? null,
    endedAt: hunt.endedAt ?? null,
    snapshotAt: now.toISOString(),
  };
}

export function huntResult(hunt) {
  return {
    payout: round2(Number(hunt && hunt.totalWon) || 0),
    currency: (hunt && hunt.currency) ?? null,
    status: (hunt && hunt.status) ?? null,
    ended: !hunt || hunt.status !== 'live',
    endedAt: (hunt && hunt.endedAt) ?? null,
  };
}

const HUNT_FIELDS = [
  'id',
  'status',
  'huntType',
  'currency',
  'startedAt',
  'endedAt',
  'updatedAt',
  'bonusCount',
  'pot',
  'totalWon',
  'averageMultiple',
];

// Only what the Hunts tab renders. calls/equity (viewer names) and owner are
// dropped; bonuses are kept only when the source hunt is a full view.
export function trimHunt(hunt) {
  if (!hunt) return null;
  const out = {};
  for (const f of HUNT_FIELDS) out[f] = hunt[f] ?? null;
  if (Array.isArray(hunt.bonuses)) {
    out.bonuses = hunt.bonuses.map((b) => ({
      slot: b.slot ?? null,
      bet: b.bet ?? null,
      win: b.win ?? null,
      multiplier: b.multiplier ?? null,
      thumb: b.thumb ?? null,
    }));
  }
  return out;
}
