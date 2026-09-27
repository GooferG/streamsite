# Live Watch-Time Tickets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Viewers earn store tickets in proportion to the time they spend in GooferG's live chat (with a bonus for chatting), replacing the once-a-day snapshot award.

**Architecture:** A Vercel cron hits `api/cron/watchtime-tick.js` every 5 minutes. Each tick credits the 5-minute window that just ended into one Firestore doc per stream (`watch_sessions/{streamId}`), using Twitch's chatter list for presence and EventSub-written markers (`watch_chat/{windowId}`) for the chat bonus. Every 30 minutes and at stream end the session is paid out in per-chunk transactions: account holders get tickets + a per-stream ledger line, everyone else is banked in `watch_bank/{twitchId}` and claimed at login. All decisions live in pure functions (`api/_lib/watchtime.js`); Firestore I/O lives in `api/_lib/watchtimeStore.js`.

**Tech Stack:** Vercel serverless functions (ESM, Node 24), firebase-admin (Firestore), Twitch Helix + EventSub, React 19 (CRA / react-scripts 5), Jest via `react-scripts test`.

**Spec:** `docs/superpowers/specs/2026-09-27-live-watchtime-design.md`

## Global Constraints

- Firebase is on the **Spark** plan (20k writes/day). Per-tick writes must stay O(1): never write per viewer per tick. Per-viewer writes happen only at payout (every 30 min + stream end).
- Window length 5 minutes (`WINDOW_MS = 300000`); payout when `(completed + 1) % 6 === 0`.
- Env names exactly: `WATCHTIME_TICKETS_PER_WINDOW` (default `1`), `WATCHTIME_CHAT_BONUS` (default `1`), `WATCHTIME_EXCLUDE_LOGINS` (default empty). `WATCHTIME_TICKET_AWARD` is retired.
- Collections exactly: `watch_sessions`, `watch_chat`, `watch_bank`. Ledger reasons exactly: `watchtime`, `watchtime_banked`. Per-stream ledger doc id exactly: `watch_{streamId}_{twitchId}`.
- Viewers are keyed by **Twitch user id** (string), never by login.
- Never credited: `TWITCH_BROADCASTER_ID`, `TWITCH_BOT_ID`, built-in bot logins, `WATCHTIME_EXCLUDE_LOGINS`.
- Cron: `{ "path": "/api/cron/watchtime-tick", "schedule": "*/5 * * * *" }` (Vercel Pro, confirmed).
- `api/**` files are ESM with explicit `.js` import extensions. Pure logic files import nothing from firebase or fetch.
- Client code in `src/` cannot import from `api/` (CRA ModuleScopePlugin); tests in `src/__tests__/` can.
- react-scripts 5 runs Jest with `resetMocks: true`: `jest.fn()` implementations from `jest.mock` factories are wiped before every test, so set them in `beforeEach`.
- Commits: short imperative subject in the repo's `type(scope): subject` style. **No `Co-Authored-By` or any Claude attribution** (user's global rule). This checkout is shared with other sessions: every commit command checks the branch first (`[ "$(git branch --show-current)" = "feat/live-watchtime" ] && ...`).

## Review Focus

1. **A cron run that fires twice, or late, for the same window** should credit and pay that window once. Tested in Task 1 (`applyWindow` returns null), Task 4 (`creditSession` duplicate is a no-op; tick with `credited === false` does not pay out).
2. **A viewer who banked tickets and then logs in mid-stream** should get the bank claimed at login and a per-stream ledger line that has a `createdAt` and counts only what was paid to the account. Tested in Task 2 (`planSettlement` "banked earlier, then signed up mid-stream").
3. **Bots, the broadcaster and the bot account** — whether in the chatter list or chatting — are never credited. Tested in Task 4 (tick "credits the completed window without bots, broadcaster or bot account").
4. **A bad rate value in Vercel env** (blank, negative, fractional, text) falls back to the default and never produces `NaN` tickets. Tested in Task 1 (`readRates`).
5. **The stream flapping offline and back with the same stream id** reopens the closed session and keeps accruing without double paying. Tested in Task 4 (`creditSession` "reopens a session closed by an offline blip").

## Test command

Run from the repo root in Git Bash:

```bash
CI=true npm test -- --watchAll=false --testPathPattern=watchtime
```

Syntax check for `api/` files no test imports (CRA's build only compiles `src/`):

```bash
node -e "const a=require('acorn'),fs=require('fs');process.argv.slice(1).forEach(f=>a.parse(fs.readFileSync(f,'utf8'),{ecmaVersion:'latest',sourceType:'module'}));console.log('syntax ok')" <files...>
```

## File map

| File | Status | Responsibility |
| --- | --- | --- |
| `api/_lib/watchtime.js` | Create | Pure: windows, rates, exclusion, crediting, payout planning, duration text |
| `api/_lib/watchtimeStore.js` | Create | Firestore I/O: chat markers, sessions, payouts, bank claim |
| `api/cron/watchtime-tick.js` | Create | Cron handler orchestrating one tick |
| `api/cron/award-watchtime.js` | Delete | Old daily snapshot award |
| `api/twitch/eventsub.js` | Modify | Write a chat marker per viewer per window |
| `api/twitch-auth.js` | Modify | Claim banked tickets on login; init `watchMinutes` |
| `api/admin/users.js` | Modify | Return `watchMinutes` |
| `api/admin/reset.js` | Modify | Tickets scope also wipes watch collections + `watchMinutes` |
| `src/contexts/TwitchAuthContext.js` | Modify | Return `banked` from sign-in |
| `src/pages/TwitchCallbackPage.js` | Modify | Pass `banked` to `/me` via router state |
| `src/pages/MyAccountPage.js` | Modify | Banked banner, "Hung out" stat, earn copy, ledger label |
| `src/pages/AdminTicketsPage.js` | Modify | Ledger label |
| `src/pages/AdminUsersPage.js` | Modify | Watched-hours stat tile |
| `src/pages/AdminHubPage.js` | Modify | Reset scope description |
| `src/pages/StorePage.js` | Modify | Header copy |
| `vercel.json` | Modify | Cron swap |
| `firestore.rules` | Modify | Explicit server-only blocks |
| `firestore.indexes.json` | Modify | Exempt nested maps from indexing |
| `.env.example`, `scripts/get-broadcaster-refresh-token.mjs`, `CLAUDE.md` | Modify | Docs |
| `src/__tests__/watchtime.test.js` | Create | Pure logic tests |
| `src/__tests__/watchtimeStore.test.js` | Create | Store tests against a fake Firestore |
| `src/__tests__/watchtimeTick.test.js` | Create | Tick handler tests with mocked Twitch + store |

---

### Task 1: Accrual logic (windows, rates, exclusion, crediting)

**Files:**
- Create: `api/_lib/watchtime.js`
- Test: `src/__tests__/watchtime.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `api/_lib/watchtime.js`):
  - `WINDOW_MS: number` (300000), `WINDOW_MINUTES: number` (5), `WINDOWS_PER_SETTLE: number` (6)
  - `windowId(ms: number): number`
  - `completedWindow(ms: number): number`
  - `shouldSettle(completed: number): boolean`
  - `readRates(env: object): { perWindow: number, chatBonus: number }`
  - `exclusionFromEnv(env: object): { ids: Set<string>, logins: Set<string> }`
  - `isExcludedViewer({ id, login }, exclusion): boolean`
  - `withoutExcluded(viewers: Map<string,string>, exclusion): Map<string,string>`
  - `creditWindow(viewers: object, { present: Map, chatted: Map }): object` — viewer entry shape `{ login, present, chat, paidTickets, paidPresent, ledgerTickets, ledgerMinutes }`
  - `applyWindow(session: object|null, { completed, present, chatted }): { isNew: boolean, lastWindow: number, viewers: object } | null`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/watchtime.test.js`:

```js
import {
  WINDOW_MS,
  windowId,
  completedWindow,
  shouldSettle,
  readRates,
  exclusionFromEnv,
  isExcludedViewer,
  withoutExcluded,
  creditWindow,
  applyWindow,
} from '../../api/_lib/watchtime';

const viewer = (overrides = {}) => ({
  login: 'someone',
  present: 0,
  chat: 0,
  paidTickets: 0,
  paidPresent: 0,
  ledgerTickets: 0,
  ledgerMinutes: 0,
  ...overrides,
});

describe('windows', () => {
  test('windowId cuts time into 5-minute buckets', () => {
    expect(windowId(0)).toBe(0);
    expect(windowId(WINDOW_MS - 1)).toBe(0);
    expect(windowId(WINDOW_MS)).toBe(1);
  });

  test('a tick credits the window that just ended, even when cron fires late', () => {
    const boundary = 1000 * WINDOW_MS;
    expect(completedWindow(boundary + 200)).toBe(999);
    expect(completedWindow(boundary + 59000)).toBe(999);
  });

  test('pays out at every :00 and :30 boundary', () => {
    expect(shouldSettle(5)).toBe(true);
    expect(shouldSettle(11)).toBe(true);
    expect(shouldSettle(0)).toBe(false);
    expect(shouldSettle(6)).toBe(false);
  });
});

describe('readRates', () => {
  test('defaults when unset', () => {
    expect(readRates({})).toEqual({ perWindow: 1, chatBonus: 1 });
  });

  test('reads non-negative integers, including 0', () => {
    expect(
      readRates({ WATCHTIME_TICKETS_PER_WINDOW: '2', WATCHTIME_CHAT_BONUS: '0' })
    ).toEqual({ perWindow: 2, chatBonus: 0 });
  });

  test('falls back on blank, negative, fractional or non-numeric values', () => {
    expect(
      readRates({ WATCHTIME_TICKETS_PER_WINDOW: '  ', WATCHTIME_CHAT_BONUS: '-3' })
    ).toEqual({ perWindow: 1, chatBonus: 1 });
    expect(
      readRates({ WATCHTIME_TICKETS_PER_WINDOW: 'abc', WATCHTIME_CHAT_BONUS: '1.5' })
    ).toEqual({ perWindow: 1, chatBonus: 1 });
  });
});

describe('exclusion', () => {
  const ex = exclusionFromEnv({
    TWITCH_BROADCASTER_ID: '100',
    TWITCH_BOT_ID: '200',
    WATCHTIME_EXCLUDE_LOGINS: ' MyModBot , other ',
  });

  test('broadcaster and bot account ids', () => {
    expect(isExcludedViewer({ id: '100', login: 'gooferg' }, ex)).toBe(true);
    expect(isExcludedViewer({ id: '200', login: 'goofbot' }, ex)).toBe(true);
  });

  test('built-in bot logins, case-insensitive', () => {
    expect(isExcludedViewer({ id: '5', login: 'Nightbot' }, ex)).toBe(true);
    expect(isExcludedViewer({ id: '6', login: 'streamelements' }, ex)).toBe(true);
  });

  test('env logins are trimmed and case-insensitive', () => {
    expect(isExcludedViewer({ id: '7', login: 'mymodbot' }, ex)).toBe(true);
    expect(isExcludedViewer({ id: '8', login: 'OTHER' }, ex)).toBe(true);
  });

  test('regular viewers pass', () => {
    expect(isExcludedViewer({ id: '9', login: 'viewer' }, ex)).toBe(false);
  });

  test('no env ids means nobody is excluded by id', () => {
    const bare = exclusionFromEnv({});
    expect(bare.ids.size).toBe(0);
    expect(isExcludedViewer({ id: '100', login: 'gooferg' }, bare)).toBe(false);
  });

  test('withoutExcluded filters an id -> login map', () => {
    const all = new Map([
      ['100', 'gooferg'],
      ['5', 'streamelements'],
      ['9', 'viewer'],
    ]);
    expect([...withoutExcluded(all, ex)]).toEqual([['9', 'viewer']]);
  });
});

describe('creditWindow', () => {
  test('a viewer in the chatter list gets a present window and no chat window', () => {
    const next = creditWindow({}, { present: new Map([['1', 'lurker']]), chatted: new Map() });
    expect(next['1']).toEqual(viewer({ login: 'lurker', present: 1 }));
  });

  test('a viewer who chatted but is not in the lagging chatter list still counts as present', () => {
    const next = creditWindow({}, { present: new Map(), chatted: new Map([['2', 'chatty']]) });
    expect(next['2']).toEqual(viewer({ login: 'chatty', present: 1, chat: 1 }));
  });

  test('present and chatted earns both', () => {
    const next = creditWindow(
      {},
      { present: new Map([['3', 'both']]), chatted: new Map([['3', 'both']]) }
    );
    expect(next['3']).toMatchObject({ present: 1, chat: 1 });
  });

  test('keeps existing counters and paid fields', () => {
    const before = { '4': viewer({ login: 'old', present: 5, chat: 2, paidTickets: 7, paidPresent: 5 }) };
    const next = creditWindow(before, { present: new Map([['4', 'renamed']]), chatted: new Map() });
    expect(next['4']).toEqual(
      viewer({ login: 'renamed', present: 6, chat: 2, paidTickets: 7, paidPresent: 5 })
    );
  });

  test('viewers who left are untouched, and the input is not mutated', () => {
    const before = { '5': viewer({ present: 3 }) };
    const snapshot = JSON.stringify(before);
    const next = creditWindow(before, { present: new Map([['6', 'new']]), chatted: new Map() });
    expect(next['5']).toEqual(before['5']);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('applyWindow', () => {
  const present = new Map([['1', 'a']]);
  const chatted = new Map();

  test('starts a new session', () => {
    const r = applyWindow(null, { completed: 10, present, chatted });
    expect(r.isNew).toBe(true);
    expect(r.lastWindow).toBe(10);
    expect(r.viewers['1']).toMatchObject({ present: 1 });
  });

  test('credits the next window on top of an existing session', () => {
    const session = { lastWindow: 10, viewers: { '1': viewer({ login: 'a', present: 1 }) } };
    const r = applyWindow(session, { completed: 11, present, chatted });
    expect(r.isNew).toBe(false);
    expect(r.lastWindow).toBe(11);
    expect(r.viewers['1'].present).toBe(2);
  });

  test('a duplicate or late fire for an already-credited window is a no-op', () => {
    const session = { lastWindow: 10, viewers: {} };
    expect(applyWindow(session, { completed: 10, present, chatted })).toBeNull();
    expect(applyWindow(session, { completed: 9, present, chatted })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: FAIL — `Cannot find module '../../api/_lib/watchtime'`.

- [ ] **Step 3: Write the implementation**

Create `api/_lib/watchtime.js`:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: PASS, all tests in `watchtime.test.js`.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/live-watchtime" ] && git add api/_lib/watchtime.js src/__tests__/watchtime.test.js && git commit -m "feat(watchtime): pure window crediting and viewer exclusion"
```

---

### Task 2: Payout planning (amount owed, ledger text, settlement plan)

**Files:**
- Modify: `api/_lib/watchtime.js` (append)
- Test: `src/__tests__/watchtime.test.js` (append)

**Interfaces:**
- Consumes: `WINDOW_MINUTES` and the viewer entry shape from Task 1.
- Produces (exported from `api/_lib/watchtime.js`):
  - `formatDuration(minutes: number): string` — `"0m"`, `"5m"`, `"1h"`, `"1h 35m"`
  - `formatWatchNote(minutes: number): string` — `"Watched 1h 35m"`
  - `owedFor(viewer, rates): { tickets: number, windows: number }`
  - `planSettlement(viewers: object, ids: string[], hasAccount: Set<string>, rates): { viewers: object, accountCredits: AccountCredit[], bankCredits: BankCredit[] }`
    - `AccountCredit = { id, tickets, minutes, ledger: { delta, minutes, note, first } }`
    - `BankCredit = { id, login, tickets, minutes }`

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/watchtime.test.js`, extend the import at the top to:

```js
import {
  WINDOW_MS,
  windowId,
  completedWindow,
  shouldSettle,
  readRates,
  exclusionFromEnv,
  isExcludedViewer,
  withoutExcluded,
  creditWindow,
  applyWindow,
  formatDuration,
  formatWatchNote,
  owedFor,
  planSettlement,
} from '../../api/_lib/watchtime';
```

Append to the end of the file:

```js
const RATES = { perWindow: 1, chatBonus: 1 };

describe('formatDuration / formatWatchNote', () => {
  test('minutes, hours, and both', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(5)).toBe('5m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(95)).toBe('1h 35m');
    expect(formatWatchNote(95)).toBe('Watched 1h 35m');
  });
});

describe('owedFor', () => {
  test('first payout owes everything earned', () => {
    expect(owedFor(viewer({ present: 6, chat: 2 }), RATES)).toEqual({ tickets: 8, windows: 6 });
  });

  test('later payouts owe only the unpaid part', () => {
    const v = viewer({ present: 6, chat: 2, paidTickets: 5, paidPresent: 3 });
    expect(owedFor(v, RATES)).toEqual({ tickets: 3, windows: 3 });
  });

  test('nothing new owes nothing', () => {
    const v = viewer({ present: 6, chat: 2, paidTickets: 8, paidPresent: 6 });
    expect(owedFor(v, RATES)).toEqual({ tickets: 0, windows: 0 });
  });

  test('a rate lowered mid-stream never owes negative tickets', () => {
    const v = viewer({ present: 6, chat: 2, paidTickets: 8, paidPresent: 6 });
    expect(owedFor(v, { perWindow: 0, chatBonus: 0 })).toEqual({ tickets: 0, windows: 0 });
  });

  test('custom rates', () => {
    expect(owedFor(viewer({ present: 4, chat: 1 }), { perWindow: 2, chatBonus: 3 })).toEqual({
      tickets: 11,
      windows: 4,
    });
  });
});

describe('planSettlement', () => {
  test('first payout to an account: tickets, minutes, and a new ledger line', () => {
    const viewers = { '1': viewer({ login: 'member', present: 6, chat: 2 }) };
    const plan = planSettlement(viewers, ['1'], new Set(['1']), RATES);
    expect(plan.accountCredits).toEqual([
      {
        id: '1',
        tickets: 8,
        minutes: 30,
        ledger: { delta: 8, minutes: 30, note: 'Watched 30m', first: true },
      },
    ]);
    expect(plan.bankCredits).toEqual([]);
    expect(plan.viewers['1']).toMatchObject({
      paidTickets: 8,
      paidPresent: 6,
      ledgerTickets: 8,
      ledgerMinutes: 30,
    });
  });

  test('second payout in the same stream grows the same ledger line', () => {
    const viewers = {
      '1': viewer({
        present: 12,
        chat: 2,
        paidTickets: 8,
        paidPresent: 6,
        ledgerTickets: 8,
        ledgerMinutes: 30,
      }),
    };
    const plan = planSettlement(viewers, ['1'], new Set(['1']), RATES);
    expect(plan.accountCredits).toEqual([
      {
        id: '1',
        tickets: 6,
        minutes: 30,
        ledger: { delta: 14, minutes: 60, note: 'Watched 1h', first: false },
      },
    ]);
  });

  test('no account: tickets go to the bank and no ledger fields change', () => {
    const viewers = { '2': viewer({ login: 'lurker', present: 3 }) };
    const plan = planSettlement(viewers, ['2'], new Set(), RATES);
    expect(plan.accountCredits).toEqual([]);
    expect(plan.bankCredits).toEqual([{ id: '2', login: 'lurker', tickets: 3, minutes: 15 }]);
    expect(plan.viewers['2']).toMatchObject({
      paidTickets: 3,
      paidPresent: 3,
      ledgerTickets: 0,
      ledgerMinutes: 0,
    });
  });

  test('banked earlier, then signed up mid-stream: ledger line starts fresh and excludes the banked part', () => {
    const viewers = {
      '3': viewer({ present: 12, chat: 2, paidTickets: 8, paidPresent: 6 }),
    };
    const plan = planSettlement(viewers, ['3'], new Set(['3']), RATES);
    expect(plan.accountCredits).toEqual([
      {
        id: '3',
        tickets: 6,
        minutes: 30,
        ledger: { delta: 6, minutes: 30, note: 'Watched 30m', first: true },
      },
    ]);
  });

  test('nothing owed produces no credits and leaves the viewer as is', () => {
    const viewers = {
      '4': viewer({ present: 2, paidTickets: 2, paidPresent: 2, ledgerTickets: 2, ledgerMinutes: 10 }),
    };
    const plan = planSettlement(viewers, ['4'], new Set(['4']), RATES);
    expect(plan.accountCredits).toEqual([]);
    expect(plan.bankCredits).toEqual([]);
    expect(plan.viewers['4']).toEqual(viewers['4']);
  });

  test('only the given ids are settled; unknown ids are ignored; input is not mutated', () => {
    const viewers = {
      '5': viewer({ present: 1 }),
      '6': viewer({ present: 1 }),
    };
    const snapshot = JSON.stringify(viewers);
    const plan = planSettlement(viewers, ['5', 'missing'], new Set(['5', '6']), RATES);
    expect(plan.accountCredits.map((c) => c.id)).toEqual(['5']);
    expect(plan.viewers['6']).toEqual(viewers['6']);
    expect(JSON.stringify(viewers)).toBe(snapshot);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: FAIL — `formatDuration is not a function` (and the other new names).

- [ ] **Step 3: Write the implementation**

Append to `api/_lib/watchtime.js`:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: PASS, all tests in `watchtime.test.js`.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/live-watchtime" ] && git add api/_lib/watchtime.js src/__tests__/watchtime.test.js && git commit -m "feat(watchtime): plan per-stream payouts and banking"
```

---

### Task 3: Chat markers from EventSub

**Files:**
- Create: `api/_lib/watchtimeStore.js`
- Modify: `api/twitch/eventsub.js` (imports near line 4, header comment near line 15, `handleChatMessage` near line 148)
- Test: `src/__tests__/watchtimeStore.test.js`

**Interfaces:**
- Consumes: `windowId` from Task 1.
- Produces: `markChatted(chatterId: string, chatterLogin: string, now?: number): Promise<boolean>` (true when it wrote). Writes `watch_chat/{windowId}` = `{ window: number, chatters: { [id]: login } }`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/watchtimeStore.test.js`. The fake Firestore below records every write in `mockWrites` and serves reads from `mockDocs`; Tasks 4 and 5 add tests to this same file and rely on it.

```js
/**
 * @jest-environment node
 */
// Fake Firestore: reads come from mockDocs (path -> data), every write is
// recorded in mockWrites as [op, path, data?, options?]. Writes do not update
// mockDocs; tests seed mockDocs with the state they need.
const mockDocs = new Map();
const mockWrites = [];

jest.mock('../../api/_lib/firebaseAdmin.js', () => {
  let auto = 0;
  const snap = (path) => {
    const data = mockDocs.get(path);
    return { id: path.split('/').pop(), exists: data !== undefined, data: () => data };
  };
  const ref = (path) => ({
    path,
    get: async () => snap(path),
    set: async (data, opts) => {
      mockWrites.push(['set', path, data, opts]);
    },
    update: async (data) => {
      mockWrites.push(['update', path, data]);
    },
  });
  const collection = (col) => ({
    doc: (id) => ref(`${col}/${id === undefined ? `auto${++auto}` : id}`),
    where: (field, op, value) => ({
      get: async () => {
        const docs = [...mockDocs.entries()]
          .filter(([path]) => path.startsWith(`${col}/`) && !path.slice(col.length + 1).includes('/'))
          .filter(([, data]) => {
            if (op === '<') return data[field] < value;
            if (op === '==') return data[field] === value;
            throw new Error(`fake where: unsupported op ${op}`);
          })
          .map(([path, data]) => ({ id: path.split('/').pop(), ref: ref(path), data: () => data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    }),
  });
  const adminDb = {
    collection,
    batch: () => ({
      delete: (r) => mockWrites.push(['delete', r.path]),
      commit: async () => {},
    }),
    runTransaction: async (fn) =>
      fn({
        get: async (r) => snap(r.path),
        getAll: async (...refs) => refs.map((r) => snap(r.path)),
        set: (r, data, opts) => mockWrites.push(['set', r.path, data, opts]),
        update: (r, data) => mockWrites.push(['update', r.path, data]),
        delete: (r) => mockWrites.push(['delete', r.path]),
      }),
  };
  const FieldValue = {
    increment: (n) => ({ increment: n }),
    serverTimestamp: () => 'SERVER_TS',
  };
  return { adminDb, FieldValue };
});

import { markChatted } from '../../api/_lib/watchtimeStore';
import { WINDOW_MS, windowId } from '../../api/_lib/watchtime';

const NOW = 1000 * WINDOW_MS + 4200;
const W = windowId(NOW);

beforeEach(() => {
  mockDocs.clear();
  mockWrites.length = 0;
});

describe('markChatted', () => {
  test('first message in a window writes one marker with the login', async () => {
    expect(await markChatted('7', 'viewer', NOW)).toBe(true);
    expect(mockWrites).toEqual([
      ['set', `watch_chat/${W}`, { window: W, chatters: { 7: 'viewer' } }, { merge: true }],
    ]);
  });

  test('more messages from the same viewer in that window cost no writes', async () => {
    mockDocs.set(`watch_chat/${W}`, { window: W, chatters: { 7: 'viewer' } });
    expect(await markChatted('7', 'viewer', NOW)).toBe(false);
    expect(mockWrites).toEqual([]);
  });

  test('another viewer in the same window writes their own marker', async () => {
    mockDocs.set(`watch_chat/${W}`, { window: W, chatters: { 7: 'viewer' } });
    expect(await markChatted('8', 'other', NOW)).toBe(true);
    expect(mockWrites).toEqual([
      ['set', `watch_chat/${W}`, { window: W, chatters: { 8: 'other' } }, { merge: true }],
    ]);
  });

  test('the next window starts fresh', async () => {
    mockDocs.set(`watch_chat/${W}`, { window: W, chatters: { 7: 'viewer' } });
    expect(await markChatted('7', 'viewer', NOW + WINDOW_MS)).toBe(true);
    expect(mockWrites[0][1]).toBe(`watch_chat/${W + 1}`);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: FAIL — `Cannot find module '../../api/_lib/watchtimeStore'`.

- [ ] **Step 3: Create the store with `markChatted`**

Create `api/_lib/watchtimeStore.js`:

```js
import { adminDb } from './firebaseAdmin.js';
import { windowId } from './watchtime.js';

// Firestore I/O for live watch time. Every decision is made by the pure
// functions in ./watchtime.js; this file only reads and writes.
//
//   watch_chat/{windowId}       who chatted in a window (id -> login)
//   watch_sessions/{streamId}   per-stream viewer counters
//   watch_bank/{twitchId}       tickets for chatters without an account yet

const CHAT = 'watch_chat';

// Record that a viewer chatted in the current window. Reads first so a
// talkative viewer costs one write per window, not one per message.
export async function markChatted(chatterId, chatterLogin, now = Date.now()) {
  const window = windowId(now);
  const ref = adminDb.collection(CHAT).doc(String(window));
  const snap = await ref.get();
  const chatters = (snap.exists && snap.data().chatters) || {};
  if (Object.prototype.hasOwnProperty.call(chatters, chatterId)) return false;
  await ref.set({ window, chatters: { [chatterId]: chatterLogin || null } }, { merge: true });
  return true;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: PASS (`watchtime.test.js` and `watchtimeStore.test.js`).

- [ ] **Step 5: Hook it into EventSub**

In `api/twitch/eventsub.js`, add the import after the `messageHasKeyword` import:

```js
import { markChatted } from '../_lib/watchtimeStore.js';
```

In the header comment, replace the line `// For \`channel.chat.message\`:` with:

```js
// For `channel.chat.message`:
//   0. Mark the chatter in watch_chat/{windowId} so the watch-time tick can
//      pay the chat bonus (api/cron/watchtime-tick.js).
```

In `handleChatMessage`, directly after the line `if (isHostAccount(event)) return { processed: false, reason: 'host_account' };`, insert:

```js
  // Watch time: note that this viewer chatted in the current 5-minute window.
  // A failure only costs that window's chat bonus, so it never blocks
  // giveaway entry.
  try {
    await markChatted(chatterId, chatterLogin);
  } catch (err) {
    console.warn('markChatted failed', chatterId, err.message);
  }
```

- [ ] **Step 6: Syntax-check the handler**

Run: `node -e "const a=require('acorn'),fs=require('fs');process.argv.slice(1).forEach(f=>a.parse(fs.readFileSync(f,'utf8'),{ecmaVersion:'latest',sourceType:'module'}));console.log('syntax ok')" api/twitch/eventsub.js`
Expected: `syntax ok`

- [ ] **Step 7: Commit**

```bash
[ "$(git branch --show-current)" = "feat/live-watchtime" ] && git add api/_lib/watchtimeStore.js api/twitch/eventsub.js src/__tests__/watchtimeStore.test.js && git commit -m "feat(watchtime): mark chatters per window from EventSub"
```

---

### Task 4: The 5-minute tick (sessions, payouts, cron swap)

**Files:**
- Modify: `api/_lib/watchtimeStore.js` (imports + append)
- Create: `api/cron/watchtime-tick.js`
- Delete: `api/cron/award-watchtime.js`
- Modify: `vercel.json`, `.env.example` (lines 58-61), `scripts/get-broadcaster-refresh-token.mjs` (line 58)
- Test: `src/__tests__/watchtimeStore.test.js` (append), `src/__tests__/watchtimeTick.test.js` (create)

**Interfaces:**
- Consumes: from `watchtime.js` — `windowId`, `completedWindow`, `shouldSettle`, `readRates`, `exclusionFromEnv`, `withoutExcluded`, `applyWindow`, `planSettlement`. From `twitchBroadcasterToken.js` — `getAppAccessToken(): Promise<string>`, `getBroadcasterAccessToken(): Promise<string>`, `helix(method, path, token): Promise<object>`.
- Produces (exported from `watchtimeStore.js`):
  - `takeChatMarkers(currentWindow: number, completed: number): Promise<{ chatted: Map<string,string>, refs: DocRef[] }>`
  - `deleteRefs(refs: DocRef[]): Promise<void>`
  - `openSessionIds(): Promise<string[]>`
  - `creditSession(streamId: string, { completed, present, chatted }): Promise<boolean>`
  - `settleSession(streamId: string, rates, { close?: boolean }): Promise<{ accounts: number, banked: number }>`
  - Handler `api/cron/watchtime-tick.js` default export `(req, res)`.

- [ ] **Step 1: Write the failing store tests**

In `src/__tests__/watchtimeStore.test.js`, change the store import to:

```js
import {
  markChatted,
  takeChatMarkers,
  deleteRefs,
  openSessionIds,
  creditSession,
  settleSession,
} from '../../api/_lib/watchtimeStore';
```

Append:

```js
const fresh = (overrides = {}) => ({
  login: 'someone',
  present: 0,
  chat: 0,
  paidTickets: 0,
  paidPresent: 0,
  ledgerTickets: 0,
  ledgerMinutes: 0,
  ...overrides,
});

describe('takeChatMarkers / deleteRefs', () => {
  test('returns the completed window chatters and every stale marker to delete', async () => {
    mockDocs.set('watch_chat/8', { window: 8, chatters: { 1: 'old' } });
    mockDocs.set('watch_chat/9', { window: 9, chatters: { 2: 'a', 3: 'b' } });
    mockDocs.set('watch_chat/10', { window: 10, chatters: { 4: 'current' } });
    const { chatted, refs } = await takeChatMarkers(10, 9);
    expect([...chatted]).toEqual([
      ['2', 'a'],
      ['3', 'b'],
    ]);
    expect(refs.map((r) => r.path).sort()).toEqual(['watch_chat/8', 'watch_chat/9']);
    await deleteRefs(refs);
    expect(mockWrites.map((w) => w.join(' ')).sort()).toEqual([
      'delete watch_chat/8',
      'delete watch_chat/9',
    ]);
  });
});

describe('openSessionIds', () => {
  test('lists only open sessions', async () => {
    mockDocs.set('watch_sessions/a', { status: 'open' });
    mockDocs.set('watch_sessions/b', { status: 'closed' });
    expect(await openSessionIds()).toEqual(['a']);
  });
});

describe('creditSession', () => {
  const present = new Map([['1', 'a']]);
  const chatted = new Map();

  test('creates the session on the first credited window', async () => {
    expect(await creditSession('s1', { completed: 10, present, chatted })).toBe(true);
    expect(mockWrites).toHaveLength(1);
    const [op, path, data] = mockWrites[0];
    expect(op).toBe('set');
    expect(path).toBe('watch_sessions/s1');
    expect(data).toMatchObject({
      streamId: 's1',
      status: 'open',
      startedAt: 'SERVER_TS',
      lastWindow: 10,
      lastSettledAt: null,
      closedAt: null,
    });
    expect(data.viewers['1']).toMatchObject({ login: 'a', present: 1 });
  });

  test('a duplicate fire for an already-credited window writes nothing', async () => {
    mockDocs.set('watch_sessions/s1', { status: 'open', lastWindow: 10, viewers: {} });
    expect(await creditSession('s1', { completed: 10, present, chatted })).toBe(false);
    expect(mockWrites).toEqual([]);
  });

  test('reopens a session closed by an offline blip when the same stream comes back', async () => {
    mockDocs.set('watch_sessions/s1', {
      status: 'closed',
      lastWindow: 9,
      viewers: { '1': fresh({ login: 'a', present: 4, paidTickets: 4, paidPresent: 4 }) },
    });
    expect(await creditSession('s1', { completed: 10, present, chatted })).toBe(true);
    const [op, path, data] = mockWrites[0];
    expect([op, path]).toEqual(['update', 'watch_sessions/s1']);
    expect(data).toMatchObject({ status: 'open', closedAt: null, lastWindow: 10 });
    expect(data.viewers['1']).toMatchObject({ present: 5, paidTickets: 4, paidPresent: 4 });
  });
});

describe('settleSession', () => {
  const RATES = { perWindow: 1, chatBonus: 1 };

  test('pays account holders, banks the rest, records what was paid, and closes', async () => {
    mockDocs.set('watch_sessions/s1', {
      status: 'open',
      viewers: {
        '1': fresh({ login: 'member', present: 6, chat: 2 }),
        '2': fresh({ login: 'lurker', present: 3 }),
      },
    });
    mockDocs.set('users/1', { tickets: 5 });

    expect(await settleSession('s1', RATES, { close: true })).toEqual({ accounts: 1, banked: 1 });

    expect(mockWrites).toContainEqual([
      'update',
      'users/1',
      {
        tickets: { increment: 8 },
        totalEarned: { increment: 8 },
        watchMinutes: { increment: 30 },
        updatedAt: 'SERVER_TS',
      },
    ]);
    expect(mockWrites).toContainEqual([
      'set',
      'ticket_ledger/watch_s1_1',
      {
        userId: '1',
        reason: 'watchtime',
        refId: 's1',
        delta: 8,
        minutes: 30,
        note: 'Watched 30m',
        updatedAt: 'SERVER_TS',
        createdAt: 'SERVER_TS',
      },
      { merge: true },
    ]);
    expect(mockWrites).toContainEqual([
      'set',
      'watch_bank/2',
      {
        login: 'lurker',
        tickets: { increment: 3 },
        minutes: { increment: 15 },
        updatedAt: 'SERVER_TS',
      },
      { merge: true },
    ]);
    const viewersWrite = mockWrites.find(
      (w) => w[0] === 'update' && w[1] === 'watch_sessions/s1' && w[2].viewers
    );
    expect(viewersWrite[2].viewers['1']).toMatchObject({
      paidTickets: 8,
      paidPresent: 6,
      ledgerTickets: 8,
      ledgerMinutes: 30,
    });
    expect(viewersWrite[2].viewers['2']).toMatchObject({
      paidTickets: 3,
      paidPresent: 3,
      ledgerTickets: 0,
      ledgerMinutes: 0,
    });
    expect(mockWrites).toContainEqual([
      'update',
      'watch_sessions/s1',
      { lastSettledAt: 'SERVER_TS', status: 'closed', closedAt: 'SERVER_TS' },
    ]);
  });

  test('a later payout does not rewrite the ledger createdAt', async () => {
    mockDocs.set('watch_sessions/s1', {
      status: 'open',
      viewers: {
        '1': fresh({
          present: 12,
          chat: 2,
          paidTickets: 8,
          paidPresent: 6,
          ledgerTickets: 8,
          ledgerMinutes: 30,
        }),
      },
    });
    mockDocs.set('users/1', { tickets: 13 });
    await settleSession('s1', RATES);
    const ledger = mockWrites.find((w) => w[1] === 'ticket_ledger/watch_s1_1');
    expect(ledger[2]).toMatchObject({ delta: 14, minutes: 60, note: 'Watched 1h' });
    expect(ledger[2]).not.toHaveProperty('createdAt');
  });

  test('nothing owed: no payouts, but a final payout still closes the session', async () => {
    mockDocs.set('watch_sessions/s1', {
      status: 'open',
      viewers: { '1': fresh({ present: 2, paidTickets: 2, paidPresent: 2 }) },
    });
    expect(await settleSession('s1', RATES, { close: true })).toEqual({ accounts: 0, banked: 0 });
    expect(mockWrites).toEqual([
      [
        'update',
        'watch_sessions/s1',
        { lastSettledAt: 'SERVER_TS', status: 'closed', closedAt: 'SERVER_TS' },
      ],
    ]);
  });

  test('a missing session is a no-op', async () => {
    expect(await settleSession('nope', RATES, { close: true })).toEqual({ accounts: 0, banked: 0 });
    expect(mockWrites).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing tick tests**

Create `src/__tests__/watchtimeTick.test.js`:

```js
/**
 * @jest-environment node
 */
jest.mock('../../api/_lib/twitchBroadcasterToken.js', () => ({
  getAppAccessToken: jest.fn(),
  getBroadcasterAccessToken: jest.fn(),
  helix: jest.fn(),
}));
jest.mock('../../api/_lib/watchtimeStore.js', () => ({
  takeChatMarkers: jest.fn(),
  deleteRefs: jest.fn(),
  openSessionIds: jest.fn(),
  creditSession: jest.fn(),
  settleSession: jest.fn(),
}));

import handler from '../../api/cron/watchtime-tick';
import * as twitch from '../../api/_lib/twitchBroadcasterToken';
import * as store from '../../api/_lib/watchtimeStore';
import { WINDOW_MS } from '../../api/_lib/watchtime';

const RATES = { perWindow: 1, chatBonus: 1 };
// Window numbers for the tick's *current* window. 6000000 % 6 === 0, so the
// window it completes (5999999) is a payout window; 6000001 completes 6000000,
// which is not.
const PAYOUT_TICK = 6000000;
const QUIET_TICK = 6000001;

const ENV = process.env;

function mockRes() {
  const res = { statusCode: 0, body: undefined };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  return res;
}

const req = (authorization = 'Bearer s3cret') => ({ method: 'GET', headers: { authorization } });

function at(window) {
  jest.spyOn(Date, 'now').mockReturnValue(window * WINDOW_MS + 1500);
}

function twitchSays({ live, chatters = [] }) {
  twitch.helix.mockImplementation(async (method, path) => {
    if (path.startsWith('/streams')) return { data: live ? [{ id: live }] : [] };
    if (path.startsWith('/chat/chatters')) return { data: chatters, pagination: {} };
    throw new Error(`unexpected helix call ${path}`);
  });
}

beforeEach(() => {
  process.env = {
    ...ENV,
    CRON_SECRET: 's3cret',
    TWITCH_BROADCASTER_ID: '100',
    TWITCH_BOT_ID: '200',
  };
  twitch.getAppAccessToken.mockResolvedValue('app-token');
  twitch.getBroadcasterAccessToken.mockResolvedValue('user-token');
  store.takeChatMarkers.mockResolvedValue({ chatted: new Map(), refs: ['marker-ref'] });
  store.deleteRefs.mockResolvedValue(undefined);
  store.openSessionIds.mockResolvedValue([]);
  store.creditSession.mockResolvedValue(true);
  store.settleSession.mockResolvedValue({ accounts: 0, banked: 0 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = ENV;
});

test('refuses to run without CRON_SECRET', async () => {
  delete process.env.CRON_SECRET;
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(500);
  expect(twitch.helix).not.toHaveBeenCalled();
});

test('rejects a wrong bearer token', async () => {
  const res = mockRes();
  await handler(req('Bearer nope'), res);
  expect(res.statusCode).toBe(401);
  expect(twitch.helix).not.toHaveBeenCalled();
});

test('offline: pays out and closes open sessions, credits nothing', async () => {
  at(QUIET_TICK);
  twitchSays({ live: null });
  store.openSessionIds.mockResolvedValue(['s1']);
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(res.body).toMatchObject({ ok: true, live: false, closed: 1 });
  expect(store.settleSession).toHaveBeenCalledWith('s1', RATES, { close: true });
  expect(store.creditSession).not.toHaveBeenCalled();
  expect(store.deleteRefs).toHaveBeenCalledWith(['marker-ref']);
});

test('live: credits the completed window without bots, broadcaster or bot account', async () => {
  at(QUIET_TICK);
  twitchSays({
    live: 'stream-1',
    chatters: [
      { user_id: '100', user_login: 'gooferg' },
      { user_id: '200', user_login: 'goofbot' },
      { user_id: '5', user_login: 'Nightbot' },
      { user_id: '8', user_login: 'Viewer' },
    ],
  });
  store.takeChatMarkers.mockResolvedValue({
    chatted: new Map([
      ['9', 'chatty'],
      ['6', 'streamelements'],
    ]),
    refs: ['marker-ref'],
  });
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(store.takeChatMarkers).toHaveBeenCalledWith(QUIET_TICK, QUIET_TICK - 1);
  expect(store.creditSession).toHaveBeenCalledWith('stream-1', {
    completed: QUIET_TICK - 1,
    present: new Map([['8', 'viewer']]),
    chatted: new Map([['9', 'chatty']]),
  });
  expect(store.settleSession).not.toHaveBeenCalled();
  expect(store.deleteRefs).toHaveBeenCalledWith(['marker-ref']);
});

test('live: pays out on a half-hour window', async () => {
  at(PAYOUT_TICK);
  twitchSays({ live: 'stream-1', chatters: [{ user_id: '8', user_login: 'viewer' }] });
  const res = mockRes();
  await handler(req(), res);
  expect(store.settleSession).toHaveBeenCalledTimes(1);
  expect(store.settleSession).toHaveBeenCalledWith('stream-1', RATES);
});

test('a duplicate fire for an already-credited window does not pay out again', async () => {
  at(PAYOUT_TICK);
  twitchSays({ live: 'stream-1', chatters: [{ user_id: '8', user_login: 'viewer' }] });
  store.creditSession.mockResolvedValue(false);
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(store.settleSession).not.toHaveBeenCalled();
});

test('a restarted stream closes the old session and keeps the current one open', async () => {
  at(QUIET_TICK);
  twitchSays({ live: 'stream-2', chatters: [] });
  store.openSessionIds.mockResolvedValue(['stream-1', 'stream-2']);
  const res = mockRes();
  await handler(req(), res);
  expect(store.settleSession).toHaveBeenCalledTimes(1);
  expect(store.settleSession).toHaveBeenCalledWith('stream-1', RATES, { close: true });
  expect(store.creditSession).toHaveBeenCalledWith('stream-2', expect.any(Object));
});

test('follows chatter pagination', async () => {
  at(QUIET_TICK);
  twitch.helix.mockImplementation(async (method, path) => {
    if (path.startsWith('/streams')) return { data: [{ id: 'stream-1' }] };
    if (path.includes('after=page2')) {
      return { data: [{ user_id: '11', user_login: 'second' }], pagination: {} };
    }
    return { data: [{ user_id: '10', user_login: 'first' }], pagination: { cursor: 'page2' } };
  });
  const res = mockRes();
  await handler(req(), res);
  expect(store.creditSession.mock.calls[0][1].present).toEqual(
    new Map([
      ['10', 'first'],
      ['11', 'second'],
    ])
  );
});

test('a Twitch failure writes nothing', async () => {
  at(QUIET_TICK);
  twitch.helix.mockRejectedValue(new Error('HELIX_503:/streams'));
  const res = mockRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(500);
  expect(store.creditSession).not.toHaveBeenCalled();
  expect(store.settleSession).not.toHaveBeenCalled();
  expect(store.deleteRefs).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: FAIL — `takeChatMarkers is not a function` in the store tests and `Cannot find module '../../api/cron/watchtime-tick'` in the tick tests.

- [ ] **Step 4: Add the session and payout functions to the store**

In `api/_lib/watchtimeStore.js`, replace the two import lines with:

```js
import { adminDb, FieldValue } from './firebaseAdmin.js';
import { windowId, applyWindow, planSettlement } from './watchtime.js';
```

Replace `const CHAT = 'watch_chat';` with:

```js
const CHAT = 'watch_chat';
const SESSIONS = 'watch_sessions';
const BANK = 'watch_bank';
// Viewers per payout transaction: at most 2 writes each plus 1 session write,
// under Firestore's 500-write transaction limit.
const SETTLE_CHUNK = 200;
const DELETE_CHUNK = 400;
```

Append to the end of the file:

```js
// Chat markers for every window before `currentWindow`. Only the `completed`
// window counts toward the chat bonus; older ones (missed ticks, chat while
// offline) are just returned for deletion.
export async function takeChatMarkers(currentWindow, completed) {
  const snap = await adminDb.collection(CHAT).where('window', '<', currentWindow).get();
  const chatted = new Map();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.window !== completed) return;
    Object.entries(data.chatters || {}).forEach(([id, login]) => chatted.set(id, login));
  });
  return { chatted, refs: snap.docs.map((d) => d.ref) };
}

export async function deleteRefs(refs) {
  for (let i = 0; i < refs.length; i += DELETE_CHUNK) {
    const batch = adminDb.batch();
    refs.slice(i, i + DELETE_CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function openSessionIds() {
  const snap = await adminDb.collection(SESSIONS).where('status', '==', 'open').get();
  return snap.docs.map((d) => d.id);
}

// Credit one window onto the stream's session: a single document write no
// matter how many people are in chat. Returns false when the window was
// already credited (duplicate or late cron run).
export async function creditSession(streamId, { completed, present, chatted }) {
  const ref = adminDb.collection(SESSIONS).doc(streamId);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = applyWindow(snap.exists ? snap.data() : null, { completed, present, chatted });
    if (!next) return false;
    if (next.isNew) {
      tx.set(ref, {
        streamId,
        status: 'open',
        startedAt: FieldValue.serverTimestamp(),
        lastWindow: next.lastWindow,
        lastSettledAt: null,
        closedAt: null,
        viewers: next.viewers,
      });
    } else {
      // A session closed by an offline blip reopens when the same stream id
      // comes back; payouts are incremental, so nothing is paid twice.
      tx.update(ref, {
        status: 'open',
        closedAt: null,
        lastWindow: next.lastWindow,
        viewers: next.viewers,
      });
    }
    return true;
  });
}

// Pay out what a session owes. Each chunk is its own transaction that
// re-reads the session, so two payouts running at once (a duplicate cron
// fire) serialize and the second owes nothing. A crash between chunks leaves
// the rest for the next payout.
export async function settleSession(streamId, rates, { close = false } = {}) {
  const ref = adminDb.collection(SESSIONS).doc(streamId);
  const first = await ref.get();
  if (!first.exists) return { accounts: 0, banked: 0 };
  const ids = Object.keys(first.data().viewers || {});
  let accounts = 0;
  let banked = 0;

  for (let i = 0; i < ids.length; i += SETTLE_CHUNK) {
    const chunk = ids.slice(i, i + SETTLE_CHUNK);
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const users = await tx.getAll(...chunk.map((id) => adminDb.collection('users').doc(id)));
      const hasAccount = new Set(users.filter((u) => u.exists).map((u) => u.id));
      const plan = planSettlement(snap.data().viewers || {}, chunk, hasAccount, rates);
      if (plan.accountCredits.length === 0 && plan.bankCredits.length === 0) {
        return { accounts: 0, banked: 0 };
      }
      const now = FieldValue.serverTimestamp();
      plan.accountCredits.forEach((c) => {
        tx.update(adminDb.collection('users').doc(c.id), {
          tickets: FieldValue.increment(c.tickets),
          totalEarned: FieldValue.increment(c.tickets),
          watchMinutes: FieldValue.increment(c.minutes),
          updatedAt: now,
        });
        const line = {
          userId: c.id,
          reason: 'watchtime',
          refId: streamId,
          delta: c.ledger.delta,
          minutes: c.ledger.minutes,
          note: c.ledger.note,
          updatedAt: now,
        };
        // The history view orders by createdAt; set it once so the line keeps
        // its place while it grows through the stream.
        if (c.ledger.first) line.createdAt = now;
        tx.set(adminDb.collection('ticket_ledger').doc(`watch_${streamId}_${c.id}`), line, {
          merge: true,
        });
      });
      plan.bankCredits.forEach((c) => {
        tx.set(
          adminDb.collection(BANK).doc(c.id),
          {
            login: c.login,
            tickets: FieldValue.increment(c.tickets),
            minutes: FieldValue.increment(c.minutes),
            updatedAt: now,
          },
          { merge: true }
        );
      });
      tx.update(ref, { viewers: plan.viewers });
      return { accounts: plan.accountCredits.length, banked: plan.bankCredits.length };
    });
    accounts += result.accounts;
    banked += result.banked;
  }

  const done = { lastSettledAt: FieldValue.serverTimestamp() };
  if (close) {
    done.status = 'closed';
    done.closedAt = FieldValue.serverTimestamp();
  }
  await ref.update(done);
  return { accounts, banked };
}
```

Note: in the "nothing owed" store test the expected writes contain only the final `update`; the transaction returns early before any `tx` writes, which is what makes that assertion hold.

- [ ] **Step 5: Create the tick handler**

Create `api/cron/watchtime-tick.js`:

```js
import crypto from 'crypto';
import {
  getAppAccessToken,
  getBroadcasterAccessToken,
  helix,
} from '../_lib/twitchBroadcasterToken.js';
import {
  windowId,
  completedWindow,
  shouldSettle,
  readRates,
  exclusionFromEnv,
  withoutExcluded,
} from '../_lib/watchtime.js';
import {
  takeChatMarkers,
  deleteRefs,
  openSessionIds,
  creditSession,
  settleSession,
} from '../_lib/watchtimeStore.js';

// Live watch-time tick. Vercel cron runs it every 5 minutes (vercel.json).
// Credits the 5-minute window that just ended to everyone in GooferG's chat,
// pays out every 30 minutes, and closes the session once the stream ends.
// Design: docs/superpowers/specs/2026-09-27-live-watchtime-design.md
//
// Auth: Authorization: Bearer <CRON_SECRET> (Vercel sends it on cron runs).
//
// Env:
//   CRON_SECRET, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_BROADCASTER_ID
//   TWITCH_BROADCASTER_REFRESH_TOKEN   needs moderator:read:chatters
//   WATCHTIME_TICKETS_PER_WINDOW       optional, default 1
//   WATCHTIME_CHAT_BONUS               optional, default 1
//   WATCHTIME_EXCLUDE_LOGINS           optional, comma-separated logins
//   TWITCH_BOT_ID                      optional, never credited

function authorized(req) {
  const got = Buffer.from(req.headers.authorization || '');
  const want = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// Everyone connected to chat, as user id -> lowercased login.
async function fetchChatters(broadcasterId, token) {
  const viewers = new Map();
  let cursor = null;
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({
      broadcaster_id: broadcasterId,
      moderator_id: broadcasterId,
      first: '1000',
    });
    if (cursor) qs.set('after', cursor);
    const data = await helix('GET', `/chat/chatters?${qs.toString()}`, token);
    (data?.data || []).forEach((c) => {
      viewers.set(String(c.user_id), String(c.user_login).toLowerCase());
    });
    cursor = data?.pagination?.cursor;
    if (!cursor) break;
  }
  return viewers;
}

export default async function handler(req, res) {
  // Fail closed: a missing CRON_SECRET must not skip auth.
  if (!process.env.CRON_SECRET) {
    console.error('watchtime-tick: CRON_SECRET is not set — refusing to run.');
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
    if (!broadcasterId) throw new Error('MISSING_TWITCH_BROADCASTER_ID');

    const now = Date.now();
    const current = windowId(now);
    const completed = completedWindow(now);
    const rates = readRates(process.env);

    const appToken = await getAppAccessToken();
    const streams = await helix('GET', `/streams?user_id=${broadcasterId}`, appToken);
    const stream = streams?.data?.[0] || null;

    const markers = await takeChatMarkers(current, completed);

    // Sessions left open by an ended or restarted stream get their final payout.
    const stale = (await openSessionIds()).filter((id) => !stream || id !== stream.id);
    for (const id of stale) {
      await settleSession(id, rates, { close: true });
    }

    if (!stream) {
      await deleteRefs(markers.refs);
      return res.status(200).json({ ok: true, live: false, window: completed, closed: stale.length });
    }

    const exclusion = exclusionFromEnv(process.env);
    const userToken = await getBroadcasterAccessToken();
    const present = withoutExcluded(await fetchChatters(broadcasterId, userToken), exclusion);
    const chatted = withoutExcluded(markers.chatted, exclusion);

    const credited = await creditSession(stream.id, { completed, present, chatted });
    const settled =
      credited && shouldSettle(completed) ? await settleSession(stream.id, rates) : null;
    await deleteRefs(markers.refs);

    return res.status(200).json({
      ok: true,
      live: true,
      window: completed,
      viewers: present.size,
      chatted: chatted.size,
      credited,
      settled,
      closed: stale.length,
    });
  } catch (err) {
    console.error('watchtime-tick error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: PASS — `watchtime.test.js`, `watchtimeStore.test.js`, `watchtimeTick.test.js`.

- [ ] **Step 7: Swap the cron and retire the daily award**

Replace the contents of `vercel.json` with:

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "crons": [
    { "path": "/api/cron/watchtime-tick", "schedule": "*/5 * * * *" }
  ]
}
```

Delete the old handler:

```bash
git rm api/cron/award-watchtime.js
```

In `.env.example`, replace these four lines:

```
# Shared secret for /api/cron/award-watchtime auth header
CRON_SECRET=some_long_random_string
# Optional: tickets awarded per cron tick to each active chatter (default 1)
WATCHTIME_TICKET_AWARD=1
```

with:

```
# Shared secret for the /api/cron/watchtime-tick auth header (Vercel sends it on cron runs)
CRON_SECRET=some_long_random_string
# Optional: live watch-time rates. Tickets per 5-minute window in chat, plus a
# bonus for windows in which the viewer chatted (both default 1).
WATCHTIME_TICKETS_PER_WINDOW=1
WATCHTIME_CHAT_BONUS=1
# Optional: extra chat logins never credited, comma-separated (common bots are built in)
WATCHTIME_EXCLUDE_LOGINS=
```

In `scripts/get-broadcaster-refresh-token.mjs`, change:

```js
// moderator:read:chatters  — needed by /api/cron/award-watchtime (Helix Get Chatters)
```

to:

```js
// moderator:read:chatters  — needed by /api/cron/watchtime-tick (Helix Get Chatters)
```

- [ ] **Step 8: Check nothing else references the old cron**

Run: `grep -rn "award-watchtime\|WATCHTIME_TICKET_AWARD" api src scripts vercel.json .env.example CLAUDE.md`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
[ "$(git branch --show-current)" = "feat/live-watchtime" ] && git add api/_lib/watchtimeStore.js api/cron/watchtime-tick.js vercel.json .env.example scripts/get-broadcaster-refresh-token.mjs src/__tests__/watchtimeStore.test.js src/__tests__/watchtimeTick.test.js && git commit -m "feat(watchtime): 5-minute tick credits chat and pays out every 30 min"
```

(`git rm` in Step 7 already staged the deletion.)

---

### Task 5: Banked tickets claimed at login

**Files:**
- Modify: `api/_lib/watchtimeStore.js` (import line + append)
- Modify: `api/twitch-auth.js`
- Modify: `src/contexts/TwitchAuthContext.js:50-62`
- Modify: `src/pages/TwitchCallbackPage.js:23-24`
- Modify: `src/pages/MyAccountPage.js` (imports, helper, hooks, banner)
- Test: `src/__tests__/watchtimeStore.test.js` (append)

**Interfaces:**
- Consumes: `formatDuration` from Task 2; the fake Firestore from Task 3.
- Produces:
  - `claimWatchBank(twitchId: string): Promise<{ tickets: number, minutes: number } | null>`
  - `/api/twitch-auth` response gains `banked: { tickets, minutes } | null`.
  - `signInWithTwitchCode(code)` resolves to `{ twitchId, displayName, profileImageUrl, banked }`.
  - `/me` accepts router state `{ banked: { tickets, minutes } }`.
  - `formatMinutes(total: number): string` helper inside `MyAccountPage.js` (Task 6 reuses it).

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/watchtimeStore.test.js`, add `claimWatchBank` to the store import list:

```js
import {
  markChatted,
  takeChatMarkers,
  deleteRefs,
  openSessionIds,
  creditSession,
  settleSession,
  claimWatchBank,
} from '../../api/_lib/watchtimeStore';
```

Append:

```js
describe('claimWatchBank', () => {
  test('moves banked tickets into the balance with a ledger line, then deletes the bank', async () => {
    mockDocs.set('watch_bank/1', { login: 'newbie', tickets: 212, minutes: 530 });
    mockDocs.set('users/1', { tickets: 0 });

    expect(await claimWatchBank('1')).toEqual({ tickets: 212, minutes: 530 });

    expect(mockWrites).toContainEqual([
      'update',
      'users/1',
      {
        tickets: { increment: 212 },
        totalEarned: { increment: 212 },
        watchMinutes: { increment: 530 },
        updatedAt: 'SERVER_TS',
      },
    ]);
    const ledger = mockWrites.find((w) => w[0] === 'set' && w[1].startsWith('ticket_ledger/'));
    expect(ledger[2]).toEqual({
      userId: '1',
      delta: 212,
      reason: 'watchtime_banked',
      minutes: 530,
      note: 'Watch time before you signed up: 8h 50m',
      createdAt: 'SERVER_TS',
    });
    expect(mockWrites).toContainEqual(['delete', 'watch_bank/1']);
  });

  test('no bank: nothing to claim', async () => {
    mockDocs.set('users/1', { tickets: 0 });
    expect(await claimWatchBank('1')).toBeNull();
    expect(mockWrites).toEqual([]);
  });

  test('no user doc yet: leaves the bank for a later login', async () => {
    mockDocs.set('watch_bank/1', { tickets: 10, minutes: 25 });
    expect(await claimWatchBank('1')).toBeNull();
    expect(mockWrites).toEqual([]);
  });

  test('an empty bank is cleaned up without a ledger line', async () => {
    mockDocs.set('watch_bank/1', { tickets: 0, minutes: 0 });
    mockDocs.set('users/1', { tickets: 0 });
    expect(await claimWatchBank('1')).toBeNull();
    expect(mockWrites).toEqual([['delete', 'watch_bank/1']]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: FAIL — `claimWatchBank is not a function`.

- [ ] **Step 3: Implement `claimWatchBank`**

In `api/_lib/watchtimeStore.js`, change the watchtime import to:

```js
import { windowId, applyWindow, planSettlement, formatDuration } from './watchtime.js';
```

Append:

```js
// Move tickets banked before the viewer had an account into their balance.
// Runs on every login (api/twitch-auth.js), which also picks up anything a
// payout banked while their first login was in flight.
export async function claimWatchBank(twitchId) {
  const bankRef = adminDb.collection(BANK).doc(twitchId);
  const userRef = adminDb.collection('users').doc(twitchId);
  return adminDb.runTransaction(async (tx) => {
    const [bank, user] = await tx.getAll(bankRef, userRef);
    if (!bank.exists || !user.exists) return null;
    const tickets = Math.max(0, Math.floor(Number(bank.data().tickets) || 0));
    const minutes = Math.max(0, Math.floor(Number(bank.data().minutes) || 0));
    tx.delete(bankRef);
    if (tickets === 0 && minutes === 0) return null;
    const now = FieldValue.serverTimestamp();
    tx.update(userRef, {
      tickets: FieldValue.increment(tickets),
      totalEarned: FieldValue.increment(tickets),
      watchMinutes: FieldValue.increment(minutes),
      updatedAt: now,
    });
    tx.set(adminDb.collection('ticket_ledger').doc(), {
      userId: twitchId,
      delta: tickets,
      reason: 'watchtime_banked',
      minutes,
      note: `Watch time before you signed up: ${formatDuration(minutes)}`,
      createdAt: now,
    });
    return { tickets, minutes };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: PASS.

- [ ] **Step 5: Claim the bank in `api/twitch-auth.js`**

Change the first line to:

```js
import { adminAuth, adminDb, FieldValue } from './_lib/firebaseAdmin.js';
import { claimWatchBank } from './_lib/watchtimeStore.js';
```

In the first-login `userRef.set({...})`, replace `lastWatchTimeAwardAt: null,` with:

```js
      watchMinutes: 0,
```

Directly before `const firebaseToken = await adminAuth.createCustomToken(`, insert:

```js
  // Watch time earned before they had an account. Never block login on it.
  let banked = null;
  try {
    banked = await claimWatchBank(twitchUser.id);
  } catch (err) {
    console.error('watch bank claim failed', twitchUser.id, err);
  }
```

In the final `res.status(200).json({...})`, add `banked,` after `profileImageUrl: twitchUser.profile_image_url,`.

- [ ] **Step 6: Return `banked` from sign-in**

In `src/contexts/TwitchAuthContext.js`, in `signInWithTwitchCode`, change:

```js
    const { firebaseToken, twitchId, displayName, profileImageUrl } = await res.json();
```

to:

```js
    const { firebaseToken, twitchId, displayName, profileImageUrl, banked } = await res.json();
```

and change the final `return profile;` of that function to:

```js
    return { ...profile, banked: banked || null };
```

(`profile` itself, which is stored in state and localStorage, stays without `banked`.)

- [ ] **Step 7: Pass it to `/me`**

In `src/pages/TwitchCallbackPage.js`, change:

```js
    signInWithTwitchCode(code)
      .then(() => navigate('/me', { replace: true }))
```

to:

```js
    signInWithTwitchCode(code)
      .then((result) =>
        navigate('/me', {
          replace: true,
          state: result?.banked ? { banked: result.banked } : null,
        })
      )
```

- [ ] **Step 8: Show the one-time banner on My Account**

In `src/pages/MyAccountPage.js`:

Add after the `lucide-react` import block:

```js
import { useLocation, useNavigate } from 'react-router-dom';
```

Add directly above `function useCountdown(targetMs) {`:

```js
function formatMinutes(total) {
  const minutes = Math.max(0, Math.floor(Number(total) || 0));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
```

Inside `MyAccountPage`, directly after `const { user } = useUserDoc();`, add:

```js
  const location = useLocation();
  const navigate = useNavigate();
  // Watch time banked before signup arrives once, via router state from the
  // Twitch callback. Keep it for this visit, then clear the state so a
  // refresh does not show it again.
  const [banked] = useState(() => location.state?.banked || null);
  useEffect(() => {
    if (location.state?.banked) navigate(location.pathname, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
```

In the signed-in return, directly after the closing `</header>` and before `{/* Balance card */}`, insert:

```jsx
        {banked?.tickets > 0 && (
          <div
            role="status"
            className="border border-emerald-signal/30 bg-emerald-signal/5 px-5 py-4 flex items-start gap-3"
          >
            <Clock size={16} className="text-emerald-signal mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-white/80">
              You had{' '}
              <span className="font-bold text-emerald-signal tabular-nums">{banked.tickets}</span>{' '}
              tickets waiting from {formatMinutes(banked.minutes)} of watch time. They're in your
              balance now.
            </p>
          </div>
        )}
```

(`Clock` is already imported from `lucide-react` in this file.)

- [ ] **Step 9: Verify**

Run: `node -e "const a=require('acorn'),fs=require('fs');process.argv.slice(1).forEach(f=>a.parse(fs.readFileSync(f,'utf8'),{ecmaVersion:'latest',sourceType:'module'}));console.log('syntax ok')" api/twitch-auth.js`
Expected: `syntax ok`

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: PASS.

Run: `npm run build`
Expected: `Compiled successfully.` (or only warnings that already existed on `main`; no new ones from the files above).

- [ ] **Step 10: Commit**

```bash
[ "$(git branch --show-current)" = "feat/live-watchtime" ] && git add api/_lib/watchtimeStore.js api/twitch-auth.js src/contexts/TwitchAuthContext.js src/pages/TwitchCallbackPage.js src/pages/MyAccountPage.js src/__tests__/watchtimeStore.test.js && git commit -m "feat(watchtime): pay banked watch time on first login"
```

---

### Task 6: Viewer and admin surfaces, reset, rules, docs

**Files:**
- Modify: `src/pages/MyAccountPage.js` (balance stats, earn copy, `REASON_LABELS`)
- Modify: `src/pages/AdminTicketsPage.js` (`REASON_LABELS`)
- Modify: `src/pages/StorePage.js:203-206`
- Modify: `api/admin/users.js:33`
- Modify: `src/pages/AdminUsersPage.js` (icon import, stats grid)
- Modify: `api/admin/reset.js`
- Modify: `src/pages/AdminHubPage.js:112`
- Modify: `firestore.rules`, `firestore.indexes.json`, `CLAUDE.md`

**Interfaces:**
- Consumes: `formatMinutes` (Task 5), `users.watchMinutes` (Tasks 4/5), ledger reason `watchtime_banked` (Task 5).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: My Account — stat, earn copy, ledger label**

In `src/pages/MyAccountPage.js`:

Add to `REASON_LABELS`, after `watchtime: 'Watch time',`:

```js
  watchtime_banked: 'Banked watch time',
```

In the balance card, the row that holds the `Earned` and `Spent` spans — add a third span after the `Spent` span:

```jsx
                <span>
                  Hung out{' '}
                  <span className="text-white/70 tabular-nums">{formatMinutes(user?.watchMinutes)}</span>
                </span>
```

In "How to earn", replace:

```jsx
              <span>Hang out in chat while the stream is live — tickets drop daily during the stream.</span>
```

with:

```jsx
              <span>
                Every 5 minutes you're in chat while the stream is live earns 1 ticket, 2 if you
                chatted. Paid out every 30 minutes.
              </span>
```

- [ ] **Step 2: Admin ticket ledger label**

In `src/pages/AdminTicketsPage.js`, add to `REASON_LABELS` after `watchtime: 'Watch time',`:

```js
  watchtime_banked: 'Banked watch',
```

- [ ] **Step 3: Store header copy**

In `src/pages/StorePage.js`, replace:

```jsx
            Earn tickets by watching streams, claiming daily drops, and joining
            the Discord. Then spend them on cosmetics and on-stream perks below.
```

with:

```jsx
            Earn tickets by hanging out in chat while the stream is live (the
            longer you stay, the more you earn), claiming daily drops, and
            joining the Discord. Then spend them on cosmetics and on-stream perks
            below.
```

- [ ] **Step 4: Admin users — return and show watch time**

In `api/admin/users.js`, in `shapeUser`, replace:

```js
    lastWatchTimeAwardAt: d.lastWatchTimeAwardAt || null,
```

with:

```js
    watchMinutes: d.watchMinutes || 0,
```

In `src/pages/AdminUsersPage.js`, add `Clock,` to the `lucide-react` import list (after `Calendar,`). Replace the stats grid:

```jsx
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={Ticket} label="Balance" value={user.tickets} />
        <StatTile icon={Ticket} label="Earned" value={user.totalEarned} />
        <StatTile icon={Ticket} label="Spent" value={user.totalSpent} />
        <StatTile icon={Calendar} label="Joined" value={formatDate(user.createdAt)} />
      </div>
```

with:

```jsx
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile icon={Ticket} label="Balance" value={user.tickets} />
        <StatTile icon={Ticket} label="Earned" value={user.totalEarned} />
        <StatTile icon={Ticket} label="Spent" value={user.totalSpent} />
        <StatTile
          icon={Clock}
          label="Watched"
          value={`${((user.watchMinutes || 0) / 60).toFixed(1)}h`}
        />
        <StatTile icon={Calendar} label="Joined" value={formatDate(user.createdAt)} />
      </div>
```

- [ ] **Step 5: Reset wipes watch-time data too**

In `api/admin/reset.js`:

In the header comment, after the line `//  - Ledger is always wiped alongside ticket balances (they're meant to mirror).`, add:

```js
//  - The tickets scope also wipes watch-time state (watch_sessions,
//    watch_chat, watch_bank) and zeroes watchMinutes, so nothing banked or
//    half-paid survives a reset.
```

In `resetUserTicketFields`, add `watchMinutes: 0,` after `lastDailyClaimAt: null,`.

In the `deleted` object, add `watch: 0,` after `ledger: 0,`.

In the `if (want.tickets) {` block, after the `deleted.ledger = ...` line, add:

```js
      deleted.watch =
        (await deleteCollection(adminDb.collection('watch_sessions'))) +
        (await deleteCollection(adminDb.collection('watch_chat'))) +
        (await deleteCollection(adminDb.collection('watch_bank')));
```

In `src/pages/AdminHubPage.js`, replace the tickets scope `detail` string with:

```js
      'Resets every user’s tickets, totalEarned, totalSpent, lastDailyClaimAt, watchMinutes. Wipes the full ticket_ledger and all watch-time sessions and banked tickets. User identity (Twitch/Discord links) is preserved.',
```

- [ ] **Step 6: Rules and index overrides**

In `firestore.rules`, directly after the `match /secrets/{id} { ... }` block, add:

```
    // Live watch time — sessions, per-window chat markers and banked tickets
    // for viewers without an account. Server-only (api/_lib/watchtimeStore.js).
    match /watch_sessions/{id} {
      allow read, write: if false;
    }
    match /watch_chat/{id} {
      allow read, write: if false;
    }
    match /watch_bank/{id} {
      allow read, write: if false;
    }
```

In `firestore.indexes.json`, append two entries to the end of the `fieldOverrides` array (after the `suggestions` entry; add a comma after its closing `}`):

```json
    {
      "collectionGroup": "watch_sessions",
      "fieldPath": "viewers",
      "indexes": []
    },
    {
      "collectionGroup": "watch_chat",
      "fieldPath": "chatters",
      "indexes": []
    }
```

Validate the JSON:

Run: `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8'));console.log('json ok')"`
Expected: `json ok`

- [ ] **Step 7: CLAUDE.md gotcha**

In `CLAUDE.md`, add this bullet to the `## Gotchas` list, after the Leaderboard bullet:

```markdown
- Watch-time tickets: `api/cron/watchtime-tick.js` runs every 5 min (Vercel Pro cron, `CRON_SECRET` bearer). Each tick credits the 5-minute window that just ended into one doc per stream, `watch_sessions/{streamId}` (viewer id → `present`/`chat`/`paid*`/`ledger*` counters). Presence is the Helix chatter list; the chat bonus comes from markers EventSub writes to `watch_chat/{windowId}`. Payouts run every 30 min and when the stream ends, one transaction per 200 viewers; viewers without a `users` doc bank into `watch_bank/{twitchId}`, which `twitch-auth.js` claims on login. Logic is pure in `api/_lib/watchtime.js`, Firestore I/O in `api/_lib/watchtimeStore.js`. Firebase is on Spark (20k writes/day): keep per-tick writes O(1) and never write per viewer per tick. Rates: `WATCHTIME_TICKETS_PER_WINDOW`, `WATCHTIME_CHAT_BONUS` (default 1 each).
```

- [ ] **Step 8: Verify**

Run: `node -e "const a=require('acorn'),fs=require('fs');process.argv.slice(1).forEach(f=>a.parse(fs.readFileSync(f,'utf8'),{ecmaVersion:'latest',sourceType:'module'}));console.log('syntax ok')" api/admin/users.js api/admin/reset.js`
Expected: `syntax ok`

Run: `CI=true npm test -- --watchAll=false --testPathPattern=watchtime`
Expected: PASS.

Run: `npm run build`
Expected: `Compiled successfully.` (no new warnings from the touched files).

Run: `grep -rn "lastWatchTimeAwardAt" api src`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
[ "$(git branch --show-current)" = "feat/live-watchtime" ] && git add src/pages/MyAccountPage.js src/pages/AdminTicketsPage.js src/pages/StorePage.js api/admin/users.js src/pages/AdminUsersPage.js api/admin/reset.js src/pages/AdminHubPage.js firestore.rules firestore.indexes.json CLAUDE.md && git commit -m "feat(watchtime): show watch time to viewers and admins, reset and rules"
```

---

## After the tasks (needs the user's go-ahead — do not run unasked)

These are outward-facing; the executor stops and asks before each:

1. Push `feat/live-watchtime` and open a PR (no Claude attribution in the PR body).
2. Deploy rules and index overrides: `firebase deploy --only firestore:rules,firestore:indexes --project goofer-website`.
3. In Vercel project env: remove the now-unused `WATCHTIME_TICKET_AWARD`; optionally set `WATCHTIME_TICKETS_PER_WINDOW` / `WATCHTIME_CHAT_BONUS` / `WATCHTIME_EXCLUDE_LOGINS` (defaults work without them). `CRON_SECRET` must already be set (the old cron used it).
4. After merge and the next live stream: check the `watch_sessions/{streamId}` doc, one viewer's `watch_{streamId}_{id}` ledger line, and the `watchtime-tick` function logs in Vercel.
