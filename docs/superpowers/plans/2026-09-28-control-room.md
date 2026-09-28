# Control Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff run giveaways and prediction rounds from a dockable floating "Control room" panel on any public page, with timers that no longer depend on an open admin page and an optional full-screen stage reveal for the streaming browser.

**Architecture:** A `ControlRoomProvider` (mounted under `AuthProvider`, on every route except OBS sources) owns two narrow Firestore subscriptions, the giveaway/prediction timer engine (run only in the tab holding a Web Lock) and the panel's persisted state. The giveaway admin page is split into `src/components/admin/giveaways/*` so `/admin` and the panel share one set of hooks and components. The panel (`src/components/controlRoom/*`) and the stage moment are lazy chunks mounted in `App.js` for staff only. The server makes `close` and `roll` transactional so several browsers can drive safely.

**Tech Stack:** Create React App (react-scripts 5), React 19, react-router-dom v7 (Jest stub at `src/test/reactRouterDomStub.js`), Tailwind 3, lucide-react 0.556, Firebase v10 client + firebase-admin on Vercel functions, Jest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-28-control-room-design.md`. Read it before starting any task; this plan argues from it.

## Global Constraints

- No new npm dependencies.
- UI copy follows PRODUCT.md voice rules: no em dashes, sentence case, no "X, not Y", none of the banned words (leverage, seamless, robust, unlock, elevate…).
- Motion animates only `transform`, `opacity`, `filter`, `clip-path`; nothing longer than 600ms; `prefers-reduced-motion: reduce` turns every transition into a 150ms opacity fade.
- The panel never has `transform`, `filter`, `backdrop-filter` or `will-change: transform` at rest (they would trap `position: fixed` modals like `SettleModal` inside it). Keyframes use `animation-fill-mode: backwards` (or `forwards` only on an exit that unmounts).
- z-index: nav `z-50`, `PlayPanel` modal `z-[60]`, panel and pill `z-[65]`, dock ghost `z-[64]`, stage `z-[80]`, `TVStaticIntro` `z-[9999]`.
- Constants (copy exactly): `PANEL_W 380`, `DOCK_W 400`, `NAV_H 57`, `EDGE 16`, `SNAP 24`, `DOCK_ZONE 48`, `UNDOCK_DIST 64`, `GRAB 48`, `HEADER_H 36`, float max height `70vh`, narrow breakpoint `(max-width: 767px)` bottom sheet max height `75vh`, `STAGE_FRESH_MS 10000`, `RESULTS_HOLD_MS 8000`, live-query retry `5000ms` × `5`.
- Storage key `goofer:control-room`. Web Lock name `goofer-control-driver`.
- The only new Firestore listeners are: live giveaways (`status in [open, closed, rolling, playing]`, `orderBy createdAt desc`, `limit 5`), newest hunts (`limit 3`), the shown giveaway's 5 newest entries (panel open, status `open`), the latest giveaway (`limit 1`, idle view only), and `useGiveawayFeed` while Stage is on.
- Commits: short conventional subject (`feat(control-room): …`, `refactor(giveaways): …`, `fix(giveaways): …`, `test(…)`, `docs(…)`), **no `Co-Authored-By` or any Claude trailer** (user's global rule). Other sessions switch branches in this checkout: every commit command checks the branch in the same command, as shown in each task.
- Test command (Git Bash): `CI=true npm test -- --watchAll=false --testPathPattern=<pattern>`. Lint changed files with `npx eslint <paths>` (uses the `react-app` config in package.json); zero warnings expected.

## Review Focus

1. **Stale or garbage `localStorage`** (older shape, hand-edited, `mode: 'maximized'`, string coordinates) must load the defaults and never crash the page on stream. Test in Task 7 (`storage.test.js`).
2. **A float position saved on a bigger monitor** (x 5000) must come back on screen on a laptop. Test in Task 10 (`geometry.test.js`) and Task 11 (`ControlRoom.test.js`).
3. **A Web Lock granted after the hook unmounted** (React StrictMode double-mount in dev, fast route changes) must be released at once, never leaving a hidden "driver" that holds the lock forever. Test in Task 6 (`useDriverLock.test.js`).
4. **A giveaway with no timer** (`durationSec 0`, `closesAt null`) must show "No timer" with no progress bar in the panel and `GVW OPEN · N IN` on the pill. Tests in Task 10 (`panelStatus.test.js`) and Task 12 (`GiveawayTab.test.js`).
5. **A backtick typed inside a text field** (slot search, prize input, chat message template) must not toggle the panel. Test in Task 11 (`ControlRoom.test.js`).

---

### Task 1: Pin the giveaway clock, then extract the giveaway logic hooks

The giveaway timers and winner announce are defined inside `src/pages/AdminGiveawaysPage.js` and have no tests. Write characterization tests against their future home, then move them verbatim.

**Files:**
- Create: `src/components/admin/giveaways/api.js`
- Create: `src/components/admin/giveaways/useGiveawayClock.js`
- Create: `src/components/admin/giveaways/useWinnerAnnounce.js`
- Test: `src/components/admin/giveaways/__tests__/useGiveawayClock.test.js`
- Modify: `src/pages/AdminGiveawaysPage.js` (remove `QUIET_ANNOUNCE`, `postAction`, `useWinnerAnnounce`, `useGiveawayClock`; add imports)

**Interfaces:**
- Produces: `postAction(action: string, body?: object) → Promise<{ ok: boolean, status: number, data: object }>` and `QUIET_ANNOUNCE: string[]` from `api.js`; `export default function useGiveawayClock(list: Giveaway[], onWarn: (msg: string) => void)`; `export default function useWinnerAnnounce(giveaway: Giveaway | null) → { enabled, posted, posting, error, dueAt, retry }`.

- [ ] **Step 1: Write the failing characterization test**

Create `src/components/admin/giveaways/__tests__/useGiveawayClock.test.js`:

```js
import { renderHook, act } from '@testing-library/react';
import useGiveawayClock from '../useGiveawayClock';
import { postAction } from '../api';

jest.mock('../api', () => ({
  postAction: jest.fn(),
  QUIET_ANNOUNCE: ['disabled', 'empty', 'already'],
}));

const NOW = 1_700_000_000_000;
const at = (ms) => ({ toMillis: () => ms });
const ok = (data = {}) => Promise.resolve({ ok: true, status: 200, data });
const fail = (error) => Promise.resolve({ ok: false, status: 400, data: { error } });

function giveaway(overrides = {}) {
  return {
    id: 'g1',
    status: 'open',
    closesAt: at(NOW + 60_000),
    announceLastCall: true,
    lastCallAt: null,
    autoRoll: true,
    entryCount: 3,
    ...overrides,
  };
}

async function flush() {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

async function advance(ms) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await flush();
  });
}

function run(list, options) {
  const onWarn = jest.fn();
  const hook = renderHook(({ l, o }) => useGiveawayClock(l, onWarn, o), {
    initialProps: { l: list, o: options },
  });
  return { onWarn, ...hook };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  postAction.mockReset();
  postAction.mockImplementation(() => ok());
});

afterEach(() => jest.useRealTimers());

const calls = (action) => postAction.mock.calls.filter(([a]) => a === action);

test('posts last call once, inside the T-30s window', async () => {
  run([giveaway()]);
  await advance(29_000); // 31s left: too early
  expect(calls('lastCall')).toHaveLength(0);
  await advance(2_000); // 29s left
  expect(postAction).toHaveBeenCalledWith('lastCall', { id: 'g1' });
  await advance(5_000);
  expect(calls('lastCall')).toHaveLength(1);
});

test('skips last call when it is off or already posted', async () => {
  run([
    giveaway({ id: 'a', announceLastCall: false }),
    giveaway({ id: 'b', lastCallAt: at(NOW) }),
  ]);
  await advance(35_000);
  expect(calls('lastCall')).toHaveLength(0);
});

test('warns when last call did not post in chat', async () => {
  postAction.mockImplementation((action) =>
    action === 'lastCall' ? ok({ announce: { posted: false, reason: 'chat down' } }) : ok()
  );
  const { onWarn } = run([giveaway({ closesAt: at(NOW + 20_000) })]);
  await act(async () => {
    await flush();
  });
  expect(onWarn).toHaveBeenCalledWith("Last call didn't post in chat: chat down");
});

test('closes at zero and auto-rolls when there are entries', async () => {
  run([giveaway({ closesAt: at(NOW + 2_000) })]);
  await advance(2_000);
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
  expect(postAction).toHaveBeenCalledWith('roll', { id: 'g1' });
});

test('does not roll with zero entries, and says so', async () => {
  const { onWarn } = run([giveaway({ closesAt: at(NOW + 1_000), entryCount: 0 })]);
  await advance(1_000);
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
  expect(calls('roll')).toHaveLength(0);
  expect(onWarn).toHaveBeenCalledWith('Time ran out with no entries, so nothing was rolled.');
});

test('warns when the auto-roll fails', async () => {
  postAction.mockImplementation((action) => (action === 'roll' ? fail('NO_ENTRIES') : ok()));
  const { onWarn } = run([giveaway({ closesAt: at(NOW + 1_000) })]);
  await advance(1_000);
  expect(onWarn).toHaveBeenCalledWith('Auto-roll failed: NO_ENTRIES');
});

test('does not roll when its own close failed (someone else closed it)', async () => {
  postAction.mockImplementation((action) => (action === 'close' ? fail('NOT_OPEN') : ok()));
  run([giveaway({ closesAt: at(NOW + 1_000) })]);
  await advance(1_000);
  expect(calls('roll')).toHaveLength(0);
});

test('closes, but never rolls, a timer that ran out long ago', async () => {
  run([giveaway({ closesAt: at(NOW - 60_000) })]);
  await act(async () => {
    await flush();
  });
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
  expect(calls('roll')).toHaveLength(0);
});

test('ignores giveaways without a timer or not open', async () => {
  run([
    giveaway({ closesAt: null }),
    giveaway({ id: 'g2', status: 'closed', closesAt: at(NOW - 1) }),
  ]);
  await advance(5_000);
  expect(postAction).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=useGiveawayClock`
Expected: FAIL with `Cannot find module '../useGiveawayClock'`.

- [ ] **Step 3: Create `api.js`**

Create `src/components/admin/giveaways/api.js` (moved from the page's lines 80–90, unchanged):

```js
import { authedFetch } from '../../../utils/authedFetch';

// Announce results that are not worth a warning toast.
export const QUIET_ANNOUNCE = ['disabled', 'empty', 'already'];

export async function postAction(action, body = {}) {
  const res = await authedFetch('/api/admin/giveaways', {
    method: 'POST',
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
```

- [ ] **Step 4: Create `useGiveawayClock.js`**

Create `src/components/admin/giveaways/useGiveawayClock.js` (the page's `useGiveawayClock` and its comment, verbatim apart from `export default`):

```js
import { useEffect, useRef } from 'react';
import { AUTO_ROLL_GRACE_MS, LAST_CALL_SECONDS, tsMillis } from '../../../utils/giveaway';
import { postAction, QUIET_ANNOUNCE } from './api';

// Runs the entry timer: posts the last call, closes entries at zero, and rolls
// when the giveaway asked for it. EventSub already refuses late entries on its
// own, so a missed tick only delays the status flip.
export default function useGiveawayClock(list, onWarn) {
  const listRef = useRef(list);
  listRef.current = list;
  const fired = useRef(new Set());
  const timed = list.some((g) => g.status === 'open' && g.closesAt);

  useEffect(() => {
    if (!timed) return undefined;
    const tick = async () => {
      const now = Date.now();
      for (const g of listRef.current) {
        if (g.status !== 'open') continue;
        const closesAt = tsMillis(g.closesAt);
        if (!closesAt) continue;

        const lcKey = `lastCall:${g.id}`;
        if (
          g.announceLastCall &&
          !g.lastCallAt &&
          now >= closesAt - LAST_CALL_SECONDS * 1000 &&
          now < closesAt - 3000 &&
          !fired.current.has(lcKey)
        ) {
          fired.current.add(lcKey);
          postAction('lastCall', { id: g.id })
            .then(({ data }) => {
              const a = data.announce;
              if (a && a.posted === false && !QUIET_ANNOUNCE.includes(a.reason)) {
                onWarn(`Last call didn't post in chat: ${a.reason}`);
              }
            })
            .catch(() => {});
        }

        const closeKey = `close:${g.id}`;
        if (now >= closesAt && !fired.current.has(closeKey)) {
          fired.current.add(closeKey);
          const closed = await postAction('close', { id: g.id }).catch(() => ({ ok: false }));
          // Only auto-roll when we watched the clock run out, not when the
          // page is opened long after the timer ended.
          if (closed.ok && g.autoRoll && now - closesAt < AUTO_ROLL_GRACE_MS) {
            if ((g.entryCount ?? 0) === 0) {
              onWarn('Time ran out with no entries, so nothing was rolled.');
            } else {
              const rolled = await postAction('roll', { id: g.id }).catch(() => ({ ok: false, data: {} }));
              if (!rolled.ok) onWarn(`Auto-roll failed: ${rolled.data?.error || 'unknown'}`);
            }
          }
        }
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [timed, onWarn]);
}
```

- [ ] **Step 5: Create `useWinnerAnnounce.js`**

Create `src/components/admin/giveaways/useWinnerAnnounce.js` (the page's `useWinnerAnnounce` and its comment, verbatim apart from `export default`):

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAT_ANNOUNCE_DELAY_MS, pickKey, tsMillis } from '../../../utils/giveaway';
import { postAction, QUIET_ANNOUNCE } from './api';

// Posts the winner in chat once the reveal has played on stream, then shows
// where that stands. Retry appears if Twitch refused the message. Runs above
// the winner window: a bonus-buy winner confirmed quickly moves to 'playing'
// and closes that window before the timer fires.
export default function useWinnerAnnounce(giveaway) {
  const key = pickKey(giveaway);
  const rolledAtMs = tsMillis(giveaway?.rolledAt);
  const enabled = !!giveaway && giveaway.announceWinner !== false && !!giveaway.winnerMessage;
  const posted = !!key && giveaway?.announcedPick === key;
  const id = giveaway?.id;
  const winnerTwitchId = giveaway?.winnerTwitchId;
  const [state, setState] = useState({ key: null, posting: false, error: null });

  const post = useCallback(async () => {
    setState({ key, posting: true, error: null });
    try {
      const { ok, status, data } = await postAction('announce', {
        id,
        winnerTwitchId,
        rolledAtMs,
      });
      if (status === 409) return setState({ key, posting: false, error: null }); // pick moved on
      const failed = !ok || (data.announce?.posted === false && !QUIET_ANNOUNCE.includes(data.announce.reason));
      setState({
        key,
        posting: false,
        error: failed ? data.announce?.reason || data.error || 'unknown' : null,
      });
    } catch {
      setState({ key, posting: false, error: 'Network error' });
    }
  }, [key, id, winnerTwitchId, rolledAtMs]);

  // One timer per pick. A reroll or skip changes the key and cancels it.
  const postRef = useRef(post);
  postRef.current = post;
  const alreadyPosted = useRef(posted);
  alreadyPosted.current = posted;
  useEffect(() => {
    if (!key || !enabled || alreadyPosted.current) return undefined;
    const delay = Math.max(0, rolledAtMs + CHAT_ANNOUNCE_DELAY_MS - Date.now());
    const t = setTimeout(() => {
      if (!alreadyPosted.current) postRef.current();
    }, delay);
    return () => clearTimeout(t);
  }, [key, enabled, rolledAtMs]);

  const mine = state.key === key;
  return {
    enabled,
    posted,
    posting: mine && state.posting,
    error: mine ? state.error : null,
    dueAt: rolledAtMs != null ? rolledAtMs + CHAT_ANNOUNCE_DELAY_MS : null,
    retry: post,
  };
}
```

- [ ] **Step 6: Remove the originals from the page and import the new modules**

In `src/pages/AdminGiveawaysPage.js`:
1. Delete the `QUIET_ANNOUNCE` constant, the `postAction` function, the `useWinnerAnnounce` function (with the comment block above it that starts `// Posts the winner in chat once the reveal…`), and the `useGiveawayClock` function (with the comment above it that starts `// Runs the entry timer while this page is open…`). Leave the `// ─── Timer automation ───` divider comment out too.
2. Add after the `import { toImageUrl } …` line:

```js
import { postAction, QUIET_ANNOUNCE } from '../components/admin/giveaways/api';
import useGiveawayClock from '../components/admin/giveaways/useGiveawayClock';
import useWinnerAnnounce from '../components/admin/giveaways/useWinnerAnnounce';
```

3. Remove the now-unused names from the `../utils/giveaway` import: `AUTO_ROLL_GRACE_MS`, `CHAT_ANNOUNCE_DELAY_MS`, `pickKey`. Keep `LAST_CALL_SECONDS` and `tsMillis` (still used by `NewGiveawayForm`, `ClosesIn`, `ClaimTimer`).

- [ ] **Step 7: Run the tests and lint**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=useGiveawayClock`
Expected: PASS (9 tests).
Run: `npx eslint src/pages/AdminGiveawaysPage.js src/components/admin/giveaways`
Expected: no output. If `no-unused-vars` names any import, remove it.

- [ ] **Step 8: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/components/admin/giveaways src/pages/AdminGiveawaysPage.js && git commit -m "refactor(giveaways): move the entry clock and winner announce out of the page"
```

---

### Task 2: Move the giveaway UI into `src/components/admin/giveaways/`

Pure moves, so `/admin/giveaways` and the panel can share them. No behavior changes.

**Files:**
- Create: `src/components/admin/giveaways/ui.js`, `EventSubStatus.js`, `NewGiveawayForm.js`, `ClaimTimer.js`, `ChatAnnounceStatus.js`, `WinnerModal.js`, `PlayPanel.js`, `AnimatedCount.js`
- Test: `src/components/admin/giveaways/__tests__/WinnerModal.test.js`
- Modify: `src/pages/AdminGiveawaysPage.js`

**Interfaces:**
- Consumes: `postAction`, `QUIET_ANNOUNCE` (Task 1).
- Produces: `ui.js` named exports `inputCls`, `labelCls`, `formatTs`, `ToggleRow`, `Chips`, `Kbd`, `MoneyInput`; `EventSubStatus.js` default `EventSubStatus({ chat })` plus named `useEventSubStatus()` and `chatLabel(chat)`; default exports `NewGiveawayForm({ seed, chat, onClose, onCreated })`, `ClaimTimer({ giveaway, firstMessageAt })`, `ChatAnnounceStatus({ announce })`, `WinnerModal({ giveaway, announce })`, `PlayPanel({ giveaway, announce })`, `AnimatedCount({ value })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/giveaways/__tests__/WinnerModal.test.js`:

```js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WinnerModal from '../WinnerModal';
import { postAction } from '../api';

jest.mock('../../../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => 'c',
  query: (ref) => ref,
  orderBy: () => null,
  limit: () => null,
  onSnapshot: (_q, next) => {
    next({ docs: [] });
    return () => {};
  },
}));
jest.mock('../api', () => ({
  postAction: jest.fn(),
  QUIET_ANNOUNCE: ['disabled', 'empty', 'already'],
}));

const at = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const ROLLING = {
  id: 'g1',
  status: 'rolling',
  kind: 'item',
  title: 'Friday',
  prize: 'Steam key',
  targetWinners: 1,
  winners: [],
  winnerTwitchId: 'tw1',
  rolledAt: at(Date.now() - 60_000),
  winner: {
    twitchId: 'tw1',
    twitchName: 'slotgoblin',
    displayName: 'SlotGoblin',
    weight: 2,
    source: 'chat',
    registered: true,
  },
};
const ANNOUNCE = { enabled: true, posted: true, posting: false, error: null, dueAt: null, retry: () => {} };

beforeEach(() => {
  postAction.mockReset();
  postAction.mockResolvedValue({ ok: true, status: 200, data: {} });
});

test('shows the pick and confirms it', async () => {
  render(<WinnerModal giveaway={ROLLING} announce={ANNOUNCE} />);
  expect(screen.getByText('SlotGoblin')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /confirm winner/i }));
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('confirm', { id: 'g1', prizeNote: null }));
});

test('R rerolls from the keyboard', async () => {
  render(<WinnerModal giveaway={ROLLING} announce={ANNOUNCE} />);
  fireEvent.keyDown(window, { key: 'r' });
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('reroll', { id: 'g1' }));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=WinnerModal`
Expected: FAIL with `Cannot find module '../WinnerModal'`.

- [ ] **Step 3: Create the moved modules**

Each file is: the import header below, then the named declarations **cut verbatim** from `src/pages/AdminGiveawaysPage.js`, with `export` / `export default` added as noted. Find each declaration by its name (line numbers shift as you cut).

`ui.js`: no imports. Move `inputCls`, `labelCls`, `formatTs`, `ToggleRow`, `Chips`, `Kbd`, `MoneyInput`, each prefixed with `export` (`export const inputCls = …`, `export function ToggleRow(…)`, and so on).

`EventSubStatus.js`:

```js
import { useCallback, useEffect, useState } from 'react';
import { Trash2, Webhook } from 'lucide-react';
import { authedFetch } from '../../../utils/authedFetch';
```
Move `useEventSubStatus` (as `export function useEventSubStatus`), `chatLabel` (as `export function chatLabel`), and `EventSubStatus` (as `export default function EventSubStatus`).

`NewGiveawayForm.js`:

```js
import { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Dices, TriangleAlert, X } from 'lucide-react';
import {
  DURATION_OPTIONS,
  LAST_CALL_SECONDS,
  WINNER_COUNT_OPTIONS,
  bonusPrize,
  defaultTitle,
  keywordWarning,
  normalizeKeyword,
  parseMoney,
  rulesSummary,
  suggestKeyword,
} from '../../../utils/giveaway';
import { postAction, QUIET_ANNOUNCE } from './api';
import { Chips, ToggleRow, inputCls, labelCls } from './ui';
import { chatLabel } from './EventSubStatus';
```
Move `PRIZE_KIND_OPTIONS` (plain `const`) and `NewGiveawayForm` (as `export default function`).

`ClaimTimer.js`:

```js
import { Timer } from 'lucide-react';
import { useRevealState } from '../../giveaway/RevealScreen';
import { REVEAL_MS, formatClock, tsMillis } from '../../../utils/giveaway';
```
Move `ClaimTimer` (as `export default function`).

`ChatAnnounceStatus.js`:

```js
import { MessageSquare } from 'lucide-react';
import { useClock } from '../../../hooks/useClock';
```
Move `ChatAnnounceStatus` (as `export default function`).

`WinnerModal.js`:

```js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { ArrowLeft, Check, Flag, Gift, Radio, RefreshCcw, SkipForward, Trophy } from 'lucide-react';
import { db } from '../../../config/firebase';
import { isBonusGiveaway } from '../../../utils/giveaway';
import { postAction } from './api';
import { Kbd, inputCls, labelCls } from './ui';
import ClaimTimer from './ClaimTimer';
import ChatAnnounceStatus from './ChatAnnounceStatus';
```
Move `WinnerModal` (as `export default function`).

`PlayPanel.js`:

```js
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { ArrowLeft, Check, ChevronDown, Flag, Gift, Minus, Pencil } from 'lucide-react';
import { db } from '../../../config/firebase';
import { toImageUrl } from '../../../utils/slotImage';
import { formatMoney, formatMulti, parseMoney } from '../../../utils/giveaway';
import { postAction, QUIET_ANNOUNCE } from './api';
import { MoneyInput, inputCls, labelCls } from './ui';
import ChatAnnounceStatus from './ChatAnnounceStatus';

// Slot search pulls the slot catalogue on first use; only load it once a bonus is being played.
const SlotAutocomplete = lazy(() => import('../../SlotAutocomplete'));
```
Move `PlayPanel` (with its comment block above) as `export default function`. Delete the page's `SlotAutocomplete` lazy constant and its comment.

`AnimatedCount.js`:

```js
import { useEffect, useRef, useState } from 'react';
```
Move `AnimatedCount` (as `export default function`).

- [ ] **Step 4: Rewrite the page's imports**

Replace everything above `const PRIZE_KIND_OPTIONS` (now gone) at the top of `src/pages/AdminGiveawaysPage.js` with exactly:

```js
import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Flag,
  Gift,
  MonitorPlay,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { db } from '../config/firebase';
import GiveawayEntriesGrid from '../components/GiveawayEntriesGrid';
import { useClock } from '../hooks/useClock';
import {
  LAST_CALL_SECONDS,
  formFromGiveaway,
  formatClock,
  formatMoney,
  formatMulti,
  isBonusGiveaway,
  parseMoney,
  tsMillis,
} from '../utils/giveaway';
import { postAction } from '../components/admin/giveaways/api';
import { MoneyInput, formatTs } from '../components/admin/giveaways/ui';
import EventSubStatus, { useEventSubStatus } from '../components/admin/giveaways/EventSubStatus';
import NewGiveawayForm from '../components/admin/giveaways/NewGiveawayForm';
import WinnerModal from '../components/admin/giveaways/WinnerModal';
import PlayPanel from '../components/admin/giveaways/PlayPanel';
import AnimatedCount from '../components/admin/giveaways/AnimatedCount';
import useGiveawayClock from '../components/admin/giveaways/useGiveawayClock';
import useWinnerAnnounce from '../components/admin/giveaways/useWinnerAnnounce';
```

What stays in the page: `OverlayLink`, `ClosesIn`, `paidTotal`, `GiveawayRow`, `GiveawayDetail`, `WinnerLine`, `AdminGiveawaysPage`.

- [ ] **Step 5: Run tests and lint**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="WinnerModal|useGiveawayClock"`
Expected: PASS.
Run: `npx eslint src/pages/AdminGiveawaysPage.js src/components/admin/giveaways`
Expected: no output. Fix any `no-undef` (a missing import) or `no-unused-vars` it reports before committing.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/components/admin/giveaways src/pages/AdminGiveawaysPage.js && git commit -m "refactor(giveaways): split the admin page into shared components"
```

---

### Task 3: Move the overlay's `RevealStage` into a shared component

**Files:**
- Create: `src/components/giveaway/RevealStage.js`
- Test: `src/components/giveaway/__tests__/RevealStage.test.js`
- Modify: `src/pages/GiveawayOverlay.js`

**Interfaces:**
- Produces: `export default function RevealStage({ giveaway, entries, firstMessage, sound = NO_SOUND, holding = false })`. It renders a `fixed inset-0` full-screen reveal. The caller must also render `<CrtStyles />` (from `RevealScreen`) for the `gvo-*` keyframes.

- [ ] **Step 1: Write the failing test**

Create `src/components/giveaway/__tests__/RevealStage.test.js`:

```js
import { render, screen } from '@testing-library/react';
import RevealStage from '../RevealStage';

const at = (ms) => ({ toMillis: () => ms });
const pick = (rolledAgoMs) => ({
  id: 'g1',
  status: 'rolling',
  prize: '$50 bonus buy',
  targetWinners: 1,
  winners: [],
  winnerTwitchId: 'tw1',
  rolledAt: at(Date.now() - rolledAgoMs),
  winner: { twitchId: 'tw1', twitchName: 'slotgoblin', displayName: 'SlotGoblin', weight: 3 },
});

test('renders a landed pick without a sound hook', () => {
  render(<RevealStage giveaway={pick(20_000)} entries={[]} firstMessage={null} />);
  expect(screen.getAllByText('SlotGoblin').length).toBeGreaterThan(0);
  expect(screen.getByText('3 tickets in the hat')).toBeTruthy();
  expect(screen.getByText(/waiting on slotgoblin/i)).toBeTruthy();
});

test('renders mid-reveal without a sound hook', () => {
  render(<RevealStage giveaway={pick(500)} entries={[]} firstMessage={null} />);
  expect(screen.getByText(/tuning in/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=RevealStage`
Expected: FAIL with `Cannot find module '../RevealStage'`.

- [ ] **Step 3: Create `RevealStage.js`**

Create `src/components/giveaway/RevealStage.js` with this header:

```js
import RevealScreen, { useRevealState } from './RevealScreen';
import { REVEAL_MS, formatClock, tsMillis } from '../../utils/giveaway';

// Silent stand-in for the overlay's sound hook, so the control room's stage
// moment can reuse the reveal without Web Audio.
const NO_SOUND = { tick() {}, burst() {}, land() {} };
```

Then cut `ClaimClock` (plain `function`) and `RevealStage` from `src/pages/GiveawayOverlay.js` verbatim. Change the `RevealStage` signature line to:

```js
export default function RevealStage({ giveaway, entries, firstMessage, sound = NO_SOUND, holding = false }) {
```

- [ ] **Step 4: Point the overlay at the new module**

In `src/pages/GiveawayOverlay.js`, add `import RevealStage from '../components/giveaway/RevealStage';` after the `RevealScreen` import. Run `npx eslint src/pages/GiveawayOverlay.js src/components/giveaway/RevealStage.js` and remove any import it reports as unused (for example `RevealScreen` if nothing else in the overlay uses it; keep `CrtStyles`, `GiveawayAvatar` and `useRevealState` if still referenced).

- [ ] **Step 5: Run tests and lint**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=RevealStage`
Expected: PASS (2 tests).
Run: `npx eslint src/pages/GiveawayOverlay.js src/components/giveaway`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/components/giveaway src/pages/GiveawayOverlay.js && git commit -m "refactor(giveaways): share the overlay reveal stage"
```

---

### Task 4: Transactional `close` and `roll`

Two browsers driving the clock can both close and both auto-roll today. Make the fake Firestore model contention like the real thing, then make both actions transactional.

**Files:**
- Modify: `src/test/fakeFirestore.js`
- Modify: `api/admin/giveaways.js` (the `close` and `roll` branches, and the header comment)
- Test: `src/__tests__/adminGiveawaysApi.test.js`

**Interfaces:**
- Produces: `roll` can now answer `409 { error: 'ROLL_RACE' }` when another caller rolled between its read and its write. `close` answers `400 { error: 'NOT_OPEN' }` to every caller except the one that closed it.

- [ ] **Step 1: Write the failing API test**

Create `src/__tests__/adminGiveawaysApi.test.js`:

```js
/**
 * @jest-environment node
 */
import handler from '../../api/admin/giveaways';
import { __fake } from '../../api/_lib/firebaseAdmin.js';

jest.mock('../../api/_lib/firebaseAdmin.js', () => {
  const { createFakeFirestore } = require('../test/fakeFirestore');
  const fake = createFakeFirestore();
  return { adminDb: fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp, __fake: fake };
});
jest.mock('../../api/_lib/verifyAuth.js', () => ({
  applyCors: () => {},
  requireAdmin: async () => ({ email: 'owner@test' }),
}));
jest.mock('../../api/_lib/twitchChat.js', () => ({ sendChannelMessage: jest.fn() }));

function mockRes() {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.setHeader = (k, v) => {
    res.headers[k] = v;
  };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  res.end = () => res;
  return res;
}

async function call(body) {
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body }, res);
  return res;
}

function seedGiveaway(id, data = {}) {
  __fake.seed(`giveaways/${id}`, {
    status: 'open',
    winners: [],
    skippedIds: [],
    winner: null,
    winnerTwitchId: null,
    rolledAt: null,
    announcedPick: null,
    playing: null,
    entryCount: 2,
    ...data,
  });
}

function seedEntry(gid, twitchId) {
  __fake.seed(`giveaways/${gid}/entries/${twitchId}`, {
    twitchId,
    twitchName: twitchId,
    displayName: twitchId.toUpperCase(),
    weight: 1,
    source: 'chat',
    registered: false,
  });
}

beforeEach(() => __fake.reset());

test('two closes at once: one closes, the other sees NOT_OPEN', async () => {
  seedGiveaway('g1');
  const [a, b] = await Promise.all([call({ action: 'close', id: 'g1' }), call({ action: 'close', id: 'g1' })]);
  expect([a.statusCode, b.statusCode].sort()).toEqual([200, 400]);
  expect([a.body, b.body]).toContainEqual({ error: 'NOT_OPEN' });
  expect(__fake.read('giveaways/g1').status).toBe('closed');
});

test('closing a giveaway that is not open answers NOT_OPEN', async () => {
  seedGiveaway('g1', { status: 'closed' });
  const res = await call({ action: 'close', id: 'g1' });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'NOT_OPEN' });
});

test('roll picks a winner, flips to rolling and clears the old winner chat', async () => {
  seedGiveaway('g1', { status: 'closed' });
  seedEntry('g1', 'tw1');
  __fake.seed('giveaways/g1/winner_messages/m1', { text: 'old pick chatter' });
  const res = await call({ action: 'roll', id: 'g1' });
  expect(res.statusCode).toBe(200);
  expect(res.body.winner.twitchId).toBe('tw1');
  const g = __fake.read('giveaways/g1');
  expect(g.status).toBe('rolling');
  expect(g.winnerTwitchId).toBe('tw1');
  expect(__fake.paths('giveaways/g1/winner_messages')).toEqual([]);
});

test('two rolls at once: exactly one pick lands, the other gets ROLL_RACE', async () => {
  seedGiveaway('g1', { status: 'closed' });
  seedEntry('g1', 'tw1');
  seedEntry('g1', 'tw2');
  const [a, b] = await Promise.all([call({ action: 'roll', id: 'g1' }), call({ action: 'roll', id: 'g1' })]);
  expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  expect([a.body, b.body]).toContainEqual({ error: 'ROLL_RACE' });
  const winner = [a, b].find((r) => r.statusCode === 200).body.winner.twitchId;
  expect(__fake.read('giveaways/g1').winnerTwitchId).toBe(winner);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=adminGiveawaysApi`
Expected: FAIL. "two closes at once" gets `[200, 200]`, and "two rolls at once" gets `[200, 200]`.

- [ ] **Step 3: Model contention in the fake Firestore**

In `src/test/fakeFirestore.js`:

1. Replace the last three lines of the header comment (`// Transactions here run sequentially …` through `// runTransaction calls the way real Firestore can interleave them.`) with:

```js
// Transactions are optimistic like the real thing: each document read through
// tx.get records its version, and if any of them changed before commit the
// callback runs again (up to 5 attempts). Two interleaved runTransaction
// calls on one document therefore resolve the way Firestore resolves them.
// Query reads inside a transaction are not version-checked.
```

2. After `let clock = 1000000;` add:

```js
  let versions = new Map();
  const bump = (path) => versions.set(path, (versions.get(path) || 0) + 1);
  const versionOf = (path) => versions.get(path) || 0;
  function remove(path) {
    docs.delete(path);
    bump(path);
  }
```

3. At the end of `write(path, kind, data, opts)` (after the `if/else if/else` block) add `bump(path);`.

4. In `docRef`, change `delete: async () => { docs.delete(path); },` to `delete: async () => remove(path),`.

5. In `queuedWriter`, change the `delete` queue line to `queue.push(() => remove(ref.path));`.

6. Replace `runTransaction` with:

```js
    runTransaction: async (fn) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const w = queuedWriter();
        const reads = new Map();
        const tx = {
          get: (target) => {
            reads.set(target.path, versionOf(target.path));
            return target.get();
          },
          set: w.set,
          update: w.update,
          delete: w.delete,
        };
        const result = await fn(tx);
        const stale = [...reads].some(([path, seen]) => versionOf(path) !== seen);
        if (!stale) {
          w.flush();
          return result;
        }
      }
      throw new Error('fake firestore: transaction kept conflicting');
    },
```

7. In `reset()`, add `versions = new Map();`.

- [ ] **Step 4: Make `close` and `roll` transactional**

In `api/admin/giveaways.js`:

1. Add after `currentPickConfirmed`:

```js
const tsMs = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null);

// Rollable from open/closed, from a bonus being played, or from the winner
// window once the pick on screen has been confirmed ("roll another").
function isRollable(giveaway) {
  return (
    ['open', 'closed', 'playing'].includes(giveaway.status) ||
    (giveaway.status === 'rolling' && currentPickConfirmed(giveaway))
  );
}
```

2. Replace the whole `if (action === 'close') { … }` block with:

```js
    if (action === 'close') {
      // Two browsers can hit zero on the same second. Only the transaction
      // that still sees 'open' closes it, and only that caller auto-rolls.
      const closed = await adminDb.runTransaction(async (tx) => {
        const cur = await tx.get(ref);
        if (!cur.exists || cur.data().status !== 'open') return false;
        tx.update(ref, { status: 'closed', closedAt: FieldValue.serverTimestamp() });
        return true;
      });
      if (!closed) return res.status(400).json({ error: 'NOT_OPEN' });
      return res.status(200).json({ ok: true });
    }
```

3. Replace the whole `if (action === 'roll') { … }` block with:

```js
    if (action === 'roll') {
      if (!isRollable(giveaway)) {
        return res.status(400).json({ error: 'NOT_ROLLABLE' });
      }
      // The pick reads the entries subcollection, so it runs first; the
      // transaction then checks nobody rolled or moved the giveaway since.
      const winner = await pickWeightedWinner(ref, excludedIds(giveaway));
      if (!winner) return res.status(400).json({ error: 'NO_ENTRIES' });
      const seenStatus = giveaway.status;
      const seenRolledAt = tsMs(giveaway.rolledAt);
      const won = await adminDb.runTransaction(async (tx) => {
        const snapNow = await tx.get(ref);
        const cur = snapNow.exists ? snapNow.data() : null;
        if (!cur || cur.status !== seenStatus || tsMs(cur.rolledAt) !== seenRolledAt || !isRollable(cur)) {
          return false;
        }
        tx.update(ref, {
          status: 'rolling',
          winner: trimEntry(winner),
          winnerTwitchId: winner.id,
          rolledAt: FieldValue.serverTimestamp(),
          announcedPick: null,
          playing: null,
        });
        return true;
      });
      if (!won) return res.status(409).json({ error: 'ROLL_RACE' });
      // Reset the winner chat stream only after this pick is the one that
      // stuck, so a losing caller never wipes the real winner's messages.
      await clearWinnerStream(ref);
      // Chat hears about the winner later, from `announce`, once the reveal
      // has played on stream.
      return res.status(200).json({ ok: true, winner: trimEntry(winner) });
    }
```

4. In the header comment, change the `roll` line to:

```js
//   roll     { id }                       -> pick weighted winner, status='rolling'.
//                                            409 ROLL_RACE when another caller
//                                            rolled first (transactional)
```

and the `close` line to `//   close    { id }                       -> stop accepting entries (transactional; losers get NOT_OPEN)`.

- [ ] **Step 5: Run the whole suite**

The fake Firestore change touches every handler test that uses a transaction (`grant-tickets`, `redemptions`, `suggestions`, `discord-auth`, `claim-daily`, `predictions/submit`, `store/redeem`, `suggestions/delete`, `watchtimeStore`, hunts), so run everything, not just the new file.

Run: `CI=true npm test -- --watchAll=false`
Expected: PASS. Sequential transactions never see a changed version, so nothing retries. If a suite now fails with `transaction kept conflicting`, its handler writes, outside the transaction, to a document it read inside the transaction callback. Report that rather than loosening the fake.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/test/fakeFirestore.js api/admin/giveaways.js src/__tests__/adminGiveawaysApi.test.js && git commit -m "fix(giveaways): close and roll once when two browsers race"
```

---

### Task 5: An `armed` switch on the timer hooks

Passenger tabs must show state without scheduling anything. Add `{ armed }` to the three engine hooks, keep today's behavior as the default, and make a lost roll race quiet.

**Files:**
- Modify: `src/components/admin/giveaways/useGiveawayClock.js`
- Modify: `src/components/admin/giveaways/useWinnerAnnounce.js`
- Modify: `src/components/admin/predictions/useResultsAnnounce.js`
- Test: `src/components/admin/giveaways/__tests__/useGiveawayClock.test.js` (extend)
- Test: `src/components/admin/giveaways/__tests__/useWinnerAnnounce.test.js` (new)
- Test: `src/components/admin/predictions/__tests__/announce.test.js` (extend)

**Interfaces:**
- Produces: `useGiveawayClock(list, onWarn, { armed = true } = {})`; `useWinnerAnnounce(giveaway, { armed = true } = {})`; `useResultsAnnounce(round, { armed = true } = {}) → { dueAt, posted, posting, error, retry }` (`posted` is new: `!!round?.announced?.results`).

- [ ] **Step 1: Write the failing tests**

Append to `src/components/admin/giveaways/__tests__/useGiveawayClock.test.js`:

```js
test('does nothing while not armed', async () => {
  run([giveaway({ closesAt: at(NOW + 1_000) })], { armed: false });
  await advance(5_000);
  expect(postAction).not.toHaveBeenCalled();
});

test('starts driving when armed flips on', async () => {
  const { rerender } = run([giveaway({ closesAt: at(NOW + 1_000) })], { armed: false });
  await advance(2_000);
  expect(postAction).not.toHaveBeenCalled();
  rerender({ l: [giveaway({ closesAt: at(NOW + 1_000) })], o: { armed: true } });
  await act(async () => {
    await flush();
  });
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
});

test('a lost roll race is not a warning', async () => {
  postAction.mockImplementation((action) =>
    action === 'roll' ? Promise.resolve({ ok: false, status: 409, data: { error: 'ROLL_RACE' } }) : ok()
  );
  const { onWarn } = run([giveaway({ closesAt: at(NOW + 1_000) })]);
  await advance(1_000);
  expect(onWarn).not.toHaveBeenCalled();
});
```

Create `src/components/admin/giveaways/__tests__/useWinnerAnnounce.test.js`:

```js
import { renderHook, act } from '@testing-library/react';
import useWinnerAnnounce from '../useWinnerAnnounce';
import { postAction } from '../api';
import { CHAT_ANNOUNCE_DELAY_MS } from '../../../../utils/giveaway';

jest.mock('../api', () => ({
  postAction: jest.fn(),
  QUIET_ANNOUNCE: ['disabled', 'empty', 'already'],
}));

const NOW = 1_700_000_000_000;
const at = (ms) => ({ toMillis: () => ms });
const pick = (extra = {}) => ({
  id: 'g1',
  status: 'rolling',
  winnerTwitchId: 'tw1',
  rolledAt: at(NOW),
  announceWinner: true,
  winnerMessage: 'gg {winner}',
  announcedPick: null,
  ...extra,
});

async function advance(ms) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  postAction.mockReset();
  postAction.mockResolvedValue({ ok: true, status: 200, data: { announce: { posted: true } } });
});
afterEach(() => jest.useRealTimers());

test('posts once the reveal has played', async () => {
  renderHook(() => useWinnerAnnounce(pick()));
  await advance(CHAT_ANNOUNCE_DELAY_MS - 1);
  expect(postAction).not.toHaveBeenCalled();
  await advance(1);
  expect(postAction).toHaveBeenCalledWith('announce', { id: 'g1', winnerTwitchId: 'tw1', rolledAtMs: NOW });
});

test('an unarmed tab never posts but still reports posted from the doc', async () => {
  const { result } = renderHook(() => useWinnerAnnounce(pick({ announcedPick: `tw1:${NOW}` }), { armed: false }));
  await advance(CHAT_ANNOUNCE_DELAY_MS + 1_000);
  expect(postAction).not.toHaveBeenCalled();
  expect(result.current.posted).toBe(true);
});

test('an unarmed tab with nothing posted yet stays pending', async () => {
  const { result } = renderHook(() => useWinnerAnnounce(pick(), { armed: false }));
  await advance(CHAT_ANNOUNCE_DELAY_MS + 1_000);
  expect(postAction).not.toHaveBeenCalled();
  expect(result.current.posted).toBe(false);
  expect(result.current.dueAt).toBe(NOW + CHAT_ANNOUNCE_DELAY_MS);
});
```

Append inside the `describe('useResultsAnnounce', …)` block of `src/components/admin/predictions/__tests__/announce.test.js`:

```js
  test('an unarmed tab never posts', () => {
    const now = Date.now();
    renderHook(() => useResultsAnnounce(settled(now), { armed: false }));
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(authedFetch).not.toHaveBeenCalled();
  });

  test('reports posted from the round doc', () => {
    const now = Date.now();
    const { result } = renderHook(() =>
      useResultsAnnounce(settled(now, { announced: { opened: at(1), locked: at(2), results: at(3) } }), {
        armed: false,
      })
    );
    expect(result.current.posted).toBe(true);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="useGiveawayClock|useWinnerAnnounce|announce.test"`
Expected: FAIL. The unarmed tests post anyway, "a lost roll race" warns, and `posted` is `undefined`.

- [ ] **Step 3: Implement `armed` in `useGiveawayClock`**

In `useGiveawayClock.js`:
- Signature: `export default function useGiveawayClock(list, onWarn, { armed = true } = {}) {`
- First line of the effect: `if (!timed || !armed) return undefined;`
- Effect deps: `}, [timed, armed, onWarn]);`
- Replace `if (!rolled.ok) onWarn(\`Auto-roll failed: ${rolled.data?.error || 'unknown'}\`);` with:

```js
              // ROLL_RACE: someone rolled it by hand at the same moment. Fine.
              if (!rolled.ok && rolled.data?.error !== 'ROLL_RACE') {
                onWarn(`Auto-roll failed: ${rolled.data?.error || 'unknown'}`);
              }
```

- Update the top comment's first line to: `// Runs the entry timer (only in the tab that drives, see useDriverLock): posts`.

- [ ] **Step 4: Implement `armed` in `useWinnerAnnounce`**

In `useWinnerAnnounce.js`:
- Signature: `export default function useWinnerAnnounce(giveaway, { armed = true } = {}) {`
- First line of the scheduling effect: `if (!armed || !key || !enabled || alreadyPosted.current) return undefined;`
- Its deps: `}, [armed, key, enabled, rolledAtMs]);`

- [ ] **Step 5: Implement `armed` and `posted` in `useResultsAnnounce`**

In `src/components/admin/predictions/useResultsAnnounce.js`:
- Signature: `export default function useResultsAnnounce(round, { armed = true } = {}) {`
- Rename the local `const armed = …` to `const due = …`, and use `due` in `const dueAt = due ? settledMs + STREAM_DELAY_MS : null;`.
- Effect guard: `if (!armed || !due || tried.current.has(id)) return undefined;` and deps `[armed, due, id, settledMs, dueAt, post]`.
- Return value gains `posted: !!(round && round.announced && round.announced.results),`.

- [ ] **Step 6: Run the tests**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="useGiveawayClock|useWinnerAnnounce|announce.test|AdminHunts"`
Expected: PASS (the hunts page tests still pass, since the default is armed).

- [ ] **Step 7: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/components/admin && git commit -m "feat(control-room): let passenger tabs show timers without firing them"
```

---

### Task 6: `useDriverLock`, one timer-driving tab per browser

**Files:**
- Create: `src/hooks/useDriverLock.js`
- Test: `src/hooks/__tests__/useDriverLock.test.js`

**Interfaces:**
- Produces: `export const DRIVER_LOCK = 'goofer-control-driver'`; `export function useDriverLock(enabled: boolean, { locks, doc } = {}) → { isDriver: boolean, supported: boolean }`. `locks` defaults to `navigator.locks`, `doc` to `document`. Without Web Locks, `isDriver === enabled`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useDriverLock.test.js`:

```js
import { renderHook, act } from '@testing-library/react';
import { useDriverLock } from '../useDriverLock';

// Minimal Web Locks: one exclusive holder, a FIFO queue, AbortSignal and steal.
function createFakeLocks() {
  let holder = null;
  const queue = [];
  const abortError = (msg) => Object.assign(new Error(msg), { name: 'AbortError' });
  const next = () => {
    if (!holder && queue.length) grant(queue.shift());
  };
  function grant(req) {
    holder = req;
    Promise.resolve(req.cb()).then(() => {
      if (holder === req) {
        holder = null;
        req.resolve();
        next();
      }
    });
  }
  return {
    request(_name, opts, cb) {
      return new Promise((resolve, reject) => {
        const req = { cb, resolve, reject };
        if (opts.steal) {
          if (holder) {
            const old = holder;
            holder = null;
            old.reject(abortError('stolen'));
          }
          grant(req);
          return;
        }
        if (opts.signal) {
          opts.signal.addEventListener('abort', () => {
            const i = queue.indexOf(req);
            if (i !== -1) {
              queue.splice(i, 1);
              reject(abortError('aborted'));
            }
          });
        }
        if (holder) queue.push(req);
        else grant(req);
      });
    },
    get held() {
      return !!holder;
    },
    get queued() {
      return queue.length;
    },
  };
}

function fakeDoc(state = 'visible') {
  const listeners = new Set();
  return {
    visibilityState: state,
    addEventListener: (type, fn) => type === 'visibilitychange' && listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
    set(next) {
      this.visibilityState = next;
      listeners.forEach((fn) => fn());
    },
  };
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

test('the only tab drives', async () => {
  const locks = createFakeLocks();
  const { result } = renderHook(() => useDriverLock(true, { locks, doc: fakeDoc() }));
  await flush();
  expect(result.current.isDriver).toBe(true);
  expect(locks.held).toBe(true);
});

test('a hidden second tab waits, then takes over when the first goes away', async () => {
  const locks = createFakeLocks();
  const a = renderHook(() => useDriverLock(true, { locks, doc: fakeDoc('visible') }));
  await flush();
  const b = renderHook(() => useDriverLock(true, { locks, doc: fakeDoc('hidden') }));
  await flush();
  expect(a.result.current.isDriver).toBe(true);
  expect(b.result.current.isDriver).toBe(false);
  a.unmount();
  await flush();
  expect(b.result.current.isDriver).toBe(true);
});

test('a tab that becomes visible takes the lock from a hidden driver', async () => {
  const locks = createFakeLocks();
  const docA = fakeDoc('visible');
  const docB = fakeDoc('hidden');
  const a = renderHook(() => useDriverLock(true, { locks, doc: docA }));
  await flush();
  const b = renderHook(() => useDriverLock(true, { locks, doc: docB }));
  await flush();
  act(() => docA.set('hidden'));
  act(() => docB.set('visible'));
  await flush();
  expect(b.result.current.isDriver).toBe(true);
  expect(a.result.current.isDriver).toBe(false);
  expect(locks.queued).toBe(1); // A queued again behind B
});

test('without Web Locks every tab drives', () => {
  const { result } = renderHook(() => useDriverLock(true, { locks: null, doc: fakeDoc() }));
  expect(result.current.isDriver).toBe(true);
  expect(result.current.supported).toBe(false);
});

test('disabled never drives and holds nothing', async () => {
  const locks = createFakeLocks();
  const { result } = renderHook(() => useDriverLock(false, { locks, doc: fakeDoc() }));
  await flush();
  expect(result.current.isDriver).toBe(false);
  expect(locks.held).toBe(false);
});

// Review Focus 3: StrictMode mounts, unmounts and remounts effects in dev.
// A grant that lands for a disposed effect must be handed straight back.
test('unmounting releases the lock at once, even right after mounting', async () => {
  const locks = createFakeLocks();
  const { unmount } = renderHook(() => useDriverLock(true, { locks, doc: fakeDoc() }));
  unmount();
  await flush();
  expect(locks.held).toBe(false);
  const again = renderHook(() => useDriverLock(true, { locks, doc: fakeDoc() }));
  await flush();
  expect(again.result.current.isDriver).toBe(true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=useDriverLock`
Expected: FAIL with `Cannot find module '../useDriverLock'`.

- [ ] **Step 3: Implement**

Create `src/hooks/useDriverLock.js`:

```js
import { useEffect, useState } from 'react';

export const DRIVER_LOCK = 'goofer-control-driver';

const defaultLocks = () => (typeof navigator !== 'undefined' ? navigator.locks : undefined);
const defaultDoc = () => (typeof document !== 'undefined' ? document : undefined);

/**
 * Elects one tab per browser to run the giveaway and prediction timers.
 *
 * The visible tab wins: browsers throttle timers in hidden tabs (last call
 * could fire a minute late), so a tab that becomes visible steals the lock and
 * the old holder queues up again. Without Web Locks every tab drives and the
 * server's claim-once guards dedupe.
 */
export function useDriverLock(enabled, { locks = defaultLocks(), doc = defaultDoc() } = {}) {
  const supported = !!(locks && typeof locks.request === 'function');
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!enabled || !supported) {
      setHeld(false);
      return undefined;
    }
    let disposed = false;
    let gen = 0;
    let release = null; // resolves the promise that holds the lock
    let controller = null; // aborts a queued (not yet granted) request

    const acquire = (steal) => {
      const mine = (gen += 1);
      const ctrl = steal ? null : new AbortController();
      controller = ctrl;
      const options = steal ? { mode: 'exclusive', steal: true } : { mode: 'exclusive', signal: ctrl.signal };
      locks
        .request(DRIVER_LOCK, options, () => {
          // A stale grant (we moved on, or unmounted): hand it straight back.
          if (disposed || mine !== gen) return undefined;
          setHeld(true);
          return new Promise((resolve) => {
            release = resolve;
          });
        })
        .catch(() => {
          // Aborted by us (ignored below), or stolen by another tab.
          if (disposed || mine !== gen) return;
          release = null;
          setHeld(false);
          acquire(false);
        });
    };

    const takeOver = () => {
      if (disposed || release || !doc || doc.visibilityState !== 'visible') return;
      const queued = controller;
      acquire(true); // bumps gen first, so the aborted request is ignored
      queued?.abort();
    };

    acquire(!!doc && doc.visibilityState === 'visible');
    doc?.addEventListener('visibilitychange', takeOver);

    return () => {
      disposed = true;
      gen += 1;
      doc?.removeEventListener('visibilitychange', takeOver);
      release?.();
      release = null;
      controller?.abort();
    };
  }, [enabled, supported, locks, doc]);

  return { isDriver: enabled && (supported ? held : true), supported };
}
```

- [ ] **Step 4: Run the tests**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=useDriverLock`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/hooks/useDriverLock.js src/hooks/__tests__/useDriverLock.test.js && git commit -m "feat(control-room): elect one timer-driving tab with a Web Lock"
```

---

### Task 7: Pure control room state (storage and selectors)

**Files:**
- Create: `src/components/controlRoom/storage.js`
- Create: `src/components/controlRoom/selectors.js`
- Test: `src/components/controlRoom/__tests__/storage.test.js`
- Test: `src/components/controlRoom/__tests__/selectors.test.js`

**Interfaces:**
- Produces (`storage.js`): `STORAGE_KEY`, `DEFAULT_STORE` (`{ mode: 'closed', restoreTo: 'float', rect: null, corner: 'tr', tab: 'giveaway', stage: false, hideLiveBadge: false }`), `isOpenMode(mode)`, `sanitizeStore(raw)`, `readStore()`, `writeStore(value)`.
- Produces (`selectors.js`): `LIVE_GIVEAWAY_STATUSES`, `OVERLAY_PATHS`, `shownGiveaway(list)`, `currentPickOf(list)`, `activeRoundOf(rounds)`, `pickConfirmed(giveaway)`, `controlRoomAllowed(pathname)`, `panelAllowed(pathname)`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/controlRoom/__tests__/storage.test.js`:

```js
import { DEFAULT_STORE, STORAGE_KEY, isOpenMode, readStore, sanitizeStore, writeStore } from '../storage';

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('an empty browser gets the defaults', () => {
  expect(readStore()).toEqual(DEFAULT_STORE);
});

test('round-trips through localStorage', () => {
  const value = { ...DEFAULT_STORE, mode: 'dock', restoreTo: 'dock', rect: { x: 10, y: 80 }, corner: 'bl', tab: 'predict', stage: true, hideLiveBadge: true };
  writeStore(value);
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(value);
  expect(readStore()).toEqual(value);
});

// Review Focus 1: garbage and stale shapes load the defaults.
test('broken JSON loads the defaults', () => {
  localStorage.setItem(STORAGE_KEY, '{not json');
  expect(readStore()).toEqual(DEFAULT_STORE);
});

test('a stale or hand-edited shape falls back field by field', () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ mode: 'maximized', restoreTo: 'pill', rect: { x: '10', y: 5 }, corner: 'middle', tab: 'chat', stage: 'yes', hideLiveBadge: 1 })
  );
  expect(readStore()).toEqual(DEFAULT_STORE);
});

test('keeps the valid fields of a partly valid shape', () => {
  expect(sanitizeStore({ mode: 'pill', rect: { x: 12, y: 90 }, tab: 'predict' })).toEqual({
    ...DEFAULT_STORE,
    mode: 'pill',
    rect: { x: 12, y: 90 },
    tab: 'predict',
  });
});

test('blocked storage never throws', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(readStore()).toEqual(DEFAULT_STORE);
  expect(() => writeStore(DEFAULT_STORE)).not.toThrow();
});

test('only float and dock count as open', () => {
  expect(['closed', 'pill', 'float', 'dock'].map(isOpenMode)).toEqual([false, false, true, true]);
});
```

Create `src/components/controlRoom/__tests__/selectors.test.js`:

```js
import {
  activeRoundOf,
  controlRoomAllowed,
  currentPickOf,
  panelAllowed,
  pickConfirmed,
  shownGiveaway,
} from '../selectors';

const at = (ms) => ({ toMillis: () => ms });

test('an older rolling giveaway wins over a newer open one', () => {
  const list = [
    { id: 'new', status: 'open' },
    { id: 'old', status: 'rolling' },
  ];
  expect(shownGiveaway(list).id).toBe('old');
});

test('playing beats open, open beats closed, empty is null', () => {
  expect(shownGiveaway([{ id: 'c', status: 'closed' }, { id: 'p', status: 'playing' }]).id).toBe('p');
  expect(shownGiveaway([{ id: 'c', status: 'closed' }, { id: 'o', status: 'open' }]).id).toBe('o');
  expect(shownGiveaway([])).toBeNull();
});

test('the current pick needs a winner and a roll time', () => {
  expect(currentPickOf([{ id: 'a', status: 'rolling', winnerTwitchId: null, rolledAt: at(1) }])).toBeNull();
  expect(currentPickOf([{ id: 'b', status: 'playing', winnerTwitchId: 'tw', rolledAt: at(1) }]).id).toBe('b');
});

test('the active round is an open or locked prediction round', () => {
  expect(activeRoundOf([{ id: 's', status: 'open', acceptPredictions: false }])).toBeNull();
  expect(activeRoundOf([{ id: 'x', status: 'settled', acceptPredictions: true }, { id: 'l', status: 'locked', acceptPredictions: true }]).id).toBe('l');
});

test('a pick is confirmed once it is in winners', () => {
  expect(pickConfirmed({ winnerTwitchId: 'tw', winners: [{ twitchId: 'tw' }] })).toBe(true);
  expect(pickConfirmed({ winnerTwitchId: 'tw', winners: [] })).toBe(false);
  expect(pickConfirmed(null)).toBe(false);
});

test('OBS sources never run the control room; /admin runs it without the panel', () => {
  expect(controlRoomAllowed('/giveaway-overlay')).toBe(false);
  expect(controlRoomAllowed('/suggest-overlay')).toBe(false);
  expect(controlRoomAllowed('/admin/giveaways')).toBe(true);
  expect(panelAllowed('/admin/giveaways')).toBe(false);
  expect(panelAllowed('/gamba/hunts')).toBe(true);
  expect(panelAllowed('/')).toBe(true);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="controlRoom/__tests__/(storage|selectors)"`
Expected: FAIL with `Cannot find module '../storage'` and `'../selectors'`.

- [ ] **Step 3: Implement `storage.js`**

Create `src/components/controlRoom/storage.js`:

```js
// Per-browser panel state and prefs. Every read and write is guarded: a
// private window, blocked storage or an older shape falls back to defaults.
export const STORAGE_KEY = 'goofer:control-room';

const MODES = ['closed', 'pill', 'float', 'dock'];
const OPEN_MODES = ['float', 'dock'];
const CORNERS = ['tl', 'tr', 'bl', 'br'];
const TABS = ['giveaway', 'predict'];

export const DEFAULT_STORE = Object.freeze({
  mode: 'closed',
  restoreTo: 'float',
  rect: null,
  corner: 'tr',
  tab: 'giveaway',
  stage: false,
  hideLiveBadge: false,
});

export const isOpenMode = (mode) => OPEN_MODES.includes(mode);

function cleanRect(rect) {
  if (!rect || typeof rect !== 'object') return null;
  const { x, y } = rect;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function sanitizeStore(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    mode: MODES.includes(s.mode) ? s.mode : DEFAULT_STORE.mode,
    restoreTo: OPEN_MODES.includes(s.restoreTo) ? s.restoreTo : DEFAULT_STORE.restoreTo,
    rect: cleanRect(s.rect),
    corner: CORNERS.includes(s.corner) ? s.corner : DEFAULT_STORE.corner,
    tab: TABS.includes(s.tab) ? s.tab : DEFAULT_STORE.tab,
    stage: s.stage === true,
    hideLiveBadge: s.hideLiveBadge === true,
  };
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStore() {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    return sanitizeStore(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_STORE };
  }
}

export function writeStore(value) {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Quota, private mode or blocked storage: the panel still works this session.
  }
}
```

- [ ] **Step 4: Implement `selectors.js`**

Create `src/components/controlRoom/selectors.js`:

```js
export const LIVE_GIVEAWAY_STATUSES = ['open', 'closed', 'rolling', 'playing'];
export const OVERLAY_PATHS = ['/giveaway-overlay', '/suggest-overlay'];
const SHOW_ORDER = ['rolling', 'playing', 'open', 'closed'];

// The giveaway the panel shows. `list` is newest first; an older rolling
// giveaway still wins over a newer open one, because a pick needs the operator.
export function shownGiveaway(list) {
  for (const status of SHOW_ORDER) {
    const hit = (list || []).find((g) => g.status === status);
    if (hit) return hit;
  }
  return null;
}

// The pick whose winner chat message may still be pending (the rule the admin
// page has always used).
export function currentPickOf(list) {
  return (
    (list || []).find(
      (g) => ['rolling', 'playing'].includes(g.status) && g.winnerTwitchId && g.rolledAt
    ) || null
  );
}

export function activeRoundOf(rounds) {
  return (
    (rounds || []).find(
      (r) => r.acceptPredictions && (r.status === 'open' || r.status === 'locked')
    ) || null
  );
}

export function pickConfirmed(giveaway) {
  if (!giveaway || !giveaway.winnerTwitchId) return false;
  return (giveaway.winners || []).some((w) => w.twitchId === giveaway.winnerTwitchId);
}

// Where the provider runs at all. OBS browser sources never drive timers.
export function controlRoomAllowed(pathname) {
  return !OVERLAY_PATHS.includes(pathname);
}

// Where the floating panel and the stage moment render. /admin has its own UI.
export function panelAllowed(pathname) {
  return controlRoomAllowed(pathname) && !pathname.startsWith('/admin');
}
```

- [ ] **Step 5: Run the tests**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="controlRoom/__tests__/(storage|selectors)"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/components/controlRoom && git commit -m "feat(control-room): panel storage and live-state selectors"
```

---

### Task 8: `ControlRoomProvider`

**Files:**
- Create: `src/components/controlRoom/useWarnings.js`
- Create: `src/components/controlRoom/useLiveQuery.js`
- Create: `src/contexts/ControlRoomContext.js`
- Modify: `src/App.js` (mount the provider)
- Test: `src/components/controlRoom/__tests__/useLiveQuery.test.js`
- Test: `src/contexts/__tests__/ControlRoomContext.test.js`

**Interfaces:**
- Consumes: `useDriverLock` (Task 6); `useGiveawayClock`, `useWinnerAnnounce`, `useResultsAnnounce` with `{ armed }` (Task 5); `storage.js`, `selectors.js` (Task 7).
- Produces: `useWarnings({ ttlMs = 8000 } = {}) → { warnings: {id, message, sticky}[], pushWarning(message, { sticky = false } = {}), dismissWarning(id) }`; `useLiveQuery(makeQuery, enabled, { retryMs = 5000, maxRetries = 5 } = {}) → { docs, error, gaveUp }`; `useControlRoom()` returns `null` outside a provider, otherwise:

```js
{
  enabled, giveaways, giveaway, rounds, activeRound, latestRound,
  dataLost, dataGaveUp, isDriver, announce, results,
  warnings, pushWarning, dismissWarning,
  panel: { mode, restoreTo, rect, corner, tab },
  panelActions: { open, toggle, minimize, close, dock, undock(rect?), moveTo(rect, corner), setTab(tab), resetPosition },
  prefs: { stage, hideLiveBadge }, setStage(bool), setHideLiveBadge(bool),
  ducked, setDucked(bool),
}
```

- [ ] **Step 1: Write the failing tests**

Create `src/components/controlRoom/__tests__/useLiveQuery.test.js`:

```js
import { renderHook, act } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';
import { useLiveQuery } from '../useLiveQuery';

jest.mock('firebase/firestore', () => ({ onSnapshot: jest.fn() }));

const snap = (rows) => ({ docs: rows.map((r) => ({ id: r.id, data: () => r })) });

beforeEach(() => {
  jest.useFakeTimers();
  onSnapshot.mockReset();
});
afterEach(() => jest.useRealTimers());

test('delivers docs with their ids', () => {
  onSnapshot.mockImplementation((_q, next) => {
    next(snap([{ id: 'a', status: 'open' }]));
    return () => {};
  });
  const { result } = renderHook(() => useLiveQuery(() => 'q', true));
  expect(result.current.docs).toEqual([{ id: 'a', status: 'open' }]);
  expect(result.current.error).toBe(false);
});

test('does not subscribe while disabled', () => {
  renderHook(() => useLiveQuery(() => 'q', false));
  expect(onSnapshot).not.toHaveBeenCalled();
});

test('retries every 5s after an error, then gives up after five retries', () => {
  onSnapshot.mockImplementation((_q, _next, fail) => {
    fail(new Error('offline'));
    return () => {};
  });
  const { result } = renderHook(() => useLiveQuery(() => 'q', true));
  expect(result.current.error).toBe(true);
  for (let i = 0; i < 5; i += 1) {
    act(() => {
      jest.advanceTimersByTime(5000);
    });
  }
  expect(onSnapshot).toHaveBeenCalledTimes(6);
  expect(result.current.gaveUp).toBe(true);
  act(() => {
    jest.advanceTimersByTime(60000);
  });
  expect(onSnapshot).toHaveBeenCalledTimes(6);
});

test('a good snapshot after an error clears it', () => {
  let calls = 0;
  onSnapshot.mockImplementation((_q, next, fail) => {
    calls += 1;
    if (calls === 1) fail(new Error('blip'));
    else next(snap([{ id: 'b' }]));
    return () => {};
  });
  const { result } = renderHook(() => useLiveQuery(() => 'q', true));
  act(() => {
    jest.advanceTimersByTime(5000);
  });
  expect(result.current.error).toBe(false);
  expect(result.current.docs).toEqual([{ id: 'b' }]);
});
```

Create `src/contexts/__tests__/ControlRoomContext.test.js`:

```js
import { render, act } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import { ControlRoomProvider, useControlRoom } from '../ControlRoomContext';
import { useAuth } from '../AuthContext';
import { useDriverLock } from '../../hooks/useDriverLock';
import { postAction } from '../../components/admin/giveaways/api';

jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({ useLocation: jest.fn() }));
jest.mock('../../hooks/useDriverLock', () => ({ useDriverLock: jest.fn() }));
jest.mock('../../config/firebase', () => ({ db: {} }));
const mockData = {};
jest.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => parts.join('/'),
  where: () => null,
  orderBy: () => null,
  limit: () => null,
  query: (ref) => ref,
  onSnapshot: jest.fn((path, next) => {
    next({ docs: (mockData[path] || []).map((row) => ({ id: row.id, data: () => row })) });
    return () => {};
  }),
}));
jest.mock('../../components/admin/giveaways/api', () => ({
  postAction: jest.fn(() => Promise.resolve({ ok: true, status: 200, data: {} })),
  QUIET_ANNOUNCE: ['disabled', 'empty', 'already'],
}));

const at = (ms) => ({ toMillis: () => ms });
let latest;
function Probe() {
  latest = useControlRoom();
  return null;
}
const mount = () => render(<ControlRoomProvider><Probe /></ControlRoomProvider>);

beforeEach(() => {
  latest = undefined;
  localStorage.clear();
  onSnapshot.mockClear();
  postAction.mockClear();
  Object.keys(mockData).forEach((k) => delete mockData[k]);
  useLocation.mockReturnValue({ pathname: '/' });
  useAuth.mockReturnValue({ isStaff: true });
  useDriverLock.mockReturnValue({ isDriver: true, supported: true });
});

test('useControlRoom is null outside a provider', () => {
  render(<Probe />);
  expect(latest).toBeNull();
});

test('viewers get a disabled control room with no subscriptions', () => {
  useAuth.mockReturnValue({ isStaff: false });
  mount();
  expect(latest.enabled).toBe(false);
  expect(onSnapshot).not.toHaveBeenCalled();
});

test('OBS overlay routes never run it', () => {
  useLocation.mockReturnValue({ pathname: '/giveaway-overlay' });
  mount();
  expect(latest.enabled).toBe(false);
  expect(onSnapshot).not.toHaveBeenCalled();
});

test('staff subscribe to live giveaways and recent rounds', () => {
  mockData.giveaways = [
    { id: 'g2', status: 'open' },
    { id: 'g1', status: 'rolling', winnerTwitchId: 'tw', rolledAt: at(1) },
  ];
  mockData.hunts = [{ id: 'r1', status: 'locked', acceptPredictions: true }];
  mount();
  expect(onSnapshot.mock.calls.map(([path]) => path).sort()).toEqual(['giveaways', 'hunts']);
  expect(latest.enabled).toBe(true);
  expect(latest.giveaway.id).toBe('g1');
  expect(latest.activeRound.id).toBe('r1');
  expect(latest.latestRound.id).toBe('r1');
});

test('panel state and prefs persist per browser', () => {
  const first = mount();
  act(() => latest.panelActions.open());
  act(() => latest.setStage(true));
  expect(latest.panel.mode).toBe('float');
  expect(JSON.parse(localStorage.getItem('goofer:control-room')).stage).toBe(true);
  first.unmount();
  mount();
  expect(latest.panel.mode).toBe('float');
  expect(latest.prefs.stage).toBe(true);
});

test('minimize and close remember where to reopen', () => {
  mount();
  act(() => latest.panelActions.dock());
  act(() => latest.panelActions.minimize());
  expect(latest.panel.mode).toBe('pill');
  act(() => latest.panelActions.open());
  expect(latest.panel.mode).toBe('dock');
  act(() => latest.panelActions.close());
  act(() => latest.panelActions.toggle());
  expect(latest.panel.mode).toBe('dock');
  act(() => latest.panelActions.toggle());
  expect(latest.panel.mode).toBe('pill');
});

test('a passenger tab never runs the giveaway clock', async () => {
  useDriverLock.mockReturnValue({ isDriver: false, supported: true });
  mockData.giveaways = [{ id: 'g1', status: 'open', closesAt: at(Date.now() - 1000), autoRoll: true, entryCount: 2 }];
  mount();
  await act(async () => {});
  expect(postAction).not.toHaveBeenCalled();
});

test('the driving tab runs it', async () => {
  mockData.giveaways = [{ id: 'g1', status: 'open', closesAt: at(Date.now() - 1000), autoRoll: true, entryCount: 2 }];
  mount();
  await act(async () => {});
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
});

test('pushWarning adds a warning, dismissWarning removes it', () => {
  mount();
  act(() => latest.pushWarning('Auto-roll failed: X', { sticky: true }));
  expect(latest.warnings.map((w) => w.message)).toEqual(['Auto-roll failed: X']);
  act(() => latest.dismissWarning(latest.warnings[0].id));
  expect(latest.warnings).toEqual([]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="useLiveQuery|ControlRoomContext"`
Expected: FAIL with missing-module errors.

- [ ] **Step 3: Implement `useWarnings.js`**

Create `src/components/controlRoom/useWarnings.js`:

```js
import { useCallback, useEffect, useRef, useState } from 'react';

// A short queue of operator warnings. Sticky ones (timer failures) stay until
// dismissed; the rest clear after ttlMs. The same message never stacks.
export function useWarnings({ ttlMs = 8000 } = {}) {
  const [warnings, setWarnings] = useState([]);
  const seq = useRef(0);
  const timers = useRef(new Map());

  const dismissWarning = useCallback((id) => {
    setWarnings((list) => list.filter((w) => w.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const pushWarning = useCallback(
    (message, { sticky = false } = {}) => {
      seq.current += 1;
      const id = seq.current;
      setWarnings((list) => [...list.filter((w) => w.message !== message), { id, message, sticky }].slice(-3));
      if (!sticky) timers.current.set(id, setTimeout(() => dismissWarning(id), ttlMs));
      return id;
    },
    [dismissWarning, ttlMs]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  return { warnings, pushWarning, dismissWarning };
}
```

- [ ] **Step 4: Implement `useLiveQuery.js`**

Create `src/components/controlRoom/useLiveQuery.js`:

```js
import { useEffect, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

const EMPTY = { docs: [], error: false, gaveUp: false };

// A live Firestore query that survives blips: on error it resubscribes every
// retryMs, and after maxRetries failures in a row it stops ("reload to
// reconnect"). A good snapshot resets the count.
export function useLiveQuery(makeQuery, enabled, { retryMs = 5000, maxRetries = 5 } = {}) {
  const [state, setState] = useState(EMPTY);
  const [attempt, setAttempt] = useState(0);
  const failures = useRef(0);
  const makeRef = useRef(makeQuery);
  makeRef.current = makeQuery;

  useEffect(() => {
    if (!enabled) {
      failures.current = 0;
      setState(EMPTY);
      return undefined;
    }
    let timer = null;
    const unsubscribe = onSnapshot(
      makeRef.current(),
      (snap) => {
        failures.current = 0;
        setState({ docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: false, gaveUp: false });
      },
      () => {
        failures.current += 1;
        if (failures.current > maxRetries) {
          setState((s) => ({ ...s, error: true, gaveUp: true }));
          return;
        }
        setState((s) => ({ ...s, error: true }));
        timer = setTimeout(() => setAttempt((a) => a + 1), retryMs);
      }
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled, attempt, retryMs, maxRetries]);

  return state;
}
```

- [ ] **Step 5: Implement the provider**

Create `src/contexts/ControlRoomContext.js`:

```js
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, orderBy, query, where, limit as fLimit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { useDriverLock } from '../hooks/useDriverLock';
import useGiveawayClock from '../components/admin/giveaways/useGiveawayClock';
import useWinnerAnnounce from '../components/admin/giveaways/useWinnerAnnounce';
import useResultsAnnounce from '../components/admin/predictions/useResultsAnnounce';
import { useWarnings } from '../components/controlRoom/useWarnings';
import { useLiveQuery } from '../components/controlRoom/useLiveQuery';
import { isOpenMode, readStore, writeStore } from '../components/controlRoom/storage';
import {
  LIVE_GIVEAWAY_STATUSES,
  activeRoundOf,
  controlRoomAllowed,
  currentPickOf,
  shownGiveaway,
} from '../components/controlRoom/selectors';

const ControlRoomContext = createContext(null);

// null outside a provider (tests, or code above it). Treat null like
// `enabled: false`.
export function useControlRoom() {
  return useContext(ControlRoomContext);
}

const giveawaysQuery = () =>
  query(
    collection(db, 'giveaways'),
    where('status', 'in', LIVE_GIVEAWAY_STATUSES),
    orderBy('createdAt', 'desc'),
    fLimit(5)
  );
const roundsQuery = () => query(collection(db, 'hunts'), orderBy('createdAt', 'desc'), fLimit(3));

// Live giveaway + prediction state and the timer engine for staff, on every
// route (so /admin and the floating panel share one engine), plus the panel's
// per-browser state. Timers only fire in the tab that holds the driver lock.
export function ControlRoomProvider({ children }) {
  const { isStaff } = useAuth();
  const { pathname } = useLocation();
  const enabled = !!isStaff && controlRoomAllowed(pathname);

  const giveawaysFeed = useLiveQuery(giveawaysQuery, enabled);
  const roundsFeed = useLiveQuery(roundsQuery, enabled);
  const giveaways = giveawaysFeed.docs;
  const rounds = roundsFeed.docs;

  const { isDriver } = useDriverLock(enabled);
  const armed = enabled && isDriver;
  const { warnings, pushWarning, dismissWarning } = useWarnings();
  const warnSticky = useCallback((message) => pushWarning(message, { sticky: true }), [pushWarning]);

  useGiveawayClock(giveaways, warnSticky, { armed });
  const currentPick = useMemo(() => currentPickOf(giveaways), [giveaways]);
  const announce = useWinnerAnnounce(currentPick, { armed });
  const latestRound = rounds[0] || null;
  const results = useResultsAnnounce(latestRound, { armed });

  const [store, setStore] = useState(readStore);
  useEffect(() => writeStore(store), [store]);
  const [ducked, setDucked] = useState(false);

  const panelActions = useMemo(() => {
    const remember = (s) => (isOpenMode(s.mode) ? s.mode : s.restoreTo);
    return {
      open: () => setStore((s) => ({ ...s, mode: s.restoreTo })),
      toggle: () =>
        setStore((s) =>
          isOpenMode(s.mode) ? { ...s, mode: 'pill', restoreTo: s.mode } : { ...s, mode: s.restoreTo }
        ),
      minimize: () => setStore((s) => ({ ...s, mode: 'pill', restoreTo: remember(s) })),
      close: () => setStore((s) => ({ ...s, mode: 'closed', restoreTo: remember(s) })),
      dock: () => setStore((s) => ({ ...s, mode: 'dock', restoreTo: 'dock' })),
      undock: (rect) => setStore((s) => ({ ...s, mode: 'float', restoreTo: 'float', rect: rect || s.rect })),
      moveTo: (rect, corner) => setStore((s) => ({ ...s, rect, corner: corner || s.corner })),
      setTab: (tab) => setStore((s) => ({ ...s, tab })),
      resetPosition: () =>
        setStore((s) => ({ ...s, mode: 'float', restoreTo: 'float', rect: null, corner: 'tr' })),
    };
  }, []);
  const setStage = useCallback((on) => setStore((s) => ({ ...s, stage: !!on })), []);
  const setHideLiveBadge = useCallback((on) => setStore((s) => ({ ...s, hideLiveBadge: !!on })), []);

  const value = {
    enabled,
    giveaways,
    giveaway: shownGiveaway(giveaways),
    rounds,
    activeRound: activeRoundOf(rounds),
    latestRound,
    dataLost: giveawaysFeed.error || roundsFeed.error,
    dataGaveUp: giveawaysFeed.gaveUp || roundsFeed.gaveUp,
    isDriver: armed,
    announce,
    results,
    warnings,
    pushWarning,
    dismissWarning,
    panel: {
      mode: store.mode,
      restoreTo: store.restoreTo,
      rect: store.rect,
      corner: store.corner,
      tab: store.tab,
    },
    panelActions,
    prefs: { stage: store.stage, hideLiveBadge: store.hideLiveBadge },
    setStage,
    setHideLiveBadge,
    ducked,
    setDucked,
  };

  return <ControlRoomContext.Provider value={value}>{children}</ControlRoomContext.Provider>;
}
```

- [ ] **Step 6: Mount it in `App.js`**

In `src/App.js`, add `import { ControlRoomProvider } from './contexts/ControlRoomContext';` after the `TwitchAuthProvider` import, and change `StreamingSite` to:

```js
export default function StreamingSite() {
  return (
    <AuthProvider>
      <ControlRoomProvider>
        <TwitchAuthProvider>
          <AppShell />
        </TwitchAuthProvider>
      </ControlRoomProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 7: Run tests and lint**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="useLiveQuery|ControlRoomContext"`
Expected: PASS.
Run: `npx eslint src/contexts src/components/controlRoom src/App.js`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/contexts src/components/controlRoom src/App.js && git commit -m "feat(control-room): provider with live data, timer engine and panel state"
```

---

### Task 9: Admin pages, nav button and the LIVE badge read from the provider

**Files:**
- Create: `src/components/controlRoom/WarningStrip.js`
- Create: `src/components/controlRoom/ControlRoomButton.js`
- Modify: `src/pages/AdminGiveawaysPage.js`
- Modify: `src/pages/AdminHuntsPage.js`
- Modify: `src/components/Navigation.js`
- Modify: `src/components/LiveIndicator.js`
- Modify: `src/App.js`
- Test: `src/pages/__tests__/AdminGiveawaysPage.test.js`
- Test: `src/components/controlRoom/__tests__/ControlRoomButton.test.js`
- Test: `src/components/__tests__/LiveIndicator.test.js`

**Interfaces:**
- Consumes: `useControlRoom()` (Task 8), `useWarnings` (Task 8).
- Produces: `WarningStrip({ warnings, onDismiss, className })`; `ControlRoomButton({ giveaway, onClick })` (renders `data-control-room-button`); `LiveIndicator({ isLive, streamData, hidden = false })`.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/__tests__/AdminGiveawaysPage.test.js`:

```js
import { render, screen, waitFor } from '@testing-library/react';
import AdminGiveawaysPage from '../AdminGiveawaysPage';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { postAction } from '../../components/admin/giveaways/api';

jest.mock('../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../config/firebase', () => ({ db: {} }));
const mockRows = {};
jest.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => parts.join('/'),
  query: (ref) => ref,
  orderBy: () => null,
  limit: () => null,
  where: () => null,
  onSnapshot: (path, next) => {
    const rows = mockRows[path] || [];
    next({ empty: rows.length === 0, docs: rows.map((row) => ({ id: row.id, data: () => row })) });
    return () => {};
  },
}));
jest.mock('../../components/admin/giveaways/api', () => ({
  postAction: jest.fn(),
  QUIET_ANNOUNCE: ['disabled', 'empty', 'already'],
}));
jest.mock('../../components/admin/giveaways/EventSubStatus', () => ({
  __esModule: true,
  default: () => null,
  useEventSubStatus: () => ({ status: 'enabled', subs: [], busy: false, error: null, subscribe: jest.fn(), remove: jest.fn() }),
  chatLabel: () => 'Connected to Twitch chat',
}));

const at = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const EXPIRED = {
  id: 'g1',
  status: 'open',
  prize: 'Steam key',
  title: 'Friday',
  keyword: 'goof',
  closesAt: at(Date.now() - 1000),
  autoRoll: true,
  entryCount: 3,
  createdAt: at(1),
};
const IDLE_ANNOUNCE = { enabled: false, posted: false, posting: false, error: null, dueAt: null, retry: jest.fn() };

beforeEach(() => {
  postAction.mockReset();
  postAction.mockResolvedValue({ ok: true, status: 200, data: {} });
  mockRows.giveaways = [EXPIRED];
});

test('shows control room warnings at the top and leaves the clock to the provider', async () => {
  useControlRoom.mockReturnValue({
    enabled: true,
    warnings: [{ id: 1, message: 'Auto-roll failed: NO_ENTRIES', sticky: true }],
    dismissWarning: jest.fn(),
    pushWarning: jest.fn(),
    announce: IDLE_ANNOUNCE,
  });
  render(<AdminGiveawaysPage />);
  expect(screen.getByText('Auto-roll failed: NO_ENTRIES')).toBeTruthy();
  await new Promise((r) => setTimeout(r, 30));
  expect(postAction).not.toHaveBeenCalled();
});

test('without a provider the page still runs its own clock', async () => {
  useControlRoom.mockReturnValue(null);
  render(<AdminGiveawaysPage />);
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' }));
});
```

Create `src/components/controlRoom/__tests__/ControlRoomButton.test.js`:

```js
import { render, screen, fireEvent } from '@testing-library/react';
import ControlRoomButton from '../ControlRoomButton';

test('idle: a plain Control room button', () => {
  const onClick = jest.fn();
  render(<ControlRoomButton giveaway={null} onClick={onClick} />);
  fireEvent.click(screen.getByRole('button', { name: /control room/i }));
  expect(onClick).toHaveBeenCalled();
});

test('live: shows the entry count and status', () => {
  render(<ControlRoomButton giveaway={{ status: 'closed', prize: 'Key', entryCount: 12 }} onClick={() => {}} />);
  expect(screen.getByRole('button', { name: /12 entries, closed/i })).toBeTruthy();
});
```

Create `src/components/__tests__/LiveIndicator.test.js`:

```js
import { render, screen } from '@testing-library/react';
import LiveIndicator from '../LiveIndicator';

test('shows while live', () => {
  render(<LiveIndicator isLive streamData={null} />);
  expect(screen.getByText(/goofer live now/i)).toBeTruthy();
});

test('hidden on this screen when the operator hides it', () => {
  render(<LiveIndicator isLive streamData={null} hidden />);
  expect(screen.queryByText(/goofer live now/i)).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="AdminGiveawaysPage.test|ControlRoomButton|LiveIndicator"`
Expected: FAIL. `ControlRoomButton` is missing, the page does not render the warning and runs its clock, and `hidden` is ignored.

- [ ] **Step 3: Create `WarningStrip.js`**

```js
import { TriangleAlert, X } from 'lucide-react';

// Operator warnings (timer failures, chat posts that didn't land). Used by the
// control room panel and pinned at the top of /admin/giveaways.
export default function WarningStrip({ warnings, onDismiss, className = '' }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div role="status" className={`space-y-1.5 ${className}`}>
      {warnings.map((w) => (
        <div
          key={w.id}
          className="flex items-start gap-2 px-3 py-2 border border-red-destructive/50 bg-red-destructive/10"
        >
          <TriangleAlert size={13} className="text-red-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="flex-1 text-xs text-white/85 leading-snug">{w.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(w.id)}
            aria-label="Dismiss warning"
            className="text-white/45 hover:text-white-body"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `ControlRoomButton.js`**

```js
import { MonitorPlay } from 'lucide-react';

const STATUS_LABEL = { open: 'Live', rolling: 'Rolling', playing: 'Playing', closed: 'Closed' };

// Nav shortcut into the control room. Shows the running giveaway's entry
// count so the operator can see it's live without opening anything.
export default function ControlRoomButton({ giveaway, onClick }) {
  const label = giveaway ? STATUS_LABEL[giveaway.status] || 'Live' : null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-control-room-button=""
      aria-keyshortcuts="`"
      title={giveaway ? `Giveaway ${label.toLowerCase()}: ${giveaway.prize}` : 'Open the control room'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border transition-colors duration-150 whitespace-nowrap ${
        giveaway
          ? 'border-emerald-signal/50 bg-emerald-signal/10 text-emerald-signal hover:bg-emerald-signal/20'
          : 'border-orange-admin/30 text-orange-admin/90 hover:bg-orange-admin/10 hover:text-orange-admin'
      }`}
    >
      <MonitorPlay size={12} aria-hidden="true" />
      <span className="sr-only lg:not-sr-only text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
        Control room
      </span>
      {giveaway && (
        <span className="inline-flex items-center gap-1 pl-1.5 ml-0.5 border-l border-emerald-signal/30 text-[0.625rem] font-bold font-mono tabular-nums">
          <span className="relative flex w-1.5 h-1.5" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-60" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
          </span>
          {giveaway.entryCount ?? 0}
          <span className="sr-only"> entries, {label}</span>
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 5: Rewire `AdminGiveawaysPage`**

In `src/pages/AdminGiveawaysPage.js`:
1. Add `useCallback` to the React import. Add:

```js
import { useControlRoom } from '../contexts/ControlRoomContext';
import { useWarnings } from '../components/controlRoom/useWarnings';
import WarningStrip from '../components/controlRoom/WarningStrip';
```

2. In `AdminGiveawaysPage`, delete `const [warning, setWarning] = useState(null);` and the `useEffect` that clears `warning` after 8000ms. In their place add:

```js
  // With the control room provider (staff on /admin), the provider runs the
  // clock and the winner announce for every page; this page only shows them.
  // Without it (tests), the page drives its own, as it always did.
  const cr = useControlRoom();
  const shared = !!cr?.enabled;
  const local = useWarnings();
  const warn = shared ? cr : local;
  const { pushWarning: pushLocal } = local;
  const warnSticky = useCallback((message) => pushLocal(message, { sticky: true }), [pushLocal]);
```

3. Replace `useGiveawayClock(list, setWarning);` with `useGiveawayClock(list, warnSticky, { armed: !shared });`.
4. Replace `const announce = useWinnerAnnounce(currentPick);` with:

```js
  const localAnnounce = useWinnerAnnounce(currentPick, { armed: !shared });
  const announce = shared ? cr.announce : localAnnounce;
```

5. In the `NewGiveawayForm` `onCreated` handler, replace `setWarning(\`Giveaway started, but chat announce failed: ${meta.announceError}\`);` with `warn.pushWarning(\`Giveaway started, but chat announce failed: ${meta.announceError}\`);`.
6. Delete the whole `{warning && ( <div role="status" className="fixed bottom-6 right-6 …"> … </div> )}` block, and insert directly after `</header>`:

```jsx
      <WarningStrip warnings={warn.warnings} onDismiss={warn.dismissWarning} className="mb-6" />
```

- [ ] **Step 6: Rewire `AdminHuntsPage`**

In `src/pages/AdminHuntsPage.js`, add `import { useControlRoom } from '../contexts/ControlRoomContext';` and replace `const results = useResultsAnnounce(current);` with:

```js
  // The control room provider posts results for every page; without it
  // (tests), this page posts them itself.
  const cr = useControlRoom();
  const shared = !!cr?.enabled;
  const localResults = useResultsAnnounce(current, { armed: !shared });
  const results = shared ? cr.results : localResults;
```

- [ ] **Step 7: `LiveIndicator` `hidden` prop and dock offset**

In `src/components/LiveIndicator.js`:
- Signature: `export default function LiveIndicator({ isLive, streamData, hidden = false }) {`
- First line: `if (!isLive || hidden) return null;`
- The `<a>` class: `className="fixed bottom-6 right-[calc(1.5rem+var(--control-dock-w,0px))] z-50 group"` (moves left when the control room is docked).

In `src/App.js` `StreamingSiteContent`: add `import { useControlRoom } from './contexts/ControlRoomContext';` (merge with the provider import) and `const cr = useControlRoom();` at the top of the component; change the LiveIndicator line to:

```jsx
      <LiveIndicator
        isLive={isLive}
        streamData={streamData}
        hidden={!!cr?.enabled && cr.prefs.hideLiveBadge}
      />
```

- [ ] **Step 8: Navigation**

In `src/components/Navigation.js`:
1. In the lucide import, replace `Gift,` with `MonitorPlay,`. Delete the `firebase/firestore` import line and the `db` import (both were only used by `useLiveGiveaway`). Add:

```js
import { useControlRoom } from '../contexts/ControlRoomContext';
import ControlRoomButton from './controlRoom/ControlRoomButton';
```

2. Delete the `useLiveGiveaway` function (with its comment) and the `GiveawayShortcut` function.
3. In `Navigation`, replace

```js
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const liveGiveaway = useLiveGiveaway(isAdmin);
```

with

```js
  const { currentUser, isStaff } = useAuth();
  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const cr = useControlRoom();
  const liveGiveaway = cr?.enabled ? cr.giveaway : null;
  // The panel is hidden on /admin, so there the button keeps its old job.
  const panelHere = !!cr?.enabled && currentPage !== 'admin';
  const toggleControlRoom = () => (panelHere ? cr.panelActions.toggle() : setPage(GIVEAWAY_ADMIN_PATH));
```

4. Desktop right cluster: replace `<GiveawayShortcut live={liveGiveaway} onClick={() => setPage(GIVEAWAY_ADMIN_PATH)} />` with `<ControlRoomButton giveaway={liveGiveaway} onClick={toggleControlRoom} />`, and replace the viewer branch `<ViewerAuthControl onNavigate={(id) => setPage(id)} />` with:

```jsx
              <div className="flex items-center gap-2 lg:gap-3">
                {isStaff && <ControlRoomButton giveaway={liveGiveaway} onClick={toggleControlRoom} />}
                <ViewerAuthControl onNavigate={(id) => setPage(id)} />
              </div>
```

5. Mobile drawer: change `{isAdmin && (` (the Operator section) to `{isStaff && (`. Replace the Giveaways `<button>` in that section with:

```jsx
              <button
                type="button"
                onClick={() => {
                  if (panelHere) {
                    cr.panelActions.open();
                    setMobileMenuOpen(false);
                  } else {
                    handleNavClick(GIVEAWAY_ADMIN_PATH);
                  }
                }}
                className="group flex items-center gap-3 px-5 py-3.5 border-l-2 border-transparent hover:bg-zinc-card/50 transition-colors duration-150"
              >
                <MonitorPlay size={15} className="text-orange-admin" aria-hidden="true" />
                <span className="text-sm font-bold tracking-tight text-white/70">Control room</span>
                {liveGiveaway && (
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" aria-hidden="true" />
                    Live · {liveGiveaway.entryCount ?? 0}
                  </span>
                )}
              </button>
```

   and wrap the Admin `<button>` that follows it in `{isAdmin && ( … )}`.

- [ ] **Step 9: Run tests and lint**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="AdminGiveawaysPage.test|ControlRoomButton|LiveIndicator|AdminHunts"`
Expected: PASS.
Run: `npx eslint src/pages src/components/Navigation.js src/components/LiveIndicator.js src/components/controlRoom src/App.js`
Expected: no output.

- [ ] **Step 10: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/pages src/components src/App.js && git commit -m "feat(control-room): admin pages and nav read from the shared engine"
```

---

### Task 10: Panel geometry and status (pure)

**Files:**
- Create: `src/components/controlRoom/geometry.js`
- Create: `src/components/controlRoom/panelStatus.js`
- Test: `src/components/controlRoom/__tests__/geometry.test.js`
- Test: `src/components/controlRoom/__tests__/panelStatus.test.js`

**Interfaces:**
- Consumes: `pickConfirmed` (Task 7).
- Produces (`geometry.js`): constants `PANEL_W, DOCK_W, NAV_H, EDGE, SNAP, DOCK_ZONE, UNDOCK_DIST, GRAB, HEADER_H, LIVE_BADGE_CLEARANCE`; `defaultRect(vw) → {x,y}`; `clampRect(rect, size, view) → {x,y}`; `snapToCorner(rect, size, view) → { rect, corner|null }`; `nearestCorner(rect, size, view) → 'tl'|'tr'|'bl'|'br'`; `inDockZone(pointerX, vw)`; `shouldUndock(startX, pointerX)`; `pillAnchor(corner, restoreTo) → style`; `originFor(corner, restoreTo) → string`. Here `size = {w,h}` and `view = {vw,vh}`.
- Produces (`panelStatus.js`): `pillState({ giveaway, round, warnings, dataLost, now }) → { label, tone: 'idle'|'live'|'attention'|'error' }`; `tallies({ isLive, giveaway, activeRound }) → { live, gvw, prd }`; `tabLeds({ giveaway, activeRound }) → { giveaway: 'off'|'on'|'pulse', predict: … }`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/controlRoom/__tests__/geometry.test.js`:

```js
import {
  clampRect,
  defaultRect,
  inDockZone,
  nearestCorner,
  originFor,
  pillAnchor,
  shouldUndock,
  snapToCorner,
} from '../geometry';

const size = { w: 380, h: 400 };
const view = { vw: 1280, vh: 720 };

test('floats top-right under the nav by default', () => {
  expect(defaultRect(1440)).toEqual({ x: 1044, y: 73 });
});

// Review Focus 2: a position saved on a bigger monitor comes back on screen.
test('clamps a saved position that is off screen', () => {
  expect(clampRect({ x: 5000, y: 5000 }, size, view)).toEqual({ x: 1232, y: 684 });
  expect(clampRect({ x: -5000, y: -40 }, size, view)).toEqual({ x: -332, y: 57 });
});

test('snaps within 24px of a corner, and only then', () => {
  expect(snapToCorner({ x: 880, y: 80 }, size, view)).toEqual({ rect: { x: 884, y: 73 }, corner: 'tr' });
  expect(snapToCorner({ x: 30, y: 300 }, size, view)).toEqual({ rect: { x: 30, y: 300 }, corner: null });
});

test('nearest corner goes by the panel centre', () => {
  expect(nearestCorner({ x: 900, y: 500 }, size, view)).toBe('br');
  expect(nearestCorner({ x: 10, y: 60 }, size, view)).toBe('tl');
});

test('dock zone is the last 48px; undock needs a 64px pull', () => {
  expect(inDockZone(1232, 1280)).toBe(true);
  expect(inDockZone(1231, 1280)).toBe(false);
  expect(shouldUndock(1200, 1136)).toBe(false);
  expect(shouldUndock(1200, 1135)).toBe(true);
});

test('the pill clears the LIVE badge on the right and follows the dock', () => {
  expect(pillAnchor('br', 'float')).toEqual({ right: 16, bottom: 104 });
  expect(pillAnchor('tl', 'float')).toEqual({ left: 16, top: 73 });
  expect(pillAnchor('tl', 'dock')).toEqual({ right: 16, bottom: 104 });
  expect(originFor('bl', 'float')).toBe('bottom left');
  expect(originFor('tl', 'dock')).toBe('bottom right');
});
```

Create `src/components/controlRoom/__tests__/panelStatus.test.js`:

```js
import { pillState, tabLeds, tallies } from '../panelStatus';

const NOW = 1_700_000_000_000;
const at = (ms) => ({ toMillis: () => ms });

test('an open timed giveaway shows its countdown and entries', () => {
  const g = { status: 'open', closesAt: at(NOW + 42_000), entryCount: 128 };
  expect(pillState({ giveaway: g, now: NOW })).toEqual({ label: 'GVW 00:42 · 128 IN', tone: 'live' });
});

// Review Focus 4: no timer, no countdown.
test('an open giveaway without a timer says OPEN', () => {
  const g = { status: 'open', closesAt: null, entryCount: 3 };
  expect(pillState({ giveaway: g, now: NOW })).toEqual({ label: 'GVW OPEN · 3 IN', tone: 'live' });
});

test('an unconfirmed pick needs attention; a confirmed one does not', () => {
  const pick = { status: 'rolling', winnerTwitchId: 'tw', winners: [], winner: { displayName: 'SlotGoblin' } };
  expect(pillState({ giveaway: pick, now: NOW })).toEqual({ label: 'GVW PICK · SLOTGOBLIN', tone: 'attention' });
  const done = { ...pick, winners: [{ twitchId: 'tw' }] };
  expect(pillState({ giveaway: done, now: NOW }).tone).toBe('live');
});

test('closed, playing, rounds and idle', () => {
  expect(pillState({ giveaway: { status: 'closed', entryCount: 9 } }).label).toBe('GVW CLOSED · 9 IN');
  expect(pillState({ giveaway: { status: 'playing', playing: { twitchName: 'bean' } } }).label).toBe('GVW PLAYING · BEAN');
  expect(pillState({ round: { status: 'locked', entryCount: 212 } })).toEqual({ label: 'PRD LOCKED · 212', tone: 'attention' });
  expect(pillState({ round: { status: 'open', entryCount: 5 } }).tone).toBe('live');
  expect(pillState({})).toEqual({ label: 'CONTROL ROOM', tone: 'idle' });
});

test('warnings or lost data turn the tone red', () => {
  expect(pillState({ warnings: [{ id: 1 }] }).tone).toBe('error');
  expect(pillState({ dataLost: true }).tone).toBe('error');
});

test('tallies and tab LEDs', () => {
  expect(tallies({ isLive: true, giveaway: null, activeRound: { status: 'open' } })).toEqual({ live: true, gvw: false, prd: true });
  expect(tabLeds({ giveaway: null, activeRound: null })).toEqual({ giveaway: 'off', predict: 'off' });
  expect(tabLeds({ giveaway: { status: 'open' }, activeRound: { status: 'locked' } })).toEqual({ giveaway: 'on', predict: 'pulse' });
  expect(tabLeds({ giveaway: { status: 'rolling', winnerTwitchId: 'tw', winners: [] }, activeRound: null }).giveaway).toBe('pulse');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="controlRoom/__tests__/(geometry|panelStatus)"`
Expected: FAIL with missing-module errors.

- [ ] **Step 3: Implement `geometry.js`**

```js
export const PANEL_W = 380;
export const DOCK_W = 400;
export const NAV_H = 57; // matches the nav bar (the mobile drawer uses top-[57px])
export const EDGE = 16;
export const SNAP = 24;
export const DOCK_ZONE = 48;
export const UNDOCK_DIST = 64;
export const GRAB = 48; // px of the header that must stay reachable
export const HEADER_H = 36;
export const LIVE_BADGE_CLEARANCE = 104; // bottom offset that clears "Goofer is live"

export function defaultRect(vw) {
  return { x: Math.max(EDGE, vw - PANEL_W - EDGE), y: NAV_H + EDGE };
}

// Keeps at least GRAB px of the header on screen sideways and the whole header
// on screen vertically, so the panel can always be dragged back.
export function clampRect(rect, size, view) {
  return {
    x: Math.min(Math.max(rect.x, GRAB - size.w), view.vw - GRAB),
    y: Math.min(Math.max(rect.y, NAV_H), view.vh - HEADER_H),
  };
}

function cornerPoints(size, view) {
  return {
    tl: { x: EDGE, y: NAV_H + EDGE },
    tr: { x: view.vw - size.w - EDGE, y: NAV_H + EDGE },
    bl: { x: EDGE, y: view.vh - size.h - EDGE },
    br: { x: view.vw - size.w - EDGE, y: view.vh - size.h - EDGE },
  };
}

export function snapToCorner(rect, size, view) {
  for (const [corner, p] of Object.entries(cornerPoints(size, view))) {
    if (Math.abs(rect.x - p.x) <= SNAP && Math.abs(rect.y - p.y) <= SNAP) return { rect: p, corner };
  }
  return { rect, corner: null };
}

export function nearestCorner(rect, size, view) {
  const v = rect.y + size.h / 2 < view.vh / 2 ? 't' : 'b';
  const h = rect.x + size.w / 2 < view.vw / 2 ? 'l' : 'r';
  return `${v}${h}`;
}

export const inDockZone = (pointerX, vw) => pointerX >= vw - DOCK_ZONE;
export const shouldUndock = (startX, pointerX) => startX - pointerX > UNDOCK_DIST;

export function pillAnchor(corner, restoreTo) {
  if (restoreTo === 'dock') return { right: EDGE, bottom: LIVE_BADGE_CLEARANCE };
  switch (corner) {
    case 'tl':
      return { left: EDGE, top: NAV_H + EDGE };
    case 'bl':
      return { left: EDGE, bottom: EDGE };
    case 'br':
      return { right: EDGE, bottom: LIVE_BADGE_CLEARANCE };
    default:
      return { right: EDGE, top: NAV_H + EDGE };
  }
}

// The panel powers on from the corner its pill sits in.
export function originFor(corner, restoreTo) {
  if (restoreTo === 'dock') return 'bottom right';
  return { tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right' }[corner] || 'top right';
}
```

- [ ] **Step 4: Implement `panelStatus.js`**

```js
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
```

- [ ] **Step 5: Run the tests**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="controlRoom/__tests__/(geometry|panelStatus)"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/components/controlRoom && git commit -m "feat(control-room): panel geometry and status labels"
```

---

### Task 11: The panel shell (float, dock, pill, drag, hotkeys, motion)

**Files:**
- Create: `src/components/controlRoom/ControlRoom.js`
- Create: `src/components/controlRoom/PanelChrome.js`
- Create: `src/components/controlRoom/Pill.js`
- Create: `src/components/controlRoom/CrashPill.js`
- Create: `src/components/controlRoom/motion.js`
- Create: `src/components/controlRoom/useMediaQuery.js`
- Create: `src/components/controlRoom/controlRoom.css`
- Create: `src/components/controlRoom/GiveawayTab.js` (first version; Task 12 replaces it)
- Create: `src/components/controlRoom/PredictTab.js` (first version; Task 13 replaces it)
- Modify: `src/components/ErrorBoundary.js` (`fallback` prop)
- Modify: `src/App.js` (mount the panel)
- Test: `src/components/controlRoom/__tests__/ControlRoom.test.js`
- Test: `src/components/__tests__/ErrorBoundary.test.js`

**Interfaces:**
- Consumes: `useControlRoom()` (Task 8), `geometry.js` and `panelStatus.js` (Task 10), `isOpenMode` and `panelAllowed` (Task 7), `WarningStrip` (Task 9).
- Produces: `export default function ControlRoom({ isLive })`; `GiveawayTab({ scopeRef })` and `PredictTab()` as the tab-body contract; `motion.js` exports `MOTION = { powerOn: 550, powerOff: 320, pillIn: 180, tabSwap: 110, tabFlip: 240, reducedFade: 150 }`, `prefersReducedMotion()` and `flipFrom(el, fromRect, opts)`; `ErrorBoundary` accepts `fallback` (a node, or `(reset) => node`).

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/ErrorBoundary.test.js`:

```js
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

function Boom() {
  throw new Error('boom');
}

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('a null fallback renders nothing', () => {
  const { container } = render(<ErrorBoundary fallback={null}><Boom /></ErrorBoundary>);
  expect(container.innerHTML).toBe('');
});

test('a function fallback gets a reset', () => {
  render(
    <ErrorBoundary fallback={(reset) => <button onClick={reset}>Reopen</button>}>
      <Boom />
    </ErrorBoundary>
  );
  expect(screen.getByRole('button', { name: 'Reopen' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
});

test('no fallback keeps the page error screen', () => {
  render(<ErrorBoundary><Boom /></ErrorBoundary>);
  expect(screen.getByText(/something broke/i)).toBeTruthy();
});
```

Create `src/components/controlRoom/__tests__/ControlRoom.test.js`:

```js
import { render, screen, fireEvent, act } from '@testing-library/react';
import ControlRoom from '../ControlRoom';
import { useControlRoom } from '../../../contexts/ControlRoomContext';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../GiveawayTab', () => () => require('react').createElement('p', null, 'giveaway tab body'));
jest.mock('../PredictTab', () => () => require('react').createElement('p', null, 'predict tab body'));

const at = (ms) => ({ toMillis: () => ms });

function makeCr(overrides = {}) {
  const { panel, ...rest } = overrides;
  return {
    enabled: true,
    giveaway: null,
    giveaways: [],
    activeRound: null,
    latestRound: null,
    rounds: [],
    warnings: [],
    dismissWarning: jest.fn(),
    dataLost: false,
    dataGaveUp: false,
    ducked: false,
    panel: { mode: 'float', restoreTo: 'float', rect: null, corner: 'tr', tab: 'giveaway', ...panel },
    panelActions: {
      open: jest.fn(),
      toggle: jest.fn(),
      minimize: jest.fn(),
      close: jest.fn(),
      dock: jest.fn(),
      undock: jest.fn(),
      moveTo: jest.fn(),
      setTab: jest.fn(),
      resetPosition: jest.fn(),
    },
    prefs: { stage: false, hideLiveBadge: false },
    setStage: jest.fn(),
    setHideLiveBadge: jest.fn(),
    ...rest,
  };
}

let cr;
function show(overrides) {
  cr = makeCr(overrides);
  useControlRoom.mockReturnValue(cr);
  return render(<ControlRoom isLive />);
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
});

test('closed renders no panel', () => {
  show({ panel: { mode: 'closed' } });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('float shows the panel with its tabs and the active tab body', () => {
  show();
  expect(screen.getByRole('dialog', { name: 'Control room' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: /giveaway/i }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('giveaway tab body')).toBeTruthy();
});

test('backtick opens a closed panel', () => {
  show({ panel: { mode: 'closed' } });
  fireEvent.keyDown(window, { key: '`' });
  expect(cr.panelActions.open).toHaveBeenCalled();
});

// Review Focus 5: typing a backtick in a field never toggles the panel.
test('backtick inside a text field does nothing', () => {
  show({ panel: { mode: 'closed' } });
  const input = document.createElement('input');
  document.body.appendChild(input);
  fireEvent.keyDown(input, { key: '`' });
  expect(cr.panelActions.open).not.toHaveBeenCalled();
});

test('Escape powers off, then minimizes', () => {
  show();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(cr.panelActions.minimize).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(cr.panelActions.minimize).toHaveBeenCalled();
});

test('Escape leaves the panel alone while a modal dialog is open', () => {
  const modal = document.createElement('div');
  modal.setAttribute('aria-modal', 'true');
  document.body.appendChild(modal);
  show();
  fireEvent.keyDown(window, { key: 'Escape' });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(cr.panelActions.minimize).not.toHaveBeenCalled();
});

test('header controls call the right actions', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Stage' }));
  expect(cr.setStage).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Dock to the right' }));
  expect(cr.panelActions.dock).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Panel options' }));
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /hide live badge/i }));
  expect(cr.setHideLiveBadge).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Close control room' }));
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(cr.panelActions.close).toHaveBeenCalled();
});

test('the pill shows live state and reopens the panel', () => {
  show({ panel: { mode: 'pill' }, giveaway: { status: 'open', closesAt: null, entryCount: 3 } });
  fireEvent.click(screen.getByRole('button', { name: /open control room\. gvw open · 3 in/i }));
  expect(cr.panelActions.open).toHaveBeenCalled();
});

// Review Focus 2: a stale saved position is clamped on screen (jsdom is 1024×768).
test('a saved position off screen comes back on screen', () => {
  show({ panel: { rect: { x: 5000, y: 5000 } } });
  const dialog = screen.getByRole('dialog', { name: 'Control room' });
  expect(dialog.style.left).toBe('976px');
  expect(dialog.style.top).toBe('732px');
});

test('a new pick opens a minimized panel on the Giveaway tab', () => {
  const view = show({ panel: { mode: 'pill', tab: 'predict' } });
  cr = makeCr({
    panel: { mode: 'pill', tab: 'predict' },
    giveaway: { id: 'g1', status: 'rolling', winnerTwitchId: 'tw1', rolledAt: at(Date.now()), winners: [], winner: { displayName: 'A' } },
  });
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  expect(cr.panelActions.open).toHaveBeenCalled();
  expect(cr.panelActions.setTab).toHaveBeenCalledWith('giveaway');
});

test('arrow keys move between tabs', () => {
  show();
  fireEvent.keyDown(screen.getByRole('tab', { name: /giveaway/i }), { key: 'ArrowRight' });
  act(() => {
    jest.advanceTimersByTime(240);
  });
  expect(cr.panelActions.setTab).toHaveBeenCalledWith('predict');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="ControlRoom.test|ErrorBoundary"`
Expected: FAIL. `ControlRoom` is missing, and `fallback` is ignored.

- [ ] **Step 3: `ErrorBoundary` fallback prop**

In `src/components/ErrorBoundary.js`, make the first lines of `render()`:

```js
  render() {
    if (this.state.hasError) {
      // Floating UI (the control room) passes its own fallback so a crash
      // never covers the page on stream: null, or (reset) => node.
      if (this.props.fallback !== undefined) {
        const { fallback } = this.props;
        return typeof fallback === 'function' ? fallback(this.handleReset) : fallback;
      }
```

(The existing page error screen follows unchanged.)

- [ ] **Step 4: `motion.js` and `useMediaQuery.js`**

`src/components/controlRoom/motion.js`:

```js
export const MOTION = { powerOn: 550, powerOff: 320, pillIn: 180, tabSwap: 110, tabFlip: 240, reducedFade: 150 };

export function prefersReducedMotion() {
  try {
    return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// FLIP: animate `el` from `from` (a DOMRect captured before a layout change)
// to where it is now. Web Animations without `fill`, so no transform stays on
// the panel afterwards (a resting transform would trap fixed-position modals).
export function flipFrom(el, from, { duration = 300, easing = 'cubic-bezier(.2,1.25,.3,1)' } = {}) {
  if (!el || !from || typeof el.animate !== 'function' || prefersReducedMotion()) return;
  const to = el.getBoundingClientRect();
  if (!to.width || !to.height) return;
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  el.animate(
    [
      { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transformOrigin: 'top left', transform: 'none' },
    ],
    { duration, easing }
  );
}
```

`src/components/controlRoom/useMediaQuery.js`:

```js
import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const read = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}
```

- [ ] **Step 5: `controlRoom.css`**

Create `src/components/controlRoom/controlRoom.css`:

```css
/* Control room: master-control chrome and motion. Loaded with the lazy panel
   and stage chunks, so viewers never download it. No rule here leaves a
   transform or filter on .cr-panel at rest (fixed modals inside must escape). */

.cr-panel { background: #111113; border: 1px solid #2a2a2e; border-radius: 10px; color: #fafafa; box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.04); overflow: hidden; transition: opacity 0.2s ease; }
.cr-panel.is-docked { border-radius: 0; border-width: 0 0 0 1px; }
.cr-panel.is-sheet { border-radius: 12px 12px 0 0; border-width: 1px 0 0; }
.cr-ducked { opacity: 0; pointer-events: none; }

.cr-top { display: flex; align-items: center; gap: 6px; padding: 7px 8px 7px 10px; background: #0b0b0d; border-bottom: 1px solid #222; font: 600 8px/1 source-code-pro, Menlo, Consolas, monospace; letter-spacing: 0.28em; color: #71717a; cursor: grab; touch-action: none; user-select: none; }
.cr-panel.is-sheet .cr-top, .cr-panel.is-docked .cr-top { cursor: default; }
.cr-tally { padding: 3px 5px; border-radius: 2px; background: #27272a; color: #52525b; letter-spacing: 0.2em; transition: background-color 0.2s, color 0.2s, box-shadow 0.2s; }
.cr-tally.is-on.tone-red { background: #ef4444; color: #fff; box-shadow: 0 0 10px rgba(239, 68, 68, 0.7); }
.cr-tally.is-on.tone-orange { background: #f97316; color: #0a0a0a; box-shadow: 0 0 10px rgba(249, 115, 22, 0.55); }
.cr-tally.is-on.tone-amber { background: #ffb24d; color: #0a0a0a; box-shadow: 0 0 10px rgba(255, 178, 77, 0.5); }
.cr-grip { color: #3f3f46; letter-spacing: 2px; margin-left: 4px; }
.cr-icon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 4px; color: #a1a1aa; cursor: pointer; }
.cr-icon:hover { color: #fafafa; background: rgba(255, 255, 255, 0.06); }
.cr-switch { padding: 4px 6px; border-radius: 3px; border: 1px solid #3f3f46; color: #a1a1aa; letter-spacing: 0.2em; cursor: pointer; font: inherit; }
.cr-switch.is-on { border-color: #ffb24d; color: #ffb24d; box-shadow: 0 0 8px rgba(255, 178, 77, 0.35); }
.cr-icon:focus-visible, .cr-tab:focus-visible, .cr-switch:focus-visible, .cr-btn:focus-visible, .cr-pill:focus-visible { outline: 2px solid #ffb24d; outline-offset: 1px; }

.cr-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 1; min-width: 180px; display: grid; padding: 4px; background: #18181b; border: 1px solid #2a2a2e; border-radius: 6px; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6); }
.cr-menu > * { text-align: left; padding: 8px; border-radius: 4px; font: 600 10px/1.2 source-code-pro, Menlo, monospace; letter-spacing: 0.12em; text-transform: uppercase; color: #d4d4d8; cursor: pointer; }
.cr-menu > *:hover, .cr-menu > *:focus-visible { background: rgba(255, 255, 255, 0.06); color: #fafafa; outline: none; }
.cr-menu [aria-checked='true']::after { content: ' \25CF'; color: #ffb24d; }

.cr-tabs { display: flex; gap: 6px; padding: 10px 10px 0; }
.cr-tab { flex: 1; position: relative; padding: 10px 0 7px; border-radius: 5px; background: #1c1c20; box-shadow: inset 0 -2px 0 #0a0a0a; font: 600 9px/1 source-code-pro, Menlo, monospace; letter-spacing: 0.2em; color: #71717a; cursor: pointer; transition: background-color 0.15s, color 0.15s; }
.cr-tab.is-active { background: #232328; color: #fafafa; }
.cr-tab-led { position: absolute; top: 3px; left: 50%; width: 14px; height: 2px; margin-left: -7px; border-radius: 1px; background: #3f3f46; transition: background-color 0.2s, box-shadow 0.2s; }
.cr-led-on, .cr-led-pulse { background: #ffb24d; box-shadow: 0 0 8px #ffb24d; }
.cr-led-pulse { animation: cr-led-pulse 1.4s ease-in-out infinite; }

.cr-body { position: relative; flex: 1; min-height: 0; overflow-y: auto; padding: 12px; }
.cr-static { position: absolute; inset: 0; pointer-events: none; opacity: 0; mix-blend-mode: screen; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.9'/%3E%3C/svg%3E"); }
.cr-flip .cr-static { animation: cr-static 240ms steps(4) both; }
.cr-flip > :not(.cr-static) { filter: blur(1.5px) brightness(1.6); transform: translateX(3px) skewX(-4deg); transition: filter 0.08s, transform 0.08s; }

.cr-lbl { font: 600 8px/1.3 source-code-pro, Menlo, monospace; letter-spacing: 0.26em; color: #71717a; text-transform: uppercase; }
.cr-timecode { font: 600 40px/1 source-code-pro, Menlo, monospace; color: #ffb24d; letter-spacing: -0.02em; text-shadow: 0 0 18px rgba(255, 178, 77, 0.35); font-variant-numeric: tabular-nums; }
.cr-timecode.is-quiet { color: #52525b; text-shadow: none; }
.cr-timecode.is-hot { color: #ef4444; text-shadow: 0 0 18px rgba(239, 68, 68, 0.45); animation: cr-hot 1s ease-in-out infinite; }
.cr-big { font-family: Anton, Impact, sans-serif; font-size: 30px; line-height: 1; }
.cr-bar { height: 3px; margin-top: 10px; border-radius: 2px; background: #27272a; overflow: hidden; }
.cr-bar > i { display: block; height: 100%; background: linear-gradient(90deg, #f97316, #ffb24d); transition: width 1s linear; }
.cr-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 6px; border-radius: 5px; background: #1f1f23; color: #d4d4d8; box-shadow: inset 0 -2px 0 #0a0a0a; font: 700 10px/1 source-code-pro, Menlo, monospace; letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer; }
.cr-btn:hover:not(:disabled) { color: #fafafa; background: #26262b; }
.cr-btn:disabled { opacity: 0.4; cursor: default; }
.cr-btn.is-go { background: #f97316; color: #0a0a0a; box-shadow: inset 0 -2px 0 #9a3412; }
.cr-btn.is-go:hover:not(:disabled) { background: #fb923c; }

.cr-pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: rgba(17, 17, 19, 0.96); border: 1px solid rgba(249, 115, 22, 0.5); box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.8); font: 600 9px/1 source-code-pro, Menlo, monospace; letter-spacing: 0.14em; color: #fafafa; cursor: pointer; }
.cr-pill-dot { width: 7px; height: 7px; border-radius: 50%; background: #52525b; }
.cr-pill.tone-live .cr-pill-dot { background: #10b981; box-shadow: 0 0 8px #10b981; }
.cr-pill.tone-attention .cr-pill-dot { background: #ffb24d; box-shadow: 0 0 8px #ffb24d; animation: cr-led-pulse 1.4s ease-in-out infinite; }
.cr-pill.tone-error { border-color: rgba(239, 68, 68, 0.7); }
.cr-pill.tone-error .cr-pill-dot { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
.cr-pill-in { animation: cr-pill-in 180ms cubic-bezier(0.2, 1.25, 0.3, 1) backwards; }

.cr-power-on { animation: cr-power-on 550ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards; }
.cr-power-on .cr-tabs, .cr-power-on .cr-body { animation: cr-fade-up 300ms 380ms ease-out backwards; }
.cr-power-off { animation: cr-power-off 320ms cubic-bezier(0.5, 0, 0.8, 0.4) forwards; }
.cr-lifted { transform: scale(1.01); box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.95); }
.cr-dock-ghost { border: 1px dashed rgba(249, 115, 22, 0.7); background: rgba(249, 115, 22, 0.06); animation: cr-fade 150ms ease-out backwards; pointer-events: none; }

body { transition: padding-right 300ms cubic-bezier(0.2, 0.8, 0.2, 1); }
body.control-docked { padding-right: var(--control-dock-w, 0px); }

.cr-stage { position: fixed; inset: 0; z-index: 80; }
.cr-stage-out { animation: cr-power-off 320ms cubic-bezier(0.5, 0, 0.8, 0.4) forwards; }

@keyframes cr-power-on {
  0% { transform: scale(0.02, 0.006); filter: brightness(5); opacity: 1; }
  35% { transform: scale(1, 0.006); filter: brightness(4); }
  65% { transform: scale(1, 1.02); filter: brightness(1.6); }
  100% { transform: none; filter: none; }
}
@keyframes cr-power-off {
  0% { transform: none; filter: none; opacity: 1; }
  55% { transform: scale(1, 0.006); filter: brightness(3); opacity: 1; }
  100% { transform: scale(0.02, 0.006); filter: brightness(5); opacity: 0; }
}
@keyframes cr-fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes cr-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cr-pill-in { from { opacity: 0; transform: translateY(8px) scale(0.94); } to { opacity: 1; transform: none; } }
@keyframes cr-static {
  0% { opacity: 0; background-position: 0 0; }
  25% { opacity: 0.75; background-position: 40px 20px; }
  60% { opacity: 0.5; background-position: -30px 60px; }
  100% { opacity: 0; background-position: 10px -20px; }
}
@keyframes cr-led-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes cr-hot { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

@media (prefers-reduced-motion: reduce) {
  .cr-power-on, .cr-pill-in, .cr-dock-ghost { animation: cr-fade 150ms ease-out backwards; }
  .cr-power-off, .cr-stage-out { animation: cr-fade 150ms ease-in reverse forwards; }
  .cr-power-on .cr-tabs, .cr-power-on .cr-body, .cr-flip .cr-static { animation: none; }
  .cr-flip > :not(.cr-static) { filter: none; transform: none; }
  .cr-led-pulse, .cr-pill.tone-attention .cr-pill-dot, .cr-timecode.is-hot { animation: none; }
  .cr-lifted { transform: none; }
  body { transition: none; }
}
```

- [ ] **Step 6: `Pill.js` and `CrashPill.js`**

`src/components/controlRoom/Pill.js`:

```js
import { useClock } from '../../hooks/useClock';
import { pillState } from './panelStatus';

// The minimized panel: one line of live state, and a click brings it back.
export default function Pill({ giveaway, round, warnings, dataLost, anchor, onOpen }) {
  const ticking = giveaway?.status === 'open' && !!giveaway.closesAt;
  const now = useClock({ intervalMs: 1000, active: ticking });
  const { label, tone } = pillState({ giveaway, round, warnings, dataLost, now });
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open control room. ${label}`}
      className={`cr-pill cr-pill-in tone-${tone} fixed z-[65]`}
      style={anchor}
    >
      <span className="cr-pill-dot" aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
    </button>
  );
}
```

`src/components/controlRoom/CrashPill.js` (main bundle, so the fallback works even if the panel chunk broke):

```js
export default function CrashPill({ onReopen }) {
  return (
    <button
      type="button"
      onClick={onReopen}
      className="fixed right-4 bottom-[104px] z-[65] px-3 py-2 rounded-full border border-red-destructive/60 bg-zinc-card text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono text-red-destructive"
    >
      Control room crashed. Reopen
    </button>
  );
}
```

- [ ] **Step 7: First-version tab bodies**

`src/components/controlRoom/GiveawayTab.js`:

```js
import { useControlRoom } from '../../contexts/ControlRoomContext';

// First version: status only. Task 12 replaces this with the full tool.
export default function GiveawayTab() {
  const cr = useControlRoom();
  return <p className="text-sm text-white/55">{cr.giveaway ? `Giveaway ${cr.giveaway.status}.` : 'Nothing running.'}</p>;
}
```

`src/components/controlRoom/PredictTab.js`:

```js
import { useControlRoom } from '../../contexts/ControlRoomContext';

// First version: status only. Task 13 replaces this with the full tool.
export default function PredictTab() {
  const cr = useControlRoom();
  return <p className="text-sm text-white/55">{cr.activeRound ? `Round ${cr.activeRound.status}.` : 'No round running.'}</p>;
}
```

- [ ] **Step 8: `PanelChrome.js`**

```js
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, MoreHorizontal, PanelRight, PanelRightClose, X } from 'lucide-react';

const TABS = [
  ['giveaway', 'Giveaway'],
  ['predict', 'Predict'],
];

function Tally({ on, tone, children }) {
  return <span className={`cr-tally tone-${tone} ${on ? 'is-on' : ''}`}>{children}</span>;
}

// Top strip (tally lights, Stage switch, menu, window buttons) and the
// hardware-style tabs. The strip is the drag handle.
export default function PanelChrome({
  tallies,
  dataLost,
  leds,
  tab,
  onTab,
  stage,
  onStage,
  hideLiveBadge,
  onHideLiveBadge,
  docked,
  narrow,
  onDock,
  onMinimize,
  onClose,
  onResetPosition,
  dragHandlers,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const adminHref = tab === 'predict' ? '/admin/hunts' : '/admin/giveaways';

  const onTabKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.findIndex(([id]) => id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
    onTab(next);
    document.getElementById(`cr-tab-${next}`)?.focus();
  };

  return (
    <>
      <div className="cr-top" {...dragHandlers}>
        <span id="cr-title" className="sr-only">
          Control room
        </span>
        <Tally on={tallies.live} tone="red">LIVE</Tally>
        <Tally on={tallies.gvw} tone="orange">GVW</Tally>
        <Tally on={tallies.prd} tone="amber">PRD</Tally>
        {dataLost && <Tally on tone="red">DATA</Tally>}
        {!narrow && !docked && (
          <span className="cr-grip" aria-hidden="true">
            ⠿
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-pressed={stage}
            onClick={() => onStage(!stage)}
            title="Play reveals full screen on this browser"
            className={`cr-switch ${stage ? 'is-on' : ''}`}
          >
            Stage
          </button>
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Panel options"
              onClick={() => setMenuOpen((o) => !o)}
              className="cr-icon"
            >
              <MoreHorizontal size={13} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="cr-menu"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setMenuOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={hideLiveBadge}
                  onClick={() => {
                    onHideLiveBadge(!hideLiveBadge);
                    setMenuOpen(false);
                  }}
                >
                  Hide LIVE badge
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onResetPosition();
                    setMenuOpen(false);
                  }}
                >
                  Reset position
                </button>
                <Link role="menuitem" to={adminHref}>
                  Open admin ↗
                </Link>
              </div>
            )}
          </div>
          {!narrow && (
            <button
              type="button"
              onClick={onDock}
              aria-label={docked ? 'Float the panel' : 'Dock to the right'}
              className="cr-icon"
            >
              {docked ? <PanelRightClose size={13} aria-hidden="true" /> : <PanelRight size={13} aria-hidden="true" />}
            </button>
          )}
          <button type="button" onClick={onMinimize} aria-label="Minimize" className="cr-icon">
            <Minus size={13} aria-hidden="true" />
          </button>
          <button type="button" onClick={onClose} aria-label="Close control room" className="cr-icon">
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div role="tablist" aria-label="Tools" className="cr-tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`cr-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="cr-body"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => onTab(id)}
            onKeyDown={onTabKey}
            className={`cr-tab ${tab === id ? 'is-active' : ''}`}
          >
            <span className={`cr-tab-led cr-led-${leds[id]}`} aria-hidden="true" />
            {label.toUpperCase()}
          </button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 9: `ControlRoom.js`**

```js
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { pickKey } from '../../utils/giveaway';
import { isOpenMode } from './storage';
import {
  DOCK_W,
  NAV_H,
  PANEL_W,
  clampRect,
  defaultRect,
  inDockZone,
  nearestCorner,
  originFor,
  pillAnchor,
  shouldUndock,
  snapToCorner,
} from './geometry';
import { MOTION, flipFrom, prefersReducedMotion } from './motion';
import { tabLeds, tallies } from './panelStatus';
import { useMediaQuery } from './useMediaQuery';
import PanelChrome from './PanelChrome';
import Pill from './Pill';
import WarningStrip from './WarningStrip';
import GiveawayTab from './GiveawayTab';
import PredictTab from './PredictTab';
import './controlRoom.css';

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];
const isTypingTarget = (el) => !!el && (TYPING_TAGS.includes(el.tagName) || el.isContentEditable);
const modalOpen = () => !!document.querySelector('[aria-modal="true"]');

function statusMessage(g) {
  if (!g) return '';
  if (g.status === 'open') return `Giveaway open: ${g.prize || ''}`;
  if (g.status === 'closed') return 'Giveaway entries closed';
  if (g.status === 'rolling') return `Winner picked: ${(g.winner && (g.winner.displayName || g.winner.twitchName)) || 'someone'}`;
  if (g.status === 'playing') return 'Bonus on stream';
  return '';
}

function useViewport() {
  const [view, setView] = useState(() => ({ vw: window.innerWidth, vh: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setView({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return view;
}

// The floating / docked control room. Positioned with left/top (never a
// resting transform) so SettleModal and friends can still be position: fixed.
export default function ControlRoom({ isLive = false }) {
  const cr = useControlRoom();
  const { panel, panelActions } = cr;
  const narrow = useMediaQuery('(max-width: 767px)');
  const view = useViewport();
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const flipRectRef = useRef(null);
  const prevMode = useRef(panel.mode);
  const [size, setSize] = useState({ w: PANEL_W, h: 420 });
  const [anim, setAnim] = useState(null); // 'on' | 'off' | null
  const [flipping, setFlipping] = useState(false);
  const [dragRect, setDragRect] = useState(null);
  const [ghost, setGhost] = useState(false);
  const open = isOpenMode(panel.mode);
  const docked = panel.mode === 'dock' && !narrow;
  const reduced = prefersReducedMotion();

  // Power on when opening from the pill/closed; FLIP between float and dock.
  useLayoutEffect(() => {
    const was = prevMode.current;
    prevMode.current = panel.mode;
    if (isOpenMode(panel.mode) && !isOpenMode(was)) {
      setAnim('on');
      const active = document.activeElement;
      if (!active || active === document.body || active.closest?.('[data-control-room-button]')) {
        document.getElementById(`cr-tab-${panel.tab}`)?.focus({ preventScroll: true });
      }
    } else if (isOpenMode(panel.mode) && isOpenMode(was) && was !== panel.mode) {
      flipFrom(rootRef.current, flipRectRef.current);
    }
    flipRectRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.mode]);

  useEffect(() => {
    if (anim !== 'on') return undefined;
    const t = setTimeout(() => setAnim(null), reduced ? MOTION.reducedFade : MOTION.powerOn);
    return () => clearTimeout(t);
  }, [anim, reduced]);

  // Measure for clamping and snapping (height is automatic).
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (w && h && (w !== size.w || h !== size.h)) setSize({ w, h });
  });

  const powerOffThen = useCallback(
    (action) => {
      if (!isOpenMode(panel.mode)) return action();
      setAnim('off');
      setTimeout(() => {
        setAnim(null);
        action();
        document.querySelector('[data-control-room-button]')?.focus?.({ preventScroll: true });
      }, reduced ? MOTION.reducedFade : MOTION.powerOff);
      return undefined;
    },
    [panel.mode, reduced]
  );
  const minimize = useCallback(() => powerOffThen(panelActions.minimize), [powerOffThen, panelActions]);
  const close = useCallback(() => powerOffThen(panelActions.close), [powerOffThen, panelActions]);

  const switchTab = useCallback(
    (tab) => {
      if (tab === panel.tab) return;
      if (reduced) {
        panelActions.setTab(tab);
        return;
      }
      setFlipping(true);
      setTimeout(() => panelActions.setTab(tab), MOTION.tabSwap);
      setTimeout(() => setFlipping(false), MOTION.tabFlip);
    },
    [panel.tab, panelActions, reduced]
  );

  // ` toggles, Escape minimizes (unless something inside wants Escape first).
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '`') {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        if (isOpenMode(panel.mode)) minimize();
        else panelActions.open();
        return;
      }
      if (e.key === 'Escape' && isOpenMode(panel.mode)) {
        if (cr.ducked || isTypingTarget(e.target) || modalOpen()) return;
        minimize();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel.mode, panelActions, minimize, cr.ducked]);

  // A new pick opens the panel on the Giveaway tab; if that opened it, it goes
  // back to where it was once the giveaway leaves rolling/playing.
  const pick = cr.giveaway && cr.giveaway.status === 'rolling' ? pickKey(cr.giveaway) : null;
  const lastPick = useRef(pick);
  const autoFrom = useRef(null);
  useEffect(() => {
    if (pick && pick !== lastPick.current) {
      if (!isOpenMode(panel.mode)) {
        if (autoFrom.current == null) autoFrom.current = panel.mode;
        panelActions.open();
      }
      panelActions.setTab('giveaway');
    }
    lastPick.current = pick;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);
  const settled = !cr.giveaway || cr.giveaway.status === 'open' || cr.giveaway.status === 'closed';
  useEffect(() => {
    if (!settled || autoFrom.current == null) return;
    const to = autoFrom.current;
    autoFrom.current = null;
    if (to === 'closed') panelActions.close();
    else panelActions.minimize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  // Docked: the page reflows into the remaining width.
  useEffect(() => {
    const root = document.documentElement;
    if (docked) {
      root.style.setProperty('--control-dock-w', `${DOCK_W}px`);
      document.body.classList.add('control-docked');
    } else {
      root.style.removeProperty('--control-dock-w');
      document.body.classList.remove('control-docked');
    }
  }, [docked]);
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty('--control-dock-w');
      document.body.classList.remove('control-docked');
    },
    []
  );

  const toggleDock = () => {
    flipRectRef.current = rootRef.current?.getBoundingClientRect() || null;
    if (panel.mode === 'dock') panelActions.undock();
    else panelActions.dock();
  };

  const dragHandlers = narrow
    ? {}
    : {
        onPointerDown: (e) => {
          if (e.button !== 0 || e.target.closest('button, a, input, select, textarea, [role="menu"]')) return;
          const el = rootRef.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          dragRef.current = {
            offX: e.clientX - r.left,
            offY: e.clientY - r.top,
            startX: e.clientX,
            fromDock: panel.mode === 'dock',
            size: { w: r.width || PANEL_W, h: r.height || size.h },
          };
          if (panel.mode !== 'dock') setDragRect({ x: r.left, y: r.top });
        },
        onPointerMove: (e) => {
          const d = dragRef.current;
          if (!d) return;
          if (d.fromDock) {
            if (!shouldUndock(d.startX, e.clientX)) return;
            d.fromDock = false;
            d.size = { w: PANEL_W, h: d.size.h };
            d.offX = Math.min(d.offX, PANEL_W - 24);
            const next = clampRect({ x: e.clientX - d.offX, y: e.clientY - d.offY }, d.size, view);
            setDragRect(next);
            panelActions.undock(next);
            return;
          }
          setDragRect(clampRect({ x: e.clientX - d.offX, y: e.clientY - d.offY }, d.size, view));
          setGhost(inDockZone(e.clientX, view.vw));
        },
        onPointerUp: (e) => {
          const d = dragRef.current;
          dragRef.current = null;
          setGhost(false);
          if (!d) return;
          if (d.fromDock) {
            setDragRect(null);
            return;
          }
          const at = clampRect({ x: e.clientX - d.offX, y: e.clientY - d.offY }, d.size, view);
          if (inDockZone(e.clientX, view.vw)) {
            flipRectRef.current = rootRef.current?.getBoundingClientRect() || null;
            panelActions.moveTo(at, nearestCorner(at, d.size, view));
            panelActions.dock();
          } else {
            const snapped = snapToCorner(at, d.size, view);
            panelActions.moveTo(snapped.rect, snapped.corner || nearestCorner(snapped.rect, d.size, view));
          }
          setDragRect(null);
        },
      };
  if (dragHandlers.onPointerUp) dragHandlers.onPointerCancel = dragHandlers.onPointerUp;

  const live = (
    <p className="sr-only" aria-live="polite">
      {statusMessage(cr.giveaway)}
    </p>
  );

  if (panel.mode === 'closed') return live;
  if (panel.mode === 'pill') {
    return (
      <>
        {live}
        <Pill
          giveaway={cr.giveaway}
          round={cr.activeRound}
          warnings={cr.warnings}
          dataLost={cr.dataLost}
          anchor={narrow ? { left: 16, bottom: 16 } : pillAnchor(panel.corner, panel.restoreTo)}
          onOpen={panelActions.open}
        />
      </>
    );
  }

  const rect = dragRect || clampRect(panel.rect || defaultRect(view.vw), size, view);
  let style;
  if (narrow) style = { left: 0, right: 0, bottom: 0, maxHeight: '75vh' };
  else if (docked) style = { top: NAV_H, right: 0, bottom: 0, width: DOCK_W };
  else style = { left: rect.x, top: rect.y, width: PANEL_W, maxHeight: '70vh' };
  style.transformOrigin = originFor(panel.corner, panel.restoreTo);

  const classes = [
    'cr-panel fixed z-[65] flex flex-col',
    narrow ? 'is-sheet' : docked ? 'is-docked' : '',
    anim === 'on' ? 'cr-power-on' : '',
    anim === 'off' ? 'cr-power-off' : '',
    dragRect && dragRef.current ? 'cr-lifted' : '',
    cr.ducked ? 'cr-ducked' : '',
  ].join(' ');

  return (
    <>
      {live}
      {ghost && (
        <div
          className="cr-dock-ghost fixed z-[64]"
          style={{ top: NAV_H, right: 0, bottom: 0, width: DOCK_W }}
          aria-hidden="true"
        />
      )}
      <section
        ref={rootRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="cr-title"
        className={classes}
        style={style}
      >
        <PanelChrome
          tallies={tallies({ isLive, giveaway: cr.giveaway, activeRound: cr.activeRound })}
          dataLost={cr.dataLost}
          leds={tabLeds({ giveaway: cr.giveaway, activeRound: cr.activeRound })}
          tab={panel.tab}
          onTab={switchTab}
          stage={cr.prefs.stage}
          onStage={cr.setStage}
          hideLiveBadge={cr.prefs.hideLiveBadge}
          onHideLiveBadge={cr.setHideLiveBadge}
          docked={docked}
          narrow={narrow}
          onDock={toggleDock}
          onMinimize={minimize}
          onClose={close}
          onResetPosition={panelActions.resetPosition}
          dragHandlers={dragHandlers}
        />
        <div
          id="cr-body"
          role="tabpanel"
          aria-labelledby={`cr-tab-${panel.tab}`}
          className={`cr-body ${flipping ? 'cr-flip' : ''}`}
        >
          <WarningStrip warnings={cr.warnings} onDismiss={cr.dismissWarning} className="mb-3" />
          {cr.dataLost && (
            <p className="mb-3 text-xs text-red-destructive font-mono">
              {cr.dataGaveUp ? 'Live data lost. Reload to reconnect.' : 'Live data lost. Reconnecting…'}
            </p>
          )}
          {panel.tab === 'predict' ? <PredictTab /> : <GiveawayTab scopeRef={rootRef} />}
          <div className="cr-static" aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 10: Mount the panel in `App.js`**

In `src/App.js`:
1. Add near the other lazy imports:

```js
// Staff-only control room; viewers never download it.
const ControlRoom = lazy(() => import('./components/controlRoom/ControlRoom'));
```

and add the regular imports `import CrashPill from './components/controlRoom/CrashPill';` and `import { panelAllowed } from './components/controlRoom/selectors';`.

2. In `StreamingSiteContent`, after `const cr = useControlRoom();`, add `const showPanel = !!cr?.enabled && panelAllowed(location.pathname);`, and right after the `<LiveIndicator … />` element add:

```jsx
      {showPanel && (
        <ErrorBoundary fallback={(reset) => <CrashPill onReopen={reset} />}>
          <Suspense fallback={null}>
            <ControlRoom isLive={isLive} />
          </Suspense>
        </ErrorBoundary>
      )}
```

- [ ] **Step 11: Run tests and lint**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="ControlRoom.test|ErrorBoundary"`
Expected: PASS.
Run: `npx eslint src/components/controlRoom src/components/ErrorBoundary.js src/App.js`
Expected: no output.

- [ ] **Step 12: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/components src/App.js && git commit -m "feat(control-room): floating, dockable panel with pill, hotkeys and CRT motion"
```

---

### Task 12: The Giveaway tab

**Files:**
- Modify: `src/components/admin/giveaways/api.js` (add `giveawayErrorText`)
- Modify: `src/components/admin/giveaways/NewGiveawayForm.js` (`inline` prop)
- Modify: `src/components/admin/giveaways/WinnerModal.js` (`inline`, `scopeRef`, `globalHotkeys` props)
- Modify: `src/components/admin/giveaways/PlayPanel.js` (`inline` prop)
- Create: `src/components/controlRoom/useGiveawayAction.js`
- Create: `src/components/controlRoom/giveawayFeeds.js`
- Replace: `src/components/controlRoom/GiveawayTab.js`
- Test: `src/components/controlRoom/__tests__/GiveawayTab.test.js`

**Interfaces:**
- Consumes: `useControlRoom()` (fields `giveaway`, `announce`, `ducked`, `pushWarning`), `postAction` (Task 1), the moved components (Task 2).
- Produces: `giveawayErrorText(code, status) → string`; `useGiveawayAction(id) → { busy: string|null, error: string|null, run(action, body?) → Promise<data|null> }`; `useRecentEntrants(giveawayId, enabled) → Entry[]` (5 newest); `useLatestGiveaway(enabled) → Giveaway|null`; `GiveawayTab({ scopeRef })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/controlRoom/__tests__/GiveawayTab.test.js`:

```js
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import GiveawayTab from '../GiveawayTab';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { postAction } from '../../admin/giveaways/api';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => parts.join('/'),
  query: (ref) => ref,
  orderBy: () => null,
  limit: () => null,
  onSnapshot: (_q, next) => {
    next({ empty: true, docs: [] });
    return () => {};
  },
}));
jest.mock('../../admin/giveaways/api', () => ({
  ...jest.requireActual('../../admin/giveaways/api'),
  postAction: jest.fn(),
}));
jest.mock('../../admin/giveaways/EventSubStatus', () => ({
  __esModule: true,
  default: () => null,
  useEventSubStatus: () => ({ status: 'enabled', subs: [], busy: false, error: null, subscribe: jest.fn(), remove: jest.fn() }),
  chatLabel: () => 'Connected to Twitch chat',
}));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const at = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const ANNOUNCE = { enabled: true, posted: false, posting: false, error: null, dueAt: null, retry: jest.fn() };

function show(giveaway, extra = {}) {
  useControlRoom.mockReturnValue({ giveaway, announce: ANNOUNCE, ducked: false, pushWarning: jest.fn(), ...extra });
  return render(<GiveawayTab scopeRef={{ current: null }} />);
}

const OPEN = {
  id: 'g1',
  status: 'open',
  prize: 'Steam key',
  keyword: 'goof',
  startedAt: at(Date.now() - 30_000),
  closesAt: at(Date.now() + 42_000),
  entryCount: 12,
  announceLastCall: true,
  lastCallMessage: 'last call',
  lastCallAt: null,
};

beforeEach(() => {
  postAction.mockReset();
  postAction.mockResolvedValue({ ok: true, status: 200, data: {} });
});

test('idle: nothing running, and New giveaway opens the form in the panel', () => {
  show(null);
  expect(screen.getByText('Nothing running.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /new giveaway/i }));
  expect(screen.getByRole('button', { name: /start giveaway/i })).toBeTruthy();
});

test('open: countdown, entries, and Close posts close', async () => {
  show(OPEN);
  expect(screen.getByText(/type goof/i)).toBeTruthy();
  expect(screen.getByText('0012')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' }));
});

// Review Focus 4: a giveaway without a timer.
test('open without a timer: no countdown and no progress bar', () => {
  const { container } = show({ ...OPEN, closesAt: null, announceLastCall: false });
  expect(screen.getByText(/no timer/i)).toBeTruthy();
  expect(container.querySelector('.cr-bar')).toBeNull();
  expect(screen.queryByRole('button', { name: /last call/i })).toBeNull();
});

test('Roll is disabled with nobody entered', () => {
  show({ ...OPEN, entryCount: 0 });
  expect(screen.getByRole('button', { name: /roll/i }).disabled).toBe(true);
});

test('closed: Roll posts roll; End asks first', async () => {
  show({ ...OPEN, status: 'closed' });
  fireEvent.click(screen.getByRole('button', { name: /end/i }));
  expect(postAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /end with no winner/i }));
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('end', { id: 'g1' }));
});

test('a lost roll race reads as plain text', async () => {
  postAction.mockResolvedValue({ ok: false, status: 409, data: { error: 'ROLL_RACE' } });
  show({ ...OPEN, status: 'closed' });
  fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));
  expect(await screen.findByText('Someone else rolled first.')).toBeTruthy();
});

test('rolling: the winner shows inline; hotkeys only count in the panel or on stage', async () => {
  const rolling = {
    ...OPEN,
    status: 'rolling',
    kind: 'item',
    targetWinners: 1,
    winners: [],
    winnerTwitchId: 'tw1',
    rolledAt: at(Date.now() - 60_000),
    winner: { twitchId: 'tw1', twitchName: 'slotgoblin', displayName: 'SlotGoblin', weight: 1, source: 'chat', registered: true },
  };
  const view = show(rolling);
  expect(screen.getAllByText('SlotGoblin').length).toBeGreaterThan(0);
  fireEvent.keyDown(window, { key: 'r' });
  await act(async () => {});
  expect(postAction).not.toHaveBeenCalled();
  useControlRoom.mockReturnValue({ giveaway: rolling, announce: ANNOUNCE, ducked: true, pushWarning: jest.fn() });
  view.rerender(<GiveawayTab scopeRef={{ current: null }} />);
  fireEvent.keyDown(window, { key: 'r' });
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('reroll', { id: 'g1' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(postAction).not.toHaveBeenCalledWith('back', expect.anything());
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=GiveawayTab`
Expected: FAIL. The first-version tab has no buttons.

- [ ] **Step 3: `giveawayErrorText` in `api.js`**

Append to `src/components/admin/giveaways/api.js`:

```js
const ERROR_TEXT = {
  NO_ENTRIES: 'Nobody left to draw.',
  NO_MORE_ENTRIES: 'Nobody left to draw.',
  ROLL_RACE: 'Someone else rolled first.',
  NOT_OPEN: 'Entries are already closed.',
  NOT_ROLLABLE: 'Not ready to roll yet.',
  NOT_FOUND: 'That giveaway is gone.',
  NOT_AUTHENTICATED: 'Signed out. Sign in again at /admin.',
};

export function giveawayErrorText(code, status) {
  if (status === 401 || status === 403) return ERROR_TEXT.NOT_AUTHENTICATED;
  return ERROR_TEXT[code] || `Action failed: ${code || status || 'unknown'}`;
}
```

- [ ] **Step 4: `inline` on `NewGiveawayForm`**

In `NewGiveawayForm.js`:
1. Signature: `export default function NewGiveawayForm({ seed, chat, onClose, onCreated, inline = false }) {`
2. Replace the `return ( <div className="fixed inset-0 …" …> <form …> … </form> </div> );` with a `formEl` constant plus two returns. The `<form>` keeps all of its children unchanged; only its opening tag changes:

```jsx
  const formEl = (
    <form
      onSubmit={submit}
      onKeyDown={
        inline
          ? (e) => {
              if (e.key === 'Escape') {
                e.preventDefault(); // the panel leaves Escape alone
                onClose();
              }
            }
          : undefined
      }
      className={
        inline
          ? 'w-full border border-white/10 bg-zinc-card'
          : 'w-full max-w-lg max-h-full overflow-y-auto border border-white/10 bg-zinc-card'
      }
    >
      {/* …the existing form children, unchanged… */}
    </form>
  );

  if (inline) return formEl;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        pressOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const endedOnBackdrop = e.target === e.currentTarget;
        const startedOnBackdrop = pressOnBackdrop.current;
        pressOnBackdrop.current = false;
        if (startedOnBackdrop && endedOnBackdrop) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      {formEl}
    </div>
  );
```

- [ ] **Step 5: `inline` on `WinnerModal`**

In `WinnerModal.js`:
1. Signature: `export default function WinnerModal({ giveaway, announce, inline = false, scopeRef = null, globalHotkeys = true }) {`
2. In the hotkey handler, directly after `const k = e.key.toLowerCase();`, insert:

```js
      if (inline) {
        // In the control room, Escape belongs to the panel (minimize), so it
        // can never discard a pick. Other keys count only while the operator
        // is in the panel, or while the stage moment plays.
        if (k === 'escape') return;
        const scope = scopeRef?.current;
        if (!globalHotkeys && !(scope && scope.contains(document.activeElement))) return;
      }
```

   and change that effect's deps to `[busy, confirmed, needMore, act, inline, globalHotkeys, scopeRef]`.
3. Split the render. Everything currently inside `<div ref={rootRef} role="dialog" …>` becomes `content`, with the glow and the header strip skipped when inline and the body padding tightened:

```jsx
  const content = (
    <>
      {!inline && (
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-orange-admin/15 blur-3xl motion-reduce:hidden"
          aria-hidden="true"
        />
      )}
      {!inline && (
        /* the existing "ON STREAM · title · prize" header strip, unchanged */
      )}
      <div className={inline ? 'relative' : 'relative px-6 sm:px-10 py-8'}>
        {/* the existing body (winner line, ClaimTimer, chat, prize note, actions, error), unchanged */}
      </div>
    </>
  );

  if (inline) {
    return (
      <div ref={rootRef} role="group" aria-label="Giveaway winner">
        {content}
      </div>
    );
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/85 backdrop-blur-md"
      onClick={(e) => {
        // Disallow click-outside-to-close so the admin doesn't accidentally
        // dismiss the winner mid-stream.
        e.stopPropagation();
      }}
    >
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Giveaway winner"
        className="relative w-full max-w-2xl max-h-full overflow-y-auto border border-orange-admin/40 bg-zinc-card"
      >
        {content}
      </div>
    </div>
  );
```

   (Move the JSX blocks; the comments above only mark where the unchanged blocks go.)
4. Change both `<Kbd>Esc</Kbd>` occurrences to `{!inline && <Kbd>Esc</Kbd>}`.

- [ ] **Step 6: `inline` on `PlayPanel`**

In `PlayPanel.js`:
1. Signature: `export default function PlayPanel({ giveaway, announce, inline = false }) {`
2. After the `useState` lines add `const isCollapsed = !inline && collapsed;` and use `isCollapsed` everywhere the render reads `collapsed` (the outer class, the backdrop click, `role`/`aria-modal`, the inner `max-w` class, and the collapsed/expanded body switch).
3. Wrap the header's collapse `<button>` in `{!inline && ( … )}`.
4. Before the existing `return (`, when inline, return only the card without the fixed wrapper:

```jsx
  if (inline) {
    return (
      <div role="group" aria-label="Now playing" className="border border-orange-admin/50 bg-zinc-card">
        {header}
        {body}
      </div>
    );
  }
```

   To do that, lift the existing header `<div className="flex items-center gap-2 px-4 py-2.5 border-b …">…</div>` into `const header = (…)`, and the `{isCollapsed ? (<p …>…</p>) : (<div className="px-4 py-4 space-y-4">…</div>)}` expression into `const body = isCollapsed ? (…) : (…)`. Use `{header}{body}` in the existing modal return too.

- [ ] **Step 7: `useGiveawayAction.js` and `giveawayFeeds.js`**

`src/components/controlRoom/useGiveawayAction.js`:

```js
import { useCallback, useState } from 'react';
import { giveawayErrorText, postAction } from '../admin/giveaways/api';

// One giveaway action at a time, with the error in plain words.
export function useGiveawayAction(id) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const run = useCallback(
    async (action, body = {}) => {
      setBusy(action);
      setError(null);
      try {
        const { ok, status, data } = await postAction(action, { id, ...body });
        if (!ok) {
          setError(giveawayErrorText(data?.error, status));
          return null;
        }
        return data;
      } catch (err) {
        setError(
          err && err.message === 'NOT_AUTHENTICATED'
            ? giveawayErrorText('NOT_AUTHENTICATED')
            : 'Network error, try again.'
        );
        return null;
      } finally {
        setBusy(null);
      }
    },
    [id]
  );
  return { busy, error, run };
}
```

`src/components/controlRoom/giveawayFeeds.js`:

```js
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The 5 newest entrants of one giveaway, only while the panel shows it open.
export function useRecentEntrants(giveawayId, enabled) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    setEntries([]);
    if (!enabled || !giveawayId) return undefined;
    const q = query(collection(db, 'giveaways', giveawayId, 'entries'), orderBy('enteredAt', 'desc'), fLimit(5));
    return onSnapshot(
      q,
      (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setEntries([])
    );
  }, [giveawayId, enabled]);
  return entries;
}

// The newest giveaway of any status, to seed "New giveaway" and "Run last
// again" from the idle view.
export function useLatestGiveaway(enabled) {
  const [latest, setLatest] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const q = query(collection(db, 'giveaways'), orderBy('createdAt', 'desc'), fLimit(1));
    return onSnapshot(
      q,
      (snap) => setLatest(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setLatest(null)
    );
  }, [enabled]);
  return latest;
}
```

- [ ] **Step 8: Replace `GiveawayTab.js`**

```js
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, Gift, Megaphone, Plus, RotateCcw } from 'lucide-react';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { useClock } from '../../hooks/useClock';
import { formFromGiveaway, formatClock, tsMillis } from '../../utils/giveaway';
import NewGiveawayForm from '../admin/giveaways/NewGiveawayForm';
import WinnerModal from '../admin/giveaways/WinnerModal';
import PlayPanel from '../admin/giveaways/PlayPanel';
import AnimatedCount from '../admin/giveaways/AnimatedCount';
import { useEventSubStatus } from '../admin/giveaways/EventSubStatus';
import { useGiveawayAction } from './useGiveawayAction';
import { useLatestGiveaway, useRecentEntrants } from './giveawayFeeds';

const HOT_SECONDS = 10;

function ChatDot({ chat }) {
  const on = chat.status === 'enabled';
  const label = chat.status === 'loading' ? 'Checking chat' : on ? 'Chat connected' : 'Chat not connected';
  const dot = on ? 'bg-emerald-signal' : chat.status === 'loading' ? 'bg-white/30' : 'bg-red-destructive';
  return (
    <span className="cr-lbl inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function Footer({ chat }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <ChatDot chat={chat} />
      <Link to="/admin/giveaways" className="cr-lbl hover:text-white-body">
        Open in admin ↗
      </Link>
    </div>
  );
}

function ActionError({ error }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
      {error}
    </p>
  );
}

function Countdown({ giveaway }) {
  const closesAt = tsMillis(giveaway.closesAt);
  const startedAt = tsMillis(giveaway.startedAt) ?? tsMillis(giveaway.createdAt);
  const now = useClock({ intervalMs: 500, active: closesAt != null });
  if (closesAt == null) {
    return (
      <div>
        <p className="cr-lbl">No timer · type {giveaway.keyword}</p>
        <p className="cr-timecode">OPEN</p>
      </div>
    );
  }
  const left = Math.max(0, (closesAt - now) / 1000);
  const total = startedAt != null ? Math.max(1, (closesAt - startedAt) / 1000) : null;
  const pct = total ? Math.min(100, Math.max(0, 100 - (left / total) * 100)) : null;
  return (
    <div className="min-w-0 flex-1">
      <p className="cr-lbl">closes in · type {giveaway.keyword}</p>
      <p className={`cr-timecode ${left > 0 && left <= HOT_SECONDS ? 'is-hot' : ''}`} aria-live="off">
        {formatClock(left)}
      </p>
      {pct != null && (
        <div className="cr-bar">
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function Entries({ giveaway }) {
  return (
    <div className="text-right">
      <p className="cr-lbl">entered</p>
      <p className="cr-big text-orange-admin">
        <AnimatedCount value={giveaway.entryCount ?? 0} />
      </p>
    </div>
  );
}

function OpenView({ giveaway, chat }) {
  const { busy, error, run } = useGiveawayAction(giveaway.id);
  const entrants = useRecentEntrants(giveaway.id, true);
  const canLastCall =
    !!giveaway.announceLastCall && !!giveaway.lastCallMessage && !giveaway.lastCallAt && !!giveaway.closesAt;
  const nobody = (giveaway.entryCount ?? 0) === 0;
  return (
    <div>
      <p className="font-bold text-white-body truncate mb-3">{giveaway.prize}</p>
      <div className="flex items-end justify-between gap-3">
        <Countdown giveaway={giveaway} />
        <Entries giveaway={giveaway} />
      </div>
      <div className="flex gap-1.5 mt-3">
        {canLastCall && (
          <button type="button" className="cr-btn" disabled={!!busy} onClick={() => run('lastCall')}>
            <Megaphone size={12} aria-hidden="true" />
            {busy === 'lastCall' ? 'Posting…' : 'Last call'}
          </button>
        )}
        <button type="button" className="cr-btn" disabled={!!busy} onClick={() => run('close')}>
          {busy === 'close' ? 'Closing…' : 'Close'}
        </button>
        <button type="button" className="cr-btn is-go" disabled={!!busy || nobody} onClick={() => run('roll')}>
          <Gift size={12} aria-hidden="true" />
          {busy === 'roll' ? 'Rolling…' : 'Roll'}
        </button>
      </div>
      <ActionError error={error} />
      {entrants.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Newest entries">
          {entrants.map((e) => (
            <li key={e.id} className="flex justify-between gap-2 text-[0.6875rem] font-mono text-white/55">
              <span className="text-white-body truncate">{e.displayName || e.twitchName}</span>
              <span>{(e.weight || 1) > 1 ? `${e.weight} tickets` : '1 ticket'}</span>
            </li>
          ))}
        </ul>
      )}
      <Footer chat={chat} />
    </div>
  );
}

function ClosedView({ giveaway, chat }) {
  const { busy, error, run } = useGiveawayAction(giveaway.id);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const winners = (giveaway.winners || []).length;
  return (
    <div>
      <p className="font-bold text-white-body truncate mb-3">{giveaway.prize}</p>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="cr-lbl">entries closed</p>
          <p className="cr-timecode">CLOSED</p>
        </div>
        <Entries giveaway={giveaway} />
      </div>
      <div className="flex gap-1.5 mt-3">
        {confirmEnd ? (
          <>
            <button type="button" className="cr-btn" onClick={() => setConfirmEnd(false)}>
              Cancel
            </button>
            <button type="button" className="cr-btn is-go" disabled={!!busy} onClick={() => run('end')}>
              {winners > 0 ? `End · ${winners} winner${winners === 1 ? '' : 's'}` : 'End with no winner'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="cr-btn" disabled={!!busy} onClick={() => setConfirmEnd(true)}>
              <Flag size={12} aria-hidden="true" />
              End
            </button>
            <button
              type="button"
              className="cr-btn is-go"
              disabled={!!busy || (giveaway.entryCount ?? 0) === 0}
              onClick={() => run('roll')}
            >
              <Gift size={12} aria-hidden="true" />
              {busy === 'roll' ? 'Rolling…' : 'Roll'}
            </button>
          </>
        )}
      </div>
      <ActionError error={error} />
      <Footer chat={chat} />
    </div>
  );
}

function IdleView({ latest, onStart, chat }) {
  return (
    <div>
      <p className="cr-lbl">giveaway</p>
      <p className="cr-timecode is-quiet">IDLE</p>
      <p className="text-sm text-white/55 mt-2">Nothing running.</p>
      <div className="flex gap-1.5 mt-3">
        <button type="button" className="cr-btn is-go" onClick={() => onStart(formFromGiveaway(latest))}>
          <Plus size={12} aria-hidden="true" />
          New giveaway
        </button>
        {latest && (
          <button
            type="button"
            className="cr-btn"
            onClick={() => onStart(formFromGiveaway(latest, { copyPrize: true }))}
          >
            <RotateCcw size={12} aria-hidden="true" />
            Run last again
          </button>
        )}
      </div>
      <Footer chat={chat} />
    </div>
  );
}

// One compact view per giveaway status. The winner and play steps reuse the
// admin components inline, so both surfaces behave the same.
export default function GiveawayTab({ scopeRef = null }) {
  const cr = useControlRoom();
  const g = cr.giveaway;
  const chat = useEventSubStatus();
  const [seed, setSeed] = useState(null);
  const latest = useLatestGiveaway(!g);

  if (seed) {
    return (
      <NewGiveawayForm
        inline
        seed={seed}
        chat={chat}
        onClose={() => setSeed(null)}
        onCreated={(_id, meta) => {
          setSeed(null);
          if (meta?.announceError) {
            cr.pushWarning(`Giveaway started, but chat announce failed: ${meta.announceError}`);
          }
        }}
      />
    );
  }
  if (!g) return <IdleView latest={latest} onStart={setSeed} chat={chat} />;
  if (g.status === 'rolling' && g.winner) {
    return (
      <>
        <WinnerModal
          inline
          key={g.id}
          giveaway={g}
          announce={cr.announce}
          scopeRef={scopeRef}
          globalHotkeys={cr.ducked}
        />
        <Footer chat={chat} />
      </>
    );
  }
  if (g.status === 'playing' && g.playing) {
    return (
      <>
        <PlayPanel inline key={`${g.id}:${g.playing.twitchId}`} giveaway={g} announce={cr.announce} />
        <Footer chat={chat} />
      </>
    );
  }
  if (g.status === 'closed') return <ClosedView giveaway={g} chat={chat} />;
  return <OpenView giveaway={g} chat={chat} />;
}
```

- [ ] **Step 9: Run tests and lint**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="GiveawayTab|WinnerModal|AdminGiveawaysPage.test"`
Expected: PASS (the admin page's modal and play panel are unchanged when `inline` is false).
Run: `npx eslint src/components/controlRoom src/components/admin/giveaways`
Expected: no output.

- [ ] **Step 10: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/components && git commit -m "feat(control-room): run a whole giveaway from the panel"
```

---

### Task 13: The Predict tab

**Files:**
- Replace: `src/components/controlRoom/PredictTab.js`
- Test: `src/components/controlRoom/__tests__/PredictTab.test.js`

**Interfaces:**
- Consumes: `useControlRoom()` (`activeRound`, `latestRound`, `rounds`, `results`), `RoundControl({ round, readOnly, results, onDeleted })`, `NewRoundModal({ onClose, onCreated, lastRound })`, `statusTone`, `lastRewardsRound`.
- Produces: `PredictTab()`.

- [ ] **Step 1: Write the failing test**

Create `src/components/controlRoom/__tests__/PredictTab.test.js`:

```js
import { render, screen, fireEvent } from '@testing-library/react';
import PredictTab from '../PredictTab';
import { useControlRoom } from '../../../contexts/ControlRoomContext';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../config/firebase', () => ({ db: {} }));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));
jest.mock('../../admin/predictions/NewRoundModal', () => () =>
  require('react').createElement('p', null, 'new round form')
);

const RESULTS = { dueAt: null, posted: false, posting: false, error: null, retry: jest.fn() };
const OPEN = {
  id: 'r2',
  title: 'Friday hunt',
  status: 'open',
  source: 'manual',
  manualTotalCost: 500,
  acceptPredictions: true,
  rewards: { tiers: [{ place: 1, tickets: 100, prize: null }] },
  announce: true,
  announced: { opened: null, locked: null, results: null },
  entryCount: 212,
};

function show(cr) {
  useControlRoom.mockReturnValue({ activeRound: null, latestRound: null, rounds: [], results: RESULTS, ...cr });
  return render(<PredictTab />);
}

test('no round: says so and offers New round', () => {
  show({});
  expect(screen.getByText('No round running.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /new round/i }));
  expect(screen.getByText('new round form')).toBeTruthy();
});

test('an open round: summary, the lifecycle controls, no New round', () => {
  show({ activeRound: OPEN, latestRound: OPEN, rounds: [OPEN] });
  expect(screen.getByText('Friday hunt')).toBeTruthy();
  expect(screen.getByText('212')).toBeTruthy();
  expect(screen.getByRole('button', { name: /lock entries/i })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /new round/i })).toBeNull();
});

test('a settled latest round lists its winners and offers New round', () => {
  const settled = {
    ...OPEN,
    status: 'settled',
    actual: { payout: 1000 },
    winners: [{ place: 1, twitchId: 'a', displayName: 'viewerA', payoutGuess: 990, diff: 10, prize: null }],
  };
  show({ latestRound: settled, rounds: [settled] });
  expect(screen.getByRole('list', { name: 'Winners' }).textContent).toMatch(/viewerA/);
  expect(screen.getByRole('button', { name: /new round/i })).toBeTruthy();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=PredictTab`
Expected: FAIL. The first-version tab has no New round button.

- [ ] **Step 3: Replace `PredictTab.js`**

```js
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trophy } from 'lucide-react';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import RoundControl from '../admin/predictions/RoundControl';
import NewRoundModal from '../admin/predictions/NewRoundModal';
import { statusTone } from '../admin/predictions/shared';
import { lastRewardsRound } from '../../utils/predictionRewards';

function Summary({ round }) {
  const bonuses = round.bonusHuntSnapshot?.bonusCount;
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0 flex-1">
        <span
          className={`inline-block px-1.5 py-0.5 border text-[0.5625rem] font-bold tracking-eyebrow-md uppercase font-mono ${statusTone(round.status)}`}
        >
          {round.status}
        </span>
        <p className="mt-1.5 font-bold text-white-body truncate">{round.title}</p>
      </div>
      <div className="text-right">
        <p className="cr-lbl">guesses</p>
        <p className="cr-timecode">{round.entryCount ?? 0}</p>
      </div>
      {bonuses != null && (
        <div className="text-right">
          <p className="cr-lbl">bonuses</p>
          <p className="cr-big">{bonuses}</p>
        </div>
      )}
    </div>
  );
}

function Winners({ round }) {
  const winners = (round.winners || []).slice(0, 3);
  if (winners.length === 0) return <p className="cr-lbl mt-3">No winners. No eligible entries.</p>;
  return (
    <ol className="mt-3 space-y-1" aria-label="Winners">
      {winners.map((w) => (
        <li key={`${w.place}-${w.twitchId}`} className="flex items-center gap-2 text-sm">
          <Trophy size={11} className="text-orange-admin" aria-hidden="true" />
          <span className="font-mono text-white/45">#{w.place}</span>
          <span className="text-white-body truncate">{w.displayName || w.twitchName}</span>
        </li>
      ))}
    </ol>
  );
}

// The active round (or the newest one) with the same lifecycle controls as
// /admin/hunts. Settling opens SettleModal over the page.
export default function PredictTab() {
  const cr = useControlRoom();
  const [creating, setCreating] = useState(false);
  const round = cr.activeRound || cr.latestRound;
  const isLatest = !!round && round.id === cr.latestRound?.id;

  return (
    <div>
      {round ? (
        <>
          <Summary round={round} />
          <RoundControl key={round.id} round={round} results={isLatest ? cr.results : null} onDeleted={() => {}} />
          {round.status === 'settled' && <Winners round={round} />}
        </>
      ) : (
        <>
          <p className="cr-lbl">prediction</p>
          <p className="cr-timecode is-quiet">IDLE</p>
          <p className="text-sm text-white/55 mt-2">No round running.</p>
        </>
      )}
      {!cr.activeRound && (
        <button type="button" className="cr-btn is-go mt-3 w-full" onClick={() => setCreating(true)}>
          <Plus size={12} aria-hidden="true" />
          New round
        </button>
      )}
      <div className="mt-4 flex justify-end">
        <Link to="/admin/hunts" className="cr-lbl hover:text-white-body">
          Open in admin ↗
        </Link>
      </div>
      {creating && (
        <NewRoundModal
          lastRound={lastRewardsRound(cr.rounds)}
          onClose={() => setCreating(false)}
          onCreated={() => setCreating(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests and lint**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=PredictTab`
Expected: PASS.
Run: `npx eslint src/components/controlRoom/PredictTab.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/components/controlRoom && git commit -m "feat(control-room): run prediction rounds from the panel"
```

---

### Task 14: The stage moment

**Files:**
- Create: `src/components/controlRoom/stageTriggers.js`
- Create: `src/components/controlRoom/StageMoment.js`
- Modify: `src/App.js`
- Test: `src/components/controlRoom/__tests__/stageTriggers.test.js`
- Test: `src/components/controlRoom/__tests__/StageMoment.test.js`

**Interfaces:**
- Consumes: `useControlRoom()` (`giveaway`, `latestRound`, `setDucked`), `useGiveawayFeed`, `RevealStage` (Task 3), `CrtStyles`, `PredictionWinnersReveal`, `MOTION`/`prefersReducedMotion` (Task 11).
- Produces: `STAGE_FRESH_MS = 10000`, `RESULTS_HOLD_MS = 8000`, `giveawayMoment(giveaway, lastKey, now) → { kind: 'giveaway', key, endsAt } | null`, `resultsMoment(round, lastId, now) → { kind: 'results', key, endsAt } | null`; `StageMoment()`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/controlRoom/__tests__/stageTriggers.test.js`:

```js
import { RESULTS_HOLD_MS, giveawayMoment, resultsMoment } from '../stageTriggers';
import { LOCK_HOLD_MS, REVEAL_MS } from '../../../utils/giveaway';

const NOW = 1_700_000_000_000;
const at = (ms) => ({ toMillis: () => ms });
const rolling = (rolledAt, id = 'tw1') => ({
  status: 'rolling',
  winnerTwitchId: id,
  rolledAt: at(rolledAt),
  winner: { twitchId: id },
});

test('a fresh pick stages until the winner has been held', () => {
  expect(giveawayMoment(rolling(NOW - 2_000), null, NOW)).toEqual({
    kind: 'giveaway',
    key: `tw1:${NOW - 2_000}`,
    endsAt: NOW - 2_000 + REVEAL_MS + LOCK_HOLD_MS,
  });
});

test('a pick older than 10s never replays (reload, or Stage turned on late)', () => {
  expect(giveawayMoment(rolling(NOW - 10_000), null, NOW)).toBeNull();
});

test('the same pick stages once; a reroll is a new pick', () => {
  const g = rolling(NOW - 1_000);
  expect(giveawayMoment(g, `tw1:${NOW - 1_000}`, NOW)).toBeNull();
  expect(giveawayMoment(rolling(NOW - 500, 'tw2'), `tw1:${NOW - 1_000}`, NOW).key).toBe(`tw2:${NOW - 500}`);
});

test('only rolling giveaways with a winner stage', () => {
  expect(giveawayMoment({ ...rolling(NOW), status: 'open' }, null, NOW)).toBeNull();
  expect(giveawayMoment({ ...rolling(NOW), winner: null }, null, NOW)).toBeNull();
  expect(giveawayMoment(null, null, NOW)).toBeNull();
});

test('a fresh settle stages once, for 8s', () => {
  const round = { id: 'r1', status: 'settled', settledAt: at(NOW - 1_000) };
  expect(resultsMoment(round, null, NOW)).toEqual({ kind: 'results', key: 'r1', endsAt: NOW + RESULTS_HOLD_MS });
  expect(resultsMoment(round, 'r1', NOW)).toBeNull();
  expect(resultsMoment({ ...round, settledAt: at(NOW - 11_000) }, null, NOW)).toBeNull();
  expect(resultsMoment({ ...round, status: 'locked' }, null, NOW)).toBeNull();
});
```

Create `src/components/controlRoom/__tests__/StageMoment.test.js`:

```js
import { render, screen, fireEvent, act } from '@testing-library/react';
import StageMoment from '../StageMoment';
import { useControlRoom } from '../../../contexts/ControlRoomContext';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../hooks/useGiveawayFeed', () => ({
  useGiveawayFeed: () => ({ giveaway: null, entries: [], firstMessage: null }),
}));
jest.mock('../../giveaway/RevealStage', () => () => require('react').createElement('p', null, 'reveal stage'));
jest.mock('../../PredictionWinnersReveal', () => () => require('react').createElement('p', null, 'winners reveal'));

const at = (ms) => ({ toMillis: () => ms });
let setDucked;

function show({ giveaway = null, latestRound = null } = {}) {
  setDucked = jest.fn();
  useControlRoom.mockReturnValue({ giveaway, latestRound, setDucked });
  return render(<StageMoment />);
}

const pick = (agoMs) => ({
  id: 'g1',
  status: 'rolling',
  winnerTwitchId: 'tw1',
  rolledAt: at(Date.now() - agoMs),
  winner: { twitchId: 'tw1', displayName: 'SlotGoblin' },
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a fresh pick takes the stage and ducks the panel', () => {
  show({ giveaway: pick(500) });
  expect(screen.getByText('reveal stage')).toBeTruthy();
  expect(setDucked).toHaveBeenLastCalledWith(true);
});

test('a stale pick does nothing', () => {
  show({ giveaway: pick(60_000) });
  expect(screen.queryByText('reveal stage')).toBeNull();
});

test('a fresh settle shows the results card', () => {
  show({ latestRound: { id: 'r1', title: 'Friday hunt', status: 'settled', settledAt: at(Date.now() - 500) } });
  expect(screen.getByText('Prediction results')).toBeTruthy();
  expect(screen.getByText('Friday hunt')).toBeTruthy();
  expect(screen.getByText('winners reveal')).toBeTruthy();
});

test('Escape ends it early and un-ducks the panel', () => {
  show({ giveaway: pick(500) });
  fireEvent.keyDown(window, { key: 'Escape' });
  act(() => {
    jest.advanceTimersByTime(400);
  });
  expect(screen.queryByText('reveal stage')).toBeNull();
  expect(setDucked).toHaveBeenLastCalledWith(false);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="stageTriggers|StageMoment"`
Expected: FAIL with missing-module errors.

- [ ] **Step 3: Implement `stageTriggers.js`**

```js
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
  return { kind: 'giveaway', key, endsAt: at + REVEAL_MS + LOCK_HOLD_MS };
}

// A settle that just happened. The results chat line already posts at
// settledAt + STREAM_DELAY_MS, so playing now lines up with the delayed video.
export function resultsMoment(round, lastId, now) {
  if (!round || round.status !== 'settled' || round.id === lastId) return null;
  const at = tsMillis(round.settledAt);
  if (at == null || now - at >= STAGE_FRESH_MS) return null;
  return { kind: 'results', key: round.id, endsAt: now + RESULTS_HOLD_MS };
}
```

- [ ] **Step 4: Implement `StageMoment.js`**

```js
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { useGiveawayFeed } from '../../hooks/useGiveawayFeed';
import { useClock } from '../../hooks/useClock';
import { pickKey } from '../../utils/giveaway';
import { CrtStyles } from '../giveaway/RevealScreen';
import RevealStage from '../giveaway/RevealStage';
import PredictionWinnersReveal from '../PredictionWinnersReveal';
import { giveawayMoment, resultsMoment } from './stageTriggers';
import { MOTION, prefersReducedMotion } from './motion';
import './controlRoom.css';

function stillOnStage(moment, giveaway) {
  if (!moment || moment.kind !== 'giveaway') return true;
  return !!giveaway && pickKey(giveaway) === moment.key && ['rolling', 'playing'].includes(giveaway.status);
}

// Full-screen reveal over the page on the streaming browser (Stage on): the
// same reveal the OBS overlay shows for a pick, and a title card plus the
// winners for a settle. Ducks the panel while it plays.
export default function StageMoment() {
  const cr = useControlRoom();
  const giveaway = cr.giveaway;
  const round = cr.latestRound;
  const feed = useGiveawayFeed({ enabled: true });
  const sameGiveaway = !!giveaway && feed.giveaway?.id === giveaway.id;
  const [moment, setMoment] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const staged = useRef({ pick: null, round: null });
  const now = useClock({ intervalMs: 250, active: !!moment && !leaving });
  const { setDucked } = cr;

  useEffect(() => {
    const m = giveawayMoment(giveaway, staged.current.pick, Date.now());
    if (!m) return;
    staged.current.pick = m.key;
    setLeaving(false);
    setMoment(m);
  }, [giveaway]);

  useEffect(() => {
    const m = resultsMoment(round, staged.current.round, Date.now());
    if (!m) return;
    staged.current.round = m.key;
    setLeaving(false);
    setMoment(m);
  }, [round]);

  const over = !!moment && (now >= moment.endsAt || !stillOnStage(moment, giveaway));
  useEffect(() => {
    if (over && !leaving) setLeaving(true);
  }, [over, leaving]);

  useEffect(() => {
    if (!leaving) return undefined;
    const t = setTimeout(() => {
      setMoment(null);
      setLeaving(false);
    }, prefersReducedMotion() ? MOTION.reducedFade : MOTION.powerOff);
    return () => clearTimeout(t);
  }, [leaving]);

  useEffect(() => {
    setDucked(!!moment);
  }, [moment, setDucked]);
  useEffect(() => () => setDucked(false), [setDucked]);

  useEffect(() => {
    if (!moment) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLeaving(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moment]);

  if (!moment) return null;

  let body = null;
  if (moment.kind === 'giveaway' && giveaway) {
    const name = giveaway.winner?.displayName || giveaway.winner?.twitchName;
    body = (
      <>
        <CrtStyles />
        <div aria-hidden="true">
          <RevealStage
            giveaway={giveaway}
            entries={sameGiveaway ? feed.entries : []}
            firstMessage={sameGiveaway ? feed.firstMessage : null}
          />
        </div>
        <p className="sr-only" aria-live="polite">
          Giveaway winner: {name}
        </p>
      </>
    );
  } else if (moment.kind === 'results' && round) {
    body = (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-6 px-8 overflow-y-auto"
        style={{ background: 'radial-gradient(ellipse at center, rgba(9,9,11,0.7) 0%, rgba(9,9,11,0.94) 75%)' }}
      >
        <p className="font-mono font-bold uppercase tracking-eyebrow-lg text-sm text-orange-admin">Prediction results</p>
        <h2 className="font-display text-white-body text-center leading-none" style={{ fontSize: 'clamp(3rem, 7vw, 6rem)' }}>
          {round.title}
        </h2>
        <div className="w-full max-w-4xl">
          <PredictionWinnersReveal round={round} />
        </div>
      </div>
    );
  }

  return createPortal(
    <div className={`cr-stage ${leaving ? 'cr-stage-out' : ''}`} onClick={() => setLeaving(true)} role="presentation">
      {body}
    </div>,
    document.body
  );
}
```

- [ ] **Step 5: Mount it in `App.js`**

Add `const StageMoment = lazy(() => import('./components/controlRoom/StageMoment'));` next to the `ControlRoom` lazy import, and after the panel block:

```jsx
      {showPanel && cr.prefs.stage && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <StageMoment />
          </Suspense>
        </ErrorBoundary>
      )}
```

- [ ] **Step 6: Run tests and lint**

Run: `CI=true npm test -- --watchAll=false --testPathPattern="stageTriggers|StageMoment"`
Expected: PASS.
Run: `npx eslint src/components/controlRoom src/App.js`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add src/components/controlRoom src/App.js && git commit -m "feat(control-room): full-screen stage moment for picks and results"
```

---

### Task 15: Docs, full verification and the manual pass

**Files:**
- Modify: `CLAUDE.md` (Gotchas)

- [ ] **Step 1: Document the control room**

In `CLAUDE.md` under `## Gotchas`, add after the Giveaways bullet:

```markdown
- Control room: staff get a floating, dockable panel on public pages (`src/components/controlRoom/`, lazy, mounted in `App.js`; hidden on `/admin/*` and the OBS routes) with Giveaway and Predict tabs, a pill when minimized, backtick to toggle, and a per-browser **Stage** switch that plays a full-screen reveal (`StageMoment`, reusing the overlay's `RevealStage`). `ControlRoomProvider` (`src/contexts/ControlRoomContext.js`) runs on every route except OBS sources: two narrow listeners (live giveaways ≤5, newest hunts 3) and the timer engine (`useGiveawayClock`, `useWinnerAnnounce`, `useResultsAnnounce` with `{ armed }`). Only the tab holding the Web Lock `goofer-control-driver` fires timers (`src/hooks/useDriverLock.js`; the visible tab steals it). `/admin/giveaways` and `/admin/hunts` read the engine from the provider and only run their own without one (tests). `close` and `roll` are transactional (`roll` can answer `409 ROLL_RACE`), so two browsers driving is safe. The panel must never carry a resting `transform`/`filter` (fixed modals like `SettleModal` render inside it). Panel state and prefs live in `localStorage['goofer:control-room']`.
```

- [ ] **Step 2: Run the whole suite**

Run: `CI=true npm test -- --watchAll=false`
Expected: every suite passes. If one fails, fix it before going on (do not skip or delete tests).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: `Compiled successfully.` with no ESLint warnings. The build output lists separate chunks for `ControlRoom` and `StageMoment`.

- [ ] **Step 4: Commit the docs**

```bash
[ "$(git branch --show-current)" = "feat/control-room" ] && git add CLAUDE.md && git commit -m "docs(control-room): gotchas entry for the panel and shared engine"
```

- [ ] **Step 5: Manual pass (owner account on `npm start`)**

Check each item and note the result in the PR description:

1. Home as owner: the nav shows **Control room**, and backtick toggles the panel (and doesn't while typing in any input).
2. Float, then drag: the panel lifts, clamps at the edges and snaps to corners. Drag it to the right edge: the dashed outline appears, it docks, and the page reflows (and the LIVE badge moves left). Drag it off the edge: it floats again. The dock button does the same.
3. Minimize (Escape, or the button): CRT power-off, then a pill in that corner shows `GVW 00:42 · N IN` counting down. Click it and the panel powers on from that corner.
4. The Stage switch and Hide LIVE badge survive a reload. Reset position works.
5. A full giveaway from the panel: new giveaway (inline form, Escape closes only the form), last call, auto-close and auto-roll at zero with the panel minimized (it pops open on the pick), confirm with Enter, bonus play (slot, payout), end. The chat lines land once.
6. Two tabs: close one, and the other keeps the timers (last call fires once). Switch between them: the visible one drives.
7. Owner plus a mod browser at the same time: a timed giveaway closes and auto-rolls exactly once.
8. Stage on, captured in OBS: a roll plays the full-screen reveal in step with the overlay and the chat line; a settle plays the results card; Escape or a click ends it early; the panel ducks during it.
9. Predictions from the panel: open a round (NewRoundModal over the page), lock, settle (SettleModal opens full-screen and isn't trapped in the panel), results post.
10. `prefers-reduced-motion` on (OS setting): everything fades, with no static bursts or pulses.
11. A phone-width window: the panel is a bottom sheet with no drag or dock.
12. `/admin/giveaways`: no panel, the Control room nav button goes to `/admin/giveaways`, and warnings show at the top of the page (not bottom-right).
13. A viewer (signed out, or a Twitch viewer): no button, no panel, and the Network tab shows no control-room chunk and no extra Firestore listeners.

- [ ] **Step 6: Push and open the PR**

Follow the repo's branch flow: push `feat/control-room` and open a PR with `gh pr create`. The PR body summarizes the feature, lists the manual-pass results, and carries **no Claude attribution** (user's global rule overrides any tooling default).
