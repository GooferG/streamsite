# Control Room Redeem Tab, Resizable Panel and Payout Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff work the pending redemption queue from the floating control room, resize the panel and the dock, and bonus-buy payouts and prediction ticket wins stop leaving stale data behind.

**Architecture:** A third `useLiveQuery` in `ControlRoomProvider` feeds a new Redeem tab plus quiet signals (tally, tab LED, pill chip), with per-browser seen tracking in the existing `goofer:control-room` store. Resizing is pure geometry in `geometry.js`, a `ResizeHandles` component that previews during a pointer gesture and commits on release, and two new store fields (`size`, `dockW`). Two small server fixes: the giveaway `payout` action fulfils a pending redemption, and Twitch login backfills missing starter fields on a user doc.

**Tech Stack:** React 19 (CRA 5, Jest 27 + Testing Library), Firebase Web SDK (Firestore `onSnapshot`), Vercel serverless functions with `firebase-admin`, Tailwind plus `controlRoom.css`.

**Spec:** `docs/superpowers/specs/2026-10-03-control-room-redeem-resize-design.md`

## Global Constraints

- Branch `feat/control-room-redeem`. The checkout is shared with other sessions, so every commit runs as `[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add … && git commit …`.
- Commit messages: short imperative conventional subjects, and **no `Co-Authored-By` or any Claude trailer** (user's global instruction).
- Run tests one-shot from the repo root: `CI=true npx react-scripts test --watchAll=false --testPathPattern="<pattern>"`.
- CRA's Jest preset resets mocks before each test, so re-arm `jest.fn` implementations in `beforeEach` or in the test.
- Vercel builds with `CI=true`, which turns ESLint warnings into build errors: no unused imports or variables.
- `.cr-panel` never carries a resting `transform` or `filter` (fixed modals inside it must escape). Resizing never adds `cr-lifted`.
- Limits: `MIN_W` 320, `MAX_W` 720, `MIN_H` 240, `DOCK_MIN` 320, `DOCK_MAX` 720, `PAGE_MIN` 480, keyboard steps 16px (64px with Shift), auto height cap 70vh, refund confirm window 4s, queue cap 50.
- Do not change `api/admin/redemptions.js`, `api/store/redeem.js`, `api/admin/hunts.js`, `firestore.rules` or `firestore.indexes.json`.
- UI copy is sentence case with no em dashes. Use the exact strings from the spec: `Fulfill`, `Fulfilling…`, `Refund`, `Confirm refund · {n}s`, `Already handled by someone else.`, `This one's gone.`, `Didn't go through. Try again.`, `Nothing waiting.`, `Nothing in {filter}.`, `Showing newest 50 · rest in admin`, `Open in admin ↗`, `Reset position and size`, `Resize panel`, `Resize dock`.
- One deliberate deviation from the spec: `showsCost` takes the redemption and returns `cost > 0`, not a kind check. Store orders always cost tickets and prizes cost 0, so real data is unchanged, and an old doc with no kind shows no stray `0t`.

## Review Focus

1. **A double click on Fulfill (or on Confirm refund) during a busy stream.** Expected: exactly one request. Pinned in Task 7.
2. **The pointer leaves mid-resize** (released outside the window, alt-tab, capture lost). Expected: nothing committed, the size snaps back, the resize cursor class leaves `body`. Pinned in Task 9.
3. **A size or dock width saved on a bigger monitor, opened on a smaller one.** Expected: both clamp to this window, and the page padding uses the clamped dock width rather than the saved one. Pinned in Tasks 4 and 9.
4. **Another mod handles a row while this browser's request for it is in flight.** Expected: the row leaves when the snapshot drops it, and the late `NOT_PENDING` error doesn't resurface anywhere. Pinned in Task 7.
5. **Old or partial redemption docs** (no `kind`, no names, no avatar, no `cost`). Expected: the row still renders with `ITEM`, the user id, and no price. Pinned in Tasks 3 and 7.

---

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `api/_lib/giveawayPayout.js` | new | Pure: what a logged payout writes onto a redemption |
| `api/admin/giveaways.js` | modify | `payout` writes the redemption through a small transaction |
| `api/_lib/userDoc.js` | new | Pure: starter fields a user doc is missing |
| `api/twitch-auth.js` | modify | Login creates or backfills starter fields from the helper |
| `src/components/controlRoom/redemptions.js` | new | Pure queue rules: groups, filters, order, seen, labels, errors |
| `src/components/controlRoom/geometry.js` | modify | Size limits, clamps, `resizeFrom`, `gripSide` |
| `src/components/controlRoom/storage.js` | modify | `size`, `dockW`, `redeemSeenAt`, `redeemFilter`, `redeem` tab |
| `src/components/controlRoom/useLiveQuery.js` | modify | `ready` flag on the first good snapshot |
| `src/contexts/ControlRoomContext.js` | modify | Redemptions feed, seen baseline, redeem summary, new actions |
| `src/components/controlRoom/useRedemptionAction.js` | new | POST fulfil/cancel with per-row busy and error |
| `src/components/controlRoom/RedeemTab.js` | new | The queue view |
| `src/components/controlRoom/panelStatus.js` | modify | `red` tally, `redeem` LED, `pillCounter` |
| `src/components/controlRoom/PanelChrome.js` | modify | Third tab, RED tally, admin link, menu label |
| `src/components/controlRoom/Pill.js` | modify | Counter chip |
| `src/components/controlRoom/ResizeHandles.js` | new | Pointer and keyboard resize handles |
| `src/components/controlRoom/ControlRoom.js` | modify | Renders the Redeem tab, sizes, resize preview, handles |
| `src/components/controlRoom/controlRoom.css` | modify | Chips, rows, pill counter, handles, grip |
| `CLAUDE.md` | modify | Control room, Giveaways and user-doc gotchas |

---

### Task 1: Logging a giveaway payout fulfils the redemption

**Files:**
- Create: `api/_lib/giveawayPayout.js`
- Modify: `api/admin/giveaways.js` (imports at the top; the `payout` action's redemption block, currently lines 624–640)
- Test: `src/__tests__/giveawayPayout.test.js` (new), `src/__tests__/adminGiveawaysApi.test.js` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `payoutRedemptionUpdate(redemption, { itemName, payout, buyAmount, slotName, actor, now }) → object` (the Firestore update for `redemptions/{id}`).

- [ ] **Step 1: Write the failing helper test**

Create `src/__tests__/giveawayPayout.test.js`:

```js
import { payoutRedemptionUpdate } from '../../api/_lib/giveawayPayout';

const NOW = { __op: 'serverTimestamp' };
const FIELDS = {
  itemName: '$100 bonus buy · Gates · paid $450',
  payout: 450,
  buyAmount: 100,
  slotName: 'Gates',
  actor: 'owner@test',
  now: NOW,
};
const PAYOUT_ONLY = {
  itemName: '$100 bonus buy · Gates · paid $450',
  payout: 450,
  buyAmount: 100,
  slotName: 'Gates',
};

test('a pending redemption is fulfilled by the payout', () => {
  expect(payoutRedemptionUpdate({ status: 'pending' }, FIELDS)).toEqual({
    ...PAYOUT_ONLY,
    status: 'fulfilled',
    fulfilledAt: NOW,
    fulfilledBy: 'owner@test',
  });
});

test('fulfilled and cancelled redemptions keep their status and take only the numbers', () => {
  expect(payoutRedemptionUpdate({ status: 'fulfilled' }, FIELDS)).toEqual(PAYOUT_ONLY);
  expect(payoutRedemptionUpdate({ status: 'cancelled' }, FIELDS)).toEqual(PAYOUT_ONLY);
});

test('a missing slot or buy amount is stored as null', () => {
  const update = payoutRedemptionUpdate({ status: 'fulfilled' }, { ...FIELDS, slotName: '', buyAmount: undefined });
  expect(update.slotName).toBeNull();
  expect(update.buyAmount).toBeNull();
});
```

- [ ] **Step 2: Write the failing API tests**

Append to `src/__tests__/adminGiveawaysApi.test.js` (it already has `seedGiveaway`, `call`, `__fake` and `beforeEach(() => __fake.reset())`; the fake clock starts at `1000000`):

```js
function seedPlaying(redemption) {
  seedGiveaway('g1', {
    status: 'playing',
    kind: 'bonus',
    prize: '$100 bonus buy',
    title: 'Sunday',
    buyAmount: 100,
    announcePayout: false,
    winners: [{ twitchId: 'tw1', displayName: 'TW1', redemptionId: 'red1', buyAmount: 100, slotName: 'Gates' }],
    playing: { twitchId: 'tw1' },
  });
  if (redemption) {
    __fake.seed('redemptions/red1', { kind: 'giveaway', cost: 0, itemName: '$100 bonus buy', ...redemption });
  }
}

test('logging a payout fulfils the pending redemption with the real win', async () => {
  seedPlaying({ status: 'pending' });
  const res = await call({ action: 'payout', id: 'g1', amount: 450 });
  expect(res.statusCode).toBe(200);
  const r = __fake.read('redemptions/red1');
  expect(r).toMatchObject({
    status: 'fulfilled',
    fulfilledBy: 'owner@test',
    payout: 450,
    itemName: '$100 bonus buy · Gates · paid $450',
  });
  expect(r.fulfilledAt.toMillis()).toBe(1000000);
});

test('a payout correction updates the amount without re-fulfilling', async () => {
  seedPlaying({ status: 'fulfilled', fulfilledBy: 'mod:bean', fulfilledAt: 'earlier' });
  await call({ action: 'payout', id: 'g1', amount: 500 });
  expect(__fake.read('redemptions/red1')).toMatchObject({
    status: 'fulfilled',
    fulfilledBy: 'mod:bean',
    fulfilledAt: 'earlier',
    payout: 500,
  });
});

test('a cancelled redemption stays cancelled when a payout is logged', async () => {
  seedPlaying({ status: 'cancelled' });
  await call({ action: 'payout', id: 'g1', amount: 450 });
  const r = __fake.read('redemptions/red1');
  expect(r.status).toBe('cancelled');
  expect(r.payout).toBe(450);
  expect(r.fulfilledAt).toBeUndefined();
});

test('a missing redemption is left alone', async () => {
  seedPlaying(null);
  const res = await call({ action: 'payout', id: 'g1', amount: 450 });
  expect(res.statusCode).toBe(200);
  expect(__fake.read('redemptions/red1')).toBeUndefined();
});

test('a failed redemption write never fails the payout', async () => {
  seedPlaying({ status: 'pending' });
  const real = __fake.db.runTransaction;
  const tx = jest
    .spyOn(__fake.db, 'runTransaction')
    .mockImplementationOnce(real)
    .mockImplementationOnce(() => Promise.reject(new Error('quota')));
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const res = await call({ action: 'payout', id: 'g1', amount: 450 });
    expect(res.statusCode).toBe(200);
    expect(__fake.read('giveaways/g1').winners[0].payout).toBe(450);
    expect(__fake.read('redemptions/red1').status).toBe('pending');
    expect(error).toHaveBeenCalledWith('redemption payout update failed', expect.any(Error));
  } finally {
    tx.mockRestore();
    error.mockRestore();
  }
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="giveawayPayout|adminGiveawaysApi"`
Expected: FAIL. `giveawayPayout.test.js` fails with "Cannot find module '../../api/_lib/giveawayPayout'". In `adminGiveawaysApi.test.js`, "logging a payout fulfils…" fails (status stays `pending`) and "a failed redemption write…" fails (`console.error` never called).

- [ ] **Step 4: Write the helper**

Create `api/_lib/giveawayPayout.js`:

```js
// What logging a giveaway payout writes onto the winner's redemption. Pure
// (no firebase-admin) so it can be unit tested; the caller passes the server
// timestamp in as `now`. Bonus wins are paid on the spot, so the first payout
// on a pending redemption fulfils it. A fulfilled or cancelled redemption
// keeps its status: logging a correction only updates the numbers.
export function payoutRedemptionUpdate(redemption, { itemName, payout, buyAmount, slotName, actor, now }) {
  const update = {
    itemName,
    payout,
    buyAmount: buyAmount ?? null,
    slotName: slotName || null,
  };
  if (redemption && redemption.status === 'pending') {
    update.status = 'fulfilled';
    update.fulfilledAt = now;
    update.fulfilledBy = actor || null;
  }
  return update;
}
```

- [ ] **Step 5: Use it in the `payout` action**

In `api/admin/giveaways.js`, add to the imports at the top:

```js
import { payoutRedemptionUpdate } from '../_lib/giveawayPayout.js';
```

Replace the block that starts `// The redemption is what gets paid out, so it carries the real number.` and ends with `.catch((err) => console.error('redemption payout update failed', err));\n      }` with:

```js
      // The redemption is what gets paid out, so it carries the real number.
      // Bonus wins are paid on the spot, so the first payout also fulfils a
      // pending redemption. Best effort: a failure never fails the payout.
      if (winner.redemptionId) {
        const parts = [g.prize];
        if (winner.slotName) parts.push(winner.slotName);
        parts.push(`paid ${formatMoney(amount)}`);
        const redemptionRef = adminDb.collection('redemptions').doc(winner.redemptionId);
        await adminDb
          .runTransaction(async (tx) => {
            const snap = await tx.get(redemptionRef);
            if (!snap.exists) return;
            tx.update(
              redemptionRef,
              payoutRedemptionUpdate(snap.data(), {
                itemName: parts.join(' · '),
                payout: amount,
                buyAmount: buy,
                slotName: winner.slotName,
                actor: admin.email,
                now: FieldValue.serverTimestamp(),
              })
            );
          })
          .catch((err) => console.error('redemption payout update failed', err));
      }
```

(`admin` is the actor from `requireAdmin` at the top of the handler. `FieldValue` and `formatMoney` are already in scope.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="giveawayPayout|adminGiveawaysApi"`
Expected: PASS, all tests in both files.

- [ ] **Step 7: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add api/_lib/giveawayPayout.js api/admin/giveaways.js src/__tests__/giveawayPayout.test.js src/__tests__/adminGiveawaysApi.test.js && git commit -m "fix(giveaways): logging a payout fulfils the pending redemption"
```

---

### Task 2: Twitch login fills in missing starter fields

**Files:**
- Create: `api/_lib/userDoc.js`
- Modify: `api/twitch-auth.js` (imports; the upsert block, currently lines 44–70)
- Test: `src/__tests__/userDoc.test.js` (new), `src/__tests__/twitchAuthApi.test.js` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `missingStarterFields(data, twitchId, now) → object` (the starter fields `data` lacks, with their defaults).

- [ ] **Step 1: Write the failing helper test**

Create `src/__tests__/userDoc.test.js`:

```js
import { missingStarterFields } from '../../api/_lib/userDoc';

const NOW = { __op: 'serverTimestamp' };

test('a new user gets every starter field', () => {
  expect(missingStarterFields({}, 'tw1', NOW)).toEqual({
    twitchId: 'tw1',
    tickets: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastDailyClaimAt: null,
    watchMinutes: 0,
    createdAt: NOW,
  });
  expect(missingStarterFields(undefined, 'tw1', NOW)).toEqual(missingStarterFields({}, 'tw1', NOW));
});

test('a doc a prediction settle made keeps its tickets and gets the rest', () => {
  const settleMade = { tickets: 150, totalEarned: 150, updatedAt: 'then' };
  expect(missingStarterFields(settleMade, 'tw1', NOW)).toEqual({
    twitchId: 'tw1',
    totalSpent: 0,
    lastDailyClaimAt: null,
    watchMinutes: 0,
    createdAt: NOW,
  });
});

test('a full doc gets nothing, and a null field counts as present', () => {
  const full = {
    twitchId: 'tw1',
    tickets: 5,
    totalEarned: 9,
    totalSpent: 4,
    lastDailyClaimAt: null,
    watchMinutes: 30,
    createdAt: 'then',
  };
  expect(missingStarterFields(full, 'tw1', NOW)).toEqual({});
});
```

- [ ] **Step 2: Write the failing handler test**

Create `src/__tests__/twitchAuthApi.test.js`:

```js
/**
 * @jest-environment node
 */
import handler from '../../api/twitch-auth';
import { __fake } from '../../api/_lib/firebaseAdmin.js';

jest.mock('../../api/_lib/firebaseAdmin.js', () => {
  const { createFakeFirestore } = require('../test/fakeFirestore');
  const fake = createFakeFirestore();
  return {
    adminDb: fake.db,
    FieldValue: fake.FieldValue,
    adminAuth: { createCustomToken: async () => 'firebase-token' },
    __fake: fake,
  };
});
jest.mock('../../api/_lib/watchtimeStore.js', () => ({ claimWatchBank: async () => null }));

const TWITCH_USER = { id: 'tw1', login: 'viewer', display_name: 'Viewer', profile_image_url: 'https://img/v.png' };

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

async function login() {
  const res = mockRes();
  await handler({ method: 'POST', body: { code: 'c', redirect_uri: 'http://localhost/twitch-callback' } }, res);
  return res;
}

beforeEach(() => {
  __fake.reset();
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [TWITCH_USER] }) });
});

test('first login creates the full starter doc', async () => {
  const res = await login();
  expect(res.statusCode).toBe(200);
  const user = __fake.read('users/tw1');
  expect(user).toMatchObject({
    twitchId: 'tw1',
    twitchName: 'viewer',
    displayName: 'Viewer',
    profileImageUrl: 'https://img/v.png',
    tickets: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastDailyClaimAt: null,
    watchMinutes: 0,
  });
  expect(user.createdAt.toMillis()).toBe(1000000);
});

test('a doc a prediction settle made first gets its missing fields and keeps its tickets', async () => {
  __fake.seed('users/tw1', { tickets: 150, totalEarned: 150, updatedAt: 'then' });
  await login();
  const user = __fake.read('users/tw1');
  expect(user).toMatchObject({
    twitchId: 'tw1',
    twitchName: 'viewer',
    tickets: 150,
    totalEarned: 150,
    totalSpent: 0,
    lastDailyClaimAt: null,
    watchMinutes: 0,
  });
  expect(user.createdAt.toMillis()).toBe(1000000);
});

test('a returning user keeps every field and gets a fresh profile', async () => {
  __fake.seed('users/tw1', {
    twitchId: 'tw1',
    twitchName: 'old',
    displayName: 'Old',
    tickets: 9,
    totalEarned: 20,
    totalSpent: 11,
    lastDailyClaimAt: 'yesterday',
    watchMinutes: 300,
    createdAt: 'long ago',
  });
  await login();
  expect(__fake.read('users/tw1')).toMatchObject({
    twitchName: 'viewer',
    displayName: 'Viewer',
    tickets: 9,
    totalSpent: 11,
    lastDailyClaimAt: 'yesterday',
    watchMinutes: 300,
    createdAt: 'long ago',
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="userDoc|twitchAuthApi"`
Expected: FAIL. `userDoc.test.js` can't find `../../api/_lib/userDoc`. In `twitchAuthApi.test.js`, "a doc a prediction settle made first…" fails because `twitchId`, `totalSpent`, `watchMinutes` and `createdAt` are missing. The other two pass already; they guard against regressions.

- [ ] **Step 4: Write the helper**

Create `api/_lib/userDoc.js`:

```js
// The fields every users/{twitchId} doc starts with. Pure (no firebase-admin)
// so it can be unit tested; `now` is the server timestamp sentinel.
//
// A user doc can exist before its owner ever logs in: a prediction settle
// credits winners' tickets with set+merge. Login fills in whatever is missing
// and never overwrites a field that's already there.
export function missingStarterFields(data, twitchId, now) {
  const starter = {
    twitchId,
    tickets: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastDailyClaimAt: null,
    watchMinutes: 0,
    createdAt: now,
  };
  const have = data || {};
  return Object.fromEntries(Object.entries(starter).filter(([key]) => !(key in have)));
}
```

- [ ] **Step 5: Use it in login**

In `api/twitch-auth.js`, add the import after the existing two:

```js
import { missingStarterFields } from './_lib/userDoc.js';
```

Replace the block from `// Upsert users/{twitchId} — initialize ticket fields only on first login.` through the closing `}` of the `else` branch with:

```js
  // Upsert users/{twitchId}. Profile fields refresh on every login. Starter
  // fields are written once: on first login, or later for a doc made
  // elsewhere first (a prediction settle credits tickets with set+merge).
  const userRef = adminDb.collection('users').doc(twitchUser.id);
  const existing = await userRef.get();
  const profile = {
    twitchName: twitchUser.login,
    displayName: twitchUser.display_name,
    profileImageUrl: twitchUser.profile_image_url || null,
    updatedAt: FieldValue.serverTimestamp(),
  };
  const starter = missingStarterFields(
    existing.exists ? existing.data() : {},
    twitchUser.id,
    FieldValue.serverTimestamp()
  );
  if (!existing.exists) {
    await userRef.set({ ...starter, ...profile });
  } else {
    await userRef.update({ ...starter, ...profile });
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="userDoc|twitchAuthApi"`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add api/_lib/userDoc.js api/twitch-auth.js src/__tests__/userDoc.test.js src/__tests__/twitchAuthApi.test.js && git commit -m "fix(auth): login fills in starter fields a settle-made user doc lacks"
```

---

### Task 3: Redemption queue rules

**Files:**
- Create: `src/components/controlRoom/redemptions.js`
- Test: `src/components/controlRoom/__tests__/redemptions.test.js`

**Interfaces:**
- Consumes: `tsMillis(ts) → number | null` from `src/utils/giveaway.js`.
- Produces:
  - `QUEUE_CAP = 50`, `FILTERS = ['all', 'stream', 'payouts']`, `FILTER_LABELS = { all: 'All', stream: 'Stream', payouts: 'Payouts' }`
  - `kindGroup(kind) → 'stream' | 'payouts' | 'other'`, `kindLabel(kind) → string`
  - `showsCost(redemption) → boolean`, `whoRedeemed(redemption) → string`
  - `filterQueue(list, filter) → list`, `filterCounts(list) → { all, stream, payouts }`
  - `queueOrder(list) → list` (oldest first; input is newest first)
  - `newestAt(list) → number | null`, `unseenCount(list, seenAt) → number`
  - `ageLabel(ts, now) → string`, `redemptionErrorText(code) → string`

- [ ] **Step 1: Write the failing test**

Create `src/components/controlRoom/__tests__/redemptions.test.js`:

```js
import {
  FILTERS,
  ageLabel,
  filterCounts,
  filterQueue,
  kindGroup,
  kindLabel,
  newestAt,
  queueOrder,
  redemptionErrorText,
  showsCost,
  unseenCount,
  whoRedeemed,
} from '../redemptions';

const at = (ms) => ({ toMillis: () => ms });
// Newest first, as the provider's feed delivers it.
const FEED = [
  { id: 'c', kind: 'giveaway', createdAt: at(3000) },
  { id: 'b', kind: 'stream', createdAt: at(2000) },
  { id: 'a', kind: 'prediction', createdAt: at(1000) },
];

test('kinds group into stream and payouts; anything else only shows under All', () => {
  expect(['stream', 'giveaway', 'prediction', 'virtual', undefined].map(kindGroup)).toEqual([
    'stream',
    'payouts',
    'payouts',
    'other',
    'other',
  ]);
  expect(kindLabel('prediction')).toBe('PREDICTION');
  expect(kindLabel(undefined)).toBe('ITEM');
});

test('filters and their counts', () => {
  const list = [...FEED, { id: 'x', kind: 'virtual', createdAt: at(500) }];
  expect(FILTERS).toEqual(['all', 'stream', 'payouts']);
  expect(filterQueue(list, 'all')).toHaveLength(4);
  expect(filterQueue(list, 'stream').map((r) => r.id)).toEqual(['b']);
  expect(filterQueue(list, 'payouts').map((r) => r.id)).toEqual(['c', 'a']);
  expect(filterCounts(list)).toEqual({ all: 4, stream: 1, payouts: 2 });
  expect(filterCounts(undefined)).toEqual({ all: 0, stream: 0, payouts: 0 });
});

test('the queue reads oldest first and leaves the feed alone', () => {
  expect(queueOrder(FEED).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  expect(FEED.map((r) => r.id)).toEqual(['c', 'b', 'a']);
});

test('newest and unseen go by createdAt', () => {
  const withMissing = [...FEED, { id: 'z', kind: 'stream' }];
  expect(newestAt(withMissing)).toBe(3000);
  expect(newestAt([])).toBeNull();
  expect(unseenCount(withMissing, 1500)).toBe(2);
  expect(unseenCount(withMissing, 3000)).toBe(0);
  expect(unseenCount(withMissing, null)).toBe(0);
});

test('age labels at each boundary', () => {
  const NOW = 10 * 86_400_000;
  const ago = (ms) => ageLabel(at(NOW - ms), NOW);
  expect(ago(59_000)).toBe('just now');
  expect(ago(60_000)).toBe('1m ago');
  expect(ago(59 * 60_000)).toBe('59m ago');
  expect(ago(60 * 60_000)).toBe('1h ago');
  expect(ago(23 * 3_600_000)).toBe('23h ago');
  expect(ago(24 * 3_600_000)).toBe('1d ago');
  expect(ago(-5_000)).toBe('just now');
  expect(ageLabel(null, NOW)).toBe('');
});

// Review Focus 5: old docs miss fields the panel reads.
test('price, name and error fallbacks', () => {
  expect(showsCost({ cost: 420 })).toBe(true);
  expect(showsCost({ cost: 0 })).toBe(false);
  expect(showsCost({})).toBe(false);
  expect(whoRedeemed({ displayName: 'Cee', twitchName: 'cee' })).toBe('Cee');
  expect(whoRedeemed({ twitchName: 'cee' })).toBe('cee');
  expect(whoRedeemed({ userId: 'u1' })).toBe('u1');
  expect(whoRedeemed({})).toBe('someone');
  expect(redemptionErrorText('NOT_PENDING')).toBe('Already handled by someone else.');
  expect(redemptionErrorText('NOT_FOUND')).toBe("This one's gone.");
  expect(redemptionErrorText('INTERNAL')).toBe("Didn't go through. Try again.");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="controlRoom/__tests__/redemptions"`
Expected: FAIL with "Cannot find module '../redemptions'".

- [ ] **Step 3: Write the module**

Create `src/components/controlRoom/redemptions.js`:

```js
import { tsMillis } from '../../utils/giveaway';

// The Redeem tab's pure rules. The provider's feed is pending redemptions,
// newest first, capped at QUEUE_CAP.
export const QUEUE_CAP = 50;
export const FILTERS = ['all', 'stream', 'payouts'];
export const FILTER_LABELS = { all: 'All', stream: 'Stream', payouts: 'Payouts' };
const PAYOUT_KINDS = ['giveaway', 'prediction'];

// Store orders played on stream, prizes owed from giveaways and predictions,
// or anything else (old docs, future kinds), which only shows under All.
export function kindGroup(kind) {
  if (kind === 'stream') return 'stream';
  return PAYOUT_KINDS.includes(kind) ? 'payouts' : 'other';
}

export const kindLabel = (kind) => String(kind || 'item').toUpperCase();

// Store orders cost tickets; prizes cost nothing, so they show no price.
export const showsCost = (r) => Number(r && r.cost) > 0;

export const whoRedeemed = (r) => r.displayName || r.twitchName || r.userId || 'someone';

export function filterQueue(list, filter) {
  if (filter !== 'stream' && filter !== 'payouts') return list || [];
  return (list || []).filter((r) => kindGroup(r.kind) === filter);
}

export function filterCounts(list) {
  const counts = { all: 0, stream: 0, payouts: 0 };
  for (const r of list || []) {
    counts.all += 1;
    const group = kindGroup(r.kind);
    if (group !== 'other') counts[group] += 1;
  }
  return counts;
}

// The feed is newest first; the queue reads oldest first, like a to-do list.
export const queueOrder = (list) => [...(list || [])].reverse();

const createdMs = (r) => tsMillis(r && r.createdAt);

export function newestAt(list) {
  let newest = null;
  for (const r of list || []) {
    const ms = createdMs(r);
    if (ms != null && (newest == null || ms > newest)) newest = ms;
  }
  return newest;
}

// Pending redemptions newer than this browser's mark. Before the first
// baseline nothing is unseen, and a doc without a createdAt counts as seen.
export function unseenCount(list, seenAt) {
  if (seenAt == null) return 0;
  return (list || []).filter((r) => {
    const ms = createdMs(r);
    return ms != null && ms > seenAt;
  }).length;
}

export function ageLabel(ts, now) {
  const ms = tsMillis(ts);
  if (ms == null) return '';
  const minutes = Math.floor(Math.max(0, now - ms) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function redemptionErrorText(code) {
  if (code === 'NOT_PENDING') return 'Already handled by someone else.';
  if (code === 'NOT_FOUND') return "This one's gone.";
  return "Didn't go through. Try again.";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="controlRoom/__tests__/redemptions"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add src/components/controlRoom/redemptions.js src/components/controlRoom/__tests__/redemptions.test.js && git commit -m "feat(control-room): redemption queue rules"
```

---

### Task 4: Resize geometry

**Files:**
- Modify: `src/components/controlRoom/geometry.js`
- Test: `src/components/controlRoom/__tests__/geometry.test.js` (append, and extend the import)

**Interfaces:**
- Consumes: the existing `PANEL_W`, `DOCK_W`, `NAV_H`, `EDGE` in the same file.
- Produces:
  - constants `MIN_W` 320, `MAX_W` 720, `MIN_H` 240, `DOCK_MIN` 320, `DOCK_MAX` 720, `PAGE_MIN` 480, `RESIZE_STEP` 16, `RESIZE_STEP_BIG` 64
  - `clampSize(size | null, view) → { w, h | null }`
  - `clampDockW(w | null, vw) → number`
  - `defaultRect(vw, w = PANEL_W) → { x, y }`
  - `resizeFrom(edge, start, dx, dy, view) → { rect: { x, y }, size: { w, h | null } }`. `edge` is one of `'l' | 'r' | 'b' | 'bl' | 'br'`. `start` is `{ x, y, w, h, fixedH }`: `h` is the height on screen, `fixedH` is the stored height (`null` = auto).
  - `gripSide(rect, w, vw) → 'bl' | 'br'`

- [ ] **Step 1: Write the failing tests**

In `src/components/controlRoom/__tests__/geometry.test.js`, replace the import block with:

```js
import {
  DOCK_W,
  MIN_H,
  clampDockW,
  clampRect,
  clampSize,
  defaultRect,
  gripSide,
  inDockZone,
  nearestCorner,
  originFor,
  pillAnchor,
  resizeFrom,
  shouldUndock,
  snapToCorner,
} from '../geometry';
```

Append:

```js
test('the default float position follows the width', () => {
  expect(defaultRect(1440, 500)).toEqual({ x: 924, y: 73 });
});

// Review Focus 3: a size saved on a bigger monitor fits this one.
test('clampSize keeps width and height inside the limits and the window', () => {
  expect(clampSize(null, view)).toEqual({ w: 380, h: null });
  expect(clampSize({ w: 2000, h: 5000 }, view)).toEqual({ w: 720, h: 647 });
  expect(clampSize({ w: 100, h: 10 }, view)).toEqual({ w: 320, h: 240 });
  expect(clampSize({ w: 700, h: null }, { vw: 600, vh: 720 })).toEqual({ w: 568, h: null });
});

test('clampDockW always leaves the page at least 480px', () => {
  expect(clampDockW(null, 1280)).toBe(DOCK_W);
  expect(clampDockW(900, 1280)).toBe(720);
  expect(clampDockW(900, 1000)).toBe(520);
  expect(clampDockW(100, 1280)).toBe(320);
  expect(clampDockW(500, 700)).toBe(320);
});

const START = { x: 884, y: 73, w: 380, h: 400, fixedH: null }; // snapped top-right

test('left handles pin the right edge', () => {
  expect(resizeFrom('l', START, -100, 0, view)).toEqual({ rect: { x: 784, y: 73 }, size: { w: 480, h: null } });
  expect(resizeFrom('l', START, -1000, 0, view)).toEqual({ rect: { x: 544, y: 73 }, size: { w: 720, h: null } });
  expect(resizeFrom('l', START, 500, 0, view)).toEqual({ rect: { x: 944, y: 73 }, size: { w: 320, h: null } });
  expect(resizeFrom('bl', START, -20, 30, view)).toEqual({ rect: { x: 864, y: 73 }, size: { w: 400, h: 430 } });
});

test('right handles stop at the screen edge', () => {
  const left = { ...START, x: 16 };
  expect(resizeFrom('r', left, 100, 0, view)).toEqual({ rect: { x: 16, y: 73 }, size: { w: 480, h: null } });
  expect(resizeFrom('r', { ...START, x: 900, w: 360 }, 200, 0, view).size.w).toBe(380);
  expect(resizeFrom('br', left, 40, 40, view)).toEqual({ rect: { x: 16, y: 73 }, size: { w: 420, h: 440 } });
});

test('the bottom handle sets a height within the limits', () => {
  expect(resizeFrom('b', START, 0, 100, view).size).toEqual({ w: 380, h: 500 });
  expect(resizeFrom('b', START, 0, 5000, view).size.h).toBe(647);
  expect(resizeFrom('b', START, 0, -1000, view).size.h).toBe(MIN_H);
});

test('a width-only resize keeps a height that was already set', () => {
  expect(resizeFrom('l', { ...START, fixedH: 500 }, -20, 0, view).size).toEqual({ w: 400, h: 500 });
});

test('the grip sits in the bottom corner facing the screen centre', () => {
  expect(gripSide({ x: 884, y: 73 }, 380, 1280)).toBe('bl');
  expect(gripSide({ x: 16, y: 73 }, 380, 1280)).toBe('br');
});
```

(`view` in this file is `{ vw: 1280, vh: 720 }`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="controlRoom/__tests__/geometry"`
Expected: FAIL. `clampSize`, `clampDockW`, `resizeFrom` and `gripSide` are not functions, and `defaultRect(1440, 500)` returns `{ x: 1044, y: 73 }`.

- [ ] **Step 3: Implement**

In `src/components/controlRoom/geometry.js`, after the existing constants (after `LIVE_BADGE_CLEARANCE`), add:

```js
// Hand resizing (floating panel and dock width).
export const MIN_W = 320;
export const MAX_W = 720;
export const MIN_H = 240;
export const DOCK_MIN = 320;
export const DOCK_MAX = 720;
export const PAGE_MIN = 480; // page width the dock always leaves
export const RESIZE_STEP = 16;
export const RESIZE_STEP_BIG = 64;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const maxPanelW = (vw) => Math.max(MIN_W, Math.min(MAX_W, vw - 2 * EDGE));
const maxPanelH = (vh) => Math.max(MIN_H, vh - NAV_H - EDGE);

// The floating size for this window. No stored size means the default width
// and auto height (h: null).
export function clampSize(size, view) {
  const w = clamp(size && Number.isFinite(size.w) ? size.w : PANEL_W, MIN_W, maxPanelW(view.vw));
  const h = size && Number.isFinite(size.h) ? clamp(size.h, MIN_H, maxPanelH(view.vh)) : null;
  return { w, h };
}

export function clampDockW(w, vw) {
  const max = Math.max(DOCK_MIN, Math.min(DOCK_MAX, vw - PAGE_MIN));
  return clamp(Number.isFinite(w) ? w : DOCK_W, DOCK_MIN, max);
}

const LEFT_EDGES = ['l', 'bl'];
const RIGHT_EDGES = ['r', 'br'];
const BOTTOM_EDGES = ['b', 'bl', 'br'];

// One resize from a handle. Left-side handles move x so the right edge stays
// put; widths stay inside the limits and on screen. A bottom handle sets a
// height; other handles keep the stored one (fixedH, null = auto).
export function resizeFrom(edge, start, dx, dy, view) {
  let { x, w } = start;
  let h = start.fixedH;
  if (LEFT_EDGES.includes(edge)) {
    const right = start.x + start.w;
    w = clamp(start.w - dx, MIN_W, Math.max(MIN_W, Math.min(maxPanelW(view.vw), right)));
    x = right - w;
  } else if (RIGHT_EDGES.includes(edge)) {
    w = clamp(start.w + dx, MIN_W, Math.max(MIN_W, Math.min(maxPanelW(view.vw), view.vw - start.x)));
  }
  if (BOTTOM_EDGES.includes(edge)) {
    h = clamp(start.h + dy, MIN_H, Math.max(MIN_H, Math.min(maxPanelH(view.vh), view.vh - start.y)));
  }
  return { rect: { x, y: start.y }, size: { w, h } };
}

// The visible grip sits in the bottom corner that faces the screen centre.
export const gripSide = (rect, w, vw) => (rect.x + w / 2 > vw / 2 ? 'bl' : 'br');
```

Replace the existing `defaultRect`:

```js
export function defaultRect(vw, w = PANEL_W) {
  return { x: Math.max(EDGE, vw - w - EDGE), y: NAV_H + EDGE };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="controlRoom/__tests__/geometry"`
Expected: PASS, every test including the original ones.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add src/components/controlRoom/geometry.js src/components/controlRoom/__tests__/geometry.test.js && git commit -m "feat(control-room): resize limits and geometry"
```

---

### Task 5: Stored panel state for size, dock width and the Redeem tab

**Files:**
- Modify: `src/components/controlRoom/storage.js`
- Test: `src/components/controlRoom/__tests__/storage.test.js` (append)

**Interfaces:**
- Consumes: `MIN_W`, `MAX_W`, `MIN_H`, `DOCK_MIN`, `DOCK_MAX` from `./geometry` (Task 4).
- Produces: `DEFAULT_STORE` and `sanitizeStore` gain `size: { w, h | null } | null` (default `null`), `dockW: number | null` (default `null`), `redeemSeenAt: number | null` (default `null`) and `redeemFilter: 'all' | 'stream' | 'payouts'` (default `'all'`). `tab` accepts `'redeem'`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/controlRoom/__tests__/storage.test.js`:

```js
test('size, dock width and redeem prefs round-trip', () => {
  const value = {
    ...DEFAULT_STORE,
    tab: 'redeem',
    size: { w: 500, h: null },
    dockW: 480,
    redeemSeenAt: 1_700_000_000_000,
    redeemFilter: 'payouts',
  };
  writeStore(value);
  expect(readStore()).toEqual(value);
});

test('sizes outside the limits are pulled back in', () => {
  expect(sanitizeStore({ size: { w: 2000, h: 50 }, dockW: 5000 })).toMatchObject({ size: { w: 720, h: 240 }, dockW: 720 });
  expect(sanitizeStore({ size: { w: 100, h: null }, dockW: 10 })).toMatchObject({ size: { w: 320, h: null }, dockW: 320 });
});

test('broken size and redeem fields fall back', () => {
  expect(sanitizeStore({ size: 'big', dockW: 'wide', redeemSeenAt: -5, redeemFilter: 'payout' })).toEqual(DEFAULT_STORE);
  expect(sanitizeStore({ size: { w: '400', h: 300 } }).size).toBeNull();
  expect(sanitizeStore({ size: { w: 400, h: 'tall' } }).size).toEqual({ w: 400, h: null });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="controlRoom/__tests__/storage"`
Expected: FAIL. The round-trip test loses `size`, `dockW`, `redeemSeenAt` and `redeemFilter`, and `tab: 'redeem'` falls back to `'giveaway'`.

- [ ] **Step 3: Implement**

In `src/components/controlRoom/storage.js`:

Add after the comment header:

```js
import { DOCK_MAX, DOCK_MIN, MAX_W, MIN_H, MIN_W } from './geometry';
```

Replace `const TABS = ['giveaway', 'predict'];` with:

```js
const TABS = ['giveaway', 'predict', 'redeem'];
const REDEEM_FILTERS = ['all', 'stream', 'payouts'];
```

Replace `DEFAULT_STORE` with:

```js
export const DEFAULT_STORE = Object.freeze({
  mode: 'closed',
  restoreTo: 'float',
  rect: null,
  corner: 'tr',
  tab: 'giveaway',
  stage: false,
  hideLiveBadge: false,
  size: null,
  dockW: null,
  redeemSeenAt: null,
  redeemFilter: 'all',
});
```

After `cleanRect`, add:

```js
const clampNum = (n, min, max) => Math.min(Math.max(n, min), max);

// The window clamps again at render; this only keeps the absolute limits.
function cleanSize(size) {
  if (!size || typeof size !== 'object' || !Number.isFinite(size.w)) return null;
  const h = Number.isFinite(size.h) ? Math.max(Math.round(size.h), MIN_H) : null;
  return { w: clampNum(Math.round(size.w), MIN_W, MAX_W), h };
}

const cleanDockW = (w) => (Number.isFinite(w) ? clampNum(Math.round(w), DOCK_MIN, DOCK_MAX) : null);
const cleanMs = (ms) => (Number.isFinite(ms) && ms >= 0 ? ms : null);
```

In `sanitizeStore`, add four fields after `hideLiveBadge`:

```js
    size: cleanSize(s.size),
    dockW: cleanDockW(s.dockW),
    redeemSeenAt: cleanMs(s.redeemSeenAt),
    redeemFilter: REDEEM_FILTERS.includes(s.redeemFilter) ? s.redeemFilter : DEFAULT_STORE.redeemFilter,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="controlRoom/__tests__/storage"`
Expected: PASS, all tests including the original ones (they compare against `DEFAULT_STORE`, which now carries the new defaults).

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add src/components/controlRoom/storage.js src/components/controlRoom/__tests__/storage.test.js && git commit -m "feat(control-room): store panel size, dock width and redeem prefs"
```

---

### Task 6: Provider feeds pending redemptions and tracks what's been seen

**Files:**
- Modify: `src/components/controlRoom/useLiveQuery.js`
- Modify: `src/contexts/ControlRoomContext.js`
- Test: `src/components/controlRoom/__tests__/useLiveQuery.test.js` (append), `src/contexts/__tests__/ControlRoomContext.test.js` (edit one test, append)

**Interfaces:**
- Consumes: `QUEUE_CAP`, `FILTERS`, `newestAt`, `unseenCount` (Task 3); store fields (Task 5).
- Produces, on the `useControlRoom()` value:
  - `redemptions`: array of pending redemption docs, newest first, at most 50.
  - `redeem: { pending: number, unseen: number, capped: boolean }`.
  - `markRedeemSeen(ms)`: only moves forward.
  - `setRedeemFilter(filter)`: ignores unknown values.
  - `prefs.redeemFilter`.
  - `panel.size` and `panel.dockW`.
  - `panelActions.resizeTo(rect, size)` and `panelActions.setDockW(w)`.
  - `panelActions.resetPosition()` also clears `size` and `dockW`.
  - `dataLost` and `dataGaveUp` include the redemptions feed.
- `useLiveQuery` state gains `ready: boolean` (true after the first good snapshot).

- [ ] **Step 1: Write the failing `useLiveQuery` test**

Append to `src/components/controlRoom/__tests__/useLiveQuery.test.js`:

```js
test('ready turns on with the first good snapshot', () => {
  let next;
  onSnapshot.mockImplementation((_q, n) => {
    next = n;
    return () => {};
  });
  const { result } = renderHook(() => useLiveQuery(() => 'q', true));
  expect(result.current.ready).toBe(false);
  act(() => next(snap([])));
  expect(result.current.ready).toBe(true);
});
```

- [ ] **Step 2: Write the failing provider tests**

In `src/contexts/__tests__/ControlRoomContext.test.js`, change the test `'staff subscribe to live giveaways and recent rounds'`. Rename it to `'staff subscribe to live giveaways, recent rounds and pending redemptions'` and change its path assertion to:

```js
  expect(onSnapshot.mock.calls.map(([path]) => path).sort()).toEqual(['giveaways', 'hunts', 'redemptions']);
```

Append:

```js
const STORE_KEY = 'goofer:control-room';
const stored = () => JSON.parse(localStorage.getItem(STORE_KEY));

test('a first run counts the redemption backlog as seen', () => {
  mockData.redemptions = [
    { id: 'r2', createdAt: at(2000) },
    { id: 'r1', createdAt: at(1000) },
  ];
  mount();
  expect(latest.redemptions.map((r) => r.id)).toEqual(['r2', 'r1']);
  expect(latest.redeem).toEqual({ pending: 2, unseen: 0, capped: false });
  expect(stored().redeemSeenAt).toBe(2000);
});

test('a newer redemption is unseen until the tab marks it seen', () => {
  let push;
  mockData.redemptions = [{ id: 'r1', createdAt: at(1000) }];
  const base = onSnapshot.getMockImplementation();
  onSnapshot.mockImplementation((path, next, error) => {
    if (path === 'redemptions') push = next;
    return base(path, next, error);
  });
  mount();
  act(() =>
    push({
      docs: [
        { id: 'r2', data: () => ({ createdAt: at(3000) }) },
        { id: 'r1', data: () => ({ createdAt: at(1000) }) },
      ],
    })
  );
  expect(latest.redeem).toEqual({ pending: 2, unseen: 1, capped: false });
  act(() => latest.markRedeemSeen(3000));
  expect(latest.redeem.unseen).toBe(0);
  act(() => latest.markRedeemSeen(500));
  expect(stored().redeemSeenAt).toBe(3000);
});

test('a browser that already tracks redemptions keeps its mark', () => {
  localStorage.setItem(STORE_KEY, JSON.stringify({ redeemSeenAt: 1500 }));
  mockData.redemptions = [
    { id: 'r2', createdAt: at(2000) },
    { id: 'r1', createdAt: at(1000) },
  ];
  mount();
  expect(latest.redeem.unseen).toBe(1);
});

test('an empty queue baselines to now', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(5000);
  try {
    mount();
    expect(stored().redeemSeenAt).toBe(5000);
  } finally {
    now.mockRestore();
  }
});

test('a full feed is flagged as capped', () => {
  mockData.redemptions = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, createdAt: at(1000 + i) }));
  mount();
  expect(latest.redeem.capped).toBe(true);
});

test('a redemptions feed error counts as lost data', () => {
  const base = onSnapshot.getMockImplementation();
  onSnapshot.mockImplementation((path, next, error) => {
    if (path === 'redemptions') {
      error(new Error('denied'));
      return () => {};
    }
    return base(path, next, error);
  });
  mount();
  expect(latest.dataLost).toBe(true);
});

test('the redeem filter persists and ignores unknown values', () => {
  mount();
  act(() => latest.setRedeemFilter('payouts'));
  expect(latest.prefs.redeemFilter).toBe('payouts');
  act(() => latest.setRedeemFilter('nope'));
  expect(latest.prefs.redeemFilter).toBe('payouts');
  expect(stored().redeemFilter).toBe('payouts');
});

test('resize actions store the size, and reset clears it', () => {
  mount();
  act(() => latest.panelActions.resizeTo({ x: 10, y: 80 }, { w: 500, h: null }));
  act(() => latest.panelActions.setDockW(600));
  expect(latest.panel).toMatchObject({ rect: { x: 10, y: 80 }, size: { w: 500, h: null }, dockW: 600 });
  act(() => latest.panelActions.resetPosition());
  expect(latest.panel).toMatchObject({ mode: 'float', rect: null, size: null, dockW: null });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="useLiveQuery|ControlRoomContext"`
Expected: FAIL. `ready` is undefined, there's no `redemptions` subscription, and `latest.redeem`, `markRedeemSeen`, `setRedeemFilter`, `resizeTo` and `setDockW` are undefined.

- [ ] **Step 4: Add `ready` to `useLiveQuery`**

In `src/components/controlRoom/useLiveQuery.js`:

```js
const EMPTY = { docs: [], error: false, gaveUp: false, ready: false };
```

and in the success callback:

```js
        setState({ docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: false, gaveUp: false, ready: true });
```

Leave the error paths as they are (they spread `s`, so `ready` keeps its value).

- [ ] **Step 5: Extend the provider**

In `src/contexts/ControlRoomContext.js`:

Add an import after the `storage` import:

```js
import {
  FILTERS as REDEEM_FILTERS,
  QUEUE_CAP,
  newestAt,
  unseenCount,
} from '../components/controlRoom/redemptions';
```

After `roundsQuery`, add:

```js
const redemptionsQuery = () =>
  query(
    collection(db, 'redemptions'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
    fLimit(QUEUE_CAP)
  );
```

Update the comment above `ControlRoomProvider` to say "Live giveaway, prediction and redemption state…", then add the feed beside the other two:

```js
  const giveawaysFeed = useLiveQuery(giveawaysQuery, enabled);
  const roundsFeed = useLiveQuery(roundsQuery, enabled);
  const redemptionsFeed = useLiveQuery(redemptionsQuery, enabled);
  const giveaways = giveawaysFeed.docs;
  const rounds = roundsFeed.docs;
  const redemptions = redemptionsFeed.docs;
```

After `const [ducked, setDucked] = useState(false);`, add:

```js
  // The first good snapshot on a browser that has never tracked redemptions
  // counts everything already waiting as seen, so a backlog never pulses.
  const redeemReady = enabled && redemptionsFeed.ready;
  useEffect(() => {
    if (!redeemReady) return;
    setStore((s) =>
      s.redeemSeenAt != null ? s : { ...s, redeemSeenAt: newestAt(redemptions) ?? Date.now() }
    );
  }, [redeemReady, redemptions]);
```

In `panelActions`, add two actions and widen `resetPosition`:

```js
      resizeTo: (rect, size) => setStore((s) => ({ ...s, rect, size })),
      setDockW: (dockW) => setStore((s) => ({ ...s, dockW })),
      resetPosition: () =>
        setStore((s) => ({
          ...s,
          mode: 'float',
          restoreTo: 'float',
          rect: null,
          corner: 'tr',
          size: null,
          dockW: null,
        })),
```

After `setHideLiveBadge`, add:

```js
  // The Redeem tab calls this while it's on screen. The mark only moves forward.
  const markRedeemSeen = useCallback(
    (ms) =>
      setStore((s) =>
        Number.isFinite(ms) && (s.redeemSeenAt == null || ms > s.redeemSeenAt) ? { ...s, redeemSeenAt: ms } : s
      ),
    []
  );
  const setRedeemFilter = useCallback(
    (filter) => setStore((s) => (REDEEM_FILTERS.includes(filter) ? { ...s, redeemFilter: filter } : s)),
    []
  );
```

In `value`, make these changes (keep everything else):

```js
    dataLost: giveawaysFeed.error || roundsFeed.error || redemptionsFeed.error,
    dataGaveUp: giveawaysFeed.gaveUp || roundsFeed.gaveUp || redemptionsFeed.gaveUp,
    redemptions,
    redeem: {
      pending: redemptions.length,
      unseen: unseenCount(redemptions, store.redeemSeenAt),
      capped: redemptions.length >= QUEUE_CAP,
    },
    markRedeemSeen,
    setRedeemFilter,
```

```js
    panel: {
      mode: store.mode,
      restoreTo: store.restoreTo,
      rect: store.rect,
      corner: store.corner,
      tab: store.tab,
      size: store.size,
      dockW: store.dockW,
    },
```

```js
    prefs: { stage: store.stage, hideLiveBadge: store.hideLiveBadge, redeemFilter: store.redeemFilter },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="useLiveQuery|ControlRoomContext"`
Expected: PASS, the new tests and every original one.

- [ ] **Step 7: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add src/components/controlRoom/useLiveQuery.js src/contexts/ControlRoomContext.js src/components/controlRoom/__tests__/useLiveQuery.test.js src/contexts/__tests__/ControlRoomContext.test.js && git commit -m "feat(control-room): pending redemptions feed with seen tracking"
```

---

### Task 7: The Redeem tab

**Files:**
- Create: `src/components/controlRoom/useRedemptionAction.js`
- Create: `src/components/controlRoom/RedeemTab.js`
- Modify: `src/components/controlRoom/controlRoom.css`
- Test: `src/components/controlRoom/__tests__/RedeemTab.test.js`

**Interfaces:**
- Consumes:
  - From `useControlRoom()`: `redemptions`, `redeem`, `prefs.redeemFilter`, `ducked`, `markRedeemSeen`, `setRedeemFilter` (Task 6).
  - The Task 3 helpers.
  - `authedFetch(url, init)` from `src/utils/authedFetch.js`.
  - `useClock({ intervalMs, active }) → number` from `src/hooks/useClock.js`.
- Produces:
  - `useRedemptionAction() → { busy: { [id]: action }, errors: { [id]: string }, run(id, action, note) → Promise<boolean> }`
  - `RedeemTab` as the default export (no props).

- [ ] **Step 1: Write the failing test**

Create `src/components/controlRoom/__tests__/RedeemTab.test.js`:

```js
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import RedeemTab from '../RedeemTab';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { authedFetch } from '../../../utils/authedFetch';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const NOW = 1_700_000_000_000;
const at = (ms) => ({ toMillis: () => ms });
// The feed's order: newest first.
const FEED = [
  { id: 'r3', itemName: 'Roll a blunt', kind: 'stream', cost: 420, displayName: 'Cee', createdAt: at(NOW - 60_000) },
  {
    id: 'r2',
    itemName: 'Sunday · 1st place',
    kind: 'prediction',
    cost: 0,
    displayName: 'Bee',
    note: '$50 cash',
    createdAt: at(NOW - 5 * 60_000),
  },
  { id: 'r1', itemName: 'Pick a Slot', kind: 'stream', cost: 1500, displayName: 'Ay', createdAt: at(NOW - 2 * 3_600_000) },
];

let cr;
function show(overrides = {}) {
  const { prefs, ...rest } = overrides;
  cr = {
    redemptions: FEED,
    redeem: { pending: FEED.length, unseen: 0, capped: false },
    prefs: { stage: false, hideLiveBadge: false, redeemFilter: 'all', ...prefs },
    ducked: false,
    markRedeemSeen: jest.fn(),
    setRedeemFilter: jest.fn(),
    ...rest,
  };
  useControlRoom.mockReturnValue(cr);
  return render(<RedeemTab />);
}
const ok = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
const rowOf = (name) => screen.getByText(name).closest('li');
const sentBody = (i) => JSON.parse(authedFetch.mock.calls[i][1].body);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  authedFetch.mockImplementation(ok);
});
afterEach(() => jest.useRealTimers());

test('rows read oldest first, with who, age and price', () => {
  show();
  const names = screen.getAllByRole('listitem').map((li) => li.querySelector('.cr-red-item').textContent);
  expect(names).toEqual(['Pick a Slot', 'Sunday · 1st place', 'Roll a blunt']);
  expect(rowOf('Pick a Slot').textContent).toMatch('Ay · 2h ago · 1500t');
  expect(rowOf('Sunday · 1st place').textContent).toMatch('Bee · 5m ago');
  expect(rowOf('Sunday · 1st place').textContent).not.toMatch(/\b0t\b/);
  expect(rowOf('Sunday · 1st place').textContent).toMatch('$50 cash');
});

test('filter chips show their counts and switch the filter', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Stream 2' }));
  expect(cr.setRedeemFilter).toHaveBeenCalledWith('stream');
});

test('the payouts filter shows only prize rows', () => {
  show({ prefs: { redeemFilter: 'payouts' } });
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('Sunday · 1st place')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Payouts 1' }).getAttribute('aria-pressed')).toBe('true');
});

test('Fulfill sends the note typed in the expanded row', async () => {
  show();
  fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: /pick a slot/i }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Note for Pick a Slot' }), { target: { value: 'played it' } });
  await act(async () => {
    fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  });
  expect(authedFetch).toHaveBeenCalledWith('/api/admin/redemptions', expect.objectContaining({ method: 'POST' }));
  expect(sentBody(0)).toEqual({ id: 'r1', action: 'fulfill', note: 'played it' });
});

test('Refund needs a second press within 4s', async () => {
  show();
  const row = rowOf('Pick a Slot');
  fireEvent.click(within(row).getByRole('button', { name: 'Refund' }));
  expect(authedFetch).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(within(row).getByRole('button', { name: 'Confirm refund · 4s' }));
  });
  expect(sentBody(0)).toEqual({ id: 'r1', action: 'cancel', note: null });
});

test('an armed Refund counts down and disarms after 4s', () => {
  show();
  const row = rowOf('Pick a Slot');
  fireEvent.click(within(row).getByRole('button', { name: 'Refund' }));
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(within(row).getByRole('button', { name: 'Confirm refund · 3s' })).toBeTruthy();
  act(() => {
    jest.advanceTimersByTime(3000);
  });
  fireEvent.click(within(row).getByRole('button', { name: 'Refund' }));
  expect(authedFetch).not.toHaveBeenCalled();
});

// Review Focus 1: a double click during a busy stream sends one request.
test('a row is busy while its request runs, and a double click sends once', async () => {
  let resolve;
  authedFetch.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  show();
  fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfilling…' }));
  expect(authedFetch).toHaveBeenCalledTimes(1);
  expect(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfilling…' }).disabled).toBe(true);
  expect(within(rowOf('Roll a blunt')).getByRole('button', { name: 'Fulfill' }).disabled).toBe(false);
  await act(async () => {
    resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

test('errors show under their row in plain words', async () => {
  authedFetch.mockImplementation(() =>
    Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'NOT_PENDING' }) })
  );
  show();
  await act(async () => {
    fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  });
  expect(within(rowOf('Pick a Slot')).getByRole('alert').textContent).toBe('Already handled by someone else.');
  expect(within(rowOf('Roll a blunt')).queryByRole('alert')).toBeNull();
});

test('a network failure says try again', async () => {
  authedFetch.mockImplementation(() => Promise.reject(new Error('offline')));
  show();
  await act(async () => {
    fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  });
  expect(within(rowOf('Pick a Slot')).getByRole('alert').textContent).toBe("Didn't go through. Try again.");
});

// Review Focus 4: another mod handles the row mid-request.
test('a row handled elsewhere leaves cleanly, even mid-request', async () => {
  let resolve;
  authedFetch.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const view = show();
  fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  cr = { ...cr, redemptions: FEED.slice(0, 2), redeem: { pending: 2, unseen: 0, capped: false } };
  useControlRoom.mockReturnValue(cr);
  view.rerender(<RedeemTab />);
  expect(screen.queryByText('Pick a Slot')).toBeNull();
  await act(async () => {
    resolve({ ok: false, json: () => Promise.resolve({ error: 'NOT_PENDING' }) });
  });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});

test('empty and filtered-empty copy', () => {
  const view = show({ redemptions: [], redeem: { pending: 0, unseen: 0, capped: false } });
  expect(screen.getByText('Nothing waiting.')).toBeTruthy();
  view.unmount();
  show({ redemptions: [FEED[1]], prefs: { redeemFilter: 'stream' } });
  expect(screen.getByText('Nothing in stream.')).toBeTruthy();
});

test('a full feed says the rest are in admin', () => {
  show({ redeem: { pending: 50, unseen: 0, capped: true } });
  expect(screen.getByText('Showing newest 50 · rest in admin')).toBeTruthy();
});

test('on screen means seen, unless a stage moment has the panel ducked', () => {
  const view = show();
  expect(cr.markRedeemSeen).toHaveBeenCalledWith(NOW - 60_000);
  view.unmount();
  show({ ducked: true });
  expect(cr.markRedeemSeen).not.toHaveBeenCalled();
});

// Review Focus 5: an old doc with no kind, name, avatar or price.
test('an old doc still renders with fallbacks', () => {
  show({ redemptions: [{ id: 'x', itemName: 'Mystery', userId: 'u123', createdAt: at(NOW) }] });
  const row = rowOf('Mystery');
  expect(row.textContent).toMatch('ITEM');
  expect(row.textContent).toMatch('u123 · just now');
  expect(row.textContent).not.toMatch(/\dt\b/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="RedeemTab"`
Expected: FAIL with "Cannot find module '../RedeemTab'".

- [ ] **Step 3: Write the action hook**

Create `src/components/controlRoom/useRedemptionAction.js`:

```js
import { useCallback, useState } from 'react';
import { authedFetch } from '../../utils/authedFetch';
import { redemptionErrorText } from './redemptions';

const without = (obj, key) => {
  const next = { ...obj };
  delete next[key];
  return next;
};

// Fulfil or refund redemptions from the panel. Each row has its own busy
// state and its own error, so one slow request never locks the queue.
export function useRedemptionAction() {
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});
  const run = useCallback(async (id, action, note) => {
    setBusy((b) => ({ ...b, [id]: action }));
    setErrors((e) => without(e, id));
    try {
      const res = await authedFetch('/api/admin/redemptions', {
        method: 'POST',
        body: JSON.stringify({ id, action, note: note || null }),
      });
      if (res.ok) return true;
      const data = await res.json().catch(() => ({}));
      setErrors((e) => ({ ...e, [id]: redemptionErrorText(data && data.error) }));
      return false;
    } catch {
      setErrors((e) => ({ ...e, [id]: redemptionErrorText(null) }));
      return false;
    } finally {
      setBusy((b) => without(b, id));
    }
  }, []);
  return { busy, errors, run };
}
```

- [ ] **Step 4: Write the tab**

Create `src/components/controlRoom/RedeemTab.js`:

```js
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Undo2 } from 'lucide-react';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { useClock } from '../../hooks/useClock';
import {
  FILTERS,
  FILTER_LABELS,
  QUEUE_CAP,
  ageLabel,
  filterCounts,
  filterQueue,
  kindGroup,
  kindLabel,
  newestAt,
  queueOrder,
  showsCost,
  whoRedeemed,
} from './redemptions';
import { useRedemptionAction } from './useRedemptionAction';

const ARM_MS = 4000;

// Refund only goes through on a second press inside 4s. The label counts down
// so the operator can see the window closing.
function RefundButton({ disabled, onConfirm }) {
  const [armedAt, setArmedAt] = useState(null);
  const armed = armedAt != null;
  const now = useClock({ intervalMs: 250, active: armed });
  useEffect(() => {
    if (armedAt == null) return undefined;
    const t = setTimeout(() => setArmedAt(null), ARM_MS);
    return () => clearTimeout(t);
  }, [armedAt]);
  const left = armed
    ? Math.min(ARM_MS / 1000, Math.max(1, Math.ceil((armedAt + ARM_MS - now) / 1000)))
    : 0;
  return (
    <button
      type="button"
      className="cr-btn"
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmedAt(null);
          onConfirm();
        } else {
          setArmedAt(Date.now());
        }
      }}
    >
      <Undo2 size={12} aria-hidden="true" />
      {armed ? `Confirm refund · ${left}s` : 'Refund'}
    </button>
  );
}

function Row({ r, now, open, onToggle, note, onNote, busy, error, onAct }) {
  const noteId = `cr-red-note-${r.id}`;
  const name = r.itemName || 'Untitled';
  const meta = [whoRedeemed(r), ageLabel(r.createdAt, now), showsCost(r) ? `${r.cost}t` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="cr-red-row">
      <button
        type="button"
        className="cr-red-summary"
        aria-expanded={open}
        aria-controls={open ? noteId : undefined}
        onClick={onToggle}
      >
        {r.profileImageUrl ? (
          <img src={r.profileImageUrl} alt="" className="w-7 h-7 rounded-full border border-white/15" />
        ) : (
          <span className="w-7 h-7 border border-white/15" aria-hidden="true" />
        )}
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="cr-red-item text-sm font-bold text-white-body truncate">{name}</span>
            <span className={`cr-kind ${kindGroup(r.kind) === 'payouts' ? 'is-payout' : ''}`}>{kindLabel(r.kind)}</span>
          </span>
          <span className="cr-lbl block mt-1">{meta}</span>
          {r.note && <span className="block mt-1 text-xs italic text-white/55">{r.note}</span>}
        </span>
      </button>
      {open && (
        <input
          id={noteId}
          type="text"
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Optional note…"
          aria-label={`Note for ${name}`}
          className="cr-red-note"
        />
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" className="cr-btn is-go" disabled={!!busy} onClick={() => onAct('fulfill')}>
          <Check size={12} aria-hidden="true" />
          {busy === 'fulfill' ? 'Fulfilling…' : 'Fulfill'}
        </button>
        <RefundButton disabled={!!busy} onConfirm={() => onAct('cancel')} />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

// Pending redemptions, oldest first, with the same actions as
// /admin/redemptions. Being on screen marks them seen.
export default function RedeemTab() {
  const cr = useControlRoom();
  const list = cr.redemptions || [];
  const filter = cr.prefs.redeemFilter;
  const counts = filterCounts(list);
  const rows = queueOrder(filterQueue(list, filter));
  const now = useClock({ intervalMs: 30_000, active: list.length > 0 });
  const [openId, setOpenId] = useState(null);
  const [notes, setNotes] = useState({});
  const { busy, errors, run } = useRedemptionAction();

  const newest = newestAt(list);
  const { markRedeemSeen, ducked } = cr;
  useEffect(() => {
    if (!ducked && newest != null) markRedeemSeen(newest);
  }, [newest, ducked, markRedeemSeen]);

  const act = async (id, action) => {
    const ok = await run(id, action, notes[id]);
    if (!ok) return;
    setNotes((n) => {
      const next = { ...n };
      delete next[id];
      return next;
    });
    setOpenId((o) => (o === id ? null : o));
  };

  return (
    <div>
      <div role="group" aria-label="Filter redemptions" className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            className={`cr-chip ${filter === f ? 'is-on' : ''}`}
            onClick={() => cr.setRedeemFilter(f)}
          >
            {FILTER_LABELS[f]} {counts[f]}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="mt-3">
          <p className="cr-lbl">redemptions</p>
          <p className="cr-timecode is-quiet">IDLE</p>
          <p className="text-sm text-white/55 mt-2">Nothing waiting.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/55 mt-3">Nothing in {FILTER_LABELS[filter].toLowerCase()}.</p>
      ) : (
        <ul aria-label="Pending redemptions" className="mt-3 space-y-2">
          {rows.map((r) => (
            <Row
              key={r.id}
              r={r}
              now={now}
              open={openId === r.id}
              onToggle={() => setOpenId((o) => (o === r.id ? null : r.id))}
              note={notes[r.id] || ''}
              onNote={(v) => setNotes((n) => ({ ...n, [r.id]: v }))}
              busy={busy[r.id]}
              error={errors[r.id]}
              onAct={(action) => act(r.id, action)}
            />
          ))}
        </ul>
      )}
      {cr.redeem?.capped && <p className="cr-lbl mt-3">Showing newest {QUEUE_CAP} · rest in admin</p>}
      <div className="mt-4 flex justify-end">
        <Link to="/admin/redemptions" className="cr-lbl hover:text-white-body">
          Open in admin ↗
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the styles**

In `src/components/controlRoom/controlRoom.css`, extend the existing focus rule on line 21 by adding `.cr-chip:focus-visible, .cr-red-summary:focus-visible` to its selector list:

```css
.cr-icon:focus-visible, .cr-tab:focus-visible, .cr-switch:focus-visible, .cr-btn:focus-visible, .cr-pill:focus-visible, .cr-chip:focus-visible, .cr-red-summary:focus-visible { outline: 2px solid #ffb24d; outline-offset: 1px; }
```

After the `.cr-btn.is-go:hover` rule, add:

```css
.cr-chip { padding: 5px 7px; border-radius: 3px; border: 1px solid #3f3f46; color: #a1a1aa; font: 600 9px/1 source-code-pro, Menlo, monospace; letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer; }
.cr-chip.is-on { border-color: #ffb24d; color: #ffb24d; }
.cr-red-row { padding: 8px; border-radius: 6px; background: #18181b; }
.cr-red-summary { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; width: 100%; text-align: left; border-radius: 4px; cursor: pointer; }
.cr-kind { flex: none; padding: 2px 4px; border: 1px solid rgba(249, 115, 22, 0.45); border-radius: 2px; color: #f97316; font: 600 8px/1 source-code-pro, Menlo, monospace; letter-spacing: 0.16em; }
.cr-kind.is-payout { border-color: rgba(16, 185, 129, 0.45); color: #10b981; }
.cr-red-note { width: 100%; margin-top: 8px; padding: 7px 8px; border-radius: 4px; background: #0b0b0d; border: 1px solid #2a2a2e; color: #fafafa; font-size: 13px; }
.cr-red-note::placeholder { color: #52525b; }
.cr-red-note:focus { outline: none; border-color: #ffb24d; }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="RedeemTab"`
Expected: PASS, 14 tests.

- [ ] **Step 7: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add src/components/controlRoom/useRedemptionAction.js src/components/controlRoom/RedeemTab.js src/components/controlRoom/controlRoom.css src/components/controlRoom/__tests__/RedeemTab.test.js && git commit -m "feat(control-room): Redeem tab for the pending queue"
```

---

### Task 8: Wire the Redeem tab and its signals into the panel

**Files:**
- Modify: `src/components/controlRoom/panelStatus.js`
- Modify: `src/components/controlRoom/PanelChrome.js`
- Modify: `src/components/controlRoom/Pill.js`
- Modify: `src/components/controlRoom/ControlRoom.js` (imports, `Pill` props, `PanelChrome` props, the tab body)
- Modify: `src/components/controlRoom/controlRoom.css`
- Test: `src/components/controlRoom/__tests__/panelStatus.test.js` (edit and append), `src/components/controlRoom/__tests__/ControlRoom.test.js` (edit the mocks and `makeCr`, append)

**Interfaces:**
- Consumes: `cr.redeem` (Task 6), `RedeemTab` (Task 7).
- Produces:
  - `tallies({ isLive, giveaway, activeRound, redeem }) → { live, gvw, prd, red: number }`
  - `tabLeds({ giveaway, activeRound, redeem }) → { giveaway, predict, redeem }`
  - `pillCounter(redeem) → { label, pulse } | null`
  - `Pill` takes a `redeem` prop.

- [ ] **Step 1: Write the failing status tests**

In `src/components/controlRoom/__tests__/panelStatus.test.js`, change the import to:

```js
import { pillCounter, pillState, tabLeds, tallies } from '../panelStatus';
```

In the test `'tallies and tab LEDs'`, change the first three expectations to:

```js
  expect(tallies({ isLive: true, giveaway: null, activeRound: { status: 'open' } })).toEqual({ live: true, gvw: false, prd: true, red: 0 });
  expect(tabLeds({ giveaway: null, activeRound: null })).toEqual({ giveaway: 'off', predict: 'off', redeem: 'off' });
  expect(tabLeds({ giveaway: { status: 'open' }, activeRound: { status: 'locked' } })).toEqual({ giveaway: 'on', predict: 'pulse', redeem: 'off' });
```

Append:

```js
test('redemptions: the tally counts, the LED pulses only while something is unseen', () => {
  expect(tallies({ redeem: { pending: 3, unseen: 0 } }).red).toBe(3);
  expect(tabLeds({ redeem: { pending: 3, unseen: 0 } }).redeem).toBe('on');
  expect(tabLeds({ redeem: { pending: 3, unseen: 1 } }).redeem).toBe('pulse');
  expect(tabLeds({ redeem: { pending: 0, unseen: 0 } }).redeem).toBe('off');
});

test('the pill counter shows only when something is pending', () => {
  expect(pillCounter(undefined)).toBeNull();
  expect(pillCounter({ pending: 0, unseen: 0 })).toBeNull();
  expect(pillCounter({ pending: 2, unseen: 0 })).toEqual({ label: 'RED 2', pulse: false });
  expect(pillCounter({ pending: 2, unseen: 1 })).toEqual({ label: 'RED 2', pulse: true });
});
```

- [ ] **Step 2: Write the failing panel tests**

In `src/components/controlRoom/__tests__/ControlRoom.test.js`:

After the `PredictTab` mock, add:

```js
jest.mock('../RedeemTab', () => () => require('react').createElement('p', null, 'redeem tab body'));
```

In `makeCr`, add two fields to the returned object, after `rounds: []`:

```js
    redemptions: [],
    redeem: { pending: 0, unseen: 0, capped: false },
```

Append:

```js
test('the Redeem tab shows its body', () => {
  show({ panel: { tab: 'redeem' } });
  expect(screen.getByRole('tab', { name: /redeem/i }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('redeem tab body')).toBeTruthy();
});

test('ArrowLeft from Giveaway wraps to Redeem', () => {
  show();
  fireEvent.keyDown(screen.getByRole('tab', { name: /giveaway/i }), { key: 'ArrowLeft' });
  act(() => {
    jest.advanceTimersByTime(240);
  });
  expect(cr.panelActions.setTab).toHaveBeenCalledWith('redeem');
});

test('pending redemptions light the RED tally and pulse the Redeem LED while unseen', () => {
  const view = show({ redeem: { pending: 2, unseen: 1, capped: false } });
  expect(screen.getByText('RED 2').className).toMatch('is-on');
  const led = () => screen.getByRole('tab', { name: /redeem/i }).querySelector('.cr-tab-led');
  expect(led().className).toMatch('cr-led-pulse');
  cr = makeCr({ redeem: { pending: 2, unseen: 0, capped: false } });
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  expect(led().className).toMatch('cr-led-on');
});

test('the pill counts pending redemptions next to its label', () => {
  show({ panel: { mode: 'pill' }, redeem: { pending: 2, unseen: 1, capped: false } });
  const pill = screen.getByRole('button', { name: 'Open control room. CONTROL ROOM. 2 redemptions pending' });
  expect(within(pill).getByText('RED 2').className).toMatch('is-pulse');
});

test('the options menu resets position and size', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Panel options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reset position and size' }));
  expect(cr.panelActions.resetPosition).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="controlRoom/__tests__/(panelStatus|ControlRoom)"`
Expected: FAIL. `pillCounter` is not a function, `red` and `redeem` are missing from `tallies` and `tabLeds`, and there's no Redeem tab, `RED 2` tally or menu label.

- [ ] **Step 4: Status helpers**

In `src/components/controlRoom/panelStatus.js`, replace `tallies` and `tabLeds` and add `pillCounter`:

```js
export function tallies({ isLive, giveaway, activeRound, redeem }) {
  return { live: !!isLive, gvw: !!giveaway, prd: !!activeRound, red: (redeem && redeem.pending) || 0 };
}

// Tab LEDs: off when idle, on while the tool runs, pulsing when it needs you.
// Redemptions pulse only for orders this browser hasn't had on screen yet.
export function tabLeds({ giveaway, activeRound, redeem }) {
  let gvw = 'off';
  if (giveaway) gvw = giveaway.status === 'rolling' && !pickConfirmed(giveaway) ? 'pulse' : 'on';
  let prd = 'off';
  if (activeRound) prd = activeRound.status === 'locked' ? 'pulse' : 'on';
  let red = 'off';
  if (redeem && redeem.pending > 0) red = redeem.unseen > 0 ? 'pulse' : 'on';
  return { giveaway: gvw, predict: prd, redeem: red };
}

// The pill's redemption chip, or null when nothing is pending.
export function pillCounter(redeem) {
  if (!redeem || !(redeem.pending > 0)) return null;
  return { label: `RED ${redeem.pending}`, pulse: redeem.unseen > 0 };
}
```

- [ ] **Step 5: Chrome**

In `src/components/controlRoom/PanelChrome.js`:

Replace `TABS` and add `ADMIN_HREF`:

```js
const TABS = [
  ['giveaway', 'Giveaway'],
  ['predict', 'Predict'],
  ['redeem', 'Redeem'],
];
const ADMIN_HREF = { giveaway: '/admin/giveaways', predict: '/admin/hunts', redeem: '/admin/redemptions' };
```

Replace `const adminHref = tab === 'predict' ? '/admin/hunts' : '/admin/giveaways';` with:

```js
  const adminHref = ADMIN_HREF[tab] || ADMIN_HREF.giveaway;
```

After `<Tally on={tallies.prd} tone="amber">PRD</Tally>`, add:

```jsx
        <Tally on={tallies.red > 0} tone="amber">
          {tallies.red > 0 ? `RED ${tallies.red}` : 'RED'}
        </Tally>
```

Change the menu item text `Reset position` to `Reset position and size`.

- [ ] **Step 6: Pill**

Replace `src/components/controlRoom/Pill.js` with:

```js
import { useClock } from '../../hooks/useClock';
import { pillCounter, pillState } from './panelStatus';

// The minimized panel: one line of live state, a redemption counter when
// anything is pending, and a click brings it back.
export default function Pill({ giveaway, round, warnings, dataLost, redeem, anchor, onOpen }) {
  const ticking = giveaway?.status === 'open' && !!giveaway.closesAt;
  const now = useClock({ intervalMs: 1000, active: ticking });
  const { label, tone } = pillState({ giveaway, round, warnings, dataLost, now });
  const counter = pillCounter(redeem);
  const pending = counter ? `. ${redeem.pending} redemption${redeem.pending === 1 ? '' : 's'} pending` : '';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open control room. ${label}${pending}`}
      className={`cr-pill cr-pill-in tone-${tone} fixed z-[65]`}
      style={anchor}
    >
      <span className="cr-pill-dot" aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
      {counter && (
        <span className={`cr-pill-count ${counter.pulse ? 'is-pulse' : ''}`} aria-hidden="true">
          {counter.label}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 7: Panel wiring**

In `src/components/controlRoom/ControlRoom.js`:

Add after the `PredictTab` import:

```js
import RedeemTab from './RedeemTab';
```

In the pill branch, pass `redeem={cr.redeem}` to `<Pill … />` (next to `dataLost`).

In `<PanelChrome …>`, change the two status props to:

```jsx
          tallies={tallies({ isLive, giveaway: cr.giveaway, activeRound: cr.activeRound, redeem: cr.redeem })}
          dataLost={cr.dataLost}
          leds={tabLeds({ giveaway: cr.giveaway, activeRound: cr.activeRound, redeem: cr.redeem })}
```

Replace the tab body line `{panel.tab === 'predict' ? <PredictTab /> : <GiveawayTab scopeRef={rootRef} />}` with:

```jsx
          {panel.tab === 'predict' ? (
            <PredictTab />
          ) : panel.tab === 'redeem' ? (
            <RedeemTab />
          ) : (
            <GiveawayTab scopeRef={rootRef} />
          )}
```

- [ ] **Step 8: Pill counter styles**

In `src/components/controlRoom/controlRoom.css`, after `.cr-pill-in { … }`, add:

```css
.cr-pill-count { padding: 3px 5px; border-radius: 2px; background: #27272a; color: #ffb24d; letter-spacing: 0.16em; }
.cr-pill-count.is-pulse { background: #ffb24d; color: #0a0a0a; animation: cr-led-pulse 1.4s ease-in-out infinite; }
```

In the `@media (prefers-reduced-motion: reduce)` block, add `.cr-pill-count.is-pulse` to the selector list of the rule that sets `animation: none` on `.cr-led-pulse`:

```css
  .cr-led-pulse, .cr-pill.tone-attention .cr-pill-dot, .cr-timecode.is-hot, .cr-pill-count.is-pulse { animation: none; }
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="controlRoom/__tests__/(panelStatus|ControlRoom)"`
Expected: PASS. The existing arrow-key test still sees `predict` after `ArrowRight`, and the existing pill test still matches `/open control room\. gvw open · 3 in/i`.

- [ ] **Step 10: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add src/components/controlRoom/panelStatus.js src/components/controlRoom/PanelChrome.js src/components/controlRoom/Pill.js src/components/controlRoom/ControlRoom.js src/components/controlRoom/controlRoom.css src/components/controlRoom/__tests__/panelStatus.test.js src/components/controlRoom/__tests__/ControlRoom.test.js && git commit -m "feat(control-room): Redeem tab, RED tally and pill counter in the panel"
```

---

### Task 9: Resize handles on the floating panel and the dock

**Files:**
- Create: `src/components/controlRoom/ResizeHandles.js`
- Modify: `src/components/controlRoom/ControlRoom.js`
- Modify: `src/components/controlRoom/controlRoom.css`
- Test: `src/components/controlRoom/__tests__/ControlRoom.test.js` (edit the mocks, `makeCr` and `afterEach`, append)

**Interfaces:**
- Consumes:
  - From `geometry.js` (Task 4): `clampSize`, `clampDockW`, `resizeFrom`, `gripSide`, `defaultRect(vw, w)`, `RESIZE_STEP`, `RESIZE_STEP_BIG`, `DOCK_MIN`, `DOCK_MAX`.
  - `panel.size`, `panel.dockW`, `panelActions.resizeTo` and `panelActions.setDockW` (Task 6).
- Produces: `ResizeHandles` as the default export, with props:
  - `mode: 'float' | 'dock'`
  - `view: { vw, vh }`
  - `side: 'bl' | 'br'`
  - `dockW: number`
  - `getStart: () => start`, returning `{ x, y, w, h, fixedH }` in float or `{ w }` in dock
  - `onPreview(next)`, `onCommit(next)`, `onEnd()`, where `next` is `{ rect, size }` in float or `{ dockW }` in dock.
  - Each handle carries `data-cr-resize="<edge>"` (`l | r | b | bl | br | dock`) for tests.

- [ ] **Step 1: Write the failing tests**

In `src/components/controlRoom/__tests__/ControlRoom.test.js`:

Add after the other `jest.mock` calls:

```js
jest.mock('../useMediaQuery', () => ({ useMediaQuery: jest.fn() }));
```

and add the import after the `authedFetch` import:

```js
import { useMediaQuery } from '../useMediaQuery';
```

(CRA resets mocks before each test, so `useMediaQuery` returns `undefined` by default: not narrow.)

In `makeCr`'s `panelActions`, add:

```js
      resizeTo: jest.fn(),
      setDockW: jest.fn(),
```

Replace the `afterEach` with:

```js
afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
  document.body.className = '';
});
```

Append:

```js
const handle = (edge) => document.querySelector(`[data-cr-resize="${edge}"]`);
const panelEl = () => screen.getByRole('dialog', { name: 'Control room' });
const resizing = () => document.body.classList.contains('cr-resizing');

// jsdom is 1024×768, so a fresh panel floats at { x: 628, y: 73 }, 380 wide.
test('a floating panel has resize handles; the phone sheet has none', () => {
  const view = show();
  const edges = [...document.querySelectorAll('[data-cr-resize]')].map((el) => el.dataset.crResize).sort();
  expect(edges).toEqual(['b', 'bl', 'br', 'l', 'r']);
  view.unmount();
  useMediaQuery.mockReturnValue(true);
  show();
  expect(document.querySelectorAll('[data-cr-resize]')).toHaveLength(0);
});

test('dragging the left edge widens a top-right panel and keeps its right edge', () => {
  show();
  firePointer('pointerdown', handle('l'), { clientX: 628, clientY: 200 });
  firePointer('pointermove', handle('l'), { clientX: 528, clientY: 200 });
  expect(panelEl().style.width).toBe('480px');
  expect(panelEl().style.left).toBe('528px');
  expect(resizing()).toBe(true);
  expect(cr.panelActions.resizeTo).not.toHaveBeenCalled();
  firePointer('pointerup', handle('l'), { clientX: 528, clientY: 200 });
  expect(cr.panelActions.resizeTo).toHaveBeenCalledWith({ x: 528, y: 73 }, { w: 480, h: null });
  expect(resizing()).toBe(false);
});

test('the bottom-right grip sets width and height', () => {
  show({ panel: { rect: { x: 16, y: 73 } } });
  const grip = screen.getByRole('button', { name: 'Resize panel' });
  expect(grip.dataset.crResize).toBe('br');
  firePointer('pointerdown', grip, { clientX: 100, clientY: 100 });
  firePointer('pointerup', grip, { clientX: 140, clientY: 160 });
  expect(cr.panelActions.resizeTo).toHaveBeenCalledWith({ x: 16, y: 73 }, { w: 420, h: 480 });
});

test('a click on the grip without moving changes nothing', () => {
  show();
  const grip = screen.getByRole('button', { name: 'Resize panel' });
  firePointer('pointerdown', grip, { clientX: 300, clientY: 400 });
  firePointer('pointerup', grip, { clientX: 300, clientY: 400 });
  expect(cr.panelActions.resizeTo).not.toHaveBeenCalled();
});

test('the grip resizes from the keyboard', () => {
  show();
  const grip = screen.getByRole('button', { name: 'Resize panel' });
  expect(grip.dataset.crResize).toBe('bl');
  fireEvent.keyDown(grip, { key: 'ArrowLeft' });
  expect(cr.panelActions.resizeTo).toHaveBeenLastCalledWith({ x: 612, y: 73 }, { w: 396, h: null });
  fireEvent.keyDown(grip, { key: 'ArrowLeft', shiftKey: true });
  expect(cr.panelActions.resizeTo).toHaveBeenLastCalledWith({ x: 564, y: 73 }, { w: 444, h: null });
  fireEvent.keyDown(grip, { key: 'ArrowDown' });
  expect(cr.panelActions.resizeTo).toHaveBeenLastCalledWith({ x: 628, y: 73 }, { w: 380, h: 436 });
});

// Review Focus 3: a size saved on a bigger monitor fits this one.
test('a stored size comes back clamped to the window', () => {
  show({ panel: { size: { w: 700, h: 2000 } } });
  expect(panelEl().style.width).toBe('700px');
  expect(panelEl().style.height).toBe('695px');
  expect(panelEl().style.maxHeight).toBe('');
});

test('the dock edge resizes by keyboard and pointer, and the page follows on release', () => {
  const view = show({ panel: { mode: 'dock', restoreTo: 'dock', dockW: 400 } });
  const edge = screen.getByRole('separator', { name: 'Resize dock' });
  expect(edge.getAttribute('aria-valuenow')).toBe('400');
  fireEvent.keyDown(edge, { key: 'ArrowLeft' });
  expect(cr.panelActions.setDockW).toHaveBeenLastCalledWith(416);
  firePointer('pointerdown', edge, { clientX: 624, clientY: 300 });
  firePointer('pointermove', edge, { clientX: 524, clientY: 300 });
  expect(panelEl().style.width).toBe('500px');
  expect(document.documentElement.style.getPropertyValue('--control-dock-w')).toBe('400px');
  firePointer('pointerup', edge, { clientX: 524, clientY: 300 });
  expect(cr.panelActions.setDockW).toHaveBeenLastCalledWith(500);
  cr = makeCr({ panel: { mode: 'dock', restoreTo: 'dock', dockW: 500 } });
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  expect(document.documentElement.style.getPropertyValue('--control-dock-w')).toBe('500px');
});

// Review Focus 3: the page padding uses the clamped dock width too.
test('a dock width saved on a wider monitor fits this one', () => {
  show({ panel: { mode: 'dock', restoreTo: 'dock', dockW: 720 } });
  expect(panelEl().style.width).toBe('544px');
  expect(document.documentElement.style.getPropertyValue('--control-dock-w')).toBe('544px');
});

// Review Focus 2: release outside the window, alt-tab, lost capture.
test('losing the pointer mid-resize commits nothing and puts the size back', () => {
  show();
  firePointer('pointerdown', handle('l'), { clientX: 628, clientY: 200 });
  firePointer('pointermove', handle('l'), { clientX: 528, clientY: 200 });
  firePointer('lostpointercapture', handle('l'));
  expect(panelEl().style.width).toBe('380px');
  expect(cr.panelActions.resizeTo).not.toHaveBeenCalled();
  expect(resizing()).toBe(false);
});

test('minimizing mid-resize drops the preview', () => {
  const view = show();
  firePointer('pointerdown', handle('l'), { clientX: 628, clientY: 200 });
  firePointer('pointermove', handle('l'), { clientX: 528, clientY: 200 });
  fireEvent.keyDown(window, { key: 'Escape' });
  act(() => {
    jest.advanceTimersByTime(320);
  });
  cr = makeCr({ panel: { mode: 'pill' } });
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  cr = makeCr();
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  expect(panelEl().style.width).toBe('380px');
  expect(resizing()).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="controlRoom/__tests__/ControlRoom"`
Expected: FAIL. There are no `[data-cr-resize]` handles, no `Resize panel` button and no `Resize dock` separator, and the stored size and dock width are ignored.

- [ ] **Step 3: Write `ResizeHandles`**

Create `src/components/controlRoom/ResizeHandles.js`:

```js
import { useEffect, useRef } from 'react';
import {
  DOCK_MAX,
  DOCK_MIN,
  RESIZE_STEP,
  RESIZE_STEP_BIG,
  clampDockW,
  resizeFrom,
} from './geometry';

const FLOAT_EDGES = ['l', 'r', 'b', 'bl', 'br'];
const CURSORS = {
  l: 'ew-resize',
  r: 'ew-resize',
  b: 'ns-resize',
  bl: 'nesw-resize',
  br: 'nwse-resize',
  dock: 'ew-resize',
};

// Resize handles for the floating panel (left, right, bottom, both bottom
// corners) and the dock (its left edge). A pointer drag previews through
// onPreview and commits once on release; a lost pointer commits nothing. The
// grip (the corner facing the screen centre) and the dock edge also take
// arrow keys, which commit each step.
export default function ResizeHandles({ mode, view, side, dockW, getStart, onPreview, onCommit, onEnd }) {
  const gesture = useRef(null);

  useEffect(() => () => document.body.classList.remove('cr-resizing'), []);

  const measure = (g, e) => {
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    return g.edge === 'dock'
      ? { dockW: clampDockW(g.start.w - dx, view.vw) }
      : resizeFrom(g.edge, g.start, dx, dy, view);
  };

  const finish = () => {
    gesture.current = null;
    document.body.classList.remove('cr-resizing');
    onEnd();
  };

  const pointer = (edge) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      gesture.current = { edge, x0: e.clientX, y0: e.clientY, start: getStart() };
      document.body.style.setProperty('--cr-resize-cursor', CURSORS[edge]);
      document.body.classList.add('cr-resizing');
    },
    onPointerMove: (e) => {
      if (gesture.current) onPreview(measure(gesture.current, e));
    },
    onPointerUp: (e) => {
      const g = gesture.current;
      if (!g) return;
      const moved = e.clientX !== g.x0 || e.clientY !== g.y0;
      const next = measure(g, e);
      finish();
      if (moved) onCommit(next);
    },
    onPointerCancel: () => {
      if (gesture.current) finish();
    },
    onLostPointerCapture: () => {
      if (gesture.current) finish();
    },
  });

  const step = (e) => (e.shiftKey ? RESIZE_STEP_BIG : RESIZE_STEP);

  // The arrow pointing away from the panel grows it.
  const onGripKey = (e) => {
    const s = step(e);
    const across = side === 'bl' ? 'l' : 'r';
    const moves = {
      ArrowLeft: [across, -s, 0],
      ArrowRight: [across, s, 0],
      ArrowUp: ['b', 0, -s],
      ArrowDown: ['b', 0, s],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onCommit(resizeFrom(m[0], getStart(), m[1], m[2], view));
  };

  const onDockKey = (e) => {
    const d = { ArrowLeft: step(e), ArrowRight: -step(e) }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    onCommit({ dockW: clampDockW(dockW + d, view.vw) });
  };

  if (mode === 'dock') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize dock"
        aria-valuenow={Math.round(dockW)}
        aria-valuemin={DOCK_MIN}
        aria-valuemax={clampDockW(DOCK_MAX, view.vw)}
        tabIndex={0}
        data-cr-resize="dock"
        className="cr-rz cr-rz-dock"
        onKeyDown={onDockKey}
        {...pointer('dock')}
      />
    );
  }

  return (
    <>
      {FLOAT_EDGES.map((edge) =>
        edge === side ? (
          <button
            key={edge}
            type="button"
            aria-label="Resize panel"
            title="Drag, or use the arrow keys, to resize"
            data-cr-resize={edge}
            className={`cr-rz cr-rz-${edge} cr-rz-grip`}
            onKeyDown={onGripKey}
            {...pointer(edge)}
          />
        ) : (
          <div key={edge} aria-hidden="true" data-cr-resize={edge} className={`cr-rz cr-rz-${edge}`} {...pointer(edge)} />
        )
      )}
    </>
  );
}
```

- [ ] **Step 4: Use it in the panel**

In `src/components/controlRoom/ControlRoom.js`:

1. Replace the `./geometry` import with:

```js
import {
  NAV_H,
  clampDockW,
  clampRect,
  clampSize,
  defaultRect,
  gripSide,
  inDockZone,
  nearestCorner,
  originFor,
  pillAnchor,
  shouldUndock,
  snapToCorner,
} from './geometry';
```

and add after the `PanelChrome` import:

```js
import ResizeHandles from './ResizeHandles';
```

2. Replace the `FALLBACK_SIZE` comment and constant with:

```js
// Clamping needs only the width. A drag or resize measures the panel itself
// and falls back to this height where it can't (jsdom).
const FALLBACK_H = 420;
```

3. After `const [dragging, setDragging] = useState(false);`, add:

```js
  const [resize, setResize] = useState(null); // live preview: { rect, size } or { dockW }
```

4. In `clearDrag`, add `setResize(null);` after `setDragging(false);`, and extend its comment's first line to say "A drag or resize can be interrupted mid-gesture…".

5. After `const reduced = prefersReducedMotion();`, add:

```js
  // Sizes from the store, clamped to this window. A resize in progress
  // previews on top of them; the page reflows to the saved dock width only.
  const floatSize = clampSize(resize?.size || panel.size, view);
  const savedDockW = clampDockW(panel.dockW, view.vw);
  const dockW = resize?.dockW ?? savedDockW;
```

6. After the effect that calls `clearDrag()` when the panel leaves an open mode, add:

```js
  // A resize preview never outlives the mode it started in.
  useEffect(() => {
    setResize(null);
  }, [panel.mode, narrow]);
```

7. In the "Docked: the page reflows" effect, use the saved width:

```js
  useEffect(() => {
    const root = document.documentElement;
    if (docked) {
      root.style.setProperty('--control-dock-w', `${savedDockW}px`);
      document.body.classList.add('control-docked');
    } else {
      root.style.removeProperty('--control-dock-w');
      document.body.classList.remove('control-docked');
    }
  }, [docked, savedDockW]);
```

8. In `onPointerDown`, change the `size` line to:

```js
            size: { w: r.width || floatSize.w, h: r.height || FALLBACK_H },
```

9. In `onPointerMove`'s `fromDock` branch, change the two `PANEL_W` lines to:

```js
            d.size = { w: floatSize.w, h: d.size.h };
            d.offX = Math.min(d.offX, floatSize.w - 24);
```

10. Replace the `rect` and `style` block (from `const rect =` through `style.transformOrigin = …`) with:

```js
  const rect =
    dragRect ||
    resize?.rect ||
    clampRect(panel.rect || defaultRect(view.vw, floatSize.w), { w: floatSize.w, h: FALLBACK_H }, view);
  let style;
  if (narrow) style = { left: 0, right: 0, bottom: 0, maxHeight: '75vh' };
  else if (docked) style = { top: NAV_H, right: 0, bottom: 0, width: dockW };
  else {
    style = { left: rect.x, top: rect.y, width: floatSize.w };
    if (floatSize.h != null) style.height = floatSize.h;
    else style.maxHeight = '70vh';
  }
  style.transformOrigin = originFor(panel.corner, panel.restoreTo);
```

11. In the dock ghost, change `width: DOCK_W` to `width: savedDockW`.

12. Inside `<section>`, after the closing `</div>` of `#cr-body`, add:

```jsx
        {!narrow && (
          <ResizeHandles
            key={docked ? 'dock' : 'float'}
            mode={docked ? 'dock' : 'float'}
            view={view}
            side={gripSide(rect, floatSize.w, view.vw)}
            dockW={dockW}
            getStart={() =>
              docked
                ? { w: dockW }
                : {
                    x: rect.x,
                    y: rect.y,
                    w: floatSize.w,
                    h: rootRef.current?.getBoundingClientRect().height || FALLBACK_H,
                    fixedH: floatSize.h,
                  }
            }
            onPreview={setResize}
            onCommit={(next) =>
              docked ? panelActions.setDockW(next.dockW) : panelActions.resizeTo(next.rect, next.size)
            }
            onEnd={() => setResize(null)}
          />
        )}
```

After these edits, `PANEL_W` and `DOCK_W` are no longer used in this file. Confirm neither is still imported (the build runs with `CI=true`, so an unused import fails it).

- [ ] **Step 5: Handle styles**

In `src/components/controlRoom/controlRoom.css`:

Add `.cr-rz-grip:focus-visible` to the shared focus rule's selector list (the one extended in Task 7).

After the `.cr-dock-ghost` rule, add:

```css
/* Resize handles: hit strips on the panel's edges, above the body. The grip
   is the bottom corner facing the screen centre; the dock has one edge. */
.cr-rz { position: absolute; z-index: 2; touch-action: none; }
.cr-rz-l, .cr-rz-r { top: 36px; bottom: 14px; width: 6px; cursor: ew-resize; }
.cr-rz-l { left: 0; }
.cr-rz-r { right: 0; }
.cr-rz-b { left: 14px; right: 14px; bottom: 0; height: 6px; cursor: ns-resize; }
.cr-rz-bl, .cr-rz-br { bottom: 0; width: 14px; height: 14px; }
.cr-rz-bl { left: 0; cursor: nesw-resize; }
.cr-rz-br { right: 0; cursor: nwse-resize; }
.cr-rz-grip { color: #52525b; }
.cr-rz-grip.cr-rz-br { background: linear-gradient(135deg, transparent 50%, currentColor 50% 58%, transparent 58% 70%, currentColor 70% 78%, transparent 78%); }
.cr-rz-grip.cr-rz-bl { background: linear-gradient(225deg, transparent 50%, currentColor 50% 58%, transparent 58% 70%, currentColor 70% 78%, transparent 78%); }
.cr-rz-grip:hover, .cr-rz-grip:focus-visible { color: #ffb24d; }
.cr-rz-dock { left: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
.cr-rz-dock:hover, .cr-rz-dock:focus-visible { background: rgba(255, 178, 77, 0.35); outline: none; }
body.cr-resizing, body.cr-resizing * { cursor: var(--cr-resize-cursor, ew-resize) !important; user-select: none; }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="controlRoom|ControlRoomContext"`
Expected: PASS, every control room suite. The existing "a saved position off screen comes back on screen" test still sees `976px` / `732px`.

- [ ] **Step 7: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add src/components/controlRoom/ResizeHandles.js src/components/controlRoom/ControlRoom.js src/components/controlRoom/controlRoom.css src/components/controlRoom/__tests__/ControlRoom.test.js && git commit -m "feat(control-room): resize the floating panel and the dock"
```

---

### Task 10: Docs and verification

**Files:**
- Modify: `CLAUDE.md` (the Giveaways and Control room gotchas, plus one new gotcha)

**Interfaces:**
- Consumes: everything above.
- Produces: updated docs, a green suite and a clean CI build.

- [ ] **Step 1: Update `CLAUDE.md`**

In the **Giveaways** gotcha, replace `and the \`payout\` action logs the real win onto \`winners[i]\` and its redemption)` with:

```text
and the `payout` action logs the real win onto `winners[i]` and its redemption, and fulfils that redemption if it's still pending, since bonus wins are paid on the spot; see `api/_lib/giveawayPayout.js`)
```

In the **Control room** gotcha:

- Replace `with Giveaway and Predict tabs` with `with Giveaway, Predict and Redeem tabs`.
- Replace `two narrow listeners (live giveaways ≤5, newest hunts 3)` with `three narrow listeners (live giveaways ≤5, newest hunts 3, pending redemptions ≤50)`.
- Before `Panel state and prefs live in`, insert:

```text
The Redeem tab works the pending queue oldest first (Fulfill, two-press Refund through `/api/admin/redemptions`, rules in `controlRoom/redemptions.js`); its LED and the pill's `RED n` chip pulse only for redemptions newer than the per-browser `redeemSeenAt`, which baselines on the first snapshot so a backlog never pulses. The floating panel resizes from its left, right and bottom edges and bottom corners, and the dock from its left edge (`size`, `dockW` in the store, limits in `geometry.js`); the page reflows to the dock width on release.
```

Add a new gotcha bullet after the Watch-time tickets one:

```text
- User docs: `users/{twitchId}` can exist before its owner ever logs in, because prediction settle credits tickets with set+merge. `api/twitch-auth.js` fills in missing starter fields from `missingStarterFields` (`api/_lib/userDoc.js`) and never overwrites one that's present.
```

- [ ] **Step 2: Run the whole suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: every suite passes. If anything outside the files this plan touched fails, check whether it also fails on `main` (`git stash; git switch main`, run it, then switch back and `git stash pop`), and report it rather than fixing it here.

- [ ] **Step 3: Build like Vercel does**

Run: `CI=true npm run build`
Expected: `Compiled successfully.` with no ESLint warnings (CI turns them into errors).

- [ ] **Step 4: Browser check**

`npm start` serves the app, and the panel reads Firestore directly. It needs a staff sign-in in that browser (the owner's or a mod's). `/api/admin/*` doesn't run under `npm start`, so Fulfill and Refund return 404 here. Check those on the Vercel preview deployment for the PR, and **only with the owner's go-ahead**: they change real redemptions and refund real tickets.

At 1440×900 and at 1024×768, on `/`:

- Open the panel with backtick and go to REDEEM. The queue is oldest first, the chip counts add up, and filters switch.
- Expand a row, type a note, then press backtick and Escape inside the note: the panel stays open.
- Drag each floating edge and both bottom corners. The panel stays on screen and respects 320–720 wide and the height limits, and a top-right panel grows leftward. Use the arrow keys on the grip.
- Dock the panel, drag its left edge, and confirm the page reflows on release. Use the arrow keys on the edge.
- Use the menu: **Reset position and size** brings back 380 wide with auto height and a 400 dock.
- Minimize the panel. With pending redemptions, the pill shows `RED n`.
- Check at 320px wide that the top strip (LIVE, GVW, PRD, RED and the buttons) still fits on one line. If it doesn't, report it rather than restyling the tallies.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/control-room-redeem" ] && git add CLAUDE.md && git commit -m "docs: control room Redeem tab, resizing and payout notes"
```
