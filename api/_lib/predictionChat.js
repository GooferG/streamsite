// Fixed Twitch chat lines for prediction rounds. Pure so they can be unit
// tested; posting goes through twitchChat.js. Money uses the round's hunt
// currency (USD for manual rounds) and drops the cents on whole amounts.

import { placeLabel } from './predictionRewards.js';

export const HUNTS_LINK = 'goofer.tv/gamba/hunts';

function roundCurrency(round) {
  const snap = round && round.source === 'communityhunts' ? round.bonusHuntSnapshot : null;
  return (snap && snap.currency) || 'USD';
}

export function chatMoney(value, currency = 'USD') {
  const n = Math.round((Number(value) || 0) * 100) / 100;
  const digits = Number.isInteger(n) ? 0 : 2;
  const opts = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, ...opts }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString('en-US', opts)}`;
  }
}

export function openedMessage(round) {
  const currency = roundCurrency(round);
  const fromHunt = round.source === 'communityhunts';
  const snap = (fromHunt && round.bonusHuntSnapshot) || {};
  const bonusCount = fromHunt ? Number(snap.bonusCount) || 0 : 0;
  const cost = fromHunt ? Number(snap.totalCost) || 0 : Number(round.manualTotalCost) || 0;
  const parts = [];
  if (bonusCount > 0) parts.push(`${bonusCount} ${bonusCount === 1 ? 'bonus' : 'bonuses'}`);
  if (cost > 0) parts.push(`${chatMoney(cost, currency)} in`);
  const detail = parts.length ? ` (${parts.join(', ')})` : '';
  return `Predictions are open! Guess the final payout of the hunt${detail}. Closest guess wins. ${HUNTS_LINK}`;
}

export function lockedMessage(round) {
  const n = Number(round.entryCount) || 0;
  return `Predictions locked. ${n} ${n === 1 ? 'guess' : 'guesses'} in. Revealed at ${HUNTS_LINK}`;
}

export function resultsMessage(round) {
  const currency = roundCurrency(round);
  const payout = chatMoney(round.actual && round.actual.payout, currency);
  const winners = (round.winners || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => a.place - b.place);
  if (winners.length === 0) return `Final payout ${payout}. No guesses this round.`;
  const list = winners
    .map(
      (w) =>
        `${placeLabel(w.place)}: ${w.displayName || w.twitchName || 'anon'} (${chatMoney(w.payoutGuess, currency)})`
    )
    .join(' · ');
  return `Final payout ${payout}. ${list}`;
}
