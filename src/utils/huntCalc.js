export function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function fmt(val) {
  if (val == null || val === '') return '—';
  return `$${Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtX(val) {
  if (val == null || !isFinite(val)) return '—';
  return `${val.toFixed(2)}x`;
}

/**
 * Derive display stats from a hunt object.
 * hunt = { startBalance, finishBalance, bonuses:[{stake,win}], gamblers:[{inFor}] }
 */
export function computeStats(hunt) {
  const bonuses = hunt?.bonuses ?? [];
  const gamblers = hunt?.gamblers ?? [];
  const start =
    hunt?.startBalance === '' || hunt?.startBalance == null
      ? null
      : Number(hunt.startBalance);
  const finish =
    hunt?.finishBalance === '' || hunt?.finishBalance == null
      ? null
      : Number(hunt.finishBalance);

  const totalStakes = bonuses.reduce((s, b) => s + (Number(b.stake) || 0), 0);
  const totalWins = bonuses.reduce((s, b) => s + (Number(b.win) || 0), 0);
  const totalBuyIns = gamblers.reduce((s, g) => s + (Number(g.inFor) || 0), 0);

  const reqX = totalStakes > 0 && start != null ? start / totalStakes : null;
  const profit = start != null && finish != null ? finish - start : null;
  const wlMultiplier =
    start != null && start !== 0 && finish != null ? finish / start : null;

  // A bonus is "opened" once it has a win entered (win > 0), matching the
  // live page's openedCount. Running figures below use this, so they update
  // bonus-by-bonus during the opening phase instead of waiting for a manually
  // entered finish balance.
  const openedCount = bonuses.filter((b) => (Number(b.win) || 0) > 0).length;
  const remainingCount = bonuses.length - openedCount;

  // Live profit/loss: winnings so far minus the buy-in. Negative while down,
  // climbs positive once winnings exceed start cost. (profit above stays the
  // finish-balance-based figure for end-of-hunt accuracy.)
  const runningProfit = start != null ? totalWins - start : null;

  // Cur Avg ($): average win per opened bonus.
  const curAvgWin = openedCount > 0 ? totalWins / openedCount : null;

  // Avg Req ($): average win still needed per UNOPENED bonus to break even.
  // Null once nothing remains to open (or start unset).
  const avgReqRemaining =
    start != null && remainingCount > 0
      ? (start - totalWins) / remainingCount
      : null;

  // Per-bonus multipliers for played bonuses (stake > 0 && win > 0).
  const playedX = bonuses
    .map((b) => {
      const stake = Number(b.stake) || 0;
      const win = Number(b.win) || 0;
      return stake > 0 && win > 0 ? win / stake : null;
    })
    .filter((x) => x != null);
  const totalX = playedX.reduce((s, x) => s + x, 0);
  const curAvgX = playedX.length > 0 ? totalX / playedX.length : null;

  const bestX = playedX.reduce((best, x) => (x > best ? x : best), 0);

  return {
    start,
    finish,
    totalStakes,
    totalWins,
    totalBuyIns,
    reqX,
    profit,
    runningProfit,
    curAvgWin,
    avgReqRemaining,
    totalX,
    curAvgX,
    openedCount,
    remainingCount,
    wlMultiplier,
    bestX: bestX > 0 ? bestX : null,
    bonusCount: bonuses.length,
  };
}

/**
 * Best and worst slot by multiplier across all PLAYED bonuses (stake > 0 &&
 * win > 0), independent of who called them. Used in the hunt recap export to
 * show the ending top/lowest performers.
 * Returns { best: { slot, x } | null, worst: { slot, x } | null }.
 */
export function bestWorstSlot(bonuses) {
  const played = (bonuses ?? [])
    .map((b) => {
      const stake = Number(b.stake) || 0;
      const win = Number(b.win) || 0;
      return stake > 0 && win > 0 ? { slot: b.slot, x: win / stake } : null;
    })
    .filter(Boolean);

  let best = null;
  let worst = null;
  for (const p of played) {
    if (!best || p.x > best.x) best = p;
    if (!worst || p.x < worst.x) worst = p;
  }
  return { best, worst };
}

/**
 * Slot-caller leaderboard + best/worst/most-consistent stats.
 * Only bonuses with a non-empty `caller` count. Ranking uses X (win / stake).
 * "Played" = stake > 0 && win > 0 — best/worst/avg ignore un-entered wins so
 * they don't all tie at 0; the leaderboard counts every called bonus.
 */
export function computeCallerStats(bonuses) {
  const called = (bonuses ?? []).filter((b) => (b.caller || '').trim() !== '');

  // Leaderboard — all called bonuses, played or not.
  const counts = new Map();
  for (const b of called) {
    const name = b.caller.trim();
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const leaderboard = [...counts.entries()]
    .map(([caller, calls]) => ({ caller, calls }))
    .sort((a, b) => b.calls - a.calls || a.caller.localeCompare(b.caller));

  // Played called bonuses, with X.
  const played = called
    .map((b) => {
      const stake = Number(b.stake) || 0;
      const win = Number(b.win) || 0;
      return stake > 0 && win > 0
        ? { caller: b.caller.trim(), slot: b.slot, x: win / stake }
        : null;
    })
    .filter(Boolean);

  let bestCall = null;
  let worstCall = null;
  for (const p of played) {
    if (!bestCall || p.x > bestCall.x) bestCall = p;
    if (!worstCall || p.x < worstCall.x) worstCall = p;
  }

  // Best average caller (mean X across each caller's played calls).
  const byCaller = new Map();
  for (const p of played) {
    const cur = byCaller.get(p.caller) || { sum: 0, calls: 0 };
    cur.sum += p.x;
    cur.calls += 1;
    byCaller.set(p.caller, cur);
  }
  let bestAvgCaller = null;
  for (const [caller, { sum, calls }] of byCaller.entries()) {
    const avgX = sum / calls;
    if (!bestAvgCaller || avgX > bestAvgCaller.avgX) {
      bestAvgCaller = { caller, avgX, calls };
    }
  }

  return { leaderboard, bestCall, worstCall, bestAvgCaller };
}

/**
 * Order bonuses for the Opening phase: non-deferred slots first (in list
 * order), then deferred slots (in list order) so "come back later" slots are
 * revisited at the end.
 */
export function openingOrder(bonuses) {
  const list = bonuses ?? [];
  const active = list.filter((b) => !b.deferred);
  const deferred = list.filter((b) => b.deferred);
  return [...active, ...deferred];
}
