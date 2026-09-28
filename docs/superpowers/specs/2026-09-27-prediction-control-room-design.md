# Prediction Control Room (admin), Hidden Guesses and Chat Announcements

**Date:** 2026-09-27
**Status:** Approved in brainstorming (pending spec review)

## Problem

Payout predictions already work end to end: `/admin/hunts` (admin nav "Predictions") creates a round from a communityhunts.gg snapshot, viewers guess the final payout on `/gamba/hunts`, and settling pays tickets or files a cash redemption. An audit of that flow found:

1. **Cash rewards also pay tickets.** Choosing "cash" hides the ticket inputs, but the form still sends the hidden 100/50 defaults and the server ignores `rewards.type`, so winners get tickets and cash.
2. **Settling can pay twice.** `settle` checks the round status outside a transaction. Two concurrent calls (two tabs, or the owner and a mod) both credit tickets.
3. **Blind settle.** The admin round view shows only an entry count. There is no way to see guesses or who would win before "Reveal winners" pays out, and that can't be undone.
4. **Thin results.** After settling, admin shows only the 1st place name: no 2nd place, guesses, distance or prize status.
5. **Guesses are public while open.** Entries are world-readable and the wall shows amounts, so a late viewer can guess $1 above the leader. Edits keep the original `submittedAt`, so an early entrant who edits late still wins ties.
6. **A new round hides an open one.** The viewer page shows only the newest round, and nothing stops creating a round while another is open.
7. **No chat hooks.** Giveaways post to Twitch chat; predictions don't.

## Scope and non-goals

- **In scope:** a new reward model (tickets plus an optional cash or bonus-buy prize per place), a settle preview and a transactional settle, the one-active-round rule, guesses hidden until lock, chat announcements, and a reworked admin page ("control room").
- **Non-goals:**
  - The on-stream bonus-buy flow for prediction prizes (confirm, overlay "now playing" card, logging the win). A bonus-buy prize is tracked only as a pending redemption. The data shape leaves room to add the flow later.
  - Editable chat templates. Messages are fixed text with one on/off switch per round.
  - Closing suggestion-only rounds. They can't be locked or settled today, and that stays as it is.
  - A Firestore rules test harness. Rules are verified by hand after deploy.
- **Unchanged:** the communityhunts snapshot and "Fill from hunt", the suggestion feature, the payout-only prediction type, and the viewer page layout apart from the hidden-guess state.

## Decisions (from brainstorming)

1. The control room reworks `/admin/hunts` in place and splits it into focused components. There is no second admin page.
2. Viewers can't see other viewers' guesses while a round is open. Guesses appear when the round locks.
3. Each place gets tickets (0 or more) plus an optional prize: none, cash, or bonus buy, each with an amount. The new-round form starts with the last round's rewards.
4. Prize amounts are in dollars (`$`), whatever currency the hunt uses.
5. A bonus-buy prize becomes a pending redemption that the admin marks done after playing it on stream.
6. Chat messages are fixed text for opened, locked and results, with one `announce` switch per round (on by default). Results post after the stream delay.
7. Settling requires a locked round. From Open, the admin page offers "Lock & settle".
8. Ties go to whoever settled on their final guess first (`lastEditAt`), not whoever first submitted.
9. Only one prediction round can be open or locked at a time.

---

## 1. Data model (Firestore `hunts/{id}`)

New or changed fields on the round document:

- **`rewards`:** `{ tiers: [{ place, tickets, prize }] }`.
  - `place` is 1, 2 or 3. Tiers 1 and 2 are always present; tier 3 is optional.
  - `tickets` is an integer from 0 to 1,000,000.
  - `prize` is `null` or `{ kind: 'cash' | 'bonus', amount }`, where `amount` is a finite number greater than 0 and at most 100,000, rounded to 2 decimals.
  - `rewards.type` is no longer written. Old rounds keep it and nothing reads it.
- **`announce`:** boolean. When it is missing (rounds created before this change), announcements are off.
- **`announced`:** `{ opened, locked, results }`, where each value is a server timestamp or `null`. It records which chat messages were posted.

Winner objects (`winners[i]`, written at settle):

```js
{ place, twitchId, twitchName, displayName, profileImageUrl,
  payoutGuess, diff,
  prize: { tickets, kind, amount, label },   // kind/amount/label null when no prize
  redemptionId }                              // null when no prize
```

Old settled rounds have `prize: { tickets, cashLabel }`. Viewer and admin displays read `prize.label ?? prize.cashLabel`.

`prizeLabel(prize)`:
- **Cash:** `"$10"`, or `"$12.50"` when the amount isn't whole.
- **Bonus buy:** `"Bonus buy $20"`.
- **No prize:** `null`.

The same rule exists in `api/_lib/predictionRewards.js` (server) and `src/utils/predictionRewards.js` (client, used for form previews and the admin rewards line). CRA can't import from `api/`.

## 2. Server: `api/admin/hunts.js`

### Pure helpers

- **`api/_lib/predictionRewards.js` (new):** `sanitizeRewards(input)` and `prizeLabel(prize)`, moved out of the handler so they can be tested.
  - `sanitizeRewards` ignores any `type`.
  - It drops invalid tiers and prizes.
  - It dedupes places (the first one wins).
  - It adds a missing tier 1 or 2 as `{ tickets: 0, prize: null }`.
  - It sorts tiers by place.
- **`api/_lib/predictions.js`:** `pickWinners` breaks ties on `lastEditAt` (millis), falling back to `submittedAt`. It is otherwise unchanged.
- **`api/_lib/predictionChat.js` (new):** pure message builders (section 4).

### Actions

| Action | Allowed from | Behaviour |
|---|---|---|
| `preview_hunt` | — | Unchanged. |
| `create` | — | In a transaction: query `hunts` where `status in ['open','locked']`. If any result has `acceptPredictions`, return 400 `ROUND_ACTIVE`. This applies to every create, including suggestion-only rounds, because a newer round would hide the active one from viewers. Otherwise write the round with the sanitized rewards, `announce` (default `true`) and `announced` all `null`. After the write, if `announce` is on, run the announce step for `opened`. The response carries `announce: { posted, reason? }`. |
| `lock` | `open` | Set `status: 'locked'` and `lockedAt`. Then, if announcements are on, run the announce step for `locked`. The response carries `announce`. |
| `reopen` | `locked` | Set `status: 'open'`, `lockedAt: null` and `announced.locked: null`. Posts nothing. |
| `preview_settle { actualPayout }` | `locked` | Read the entries and run `pickWinners`. Writes nothing. Returns `{ actualPayout, entryCount, placements: [...winner-shaped objects with prize and label, or null] }`. |
| `settle { actualPayout }` | `locked` | In one transaction: `tx.get` the round and its `entries`. A settled round returns 400 `ALREADY_SETTLED`; an open round returns 400 `NOT_LOCKED`. Then write everything listed below. |
| `hunt_result` | — | Unchanged. |
| `announce { event }` | see section 4 | Posts one chat message, idempotently. |
| `delete` | — | Unchanged. |

`actualPayout` is validated as today: required, finite, and not an empty string.

Writes made by `settle` (all inside the transaction):
- **Tickets greater than 0:**
  - `tx.set(users/{twitchId}, { tickets: increment, totalEarned: increment, updatedAt }, { merge: true })`. Set-merge means a missing user doc can't fail the settle.
  - A `ticket_ledger` doc (`reason: 'prediction'`, `refId: roundId`, a note naming the place and round).
- **A prize:** a `redemptions` doc containing:
  - `userId`, `twitchName`, `displayName`, `profileImageUrl`
  - `itemId: roundId`, `itemName: "<title> · 1st place"`, `cost: 0`
  - `kind: 'prediction'`, `status: 'pending'`
  - `note: label`, `prizeKind`, `prizeAmount`
  - `predictionRoundId: roundId`, `huntId: roundId`
  - `createdAt`, `fulfilledAt: null`
- **The round:** `actual: { payout }`, `winners`, `status: 'settled'`, `settledAt`, `settledBy`.

The most writes in one transaction is 3 places × 3 writes plus the round, well under Firestore's limit.

Errors: communityhunts failures map to 404/502 as today. Other errors return 500 `INTERNAL`.

## 3. Hidden guesses

### Firestore rules (`firestore.rules`)

```text
match /hunts/{id} {
  allow read: if true;
  allow write: if false;
  match /entries/{entryId} {
    allow read: if isStaff()
      || (isSignedIn() && request.auth.uid == entryId)
      || get(/databases/$(database)/documents/hunts/$(id)).data.status != 'open';
    allow write: if false;
  }
  ...
}
```

- Entry ids are Twitch ids. They equal the viewer's Firebase `uid`, so the viewer's own-entry read (`PredictionSlip`) keeps working.
- A list query by a non-staff viewer while the round is open is denied. The rule can't be proven for every doc in the collection, so clients must not run that query (below).

### Viewer components

- **`PredictionWall`** takes the viewer's staff status from `useAuth().isStaff`.
  - **Open round, viewer not staff:** it doesn't subscribe to entries. It renders a sealed state showing `round.entryCount` ("37 guesses pinned face down · revealed at lock").
  - **Otherwise:** it subscribes as today.
  - The subscription effect depends on `round.status`, so it starts when the round locks and stops before reopen.
  - `onSnapshot` gets an error handler: a permission error falls back to the sealed state.
- **`PredictionNumberLine`:** same gating. It renders nothing while sealed.
- **`PredictionSlip` and `PredictionWinnersReveal`:** show `prize.label ?? prize.cashLabel`.

## 4. Chat announcements

### Messages (`api/_lib/predictionChat.js`)

Money is formatted with `Intl.NumberFormat('en-US', { style: 'currency' })` using the round's currency: the snapshot currency, else USD. Whole amounts show no decimals. Names are `displayName || twitchName`. The link constant is `goofer.tv/gamba/hunts`.

- **`openedMessage(round)`:** `Predictions are open! Guess the final payout of the hunt (14 bonuses, $1,200 in). Closest guess wins. goofer.tv/gamba/hunts`
  - The part in brackets lists `"<n> bonuses"` when `bonusCount > 0` and `"<cost> in"` when the snapshot or manual cost is above 0.
  - The brackets are left out when both are missing.
- **`lockedMessage(round)`:** `Predictions locked. 37 guesses in. Revealed at goofer.tv/gamba/hunts`. The count is `entryCount`, and it says "1 guess" for one.
- **`resultsMessage(round)`:** `Final payout $1,843. 1st: viewerA ($1,810) · 2nd: viewerB ($1,900)`.
  - 3rd place is added when it exists.
  - With no winners: `Final payout $1,843. No guesses this round.`

Posting goes through the existing `sendChannelMessage`, which clips to 500 characters and uses the bot account when configured.

### `announce { id, event }` and the shared announce step

`event` is one of `opened`, `locked`, `results`. The same step runs inside `create` and `lock`.

1. If the round's `announce` is off, return `{ posted: false, reason: 'disabled' }`.
2. Check the round's status for the event:
   - `opened` is allowed in any status.
   - `locked` needs `locked` or `settled`.
   - `results` needs `settled`.
   - Otherwise return 400 `WRONG_STATUS`.
3. **Claim** the event in a transaction: if `announced.<event>` is already set, return `{ posted: false, reason: 'already' }`. Otherwise set it to a server timestamp.
4. Post the message. If the post fails, set `announced.<event>` back to `null` so a retry can post, and return `{ posted: false, reason: <error> }`. A post failure never fails the parent action.

Claiming before posting means two concurrent callers can't both post.

### Results timing (admin page)

`useResultsAnnounce(round)` runs on the admin page. It arms a timer when all of these are true:
- the round is settled
- `announce` is on
- `announced.results` is null
- `settledAt` is less than 5 minutes ago

The timer fires at `settledAt + STREAM_DELAY_MS` (reused from `src/utils/giveaway.js`) and calls `announce { event: 'results' }`. Outside that 5-minute window, results post only through Retry. The winners reveal on the site has no animation, so the stream delay is enough.

## 5. Admin control room (`/admin/hunts`)

The admin area is product register (see CLAUDE.md). The page keeps the current admin visual language: orange admin accent, emerald for positive states, mono eyebrow labels.

### Page structure

- **Current round panel** at the top: the newest round, the same one viewers see. It contains `RoundControl`, then `EntriesTable`, then `RoundResults` once settled.
- **Past rounds** list below, using the existing row style. Selecting a row shows that round in the panel, read-only.
- **"New round"** is disabled while a prediction round is open or locked, with the note "Settle or delete the current round first". The server enforces the same rule (`ROUND_ACTIVE`).

### `RoundControl`

- **Header:** title, context note and status chip. The snapshot line reads `cost · currency · N bonuses · Live | Ended <date>`, or `manual · cost` for manual rounds.
- **Steps:** `01 Open → 02 Locked → 03 Settled`, with the current step highlighted.
  - **Open:** the main button is "Lock entries". A secondary "Lock & settle" calls `lock`, then opens `SettleModal`.
  - **Locked:** the main button is "Settle & pay". A secondary "Reopen".
  - **Settled:** no step actions.
- **Rewards line:** one item per place, e.g. `1st · 100t + $10 cash`, `2nd · 50t`, `3rd · Bonus buy $20`.
- **`ChatStatus`:** for each of opened / locked / results it shows one of: off, posted, pending (with a countdown for results), or failed with Retry. It reads `announced.*`, plus the last error from this session.
- **Delete** with confirm, as today.

### `EntriesTable`

- A live subscription to `hunts/{id}/entries`. Staff can read entries while the round is open.
- Columns: viewer (avatar and name), guess (in the round currency), edits, last edit.
- Before settle it's sorted by guess, ascending. Once settled it's sorted by distance to the actual payout, with a "off by" column and place badges on the winners.
- The header shows the entry count. Empty state: "No guesses yet".

### `SettleModal` (two steps)

1. **Payout:** the input, "Fill from hunt", and the existing live and stale warnings (unchanged). Then "Preview winners", which calls `preview_settle`.
2. **Preview:** the actual payout, then one row per place (place, viewer, guess, off by, prize). An empty place reads "No entry". Below that, "N entries ranked". Buttons: **Back** and **Confirm & pay**, which calls `settle`. Error codes get readable messages (`ALREADY_SETTLED`, `NOT_LOCKED`, and so on).

### `RoundResults`

- **Actual payout** at the top.
- **One row per winner:** guess, off by, "+N tickets credited" when tickets were paid, and the prize label.
- **Prize status:** the live redemption status (pending or fulfilled) read from `redemptions/{redemptionId}`, with a link to `/admin/redemptions`.

### `NewRoundModal` and `RewardsEditor`

- Title, context note, source (with the snapshot preview) and feature switches, as today.
- **`RewardsEditor`:** rows for 1st and 2nd place, plus an optional 3rd (checkbox). Each row has:
  - a ticket count
  - a prize select: None, Cash, or Bonus buy
  - when a prize is chosen, an amount field with a `$` prefix
- **Defaults:** copied from the newest round that has `acceptPredictions` and tiers carrying a `prize` key (the new shape). Otherwise 1st = 100t and 2nd = 50t with no prizes.
- **"Announce in chat"** switch, on by default.
- The create request sends `rewards: { tiers }` and `announce`. It no longer sends `type`.

### Other admin touch

- **`AdminRedemptionsPage`:** for `kind === 'prediction'`, hide the `0t` cost segment. The note already shows the prize label.

## 6. Files

**New:**
- `api/_lib/predictionRewards.js`
- `api/_lib/predictionChat.js`
- `src/utils/predictionRewards.js`
- `src/components/admin/predictions/`:
  - `NewRoundModal.js`
  - `RewardsEditor.js`
  - `SettleModal.js`
  - `RoundControl.js`
  - `EntriesTable.js`
  - `RoundResults.js`
  - `ChatStatus.js`
  - `useResultsAnnounce.js`

**Changed:**
- `api/admin/hunts.js`
- `api/_lib/predictions.js`
- `firestore.rules`
- `src/pages/AdminHuntsPage.js`: now only the round subscriptions and layout.
- `src/components/PredictionWall.js`
- `src/components/PredictionNumberLine.js`
- `src/components/PredictionSlip.js`
- `src/components/PredictionWinnersReveal.js`
- `src/pages/AdminRedemptionsPage.js`
- `CLAUDE.md` (Gotchas: the predictions line)

**Tests:**
- `src/pages/__tests__/AdminHuntsPage.test.js` imports `SettleModal` and `NewRoundModal` from their new files.

## 7. Testing

**Unit tests (Jest):**
- `sanitizeRewards`:
  - a `cash`-style input carries no hidden tickets
  - ticket values are clamped to whole numbers
  - an invalid prize kind or amount becomes `null`
  - tiers 1 and 2 are always present
  - duplicate places are deduped
  - `type` is ignored
- `prizeLabel`: cash (whole and fractional amounts), bonus, and none.
- `pickWinners`: the existing tests, updated so the tie-break is `lastEditAt`, plus a fallback to `submittedAt`.
- Chat messages:
  - opened: with a snapshot, a manual round with a cost, and a manual round without one
  - locked: 1 guess vs many
  - results: 0, 1, 2 and 3 winners, in a non-USD currency

**Handler tests** (`api/admin/hunts.js`, with a small in-memory fake of `adminDb`, `runTransaction` and `sendChannelMessage`, plus mocked `requireAdmin` and communityhunts helpers):
- `create` returns `ROUND_ACTIVE` while a prediction round is open or locked.
- `settle` on an open round returns `NOT_LOCKED`.
- A second `settle` returns `ALREADY_SETTLED` and adds no ledger or user writes.
- `preview_settle` writes nothing.
- `announce` posts once per event. A failed post releases the claim, so the next call posts.
- `lock` with `announce` off posts nothing.

**Render tests:**
- `SettleModal`: Preview calls `preview_settle` and shows the placements, and Confirm calls `settle`. The existing Fill-from-hunt tests keep passing.
- `NewRoundModal`: it starts with the last round's rewards and sends the new tier shape (no `type`, prize object).
- `PredictionWall`: on an open round for a non-staff viewer, it shows the sealed state and runs no entries query; on a locked round it subscribes.
- `HuntsPage`: the existing tests still pass.

**Whole project:** the full Jest suite passes, and `npm run build` finishes with no warnings.

**Manual checks after the rules deploy:**
- A second viewer sees the sealed wall, with no console errors.
- Your own slip submits and shows your guess.
- Locking shows the cards on the open viewer pages.
- The admin entries table fills while the round is open.
- Chat posts arrive for open, lock and results.

## 8. Rollout

1. Build on `feat/prediction-control-room`, open a PR, and the owner merges it. Vercel deploys the client and API.
2. **After** the deploy, run `firebase deploy --only firestore:rules --project goofer-website`. Deploy the rules only after the client, because clients still on the old code query entries while a round is open.
3. **Existing data:**
   - Settled rounds keep `cashLabel`, which the displays fall back to.
   - Old rounds have no `announce` field, so they never post.
   - A round open at deploy time must be locked before settling.
