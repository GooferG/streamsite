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
