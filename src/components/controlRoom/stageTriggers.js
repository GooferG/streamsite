import { LOCK_HOLD_MS, REVEAL_MS, pickKey, tsMillis } from '../../utils/giveaway';

export const STAGE_FRESH_MS = 10_000;
export const RESULTS_HOLD_MS = 8_000;

// A new pick that is still fresh: a reload, or Stage switched on late, must
// never replay an old reveal. Reveal timing comes from rolledAt, like the overlay.
export function giveawayMoment(giveaway, lastKey, now) {
  if (!giveaway || giveaway.status !== 'rolling' || !giveaway.winner) return null;
  const key = pickKey(giveaway);
  const at = tsMillis(giveaway.rolledAt);
  if (!key || key === lastKey || at == null || now - at >= STAGE_FRESH_MS) return null;
  const endsAt = at + REVEAL_MS + LOCK_HOLD_MS;
  // A pick seen late (reload, Stage turned on, a delayed snapshot) whose hold
  // has already elapsed must not flash the reveal just to power off.
  if (endsAt <= now) return null;
  return { kind: 'giveaway', key, endsAt };
}

// A settle that just happened. The results chat line already posts at
// settledAt + STREAM_DELAY_MS, so playing now lines up with the delayed video.
// The round is snapshotted onto the moment so a new round created while this
// one holds never swaps the card out from under it.
export function resultsMoment(round, lastId, now) {
  if (!round || round.status !== 'settled' || round.id === lastId) return null;
  const at = tsMillis(round.settledAt);
  if (at == null || now - at >= STAGE_FRESH_MS) return null;
  return { kind: 'results', key: round.id, endsAt: now + RESULTS_HOLD_MS, round };
}
