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

// Tunable thresholds for the "fun stat" reputation layer. Adjust here only.
const REP = {
  winX: 20,      // form pip "win" / hot-pace threshold
  brickX: 1,     // form pip "brick" / cold-pace threshold
  hotAvgX: 25,
  hotAccept: 0.6,
  coldAccept: 0.35,
  streakLen: 2,
  minColdCalls: 3,
};

// Public thresholds the UI reuses so row tints match form-pip colors.
export const CALLER_WIN_X = REP.winX;
export const CALLER_BRICK_X = REP.brickX;

function playedX(b) {
  const stake = Number(b.stake) || 0;
  const win = Number(b.win) || 0;
  return stake > 0 && win > 0 ? win / stake : null;
}

/**
 * Slot-caller leaderboard + cross-hunt reputation.
 * @param {Array} bonuses        current hunt bonuses (with caller, stake, win)
 * @param {Array} history        completed hunts [{ bonuses:[...] }] for prior plays
 * @param {Array} skippedCalls   [{ caller }] viewer calls skipped this hunt
 * Backward compatible: history/skippedCalls default to []. Legacy keys
 * (leaderboard, bestCall, worstCall, bestAvgCaller) are preserved.
 */
export function computeCallerStats(bonuses, history = [], skippedCalls = []) {
  const cur = (bonuses ?? []).filter((b) => (b.caller || '').trim() !== '');

  // Per-caller accumulator.
  const map = new Map();
  const ensure = (name) => {
    if (!map.has(name)) {
      map.set(name, { name, gotIn: 0, missed: 0, xs: [] });
    }
    return map.get(name);
  };

  // History first (older plays at the front of each caller's X list).
  for (const h of history ?? []) {
    for (const b of h.bonuses ?? []) {
      const name = (b.caller || '').trim();
      if (!name) continue;
      const rec = ensure(name);
      rec.gotIn += 1;
      const x = playedX(b);
      if (x != null) rec.xs.push(x);
    }
  }
  // Current hunt.
  for (const b of cur) {
    const name = b.caller.trim();
    const rec = ensure(name);
    rec.gotIn += 1;
    const x = playedX(b);
    if (x != null) rec.xs.push(x);
  }
  // Skips → missed.
  for (const s of skippedCalls ?? []) {
    const name = (s.caller || '').trim();
    if (!name) continue;
    ensure(name).missed += 1;
  }

  const formPip = (x) => (x >= REP.winX ? 'win' : x < REP.brickX ? 'brick' : 'ok');
  const trailingRun = (xs, pred) => {
    let n = 0;
    for (let i = xs.length - 1; i >= 0 && pred(xs[i]); i--) n += 1;
    return n;
  };

  const leaderboard = [...map.values()]
    .map((rec) => {
      const calls = rec.gotIn + rec.missed;
      const plays = rec.xs.length;
      const avgX = plays ? rec.xs.reduce((s, x) => s + x, 0) / plays : null;
      const best = plays ? Math.max(...rec.xs) : null;
      const acceptRate = calls ? rec.gotIn / calls : 0;
      const form = rec.xs.slice(-5).map(formPip);
      const hotStreak = trailingRun(rec.xs, (x) => x >= REP.winX);
      const coldStreak = trailingRun(rec.xs, (x) => x < REP.brickX);
      let status = 'steady';
      if (hotStreak >= REP.streakLen || (avgX != null && avgX >= REP.hotAvgX && acceptRate >= REP.hotAccept)) {
        status = 'hot';
      } else if (coldStreak >= REP.streakLen || (acceptRate < REP.coldAccept && calls >= REP.minColdCalls)) {
        status = 'cold';
      }
      return {
        name: rec.name, calls, gotIn: rec.gotIn, missed: rec.missed,
        acceptRate, avgX, best, plays, form, status, hotStreak, coldStreak,
      };
    })
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));

  // Best/worst single call — current hunt played bonuses only (the "this hunt" highlight).
  let bestCall = null;
  let worstCall = null;
  for (const b of cur) {
    const x = playedX(b);
    if (x == null) continue;
    const cand = { slot: b.slot, x, caller: b.caller.trim() };
    if (!bestCall || x > bestCall.x) bestCall = cand;
    if (!worstCall || x < worstCall.x) worstCall = cand;
  }

  const withPlays = leaderboard.filter((r) => r.plays >= 2);
  const mostConsistent = withPlays.reduce(
    (best, r) => (!best || r.avgX > best.avgX ? r : best), null
  );
  const hotRows = leaderboard.filter((r) => r.status === 'hot');
  const hotCaller = hotRows.reduce(
    (best, r) => (!best || (r.avgX ?? 0) > (best.avgX ?? 0) ? r : best), null
  );
  const coldRows = leaderboard.filter((r) => r.status === 'cold');
  const coldCaller = coldRows.reduce(
    (worst, r) => (!worst || r.acceptRate < worst.acceptRate ? r : worst), null
  );

  return {
    leaderboard, bestCall, worstCall,
    mostConsistent, hotCaller, coldCaller,
    bestAvgCaller: mostConsistent, // legacy alias
  };
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
