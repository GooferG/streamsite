# Goofer Ball Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Viewers call slots into a lottery drum with `!slot <name>`; staff draw balls one at a time on stream to pick a buy hunt's slots, and the caller of the best multiplier wins a per-round prize. All of it shows on a Channel 42 OBS overlay, the control room, and the `/gamba/ball` (CH 42) page.

**Architecture:**

- **Server.** A new Firestore tree `ball_rounds/{id}` (balls, claims, choices) is written only by the server: the EventSub `!slot` branch (`api/_lib/slotCommand.js`) and the staff endpoint `api/admin/ball.js`. Pure rule modules (`ballRules`, `slotMatch`, `ballResults`) hold every decision, so they are unit tested without Firestore.
- **Client.** The client reads the same tree through small hooks. A pure set of `src/components/ball/` components renders the Channel 42 set for the overlay, Stage and CH 42.
- **Reveals switch.** A shared `settings/broadcast` doc decides whether full-screen reveals (ball and giveaway) play in OBS or on Stage.

**Tech Stack:** CRA (react-scripts 5), React 19, Tailwind 3.4, Firebase 12 (client) + firebase-admin (Vercel functions), Jest + @testing-library/react 16 (no jest-dom), lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-09-goofer-ball-design.md` (mockups in `docs/redesign/goofer-ball/`). Read both before starting any task.

## Global Constraints

- **Branch and commits.**
  - Work on `feat/goofer-ball`. Every commit command checks the branch first: `test "$(git branch --show-current)" = feat/goofer-ball && git commit ...`.
  - Commit subjects are short and imperative (`feat(ball): ...`, `test(ball): ...`). **Never add `Co-Authored-By` or any Claude attribution.**
  - Don't push. The owner play-tests on localhost first.
- **Tests.**
  - Run one file with `npm test -- --watchAll=false --testPathPattern=<pattern>`.
  - There is no jest-dom. Assert with `.toBeTruthy()`, `.textContent`, `.getAttribute()`, `queryBy… === null`.
  - CRA's Jest resets mocks before each test, so re-arm every `jest.fn` implementation in `beforeEach`.
  - `react-router-dom` maps to `src/test/reactRouterDomStub.js`, which provides MemoryRouter, Link, Navigate, useNavigate, useLocation and Routes/Route.
  - API tests live in `src/__tests__/` with `/** @jest-environment node */`. They mock `api/_lib/firebaseAdmin.js` with `src/test/fakeFirestore.js`.
- **Fake Firestore limits.**
  - There is no `create()` and no `FieldValue.delete`.
  - `orderBy`/`limit` are ignored.
  - `Timestamp` only has `fromMillis`.
  - Server code must therefore claim slots with transaction `get` + `set`, and never use `create()`.
- **Firestore.**
  - Arrays can't hold `serverTimestamp()`. Rack entries carry `Timestamp.fromMillis(Date.now())`.
  - Dotted claim keys for a draw use `d<drawNo>` (`announced.draws.d3`), never a bare number.
  - Entries never write the round doc.
  - Firebase is on Spark (50k reads, 20k writes per day).
- **Copy.** Chat lines, bot replies and on-set text are copied verbatim from the spec, in the "Outcomes" table and under "Chat lines".
- **Design.**
  - The On Air contract (`src/components/onAir/__tests__/onAirContract.test.js`) scans `src/components/ball/` (added in Task 10). Rules:
    - no `rgba(`, no 6-digit hex and no bare `rounded` in JS (use `src/components/ball/ball.css` with `theme()`, or tokens);
    - no `font-semibold`;
    - no text under 10px (`text-[0.625rem]` is the floor).
  - The `onair.wgoof` tokens appear only under `src/components/ball/`.
  - The control room tab uses the existing `cr-*` classes.
- **Timing.**
  - Client: `DRAW_REVEAL_MS = 8000`, `WINNER_HOLD_MS = 12000`, and `STREAM_DELAY_MS = 3000` (imported from `src/utils/giveaway.js`).
  - Server: `DRAW_REVEAL_MS = 8000`.
  - A draw's chat line is due at `drawnAt + DRAW_REVEAL_MS + STREAM_DELAY_MS`. The results line is due at `settledAt + STREAM_DELAY_MS`.
- **Staff auth.** `requireAdmin` from `api/_lib/verifyAuth.js` (owner or active mod; exposes `.email`).

## Review Focus

These are the five inputs most likely to hurt a real user that the spec's own test list doesn't pin. Each line has a test in the task named.

1. **A `!slot` rush during a draw.** Entries must touch only `balls` and `claims`, never the round doc, so they can't contend with the draw transaction. Test: an accepted entry leaves `ball_rounds/r1` byte-identical (Task 5).
2. **Catalogue ids with `/`, `.`, a leading `_`, or exactly `..`** must still make valid Firestore doc ids for claims. Test: `slotKey` (Task 1).
3. **An OBS reload or a late snapshot after a draw has played** must never replay the takeover. Test: `drawMoment` returns null once `DRAW_REVEAL_MS` has passed, and the overlay renders the corner box instead (Tasks 8 and 13).
4. **communityhunts rows whose multiplier is `null` (unopened), a numeric string, or whose `slot` differs only by case or punctuation.** These must count as pending, parse, and match respectively. Test: `resultRows` (Task 3).
5. **`!slot` followed only by emoji or punctuation, or 300 characters of text,** must answer "couldn't find" (clipped) and never throw. Tests: Tasks 2 and 5.

---

## File map

#### Server (new)

- `api/_lib/ballRules.js` — constants, prize sanitize/label, `slotKey`, entry decision, bot replies, chat lines, `drawKey`.
- `api/_lib/slotAliases.js` — chat nicknames → catalogue names.
- `api/_lib/slotMatch.js` — normalize, edit distance, index, `matchSlot`.
- `api/_lib/ballResults.js` — match rack ↔ hunt bonuses, overrides, ranking (mirrored client-side).
- `api/_lib/chatRoles.js` — `rolesFromBadges`, `isFollower` (moved out of `api/twitch/eventsub.js`).
- `api/_lib/slotCommand.js` — the `!slot` command: parse, gate, match, transaction, reply.
- `api/admin/ball.js` — staff endpoint.

#### Server (modified)

- `api/_lib/predictionRewards.js` — export `sanitizePrize`.
- `api/_lib/twitchChat.js` — `sendChannelMessage(text, { replyTo })`.
- `api/twitch/eventsub.js` — import from `chatRoles`, call `handleSlotCommand`.
- `firestore.rules`, `firestore.indexes.json`.

#### Client (new)

- Utils: `src/utils/ballResults.js` (mirror), `src/utils/ball.js` (timing, moments, view helpers), `src/utils/broadcast.js` (`writeReveals`).
- Hooks: `src/hooks/useBallRound.js`, `useBallsFeed.js`, `useBallHunt.js`, `useBroadcastSettings.js`, `usePageVisible.js`, `useOverlaySound.js` (moved out of `GiveawayOverlay`), `useBallData.js`.
- Set and overlay components (`src/components/ball/`): `ball.css`, `canvasPalette.js`, `drumPhysics.js`, `DrumCanvas.js`, `DrumRig.js`, `ChannelSet.js`, `BallFace.js`, `LowerThird.js`, `DrawTakeover.js`, `WinnerCard.js`, `toastQueue.js`, `CornerBox.js`, `RackBoard.js`, `ballDemo.js`, `ballFixtures.js`.
- CH 42 components (`src/components/ball/`): `SlotFinder.js`, `BallFront.js`, `BallChannel.js`.
- `src/pages/BallOverlay.js`.
- Control room (`src/components/controlRoom/`): `ballApi.js`, `useBallAnnounce.js`, `BallTab.js`, `BallPayout.js`, `HuntLink.js`.

#### Client (modified)

- `tailwind.config.js` (the `onair.wgoof` tokens).
- `src/App.js` (`/ball-overlay`).
- `src/pages/GiveawayOverlay.js` (shared sound hook, reveals switch).
- Control room:
  - `src/contexts/ControlRoomContext.js`;
  - in `src/components/controlRoom/`: `selectors.js`, `storage.js`, `PanelChrome.js`, `ControlRoom.js`, `panelStatus.js`, `Pill.js`, `stageTriggers.js`, `StageMoment.js`.
- Gamba: `src/data/gambaTools.js`, `src/pages/GambaPage.js`, `src/components/gamba/guide.js`, `src/components/gamba/useGuideData.js`.
- Docs: `DESIGN.md`, `CLAUDE.md`.
- Existing tests that pin channel lists, tab LEDs, the Stage button and provider subscriptions (named in each task).

---

### Task 1: Ball rules (pure server module)

**Files:**

- Modify: `api/_lib/predictionRewards.js` (export `sanitizePrize`)
- Create: `api/_lib/ballRules.js`
- Test: `src/__tests__/ballRules.test.js`

**Interfaces:**

- Consumes: `MAX_TICKETS`, `prizeLabel`, `sanitizePrize` from `api/_lib/predictionRewards.js`.
- Produces:
  - Constants: `DRAW_REVEAL_MS` (8000), `ACTIVE_STATUSES` (`['open','closed']`), `CHOICE_TTL_MS`, `REPLY_COOLDOWN_MS`, `BALL_SITE`.
  - Prize: `sanitizeBallPrize(input) → { tickets:number, prize:null|{kind,amount} }`, `hasPrize(prize) → boolean`, `ballPrizeLabel(prize) → string`, `formatMulti(n) → '412x'`.
  - Ids: `slotKey(slotId) → string`, `drawKey(drawNo) → 'd3'`.
  - `entryDecision({ ball, claim, slotId, twitchId }) → { code: 'NEW'|'SWAP'|'SAME'|'TAKEN'|'SCRATCHED'|'ALREADY_DRAWN', oldSlotId?, holder?, slotName? }`.
  - Text: `replyText(code, ctx) → string`, `openedLine(round)`, `drawLine(entry)`, `scratchLine(entry)`, `resultsLine(round)`.

- [ ] **Step 1: Export `sanitizePrize`**

In `api/_lib/predictionRewards.js` change `function sanitizePrize(prize) {` to `export function sanitizePrize(prize) {`. Nothing else changes.

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/ballRules.test.js`:

```js
/**
 * @jest-environment node
 */
import {
  ACTIVE_STATUSES,
  DRAW_REVEAL_MS,
  ballPrizeLabel,
  drawKey,
  drawLine,
  entryDecision,
  formatMulti,
  hasPrize,
  openedLine,
  replyText,
  resultsLine,
  sanitizeBallPrize,
  scratchLine,
  slotKey,
} from '../../api/_lib/ballRules.js';

test('constants', () => {
  expect(DRAW_REVEAL_MS).toBe(8000);
  expect(ACTIVE_STATUSES).toEqual(['open', 'closed']);
  expect(drawKey(3)).toBe('d3');
});

test('prize: tickets clamp to whole numbers, money goes through the prediction sanitizer', () => {
  expect(sanitizeBallPrize({ tickets: '200.7', prize: { kind: 'cash', amount: '5' } })).toEqual({
    tickets: 200,
    prize: { kind: 'cash', amount: 5 },
  });
  expect(sanitizeBallPrize({ tickets: -4, prize: { kind: 'gold', amount: 5 } })).toEqual({ tickets: 0, prize: null });
  expect(sanitizeBallPrize(null)).toEqual({ tickets: 0, prize: null });
  expect(hasPrize({ tickets: 0, prize: null })).toBe(false);
  expect(hasPrize({ tickets: 1, prize: null })).toBe(true);
  expect(hasPrize({ tickets: 0, prize: { kind: 'bonus', amount: 10 } })).toBe(true);
});

test('prize label', () => {
  expect(ballPrizeLabel({ tickets: 200, prize: { kind: 'cash', amount: 5 } })).toBe('200 tickets + $5');
  expect(ballPrizeLabel({ tickets: 1500, prize: null })).toBe('1,500 tickets');
  expect(ballPrizeLabel({ tickets: 0, prize: { kind: 'bonus', amount: 10 } })).toBe('Bonus buy $10');
  expect(ballPrizeLabel(null)).toBe('');
});

test('formatMulti', () => {
  expect(formatMulti(412)).toBe('412x');
  expect(formatMulti(12.456)).toBe('12.46x');
  expect(formatMulti(1204)).toBe('1,204x');
  expect(formatMulti(null)).toBe('—');
});

test('slotKey always makes a legal Firestore doc id', () => {
  expect(slotKey('gates-of-olympus')).toBe('gates-of-olympus');
  for (const id of ['a/b', '.', '..', '__x__', 'big.bass', 'Fire & Roses']) {
    const key = slotKey(id);
    expect(key).not.toMatch(/\//);
    expect(key).not.toBe('.');
    expect(key).not.toBe('..');
    expect(key).not.toMatch(/^__.*__$/);
    expect(key.length).toBeGreaterThan(0);
  }
  expect(slotKey('a/b')).not.toBe(slotKey('a_b'));
});

describe('entryDecision', () => {
  const me = 'v1';
  test('a first call is NEW', () => {
    expect(entryDecision({ ball: null, claim: null, slotId: 's1', twitchId: me })).toEqual({ code: 'NEW' });
  });
  test('a drawn ball is locked', () => {
    const ball = { status: 'drawn', slotId: 's1', slotName: 'Sugar Rush' };
    expect(entryDecision({ ball, claim: null, slotId: 's2', twitchId: me })).toEqual({ code: 'ALREADY_DRAWN', slotName: 'Sugar Rush' });
  });
  test('someone else holds the slot', () => {
    const claim = { twitchId: 'v2', displayName: 'First', scratched: false };
    expect(entryDecision({ ball: null, claim, slotId: 's1', twitchId: me })).toEqual({ code: 'TAKEN', holder: 'First' });
  });
  test('a scratched slot is blocked for everyone, owner included', () => {
    expect(entryDecision({ ball: null, claim: { twitchId: 'v2', scratched: true }, slotId: 's1', twitchId: me }).code).toBe('SCRATCHED');
    const ball = { status: 'scratched', slotId: 's1' };
    expect(entryDecision({ ball, claim: { twitchId: me, scratched: true }, slotId: 's1', twitchId: me }).code).toBe('SCRATCHED');
  });
  test('a scratched ball frees its owner to call a new slot', () => {
    const ball = { status: 'scratched', slotId: 's1' };
    expect(entryDecision({ ball, claim: null, slotId: 's2', twitchId: me })).toEqual({ code: 'NEW' });
  });
  test('swap and same', () => {
    const ball = { status: 'drum', slotId: 's1' };
    expect(entryDecision({ ball, claim: null, slotId: 's2', twitchId: me })).toEqual({ code: 'SWAP', oldSlotId: 's1' });
    expect(entryDecision({ ball, claim: { twitchId: me, scratched: false }, slotId: 's1', twitchId: me })).toEqual({ code: 'SAME' });
  });
});

test('bot replies match the spec outcomes table', () => {
  const name = 'Viewer1';
  expect(replyText('GUESS', { name, slotName: 'Gates of Olympus 1000' })).toBe('@Viewer1 → Gates of Olympus 1000 is in the drum');
  expect(replyText('SWAP', { name, slotName: 'Sugar Rush' })).toBe('@Viewer1 swapped to Sugar Rush');
  expect(
    replyText('AMBIGUOUS', {
      name,
      options: [{ name: 'Sweet Bonanza 1000' }, { name: 'Sweet Bonanza Xmas' }, { name: 'Sweet Bonanza Super Scatter' }],
    })
  ).toBe('@Viewer1 did you mean 1. Sweet Bonanza 1000 · 2. Sweet Bonanza Xmas · 3. Sweet Bonanza Super Scatter? Type !slot 1-3');
  expect(replyText('NOT_FOUND', { name, query: 'xyz' })).toBe('@Viewer1 couldn\'t find "xyz". Exact names: goofer.tv/gamba/ball');
  expect(replyText('NOT_FOUND', { name, query: 'x'.repeat(300) })).toBe(`@Viewer1 couldn't find "${'x'.repeat(40)}…". Exact names: goofer.tv/gamba/ball`);
  expect(replyText('NO_BONUS_BUY', { name, slotName: 'Book of Dead' })).toBe('@Viewer1 Book of Dead has no bonus buy. Pick another.');
  expect(replyText('TAKEN', { name, slotName: 'Gates of Olympus', holder: 'first' })).toBe('@Viewer1 Gates of Olympus is taken by @first. Pick another.');
  expect(replyText('SCRATCHED', { name, slotName: 'Gates of Olympus' })).toBe('@Viewer1 Gates of Olympus was scratched tonight. Pick another.');
  expect(replyText('ALREADY_DRAWN', { name, slotName: 'Sugar Rush' })).toBe("@Viewer1 your ball's already on the rack: Sugar Rush.");
  expect(replyText('NOT_FOLLOWING', { name })).toBe('@Viewer1 follow the channel to call a slot in.');
  expect(replyText('STATUS', { name, slotName: 'Sugar Rush', status: 'drum' })).toBe('@Viewer1 your ball: Sugar Rush (in the drum)');
  expect(replyText('HOW_TO', { name })).toBe('@Viewer1 type !slot <slot name> to call one in');
  expect(replyText('BAD_PICK', { name })).toBe('@Viewer1 that pick list expired. Type !slot <slot name>.');
  expect(replyText('CATALOG_DOWN', { name })).toBe('@Viewer1 slot list is down, try again in a minute.');
});

test('chat lines', () => {
  const round = { prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } } };
  expect(openedLine(round)).toBe(
    '🎱 Goofer Ball is open! Type !slot <slot name> to call one in. Top multi wins 200 tickets + $5. Exact names: goofer.tv/gamba/ball'
  );
  const entry = { drawNo: 3, slotName: 'Gates of Olympus', displayName: 'CoolGuy', twitchName: 'coolguy' };
  expect(drawLine(entry)).toBe('🎱 Ball 3: Gates of Olympus, called in by @CoolGuy');
  expect(scratchLine(entry)).toBe("🎱 Ball 3 scratched (Gates of Olympus isn't available tonight). @CoolGuy, call another slot.");
  expect(resultsLine({ ...round, winner: { ...entry, multiplier: 412 } })).toBe(
    "🎱 Tonight's winning ball: Gates of Olympus at 412x. @CoolGuy wins 200 tickets + $5."
  );
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=ballRules`
Expected: FAIL with "Cannot find module '../../api/_lib/ballRules.js'".

- [ ] **Step 4: Write the implementation**

Create `api/_lib/ballRules.js`:

```js
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=ballRules`
Expected: PASS. Also run `--testPathPattern=adminHuntsApi` and expect PASS; the `sanitizePrize` export must not break the hunts handler.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/predictionRewards.js api/_lib/ballRules.js src/__tests__/ballRules.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): Goofer Ball rules, replies and chat lines"
```

---

### Task 2: Slot matcher and nicknames

**Files:**

- Create: `api/_lib/slotAliases.js`
- Create: `api/_lib/slotMatch.js`
- Test: `src/__tests__/slotMatch.test.js`

**Interfaces:**

- Produces:
  - `SLOT_ALIASES` (`{ nickname: catalogueName }`).
  - `normalizeName(s) → string`, `editDistance(a, b) → number` (optimal string alignment, so a transposition costs 1), `dice(a, b) → 0..1`.
  - `toCatalogSlot(row) → { id, name, thumb, bonusBuy } | null`, `buildSlotIndex(rows, aliases = SLOT_ALIASES) → index`.
  - `matchSlot(index, query) → { kind: 'exact'|'alias'|'guess'|'ambiguous'|'none', slot?, options? }`. `slot` and `options[i]` are catalogue slots `{ id, name, thumb, bonusBuy, … }`.
- Matching order (the spec's matcher section, with exact before nickname): normalize → exact full name (or the space-free form) → nickname → partial tokens with typo tolerance ("plain version wins" by fewest extra tokens; a tie is ambiguous, top 3) → fuzzy whole-name fallback (accept ≥ 0.75 with a ≥ 0.08 margin; offer the top 3 at ≥ 0.5) → none.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/slotMatch.test.js`:

```js
/**
 * @jest-environment node
 */
import { buildSlotIndex, dice, editDistance, matchSlot, normalizeName, toCatalogSlot } from '../../api/_lib/slotMatch.js';

const ROWS = [
  { rainbetSlug: 'gates-of-olympus', name: 'Gates of Olympus', thumb: 'https://img/goo.png', bonusBuy: true },
  { rainbetSlug: 'gates-of-olympus-1000', name: 'Gates of Olympus 1000', bonusBuy: true },
  { rainbetSlug: 'gates-of-olympus-xmas-1000', name: 'Gates of Olympus Xmas 1000', bonusBuy: true },
  { rainbetSlug: 'sweet-bonanza', name: 'Sweet Bonanza', bonusBuy: true },
  { rainbetSlug: 'sweet-bonanza-1000', name: 'Sweet Bonanza 1000', bonusBuy: true },
  { rainbetSlug: 'sweet-bonanza-xmas', name: 'Sweet Bonanza Xmas', bonusBuy: true },
  { rainbetSlug: 'the-dog-house', name: 'The Dog House', bonusBuy: true },
  { rainbetSlug: 'wanted-dead-or-a-wild', name: 'Wanted Dead or a Wild', bonusBuy: true },
  { rainbetSlug: 'book-of-dead', name: 'Book of Dead', bonusBuy: false },
  { rainbetSlug: 'sugar-rush', name: 'Sugar Rush', bonusBuy: true },
  { rainbetSlug: 'sugar-rush-1000', name: 'Sugar Rush 1000', bonusBuy: true },
  { rainbetSlug: 'fire-and-roses-joker', name: 'Fire & Roses Joker', bonusBuy: true },
  { rainbetSlug: 'pinata-wins', name: 'Piñata Wins', bonusBuy: true },
  { rainbetSlug: 'big-bass-bonanza', name: 'Big Bass Bonanza', bonusBuy: true },
  { rainbetSlug: 'big-bass-splash', name: 'Big Bass Splash', bonusBuy: true },
  { slug: 'no-rainbet-slug', name: 'Fallback Slug', bonusBuy: true },
  { name: '' },
];
const ALIASES = { gates: 'Gates of Olympus', sugar: 'Sugar Rush', wanted: 'Wanted Dead or a Wild', ghost: 'Not In The Catalogue' };
const index = buildSlotIndex(ROWS, ALIASES);
const id = (q) => {
  const m = matchSlot(index, q);
  return m.slot ? `${m.kind}:${m.slot.id}` : m.kind;
};

test('normalizeName', () => {
  expect(normalizeName('  GATES   of   Olympus!! ')).toBe('gates of olympus');
  expect(normalizeName('The Dog House')).toBe('dog house');
  expect(normalizeName('Fire & Roses Joker')).toBe('fire and roses joker');
  expect(normalizeName('Piñata Wins')).toBe('pinata wins');
  expect(normalizeName('🎰🎰🎰')).toBe('');
});

test('editDistance counts a transposition as one edit', () => {
  expect(editDistance('olympus', 'olympus')).toBe(0);
  expect(editDistance('olympsu', 'olympus')).toBe(1);
  expect(editDistance('bonanza', 'bonamza')).toBe(1);
  expect(editDistance('abc', '')).toBe(3);
});

test('dice', () => {
  expect(dice('abc', 'abc')).toBe(1);
  expect(dice('a', 'b')).toBe(0);
  expect(dice('sweetbonanzaa', 'sweetbonanza')).toBeGreaterThan(0.9);
});

test('toCatalogSlot prefers the rainbet slug, then slug, then name; drops nameless rows', () => {
  expect(toCatalogSlot(ROWS[0])).toEqual({ id: 'gates-of-olympus', name: 'Gates of Olympus', thumb: 'https://img/goo.png', bonusBuy: true });
  expect(toCatalogSlot(ROWS[15]).id).toBe('no-rainbet-slug');
  expect(toCatalogSlot({ name: 'Only Name' }).id).toBe('Only Name');
  expect(toCatalogSlot({ name: '' })).toBeNull();
});

test('exact names, the space-free form, & and accents', () => {
  expect(id('Gates of Olympus')).toBe('exact:gates-of-olympus');
  expect(id('GATES   OF olympus!!')).toBe('exact:gates-of-olympus');
  expect(id('doghouse')).toBe('exact:the-dog-house');
  expect(id('fire and roses joker')).toBe('exact:fire-and-roses-joker');
  expect(id('pinata wins')).toBe('exact:pinata-wins');
  expect(id('sweet bonanza')).toBe('exact:sweet-bonanza');
});

test('nicknames; an alias to a missing slot is ignored', () => {
  expect(id('gates')).toBe('alias:gates-of-olympus');
  expect(id('Wanted')).toBe('alias:wanted-dead-or-a-wild');
  expect(id('ghost')).toBe('none');
});

test('partial names: the plain version wins, typos are forgiven', () => {
  expect(id('gates olympus')).toBe('guess:gates-of-olympus');
  expect(id('gates of olympsu')).toBe('guess:gates-of-olympus');
  expect(id('olympus 1000')).toBe('guess:gates-of-olympus-1000');
  expect(id('rush')).toBe('guess:sugar-rush');
  expect(id('olymp xmas')).toBe('guess:gates-of-olympus-xmas-1000');
});

test('a tie is ambiguous and offers up to three, shortest name first', () => {
  const m = matchSlot(index, 'big bass');
  expect(m.kind).toBe('ambiguous');
  expect(m.options.map((s) => s.name)).toEqual(['Big Bass Splash', 'Big Bass Bonanza']);
});

test('fuzzy fallback takes a clear winner', () => {
  expect(id('sweetbonanzaa')).toBe('guess:sweet-bonanza');
});

test('nothing close, emoji-only and empty input are none (never throws)', () => {
  expect(id('zzzz qqqq')).toBe('none');
  expect(id('🎰🎰🎰')).toBe('none');
  expect(id('')).toBe('none');
  expect(id('x'.repeat(300))).toBe('none');
});

test('the matcher does not judge bonus buys (the command does)', () => {
  const m = matchSlot(index, 'book of dead');
  expect(m.kind).toBe('exact');
  expect(m.slot.bonusBuy).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=slotMatch`
Expected: FAIL with "Cannot find module '../../api/_lib/slotMatch.js'".

- [ ] **Step 3: Write the nickname list**

Create `api/_lib/slotAliases.js`:

```js
// Chat nicknames for slots → the catalogue name they mean. Keys are matched
// after normalizeName (lowercase, no punctuation, no leading "the"). An alias
// whose target isn't in the catalogue is ignored, so a renamed slot never
// breaks the matcher. Add one when chat keeps using a nickname.
export const SLOT_ALIASES = {
  gates: 'Gates of Olympus',
  goo: 'Gates of Olympus',
  sugar: 'Sugar Rush',
  wanted: 'Wanted Dead or a Wild',
  bonanza: 'Sweet Bonanza',
  sb: 'Sweet Bonanza',
  sbx: 'Sweet Bonanza Xmas',
  'le bandit': 'Le Bandit',
};
```

- [ ] **Step 4: Write the matcher**

Create `api/_lib/slotMatch.js`:

```js
// Turns what chat typed after !slot into one catalogue slot. Pure, so it is
// unit tested; api/_lib/slotCommand.js builds the index once per warm
// instance from communityhunts' /slots catalogue.
import { SLOT_ALIASES } from './slotAliases.js';

const MAX_OPTIONS = 3;
const FUZZY_ACCEPT = 0.75;
const FUZZY_MARGIN = 0.08;
const FUZZY_OFFER = 0.5;

export function normalizeName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ');
}

const squash = (s) => s.replace(/ /g, '');

// Optimal string alignment distance: insert, delete, substitute, and swap two
// neighbouring letters, each costing 1.
export function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j += 1) d[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function bigrams(s) {
  const out = new Map();
  for (let i = 0; i < s.length - 1; i += 1) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return out;
}

function diceOf(aGrams, aLen, bGrams, bLen) {
  if (aLen < 2 || bLen < 2) return 0;
  let overlap = 0;
  for (const [g, n] of aGrams) overlap += Math.min(n, bGrams.get(g) || 0);
  return (2 * overlap) / (aLen - 1 + (bLen - 1));
}

// Sørensen–Dice similarity over letter pairs.
export function dice(a, b) {
  if (a === b) return 1;
  return diceOf(bigrams(a), a.length, bigrams(b), b.length);
}

export function toCatalogSlot(row) {
  if (!row || !row.name) return null;
  return {
    id: String(row.rainbetSlug || row.slug || row.name),
    name: String(row.name),
    thumb: row.thumb || null,
    bonusBuy: row.bonusBuy === true,
  };
}

export function buildSlotIndex(rows, aliases = SLOT_ALIASES) {
  const slots = [];
  const seen = new Set();
  for (const row of rows || []) {
    const slot = toCatalogSlot(row);
    if (!slot || seen.has(slot.id)) continue;
    seen.add(slot.id);
    const norm = normalizeName(slot.name);
    if (!norm) continue;
    const flat = squash(norm);
    slots.push({ ...slot, norm, flat, tokens: norm.split(' '), grams: bigrams(flat) });
  }
  const byNorm = new Map();
  const byFlat = new Map();
  for (const s of slots) {
    if (!byNorm.has(s.norm)) byNorm.set(s.norm, s);
    if (!byFlat.has(s.flat)) byFlat.set(s.flat, s);
  }
  const alias = new Map();
  for (const [nick, target] of Object.entries(aliases || {})) {
    const hit = byNorm.get(normalizeName(target));
    if (hit) alias.set(normalizeName(nick), hit);
  }
  return { slots, byNorm, byFlat, alias };
}

// A typed word matches a name word when equal, when it is a 4+ letter prefix,
// or within 1 edit (5+ letters) or 2 edits (8+ letters).
function tokenClose(q, t) {
  if (q === t) return true;
  if (q.length >= 4 && t.startsWith(q)) return true;
  const allow = q.length >= 8 ? 2 : q.length >= 5 ? 1 : 0;
  if (allow === 0 || Math.abs(q.length - t.length) > allow) return false;
  return editDistance(q, t) <= allow;
}

const publicSlot = ({ id, name, thumb, bonusBuy }) => ({ id, name, thumb, bonusBuy });

export function matchSlot(index, query) {
  const q = normalizeName(String(query || '').slice(0, 80));
  if (!q) return { kind: 'none' };
  const flat = squash(q);

  const exact = index.byNorm.get(q) || index.byFlat.get(flat);
  if (exact) return { kind: 'exact', slot: publicSlot(exact) };
  const nick = index.alias.get(q);
  if (nick) return { kind: 'alias', slot: publicSlot(nick) };

  const qTokens = q.split(' ');
  const candidates = index.slots
    .filter((s) => qTokens.every((qt) => s.tokens.some((t) => tokenClose(qt, t))))
    .map((s) => ({ s, extra: s.tokens.length - qTokens.length }))
    .sort((a, b) => a.extra - b.extra || a.s.name.length - b.s.name.length || a.s.name.localeCompare(b.s.name));
  if (candidates.length === 1 || (candidates.length > 1 && candidates[0].extra < candidates[1].extra)) {
    return { kind: 'guess', slot: publicSlot(candidates[0].s) };
  }
  if (candidates.length > 1) {
    return { kind: 'ambiguous', options: candidates.slice(0, MAX_OPTIONS).map((c) => publicSlot(c.s)) };
  }

  const qGrams = bigrams(flat);
  const scored = index.slots
    .map((s) => ({ s, score: diceOf(qGrams, flat.length, s.grams, s.flat.length) }))
    .filter((x) => x.score >= FUZZY_OFFER)
    .sort((a, b) => b.score - a.score);
  if (scored.length && scored[0].score >= FUZZY_ACCEPT && (scored.length === 1 || scored[0].score - scored[1].score >= FUZZY_MARGIN)) {
    return { kind: 'guess', slot: publicSlot(scored[0].s) };
  }
  if (scored.length) return { kind: 'ambiguous', options: scored.slice(0, MAX_OPTIONS).map((x) => publicSlot(x.s)) };
  return { kind: 'none' };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=slotMatch`
Expected: PASS. If `olymp xmas` or `sweetbonanzaa` misses by a hair, adjust only the constants (`FUZZY_*`) or `tokenClose` thresholds, never the expectations, and re-run every case.

- [ ] **Step 6: Check the nicknames against the live catalogue**

Run (PowerShell):
`(Invoke-RestMethod https://www.goofer.tv/api/slots).slots | Where-Object { $_.name -in @('Gates of Olympus','Sugar Rush','Wanted Dead or a Wild','Sweet Bonanza','Sweet Bonanza Xmas','Le Bandit') } | Select-Object name`
Expected: each target name prints. Delete any `SLOT_ALIASES` entry whose target is missing; an unmatched alias is harmless, but dead weight.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/slotAliases.js api/_lib/slotMatch.js src/__tests__/slotMatch.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): match !slot names against the slot catalogue"
```

---

### Task 3: Results matching (server and client mirror)

**Files:**

- Create: `api/_lib/ballResults.js`
- Create: `src/utils/ballResults.js` (same code plus `settledRows`)
- Test: `src/__tests__/ballResults.test.js`

**Interfaces:**

- Produces (both files):
  - `normName(s)`.
  - `sanitizeOverrides(input) → { [drawNo]: { multiplier:number|null, win, bet, bonusIndex:number|null } }`.
  - `resultRows(round, bonuses = [], overrides = {}) → Row[]`.
  - `rankRows(rows) → Row[]` and `winnerOf(rows) → Row|null`.
- `Row = { drawNo, twitchId, twitchName, displayName, slotId, slotName, thumb, matchCount, multiplier:number|null, win:number|null, bet:number|null, source:'hunt'|'manual'|null }`.
- Client only: `settledRows(round) → Row[]` (rack plus `round.results`).
- Rules:
  - Scratched rack entries are skipped.
  - A bonus matches when `normName(bonus.slot) === normName(entry.slotName)`.
  - A manual `multiplier` beats the hunt.
  - `bonusIndex` picks among duplicate rows; otherwise the first match is used.
  - A `null`, empty or non-numeric multiplier means pending.
  - Ranking: multiplier desc, then win desc, then drawNo asc.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ballResults.test.js`:

```js
/**
 * @jest-environment node
 */
import * as server from '../../api/_lib/ballResults.js';
import * as client from '../utils/ballResults';

const at = (ms) => ({ toMillis: () => ms });
const ROUND = {
  rack: [
    { drawNo: 1, twitchId: 'a', displayName: 'CoolGuy', slotId: 'goo', slotName: 'Gates of Olympus', thumb: 't1', drawnAt: at(1), scratched: false },
    { drawNo: 2, twitchId: 'b', displayName: 'BigWinz', slotId: 'wanted', slotName: 'Wanted Dead or a Wild', thumb: null, drawnAt: at(2), scratched: false },
    { drawNo: 3, twitchId: 'c', displayName: 'Pupper', slotId: 'dog', slotName: 'The Dog House', thumb: null, drawnAt: at(3), scratched: true },
    { drawNo: 4, twitchId: 'd', displayName: 'SugarFan', slotId: 'sugar', slotName: 'Sugar Rush 1000', thumb: null, drawnAt: at(4), scratched: false },
  ],
};
const BONUSES = [
  { slot: 'gates of olympus', bet: 1, win: 412, multiplier: 412 },
  { slot: 'Wanted Dead or a Wild', bet: '2', win: '176', multiplier: '88' },
  { slot: 'The Dog House', bet: 1, win: 900, multiplier: 900 },
  { slot: 'Sugar Rush 1000', bet: 1, win: null, multiplier: null },
  { slot: 'Not On The Rack', bet: 1, win: 5000, multiplier: 5000 },
];

describe.each([
  ['server', server],
  ['client', client],
])('%s', (_label, m) => {
  test('rows: scratched skipped, strings parsed, unopened is pending, case and punctuation ignored', () => {
    const rows = m.resultRows(ROUND, BONUSES);
    expect(rows.map((r) => [r.drawNo, r.multiplier, r.win, r.bet, r.source, r.matchCount])).toEqual([
      [1, 412, 412, 1, 'hunt', 1],
      [2, 88, 176, 2, 'hunt', 1],
      [4, null, null, null, null, 1],
    ]);
  });

  test('a manual multiplier beats the hunt; bonusIndex picks between duplicates', () => {
    const dupes = [...BONUSES, { slot: 'Gates of Olympus', bet: 1, win: 1000, multiplier: 1000 }];
    expect(m.resultRows(ROUND, dupes)[0]).toMatchObject({ multiplier: 412, matchCount: 2 });
    expect(m.resultRows(ROUND, dupes, { 1: { multiplier: null, bonusIndex: 1 } })[0]).toMatchObject({ multiplier: 1000, source: 'hunt' });
    expect(m.resultRows(ROUND, BONUSES, { 4: { multiplier: 41, win: 41, bet: 1, bonusIndex: null } })[2]).toMatchObject({
      multiplier: 41,
      source: 'manual',
    });
  });

  test('ranking: multiplier, then win, then the earlier draw', () => {
    const rows = [
      { drawNo: 1, multiplier: 50, win: 50 },
      { drawNo: 2, multiplier: 50, win: 100 },
      { drawNo: 3, multiplier: 50, win: 100 },
      { drawNo: 4, multiplier: null, win: null },
    ];
    expect(m.rankRows(rows).map((r) => r.drawNo)).toEqual([2, 3, 1]);
    expect(m.winnerOf(rows).drawNo).toBe(2);
    expect(m.winnerOf([{ drawNo: 1, multiplier: null }])).toBeNull();
  });

  test('sanitizeOverrides keeps only usable entries', () => {
    expect(
      m.sanitizeOverrides({ 1: { multiplier: '12.5', win: '25', bet: 'x' }, 0: { multiplier: 3 }, 2: { multiplier: -1 }, 3: { bonusIndex: '1' }, a: { multiplier: 2 } })
    ).toEqual({ 1: { multiplier: 12.5, win: 25, bet: null, bonusIndex: null }, 3: { multiplier: null, win: null, bet: null, bonusIndex: 1 } });
    expect(m.sanitizeOverrides(null)).toEqual({});
  });
});

test('client and server agree', () => {
  const overrides = { 4: { multiplier: 41, win: 41, bet: 1, bonusIndex: null } };
  expect(client.resultRows(ROUND, BONUSES, overrides)).toEqual(server.resultRows(ROUND, BONUSES, overrides));
  expect(client.normName('The Dog House!')).toBe(server.normName('The Dog House!'));
});

test('settledRows reads results off the round', () => {
  const settled = { ...ROUND, results: { 1: { multiplier: 412, win: 412, bet: 1, source: 'hunt' }, 4: { multiplier: 41, win: 41, bet: 1, source: 'manual' } } };
  expect(client.settledRows(settled).map((r) => [r.drawNo, r.multiplier, r.source])).toEqual([
    [1, 412, 'hunt'],
    [2, null, null],
    [4, 41, 'manual'],
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=ballResults`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the server module**

Create `api/_lib/ballResults.js`:

```js
// Goofer Ball results: which hunt bonus row belongs to which drawn ball, and
// who won. Mirrored in src/utils/ballResults.js for the live rack; keep the
// two identical (src/__tests__/ballResults.test.js checks they agree).

export function normName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ');
}

function num(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonNegative(value) {
  const n = num(value);
  return n != null && n >= 0 ? n : null;
}

// Staff-typed results from the payout table, keyed by draw number.
export function sanitizeOverrides(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, raw] of Object.entries(input)) {
    const drawNo = Number(key);
    if (!Number.isInteger(drawNo) || drawNo < 1 || !raw || typeof raw !== 'object') continue;
    const bi = Number(raw.bonusIndex);
    const o = {
      multiplier: nonNegative(raw.multiplier),
      win: nonNegative(raw.win),
      bet: nonNegative(raw.bet),
      bonusIndex: raw.bonusIndex !== '' && raw.bonusIndex != null && Number.isInteger(bi) && bi >= 0 ? bi : null,
    };
    if (o.multiplier == null && o.bonusIndex == null) continue;
    out[drawNo] = o;
  }
  return out;
}

export function resultRows(round, bonuses = [], overrides = {}) {
  const rack = ((round && round.rack) || []).filter((e) => !e.scratched);
  const list = Array.isArray(bonuses) ? bonuses : [];
  return rack.map((e) => {
    const key = normName(e.slotName);
    const matches = list.filter((b) => b && normName(b.slot) === key);
    const o = (overrides && overrides[e.drawNo]) || null;
    const picked = o && o.bonusIndex != null ? matches[o.bonusIndex] || null : matches[0] || null;
    const base = {
      drawNo: e.drawNo,
      twitchId: e.twitchId,
      twitchName: e.twitchName || null,
      displayName: e.displayName || null,
      slotId: e.slotId,
      slotName: e.slotName,
      thumb: e.thumb || null,
      matchCount: matches.length,
    };
    if (o && o.multiplier != null) {
      return { ...base, multiplier: o.multiplier, win: o.win ?? null, bet: o.bet ?? null, source: 'manual' };
    }
    const multiplier = picked ? num(picked.multiplier) : null;
    if (multiplier != null) {
      return { ...base, multiplier, win: num(picked.win), bet: num(picked.bet), source: 'hunt' };
    }
    return { ...base, multiplier: null, win: null, bet: null, source: null };
  });
}

export function rankRows(rows) {
  return (rows || [])
    .filter((r) => r.multiplier != null)
    .sort((a, b) => b.multiplier - a.multiplier || (b.win ?? -1) - (a.win ?? -1) || a.drawNo - b.drawNo);
}

export function winnerOf(rows) {
  return rankRows(rows)[0] || null;
}
```

- [ ] **Step 4: Write the client mirror**

Create `src/utils/ballResults.js` with **exactly** the body of `api/_lib/ballResults.js` above (same functions, same order), with the header comment changed to:

```js
// Mirror of api/_lib/ballResults.js for the live rack (overlay, CH 42, the
// control room payout table). Keep the two identical; the parity test in
// src/__tests__/ballResults.test.js fails when they drift.
```

and this extra export appended at the end:

```js
// A settled round's rows: the rack with the results the payout stored.
export function settledRows(round) {
  const results = (round && round.results) || {};
  return resultRows(round, []).map((r) => {
    const x = results[r.drawNo];
    return x ? { ...r, multiplier: x.multiplier, win: x.win ?? null, bet: x.bet ?? null, source: x.source || null } : r;
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=ballResults`
Expected: PASS (both `describe.each` blocks, the parity test and `settledRows`).

- [ ] **Step 6: Commit**

```bash
git add api/_lib/ballResults.js src/utils/ballResults.js src/__tests__/ballResults.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): match drawn balls to hunt results and rank them"
```

---

### Task 4: Chat plumbing (reply threading, chat roles module)

**Files:**

- Modify: `api/_lib/twitchChat.js`
- Create: `api/_lib/chatRoles.js` (move `rolesFromBadges` and `isFollower` out of `api/twitch/eventsub.js`)
- Modify: `api/twitch/eventsub.js` (import them, drop the local copies and the now-unused imports)
- Test: `src/__tests__/twitchChat.test.js`, `src/__tests__/chatRoles.test.js`

**Interfaces:**

- Produces:
  - `sendChannelMessage(text, { replyTo } = {})`, which sets Helix `reply_parent_message_id` when `replyTo` is given and returns the same `{ ok, twitchMessageId, sentAs }` as today.
  - `rolesFromBadges(badges) → { isTwitchSub, isVip, isMod }`.
  - `isFollower(chatterId, cache: Map) → Promise<true|false|null>`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/twitchChat.test.js`:

```js
/**
 * @jest-environment node
 */
import { sendChannelMessage } from '../../api/_lib/twitchChat.js';
import { getBroadcasterAccessToken, helix } from '../../api/_lib/twitchBroadcasterToken.js';

jest.mock('../../api/_lib/twitchBroadcasterToken.js', () => ({
  helix: jest.fn(),
  getBroadcasterAccessToken: jest.fn(),
  getBotAccessToken: jest.fn(),
}));

beforeEach(() => {
  process.env.TWITCH_BROADCASTER_ID = 'b1';
  delete process.env.TWITCH_BOT_ID;
  delete process.env.TWITCH_BOT_REFRESH_TOKEN;
  getBroadcasterAccessToken.mockResolvedValue('tok');
  helix.mockResolvedValue({ data: [{ is_sent: true, message_id: 'm2' }] });
});

test('a reply threads under the viewer message', async () => {
  await sendChannelMessage('hi', { replyTo: 'm1' });
  expect(helix).toHaveBeenCalledWith('POST', '/chat/messages', 'tok', {
    broadcaster_id: 'b1',
    sender_id: 'b1',
    message: 'hi',
    reply_parent_message_id: 'm1',
  });
});

test('a plain message carries no reply field', async () => {
  await sendChannelMessage('hi');
  expect(helix.mock.calls[0][3]).toEqual({ broadcaster_id: 'b1', sender_id: 'b1', message: 'hi' });
});
```

Create `src/__tests__/chatRoles.test.js`:

```js
/**
 * @jest-environment node
 */
import { isFollower, rolesFromBadges } from '../../api/_lib/chatRoles.js';
import { getBroadcasterAccessToken, helix } from '../../api/_lib/twitchBroadcasterToken.js';

jest.mock('../../api/_lib/twitchBroadcasterToken.js', () => ({
  helix: jest.fn(),
  getBroadcasterAccessToken: jest.fn(),
}));

beforeEach(() => {
  process.env.TWITCH_BROADCASTER_ID = 'b1';
  getBroadcasterAccessToken.mockResolvedValue('tok');
  helix.mockResolvedValue({ data: [{ user_id: 'v1' }] });
});

test('rolesFromBadges', () => {
  expect(rolesFromBadges([{ set_id: 'founder' }, { set_id: 'vip' }])).toEqual({ isTwitchSub: true, isVip: true, isMod: false });
  expect(rolesFromBadges([{ set_id: 'broadcaster' }]).isMod).toBe(true);
  expect(rolesFromBadges(undefined)).toEqual({ isTwitchSub: false, isVip: false, isMod: false });
});

test('isFollower asks Helix once per chatter per call', async () => {
  const cache = new Map();
  expect(await isFollower('v1', cache)).toBe(true);
  expect(await isFollower('v1', cache)).toBe(true);
  expect(helix).toHaveBeenCalledTimes(1);
  helix.mockRejectedValue(new Error('boom'));
  expect(await isFollower('v2', cache)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testPathPattern="twitchChat|chatRoles"`
Expected: `twitchChat` FAILS on the reply test (no `reply_parent_message_id`); `chatRoles` FAILS with "Cannot find module".

- [ ] **Step 3: Add `replyTo` to `sendChannelMessage`**

In `api/_lib/twitchChat.js` change the signature and the Helix body:

```js
export async function sendChannelMessage(text, { replyTo } = {}) {
```

```js
  const res = await helix('POST', '/chat/messages', accessToken, {
    broadcaster_id: broadcasterId,
    sender_id: senderId,
    message: clipped,
    // Threads the line under a viewer's message (the !slot replies).
    ...(replyTo ? { reply_parent_message_id: replyTo } : {}),
  });
```

- [ ] **Step 4: Move the chat-role helpers**

Create `api/_lib/chatRoles.js`, moving `rolesFromBadges` and `isFollower` verbatim from `api/twitch/eventsub.js` (comments included) and exporting both:

```js
import { getBroadcasterAccessToken, helix } from './twitchBroadcasterToken.js';

// Derive chat roles from the badges array on a channel.chat.message event.
// Twitch sends e.g. [{ set_id: 'subscriber', id: '12', info: '14' },
// { set_id: 'vip', id: '1', info: '' }]. We only care about set_id presence.
export function rolesFromBadges(badges) {
  const sets = new Set((badges || []).map((b) => b?.set_id).filter(Boolean));
  return {
    isTwitchSub: sets.has('subscriber') || sets.has('founder'),
    isVip: sets.has('vip'),
    isMod: sets.has('moderator') || sets.has('broadcaster'),
  };
}

// Check whether a chatter follows the broadcaster. Cached per-invocation to
// avoid repeated Helix calls when multiple giveaways are open. Returns true
// if following, false if not, or null when the check could not be performed
// (missing config / Helix error) so callers can choose how to handle.
export async function isFollower(chatterId, cache) {
  if (cache.has(chatterId)) return cache.get(chatterId);
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
  if (!broadcasterId) {
    cache.set(chatterId, null);
    return null;
  }
  try {
    const token = await getBroadcasterAccessToken();
    const r = await helix(
      'GET',
      `/channels/followers?broadcaster_id=${broadcasterId}&user_id=${chatterId}`,
      token
    );
    const following = Array.isArray(r?.data) && r.data.length > 0;
    cache.set(chatterId, following);
    return following;
  } catch (err) {
    console.warn('isFollower check failed', chatterId, err.message);
    cache.set(chatterId, null);
    return null;
  }
}
```

In `api/twitch/eventsub.js`:

- delete the local `rolesFromBadges` and `isFollower` functions and their comments;
- replace `import { getBroadcasterAccessToken, helix } from '../_lib/twitchBroadcasterToken.js';` with `import { isFollower, rolesFromBadges } from '../_lib/chatRoles.js';`.

Nothing else in that file uses `helix` or `getBroadcasterAccessToken`. Confirm with `Grep` for `helix(` and `getBroadcasterAccessToken` in `api/twitch/eventsub.js`; expect 0 matches.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="twitchChat|chatRoles"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/twitchChat.js api/_lib/chatRoles.js api/twitch/eventsub.js src/__tests__/twitchChat.test.js src/__tests__/chatRoles.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "refactor(chat): thread replies; move chat roles out of eventsub"
```

---

### Task 5: The `!slot` chat command

**Files:**

- Create: `api/_lib/slotCommand.js`
- Modify: `api/twitch/eventsub.js` (call it)
- Test: `src/__tests__/slotCommand.test.js`

**Interfaces:**

- Consumes:
  - From `ballRules` (Task 1): `entryDecision`, `replyText`, `slotKey`, `CHOICE_TTL_MS`, `REPLY_COOLDOWN_MS`.
  - From `slotMatch` (Task 2): `buildSlotIndex`, `matchSlot`.
  - From `chatRoles` (Task 4): `isFollower`, `rolesFromBadges`.
  - `sendChannelMessage(text, { replyTo })` (Task 4), and `getSlotCatalog()` from `api/_lib/communityHunts.js`.
- Produces:
  - `parseSlotCommand(text) → string|null`: `''` for a bare `!slot`, `null` when the message isn't the command, otherwise the argument clipped to 80 characters.
  - `handleSlotCommand(event, { now = Date.now() } = {}) → Promise<{ handled, outcome?, replied? }>`.
  - `__resetSlotCommandForTests()`.
- Firestore writes (never the round doc):
  - `ball_rounds/{id}/balls/{twitchId}`;
  - `ball_rounds/{id}/claims/{slotKey}`;
  - `ball_rounds/{id}/choices/{twitchId}`, as `{ options: Slot[], createdAtMs }`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/slotCommand.test.js`:

```js
/**
 * @jest-environment node
 */
import { __resetSlotCommandForTests, handleSlotCommand, parseSlotCommand } from '../../api/_lib/slotCommand.js';
import { __fake } from '../../api/_lib/firebaseAdmin.js';
import { sendChannelMessage } from '../../api/_lib/twitchChat.js';
import { getSlotCatalog } from '../../api/_lib/communityHunts.js';
import { isFollower } from '../../api/_lib/chatRoles.js';
import { CHOICE_TTL_MS } from '../../api/_lib/ballRules.js';

jest.mock('../../api/_lib/firebaseAdmin.js', () => {
  const { createFakeFirestore } = require('../test/fakeFirestore');
  const fake = createFakeFirestore();
  return { adminDb: fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp, __fake: fake };
});
jest.mock('../../api/_lib/twitchChat.js', () => ({ sendChannelMessage: jest.fn() }));
jest.mock('../../api/_lib/communityHunts.js', () => ({ getSlotCatalog: jest.fn() }));
jest.mock('../../api/_lib/chatRoles.js', () => ({
  ...jest.requireActual('../../api/_lib/chatRoles.js'),
  isFollower: jest.fn(),
}));

const NOW = 2_000_000;
const ROWS = [
  { rainbetSlug: 'gates-of-olympus', name: 'Gates of Olympus', thumb: 'https://img/goo.png', bonusBuy: true },
  { rainbetSlug: 'gates-of-olympus-1000', name: 'Gates of Olympus 1000', bonusBuy: true },
  { rainbetSlug: 'sugar-rush', name: 'Sugar Rush', bonusBuy: true },
  { rainbetSlug: 'book-of-dead', name: 'Book of Dead', bonusBuy: false },
  { rainbetSlug: 'big-bass-bonanza', name: 'Big Bass Bonanza', bonusBuy: true },
  { rainbetSlug: 'big-bass-splash', name: 'Big Bass Splash', bonusBuy: true },
];

const event = (text, over = {}) => ({
  chatter_user_id: 'v1',
  chatter_user_login: 'viewer1',
  chatter_user_name: 'Viewer1',
  message_id: 'msg1',
  message: { text },
  badges: [],
  ...over,
});
const run = (text, over, now = NOW) => handleSlotCommand(event(text, over), { now });
const replies = () => sendChannelMessage.mock.calls.map(([text]) => text);
const ball = (id = 'v1') => __fake.read(`ball_rounds/r1/balls/${id}`);
const claimIds = () => __fake.paths('ball_rounds/r1/claims').map((p) => p.split('/').pop());

function seedOpen(extra = {}) {
  __fake.seed('ball_rounds/r1', { status: 'open', requireFollow: true, rack: [], prize: { tickets: 200, prize: null }, ...extra });
}
function seedBall(id, data) {
  __fake.seed(`ball_rounds/r1/balls/${id}`, { twitchId: id, displayName: id, status: 'drum', drawNo: null, ...data });
}

beforeEach(() => {
  __fake.reset();
  __resetSlotCommandForTests();
  sendChannelMessage.mockResolvedValue({ ok: true });
  getSlotCatalog.mockResolvedValue(ROWS);
  isFollower.mockResolvedValue(true);
});

test('parseSlotCommand', () => {
  expect(parseSlotCommand('!slot gates')).toBe('gates');
  expect(parseSlotCommand('  !SLOT   Gates  ')).toBe('Gates');
  expect(parseSlotCommand('!slot')).toBe('');
  expect(parseSlotCommand('!slots gates')).toBeNull();
  expect(parseSlotCommand('hello !slot gates')).toBeNull();
  expect(parseSlotCommand(`!slot ${'x'.repeat(300)}`)).toHaveLength(80);
});

test('not the command, or no open round: nothing happens', async () => {
  expect(await run('hello')).toEqual({ handled: false });
  expect(await run('!slot gates of olympus')).toMatchObject({ handled: true, outcome: 'NO_ROUND' });
  seedOpen({ status: 'closed' });
  expect(await run('!slot gates of olympus')).toMatchObject({ outcome: 'NO_ROUND' });
  expect(replies()).toEqual([]);
  expect(__fake.paths('ball_rounds/r1/balls')).toEqual([]);
});

test('an exact name enters silently and never writes the round doc', async () => {
  seedOpen();
  const before = __fake.read('ball_rounds/r1');
  expect(await run('!slot Gates of Olympus')).toMatchObject({ outcome: 'NEW', replied: false });
  expect(ball()).toMatchObject({
    twitchId: 'v1',
    twitchName: 'viewer1',
    displayName: 'Viewer1',
    slotId: 'gates-of-olympus',
    slotName: 'Gates of Olympus',
    thumb: 'https://img/goo.png',
    status: 'drum',
    drawNo: null,
  });
  expect(claimIds()).toEqual(['gates-of-olympus']);
  expect(__fake.read('ball_rounds/r1/claims/gates-of-olympus')).toMatchObject({ twitchId: 'v1', scratched: false });
  expect(replies()).toEqual([]);
  expect(__fake.read('ball_rounds/r1')).toEqual(before);
});

test('a guess is confirmed in a threaded reply', async () => {
  seedOpen();
  await run('!slot gates olympus');
  expect(ball().slotName).toBe('Gates of Olympus');
  expect(sendChannelMessage).toHaveBeenCalledWith('@Viewer1 → Gates of Olympus is in the drum', { replyTo: 'msg1' });
});

test('the follow gate: followers in, others told, mods and VIPs and open rounds skip it', async () => {
  seedOpen();
  isFollower.mockResolvedValue(false);
  expect(await run('!slot sugar rush')).toMatchObject({ outcome: 'NOT_FOLLOWING' });
  expect(replies()).toEqual(['@Viewer1 follow the channel to call a slot in.']);
  expect(ball()).toBeUndefined();
  isFollower.mockClear();
  await run('!slot sugar rush', { chatter_user_id: 'm1', badges: [{ set_id: 'moderator' }] });
  expect(isFollower).not.toHaveBeenCalled();
  expect(ball('m1').slotName).toBe('Sugar Rush');
  __fake.reset();
  seedOpen({ requireFollow: false });
  await run('!slot sugar rush', { chatter_user_id: 'v9' });
  expect(isFollower).not.toHaveBeenCalled();
  expect(ball('v9').slotName).toBe('Sugar Rush');
});

test('ambiguous: a numbered list, then !slot 2 picks from it; a stale or missing list is refused', async () => {
  seedOpen();
  await run('!slot big bass');
  expect(replies()).toEqual(['@Viewer1 did you mean 1. Big Bass Splash · 2. Big Bass Bonanza? Type !slot 1-2']);
  expect(ball()).toBeUndefined();
  await run('!slot 2', {}, NOW + 11_000);
  expect(ball().slotName).toBe('Big Bass Bonanza');

  await run('!slot 1', { chatter_user_id: 'v2' }, NOW + 30_000);
  expect(replies()).toContain('@Viewer1 that pick list expired. Type !slot <slot name>.');
  await run('!slot big bass', { chatter_user_id: 'v3' }, NOW);
  await run('!slot 1', { chatter_user_id: 'v3' }, NOW + CHOICE_TTL_MS + 1);
  expect(ball('v3')).toBeUndefined();
});

test('no bonus buy, unknown names, emoji and very long input', async () => {
  seedOpen();
  await run('!slot book of dead', {}, NOW);
  await run('!slot 🎰🎰🎰', { chatter_user_id: 'v2' });
  await run(`!slot ${'x'.repeat(300)}`, { chatter_user_id: 'v3' });
  expect(replies()).toEqual([
    '@Viewer1 Book of Dead has no bonus buy. Pick another.',
    '@Viewer1 couldn\'t find "🎰🎰🎰". Exact names: goofer.tv/gamba/ball',
    `@Viewer1 couldn't find "${'x'.repeat(40)}…". Exact names: goofer.tv/gamba/ball`,
  ]);
  expect(__fake.paths('ball_rounds/r1/balls')).toEqual([]);
});

test('taken, scratched, and a drawn ball is locked', async () => {
  seedOpen();
  __fake.seed('ball_rounds/r1/claims/gates-of-olympus', { twitchId: 'v2', displayName: 'First', scratched: false });
  __fake.seed('ball_rounds/r1/claims/sugar-rush', { twitchId: 'v2', displayName: 'First', scratched: true });
  await run('!slot gates of olympus');
  await run('!slot sugar rush', {}, NOW + 11_000);
  seedBall('v4', { slotId: 'gates-of-olympus-1000', slotName: 'Gates of Olympus 1000', status: 'drawn', drawNo: 1 });
  await run('!slot book of dead', { chatter_user_id: 'v4' });
  await run('!slot big bass bonanza', { chatter_user_id: 'v4' }, NOW + 11_000);
  expect(replies()).toEqual([
    '@Viewer1 Gates of Olympus is taken by @First. Pick another.',
    '@Viewer1 Sugar Rush was scratched tonight. Pick another.',
    '@Viewer1 Book of Dead has no bonus buy. Pick another.',
    "@Viewer1 your ball's already on the rack: Gates of Olympus 1000.",
  ]);
  expect(ball('v4').slotName).toBe('Gates of Olympus 1000');
});

test('swap moves the claim; the same slot again is a silent no-op; a scratched ball may call again', async () => {
  seedOpen();
  await run('!slot gates of olympus');
  await run('!slot sugar rush', {}, NOW + 11_000);
  expect(claimIds()).toEqual(['sugar-rush']);
  expect(ball().slotName).toBe('Sugar Rush');
  expect(replies()).toEqual(['@Viewer1 swapped to Sugar Rush']);
  expect(await run('!slot sugar rush', {}, NOW + 30_000)).toMatchObject({ outcome: 'SAME', replied: false });

  seedBall('v5', { slotId: 'big-bass-splash', slotName: 'Big Bass Splash', status: 'scratched', drawNo: 2 });
  __fake.seed('ball_rounds/r1/claims/big-bass-splash', { twitchId: 'v5', scratched: true });
  await run('!slot gates of olympus', { chatter_user_id: 'v5' });
  expect(ball('v5')).toMatchObject({ slotName: 'Gates of Olympus', status: 'drum' });
  expect(claimIds()).toEqual(['big-bass-splash', 'gates-of-olympus', 'sugar-rush']);
});

test('a bare !slot reports your ball or how to enter', async () => {
  seedOpen();
  await run('!slot');
  seedBall('v2', { slotName: 'Sugar Rush', status: 'drum' });
  await run('!slot', { chatter_user_id: 'v2' });
  expect(replies()).toEqual(['@Viewer1 type !slot <slot name> to call one in', '@Viewer1 your ball: Sugar Rush (in the drum)']);
});

test('one reply per viewer per 10s; a failed reply never undoes the entry', async () => {
  seedOpen();
  await run('!slot zzzz qqqq');
  await run('!slot zzzz qqqq', {}, NOW + 1000);
  expect(sendChannelMessage).toHaveBeenCalledTimes(1);
  sendChannelMessage.mockRejectedValue(new Error('CHAT_DROPPED:x'));
  await expect(run('!slot gates olympus', { chatter_user_id: 'v7' })).resolves.toMatchObject({ outcome: 'GUESS' });
  expect(ball('v7').slotName).toBe('Gates of Olympus');
});

test('catalogue down: refused with a retry line', async () => {
  seedOpen();
  getSlotCatalog.mockRejectedValue(new Error('down'));
  await run('!slot gates of olympus');
  expect(replies()).toEqual(['@Viewer1 slot list is down, try again in a minute.']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=slotCommand`
Expected: FAIL with "Cannot find module '../../api/_lib/slotCommand.js'".

- [ ] **Step 3: Write the command**

Create `api/_lib/slotCommand.js`:

```js
// The !slot chat command for Goofer Ball (spec: Chat intake). Called from
// api/twitch/eventsub.js for messages that start with !slot. Replies thread
// under the viewer's message; an exact or nickname entry stays silent
// because the ball dropping on stream is the confirmation.
import { adminDb, FieldValue } from './firebaseAdmin.js';
import { getSlotCatalog } from './communityHunts.js';
import { sendChannelMessage } from './twitchChat.js';
import { isFollower, rolesFromBadges } from './chatRoles.js';
import { buildSlotIndex, matchSlot } from './slotMatch.js';
import { CHOICE_TTL_MS, REPLY_COOLDOWN_MS, entryDecision, replyText, slotKey } from './ballRules.js';

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_QUERY = 80;
const COOLDOWN_CAP = 5000;

let catalog = { index: null, at: 0, pending: null };
const lastReply = new Map();

export function __resetSlotCommandForTests() {
  catalog = { index: null, at: 0, pending: null };
  lastReply.clear();
}

// '' for a bare !slot, the argument for !slot <text>, null when the message
// isn't the command (!slots, or text before it).
export function parseSlotCommand(text) {
  const m = /^!slot(?:\s+([\s\S]*))?$/i.exec(String(text || '').trim());
  if (!m) return null;
  return (m[1] || '').trim().slice(0, MAX_QUERY);
}

// The catalogue index, built once per warm instance and refreshed every 6h.
// A failed refresh keeps the old index: a stale list beats refusing everyone.
async function slotIndex(now) {
  if (catalog.index && now - catalog.at < CATALOG_TTL_MS) return catalog.index;
  if (!catalog.pending) {
    catalog.pending = getSlotCatalog()
      .then((rows) => {
        if (!rows || rows.length === 0) throw new Error('EMPTY_CATALOG');
        catalog = { index: buildSlotIndex(rows), at: now, pending: null };
        return catalog.index;
      })
      .catch((err) => {
        catalog.pending = null;
        if (catalog.index) return catalog.index;
        throw err;
      });
  }
  return catalog.pending;
}

const silent = (outcome) => ({ handled: true, outcome, replied: false });

async function reply(event, viewer, code, ctx, now) {
  const last = lastReply.get(viewer.twitchId);
  if (last != null && now - last < REPLY_COOLDOWN_MS) return silent(code);
  if (lastReply.size > COOLDOWN_CAP) lastReply.clear();
  lastReply.set(viewer.twitchId, now);
  try {
    await sendChannelMessage(replyText(code, { ...ctx, name: viewer.displayName }), { replyTo: event.message_id });
  } catch (err) {
    console.warn('slot reply failed', viewer.twitchId, err.message);
  }
  return { handled: true, outcome: code, replied: true };
}

export async function handleSlotCommand(event, { now = Date.now() } = {}) {
  const arg = parseSlotCommand(event && event.message && event.message.text);
  const twitchId = event && event.chatter_user_id;
  if (arg == null || !twitchId) return { handled: false };
  const viewer = {
    twitchId,
    twitchName: String(event.chatter_user_login || '').toLowerCase() || null,
    displayName: event.chatter_user_name || event.chatter_user_login || 'viewer',
  };

  const open = await adminDb.collection('ball_rounds').where('status', '==', 'open').limit(1).get();
  if (open.empty) return silent('NO_ROUND');
  const roundRef = open.docs[0].ref;
  const round = open.docs[0].data();
  const say = (code, ctx = {}) => reply(event, viewer, code, ctx, now);

  // Followers only by default; mods and VIPs are trusted (the giveaway rule).
  if (round.requireFollow !== false) {
    const roles = rolesFromBadges(event.badges);
    if (!roles.isMod && !roles.isVip && (await isFollower(twitchId, new Map())) !== true) {
      return say('NOT_FOLLOWING');
    }
  }

  const ballRef = roundRef.collection('balls').doc(twitchId);
  if (arg === '') {
    const snap = await ballRef.get();
    if (!snap.exists) return say('HOW_TO');
    const mine = snap.data();
    return say('STATUS', { slotName: mine.slotName, status: mine.status });
  }

  let slot = null;
  let guessed = false;
  if (/^[1-3]$/.test(arg)) {
    const snap = await roundRef.collection('choices').doc(twitchId).get();
    const choice = snap.exists ? snap.data() : null;
    const fresh = !!choice && Number.isFinite(choice.createdAtMs) && now - choice.createdAtMs < CHOICE_TTL_MS;
    slot = fresh ? (choice.options || [])[Number(arg) - 1] || null : null;
    if (!slot) return say('BAD_PICK');
  } else {
    let index;
    try {
      index = await slotIndex(now);
    } catch (err) {
      console.warn('slot catalogue unavailable', err.message);
      return say('CATALOG_DOWN');
    }
    const match = matchSlot(index, arg);
    if (match.kind === 'none') return say('NOT_FOUND', { query: arg });
    if (match.kind === 'ambiguous') {
      await roundRef.collection('choices').doc(twitchId).set({ options: match.options, createdAtMs: now });
      return say('AMBIGUOUS', { options: match.options });
    }
    slot = match.slot;
    guessed = match.kind === 'guess';
  }
  if (!slot.bonusBuy) return say('NO_BONUS_BUY', { slotName: slot.name });

  const claims = roundRef.collection('claims');
  const claimRef = claims.doc(slotKey(slot.id));
  // Only the viewer's ball and the slot's claim. Entries never touch the
  // round doc, so a !slot rush can't hold up a draw; a draw that lands on
  // this ball mid-swap makes the transaction retry and see it drawn.
  const decision = await adminDb.runTransaction(async (tx) => {
    const [ballSnap, claimSnap] = await Promise.all([tx.get(ballRef), tx.get(claimRef)]);
    const current = ballSnap.exists ? ballSnap.data() : null;
    const claim = claimSnap.exists ? claimSnap.data() : null;
    const d = entryDecision({ ball: current, claim, slotId: slot.id, twitchId });
    if (d.code !== 'NEW' && d.code !== 'SWAP') return d;
    const ts = FieldValue.serverTimestamp();
    if (d.code === 'SWAP') tx.delete(claims.doc(slotKey(current.slotId)));
    tx.set(claimRef, { twitchId, displayName: viewer.displayName, scratched: false, createdAt: ts });
    tx.set(ballRef, {
      twitchId,
      twitchName: viewer.twitchName,
      displayName: viewer.displayName,
      slotId: slot.id,
      slotName: slot.name,
      thumb: slot.thumb || null,
      status: 'drum',
      drawNo: null,
      enteredAt: (d.code === 'SWAP' && current.enteredAt) || ts,
      updatedAt: ts,
    });
    return d;
  });

  switch (decision.code) {
    case 'NEW':
      return guessed ? say('GUESS', { slotName: slot.name }) : silent('NEW');
    case 'SWAP':
      return say('SWAP', { slotName: slot.name });
    case 'TAKEN':
      return say('TAKEN', { slotName: slot.name, holder: decision.holder });
    case 'SCRATCHED':
      return say('SCRATCHED', { slotName: slot.name });
    case 'ALREADY_DRAWN':
      return say('ALREADY_DRAWN', { slotName: decision.slotName });
    default:
      return silent(decision.code);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=slotCommand`
Expected: PASS.

- [ ] **Step 5: Call it from EventSub**

In `api/twitch/eventsub.js`, add the import next to the other `_lib` imports:

```js
import { handleSlotCommand } from '../_lib/slotCommand.js';
```

In `handleChatMessage`, directly after the `markChatted` try/catch block and before `const chatRoles = rolesFromBadges(event.badges);`, add:

```js
  // Goofer Ball: !slot calls a slot into the drum. It has its own try/catch,
  // so a ball failure never blocks giveaway entries (and the reverse).
  if (/^!slot\b/i.test(text.trim())) {
    try {
      await handleSlotCommand(event);
    } catch (err) {
      console.error('slot command failed', err);
    }
  }
```

Also add one line to the header comment's numbered list in that file: `//   0b. Messages starting with !slot go to api/_lib/slotCommand.js (Goofer Ball).`

- [ ] **Step 6: Re-run the server suites**

Run: `npm test -- --watchAll=false --testPathPattern="slotCommand|chatRoles|twitchChat|adminGiveawaysApi"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/slotCommand.js api/twitch/eventsub.js src/__tests__/slotCommand.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): !slot calls a slot into the drum from chat"
```

---

### Task 6: Staff endpoint, part 1: lifecycle, draws, scratches, chat lines, rules

**Files:**

- Create: `api/admin/ball.js`
- Modify: `firestore.rules`, `firestore.indexes.json`
- Test: `src/__tests__/adminBallApi.test.js`

**Interfaces:**

- Consumes: from Task 1, `ACTIVE_STATUSES`, `DRAW_REVEAL_MS`, `drawKey`, `drawLine`, `hasPrize`, `openedLine`, `resultsLine`, `sanitizeBallPrize`, `scratchLine` and `slotKey`. Also `getHunt` and `CommunityHuntsError` from `api/_lib/communityHunts.js`.
- Produces: `POST /api/admin/ball` with `{ action, id?, ... }` (staff auth).
  - **`open`** `{ prize, requireFollow }`
    - Returns `{ ok, id, announce }`.
    - Errors: `ROUND_ACTIVE`, `INVALID_PRIZE`.
  - **`update_prize`** `{ id, prize }`
    - Returns `{ ok, prize }`.
    - Errors: `FINAL`, `INVALID_PRIZE`.
  - **`draw`** `{ id }`
    - Returns `{ ok, entry }`, where `entry.drawnAt` is in ms.
    - Errors: `NOT_OPEN`, `EMPTY_DRUM`, 409 `DRAW_BUSY`.
  - **`scratch`** `{ id, drawNo }`
    - Returns `{ ok, entry, announce }`.
    - Errors: `FINAL`, `NOT_DRAWN`, `ALREADY_SCRATCHED`.
  - **`close`**, **`reopen`** and **`cancel`** `{ id }`
    - Return `{ ok }`.
    - Errors: `NOT_OPEN`, `NOT_CLOSED`, `FINAL`.
  - **`link_hunt`** `{ id, huntId|null }`
    - Returns `{ ok, huntId }`.
    - Errors: `FINAL`, 404 `HUNT_NOT_FOUND`, 502 `COMMUNITYHUNTS_UNAVAILABLE`.
  - **`announce`** `{ id, event: 'opened'|'draw'|'scratch'|'results', drawNo? }`
    - Returns `{ ok, announce: { posted, reason? } }`.
    - Errors: 409 `TOO_EARLY`, `NOT_DRAWN`, `NOT_SCRATCHED`, `NOT_SETTLED`, `INVALID_EVENT`.
- Round doc written by `open`, exactly:

```js
{ status: 'open', prize, requireFollow, rack: [], lastDrawAt: null, huntId: null, results: null, winner: null,
  announced: { opened: null, draws: {}, scratches: {}, results: null },
  openedAt: <serverTimestamp>, closedAt: null, settledAt: null, cancelledAt: null, openedBy: admin.email }
```

- Rack entry: `{ drawNo, twitchId, twitchName, displayName, slotId, slotName, thumb, drawnAt: Timestamp, scratched: false }`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/adminBallApi.test.js`:

```js
/**
 * @jest-environment node
 */
import handler from '../../api/admin/ball';
import { __fake } from '../../api/_lib/firebaseAdmin.js';
import { sendChannelMessage } from '../../api/_lib/twitchChat.js';
import { CommunityHuntsError, getHunt } from '../../api/_lib/communityHunts.js';

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
  getHunt: jest.fn(),
}));

const NOW = 5_000_000;

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
const round = (id = 'r1') => __fake.read(`ball_rounds/${id}`);

function seedRound(id, data = {}) {
  __fake.seed(`ball_rounds/${id}`, {
    status: 'open',
    prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
    requireFollow: true,
    rack: [],
    lastDrawAt: null,
    huntId: null,
    results: null,
    winner: null,
    announced: { opened: null, draws: {}, scratches: {}, results: null },
    ...data,
  });
}
function seedBall(roundId, twitchId, data = {}) {
  __fake.seed(`ball_rounds/${roundId}/balls/${twitchId}`, {
    twitchId,
    twitchName: twitchId,
    displayName: twitchId.toUpperCase(),
    slotId: `slot-${twitchId}`,
    slotName: `Slot ${twitchId}`,
    thumb: null,
    status: 'drum',
    drawNo: null,
    ...data,
  });
}
const entry = (drawNo, twitchId, extra = {}) => ({
  drawNo,
  twitchId,
  twitchName: twitchId,
  displayName: twitchId.toUpperCase(),
  slotId: `slot-${twitchId}`,
  slotName: `Slot ${twitchId}`,
  thumb: null,
  drawnAt: ts(NOW - 60_000),
  scratched: false,
  ...extra,
});

beforeEach(() => {
  __fake.reset();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  sendChannelMessage.mockResolvedValue({ ok: true });
  getHunt.mockResolvedValue({ id: 'h1', bonuses: [] });
});
afterEach(() => {
  Date.now.mockRestore();
});

describe('open', () => {
  test('refuses while a round is open or closed; a settled one does not block', async () => {
    seedRound('r0', { status: 'closed' });
    expect((await call({ action: 'open', prize: { tickets: 100 } })).body).toEqual({ error: 'ROUND_ACTIVE' });
    __fake.reset();
    seedRound('r0', { status: 'settled' });
    expect((await call({ action: 'open', prize: { tickets: 100 } })).statusCode).toBe(200);
  });

  test('needs a prize', async () => {
    const res = await call({ action: 'open', prize: { tickets: 0, prize: null } });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'INVALID_PRIZE' });
  });

  test('writes the round and posts the opening line once', async () => {
    const res = await call({ action: 'open', prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } }, requireFollow: false });
    expect(res.body).toMatchObject({ ok: true, announce: { posted: true } });
    const r = round(res.body.id);
    expect(r).toMatchObject({
      status: 'open',
      prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
      requireFollow: false,
      rack: [],
      huntId: null,
      openedBy: 'owner@test',
    });
    expect(r.announced.opened).toBeTruthy();
    expect(sendChannelMessage).toHaveBeenCalledWith(
      '🎱 Goofer Ball is open! Type !slot <slot name> to call one in. Top multi wins 200 tickets + $5. Exact names: goofer.tv/gamba/ball'
    );
    await call({ action: 'announce', id: res.body.id, event: 'opened' });
    expect(sendChannelMessage).toHaveBeenCalledTimes(1);
  });

  test('a chat failure still opens the round and frees the claim for a retry', async () => {
    sendChannelMessage.mockRejectedValue(new Error('CHAT_DROPPED:x'));
    const res = await call({ action: 'open', prize: { tickets: 50 } });
    expect(res.statusCode).toBe(200);
    expect(res.body.announce).toEqual({ posted: false, reason: 'CHAT_DROPPED:x' });
    expect(round(res.body.id).announced.opened).toBeNull();
  });
});

describe('draw', () => {
  test('needs an open round and someone in the drum', async () => {
    seedRound('r1', { status: 'closed' });
    expect((await call({ action: 'draw', id: 'r1' })).body).toEqual({ error: 'NOT_OPEN' });
    seedRound('r1');
    seedBall('r1', 'a', { status: 'drawn', drawNo: 1 });
    expect((await call({ action: 'draw', id: 'r1' })).body).toEqual({ error: 'EMPTY_DRUM' });
  });

  test('draws a drum ball onto the rack', async () => {
    seedRound('r1', { rack: [entry(1, 'a')] });
    seedBall('r1', 'a', { status: 'drawn', drawNo: 1 });
    seedBall('r1', 'b', { status: 'scratched', drawNo: null });
    seedBall('r1', 'c', { slotName: 'Gates of Olympus', thumb: 'https://img/goo.png' });
    const res = await call({ action: 'draw', id: 'r1' });
    expect(res.body).toMatchObject({ ok: true, entry: { drawNo: 2, twitchId: 'c', slotName: 'Gates of Olympus', drawnAt: NOW } });
    const r = round();
    expect(r.rack).toHaveLength(2);
    expect(r.rack[1]).toMatchObject({ drawNo: 2, twitchId: 'c', displayName: 'C', slotId: 'slot-c', thumb: 'https://img/goo.png', scratched: false });
    expect(r.rack[1].drawnAt.toMillis()).toBe(NOW);
    expect(r.lastDrawAt.toMillis()).toBe(NOW);
    expect(__fake.read('ball_rounds/r1/balls/c')).toMatchObject({ status: 'drawn', drawNo: 2 });
    expect(sendChannelMessage).not.toHaveBeenCalled();
  });

  test('refuses while the last reveal is still playing', async () => {
    seedRound('r1', { lastDrawAt: ts(NOW - 1000) });
    seedBall('r1', 'a');
    const busy = await call({ action: 'draw', id: 'r1' });
    expect(busy.statusCode).toBe(409);
    expect(busy.body).toEqual({ error: 'DRAW_BUSY' });
    seedRound('r1', { lastDrawAt: ts(NOW - 8000) });
    expect((await call({ action: 'draw', id: 'r1' })).statusCode).toBe(200);
  });
});

describe('scratch', () => {
  test('marks the rack, the ball and the claim, and posts the scratch line', async () => {
    seedRound('r1', { rack: [entry(1, 'a', { slotName: 'Gates of Olympus' })] });
    seedBall('r1', 'a', { status: 'drawn', drawNo: 1 });
    __fake.seed('ball_rounds/r1/claims/slot-a', { twitchId: 'a', scratched: false });
    const res = await call({ action: 'scratch', id: 'r1', drawNo: 1 });
    expect(res.body).toMatchObject({ ok: true, entry: { drawNo: 1, scratched: true }, announce: { posted: true } });
    expect(round().rack[0].scratched).toBe(true);
    expect(__fake.read('ball_rounds/r1/balls/a').status).toBe('scratched');
    expect(__fake.read('ball_rounds/r1/claims/slot-a')).toMatchObject({ twitchId: 'a', scratched: true });
    expect(sendChannelMessage).toHaveBeenCalledWith("🎱 Ball 1 scratched (Gates of Olympus isn't available tonight). @A, call another slot.");
    expect((await call({ action: 'scratch', id: 'r1', drawNo: 1 })).body).toEqual({ error: 'ALREADY_SCRATCHED' });
    expect((await call({ action: 'scratch', id: 'r1', drawNo: 9 })).body).toEqual({ error: 'NOT_DRAWN' });
  });

  test('nothing changes on a settled round', async () => {
    seedRound('r1', { status: 'settled', rack: [entry(1, 'a')] });
    expect((await call({ action: 'scratch', id: 'r1', drawNo: 1 })).body).toEqual({ error: 'FINAL' });
  });
});

test('close, reopen and cancel', async () => {
  seedRound('r1');
  expect((await call({ action: 'reopen', id: 'r1' })).body).toEqual({ error: 'NOT_CLOSED' });
  await call({ action: 'close', id: 'r1' });
  expect(round().status).toBe('closed');
  expect(round().closedAt).toBeTruthy();
  expect((await call({ action: 'close', id: 'r1' })).body).toEqual({ error: 'NOT_OPEN' });
  await call({ action: 'reopen', id: 'r1' });
  expect(round()).toMatchObject({ status: 'open', closedAt: null });
  await call({ action: 'cancel', id: 'r1' });
  expect(round().status).toBe('cancelled');
  expect((await call({ action: 'cancel', id: 'r1' })).body).toEqual({ error: 'FINAL' });
  expect((await call({ action: 'close', id: 'nope' })).statusCode).toBe(404);
});

test('update_prize', async () => {
  seedRound('r1', { status: 'closed' });
  const res = await call({ action: 'update_prize', id: 'r1', prize: { tickets: '300', prize: { kind: 'bonus', amount: 20 } } });
  expect(res.body).toEqual({ ok: true, prize: { tickets: 300, prize: { kind: 'bonus', amount: 20 } } });
  expect(round().prize).toEqual({ tickets: 300, prize: { kind: 'bonus', amount: 20 } });
  expect((await call({ action: 'update_prize', id: 'r1', prize: {} })).body).toEqual({ error: 'INVALID_PRIZE' });
  seedRound('r1', { status: 'settled' });
  expect((await call({ action: 'update_prize', id: 'r1', prize: { tickets: 5 } })).body).toEqual({ error: 'FINAL' });
});

test('link_hunt checks the hunt exists; null unlinks', async () => {
  seedRound('r1');
  expect((await call({ action: 'link_hunt', id: 'r1', huntId: 'h1' })).body).toEqual({ ok: true, huntId: 'h1' });
  expect(getHunt).toHaveBeenCalledWith('h1');
  expect(round().huntId).toBe('h1');
  getHunt.mockRejectedValue(new CommunityHuntsError('NOT_FOUND', 404));
  const missing = await call({ action: 'link_hunt', id: 'r1', huntId: 'zz' });
  expect(missing.statusCode).toBe(404);
  expect(missing.body.error).toBe('HUNT_NOT_FOUND');
  getHunt.mockClear();
  expect((await call({ action: 'link_hunt', id: 'r1', huntId: null })).body).toEqual({ ok: true, huntId: null });
  expect(getHunt).not.toHaveBeenCalled();
  expect(round().huntId).toBeNull();
});

describe('announce draw', () => {
  test('never before the reveal has played; then once', async () => {
    seedRound('r1', { rack: [entry(1, 'a', { drawnAt: ts(NOW - 2000), slotName: 'Sugar Rush' })] });
    const early = await call({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 });
    expect(early.statusCode).toBe(409);
    expect(early.body).toEqual({ error: 'TOO_EARLY' });
    Date.now.mockReturnValue(NOW + 7000);
    expect((await call({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 })).body.announce).toEqual({ posted: true });
    expect(sendChannelMessage).toHaveBeenCalledWith('🎱 Ball 1: Sugar Rush, called in by @A');
    expect(round().announced.draws.d1).toBeTruthy();
    expect((await call({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 })).body.announce).toEqual({ posted: false, reason: 'already' });
    expect(sendChannelMessage).toHaveBeenCalledTimes(1);
  });

  test('a scratched draw is skipped; a failed post frees the claim', async () => {
    seedRound('r1', { rack: [entry(1, 'a', { scratched: true }), entry(2, 'b')] });
    expect((await call({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 })).body.announce).toEqual({ posted: false, reason: 'scratched' });
    sendChannelMessage.mockRejectedValue(new Error('boom'));
    expect((await call({ action: 'announce', id: 'r1', event: 'draw', drawNo: 2 })).body.announce).toEqual({ posted: false, reason: 'boom' });
    expect(round().announced.draws.d2).toBeNull();
  });

  test('unknown events and results before settle are refused', async () => {
    seedRound('r1');
    expect((await call({ action: 'announce', id: 'r1', event: 'nope' })).body).toEqual({ error: 'INVALID_EVENT' });
    expect((await call({ action: 'announce', id: 'r1', event: 'results' })).body).toEqual({ error: 'NOT_SETTLED' });
  });
});

test('unknown actions', async () => {
  seedRound('r1');
  expect((await call({ action: 'explode', id: 'r1' })).body).toEqual({ error: 'UNKNOWN_ACTION' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=adminBallApi`
Expected: FAIL with "Cannot find module '../../api/admin/ball'".

- [ ] **Step 3: Write the endpoint**

Create `api/admin/ball.js`:

```js
import { randomInt } from 'node:crypto';
import { adminDb, FieldValue, Timestamp } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';
import { CommunityHuntsError, getHunt } from '../_lib/communityHunts.js';
import { sendChannelMessage } from '../_lib/twitchChat.js';
import {
  ACTIVE_STATUSES,
  DRAW_REVEAL_MS,
  drawKey,
  drawLine,
  hasPrize,
  openedLine,
  resultsLine,
  sanitizeBallPrize,
  scratchLine,
  slotKey,
} from '../_lib/ballRules.js';

// Goofer Ball staff endpoint (spec: Staff API). POST { action, id?, ... }.
// One round can be open or closed at a time. Entries come from chat
// (api/_lib/slotCommand.js), never from here.

class ActionError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const rounds = () => adminDb.collection('ball_rounds');
const tsMs = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null);
// A draw line may post this much before the reveal ends (clock skew between
// the driving staff browser and the server).
const EARLY_SLACK_MS = 1000;

// Check-and-write in one transaction so two staff tabs can't interleave.
async function mutate(ref, fn) {
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ActionError(404, 'NOT_FOUND');
    return fn(tx, snap.data());
  });
}

function assertActive(round) {
  if (!ACTIVE_STATUSES.includes(round.status)) throw new ActionError(400, 'FINAL');
}

const findEntry = (round, drawNo) => (round.rack || []).find((e) => e.drawNo === Number(drawNo)) || null;

// Claims one chat line on the round in a transaction, then posts it, so two
// callers can't both post. A failed post releases the claim for a retry.
async function announceEvent(ref, event, drawNo, nowMs) {
  const claim = await mutate(ref, async (tx, round) => {
    const announced = round.announced || {};
    let field;
    let text;
    if (event === 'opened') {
      if (announced.opened) return null;
      field = 'announced.opened';
      text = openedLine(round);
    } else if (event === 'draw' || event === 'scratch') {
      const entry = findEntry(round, drawNo);
      if (!entry) throw new ActionError(400, 'NOT_DRAWN');
      const bucket = event === 'draw' ? 'draws' : 'scratches';
      if (announced[bucket] && announced[bucket][drawKey(entry.drawNo)]) return null;
      if (event === 'draw') {
        if (entry.scratched) return { skip: 'scratched' };
        const at = tsMs(entry.drawnAt);
        // Chat runs ahead of the video: a line before the reveal spoils it.
        if (at != null && nowMs < at + DRAW_REVEAL_MS - EARLY_SLACK_MS) throw new ActionError(409, 'TOO_EARLY');
        text = drawLine(entry);
      } else {
        if (!entry.scratched) throw new ActionError(400, 'NOT_SCRATCHED');
        text = scratchLine(entry);
      }
      field = `announced.${bucket}.${drawKey(entry.drawNo)}`;
    } else if (event === 'results') {
      if (round.status !== 'settled' || !round.winner) throw new ActionError(400, 'NOT_SETTLED');
      if (announced.results) return null;
      field = 'announced.results';
      text = resultsLine(round);
    } else {
      throw new ActionError(400, 'INVALID_EVENT');
    }
    tx.update(ref, { [field]: FieldValue.serverTimestamp() });
    return { field, text };
  });
  if (!claim) return { posted: false, reason: 'already' };
  if (claim.skip) return { posted: false, reason: claim.skip };
  try {
    await sendChannelMessage(claim.text);
    return { posted: true };
  } catch (err) {
    console.error('ball chat announce failed', err);
    try {
      await ref.update({ [claim.field]: null });
    } catch (releaseErr) {
      console.error('ball chat claim release failed', releaseErr);
    }
    return { posted: false, reason: err.message };
  }
}

// open and scratch have already written; a chat problem must not turn that
// into an error response.
async function announceQuietly(ref, event, drawNo, nowMs) {
  try {
    return await announceEvent(ref, event, drawNo, nowMs);
  } catch (err) {
    console.error('ball chat announce failed', err);
    return { posted: false, reason: err.code || err.message };
  }
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { action, ...payload } = req.body || {};
  const nowMs = Date.now();

  try {
    if (action === 'open') {
      const prize = sanitizeBallPrize(payload.prize);
      if (!hasPrize(prize)) return res.status(400).json({ error: 'INVALID_PRIZE' });
      const ref = rounds().doc();
      await adminDb.runTransaction(async (tx) => {
        const active = await tx.get(rounds().where('status', 'in', ACTIVE_STATUSES));
        if (!active.empty) throw new ActionError(400, 'ROUND_ACTIVE');
        tx.set(ref, {
          status: 'open',
          prize,
          requireFollow: payload.requireFollow !== false,
          rack: [],
          lastDrawAt: null,
          huntId: null,
          results: null,
          winner: null,
          announced: { opened: null, draws: {}, scratches: {}, results: null },
          openedAt: FieldValue.serverTimestamp(),
          closedAt: null,
          settledAt: null,
          cancelledAt: null,
          openedBy: admin.email,
        });
      });
      const announce = await announceQuietly(ref, 'opened', null, nowMs);
      return res.status(200).json({ ok: true, id: ref.id, announce });
    }

    const { id } = payload;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
    const ref = rounds().doc(id);

    if (action === 'update_prize') {
      const prize = sanitizeBallPrize(payload.prize);
      if (!hasPrize(prize)) return res.status(400).json({ error: 'INVALID_PRIZE' });
      await mutate(ref, async (tx, round) => {
        assertActive(round);
        tx.update(ref, { prize });
      });
      return res.status(200).json({ ok: true, prize });
    }

    if (action === 'draw') {
      const entry = await mutate(ref, async (tx, round) => {
        if (round.status !== 'open') throw new ActionError(400, 'NOT_OPEN');
        const last = tsMs(round.lastDrawAt);
        if (last != null && nowMs < last + DRAW_REVEAL_MS) throw new ActionError(409, 'DRAW_BUSY');
        const drum = await tx.get(ref.collection('balls').where('status', '==', 'drum'));
        if (drum.empty) throw new ActionError(400, 'EMPTY_DRUM');
        const pick = drum.docs[randomInt(drum.docs.length)];
        const ball = pick.data();
        const rack = round.rack || [];
        // Arrays can't hold serverTimestamp(); the overlay times the reveal
        // off this value, so it is the server's clock at draw time.
        const drawnAt = Timestamp.fromMillis(nowMs);
        const next = {
          drawNo: rack.length + 1,
          twitchId: pick.id,
          twitchName: ball.twitchName || null,
          displayName: ball.displayName || null,
          slotId: ball.slotId,
          slotName: ball.slotName,
          thumb: ball.thumb || null,
          drawnAt,
          scratched: false,
        };
        tx.update(pick.ref, { status: 'drawn', drawNo: next.drawNo, updatedAt: FieldValue.serverTimestamp() });
        tx.update(ref, { rack: [...rack, next], lastDrawAt: drawnAt });
        return next;
      });
      return res.status(200).json({ ok: true, entry: { ...entry, drawnAt: nowMs } });
    }

    if (action === 'scratch') {
      const drawNo = Number(payload.drawNo);
      const entry = await mutate(ref, async (tx, round) => {
        assertActive(round);
        const rack = round.rack || [];
        const i = rack.findIndex((e) => e.drawNo === drawNo);
        if (i === -1) throw new ActionError(400, 'NOT_DRAWN');
        if (rack[i].scratched) throw new ActionError(400, 'ALREADY_SCRATCHED');
        const ballRef = ref.collection('balls').doc(rack[i].twitchId);
        const ballSnap = await tx.get(ballRef);
        const next = rack.map((e, j) => (j === i ? { ...e, scratched: true } : e));
        // The viewer may have been scratched before and called again; only
        // touch the ball if it is still this draw.
        if (ballSnap.exists && ballSnap.data().drawNo === drawNo) {
          tx.update(ballRef, { status: 'scratched', updatedAt: FieldValue.serverTimestamp() });
        }
        // The slot stays blocked for the round (it was scratched for being unavailable).
        tx.set(ref.collection('claims').doc(slotKey(rack[i].slotId)), { scratched: true }, { merge: true });
        tx.update(ref, { rack: next });
        return next[i];
      });
      const announce = await announceQuietly(ref, 'scratch', drawNo, nowMs);
      return res.status(200).json({ ok: true, entry, announce });
    }

    if (action === 'close') {
      await mutate(ref, async (tx, round) => {
        if (round.status !== 'open') throw new ActionError(400, 'NOT_OPEN');
        tx.update(ref, { status: 'closed', closedAt: FieldValue.serverTimestamp() });
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'reopen') {
      await mutate(ref, async (tx, round) => {
        if (round.status !== 'closed') throw new ActionError(400, 'NOT_CLOSED');
        tx.update(ref, { status: 'open', closedAt: null });
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'cancel') {
      await mutate(ref, async (tx, round) => {
        assertActive(round);
        tx.update(ref, { status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'link_hunt') {
      const huntId = payload.huntId ? String(payload.huntId) : null;
      // Throws CommunityHuntsError (404 → HUNT_NOT_FOUND) for a hunt that isn't there.
      if (huntId && !(await getHunt(huntId))) throw new ActionError(404, 'HUNT_NOT_FOUND');
      await mutate(ref, async (tx, round) => {
        assertActive(round);
        tx.update(ref, { huntId });
      });
      return res.status(200).json({ ok: true, huntId });
    }

    if (action === 'announce') {
      const announce = await announceEvent(ref, payload.event, payload.drawNo, nowMs);
      return res.status(200).json({ ok: true, announce });
    }

    // SETTLE-ACTIONS (Task 7)

    return res.status(400).json({ error: 'UNKNOWN_ACTION' });
  } catch (err) {
    if (err instanceof ActionError) return res.status(err.status).json({ error: err.code });
    if (err instanceof CommunityHuntsError) {
      const notFound = err.status === 404;
      return res
        .status(notFound ? 404 : 502)
        .json({ error: notFound ? 'HUNT_NOT_FOUND' : 'COMMUNITYHUNTS_UNAVAILABLE', detail: err.code });
    }
    console.error('ball admin error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=adminBallApi`
Expected: PASS.

- [ ] **Step 5: Firestore rules and index**

In `firestore.rules`, directly after the `match /giveaways/{id} { ... }` block, add:

```text
    // Goofer Ball — rounds and balls are public (overlay, CH 42, control
    // room). Claims and did-you-mean lists are server-only. All writes go
    // through api/admin/ball.js and the !slot command (firebase-admin).
    match /ball_rounds/{id} {
      allow read: if true;
      allow write: if false;
      match /balls/{ballId} {
        allow read: if true;
        allow write: if false;
      }
      match /claims/{claimId} {
        allow read, write: if false;
      }
      match /choices/{twitchId} {
        allow read, write: if false;
      }
    }
```

In `firestore.indexes.json`, append to the `indexes` array (CH 42's past draws query):

```json
    {
      "collectionGroup": "ball_rounds",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "settledAt", "order": "DESCENDING" }
      ]
    }
```

`settings/broadcast` needs no change: the existing `match /settings/{docId}` rule is already public read and staff write.

- [ ] **Step 6: Commit**

```bash
git add api/admin/ball.js firestore.rules firestore.indexes.json src/__tests__/adminBallApi.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): staff endpoint for rounds, draws, scratches and chat lines"
```

---

### Task 7: Staff endpoint, part 2: preview and payout

**Files:**

- Modify: `api/admin/ball.js` (replace the `// SETTLE-ACTIONS (Task 7)` marker; add imports)
- Test: `src/__tests__/adminBallApi.test.js` (append)

**Interfaces:**

- Consumes: `resultRows`, `sanitizeOverrides` and `winnerOf` (Task 3); `formatMulti` (Task 1); `prizeLabel` from `api/_lib/predictionRewards.js`.
- Produces:
  - **`preview_settle`** `{ id, overrides }`
    - Returns `{ ok, rows: Row[], winner: Row|null, prize, huntError: null|'HUNT_NOT_FOUND'|'COMMUNITYHUNTS_UNAVAILABLE' }`. Writes nothing.
    - Errors: `NOT_CLOSED`, `ALREADY_SETTLED`.
  - **`settle`** `{ id, overrides }`
    - Returns `{ ok, winner }`.
    - Errors: `NOT_CLOSED`, `ALREADY_SETTLED`, `NO_RESULTS`.
    - Writes:
      - On the round: `results` (`{ [drawNo]: { multiplier, win, bet, source } }`), `winner` (`{ drawNo, twitchId, twitchName, displayName, slotId, slotName, thumb, multiplier, win, redemptionId }`), `status: 'settled'`, `settledAt`, `settledBy`.
      - Tickets: `users/{twitchId}` (set+merge) and a `ticket_ledger` row `{ reason: 'goofer_ball', refId, note }`.
      - A $ prize: a pending `redemptions` doc with `kind: 'goofer_ball'`.

- [ ] **Step 1: Append the failing tests**

Append to `src/__tests__/adminBallApi.test.js`:

```js
describe('payout', () => {
  const RACK = [
    entry(1, 'a', { slotName: 'Gates of Olympus' }),
    entry(2, 'b', { slotName: 'Wanted Dead or a Wild' }),
    entry(3, 'c', { slotName: 'The Dog House', scratched: true }),
    entry(4, 'd', { slotName: 'Sugar Rush 1000' }),
  ];
  const BONUSES = [
    { slot: 'Gates of Olympus', bet: 1, win: 412, multiplier: 412 },
    { slot: 'Wanted Dead or a Wild', bet: 2, win: 176, multiplier: 88 },
    { slot: 'The Dog House', bet: 1, win: 9000, multiplier: 9000 },
    { slot: 'Sugar Rush 1000', bet: 1, win: null, multiplier: null },
  ];

  beforeEach(() => {
    getHunt.mockResolvedValue({ id: 'h1', bonuses: BONUSES });
  });

  test('preview needs a closed round and writes nothing', async () => {
    seedRound('r1', { rack: RACK, huntId: 'h1' });
    expect((await call({ action: 'preview_settle', id: 'r1' })).body).toEqual({ error: 'NOT_CLOSED' });
    seedRound('r1', { status: 'closed', rack: RACK, huntId: 'h1' });
    const before = __fake.snapshot();
    const res = await call({ action: 'preview_settle', id: 'r1', overrides: { 4: { multiplier: '41', win: '41' } } });
    expect(res.body).toMatchObject({ ok: true, huntError: null, winner: { drawNo: 1, multiplier: 412 } });
    expect(res.body.rows.map((r) => [r.drawNo, r.multiplier, r.source])).toEqual([
      [1, 412, 'hunt'],
      [2, 88, 'hunt'],
      [4, 41, 'manual'],
    ]);
    expect(__fake.snapshot()).toEqual(before);
  });

  test('a communityhunts outage still previews from manual numbers', async () => {
    seedRound('r1', { status: 'closed', rack: RACK, huntId: 'h1' });
    getHunt.mockRejectedValue(new CommunityHuntsError('UPSTREAM', 502));
    const res = await call({ action: 'preview_settle', id: 'r1', overrides: { 2: { multiplier: 7 } } });
    expect(res.body).toMatchObject({ huntError: 'COMMUNITYHUNTS_UNAVAILABLE', winner: { drawNo: 2, multiplier: 7 } });
  });

  test('settle pays the top multiplier: tickets, ledger, redemption, results; only once', async () => {
    seedRound('r1', { status: 'closed', rack: RACK, huntId: 'h1' });
    const res = await call({ action: 'settle', id: 'r1' });
    expect(res.body.ok).toBe(true);
    const r = round();
    expect(r.status).toBe('settled');
    expect(r.settledBy).toBe('owner@test');
    expect(r.results).toEqual({
      1: { multiplier: 412, win: 412, bet: 1, source: 'hunt' },
      2: { multiplier: 88, win: 176, bet: 2, source: 'hunt' },
    });
    expect(r.winner).toMatchObject({ drawNo: 1, twitchId: 'a', displayName: 'A', slotName: 'Gates of Olympus', multiplier: 412, win: 412 });
    expect(__fake.read('users/a')).toMatchObject({ tickets: 200, totalEarned: 200 });
    const [ledger] = __fake.paths('ticket_ledger').map((p) => __fake.read(p));
    expect(ledger).toMatchObject({ userId: 'a', delta: 200, reason: 'goofer_ball', refId: 'r1', note: 'Goofer Ball winner — Gates of Olympus 412x' });
    const [redemption] = __fake.paths('redemptions').map((p) => __fake.read(p));
    expect(redemption).toMatchObject({
      userId: 'a',
      kind: 'goofer_ball',
      status: 'pending',
      cost: 0,
      note: '$5',
      prizeKind: 'cash',
      prizeAmount: 5,
      ballRoundId: 'r1',
      itemName: 'Goofer Ball · Gates of Olympus 412x',
    });
    expect(r.winner.redemptionId).toBe(__fake.paths('redemptions')[0].split('/').pop());
    expect((await call({ action: 'settle', id: 'r1' })).body).toEqual({ error: 'ALREADY_SETTLED' });
    expect(__fake.read('users/a').tickets).toBe(200);
  });

  test('tickets only: no redemption; nothing to rank: NO_RESULTS', async () => {
    seedRound('r1', { status: 'closed', rack: RACK, huntId: 'h1', prize: { tickets: 50, prize: null } });
    await call({ action: 'settle', id: 'r1' });
    expect(__fake.paths('redemptions')).toEqual([]);
    expect(round().winner.redemptionId).toBeNull();
    seedRound('r2', { status: 'closed', rack: [entry(1, 'd', { slotName: 'Sugar Rush 1000' })], huntId: 'h1' });
    expect((await call({ action: 'settle', id: 'r2' })).body).toEqual({ error: 'NO_RESULTS' });
  });

  test('the results line posts only after settle', async () => {
    seedRound('r1', { status: 'closed', rack: RACK, huntId: 'h1' });
    expect((await call({ action: 'announce', id: 'r1', event: 'results' })).body).toEqual({ error: 'NOT_SETTLED' });
    await call({ action: 'settle', id: 'r1' });
    expect((await call({ action: 'announce', id: 'r1', event: 'results' })).body.announce).toEqual({ posted: true });
    expect(sendChannelMessage).toHaveBeenCalledWith("🎱 Tonight's winning ball: Gates of Olympus at 412x. @A wins 200 tickets + $5.");
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- --watchAll=false --testPathPattern=adminBallApi`
Expected: the `payout` tests FAIL with `{ error: 'UNKNOWN_ACTION' }`; everything else passes.

- [ ] **Step 3: Implement preview and settle**

In `api/admin/ball.js`, extend the imports:

```js
import { prizeLabel } from '../_lib/predictionRewards.js';
import { resultRows, sanitizeOverrides, winnerOf } from '../_lib/ballResults.js';
```

and add `formatMulti` to the `../_lib/ballRules.js` import list. Above `export default async function handler`, add:

```js
// Settling (and previewing it) needs a closed round, so no draw can change
// between the preview and the payout.
function assertClosed(round) {
  if (round.status === 'settled' || round.settledAt) throw new ActionError(400, 'ALREADY_SETTLED');
  if (round.status !== 'closed') throw new ActionError(400, 'NOT_CLOSED');
}

// The linked hunt's bonus rows. A communityhunts outage leaves an empty list
// and a flag, so a fully manual payout table can still settle.
async function huntBonuses(round) {
  if (!round.huntId) return { bonuses: [], huntError: null };
  try {
    const hunt = await getHunt(round.huntId);
    if (!hunt) return { bonuses: [], huntError: 'HUNT_NOT_FOUND' };
    return { bonuses: Array.isArray(hunt.bonuses) ? hunt.bonuses : [], huntError: null };
  } catch (err) {
    if (err instanceof CommunityHuntsError) {
      return { bonuses: [], huntError: err.status === 404 ? 'HUNT_NOT_FOUND' : 'COMMUNITYHUNTS_UNAVAILABLE' };
    }
    throw err;
  }
}
```

Replace `    // SETTLE-ACTIONS (Task 7)` with:

```js
    if (action === 'preview_settle') {
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
      const round = snap.data();
      assertClosed(round);
      const { bonuses, huntError } = await huntBonuses(round);
      const rows = resultRows(round, bonuses, sanitizeOverrides(payload.overrides));
      return res.status(200).json({ ok: true, rows, winner: winnerOf(rows), prize: round.prize, huntError });
    }

    if (action === 'settle') {
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
      assertClosed(snap.data());
      const overrides = sanitizeOverrides(payload.overrides);
      // Network first; the transaction re-checks the round and re-ranks.
      const { bonuses } = await huntBonuses(snap.data());
      const winner = await mutate(ref, async (tx, current) => {
        assertClosed(current);
        const rows = resultRows(current, bonuses, overrides);
        const top = winnerOf(rows);
        if (!top) throw new ActionError(400, 'NO_RESULTS');
        const now = FieldValue.serverTimestamp();
        const prize = current.prize || { tickets: 0, prize: null };
        const multi = formatMulti(top.multiplier);

        const results = {};
        for (const r of rows) {
          if (r.multiplier != null) results[r.drawNo] = { multiplier: r.multiplier, win: r.win, bet: r.bet, source: r.source };
        }

        if (prize.tickets > 0) {
          // set+merge so a viewer who never signed in still gets paid.
          tx.set(
            adminDb.collection('users').doc(top.twitchId),
            { tickets: FieldValue.increment(prize.tickets), totalEarned: FieldValue.increment(prize.tickets), updatedAt: now },
            { merge: true }
          );
          tx.set(adminDb.collection('ticket_ledger').doc(), {
            userId: top.twitchId,
            delta: prize.tickets,
            reason: 'goofer_ball',
            refId: id,
            note: `Goofer Ball winner — ${top.slotName} ${multi}`,
            createdAt: now,
          });
        }

        let redemptionId = null;
        const label = prizeLabel(prize.prize);
        if (label) {
          const redemptionRef = adminDb.collection('redemptions').doc();
          redemptionId = redemptionRef.id;
          tx.set(redemptionRef, {
            userId: top.twitchId,
            twitchName: top.twitchName,
            displayName: top.displayName,
            profileImageUrl: null,
            itemId: id,
            itemName: `Goofer Ball · ${top.slotName} ${multi}`,
            cost: 0,
            kind: 'goofer_ball',
            status: 'pending',
            note: label,
            prizeKind: prize.prize.kind,
            prizeAmount: prize.prize.amount,
            ballRoundId: id,
            createdAt: now,
            fulfilledAt: null,
          });
        }

        const winnerDoc = {
          drawNo: top.drawNo,
          twitchId: top.twitchId,
          twitchName: top.twitchName,
          displayName: top.displayName,
          slotId: top.slotId,
          slotName: top.slotName,
          thumb: top.thumb,
          multiplier: top.multiplier,
          win: top.win,
          redemptionId,
        };
        tx.update(ref, { results, winner: winnerDoc, status: 'settled', settledAt: now, settledBy: admin.email });
        return winnerDoc;
      });
      return res.status(200).json({ ok: true, winner });
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern=adminBallApi`
Expected: PASS (all describes).

- [ ] **Step 5: Commit**

```bash
git add api/admin/ball.js src/__tests__/adminBallApi.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): preview and settle the payout from the linked hunt"
```

---

### Task 8: Client ball rules (timing, moments, view helpers)

**Files:**

- Create: `src/utils/ball.js`
- Test: `src/utils/__tests__/ball.test.js`

**Interfaces:**

- Consumes: `STREAM_DELAY_MS` and `tsMillis` from `src/utils/giveaway.js`; `prizeLabel` from `src/utils/predictionRewards.js`; `rankRows`, `resultRows` and `settledRows` from `src/utils/ballResults.js` (Task 3).
- Produces:
  - Constants: `DRAW_REVEAL_MS` (8000), `WINNER_HOLD_MS` (12000), `BALL_TIMELINE` (`{ cut: 600, blower: 3000, tube: 4200, spin: 5200, hold: 7400 }`), `ACTIVE_STATUSES`, `AUTO_POST_WINDOW_MS` (5 min), `BALL_PATH` (`'/gamba/ball'`).
  - Small helpers: `drawKey(n)`, `pad2(n)`, `who(p)`, `isActive(round)`.
  - Phases and moments: `drawPhase(elapsedMs) → 'cut'|'blower'|'tube'|'spin'|'hold'|'out'|null`, `latestDraw(round)`, `drawMoment(round, now) → { kind:'draw', key, entry, at, endsAt }|null`, `winnerMoment(round, now) → { kind:'winner', key, at, endsAt }|null`.
  - Ball lists: `drumBalls(balls)`, `drawnEntries(round)`, `recentBalls(balls, n = 8)`.
  - Formatting: `prizeText(prize)`, `formatMulti(n)`.
  - Rack and results: `takenSlots(round, balls) → Map<slotId, { holder, scratched }>`, `liveRows(round, hunt)`, `leaderRow(rows)`, `hasResults(rows)`.
  - Chat timing: `drawAnnounceDueAt(entry)`, `pendingDrawAnnounces(round, now) → entry[]`.
  - Arrivals: `ballSignature(balls) → Map`, `arrivals(prevSignature, balls) → [{ id, name, slotName, kind: 'new'|'swap' }]`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/ball.test.js`:

```js
import {
  AUTO_POST_WINDOW_MS,
  DRAW_REVEAL_MS,
  WINNER_HOLD_MS,
  arrivals,
  ballSignature,
  drawAnnounceDueAt,
  drawMoment,
  drawPhase,
  drawnEntries,
  drumBalls,
  formatMulti,
  hasResults,
  isActive,
  leaderRow,
  liveRows,
  pendingDrawAnnounces,
  prizeText,
  recentBalls,
  takenSlots,
  winnerMoment,
} from '../ball';

const at = (ms) => ({ toMillis: () => ms });
const T = 1_000_000;
const e = (drawNo, extra = {}) => ({
  drawNo,
  twitchId: `v${drawNo}`,
  displayName: `V${drawNo}`,
  slotId: `s${drawNo}`,
  slotName: `Slot ${drawNo}`,
  drawnAt: at(T + drawNo * 20_000),
  scratched: false,
  ...extra,
});

test('constants', () => {
  expect(DRAW_REVEAL_MS).toBe(8000);
  expect(WINNER_HOLD_MS).toBe(12000);
});

test('drawPhase follows the takeover beats', () => {
  expect([0, 599, 600, 2999, 3000, 4199, 4200, 5199, 5200, 7399, 7400, 7999].map(drawPhase)).toEqual([
    'cut', 'cut', 'blower', 'blower', 'tube', 'tube', 'spin', 'spin', 'hold', 'hold', 'out', 'out',
  ]);
  expect(drawPhase(8000)).toBeNull();
  expect(drawPhase(null)).toBeNull();
});

test('drawMoment: only the latest unscratched draw, only while it plays', () => {
  const round = { id: 'r1', rack: [e(1), e(2)] };
  const drawnAt = T + 40_000;
  expect(drawMoment(round, drawnAt + 1000)).toMatchObject({ kind: 'draw', key: 'r1:2', at: drawnAt, endsAt: drawnAt + 8000 });
  expect(drawMoment(round, drawnAt - 500)).toMatchObject({ key: 'r1:2' });
  expect(drawMoment(round, drawnAt + DRAW_REVEAL_MS)).toBeNull();
  expect(drawMoment({ id: 'r1', rack: [e(1), e(2, { scratched: true })] }, drawnAt + 1000)).toBeNull();
  expect(drawMoment({ id: 'r1', rack: [] }, T)).toBeNull();
  expect(drawMoment(null, T)).toBeNull();
});

test('winnerMoment', () => {
  const settled = { id: 'r1', status: 'settled', settledAt: at(T), winner: { drawNo: 1 } };
  expect(winnerMoment(settled, T + 1000)).toEqual({ kind: 'winner', key: 'r1:winner', at: T, endsAt: T + 12000 });
  expect(winnerMoment(settled, T + WINNER_HOLD_MS)).toBeNull();
  expect(winnerMoment({ ...settled, status: 'closed' }, T + 1000)).toBeNull();
});

test('lists', () => {
  expect(isActive({ status: 'open' })).toBe(true);
  expect(isActive({ status: 'closed' })).toBe(true);
  expect(isActive({ status: 'settled' })).toBe(false);
  expect(isActive(null)).toBe(false);
  const balls = [
    { id: 'a', status: 'drum', enteredAt: at(3) },
    { id: 'b', status: 'drawn', enteredAt: at(1) },
    { id: 'c', status: 'drum', enteredAt: at(5) },
  ];
  expect(drumBalls(balls).map((b) => b.id)).toEqual(['a', 'c']);
  expect(recentBalls(balls, 2).map((b) => b.id)).toEqual(['c', 'a']);
  expect(drawnEntries({ rack: [e(1), e(2, { scratched: true })] }).map((x) => x.drawNo)).toEqual([1]);
});

test('prizeText and formatMulti match the server', () => {
  expect(prizeText({ tickets: 200, prize: { kind: 'cash', amount: 5 } })).toBe('200 tickets + $5');
  expect(prizeText({ tickets: 0, prize: { kind: 'bonus', amount: 10 } })).toBe('Bonus buy $10');
  expect(prizeText(null)).toBe('');
  expect(formatMulti(1204)).toBe('1,204x');
  expect(formatMulti(null)).toBe('—');
});

test('takenSlots: the drum and the rack hold slots; scratches are marked', () => {
  const balls = [
    { slotId: 's1', status: 'drum', displayName: 'A' },
    { slotId: 's2', status: 'drawn', displayName: 'B' },
    { slotId: 's3', status: 'scratched', displayName: 'C' },
  ];
  const map = takenSlots({ rack: [e(3, { slotId: 's3', displayName: 'C', scratched: true })] }, balls);
  expect(map.get('s1')).toEqual({ holder: 'A', scratched: false });
  expect(map.get('s2')).toEqual({ holder: 'B', scratched: false });
  expect(map.get('s3')).toEqual({ holder: 'C', scratched: true });
});

test('liveRows, leaderRow, hasResults', () => {
  const round = { id: 'r1', status: 'open', rack: [e(1, { slotName: 'Gates of Olympus' }), e(2, { slotName: 'Sugar Rush' })] };
  const hunt = { bonuses: [{ slot: 'Gates of Olympus', multiplier: 50 }, { slot: 'Sugar Rush', multiplier: 120 }] };
  const rows = liveRows(round, hunt);
  expect(rows.map((r) => r.multiplier)).toEqual([50, 120]);
  expect(leaderRow(rows).drawNo).toBe(2);
  expect(hasResults(liveRows(round, null))).toBe(false);
  const settled = { ...round, status: 'settled', results: { 1: { multiplier: 9, win: 9, bet: 1, source: 'manual' } } };
  expect(liveRows(settled, hunt).map((r) => r.multiplier)).toEqual([9, null]);
});

test('draw lines: due after the reveal plus the stream delay; every unannounced fresh draw is pending', () => {
  expect(drawAnnounceDueAt(e(1))).toBe(T + 20_000 + 8000 + 3000);
  const round = { rack: [e(1), e(2), e(3, { scratched: true })], announced: { draws: { d1: at(5) } } };
  expect(pendingDrawAnnounces(round, T + 50_000).map((x) => x.drawNo)).toEqual([2]);
  expect(pendingDrawAnnounces(round, T + 40_000 + AUTO_POST_WINDOW_MS + 1)).toEqual([]);
});

test('arrivals: new balls and swaps, never drawn or unchanged ones', () => {
  const before = ballSignature([
    { id: 'a', status: 'drum', slotId: 's1' },
    { id: 'b', status: 'drum', slotId: 's2' },
    { id: 'c', status: 'scratched', slotId: 's3' },
  ]);
  const after = [
    { id: 'a', status: 'drum', slotId: 's1', displayName: 'A', slotName: 'One' },
    { id: 'b', status: 'drum', slotId: 's9', displayName: 'B', slotName: 'Nine' },
    { id: 'c', status: 'drum', slotId: 's4', displayName: 'C', slotName: 'Four' },
    { id: 'd', status: 'drum', slotId: 's5', displayName: 'D', slotName: 'Five' },
    { id: 'e', status: 'drawn', slotId: 's6', displayName: 'E', slotName: 'Six' },
  ];
  expect(arrivals(before, after)).toEqual([
    { id: 'b:s9', name: 'B', slotName: 'Nine', kind: 'swap' },
    { id: 'c:s4', name: 'C', slotName: 'Four', kind: 'new' },
    { id: 'd:s5', name: 'D', slotName: 'Five', kind: 'new' },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=src/utils/__tests__/ball.test`
Expected: FAIL with "Cannot find module '../ball'".

- [ ] **Step 3: Write the module**

Create `src/utils/ball.js`:

```js
import { STREAM_DELAY_MS, tsMillis } from './giveaway';
import { prizeLabel } from './predictionRewards';
import { rankRows, resultRows, settledRows } from './ballResults';

// Goofer Ball rules for the overlay, Stage, the control room and CH 42. The
// server twin is api/_lib/ballRules.js (chat lines, entry decisions).

export const DRAW_REVEAL_MS = 8000;
export const WINNER_HOLD_MS = 12000;
// The draw takeover's beats, in ms from drawnAt (spec: OBS overlay).
export const BALL_TIMELINE = { cut: 600, blower: 3000, tube: 4200, spin: 5200, hold: 7400 };
export const ACTIVE_STATUSES = ['open', 'closed'];
// Only fresh draws post on their own; older ones go through Retry.
export const AUTO_POST_WINDOW_MS = 5 * 60 * 1000;
export const BALL_PATH = '/gamba/ball';
// A timestamp up to this far "in the future" is clock skew, not a bug.
const SKEW_MS = 2000;

export const drawKey = (drawNo) => `d${drawNo}`;
export const pad2 = (n) => String(n).padStart(2, '0');
export const who = (p) => (p && (p.displayName || p.twitchName)) || 'someone';
export const isActive = (round) => !!round && ACTIVE_STATUSES.includes(round.status);

export function drawPhase(elapsed) {
  if (elapsed == null || !Number.isFinite(elapsed) || elapsed >= DRAW_REVEAL_MS) return null;
  const t = Math.max(0, elapsed);
  if (t < BALL_TIMELINE.cut) return 'cut';
  if (t < BALL_TIMELINE.blower) return 'blower';
  if (t < BALL_TIMELINE.tube) return 'tube';
  if (t < BALL_TIMELINE.spin) return 'spin';
  if (t < BALL_TIMELINE.hold) return 'hold';
  return 'out';
}

export function latestDraw(round) {
  const rack = (round && round.rack) || [];
  return rack.length ? rack[rack.length - 1] : null;
}

// The draw takeover to play right now, or null. Timed off drawnAt like the
// giveaway reveal off rolledAt, so a reload mid-reveal resumes and a reload
// after it never replays.
export function drawMoment(round, now) {
  const entry = latestDraw(round);
  const at = tsMillis(entry && entry.drawnAt);
  if (!entry || entry.scratched || at == null) return null;
  const elapsed = now - at;
  if (elapsed >= DRAW_REVEAL_MS || elapsed < -SKEW_MS) return null;
  return { kind: 'draw', key: `${round.id}:${entry.drawNo}`, entry, at, endsAt: at + DRAW_REVEAL_MS };
}

export function winnerMoment(round, now) {
  if (!round || round.status !== 'settled' || !round.winner) return null;
  const at = tsMillis(round.settledAt);
  if (at == null || now - at >= WINNER_HOLD_MS || now - at < -SKEW_MS) return null;
  return { kind: 'winner', key: `${round.id}:winner`, at, endsAt: at + WINNER_HOLD_MS };
}

export const drumBalls = (balls) => (balls || []).filter((b) => b.status === 'drum');
export const drawnEntries = (round) => ((round && round.rack) || []).filter((e) => !e.scratched);

export function recentBalls(balls, n = 8) {
  return [...(balls || [])].sort((a, b) => (tsMillis(b.enteredAt) ?? 0) - (tsMillis(a.enteredAt) ?? 0)).slice(0, n);
}

export function prizeText(prize) {
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

// Slots nobody can call right now: every ball in the drum or on the rack,
// plus scratched draws (blocked for the round).
export function takenSlots(round, balls) {
  const out = new Map();
  for (const b of balls || []) {
    if (b.status === 'drum' || b.status === 'drawn') out.set(b.slotId, { holder: who(b), scratched: false });
  }
  for (const e of (round && round.rack) || []) {
    if (e.scratched) out.set(e.slotId, { holder: who(e), scratched: true });
  }
  return out;
}

export function liveRows(round, hunt) {
  if (!round) return [];
  if (round.status === 'settled') return settledRows(round);
  return resultRows(round, (hunt && hunt.bonuses) || []);
}

export const leaderRow = (rows) => rankRows(rows)[0] || null;
export const hasResults = (rows) => (rows || []).some((r) => r.multiplier != null);

export function drawAnnounceDueAt(entry) {
  const at = tsMillis(entry && entry.drawnAt);
  return at == null ? null : at + DRAW_REVEAL_MS + STREAM_DELAY_MS;
}

// Draws whose chat line hasn't posted yet. A second draw can land before the
// first one's line is due (8s busy guard vs 11s line), so this is a list.
export function pendingDrawAnnounces(round, now) {
  const done = (round && round.announced && round.announced.draws) || {};
  return drawnEntries(round).filter((e) => {
    const at = tsMillis(e.drawnAt);
    return !done[drawKey(e.drawNo)] && at != null && now - at <= AUTO_POST_WINDOW_MS;
  });
}

// What each ball looked like at the last snapshot: status and slot.
export function ballSignature(balls) {
  return new Map((balls || []).map((b) => [b.id, `${b.status}:${b.slotId}`]));
}

// Balls that just landed in the drum since `prev`: new callers (or a
// scratched viewer calling again) and swaps. Feeds the overlay's toasts.
export function arrivals(prev, balls) {
  const out = [];
  for (const b of balls || []) {
    if (b.status !== 'drum') continue;
    const before = prev.get(b.id);
    if (before === `drum:${b.slotId}`) continue;
    out.push({ id: `${b.id}:${b.slotId}`, name: who(b), slotName: b.slotName, kind: before && before.startsWith('drum:') ? 'swap' : 'new' });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=src/utils/__tests__/ball.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/ball.js src/utils/__tests__/ball.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): client timing, moments and view helpers"
```

---

### Task 9: Data hooks and the reveals writer

**Files:**

- Create: `src/hooks/useBallRound.js`, `src/hooks/useBallsFeed.js`, `src/hooks/useBallHunt.js`, `src/hooks/useBroadcastSettings.js`, `src/hooks/usePageVisible.js`, `src/hooks/useBallArrivals.js`, `src/utils/broadcast.js`
- Test: `src/hooks/__tests__/ballHooks.test.js`

**Interfaces:**

- Consumes: `db` and `auth` from `src/config/firebase.js`; `ballSignature` and `arrivals` (Task 8).
- Produces:
  - Round and balls:
    - `useBallRound({ enabled = true } = {}) → { round: undefined|null|Round, error }`. This is the newest round (`orderBy('openedAt','desc')`, `limit(1)`).
    - `useBallsFeed(roundId, { enabled = true } = {}) → { balls, ready, error }`.
    - `useBallArrivals(balls, ready, onArrive)`. It calls `onArrive({ id, name, slotName, kind })` for changes after the first ready snapshot.
  - Hunt: `useBallHunt(huntId, { enabled = true } = {}) → { hunt, stale, loading }`. It polls `/api/communityhunts?view=hunt&id=` every 60s, skips hidden tabs, and keeps the last hunt (flagged `stale`) when a poll fails.
  - Reveals switch:
    - `useBroadcastSettings(enabled = true) → { reveals: 'overlay'|'stage' }`.
    - `writeReveals(mode) → Promise` writes `settings/broadcast` `{ reveals, updatedAt, updatedBy }` (merge).
  - `usePageVisible() → boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/ballHooks.test.js`:

```js
import { act, renderHook, waitFor } from '@testing-library/react';
import { onSnapshot, setDoc } from 'firebase/firestore';
import useBallRound from '../useBallRound';
import useBallsFeed from '../useBallsFeed';
import useBallHunt from '../useBallHunt';
import useBroadcastSettings from '../useBroadcastSettings';
import usePageVisible from '../usePageVisible';
import useBallArrivals from '../useBallArrivals';
import { writeReveals } from '../../utils/broadcast';

jest.mock('../../config/firebase', () => ({ db: {}, auth: { currentUser: { email: 'owner@test', uid: 'u1' } } }));
jest.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => parts.join('/'),
  doc: (_db, ...parts) => parts.join('/'),
  orderBy: () => null,
  limit: () => null,
  query: (ref) => ref,
  onSnapshot: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: () => 'ts',
}));

const listeners = {};
beforeEach(() => {
  Object.keys(listeners).forEach((k) => delete listeners[k]);
  onSnapshot.mockImplementation((path, next, fail) => {
    listeners[path] = { next, fail };
    return () => delete listeners[path];
  });
  setDoc.mockResolvedValue(undefined);
});

const docsSnap = (rows) => ({ empty: rows.length === 0, docs: rows.map((r) => ({ id: r.id, data: () => r })) });

test('useBallRound: undefined until the first snapshot, then the round or null', () => {
  const { result } = renderHook(() => useBallRound());
  expect(result.current.round).toBeUndefined();
  act(() => listeners.ball_rounds.next(docsSnap([{ id: 'r1', status: 'open' }])));
  expect(result.current.round).toEqual({ id: 'r1', status: 'open' });
  act(() => listeners.ball_rounds.next(docsSnap([])));
  expect(result.current.round).toBeNull();
  act(() => listeners.ball_rounds.fail(new Error('x')));
  expect(result.current).toEqual({ round: null, error: true });
});

test('useBallsFeed: follows the round id; disabled means no listener', () => {
  const { result, rerender } = renderHook(({ id, on }) => useBallsFeed(id, { enabled: on }), { initialProps: { id: 'r1', on: true } });
  act(() => listeners['ball_rounds/r1/balls'].next(docsSnap([{ id: 'a', status: 'drum' }])));
  expect(result.current).toEqual({ balls: [{ id: 'a', status: 'drum' }], ready: true, error: false });
  rerender({ id: 'r2', on: true });
  expect(listeners['ball_rounds/r1/balls']).toBeUndefined();
  expect(result.current.ready).toBe(false);
  rerender({ id: 'r2', on: false });
  expect(listeners['ball_rounds/r2/balls']).toBeUndefined();
  expect(result.current.balls).toEqual([]);
});

test('useBallArrivals: nothing for the first snapshot, then each new or swapped ball', () => {
  const onArrive = jest.fn();
  const first = [{ id: 'a', status: 'drum', slotId: 's1', displayName: 'A', slotName: 'One' }];
  const { rerender } = renderHook(({ balls, ready }) => useBallArrivals(balls, ready, onArrive), { initialProps: { balls: first, ready: true } });
  expect(onArrive).not.toHaveBeenCalled();
  rerender({ balls: [...first, { id: 'b', status: 'drum', slotId: 's2', displayName: 'B', slotName: 'Two' }], ready: true });
  expect(onArrive).toHaveBeenCalledWith({ id: 'b:s2', name: 'B', slotName: 'Two', kind: 'new' });
  rerender({ balls: [], ready: false });
  rerender({ balls: [{ id: 'z', status: 'drum', slotId: 's9' }], ready: true });
  expect(onArrive).toHaveBeenCalledTimes(1);
});

test('useBallHunt polls every 60s and keeps the last hunt when a poll fails', async () => {
  jest.useFakeTimers();
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ hunt: { id: 'h1', bonuses: [{ slot: 'A', multiplier: 2 }] } }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'COMMUNITYHUNTS_UNAVAILABLE' }) });
  const { result } = renderHook(() => useBallHunt('h1'));
  await waitFor(() => expect(result.current.hunt).toEqual({ id: 'h1', bonuses: [{ slot: 'A', multiplier: 2 }] }));
  expect(global.fetch).toHaveBeenCalledWith('/api/communityhunts?view=hunt&id=h1');
  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });
  await waitFor(() => expect(result.current.stale).toBe(true));
  expect(result.current.hunt.id).toBe('h1');
  jest.useRealTimers();
});

test('useBallHunt does nothing without a hunt id', () => {
  global.fetch = jest.fn();
  const { result } = renderHook(() => useBallHunt(null));
  expect(result.current).toEqual({ hunt: null, stale: false, loading: false });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('useBroadcastSettings: stage only when the doc says so', () => {
  const { result } = renderHook(() => useBroadcastSettings());
  expect(result.current.reveals).toBe('overlay');
  act(() => listeners['settings/broadcast'].next({ exists: () => true, data: () => ({ reveals: 'stage' }) }));
  expect(result.current.reveals).toBe('stage');
  act(() => listeners['settings/broadcast'].next({ exists: () => false, data: () => undefined }));
  expect(result.current.reveals).toBe('overlay');
  act(() => listeners['settings/broadcast'].next({ docs: [] }));
  expect(result.current.reveals).toBe('overlay');
});

test('writeReveals', async () => {
  await writeReveals('stage');
  expect(setDoc).toHaveBeenCalledWith('settings/broadcast', { reveals: 'stage', updatedAt: 'ts', updatedBy: 'owner@test' }, { merge: true });
  await writeReveals('nonsense');
  expect(setDoc.mock.calls[1][1].reveals).toBe('overlay');
});

test('usePageVisible', () => {
  const { result } = renderHook(() => usePageVisible());
  expect(result.current).toBe(true);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(result.current).toBe(false);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(result.current).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=ballHooks`
Expected: FAIL with "Cannot find module '../useBallRound'".

- [ ] **Step 3: Write the hooks**

Create `src/hooks/useBallRound.js`:

```js
import { useEffect, useState } from 'react';
import { collection, limit as fLimit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';

// The newest Goofer Ball round (a settled one lingers until the next opens).
// `round` is undefined until the first snapshot, then the round or null.
export default function useBallRound({ enabled = true } = {}) {
  const [state, setState] = useState({ round: undefined, error: false });
  useEffect(() => {
    if (!enabled) return undefined;
    const q = query(collection(db, 'ball_rounds'), orderBy('openedAt', 'desc'), fLimit(1));
    return onSnapshot(
      q,
      (snap) => setState({ round: snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }, error: false }),
      () => setState({ round: null, error: true })
    );
  }, [enabled]);
  return state;
}
```

Create `src/hooks/useBallsFeed.js`:

```js
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const IDLE = { roundId: null, balls: [], ready: false, error: false };

// Every ball in one round's drum (and on its rack). Re-subscribes when the
// round changes; nothing listens while disabled (Spark read budget).
export default function useBallsFeed(roundId, { enabled = true } = {}) {
  const [state, setState] = useState(IDLE);
  useEffect(() => {
    if (!enabled || !roundId) {
      setState(IDLE);
      return undefined;
    }
    setState({ ...IDLE, roundId });
    return onSnapshot(
      collection(db, 'ball_rounds', roundId, 'balls'),
      (snap) => setState({ roundId, balls: snap.docs.map((d) => ({ id: d.id, ...d.data() })), ready: true, error: false }),
      () => setState((s) => ({ ...s, error: true }))
    );
  }, [roundId, enabled]);
  const { balls, ready, error } = state.roundId === roundId && enabled ? state : IDLE;
  return { balls, ready, error };
}
```

Create `src/hooks/useBallArrivals.js`:

```js
import { useEffect, useRef } from 'react';
import { arrivals, ballSignature } from '../utils/ball';

// Calls onArrive for each ball that lands in the drum after the first ready
// snapshot (new callers and swaps), never for the backlog already there.
export default function useBallArrivals(balls, ready, onArrive) {
  const signature = useRef(null);
  const callback = useRef(onArrive);
  callback.current = onArrive;
  useEffect(() => {
    if (!ready) {
      signature.current = null;
      return;
    }
    if (signature.current) arrivals(signature.current, balls).forEach((a) => callback.current(a));
    signature.current = ballSignature(balls);
  }, [balls, ready]);
}
```

Create `src/hooks/useBallHunt.js`:

```js
import { useEffect, useState } from 'react';

const POLL_MS = 60 * 1000;
const IDLE = { hunt: null, stale: false, loading: false };

// The linked communityhunts hunt (its bonus rows feed the live rack). Polls
// the public, server-cached endpoint every 60s; a failed poll keeps the last
// hunt and flags it stale.
export default function useBallHunt(huntId, { enabled = true } = {}) {
  const [state, setState] = useState({ huntId: null, ...IDLE });
  useEffect(() => {
    if (!enabled || !huntId) return undefined;
    let cancelled = false;
    setState((s) => (s.huntId === huntId ? s : { huntId, hunt: null, stale: false, loading: true }));
    const load = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await fetch(`/api/communityhunts?view=hunt&id=${encodeURIComponent(huntId)}`);
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || !body.hunt) throw new Error((body && body.error) || `HTTP ${res.status}`);
        if (!cancelled) setState({ huntId, hunt: body.hunt, stale: false, loading: false });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, huntId, stale: true, loading: false }));
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [huntId, enabled]);
  if (!enabled || !huntId) return IDLE;
  if (state.huntId !== huntId) return { hunt: null, stale: false, loading: true };
  return { hunt: state.hunt, stale: state.stale, loading: state.loading };
}
```

Create `src/hooks/useBroadcastSettings.js`:

```js
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

// Where full-screen reveals play (settings/broadcast): 'overlay' (OBS) or
// 'stage' (a staff browser). A missing doc or a failed read means 'overlay'.
export default function useBroadcastSettings(enabled = true) {
  const [reveals, setReveals] = useState('overlay');
  useEffect(() => {
    if (!enabled) return undefined;
    return onSnapshot(
      doc(db, 'settings', 'broadcast'),
      (snap) => {
        const data = snap && typeof snap.exists === 'function' && snap.exists() ? snap.data() : null;
        setReveals(data && data.reveals === 'stage' ? 'stage' : 'overlay');
      },
      () => setReveals('overlay')
    );
  }, [enabled]);
  return { reveals };
}
```

Create `src/hooks/usePageVisible.js`:

```js
import { useEffect, useState } from 'react';

// False while the tab is hidden, so listeners and polls can stand down.
export default function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}
```

Create `src/utils/broadcast.js`:

```js
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// The shared reveals switch (spec: Reveals switch). Staff write it from the
// control room header; both OBS overlays read it.
export function writeReveals(mode) {
  const user = auth && auth.currentUser;
  return setDoc(
    doc(db, 'settings', 'broadcast'),
    {
      reveals: mode === 'stage' ? 'stage' : 'overlay',
      updatedAt: serverTimestamp(),
      updatedBy: (user && (user.email || user.uid)) || null,
    },
    { merge: true }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=ballHooks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBallRound.js src/hooks/useBallsFeed.js src/hooks/useBallHunt.js src/hooks/useBroadcastSettings.js src/hooks/usePageVisible.js src/hooks/useBallArrivals.js src/utils/broadcast.js src/hooks/__tests__/ballHooks.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): round, balls, hunt and reveals hooks"
```

---

### Task 10: The drum: tokens, set stylesheet, physics, canvas, contract

**Files:**

- Modify: `tailwind.config.js` (add `onair.wgoof`)
- Create: `src/components/ball/ball.css`, `src/components/ball/canvasPalette.js`, `src/components/ball/drumPhysics.js`, `src/components/ball/DrumCanvas.js`, `src/components/ball/DrumRig.js`
- Modify: `src/components/onAir/__tests__/onAirContract.test.js`
- Test: `src/components/ball/__tests__/drum.test.js`

**Interfaces:**

- Produces:
  - Physics: `createDrum(count, { seed = 7, r = BALL_R } = {}) → drum` and `stepDrum(drum, dt, jet = 0)` (mutates; unit circle, y grows downward). `BALL_R = 0.09`.
  - `<DrumCanvas balls count blowing still maxBalls=60 className />`. It draws up to 60 balls and shows "+N more" past that. It does nothing when `getContext` is unavailable (jsdom).
  - `<DrumRig balls count blowing still tube riding base className />`: glass, canvas, stand, blower base and an optional tube, with a rising ball when `riding` is set.
  - CSS classes in `ball.css`: `gb-set`, `gb-burst`, `gb-desk`, `gb-title`, `gb-scan`, `gb-vig`, `gb-ball`, `gb-decal`, `gb-band`, `gb-glass`, `gb-stand`, `gb-base`, `gb-tube`, `gb-static`, `gb-spin-in`, `gb-rise`, `gb-cut-out`, `gb-toast-in`.
  - `CANVAS` and `DECALS` from `canvasPalette.js`.

- [ ] **Step 1: Add the tokens**

In `tailwind.config.js`, inside `theme.extend.colors.onair`, after the `paper` entry, add:

```js
          // Goofer Ball's WGOOF Channel 42 set (DESIGN.md §7, Channel 42). Only
          // src/components/ball/ uses these (contract test).
          wgoof: {
            sky: '#3d63a3',
            deep: '#22396b',
            night: '#152447',
            desk: '#5a3a22',
            'desk-deep': '#3b2414',
            trim: '#8a5a33',
            title: '#ffe9c2',
            'title-dim': '#ffd2b0',
            blower: '#c8452a',
            'blower-deep': '#8a2a17',
            shade: '#a99c82',
            chrome: '#d9dce2',
            'chrome-deep': '#4a4d55',
          },
```

- [ ] **Step 2: Write the failing tests**

Create `src/components/ball/__tests__/drum.test.js`:

```js
import { render } from '@testing-library/react';
import { BALL_R, createDrum, stepDrum } from '../drumPhysics';
import DrumCanvas from '../DrumCanvas';
import DrumRig from '../DrumRig';

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const meanY = (drum) => drum.balls.reduce((s, b) => s + b.y, 0) / drum.balls.length;

test('balls never leave the drum and never go NaN', () => {
  const drum = createDrum(40);
  for (let i = 0; i < 600; i += 1) stepDrum(drum, 1 / 60, i % 200 < 100 ? 1 : 0.2);
  for (const b of drum.balls) {
    expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
    expect(Math.hypot(b.x, b.y)).toBeLessThanOrEqual(1 - BALL_R + 1e-6);
  }
});

test('the blower lifts the pile', () => {
  const calm = createDrum(30);
  const blown = createDrum(30);
  for (let i = 0; i < 300; i += 1) {
    stepDrum(calm, 1 / 60, 0);
    stepDrum(blown, 1 / 60, 1);
  }
  expect(meanY(blown)).toBeLessThan(meanY(calm));
});

test('the same seed gives the same drum', () => {
  expect(createDrum(5, { seed: 3 }).balls).toEqual(createDrum(5, { seed: 3 }).balls);
});

test('DrumCanvas: a canvas, and "+N more" past the cap', () => {
  const balls = Array.from({ length: 64 }, (_, i) => ({ id: `b${i}`, slotId: `s${i}` }));
  const { container, getByText } = render(<DrumCanvas balls={balls} maxBalls={60} />);
  expect(container.querySelector('canvas')).toBeTruthy();
  expect(getByText('+4 more')).toBeTruthy();
});

test('DrumCanvas: a plain count works without ball data', () => {
  const { queryByText } = render(<DrumCanvas count={12} />);
  expect(queryByText(/more/)).toBeNull();
});

test('DrumRig: tube and riding ball are optional', () => {
  const { container, rerender } = render(<DrumRig count={3} />);
  expect(container.querySelector('.gb-tube')).toBeNull();
  rerender(<DrumRig count={3} tube riding />);
  expect(container.querySelector('.gb-tube .gb-rise')).toBeTruthy();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testPathPattern=components/ball/__tests__/drum`
Expected: FAIL with "Cannot find module '../drumPhysics'".

- [ ] **Step 4: Write the stylesheet and palette**

Create `src/components/ball/ball.css`:

```css
/* Goofer Ball: the WGOOF Channel 42 set (DESIGN.md §7, Channel 42). Colours
   come from the onair tokens through theme(); the On Air contract keeps raw
   colours out of the JS. */
.gb-set { background: linear-gradient(180deg, theme('colors.onair.wgoof.sky') 0%, theme('colors.onair.wgoof.deep') 62%, theme('colors.onair.wgoof.night') 100%); }
.gb-burst { background: repeating-conic-gradient(from 0deg at 52% 38%, theme('colors.white / 7%') 0 5deg, transparent 5deg 13deg); }
.gb-desk { background: linear-gradient(180deg, theme('colors.onair.wgoof.desk'), theme('colors.onair.wgoof.desk-deep')); border-top: 3px solid theme('colors.onair.wgoof.trim'); }
.gb-title { color: theme('colors.onair.wgoof.title'); text-shadow: 2px 0 theme('colors.onair.loss / 55%'), -2px 0 theme('colors.onair.signal.DEFAULT / 45%'); }
.gb-scan { background: repeating-linear-gradient(0deg, theme('colors.white / 3.5%') 0 1px, transparent 1px 3px); mix-blend-mode: screen; }
.gb-vig { background: radial-gradient(ellipse at center, transparent 55%, theme('colors.black / 55%') 100%); }
.gb-ball { background: radial-gradient(circle at 34% 30%, theme('colors.white'), theme('colors.onair.paper.DEFAULT') 45%, theme('colors.onair.wgoof.shade') 100%); box-shadow: 0 18px 40px theme('colors.black / 55%'); }
.gb-decal { background: linear-gradient(160deg, theme('colors.onair.viewer.DEFAULT'), theme('colors.onair.viewer.deep')); box-shadow: inset 0 0 0 3px theme('colors.onair.paper.ink / 85%'); }
.gb-band { border-top: 2px solid theme('colors.onair.paper.ink / 70%'); border-bottom: 2px solid theme('colors.onair.paper.ink / 70%'); }
.gb-glass { border: 2px solid theme('colors.white / 38%'); background: radial-gradient(circle at 32% 26%, theme('colors.white / 32%'), theme('colors.white / 6%') 30%, theme('colors.white / 1.5%') 62%, theme('colors.white / 7%') 100%); box-shadow: inset 0 0 36px theme('colors.white / 8%'); }
.gb-glass::after { content: ''; position: absolute; left: 16%; top: 9%; width: 30%; height: 14%; border-radius: 50%; background: theme('colors.white / 28%'); filter: blur(3px); transform: rotate(-28deg); }
.gb-stand { clip-path: polygon(30% 0, 70% 0, 100% 100%, 0 100%); background: linear-gradient(90deg, theme('colors.onair.wgoof.chrome-deep'), theme('colors.onair.wgoof.chrome') 40%, theme('colors.onair.wgoof.chrome-deep') 100%); }
.gb-base { background: linear-gradient(180deg, theme('colors.onair.wgoof.blower'), theme('colors.onair.wgoof.blower-deep')); box-shadow: inset 0 2px 0 theme('colors.white / 25%'); }
.gb-tube { border: 2px solid theme('colors.white / 35%'); border-bottom: none; background: theme('colors.white / 6%'); }
.gb-static { background: repeating-linear-gradient(0deg, theme('colors.white / 18%') 0 1px, theme('colors.black / 60%') 1px 2px); animation: gb-static 0.12s steps(2) infinite; }
@keyframes gb-static { to { background-position: 0 3px; } }
.gb-spin-in { animation: gb-spin-in 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
@keyframes gb-spin-in { from { transform: scale(0.35) rotate(-200deg); opacity: 0; } to { transform: none; opacity: 1; } }
.gb-rise { animation: gb-rise 1.1s ease-in both; }
@keyframes gb-rise { from { transform: translateY(0); } to { transform: translateY(-260%); } }
.gb-cut-out { animation: gb-cut-out 0.5s steps(3) both; }
@keyframes gb-cut-out { to { opacity: 0; } }
.gb-toast-in { animation: gb-toast-in 0.3s ease-out both; }
@keyframes gb-toast-in { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .gb-spin-in, .gb-rise, .gb-static, .gb-toast-in, .gb-cut-out { animation: none; }
}
```

Create `src/components/ball/canvasPalette.js`:

```js
// The drum is a canvas, which can't use Tailwind classes, so it draws with
// these. CANVAS mirrors tailwind.config.js (onair.paper, onair.wgoof.shade);
// the On Air contract test fails if they drift. DECALS tint a ball until its
// slot art loads (raw colours, a recorded exemption like the per-slot tints).
export const CANVAS = { paper: '#ece3cf', shade: '#a99c82', ink: '#231c17', white: '#ffffff' };
export const DECALS = ['#5b3fd6', '#ff8a3d', '#3ee0bf', '#e64b8b', '#ffd166', '#5aa9ff', '#9be15d'];
```

- [ ] **Step 5: Write the physics**

Create `src/components/ball/drumPhysics.js`:

```js
// A tiny 2D lottery drum: balls in a unit circle (y grows downward) with
// gravity, an air jet from the bottom, and bouncy collisions. Pure and
// seeded, so tests can step it.
export const BALL_R = 0.09;
const GRAVITY = 1.6;
const WALL_BOUNCE = 1.7; // 1 + restitution
const BALL_BOUNCE = 1.8;
const DRAG = 0.995;

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function spawn(rand, r) {
  const a = rand() * Math.PI * 2;
  const d = Math.sqrt(rand()) * (0.85 - r);
  return { x: Math.cos(a) * d, y: Math.abs(Math.sin(a)) * d * 0.8 + 0.1, vx: 0, vy: 0 };
}

export function createDrum(count, { seed = 7, r = BALL_R } = {}) {
  const rand = seeded(seed);
  return { r, rand, balls: Array.from({ length: count }, () => spawn(rand, r)) };
}

// Grow or shrink the simulated pile without disturbing the balls that stay.
export function resizeDrum(drum, count) {
  while (drum.balls.length < count) drum.balls.push({ ...spawn(drum.rand, drum.r), y: -0.6 });
  if (drum.balls.length > count) drum.balls.length = count;
}

function keepInside(b, limit) {
  const dist = Math.hypot(b.x, b.y);
  if (dist <= limit) return;
  const nx = b.x / dist;
  const ny = b.y / dist;
  b.x = nx * limit;
  b.y = ny * limit;
  const vn = b.vx * nx + b.vy * ny;
  if (vn > 0) {
    b.vx -= WALL_BOUNCE * vn * nx;
    b.vy -= WALL_BOUNCE * vn * ny;
  }
}

export function stepDrum(drum, dt, jet = 0) {
  const { balls, r, rand } = drum;
  const limit = 1 - r;
  for (const b of balls) {
    b.vy += GRAVITY * dt;
    // The blower: an upward push, strongest low in the drum.
    if (jet > 0 && b.y > 0.2 && Math.abs(b.x) < 0.55) {
      b.vy -= jet * (b.y + 0.2) * 9 * dt;
      b.vx += (rand() - 0.5) * jet * 6 * dt;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= DRAG;
    b.vy *= DRAG;
    keepInside(b, limit);
  }
  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const a = balls[i];
      const b = balls[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      if (d >= 2 * r) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (2 * r - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const k = (BALL_BOUNCE * rel) / 2;
        a.vx += k * nx;
        a.vy += k * ny;
        b.vx -= k * nx;
        b.vy -= k * ny;
      }
    }
  }
  // Collisions can shove a ball through the glass; put it back.
  for (const b of balls) keepInside(b, limit);
}
```

- [ ] **Step 6: Write the canvas and the rig**

Create `src/components/ball/DrumCanvas.js`:

```js
import { useEffect, useRef } from 'react';
import { BALL_R, createDrum, resizeDrum, stepDrum } from './drumPhysics';
import { CANVAS, DECALS } from './canvasPalette';

export const MAX_BALLS = 60;

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// The balls inside the glass. One canvas, a requestAnimationFrame loop that
// pauses with the tab, at most MAX_BALLS drawn ("+N more" past that). Each
// ball wears its slot art as a round decal once the image loads.
export default function DrumCanvas({ balls = [], count, blowing = false, still = false, maxBalls = MAX_BALLS, className = '' }) {
  const canvasRef = useRef(null);
  const total = count ?? balls.length;
  const shown = Math.min(total, maxBalls);
  const drumRef = useRef(null);
  if (!drumRef.current) drumRef.current = createDrum(shown);
  const live = useRef({ balls, blowing });
  live.current = { balls, blowing };

  useEffect(() => {
    resizeDrum(drumRef.current, shown);
  }, [shown]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!ctx) return undefined;
    const images = new Map();
    const imageFor = (url) => {
      if (!url) return null;
      if (!images.has(url)) {
        const img = new Image();
        img.src = url;
        images.set(url, img);
      }
      const img = images.get(url);
      return img.complete && img.naturalWidth > 0 ? img : null;
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      const br = BALL_R * R;
      const data = live.current.balls;
      drumRef.current.balls.forEach((b, i) => {
        const x = cx + b.x * R;
        const y = cy + b.y * R;
        const grad = ctx.createRadialGradient(x - br * 0.32, y - br * 0.4, br * 0.1, x, y, br);
        grad.addColorStop(0, CANVAS.white);
        grad.addColorStop(0.45, CANVAS.paper);
        grad.addColorStop(1, CANVAS.shade);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, br, 0, Math.PI * 2);
        ctx.fill();
        const ball = data[i];
        const decal = br * 0.52;
        const art = imageFor(ball && ball.thumb);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, decal, 0, Math.PI * 2);
        ctx.clip();
        if (art) ctx.drawImage(art, x - decal, y - decal, decal * 2, decal * 2);
        else {
          ctx.fillStyle = DECALS[hash(String((ball && (ball.slotId || ball.id)) || i)) % DECALS.length];
          ctx.fill();
        }
        ctx.restore();
      });
    };

    if (still) {
      draw();
      return undefined;
    }
    let raf = 0;
    let last = 0;
    const loop = (t) => {
      const dt = last ? Math.min(0.033, (t - last) / 1000) : 1 / 60;
      last = t;
      if (!document.hidden) {
        stepDrum(drumRef.current, dt, live.current.blowing ? 1 : 0.22);
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [still]);

  const more = total - shown;
  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      {more > 0 && (
        <span className="absolute bottom-[10%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 font-onair-mono text-[0.625rem] font-bold uppercase tracking-[0.15em] text-white">
          +{more} more
        </span>
      )}
    </div>
  );
}
```

Create `src/components/ball/DrumRig.js`:

```js
import DrumCanvas from './DrumCanvas';
import './ball.css';

// The air-mix drum: glass over the ball canvas, on a chrome stand and a red
// blower base. `tube` adds the draw tube on top; `riding` sends a ball up it.
export default function DrumRig({ balls = [], count, blowing = false, still = false, tube = false, riding = false, base = true, className = '' }) {
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      {tube && (
        <div className="gb-tube absolute -top-[24%] left-1/2 h-[24%] w-[7%] -translate-x-1/2 rounded-t-[6px]">
          {riding && <div className="gb-ball gb-rise absolute bottom-0 left-0 aspect-square w-full rounded-full" />}
        </div>
      )}
      <div className="relative aspect-square">
        <DrumCanvas balls={balls} count={count} blowing={blowing} still={still} className="absolute inset-[3%] overflow-hidden rounded-full" />
        <div className="gb-glass absolute inset-0 rounded-full" />
      </div>
      {base && (
        <>
          <div className="gb-stand mx-auto -mt-[2%] h-[16%] w-[40%]" />
          <div className="gb-base mx-auto h-[9%] w-[74%] rounded-[4px]" />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Extend the On Air contract**

In `src/components/onAir/__tests__/onAirContract.test.js`:

- add `'src/components/ball',` to the end of `DIRS`;
- add `'src/components/ball/canvasPalette.js',` and `'src/components/ball/ballFixtures.js',` to `RAW_COLOUR_EXEMPT`;
- in the "Tokens: no raw colours…" test's `only` function, add `rel.startsWith('src/components/ball/') ||` alongside the other folders.

Then append:

```js
test('Tokens: the WGOOF Channel 42 colours stay on the Goofer Ball set', () => {
  const outside = srcFiles('src')
    .filter((rel) => !rel.startsWith('src/components/ball/'))
    .filter((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').includes('wgoof'));
  expect(outside).toEqual([]);
});

test('Tokens: the drum canvas palette mirrors the tailwind tokens', () => {
  const { CANVAS } = require('../../ball/canvasPalette');
  expect(CANVAS.paper).toBe(onair.paper.DEFAULT);
  expect(CANVAS.ink).toBe(onair.paper.ink);
  expect(CANVAS.shade).toBe(onair.wgoof.shade);
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="components/ball|onAirContract"`
Expected: PASS. If the "blower lifts the pile" assertion is flaky across seeds, raise the jet multiplier (9) and keep the test unchanged.

- [ ] **Step 9: Commit**

```bash
git add tailwind.config.js src/components/ball src/components/onAir/__tests__/onAirContract.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): the drum (physics, canvas, rig) and Channel 42 tokens"
```

---

### Task 11: The Channel 42 set: draw takeover and winner card

**Files:**

- Create: `src/components/ball/ChannelSet.js`, `src/components/ball/BallFace.js`, `src/components/ball/LowerThird.js`, `src/components/ball/DrawTakeover.js`, `src/components/ball/WinnerCard.js`
- Test: `src/components/ball/__tests__/set.test.js`

**Interfaces:**

- Consumes: `DrumRig` (Task 10); `drawPhase`, `drawnEntries`, `formatMulti`, `pad2`, `prizeText` and `who` (Task 8).
- Produces:
  - `<ChannelSet fine title bug live className>{children}</ChannelSet>`, which fills its positioned parent (`absolute inset-0`). `live` shows the "● Live 4:20" bug (CH 42's strip hides it). It exports `FINE_PRINT`.
  - `<BallFace entry spinning className />`, where `entry` is `{ drawNo, slotName, thumb, displayName|twitchName }`.
  - `<LowerThird entry left />`.
  - `<DrawTakeover entry rack balls left elapsed sound />`, which renders nothing when `drawPhase(elapsed)` is null.
  - `<WinnerCard round />`.
  - `NO_SOUND` (from `DrawTakeover.js`).
  - Sound calls: `sound.burst(1600)` at `blower`, `sound.tick()` at `tube`, `sound.land()` at `spin` (the `useOverlaySound` API from Task 13).

- [ ] **Step 1: Write the failing test**

Create `src/components/ball/__tests__/set.test.js`:

```js
import { render, screen } from '@testing-library/react';
import DrawTakeover from '../DrawTakeover';
import WinnerCard from '../WinnerCard';
import ChannelSet, { FINE_PRINT } from '../ChannelSet';

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const ENTRY = { drawNo: 3, slotName: 'Gates of Olympus', thumb: null, displayName: 'CoolGuy', twitchName: 'coolguy' };
const sound = () => ({ tick: jest.fn(), burst: jest.fn(), land: jest.fn() });

test('the set: title, LIVE 4:20 bug, the 42 station bug and the fine print', () => {
  render(
    <div className="relative">
      <ChannelSet />
    </div>
  );
  expect(screen.getByText('Goofer Ball')).toBeTruthy();
  expect(screen.getByText('WGOOF · Channel 42 · Nightly draw')).toBeTruthy();
  expect(screen.getByText('● Live 4:20')).toBeTruthy();
  expect(screen.getByText('42')).toBeTruthy();
  expect(FINE_PRINT).toBe('Drawn nightly at 4:20. Supervised by the Goofer Gaming Commission. Odds are odds. Not a real lottery.');
  expect(screen.getByText(FINE_PRINT)).toBeTruthy();
});

test('blower phase: drum only, no ball or lower third yet', () => {
  const s = sound();
  render(<DrawTakeover entry={ENTRY} rack={[ENTRY]} balls={[]} left={61} elapsed={1000} sound={s} />);
  expect(screen.queryByText('@CoolGuy')).toBeNull();
  expect(screen.queryByText(/Called in by/)).toBeNull();
  expect(s.burst).toHaveBeenCalledWith(1600);
});

test('hold phase: the ball close-up and the lower third', () => {
  render(<DrawTakeover entry={ENTRY} rack={[ENTRY]} balls={[]} left={61} elapsed={6000} sound={sound()} />);
  expect(screen.getByText('@CoolGuy')).toBeTruthy();
  expect(screen.getAllByText('Ball 03').length).toBeGreaterThan(0);
  expect(screen.getByText('Called in by @CoolGuy · 61 balls left in the drum')).toBeTruthy();
  expect(screen.getByText('Ball 3: Gates of Olympus, called in by CoolGuy')).toBeTruthy();
});

test('spin phase lands the sound; an unknown drum count drops the "left" clause', () => {
  const s = sound();
  render(<DrawTakeover entry={ENTRY} rack={[ENTRY]} left={null} elapsed={5800} sound={s} />);
  expect(screen.getByText('Called in by @CoolGuy')).toBeTruthy();
  const { rerender } = render(<DrawTakeover entry={ENTRY} rack={[ENTRY]} elapsed={4500} sound={s} />);
  expect(s.land).toHaveBeenCalled();
  rerender(<DrawTakeover entry={ENTRY} rack={[ENTRY]} elapsed={8000} sound={s} />);
});

test('after the reveal it renders nothing', () => {
  const { container } = render(<DrawTakeover entry={ENTRY} rack={[ENTRY]} elapsed={8000} sound={sound()} />);
  expect(container.textContent).toBe('');
});

test('winner card', () => {
  const round = {
    prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
    winner: { ...ENTRY, drawNo: 1, multiplier: 412 },
  };
  render(<WinnerCard round={round} />);
  expect(screen.getByText("Tonight's winning ball")).toBeTruthy();
  expect(screen.getByText('412x')).toBeTruthy();
  expect(screen.getByText('@CoolGuy wins 200 tickets + $5')).toBeTruthy();
  expect(screen.getByText('Results certified by the Goofer Gaming Commission (one guy). Drawn nightly at 4:20.')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=components/ball/__tests__/set`
Expected: FAIL with "Cannot find module '../DrawTakeover'".

- [ ] **Step 3: Write the components**

Create `src/components/ball/ChannelSet.js`:

```js
import './ball.css';

export const FINE_PRINT = 'Drawn nightly at 4:20. Supervised by the Goofer Gaming Commission. Odds are odds. Not a real lottery.';

// WGOOF Channel 42: a cheap 90s local-TV lottery set (spec decision 1). Fills
// its positioned parent; the drum, ball and lower third go in as children.
export default function ChannelSet({ children, fine = FINE_PRINT, title = true, bug = true, live = true, className = '' }) {
  return (
    <div className={`gb-set absolute inset-0 overflow-hidden font-onair ${className}`}>
      <div className="gb-burst absolute inset-0" aria-hidden="true" />
      <div className="gb-desk absolute inset-x-0 bottom-0 h-[24%]" aria-hidden="true" />
      {title && (
        <div className="absolute right-[4%] top-[4%] text-right" aria-hidden="true">
          <p className="gb-title font-display text-[clamp(1.5rem,4.2vw,4.5rem)] uppercase leading-none">Goofer Ball</p>
          <p className="mt-1 font-onair-mono text-[clamp(0.625rem,1vw,1rem)] font-bold uppercase tracking-[0.3em] text-onair-wgoof-title-dim">
            WGOOF · Channel 42 · Nightly draw
          </p>
        </div>
      )}
      {live && (
        <p
          className="absolute left-[4%] top-[5%] rounded-[3px] bg-onair-live px-2 py-0.5 font-onair-mono text-[clamp(0.625rem,0.9vw,0.875rem)] font-bold uppercase tracking-[0.2em] text-white"
          aria-hidden="true"
        >
          ● Live 4:20
        </p>
      )}
      {bug && (
        <span
          className="absolute bottom-[24%] right-[3.2%] flex aspect-square w-[7%] items-center justify-center rounded-full border-2 border-onair-wgoof-title/55 bg-black/20 font-display text-[clamp(1rem,2.4vw,2.75rem)] text-onair-wgoof-title/70"
          aria-hidden="true"
        >
          42
        </span>
      )}
      {children}
      {fine && (
        <p className="absolute bottom-[2%] left-[4%] right-[4%] font-onair-mono text-[clamp(0.625rem,0.75vw,0.75rem)] uppercase tracking-[0.15em] text-onair-wgoof-title/60">
          {fine}
        </p>
      )}
      <div className="gb-scan pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="gb-vig pointer-events-none absolute inset-0" aria-hidden="true" />
    </div>
  );
}
```

Create `src/components/ball/BallFace.js`:

```js
import { pad2, who } from '../../utils/ball';
import './ball.css';

// The drawn ball in close-up: "BALL 03", the slot art as a round decal (the
// slot name until art exists), and the caller stamped on the band.
export default function BallFace({ entry, spinning = false, className = '' }) {
  return (
    <div className={`gb-ball relative aspect-square rounded-full ${spinning ? 'gb-spin-in' : ''} ${className}`}>
      <p className="absolute inset-x-0 top-[5%] text-center font-onair-mono text-[clamp(0.625rem,1.1vw,1.125rem)] font-bold uppercase tracking-[0.15em] text-onair-paper-ink/75">
        Ball {pad2(entry.drawNo)}
      </p>
      <div className="gb-decal absolute left-1/2 top-[16%] aspect-square w-1/2 -translate-x-1/2 overflow-hidden rounded-full">
        {entry.thumb ? (
          <img src={entry.thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center p-[12%] text-center font-onair text-[clamp(0.625rem,1.2vw,1.25rem)] font-extrabold uppercase leading-tight text-white">
            {entry.slotName}
          </span>
        )}
      </div>
      <p className="gb-band absolute inset-x-[8%] top-[68%] -rotate-[5deg] py-[3%] text-center font-onair-mono text-[clamp(0.75rem,1.6vw,1.75rem)] font-bold uppercase text-onair-paper-ink">
        @{who(entry)}
      </p>
    </div>
  );
}
```

Create `src/components/ball/LowerThird.js`:

```js
import { pad2, who } from '../../utils/ball';

// "BALL 03 · GATES OF OLYMPUS · CALLED IN BY @X · 61 BALLS LEFT IN THE DRUM".
// `left` is null when the drum count isn't known (Stage has no ball list).
export default function LowerThird({ entry, left = null }) {
  const tail = left == null ? '' : ` · ${left} ${left === 1 ? 'ball' : 'balls'} left in the drum`;
  return (
    <div className="absolute inset-x-[4%] bottom-[7%] flex h-[14%] items-stretch shadow-onair-card">
      <div className="flex items-center bg-onair-winner px-[3%] font-display text-[clamp(1rem,2.6vw,3rem)] uppercase tracking-wide text-onair-winner-ink">
        Ball {pad2(entry.drawNo)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center bg-onair-paper px-[3%] text-onair-paper-ink">
        <p className="truncate font-display text-[clamp(1.1rem,2.8vw,3.25rem)] uppercase leading-none tracking-wide">{entry.slotName}</p>
        <p className="mt-1 truncate font-onair-mono text-[clamp(0.625rem,1vw,1rem)] font-bold uppercase tracking-[0.15em]">
          {`Called in by @${who(entry)}${tail}`}
        </p>
      </div>
    </div>
  );
}
```

Create `src/components/ball/DrawTakeover.js`:

```js
import { useEffect, useRef } from 'react';
import ChannelSet from './ChannelSet';
import DrumRig from './DrumRig';
import BallFace from './BallFace';
import LowerThird from './LowerThird';
import { drawPhase, pad2, who } from '../../utils/ball';

export const NO_SOUND = { tick() {}, burst() {}, land() {} };

function usePhaseSound(phase, sound) {
  const last = useRef(null);
  useEffect(() => {
    if (phase === last.current) return;
    last.current = phase;
    if (phase === 'blower') sound.burst(1600);
    else if (phase === 'tube') sound.tick();
    else if (phase === 'spin') sound.land();
  }, [phase, sound]);
}

// The full-screen draw (spec: Draw takeover, DRAW_REVEAL_MS from drawnAt):
// static cut in, the blower roars, the ball rides the tube, the close-up spins
// to the slot art and the caller, the lower third holds, cut back out.
export default function DrawTakeover({ entry, rack = [], balls = [], left = null, elapsed, sound = NO_SOUND }) {
  const phase = drawPhase(elapsed);
  usePhaseSound(phase, sound);
  if (!phase) return null;
  const blowing = phase === 'blower' || phase === 'tube';
  const shown = phase === 'spin' || phase === 'hold' || phase === 'out';
  const lower = phase === 'hold' || phase === 'out';
  const earlier = rack.filter((e) => !e.scratched && e.drawNo < entry.drawNo);
  const onRack = lower ? [...earlier, entry] : earlier;

  return (
    <div className={`fixed inset-0 ${phase === 'out' ? 'gb-cut-out' : ''}`} role="presentation">
      <ChannelSet>
        <DrumRig
          balls={balls}
          count={balls.length || 24}
          blowing={blowing}
          tube
          riding={phase === 'tube'}
          className="absolute left-[7%] top-[14%] w-[30%]"
        />
        {shown && <BallFace entry={entry} spinning={phase === 'spin'} className="absolute left-[46%] top-[16%] w-[28%]" />}
        {onRack.length > 0 && (
          <ol className="absolute bottom-[27%] left-[5%] flex gap-1.5" aria-hidden="true">
            {onRack.map((e) => (
              <li
                key={e.drawNo}
                className="gb-ball flex aspect-square w-[clamp(1.25rem,2vw,2.25rem)] items-center justify-center rounded-full font-onair-mono text-[0.625rem] font-bold text-onair-paper-ink"
              >
                {pad2(e.drawNo)}
              </li>
            ))}
          </ol>
        )}
        {lower && <LowerThird entry={entry} left={left} />}
      </ChannelSet>
      {phase === 'cut' && <div className="gb-static absolute inset-0" aria-hidden="true" />}
      <p className="sr-only" aria-live="polite">
        {`Ball ${entry.drawNo}: ${entry.slotName}, called in by ${who(entry)}`}
      </p>
    </div>
  );
}
```

Create `src/components/ball/WinnerCard.js`:

```js
import ChannelSet from './ChannelSet';
import BallFace from './BallFace';
import { formatMulti, prizeText, who } from '../../utils/ball';

const WINNER_FINE = 'Results certified by the Goofer Gaming Commission (one guy). Drawn nightly at 4:20.';

// "Tonight's winning ball": played WINNER_HOLD_MS from settledAt.
export default function WinnerCard({ round }) {
  const w = round.winner;
  return (
    <div className="fixed inset-0" role="presentation">
      <ChannelSet title={false} bug={false} fine={WINNER_FINE}>
        <p className="gb-title absolute inset-x-0 top-[7%] text-center font-display text-[clamp(2rem,5vw,5.5rem)] uppercase leading-none">
          Tonight's winning ball
        </p>
        <BallFace entry={w} spinning className="absolute left-[13%] top-[22%] w-[26%]" />
        <div className="absolute left-[45%] right-[5%] top-[24%]">
          <p className="font-display text-[clamp(4rem,12vw,13rem)] leading-[0.9] text-onair-winner-warm">{formatMulti(w.multiplier)}</p>
          <p className="mt-2 font-display text-[clamp(1.25rem,3vw,3.5rem)] uppercase text-onair-wgoof-title">{w.slotName}</p>
          <p className="mt-3 inline-block bg-onair-paper px-3 py-1.5 font-onair-mono text-[clamp(0.75rem,1.2vw,1.25rem)] font-bold uppercase tracking-[0.15em] text-onair-paper-ink">
            {`@${who(w)} wins ${prizeText(round.prize)}`}
          </p>
        </div>
      </ChannelSet>
      <p className="sr-only" aria-live="polite">
        {`Tonight's winning ball: ${w.slotName} at ${formatMulti(w.multiplier)}, called in by ${who(w)}`}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern="components/ball|onAirContract"`
Expected: PASS. The contract scans these files: no raw colours, no `font-semibold`, nothing under 10px.

- [ ] **Step 5: Commit**

```bash
git add src/components/ball
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): Channel 42 set, draw takeover and winner card"
```

---

### Task 12: Corner box, live rack and toasts

**Files:**

- Create: `src/components/ball/toastQueue.js`, `src/components/ball/CornerBox.js`, `src/components/ball/RackBoard.js`
- Test: `src/components/ball/__tests__/corner.test.js`

**Interfaces:**

- Consumes: `drumBalls`, `drawnEntries`, `formatMulti`, `leaderRow`, `pad2`, `prizeText`, `who` (Task 8); `DrumRig` (Task 10).
- Produces:
  - Toast queue: `TOAST_MS` (3000), `TOAST_QUEUE_MAX` (4), `EMPTY_TOASTS`, `enqueueToast(state, toast)`, `shiftToast(state)`, and `useToasts() → { toast, push }`. A toast is `{ id, name, slotName, kind }`, or `{ id, more: n }` for the folded overflow.
  - `<CornerBox round balls toast position still />`: the resting state.
  - `<RackBoard round rows stale position />`: the live rack.

- [ ] **Step 1: Write the failing test**

Create `src/components/ball/__tests__/corner.test.js`:

```js
import { act, render, renderHook, screen } from '@testing-library/react';
import { EMPTY_TOASTS, TOAST_MS, enqueueToast, shiftToast, useToasts } from '../toastQueue';
import CornerBox from '../CornerBox';
import RackBoard from '../RackBoard';

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const t = (n) => ({ id: `t${n}`, name: `V${n}`, slotName: `Slot ${n}`, kind: 'new' });

test('the toast queue folds overflow into one "+N more"', () => {
  let s = EMPTY_TOASTS;
  for (let i = 1; i <= 6; i += 1) s = enqueueToast(s, t(i));
  expect(s.items.map((x) => x.id)).toEqual(['t1', 't2', 't3', 't4']);
  expect(s.extra).toBe(2);
  s = shiftToast(s);
  expect(s.items.map((x) => x.id || x.more)).toEqual(['t2', 't3', 't4', 'more-1']);
  expect(s.items[3].more).toBe(2);
  expect(s.extra).toBe(0);
});

test('useToasts shows one at a time for TOAST_MS', () => {
  jest.useFakeTimers();
  const { result } = renderHook(() => useToasts());
  act(() => {
    result.current.push(t(1));
    result.current.push(t(2));
  });
  expect(result.current.toast.id).toBe('t1');
  act(() => jest.advanceTimersByTime(TOAST_MS));
  expect(result.current.toast.id).toBe('t2');
  act(() => jest.advanceTimersByTime(TOAST_MS));
  expect(result.current.toast).toBeNull();
  jest.useRealTimers();
});

const ROUND = {
  id: 'r1',
  status: 'open',
  prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
  rack: [{ drawNo: 1, slotName: 'Gates of Olympus', displayName: 'CoolGuy', scratched: false }],
};
const BALLS = [
  { id: 'a', status: 'drum' },
  { id: 'b', status: 'drum' },
  { id: 'c', status: 'drawn' },
];

test('corner box: count, command, prize, rack and the toast', () => {
  render(<CornerBox round={ROUND} balls={BALLS} toast={{ id: 'x', name: 'SugarFan', slotName: 'Sugar Rush 1000', kind: 'new' }} />);
  expect(screen.getByText('2 balls')).toBeTruthy();
  expect(screen.getByText('!slot <slot name>')).toBeTruthy();
  expect(screen.getByText('CH 42 · Top multi wins 200 tickets + $5')).toBeTruthy();
  expect(screen.getByText('01')).toBeTruthy();
  expect(screen.getByText('@SugarFan called')).toBeTruthy();
  expect(screen.getByText('Sugar Rush 1000')).toBeTruthy();
});

test('corner box when closed, and a "+N more" toast', () => {
  render(<CornerBox round={{ ...ROUND, status: 'closed' }} balls={[]} toast={{ id: 'm', more: 3 }} />);
  expect(screen.getByText('Drum closed · results after the hunt')).toBeTruthy();
  expect(screen.getByText('+3 more called in')).toBeTruthy();
});

test('rack board: leader highlighted, pending dashes, footer by status', () => {
  const rows = [
    { drawNo: 1, slotName: 'Gates of Olympus', displayName: 'CoolGuy', multiplier: 412, thumb: null },
    { drawNo: 2, slotName: 'Sugar Rush 1000', displayName: 'SugarFan', multiplier: null, thumb: null },
  ];
  const { rerender } = render(<RackBoard round={ROUND} rows={rows} />);
  expect(screen.getByText('Leader @CoolGuy · 412x')).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.getByText('Type !slot <slot name> to call one in')).toBeTruthy();
  rerender(<RackBoard round={{ ...ROUND, status: 'closed' }} rows={rows} stale />);
  expect(screen.getByText('Drum closed · top multi wins 200 tickets + $5 · stale')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=components/ball/__tests__/corner`
Expected: FAIL with "Cannot find module '../toastQueue'".

- [ ] **Step 3: Write the components**

Create `src/components/ball/toastQueue.js`:

```js
import { useCallback, useEffect, useState } from 'react';

export const TOAST_MS = 3000;
export const TOAST_QUEUE_MAX = 4;
export const EMPTY_TOASTS = { items: [], extra: 0, seq: 0 };

// New balls wait their turn; past the cap they fold into one "+N more".
export function enqueueToast(state, toast) {
  if (state.items.length < TOAST_QUEUE_MAX) return { ...state, items: [...state.items, toast] };
  return { ...state, extra: state.extra + 1 };
}

export function shiftToast(state) {
  const rest = state.items.slice(1);
  if (state.extra > 0 && rest.length < TOAST_QUEUE_MAX) {
    const seq = state.seq + 1;
    return { items: [...rest, { id: `more-${seq}`, more: state.extra }], extra: 0, seq };
  }
  return { ...state, items: rest };
}

export function useToasts() {
  const [state, setState] = useState(EMPTY_TOASTS);
  const push = useCallback((toast) => setState((s) => enqueueToast(s, toast)), []);
  const head = state.items[0] || null;
  useEffect(() => {
    if (!head) return undefined;
    const t = setTimeout(() => setState((s) => shiftToast(s)), TOAST_MS);
    return () => clearTimeout(t);
  }, [head]);
  return { toast: head, push };
}
```

Create `src/components/ball/CornerBox.js`:

```js
import DrumRig from './DrumRig';
import { drawnEntries, drumBalls, pad2, prizeText } from '../../utils/ball';
import './ball.css';

function Toast({ toast }) {
  return (
    <p key={toast.id} className="gb-toast-in mb-2 flex items-center gap-2 border-l-4 border-onair-winner bg-onair-winner-ink px-3 py-1.5 font-onair-mono text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-onair-wgoof-title">
      <span aria-hidden="true">🎱</span>
      {toast.more ? (
        <span>{`+${toast.more} more called in`}</span>
      ) : (
        <>
          <span>{toast.kind === 'swap' ? `@${toast.name} swapped to` : `@${toast.name} called`}</span>
          <span className="text-onair-winner-warm">{toast.slotName}</span>
        </>
      )}
    </p>
  );
}

// The resting overlay (spec: OBS overlay, state 1): the mini drum, the count,
// the !slot command, the prize and the rack so far, plus arrival toasts.
export default function CornerBox({ round, balls = [], toast = null, position = 'left-8 bottom-8', still = false }) {
  const drum = drumBalls(balls);
  const drawn = drawnEntries(round);
  return (
    <div className={`absolute ${position} w-[min(30rem,40vw)] font-onair`}>
      {toast && <Toast toast={toast} />}
      <div className="shadow-onair-card">
        <div className="flex items-stretch">
          <span className="bg-onair-winner px-2.5 py-1 font-display text-[1.125rem] uppercase tracking-wide text-onair-winner-ink">Goofer Ball</span>
          <span className="min-w-0 flex-1 truncate bg-onair-wgoof-deep px-2.5 font-onair-mono text-[0.625rem] font-bold uppercase leading-[2.6] tracking-[0.16em] text-onair-wgoof-title">
            {`CH 42 · Top multi wins ${prizeText(round.prize)}`}
          </span>
        </div>
        <div className="flex items-center gap-3 bg-onair-paper p-2.5 text-onair-paper-ink">
          <div className="gb-set w-[30%] shrink-0 rounded-full">
            <DrumRig balls={drum} still={still} base={false} />
          </div>
          <div className="min-w-0 flex-1 font-onair-mono text-[0.6875rem] font-bold uppercase tracking-[0.15em]">
            <p className="font-display text-[2rem] normal-case leading-none tracking-normal">{`${drum.length} ${drum.length === 1 ? 'ball' : 'balls'}`}</p>
            <p>In the drum</p>
            {round.status === 'open' ? (
              <p className="mt-1">
                Type <span className="whitespace-nowrap bg-onair-paper-ink px-1 normal-case text-onair-paper">!slot &lt;slot name&gt;</span>
              </p>
            ) : (
              <p className="mt-1">Drum closed · results after the hunt</p>
            )}
            {drawn.length > 0 && (
              <ol className="mt-1.5 flex flex-wrap gap-1" aria-label="Drawn">
                {drawn.map((e) => (
                  <li key={e.drawNo} className="gb-ball flex h-5 w-5 items-center justify-center rounded-full text-[0.625rem]">
                    {pad2(e.drawNo)}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

Create `src/components/ball/RackBoard.js`:

```js
import { formatMulti, leaderRow, pad2, prizeText, who } from '../../utils/ball';
import './ball.css';

// Tonight's rack (spec: OBS overlay, state 3): every drawn ball with its
// multiplier as the bonuses open, the leader highlighted.
export default function RackBoard({ round, rows = [], stale = false, position = 'left-8 top-8' }) {
  const leader = leaderRow(rows);
  const footer =
    round.status === 'open'
      ? 'Type !slot <slot name> to call one in'
      : `Drum closed · top multi wins ${prizeText(round.prize)}${stale ? ' · stale' : ''}`;
  return (
    <div className={`absolute ${position} w-[min(32rem,42vw)] font-onair shadow-onair-card`}>
      <div className="flex items-stretch">
        <span className="bg-onair-winner px-2.5 py-1 font-display text-[1.125rem] uppercase tracking-wide text-onair-winner-ink">Tonight's rack</span>
        <span className="min-w-0 flex-1 truncate bg-onair-wgoof-deep px-2.5 font-onair-mono text-[0.625rem] font-bold uppercase leading-[2.6] tracking-[0.16em] text-onair-wgoof-title">
          {leader ? `Leader @${who(leader)} · ${formatMulti(leader.multiplier)}` : 'No results yet'}
        </span>
      </div>
      <ol>
        {rows.map((r) => (
          <li
            key={r.drawNo}
            className={`grid grid-cols-[1.5rem_1.75rem_1fr_auto] items-center gap-2 border-t border-onair-paper-ink/15 px-2.5 py-1 font-onair-mono text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-onair-paper-ink ${
              leader && leader.drawNo === r.drawNo ? 'bg-onair-winner-pale' : 'bg-onair-paper'
            }`}
          >
            <span>{pad2(r.drawNo)}</span>
            {r.thumb ? <img src={r.thumb} alt="" className="h-5 w-7 rounded-[2px] object-cover" /> : <span className="gb-decal h-5 w-7 rounded-[2px]" />}
            <span className="min-w-0 truncate">
              {r.slotName}
              <span className="block text-[0.625rem] opacity-70">@{who(r)}</span>
            </span>
            <span className="font-display text-[1.125rem] normal-case tracking-normal">{formatMulti(r.multiplier)}</span>
          </li>
        ))}
      </ol>
      <p className="bg-onair-wgoof-deep px-2.5 py-1 font-onair-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] text-onair-wgoof-title">{footer}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern="components/ball|onAirContract"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ball
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): corner box, live rack and arrival toasts"
```

---

### Task 13: The OBS overlay `/ball-overlay`

**Files:**

- Create: `src/hooks/useOverlaySound.js` (moved verbatim out of `src/pages/GiveawayOverlay.js`)
- Modify: `src/pages/GiveawayOverlay.js` (import the moved hook)
- Create: `src/components/ball/ballDemo.js`, `src/components/ball/ballFixtures.js`, `src/pages/BallOverlay.js`
- Modify: `src/App.js` (bare route), `src/components/controlRoom/selectors.js` (`OVERLAY_PATHS`)
- Test: `src/pages/__tests__/BallOverlay.test.js`, plus one assertion in `src/components/controlRoom/__tests__/selectors.test.js`

**Interfaces:**

- Consumes: the hooks from Task 9; the components from Tasks 11 and 12; `drawMoment`, `drumBalls`, `hasResults`, `isActive`, `liveRows` and `winnerMoment` from Task 8.
- Produces:
  - `useOverlaySound(enabled) → { tick(), burst(ms), land() }` (unchanged API).
  - `demoFeed(elapsedMs, startedAt) → { round, balls, ready: true, hunt: null, stale: false }`.
  - `overlayFixture(key, now) → same shape | null` for `open|draw|rack|winner`, with the shared fixture builders `fixtureRound`, `fixtureBalls`, `FIXTURE_HUNT` (Task 17 adds CH 42 fixtures to this file).
  - `<BallOverlay />` at `/ball-overlay`. Params: `?pos=bl|br|tl|tr` (default `bl`), `?sound=1`, `?demo=1`, `?fixture=` (dev only).

- [ ] **Step 1: Move the sound hook**

Create `src/hooks/useOverlaySound.js` containing the `useOverlaySound` function moved **verbatim** from `src/pages/GiveawayOverlay.js` (the whole `// ─── Sound ───` section), exported as default, with this header and imports:

```js
import { useCallback, useEffect, useMemo, useRef } from 'react';

// Synthesized OBS overlay sounds (Web Audio, no files): tick, burst(ms) and
// land. Shared by the giveaway and Goofer Ball overlays; silent unless the
// browser source URL has ?sound=1.
export default function useOverlaySound(enabled) {
```

In `src/pages/GiveawayOverlay.js`:

- delete the moved function;
- add `import useOverlaySound from '../hooks/useOverlaySound';`;
- remove `useCallback` from the `react` import if `Grep` finds no other `useCallback(` in the file. Keep `useRef` only if still used, since `useDemoFeed` uses it.

Run: `npm test -- --watchAll=false --testPathPattern="GiveawayOverlay|RevealStage"`
Expected: PASS (behaviour unchanged).

- [ ] **Step 2: Write the failing overlay test**

Create `src/pages/__tests__/BallOverlay.test.js`:

```js
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BallOverlay from '../BallOverlay';
import useBallRound from '../../hooks/useBallRound';
import useBallsFeed from '../../hooks/useBallsFeed';
import useBallHunt from '../../hooks/useBallHunt';
import useBroadcastSettings from '../../hooks/useBroadcastSettings';

jest.mock('../../hooks/useBallRound', () => jest.fn());
jest.mock('../../hooks/useBallsFeed', () => jest.fn());
jest.mock('../../hooks/useBallHunt', () => jest.fn());
jest.mock('../../hooks/useBroadcastSettings', () => jest.fn());

const at = (ms) => ({ toMillis: () => ms });
const NOW = Date.now(); // only for timestamps far from any window
const base = {
  id: 'r1',
  status: 'open',
  prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
  huntId: null,
  rack: [],
};
const BALLS = [
  { id: 'a', status: 'drum', slotId: 's1', slotName: 'One', displayName: 'A' },
  { id: 'b', status: 'drum', slotId: 's2', slotName: 'Two', displayName: 'B' },
];
const drawn = (ms) => ({ drawNo: 1, twitchId: 'c', displayName: 'CoolGuy', slotId: 's3', slotName: 'Gates of Olympus', thumb: null, drawnAt: at(ms), scratched: false });

function show(round, { reveals = 'overlay', hunt = null, url = '/ball-overlay' } = {}) {
  useBallRound.mockReturnValue({ round, error: false });
  useBallsFeed.mockReturnValue({ balls: BALLS, ready: true, error: false });
  useBallHunt.mockReturnValue({ hunt, stale: false, loading: false });
  useBroadcastSettings.mockReturnValue({ reveals });
  return render(
    <MemoryRouter initialEntries={[url]}>
      <BallOverlay />
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

test('no round: nothing on screen', () => {
  const { container } = show(null);
  expect(container.textContent).toBe('');
});

test('an open round rests in the corner box', () => {
  show(base);
  expect(screen.getByText('2 balls')).toBeTruthy();
  expect(screen.getByText('!slot <slot name>')).toBeTruthy();
});

test('a fresh draw takes over the screen', () => {
  show({ ...base, rack: [drawn(Date.now() - 6000)] });
  expect(screen.getByText('Called in by @CoolGuy · 2 balls left in the drum')).toBeTruthy();
});

test('a draw whose reveal already played never replays (OBS reload)', () => {
  show({ ...base, rack: [drawn(NOW - 60_000)] });
  expect(screen.queryByText(/Called in by/)).toBeNull();
  expect(screen.getByText('2 balls')).toBeTruthy();
});

test('Stage mode: OBS skips the takeover but keeps the corner box', () => {
  show({ ...base, rack: [drawn(Date.now() - 6000)] }, { reveals: 'stage' });
  expect(screen.queryByText(/Called in by/)).toBeNull();
  expect(screen.getByText('2 balls')).toBeTruthy();
});

test('a linked hunt with results shows the live rack', () => {
  show(
    { ...base, huntId: 'h1', rack: [drawn(NOW - 60_000)] },
    { hunt: { bonuses: [{ slot: 'Gates of Olympus', multiplier: 412 }] } }
  );
  expect(screen.getByText('Leader @CoolGuy · 412x')).toBeTruthy();
});

test('a fresh settle plays the winner card', () => {
  show({
    ...base,
    status: 'settled',
    settledAt: at(Date.now() - 2000),
    rack: [drawn(Date.now() - 600_000)],
    winner: { ...drawn(0), multiplier: 412 },
  });
  expect(screen.getByText("Tonight's winning ball")).toBeTruthy();
});

test('the corner follows ?pos', () => {
  const { container } = show(base, { url: '/ball-overlay?pos=tr' });
  expect(container.querySelector('.right-8.top-8')).toBeTruthy();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=BallOverlay`
Expected: FAIL with "Cannot find module '../BallOverlay'".

- [ ] **Step 4: Write the demo and fixtures**

Create `src/components/ball/ballDemo.js`:

```js
// ?demo=1 on the overlay: a fake round on a 24s loop, for placing the source
// in OBS. Balls drop in for 10s, one draw lands at 11s, then it starts over.
const NAMES = ['SlotGoblin', 'NightOwl', 'ReelRat', 'Pupper', 'SugarFan', 'BigWinz', 'CoolGuy', 'Mossy', 'DeadSpin', 'LuckyLou', 'Gizmo', 'Brick'];
const SLOTS = ['Gates of Olympus', 'Sugar Rush 1000', 'The Dog House', 'Wanted Dead or a Wild', 'Big Bass Bonanza', 'Zeus vs Hades', 'Le Bandit', 'Fire Portals', 'Mental', 'San Quentin', 'Starlight Princess', 'Fruit Party'];
const LOOP_MS = 24_000;
const DRAW_AT = 11_000;
const at = (ms) => ({ toMillis: () => ms });

export function demoFeed(elapsed, startedAt) {
  const loop = Math.floor(elapsed / LOOP_MS);
  const t = elapsed % LOOP_MS;
  const loopStart = startedAt + loop * LOOP_MS;
  const count = Math.min(NAMES.length, Math.floor(t / 800) + 1);
  const balls = NAMES.slice(0, count).map((name, i) => ({
    id: `demo-${loop}-${i}`,
    twitchId: `demo-${i}`,
    displayName: name,
    slotId: `demo-slot-${i}`,
    slotName: SLOTS[i],
    thumb: null,
    status: i === 6 && t >= DRAW_AT ? 'drawn' : 'drum',
    enteredAt: at(loopStart + i * 800),
  }));
  const rack =
    t >= DRAW_AT
      ? [{ drawNo: 1, twitchId: 'demo-6', displayName: NAMES[6], slotId: 'demo-slot-6', slotName: SLOTS[6], thumb: null, drawnAt: at(loopStart + DRAW_AT), scratched: false }]
      : [];
  const round = { id: `demo-${loop}`, status: 'open', prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } }, huntId: null, rack };
  return { round, balls, ready: true, hunt: null, stale: false };
}
```

Create `src/components/ball/ballFixtures.js`:

```js
// Dev-only Goofer Ball fixtures (stripped from production builds, like
// huntFixtures): the overlay's ?fixture= and CH 42's ?fixture=. Timestamps
// are relative to `now` so the draw and winner moments actually play.
const at = (ms) => ({ toMillis: () => ms });
const NAMES = ['CoolGuy', 'BigWinz', 'Pupper', 'SugarFan', 'NightOwl', 'ReelRat', 'Mossy', 'LuckyLou'];
const SLOTS = ['Gates of Olympus', 'Wanted Dead or a Wild', 'The Dog House', 'Sugar Rush 1000', 'Big Bass Bonanza', 'Zeus vs Hades', 'Le Bandit', 'Fire Portals'];

export const FIXTURE_PRIZE = { tickets: 200, prize: { kind: 'cash', amount: 5 } };

export function fixtureBalls(now, { drawn = 0, count = 8 } = {}) {
  return NAMES.slice(0, count).map((name, i) => ({
    id: `fx${i}`,
    twitchId: `fx${i}`,
    twitchName: name.toLowerCase(),
    displayName: name,
    slotId: `fx-slot-${i}`,
    slotName: SLOTS[i],
    thumb: null,
    status: i < drawn ? 'drawn' : 'drum',
    drawNo: i < drawn ? i + 1 : null,
    enteredAt: at(now - (count - i) * 60_000),
  }));
}

export function fixtureRack(now, drawn, { lastAt = now - 600_000 } = {}) {
  return Array.from({ length: drawn }, (_, i) => ({
    drawNo: i + 1,
    twitchId: `fx${i}`,
    twitchName: NAMES[i].toLowerCase(),
    displayName: NAMES[i],
    slotId: `fx-slot-${i}`,
    slotName: SLOTS[i],
    thumb: null,
    drawnAt: at(i === drawn - 1 ? lastAt : now - (drawn - i) * 900_000),
    scratched: false,
  }));
}

export function fixtureRound(now, extra = {}) {
  return { id: 'fx-round', status: 'open', prize: FIXTURE_PRIZE, huntId: null, rack: [], openedAt: at(now - 3_600_000), ...extra };
}

export const FIXTURE_HUNT = {
  id: 'fx-hunt',
  bonuses: [
    { slot: 'Gates of Olympus', bet: 1, win: 412, multiplier: 412 },
    { slot: 'Wanted Dead or a Wild', bet: 2, win: 176, multiplier: 88 },
    { slot: 'The Dog House', bet: 1, win: 12, multiplier: 12 },
    { slot: 'Sugar Rush 1000', bet: 1, win: null, multiplier: null },
  ],
};

export function overlayFixture(key, now) {
  const feed = (round, balls, hunt = null) => ({ round, balls, ready: true, hunt, stale: false });
  if (key === 'open') return feed(fixtureRound(now, { rack: fixtureRack(now, 3) }), fixtureBalls(now, { drawn: 3 }));
  if (key === 'draw') return feed(fixtureRound(now, { rack: fixtureRack(now, 4, { lastAt: now }) }), fixtureBalls(now, { drawn: 4 }));
  if (key === 'rack') return feed(fixtureRound(now, { huntId: 'fx-hunt', rack: fixtureRack(now, 4) }), fixtureBalls(now, { drawn: 4 }), FIXTURE_HUNT);
  if (key === 'winner') {
    const rack = fixtureRack(now, 4);
    const round = fixtureRound(now, {
      status: 'settled',
      rack,
      settledAt: at(now),
      results: { 1: { multiplier: 412, win: 412, bet: 1, source: 'hunt' } },
      winner: { ...rack[0], multiplier: 412, win: 412, redemptionId: null },
    });
    return feed(round, fixtureBalls(now, { drawn: 4 }));
  }
  return null;
}
```

- [ ] **Step 5: Write the overlay page**

Create `src/pages/BallOverlay.js`:

```js
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useClock } from '../hooks/useClock';
import useOverlaySound from '../hooks/useOverlaySound';
import useBallRound from '../hooks/useBallRound';
import useBallsFeed from '../hooks/useBallsFeed';
import useBallHunt from '../hooks/useBallHunt';
import useBallArrivals from '../hooks/useBallArrivals';
import useBroadcastSettings from '../hooks/useBroadcastSettings';
import { useToasts } from '../components/ball/toastQueue';
import CornerBox from '../components/ball/CornerBox';
import RackBoard from '../components/ball/RackBoard';
import DrawTakeover from '../components/ball/DrawTakeover';
import WinnerCard from '../components/ball/WinnerCard';
import { demoFeed } from '../components/ball/ballDemo';
import { drawMoment, drumBalls, hasResults, isActive, liveRows, winnerMoment } from '../utils/ball';

// OBS browser source for Goofer Ball (spec: OBS overlay). Transparent; it
// follows Firestore, so staff run the round from the control room.
//
// Query params:
//   pos=bl|br|tl|tr   corner for the box and the live rack (default bl)
//   sound=1           blower, tube and landing sounds (OBS audio)
//   demo=1            loop a fake round, for placing it in OBS
//   fixture=open|draw|rack|winner   dev only

const POSITION = {
  bl: 'left-8 bottom-8',
  br: 'right-8 bottom-8',
  tl: 'left-8 top-8',
  tr: 'right-8 top-8',
};

let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Webpack drops this branch, and the fixtures with it, from production builds.
  readFixture = (key, now) => (key ? require('../components/ball/ballFixtures').overlayFixture(key, now) : null);
}

function useLiveBall(enabled) {
  const { round } = useBallRound({ enabled });
  const active = enabled && isActive(round);
  const { balls, ready } = useBallsFeed(round ? round.id : null, { enabled: active });
  const { hunt, stale } = useBallHunt(round ? round.huntId : null, { enabled: active });
  return { round: round || null, balls, ready, hunt, stale };
}

function useDemo(enabled) {
  const startedAt = useRef(Date.now());
  const now = useClock({ intervalMs: 250, active: enabled });
  return useMemo(() => (enabled ? demoFeed(now - startedAt.current, startedAt.current) : null), [enabled, now]);
}

export default function BallOverlay() {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const demo = params.get('demo') === '1';
  const [fixture] = useState(() => readFixture(params.get('fixture'), Date.now()));
  const position = POSITION[params.get('pos')] || POSITION.bl;
  const sound = useOverlaySound(params.get('sound') === '1');

  const liveEnabled = !demo && !fixture;
  const live = useLiveBall(liveEnabled);
  const demoData = useDemo(demo);
  const data = fixture || demoData || live;
  const { reveals } = useBroadcastSettings(liveEnabled);
  const { toast, push } = useToasts();
  useBallArrivals(data.balls, data.ready, push);

  // The browser source must be see-through (same as the giveaway overlay).
  useEffect(() => {
    const prev = [document.documentElement.style.background, document.body.style.background];
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      [document.documentElement.style.background, document.body.style.background] = prev;
    };
  }, []);

  const round = data.round;
  const probe = drawMoment(round, Date.now()) || winnerMoment(round, Date.now());
  const now = useClock({ fast: !!probe, active: !!probe });
  const moment = drawMoment(round, now) || winnerMoment(round, now);
  // Stage mode: a staff browser plays the full-screen moments; OBS keeps
  // only the corner cards, so nothing plays twice.
  const fullScreen = reveals !== 'stage';

  let body = null;
  if (moment && fullScreen && moment.kind === 'draw') {
    const drum = drumBalls(data.balls);
    body = (
      <DrawTakeover
        entry={moment.entry}
        rack={round.rack || []}
        balls={drum}
        left={data.ready ? drum.length : null}
        elapsed={now - moment.at}
        sound={sound}
      />
    );
  } else if (moment && fullScreen && moment.kind === 'winner') {
    body = <WinnerCard round={round} />;
  } else if (isActive(round)) {
    const rows = liveRows(round, data.hunt);
    body =
      round.huntId && hasResults(rows) ? (
        <RackBoard round={round} rows={rows} stale={data.stale} position={position} />
      ) : (
        <CornerBox round={round} balls={data.balls} toast={toast} position={position} />
      );
  }

  return <div className="pointer-events-none fixed inset-0 overflow-hidden font-onair text-onair-ink-1">{body}</div>;
}
```

- [ ] **Step 6: Route it and keep the control room off it**

In `src/App.js`:

- add `const BallOverlay = lazy(() => import('./pages/BallOverlay'));` next to `GiveawayOverlay`;
- in `AppShell`, after the `/giveaway-overlay` branch, add:

```js
  if (location.pathname === '/ball-overlay') {
    return (
      <Suspense fallback={null}>
        <BallOverlay />
      </Suspense>
    );
  }
```

In `src/components/controlRoom/selectors.js` change `OVERLAY_PATHS` to `['/giveaway-overlay', '/ball-overlay', '/suggest-overlay']`. In `src/components/controlRoom/__tests__/selectors.test.js`, add an assertion: `expect(controlRoomAllowed('/ball-overlay')).toBe(false);`, inside the existing `controlRoomAllowed` test or as a new one-line test importing `controlRoomAllowed`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="BallOverlay|selectors|GiveawayOverlay|components/ball"`
Expected: PASS.

- [ ] **Step 8: Look at it**

Run `npm start`, then open these URLs:

- `http://localhost:3000/ball-overlay?fixture=open`;
- `?fixture=draw` (reload to replay the 8s takeover);
- `?fixture=rack`;
- `?fixture=winner`;
- `?demo=1&pos=br`.

Check against `docs/redesign/goofer-ball/overlay-flow.html`: corner box layout, starburst set, lower third, rack and winner card. Nothing should overflow at 1920×1080. Fix spacing in the components if needed (keep tests green).

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useOverlaySound.js src/pages/GiveawayOverlay.js src/components/ball src/pages/BallOverlay.js src/pages/__tests__/BallOverlay.test.js src/App.js src/components/controlRoom/selectors.js src/components/controlRoom/__tests__/selectors.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): the /ball-overlay OBS source"
```

---

### Task 14: Reveals switch, the provider's ball round, Stage moments, giveaway overlay

**Files:**

- Modify: `src/contexts/ControlRoomContext.js`, `src/components/controlRoom/PanelChrome.js`, `src/components/controlRoom/ControlRoom.js`, `src/components/controlRoom/stageTriggers.js`, `src/components/controlRoom/StageMoment.js`, `src/pages/GiveawayOverlay.js`
- Modify tests: `src/contexts/__tests__/ControlRoomContext.test.js`, `src/components/controlRoom/__tests__/ControlRoom.test.js`, `src/components/controlRoom/__tests__/stageTriggers.test.js`
- Create tests: `src/components/controlRoom/__tests__/StageMomentBall.test.js`, `src/pages/__tests__/GiveawayOverlayReveals.test.js`

**Interfaces:**

- Consumes: `useBroadcastSettings` and `writeReveals` (Task 9); `drawMoment` and `winnerMoment` (Task 8); `DrawTakeover` and `WinnerCard` (Task 11).
- Produces:
  - In the `useControlRoom()` value: `ballRound` (the newest `ball_rounds` doc or null), `reveals` (`'overlay'|'stage'`), and `setReveals(mode)`, which sets this browser's Stage pref (`mode === 'stage'`) and writes `settings/broadcast`.
  - `PanelChrome` props: `reveals` and `onReveals` replace `stage` and `onStage`. The header shows a radiogroup "Reveals play on" with radios **OBS** and **Stage**.
  - In `stageTriggers.js`: `ballDrawMoment(round, lastKey, now)` and `ballWinnerMoment(round, lastKey, now)`, returning `{ kind: 'ball-draw'|'ball-winner', key, at, endsAt, entry?, round }`.
  - `GiveawayOverlay` skips `RevealStage` (rolling and the lock hold) when `reveals === 'stage'`. Its entry card and now-playing card still render.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/controlRoom/__tests__/stageTriggers.test.js` (add `ballDrawMoment, ballWinnerMoment` to its import from `'../stageTriggers'`):

```js
describe('Goofer Ball moments', () => {
  const at2 = (ms) => ({ toMillis: () => ms });
  const NOW = 10_000_000;
  const round = (agoMs, extra = {}) => ({
    id: 'r1',
    status: 'open',
    rack: [{ drawNo: 2, slotName: 'Gates of Olympus', displayName: 'CoolGuy', drawnAt: at2(NOW - agoMs), scratched: false }],
    ...extra,
  });

  test('a fresh draw takes the stage once', () => {
    const m = ballDrawMoment(round(500), null, NOW);
    expect(m).toMatchObject({ kind: 'ball-draw', key: 'r1:2', at: NOW - 500, endsAt: NOW - 500 + 8000 });
    expect(ballDrawMoment(round(500), 'r1:2', NOW)).toBeNull();
    expect(ballDrawMoment(round(9000), null, NOW)).toBeNull();
  });

  test('a fresh settle plays the winner card', () => {
    const settled = { id: 'r1', status: 'settled', settledAt: at2(NOW - 1000), winner: { drawNo: 2 }, rack: [] };
    expect(ballWinnerMoment(settled, null, NOW)).toMatchObject({ kind: 'ball-winner', key: 'r1:winner', endsAt: NOW - 1000 + 12000 });
    expect(ballWinnerMoment(settled, 'r1:winner', NOW)).toBeNull();
  });
});
```

Create `src/components/controlRoom/__tests__/StageMomentBall.test.js`:

```js
import { render, screen } from '@testing-library/react';
import StageMoment from '../StageMoment';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { useGiveawayFeed } from '../../../hooks/useGiveawayFeed';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../hooks/useGiveawayFeed', () => ({ useGiveawayFeed: jest.fn() }));

const at = (ms) => ({ toMillis: () => ms });
const entry = (ms) => ({ drawNo: 1, twitchId: 'c', displayName: 'CoolGuy', slotName: 'Gates of Olympus', thumb: null, drawnAt: at(ms), scratched: false });

function show(ballRound) {
  useControlRoom.mockReturnValue({ giveaway: null, latestRound: null, ballRound, setDucked: jest.fn() });
  return render(<StageMoment />);
}

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  useGiveawayFeed.mockReturnValue({ giveaway: null, entries: [], firstMessage: null });
});

test('a fresh draw plays the takeover on Stage', () => {
  show({ id: 'r1', status: 'open', rack: [entry(Date.now() - 6000)] });
  expect(screen.getByText('Called in by @CoolGuy')).toBeTruthy();
});

test('an old draw never plays', () => {
  const { container } = show({ id: 'r1', status: 'open', rack: [entry(Date.now() - 60_000)] });
  expect(container.textContent).toBe('');
});

test('a fresh settle plays the winner card', () => {
  show({
    id: 'r1',
    status: 'settled',
    settledAt: at(Date.now() - 1000),
    prize: { tickets: 200, prize: null },
    rack: [entry(Date.now() - 600_000)],
    winner: { ...entry(0), multiplier: 412 },
  });
  expect(screen.getByText("Tonight's winning ball")).toBeTruthy();
});
```

Create `src/pages/__tests__/GiveawayOverlayReveals.test.js`:

```js
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GiveawayOverlay from '../GiveawayOverlay';
import { useGiveawayFeed } from '../../hooks/useGiveawayFeed';
import useBroadcastSettings from '../../hooks/useBroadcastSettings';

jest.mock('../../hooks/useGiveawayFeed', () => ({ useGiveawayFeed: jest.fn() }));
jest.mock('../../hooks/useBroadcastSettings', () => jest.fn());
jest.mock('../../components/giveaway/RevealStage', () => () => require('react').createElement('p', null, 'reveal stage'));

const at = (ms) => ({ toMillis: () => ms });
const ROLLING = {
  id: 'g1',
  title: 'Test giveaway',
  status: 'rolling',
  keyword: 'GOOF',
  prize: 'Bonus buy $50',
  entryCount: 3,
  winners: [],
  winnerTwitchId: 'w1',
  winner: { twitchId: 'w1', displayName: 'Winner' },
  rolledAt: at(Date.now() - 1000),
};

function show(reveals) {
  useGiveawayFeed.mockReturnValue({ giveaway: ROLLING, entries: [], firstMessage: null });
  useBroadcastSettings.mockReturnValue({ reveals });
  return render(
    <MemoryRouter initialEntries={['/giveaway-overlay']}>
      <GiveawayOverlay />
    </MemoryRouter>
  );
}

test('OBS mode plays the reveal', () => {
  show('overlay');
  expect(screen.getByText('reveal stage')).toBeTruthy();
});

test('Stage mode: the OBS overlay skips the full-screen reveal', () => {
  show('stage');
  expect(screen.queryByText('reveal stage')).toBeNull();
});
```

In `src/contexts/__tests__/ControlRoomContext.test.js`:

- add `doc: (_db, ...parts) => parts.join('/'),` to the `firebase/firestore` mock;
- add `jest.mock('../../utils/broadcast', () => ({ writeReveals: jest.fn() }));` and import `{ writeReveals } from '../../utils/broadcast'`;
- in `beforeEach`, add `writeReveals.mockResolvedValue(undefined);`;
- change the expected subscription list (the line asserting `['giveaways', 'hunts', 'redemptions']`) to `['ball_rounds', 'giveaways', 'hunts', 'redemptions', 'settings/broadcast']`.

Then append:

```js
test('setReveals writes the shared switch and moves this browser’s Stage pref with it', () => {
  mount();
  act(() => latest.setReveals('stage'));
  expect(writeReveals).toHaveBeenCalledWith('stage');
  expect(latest.prefs.stage).toBe(true);
  act(() => latest.setReveals('overlay'));
  expect(writeReveals).toHaveBeenLastCalledWith('overlay');
  expect(latest.prefs.stage).toBe(false);
});

test('the newest Goofer Ball round is on the context', () => {
  mockData.ball_rounds = [{ id: 'b1', status: 'open', rack: [] }];
  mount();
  expect(latest.ballRound).toMatchObject({ id: 'b1', status: 'open' });
});
```

In `src/components/controlRoom/__tests__/ControlRoom.test.js`:

- in `makeCr`, add `reveals: 'overlay',` and `setReveals: jest.fn(),`;
- in the "header controls call the right actions" test, replace the two Stage lines with:

```js
  fireEvent.click(screen.getByRole('radio', { name: 'Stage' }));
  expect(cr.setReveals).toHaveBeenCalledWith('stage');
  expect(screen.getByRole('radio', { name: 'OBS' }).getAttribute('aria-checked')).toBe('true');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testPathPattern="stageTriggers|StageMomentBall|GiveawayOverlayReveals|ControlRoomContext|ControlRoom.test"`
Expected: FAIL. The ball moment functions are missing, Stage renders nothing for ball rounds, the giveaway overlay ignores the switch, there's no `setReveals`, and there's no OBS/Stage radio.

- [ ] **Step 3: Stage triggers**

Append to `src/components/controlRoom/stageTriggers.js` (and import `drawMoment, winnerMoment` from `'../../utils/ball'`):

```js
// A Goofer Ball draw that just landed: the same takeover the OBS overlay
// plays, timed off drawnAt, so Stage and OBS are frame-for-frame the same.
export function ballDrawMoment(round, lastKey, now) {
  const m = drawMoment(round, now);
  if (!m || m.key === lastKey || now - m.at >= STAGE_FRESH_MS) return null;
  return { kind: 'ball-draw', key: m.key, at: m.at, endsAt: m.endsAt, entry: m.entry, round };
}

export function ballWinnerMoment(round, lastKey, now) {
  const m = winnerMoment(round, now);
  if (!m || m.key === lastKey) return null;
  return { kind: 'ball-winner', key: m.key, at: m.at, endsAt: m.endsAt, round };
}
```

- [ ] **Step 4: Stage plays ball moments**

In `src/components/controlRoom/StageMoment.js`:

- import `DrawTakeover` from `'../ball/DrawTakeover'` and `WinnerCard` from `'../ball/WinnerCard'`;
- add `ballDrawMoment, ballWinnerMoment` to the `./stageTriggers` import;
- change the `staged` ref to `useRef({ pick: null, round: null, ballDraw: null, ballWinner: null })`;
- tick faster for a draw: `const now = useClock({ intervalMs: moment && moment.kind === 'ball-draw' ? 100 : 250, active: !!moment && !leaving });`.

Then add the effect after the results effect:

```js
  const ballRound = cr.ballRound;
  useEffect(() => {
    const t = Date.now();
    const draw = ballDrawMoment(ballRound, staged.current.ballDraw, t);
    if (draw) {
      staged.current.ballDraw = draw.key;
      setMoment(draw);
      return;
    }
    const win = ballWinnerMoment(ballRound, staged.current.ballWinner, t);
    if (win) {
      staged.current.ballWinner = win.key;
      setMoment(win);
    }
  }, [ballRound]);
```

and two branches after the `results` branch in the body:

```js
  } else if (moment.kind === 'ball-draw') {
    body = <DrawTakeover entry={moment.entry} rack={moment.round.rack || []} elapsed={now - moment.at} />;
  } else if (moment.kind === 'ball-winner') {
    body = <WinnerCard round={moment.round} />;
  }
```

- [ ] **Step 5: Provider: ball round and the reveals switch**

In `src/contexts/ControlRoomContext.js`:

```js
import useBroadcastSettings from '../hooks/useBroadcastSettings';
import { writeReveals } from '../utils/broadcast';
```

```js
const ballRoundsQuery = () => query(collection(db, 'ball_rounds'), orderBy('openedAt', 'desc'), fLimit(1));
```

Inside `ControlRoomProvider`, after `redemptionsFeed`:

```js
  const ballFeed = useLiveQuery(ballRoundsQuery, enabled);
  const ballRound = ballFeed.docs[0] || null;
  const broadcast = useBroadcastSettings(enabled);
```

After `setStage`:

```js
  // The shared reveals switch: OBS or this browser's Stage, never both.
  const setReveals = useCallback(
    (mode) => {
      const next = mode === 'stage' ? 'stage' : 'overlay';
      setStore((s) => ({ ...s, stage: next === 'stage' }));
      Promise.resolve(writeReveals(next)).catch(() => pushWarning('Could not save where reveals play. Try again.'));
    },
    [pushWarning]
  );
```

In `value`:

- add `ballRound,`, `reveals: broadcast.reveals,` and `setReveals,`;
- extend `dataLost` with `|| ballFeed.error` and `dataGaveUp` with `|| ballFeed.gaveUp`.

- [ ] **Step 6: Header switch**

In `src/components/controlRoom/PanelChrome.js`, replace the `stage`/`onStage` props with `reveals`/`onReveals`, and replace the Stage `<button>` with:

```js
          <div role="radiogroup" aria-label="Reveals play on" className="flex items-center gap-0.5">
            {[
              ['overlay', 'OBS', 'Full-screen reveals play in the OBS overlays'],
              ['stage', 'Stage', 'Full-screen reveals play on this browser; the OBS overlays skip them'],
            ].map(([mode, label, title]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={reveals === mode}
                title={title}
                onClick={() => onReveals(mode)}
                className={`cr-switch ${reveals === mode ? 'is-on' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
```

In `src/components/controlRoom/ControlRoom.js`, replace `stage={cr.prefs.stage}` and `onStage={cr.setStage}` on `<PanelChrome>` with `reveals={cr.reveals}` and `onReveals={cr.setReveals}`. `StaffLayer` still mounts `StageMoment` from `cr.prefs.stage`, which `setReveals` now drives.

- [ ] **Step 7: The giveaway overlay respects the switch**

In `src/pages/GiveawayOverlay.js`:

- import `useBroadcastSettings from '../hooks/useBroadcastSettings'`;
- after the feed lines, add:

```js
  // Stage mode: a staff browser plays the full-screen reveal, so OBS skips
  // it (the entry and now-playing cards stay).
  const { reveals } = useBroadcastSettings(!demo);
  const fullScreen = demo || reveals !== 'stage';
```

Then change the reveal condition to `if (fullScreen && ((giveaway.status === 'rolling' && giveaway.winner) || holding)) {`. A rolling giveaway in Stage mode falls through to the existing `['open', 'closed', 'rolling']` entry-card branch.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="stageTriggers|StageMoment|GiveawayOverlayReveals|ControlRoomContext|ControlRoom.test|StaffLayer|PanelChrome"`
Expected: PASS. If `GiveawayOverlayReveals` crashes inside the entry card for a missing field, add that field to `ROLLING` (it's a fixture, not the subject).

- [ ] **Step 9: Commit**

```bash
git add src/contexts src/components/controlRoom src/pages/GiveawayOverlay.js src/pages/__tests__/GiveawayOverlayReveals.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(control-room): one reveals switch for OBS or Stage; Stage plays Goofer Ball"
```

---

### Task 15: Control room Ball tab: open, draw, scratch, close, chat engine

**Files:**

- Create: `src/components/controlRoom/ballApi.js`, `src/components/controlRoom/useBallAnnounce.js`, `src/components/controlRoom/BallTab.js`
- Modify:
  - `src/contexts/ControlRoomContext.js` (balls feed, engine);
  - in `src/components/controlRoom/`: `storage.js`, `PanelChrome.js`, `panelStatus.js`, `Pill.js`, `ControlRoom.js`.
- Modify tests: `src/components/controlRoom/__tests__/panelStatus.test.js`
- Create tests: `src/components/controlRoom/__tests__/BallTab.test.js`, `src/components/controlRoom/__tests__/useBallAnnounce.test.js`

**Interfaces:**

- Consumes: `cr.ballRound` and `cr.giveaway` (Task 14); `useBallsFeed` (Task 9); `DRAW_REVEAL_MS`, `drawnEntries`, `drumBalls`, `isActive`, `pad2`, `pendingDrawAnnounces`, `drawAnnounceDueAt`, `prizeText`, `recentBalls`, `who` and `AUTO_POST_WINDOW_MS` (Task 8); `REVEAL_MS`, `LOCK_HOLD_MS`, `STREAM_DELAY_MS` and `tsMillis` from `src/utils/giveaway.js`; `inputCls` from `src/components/admin/predictions/shared.js`.
- Produces:
  - API helpers: `ballAction(body) → { ok, status, data }` (never throws), `ballErrorText(code, status)`, `announceProblem(ok, data) → string|null`, `useBallRun() → { busy, error, run(body) → Promise<{ok,data}>, setError }`.
  - Engine hooks: `useBallDrawAnnounce(round, { armed }) → { error, retry }` and `useBallResultsAnnounce(round, { armed }) → { posted, posting, error, retry }`.
  - Context: adds `balls`, `ballDrawAnnounce` and `ballResults`.
  - `<BallTab />` with exports `prizeForm(prize)`, `prizePayload(form)`, `PrizeFields`.
  - Panel status: `tabLeds({ …, ballRound })` gains `ball: 'off'|'on'|'pulse'`, and `ballChip(ballRound, balls) → { label: 'BALL n' }|null`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/controlRoom/__tests__/useBallAnnounce.test.js`:

```js
import { renderHook, waitFor } from '@testing-library/react';
import { useBallDrawAnnounce, useBallResultsAnnounce } from '../useBallAnnounce';
import { ballAction } from '../ballApi';

jest.mock('../ballApi', () => ({
  ballAction: jest.fn(),
  announceProblem: jest.requireActual('../ballApi').announceProblem,
}));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const at = (ms) => ({ toMillis: () => ms });
const entry = (drawNo, agoMs) => ({ drawNo, slotName: 'X', displayName: 'Y', drawnAt: at(Date.now() - agoMs), scratched: false });

beforeEach(() => {
  ballAction.mockResolvedValue({ ok: true, status: 200, data: { ok: true, announce: { posted: true } } });
});

test('posts every due draw line once, only in the driving tab', async () => {
  const round = { id: 'r1', rack: [entry(1, 30_000), entry(2, 20_000)], announced: { draws: {} } };
  const { rerender } = renderHook(({ armed }) => useBallDrawAnnounce(round, { armed }), { initialProps: { armed: false } });
  expect(ballAction).not.toHaveBeenCalled();
  rerender({ armed: true });
  await waitFor(() => expect(ballAction).toHaveBeenCalledTimes(2));
  expect(ballAction).toHaveBeenCalledWith({ action: 'announce', id: 'r1', event: 'draw', drawNo: 1 });
  expect(ballAction).toHaveBeenCalledWith({ action: 'announce', id: 'r1', event: 'draw', drawNo: 2 });
  rerender({ armed: true });
  expect(ballAction).toHaveBeenCalledTimes(2);
});

test('a refused line surfaces an error', async () => {
  ballAction.mockResolvedValue({ ok: true, status: 200, data: { ok: true, announce: { posted: false, reason: 'CHAT_DROPPED:x' } } });
  const round = { id: 'r1', rack: [entry(1, 30_000)], announced: { draws: {} } };
  const { result } = renderHook(() => useBallDrawAnnounce(round, { armed: true }));
  await waitFor(() => expect(result.current.error).toBe('CHAT_DROPPED:x'));
});

test('results post after the stream delay, once', async () => {
  const round = { id: 'r1', status: 'settled', settledAt: at(Date.now() - 4000), winner: { drawNo: 1 }, announced: {} };
  renderHook(() => useBallResultsAnnounce(round, { armed: true }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'announce', id: 'r1', event: 'results' }));
});
```

Create `src/components/controlRoom/__tests__/BallTab.test.js`:

```js
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BallTab from '../BallTab';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { ballAction } from '../ballApi';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../ballApi', () => ({ ...jest.requireActual('../ballApi'), ballAction: jest.fn() }));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));
jest.mock('../BallPayout', () => () => require('react').createElement('p', null, 'payout table'));
jest.mock('../HuntLink', () => () => require('react').createElement('p', null, 'hunt link'));

const at = (ms) => ({ toMillis: () => ms });
const OPEN = {
  id: 'r1',
  status: 'open',
  prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
  rack: [{ drawNo: 1, twitchId: 'a', displayName: 'CoolGuy', slotName: 'Gates of Olympus', drawnAt: at(1), scratched: false }],
  lastDrawAt: at(Date.now() - 60_000),
  huntId: null,
};
const BALLS = [
  { id: 'a', status: 'drawn', slotName: 'Gates of Olympus', displayName: 'CoolGuy', enteredAt: at(1) },
  { id: 'b', status: 'drum', slotName: 'Sugar Rush', displayName: 'SugarFan', enteredAt: at(3) },
  { id: 'c', status: 'drum', slotName: 'The Dog House', displayName: 'Pupper', enteredAt: at(2) },
];
const QUIET = { error: null, retry: jest.fn() };

function show(cr) {
  useControlRoom.mockReturnValue({
    ballRound: null,
    balls: [],
    giveaway: null,
    ballDrawAnnounce: QUIET,
    ballResults: { posted: false, posting: false, error: null, retry: jest.fn() },
    ...cr,
  });
  return render(<BallTab />);
}

beforeEach(() => {
  ballAction.mockResolvedValue({ ok: true, status: 200, data: { ok: true } });
});

test('idle: open the drum with the prize from the form', async () => {
  show({});
  expect(screen.getByText('No drum open.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Tickets'), { target: { value: '300' } });
  fireEvent.change(screen.getByLabelText('Dollar prize'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Prize kind'), { target: { value: 'bonus' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open the drum' }));
  await waitFor(() =>
    expect(ballAction).toHaveBeenCalledWith({ action: 'open', prize: { tickets: 300, prize: { kind: 'bonus', amount: 5 } }, requireFollow: true })
  );
});

test('the open form pre-fills from the last round', () => {
  show({ ballRound: { id: 'old', status: 'cancelled', prize: { tickets: 75, prize: null } } });
  expect(screen.getByLabelText('Tickets').value).toBe('75');
  expect(screen.getByLabelText('Dollar prize').value).toBe('');
});

test('open: counts, prize, rack, just-in, and Draw', async () => {
  show({ ballRound: OPEN, balls: BALLS });
  expect(screen.getByText('OPEN')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByText('200 tickets + $5')).toBeTruthy();
  expect(screen.getByText('Gates of Olympus')).toBeTruthy();
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toContain('SugarFanSugar Rush');
  fireEvent.click(screen.getByRole('button', { name: 'Draw ball' }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'draw', id: 'r1' }));
});

test('Draw waits while a ball or a giveaway reveal is on screen', () => {
  const { unmount } = show({ ballRound: { ...OPEN, lastDrawAt: at(Date.now() - 1000) }, balls: BALLS });
  expect(screen.getByRole('button', { name: 'Ball on screen…' }).disabled).toBe(true);
  unmount();
  show({ ballRound: OPEN, balls: BALLS, giveaway: { status: 'rolling', rolledAt: at(Date.now() - 1000) } });
  expect(screen.getByRole('button', { name: 'Giveaway on screen…' }).disabled).toBe(true);
});

test('scratch and close are two-press', async () => {
  show({ ballRound: OPEN, balls: BALLS });
  fireEvent.click(screen.getByRole('button', { name: 'Scratch' }));
  expect(ballAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm scratch' }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'scratch', id: 'r1', drawNo: 1 }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Close lineup' }).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Close lineup' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm close' }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'close', id: 'r1' }));
});

test('edit the prize inline', async () => {
  show({ ballRound: OPEN, balls: BALLS });
  fireEvent.click(screen.getByRole('button', { name: 'Edit prize' }));
  fireEvent.change(screen.getByLabelText('Tickets'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save prize' }));
  await waitFor(() =>
    expect(ballAction).toHaveBeenCalledWith({ action: 'update_prize', id: 'r1', prize: { tickets: 500, prize: { kind: 'cash', amount: 5 } } })
  );
});

test('server errors show in words', async () => {
  ballAction.mockResolvedValue({ ok: false, status: 400, data: { error: 'EMPTY_DRUM' } });
  show({ ballRound: OPEN, balls: BALLS });
  fireEvent.click(screen.getByRole('button', { name: 'Draw ball' }));
  expect(await screen.findByText('Nobody in the drum.')).toBeTruthy();
});

test('closed: the payout table, Reopen and two-press Cancel', async () => {
  show({ ballRound: { ...OPEN, status: 'closed' }, balls: BALLS });
  expect(screen.getByText('payout table')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Draw ball' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'reopen', id: 'r1' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel round' }).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel round' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel' }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'cancel', id: 'r1' }));
});

test('a failed draw line offers Retry', () => {
  const retry = jest.fn();
  show({ ballRound: OPEN, balls: BALLS, ballDrawAnnounce: { error: 'CHAT_DROPPED:x', retry } });
  fireEvent.click(screen.getByRole('button', { name: 'Retry chat line' }));
  expect(retry).toHaveBeenCalled();
});
```

In `src/components/controlRoom/__tests__/panelStatus.test.js`:

- change the two `tabLeds(...)).toEqual({ giveaway: …, predict: …, redeem: … })` lines to also expect `ball: 'off'`;
- add `ballChip` to the import.

Then append:

```js
test('the Ball tab LED and the pill chip', () => {
  expect(tabLeds({ ballRound: { status: 'open' } }).ball).toBe('on');
  expect(tabLeds({ ballRound: { status: 'closed' } }).ball).toBe('pulse');
  expect(tabLeds({ ballRound: { status: 'settled' } }).ball).toBe('off');
  expect(ballChip({ status: 'open' }, [{ status: 'drum' }, { status: 'drawn' }, { status: 'drum' }])).toEqual({ label: 'BALL 2' });
  expect(ballChip({ status: 'closed' }, [])).toBeNull();
  expect(ballChip(null, null)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false --testPathPattern="useBallAnnounce|BallTab|panelStatus"`
Expected: FAIL (modules missing; `ball` LED absent).

- [ ] **Step 3: API helper and engine hooks**

Create `src/components/controlRoom/ballApi.js`:

```js
import { useCallback, useState } from 'react';
import { authedFetch } from '../../utils/authedFetch';

// POST one action to the Goofer Ball staff endpoint. Never throws.
export async function ballAction(body) {
  try {
    const res = await authedFetch('/api/admin/ball', { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: data || {} };
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error' } };
  }
}

const ERROR_TEXT = {
  ROUND_ACTIVE: 'Settle or cancel the current round first.',
  INVALID_PRIZE: 'Set tickets or a $ prize.',
  NOT_OPEN: 'The drum is not open.',
  NOT_CLOSED: 'Close the lineup first.',
  EMPTY_DRUM: 'Nobody in the drum.',
  DRAW_BUSY: 'A draw is still on screen.',
  ALREADY_SETTLED: 'Already paid out.',
  NO_RESULTS: 'No drawn ball has a result yet.',
  FINAL: 'This round is over.',
  NOT_DRAWN: 'That ball is not on the rack.',
  ALREADY_SCRATCHED: 'Already scratched.',
  HUNT_NOT_FOUND: 'That hunt is gone.',
  COMMUNITYHUNTS_UNAVAILABLE: 'communityhunts.gg is unavailable. Type the numbers in.',
  NOT_AUTHENTICATED: 'Signed out. Sign in again at /admin.',
};

export function ballErrorText(code, status) {
  if (status === 401 || status === 403) return ERROR_TEXT.NOT_AUTHENTICATED;
  return ERROR_TEXT[code] || `Failed: ${code || status || 'unknown'}`;
}

// The problem to show for an `announce` reply, or null when it posted (or
// was already posted, or the draw was scratched).
export function announceProblem(ok, data) {
  const r = data && data.announce;
  if (ok && r && (r.posted || r.reason === 'already' || r.reason === 'scratched')) return null;
  return (r && r.reason) || (data && data.error) || 'unknown';
}

// One staff action at a time, with its error in words.
export function useBallRun() {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const run = useCallback(async (body) => {
    setBusy(body.action);
    setError(null);
    const result = await ballAction(body);
    setBusy(null);
    if (!result.ok) setError(ballErrorText(result.data.error, result.status));
    return result;
  }, []);
  return { busy, error, run, setError };
}
```

Create `src/components/controlRoom/useBallAnnounce.js`:

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { STREAM_DELAY_MS, tsMillis } from '../../utils/giveaway';
import { AUTO_POST_WINDOW_MS, drawAnnounceDueAt, pendingDrawAnnounces } from '../../utils/ball';
import { announceProblem, ballAction } from './ballApi';

const TOO_EARLY_RETRY_MS = 1500;

// Posts each draw's chat line once the reveal has played on stream (chat runs
// ahead of the video). Driving tab only; the server claims each line, so
// several staff tabs still post once.
export function useBallDrawAnnounce(round, { armed = true } = {}) {
  const [error, setError] = useState(null);
  const tried = useRef(new Set());
  const id = round ? round.id : null;
  const pending = round ? pendingDrawAnnounces(round, Date.now()) : [];
  const pendingKey = pending.map((e) => e.drawNo).join(',');

  const postRef = useRef(null);
  const post = useCallback(
    async (drawNo, again = true) => {
      const { ok, status, data } = await ballAction({ action: 'announce', id, event: 'draw', drawNo });
      // TOO_EARLY: this browser's clock runs ahead of the server's. Once more.
      if (status === 409 && again) {
        setTimeout(() => postRef.current(drawNo, false), TOO_EARLY_RETRY_MS);
        return;
      }
      setError(announceProblem(ok, data));
    },
    [id]
  );
  postRef.current = post;

  useEffect(() => {
    if (!armed || !id) return undefined;
    const timers = pending
      .filter((e) => !tried.current.has(`${id}:${e.drawNo}`))
      .map((e) =>
        setTimeout(() => {
          tried.current.add(`${id}:${e.drawNo}`);
          postRef.current(e.drawNo);
        }, Math.max(0, drawAnnounceDueAt(e) - Date.now()))
      );
    return () => timers.forEach(clearTimeout);
    // pendingKey stands in for `pending`, which is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, id, pendingKey]);

  const retry = useCallback(() => {
    setError(null);
    pendingDrawAnnounces(round, Date.now()).forEach((e) => postRef.current(e.drawNo));
  }, [round]);

  return { error, retry };
}

// Posts the winner line STREAM_DELAY_MS after the payout, like prediction
// results. Only a fresh settle posts on its own; older ones use Retry.
export function useBallResultsAnnounce(round, { armed = true } = {}) {
  const [state, setState] = useState({ id: null, posting: false, error: null });
  const tried = useRef(new Set());
  const id = round ? round.id : null;
  const settledMs = tsMillis(round && round.settledAt);
  const posted = !!(round && round.announced && round.announced.results);
  const due = !!round && round.status === 'settled' && !!round.winner && !posted && settledMs != null;

  const post = useCallback(async () => {
    if (!id) return;
    setState({ id, posting: true, error: null });
    const { ok, data } = await ballAction({ action: 'announce', id, event: 'results' });
    setState({ id, posting: false, error: announceProblem(ok, data) });
  }, [id]);

  useEffect(() => {
    if (!armed || !due || tried.current.has(id)) return undefined;
    if (Date.now() - settledMs > AUTO_POST_WINDOW_MS) return undefined;
    const t = setTimeout(() => {
      tried.current.add(id);
      post();
    }, Math.max(0, settledMs + STREAM_DELAY_MS - Date.now()));
    return () => clearTimeout(t);
  }, [armed, due, id, settledMs, post]);

  const mine = state.id === id;
  return { posted, posting: mine && state.posting, error: mine ? state.error : null, retry: post };
}
```

- [ ] **Step 4: Provider: balls feed and the engine**

In `src/contexts/ControlRoomContext.js`:

```js
import useBallsFeed from '../hooks/useBallsFeed';
import { isActive } from '../utils/ball';
import { useBallDrawAnnounce, useBallResultsAnnounce } from '../components/controlRoom/useBallAnnounce';
```

After the `ballRound` line from Task 14:

```js
  // Balls only while a drum is active: the tab, the pill chip and the draw
  // guard read them; nothing listens between rounds.
  const { balls } = useBallsFeed(ballRound ? ballRound.id : null, { enabled: enabled && isActive(ballRound) });
```

After `const results = useResultsAnnounce(...)`:

```js
  const ballDrawAnnounce = useBallDrawAnnounce(ballRound, { armed });
  const ballResults = useBallResultsAnnounce(ballRound, { armed });
```

Add `balls,`, `ballDrawAnnounce,` and `ballResults,` to `value`.

- [ ] **Step 5: Tab registration, LED, pill chip**

- **`storage.js`:** `const TABS = ['giveaway', 'predict', 'redeem', 'ball'];`
- **`PanelChrome.js`:** add `['ball', 'Ball']` to `TABS`, and `ball: '/gamba/ball'` to `ADMIN_HREF`.
- **`panelStatus.js`:** import `{ drumBalls, isActive } from '../../utils/ball'`, then change `tabLeds` and add `ballChip`:

```js
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
```

- **`Pill.js`:** accept a `ball` prop and render it after the redemption counter:

```js
      {ball && (
        <span className="cr-pill-count" aria-hidden="true">
          {ball.label}
        </span>
      )}
```

Also append `${ball ? `. ${ball.label.toLowerCase()} in the drum` : ''}` to the `aria-label`.

- **`ControlRoom.js`:**
  - import `BallTab` from `'./BallTab'`, `ballChip` from `'./panelStatus'` and `isActive` from `'../../utils/ball'`;
  - pass `ballRound: cr.ballRound` into the `tabLeds({...})` call;
  - pass `ball={ballChip(cr.ballRound, cr.balls)}` to `<Pill>`;
  - add the Ball branch to the tab body: `panel.tab === 'ball' ? <BallTab /> :` before the Giveaway fallback;
  - under the `dataLost` paragraph, add the offline warning:

```js
          {isActive(cr.ballRound) && !isLive && (
            <p className="mb-3 text-xs text-orange-admin font-mono">Goofer Ball still open (stream is offline).</p>
          )}
```

- [ ] **Step 6: The Ball tab**

Create `src/components/controlRoom/BallTab.js`:

```js
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { useClock } from '../../hooks/useClock';
import { LOCK_HOLD_MS, REVEAL_MS, tsMillis } from '../../utils/giveaway';
import { DRAW_REVEAL_MS, drawnEntries, drumBalls, formatMulti, isActive, pad2, prizeText, recentBalls, who } from '../../utils/ball';
import { inputCls } from '../admin/predictions/shared';
import { useBallRun } from './ballApi';
import BallPayout from './BallPayout';
import HuntLink from './HuntLink';

export function prizeForm(prize) {
  return {
    tickets: String(prize && prize.tickets != null ? prize.tickets : 200),
    amount: prize && prize.prize ? String(prize.prize.amount) : '',
    kind: (prize && prize.prize && prize.prize.kind) || 'cash',
  };
}

export function prizePayload(form) {
  const amount = Number(form.amount);
  return {
    tickets: Math.max(0, Math.floor(Number(form.tickets) || 0)),
    prize: form.amount !== '' && Number.isFinite(amount) && amount > 0 ? { kind: form.kind, amount } : null,
  };
}

export function PrizeFields({ form, setForm }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <label className="block">
        <span className="cr-lbl">tickets</span>
        <input className={inputCls} inputMode="numeric" aria-label="Tickets" value={form.tickets} onChange={(e) => setForm({ ...form, tickets: e.target.value })} />
      </label>
      <label className="block">
        <span className="cr-lbl">$ prize</span>
        <input className={inputCls} inputMode="decimal" aria-label="Dollar prize" placeholder="none" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </label>
      <label className="block">
        <span className="cr-lbl">paid as</span>
        <select className={inputCls} aria-label="Prize kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          <option value="cash">Cash</option>
          <option value="bonus">Bonus buy</option>
        </select>
      </label>
    </div>
  );
}

// A giveaway winner reveal (or its lock hold) is on the OBS overlay right now.
function giveawayOnScreen(giveaway, now) {
  const at = tsMillis(giveaway && giveaway.rolledAt);
  return !!giveaway && giveaway.status === 'rolling' && at != null && now - at < REVEAL_MS + LOCK_HOLD_MS;
}

function OpenForm({ initial }) {
  const [form, setForm] = useState(() => prizeForm(initial));
  const [follow, setFollow] = useState(true);
  const { busy, error, run } = useBallRun();
  return (
    <div className="mt-3 space-y-2">
      <PrizeFields form={form} setForm={setForm} />
      <label className="flex items-center gap-2 text-xs text-white/70">
        <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
        Followers only (mods and VIPs always in)
      </label>
      <button
        type="button"
        className="cr-btn is-go w-full"
        disabled={!!busy}
        onClick={() => run({ action: 'open', prize: prizePayload(form), requireFollow: follow })}
      >
        Open the drum
      </button>
      {error && <p className="text-xs font-mono text-red-destructive">{error}</p>}
    </div>
  );
}

function LastWinner({ round, results }) {
  const w = round.winner;
  return (
    <div>
      <p className="cr-lbl">last winning ball</p>
      <p className="mt-1 text-sm text-white-body">
        {`@${who(w)} · ${w.slotName}`} <span className="font-mono text-orange-admin">{formatMulti(w.multiplier)}</span>
      </p>
      <p className="cr-lbl mt-1">{`won ${prizeText(round.prize)}`}</p>
      <p className="mt-1 text-xs font-mono text-white/55">
        {results.posted ? 'Chat line posted.' : results.posting ? 'Posting to chat…' : results.error ? `Chat line failed: ${results.error}` : 'Chat line due after the stream delay.'}
        {results.error && (
          <button type="button" className="ml-2 underline" onClick={results.retry}>
            Retry chat line
          </button>
        )}
      </p>
    </div>
  );
}

function PrizeLine({ round, run, busy }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => prizeForm(round.prize));
  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-white-body">{prizeText(round.prize)}</p>
        <button
          type="button"
          className="cr-btn flex-none px-2"
          onClick={() => {
            setForm(prizeForm(round.prize));
            setEditing(true);
          }}
        >
          Edit prize
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2" data-cr-keep-open="">
      <PrizeFields form={form} setForm={setForm} />
      <div className="flex gap-2">
        <button type="button" className="cr-btn" onClick={() => setEditing(false)}>
          Keep
        </button>
        <button
          type="button"
          className="cr-btn is-go"
          disabled={!!busy}
          onClick={async () => {
            const { ok } = await run({ action: 'update_prize', id: round.id, prize: prizePayload(form) });
            if (ok) setEditing(false);
          }}
        >
          Save prize
        </button>
      </div>
    </div>
  );
}

function Rack({ round, run, confirm, setConfirm }) {
  const rack = round.rack || [];
  if (rack.length === 0) return <p className="cr-lbl mt-3">No balls drawn yet.</p>;
  return (
    <ol className="mt-3 space-y-1" aria-label="Rack">
      {rack.map((e) => (
        <li key={e.drawNo} className="flex items-center gap-2 text-sm">
          <span className="font-mono text-white/45">{pad2(e.drawNo)}</span>
          <span className={`min-w-0 flex-1 truncate ${e.scratched ? 'text-white/40 line-through' : 'text-white-body'}`}>
            <span>{e.slotName}</span> <span className="text-white/45">@{who(e)}</span>
          </span>
          {!e.scratched &&
            (confirm === `scratch:${e.drawNo}` ? (
              <button
                type="button"
                className="cr-btn is-go flex-none px-2"
                onClick={() => {
                  setConfirm(null);
                  run({ action: 'scratch', id: round.id, drawNo: e.drawNo });
                }}
              >
                Confirm scratch
              </button>
            ) : (
              <button type="button" className="cr-btn flex-none px-2" onClick={() => setConfirm(`scratch:${e.drawNo}`)}>
                Scratch
              </button>
            ))}
        </li>
      ))}
    </ol>
  );
}

function JustIn({ balls }) {
  const list = recentBalls(drumBalls(balls), 8);
  if (list.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="cr-lbl">just in</p>
      <ul className="mt-1 space-y-0.5">
        {list.map((b) => (
          <li key={b.id} className="flex justify-between gap-2 text-xs">
            <span className="text-white/70">{who(b)}</span>
            <span className="truncate text-white-body">{b.slotName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TwoPress({ id, confirm, setConfirm, label, confirmLabel, onConfirm, disabled }) {
  return confirm === id ? (
    <button
      type="button"
      className="cr-btn is-go"
      disabled={disabled}
      onClick={() => {
        setConfirm(null);
        onConfirm();
      }}
    >
      {confirmLabel}
    </button>
  ) : (
    <button type="button" className="cr-btn" disabled={disabled} onClick={() => setConfirm(id)}>
      {label}
    </button>
  );
}

function ActiveRound({ round, balls, giveaway, drawAnnounce }) {
  const { busy, error, run } = useBallRun();
  const [confirm, setConfirm] = useState(null);
  const now = useClock({ intervalMs: 500 });
  const drum = drumBalls(balls);
  const drawn = drawnEntries(round);
  const last = tsMillis(round.lastDrawAt);
  const ballBusy = last != null && now < last + DRAW_REVEAL_MS;
  const gvwBusy = giveawayOnScreen(giveaway, now);
  const open = round.status === 'open';

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="cr-lbl">{open ? 'drum open · !slot' : 'lineup closed'}</p>
          <p className="cr-timecode">{open ? 'OPEN' : 'CLOSED'}</p>
        </div>
        <div className="text-right">
          <p className="cr-lbl">in the drum</p>
          <p className="cr-big text-orange-admin">{drum.length}</p>
        </div>
        <div className="text-right">
          <p className="cr-lbl">drawn</p>
          <p className="cr-big text-orange-admin">{drawn.length}</p>
        </div>
      </div>
      <PrizeLine round={round} run={run} busy={busy} />
      <HuntLink round={round} />
      {open && (
        <button
          type="button"
          className="cr-btn is-go mt-3 w-full"
          disabled={!!busy || ballBusy || gvwBusy}
          onClick={() => run({ action: 'draw', id: round.id })}
        >
          {ballBusy ? 'Ball on screen…' : gvwBusy ? 'Giveaway on screen…' : 'Draw ball'}
        </button>
      )}
      <Rack round={round} run={run} confirm={confirm} setConfirm={setConfirm} />
      {open && <JustIn balls={balls} />}
      {!open && <BallPayout round={round} />}
      <div className="mt-3 flex gap-2">
        {open ? (
          <TwoPress
            id="close"
            confirm={confirm}
            setConfirm={setConfirm}
            label="Close lineup"
            confirmLabel="Confirm close"
            disabled={!!busy}
            onConfirm={() => run({ action: 'close', id: round.id })}
          />
        ) : (
          <button type="button" className="cr-btn" disabled={!!busy} onClick={() => run({ action: 'reopen', id: round.id })}>
            Reopen
          </button>
        )}
        <TwoPress
          id="cancel"
          confirm={confirm}
          setConfirm={setConfirm}
          label="Cancel round"
          confirmLabel="Confirm cancel"
          disabled={!!busy}
          onConfirm={() => run({ action: 'cancel', id: round.id })}
        />
      </div>
      {error && <p className="mt-2 text-xs font-mono text-red-destructive">{error}</p>}
      {drawAnnounce.error && (
        <p className="mt-2 text-xs font-mono text-red-destructive">
          {`Chat line failed: ${drawAnnounce.error}`}
          <button type="button" className="ml-2 underline" onClick={drawAnnounce.retry}>
            Retry chat line
          </button>
        </p>
      )}
    </div>
  );
}

// Goofer Ball in the control room (spec: Control room). Open a drum, draw
// balls, scratch, close the lineup, pay out.
export default function BallTab() {
  const cr = useControlRoom();
  const round = cr.ballRound;
  return (
    <div>
      {isActive(round) ? (
        <ActiveRound round={round} balls={cr.balls || []} giveaway={cr.giveaway} drawAnnounce={cr.ballDrawAnnounce} />
      ) : (
        <>
          {round && round.status === 'settled' && round.winner ? (
            <LastWinner round={round} results={cr.ballResults} />
          ) : (
            <>
              <p className="cr-lbl">goofer ball</p>
              <p className="cr-timecode is-quiet">IDLE</p>
              <p className="mt-2 text-sm text-white/55">No drum open.</p>
            </>
          )}
          <OpenForm key={round ? round.id : 'none'} initial={round && round.prize} />
        </>
      )}
      <div className="mt-4 flex justify-end">
        <Link to="/gamba/ball" className="cr-lbl hover:text-white-body">
          CH 42 ↗
        </Link>
      </div>
    </div>
  );
}
```

`BallTab` imports `BallPayout` and `HuntLink`, which Task 16 creates. Create minimal placeholder files now so this task builds on its own. Task 16 replaces them, and their tests mock them:

`src/components/controlRoom/BallPayout.js`:

```js
// Replaced in Task 16 (payout table).
export default function BallPayout() {
  return null;
}
```

`src/components/controlRoom/HuntLink.js`:

```js
// Replaced in Task 16 (link a communityhunts hunt).
export default function HuntLink() {
  return null;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="useBallAnnounce|BallTab|panelStatus|ControlRoom|storage|PanelChrome|ControlRoomContext"`
Expected: PASS.

In the "open: counts…" test, `getByText('2')` must match only the drum count. If "drawn" also shows `1`, it's fine; but if any other element renders exactly `2`, scope the query with `within`. Adjust the test, not the component.

- [ ] **Step 8: Commit**

```bash
git add src/components/controlRoom src/contexts/ControlRoomContext.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(control-room): Ball tab to open, draw, scratch and close; draw chat lines"
```

---

### Task 16: Control room payout: link a hunt, payout table, pay out

**Files:**

- Replace: `src/components/controlRoom/HuntLink.js`, `src/components/controlRoom/BallPayout.js`
- Test: `src/components/controlRoom/__tests__/BallPayout.test.js`

**Interfaces:**

- Consumes: `useCommunityHunts()` (`{ live, recent, loading, error }`, polls `/api/communityhunts?view=overview`); `useBallHunt` (Task 9); `resultRows` and `winnerOf` from `src/utils/ballResults.js`; `formatMulti`, `prizeText` and `who` (Task 8); `useBallRun` (Task 15); `HoldButton` from `src/components/onAir/HoldButton.js` (a quick press arms it, and a second press confirms).
- Produces:
  - `<HuntLink round />`: shows the linked hunt, or the picker (live and recent hunts) plus Unlink.
  - `<BallPayout round />`, for a closed round:
    - a row per drawn ball, with the hunt multiplier or an input;
    - a duplicate-row picker;
    - **Preview** (`preview_settle`), then a hold-to-confirm **Pay out** (`settle`) with the overrides.

- [ ] **Step 1: Write the failing test**

Create `src/components/controlRoom/__tests__/BallPayout.test.js`:

```js
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BallPayout from '../BallPayout';
import HuntLink from '../HuntLink';
import { ballAction } from '../ballApi';
import useBallHunt from '../../../hooks/useBallHunt';
import useCommunityHunts from '../../../hooks/useCommunityHunts';

jest.mock('../ballApi', () => ({ ...jest.requireActual('../ballApi'), ballAction: jest.fn() }));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));
jest.mock('../../../hooks/useBallHunt', () => jest.fn());
jest.mock('../../../hooks/useCommunityHunts', () => jest.fn());

const at = (ms) => ({ toMillis: () => ms });
const ROUND = {
  id: 'r1',
  status: 'closed',
  huntId: 'h1',
  prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
  rack: [
    { drawNo: 1, twitchId: 'a', displayName: 'CoolGuy', slotName: 'Gates of Olympus', drawnAt: at(1), scratched: false },
    { drawNo: 2, twitchId: 'b', displayName: 'SugarFan', slotName: 'Sugar Rush 1000', drawnAt: at(2), scratched: false },
  ],
};

beforeEach(() => {
  useBallHunt.mockReturnValue({
    hunt: { bonuses: [{ slot: 'Gates of Olympus', multiplier: 412, win: 412, bet: 1 }, { slot: 'Sugar Rush 1000', multiplier: null }] },
    stale: false,
    loading: false,
  });
  useCommunityHunts.mockReturnValue({ live: { id: 'h9', status: 'live', bonusCount: 10, startedAt: '2026-10-09T01:00:00Z' }, recent: [], loading: false, error: null });
  ballAction.mockResolvedValue({ ok: true, status: 200, data: { ok: true } });
});

test('rows show hunt results; a pending row takes a typed multiplier', async () => {
  render(<BallPayout round={ROUND} />);
  expect(screen.getByText('412x')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Multiplier for ball 2'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  await waitFor(() =>
    expect(ballAction).toHaveBeenCalledWith({ action: 'preview_settle', id: 'r1', overrides: { 2: { multiplier: '500', win: '', bonusIndex: null } } })
  );
});

test('preview names the winner; pay out sends the same overrides', async () => {
  ballAction.mockResolvedValueOnce({
    ok: true,
    status: 200,
    data: { ok: true, winner: { drawNo: 1, displayName: 'CoolGuy', slotName: 'Gates of Olympus', multiplier: 412 }, huntError: null },
  });
  render(<BallPayout round={ROUND} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  expect(await screen.findByText('@CoolGuy · Gates of Olympus · 412x wins 200 tickets + $5')).toBeTruthy();
  const pay = screen.getByRole('button', { name: 'Hold to pay out' });
  fireEvent.click(pay);
  fireEvent.click(screen.getByRole('button', { name: 'Press again to pay out' }));
  await waitFor(() => expect(ballAction).toHaveBeenLastCalledWith({ action: 'settle', id: 'r1', overrides: {} }));
});

test('no linked hunt: everything is typed', () => {
  useBallHunt.mockReturnValue({ hunt: null, stale: false, loading: false });
  render(<BallPayout round={{ ...ROUND, huntId: null }} />);
  expect(screen.getByLabelText('Multiplier for ball 1')).toBeTruthy();
  expect(screen.getByText('No hunt linked: type each multiplier.')).toBeTruthy();
});

test('HuntLink: pick the live hunt, or unlink', async () => {
  const { rerender } = render(<HuntLink round={{ ...ROUND, huntId: null }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Link hunt' }));
  fireEvent.click(screen.getByRole('button', { name: /LIVE · 10 bonuses/ }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'link_hunt', id: 'r1', huntId: 'h9' }));
  rerender(<HuntLink round={ROUND} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Unlink' }).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
  await waitFor(() => expect(ballAction).toHaveBeenLastCalledWith({ action: 'link_hunt', id: 'r1', huntId: null }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=BallPayout`
Expected: FAIL (the placeholders render nothing).

- [ ] **Step 3: Write `HuntLink`**

Replace `src/components/controlRoom/HuntLink.js`:

```js
import { useState } from 'react';
import useCommunityHunts from '../../hooks/useCommunityHunts';
import { useBallRun } from './ballApi';

function huntLabel(h) {
  const when = h.startedAt ? new Date(h.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  return `${h.status === 'live' ? 'LIVE · ' : ''}${h.bonusCount ?? 0} bonuses${when ? ` · ${when}` : ''}`;
}

function Picker({ onPick, busy }) {
  const { live, recent, loading, error } = useCommunityHunts();
  const list = [live, ...(recent || []).filter((h) => !live || h.id !== live.id)].filter(Boolean).slice(0, 6);
  if (loading) return <p className="cr-lbl mt-2">Tuning…</p>;
  if (error && list.length === 0) return <p className="mt-2 text-xs font-mono text-red-destructive">communityhunts.gg is unavailable.</p>;
  return (
    <ul className="mt-2 space-y-1">
      {list.map((h) => (
        <li key={h.id}>
          <button type="button" className="cr-btn w-full justify-start" disabled={busy} onClick={() => onPick(h.id)}>
            {huntLabel(h)}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Which communityhunts hunt the live rack and the payout read (spec: Results
// and payout). Linkable any time while the round is open or closed.
export default function HuntLink({ round }) {
  const [picking, setPicking] = useState(false);
  const { busy, error, run } = useBallRun();
  const pick = async (huntId) => {
    const { ok } = await run({ action: 'link_hunt', id: round.id, huntId });
    if (ok) setPicking(false);
  };
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="cr-lbl">{round.huntId ? `hunt · ${round.huntId}` : 'no hunt linked'}</p>
        <div className="flex gap-1">
          {round.huntId && (
            <button type="button" className="cr-btn flex-none px-2" disabled={!!busy} onClick={() => pick(null)}>
              Unlink
            </button>
          )}
          <button type="button" className="cr-btn flex-none px-2" onClick={() => setPicking((p) => !p)}>
            {round.huntId ? 'Change' : 'Link hunt'}
          </button>
        </div>
      </div>
      {picking && <Picker onPick={pick} busy={!!busy} />}
      {error && <p className="mt-1 text-xs font-mono text-red-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Write `BallPayout`**

Replace `src/components/controlRoom/BallPayout.js`:

```js
import { useMemo, useState } from 'react';
import HoldButton from '../onAir/HoldButton';
import useBallHunt from '../../hooks/useBallHunt';
import { resultRows } from '../../utils/ballResults';
import { formatMulti, pad2, prizeText, who } from '../../utils/ball';
import { inputCls } from '../admin/predictions/shared';
import { useBallRun } from './ballApi';

const EMPTY = { multiplier: '', win: '', bonusIndex: null };

// Only rows staff actually touched go to the server.
function overridesFrom(edits) {
  const out = {};
  for (const [drawNo, e] of Object.entries(edits)) {
    if (e.multiplier !== '' || e.bonusIndex != null) out[drawNo] = e;
  }
  return out;
}

// The payout table for a closed round (spec: Results and payout): the hunt's
// numbers per drawn ball, typed numbers where it has none, then Preview and
// a hold-to-confirm Pay out. The server re-reads the hunt and re-ranks.
export default function BallPayout({ round }) {
  const { hunt, stale } = useBallHunt(round.huntId, { enabled: !!round.huntId });
  const [edits, setEdits] = useState({});
  const [preview, setPreview] = useState(null);
  const { busy, error, run } = useBallRun();
  const overrides = useMemo(() => overridesFrom(edits), [edits]);
  const rows = resultRows(round, (hunt && hunt.bonuses) || [], overrides);
  const edit = (drawNo, patch) => {
    setPreview(null);
    setEdits((all) => ({ ...all, [drawNo]: { ...EMPTY, ...all[drawNo], ...patch } }));
  };

  const doPreview = async () => {
    const { ok, data } = await run({ action: 'preview_settle', id: round.id, overrides });
    if (ok) setPreview(data);
  };

  return (
    <div className="mt-3">
      <p className="cr-lbl">payout</p>
      {!round.huntId && <p className="mt-1 text-xs text-white/55">No hunt linked: type each multiplier.</p>}
      {stale && <p className="mt-1 text-xs font-mono text-orange-admin">Hunt numbers are stale (communityhunts.gg not answering).</p>}
      <table className="mt-2 w-full text-sm">
        <tbody>
          {rows.map((r) => {
            const e = edits[r.drawNo] || EMPTY;
            const fromHunt = r.source === 'hunt';
            return (
              <tr key={r.drawNo} className="border-t border-white/10">
                <td className="py-1 pr-2 font-mono text-white/45">{pad2(r.drawNo)}</td>
                <td className="py-1 pr-2">
                  <span className="block truncate text-white-body">{r.slotName}</span>
                  <span className="text-xs text-white/45">@{who(r)}</span>
                  {r.matchCount > 1 && (
                    <select
                      className={`${inputCls} mt-1`}
                      aria-label={`Hunt row for ball ${r.drawNo}`}
                      value={e.bonusIndex ?? 0}
                      onChange={(ev) => edit(r.drawNo, { bonusIndex: Number(ev.target.value) })}
                    >
                      {Array.from({ length: r.matchCount }, (_, i) => (
                        <option key={i} value={i}>{`Hunt row ${i + 1}`}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="w-24 py-1 text-right">
                  {fromHunt && e.multiplier === '' ? (
                    <span className="font-mono text-orange-admin">{formatMulti(r.multiplier)}</span>
                  ) : (
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      placeholder="multi"
                      aria-label={`Multiplier for ball ${r.drawNo}`}
                      value={e.multiplier}
                      onChange={(ev) => edit(r.drawNo, { multiplier: ev.target.value })}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" className="cr-btn mt-3 w-full" disabled={!!busy} onClick={doPreview}>
        Preview
      </button>
      {preview && preview.winner && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-white-body">
            {`@${who(preview.winner)} · ${preview.winner.slotName} · ${formatMulti(preview.winner.multiplier)} wins ${prizeText(round.prize)}`}
          </p>
          {preview.huntError && <p className="text-xs font-mono text-orange-admin">{`Hunt unavailable (${preview.huntError}); typed numbers only.`}</p>}
          <HoldButton
            size="sm"
            variant="winner"
            idleLabel="Hold to pay out"
            armedLabel="Press again to pay out"
            disabled={!!busy}
            onConfirm={() => run({ action: 'settle', id: round.id, overrides })}
          />
        </div>
      )}
      {preview && !preview.winner && <p className="mt-2 text-xs font-mono text-red-destructive">No drawn ball has a result yet.</p>}
      {error && <p className="mt-2 text-xs font-mono text-red-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="BallPayout|BallTab|onAirContract"`
Expected: PASS.

- [ ] **Step 6: Try the whole control room flow locally**

Run `npm start` (and `vercel dev` if you want the real API). Sign in at `/admin`, open the control room on `/` and step through the Ball tab:

1. Open a drum.
2. Watch `/ball-overlay` in another tab.
3. Draw, which should be refused while the drum is empty.
4. Close, then link a hunt.
5. Preview.

Real entries need EventSub in production. Locally, seed balls in the Firestore console under `ball_rounds/{id}/balls` (the fields from the Task 5 test).

- [ ] **Step 7: Commit**

```bash
git add src/components/controlRoom
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(control-room): link a hunt, payout table, hold to pay out"
```

---

### Task 17: CH 42 page: data hook, slot finder, the front, fixtures

**Files:**

- Create: `src/hooks/useBallData.js`, `src/components/ball/SlotFinder.js`, `src/components/ball/BallFront.js`, `src/components/ball/BallChannel.js`
- Modify: `src/components/ball/ballFixtures.js` (add `frontFixture`)
- Test: `src/components/ball/__tests__/BallFront.test.js`

**Interfaces:**

- Consumes:
  - Hooks: `useBallRound`, `useBallsFeed`, `useBallHunt` and `usePageVisible` (Task 9); `useTwitchAuth()` (`{ twitchUser: { twitchId } }`); `useSlotCatalog()` (`{ slots: [{ id, name, thumbnail, bonusBuy }], loading, error }`); `usePrefersReducedMotion` from `src/hooks/useClock.js`.
  - Helpers: `drawnEntries`, `drumBalls`, `formatMulti`, `isActive`, `leaderRow`, `liveRows`, `pad2`, `prizeText`, `takenSlots` and `who` (Task 8); `settledRows` (Task 3); `tsMillis`.
  - Components: `ChannelSet`, `DrumRig`, and the `Panel` and `MONO` On Air primitives.
- Produces:
  - `useBallData() → { round, roundError, balls, ballsReady, hunt, stale, me, past, pastLoading, pastError, hasMore, loadMore }`.
    - The balls listener runs only while a round is active **and** the tab is visible.
    - Past rounds come from `status == 'settled'` ordered by `settledAt desc`, 20 per page (this uses the index from Task 6).
  - `<SlotFinder taken />`: catalogue search (bonus-buy slots only), taken slots greyed with their holder, and a **Copy !slot** button.
  - `<BallFront … onLoadMore still />`, pure.
  - `<BallChannel />`: a `?fixture=` (dev) or live wrapper.
  - `frontFixture(key, now)` for `open|rack|closed|settled|offair|empty|loading`.

- [ ] **Step 1: Add the CH 42 fixtures**

Append to `src/components/ball/ballFixtures.js`:

```js
function pastRound(now, i, multi, prize) {
  const day = now - i * 86_400_000;
  const rack = fixtureRack(day, 3);
  return {
    id: `fx-past-${i}`,
    status: 'settled',
    prize,
    rack,
    settledAt: at(day),
    results: {
      1: { multiplier: multi, win: multi, bet: 1, source: 'hunt' },
      2: { multiplier: 12, win: 12, bet: 1, source: 'hunt' },
      3: { multiplier: 3.5, win: 3.5, bet: 1, source: 'manual' },
    },
    winner: { ...rack[0], multiplier: multi, win: multi, redemptionId: null },
  };
}

export function fixturePast(now) {
  return [
    pastRound(now, 1, 412, FIXTURE_PRIZE),
    pastRound(now, 3, 96, { tickets: 300, prize: null }),
    pastRound(now, 6, 1204, { tickets: 200, prize: { kind: 'bonus', amount: 10 } }),
  ];
}

// CH 42 (BallFront props) for /gamba/ball?fixture=…
export function frontFixture(key, now) {
  const base = { roundError: false, hunt: null, stale: false, me: null, past: fixturePast(now), pastLoading: false, pastError: false, hasMore: false, ballsReady: true, still: true };
  if (key === 'open') return { ...base, round: fixtureRound(now, { rack: fixtureRack(now, 2) }), balls: fixtureBalls(now, { drawn: 2 }), me: 'fx4' };
  if (key === 'rack') return { ...base, round: fixtureRound(now, { huntId: 'fx-hunt', rack: fixtureRack(now, 4) }), balls: fixtureBalls(now, { drawn: 4 }), hunt: FIXTURE_HUNT };
  if (key === 'closed') {
    return { ...base, round: fixtureRound(now, { status: 'closed', huntId: 'fx-hunt', rack: fixtureRack(now, 4) }), balls: fixtureBalls(now, { drawn: 4 }), hunt: FIXTURE_HUNT };
  }
  if (key === 'settled' || key === 'offair') return { ...base, round: base.past[0], balls: [] };
  if (key === 'empty') return { ...base, round: null, balls: [], past: [] };
  if (key === 'loading') return { ...base, round: undefined, balls: [], past: [], pastLoading: true };
  return null;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/components/ball/__tests__/BallFront.test.js`:

```js
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BallFront from '../BallFront';
import { frontFixture } from '../ballFixtures';
import useSlotCatalog from '../../../hooks/useSlotCatalog';

jest.mock('../../../hooks/useSlotCatalog', () => jest.fn());

const NOW = Date.UTC(2026, 9, 9, 3);
const CATALOG = [
  { id: 'fx-slot-0', name: 'Gates of Olympus', thumbnail: null, bonusBuy: true },
  { id: 'gates-1000', name: 'Gates of Olympus 1000', thumbnail: null, bonusBuy: true },
  { id: 'book', name: 'Book of Dead', thumbnail: null, bonusBuy: false },
];
const show = (key, extra = {}) => render(<BallFront {...frontFixture(key, NOW)} onLoadMore={jest.fn()} {...extra} />);

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  useSlotCatalog.mockReturnValue({ slots: CATALOG, loading: false, error: null });
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
});

test('loading', () => {
  show('loading');
  expect(screen.getByText('Tuning to Channel 42…')).toBeTruthy();
});

test('open: the strip, call one in, your ball and the drum', async () => {
  show('open');
  expect(screen.getByText(/Drum open/)).toBeTruthy();
  expect(screen.getByText('Top multi wins 200 tickets + $5')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search slots'), { target: { value: 'gates' } });
  expect(screen.getByText('Taken by @CoolGuy')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Copy !slot' }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('!slot Gates of Olympus 1000'));
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search slots'), { target: { value: 'book' } });
  expect(screen.queryByText('Book of Dead')).toBeNull();
  const mine = within(screen.getByRole('region', { name: 'Your ball' }));
  expect(mine.getByText('Big Bass Bonanza')).toBeTruthy();
  expect(mine.getByText('In the drum')).toBeTruthy();
  const drum = within(screen.getByRole('region', { name: 'In the drum' }));
  fireEvent.change(drum.getByLabelText('Find a ball'), { target: { value: 'reel' } });
  expect(drum.getByText('Zeus vs Hades')).toBeTruthy();
  expect(drum.queryByText('Le Bandit')).toBeNull();
});

test('rack: live multipliers with the leader marked', () => {
  show('rack');
  const rack = within(screen.getByRole('region', { name: "Tonight's rack" }));
  expect(rack.getByText('412x')).toBeTruthy();
  expect(rack.getByText('Live from the hunt · 60s')).toBeTruthy();
  expect(rack.getByText('Leader')).toBeTruthy();
  expect(rack.getByText('—')).toBeTruthy();
});

test('off air: the last winner, no finder, past draws expand', () => {
  show('offair');
  expect(screen.getByText('Last winning ball: Gates of Olympus · 412x · @CoolGuy')).toBeTruthy();
  expect(screen.getByText("Drum's closed. Next draw whenever the drum opens on stream.")).toBeTruthy();
  expect(screen.queryByLabelText('Search slots')).toBeNull();
  const past = within(screen.getByRole('region', { name: 'Past draws' }));
  expect(past.getAllByRole('button', { name: /Show the rack/ })).toHaveLength(3);
  fireEvent.click(past.getAllByRole('button', { name: /Show the rack/ })[0]);
  expect(past.getByText('01 Gates of Olympus 412x')).toBeTruthy();
});

test('empty and load more', () => {
  const { unmount } = show('empty');
  expect(screen.getByText('No draws yet.')).toBeTruthy();
  unmount();
  const onLoadMore = jest.fn();
  render(<BallFront {...frontFixture('offair', NOW)} hasMore onLoadMore={onLoadMore} />);
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(onLoadMore).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=BallFront`
Expected: FAIL with "Cannot find module '../BallFront'".

- [ ] **Step 4: Write the slot finder**

Create `src/components/ball/SlotFinder.js`:

```js
import { useMemo, useState } from 'react';
import useSlotCatalog from '../../hooks/useSlotCatalog';
import { MONO } from '../onAir/classes';
import './ball.css';

const MAX_RESULTS = 8;

// "Call one in" (spec: Site page): find the exact catalogue name, see who
// holds it, copy the !slot line for Twitch chat. Bonus-buy slots only.
export default function SlotFinder({ taken }) {
  const { slots, loading, error } = useSlotCatalog();
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState(null);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return slots
      .filter((s) => s.bonusBuy && s.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
      .slice(0, MAX_RESULTS);
  }, [q, slots]);

  const copy = async (slot) => {
    try {
      await navigator.clipboard.writeText(`!slot ${slot.name}`);
      setCopied(slot.id);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="rounded-[6px] bg-onair-paper p-3 text-onair-paper-ink shadow-onair-card">
      <h3 className="font-display text-[1.25rem] uppercase tracking-wide">Call one in</h3>
      <label className="mt-2 block">
        <span className="sr-only">Search slots</span>
        <input
          type="search"
          value={q}
          placeholder="Search slots…"
          onChange={(e) => {
            setQ(e.target.value);
            setCopied(null);
          }}
          className="w-full border-2 border-onair-paper-ink bg-white px-2.5 py-1.5 font-onair-mono text-[0.8125rem] text-onair-paper-ink placeholder:text-onair-paper-ink/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-onair-winner"
        />
      </label>
      {loading && <p className={`${MONO} mt-2 text-[0.625rem] tracking-[0.15em]`}>Loading the slot list…</p>}
      {error && <p className="mt-2 text-[0.8125rem]">The slot list is down. Type the name in chat and the bot will help.</p>}
      <ul className="mt-2 divide-y divide-dashed divide-onair-paper-ink/25">
        {results.map((s) => {
          const t = taken.get(s.id);
          return (
            <li key={s.id} className={`grid grid-cols-[1.75rem_1fr_auto] items-center gap-2 py-1.5 ${t ? 'opacity-55' : ''}`}>
              {s.thumbnail ? <img src={s.thumbnail} alt="" className="h-5 w-7 rounded-[2px] object-cover" /> : <span className="gb-decal h-5 w-7 rounded-[2px]" />}
              <span className="min-w-0 truncate font-onair-mono text-[0.75rem] font-bold">
                {s.name}
                {t && <span className="block text-[0.625rem] font-normal">{t.scratched ? 'Scratched tonight' : `Taken by @${t.holder}`}</span>}
              </span>
              {t ? (
                <span className={`${MONO} text-[0.625rem] tracking-[0.15em]`}>Taken</span>
              ) : (
                <button
                  type="button"
                  onClick={() => copy(s)}
                  className={`${MONO} rounded-[3px] bg-onair-winner px-2 py-1 text-[0.625rem] font-bold tracking-[0.15em] text-onair-winner-ink`}
                >
                  {copied === s.id ? 'Copied' : 'Copy !slot'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className={`${MONO} mt-2 text-[0.625rem] tracking-[0.15em] text-onair-paper-ink/70`}>Only slots with a bonus buy · paste it in Twitch chat</p>
    </div>
  );
}
```

- [ ] **Step 5: Write the front**

Create `src/components/ball/BallFront.js`:

```js
import { useState } from 'react';
import Panel from '../onAir/Panel';
import { MONO } from '../onAir/classes';
import ChannelSet from './ChannelSet';
import DrumRig from './DrumRig';
import SlotFinder from './SlotFinder';
import { settledRows } from '../../utils/ballResults';
import { drawnEntries, drumBalls, formatMulti, isActive, leaderRow, liveRows, pad2, prizeText, takenSlots, who } from '../../utils/ball';
import { tsMillis } from '../../utils/giveaway';
import './ball.css';

const LABEL = `${MONO} text-[0.625rem] tracking-[0.2em] text-onair-ink-5`;

function dayLabel(ts) {
  const ms = tsMillis(ts);
  return ms == null ? '—' : new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// A panel that folds away below lg (phones see the essentials first).
function Fold({ id, title, aside, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Panel as="section" aria-labelledby={id} className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-[1.125rem] font-extrabold">
          {title}
        </h2>
        {aside && <span className={LABEL}>{aside}</span>}
      </div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${MONO} mt-2 text-[0.6875rem] tracking-[0.18em] text-onair-ink-4 lg:hidden`}>
        {open ? 'Hide' : 'Show'}
      </button>
      <div className={open ? 'mt-3 block' : 'mt-3 hidden lg:block'}>{children}</div>
    </Panel>
  );
}

function ActiveFacts({ round, drum }) {
  return (
    <>
      <p className="mt-3">
        <span className={`${MONO} inline-flex items-center gap-1.5 rounded-full bg-onair-live px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-[0.18em] text-white`}>
          ● {round.status === 'open' ? 'Drum open' : 'Lineup closed'}
        </span>
      </p>
      <p className="mt-2 font-display text-[clamp(2.5rem,6vw,4rem)] leading-none text-white">{drum.length}</p>
      <p className={`${MONO} text-[0.6875rem] font-bold tracking-[0.2em] text-onair-wgoof-title-dim`}>
        {`Balls in the drum · ${drawnEntries(round).length} drawn`}
      </p>
      <p className={`${MONO} mt-2 inline-block bg-onair-paper px-2.5 py-1 text-[0.6875rem] font-bold tracking-[0.15em] text-onair-paper-ink`}>
        {`Top multi wins ${prizeText(round.prize)}`}
      </p>
    </>
  );
}

function SetStrip({ round, balls, still, lastWinner, children }) {
  const active = isActive(round);
  const drum = drumBalls(balls);
  return (
    <section aria-labelledby="ball-title" className="relative overflow-hidden rounded-onair-card shadow-onair-card">
      <ChannelSet fine={null} title={false} bug={false} live={false} />
      <div className="relative flex flex-wrap items-center gap-5 p-5 sm:p-6">
        <DrumRig balls={drum} count={drum.length} still={still} className="w-28 shrink-0 sm:w-40" />
        <div className="min-w-[12rem] flex-1">
          <h2 id="ball-title" className="gb-title font-display text-[clamp(1.75rem,4vw,3rem)] uppercase leading-none">
            Goofer Ball
          </h2>
          <p className={`${MONO} mt-1 text-[0.6875rem] font-bold tracking-[0.28em] text-onair-wgoof-title-dim`}>WGOOF · Channel 42 · Nightly draw</p>
          {active ? (
            <ActiveFacts round={round} drum={drum} />
          ) : (
            <>
              {lastWinner && (
                <p className="mt-3 text-[0.9375rem] font-bold text-onair-wgoof-title">
                  {`Last winning ball: ${lastWinner.winner.slotName} · ${formatMulti(lastWinner.winner.multiplier)} · @${who(lastWinner.winner)}`}
                </p>
              )}
              <p className="mt-2 text-[0.9375rem] text-onair-wgoof-title">Drum's closed. Next draw whenever the drum opens on stream.</p>
            </>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

const BALL_STATUS = { drum: 'In the drum', drawn: 'On the rack', scratched: 'Scratched, call another slot' };

function YourBall({ ball }) {
  return (
    <Panel as="section" aria-labelledby="ball-mine" className="p-4 ring-1 ring-onair-signal/40">
      <h2 id="ball-mine" className="text-[1.125rem] font-extrabold">
        Your ball
      </h2>
      <p className="mt-2 text-[0.9375rem] font-bold">{ball.slotName}</p>
      <p className={`${MONO} mt-1 text-[0.6875rem] tracking-[0.18em] text-onair-signal-light`}>
        {ball.status === 'drawn' && ball.drawNo ? `On the rack · Ball ${pad2(ball.drawNo)}` : BALL_STATUS[ball.status] || BALL_STATUS.drum}
      </p>
    </Panel>
  );
}

function DrumList({ balls, me }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const list = needle
    ? balls.filter((b) => `${who(b)} ${b.slotName}`.toLowerCase().includes(needle))
    : balls;
  return (
    <Fold id="ball-drum" title="In the drum" aside={`${balls.length} called`}>
      <label className="block">
        <span className="sr-only">Find a ball</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find my ball…"
          className="w-full rounded-onair-tile border border-white/10 bg-transparent px-3 py-2 font-onair-mono text-[0.75rem] text-onair-ink-1 placeholder:text-onair-ink-5"
        />
      </label>
      <ul className="mt-2">
        {list.map((b) => (
          <li key={b.id} className={`flex items-center gap-3 border-t border-white/5 px-1 py-1.5 ${b.twitchId === me ? 'rounded-onair-tile bg-onair-signal/10' : ''}`}>
            <span className="gb-ball h-4 w-4 shrink-0 rounded-full" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[0.875rem] font-bold">
              {b.slotName}
              <span className="block font-onair-mono text-[0.6875rem] font-normal text-onair-viewer-light">@{who(b)}</span>
            </span>
            {b.twitchId === me && <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-signal`}>Your ball</span>}
            {b.twitchId !== me && b.status === 'drawn' && <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-winner-light`}>On the rack</span>}
          </li>
        ))}
      </ul>
    </Fold>
  );
}

function RackPanel({ round, hunt, stale }) {
  const rows = liveRows(round, hunt);
  const leader = leaderRow(rows);
  const aside = round.huntId ? (stale ? 'Stale · retrying' : 'Live from the hunt · 60s') : 'No hunt linked yet';
  return (
    <Panel as="section" aria-labelledby="ball-rack" className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ball-rack" className="text-[1.125rem] font-extrabold">
          Tonight's rack
        </h2>
        <span className={LABEL}>{aside}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-[0.875rem] text-onair-ink-4">No balls drawn yet.</p>
      ) : (
        <ol className="mt-2">
          {rows.map((r) => (
            <li key={r.drawNo} className="flex items-center gap-3 border-t border-white/5 py-1.5">
              <span className="gb-ball flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-onair-mono text-[0.625rem] font-bold text-onair-paper-ink">{pad2(r.drawNo)}</span>
              <span className="min-w-0 flex-1 truncate text-[0.875rem] font-bold">
                {r.slotName}
                <span className="block font-onair-mono text-[0.6875rem] font-normal text-onair-viewer-light">@{who(r)}</span>
              </span>
              {leader && leader.drawNo === r.drawNo && <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-winner-light`}>Leader</span>}
              <span className={`font-display text-[1.25rem] ${leader && leader.drawNo === r.drawNo ? 'text-onair-winner' : 'text-onair-ink-1'}`}>{formatMulti(r.multiplier)}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function PastRow({ round }) {
  const [open, setOpen] = useState(false);
  const w = round.winner;
  const day = dayLabel(round.settledAt);
  return (
    <li className="border-t border-white/5 py-2">
      <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
        <span className={`${MONO} text-[0.6875rem] tracking-[0.15em] text-onair-ink-4`}>{day}</span>
        <span className="min-w-0 truncate text-[0.875rem] font-bold">
          {w.slotName}
          <span className="block font-onair-mono text-[0.6875rem] font-normal text-onair-viewer-light">{`@${who(w)} · ${prizeText(round.prize)}`}</span>
        </span>
        <span className="font-display text-[1.25rem] text-onair-winner-warm">{formatMulti(w.multiplier)}</span>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Show the rack for ${day}`}
        onClick={() => setOpen((o) => !o)}
        className={`${MONO} mt-1 text-[0.625rem] tracking-[0.18em] text-onair-ink-4`}
      >
        {open ? 'Hide rack' : 'Rack'}
      </button>
      {open && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {settledRows(round).map((r) => (
            <li key={r.drawNo} className={`${MONO} rounded-full bg-white/5 px-2.5 py-1 text-[0.625rem] tracking-[0.15em] text-onair-ink-3`}>
              {`${pad2(r.drawNo)} ${r.slotName} ${formatMulti(r.multiplier)}`}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PastDraws({ past, loading, error, hasMore, onLoadMore }) {
  const settled = past.filter((r) => r.winner);
  return (
    <Fold id="ball-past" title="Past draws" aside="Winning balls">
      {settled.length === 0 && !loading && <p className="text-[0.875rem] text-onair-ink-4">{error ? 'No signal from the archive.' : 'No draws yet.'}</p>}
      <ul>
        {settled.map((r) => (
          <PastRow key={r.id} round={r} />
        ))}
      </ul>
      {hasMore && (
        <button type="button" onClick={onLoadMore} className={`${MONO} mt-3 text-[0.6875rem] tracking-[0.18em] text-onair-ink-3`}>
          Load more
        </button>
      )}
    </Fold>
  );
}

// CH 42 · Goofer Ball (spec: Site page). Pure: data comes in as props from
// useBallData (or a fixture).
export default function BallFront({ round, balls = [], hunt = null, stale = false, me = null, past = [], pastLoading = false, pastError = false, hasMore = false, onLoadMore, still = false }) {
  if (round === undefined) {
    return (
      <p role="status" className={`${MONO} px-4 py-16 text-center text-xs font-bold tracking-[0.25em] text-onair-ink-3 motion-safe:animate-pulse`}>
        Tuning to Channel 42…
      </p>
    );
  }
  const active = isActive(round);
  const lastWinner = (round && round.status === 'settled' && round.winner ? round : null) || past.find((r) => r.winner) || null;
  const mine = active && me ? balls.find((b) => b.twitchId === me) : null;
  return (
    <div className="space-y-4 font-onair text-onair-ink-1">
      <SetStrip round={round} balls={active ? balls : []} still={still} lastWinner={lastWinner}>
        {active && round.status === 'open' && (
          <div className="w-full lg:w-[24rem]">
            <SlotFinder taken={takenSlots(round, balls)} />
          </div>
        )}
      </SetStrip>
      {mine && <YourBall ball={mine} />}
      {active && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RackPanel round={round} hunt={hunt} stale={stale} />
          <DrumList balls={balls} me={me} />
        </div>
      )}
      <PastDraws past={past} loading={pastLoading} error={pastError} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
}
```

- [ ] **Step 6: Write the data hook and the channel wrapper**

Create `src/hooks/useBallData.js`:

```js
import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, limit as fLimit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import useBallRound from './useBallRound';
import useBallsFeed from './useBallsFeed';
import useBallHunt from './useBallHunt';
import usePageVisible from './usePageVisible';
import { isActive } from '../utils/ball';

const PAGE = 20;

// Everything CH 42 reads (spec: Site page): the newest round, its balls while
// a drum is active and the tab is visible, the linked hunt's 60s poll, and
// settled rounds a page at a time. The archive reads round docs only.
export default function useBallData() {
  const visible = usePageVisible();
  const { round, error } = useBallRound();
  const active = isActive(round);
  const { balls, ready } = useBallsFeed(round ? round.id : null, { enabled: active && visible });
  const { hunt, stale } = useBallHunt(round ? round.huntId : null, { enabled: active });
  const auth = useTwitchAuth();
  const me = (auth && auth.twitchUser && auth.twitchUser.twitchId) || null;
  const [past, setPast] = useState({ rounds: [], loading: true, more: false, cursor: null, error: false });

  const loadPast = useCallback(async (cursor = null) => {
    setPast((p) => ({ ...p, loading: true }));
    try {
      const constraints = [where('status', '==', 'settled'), orderBy('settledAt', 'desc')];
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(fLimit(PAGE));
      const snap = await getDocs(query(collection(db, 'ball_rounds'), ...constraints));
      const rounds = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPast((p) => ({
        rounds: cursor ? [...p.rounds, ...rounds] : rounds,
        loading: false,
        more: snap.docs.length === PAGE,
        cursor: snap.docs[snap.docs.length - 1] || p.cursor,
        error: false,
      }));
    } catch {
      setPast((p) => ({ ...p, loading: false, error: true }));
    }
  }, []);

  // A settle moves the newest round into the archive: reload page one.
  const settledId = round && round.status === 'settled' ? round.id : null;
  useEffect(() => {
    loadPast(null);
  }, [loadPast, settledId]);

  return {
    round,
    roundError: error,
    balls,
    ballsReady: ready,
    hunt,
    stale,
    me,
    past: past.rounds,
    pastLoading: past.loading,
    pastError: past.error,
    hasMore: past.more,
    loadMore: () => loadPast(past.cursor),
  };
}
```

Create `src/components/ball/BallChannel.js`:

```js
import { useState } from 'react';
import BallFront from './BallFront';
import useBallData from '../../hooks/useBallData';
import { usePrefersReducedMotion } from '../../hooks/useClock';

let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /gamba/ball?fixture=open|rack|closed|settled|offair|empty|loading.
  // Webpack drops this branch, and the fixtures with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    return key ? require('./ballFixtures').frontFixture(key, Date.now()) : null;
  };
}

function LiveChannel() {
  const data = useBallData();
  const still = usePrefersReducedMotion();
  return <BallFront {...data} onLoadMore={data.loadMore} still={still} />;
}

// CH 42 in the Gamba tuner.
export default function BallChannel() {
  const [fixture] = useState(readFixture);
  return fixture ? <BallFront {...fixture} onLoadMore={() => {}} /> : <LiveChannel />;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="BallFront|components/ball|onAirContract"`
Expected: PASS. In the `open` test, the fixture viewer `fx4` is NightOwl with Big Bass Bonanza, and the reel search hits ReelRat (Zeus vs Hades). If a name in `ballFixtures.js` differs, fix the fixture, not the test.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useBallData.js src/components/ball
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(ball): CH 42 page with the drum, slot finder, your ball, rack and past draws"
```

---

### Task 18: Gamba wiring: CH 42 in the tuner, route and hub row

**Files:**

- Modify: `src/data/gambaTools.js`, `src/pages/GambaPage.js`, `src/components/gamba/guide.js`, `src/components/gamba/useGuideData.js`, `src/components/gamba/GambaGuide.js`
- Create: `src/hooks/useBallDrumCount.js`
- Modify tests: `src/data/__tests__/gambaTools.test.js`, `src/components/gamba/__tests__/GambaTuner.test.js`, `src/components/gamba/__tests__/guide.test.js`, `src/components/gamba/__tests__/GambaGuide.test.js`

**Interfaces:**

- Consumes: `BallChannel` (Task 17); `useBallRound` (Task 9); `drawnEntries`, `formatMulti`, `prizeText` and `who` (Task 8).
- Produces:
  - `GAMBA_TOOLS` gains `{ id: 'ball', label: 'Goofer Ball', icon: CircleDot, channel: 42, path: '/gamba/ball' }`.
  - `guideRows({ …, ball })` gains a `ball` row.
  - `useGuideData()` returns `ball: { round, count }`.
  - `useBallDrumCount(roundId) → number|null` (one `getCountFromServer`).

- [ ] **Step 1: Update the pinned tests (they fail until the code lands)**

- **`src/data/__tests__/gambaTools.test.js`**
  - Add `['ball', 42, '/gamba/ball'],` to the tools list.
  - Expect `GAMBA_CHANNELS.map((c) => c.channel)` to equal `[0, 1, 2, 3, 4, 42]`.
  - Add `expect(channelForPath('/gamba/ball').id).toBe('ball');` and `expect(channelLabel(GAMBA_TOOLS[4])).toBe('CH 42');`.
- **`src/components/gamba/__tests__/GambaTuner.test.js`**
  - In the channel-links test: rename it to "six channel links…" and add `['CH 42Goofer Ball', '/gamba/ball'],` as the last expected row.
  - In the steppers test, the hub's previous channel is now Goofer Ball: `screen.getByRole('link', { name: 'Previous channel: Goofer Ball' })` with href `/gamba/ball`. From `wheel`, the next channel is now `'Next channel: Goofer Ball'` with href `/gamba/ball`. Add `renderTuner('ball')` → `'Next channel: Hub'` with href `/gamba` (unmount between renders like the existing test).
  - In the phone readout test: `· 3 of 5` becomes `· 3 of 6`, and `3 of 5` becomes `3 of 6`.
  - Needle positions are now in sixths:
    - Add `const pos = (i) => ((i + 0.5) / 6) * 100;` at the top.
    - Replace every `expect(needle().style.left).toBe('50%')` (hunts, index 2) with `expect(parseFloat(needle().style.left)).toBeCloseTo(pos(2))`.
    - Replace every `toBe('90%')` (wheel, index 4) the same way with `pos(4)`.
    - Do the same for the `.style.left).toBe('50%')` on `next.container…`.
    - Change `expect(seen).toEqual(['50%'])` to `expect(seen).toHaveLength(1); expect(parseFloat(seen[0])).toBeCloseTo(pos(2));`.
- **`src/components/gamba/__tests__/guide.test.js`**
  - Add `['ball', 'CH 42', '/gamba/ball'],` to "tool order, channels and paths".
  - Append to `describe('guideRows', …)`:

```js
  test('the Goofer Ball row', () => {
    const r = (ball) => rows({ ...base, featured: 'leaderboard', feature: null, ball }).ball;
    const prize = { tickets: 200, prize: { kind: 'cash', amount: 5 } };
    expect(r(undefined)).toMatchObject({ now: 'Viewer-called buy hunts', next: 'When the drum opens', lit: false, live: false });
    expect(r({ round: undefined })).toMatchObject({ now: 'Tuning…', next: '—' });
    expect(r({ round: { status: 'open', prize, rack: [] }, count: 64 })).toMatchObject({
      now: 'Drum open · 64 balls',
      next: 'Top multi wins 200 tickets + $5',
      lit: true,
      live: true,
    });
    expect(r({ round: { status: 'open', prize, rack: [] }, count: null }).now).toBe('Drum open');
    expect(r({ round: { status: 'closed', prize, rack: [{ drawNo: 1, scratched: false }, { drawNo: 2, scratched: true }] } })).toMatchObject({
      now: 'Lineup closed · 1 ball drawn',
      next: 'Results after the hunt',
      lit: true,
      live: false,
    });
    expect(r({ round: { status: 'settled', prize, rack: [], winner: { displayName: 'CoolGuy', multiplier: 412 } } })).toMatchObject({
      now: 'Last winner @CoolGuy · 412x',
      next: 'Next draw on stream',
    });
  });
```

- **`src/components/gamba/__tests__/GambaGuide.test.js`**: `toHaveLength(4)` becomes `toHaveLength(5)`.

Run: `npm test -- --watchAll=false --testPathPattern="gambaTools|GambaTuner|guide|GambaGuide"`
Expected: FAIL (no ball channel yet).

- [ ] **Step 2: Add the channel**

In `src/data/gambaTools.js`:

- add `CircleDot` to the lucide import;
- append `{ id: 'ball', label: 'Goofer Ball', icon: CircleDot, channel: 42, path: '/gamba/ball' },` to `GAMBA_TOOLS`;
- change the header comment's last line to `// Channel numbers follow the On Air handoff: Hub 00, tools 01–04, Goofer Ball 42 (a 420 nod).`

In `src/pages/GambaPage.js`:

- add `const BallChannel = lazy(() => import('../components/ball/BallChannel'));`;
- after the `wheel` block, add:

```js
          {toolId === 'ball' && (
            <Suspense fallback={<ToolLoading label="Tuning to Channel 42…" />}>
              <BallChannel />
            </Suspense>
          )}
```

- [ ] **Step 3: The hub row**

Create `src/hooks/useBallDrumCount.js`:

```js
import { useEffect, useState } from 'react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// Balls in an open drum, counted once per round (an aggregation read per
// 1,000 balls) for the Gamba hub row, which doesn't need it live.
export default function useBallDrumCount(roundId) {
  const [state, setState] = useState({ roundId: null, count: null });
  useEffect(() => {
    if (!roundId) return undefined;
    let cancelled = false;
    getCountFromServer(query(collection(db, 'ball_rounds', roundId, 'balls'), where('status', '==', 'drum')))
      .then((snap) => {
        if (!cancelled) setState({ roundId, count: snap.data().count });
      })
      .catch(() => {
        if (!cancelled) setState({ roundId, count: null });
      });
    return () => {
      cancelled = true;
    };
  }, [roundId]);
  return state.roundId === roundId ? state.count : null;
}
```

In `src/components/gamba/useGuideData.js`:

- import `useBallRound from '../../hooks/useBallRound'` and `useBallDrumCount from '../../hooks/useBallDrumCount'`;
- add:

```js
  const { round: ballRound } = useBallRound();
  const ballCount = useBallDrumCount(ballRound && ballRound.status === 'open' ? ballRound.id : null);
```

- return `ball: { round: ballRound, count: ballCount }` alongside the existing fields;
- add `the newest Goofer Ball round (limit 1) and its drum count` to the header comment.

In `src/components/gamba/guide.js`, import `{ drawnEntries, formatMulti, prizeText, who } from '../../utils/ball'` and add:

```js
function ballRow(ball) {
  const round = ball.round;
  if (round === undefined) return { now: 'Tuning…', next: '—', lit: false, live: false, tone: null };
  if (round && round.status === 'open') {
    return {
      now: ball.count == null ? 'Drum open' : `Drum open · ${plural(ball.count, 'ball', 'balls')}`,
      next: `Top multi wins ${prizeText(round.prize)}`,
      lit: true,
      live: true,
      tone: null,
    };
  }
  if (round && round.status === 'closed') {
    return { now: `Lineup closed · ${plural(drawnEntries(round).length, 'ball', 'balls')} drawn`, next: 'Results after the hunt', lit: true, live: false, tone: null };
  }
  if (round && round.status === 'settled' && round.winner) {
    return { now: `Last winner @${who(round.winner)} · ${formatMulti(round.winner.multiplier)}`, next: 'Next draw on stream', lit: false, live: false, tone: null };
  }
  return { now: 'Viewer-called buy hunts', next: 'When the drum opens', lit: false, live: false, tone: null };
}
```

Then change `guideRows` to take `ball = null`, and add the branch before the static fallback: `if (tool.id === 'ball') return { ...head, ...ballRow(ball || { round: null }) };`.

In `src/components/gamba/GambaGuide.js`, pass the data through: `guideRows({ featured, feature, hunts: data.hunts, leaderboard: data.leaderboard, resets, roundError: data.roundError, ball: data.ball })`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="gambaTools|GambaTuner|guide|GambaGuide|GambaMenu|NavSheet|Navigation|FeaturedMonitor|HuntMonitor"`
Expected: PASS. The nav menu now lists `4-42 Goofer Ball`, and its tests only check that rows are present. If another test pins the full channel list, update its expectation to include CH 42.

- [ ] **Step 5: Look at it**

With `npm start`, open each of these:

- `/gamba/ball?fixture=open`;
- `?fixture=rack`;
- `?fixture=offair`;
- `?fixture=loading`;
- `/gamba` (the hub row).

Then step the tuner from Slot Picker to Goofer Ball. At 375px wide, check that "Call one in" and "Your ball" come first, and that the drum list and past draws fold. Compare against `docs/redesign/goofer-ball/site-page.html`.

- [ ] **Step 6: Commit**

```bash
git add src/data/gambaTools.js src/pages/GambaPage.js src/components/gamba src/hooks/useBallDrumCount.js src/data/__tests__/gambaTools.test.js
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "feat(gamba): CH 42 Goofer Ball in the tuner, route and hub listings"
```

---

### Task 19: Docs, full verification, play-test handoff

**Files:**

- Modify: `DESIGN.md` (§7), `CLAUDE.md` (Gotchas, Commands)

- [ ] **Step 1: DESIGN.md**

In `DESIGN.md` §7, after the "Video store" subsection, add:

```markdown
### Channel 42 (Goofer Ball)

Goofer Ball is WGOOF Channel 42: a cheap 90s local-TV lottery draw, not a casino.

- **Set:** a faded blue starburst backdrop, a wood desk, a "● LIVE 4:20" bug, a "42" station bug, and fine print ("Drawn nightly at 4:20. Supervised by the Goofer Gaming Commission. Odds are odds. Not a real lottery.").
- **Colours:** the set uses the `onair.wgoof` tokens. They appear only under `src/components/ball/`, through `ball.css` (`theme()`) and token classes, and the contract test holds them there. The drum canvas mirrors them in `canvasPalette.js`.
- **Type:**
  - Titles and the lower third are Anton (`font-display`), uppercase.
  - Labels are JetBrains Mono.
  - The lower third is `onair.winner` over `onair.paper`.
- **The drum:** canvas balls between the code-drawn glass and the stand. Each ball wears its slot art as a decal. All lettering is real text.
- **There is no host:** the streamer's webcam is the host.
- **The OBS overlay** rests in a corner box and takes over the screen only for a draw (8s) and the winner card (12s).
- **CH 42** uses the set as a strip at the top, then regular On Air panels below.
- **Reduced motion:** on CH 42 the drum renders still and the reveal animations drop.
```

- [ ] **Step 2: CLAUDE.md**

Under **Commands**, add this line after `npm run share:shots`:
`- Goofer Ball dev fixtures: /ball-overlay?fixture=open|draw|rack|winner (or ?demo=1&pos=br) and /gamba/ball?fixture=open|rack|closed|settled|offair|empty|loading.`

Under **Gotchas**, add:

```markdown
- Goofer Ball (`/gamba/ball`, CH 42; OBS source `/ball-overlay`): a viewer-called buy hunt draw.
  - **Chat intake:**
    - Viewers type `!slot <name>` in chat. `api/twitch/eventsub.js` hands those messages to `api/_lib/slotCommand.js` inside its own try/catch, so it never blocks giveaway entries.
    - The name is matched against the communityhunts catalogue (`slotMatch.js`, nicknames in `slotAliases.js`; bonus-buy slots only).
    - Bot replies thread under the viewer's message and only speak up when something's off or the name was guessed.
  - **Data:**
    - Rounds live in `ball_rounds/{id}`, with `balls/{twitchId}` (public), `claims/{slotKey}` (first caller wins, server-only) and `choices/{twitchId}` (did-you-mean, server-only).
    - Entries never write the round doc, so a `!slot` rush can't contend with a draw.
  - **Staff:**
    - The endpoint is `api/admin/ball.js`: open / update_prize / draw / scratch / close / reopen / cancel / link_hunt / preview_settle / settle / announce.
    - The control-room Ball tab drives it.
    - A draw is refused (`DRAW_BUSY`) while the last reveal plays.
    - The driving tab posts draw lines `DRAW_REVEAL_MS + STREAM_DELAY_MS` after `drawnAt`, and results `STREAM_DELAY_MS` after settle. Each line is claimed once on `announced.draws.d<n>` / `announced.results`.
  - **Payout:**
    - It reads the linked hunt's bonuses (`api/_lib/ballResults.js`, mirrored in `src/utils/ballResults.js` with a parity test), with typed overrides.
    - It pays tickets (set+merge plus a `ticket_ledger` row) and, for a $ prize, a pending `kind: 'goofer_ball'` redemption.
  - **Reveals switch:** `settings/broadcast.reveals` (`'overlay' | 'stage'`, set from the control room header) decides whether full-screen reveals (ball and giveaway) play in the OBS overlays or on the staff browser's Stage, so nothing plays twice.
```

- [ ] **Step 3: Full test run**

Run: `npm test -- --watchAll=false`
Expected: every suite PASSES. Fix anything this branch broke. Pre-existing failures on `main`, if any, get reported, not hidden.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds with no new ESLint warnings from the files this plan touched. `scripts/share/write-pages.js` also runs and must pass; `/gamba/ball` isn't a share page, so no rewrite is needed.

- [ ] **Step 5: Commit**

```bash
git add DESIGN.md CLAUDE.md
test "$(git branch --show-current)" = feat/goofer-ball && git commit -m "docs: Goofer Ball in DESIGN.md and CLAUDE.md"
```

- [ ] **Step 6: Hand off for the owner's localhost play-test (no push)**

Tell the owner what is ready, with these steps:

1. **Before any real round,** the Firestore rules and index must be deployed:
   `firebase deploy --only firestore:rules,firestore:indexes --project goofer-website`
   This is outward-facing, so **ask the owner first**; don't run it unasked.
2. **Play-test on localhost:**
   - `npm start`;
   - open the control room on `/` and step through the Ball tab;
   - put `/ball-overlay` in OBS (or a tab) next to `/gamba/ball`;
   - flip the reveals switch to Stage and back.
3. **Real `!slot` entries need production EventSub,** which already subscribes to `channel.chat.message`, so no new subscription is needed. They only work after a deploy. Locally, seed `ball_rounds/{id}/balls/*` docs by hand, or use the fixtures.

Keep the branch local until the owner signs off. Then push it and open the PR without Claude attribution (memory: Branch + PR flow).

---

## Self-review notes (resolved while writing)

- **Matcher order.** The spec lists nicknames before the exact name. This plan checks the exact name first, so a real slot whose name equals a nickname still wins; the spec has been updated to match.
- **"Warning strip".** The spec's "Goofer Ball still open" warning renders as a line in the panel body, next to the data-lost line, instead of a dismissible warning. That way it can't be dismissed while still true.
- **Ambiguous `!slot 1-3` lists.** The spec says 1-3. A tie of two offers `1-2`; the reply's range follows the option count.
- **Spec coverage.** Each spec section maps to a task:

  | Spec section | Task |
  |---|---|
  | Data model, Firestore rules, index | 6 |
  | Chat intake | 4–5 |
  | Staff API | 6–7 |
  | Results and payout | 3, 7, 16 |
  | Control room | 14–16 |
  | Reveals switch | 9, 14 |
  | OBS overlay | 10–13 |
  | Site page | 17–18 |
  | Visual language | 10, 19 |
  | Failure handling | 5–7, 9, 13, 16 |
  | Firestore budget | 5, 9, 17 |
  | Testing | every task |

