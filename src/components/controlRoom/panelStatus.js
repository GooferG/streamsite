import { formatClock, tsMillis } from '../../utils/giveaway';
import { pickConfirmed } from './selectors';

const who = (p) => ((p && (p.displayName || p.twitchName)) || 'winner').toUpperCase();

// What the minimized pill says, and how its LED looks.
export function pillState({ giveaway = null, round = null, warnings = [], dataLost = false, now = Date.now() }) {
  const tone = (base) => (warnings.length > 0 || dataLost ? 'error' : base);
  if (giveaway) {
    const n = giveaway.entryCount ?? 0;
    if (giveaway.status === 'rolling') {
      return pickConfirmed(giveaway)
        ? { label: `GVW WINNER · ${who(giveaway.winner)}`, tone: tone('live') }
        : { label: `GVW PICK · ${who(giveaway.winner)}`, tone: tone('attention') };
    }
    if (giveaway.status === 'playing') return { label: `GVW PLAYING · ${who(giveaway.playing)}`, tone: tone('live') };
    if (giveaway.status === 'closed') return { label: `GVW CLOSED · ${n} IN`, tone: tone('live') };
    const closesAt = tsMillis(giveaway.closesAt);
    if (closesAt != null) {
      return { label: `GVW ${formatClock((closesAt - now) / 1000)} · ${n} IN`, tone: tone('live') };
    }
    return { label: `GVW OPEN · ${n} IN`, tone: tone('live') };
  }
  if (round && (round.status === 'open' || round.status === 'locked')) {
    return {
      label: `PRD ${round.status.toUpperCase()} · ${round.entryCount ?? 0}`,
      tone: tone(round.status === 'locked' ? 'attention' : 'live'),
    };
  }
  return { label: 'CONTROL ROOM', tone: tone('idle') };
}

export function tallies({ isLive, giveaway, activeRound }) {
  return { live: !!isLive, gvw: !!giveaway, prd: !!activeRound };
}

// Tab LEDs: off when idle, on while the tool runs, pulsing when it needs you.
export function tabLeds({ giveaway, activeRound }) {
  let gvw = 'off';
  if (giveaway) gvw = giveaway.status === 'rolling' && !pickConfirmed(giveaway) ? 'pulse' : 'on';
  let prd = 'off';
  if (activeRound) prd = activeRound.status === 'locked' ? 'pulse' : 'on';
  return { giveaway: gvw, predict: prd };
}
