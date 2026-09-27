# Live watch-time tickets — design

Date: 2026-09-27
Branch: `feat/live-watchtime`

## Goal

Viewers earn store tickets for time spent in GooferG's live stream, in
proportion to how long they stay. The people who hang out the most earn the
most. Chatting earns more than lurking, but lurkers still earn.

## Why the current system fails

`api/cron/award-watchtime.js` runs once a day at 00:00 UTC (it was `*/5` until
commit `f4de4f5` cut it to daily for the Vercel Hobby cron limit). It takes a
single snapshot of the chatter list and gives everyone in it a flat
`WATCHTIME_TICKET_AWARD`. If the stream is offline at that instant nobody earns
anything, and someone who watched four hours earns the same as someone who
joined a minute before the snapshot. It also only pays viewers who have already
logged in on the site, and matches them by lowercased login rather than id.

## Constraints

- **Vercel Pro** (confirmed active on the `goofergs-projects` team): cron can
  run every minute, so a native `*/5` cron is available at no extra cost.
- **Firebase Spark plan**: 20k writes/day, 50k reads/day. Usually fewer than
  100 people in chat. The design must stay far under the write cap, which
  rules out "write every viewer every tick".
- EventSub already delivers every chat message to `api/twitch/eventsub.js`
  (`channel.chat.message`), and the broadcaster token already carries
  `moderator:read:chatters`.

## Decisions

| Question | Decision |
|---|---|
| What counts as hanging out | Presence (in the chat viewer list) earns a base rate; chatting in the same window earns a bonus on top |
| Chatters who never logged in on the site | Track them by Twitch id, bank their tickets, pay out on first login |
| Scheduler | Native Vercel cron, `*/5 * * * *` |
| Accrual granularity | 5-minute windows |
| Payout cadence | Every 30 minutes while live, plus a final payout when the stream ends |
| Ledger shape | One ledger line per viewer per stream, updated at each payout |

## Rates

Configured by env, read at payout time:

| Env var | Default | Meaning |
|---|---|---|
| `WATCHTIME_TICKETS_PER_WINDOW` | `1` | Tickets per 5-minute window present |
| `WATCHTIME_CHAT_BONUS` | `1` | Extra tickets for a window in which the viewer chatted |
| `WATCHTIME_EXCLUDE_LOGINS` | empty | Comma-separated extra logins to ignore (added to the built-in bot list) |

At the defaults a 4-hour stream pays a lurker about 48 tickets and a steady
chatter about 96. The default store item costs 100.

Rates are applied to the unpaid counters at payout time. Changing a rate
mid-stream reprices only windows that have not been paid yet.

`WATCHTIME_TICKET_AWARD` is retired.

## Data model

### `watch_sessions/{streamId}`

One document per Twitch stream (`streamId` is the `id` from Helix
`/streams`). Server-only.

```js
{
  streamId: '41234567890',
  status: 'open' | 'closed',
  startedAt: Timestamp,          // first tick that saw this stream
  lastWindow: 5932190,           // last window credited (dedupe)
  lastSettledAt: Timestamp | null,
  closedAt: Timestamp | null,
  viewers: {
    '<twitchUserId>': {
      login: 'someviewer',
      present: 31,       // windows present
      chat: 12,          // windows with at least one message
      paidTickets: 36,   // tickets already paid out from this session
      paidPresent: 24,   // present windows already converted to minutes
    },
  },
}
```

Size: about 120 bytes per viewer, so the 1 MB document limit is only reached
around 8k unique viewers in a single stream.

### `watch_chat/{windowId}`

Short-lived marker of who chatted in a window. Server-only.

```js
{ window: 5932190, chatters: { '<twitchUserId>': 'someviewer' } }  // id → login
```

The login is stored so a viewer who chatted but is not yet in the chatter list
can still be added to the session with a login.

### `watch_bank/{twitchUserId}`

Tickets earned by a chatter who has no `users` doc yet. Server-only.

```js
{ login: 'someviewer', tickets: 212, minutes: 530, updatedAt: Timestamp }
```

### Changes to existing docs

- `users/{twitchId}` gains `watchMinutes` (lifetime minutes watched live,
  incremented at payout and at bank claim). `lastWatchTimeAwardAt` is no
  longer written or initialized; existing values are left in place.
- `ticket_ledger` gains two reasons:
  - `watchtime`: doc id `watch_{streamId}_{twitchId}`, one per viewer per
    stream. `delta` is set to the session's cumulative `paidTickets` for that
    viewer, and `minutes` and `note` ("Watched 1h 35m") are refreshed at each
    payout. `createdAt` is written only on the first payout so the line keeps
    its place in the `orderBy('createdAt')` history. `updatedAt` changes each
    payout.
  - `watchtime_banked`: one line when banked tickets are claimed at login
    ("Watch time before you signed up: 8h 50m").

## Window math

`windowId = Math.floor(epochMs / 300_000)`. A tick that runs at time `T`
credits the window that just ended: `completed = windowId(T) - 1`. Cron can
fire late by up to a minute without changing which window is credited.

## Components

### `api/_lib/watchtime.js` (pure logic, no Firestore or fetch)

- `windowId(ms)`
- `isExcludedViewer({ id, login }, { broadcasterId, botId, extraLogins })`:
  broadcaster, `TWITCH_BOT_ID`, built-in bot logins (`streamelements`,
  `nightbot`, `moobot`, `fossabot`, `streamlabs`, `sery_bot`, `wizebot`,
  `soundalerts`, `commanderroot`) and `WATCHTIME_EXCLUDE_LOGINS`.
- `creditWindow(viewers, { present: Map<id, login>, chatted: Map<id, login> })`:
  returns the updated `viewers` map. The caller has already removed excluded
  viewers from **both** maps (bots chat too). A viewer who chatted counts as
  present even if the chatter list has not caught up yet. Chat bonus only
  applies to viewers who chatted. New viewers start with all counters at 0.
- `owedFor(viewer, rates)`: returns
  `{ tickets: present × perWindow + chat × chatBonus − paidTickets, windows: present − paidPresent }`,
  each floored at 0.
- `formatWatchNote(minutes)`: `"Watched 1h 35m"`.
- `shouldSettle(completedWindow)`: `(completedWindow + 1) % 6 === 0`, i.e. a
  payout at every :00 and :30 UTC boundary.

### `api/cron/watchtime-tick.js` (replaces `api/cron/award-watchtime.js`)

Auth identical to today: `Authorization: Bearer <CRON_SECRET>`, fail closed
when unset, timing-safe compare.

1. App token, then Helix `/streams?user_id=<TWITCH_BROADCASTER_ID>`.
2. Load chat markers: query `watch_chat` where `window < windowId(now)`. Keep
   the doc for `completed` as the `chatted` set. Delete all of them at the end
   of the tick (including stray docs written while offline).
3. **Offline**: query `watch_sessions` where `status == 'open'`; for each,
   run the final payout and mark it `closed`. Return.
4. **Live**:
   - Any `open` session whose id is not the current `stream.id` (stream
     restarted) gets its final payout and is closed.
   - Fetch all chatters (paginated, broadcaster token via
     `getBroadcasterAccessToken()` in `_lib/twitchBroadcasterToken.js`), keep
     `user_id` and `user_login`, drop excluded viewers.
   - Transaction on `watch_sessions/{stream.id}`: if `lastWindow >=
     completed`, do nothing (duplicate or late fire). Otherwise apply
     `creditWindow`, set `lastWindow = completed`, create the doc with
     `status: 'open'` and `startedAt` if it is new.
   - If `shouldSettle(completed)`, run a payout for this session.
5. Respond `{ ok, live, window, viewers, settled }` for logs.

### Payout (`settleSession` in the tick file, or `api/_lib/watchtimeSettle.js` if it grows)

1. Read the session doc. Collect viewers where `owedFor` is non-zero.
2. `getAll()` on `users/{id}` for those viewers to see who has an account.
3. Write in batches of at most 200 viewers (at most 2 ops per viewer plus one
   session update per batch, under the 500-op limit). Each batch is atomic
   and contains, for each viewer:
   - **Has a user doc**: increment `tickets`, `totalEarned`, `watchMinutes`;
     `set(merge)` the ledger line `watch_{streamId}_{id}`, including
     `createdAt` only when the viewer's `paidTickets` and `paidPresent` were
     both 0 before this payout.
   - **No user doc**: `set(merge)` `watch_bank/{id}` with incremented
     `tickets` and `minutes`, and `login`.
   - Session update: `viewers.{id}.paidTickets` and
     `viewers.{id}.paidPresent` set to their new totals.
4. Set `lastSettledAt` (and `status: 'closed'`, `closedAt` on a final payout).

Because the `paid*` counters commit in the same batch as the credit, a crash
between batches never pays twice or loses tickets. The next payout picks up
whatever is still owed.

### `api/twitch/eventsub.js` (chat marker)

In `handleChatMessage`, after the existing `isHostAccount` early return and
before the giveaway logic, call `markChatted(chatterId)`:

- `window = windowId(Date.now())`.
- Read `watch_chat/{window}`. If `chatters[chatterId]` is already set, stop.
- Otherwise `set({ window, chatters: { [chatterId]: chatterLogin } }, { merge: true })`.

Exclusion is not applied here; the tick filters bots out of the chatted set.

It is wrapped in its own try/catch so a marker failure never blocks giveaway
entry. It runs whether or not the stream is live; offline markers are
swept by the next tick. Two simultaneous messages from the same viewer may
both write; the write is idempotent.

### `api/twitch-auth.js` (bank claim)

After the existing user upsert, run a transaction:

- Read `watch_bank/{twitchId}`. If missing or `tickets <= 0`, return `null`.
- Increment `users.tickets`, `totalEarned`, `watchMinutes`; write a
  `watchtime_banked` ledger line; delete the bank doc.

The response gains `banked: { tickets, minutes } | null`. This runs on every
login, which also catches a bank that was written by a payout racing a first
login.

### Client

- `src/contexts/TwitchAuthContext.js`: `signInWithTwitchCode` returns
  `banked` along with the profile.
- `src/pages/TwitchCallbackPage.js`: navigates to `/me` with
  `state: { banked }`.
- `src/pages/MyAccountPage.js`:
  - One-time banner when `location.state.banked` is present: "You had
    {tickets} tickets waiting from {h}h {m}m of watch time." The state is
    cleared after display so a refresh does not repeat it.
  - Lifetime "hours hung out" stat from `user.watchMinutes`.
  - "How to earn → Watch" copy: "Every 5 minutes you're in chat while live
    earns 1 ticket, 2 if you chatted. Paid out every 30 minutes." The numbers
    are the defaults, written as copy (no env on the client).
  - Ledger reason label `watchtime_banked: 'Banked watch time'`.
- `src/pages/AdminTicketsPage.js`: same `watchtime_banked` label.
- `src/pages/StorePage.js`: header copy leads with watching live.
- `api/admin/users.js` returns `watchMinutes` instead of
  `lastWatchTimeAwardAt`; `src/pages/AdminUsersPage.js` shows watch hours in
  the user row.

### Housekeeping

- `vercel.json`: replace the `award-watchtime` cron with
  `{ "path": "/api/cron/watchtime-tick", "schedule": "*/5 * * * *" }`.
- Delete `api/cron/award-watchtime.js`.
- `api/admin/reset.js`: the `tickets` scope also deletes `watch_bank`,
  `watch_sessions` and `watch_chat`, and zeroes `watchMinutes` alongside the
  other ticket fields.
- `firestore.rules`: explicit `allow read, write: if false` blocks for
  `watch_sessions`, `watch_chat` and `watch_bank` (they are already denied by
  default; the explicit blocks document intent, matching `secrets`).
- `.env.example`: drop `WATCHTIME_TICKET_AWARD`, add the three new vars.
- `scripts/get-broadcaster-refresh-token.mjs`: update the comment that says
  `moderator:read:chatters` is for `award-watchtime`.
- `CLAUDE.md` Gotchas: one entry describing the watch-time tick, the
  per-stream session doc, the bank, and the Spark write budget.

## Firestore budget

4-hour stream, 100 in chat, 30 active chatters, 48 ticks:

| Source | Writes | Reads |
|---|---|---|
| Session transaction per tick | 48 | 48 |
| Chat markers (worst case: every active chatter, every window) | ≤ 1,440 | 1 per message |
| Chat marker sweep | ≤ 48 deletes | ≤ 48 |
| Payouts (8 while live + 1 final), ~100 viewers × 2 ops + session | ~1,800 | ~900 (`getAll`) |
| Offline ticks (rest of the day, ~240) | 0 | ~480 (open-session query + marker query, 1 read each when empty) |
| **Total** | **~3.3k / 20k** | **well under 50k** |

Known pre-existing cost, out of scope: `alreadyProcessed()` in
`eventsub.js` writes one `eventsub_seen` doc per chat message. On a busy
stream that is the largest writer on the Spark plan. Worth a follow-up (for
example, relying on idempotent writes instead of a dedupe doc).

## Failure modes

| Failure | Result |
|---|---|
| Helix, token refresh or chatter fetch fails | Tick logs and returns 500, writes nothing. That window is lost for everyone (5 min). |
| Cron fires twice for one window | Second transaction sees `lastWindow >= completed`, no-op. |
| Cron skips a tick | That window is lost; the next tick credits only its own window. |
| Stream ends between ticks | Next tick sees offline, pays out and closes the open session. |
| Stream restarts (new stream id) | Old session gets a final payout and closes; a new session starts. |
| Payout crashes partway | Completed batches are consistent; the rest is paid at the next payout. |
| Viewer logs in during a payout | Anything written to their bank is claimed at their next login. |
| Chat marker write fails | Viewer loses that window's chat bonus only; giveaway entry is unaffected. |

## Testing

- `src/__tests__/watchtime.test.js` (Jest, same pattern as
  `predictions.test.js`) covers `api/_lib/watchtime.js`:
  - window boundaries and `completed` window;
  - exclusion of broadcaster, bot id, built-in and env logins
    (case-insensitive);
  - `creditWindow`: present only, chatted only (counts as present), both,
    new vs existing viewers;
  - `owedFor`: first payout, partial payout, nothing owed, rate change;
  - `formatWatchNote`: `5m`, `1h`, `1h 35m`;
  - `shouldSettle` every 6th window.
- Handlers stay thin and are verified live: after the first stream, check the
  `watch_sessions` doc, a viewer's ledger line and the Vercel function logs.
  `npm run build` must pass.

## Out of scope

- Watch-time leaderboard or streak multipliers.
- Admin page for live session inspection (Firestore console and logs cover it).
- Crediting VOD or embed-only viewers who are not connected to chat.
- Fixing the `eventsub_seen` write cost.
