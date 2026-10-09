// Goofer Ball rules shared by the !slot chat command (api/_lib/slotCommand.js)
// and the staff endpoint (api/admin/ball.js). Pure (no firebase-admin) so it
// can be unit tested. Copy is verbatim from the spec.
import { MAX_TICKETS, prizeLabel, sanitizePrize } from './predictionRewards.js';

// The draw takeover's length on the overlay. A draw's chat line must not post
// before it, and a new draw can't start while one is playing.
export const DRAW_REVEAL_MS = 8000;
export const ACTIVE_STATUSES = ['open', 'closed'];
// How long a did-you-mean list answers `!slot 1-3`.
export const CHOICE_TTL_MS = 5 * 60 * 1000;
// At most one bot reply per viewer in this window (best effort, per instance).
export const REPLY_COOLDOWN_MS = 10 * 1000;
export const BALL_SITE = 'goofer.tv/gamba/ball';

export function sanitizeBallPrize(input) {
  const raw = Number(input && input.tickets);
  const tickets = Number.isFinite(raw) ? Math.min(MAX_TICKETS, Math.max(0, Math.floor(raw))) : 0;
  return { tickets, prize: sanitizePrize(input && input.prize) };
}

export function hasPrize(prize) {
  return !!prize && (prize.tickets > 0 || !!prize.prize);
}

export function ballPrizeLabel(prize) {
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

// Claim doc ids come from catalogue slugs. Firestore ids can't contain '/',
// can't be '.' or '..', and can't look like __reserved__.
export function slotKey(slotId) {
  return encodeURIComponent(String(slotId))
    .replace(/\./g, '%2E')
    .replace(/^_/, '%5F')
    .slice(0, 700);
}

// Map keys inside `announced.draws` / `announced.scratches`. A bare number
// is not a safe dotted field path segment.
export const drawKey = (drawNo) => `d${drawNo}`;

// What a !slot call does, given the viewer's ball and the claim on the slot
// they asked for, both read inside the entry transaction.
export function entryDecision({ ball, claim, slotId, twitchId }) {
  if (ball && ball.status === 'drawn') return { code: 'ALREADY_DRAWN', slotName: ball.slotName };
  if (claim && claim.scratched) return { code: 'SCRATCHED' };
  if (claim && claim.twitchId !== twitchId) return { code: 'TAKEN', holder: claim.displayName || null };
  if (ball && ball.status === 'drum') {
    if (ball.slotId === slotId) return { code: 'SAME' };
    return { code: 'SWAP', oldSlotId: ball.slotId };
  }
  return { code: 'NEW' };
}

function clip(text, max = 40) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const STATUS_TEXT = { drum: 'in the drum', drawn: 'on the rack', scratched: 'scratched, call another' };

export function replyText(code, { name, slotName, holder, options = [], query, status } = {}) {
  const me = `@${name || 'you'}`;
  switch (code) {
    case 'GUESS':
      return `${me} → ${slotName} is in the drum`;
    case 'SWAP':
      return `${me} swapped to ${slotName}`;
    case 'AMBIGUOUS':
      return `${me} did you mean ${options.map((o, i) => `${i + 1}. ${o.name}`).join(' · ')}? Type !slot 1-${options.length}`;
    case 'NOT_FOUND':
      return `${me} couldn't find "${clip(query)}". Exact names: ${BALL_SITE}`;
    case 'NO_BONUS_BUY':
      return `${me} ${slotName} has no bonus buy. Pick another.`;
    case 'TAKEN':
      return `${me} ${slotName} is taken by @${holder || 'someone'}. Pick another.`;
    case 'SCRATCHED':
      return `${me} ${slotName} was scratched tonight. Pick another.`;
    case 'ALREADY_DRAWN':
      return `${me} your ball's already on the rack: ${slotName}.`;
    case 'NOT_FOLLOWING':
      return `${me} follow the channel to call a slot in.`;
    case 'STATUS':
      return `${me} your ball: ${slotName} (${STATUS_TEXT[status] || STATUS_TEXT.drum})`;
    case 'HOW_TO':
      return `${me} type !slot <slot name> to call one in`;
    case 'BAD_PICK':
      return `${me} that pick list expired. Type !slot <slot name>.`;
    case 'CATALOG_DOWN':
      return `${me} slot list is down, try again in a minute.`;
    default:
      return '';
  }
}

const who = (p) => (p && (p.displayName || p.twitchName)) || 'someone';

export function openedLine(round) {
  return `🎱 Goofer Ball is open! Type !slot <slot name> to call one in. Top multi wins ${ballPrizeLabel(round.prize)}. Exact names: ${BALL_SITE}`;
}

export function drawLine(entry) {
  return `🎱 Ball ${entry.drawNo}: ${entry.slotName}, called in by @${who(entry)}`;
}

export function scratchLine(entry) {
  return `🎱 Ball ${entry.drawNo} scratched (${entry.slotName} isn't available tonight). @${who(entry)}, call another slot.`;
}

export function resultsLine(round) {
  const w = round.winner;
  return `🎱 Tonight's winning ball: ${w.slotName} at ${formatMulti(w.multiplier)}. @${who(w)} wins ${ballPrizeLabel(round.prize)}.`;
}
