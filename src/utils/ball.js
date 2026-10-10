import { STREAM_DELAY_MS, tsMillis } from './giveaway';
import { prizeLabel } from './predictionRewards';
import { rankRows, resultRows, settledRows } from './ballResults';

// Goofer Ball rules for the overlay, Stage, the control room and CH 42. The
// server twin is api/_lib/ballRules.js (chat lines, entry decisions).

export const DRAW_REVEAL_MS = 8000;
export const WINNER_HOLD_MS = 12000;
// The draw takeover's beats, in ms from drawnAt (spec: OBS overlay).
export const BALL_TIMELINE = { cut: 600, blower: 3000, tube: 4200, spin: 5200, hold: 7400 };
export const ACTIVE_STATUSES = ['open', 'closed'];
// Only fresh draws post on their own; older ones go through Retry.
export const AUTO_POST_WINDOW_MS = 5 * 60 * 1000;
export const BALL_PATH = '/gamba/ball';
// A moment without a local anchor may start up to this far "in the future"
// (the server clock ahead of this browser) and still counts as starting now.
const SKEW_MS = 10000;

export const drawKey = (drawNo) => `d${drawNo}`;
export const pad2 = (n) => String(n).padStart(2, '0');
export const who = (p) => (p && (p.displayName || p.twitchName)) || 'someone';
export const isActive = (round) => !!round && ACTIVE_STATUSES.includes(round.status);

export function drawPhase(elapsed) {
  if (elapsed == null || !Number.isFinite(elapsed) || elapsed >= DRAW_REVEAL_MS) return null;
  const t = Math.max(0, elapsed);
  if (t < BALL_TIMELINE.cut) return 'cut';
  if (t < BALL_TIMELINE.blower) return 'blower';
  if (t < BALL_TIMELINE.tube) return 'tube';
  if (t < BALL_TIMELINE.spin) return 'spin';
  if (t < BALL_TIMELINE.hold) return 'hold';
  return 'out';
}

export function latestDraw(round) {
  const rack = (round && round.rack) || [];
  return rack.length ? rack[rack.length - 1] : null;
}

// The draw takeover to play right now, or null. Timed off drawnAt like the
// giveaway reveal off rolledAt, so a reload mid-reveal resumes and a reload
// after it never replays.
//
// `anchors` (hooks/useMomentAnchors) holds the local time a live draw or
// settle arrived: it replaces the server timestamp as the start, so an OBS or
// Stage clock that is off by more than the reveal can't drop or truncate it.
export function drawMoment(round, now, anchors) {
  const entry = latestDraw(round);
  if (!entry || entry.scratched) return null;
  const anchor = anchors && anchors.draws ? anchors.draws.get(entry.drawNo) : null;
  const at = anchor != null ? anchor : tsMillis(entry.drawnAt);
  if (at == null) return null;
  const elapsed = now - at;
  if (elapsed >= DRAW_REVEAL_MS || (anchor == null && elapsed < -SKEW_MS)) return null;
  return { kind: 'draw', key: `${round.id}:${entry.drawNo}`, entry, at, endsAt: at + DRAW_REVEAL_MS };
}

export function winnerMoment(round, now, anchors) {
  if (!round || round.status !== 'settled' || !round.winner) return null;
  const anchor = anchors ? anchors.settle : null;
  const at = anchor != null ? anchor : tsMillis(round.settledAt);
  if (at == null || now - at >= WINNER_HOLD_MS || (anchor == null && now - at < -SKEW_MS)) return null;
  return { kind: 'winner', key: `${round.id}:winner`, at, endsAt: at + WINNER_HOLD_MS };
}

export const drumBalls = (balls) => (balls || []).filter((b) => b.status === 'drum');
export const drawnEntries = (round) => ((round && round.rack) || []).filter((e) => !e.scratched);

export function recentBalls(balls, n = 8) {
  return [...(balls || [])].sort((a, b) => (tsMillis(b.enteredAt) ?? 0) - (tsMillis(a.enteredAt) ?? 0)).slice(0, n);
}

export function prizeText(prize) {
  if (!prize) return '';
  const parts = [];
  if (prize.tickets > 0) parts.push(`${prize.tickets.toLocaleString('en-US')} tickets`);
  const money = prizeLabel(prize.prize);
  if (money) parts.push(money);
  return parts.join(' + ');
}

export function formatMulti(multiplier) {
  if (multiplier == null || multiplier === '') return '—';
  const n = Number(multiplier);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 })}x`;
}

// Slots nobody can call right now: every ball in the drum or on the rack
// (the rack covers a ball whose doc hasn't loaded yet), plus scratched draws
// (blocked for the round).
export function takenSlots(round, balls) {
  const out = new Map();
  for (const b of balls || []) {
    if (b.status === 'drum' || b.status === 'drawn') out.set(b.slotId, { holder: who(b), scratched: false });
  }
  for (const e of (round && round.rack) || []) {
    if (e.scratched) out.set(e.slotId, { holder: who(e), scratched: true });
    else if (!out.has(e.slotId)) out.set(e.slotId, { holder: who(e), scratched: false });
  }
  return out;
}

export function liveRows(round, hunt) {
  if (!round) return [];
  if (round.status === 'settled') return settledRows(round);
  return resultRows(round, (hunt && hunt.bonuses) || []);
}

export const leaderRow = (rows) => rankRows(rows)[0] || null;
export const hasResults = (rows) => (rows || []).some((r) => r.multiplier != null);

export function drawAnnounceDueAt(entry) {
  const at = tsMillis(entry && entry.drawnAt);
  return at == null ? null : at + DRAW_REVEAL_MS + STREAM_DELAY_MS;
}

// Draws whose chat line hasn't posted yet. A second draw can land before the
// first one's line is due (8s busy guard vs 11s line), so this is a list.
export function pendingDrawAnnounces(round, now) {
  const done = (round && round.announced && round.announced.draws) || {};
  return drawnEntries(round).filter((e) => {
    const at = tsMillis(e.drawnAt);
    return !done[drawKey(e.drawNo)] && at != null && now - at <= AUTO_POST_WINDOW_MS;
  });
}

// What each ball looked like at the last snapshot: status and slot.
export function ballSignature(balls) {
  return new Map((balls || []).map((b) => [b.id, `${b.status}:${b.slotId}`]));
}

// Balls that just landed in the drum since `prev`: new callers (or a
// scratched viewer calling again) and swaps. Feeds the overlay's toasts.
export function arrivals(prev, balls) {
  const out = [];
  for (const b of balls || []) {
    if (b.status !== 'drum') continue;
    const before = prev.get(b.id);
    if (before === `drum:${b.slotId}`) continue;
    out.push({ id: `${b.id}:${b.slotId}`, name: who(b), slotName: b.slotName, kind: before && before.startsWith('drum:') ? 'swap' : 'new' });
  }
  return out;
}

// When a draw may show on CH 42: the same moment its chat line is due, so the
// page never spoils what the stream hasn't revealed yet.
export const revealAt = (entry) => drawAnnounceDueAt(entry);

export function settleRevealAt(round) {
  const at = tsMillis(round && round.settledAt);
  return at == null ? null : at + STREAM_DELAY_MS;
}

// CH 42 data as the stream audience has seen it by `now`: draws and settles
// still inside the reveal delay are held back. `nextAt` is the earliest
// pending reveal (or null) so the page knows when to look again.
export function spoilerSafe({ round, balls, past }, now) {
  let nextAt = null;
  const note = (t) => {
    if (t != null && t > now && (nextAt == null || t < nextAt)) nextAt = t;
  };
  const safePast = (past || []).filter((r) => {
    const t = settleRevealAt(r);
    if (t != null && t > now) {
      note(t);
      return false;
    }
    return true;
  });
  if (!round) return { round, balls, past: safePast, nextAt };
  const hidden = new Set();
  const rack = (round.rack || []).filter((e) => {
    const t = revealAt(e);
    if (t != null && t > now) {
      hidden.add(e.drawNo);
      note(t);
      return false;
    }
    return true;
  });
  let out = hidden.size ? { ...round, rack } : round;
  const settleAt = round.status === 'settled' ? settleRevealAt(round) : null;
  if (settleAt != null && settleAt > now) {
    note(settleAt);
    const { winner, results, settledAt, ...rest } = out; // eslint-disable-line no-unused-vars
    out = { ...rest, status: 'closed' };
  }
  const safeBalls = hidden.size
    ? (balls || []).map((b) => (b.drawNo != null && hidden.has(b.drawNo) ? { ...b, status: 'drum', drawNo: null } : b))
    : balls;
  return { round: out, balls: safeBalls, past: safePast, nextAt };
}

// liveRows/settledRows skip scratched draws; every screen shows them struck
// through, in draw order.
export function withScratched(round, rows) {
  const scratched = ((round && round.rack) || [])
    .filter((e) => e.scratched)
    .map((e) => ({
      drawNo: e.drawNo,
      twitchId: e.twitchId,
      twitchName: e.twitchName || null,
      displayName: e.displayName || null,
      slotId: e.slotId,
      slotName: e.slotName,
      thumb: e.thumb || null,
      multiplier: null,
      scratched: true,
    }));
  if (!scratched.length) return rows;
  return [...rows, ...scratched].sort((a, b) => a.drawNo - b.drawNo);
}
