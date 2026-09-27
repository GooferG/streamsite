// Live watch-time accrual. Pure (no firebase-admin, no fetch) so it can be
// unit tested. api/cron/watchtime-tick.js and api/_lib/watchtimeStore.js do
// the I/O around it.
//
// Time is cut into 5-minute windows. Each tick credits the window that just
// ended to everyone in chat: +1 present window, and +1 chat window if they
// sent a message in it. Tickets are paid out from those counters every 30
// minutes and when the stream ends.

export const WINDOW_MS = 5 * 60 * 1000;
export const WINDOW_MINUTES = 5;
export const WINDOWS_PER_SETTLE = 6;

const DEFAULT_RATES = { perWindow: 1, chatBonus: 1 };

// Chat bots that sit in most channels. Extra logins come from
// WATCHTIME_EXCLUDE_LOGINS.
const BOT_LOGINS = [
  'streamelements',
  'nightbot',
  'moobot',
  'fossabot',
  'streamlabs',
  'sery_bot',
  'wizebot',
  'soundalerts',
  'commanderroot',
];

export function windowId(ms) {
  return Math.floor(ms / WINDOW_MS);
}

// The window a tick running at `ms` credits: the one that just ended. Cron
// firing a little late still lands on the same window.
export function completedWindow(ms) {
  return windowId(ms) - 1;
}

// Payout at every :00 and :30 boundary.
export function shouldSettle(completed) {
  return (completed + 1) % WINDOWS_PER_SETTLE === 0;
}

function nonNegativeInt(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export function readRates(env) {
  return {
    perWindow: nonNegativeInt(env.WATCHTIME_TICKETS_PER_WINDOW, DEFAULT_RATES.perWindow),
    chatBonus: nonNegativeInt(env.WATCHTIME_CHAT_BONUS, DEFAULT_RATES.chatBonus),
  };
}

export function exclusionFromEnv(env) {
  const extra = String(env.WATCHTIME_EXCLUDE_LOGINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return {
    ids: new Set([env.TWITCH_BROADCASTER_ID, env.TWITCH_BOT_ID].filter(Boolean).map(String)),
    logins: new Set([...BOT_LOGINS, ...extra]),
  };
}

export function isExcludedViewer({ id, login }, exclusion) {
  if (id && exclusion.ids.has(String(id))) return true;
  return Boolean(login) && exclusion.logins.has(String(login).toLowerCase());
}

// Drop excluded viewers from an id -> login map.
export function withoutExcluded(viewers, exclusion) {
  const out = new Map();
  viewers.forEach((login, id) => {
    if (!isExcludedViewer({ id, login }, exclusion)) out.set(String(id), login);
  });
  return out;
}

function emptyViewer() {
  return {
    login: null,
    present: 0,
    chat: 0,
    paidTickets: 0,
    paidPresent: 0,
    ledgerTickets: 0,
    ledgerMinutes: 0,
  };
}

// Credit one window. `present` and `chatted` are id -> login maps with
// excluded viewers already removed. Chatting counts as present too, because
// Twitch's chatter list can lag a few minutes behind chat.
export function creditWindow(viewers, { present, chatted }) {
  const next = { ...viewers };
  const ids = new Set([...present.keys(), ...chatted.keys()]);
  ids.forEach((id) => {
    const prev = next[id] || emptyViewer();
    next[id] = {
      ...prev,
      login: present.get(id) || chatted.get(id) || prev.login,
      present: prev.present + 1,
      chat: prev.chat + (chatted.has(id) ? 1 : 0),
    };
  });
  return next;
}

// Credit `completed` onto a session (null when the stream has no session
// yet). Returns null when that window was already credited, so a duplicate
// or late cron run changes nothing.
export function applyWindow(session, { completed, present, chatted }) {
  if (session && typeof session.lastWindow === 'number' && session.lastWindow >= completed) {
    return null;
  }
  return {
    isNew: !session,
    lastWindow: completed,
    viewers: creditWindow((session && session.viewers) || {}, { present, chatted }),
  };
}

export function formatDuration(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function formatWatchNote(minutes) {
  return `Watched ${formatDuration(minutes)}`;
}

// What a viewer is still owed: tickets from their counters at the current
// rates minus what was already paid, and present windows not yet paid out as
// minutes. Floored at 0 so a rate lowered mid-stream never claws back.
export function owedFor(viewer, rates) {
  const earned = viewer.present * rates.perWindow + viewer.chat * rates.chatBonus;
  return {
    tickets: Math.max(0, earned - (viewer.paidTickets || 0)),
    windows: Math.max(0, viewer.present - (viewer.paidPresent || 0)),
  };
}

// Decide one payout for the viewers in `ids`. `hasAccount` holds the ids that
// have a users/{id} doc. Account holders get tickets plus a per-stream ledger
// line built from ledgerTickets/ledgerMinutes (what went to the account, not
// the bank). Everyone else is banked until they log in. Returns the updated
// viewers map so the caller can write it in the same transaction.
export function planSettlement(viewers, ids, hasAccount, rates) {
  const next = { ...viewers };
  const accountCredits = [];
  const bankCredits = [];
  ids.forEach((id) => {
    const v = viewers[id];
    if (!v) return;
    const owed = owedFor(v, rates);
    if (owed.tickets === 0 && owed.windows === 0) return;
    const minutes = owed.windows * WINDOW_MINUTES;
    const paid = {
      ...v,
      paidTickets: (v.paidTickets || 0) + owed.tickets,
      paidPresent: (v.paidPresent || 0) + owed.windows,
    };
    if (hasAccount.has(id)) {
      const ledgerTickets = v.ledgerTickets || 0;
      const ledgerMinutes = v.ledgerMinutes || 0;
      paid.ledgerTickets = ledgerTickets + owed.tickets;
      paid.ledgerMinutes = ledgerMinutes + minutes;
      accountCredits.push({
        id,
        tickets: owed.tickets,
        minutes,
        ledger: {
          delta: paid.ledgerTickets,
          minutes: paid.ledgerMinutes,
          note: formatWatchNote(paid.ledgerMinutes),
          first: ledgerTickets === 0 && ledgerMinutes === 0,
        },
      });
    } else {
      bankCredits.push({ id, login: v.login || null, tickets: owed.tickets, minutes });
    }
    next[id] = paid;
  });
  return { viewers: next, accountCredits, bankCredits };
}
