# Prediction Control Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `/admin/hunts` into a prediction control room with per-place ticket and prize rewards, a previewed transactional settle, one active round at a time, guesses hidden from viewers until lock, and Twitch chat announcements.

**Architecture:** Server logic stays in the one Vercel handler `api/admin/hunts.js`, with pure helpers in `api/_lib/` (rewards, winners, chat text) so they can be unit tested. The client gets a small mirror of the reward helpers in `src/utils/predictionRewards.js` (CRA can't import from `api/`). The admin page is split into focused components under `src/components/admin/predictions/`. Hidden guesses are enforced by `firestore.rules`; viewer components skip their entries query while a round is open.

**Tech Stack:** React 19 (CRA 5, Jest 27, Testing Library 16), Tailwind, Firebase v9 client SDK, firebase-admin on Vercel functions, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-09-27-prediction-control-room-design.md`

## Global Constraints

- Branch: `feat/prediction-control-room`. Other sessions share this checkout, so every commit command starts with `git branch --show-current | grep -qx feat/prediction-control-room &&`.
- Commit messages: short imperative conventional subjects (`feat(predictions): …`). **No `Co-Authored-By` trailer and no Claude attribution** in commits or the PR (the user's global rule overrides any default attribution).
- Run tests with: `CI=true npx react-scripts test --watchAll=false --testPathPattern "<pattern>"`. CRA sets `resetMocks: true`: `jest.fn()` implementations are cleared before every test, so set them in `beforeEach` or in the test.
- Lint touched files with: `npx eslint --max-warnings=0 <files>`. The production build fails on warnings in CI.
- Prize amounts are dollars (`$`), whatever currency the hunt uses. Tickets: whole numbers from 0 to 1,000,000. Prize amount: greater than 0 and at most 100,000, rounded to cents.
- Chat link text is exactly `goofer.tv/gamba/hunts`.
- CRA code under `src/` must not import from `api/`. Tests under `src/` may.
- Admin visual language: `orange-admin` accent, `emerald-signal` for positive states, `red-destructive` for errors, mono uppercase eyebrow labels (`text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono`).
- Do not deploy Firestore rules. The owner deploys them after the PR merges and the site deploy finishes.

## Review Focus

1. **A round open at deploy time still has legacy tiers** `{ place, tickets, cashLabel }` (plus `rewards.type`). Settling it must pay the tickets and file the cash label as a redemption, not drop it. Pinned in Task 4.
2. **The admin picks Cash or Bonus buy but leaves the amount blank.** Create must refuse with a message naming the place, not save a round whose prize silently vanished. Pinned in Task 8.
3. **A chat post fails (for example an expired bot token).** The server releases the claim; the admin page's results timer must not fire again and again while the page stays open. Pinned in Task 10.
4. **The admin reopens a locked round.** Viewer walls must stop listening and go face down: no permission-denied loop, no stale cards. Pinned in Task 7.
5. **A winner with no `users` doc, or an actual payout of exactly 0.** Settle must still succeed. Pinned in Task 4.

---

## File Structure

**Server (`api/`):**
- Create `api/_lib/predictionRewards.js`: `sanitizeRewards`, `prizeLabel`, `placeLabel`, `tierPrize`.
- Modify `api/_lib/predictions.js`: `pickWinners` tie-break on `lastEditAt`; new `buildWinners`.
- Create `api/_lib/predictionChat.js`: `openedMessage`, `lockedMessage`, `resultsMessage`, `chatMoney`, `HUNTS_LINK`.
- Modify `api/admin/hunts.js`: `create` guard, `preview_settle`, transactional `settle`, `announce` and the announce step.

**Rules:**
- Modify `firestore.rules`: entries under `hunts/{id}` readable by staff, by the entry's owner, or by anyone once the round isn't open.

**Client utils:**
- Create `src/utils/predictionRewards.js`: labels, `rewardSummary`, `winnerPrizeLabel`, rewards-editor form helpers.
- Modify `src/utils/predictionRound.js`: add `entriesSealed`.

**Viewer components:**
- Modify `src/components/PredictionWall.js` and `src/components/PredictionNumberLine.js`: sealed state while a round is open.
- Modify `src/components/PredictionSlip.js` and `src/components/PredictionWinnersReveal.js`: prize label with legacy fallback.

**Admin components (`src/components/admin/predictions/`):**
- `shared.js`: styles, `formatTs`, `errorText`, `roundsAction`.
- `RewardsEditor.js`
- `NewRoundModal.js`: moved out of the page.
- `SettleModal.js`: moved out of the page, now two steps.
- `useResultsAnnounce.js`
- `ChatStatus.js`
- `RoundControl.js`
- `EntriesTable.js`
- `RoundResults.js`

**Pages:**
- Modify `src/pages/AdminHuntsPage.js`: now only the round subscription and layout.
- Modify `src/pages/AdminRedemptionsPage.js`: hide the `0t` cost on prediction redemptions.

**Tests:**
- Create `src/test/fakeFirestore.js`: in-memory firebase-admin Firestore stand-in (not a test file; `src/test/` isn't matched by Jest).
- Create:
  - `src/__tests__/predictionRewards.test.js`
  - `src/__tests__/predictionChat.test.js`
  - `src/__tests__/adminHuntsApi.test.js`
  - `src/utils/__tests__/predictionRewards.test.js`
  - `src/components/__tests__/sealedGuesses.test.js`
  - `src/components/__tests__/PredictionWinnersReveal.test.js`
  - `src/components/admin/predictions/__tests__/announce.test.js`
  - `src/pages/__tests__/AdminHuntsControlRoom.test.js`
- Modify `src/__tests__/predictions.test.js` and `src/pages/__tests__/AdminHuntsPage.test.js`.

**Docs:**
- Modify `CLAUDE.md` (Gotchas: predictions line).

---

### Task 1: Server reward helpers

**Files:**
- Create: `api/_lib/predictionRewards.js`
- Test: `src/__tests__/predictionRewards.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `sanitizeRewards(input) → { tiers: [{ place: 1|2|3, tickets: number, prize: null | { kind: 'cash'|'bonus', amount: number } }] }`
  - `prizeLabel(prize) → string | null`
  - `placeLabel(place) → '1st' | '2nd' | '3rd' | 'Nth'`
  - `tierPrize(tier) → null | { kind, amount, label }`. Legacy `cashLabel` tiers give `{ kind: 'cash', amount: null, label: cashLabel }`.
  - Constants `MAX_TICKETS` (1000000) and `MAX_PRIZE_AMOUNT` (100000).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/predictionRewards.test.js`:

```js
import {
  sanitizeRewards,
  prizeLabel,
  placeLabel,
  tierPrize,
} from '../../api/_lib/predictionRewards';

test('a cash-only round carries no hidden tickets and ignores type', () => {
  const out = sanitizeRewards({
    type: 'cash',
    tiers: [
      { place: 1, tickets: 0, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 0, prize: { kind: 'cash', amount: 5 } },
    ],
  });
  expect(out).toEqual({
    tiers: [
      { place: 1, tickets: 0, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 0, prize: { kind: 'cash', amount: 5 } },
    ],
  });
});

test('tickets clamp to whole numbers in range', () => {
  const { tiers } = sanitizeRewards({
    tiers: [
      { place: 1, tickets: 99.9 },
      { place: 2, tickets: -5 },
      { place: 3, tickets: 5e9 },
    ],
  });
  expect(tiers.map((t) => t.tickets)).toEqual([99, 0, 1000000]);
});

test('invalid prize kinds and amounts become null; amounts round to cents', () => {
  const { tiers } = sanitizeRewards({
    tiers: [
      { place: 1, tickets: 1, prize: { kind: 'car', amount: 10 } },
      { place: 2, tickets: 1, prize: { kind: 'cash', amount: 0 } },
      { place: 3, tickets: 1, prize: { kind: 'bonus', amount: '20.456' } },
    ],
  });
  expect(tiers[0].prize).toBeNull();
  expect(tiers[1].prize).toBeNull();
  expect(tiers[2].prize).toEqual({ kind: 'bonus', amount: 20.46 });
});

test('prize amounts over the cap are dropped', () => {
  const { tiers } = sanitizeRewards({
    tiers: [{ place: 1, tickets: 0, prize: { kind: 'cash', amount: 100001 } }],
  });
  expect(tiers[0].prize).toBeNull();
});

test('1st and 2nd are always present; duplicates and bad places are dropped', () => {
  const { tiers } = sanitizeRewards({
    tiers: [
      { place: 2, tickets: 50 },
      { place: 2, tickets: 999 },
      { place: 4, tickets: 1 },
      { place: 'x' },
    ],
  });
  expect(tiers).toEqual([
    { place: 1, tickets: 0, prize: null },
    { place: 2, tickets: 50, prize: null },
  ]);
});

test('missing input still yields 1st and 2nd', () => {
  expect(sanitizeRewards(undefined).tiers.map((t) => t.place)).toEqual([1, 2]);
});

test('prize labels', () => {
  expect(prizeLabel({ kind: 'cash', amount: 10 })).toBe('$10');
  expect(prizeLabel({ kind: 'cash', amount: 12.5 })).toBe('$12.50');
  expect(prizeLabel({ kind: 'bonus', amount: 1500 })).toBe('Bonus buy $1,500');
  expect(prizeLabel(null)).toBeNull();
});

test('place labels', () => {
  expect([1, 2, 3, 4].map(placeLabel)).toEqual(['1st', '2nd', '3rd', '4th']);
});

test('tierPrize reads new and legacy tiers', () => {
  expect(tierPrize({ place: 1, tickets: 0, prize: { kind: 'bonus', amount: 20 } })).toEqual({
    kind: 'bonus',
    amount: 20,
    label: 'Bonus buy $20',
  });
  expect(tierPrize({ place: 1, tickets: 0, cashLabel: '$25 PayPal' })).toEqual({
    kind: 'cash',
    amount: null,
    label: '$25 PayPal',
  });
  expect(tierPrize({ place: 2, tickets: 50, prize: null })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "src/__tests__/predictionRewards"`
Expected: FAIL with "Cannot find module '../../api/_lib/predictionRewards'".

- [ ] **Step 3: Write the implementation**

Create `api/_lib/predictionRewards.js`:

```js
// Reward tiers for prediction rounds. Pure (no firebase-admin) so it can be
// unit tested. A tier is { place, tickets, prize } where prize is null or
// { kind: 'cash' | 'bonus', amount } in dollars. Rounds created before the
// prize field existed carry { place, tickets, cashLabel } instead.

export const MAX_TICKETS = 1000000;
export const MAX_PRIZE_AMOUNT = 100000;
const PRIZE_KINDS = ['cash', 'bonus'];
const PLACE_LABELS = { 1: '1st', 2: '2nd', 3: '3rd' };

export function placeLabel(place) {
  return PLACE_LABELS[place] || `${place}th`;
}

function sanitizePrize(prize) {
  if (!prize || !PRIZE_KINDS.includes(prize.kind)) return null;
  const amount = Number(prize.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_PRIZE_AMOUNT) return null;
  return { kind: prize.kind, amount: Math.round(amount * 100) / 100 };
}

function sanitizeTier(tier) {
  if (!tier) return null;
  const place = Number(tier.place);
  if (!Number.isInteger(place) || place < 1 || place > 3) return null;
  const raw = Number(tier.tickets);
  const tickets = Number.isFinite(raw) ? Math.min(MAX_TICKETS, Math.max(0, Math.floor(raw))) : 0;
  return { place, tickets, prize: sanitizePrize(tier.prize) };
}

// Admin input -> stored rewards. Invalid tiers and prizes are dropped, the
// first tier for a place wins, and 1st and 2nd are always present. Any legacy
// `type` field is ignored: a tier pays exactly what it lists.
export function sanitizeRewards(input) {
  const tiers = [];
  const seen = new Set();
  const list = input && Array.isArray(input.tiers) ? input.tiers : [];
  for (const raw of list) {
    const tier = sanitizeTier(raw);
    if (!tier || seen.has(tier.place)) continue;
    seen.add(tier.place);
    tiers.push(tier);
  }
  for (const place of [1, 2]) {
    if (!seen.has(place)) tiers.push({ place, tickets: 0, prize: null });
  }
  tiers.sort((a, b) => a.place - b.place);
  return { tiers };
}

function dollars(amount) {
  const n = Number(amount);
  const digits = Number.isInteger(n) ? 0 : 2;
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function prizeLabel(prize) {
  if (!prize) return null;
  if (prize.kind === 'cash') return dollars(prize.amount);
  if (prize.kind === 'bonus') return `Bonus buy ${dollars(prize.amount)}`;
  return null;
}

// The prize a stored tier pays, with its label. Legacy tiers only had a
// free-text cashLabel, which is kept as the label.
export function tierPrize(tier) {
  if (!tier) return null;
  if (tier.prize) {
    return { kind: tier.prize.kind, amount: tier.prize.amount, label: prizeLabel(tier.prize) };
  }
  if (tier.cashLabel) return { kind: 'cash', amount: null, label: tier.cashLabel };
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "src/__tests__/predictionRewards"`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add api/_lib/predictionRewards.js src/__tests__/predictionRewards.test.js && git commit -m "feat(predictions): reward tiers with tickets and an optional prize"
```

---

### Task 2: Winner records and the tie-break

**Files:**
- Modify: `api/_lib/predictions.js` (whole file)
- Test: `src/__tests__/predictions.test.js`

**Interfaces:**
- Consumes: `tierPrize` from `api/_lib/predictionRewards.js` (Task 1).
- Produces:
  - `pickWinners(entries, round) → Array<entry & { payoutDiff } | null>`, one per tier in place order. Ties go to the smaller `lastEditAt`, falling back to `submittedAt`.
  - `buildWinners(entries, round, actualPayout) → Array<Winner | null>`, one per tier in place order, where `Winner = { place, twitchId, twitchName, displayName, profileImageUrl, payoutGuess, diff, prize: { tickets, kind, amount, label }, redemptionId: null }`. `kind`, `amount` and `label` are `null` when the tier has no prize.

- [ ] **Step 1: Update the tests**

In `src/__tests__/predictions.test.js`, change the import line to:

```js
import { pickWinners, buildWinners } from '../../api/_lib/predictions';
```

Replace the test `'a tie goes to the earlier submission'` with these two:

```js
test('a tie goes to whoever settled on their final guess first', () => {
  const entries = [
    // Submitted first but edited last: loses the tie.
    { twitchId: 'editor', payoutGuess: 1100, submittedAt: ts(1), lastEditAt: ts(30) },
    { twitchId: 'steady', payoutGuess: 900, submittedAt: ts(10), lastEditAt: ts(10) },
  ];
  expect(pickWinners(entries, round(1000))[0].twitchId).toBe('steady');
});

test('without lastEditAt a tie falls back to submittedAt', () => {
  const entries = [
    { twitchId: 'late', payoutGuess: 1100, submittedAt: ts(20) },
    { twitchId: 'early', payoutGuess: 900, submittedAt: ts(10) },
  ];
  expect(pickWinners(entries, round(1000))[0].twitchId).toBe('early');
});
```

Append:

```js
test('buildWinners attaches each tier prize in place order', () => {
  const r = {
    rewards: {
      tiers: [
        { place: 2, tickets: 50, prize: null },
        { place: 1, tickets: 100, prize: { kind: 'cash', amount: 10 } },
      ],
    },
  };
  const entries = [
    { twitchId: 'a', displayName: 'A', payoutGuess: 990, submittedAt: ts(1) },
    { twitchId: 'b', displayName: 'B', payoutGuess: 1500, submittedAt: ts(2) },
  ];
  const [first, second] = buildWinners(entries, r, 1000);
  expect(first).toMatchObject({
    place: 1,
    twitchId: 'a',
    displayName: 'A',
    payoutGuess: 990,
    diff: 10,
    prize: { tickets: 100, kind: 'cash', amount: 10, label: '$10' },
    redemptionId: null,
  });
  expect(second).toMatchObject({
    place: 2,
    twitchId: 'b',
    prize: { tickets: 50, kind: null, amount: null, label: null },
  });
});

test('buildWinners keeps a legacy cashLabel prize and pads empty places', () => {
  const r = {
    rewards: {
      tiers: [
        { place: 1, tickets: 0, cashLabel: '$25 PayPal' },
        { place: 2, tickets: 5 },
      ],
    },
  };
  const out = buildWinners([{ twitchId: 'a', payoutGuess: 1, submittedAt: ts(1) }], r, 1);
  expect(out[0].prize).toEqual({ tickets: 0, kind: 'cash', amount: null, label: '$25 PayPal' });
  expect(out[1]).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "src/__tests__/predictions.test"`
Expected: FAIL. The `steady` tie-break test fails (it gets `editor`), and the `buildWinners` tests fail with "buildWinners is not a function".

- [ ] **Step 3: Write the implementation**

Replace `api/_lib/predictions.js` with:

```js
// Payout-only winner picking for prediction rounds. Pure (no firebase-admin)
// so it can be unit tested. The closest guess to the actual payout wins. A
// tie goes to whoever settled on their final guess first (lastEditAt, falling
// back to submittedAt), so editing late never keeps an early tie-break.
// Entries without a numeric guess are ignored; one slot per reward tier.

import { tierPrize } from './predictionRewards.js';

function toMs(ts) {
  return ts && ts.toMillis ? ts.toMillis() : 0;
}

function finalGuessMs(entry) {
  return toMs(entry.lastEditAt) || toMs(entry.submittedAt);
}

function sortedTiers(round) {
  return ((round && round.rewards && round.rewards.tiers) || [])
    .slice()
    .sort((a, b) => a.place - b.place);
}

export function pickWinners(entries, round) {
  const tiers = sortedTiers(round);
  const actual = round && round.actual && round.actual.payout;
  if (typeof actual !== 'number' || !Number.isFinite(actual)) {
    return tiers.map(() => null);
  }
  const ranked = entries
    .filter((e) => typeof e.payoutGuess === 'number' && Number.isFinite(e.payoutGuess))
    .map((e) => ({ ...e, payoutDiff: Math.abs(e.payoutGuess - actual) }))
    .sort((a, b) => a.payoutDiff - b.payoutDiff || finalGuessMs(a) - finalGuessMs(b));
  return tiers.map((_, i) => ranked[i] || null);
}

// Winner records for a payout: one per tier in place order, null where no
// entry placed. Settle fills in redemptionId when it files a prize.
export function buildWinners(entries, round, actualPayout) {
  const tiers = sortedTiers(round);
  const picks = pickWinners(entries, { ...round, actual: { payout: actualPayout } });
  return tiers.map((tier, i) => {
    const e = picks[i];
    if (!e) return null;
    const prize = tierPrize(tier);
    const tickets = Number(tier.tickets);
    return {
      place: tier.place,
      twitchId: e.twitchId || e.id,
      twitchName: e.twitchName || null,
      displayName: e.displayName || null,
      profileImageUrl: e.profileImageUrl || null,
      payoutGuess: e.payoutGuess,
      diff: e.payoutDiff,
      prize: {
        tickets: Number.isFinite(tickets) && tickets > 0 ? Math.floor(tickets) : 0,
        kind: prize ? prize.kind : null,
        amount: prize ? prize.amount : null,
        label: prize ? prize.label : null,
      },
      redemptionId: null,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "src/__tests__/predictions.test"`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add api/_lib/predictions.js src/__tests__/predictions.test.js && git commit -m "feat(predictions): winner records per tier, tie-break on final guess"
```

---

### Task 3: Chat message text

**Files:**
- Create: `api/_lib/predictionChat.js`
- Test: `src/__tests__/predictionChat.test.js`

**Interfaces:**
- Consumes: `placeLabel` from `api/_lib/predictionRewards.js` (Task 1).
- Produces:
  - `openedMessage(round) → string`
  - `lockedMessage(round) → string`
  - `resultsMessage(round) → string`
  - `chatMoney(value, currency = 'USD') → string`
  - `HUNTS_LINK = 'goofer.tv/gamba/hunts'`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/predictionChat.test.js`:

```js
import { openedMessage, lockedMessage, resultsMessage } from '../../api/_lib/predictionChat';

const CH = {
  source: 'communityhunts',
  bonusHuntSnapshot: { currency: 'USD', totalCost: 1200, bonusCount: 14 },
};

test('opened message lists bonuses and cost from the snapshot', () => {
  expect(openedMessage(CH)).toBe(
    'Predictions are open! Guess the final payout of the hunt (14 bonuses, $1,200 in). Closest guess wins. goofer.tv/gamba/hunts'
  );
});

test('opened message for a manual round with a cost', () => {
  expect(openedMessage({ source: 'manual', manualTotalCost: 500 })).toBe(
    'Predictions are open! Guess the final payout of the hunt ($500 in). Closest guess wins. goofer.tv/gamba/hunts'
  );
});

test('opened message without a snapshot or cost drops the brackets', () => {
  expect(openedMessage({ source: 'manual', manualTotalCost: null })).toBe(
    'Predictions are open! Guess the final payout of the hunt. Closest guess wins. goofer.tv/gamba/hunts'
  );
});

test('locked message counts guesses', () => {
  expect(lockedMessage({ entryCount: 1 })).toBe(
    'Predictions locked. 1 guess in. Revealed at goofer.tv/gamba/hunts'
  );
  expect(lockedMessage({ entryCount: 37 })).toBe(
    'Predictions locked. 37 guesses in. Revealed at goofer.tv/gamba/hunts'
  );
});

test('results message lists winners in place order', () => {
  const round = {
    ...CH,
    actual: { payout: 1843 },
    winners: [
      { place: 2, displayName: 'viewerB', payoutGuess: 1900 },
      { place: 1, displayName: 'viewerA', payoutGuess: 1810.5 },
    ],
  };
  expect(resultsMessage(round)).toBe(
    'Final payout $1,843. 1st: viewerA ($1,810.50) · 2nd: viewerB ($1,900)'
  );
});

test('results message includes 3rd place', () => {
  const round = {
    ...CH,
    actual: { payout: 100 },
    winners: [
      { place: 1, displayName: 'a', payoutGuess: 100 },
      { place: 2, displayName: 'b', payoutGuess: 90 },
      { place: 3, twitchName: 'c', payoutGuess: 80 },
    ],
  };
  expect(resultsMessage(round)).toBe(
    'Final payout $100. 1st: a ($100) · 2nd: b ($90) · 3rd: c ($80)'
  );
});

test('results message with no winners', () => {
  expect(resultsMessage({ ...CH, actual: { payout: 1843 }, winners: [] })).toBe(
    'Final payout $1,843. No guesses this round.'
  );
});

test('results use the hunt currency', () => {
  const round = {
    source: 'communityhunts',
    bonusHuntSnapshot: { currency: 'CAD' },
    actual: { payout: 1843 },
    winners: [{ place: 1, twitchName: 'viewera', payoutGuess: 1800 }],
  };
  const text = resultsMessage(round);
  expect(text).toContain('CA$1,843');
  expect(text).toContain('1st: viewera (CA$1,800)');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "predictionChat"`
Expected: FAIL with "Cannot find module '../../api/_lib/predictionChat'".

- [ ] **Step 3: Write the implementation**

Create `api/_lib/predictionChat.js`:

```js
// Fixed Twitch chat lines for prediction rounds. Pure so they can be unit
// tested; posting goes through twitchChat.js. Money uses the round's hunt
// currency (USD for manual rounds) and drops the cents on whole amounts.

import { placeLabel } from './predictionRewards.js';

export const HUNTS_LINK = 'goofer.tv/gamba/hunts';

function roundCurrency(round) {
  const snap = round && round.source === 'communityhunts' ? round.bonusHuntSnapshot : null;
  return (snap && snap.currency) || 'USD';
}

export function chatMoney(value, currency = 'USD') {
  const n = Math.round((Number(value) || 0) * 100) / 100;
  const digits = Number.isInteger(n) ? 0 : 2;
  const opts = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, ...opts }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString('en-US', opts)}`;
  }
}

export function openedMessage(round) {
  const currency = roundCurrency(round);
  const fromHunt = round.source === 'communityhunts';
  const snap = (fromHunt && round.bonusHuntSnapshot) || {};
  const bonusCount = fromHunt ? Number(snap.bonusCount) || 0 : 0;
  const cost = fromHunt ? Number(snap.totalCost) || 0 : Number(round.manualTotalCost) || 0;
  const parts = [];
  if (bonusCount > 0) parts.push(`${bonusCount} ${bonusCount === 1 ? 'bonus' : 'bonuses'}`);
  if (cost > 0) parts.push(`${chatMoney(cost, currency)} in`);
  const detail = parts.length ? ` (${parts.join(', ')})` : '';
  return `Predictions are open! Guess the final payout of the hunt${detail}. Closest guess wins. ${HUNTS_LINK}`;
}

export function lockedMessage(round) {
  const n = Number(round.entryCount) || 0;
  return `Predictions locked. ${n} ${n === 1 ? 'guess' : 'guesses'} in. Revealed at ${HUNTS_LINK}`;
}

export function resultsMessage(round) {
  const currency = roundCurrency(round);
  const payout = chatMoney(round.actual && round.actual.payout, currency);
  const winners = (round.winners || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => a.place - b.place);
  if (winners.length === 0) return `Final payout ${payout}. No guesses this round.`;
  const list = winners
    .map(
      (w) =>
        `${placeLabel(w.place)}: ${w.displayName || w.twitchName || 'anon'} (${chatMoney(w.payoutGuess, currency)})`
    )
    .join(' · ');
  return `Final payout ${payout}. ${list}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "predictionChat"`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add api/_lib/predictionChat.js src/__tests__/predictionChat.test.js && git commit -m "feat(predictions): chat lines for opened, locked and results"
```

---

### Task 4: Create guard, settle preview and transactional settle

**Files:**
- Create: `src/test/fakeFirestore.js`
- Modify: `api/admin/hunts.js` (whole file)
- Test: `src/__tests__/adminHuntsApi.test.js`

**Interfaces:**
- Consumes:
  - `buildWinners(entries, round, actualPayout)` (Task 2).
  - `sanitizeRewards` and `placeLabel` (Task 1).
- Produces (HTTP, `POST /api/admin/hunts`):
  - `create` → 200 `{ ok, id }`, or 400 `{ error: 'ROUND_ACTIVE' }`. Stores `rewards` (sanitized), `announce` (boolean) and `announced: { opened: null, locked: null, results: null }`.
  - `preview_settle { id, actualPayout }` → 200 `{ ok, actualPayout, entryCount, placements: Array<Winner|null> }`, or 400 `NOT_LOCKED` / `ALREADY_SETTLED` / `PREDICTIONS_DISABLED` / `actualPayout required`.
  - `settle { id, actualPayout }` → 200 `{ ok, winners: Winner[] }` (each with `redemptionId` set when a prize was filed), or the same 400 codes. It runs in one transaction.
  - Test helper `createFakeFirestore()` returning `{ db, FieldValue, Timestamp, reset, seed, read, paths, snapshot, setClock }`.

- [ ] **Step 1: Write the fake Firestore helper**

Create `src/test/fakeFirestore.js`:

```js
// In-memory stand-in for the slice of firebase-admin Firestore that the API
// handlers use, for handler tests. It supports docs and subcollections by
// path, auto ids, where('==' | 'in'), transactions and batches (writes apply
// when the callback or commit finishes; a throw discards them), set with
// merge, dotted update paths, and the serverTimestamp / increment sentinels.

export function createFakeFirestore() {
  let docs = new Map();
  let autoId = 0;
  let clock = 1000000;

  const Timestamp = {
    fromMillis: (ms) => ({ toMillis: () => ms }),
  };
  const FieldValue = {
    serverTimestamp: () => ({ __op: 'serverTimestamp' }),
    increment: (n) => ({ __op: 'increment', n }),
  };

  function resolve(value, prev) {
    if (value && value.__op === 'serverTimestamp') return Timestamp.fromMillis(clock);
    if (value && value.__op === 'increment') return (typeof prev === 'number' ? prev : 0) + value.n;
    return value;
  }

  // Applies fields onto a copy of target, resolving sentinels. With dotted,
  // 'a.b' writes the nested field b of map a (Firestore update semantics).
  function applyFields(target, fields, dotted) {
    const out = { ...target };
    for (const [key, value] of Object.entries(fields)) {
      const parts = dotted ? key.split('.') : [key];
      let node = out;
      for (let i = 0; i < parts.length - 1; i += 1) {
        node[parts[i]] = { ...(node[parts[i]] || {}) };
        node = node[parts[i]];
      }
      const last = parts[parts.length - 1];
      node[last] = resolve(value, node[last]);
    }
    return out;
  }

  function write(path, kind, data, opts) {
    const prev = docs.get(path);
    if (kind === 'update') {
      if (prev === undefined) throw new Error(`fake firestore: no document to update: ${path}`);
      docs.set(path, applyFields(prev, data, true));
    } else if (opts && opts.merge) {
      docs.set(path, applyFields(prev || {}, data, false));
    } else {
      docs.set(path, applyFields({}, data, false));
    }
  }

  function snapshotOf(path) {
    const data = docs.get(path);
    return {
      id: path.split('/').pop(),
      ref: docRef(path),
      exists: data !== undefined,
      data: () => (data === undefined ? undefined : { ...data }),
    };
  }

  function docRef(path) {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => snapshotOf(path),
      set: async (data, opts) => write(path, 'set', data, opts),
      update: async (data) => write(path, 'update', data),
      delete: async () => {
        docs.delete(path);
      },
      collection: (name) => collectionRef(`${path}/${name}`),
    };
  }

  function childPaths(path) {
    const prefix = `${path}/`;
    return [...docs.keys()]
      .filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
      .sort();
  }

  function matches(data, { field, op, value }) {
    if (op === '==') return data[field] === value;
    if (op === 'in') return value.includes(data[field]);
    throw new Error(`fake firestore: unsupported where op ${op}`);
  }

  function collectionRef(path, filters = []) {
    return {
      path,
      doc: (id) => docRef(`${path}/${id || `auto${(autoId += 1)}`}`),
      add: async (data) => {
        const ref = docRef(`${path}/auto${(autoId += 1)}`);
        await ref.set(data);
        return ref;
      },
      where: (field, op, value) => collectionRef(path, [...filters, { field, op, value }]),
      orderBy: () => collectionRef(path, filters),
      limit: () => collectionRef(path, filters),
      get: async () => {
        const out = childPaths(path)
          .filter((p) => filters.every((f) => matches(docs.get(p), f)))
          .map(snapshotOf);
        return { docs: out, empty: out.length === 0, size: out.length };
      },
    };
  }

  function queuedWriter() {
    const queue = [];
    const api = {
      set: (ref, data, opts) => {
        queue.push(() => write(ref.path, 'set', data, opts));
        return api;
      },
      update: (ref, data) => {
        queue.push(() => write(ref.path, 'update', data));
        return api;
      },
      delete: (ref) => {
        queue.push(() => docs.delete(ref.path));
        return api;
      },
      flush: () => queue.splice(0).forEach((apply) => apply()),
    };
    return api;
  }

  const db = {
    collection: (name) => collectionRef(name),
    batch: () => {
      const w = queuedWriter();
      return { set: w.set, update: w.update, delete: w.delete, commit: async () => w.flush() };
    },
    runTransaction: async (fn) => {
      const w = queuedWriter();
      const tx = { get: (target) => target.get(), set: w.set, update: w.update, delete: w.delete };
      const result = await fn(tx);
      w.flush();
      return result;
    },
  };

  return {
    db,
    FieldValue,
    Timestamp,
    reset() {
      docs = new Map();
      autoId = 0;
      clock = 1000000;
    },
    seed(path, data) {
      docs.set(path, { ...data });
    },
    read(path) {
      const d = docs.get(path);
      return d === undefined ? undefined : { ...d };
    },
    paths(collectionPath) {
      return childPaths(collectionPath);
    },
    snapshot() {
      return Object.fromEntries([...docs].map(([k, v]) => [k, { ...v }]));
    },
    setClock(ms) {
      clock = ms;
    },
  };
}
```

- [ ] **Step 2: Write the failing handler tests**

Create `src/__tests__/adminHuntsApi.test.js`:

```js
/**
 * @jest-environment node
 */
import handler from '../../api/admin/hunts';
import { __fake } from '../../api/_lib/firebaseAdmin.js';
import { sendChannelMessage } from '../../api/_lib/twitchChat.js';

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
jest.mock('../../api/_lib/communityHunts.js', () => ({
  ...jest.requireActual('../../api/_lib/communityHunts.js'),
  getCurrentHunt: jest.fn(),
  getHunt: jest.fn(),
}));

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

const ts = (ms) => __fake.Timestamp.fromMillis(ms);

function seedRound(id, data = {}) {
  __fake.seed(`hunts/${id}`, {
    title: 'Friday',
    source: 'manual',
    manualTotalCost: 500,
    bonusHuntSnapshot: null,
    acceptPredictions: true,
    acceptSuggestions: false,
    rewards: {
      tiers: [
        { place: 1, tickets: 100, prize: { kind: 'cash', amount: 10 } },
        { place: 2, tickets: 50, prize: null },
      ],
    },
    announce: false,
    announced: { opened: null, locked: null, results: null },
    status: 'locked',
    entryCount: 0,
    winners: [],
    ...data,
  });
}

function seedEntry(roundId, twitchId, payoutGuess, ms) {
  __fake.seed(`hunts/${roundId}/entries/${twitchId}`, {
    twitchId,
    twitchName: twitchId,
    displayName: twitchId.toUpperCase(),
    profileImageUrl: null,
    payoutGuess,
    submittedAt: ts(ms),
    lastEditAt: ts(ms),
    editCount: 1,
  });
}

beforeEach(() => {
  __fake.reset();
  sendChannelMessage.mockResolvedValue({ ok: true });
});

test('create refuses while a prediction round is open', async () => {
  seedRound('r1', { status: 'open' });
  const res = await call({ action: 'create', title: 'Next', source: 'manual', rewards: {} });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'ROUND_ACTIVE' });
  expect(__fake.paths('hunts')).toEqual(['hunts/r1']);
});

test('a suggestion-only round does not block create; rewards are sanitized', async () => {
  seedRound('s1', { status: 'open', acceptPredictions: false, acceptSuggestions: true });
  const res = await call({
    action: 'create',
    title: 'Next',
    source: 'manual',
    manualTotalCost: 500,
    rewards: { type: 'cash', tiers: [{ place: 1, tickets: 0, prize: { kind: 'cash', amount: 10 } }] },
  });
  expect(res.statusCode).toBe(200);
  const round = __fake.read(`hunts/${res.body.id}`);
  expect(round.status).toBe('open');
  expect(round.announce).toBe(true);
  expect(round.rewards).toEqual({
    tiers: [
      { place: 1, tickets: 0, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 0, prize: null },
    ],
  });
});

test('preview_settle needs a locked round and writes nothing', async () => {
  seedRound('r1', { status: 'open' });
  const open = await call({ action: 'preview_settle', id: 'r1', actualPayout: 1000 });
  expect(open.statusCode).toBe(400);
  expect(open.body).toEqual({ error: 'NOT_LOCKED' });

  seedRound('r1', { status: 'locked' });
  seedEntry('r1', 'tw1', 990, 1);
  seedEntry('r1', 'tw2', 1500, 2);
  const before = __fake.snapshot();
  const res = await call({ action: 'preview_settle', id: 'r1', actualPayout: 1000 });
  expect(res.statusCode).toBe(200);
  expect(res.body.entryCount).toBe(2);
  expect(res.body.placements[0]).toMatchObject({
    place: 1,
    twitchId: 'tw1',
    diff: 10,
    prize: { tickets: 100, label: '$10' },
  });
  expect(res.body.placements[1]).toMatchObject({ place: 2, twitchId: 'tw2', prize: { tickets: 50, label: null } });
  expect(__fake.snapshot()).toEqual(before);
});

test('settle refuses an open round', async () => {
  seedRound('r1', { status: 'open' });
  const res = await call({ action: 'settle', id: 'r1', actualPayout: 1000 });
  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: 'NOT_LOCKED' });
});

test('settle rejects an empty payout', async () => {
  seedRound('r1');
  const res = await call({ action: 'settle', id: 'r1', actualPayout: '' });
  expect(res.statusCode).toBe(400);
  expect(__fake.read('hunts/r1').status).toBe('locked');
});

// Review Focus 5: a winner without a users doc still gets paid.
test('settle pays tickets, files the prize and settles; a second settle pays nothing', async () => {
  seedRound('r1');
  seedEntry('r1', 'tw1', 990, 1);
  seedEntry('r1', 'tw2', 1500, 2);
  __fake.seed('users/tw2', { tickets: 5, totalEarned: 5 });

  const res = await call({ action: 'settle', id: 'r1', actualPayout: 1000 });
  expect(res.statusCode).toBe(200);
  expect(__fake.read('users/tw1')).toMatchObject({ tickets: 100, totalEarned: 100 });
  expect(__fake.read('users/tw2')).toMatchObject({ tickets: 55, totalEarned: 55 });
  expect(__fake.paths('ticket_ledger')).toHaveLength(2);
  const [redemptionPath] = __fake.paths('redemptions');
  expect(__fake.read(redemptionPath)).toMatchObject({
    userId: 'tw1',
    kind: 'prediction',
    status: 'pending',
    note: '$10',
    prizeKind: 'cash',
    prizeAmount: 10,
    itemName: 'Friday · 1st place',
    cost: 0,
    predictionRoundId: 'r1',
  });
  const round = __fake.read('hunts/r1');
  expect(round.status).toBe('settled');
  expect(round.actual).toEqual({ payout: 1000 });
  expect(round.winners.map((w) => w.twitchId)).toEqual(['tw1', 'tw2']);
  expect(round.winners[0].redemptionId).toBe(redemptionPath.split('/')[1]);
  expect(round.winners[1].redemptionId).toBeNull();

  const again = await call({ action: 'settle', id: 'r1', actualPayout: 1000 });
  expect(again.statusCode).toBe(400);
  expect(again.body).toEqual({ error: 'ALREADY_SETTLED' });
  expect(__fake.paths('ticket_ledger')).toHaveLength(2);
  expect(__fake.read('users/tw1').tickets).toBe(100);
});

// Review Focus 1: rounds opened before this change keep their cash label.
test('settle keeps a legacy cashLabel prize', async () => {
  seedRound('r1', {
    rewards: {
      type: 'both',
      tiers: [
        { place: 1, tickets: 100, cashLabel: '$25 PayPal' },
        { place: 2, tickets: 50, cashLabel: null },
      ],
    },
  });
  seedEntry('r1', 'tw1', 1000, 1);
  const res = await call({ action: 'settle', id: 'r1', actualPayout: 1000 });
  expect(res.statusCode).toBe(200);
  const [redemptionPath] = __fake.paths('redemptions');
  expect(__fake.read(redemptionPath).note).toBe('$25 PayPal');
  expect(__fake.read('users/tw1').tickets).toBe(100);
});

// Review Focus 5: a dead hunt can pay out 0.
test('a payout of 0 settles', async () => {
  seedRound('r1');
  seedEntry('r1', 'tw1', 0, 1);
  const res = await call({ action: 'settle', id: 'r1', actualPayout: 0 });
  expect(res.statusCode).toBe(200);
  expect(__fake.read('hunts/r1').winners[0]).toMatchObject({ twitchId: 'tw1', diff: 0 });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "adminHuntsApi"`
Expected: FAIL. `create refuses…` gets 200 instead of 400, `preview_settle` returns `UNKNOWN_ACTION`, `settle refuses an open round` returns 200, and the new settle fields are missing.

- [ ] **Step 4: Rewrite the handler**

Replace `api/admin/hunts.js` with:

```js
import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';
import {
  getCurrentHunt,
  getHunt,
  toRoundSnapshot,
  huntResult,
  CommunityHuntsError,
} from '../_lib/communityHunts.js';
import { buildWinners } from '../_lib/predictions.js';
import { sanitizeRewards, placeLabel } from '../_lib/predictionRewards.js';

// Admin prediction-round lifecycle. A round can have payout predictions and/or
// slot suggestions enabled. Predictions go open -> locked -> settled, and only
// one prediction round can be open or locked at a time. Rounds snapshot
// GooferG's current communityhunts.gg hunt (or take a manual cost).
//
// POST { action, ...payload }

// Thrown inside actions (and transactions) to answer with a 4xx code.
class ActionError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function parsePayout(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Settling (and previewing it) needs a locked round, so no guess can change
// between the preview and the payout.
function assertLocked(round) {
  if (!round.acceptPredictions) throw new ActionError(400, 'PREDICTIONS_DISABLED');
  if (round.status === 'settled') throw new ActionError(400, 'ALREADY_SETTLED');
  if (round.status !== 'locked') throw new ActionError(400, 'NOT_LOCKED');
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { action, ...payload } = req.body || {};

  try {
    if (action === 'preview_hunt') {
      const hunt = await getCurrentHunt();
      if (!hunt) return res.status(404).json({ error: 'NO_CURRENT_HUNT' });
      return res.status(200).json({ ok: true, snapshot: toRoundSnapshot(hunt) });
    }

    if (action === 'create') {
      const title = String(payload.title || '').trim();
      const contextNote = String(payload.contextNote || '').trim() || null;
      if (!title) return res.status(400).json({ error: 'title required' });

      const acceptPredictions = payload.acceptPredictions !== false;
      const acceptSuggestions = !!payload.acceptSuggestions;
      if (!acceptPredictions && !acceptSuggestions) {
        return res.status(400).json({ error: 'enable predictions or suggestions' });
      }

      const suggestionCapRaw = Number(payload.suggestionCap);
      const suggestionCap = acceptSuggestions
        ? (Number.isInteger(suggestionCapRaw) && suggestionCapRaw >= 1
            ? Math.min(20, suggestionCapRaw)
            : 3)
        : 0;

      const source = payload.source === 'manual' ? 'manual' : 'communityhunts';
      let bonusHuntSnapshot = null;
      let manualTotalCost = null;

      if (source === 'communityhunts') {
        const hunt = await getCurrentHunt();
        if (!hunt) return res.status(400).json({ error: 'NO_CURRENT_HUNT' });
        bonusHuntSnapshot = toRoundSnapshot(hunt);
      } else {
        manualTotalCost =
          payload.manualTotalCost === '' || payload.manualTotalCost == null
            ? null
            : Number(payload.manualTotalCost);
      }

      const rewards = sanitizeRewards(payload.rewards);
      const announce = payload.announce !== false;
      const now = FieldValue.serverTimestamp();
      const huntsCol = adminDb.collection('hunts');
      const ref = huntsCol.doc();

      await adminDb.runTransaction(async (tx) => {
        // The viewer page shows only the newest round, so a new round would
        // hide an active prediction round.
        const active = await tx.get(huntsCol.where('status', 'in', ['open', 'locked']));
        if (active.docs.some((d) => d.data().acceptPredictions)) {
          throw new ActionError(400, 'ROUND_ACTIVE');
        }
        tx.set(ref, {
          title,
          contextNote,
          // Feature flags
          acceptPredictions,
          acceptSuggestions,
          suggestionCap,
          // Source data
          source,
          bonusHuntSnapshot,
          manualTotalCost,
          // Prediction config
          rewards,
          announce,
          announced: { opened: null, locked: null, results: null },
          // Prediction lifecycle state
          status: 'open',
          entryCount: 0,
          suggestionCount: 0,
          actual: null,
          winners: [],
          // Timestamps
          openedAt: now,
          lockedAt: null,
          settledAt: null,
          createdAt: now,
          createdBy: admin.email,
        });
      });
      return res.status(200).json({ ok: true, id: ref.id });
    }

    // All other actions need an existing hunt.
    const { id } = payload;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const ref = adminDb.collection('hunts').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const round = snap.data();

    if (action === 'hunt_result') {
      const huntId = round.bonusHuntSnapshot && round.bonusHuntSnapshot.huntId;
      if (round.source !== 'communityhunts' || !huntId) {
        return res.status(400).json({ error: 'NOT_COMMUNITYHUNTS_ROUND' });
      }
      const hunt = await getHunt(huntId);
      return res.status(200).json({ ok: true, result: huntResult(hunt) });
    }

    if (action === 'lock') {
      if (!round.acceptPredictions) {
        return res.status(400).json({ error: 'PREDICTIONS_DISABLED' });
      }
      if (round.status !== 'open') return res.status(400).json({ error: 'NOT_OPEN' });
      await ref.update({ status: 'locked', lockedAt: FieldValue.serverTimestamp() });
      return res.status(200).json({ ok: true });
    }

    if (action === 'reopen') {
      if (round.status !== 'locked') return res.status(400).json({ error: 'NOT_LOCKED' });
      await ref.update({ status: 'open', lockedAt: null });
      return res.status(200).json({ ok: true });
    }

    if (action === 'preview_settle') {
      assertLocked(round);
      const actualPayout = parsePayout(payload.actualPayout);
      if (actualPayout == null) return res.status(400).json({ error: 'actualPayout required' });
      const entriesSnap = await ref.collection('entries').get();
      const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.status(200).json({
        ok: true,
        actualPayout,
        entryCount: entries.length,
        placements: buildWinners(entries, round, actualPayout),
      });
    }

    if (action === 'settle') {
      const actualPayout = parsePayout(payload.actualPayout);
      if (actualPayout == null) return res.status(400).json({ error: 'actualPayout required' });

      // One transaction: a second settle (another tab, a mod) re-reads the
      // round, finds it settled and pays nothing.
      const winners = await adminDb.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists) throw new ActionError(404, 'NOT_FOUND');
        const current = fresh.data();
        assertLocked(current);
        const entriesSnap = await tx.get(ref.collection('entries'));
        const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const now = FieldValue.serverTimestamp();
        const settled = [];

        for (const winner of buildWinners(entries, current, actualPayout)) {
          if (!winner) continue;
          const place = placeLabel(winner.place);
          const { tickets, kind, amount, label } = winner.prize;

          if (tickets > 0) {
            // set+merge so a missing user doc can't fail the whole settle.
            tx.set(
              adminDb.collection('users').doc(winner.twitchId),
              {
                tickets: FieldValue.increment(tickets),
                totalEarned: FieldValue.increment(tickets),
                updatedAt: now,
              },
              { merge: true }
            );
            tx.set(adminDb.collection('ticket_ledger').doc(), {
              userId: winner.twitchId,
              delta: tickets,
              reason: 'prediction',
              refId: id,
              note: `Prediction ${place} place — ${current.title}`,
              createdAt: now,
            });
          }

          let redemptionId = null;
          if (label) {
            const redemptionRef = adminDb.collection('redemptions').doc();
            redemptionId = redemptionRef.id;
            tx.set(redemptionRef, {
              userId: winner.twitchId,
              twitchName: winner.twitchName,
              displayName: winner.displayName,
              profileImageUrl: winner.profileImageUrl,
              itemId: id,
              itemName: `${current.title} · ${place} place`,
              cost: 0,
              kind: 'prediction',
              status: 'pending',
              note: label,
              prizeKind: kind,
              prizeAmount: amount,
              predictionRoundId: id,
              huntId: id,
              createdAt: now,
              fulfilledAt: null,
            });
          }
          settled.push({ ...winner, redemptionId });
        }

        tx.update(ref, {
          actual: { payout: actualPayout },
          winners: settled,
          status: 'settled',
          settledAt: now,
          settledBy: admin.email,
        });
        return settled;
      });
      return res.status(200).json({ ok: true, winners });
    }

    if (action === 'delete') {
      // Hard delete hunt + entries + suggestions subcollections.
      const subcols = ['entries', 'suggestions'];
      for (const sub of subcols) {
        const subSnap = await ref.collection(sub).get();
        if (!subSnap.empty) {
          for (let i = 0; i < subSnap.docs.length; i += 400) {
            const b = adminDb.batch();
            subSnap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
            await b.commit();
          }
        }
      }
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'UNKNOWN_ACTION' });
  } catch (err) {
    if (err instanceof ActionError) {
      return res.status(err.status).json({ error: err.code });
    }
    if (err instanceof CommunityHuntsError) {
      const notFound = err.status === 404;
      return res
        .status(notFound ? 404 : 502)
        .json({ error: notFound ? 'HUNT_NOT_FOUND' : 'COMMUNITYHUNTS_UNAVAILABLE', detail: err.code });
    }
    console.error('hunts admin error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "adminHuntsApi|predictions.test|predictionRewards"`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `npx eslint --max-warnings=0 api/admin/hunts.js src/test/fakeFirestore.js`
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add src/test/fakeFirestore.js api/admin/hunts.js src/__tests__/adminHuntsApi.test.js && git commit -m "feat(predictions): one active round, settle preview, transactional settle"
```

---

### Task 5: Chat announcements in the handler

**Files:**
- Modify: `api/admin/hunts.js`
- Test: `src/__tests__/adminHuntsApi.test.js`

**Interfaces:**
- Consumes:
  - `openedMessage`, `lockedMessage` and `resultsMessage` (Task 3).
  - `sendChannelMessage(text)` from `api/_lib/twitchChat.js` (existing; throws on failure).
- Produces (HTTP):
  - `create` → 200 `{ ok, id, announce: { posted, reason? } }`. `announce` is only stored as true when predictions are on.
  - `lock` → 200 `{ ok, announce }`.
  - `reopen` clears `announced.locked`.
  - `announce { id, event: 'opened'|'locked'|'results' }` → 200 `{ ok, announce: { posted: true } | { posted: false, reason: 'disabled'|'already'|<error message> } }`, or 400 `INVALID_EVENT` / `WRONG_STATUS`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/adminHuntsApi.test.js`:

```js
test('create posts the opened message once and records it', async () => {
  const res = await call({ action: 'create', title: 'Friday', source: 'manual', manualTotalCost: 500 });
  expect(res.body.announce).toEqual({ posted: true });
  expect(sendChannelMessage).toHaveBeenCalledTimes(1);
  expect(sendChannelMessage.mock.calls[0][0]).toMatch(/^Predictions are open! .*\(\$500 in\)/);
  expect(__fake.read(`hunts/${res.body.id}`).announced.opened).toBeTruthy();
});

test('announce off posts nothing on create or lock', async () => {
  const res = await call({ action: 'create', title: 'Friday', source: 'manual', announce: false });
  expect(res.body.announce).toEqual({ posted: false, reason: 'disabled' });
  const lock = await call({ action: 'lock', id: res.body.id });
  expect(lock.body.announce).toEqual({ posted: false, reason: 'disabled' });
  expect(sendChannelMessage).not.toHaveBeenCalled();
});

test('a suggestion-only round never announces', async () => {
  const res = await call({
    action: 'create',
    title: 'Slots',
    source: 'manual',
    acceptPredictions: false,
    acceptSuggestions: true,
  });
  expect(__fake.read(`hunts/${res.body.id}`).announce).toBe(false);
  expect(sendChannelMessage).not.toHaveBeenCalled();
});

test('rounds from before announcements never post', async () => {
  seedRound('old', { status: 'settled', announce: undefined, announced: undefined });
  const res = await call({ action: 'announce', id: 'old', event: 'results' });
  expect(res.body.announce).toEqual({ posted: false, reason: 'disabled' });
  expect(sendChannelMessage).not.toHaveBeenCalled();
});

test('lock posts the locked message with the guess count, once', async () => {
  seedRound('r1', { status: 'open', announce: true, entryCount: 37 });
  const lock = await call({ action: 'lock', id: 'r1' });
  expect(lock.body.announce).toEqual({ posted: true });
  expect(sendChannelMessage).toHaveBeenCalledWith(
    'Predictions locked. 37 guesses in. Revealed at goofer.tv/gamba/hunts'
  );
  const again = await call({ action: 'announce', id: 'r1', event: 'locked' });
  expect(again.body.announce).toEqual({ posted: false, reason: 'already' });
  expect(sendChannelMessage).toHaveBeenCalledTimes(1);
});

test('reopen clears the locked claim so the next lock posts again', async () => {
  seedRound('r1', { status: 'open', announce: true, entryCount: 3 });
  await call({ action: 'lock', id: 'r1' });
  await call({ action: 'reopen', id: 'r1' });
  expect(__fake.read('hunts/r1').announced.locked).toBeNull();
  await call({ action: 'lock', id: 'r1' });
  expect(sendChannelMessage).toHaveBeenCalledTimes(2);
});

test('a failed post releases the claim so a retry posts', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  seedRound('r1', { status: 'settled', announce: true, actual: { payout: 1843 }, winners: [] });
  sendChannelMessage.mockRejectedValueOnce(new Error('CHAT_DROPPED:spam'));
  const first = await call({ action: 'announce', id: 'r1', event: 'results' });
  expect(first.body.announce).toEqual({ posted: false, reason: 'CHAT_DROPPED:spam' });
  expect(__fake.read('hunts/r1').announced.results).toBeNull();
  const retry = await call({ action: 'announce', id: 'r1', event: 'results' });
  expect(retry.body.announce).toEqual({ posted: true });
  expect(sendChannelMessage).toHaveBeenLastCalledWith('Final payout $1,843. No guesses this round.');
});

test('announce checks the event and the round status', async () => {
  seedRound('r1', { status: 'locked', announce: true });
  const early = await call({ action: 'announce', id: 'r1', event: 'results' });
  expect(early.statusCode).toBe(400);
  expect(early.body).toEqual({ error: 'WRONG_STATUS' });
  const bad = await call({ action: 'announce', id: 'r1', event: 'hype' });
  expect(bad.statusCode).toBe(400);
  expect(bad.body).toEqual({ error: 'INVALID_EVENT' });
  expect(sendChannelMessage).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "adminHuntsApi"`
Expected: FAIL. The new tests fail (`announce` is undefined in responses, and `announce` returns `UNKNOWN_ACTION`). The Task 4 tests still pass.

- [ ] **Step 3: Add the announce step to the handler**

In `api/admin/hunts.js`, make the following edits.

**a) Imports.** Add these after the `predictionRewards.js` import:

```js
import { openedMessage, lockedMessage, resultsMessage } from '../_lib/predictionChat.js';
import { sendChannelMessage } from '../_lib/twitchChat.js';
```

**b) The announce step.** Insert this directly after the `assertLocked` function:

```js
const MESSAGES = { opened: openedMessage, locked: lockedMessage, results: resultsMessage };
// Round statuses in which each chat line may post (null = any).
const EVENT_STATUSES = { opened: null, locked: ['locked', 'settled'], results: ['settled'] };

// Posts one chat line per round event. The event is claimed on the round in a
// transaction before posting, so two callers can't both post; a failed post
// releases the claim so Retry can post it. A chat failure never throws.
async function announceEvent(ref, event) {
  const claim = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ActionError(404, 'NOT_FOUND');
    const round = snap.data();
    if (!round.announce) return { result: { posted: false, reason: 'disabled' } };
    const allowed = EVENT_STATUSES[event];
    if (allowed && !allowed.includes(round.status)) throw new ActionError(400, 'WRONG_STATUS');
    if (round.announced && round.announced[event]) {
      return { result: { posted: false, reason: 'already' } };
    }
    tx.update(ref, { [`announced.${event}`]: FieldValue.serverTimestamp() });
    return { round };
  });
  if (claim.result) return claim.result;

  try {
    await sendChannelMessage(MESSAGES[event](claim.round));
    return { posted: true };
  } catch (err) {
    console.error('prediction chat announce failed', err);
    await ref.update({ [`announced.${event}`]: null });
    return { posted: false, reason: err.message };
  }
}
```

**c) `create`.** Replace

```js
      const announce = payload.announce !== false;
```

with

```js
      // The chat lines are about guessing, so a suggestion-only round never posts.
      const announce = acceptPredictions && payload.announce !== false;
```

and replace the create's final line

```js
      return res.status(200).json({ ok: true, id: ref.id });
```

with

```js
      const announceResult = announce
        ? await announceEvent(ref, 'opened')
        : { posted: false, reason: 'disabled' };
      return res.status(200).json({ ok: true, id: ref.id, announce: announceResult });
```

**d) `lock`.** Replace

```js
      await ref.update({ status: 'locked', lockedAt: FieldValue.serverTimestamp() });
      return res.status(200).json({ ok: true });
```

with

```js
      await ref.update({ status: 'locked', lockedAt: FieldValue.serverTimestamp() });
      const announce = await announceEvent(ref, 'locked');
      return res.status(200).json({ ok: true, announce });
```

**e) `reopen`.** Replace

```js
      await ref.update({ status: 'open', lockedAt: null });
```

with

```js
      // The next lock posts again, with the new guess count.
      await ref.update({ status: 'open', lockedAt: null, 'announced.locked': null });
```

**f) The `announce` action.** Insert this directly before `if (action === 'delete') {`:

```js
    if (action === 'announce') {
      const event = payload.event;
      if (!Object.prototype.hasOwnProperty.call(MESSAGES, event)) {
        return res.status(400).json({ error: 'INVALID_EVENT' });
      }
      const announce = await announceEvent(ref, event);
      return res.status(200).json({ ok: true, announce });
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "adminHuntsApi"`
Expected: PASS (all Task 4 and Task 5 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint --max-warnings=0 api/admin/hunts.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add api/admin/hunts.js src/__tests__/adminHuntsApi.test.js && git commit -m "feat(predictions): post opened, locked and results lines to chat"
```

---

### Task 6: Client reward helpers and prize labels

**Files:**
- Create: `src/utils/predictionRewards.js`
- Modify:
  - `src/components/PredictionSlip.js` (the settled result line near line 309)
  - `src/components/PredictionWinnersReveal.js` (lines 58-63)
  - `src/pages/AdminRedemptionsPage.js` (lines 146-149)
- Test:
  - `src/utils/__tests__/predictionRewards.test.js`
  - `src/components/__tests__/PredictionWinnersReveal.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all from `src/utils/predictionRewards.js`):
  - `placeLabel(place) → string`
  - `prizeLabel(prize) → string | null`
  - `winnerPrizeLabel(prize) → string | null` (`prize.label || prize.cashLabel`)
  - `rewardSummary(tier) → string`, e.g. `'100t + $10 cash'`, `'50t'`, `'Bonus buy $20'`, `'No reward'`.
  - `PRIZE_KINDS: Array<{ value: 'none'|'cash'|'bonus', label }>`
  - `MAX_PRIZE_AMOUNT = 100000`
  - The rewards-editor form shape `RewardsForm = { rows: [{ place, tickets: string, prizeKind: 'none'|'cash'|'bonus', prizeAmount: string }] (always places 1, 2, 3), thirdEnabled: boolean }`, with:
    - `defaultRewardsForm() → RewardsForm`
    - `rewardsFormFrom(round | null) → RewardsForm`
    - `lastRewardsRound(rounds) → round | null`
    - `validateRewardsForm(form) → string | null`
    - `rewardsPayload(form) → { tiers: [{ place, tickets: number, prize: null | { kind, amount: number } }] }`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/__tests__/predictionRewards.test.js`:

```js
import {
  prizeLabel,
  winnerPrizeLabel,
  rewardSummary,
  defaultRewardsForm,
  rewardsFormFrom,
  lastRewardsRound,
  validateRewardsForm,
  rewardsPayload,
} from '../predictionRewards';

const ROUND = {
  acceptPredictions: true,
  rewards: {
    tiers: [
      { place: 1, tickets: 200, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 75, prize: null },
      { place: 3, tickets: 0, prize: { kind: 'bonus', amount: 20 } },
    ],
  },
};

test('labels', () => {
  expect(prizeLabel({ kind: 'cash', amount: 12.5 })).toBe('$12.50');
  expect(prizeLabel({ kind: 'bonus', amount: 20 })).toBe('Bonus buy $20');
  expect(winnerPrizeLabel({ tickets: 1, label: 'Bonus buy $20' })).toBe('Bonus buy $20');
  expect(winnerPrizeLabel({ tickets: 1, cashLabel: '$25 PayPal' })).toBe('$25 PayPal');
  expect(winnerPrizeLabel(null)).toBeNull();
});

test('reward summaries', () => {
  expect(rewardSummary({ tickets: 100, prize: { kind: 'cash', amount: 10 } })).toBe('100t + $10 cash');
  expect(rewardSummary({ tickets: 50, prize: null })).toBe('50t');
  expect(rewardSummary({ tickets: 0, prize: { kind: 'bonus', amount: 20 } })).toBe('Bonus buy $20');
  expect(rewardSummary({ tickets: 0, cashLabel: '$25 PayPal' })).toBe('$25 PayPal');
  expect(rewardSummary({ tickets: 0, prize: null })).toBe('No reward');
});

test('the form defaults to 100/50 tickets with 3rd place off', () => {
  const form = defaultRewardsForm();
  expect(form.thirdEnabled).toBe(false);
  expect(form.rows.map((r) => [r.place, r.tickets, r.prizeKind])).toEqual([
    [1, '100', 'none'],
    [2, '50', 'none'],
    [3, '25', 'none'],
  ]);
});

test('the form copies the last round rewards', () => {
  const form = rewardsFormFrom(ROUND);
  expect(form.thirdEnabled).toBe(true);
  expect(form.rows[0]).toEqual({ place: 1, tickets: '200', prizeKind: 'cash', prizeAmount: '10' });
  expect(form.rows[1]).toEqual({ place: 2, tickets: '75', prizeKind: 'none', prizeAmount: '' });
  expect(form.rows[2]).toEqual({ place: 3, tickets: '0', prizeKind: 'bonus', prizeAmount: '20' });
});

test('legacy rounds do not seed the form', () => {
  const legacy = { acceptPredictions: true, rewards: { type: 'tickets', tiers: [{ place: 1, tickets: 5, cashLabel: null }] } };
  expect(rewardsFormFrom(legacy)).toEqual(defaultRewardsForm());
  expect(lastRewardsRound([{ acceptPredictions: false }, legacy, ROUND])).toBe(ROUND);
  expect(lastRewardsRound([])).toBeNull();
});

test('a prize needs an amount', () => {
  const form = defaultRewardsForm();
  form.rows[1].prizeKind = 'cash';
  expect(validateRewardsForm(form)).toMatch(/2nd place/);
  form.rows[1].prizeAmount = '5';
  expect(validateRewardsForm(form)).toBeNull();
  form.rows[2].prizeKind = 'bonus'; // 3rd is off, so it is not checked
  expect(validateRewardsForm(form)).toBeNull();
  form.rows[1].prizeAmount = '100001';
  expect(validateRewardsForm(form)).toMatch(/2nd place/);
});

test('the payload sends tiers without a type', () => {
  const form = rewardsFormFrom(ROUND);
  expect(rewardsPayload(form)).toEqual({
    tiers: [
      { place: 1, tickets: 200, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 75, prize: null },
      { place: 3, tickets: 0, prize: { kind: 'bonus', amount: 20 } },
    ],
  });
  form.thirdEnabled = false;
  expect(rewardsPayload(form).tiers.map((t) => t.place)).toEqual([1, 2]);
});
```

Create `src/components/__tests__/PredictionWinnersReveal.test.js`:

```js
import { render, screen } from '@testing-library/react';
import PredictionWinnersReveal from '../PredictionWinnersReveal';

const base = { status: 'settled', source: 'manual', actual: { payout: 1000 } };

test('shows the prize label of a settled winner', () => {
  render(
    <PredictionWinnersReveal
      round={{
        ...base,
        winners: [
          {
            place: 1,
            twitchId: 'a',
            displayName: 'viewerA',
            payoutGuess: 990,
            diff: 10,
            prize: { tickets: 100, kind: 'bonus', amount: 20, label: 'Bonus buy $20' },
          },
        ],
      }}
    />
  );
  expect(screen.getByText('Bonus buy $20')).toBeTruthy();
  expect(screen.getByText('+100 tickets')).toBeTruthy();
});

test('falls back to the legacy cashLabel', () => {
  render(
    <PredictionWinnersReveal
      round={{
        ...base,
        winners: [
          {
            place: 1,
            twitchId: 'a',
            displayName: 'viewerA',
            payoutGuess: 990,
            diff: 10,
            prize: { tickets: null, cashLabel: '$25 PayPal' },
          },
        ],
      }}
    />
  );
  expect(screen.getByText('$25 PayPal')).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "utils/__tests__/predictionRewards|PredictionWinnersReveal"`
Expected: FAIL. The util test fails with "Cannot find module '../predictionRewards'", and the Reveal test fails to find 'Bonus buy $20'.

- [ ] **Step 3: Write the client helpers**

Create `src/utils/predictionRewards.js`:

```js
// Client-side reward helpers for prediction rounds: labels (mirroring
// api/_lib/predictionRewards.js, which CRA can't import) and the admin
// rewards-editor form. Prize amounts are dollars.

export const MAX_PRIZE_AMOUNT = 100000;
const PLACE_LABELS = { 1: '1st', 2: '2nd', 3: '3rd' };

export const PRIZE_KINDS = [
  { value: 'none', label: 'No prize' },
  { value: 'cash', label: 'Cash' },
  { value: 'bonus', label: 'Bonus buy' },
];

export function placeLabel(place) {
  return PLACE_LABELS[place] || `${place}th`;
}

function dollars(amount) {
  const n = Number(amount);
  const digits = Number.isInteger(n) ? 0 : 2;
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function prizeLabel(prize) {
  if (!prize) return null;
  if (prize.kind === 'cash') return dollars(prize.amount);
  if (prize.kind === 'bonus') return `Bonus buy ${dollars(prize.amount)}`;
  return null;
}

// What a settled winner won, for display. Rounds settled before prizes
// existed stored a free-text cashLabel.
export function winnerPrizeLabel(prize) {
  if (!prize) return null;
  return prize.label || prize.cashLabel || null;
}

// One tier as "100t + $10 cash", "50t", "Bonus buy $20" or "No reward".
export function rewardSummary(tier) {
  const parts = [];
  const tickets = Number(tier && tier.tickets) || 0;
  if (tickets > 0) parts.push(`${tickets}t`);
  const prize = tier && tier.prize;
  const label = prizeLabel(prize);
  if (label) parts.push(prize.kind === 'cash' ? `${label} cash` : label);
  else if (tier && tier.cashLabel) parts.push(tier.cashLabel);
  return parts.length ? parts.join(' + ') : 'No reward';
}

const DEFAULT_ROWS = [
  { place: 1, tickets: '100', prizeKind: 'none', prizeAmount: '' },
  { place: 2, tickets: '50', prizeKind: 'none', prizeAmount: '' },
  { place: 3, tickets: '25', prizeKind: 'none', prizeAmount: '' },
];

export function defaultRewardsForm() {
  return { rows: DEFAULT_ROWS.map((row) => ({ ...row })), thirdEnabled: false };
}

function hasPrizeShape(round) {
  const tiers = round && round.rewards && round.rewards.tiers;
  return (
    Array.isArray(tiers) &&
    tiers.length > 0 &&
    tiers.every((t) => t && Object.prototype.hasOwnProperty.call(t, 'prize'))
  );
}

// Newest round (the list is newest first) whose rewards can seed the form.
export function lastRewardsRound(rounds) {
  return (rounds || []).find((r) => r && r.acceptPredictions && hasPrizeShape(r)) || null;
}

export function rewardsFormFrom(round) {
  const form = defaultRewardsForm();
  if (!hasPrizeShape(round)) return form;
  for (const tier of round.rewards.tiers) {
    const row = form.rows.find((r) => r.place === tier.place);
    if (!row) continue;
    row.tickets = String(tier.tickets ?? 0);
    row.prizeKind = tier.prize ? tier.prize.kind : 'none';
    row.prizeAmount = tier.prize ? String(tier.prize.amount) : '';
    if (tier.place === 3) form.thirdEnabled = true;
  }
  return form;
}

function activeRows(form) {
  return form.rows.filter((row) => row.place !== 3 || form.thirdEnabled);
}

// The first incomplete prize as a message, else null.
export function validateRewardsForm(form) {
  for (const row of activeRows(form)) {
    if (row.prizeKind === 'none') continue;
    const n = Number(row.prizeAmount);
    if (row.prizeAmount === '' || !Number.isFinite(n) || n <= 0 || n > MAX_PRIZE_AMOUNT) {
      return `Enter a prize amount for ${placeLabel(row.place)} place (up to $100,000)`;
    }
  }
  return null;
}

export function rewardsPayload(form) {
  return {
    tiers: activeRows(form).map((row) => ({
      place: row.place,
      tickets: Math.max(0, Math.floor(Number(row.tickets) || 0)),
      prize:
        row.prizeKind === 'none'
          ? null
          : { kind: row.prizeKind, amount: Number(row.prizeAmount) },
    })),
  };
}
```

- [ ] **Step 4: Show prize labels on the viewer pages**

In `src/components/PredictionWinnersReveal.js`, add to the imports:

```js
import { winnerPrizeLabel } from '../utils/predictionRewards';
```

Replace

```jsx
        {winner.prize?.cashLabel && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 border border-current text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            <Trophy size={11} aria-hidden="true" />
            {winner.prize.cashLabel}
          </span>
        )}
```

with

```jsx
        {winnerPrizeLabel(winner.prize) && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 border border-current text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            <Trophy size={11} aria-hidden="true" />
            {winnerPrizeLabel(winner.prize)}
          </span>
        )}
```

In `src/components/PredictionSlip.js`, add to the imports:

```js
import { winnerPrizeLabel } from '../utils/predictionRewards';
```

Replace

```jsx
                {yourWinnerEntry.prize?.cashLabel ? ` · ${yourWinnerEntry.prize.cashLabel}` : ''}
```

with

```jsx
                {winnerPrizeLabel(yourWinnerEntry.prize) ? ` · ${winnerPrizeLabel(yourWinnerEntry.prize)}` : ''}
```

- [ ] **Step 5: Hide the zero ticket cost on prediction redemptions**

In `src/pages/AdminRedemptionsPage.js`, replace

```jsx
                    {r.displayName || r.twitchName || r.userId} · {formatTs(r.createdAt)} ·{' '}
                    <span className="text-emerald-signal/70">{r.cost}t</span>
```

with

```jsx
                    {r.displayName || r.twitchName || r.userId} · {formatTs(r.createdAt)}
                    {r.kind !== 'prediction' && (
                      <>
                        {' · '}
                        <span className="text-emerald-signal/70">{r.cost}t</span>
                      </>
                    )}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "utils/__tests__/predictionRewards|PredictionWinnersReveal|PredictionSlip"`
Expected: PASS.

- [ ] **Step 7: Lint**

Run: `npx eslint --max-warnings=0 src/utils/predictionRewards.js src/components/PredictionSlip.js src/components/PredictionWinnersReveal.js src/pages/AdminRedemptionsPage.js`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add src/utils/predictionRewards.js src/utils/__tests__/predictionRewards.test.js src/components/PredictionSlip.js src/components/PredictionWinnersReveal.js src/components/__tests__/PredictionWinnersReveal.test.js src/pages/AdminRedemptionsPage.js && git commit -m "feat(predictions): client reward helpers and prize labels"
```

---

### Task 7: Guesses hidden until lock

**Files:**
- Modify:
  - `firestore.rules` (the `hunts/{id}` entries block, lines 130-133)
  - `src/utils/predictionRound.js`
  - `src/components/PredictionWall.js`
  - `src/components/PredictionNumberLine.js`
- Test: `src/components/__tests__/sealedGuesses.test.js`

**Interfaces:**
- Consumes: `useAuth()` from `src/contexts/AuthContext.js` (existing; returns `{ isStaff }`, or `{}` outside the provider).
- Produces: `entriesSealed(round, isStaff) → boolean` in `src/utils/predictionRound.js`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/sealedGuesses.test.js`:

```js
import { render, screen } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';
import PredictionWall from '../PredictionWall';
import PredictionNumberLine from '../PredictionNumberLine';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: jest.fn(),
}));
let mockIsStaff = false;
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isStaff: mockIsStaff }),
}));

const ROUND = { id: 'r1', status: 'open', acceptPredictions: true, entryCount: 37, source: 'manual' };

beforeEach(() => {
  mockIsStaff = false;
  onSnapshot.mockImplementation(() => () => {});
});

test('viewers see a face-down wall while open and nothing is queried', () => {
  render(<PredictionWall round={ROUND} />);
  expect(screen.getByText(/37 guesses pinned face down/i)).toBeTruthy();
  expect(onSnapshot).not.toHaveBeenCalled();
});

test('staff see the live wall while open', () => {
  mockIsStaff = true;
  render(<PredictionWall round={ROUND} />);
  expect(onSnapshot).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/face down/i)).toBeNull();
});

test('the wall subscribes once the round locks', () => {
  render(<PredictionWall round={{ ...ROUND, status: 'locked' }} />);
  expect(onSnapshot).toHaveBeenCalledTimes(1);
});

// Review Focus 4: reopening must stop the listener and reseal the wall.
test('reopening a locked round unsubscribes and reseals', () => {
  const unsub = jest.fn();
  onSnapshot.mockImplementation(() => unsub);
  const { rerender } = render(<PredictionWall round={{ ...ROUND, status: 'locked' }} />);
  rerender(<PredictionWall round={{ ...ROUND, status: 'open' }} />);
  expect(unsub).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/pinned face down/i)).toBeTruthy();
});

test('a permission error falls back to the face-down wall', () => {
  onSnapshot.mockImplementation((q, next, error) => {
    error(new Error('permission-denied'));
    return () => {};
  });
  render(<PredictionWall round={{ ...ROUND, status: 'locked' }} />);
  expect(screen.getByText(/pinned face down/i)).toBeTruthy();
});

test('the number line stays hidden and unqueried while sealed', () => {
  const { container } = render(<PredictionNumberLine round={ROUND} />);
  expect(container.firstChild).toBeNull();
  expect(onSnapshot).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "sealedGuesses"`
Expected: FAIL. No "pinned face down" text renders, and `onSnapshot` is called for viewers.

- [ ] **Step 3: Add `entriesSealed`**

Append to `src/utils/predictionRound.js`:

```js
// While a round is open only staff (and each viewer, for their own entry) may
// read its entries (firestore.rules), so viewer pages must not query them.
export function entriesSealed(round, isStaff) {
  return !!round && round.status === 'open' && !isStaff;
}
```

- [ ] **Step 4: Seal the wall**

In `src/components/PredictionWall.js`:

Change `import { Pin } from 'lucide-react';` to `import { Pin, EyeOff } from 'lucide-react';`, then replace `import { roundCurrency } from '../utils/predictionRound';` with:

```js
import { roundCurrency, entriesSealed } from '../utils/predictionRound';
import { useAuth } from '../contexts/AuthContext';
```

Replace

```js
export default function PredictionWall({ round }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!round?.id) return undefined;
    const q = query(
      collection(db, 'hunts', round.id, 'entries'),
      orderBy('submittedAt', 'asc'),
      fLimit(MAX_CARDS + 1)
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [round?.id]);
```

with

```js
export default function PredictionWall({ round }) {
  const { isStaff } = useAuth();
  const sealed = entriesSealed(round, isStaff);
  const [entries, setEntries] = useState([]);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    setEntries([]);
    setDenied(false);
    if (!round?.id || sealed) return undefined;
    const q = query(
      collection(db, 'hunts', round.id, 'entries'),
      orderBy('submittedAt', 'asc'),
      fLimit(MAX_CARDS + 1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      // Denied when the round reopened before this listener caught up.
      () => setDenied(true)
    );
    return unsub;
  }, [round?.id, sealed]);
```

Insert this directly before `if (entries.length === 0) {`:

```jsx
  if (sealed || denied) {
    const count = round?.entryCount ?? 0;
    return (
      <div className="border border-dashed border-white/15 bg-zinc-card/20 py-12 text-center">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/15 mb-3 text-white/35">
          <EyeOff size={14} aria-hidden="true" />
        </div>
        <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">
          {count} {count === 1 ? 'guess' : 'guesses'} pinned face down
        </p>
        <p className="text-sm text-white/55">Revealed when predictions lock.</p>
      </div>
    );
  }
```

- [ ] **Step 5: Seal the number line**

In `src/components/PredictionNumberLine.js`, replace `import { roundCurrency } from '../utils/predictionRound';` with:

```js
import { roundCurrency, entriesSealed } from '../utils/predictionRound';
import { useAuth } from '../contexts/AuthContext';
```

Replace

```js
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!round?.id || !round?.acceptPredictions) return undefined;
    const q = query(
      collection(db, 'hunts', round.id, 'entries'),
      orderBy('submittedAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [round?.id, round?.acceptPredictions]);
```

with

```js
  const { isStaff } = useAuth();
  const sealed = entriesSealed(round, isStaff);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    setEntries([]);
    if (!round?.id || !round?.acceptPredictions || sealed) return undefined;
    const q = query(
      collection(db, 'hunts', round.id, 'entries'),
      orderBy('submittedAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => setEntries([])
    );
    return unsub;
  }, [round?.id, round?.acceptPredictions, sealed]);
```

- [ ] **Step 6: Update the Firestore rules**

In `firestore.rules`, inside `match /hunts/{id} {`, replace

```
      match /entries/{entryId} {
        allow read: if true;
        allow write: if false;
      }
```

with

```
      // Guesses stay hidden while the round is open: staff and the entry's
      // owner (entry id = Twitch id = uid) can read; everyone after lock.
      match /entries/{entryId} {
        allow read: if isStaff()
          || (isSignedIn() && request.auth.uid == entryId)
          || get(/databases/$(database)/documents/hunts/$(id)).data.status != 'open';
        allow write: if false;
      }
```

Make sure you edit the block under `match /hunts/{id}` (around line 127), not an `entries` block of another collection.

- [ ] **Step 7: Run tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "sealedGuesses|HuntsPage|PredictionSlip"`
Expected: PASS.

- [ ] **Step 8: Lint**

Run: `npx eslint --max-warnings=0 src/components/PredictionWall.js src/components/PredictionNumberLine.js src/utils/predictionRound.js`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add firestore.rules src/utils/predictionRound.js src/components/PredictionWall.js src/components/PredictionNumberLine.js src/components/__tests__/sealedGuesses.test.js && git commit -m "feat(predictions): keep guesses face down until the round locks"
```

---

### Task 8: Rewards editor and the new-round form

**Files:**
- Create:
  - `src/components/admin/predictions/shared.js`
  - `src/components/admin/predictions/RewardsEditor.js`
  - `src/components/admin/predictions/NewRoundModal.js`
- Modify:
  - `src/pages/AdminHuntsPage.js` (remove `DEFAULT_FORM` and `NewRoundModal`; import the new file)
  - `src/pages/__tests__/AdminHuntsPage.test.js`

**Interfaces:**
- Consumes: from `src/utils/predictionRewards.js` (Task 6), `rewardsFormFrom`, `rewardsPayload`, `validateRewardsForm`, `PRIZE_KINDS` and `placeLabel`.
- Produces:
  - `shared.js`:
    - `inputCls: string`
    - `formatTs(ts) → string`
    - `errorText(code) → string`
    - `roundsAction(body) → Promise<{ ok: boolean, data: object }>`. It never throws; a network failure gives `{ ok: false, data: { error: 'Network error' } }`.
  - `RewardsEditor` (default export): props `{ value: RewardsForm, onChange(RewardsForm) }`. Inputs are labelled `"<1st|2nd|3rd> place tickets"`, `"… place prize"` (select) and `"… place prize amount"`.
  - `NewRoundModal` (default export): props `{ onClose, onCreated(id), lastRound?: round | null }`. It sends `create` with `rewards: { tiers }` and `announce`.

- [ ] **Step 1: Write the failing tests**

In `src/pages/__tests__/AdminHuntsPage.test.js`, replace

```js
import { SettleModal, NewRoundModal } from '../AdminHuntsPage';
```

with

```js
import { SettleModal } from '../AdminHuntsPage';
import NewRoundModal from '../../components/admin/predictions/NewRoundModal';
```

Append:

```js
const LAST = {
  acceptPredictions: true,
  rewards: {
    tiers: [
      { place: 1, tickets: 200, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 75, prize: null },
    ],
  },
};

function mockCreateFlow(createReply = reply(true, { ok: true, id: 'new1', announce: { posted: true } })) {
  authedFetch.mockImplementation((url, init) => {
    const body = JSON.parse(init.body);
    if (body.action === 'preview_hunt') {
      return reply(true, {
        ok: true,
        snapshot: { huntId: 'h2', totalCost: 500, currency: 'CAD', bonusCount: 4, status: 'live', endedAt: null },
      });
    }
    return createReply;
  });
}

const createCall = () =>
  authedFetch.mock.calls.map(([, init]) => JSON.parse(init.body)).find((b) => b.action === 'create');

test('the form starts from the last round rewards', () => {
  mockCreateFlow();
  render(<NewRoundModal lastRound={LAST} onClose={() => {}} onCreated={() => {}} />);
  expect(screen.getByLabelText('1st place tickets').value).toBe('200');
  expect(screen.getByLabelText('1st place prize').value).toBe('cash');
  expect(screen.getByLabelText('1st place prize amount').value).toBe('10');
  expect(screen.getByLabelText('2nd place tickets').value).toBe('75');
});

test('create sends each place tickets and prize, and the announce switch', async () => {
  mockCreateFlow();
  const onCreated = jest.fn();
  render(<NewRoundModal onClose={() => {}} onCreated={onCreated} />);
  fireEvent.change(screen.getByPlaceholderText('Friday night bonus hunt'), { target: { value: 'Friday' } });
  fireEvent.change(screen.getByLabelText('1st place prize'), { target: { value: 'bonus' } });
  fireEvent.change(screen.getByLabelText('1st place prize amount'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: /start round/i }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new1'));
  const body = createCall();
  expect(body.rewards).toEqual({
    tiers: [
      { place: 1, tickets: 100, prize: { kind: 'bonus', amount: 20 } },
      { place: 2, tickets: 50, prize: null },
    ],
  });
  expect(body.announce).toBe(true);
  expect(body.rewards).not.toHaveProperty('type');
});

// Review Focus 2: a prize without an amount must not silently disappear.
test('a prize without an amount blocks create', async () => {
  mockCreateFlow();
  render(<NewRoundModal onClose={() => {}} onCreated={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText('Friday night bonus hunt'), { target: { value: 'Friday' } });
  fireEvent.change(screen.getByLabelText('1st place prize'), { target: { value: 'cash' } });
  fireEvent.click(screen.getByRole('button', { name: /start round/i }));
  expect(await screen.findByText(/enter a prize amount for 1st place/i)).toBeTruthy();
  expect(createCall()).toBeUndefined();
});

test('an active round blocks create with a readable error', async () => {
  mockCreateFlow(reply(false, { error: 'ROUND_ACTIVE' }));
  render(<NewRoundModal onClose={() => {}} onCreated={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText('Friday night bonus hunt'), { target: { value: 'Friday' } });
  fireEvent.click(screen.getByRole('button', { name: /start round/i }));
  expect(await screen.findByText(/settle or delete the current round first/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "AdminHuntsPage"`
Expected: FAIL with "Cannot find module '../../components/admin/predictions/NewRoundModal'".

- [ ] **Step 3: Create the shared module**

Create `src/components/admin/predictions/shared.js`:

```js
import { authedFetch } from '../../../utils/authedFetch';

// Shared pieces for the prediction control room components.

export const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150';

export function formatTs(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts.toMillis ? ts.toMillis() : ts);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ERROR_TEXT = {
  ROUND_ACTIVE: 'Settle or delete the current round first.',
  NOT_LOCKED: 'Lock the round before settling.',
  NOT_OPEN: 'The round is not open.',
  ALREADY_SETTLED: 'This round is already settled.',
  PREDICTIONS_DISABLED: 'This round has predictions turned off.',
  WRONG_STATUS: 'Not available in this round state.',
  NO_CURRENT_HUNT: 'No communityhunts.gg hunt found yet.',
  COMMUNITYHUNTS_UNAVAILABLE: 'communityhunts.gg is unavailable. Try again or use manual entry.',
};

export function errorText(code) {
  return ERROR_TEXT[code] || code || 'Failed';
}

// POST one action to the admin rounds endpoint. Never throws.
export async function roundsAction(body) {
  try {
    const res = await authedFetch('/api/admin/hunts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, data: data || {} };
  } catch {
    return { ok: false, data: { error: 'Network error' } };
  }
}
```

- [ ] **Step 4: Create the rewards editor**

Create `src/components/admin/predictions/RewardsEditor.js`:

```jsx
import { PRIZE_KINDS, placeLabel } from '../../../utils/predictionRewards';
import { inputCls } from './shared';

const miniLabel =
  'block text-[0.5625rem] font-bold tracking-eyebrow uppercase text-white/40 mb-1 font-mono';

// Controlled editor for a round's reward tiers. value / onChange use the
// RewardsForm shape from utils/predictionRewards (rows of strings plus
// thirdEnabled).
export default function RewardsEditor({ value, onChange }) {
  const setRow = (place, patch) =>
    onChange({
      ...value,
      rows: value.rows.map((row) => (row.place === place ? { ...row, ...patch } : row)),
    });
  const rows = value.rows.filter((row) => row.place !== 3 || value.thirdEnabled);

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const name = `${placeLabel(row.place)} place`;
        return (
          <div key={row.place} className="grid grid-cols-[2.5rem_1fr_1fr_1fr] gap-2 items-end">
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono pb-2.5">
              {placeLabel(row.place)}
            </span>
            <div>
              <span className={miniLabel} aria-hidden="true">tickets</span>
              <input
                type="number"
                min="0"
                step="1"
                aria-label={`${name} tickets`}
                value={row.tickets}
                onChange={(e) => setRow(row.place, { tickets: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <span className={miniLabel} aria-hidden="true">prize</span>
              <select
                aria-label={`${name} prize`}
                value={row.prizeKind}
                onChange={(e) => setRow(row.place, { prizeKind: e.target.value })}
                className={inputCls}
              >
                {PRIZE_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </div>
            {row.prizeKind !== 'none' ? (
              <div>
                <span className={miniLabel} aria-hidden="true">amount ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`${name} prize amount`}
                  value={row.prizeAmount}
                  onChange={(e) => setRow(row.place, { prizeAmount: e.target.value })}
                  placeholder="10"
                  className={inputCls}
                />
              </div>
            ) : (
              <div />
            )}
          </div>
        );
      })}
      <label className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          checked={value.thirdEnabled}
          onChange={(e) => onChange({ ...value, thirdEnabled: e.target.checked })}
        />
        <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono">
          Enable 3rd place
        </span>
      </label>
    </div>
  );
}
```

- [ ] **Step 5: Move `NewRoundModal` into its own file**

Create `src/components/admin/predictions/NewRoundModal.js` like this:
1. Start it with this header:

```js
import { useEffect, useState } from 'react';
import { X, Check, RefreshCcw } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { formatHuntDate } from '../../../utils/huntFormat';
import {
  rewardsFormFrom,
  rewardsPayload,
  validateRewardsForm,
} from '../../../utils/predictionRewards';
import RewardsEditor from './RewardsEditor';
import { inputCls, errorText, roundsAction } from './shared';
```

2. Below it, paste the code from `src/pages/AdminHuntsPage.js` starting at `const DEFAULT_FORM = () => ({` through the closing `}` of `export function NewRoundModal(...)` (the line just before `export function SettleModal`). Delete that code from `AdminHuntsPage.js`.

3. Then apply these edits to the new file.

**a)** Replace the whole `DEFAULT_FORM` definition with:

```js
// The rewards editor starts from the last round's rewards (or 100/50 tickets).
const DEFAULT_FORM = (lastRound) => ({
  title: '',
  contextNote: '',
  acceptPredictions: true,
  acceptSuggestions: false,
  suggestionCap: 3,
  source: 'communityhunts',
  manualTotalCost: '',
  rewards: rewardsFormFrom(lastRound),
  announce: true,
});
```

**b)** Replace

```js
export function NewRoundModal({ onClose, onCreated }) {
  const [form, setForm] = useState(DEFAULT_FORM());
```

with

```js
export default function NewRoundModal({ onClose, onCreated, lastRound = null }) {
  const [form, setForm] = useState(() => DEFAULT_FORM(lastRound));
```

**c)** Replace the whole `fetchPreview` function with:

```js
  const fetchPreview = async () => {
    setPreviewing(true);
    setPreviewError(null);
    const { ok, data } = await roundsAction({ action: 'preview_hunt' });
    if (ok) {
      setPreview(data.snapshot);
    } else {
      setPreviewError(data.error || 'Failed');
      setPreview(null);
    }
    setPreviewing(false);
  };
```

**d)** Replace the whole `submit` function with:

```js
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError('Title required');
    if (!form.acceptPredictions && !form.acceptSuggestions) {
      return setError('Enable predictions or suggestions');
    }
    if (form.acceptPredictions) {
      const rewardsError = validateRewardsForm(form.rewards);
      if (rewardsError) return setError(rewardsError);
    }

    setSubmitting(true);
    const { ok, data } = await roundsAction({
      action: 'create',
      title: form.title,
      contextNote: form.contextNote,
      acceptPredictions: form.acceptPredictions,
      acceptSuggestions: form.acceptSuggestions,
      suggestionCap: form.acceptSuggestions ? form.suggestionCap : 0,
      source: form.source,
      manualTotalCost: form.source === 'manual' ? form.manualTotalCost : null,
      rewards: form.acceptPredictions ? rewardsPayload(form.rewards) : { tiers: [] },
      announce: form.acceptPredictions && form.announce,
    });
    setSubmitting(false);
    if (ok) onCreated(data.id);
    else setError(errorText(data.error));
  };
```

**e)** In the Features section, find the end of the suggestion-cap block:

```jsx
                </label>
              )}
            </div>
          </div>

          {/* Rewards (only if predictions enabled) */}
```

Insert the announce switch between that `)}` and the `</div>` after it, so it reads:

```jsx
                </label>
              )}
              {form.acceptPredictions && (
                <button
                  type="button"
                  onClick={() => set('announce', !form.announce)}
                  aria-pressed={form.announce}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 border transition-colors duration-150 ${
                    form.announce
                      ? 'border-emerald-signal/40 bg-emerald-signal/5 text-white-body'
                      : 'border-white/10 bg-zinc-broadcast/40 text-white/50 hover:text-white-body'
                  }`}
                >
                  <span className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono">
                    <span className={`w-1.5 h-1.5 rounded-full ${form.announce ? 'bg-emerald-signal' : 'bg-white/25'}`} />
                    Announce in chat <span className="text-white/30 normal-case font-normal text-[0.625rem]">posts on open, lock and results</span>
                  </span>
                  <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                    {form.announce ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Rewards (only if predictions enabled) */}
```

**f)** Replace the whole rewards block, from `{/* Rewards (only if predictions enabled) */}` down to the `)}` just before `{error && (`, with:

```jsx
          {/* Rewards (only if predictions enabled) */}
          {form.acceptPredictions && (
            <div>
              <p className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                <span className="text-orange-admin tabular-nums">05</span> Rewards
              </p>
              <RewardsEditor
                value={form.rewards}
                onChange={(rewards) => setForm((f) => ({ ...f, rewards }))}
              />
            </div>
          )}
```

- [ ] **Step 6: Point the page at the new file**

In `src/pages/AdminHuntsPage.js`:
1. Add `import NewRoundModal from '../components/admin/predictions/NewRoundModal';` next to the other imports. The page still renders `<NewRoundModal onClose=… onCreated=… />` unchanged.
2. Run `npx eslint --max-warnings=0 src/pages/AdminHuntsPage.js` and remove every import it reports as unused. Expect `Check`, `formatHuntDate` and `formatMoney`, plus `const inputCls` only if nothing left in the page uses it. `SettleModal` still uses `inputCls`, so keep it.

- [ ] **Step 7: Run tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "AdminHuntsPage"`
Expected: PASS. That includes the two existing create-preview tests and the four new ones.

- [ ] **Step 8: Lint**

Run: `npx eslint --max-warnings=0 src/pages/AdminHuntsPage.js src/components/admin/predictions/`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add src/components/admin/predictions/shared.js src/components/admin/predictions/RewardsEditor.js src/components/admin/predictions/NewRoundModal.js src/pages/AdminHuntsPage.js src/pages/__tests__/AdminHuntsPage.test.js && git commit -m "feat(predictions): per-place rewards editor and chat switch in the new-round form"
```

---

### Task 9: Two-step settle window

**Files:**
- Create: `src/components/admin/predictions/SettleModal.js`
- Modify:
  - `src/pages/AdminHuntsPage.js` (remove `SettleModal`; import the new file)
  - `src/pages/__tests__/AdminHuntsPage.test.js`

**Interfaces:**
- Consumes:
  - `roundsAction` and `errorText` from `shared.js` (Task 8).
  - `placeLabel` from `src/utils/predictionRewards.js` (Task 6).
  - `roundCurrency` from `src/utils/predictionRound.js`.
  - The `preview_settle` / `settle` responses (Task 4).
- Produces: `SettleModal` (default export) with props `{ round, onClose, onSettled(data) }`. Step 1 is labelled "Actual final payout", with buttons "Fill from hunt" and "Preview winners". Step 2 has "Back" and "Confirm & pay".

- [ ] **Step 1: Update and add tests**

In `src/pages/__tests__/AdminHuntsPage.test.js`, replace

```js
import { SettleModal } from '../AdminHuntsPage';
```

with

```js
import SettleModal from '../../components/admin/predictions/SettleModal';
```

In the `ROUND` constant, add a `rewards` field so it reads:

```js
const ROUND = {
  id: 'r1',
  title: 'Sunday',
  source: 'communityhunts',
  acceptPredictions: true,
  bonusHuntSnapshot: { huntId: 'h1', currency: 'CAD', totalCost: 3103.62, bonusCount: 18 },
  rewards: {
    tiers: [
      { place: 1, tickets: 100, prize: { kind: 'cash', amount: 10 } },
      { place: 2, tickets: 50, prize: null },
    ],
  },
};
```

In the test `'settling with an empty payout is blocked'`, change `/reveal winners/i` to `/preview winners/i`.

Append:

```js
const PREVIEW = {
  ok: true,
  actualPayout: 1000,
  entryCount: 3,
  placements: [
    {
      place: 1,
      twitchId: 'a',
      displayName: 'viewerA',
      payoutGuess: 990,
      diff: 10,
      prize: { tickets: 100, kind: 'cash', amount: 10, label: '$10' },
    },
    null,
  ],
};

async function toPreview(onSettled = () => {}) {
  render(<SettleModal round={ROUND} onClose={() => {}} onSettled={onSettled} />);
  fireEvent.change(screen.getByLabelText(/actual final payout/i), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: /preview winners/i }));
  await screen.findByText('viewerA');
}

test('Preview shows who would place before anything is paid', async () => {
  authedFetch.mockReturnValue(reply(true, PREVIEW));
  await toPreview();
  expect(screen.getByText('$10')).toBeTruthy();
  expect(screen.getByText(/no entry/i)).toBeTruthy();
  expect(authedFetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({
    action: 'preview_settle',
    id: 'r1',
    actualPayout: 1000,
  });
});

test('Confirm & pay settles with the previewed payout', async () => {
  authedFetch
    .mockReturnValueOnce(reply(true, PREVIEW))
    .mockReturnValueOnce(reply(true, { ok: true, winners: [] }));
  const onSettled = jest.fn();
  await toPreview(onSettled);
  fireEvent.click(screen.getByRole('button', { name: /confirm & pay/i }));
  await waitFor(() => expect(onSettled).toHaveBeenCalled());
  expect(JSON.parse(authedFetch.mock.calls[1][1].body)).toEqual({
    action: 'settle',
    id: 'r1',
    actualPayout: 1000,
  });
});

test('Back returns to the payout step and keeps the value', async () => {
  authedFetch.mockReturnValue(reply(true, PREVIEW));
  await toPreview();
  fireEvent.click(screen.getByRole('button', { name: /back/i }));
  expect(screen.getByLabelText(/actual final payout/i).value).toBe('1000');
});

test('a round settled elsewhere shows a readable error', async () => {
  authedFetch
    .mockReturnValueOnce(reply(true, PREVIEW))
    .mockReturnValueOnce(reply(false, { error: 'ALREADY_SETTLED' }));
  await toPreview();
  fireEvent.click(screen.getByRole('button', { name: /confirm & pay/i }));
  expect(await screen.findByText(/already settled/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "AdminHuntsPage"`
Expected: FAIL with "Cannot find module '../../components/admin/predictions/SettleModal'".

- [ ] **Step 3: Write the settle window**

Create `src/components/admin/predictions/SettleModal.js`:

```jsx
import { useState } from 'react';
import { Trophy, X, RefreshCcw, Ticket } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { roundCurrency } from '../../../utils/predictionRound';
import { placeLabel } from '../../../utils/predictionRewards';
import { inputCls, errorText, roundsAction } from './shared';

const FILL_ERRORS = {
  HUNT_NOT_FOUND: 'Hunt not found on communityhunts.gg. Enter the payout by hand.',
  COMMUNITYHUNTS_UNAVAILABLE: 'communityhunts.gg is unavailable. Enter the payout by hand.',
};

const labelCls = 'text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono';

function PreviewRow({ place, winner, currency }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 border border-white/10 bg-zinc-broadcast/40">
      <span className="w-9 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono">
        {placeLabel(place)}
      </span>
      {winner ? (
        <>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white-body text-sm truncate">
              {winner.displayName || winner.twitchName}
            </p>
            <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono mt-0.5">
              guess {formatMoney(winner.payoutGuess, currency)} · off by {formatMoney(winner.diff, currency)}
            </p>
          </div>
          <div className="text-right text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono text-emerald-signal space-y-0.5">
            {winner.prize.tickets > 0 && (
              <p className="inline-flex items-center gap-1">
                <Ticket size={10} aria-hidden="true" />+{winner.prize.tickets}
              </p>
            )}
            {winner.prize.label && <p>{winner.prize.label}</p>}
          </div>
        </>
      ) : (
        <p className="flex-1 text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/35 font-mono">
          No entry
        </p>
      )}
    </li>
  );
}

// Two steps: enter (or fill) the payout and preview who places, then confirm
// to pay. The round is locked by now, so the preview is what gets paid.
export default function SettleModal({ round, onClose, onSettled }) {
  const [step, setStep] = useState('payout');
  const [actualPayout, setActualPayout] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null); // 'fill' | 'preview' | 'settle'
  const [liveWarning, setLiveWarning] = useState(false);
  const [staleWarning, setStaleWarning] = useState(false);
  const [error, setError] = useState(null);
  const currency = roundCurrency(round);
  const canFill = round.source === 'communityhunts' && !!round.bonusHuntSnapshot?.huntId;
  const places = (round.rewards?.tiers || []).map((t) => t.place).sort((a, b) => a - b);

  const fillFromHunt = async () => {
    setBusy('fill');
    setError(null);
    const { ok, data } = await roundsAction({ action: 'hunt_result', id: round.id });
    setBusy(null);
    if (!ok) {
      setError(FILL_ERRORS[data.error] || errorText(data.error));
      return;
    }
    setActualPayout(String(data.result.payout));
    setLiveWarning(data.result.ended === false);
    // A round opened while nothing was live snapshots the previous hunt;
    // its payout would settle the wrong hunt.
    const createdMs = round.createdAt?.toMillis ? round.createdAt.toMillis() : null;
    const endedMs = data.result.endedAt ? Date.parse(data.result.endedAt) : NaN;
    setStaleWarning(createdMs != null && Number.isFinite(endedMs) && endedMs < createdMs);
  };

  const requestPreview = async (e) => {
    e.preventDefault();
    setError(null);
    if (actualPayout === '' || !Number.isFinite(Number(actualPayout))) {
      setError('Actual payout required');
      return;
    }
    setBusy('preview');
    const { ok, data } = await roundsAction({
      action: 'preview_settle',
      id: round.id,
      actualPayout: Number(actualPayout),
    });
    setBusy(null);
    if (!ok) {
      setError(errorText(data.error));
      return;
    }
    setPreview(data);
    setStep('preview');
  };

  const confirm = async () => {
    setError(null);
    setBusy('settle');
    const { ok, data } = await roundsAction({
      action: 'settle',
      id: round.id,
      actualPayout: Number(actualPayout),
    });
    setBusy(null);
    if (!ok) {
      setError(errorText(data.error));
      return;
    }
    onSettled(data);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={requestPreview}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-orange-admin/40 bg-zinc-card"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <Trophy size={11} aria-hidden="true" />
            Settle round · {step === 'payout' ? '1/2 payout' : '2/2 confirm'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>

        {step === 'payout' ? (
          <div className="px-5 py-5 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <label htmlFor="settle-actual-payout" className={`block text-white/55 ${labelCls}`}>
                  Actual final payout{currency ? ` (${currency})` : ''} <span className="text-emerald-signal">*</span>
                </label>
                {canFill && (
                  <button
                    type="button"
                    onClick={fillFromHunt}
                    disabled={!!busy}
                    className="inline-flex items-center gap-1.5 px-2 py-1 border border-white/15 text-white/65 hover:text-white-body hover:border-white/30 disabled:opacity-50"
                  >
                    <RefreshCcw size={11} aria-hidden="true" className={busy === 'fill' ? 'animate-spin' : ''} />
                    <span className={labelCls}>Fill from hunt</span>
                  </button>
                )}
              </div>
              <input
                id="settle-actual-payout"
                type="number"
                min="0"
                step="0.01"
                value={actualPayout}
                onChange={(e) => {
                  setActualPayout(e.target.value);
                  setLiveWarning(false);
                  setStaleWarning(false);
                }}
                className={inputCls}
                placeholder="0.00"
              />
              {liveWarning && (
                <p className="mt-1.5 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-orange-admin font-mono">
                  Hunt is still live. The payout may change.
                </p>
              )}
              {staleWarning && (
                <p className="mt-1.5 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-orange-admin font-mono">
                  This hunt ended before this round opened. Make sure it is the right hunt before settling.
                </p>
              )}
            </div>
            {error && (
              <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">{error}</p>
            )}
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            <p className={`text-white/55 ${labelCls}`}>
              Actual payout{' '}
              <span className="text-emerald-signal tabular-nums">{formatMoney(preview.actualPayout, currency)}</span>
            </p>
            <ol className="space-y-2">
              {preview.placements.map((winner, i) => (
                <PreviewRow key={places[i] ?? i + 1} place={places[i] ?? i + 1} winner={winner} currency={currency} />
              ))}
            </ol>
            <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
              {preview.entryCount} {preview.entryCount === 1 ? 'entry' : 'entries'} ranked · paying can't be undone
            </p>
            {error && (
              <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">{error}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 px-5 pb-5">
          {step === 'payout' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
              >
                <span className={labelCls}>Cancel</span>
              </button>
              <button
                type="submit"
                disabled={!!busy}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
              >
                <span className={labelCls}>{busy === 'preview' ? 'Ranking…' : 'Preview winners'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('payout');
                  setError(null);
                }}
                disabled={busy === 'settle'}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150 disabled:opacity-50"
              >
                <span className={labelCls}>Back</span>
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!!busy}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50"
              >
                <Trophy size={13} aria-hidden="true" />
                <span className={labelCls}>{busy === 'settle' ? 'Paying…' : 'Confirm & pay'}</span>
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Point the page at the new file**

In `src/pages/AdminHuntsPage.js`:
1. Delete `export function SettleModal(...)`, from its first line through its closing `}` just before `function RoundRow`.
2. Add `import SettleModal from '../components/admin/predictions/SettleModal';`.
3. Run `npx eslint --max-warnings=0 src/pages/AdminHuntsPage.js` and remove every import it reports as unused. Expect `X`, `RefreshCcw`, `roundCurrency` and `inputCls`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "AdminHuntsPage"`
Expected: PASS (all old and new tests).

- [ ] **Step 6: Lint**

Run: `npx eslint --max-warnings=0 src/pages/AdminHuntsPage.js src/components/admin/predictions/`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add src/components/admin/predictions/SettleModal.js src/pages/AdminHuntsPage.js src/pages/__tests__/AdminHuntsPage.test.js && git commit -m "feat(predictions): preview winners before confirming the payout"
```

---

### Task 10: Timed results post and chat status

**Files:**
- Create:
  - `src/components/admin/predictions/useResultsAnnounce.js`
  - `src/components/admin/predictions/ChatStatus.js`
- Test: `src/components/admin/predictions/__tests__/announce.test.js`

**Interfaces:**
- Consumes:
  - `roundsAction` (Task 8).
  - `STREAM_DELAY_MS` from `src/utils/giveaway.js` (existing, 3000).
  - `useClock` from `src/hooks/useClock.js` (existing).
  - The `announce` action (Task 5).
- Produces:
  - `useResultsAnnounce(round) → { dueAt: number|null, posting: boolean, error: string|null, retry: () => Promise }` (default export). Also exports `AUTO_POST_WINDOW_MS` (300000).
  - `ChatStatus` (default export): props `{ round, results: ReturnType<useResultsAnnounce> | null }`. Retry buttons are labelled `Retry opened`, `Retry locked` and `Retry results`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/admin/predictions/__tests__/announce.test.js`:

```js
import { renderHook, act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import useResultsAnnounce, { AUTO_POST_WINDOW_MS } from '../useResultsAnnounce';
import ChatStatus from '../ChatStatus';
import { authedFetch } from '../../../../utils/authedFetch';
import { STREAM_DELAY_MS } from '../../../../utils/giveaway';

jest.mock('../../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const reply = (ok, body) => Promise.resolve({ ok, json: () => Promise.resolve(body) });
const at = (ms) => ({ toMillis: () => ms });
const settled = (settledMs, extra = {}) => ({
  id: 'r1',
  status: 'settled',
  announce: true,
  announced: { opened: at(1), locked: at(2), results: null },
  settledAt: at(settledMs),
  ...extra,
});

describe('useResultsAnnounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('posts results once the stream delay has passed', async () => {
    authedFetch.mockReturnValue(reply(true, { ok: true, announce: { posted: true } }));
    const now = Date.now();
    renderHook(() => useResultsAnnounce(settled(now)));
    act(() => {
      jest.advanceTimersByTime(STREAM_DELAY_MS - 1);
    });
    expect(authedFetch).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({
      action: 'announce',
      id: 'r1',
      event: 'results',
    });
  });

  test('stale results never auto-post', () => {
    const old = Date.now() - AUTO_POST_WINDOW_MS - 1;
    renderHook(() => useResultsAnnounce(settled(old)));
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(authedFetch).not.toHaveBeenCalled();
  });

  test('nothing posts when the round has announcements off', () => {
    const now = Date.now();
    renderHook(() => useResultsAnnounce(settled(now, { announce: false })));
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(authedFetch).not.toHaveBeenCalled();
  });

  // Review Focus 3: a failed post releases the claim; the timer must not loop.
  test('a failed auto-post is not retried on its own', async () => {
    authedFetch.mockReturnValue(
      reply(true, { ok: true, announce: { posted: false, reason: 'CHAT_DROPPED:spam' } })
    );
    const start = Date.now();
    const { result, rerender } = renderHook(({ round }) => useResultsAnnounce(round), {
      initialProps: { round: settled(start) },
    });
    act(() => {
      jest.advanceTimersByTime(STREAM_DELAY_MS);
    });
    await waitFor(() => expect(result.current.error).toBe('CHAT_DROPPED:spam'));
    // The server claimed and then released the post.
    rerender({ round: settled(start, { announced: { opened: at(1), locked: at(2), results: at(start + 3000) } }) });
    rerender({ round: settled(start) });
    act(() => {
      jest.advanceTimersByTime(STREAM_DELAY_MS * 2);
    });
    expect(authedFetch).toHaveBeenCalledTimes(1);
  });
});

describe('ChatStatus', () => {
  test('reads off when the round does not announce', () => {
    render(<ChatStatus round={{ id: 'r1', status: 'open', announce: false }} results={null} />);
    expect(screen.getByText(/chat announce off/i)).toBeTruthy();
  });

  test('shows posted and not-yet states', () => {
    render(
      <ChatStatus
        round={{ id: 'r1', status: 'open', announce: true, announced: { opened: at(1), locked: null, results: null } }}
        results={null}
      />
    );
    expect(screen.getByText('posted')).toBeTruthy();
    expect(screen.getAllByText('not yet')).toHaveLength(2);
  });

  test('an unposted opened message offers Retry', async () => {
    authedFetch.mockReturnValue(reply(true, { ok: true, announce: { posted: true } }));
    render(
      <ChatStatus
        round={{ id: 'r1', status: 'open', announce: true, announced: { opened: null, locked: null, results: null } }}
        results={null}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /retry opened/i }));
    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({
      action: 'announce',
      id: 'r1',
      event: 'opened',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "admin/predictions/__tests__/announce"`
Expected: FAIL with "Cannot find module '../useResultsAnnounce'".

- [ ] **Step 3: Write the hook**

Create `src/components/admin/predictions/useResultsAnnounce.js`:

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { STREAM_DELAY_MS } from '../../../utils/giveaway';
import { roundsAction } from './shared';

// Only a fresh settle posts on its own. Older results post through Retry, so
// opening the admin page hours later can't post stale winners to chat.
export const AUTO_POST_WINDOW_MS = 5 * 60 * 1000;

function toMs(ts) {
  return ts && ts.toMillis ? ts.toMillis() : null;
}

function failure(ok, data) {
  const result = data && data.announce;
  if (ok && result && (result.posted || result.reason === 'already')) return null;
  return (result && result.reason) || (data && data.error) || 'unknown';
}

// Posts a settled round's results to chat once the stream has caught up with
// the reveal (chat runs STREAM_DELAY_MS ahead of the video). The server claims
// the post, so several open admin tabs still post once. Each round gets one
// automatic attempt; after that it's Retry.
export default function useResultsAnnounce(round) {
  const [state, setState] = useState({ roundId: null, posting: false, error: null });
  const tried = useRef(new Set());
  const id = round ? round.id : null;
  const settledMs = toMs(round && round.settledAt);
  const armed =
    !!round &&
    round.status === 'settled' &&
    !!round.announce &&
    !(round.announced && round.announced.results) &&
    settledMs != null;
  const dueAt = armed ? settledMs + STREAM_DELAY_MS : null;

  const post = useCallback(async () => {
    if (!id) return;
    setState({ roundId: id, posting: true, error: null });
    const { ok, data } = await roundsAction({ action: 'announce', id, event: 'results' });
    setState({ roundId: id, posting: false, error: failure(ok, data) });
  }, [id]);

  useEffect(() => {
    if (!armed || tried.current.has(id)) return undefined;
    if (Date.now() - settledMs > AUTO_POST_WINDOW_MS) return undefined;
    const t = setTimeout(() => {
      tried.current.add(id);
      post();
    }, Math.max(0, dueAt - Date.now()));
    return () => clearTimeout(t);
  }, [armed, id, settledMs, dueAt, post]);

  const mine = state.roundId === id;
  return {
    dueAt,
    posting: mine && state.posting,
    error: mine ? state.error : null,
    retry: post,
  };
}
```

- [ ] **Step 4: Write the status strip**

Create `src/components/admin/predictions/ChatStatus.js`:

```jsx
import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useClock } from '../../../hooks/useClock';
import { roundsAction } from './shared';

const EVENTS = [
  { key: 'opened', label: 'Opened' },
  { key: 'locked', label: 'Locked' },
  { key: 'results', label: 'Results' },
];

const shellCls =
  'flex items-center gap-x-4 gap-y-2 px-3 py-2 border border-white/10 bg-zinc-broadcast/40 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono';

// Whether the round has reached the moment a line posts for.
function reached(round, key) {
  if (key === 'opened') return true;
  if (key === 'locked') return round.status === 'locked' || round.status === 'settled';
  return round.status === 'settled';
}

function failure(ok, data) {
  const result = data && data.announce;
  if (ok && result && (result.posted || result.reason === 'already')) return null;
  return (result && result.reason) || (data && data.error) || 'unknown';
}

// Chat post status for a round's three lines. `results` comes from
// useResultsAnnounce for the current round; past rounds pass null and retry
// results here like the other two.
export default function ChatStatus({ round, results }) {
  const [local, setLocal] = useState({});
  const pending = !!results?.dueAt && !round.announced?.results;
  const now = useClock({ intervalMs: 500, active: pending });

  const retry = async (key) => {
    setLocal((s) => ({ ...s, [key]: { posting: true, error: null } }));
    const { ok, data } = await roundsAction({ action: 'announce', id: round.id, event: key });
    setLocal((s) => ({ ...s, [key]: { posting: false, error: failure(ok, data) } }));
  };

  if (!round.announce) {
    return (
      <div className={shellCls}>
        <MessageSquare size={11} className="text-white/40 flex-shrink-0" aria-hidden="true" />
        <span className="text-white/35">Chat announce off</span>
      </div>
    );
  }

  return (
    <div className={`${shellCls} flex-wrap`}>
      <MessageSquare size={11} className="text-white/40 flex-shrink-0" aria-hidden="true" />
      {EVENTS.map(({ key, label }) => {
        const useHook = key === 'results' && results;
        const own = useHook ? results : local[key] || {};
        const onRetry = useHook ? results.retry : () => retry(key);
        let body;
        let canRetry = false;
        if (!reached(round, key)) {
          body = <span className="text-white/30">not yet</span>;
        } else if (round.announced?.[key]) {
          body = <span className="text-emerald-signal">posted</span>;
        } else if (own.posting) {
          body = <span className="text-white/55">posting…</span>;
        } else if (own.error) {
          body = (
            <span className="text-red-destructive truncate max-w-[28ch]" title={own.error}>
              failed: {own.error}
            </span>
          );
          canRetry = true;
        } else if (key === 'results' && pending && results.dueAt > now) {
          body = <span className="text-white/55">in {Math.ceil((results.dueAt - now) / 1000)}s</span>;
        } else {
          body = <span className="text-white/45">not posted</span>;
          canRetry = true;
        }
        return (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="text-white/45">{label}</span>
            {body}
            {canRetry && (
              <button
                type="button"
                onClick={onRetry}
                aria-label={`Retry ${label.toLowerCase()}`}
                className="px-1.5 py-0.5 border border-white/20 text-white/65 hover:text-white-body hover:border-white/40"
              >
                Retry
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "admin/predictions/__tests__/announce"`
Expected: PASS (7 tests).

- [ ] **Step 6: Lint**

Run: `npx eslint --max-warnings=0 src/components/admin/predictions/`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add src/components/admin/predictions/useResultsAnnounce.js src/components/admin/predictions/ChatStatus.js src/components/admin/predictions/__tests__/announce.test.js && git commit -m "feat(predictions): timed results post and chat status with retry"
```

---

### Task 11: Control room page

**Files:**
- Create:
  - `src/components/admin/predictions/RoundControl.js`
  - `src/components/admin/predictions/EntriesTable.js`
  - `src/components/admin/predictions/RoundResults.js`
- Modify: `src/pages/AdminHuntsPage.js` (whole file)
- Test: `src/pages/__tests__/AdminHuntsControlRoom.test.js`

**Interfaces:**
- Consumes:
  - `SettleModal` (Task 9).
  - `ChatStatus` and `useResultsAnnounce` (Task 10).
  - `NewRoundModal` (Task 8).
  - `roundsAction`, `errorText` and `formatTs` (Task 8).
  - `placeLabel`, `rewardSummary`, `winnerPrizeLabel` and `lastRewardsRound` (Task 6).
  - `SuggestionList` (existing, props `{ huntId, adminMode }`).
- Produces:
  - `RoundControl` with props `{ round, readOnly?, results?, onDeleted? }`.
  - `EntriesTable` with props `{ round }`.
  - `RoundResults` with props `{ round }`.
  - The default export `AdminHuntsPage`.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/__tests__/AdminHuntsControlRoom.test.js`:

```js
import { render, screen, fireEvent } from '@testing-library/react';
import AdminHuntsPage from '../AdminHuntsPage';
import { authedFetch } from '../../utils/authedFetch';

// Fixtures by Firestore path: collections (odd segment count) hold arrays of
// rows, docs (even segment count) hold one object. Missing paths are empty.
const mockDocs = {};

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => parts.join('/'),
  doc: (_db, ...parts) => parts.join('/'),
  query: (ref) => ref,
  orderBy: () => null,
  limit: () => null,
  onSnapshot: (path, next) => {
    const value = mockDocs[path];
    if (path.split('/').length % 2 === 1) {
      next({ docs: (value || []).map((row) => ({ id: row.id, data: () => row })) });
    } else {
      next({ exists: () => !!value, data: () => value });
    }
    return () => {};
  },
}));
jest.mock('../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const at = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const TIERS = [
  { place: 1, tickets: 100, prize: { kind: 'cash', amount: 10 } },
  { place: 2, tickets: 50, prize: null },
];
const OPEN = {
  id: 'r2',
  title: 'Friday',
  status: 'open',
  source: 'manual',
  manualTotalCost: 500,
  acceptPredictions: true,
  rewards: { tiers: TIERS },
  announce: true,
  announced: { opened: at(1), locked: null, results: null },
  entryCount: 2,
  createdAt: at(2000),
};
const PAST = {
  id: 'r1',
  title: 'Last week',
  status: 'settled',
  source: 'manual',
  manualTotalCost: 400,
  acceptPredictions: true,
  rewards: { tiers: TIERS },
  announce: false,
  actual: { payout: 1000 },
  winners: [
    {
      place: 1,
      twitchId: 'a',
      displayName: 'viewerA',
      payoutGuess: 990,
      diff: 10,
      prize: { tickets: 100, kind: 'cash', amount: 10, label: '$10' },
      redemptionId: 'red1',
    },
  ],
  createdAt: at(1000),
};

beforeEach(() => {
  Object.keys(mockDocs).forEach((k) => delete mockDocs[k]);
});

test('the current round leads the page and blocks a new round while open', () => {
  mockDocs.hunts = [OPEN, PAST];
  mockDocs['hunts/r2/entries'] = [
    { id: 'b', twitchId: 'b', displayName: 'viewerB', payoutGuess: 1500, editCount: 2 },
    { id: 'a', twitchId: 'a', displayName: 'viewerA', payoutGuess: 900, editCount: 1 },
  ];
  render(<AdminHuntsPage />);
  expect(screen.getByText('Friday')).toBeTruthy();
  expect(screen.getByRole('button', { name: /new round/i }).disabled).toBe(true);
  expect(screen.getByText(/settle or delete the current round first/i)).toBeTruthy();
  expect(screen.getByText(/100t \+ \$10 cash/)).toBeTruthy();
  const rows = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
  expect(rows[0]).toMatch(/viewerA/);
  expect(rows[1]).toMatch(/viewerB/);
});

test('Lock & settle locks the round, then opens the settle window', async () => {
  mockDocs.hunts = [OPEN];
  authedFetch.mockReturnValue(
    Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, announce: { posted: true } }) })
  );
  render(<AdminHuntsPage />);
  fireEvent.click(screen.getByRole('button', { name: /lock & settle/i }));
  expect(await screen.findByLabelText(/actual final payout/i)).toBeTruthy();
  expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({ action: 'lock', id: 'r2' });
});

test('opening a past round shows its results read-only', () => {
  mockDocs.hunts = [OPEN, PAST];
  mockDocs['redemptions/red1'] = { status: 'pending' };
  render(<AdminHuntsPage />);
  fireEvent.click(screen.getByRole('button', { name: /last week/i }));
  expect(screen.getByText(/\+100 credited/)).toBeTruthy();
  expect(screen.getByText('pending')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /lock entries/i })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /back to current round/i }));
  expect(screen.getByRole('button', { name: /lock entries/i })).toBeTruthy();
});

test('with no active round, New round is enabled', () => {
  mockDocs.hunts = [PAST];
  render(<AdminHuntsPage />);
  expect(screen.getByRole('button', { name: /new round/i }).disabled).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "AdminHuntsControlRoom"`
Expected: FAIL. The page still shows the old list layout: no "Lock & settle", no rewards line, and New round isn't disabled.

- [ ] **Step 3: Write `RoundControl`**

Create `src/components/admin/predictions/RoundControl.js`:

```jsx
import { useState } from 'react';
import { Lock, Unlock, Trophy, Trash2 } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { formatHuntDate } from '../../../utils/huntFormat';
import { placeLabel, rewardSummary } from '../../../utils/predictionRewards';
import SettleModal from './SettleModal';
import ChatStatus from './ChatStatus';
import { errorText, roundsAction } from './shared';

const STEPS = [
  { key: 'open', label: 'Open' },
  { key: 'locked', label: 'Locked' },
  { key: 'settled', label: 'Settled' },
];

const btnLabel = 'text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono';
const btnSecondary =
  'inline-flex items-center gap-2 px-3.5 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-50';

function statusTone(status) {
  if (status === 'open') return 'text-emerald-signal border-emerald-signal/40';
  if (status === 'locked') return 'text-orange-admin border-orange-admin/40';
  return 'text-white/65 border-white/20';
}

function sourceLine(round) {
  const s = round.bonusHuntSnapshot;
  if (round.source === 'communityhunts' && s) {
    const when = s.status === 'live' ? 'Live' : s.endedAt ? `Ended ${formatHuntDate(s.endedAt)}` : null;
    return [formatMoney(s.totalCost, s.currency), s.currency, `${s.bonusCount} bonuses`, when]
      .filter(Boolean)
      .join(' · ');
  }
  return `Manual · ${formatMoney(round.manualTotalCost, null)}`;
}

function StepRail({ status }) {
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
      {STEPS.map((step, i) => (
        <li key={step.key} className="inline-flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          {i > 0 && (
            <span className="text-white/20" aria-hidden="true">
              →
            </span>
          )}
          <span className={i === current ? 'text-orange-admin' : i < current ? 'text-emerald-signal' : 'text-white/30'}>
            <span className="tabular-nums">0{i + 1}</span> {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Header, lifecycle steps and actions for one round. readOnly (a past round
// opened from the list) hides the lifecycle actions.
export default function RoundControl({ round, readOnly = false, results = null, onDeleted }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [settling, setSettling] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const tiers = (round.rewards?.tiers || []).slice().sort((a, b) => a.place - b.place);
  const live = !readOnly && round.acceptPredictions;

  const act = async (action) => {
    setBusy(action);
    setError(null);
    const { ok, data } = await roundsAction({ action, id: round.id });
    setBusy(null);
    if (!ok) {
      setError(errorText(data.error));
      return false;
    }
    if (action === 'delete' && onDeleted) onDeleted();
    return true;
  };

  const lockAndSettle = async () => {
    if (await act('lock')) setSettling(true);
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden border border-orange-admin/30 bg-zinc-card/40">
        <div
          className="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full bg-orange-admin/15 blur-3xl motion-reduce:hidden"
          aria-hidden="true"
        />
        <div className="relative px-6 sm:px-8 py-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono">
              ▸ Prediction round
            </p>
            <span className={`px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase border font-mono ${statusTone(round.status)}`}>
              {round.status}
            </span>
          </div>
          <div>
            <p
              className="font-black text-white-body leading-[0.9] tracking-[-0.03em]"
              style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 'clamp(2rem, 5vw, 3rem)' }}
            >
              {round.title}
            </p>
            {round.contextNote && <p className="mt-2 text-sm text-white/55">{round.contextNote}</p>}
            <p className="mt-2 text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono">
              {sourceLine(round)}
            </p>
          </div>
          {round.acceptPredictions && <StepRail status={round.status} />}
          {round.acceptPredictions && tiers.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
              {tiers.map((tier) => (
                <li key={tier.place} className="text-white/55">
                  <span className="text-white-body">{placeLabel(tier.place)}</span> · {rewardSummary(tier)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {round.acceptPredictions && <ChatStatus round={round} results={results} />}

      <div className="flex flex-wrap items-center gap-2">
        {live && round.status === 'open' && (
          <>
            <button
              type="button"
              onClick={() => act('lock')}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
            >
              <Lock size={13} aria-hidden="true" />
              <span className={btnLabel}>{busy === 'lock' ? 'Locking…' : 'Lock entries'}</span>
            </button>
            <button type="button" onClick={lockAndSettle} disabled={!!busy} className={btnSecondary}>
              <Trophy size={13} aria-hidden="true" />
              <span className={btnLabel}>Lock & settle</span>
            </button>
          </>
        )}
        {live && round.status === 'locked' && (
          <>
            <button
              type="button"
              onClick={() => setSettling(true)}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50"
            >
              <Trophy size={13} aria-hidden="true" />
              <span className={btnLabel}>Settle & pay</span>
            </button>
            <button type="button" onClick={() => act('reopen')} disabled={!!busy} className={btnSecondary}>
              <Unlock size={13} aria-hidden="true" />
              <span className={btnLabel}>{busy === 'reopen' ? 'Reopening…' : 'Reopen'}</span>
            </button>
          </>
        )}
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="ml-auto inline-flex items-center gap-2 px-3 py-2 border border-red-destructive/30 text-red-destructive/70 hover:bg-red-destructive/10 hover:border-red-destructive/60 transition-colors duration-150"
          >
            <Trash2 size={12} aria-hidden="true" />
            <span className={btnLabel}>Delete</span>
          </button>
        ) : (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => act('delete')}
              disabled={!!busy}
              className={`inline-flex items-center gap-2 px-3 py-2 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/25 ${btnLabel}`}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className={`px-3 py-2 border border-white/10 text-white/60 hover:text-white-body ${btnLabel}`}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">{error}</p>
      )}

      {settling && (
        <SettleModal round={round} onClose={() => setSettling(false)} onSettled={() => setSettling(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `EntriesTable`**

Create `src/components/admin/predictions/EntriesTable.js`:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Users } from 'lucide-react';
import { db } from '../../../config/firebase';
import { formatMoney } from '../../../utils/money';
import { roundCurrency } from '../../../utils/predictionRound';
import { placeLabel } from '../../../utils/predictionRewards';
import { formatTs } from './shared';

const th = 'px-4 py-2 font-bold';

// Every guess in a round, live. Staff can read entries while the round is
// open (firestore.rules), so this works before the lock. Sorted by guess
// until settled, then by distance to the actual payout.
export default function EntriesTable({ round }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!round?.id) return undefined;
    return onSnapshot(collection(db, 'hunts', round.id, 'entries'), (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [round?.id]);

  const currency = roundCurrency(round);
  const actual = round.status === 'settled' ? round.actual?.payout : null;
  const settled = typeof actual === 'number';
  const places = useMemo(
    () => Object.fromEntries((round.winners || []).map((w) => [w.twitchId, w.place])),
    [round.winners]
  );
  const rows = useMemo(() => {
    const guessed = entries.filter((e) => typeof e.payoutGuess === 'number');
    if (!settled) return guessed.sort((a, b) => a.payoutGuess - b.payoutGuess);
    return guessed
      .map((e) => ({ ...e, diff: Math.abs(e.payoutGuess - actual) }))
      .sort((a, b) => a.diff - b.diff);
  }, [entries, settled, actual]);

  return (
    <section className="border border-white/8 bg-zinc-card/30">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-white/65">
          <Users size={11} aria-hidden="true" /> Entries
        </span>
        <span className="text-white/40 tabular-nums">{rows.length}</span>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
          No guesses yet
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.5625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
                <th scope="col" className={th}>Viewer</th>
                <th scope="col" className={`${th} text-right`}>Guess</th>
                {settled && <th scope="col" className={`${th} text-right`}>Off by</th>}
                <th scope="col" className={`${th} text-right`}>Edits</th>
                <th scope="col" className={`${th} text-right`}>Last edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-white/8">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      {places[e.twitchId] && (
                        <span className="px-1 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase border border-orange-admin/50 text-orange-admin font-mono">
                          {placeLabel(places[e.twitchId])}
                        </span>
                      )}
                      <span className="text-white-body truncate">{e.displayName || e.twitchName || e.id}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-white-body">
                    {formatMoney(e.payoutGuess, currency)}
                  </td>
                  {settled && (
                    <td className="px-4 py-2 text-right tabular-nums text-white/65">{formatMoney(e.diff, currency)}</td>
                  )}
                  <td className="px-4 py-2 text-right tabular-nums text-white/55">{e.editCount ?? 1}</td>
                  <td className="px-4 py-2 text-right text-white/45 font-mono text-[0.6875rem]">
                    {formatTs(e.lastEditAt || e.submittedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Write `RoundResults`**

Create `src/components/admin/predictions/RoundResults.js`:

```jsx
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Trophy, Ticket } from 'lucide-react';
import { db } from '../../../config/firebase';
import { formatMoney } from '../../../utils/money';
import { roundCurrency } from '../../../utils/predictionRound';
import { placeLabel, winnerPrizeLabel } from '../../../utils/predictionRewards';

function RedemptionStatus({ id }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!id) return undefined;
    return onSnapshot(
      doc(db, 'redemptions', id),
      (snap) => setStatus(snap.exists() ? snap.data().status : 'missing'),
      () => setStatus('unknown')
    );
  }, [id]);
  const tone =
    status === 'fulfilled'
      ? 'text-emerald-signal border-emerald-signal/40'
      : status === 'pending'
        ? 'text-orange-admin border-orange-admin/40'
        : 'text-white/45 border-white/20';
  return (
    <Link
      to="/admin/redemptions"
      className={`px-1.5 py-0.5 border text-[0.5625rem] font-bold tracking-eyebrow-md uppercase font-mono ${tone}`}
    >
      {status || '…'}
    </Link>
  );
}

// A settled round's payout and what each winner got. Tickets were credited at
// settle; a prize links to its redemption so it can be marked done.
export default function RoundResults({ round }) {
  const currency = roundCurrency(round);
  const winners = (round.winners || []).slice().sort((a, b) => a.place - b.place);
  return (
    <section className="border border-emerald-signal/30 bg-zinc-card/30">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <Trophy size={11} aria-hidden="true" /> Results
        </span>
        <span className="text-white/55">
          Actual <span className="text-white-body tabular-nums">{formatMoney(round.actual?.payout, currency)}</span>
        </span>
      </header>
      {winners.length === 0 ? (
        <p className="px-4 py-6 text-center text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
          No winners — no eligible entries.
        </p>
      ) : (
        <ul>
          {winners.map((w) => {
            const prize = winnerPrizeLabel(w.prize);
            const tickets = Number(w.prize?.tickets) || 0;
            return (
              <li
                key={`${w.place}-${w.twitchId}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-white/8 first:border-t-0"
              >
                <span className="w-9 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono">
                  {placeLabel(w.place)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white-body text-sm truncate">{w.displayName || w.twitchName}</p>
                  <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono mt-0.5">
                    guess {formatMoney(w.payoutGuess, currency)}
                    {typeof w.diff === 'number' ? ` · off by ${formatMoney(w.diff, currency)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
                  {tickets > 0 && (
                    <span className="inline-flex items-center gap-1 text-emerald-signal">
                      <Ticket size={10} aria-hidden="true" />+{tickets} credited
                    </span>
                  )}
                  {prize && <span className="text-white-body">{prize}</span>}
                  {w.redemptionId && <RedemptionStatus id={w.redemptionId} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Rewrite the page**

Replace `src/pages/AdminHuntsPage.js` with:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { Plus, ChevronRight, Layers } from 'lucide-react';
import { db } from '../config/firebase';
import SuggestionList from '../components/SuggestionList';
import NewRoundModal from '../components/admin/predictions/NewRoundModal';
import RoundControl from '../components/admin/predictions/RoundControl';
import EntriesTable from '../components/admin/predictions/EntriesTable';
import RoundResults from '../components/admin/predictions/RoundResults';
import useResultsAnnounce from '../components/admin/predictions/useResultsAnnounce';
import { formatTs } from '../components/admin/predictions/shared';
import { lastRewardsRound } from '../utils/predictionRewards';

function RoundRow({ round, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(round)}
      className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 border-t border-white/8 first:border-t-0 hover:bg-zinc-broadcast/40 text-left"
    >
      <span
        className={`px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase border font-mono ${
          round.status === 'open'
            ? 'text-emerald-signal border-emerald-signal/40'
            : round.status === 'locked'
              ? 'text-orange-admin border-orange-admin/40'
              : 'text-white/65 border-white/20'
        }`}
      >
        {round.status}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-white-body text-sm truncate">{round.title}</p>
        <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5">
          {[round.acceptPredictions && 'PREDICT', round.acceptSuggestions && 'SUGGEST'].filter(Boolean).join(' + ')} ·{' '}
          {round.source} · {formatTs(round.createdAt)}
        </p>
      </div>
      <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono tabular-nums">
        {round.entryCount ?? 0} entries
      </span>
      <ChevronRight size={14} className="text-white/30" aria-hidden="true" />
    </button>
  );
}

// /admin/hunts: the prediction control room. The newest round (the one viewers
// see on /gamba/hunts) leads the page; past rounds open read-only below.
export default function AdminHuntsPage() {
  const [list, setList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'hunts'), orderBy('createdAt', 'desc'), fLimit(50));
    return onSnapshot(q, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const current = list[0] || null;
  const selected = selectedId ? list.find((r) => r.id === selectedId) : null;
  const viewing = selected || current;
  const readOnly = !!viewing && !!current && viewing.id !== current.id;
  const past = list.slice(1);
  const active = list.find(
    (r) => r.acceptPredictions && (r.status === 'open' || r.status === 'locked')
  );
  const results = useResultsAnnounce(current);
  const lastRound = useMemo(() => lastRewardsRound(list), [list]);

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>PREDICTIONS</span>
          </span>
          <span className="text-white/20">·</span>
          <span>MODULE</span>
          <span className="text-white/70 tracking-eyebrow-lg">PRD</span>
        </div>
        <h1
          className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 'clamp(2.25rem, 6vw, 3.25rem)' }}
        >
          <span className="block">Prediction</span>
          <span className="block text-orange-admin">rounds.</span>
        </h1>
      </header>

      <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
        {active && (
          <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono">
            Settle or delete the current round first
          </p>
        )}
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={!!active}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-40 disabled:hover:bg-orange-admin"
        >
          <Plus size={13} aria-hidden="true" />
          <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">New round</span>
        </button>
      </div>

      {viewing ? (
        <div className="space-y-5">
          {readOnly && (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-[0.625rem] font-bold uppercase tracking-eyebrow-lg font-mono text-white/55 hover:text-white-body"
            >
              ← Back to current round
            </button>
          )}
          <RoundControl
            key={viewing.id}
            round={viewing}
            readOnly={readOnly}
            results={viewing.id === current?.id ? results : null}
            onDeleted={() => setSelectedId(null)}
          />
          {viewing.acceptPredictions && viewing.status === 'settled' && <RoundResults round={viewing} />}
          {viewing.acceptPredictions && <EntriesTable round={viewing} />}
          {viewing.acceptSuggestions && <SuggestionList huntId={viewing.id} adminMode />}
        </div>
      ) : (
        <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/15 mb-3 text-white/35">
            <Layers size={16} aria-hidden="true" />
          </div>
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">
            No rounds yet
          </p>
          <p className="text-sm text-white/55">Start one to begin.</p>
        </div>
      )}

      {past.length > 0 && (
        <section className="mt-10">
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 mb-2 font-mono">
            Past · {past.length}
          </p>
          <div className="border border-white/8 bg-zinc-card/30">
            {past.map((r) => (
              <RoundRow key={r.id} round={r} onOpen={(x) => setSelectedId(x.id)} />
            ))}
          </div>
        </section>
      )}

      {creating && (
        <NewRoundModal
          lastRound={lastRound}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern "AdminHuntsControlRoom|AdminHuntsPage|admin/predictions"`
Expected: PASS.

- [ ] **Step 8: Lint**

Run: `npx eslint --max-warnings=0 src/pages/AdminHuntsPage.js src/components/admin/predictions/`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add src/components/admin/predictions/RoundControl.js src/components/admin/predictions/EntriesTable.js src/components/admin/predictions/RoundResults.js src/pages/AdminHuntsPage.js src/pages/__tests__/AdminHuntsControlRoom.test.js && git commit -m "feat(predictions): control room with steps, live entries and results"
```

---

### Task 12: Docs, full verification, PR

**Files:**
- Modify: `CLAUDE.md` (the Gotchas bullet about hunts and predictions)

**Interfaces:**
- Consumes: everything above.
- Produces: an open PR from `feat/prediction-control-room` to `main`.

- [ ] **Step 1: Update CLAUDE.md**

In `CLAUDE.md`, in the Gotchas bullet that starts "Hunts + predictions run on communityhunts.gg", replace the sentence

```
Prediction rounds (`hunts/{id}`, entries under `hunts/{id}/entries`) are payout-only: `source: 'communityhunts'|'manual'`, snapshot `{ huntId, totalCost, currency, bonusCount }`, and the admin settle modal's "Fill from hunt" reads the final `totalWon`.
```

with

```
Prediction rounds (`hunts/{id}`, entries under `hunts/{id}/entries`) are payout-only: `source: 'communityhunts'|'manual'`, snapshot `{ huntId, totalCost, currency, bonusCount }`. `/admin/hunts` is the control room (`src/components/admin/predictions/`): one prediction round open or locked at a time (`ROUND_ACTIVE`), settling needs a locked round, `preview_settle` shows the placements and `settle` pays in one transaction; "Fill from hunt" reads the final `totalWon`. Reward tiers are `{ place, tickets, prize: null | { kind: 'cash'|'bonus', amount } }` in dollars (`api/_lib/predictionRewards.js`, mirrored client-side in `src/utils/predictionRewards.js`); a prize files a pending `kind: 'prediction'` redemption. `firestore.rules` hides entries from viewers until lock (staff and the entry's owner can read while open), so viewer components must not query entries on an open round (`entriesSealed`). Chat lines for opened/locked/results go through the `announce` action, claimed once per event on `announced.*`; results post `STREAM_DELAY_MS` after settle from the open admin page.
```

- [ ] **Step 2: Run the full test suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: every suite passes. If an unrelated suite was already failing on `main`, confirm that with `git stash; CI=true npx react-scripts test --watchAll=false --testPathPattern <suite>; git stash pop` and report it, but don't fix it here.

- [ ] **Step 3: Production build**

Run: `CI=true npm run build`
Expected: "Compiled successfully." with no warnings (CI treats warnings as errors).

- [ ] **Step 4: Commit the docs**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git add CLAUDE.md && git commit -m "docs(predictions): control room, rewards, hidden guesses and chat in CLAUDE.md"
```

- [ ] **Step 5: Push and open the PR**

```bash
git branch --show-current | grep -qx feat/prediction-control-room && git push -u origin feat/prediction-control-room
```

```bash
gh pr create --base main --head feat/prediction-control-room --title "Prediction control room: rewards, settle preview, hidden guesses, chat" --body "$(cat <<'EOF'
## Summary
- `/admin/hunts` is now a control room: the current round leads with Open → Locked → Settled steps, a live entries table, a two-step settle (preview winners, then confirm & pay) and a results panel with redemption status.
- Rewards per place: tickets plus an optional cash or bonus-buy prize (dollars). The new-round form starts from the last round's rewards. Fixes cash rounds silently paying the hidden default tickets.
- Settle runs in one Firestore transaction and needs a locked round, so it can't pay twice. Only one prediction round can be open or locked at a time.
- Guesses stay face down for viewers until the round locks (Firestore rules plus viewer components). Ties go to whoever settled on their final guess first.
- Chat lines for opened, locked and results (results wait out the stream delay), one switch per round, posted once per event with Retry.

## Test plan
- [ ] `CI=true npx react-scripts test --watchAll=false` passes
- [ ] `CI=true npm run build` compiles with no warnings
- [ ] After merge and deploy: `firebase deploy --only firestore:rules --project goofer-website`
- [ ] Second viewer sees the face-down wall with no console errors; your own slip still submits
- [ ] Lock shows the cards on open viewer pages; the admin entries table fills while open
- [ ] Chat lines arrive for open, lock and results

## Rollout
Deploy the Firestore rules **after** the site deploy: clients on the old code query entries while a round is open.
EOF
)"
```

Expected: `gh` prints the PR URL. Give that URL to the owner. **Do not deploy the Firestore rules**; that's the owner's step after merge.
