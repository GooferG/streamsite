import { toMs } from './huntTime';
import { formatAvg } from './huntStats';
import { formatMultiplier } from '../../utils/huntFormat';

// Pure derivations over a round's entries: ranking, lineup rows, the meter,
// the viewer's position and the chyron items. Entries arrive in submission
// order (the listener orders by submittedAt), so list position is the entry
// number. Entry ids are Twitch ids.

export function guessOf(entry) {
  const v = entry && entry.payoutGuess;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function entryName(entry) {
  return (entry && (entry.displayName || entry.twitchName)) || 'Viewer';
}

const keyOf = (e) => e.twitchId || e.id;
const finalGuessMs = (e) => toMs(e.lastEditAt) || toMs(e.submittedAt);

function winnerPlaces(round) {
  const map = {};
  ((round && round.winners) || []).forEach((w) => {
    if (w && w.twitchId) map[w.twitchId] = w.place;
  });
  return map;
}

function actualOf(round) {
  const v = round && round.actual && round.actual.payout;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// Closest first; a tie goes to whoever settled on their final guess first.
// Mirrors pickWinners in api/_lib/predictions.js.
export function rankEntries(entries, actual) {
  return entries
    .filter((e) => guessOf(e) != null)
    .map((e) => ({ ...e, diff: Math.abs(e.payoutGuess - actual) }))
    .sort((a, b) => a.diff - b.diff || finalGuessMs(a) - finalGuessMs(b));
}

export function lineupRows({ mode, entries, round, myId, limit = 10, expanded = false }) {
  const places = winnerPlaces(round);
  const actual = actualOf(round);
  const numbered = entries.map((e, i) => ({ ...e, no: i + 1 })).filter((e) => guessOf(e) != null);
  const ordered =
    mode === 'settled' && actual != null
      ? rankEntries(numbered, actual).map((e, i) => ({ ...e, place: i + 1, off: e.payoutGuess - actual }))
      : numbered
          .slice()
          .sort((a, b) => a.payoutGuess - b.payoutGuess || a.no - b.no)
          .map((e) => ({ ...e, place: null, off: null }));
  const rows = ordered.map((e) => ({
    id: e.id,
    twitchId: keyOf(e),
    name: entryName(e),
    avatar: e.profileImageUrl || null,
    guess: e.payoutGuess,
    no: e.no,
    place: e.place,
    off: e.off,
    submittedAt: e.lastEditAt || e.submittedAt || null,
    isMe: !!myId && keyOf(e) === myId,
    winnerPlace: places[keyOf(e)] || null,
  }));
  const visible = expanded ? rows : rows.slice(0, limit);
  const mine = rows.find((r) => r.isMe) || null;
  return {
    rows: visible,
    total: rows.length,
    hiddenCount: rows.length - visible.length,
    pinned: mine && !visible.includes(mine) ? mine : null,
  };
}

export function guessPosition(entries, myId) {
  const mine = entries.find((e) => keyOf(e) === myId);
  const g = guessOf(mine);
  if (g == null) return null;
  let below = 0;
  let above = 0;
  entries.forEach((e) => {
    if (keyOf(e) === myId) return;
    const v = guessOf(e);
    if (v == null) return;
    if (v < g) below += 1;
    else if (v > g) above += 1;
  });
  return { below, above };
}

const DOT_ORDER = { dim: 0, open: 0, runner: 1, winner: 2, me: 3 };

export function meterModel({ mode, sealed, entries, myEntry, myId, startCost, wonSoFar, round }) {
  if (mode === 'offair' || mode === 'tuning') return null;
  const places = winnerPlaces(round);
  const myGuess = guessOf(myEntry);

  const points = sealed
    ? myGuess != null
      ? [{ id: myId || 'me', value: myGuess, tone: 'me', name: 'You' }]
      : []
    : entries
        .filter((e) => guessOf(e) != null)
        .map((e) => {
          const place = places[keyOf(e)];
          const tone =
            place === 1 ? 'winner' : place === 2 ? 'runner' : keyOf(e) === myId ? 'me' : mode === 'settled' ? 'dim' : 'open';
          return { id: e.id, value: e.payoutGuess, tone, name: entryName(e) };
        });

  const markers = [];
  if (mode === 'settled') {
    const actual = actualOf(round);
    if (actual != null) markers.push({ key: 'actual', label: 'Actual', value: actual, tone: 'winner', labelAt: 'top' });
  } else {
    if (startCost) markers.push({ key: 'break-even', label: 'Break-even', value: startCost, tone: 'signal', labelAt: 'top' });
    if (mode === 'locked' && wonSoFar) markers.push({ key: 'so-far', label: 'So far', value: wonSoFar, tone: 'muted', labelAt: 'bottom' });
  }

  const values = [...points.map((p) => p.value), ...markers.map((m) => m.value)];
  if (sealed) {
    const base = startCost || myGuess;
    if (!base) return null;
    values.push(base * 0.5, base * 1.5);
  }
  if (!values.length) return null;

  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.05, hi * 0.02, 1);
  lo = Math.max(0, lo - pad);
  hi += pad;
  const pct = (v) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));

  return {
    lo,
    hi,
    markers: markers.map((m) => ({ ...m, pct: pct(m.value) })),
    dots: points.map((p) => ({ ...p, pct: pct(p.value) })).sort((a, b) => DOT_ORDER[a.tone] - DOT_ORDER[b.tone]),
    count: sealed ? (round && round.entryCount) || points.length : points.length,
    sealed: !!sealed,
  };
}

// Chyron items, sentence case (the Monitor uppercases them with CSS so screen
// readers get words, not letters).
export function tickerItems(mode, { stats, guessCount = 0, prize = null, winner = null, runnerUp = null, isLive = false, money, signed }) {
  const items = [];
  const add = (cond, text) => {
    if (cond) items.push(text);
  };
  const best = stats.bestIndex >= 0 ? stats.bonuses[stats.bestIndex] : null;
  const bestText = best ? `${best.slot} ${formatMultiplier(best.multiplier)}` : null;
  const progress = stats.bonuses.length > 0 && stats.bonusCount;
  const guesses = `${guessCount} ${guessCount === 1 ? 'guess' : 'guesses'}`;

  if (mode === 'open') {
    add(true, 'Predictions open');
    const docket = [stats.bonusCount && `${stats.bonusCount} bonuses`, stats.startCost != null && `start cost ${money(stats.startCost)}`]
      .filter(Boolean)
      .join(' · ');
    add(docket, docket);
    add(true, `${guesses} in`);
    add(stats.requiredAvg != null, `Required avg · ${formatAvg(stats.requiredAvg)}`);
    add(prize, `Closest guess wins ${prize}`);
    add(true, 'Get your guess in before Goofer closes entries');
  } else if (mode === 'locked') {
    add(true, 'Entries closed');
    add(progress, `${stats.openedCount}/${stats.bonusCount} opened`);
    add(stats.wonSoFar != null, `Won so far ${money(stats.wonSoFar)}`);
    add(bestText, `Best hit so far · ${bestText}`);
    add(stats.stillNeedAvg != null, `Still need ${formatAvg(stats.stillNeedAvg)} avg`);
    add(true, 'Results when the last bonus opens');
  } else if (mode === 'settled') {
    add(true, winner ? `${winner.name} takes ${winner.prize || 'the round'}` : 'No eligible guesses');
    add(stats.result != null, `Hunt finishes ${signed(stats.result)}`);
    add(bestText, `Best hit · ${bestText}`);
    add(runnerUp, runnerUp && `Runner-up ${runnerUp.name}${runnerUp.prize ? ` ${runnerUp.prize}` : ''}`);
  } else {
    add(true, isLive ? 'Hunt in progress' : 'No round open');
    add(isLive && progress, `${stats.openedCount}/${stats.bonusCount} opened`);
    add(isLive && stats.wonSoFar != null, `Won so far ${money(stats.wonSoFar)}`);
    add(!isLive && stats.result != null, `Last hunt ${signed(stats.result)}`);
    add(bestText, `Best hit · ${bestText}`);
    add(true, 'Predictions open when Goofer starts a round');
  }
  return items;
}
