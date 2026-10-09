import { formatClock, tsMillis } from '../../utils/giveaway';
import { drumBalls, isActive } from '../../utils/ball';
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

export function tallies({ isLive, giveaway, activeRound, redeem }) {
  return { live: !!isLive, gvw: !!giveaway, prd: !!activeRound, red: (redeem && redeem.pending) || 0 };
}

// Tab LEDs: off when idle, on while the tool runs, pulsing when it needs you.
// Redemptions pulse only for orders this browser hasn't had on screen yet.
export function tabLeds({ giveaway, activeRound, redeem, ballRound }) {
  let gvw = 'off';
  if (giveaway) gvw = giveaway.status === 'rolling' && !pickConfirmed(giveaway) ? 'pulse' : 'on';
  let prd = 'off';
  if (activeRound) prd = activeRound.status === 'locked' ? 'pulse' : 'on';
  let red = 'off';
  if (redeem && redeem.pending > 0) red = redeem.unseen > 0 ? 'pulse' : 'on';
  // A closed drum is waiting on the payout.
  let ball = 'off';
  if (isActive(ballRound)) ball = ballRound.status === 'closed' ? 'pulse' : 'on';
  return { giveaway: gvw, predict: prd, redeem: red, ball };
}

// The pill's Goofer Ball chip while the drum is open: balls in the drum.
export function ballChip(ballRound, balls) {
  if (!ballRound || ballRound.status !== 'open') return null;
  return { label: `BALL ${drumBalls(balls).length}` };
}

// The pill's redemption chip, or null when nothing is pending.
export function pillCounter(redeem) {
  if (!redeem || !(redeem.pending > 0)) return null;
  return { label: `RED ${redeem.pending}`, pulse: redeem.unseen > 0 };
}
