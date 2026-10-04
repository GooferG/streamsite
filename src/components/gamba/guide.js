import { huntMode, huntStats, signedMoney, tabHuntRef, topPrizeText } from '../hunts/huntStats';
import { formatMoney } from '../../utils/money';
import { huntTypeLabel, profitLoss } from '../../utils/huntFormat';
import { GAMBA_TOOLS, channelLabel } from '../../data/gambaTools';

// Pure derivations for the Gamba guide hub (spec Part 4). Everything here is a
// string, a number or null: the components only lay it out.

const NOTCH_CAP = 60;
const usd = (n) => `$${Math.trunc(Number(n) || 0).toLocaleString('en-US')}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const liveHuntOf = (hunts) => (hunts && !hunts.loading ? hunts.live || null : null);
const isActive = (round) => !!round && !!round.acceptPredictions && (round.status === 'open' || round.status === 'locked');

// Hunts holds the featured monitor while a hunt is live or a prediction round
// is open or locked; otherwise the leaderboard has it. A loading or failed
// hunts read never selects Hunts on its own.
export function pickFeatured({ hunts, round }) {
  return liveHuntOf(hunts) || isActive(round) ? 'hunts' : 'leaderboard';
}

// A round with no title still reads as something.
export const roundTitle = (round) => (round && round.title) || 'Prediction round';

// What the hunt screen talks about: the live hunt (kind 'live'), else the
// active round before its hunt starts (kind 'prehunt'). A live hunt only takes
// its cost and currency from the round when the round snapshots that hunt; a
// round open for another hunt still sets the mode, chip and call to action.
export function huntFeature({ hunts, round }) {
  const live = liveHuntOf(hunts);
  const active = isActive(round);
  const activeRound = active ? round : null;
  const ref = active ? tabHuntRef(round, live, hunts && hunts.recent) : null;
  const hunt = live || (ref ? ref.summary : null);
  const figuresRound = live && !(ref && ref.isLive) ? null : activeRound;
  const snap = figuresRound && figuresRound.bonusHuntSnapshot;
  return {
    kind: live ? 'live' : 'prehunt',
    mode: active ? huntMode(round) : 'offair',
    round: activeRound,
    hunt,
    stats: huntStats(hunt, figuresRound),
    currency: (hunt && hunt.currency) || (snap && snap.currency) || null,
    guessCount: activeRound ? activeRound.entryCount || 0 : 0,
    prize: activeRound ? topPrizeText(activeRound) : null,
  };
}

// One notch per bonus up to NOTCH_CAP, then a continuous bar.
export function progressModel(stats) {
  const total = stats && stats.bonuses && stats.bonuses.length ? stats.bonusCount || stats.bonuses.length : 0;
  if (!total) return null;
  return { opened: stats.openedCount, total, style: total > NOTCH_CAP ? 'bar' : 'notches' };
}

// Handles arrive pre-masked from the bean board; never re-mask.
export function leaderboardFacts(lb) {
  const players = (lb && lb.players) || [];
  if (lb && lb.isLoading && !players.length) return { loading: true };
  if (lb && lb.error && !players.length) return { noSignal: true };
  const [leader, second] = players;
  return {
    pool: lb && lb.prizePool > 0 ? usd(lb.prizePool) : null,
    period: (lb && lb.periodLabel) || null,
    leader: leader ? { name: leader.maskedUsername, wagered: usd(leader.wagered), prize: leader.prize > 0 ? usd(leader.prize) : null } : null,
    lead: leader && second ? usd(leader.wagered - second.wagered) : null,
    standings: players.slice(0, 5).map((p, i) => `${i + 1} ${p.maskedUsername} ${usd(p.wagered)}`),
  };
}

export function formatResets(countdown) {
  if (!countdown || countdown.unknown) return null;
  if (countdown.isOver) return 'Resetting now';
  return `Resets in ${countdown.days}d ${String(countdown.hours).padStart(2, '0')}h`;
}

function leaderboardRow(lb, featured) {
  if (lb.loading) return 'Tuning…';
  if (lb.noSignal) return 'No signal';
  if (!lb.leader) return lb.pool ? `${lb.pool} pool` : 'No standings yet';
  const leads = `${lb.leader.name} leads · ${lb.leader.wagered}`;
  return featured === 'hunts' && lb.pool ? `${lb.pool} pool · ${leads}` : leads;
}

function roundNext(feature) {
  if (feature.mode === 'open') return `Predictions open · ${feature.guessCount} in`;
  if (feature.mode === 'locked') return `Entries closed · ${plural(feature.guessCount, 'guess', 'guesses')}`;
  return 'No round open';
}

function huntsRow(featured, feature, hunts, roundError) {
  if (featured === 'hunts' && feature.kind === 'live') {
    const { stats, hunt } = feature;
    const parts = [`${huntTypeLabel(hunt.huntType)} hunt`];
    if (stats.bonuses.length) parts.push(`${stats.openedCount}/${stats.bonusCount} opened`);
    if (stats.wonSoFar != null) parts.push(`${formatMoney(stats.wonSoFar, feature.currency)} won`);
    return { now: parts.join(' · '), next: roundNext(feature), lit: true, live: true, tone: null };
  }
  if (featured === 'hunts') {
    const state = feature.mode === 'open' ? 'Predictions open' : 'Entries closed';
    return { now: `${roundTitle(feature.round)} · ${state}`, next: `${plural(feature.guessCount, 'guess', 'guesses')} in`, lit: true, live: false, tone: null };
  }
  if (hunts.loading) return { now: 'Tuning…', next: '—', lit: false, live: false, tone: null };
  // A failed round read can't promise there is no round.
  const next = roundError ? 'No signal' : 'No round open';
  const last = (hunts.recent || [])[0];
  if (!last) {
    return hunts.error
      ? { now: 'No signal', next: '—', lit: false, live: false, tone: null }
      : { now: 'No hunts yet', next, lit: false, live: false, tone: null };
  }
  const result = profitLoss(last);
  return {
    now: result != null ? `Last hunt ${signedMoney(result, last.currency)}` : 'Last hunt',
    next,
    lit: false,
    live: false,
    tone: result == null ? null : result < 0 ? 'loss' : 'signal',
  };
}

const STATIC_ROWS = {
  'bonus-battle': 'Two bonuses, one winner. Call it.',
  wheel: 'Spin up a random slot to play next.',
};

export function guideRows({ featured, feature, hunts, leaderboard, resets, roundError = null }) {
  const lb = leaderboardFacts(leaderboard);
  return GAMBA_TOOLS.map((tool) => {
    const head = { id: tool.id, channel: channelLabel(tool), label: tool.label, path: tool.path };
    if (tool.id === 'leaderboard') {
      return { ...head, now: leaderboardRow(lb, featured), next: resets || '—', lit: false, live: false, tone: null };
    }
    if (tool.id === 'hunts') return { ...head, ...huntsRow(featured, feature, hunts || {}, roundError) };
    return { ...head, now: STATIC_ROWS[tool.id], next: 'Any time', lit: false, live: false, tone: null };
  });
}
