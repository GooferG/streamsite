// Shared giveaway helpers: setup defaults, keyword checks, and the reveal
// clock that the OBS overlay, the public page and the admin modal all read.
//
// The reveal is keyed off the giveaway's `rolledAt` server timestamp. Every
// screen derives the same frame from (now - rolledAt), so the overlay, the
// public page and a refreshed browser source all land on the winner together.

// ─── Reveal timeline (ms after rolledAt) ────────────────────────────────────
export const REVEAL_TIMELINE = {
  surfStart: 250, // static burst, then channel surfing begins
  surfEnd: 3300, // last surf frame (the winner) holds until the flash
  landAt: 3700, // static flash clears onto the full winner card
};
export const REVEAL_MS = 4200;
// Chat is near real time; the stream video runs a few seconds behind it. The
// winner announcement waits for the reveal to play out on stream first.
export const STREAM_DELAY_MS = 3000;
export const CHAT_ANNOUNCE_DELAY_MS = REVEAL_MS + STREAM_DELAY_MS;
export const SURF_FRAMES = 22;
// The channel the surf lands on. Giveaway is channel 07 in the site nav.
export const WINNER_CHANNEL = 7;

export const LAST_CALL_SECONDS = 30;
// Auto-roll only fires when the admin page sees the timer run out live. A page
// opened long after the fact should not suddenly roll a winner.
export const AUTO_ROLL_GRACE_MS = 15000;

export const DURATION_OPTIONS = [
  { label: 'No timer', value: 0 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];
export const WINNER_COUNT_OPTIONS = [1, 2, 3, 5];

export const DEFAULT_START_MSG =
  '🎁 GIVEAWAY → Type "{keyword}" in chat to enter. Prize: {prize}';
export const DEFAULT_WINNER_MSG =
  '🎉 @{winner} has been picked for {prize}! Reply in chat to claim.';
export const DEFAULT_LAST_CALL_MSG =
  '⏳ 30 seconds left. Type "{keyword}" in chat to get in on {prize}.';

// Channel-flavored keywords that nobody types by accident. Swap in real
// channel in-jokes whenever.
export const KEYWORD_POOL = [
  'tunedin',
  'rabbitears',
  'couchgang',
  'lateshow',
  'nightowl',
  'channel07',
  'crtglow',
  'vhsrewind',
  'goofedup',
  'staticsnack',
  'afterhours',
  'dialtone',
];

// Words chat says anyway. A keyword from this list enters people who were
// just talking.
const COMMON_CHAT_WORDS = new Set([
  'gg', 'ggs', 'lol', 'lmao', 'lul', 'kekw', 'omegalul', 'pog', 'poggers',
  'pogchamp', 'hi', 'hey', 'hello', 'yo', 'yes', 'no', 'ok', 'okay', 'w', 'l',
  'win', 'won', 'ez', 'nice', 'wow', 'hype', 'lets go', 'letsgo', 'gamba',
  'giveaway', 'gw', 'enter', 'me', 'pls', 'please', 'goofer', 'gooferg',
  'bonus', 'slots', 'love', 'goat', 'based', 'sheesh', 'monka', 'clap',
]);

export function normalizeKeyword(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function suggestKeyword(exclude, random = Math.random) {
  const current = normalizeKeyword(exclude);
  const pool = KEYWORD_POOL.filter((k) => k !== current);
  return pool[Math.floor(random() * pool.length) % pool.length];
}

// Returns a short warning string, or null when the keyword looks safe.
export function keywordWarning(value) {
  const kw = normalizeKeyword(value);
  if (!kw) return null;
  if (COMMON_CHAT_WORDS.has(kw)) {
    return 'Chat says this anyway. People will enter without meaning to.';
  }
  if (kw.replace(/[^a-z0-9]/g, '').length < 4) {
    return 'Short keywords get typed by accident. Try 4+ letters.';
  }
  return null;
}

export function defaultTitle(date = new Date()) {
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Giveaway · ${day}`;
}

// Firestore Timestamp | Date | millis | {seconds,nanoseconds} → millis.
export function tsMillis(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') return Number.isFinite(ts) ? ts : null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  }
  return null;
}

// Identifies one specific pick. A re-roll onto the same person later is a
// different pick because rolledAt changes.
export function pickKey(giveaway) {
  const at = tsMillis(giveaway?.rolledAt);
  if (!giveaway?.winnerTwitchId || at == null) return null;
  return `${giveaway.winnerTwitchId}:${at}`;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Reveal math (pure, shared by every screen) ─────────────────────────────

// 'pending' | 'static' | 'surf' | 'flash' | 'landed'
export function revealPhase(elapsedMs) {
  const { surfStart, surfEnd, landAt } = REVEAL_TIMELINE;
  if (elapsedMs == null || elapsedMs < 0) return 'pending';
  if (elapsedMs < surfStart) return 'static';
  if (elapsedMs < surfEnd) return 'surf';
  if (elapsedMs < landAt) return 'flash';
  return 'landed';
}

// Which surf frame shows at `elapsedMs`. Quadratic ease-out: flicks fast at
// first, slows down, and the last frame (the winner) holds before the flash.
export function surfFrameIndex(elapsedMs, frames = SURF_FRAMES) {
  const { surfStart, surfEnd } = REVEAL_TIMELINE;
  const x = Math.min(1, Math.max(0, (elapsedMs - surfStart) / (surfEnd - surfStart)));
  const eased = 1 - (1 - x) * (1 - x);
  return Math.min(frames - 1, Math.floor(eased * frames));
}

// Small deterministic PRNG so every screen shuffles the same way for a pick.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The frames the surf flicks through: entrants other than the winner, in a
// shuffle seeded by the pick, ending on the winner. Each frame carries the
// channel number shown in the corner OSD. With nobody else in the pool the
// frames are empty channels (static with a number).
export function buildSurfFrames({ winner, pool = [], seedKey = '', frames = SURF_FRAMES }) {
  const rand = mulberry32(hashString(String(seedKey)));
  const winnerId = winner?.twitchId || winner?.id;
  const others = pool.filter((e) => (e.twitchId || e.id) !== winnerId);
  // Fisher-Yates on a copy.
  const shuffled = [...others];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const out = [];
  let lastChannel = WINNER_CHANNEL;
  for (let i = 0; i < frames - 1; i++) {
    let channel;
    do {
      channel = 1 + Math.floor(rand() * 99);
    } while (channel === WINNER_CHANNEL || channel === lastChannel);
    lastChannel = channel;
    out.push({
      channel,
      entry: shuffled.length > 0 ? shuffled[i % shuffled.length] : null,
    });
  }
  out.push({ channel: WINNER_CHANNEL, entry: winner || null, isWinner: true });
  return out;
}

// Seed the new-giveaway form. `from` is a previous giveaway: its rules always
// carry over; with `copyPrize` its prize/title/keyword do too (Run it again).
export function formFromGiveaway(from, { copyPrize = false } = {}) {
  const base = {
    title: '',
    prize: '',
    keyword: suggestKeyword(from?.keyword),
    durationSec: 0,
    autoRoll: false,
    targetWinners: 1,
    weights: { base: 1, registered: 1, discord: 1, sub: 1, vip: 1 },
    requireFollow: true,
    announceStart: true,
    startMessage: DEFAULT_START_MSG,
    announceWinner: true,
    winnerMessage: DEFAULT_WINNER_MSG,
    announceLastCall: true,
    lastCallMessage: DEFAULT_LAST_CALL_MSG,
  };
  if (!from) return base;
  const rules = {
    weights: { ...base.weights, ...(from.weights || {}) },
    requireFollow: from.requireFollow !== false,
    announceStart: from.announceStart !== false,
    startMessage: from.startMessage || base.startMessage,
    announceWinner: from.announceWinner !== false,
    winnerMessage: from.winnerMessage || base.winnerMessage,
    announceLastCall: from.announceLastCall !== false,
    lastCallMessage: from.lastCallMessage || base.lastCallMessage,
    durationSec: Number(from.durationSec) || 0,
    autoRoll: from.autoRoll === true,
  };
  if (!copyPrize) return { ...base, ...rules };
  return {
    ...base,
    ...rules,
    title: from.title || '',
    prize: from.prize || '',
    keyword: from.keyword || base.keyword,
    targetWinners: Number(from.targetWinners) || 1,
  };
}

// One-line summary of the collapsed rules section.
export function rulesSummary(form) {
  const parts = [];
  parts.push(form.requireFollow ? 'Follow required' : 'Anyone in chat');
  const bonus = [];
  if (form.weights?.sub) bonus.push('sub');
  if (form.weights?.vip) bonus.push('VIP');
  if (form.weights?.discord) bonus.push('Discord');
  if (form.weights?.registered) bonus.push('site');
  parts.push(bonus.length ? `${bonus.join('/')} +1 each` : 'no bonus weight');
  const chat = [];
  if (form.announceStart) chat.push('start');
  if (form.durationSec > 0 && form.announceLastCall) chat.push('last call');
  if (form.announceWinner) chat.push('winner');
  parts.push(chat.length ? `chat: ${chat.join(', ')}` : 'chat quiet');
  return parts.join(' · ');
}
