import { roundTotalCost } from '../../utils/predictionRound';
import { prizeLabel, winnerPrizeLabel } from '../../utils/predictionRewards';
import { formatMoney } from '../../utils/money';

// Pure money and state derivations for the Hunts tab (spec "Derivations").
// Every figure is a finite number or null, never NaN or Infinity.

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
const round2 = (n) => Math.round(n * 100) / 100;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export const isOpened = (b) => !!b && num(b.win) != null;

export function huntMode(round) {
  if (!round || !round.acceptPredictions) return 'offair';
  if (round.status === 'open') return 'open';
  if (round.status === 'locked') return 'locked';
  if (round.status === 'settled') return 'settled';
  return 'offair';
}

// The communityhunts hunt the tab talks about: the round's snapshot hunt, or
// off air the live hunt, else the newest. `summary` is what the overview poll
// has for it (the live poll carries bonuses, recent summaries don't).
export function tabHuntRef(round, live, recent) {
  const list = Array.isArray(recent) ? recent : [];
  if (huntMode(round) === 'offair') {
    const hunt = live || list[0] || null;
    return { huntId: hunt ? hunt.id : null, summary: hunt, isLive: !!live };
  }
  const snap = round.bonusHuntSnapshot;
  const huntId = (round.source === 'communityhunts' && snap && snap.huntId) || null;
  if (!huntId) return { huntId: null, summary: null, isLive: false };
  if (live && live.id === huntId) return { huntId, summary: live, isLive: true };
  return { huntId, summary: list.find((h) => h.id === huntId) || null, isLive: false };
}

export function huntStats(hunt, round) {
  const bonuses = hunt && Array.isArray(hunt.bonuses) ? hunt.bonuses : [];
  const roundCost = roundTotalCost(round);
  const pot = num(hunt && hunt.pot);
  const startCost = roundCost > 0 ? roundCost : pot != null && pot > 0 ? pot : null;

  const bets = bonuses.map((b) => num(b && b.bet)).filter((n) => n != null && n > 0);
  const totalBet = bets.length ? round2(sum(bets)) : null;
  const opened = bonuses.filter(isOpened);
  const huntWon = num(hunt && hunt.totalWon);
  const wonSoFar = bonuses.length ? round2(sum(opened.map((b) => num(b.win)))) : huntWon;
  const remainingBet = round2(sum(bonuses.filter((b) => !isOpened(b)).map((b) => num(b && b.bet) || 0)));
  const snapCount = round && round.bonusHuntSnapshot && round.bonusHuntSnapshot.bonusCount;
  const bonusCount = bonuses.length || num(hunt && hunt.bonusCount) || num(snapCount) || null;

  const actual = round && round.status === 'settled' ? num(round.actual && round.actual.payout) : null;
  const won = actual != null ? actual : huntWon;

  let bestIndex = -1;
  let bestMulti = 0;
  bonuses.forEach((b, i) => {
    const m = num(b && b.multiplier);
    if (isOpened(b) && m != null && m > bestMulti) {
      bestMulti = m;
      bestIndex = i;
    }
  });

  const huntAvg = num(hunt && hunt.averageMultiple);
  return {
    bonuses,
    bonusCount,
    startCost,
    totalBet,
    avgBet: totalBet != null ? round2(totalBet / bets.length) : null,
    requiredAvg: startCost != null && totalBet ? startCost / totalBet : null,
    openedCount: opened.length,
    wonSoFar,
    stillNeedAvg: startCost != null && remainingBet > 0 ? Math.max(0, startCost - (wonSoFar || 0)) / remainingBet : null,
    won,
    avgMulti: huntAvg != null ? huntAvg : won != null && totalBet ? won / totalBet : null,
    result: won != null && startCost != null ? round2(won - startCost) : null,
    bestIndex,
    nextIndex: bonuses.findIndex((b) => !isOpened(b)),
  };
}

export function median(values) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export function formatAvgFigure(x) {
  if (x == null || !Number.isFinite(x)) return '—';
  return x >= 1000 ? Math.round(x).toLocaleString('en-US') : x.toFixed(1);
}

export function formatAvg(x) {
  const figure = formatAvgFigure(x);
  return figure === '—' ? figure : `${figure}x`;
}

// Guesses either side of the start cost: paying back half is as normal as doubling.
export function quickPicks(startCost) {
  const c = Number(startCost) || 0;
  if (c <= 0) return [];
  return [
    { label: 'Half back', value: Math.round(c / 2) },
    { label: 'Break-even', value: round2(c) },
    { label: 'Double', value: Math.round(c * 2) },
  ];
}

function sortedTiers(round) {
  return ((round && round.rewards && round.rewards.tiers) || []).slice().sort((a, b) => a.place - b.place);
}

// "+500 tickets", "+500 tickets + $50 cash", "Bonus buy $20". A legacy tier
// (no `prize` key) honours the round's old rewards.type like rewardSummary.
function tierPrizeText(tier, legacyType) {
  if (!tier) return null;
  const legacy = !Object.prototype.hasOwnProperty.call(tier, 'prize');
  const parts = [];
  const tickets = Math.floor(Number(tier.tickets) || 0);
  if (tickets > 0 && !(legacy && legacyType === 'cash')) parts.push(`+${tickets.toLocaleString('en-US')} tickets`);
  if (!(legacy && legacyType === 'tickets')) {
    const label = prizeLabel(tier.prize);
    if (label) parts.push(tier.prize.kind === 'cash' ? `${label} cash` : label);
    else if (tier.cashLabel) parts.push(tier.cashLabel);
  }
  return parts.length ? parts.join(' + ') : null;
}

export function topPrizeText(round) {
  const tiers = sortedTiers(round);
  return tiers.length ? tierPrizeText(tiers[0], round.rewards && round.rewards.type) : null;
}

export function winnerPrizeText(prize) {
  if (!prize) return null;
  const parts = [];
  const tickets = Math.floor(Number(prize.tickets) || 0);
  if (tickets > 0) parts.push(`+${tickets.toLocaleString('en-US')} tickets`);
  const label = winnerPrizeLabel(prize);
  if (label) parts.push(label);
  return parts.length ? parts.join(' + ') : null;
}

export function signedMoney(value, currency, opts) {
  if (value == null || !Number.isFinite(value)) return '—';
  const body = formatMoney(Math.abs(value), currency, opts);
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}

// "−ARS 1,850,000.00" → { sign: '−', symbol: 'ARS', figure: '1,850,000.00' }, so
// a display figure can shrink a long currency code instead of clipping. Text
// without a digit ('—', '109.1x' has no symbol) passes through as the figure.
export function splitMoney(text) {
  const m = /^([+−-]?)([^\d]*?)\s*(\d[\s\S]*)$/.exec(String(text));
  if (!m) return { sign: '', symbol: '', figure: String(text) };
  return { sign: m[1], symbol: m[2].trim(), figure: m[3] };
}

export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}
