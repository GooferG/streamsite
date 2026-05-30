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

  const bestX = bonuses.reduce((best, b) => {
    const stake = Number(b.stake) || 0;
    const win = Number(b.win) || 0;
    if (stake <= 0 || win <= 0) return best;
    const x = win / stake;
    return x > best ? x : best;
  }, 0);

  return {
    start,
    finish,
    totalStakes,
    totalWins,
    totalBuyIns,
    reqX,
    profit,
    wlMultiplier,
    bestX: bestX > 0 ? bestX : null,
    bonusCount: bonuses.length,
  };
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
