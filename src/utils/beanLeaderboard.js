// Maps bean's published `Leaderboard` (served via /api/leaderboard) onto the
// player/board shape our leaderboard themes render. Pure and synchronous so
// ranking, movement and labels are testable without fetch or React.
//
// Bean's contract (Site/src/lib/leaderboard/types.ts):
//   entry.rank            1-based position
//   entry.maskedHandle    already masked server-side ("2A***r") — never re-mask
//   entry.playerId        opaque salted id, stable across periods
//   entry.weightedWager   number
//   entry.prize           whole dollars, 0 when unpaid
//   entry.delta           places moved vs ~24h ago, positive = up, null = unknown
//   entry.tier            reward-ladder tier or null
//   board.closesAt        ISO string or null (period end)
//   board.fetchedAt       ISO string — when bean last counted (every 15 min)

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTime(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function numberOr0(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// "SEPTEMBER 2026" — the period is named by the month it closes in.
export function periodLabelFor(endsAt) {
  if (endsAt == null) return 'CURRENT PERIOD';
  return new Date(endsAt)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();
}

// Sits after "STANDINGS ·" in the broadcast header.
export function weekLabelFor(endsAt, now = Date.now()) {
  if (endsAt == null) return 'LIVE';
  const daysLeft = Math.ceil((endsAt - now) / DAY_MS);
  if (daysLeft <= 0) return 'FINAL';
  return `${daysLeft}D LEFT`;
}

export function mapBeanBoard(board, { previousPlayers = [], now = Date.now() } = {}) {
  const prevById = new Map(previousPlayers.map((p) => [p.id, p]));
  const entries = Array.isArray(board.entries) ? board.entries : [];

  const players = entries.map((e) => {
    const wagered = numberOr0(e.weightedWager);
    const prev = prevById.get(e.playerId);
    // Wager gained since our last poll — feeds the drop chip. 0 on first sight
    // and on a rare downward correction, which is not a "drop" to celebrate.
    const wagerDelta = prev ? Math.max(0, wagered - prev.wagered) : 0;
    const position = numberOr0(e.rank);
    const moved = typeof e.delta === 'number' && Number.isFinite(e.delta) ? e.delta : 0;

    return {
      id: e.playerId,
      username: e.maskedHandle,
      maskedUsername: e.maskedHandle,
      wagered,
      prize: numberOr0(e.prize),
      position,
      // Bean's delta is places moved (positive = up), so yesterday's rank sat
      // that many places lower on the list. TrendArrow compares the two.
      previousPosition: position + moved,
      delta: wagerDelta,
      tier: e.tier == null ? null : e.tier,
    };
  });

  const endsAt = parseTime(board.closesAt);
  const lastUpdatedAt = parseTime(board.fetchedAt) ?? now;

  return {
    boardId: board.id == null ? null : String(board.id),
    players,
    prizePool: numberOr0(board.prizePool),
    paidPlaces: numberOr0(board.paidPlaces),
    rankingField: board.rankingField || 'Weighted Wager',
    endsAt,
    lastUpdatedAt,
    periodLabel: periodLabelFor(endsAt),
    weekLabel: weekLabelFor(endsAt, now),
  };
}
