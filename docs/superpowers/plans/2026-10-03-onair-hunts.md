# On Air Hunts Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/gamba/hunts` in the "On Air" design language (rounded, layered broadcast surfaces) on real prediction and communityhunts data, and land the language itself as reusable tokens, primitives and DESIGN.md rules.

**Architecture:** Tokens live in `tailwind.config.js` under an `onair` namespace. Generic primitives (`Monitor`, `Panel`, `Chip`, `Ticket`, `OnAirButton`) live in `src/components/onAir/`. The Hunts feature is split into pure derivations (`huntStats.js`, `huntBoard.js`, `huntTime.js`), data hooks, and presentational components; `HuntsTab` composes them and `HuntsPage` only wires live data (or a dev-only fixture) into it.

**Tech Stack:** React 19, Create React App (react-scripts 5, Jest + Testing Library), Tailwind CSS 3.4, Firebase Firestore (client SDK), communityhunts.gg via `/api/communityhunts`.

**Spec:** `docs/superpowers/specs/2026-10-03-onair-hunts-design.md` (read it first; the handoff it cites is `docs/redesign/design_handoff_bonus_hunt_on_air/`).

## Global Constraints

- No new npm dependencies.
- Work on branch `feat/onair-hunts` in the main checkout. Every commit command starts with `[ "$(git branch --show-current)" = "feat/onair-hunts" ] &&` because other sessions switch branches in this folder.
- No `Co-Authored-By`, "Generated with Claude Code", or any Claude attribution in commits or the PR.
- Commit subjects: short imperative, conventional prefix, e.g. `feat(onair): …`, `feat(hunts): …`.
- Run tests with `npm test -- --watchAll=false --testPathPattern=<FileName>`. Patterns are file names, not paths (Windows paths use backslashes).
- Colours, radii, shadows and fonts come from the `onair` tokens. Raw colour values are allowed only inside `src/components/onAir/` (set dressing: screen tints, static noise, knobs) and for the per-slot tile tints in `BonusTable.js`.
- Glow means LIVE, winner, or you. No glow on hero numbers, generic buttons, markers, readouts or plain dots.
- Informational text is never fainter than `text-onair-ink-5` (`#8a8690`). `ink-6`/`ink-7` are decorative only.
- Viewers never query `hunts/{id}/entries` while a round is open (`entriesSealed`). Staff may.
- Opacity modifiers outside Tailwind's pre-3.4 scale (0,5,10,20,25,30,40,50,60,70,75,80,90,95,100) are written as arbitrary values, e.g. `bg-black/[0.35]`.
- Copy strings are exactly as written in this plan (they come from the spec).

## Review Focus

Most likely to bite real viewers, each pinned by a test in the owning task:

1. **Huge figures (ARS millions, long currency codes) in the hero, lineup and slip** must not overflow: the hero is container-fitted and the lineup's value column grows. Pinned in Task 6 (`HuntMonitor` ARS hero) and Task 7 (lineup with ARS 1,850,000).
2. **An admin re-opens a locked round** while a viewer is watching: the entries listener must unsubscribe and the board reseal. Pinned in Task 5 (`useRoundEntries` reopen test).
3. **Malformed entries** (no `payoutGuess`, no `displayName`, broken avatar URL) must not crash or print NaN. Pinned in Task 4 (`huntBoard` filters) and Task 7 (lineup fallback name and avatar).
4. **Degenerate hunts** (no bonuses, potless, nothing opened, everything opened) must never show `NaN`/`Infinity`. Pinned in Task 4 (`huntStats`) and Task 8 (recap of a potless hunt).
5. **The viewer is also the winner, or sits outside the top 10**: winner styling wins over viewer styling, and the viewer's row is pinned under the list. Pinned in Task 4 (`lineupRows`) and Task 7.

---

## File map

| File | Responsibility |
| --- | --- |
| `tailwind.config.js` | `onair` colours, radii, shadows, fonts, keyframes |
| `public/index.html` | Bricolage Grotesque + JetBrains Mono stylesheet |
| `DESIGN.md` | Section 7 "On Air (pilot: /gamba/hunts)" rules |
| `src/utils/fitText.js` | export `textEm` (used by `onAir/fit.js`) |
| `src/components/onAir/classes.js` | `MONO`, `FOCUS` class strings |
| `src/components/onAir/fit.js` | `fitFigure` container-fitted display sizes |
| `src/components/onAir/Panel.js` | rounded card / row surface, optional lit wash |
| `src/components/onAir/Chip.js` | pill |
| `src/components/onAir/OnAirButton.js` | viewer / winner / ghost button |
| `src/components/onAir/Ticket.js` | perforated slip with punched holes |
| `src/components/onAir/useChannelSwitch.js` | static burst + knob turns on key change |
| `src/components/onAir/Monitor.js` | bezel, screen, chyron, bezel strip |
| `src/components/hunts/huntTime.js` | dates, clock, time ago |
| `src/components/hunts/huntStats.js` | mode, tab hunt ref, money stats, prize text |
| `src/components/hunts/huntBoard.js` | ranking, lineup rows, meter, position, ticker |
| `src/components/hunts/usePredictionRound.js` | latest round listener |
| `src/components/hunts/useRoundEntries.js` | the tab's one entries listener |
| `src/components/hunts/useMyEntry.js` | viewer's own entry |
| `src/components/hunts/useHunt.js` | tab hunt / episode with bonuses (replaces `useHuntDetail`) |
| `src/components/hunts/useNow.js` | ticking clock |
| `src/components/hunts/ViewerAvatar.js` | avatar with initial fallback |
| `src/components/hunts/HuntMeter.js` | guess meter |
| `src/components/hunts/HuntMonitor.js` | the five screens on the `Monitor` |
| `src/components/hunts/HuntLineup.js` | guesses list, face-down rows |
| `src/components/hunts/BonusTable.js` | per-bonus table |
| `src/components/hunts/HuntRecap.js` | stats row + bonus table, episode back |
| `src/components/hunts/HuntSlip.js` | the prediction slip |
| `src/components/hunts/RunnerUpCard.js` | places 2+ |
| `src/components/hunts/PastEpisodes.js` | recent hunts list |
| `src/components/hunts/HuntsTab.js` | composes the tab from raw data |
| `src/components/hunts/huntFixtures.js` | dev-only fixture data |
| `src/pages/HuntsPage.js` | live wiring or fixture |

Deleted in Task 11: `src/components/PredictionSlip.js`, `PredictionWall.js`, `PredictionNumberLine.js`, `src/components/hunts/CurrentHuntCard.js`, `RecentHunts.js`, `BonusReel.js`, `HuntBonuses.js`, `ProfitBadge.js`, `useHuntDetail.js`, and tests `src/components/__tests__/PredictionSlip.test.js`, `PredictionWall.test.js`, `sealedGuesses.test.js`.

---

### Task 1: On Air tokens, fonts and the DESIGN.md contract

**Files:**
- Modify: `tailwind.config.js` (theme.extend: colors, fontFamily, borderRadius, boxShadow, keyframes, animation)
- Modify: `public/index.html:33`
- Modify: `DESIGN.md` (append section 7)

**Interfaces:**
- Produces: Tailwind classes used by every later task: `text|bg|from|to|via|ring-onair-{signal,signal-light,signal-deep,winner,winner-hot,winner-warm,winner-light,winner-pale,winner-deep,winner-ink,viewer,viewer-bright,viewer-deep,viewer-light,viewer-ink,viewer-muted,live,loss,surface-1..4,surface-raised,bezel-top,bezel-bottom,ink-1..7,screen-ink,screen-dim,ticket-top,ticket-mid,ticket-bottom}`, `rounded-onair-{bezel,screen,card,row,inner,control,tile}`, `shadow-onair-{bezel,screen,card,row,well,raised,lit-signal,lit-winner,lit-viewer,live,led,ticket,winner-ring,winner-chip,dot,dot-winner,dot-viewer}`, `font-onair`, `font-onair-mono`, `animate-onair-{static,roll,ticker,pulse}`.

- [ ] **Step 1: Write a failing probe that checks the classes are generated**

Create `$SCRATCH/onair-probe.html` (use the session scratchpad directory, not the repo):

```html
<div class="text-onair-signal bg-onair-surface-2 from-onair-ticket-top rounded-onair-card rounded-onair-inner shadow-onair-lit-winner shadow-onair-dot-viewer font-onair font-onair-mono animate-onair-ticker bg-onair-signal/[0.14] text-onair-ink-5"></div>
```

- [ ] **Step 2: Run the probe to see it fail**

Run:
```bash
npx tailwindcss -c tailwind.config.js --content "$SCRATCH/onair-probe.html" -o "$SCRATCH/onair-probe.css" && grep -c "onair" "$SCRATCH/onair-probe.css"
```
Expected: `0` (no On Air classes exist yet).

- [ ] **Step 3: Add the tokens**

In `tailwind.config.js`, inside `theme.extend.colors`, after `'nn-orange': '#ff8a3d',` add:

```js
        // On Air (pilot: /gamba/hunts). Semantic roles, see DESIGN.md §7.
        onair: {
          signal: { DEFAULT: '#3ee0bf', light: '#7af0d6', deep: '#1fc9a8' },
          winner: {
            DEFAULT: '#ff6a1a',
            hot: '#ff8a3d',
            warm: '#ff9a5c',
            light: '#ffb27a',
            pale: '#ffd2b0',
            deep: '#e0520c',
            ink: '#1a0a02',
          },
          viewer: {
            DEFAULT: '#9146ff',
            bright: '#a26bff',
            deep: '#8240f0',
            light: '#b89cff',
            ink: '#d6cce4',
            muted: '#b7aec4',
          },
          live: '#d83a1c',
          loss: '#ff6b6b',
          surface: { 1: '#17151b', 2: '#141216', 3: '#121015', 4: '#0f0e12', raised: '#3a3540' },
          bezel: { top: '#26232c', bottom: '#141217' },
          ink: {
            1: '#ece8e1',
            2: '#e4e0e8',
            3: '#c9c4cf',
            4: '#a7a2ad',
            5: '#8a8690',
            6: '#6d6873',
            7: '#4a4550',
          },
          screen: { ink: '#c9a993', dim: '#8a7d75' },
          ticket: { top: '#2a1d3d', mid: '#231933', bottom: '#17121f' },
        },
```

Inside `theme.extend.fontFamily`, after `rajdhani: [...]` add:

```js
        onair: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'onair-mono': ['"JetBrains Mono"', 'source-code-pro', 'Menlo', 'Consolas', 'monospace'],
```

Inside `theme.extend`, after the `letterSpacing` block, add:

```js
      borderRadius: {
        'onair-bezel': '36px',
        'onair-screen': '26px',
        'onair-card': '24px',
        'onair-row': '18px',
        'onair-inner': '16px',
        'onair-control': '14px',
        'onair-tile': '10px',
      },
      boxShadow: {
        'onair-bezel':
          'inset 0 1px 0 rgba(255,255,255,.09), inset 0 -2px 0 rgba(0,0,0,.6), 0 30px 60px rgba(0,0,0,.6)',
        'onair-screen': 'inset 0 0 80px rgba(0,0,0,.85), inset 0 0 0 1px rgba(255,255,255,.04)',
        'onair-card': 'inset 0 1px 0 rgba(255,255,255,.06), 0 14px 30px rgba(0,0,0,.4)',
        'onair-row': 'inset 0 1px 0 rgba(255,255,255,.05)',
        'onair-well': 'inset 0 2px 6px rgba(0,0,0,.5)',
        'onair-raised': 'inset 0 1px 0 rgba(255,255,255,.25)',
        'onair-lit-signal': 'inset 0 1px 0 rgba(120,255,220,.12)',
        'onair-lit-winner': 'inset 0 1px 0 rgba(255,180,130,.2), 0 12px 30px -12px rgba(255,106,26,.45)',
        'onair-lit-viewer': 'inset 0 1px 0 rgba(200,170,255,.2), 0 12px 30px -12px rgba(145,70,255,.45)',
        'onair-live': '0 0 24px rgba(216,58,28,.6)',
        'onair-led': '0 0 10px #ff4a2a',
        'onair-ticket': '0 24px 40px -14px rgba(145,70,255,.4)',
        'onair-winner-ring': '0 0 0 5px #1a100c, 0 0 0 7px #ff6a1a, 0 0 60px rgba(255,106,26,.55)',
        'onair-winner-chip': '0 8px 20px rgba(255,106,26,.4)',
        'onair-dot': '0 0 0 3px #0f0b0d',
        'onair-dot-winner': '0 0 0 3px #0f0b0d, 0 0 16px #ff6a1a',
        'onair-dot-viewer': '0 0 0 3px #0f0b0d, 0 0 16px #9146ff',
      },
```

Inside `theme.extend.keyframes`, after `'tote-flip': {...},` add:

```js
        // On Air monitor: channel-change static, rolling band, chyron, LIVE light.
        'onair-static': {
          '0%': { backgroundPosition: '0 0, 0 0' },
          '25%': { backgroundPosition: '-37px 21px, 13px -9px' },
          '50%': { backgroundPosition: '19px -43px, -27px 31px' },
          '75%': { backgroundPosition: '-11px 7px, 41px 17px' },
          '100%': { backgroundPosition: '29px 39px, -7px -23px' },
        },
        'onair-roll': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'onair-ticker': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'onair-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
```

Inside `theme.extend.animation`, after `'tote-flip': ...,` add:

```js
        'onair-static': 'onair-static 0.12s steps(4) infinite',
        'onair-roll': 'onair-roll 0.4s linear infinite',
        'onair-ticker': 'onair-ticker 38s linear infinite',
        'onair-pulse': 'onair-pulse 1.4s ease-in-out infinite',
```

- [ ] **Step 4: Load the fonts**

In `public/index.html`, directly after the Anton stylesheet line (`<link href="https://fonts.googleapis.com/css2?family=Anton&display=swap" rel="stylesheet" />`) add:

```html
    <!-- On Air (pilot: /gamba/hunts). Files only download where an element uses the font. -->
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 5: Run the probe again**

Run the Step 2 command.
Expected: a count greater than `0`, and `grep -o "rounded-onair-inner" "$SCRATCH/onair-probe.css"` prints a match.

- [ ] **Step 6: Write the DESIGN.md contract**

Append to the end of `DESIGN.md`:

```markdown

## 7. On Air (pilot: /gamba/hunts)

On Air is the softer broadcast look replacing the hard-lined boxes: rounded, layered surfaces with inset highlights and drop shadows, a TV monitor stage, a perforated prediction slip. It pilots on the Hunts tab (`/gamba/hunts`); other surfaces opt in one at a time by using the `onair` tokens and the primitives in `src/components/onAir/`. Until the global nav migrates, the seam between the system-font nav and On Air content is expected.

### Tokens

All values live in `tailwind.config.js` under `onair`. Never copy a hex out of the handoff into a component; add or reuse a token.

- **Colour roles:** `onair-signal` (#3ee0bf) is the signal: open, live state, positive result. `onair-winner` (#ff6a1a family) is the result moment. `onair-viewer` (#9146ff family) is "you" and Twitch actions. `onair-live` (#d83a1c) is the LIVE tally light only. `onair-loss` (#ff6b6b) is negative results and errors.
- **Surfaces:** `onair-surface-1…4` step from #17151b to #0f0e12; `onair-bezel-*` for the monitor frame; `onair-ticket-*` for the slip.
- **Ink:** `onair-ink-1…7`, #ece8e1 down to #4a4550.
- **Radii:** bezel 36, screen 26, card 24, row 18, inner 16, control 14, tile 10.
- **Depth:** `shadow-onair-card` and `shadow-onair-row` for resting surfaces; `shadow-onair-lit-winner` / `-lit-viewer` for lit rows and cards.
- **Type:** `font-onair` (Bricolage Grotesque 500/700/800) for display and UI; `font-onair-mono` (JetBrains Mono 400/600/700) uppercase with 0.15–0.35em tracking for labels and data. Scale: 96 / 60 / 30 / 24 / 22 / 20 / 17 / 15 / 14 / 13 / 12 / 11 / 10.

### Named Rules

**Depth, Not Borders.** On Air surfaces get an inset top highlight plus a drop shadow. No 1px border boxes. Hairlines are only allowed as row dividers inside a table.

**Glow Means Something.** Only three things glow: the LIVE light, the winner, and you. Hero numbers, generic buttons, markers, readouts and plain dots do not.

**Readable Labels.** Informational text is never fainter than `onair-ink-5` (#8a8690, about 5:1 on On Air surfaces). `onair-ink-6` and `-7` are for decoration only.

**Roles Inside On Air.** Inside On Air, orange means the winner/result (not admin) and red means the LIVE light and losses (not only destructive). Outside On Air, §2's Two-Role Rule still holds.

**Honest Set Dressing.** Decorative controls (the monitor's knobs, LED, wordmark) are `aria-hidden`, have no pointer cursor and no hover state.

**Motion Has An Off Switch.** The channel-change static, knob spin, chyron scroll and LIVE pulse all stop under `prefers-reduced-motion`.
```

- [ ] **Step 7: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add tailwind.config.js public/index.html DESIGN.md && git commit -m "feat(onair): tokens, fonts and the On Air design rules"
```

---

### Task 2: On Air primitives (Panel, Chip, OnAirButton, Ticket, fit)

**Files:**
- Modify: `src/utils/fitText.js:13` (export `textEm`)
- Create: `src/components/onAir/classes.js`, `src/components/onAir/fit.js`, `src/components/onAir/Panel.js`, `src/components/onAir/Chip.js`, `src/components/onAir/OnAirButton.js`, `src/components/onAir/Ticket.js`
- Test: `src/components/onAir/__tests__/onAirPrimitives.test.js`

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces:
  - `MONO: string` (`'font-onair-mono uppercase'`), `FOCUS: string` (focus-visible outline classes)
  - `fitFigure(text: string, { min: number, max: number, share?: string }) => string` (CSS `clamp(...)` using `cqi`; default share `var(--hero-share, 1)`)
  - `<Panel as? radius?: 'card'|'row' lit?: 'winner'|'viewer'|'signal'|null className? ...rest>`; sets `data-lit` when lit
  - `<Chip tone?: 'neutral'|'signal'|'winner' className?>`
  - `<OnAirButton variant?: 'viewer'|'winner'|'ghost' size?: 'md'|'sm' type? className? ...rest>`
  - `<Ticket header: node className?>children</Ticket>` (a `section` labelled "Prediction slip")

- [ ] **Step 1: Write the failing tests**

Create `src/components/onAir/__tests__/onAirPrimitives.test.js`:

```js
import { fireEvent, render, screen } from '@testing-library/react';
import Panel from '../Panel';
import Chip from '../Chip';
import OnAirButton from '../OnAirButton';
import Ticket from '../Ticket';
import { fitFigure } from '../fit';

test('Panel renders as the requested element and marks lit panels', () => {
  render(
    <ul>
      <Panel as="li" radius="row" lit="winner">first</Panel>
      <Panel as="li" radius="row">second</Panel>
    </ul>
  );
  const [first, second] = screen.getAllByRole('listitem');
  expect(first.getAttribute('data-lit')).toBe('winner');
  expect(first.className).toContain('shadow-onair-lit-winner');
  expect(second.getAttribute('data-lit')).toBeNull();
  expect(second.className).toContain('shadow-onair-row');
});

test('Chip renders its content', () => {
  render(<Chip tone="signal">6 guesses in</Chip>);
  expect(screen.getByText('6 guesses in').className).toContain('text-onair-signal-light');
});

test('OnAirButton defaults to type=button and respects disabled', () => {
  const onClick = jest.fn();
  render(<OnAirButton onClick={onClick} disabled>Lock it in</OnAirButton>);
  const btn = screen.getByRole('button', { name: 'Lock it in' });
  expect(btn.getAttribute('type')).toBe('button');
  fireEvent.click(btn);
  expect(onClick).not.toHaveBeenCalled();
});

test('Ticket labels itself and renders header and body', () => {
  render(<Ticket header={<p>Call the payout</p>}><p>body</p></Ticket>);
  const slip = screen.getByRole('region', { name: 'Prediction slip' });
  expect(slip.textContent).toContain('Call the payout');
  expect(slip.textContent).toContain('body');
});

test('fitFigure sizes text to a share of the container width', () => {
  const size = fitFigure('CA$2,046.12', { min: 3.25, max: 6 });
  expect(size).toMatch(/^clamp\(3\.25rem, calc\([\d.]+cqi \* var\(--hero-share, 1\)\), 6rem\)$/);
  expect(fitFigure('Xilentdrifter', { min: 2.25, max: 3.75, share: '0.9' })).toContain('* 0.9)');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- --watchAll=false --testPathPattern=onAirPrimitives`
Expected: FAIL with "Cannot find module '../Panel'".

- [ ] **Step 3: Export `textEm`**

In `src/utils/fitText.js` change `function textEm(text) {` to `export function textEm(text) {`.

- [ ] **Step 4: Write the primitives**

Create `src/components/onAir/classes.js`:

```js
// Shared On Air class strings (DESIGN.md §7). Labels pick their own size and
// tracking; informational ones never go fainter than ink-5.
export const MONO = 'font-onair-mono uppercase';

export const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-onair-signal';
```

Create `src/components/onAir/fit.js`:

```js
import { textEm } from '../../utils/fitText';

// A one-line display figure sized to a share of its nearest size container
// (container-type: inline-size). The share defaults to --hero-share so a
// breakpoint can shrink it when side stats join the hero's row.
export function fitFigure(text, { min, max, share = 'var(--hero-share, 1)' }) {
  const per = (94 / textEm(text)).toFixed(2);
  return `clamp(${min}rem, calc(${per}cqi * ${share}), ${max}rem)`;
}
```

Create `src/components/onAir/Panel.js`:

```js
// The On Air surface: rounded, inset highlight plus drop shadow, no border.
// A lit panel washes in its role colour from the left; winner and viewer also
// carry their glow, the only glows On Air allows.
const RADIUS = { card: 'rounded-onair-card', row: 'rounded-onair-row' };

const SURFACE = {
  none: 'bg-gradient-to-b from-onair-surface-1 to-onair-surface-3',
  winner:
    'bg-onair-surface-2 bg-gradient-to-r from-onair-winner/20 via-onair-winner/[0.04] via-60% to-transparent',
  viewer:
    'bg-onair-surface-2 bg-gradient-to-r from-onair-viewer/[0.22] via-onair-viewer/[0.04] via-60% to-transparent',
  signal:
    'bg-onair-surface-2 bg-gradient-to-r from-onair-signal-deep/[0.16] to-onair-signal-deep/[0.03]',
};

const RESTING = { card: 'shadow-onair-card', row: 'shadow-onair-row' };
const LIT = {
  winner: 'shadow-onair-lit-winner',
  viewer: 'shadow-onair-lit-viewer',
  signal: 'shadow-onair-lit-signal',
};

export default function Panel({ as: Tag = 'div', radius = 'card', lit = null, className = '', children, ...rest }) {
  const depth = lit ? LIT[lit] : RESTING[radius];
  return (
    <Tag
      className={`${RADIUS[radius]} ${SURFACE[lit || 'none']} ${depth} ${className}`}
      data-lit={lit || undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

Create `src/components/onAir/Chip.js`:

```js
const TONES = {
  neutral: 'bg-white/[0.07] text-onair-ink-1',
  signal: 'bg-onair-signal/[0.14] text-onair-signal-light',
  winner:
    'bg-gradient-to-b from-onair-winner-hot to-onair-winner-deep font-extrabold text-onair-winner-ink shadow-onair-winner-chip',
};

export default function Chip({ tone = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9375rem] leading-tight ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
```

Create `src/components/onAir/OnAirButton.js`:

```js
import { FOCUS } from './classes';

const VARIANTS = {
  viewer:
    'bg-gradient-to-b from-onair-viewer-bright to-onair-viewer-deep text-white-body shadow-onair-raised hover:brightness-110',
  winner:
    'bg-gradient-to-b from-onair-winner-hot to-onair-winner-deep text-onair-winner-ink shadow-onair-raised hover:brightness-110',
  ghost: 'bg-white/[0.07] text-onair-ink-2 hover:bg-white/[0.12]',
};

const SIZES = {
  md: 'w-full px-4 py-3 text-[0.9375rem]',
  sm: 'w-auto px-3.5 py-2 text-sm',
};

const DISABLED =
  'disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/[0.08] disabled:text-onair-ink-6 disabled:shadow-none disabled:hover:brightness-100';

export default function OnAirButton({ variant = 'viewer', size = 'md', type = 'button', className = '', children, ...rest }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-onair-control font-bold transition-[filter,background-color] duration-150 ${SIZES[size]} ${VARIANTS[variant]} ${DISABLED} ${FOCUS} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
```

Create `src/components/onAir/Ticket.js`:

```js
// The prediction slip: two halves joined at a dashed perforation, with real
// holes punched at both ends of it. Each half masks its own corner notches,
// so the holes stay on the perforation however tall the header grows, and
// they show the page behind (the site's gradient), not a painted dot. The
// glow sits on the unmasked outer box: an outer box-shadow is never drawn
// inside the box, so the holes stay clean.
const NOTCH = 12;

function notchMask(edge) {
  const y = edge === 'bottom' ? '100%' : '0';
  const hole = (x) => `radial-gradient(circle at ${x} ${y}, transparent ${NOTCH}px, #000 ${NOTCH + 0.5}px)`;
  const value = `${hole('0')} left / 51% 100% no-repeat, ${hole('100%')} right / 51% 100% no-repeat`;
  return { WebkitMask: value, mask: value };
}

export default function Ticket({ header, className = '', children }) {
  return (
    <section aria-label="Prediction slip" className={`rounded-onair-card shadow-onair-ticket ${className}`}>
      <div
        className="rounded-t-onair-card bg-gradient-to-b from-onair-ticket-top to-onair-ticket-mid px-[22px] pb-[18px] pt-[22px] shadow-[inset_0_1px_0_rgba(200,170,255,.18)]"
        style={notchMask('bottom')}
      >
        {header}
      </div>
      <div
        className="rounded-b-onair-card bg-gradient-to-b from-onair-ticket-mid to-onair-ticket-bottom px-[22px] pb-[22px]"
        style={notchMask('top')}
      >
        <div className="-mx-1 border-t-2 border-dashed border-white/[0.12]" aria-hidden="true" />
        <div className="pt-[18px]">{children}</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test -- --watchAll=false --testPathPattern=onAirPrimitives`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add src/utils/fitText.js src/components/onAir && git commit -m "feat(onair): panel, chip, button, ticket and fitted figures"
```

---

### Task 3: The Monitor and its channel switch

**Files:**
- Create: `src/components/onAir/useChannelSwitch.js`, `src/components/onAir/Monitor.js`
- Test: `src/components/onAir/__tests__/Monitor.test.js`

**Interfaces:**
- Consumes: `MONO` (Task 2), Task 1 tokens.
- Produces:
  - `SWITCH_MS = 420`, `prefersReducedMotion(): boolean`, `useChannelSwitch(key: string|null) => { switching: boolean, turns: number }`
  - `<Monitor tint?: 'signal'|'winner'|'neutral' status?: 'live'|'replay'|null channel: string clock?: { long, short }|null channelKey?: string|null readout: { label, tone: 'signal'|'muted' } chyron?: { tag, tone: 'signal'|'winner'|'muted', items: string[] }|null>children</Monitor>`
  - The static layer has `data-testid="onair-static"`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/onAir/__tests__/Monitor.test.js`:

```js
import { act, render, screen } from '@testing-library/react';
import Monitor from '../Monitor';
import { SWITCH_MS } from '../useChannelSwitch';

function setReducedMotion(on) {
  window.matchMedia = jest.fn((query) => ({
    matches: on && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

const PROPS = {
  tint: 'signal',
  status: 'live',
  channel: 'CH 02 · Hunts',
  clock: { long: 'THU OCT 1 · 9:58 PM', short: '9:58 PM' },
  readout: { label: 'CH 02 · Entries open', tone: 'signal' },
  chyron: { tag: 'Open', tone: 'signal', items: ['Predictions open', '6 guesses in'] },
};

afterEach(() => {
  delete window.matchMedia;
  jest.useRealTimers();
});

test('renders the screen, readout and a ticker whose copy is hidden from screen readers', () => {
  render(<Monitor {...PROPS} channelKey="open"><p>screen body</p></Monitor>);
  expect(screen.getByText('screen body')).toBeTruthy();
  expect(screen.getByText('CH 02 · Entries open')).toBeTruthy();
  expect(screen.getByText('Live')).toBeTruthy();
  const copies = screen.getAllByText('Predictions open');
  expect(copies).toHaveLength(2);
  expect(copies.filter((el) => el.closest('[aria-hidden="true"]'))).toHaveLength(1);
});

test('knobs and the wordmark are set dressing', () => {
  render(<Monitor {...PROPS} channelKey="open" />);
  expect(screen.getByText('VOL').closest('[aria-hidden="true"]')).toBeTruthy();
  expect(screen.getByText('Goofer·vision').closest('[aria-hidden="true"]')).toBeTruthy();
});

test('the static plays on a channel change, never on mount, and clears after the burst', () => {
  jest.useFakeTimers();
  setReducedMotion(false);
  const { rerender } = render(<Monitor {...PROPS} channelKey="open" />);
  expect(screen.queryByTestId('onair-static')).toBeNull();
  rerender(<Monitor {...PROPS} channelKey="locked" />);
  expect(screen.getByTestId('onair-static')).toBeTruthy();
  act(() => {
    jest.advanceTimersByTime(SWITCH_MS);
  });
  expect(screen.queryByTestId('onair-static')).toBeNull();
});

test('the first real channel after loading (null key) is quiet', () => {
  setReducedMotion(false);
  const { rerender } = render(<Monitor {...PROPS} channelKey={null} />);
  rerender(<Monitor {...PROPS} channelKey="open" />);
  expect(screen.queryByTestId('onair-static')).toBeNull();
});

test('reduced motion swaps channels without static', () => {
  setReducedMotion(true);
  const { rerender } = render(<Monitor {...PROPS} channelKey="open" />);
  rerender(<Monitor {...PROPS} channelKey="settled" />);
  expect(screen.queryByTestId('onair-static')).toBeNull();
});

test('a replay monitor shows Replay and no ticker when chyron is omitted', () => {
  render(<Monitor {...PROPS} status="replay" chyron={null} channelKey="settled" />);
  expect(screen.getByText('Replay')).toBeTruthy();
  expect(screen.queryByRole('marquee')).toBeNull();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- --watchAll=false --testPathPattern=Monitor.test`
Expected: FAIL with "Cannot find module '../Monitor'".

- [ ] **Step 3: Write `useChannelSwitch`**

Create `src/components/onAir/useChannelSwitch.js`:

```js
import { useEffect, useRef, useState } from 'react';

export const SWITCH_MS = 420;

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Channel-change state for the Monitor. Each time `key` moves from one real
// value to another, the CH knob turns a notch and (motion allowing) the static
// burst shows for SWITCH_MS. A null key means "still loading": the first real
// key after it never counts, so first paint and first data load stay quiet.
// Comparing against the previous key (not a "mounted" flag) keeps React's
// StrictMode double-run of mount effects from faking a switch.
export default function useChannelSwitch(key) {
  const prev = useRef(key);
  const [state, setState] = useState({ switching: false, turns: 0 });

  useEffect(() => {
    if (prev.current === key) return undefined;
    const from = prev.current;
    prev.current = key;
    if (from == null || key == null) return undefined;
    const reduce = prefersReducedMotion();
    setState((s) => ({ switching: !reduce, turns: s.turns + 1 }));
    if (reduce) return undefined;
    const t = setTimeout(() => setState((s) => ({ ...s, switching: false })), SWITCH_MS);
    return () => clearTimeout(t);
  }, [key]);

  return state;
}
```

- [ ] **Step 4: Write the Monitor**

Create `src/components/onAir/Monitor.js`:

```js
import { MONO } from './classes';
import useChannelSwitch from './useChannelSwitch';

// The On Air stage: a bezel around a tinted CRT screen, a chyron ticker along
// the screen's foot and a bezel strip with the channel readout. The knobs,
// LED and wordmark are set dressing (aria-hidden, not interactive).

const TINTS = { signal: '#0f2220', winner: '#2a1810', neutral: '#16131a' };
const TAG = { signal: 'bg-onair-signal', winner: 'bg-onair-winner-hot', muted: 'bg-onair-ink-4' };
const STAR = { signal: 'text-onair-signal', winner: 'text-onair-winner-hot', muted: 'text-onair-ink-4' };
const READOUT = { signal: 'text-onair-signal', muted: 'text-onair-ink-5' };

const SCANLINES = {
  background: 'repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 3px)',
};
const NOISE = {
  backgroundImage:
    'repeating-radial-gradient(circle at 17% 32%, #fff 0 1px, #000 1px 2px, #777 2px 3px), repeating-conic-gradient(#222 0 7deg, #ddd 7deg 9deg, #555 9deg 15deg)',
  backgroundSize: '97px 89px, 61px 53px',
  filter: 'contrast(1.6) grayscale(1)',
};

function StatusLight({ status }) {
  if (status === 'live') {
    return (
      <span
        className={`${MONO} inline-flex items-center gap-[7px] rounded-onair-tile bg-onair-live px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.2em] text-white-body shadow-onair-live`}
      >
        <span className="h-[7px] w-[7px] rounded-full bg-white-body motion-safe:animate-onair-pulse" aria-hidden="true" />
        Live
      </span>
    );
  }
  if (status === 'replay') {
    return (
      <span
        className={`${MONO} inline-flex items-center rounded-onair-tile bg-onair-surface-raised px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.2em] text-onair-ink-2`}
      >
        Replay
      </span>
    );
  }
  return null;
}

function Static() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden bg-[#07060a]"
      data-testid="onair-static"
      aria-hidden="true"
    >
      <div className="absolute inset-[-20%] animate-onair-static opacity-[0.85]" style={NOISE} />
      <div className="absolute inset-x-0 h-[30%] animate-onair-roll bg-gradient-to-b from-transparent via-white/[0.35] to-transparent" />
    </div>
  );
}

function TickerRun({ items, tone, hidden }) {
  return (
    <div className="flex flex-none" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-7 pr-7">
          {item}
          <span className={STAR[tone]} aria-hidden="true">★</span>
        </span>
      ))}
    </div>
  );
}

function Chyron({ tag, tone, items }) {
  return (
    <div className="relative flex h-10 items-stretch bg-black/[0.55] shadow-onair-row">
      <div
        className={`${MONO} flex flex-none items-center px-4 text-[0.6875rem] font-bold tracking-[0.2em] text-onair-winner-ink ${TAG[tone]}`}
      >
        {tag}
      </div>
      <div
        role="marquee"
        aria-label="Hunt ticker"
        className="relative flex flex-1 items-center overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]"
      >
        <div className={`${MONO} flex whitespace-nowrap text-xs tracking-[0.18em] text-onair-ink-2 motion-safe:animate-onair-ticker`}>
          <TickerRun items={items} tone={tone} />
          <TickerRun items={items} tone={tone} hidden />
        </div>
      </div>
    </div>
  );
}

function Knob({ label, sizeClass, deg, indicatorClass, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} aria-hidden="true">
      <span className={`${MONO} text-[0.5625rem] tracking-[0.2em] text-onair-ink-6`}>{label}</span>
      <span
        className={`relative rounded-full bg-[radial-gradient(circle_at_35%_30%,#4a4650,#1c1a20_70%)] shadow-[0_3px_6px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.15),0_0_0_3px_#17151a] transition-transform duration-[350ms] ease-[cubic-bezier(.3,1.5,.5,1)] motion-reduce:transition-none ${sizeClass}`}
        style={{ transform: `rotate(${deg}deg)` }}
      >
        <span className={`absolute left-1/2 top-1 -ml-px w-[3px] rounded-sm ${indicatorClass}`} />
      </span>
    </div>
  );
}

function BezelStrip({ readout, turns }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 pb-4 pt-3.5 sm:gap-5 sm:px-[18px]">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-onair-live shadow-onair-led" />
        <span className={`${MONO} hidden text-[0.6875rem] font-bold tracking-[0.35em] text-onair-ink-6 sm:inline`}>
          Goofer·vision
        </span>
      </div>
      <div className="flex items-center gap-3 sm:gap-[22px]">
        {readout && (
          <div
            className={`${MONO} flex items-center gap-2 rounded-onair-tile bg-black/[0.35] px-3 py-[7px] text-[0.625rem] font-bold tracking-[0.18em] shadow-onair-well ${READOUT[readout.tone]}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {readout.label}
          </div>
        )}
        <Knob
          label="CH"
          deg={turns * 60}
          sizeClass="h-[30px] w-[30px] sm:h-[38px] sm:w-[38px]"
          indicatorClass="h-2 bg-onair-winner-hot sm:h-[11px]"
        />
        <Knob
          label="VOL"
          deg={-40}
          sizeClass="h-[30px] w-[30px]"
          indicatorClass="h-2 bg-onair-ink-3"
          className="hidden sm:flex"
        />
      </div>
    </div>
  );
}

export default function Monitor({
  tint = 'neutral',
  status = null,
  channel,
  clock = null,
  channelKey = null,
  readout = null,
  chyron = null,
  children,
}) {
  const { switching, turns } = useChannelSwitch(channelKey);
  return (
    <section
      aria-label="Hunt monitor"
      className="rounded-onair-bezel bg-gradient-to-b from-onair-bezel-top to-onair-bezel-bottom px-2.5 pt-2.5 shadow-onair-bezel sm:px-3.5 sm:pt-3.5"
    >
      <div
        className="relative overflow-hidden rounded-onair-screen shadow-onair-screen"
        style={{ background: `radial-gradient(120% 90% at 50% 40%, ${TINTS[tint]} 0%, #120c0e 60%, #07060a 100%)` }}
      >
        <div className="pointer-events-none absolute inset-0 z-[2] mix-blend-screen" style={SCANLINES} aria-hidden="true" />
        {switching && <Static />}
        <div className="relative px-[18px] pb-4 pt-5 sm:px-[34px] sm:pb-6 sm:pt-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <StatusLight status={status} />
              <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-screen-ink`}>{channel}</span>
            </div>
            {clock && (
              <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-screen-dim`}>
                <span className="hidden sm:inline">{clock.long}</span>
                <span className="sm:hidden">{clock.short}</span>
              </span>
            )}
          </div>
          {children}
        </div>
        {chyron && chyron.items.length > 0 && <Chyron {...chyron} />}
      </div>
      <BezelStrip readout={readout} turns={turns} />
    </section>
  );
}
```

Note: the spec keeps the wordmark on phones; at 375px the LED + wordmark + readout + CH knob are about 420px wide in a 311px strip, so the wordmark is hidden below `sm` and the LED stays.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test -- --watchAll=false --testPathPattern=Monitor.test`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add src/components/onAir && git commit -m "feat(onair): monitor with chyron, bezel strip and channel-change static"
```

---

### Task 4: Pure derivations (huntTime, huntStats, huntBoard)

**Files:**
- Create: `src/components/hunts/huntTime.js`, `src/components/hunts/huntStats.js`, `src/components/hunts/huntBoard.js`
- Test: `src/components/hunts/__tests__/huntStats.test.js`, `src/components/hunts/__tests__/huntBoard.test.js`

**Interfaces:**
- Consumes: `roundTotalCost` (`src/utils/predictionRound.js`), `prizeLabel`, `winnerPrizeLabel` (`src/utils/predictionRewards.js`), `formatMoney` (`src/utils/money.js`), `formatMultiplier` (`src/utils/huntFormat.js`).
- Produces (`huntTime.js`):
  - `toDate(v) => Date|null` (Firestore Timestamp, Date, ISO string, ms)
  - `toMs(v) => number` (0 when missing)
  - `formatClock(v) => { long: string, short: string }|null` (e.g. `{ long: 'THU OCT 1 · 9:58 PM', short: '9:58 PM' }`)
  - `timeAgo(v, now?) => string` (`'just now'`, `'5m ago'`, `'2h ago'`, `'3d ago'`, `''`)
  - `formatEpisodeDate(v) => string` (`'OCT 1'`, `'—'`)
  - `screenClock(mode, { round, hunt, now, isLive }) => { long, short }|null`
- Produces (`huntStats.js`):
  - `huntMode(round) => 'open'|'locked'|'settled'|'offair'`
  - `tabHuntRef(round, live, recent) => { huntId: string|null, summary: object|null, isLive: boolean }`
  - `huntStats(hunt, round) => { bonuses, bonusCount, startCost, totalBet, avgBet, requiredAvg, openedCount, wonSoFar, stillNeedAvg, won, avgMulti, result, bestIndex, nextIndex }` (numbers or `null`; `bonuses` is always an array; indexes `-1` when none)
  - `median(values) => number|null`
  - `formatAvgFigure(x) => string` (`'109.1'`, `'1,204'`, `'—'`), `formatAvg(x) => string` (`'109.1x'`, `'—'`)
  - `quickPicks(startCost) => Array<{ label: 'Half back'|'Break-even'|'Double', value: number }>`
  - `topPrizeText(round) => string|null` (e.g. `'+500 tickets'`, `'+500 tickets + $50 cash'`)
  - `winnerPrizeText(prize) => string|null`
  - `signedMoney(value, currency, opts?) => string` (`'+$1,284.40'`, `'−$375.70'` with U+2212, `'—'`)
  - `ordinal(n) => string` (`'1st'`, `'2nd'`, `'3rd'`, `'11th'`, `'22nd'`)
- Produces (`huntBoard.js`):
  - `guessOf(entry) => number|null`, `entryName(entry) => string` (falls back to `'Viewer'`)
  - `rankEntries(entries, actual) => entries sorted closest first, each with diff`
  - `lineupRows({ mode, entries, round, myId, limit = 10, expanded = false }) => { rows: Row[], total, hiddenCount, pinned: Row|null }` where `Row = { id, twitchId, name, avatar, guess, no, place, off, submittedAt, isMe, winnerPlace }`
  - `guessPosition(entries, myId) => { below, above }|null`
  - `meterModel({ mode, sealed, entries, myEntry, myId, startCost, wonSoFar, round }) => { lo, hi, markers: Array<{ key, label, value, tone, pct, labelAt }>, dots: Array<{ id, value, tone, name, pct }>, count, sealed }|null`
  - `tickerItems(mode, { stats, guessCount, prize, winner, runnerUp, isLive, money, signed }) => string[]`

- [ ] **Step 1: Write the failing tests for time and stats**

Create `src/components/hunts/__tests__/huntStats.test.js`:

```js
import { formatClock, formatEpisodeDate, screenClock, timeAgo, toMs } from '../huntTime';
import {
  formatAvg,
  formatAvgFigure,
  huntMode,
  huntStats,
  median,
  ordinal,
  quickPicks,
  signedMoney,
  tabHuntRef,
  topPrizeText,
  winnerPrizeText,
} from '../huntStats';

const BONUSES = [
  { slot: 'Wanted Dead or a Wild', bet: 0.6, win: 487.2, multiplier: 812 },
  { slot: 'Gates of Olympus', bet: 0.8, win: 33.2, multiplier: 41.5 },
  { slot: 'The Dog House', bet: 0.8, win: 0, multiplier: 0 },
  { slot: 'Sugar Rush', bet: 0.6, win: null, multiplier: null },
];
const ROUND = {
  id: 'r1',
  title: 'Thursday Comm Hunt',
  status: 'open',
  acceptPredictions: true,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h1', totalCost: 2421.82, currency: null, bonusCount: 4 },
  rewards: { tiers: [{ place: 2, tickets: 100, prize: null }, { place: 1, tickets: 500, prize: null }] },
};

describe('huntTime', () => {
  test('formatClock reads a Firestore timestamp, a Date or an ISO string', () => {
    const d = new Date(2026, 9, 1, 21, 58);
    expect(formatClock(d)).toEqual({ long: 'THU OCT 1 · 9:58 PM', short: '9:58 PM' });
    expect(formatClock({ toDate: () => d })).toEqual(formatClock(d));
    expect(formatClock(d.toISOString())).toEqual(formatClock(d));
    expect(formatClock(null)).toBeNull();
    expect(formatClock('not a date')).toBeNull();
  });

  test('timeAgo buckets', () => {
    const now = 10 * 60 * 60 * 1000;
    expect(timeAgo(now - 20 * 1000, now)).toBe('just now');
    expect(timeAgo(now - 5 * 60 * 1000, now)).toBe('5m ago');
    expect(timeAgo(now - 2 * 60 * 60 * 1000, now)).toBe('2h ago');
    expect(timeAgo(null, now)).toBe('');
  });

  test('toMs and formatEpisodeDate tolerate missing values', () => {
    expect(toMs(undefined)).toBe(0);
    expect(toMs({ toMillis: () => 5, toDate: () => new Date(5) })).toBe(5);
    expect(formatEpisodeDate(new Date(2026, 8, 27))).toBe('SEP 27');
    expect(formatEpisodeDate(null)).toBe('—');
  });

  test('screenClock: live clock while running, settledAt once settled, hunt end off air', () => {
    const now = new Date(2026, 9, 1, 21, 58).getTime();
    expect(screenClock('open', { now }).short).toBe('9:58 PM');
    expect(screenClock('settled', { round: { settledAt: new Date(2026, 9, 1, 23, 42) } }).short).toBe('11:42 PM');
    expect(screenClock('settled', { round: {} })).toBeNull();
    expect(screenClock('offair', { hunt: { endedAt: '2026-09-27T03:00:00Z' }, isLive: false })).not.toBeNull();
    expect(screenClock('tuning', { now })).toBeNull();
  });
});

describe('huntMode and tabHuntRef', () => {
  test('mode follows status, and rounds without predictions are off air', () => {
    expect(huntMode(null)).toBe('offair');
    expect(huntMode({ ...ROUND, acceptPredictions: false })).toBe('offair');
    expect(huntMode(ROUND)).toBe('open');
    expect(huntMode({ ...ROUND, status: 'locked' })).toBe('locked');
    expect(huntMode({ ...ROUND, status: 'settled' })).toBe('settled');
  });

  test('the round hunt comes from the live poll, else the recent list, else by id only', () => {
    const live = { id: 'h1', bonuses: BONUSES };
    expect(tabHuntRef(ROUND, live, [])).toEqual({ huntId: 'h1', summary: live, isLive: true });
    expect(tabHuntRef(ROUND, null, [{ id: 'h1' }])).toEqual({ huntId: 'h1', summary: { id: 'h1' }, isLive: false });
    expect(tabHuntRef(ROUND, null, [])).toEqual({ huntId: 'h1', summary: null, isLive: false });
  });

  test('manual rounds have no hunt; off air uses live, else the newest', () => {
    expect(tabHuntRef({ ...ROUND, source: 'manual' }, { id: 'x' }, [])).toEqual({ huntId: null, summary: null, isLive: false });
    expect(tabHuntRef(null, null, [{ id: 'a' }, { id: 'b' }]).huntId).toBe('a');
    expect(tabHuntRef(null, { id: 'live' }, [{ id: 'a' }])).toEqual({ huntId: 'live', summary: { id: 'live' }, isLive: true });
    expect(tabHuntRef(null, null, [])).toEqual({ huntId: null, summary: null, isLive: false });
  });
});

describe('huntStats', () => {
  test('required avg, opening progress, best hit and next up', () => {
    const s = huntStats({ id: 'h1', bonuses: BONUSES }, ROUND);
    expect(s.startCost).toBe(2421.82);
    expect(s.totalBet).toBe(2.8);
    expect(s.avgBet).toBe(0.7);
    expect(s.requiredAvg).toBeCloseTo(864.94, 2);
    expect(s.openedCount).toBe(3);
    expect(s.bonusCount).toBe(4);
    expect(s.wonSoFar).toBe(520.4);
    expect(s.stillNeedAvg).toBeCloseTo((2421.82 - 520.4) / 0.6, 6);
    expect(s.bestIndex).toBe(0);
    expect(s.nextIndex).toBe(3);
  });

  // Review Focus 4: degenerate hunts never produce NaN or Infinity.
  test('no bonuses, potless and manual rounds give nulls, not NaN', () => {
    const s = huntStats(null, { ...ROUND, source: 'manual', manualTotalCost: '' });
    expect(s.bonuses).toEqual([]);
    expect(s.startCost).toBeNull();
    expect(s.totalBet).toBeNull();
    expect(s.requiredAvg).toBeNull();
    expect(s.stillNeedAvg).toBeNull();
    expect(s.result).toBeNull();
    expect(s.bestIndex).toBe(-1);
    expect(s.nextIndex).toBe(-1);
    const potless = huntStats({ pot: 0, totalWon: 50, bonuses: [] }, null);
    expect(potless.startCost).toBeNull();
    expect(potless.result).toBeNull();
  });

  test('everything opened: still-need avg is null, a hunt of duds has no best hit', () => {
    const allOpen = BONUSES.slice(0, 3);
    expect(huntStats({ bonuses: allOpen }, ROUND).stillNeedAvg).toBeNull();
    const duds = [{ bet: 1, win: 0, multiplier: 0 }];
    expect(huntStats({ bonuses: duds }, ROUND).bestIndex).toBe(-1);
  });

  test('a settled round reports the actual payout as won, with result and avg multi', () => {
    const s = huntStats({ bonuses: BONUSES.slice(0, 3), averageMultiple: null }, { ...ROUND, status: 'settled', actual: { payout: 2046.12 } });
    expect(s.won).toBe(2046.12);
    expect(s.result).toBe(-375.7);
    expect(s.avgMulti).toBeCloseTo(2046.12 / 2.2, 6);
  });

  test('off air (no round) uses the hunt pot and total won', () => {
    const s = huntStats({ pot: 3103.62, totalWon: 1318.8, averageMultiple: 30.44, bonusCount: 18 }, null);
    expect(s.startCost).toBe(3103.62);
    expect(s.won).toBe(1318.8);
    expect(s.result).toBe(-1784.82);
    expect(s.avgMulti).toBe(30.44);
    expect(s.bonusCount).toBe(18);
  });
});

describe('formatting helpers', () => {
  test('median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1855, 3663, 3100, 2777, 2122, 3333])).toBe(2938.5);
    expect(median([null, NaN])).toBeNull();
  });

  test('averages', () => {
    expect(formatAvgFigure(109.09)).toBe('109.1');
    expect(formatAvg(109.09)).toBe('109.1x');
    expect(formatAvg(1204.4)).toBe('1,204x');
    expect(formatAvg(null)).toBe('—');
  });

  test('quick picks spread around the start cost', () => {
    expect(quickPicks(150000)).toEqual([
      { label: 'Half back', value: 75000 },
      { label: 'Break-even', value: 150000 },
      { label: 'Double', value: 300000 },
    ]);
    expect(quickPicks(0)).toEqual([]);
  });

  test('prize text for the top tier and for winners', () => {
    expect(topPrizeText(ROUND)).toBe('+500 tickets');
    expect(topPrizeText({ rewards: { tiers: [{ place: 1, tickets: 500, prize: { kind: 'cash', amount: 50 } }] } })).toBe('+500 tickets + $50 cash');
    expect(topPrizeText({ rewards: { type: 'cash', tiers: [{ place: 1, tickets: 100, cashLabel: '$20' }] } })).toBe('$20');
    expect(topPrizeText(null)).toBeNull();
    expect(winnerPrizeText({ tickets: 500, label: null })).toBe('+500 tickets');
    expect(winnerPrizeText({ tickets: 0, label: 'Bonus buy $20' })).toBe('Bonus buy $20');
    expect(winnerPrizeText(null)).toBeNull();
  });

  test('signedMoney and ordinal', () => {
    expect(signedMoney(1284.4, null)).toBe('+$1,284.40');
    expect(signedMoney(-375.7, null)).toBe('−$375.70');
    expect(signedMoney(-191.12, null, { decimals: 0 })).toBe('−$191');
    expect(signedMoney(null, null)).toBe('—');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
});
```

- [ ] **Step 2: Run the stats tests to see them fail**

Run: `npm test -- --watchAll=false --testPathPattern=huntStats`
Expected: FAIL with "Cannot find module '../huntTime'".

- [ ] **Step 3: Write `huntTime.js`**

Create `src/components/hunts/huntTime.js`:

```js
// Date helpers for the Hunts tab. Rounds carry Firestore Timestamps, hunts ISO
// strings, fixtures plain Dates; all of them go through toDate.

export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toMs(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  const d = toDate(value);
  return d ? d.getTime() : 0;
}

// "THU OCT 1 · 9:58 PM" / "9:58 PM". Newer ICU puts a narrow no-break space
// before PM; collapse it so the clock reads (and tests) the same everywhere.
export function formatClock(value) {
  const d = toDate(value);
  if (!d) return null;
  const day = d
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '');
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s+/g, ' ');
  return { long: `${day} · ${time}`.toUpperCase(), short: time.toUpperCase() };
}

export function timeAgo(value, now = Date.now()) {
  const ms = toMs(value);
  if (!ms) return '';
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatEpisodeDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '—';
}

// The monitor's clock: live while a round or hunt is running, the settle time
// once settled, the hunt's end for an off-air replay.
export function screenClock(mode, { round, hunt, now, isLive } = {}) {
  if (mode === 'open' || mode === 'locked' || (mode === 'offair' && isLive)) return formatClock(now);
  if (mode === 'settled') return formatClock(round && round.settledAt);
  if (mode === 'offair') return formatClock(hunt && (hunt.endedAt || hunt.startedAt));
  return null;
}
```

- [ ] **Step 4: Write `huntStats.js`**

Create `src/components/hunts/huntStats.js`:

```js
import { roundTotalCost } from '../../utils/predictionRound';
import { prizeLabel, winnerPrizeLabel } from '../../utils/predictionRewards';
import { formatMoney } from '../../utils/money';

// Pure money and state derivations for the Hunts tab (spec "Derivations").
// Every figure is a finite number or null, never NaN or Infinity.

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
const round2 = (n) => Math.round(n * 100) / 100;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const isOpened = (b) => !!b && num(b.win) != null;

export function huntMode(round) {
  if (!round || !round.acceptPredictions) return 'offair';
  if (round.status === 'open') return 'open';
  if (round.status === 'locked') return 'locked';
  if (round.status === 'settled') return 'settled';
  return 'offair';
}

// The communityhunts hunt the tab talks about: the round's snapshot hunt, or
// off air the live hunt, else the newest. `summary` is what the overview poll
// has for it (the live poll carries bonuses, recent summaries don't).
export function tabHuntRef(round, live, recent) {
  const list = Array.isArray(recent) ? recent : [];
  if (huntMode(round) === 'offair') {
    const hunt = live || list[0] || null;
    return { huntId: hunt ? hunt.id : null, summary: hunt, isLive: !!live };
  }
  const snap = round.bonusHuntSnapshot;
  const huntId = (round.source === 'communityhunts' && snap && snap.huntId) || null;
  if (!huntId) return { huntId: null, summary: null, isLive: false };
  if (live && live.id === huntId) return { huntId, summary: live, isLive: true };
  return { huntId, summary: list.find((h) => h.id === huntId) || null, isLive: false };
}

export function huntStats(hunt, round) {
  const bonuses = hunt && Array.isArray(hunt.bonuses) ? hunt.bonuses : [];
  const roundCost = roundTotalCost(round);
  const pot = num(hunt && hunt.pot);
  const startCost = roundCost > 0 ? roundCost : pot != null && pot > 0 ? pot : null;

  const bets = bonuses.map((b) => num(b && b.bet)).filter((n) => n != null && n > 0);
  const totalBet = bets.length ? round2(sum(bets)) : null;
  const opened = bonuses.filter(isOpened);
  const huntWon = num(hunt && hunt.totalWon);
  const wonSoFar = bonuses.length ? round2(sum(opened.map((b) => num(b.win)))) : huntWon;
  const remainingBet = round2(sum(bonuses.filter((b) => !isOpened(b)).map((b) => num(b && b.bet) || 0)));
  const snapCount = round && round.bonusHuntSnapshot && round.bonusHuntSnapshot.bonusCount;
  const bonusCount = bonuses.length || num(hunt && hunt.bonusCount) || num(snapCount) || null;

  const actual = round && round.status === 'settled' ? num(round.actual && round.actual.payout) : null;
  const won = actual != null ? actual : huntWon;

  let bestIndex = -1;
  let bestMulti = 0;
  bonuses.forEach((b, i) => {
    const m = num(b && b.multiplier);
    if (isOpened(b) && m != null && m > bestMulti) {
      bestMulti = m;
      bestIndex = i;
    }
  });

  const huntAvg = num(hunt && hunt.averageMultiple);
  return {
    bonuses,
    bonusCount,
    startCost,
    totalBet,
    avgBet: totalBet != null ? round2(totalBet / bets.length) : null,
    requiredAvg: startCost != null && totalBet ? startCost / totalBet : null,
    openedCount: opened.length,
    wonSoFar,
    stillNeedAvg: startCost != null && remainingBet > 0 ? Math.max(0, startCost - (wonSoFar || 0)) / remainingBet : null,
    won,
    avgMulti: huntAvg != null ? huntAvg : won != null && totalBet ? won / totalBet : null,
    result: won != null && startCost != null ? round2(won - startCost) : null,
    bestIndex,
    nextIndex: bonuses.findIndex((b) => !isOpened(b)),
  };
}

export function median(values) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export function formatAvgFigure(x) {
  if (x == null || !Number.isFinite(x)) return '—';
  return x >= 1000 ? Math.round(x).toLocaleString('en-US') : x.toFixed(1);
}

export function formatAvg(x) {
  const figure = formatAvgFigure(x);
  return figure === '—' ? figure : `${figure}x`;
}

// Guesses either side of the start cost: paying back half is as normal as doubling.
export function quickPicks(startCost) {
  const c = Number(startCost) || 0;
  if (c <= 0) return [];
  return [
    { label: 'Half back', value: Math.round(c / 2) },
    { label: 'Break-even', value: round2(c) },
    { label: 'Double', value: Math.round(c * 2) },
  ];
}

function sortedTiers(round) {
  return ((round && round.rewards && round.rewards.tiers) || []).slice().sort((a, b) => a.place - b.place);
}

// "+500 tickets", "+500 tickets + $50 cash", "Bonus buy $20". A legacy tier
// (no `prize` key) honours the round's old rewards.type like rewardSummary.
function tierPrizeText(tier, legacyType) {
  if (!tier) return null;
  const legacy = !Object.prototype.hasOwnProperty.call(tier, 'prize');
  const parts = [];
  const tickets = Math.floor(Number(tier.tickets) || 0);
  if (tickets > 0 && !(legacy && legacyType === 'cash')) parts.push(`+${tickets.toLocaleString('en-US')} tickets`);
  if (!(legacy && legacyType === 'tickets')) {
    const label = prizeLabel(tier.prize);
    if (label) parts.push(tier.prize.kind === 'cash' ? `${label} cash` : label);
    else if (tier.cashLabel) parts.push(tier.cashLabel);
  }
  return parts.length ? parts.join(' + ') : null;
}

export function topPrizeText(round) {
  const tiers = sortedTiers(round);
  return tiers.length ? tierPrizeText(tiers[0], round.rewards && round.rewards.type) : null;
}

export function winnerPrizeText(prize) {
  if (!prize) return null;
  const parts = [];
  const tickets = Math.floor(Number(prize.tickets) || 0);
  if (tickets > 0) parts.push(`+${tickets.toLocaleString('en-US')} tickets`);
  const label = winnerPrizeLabel(prize);
  if (label) parts.push(label);
  return parts.length ? parts.join(' + ') : null;
}

export function signedMoney(value, currency, opts) {
  if (value == null || !Number.isFinite(value)) return '—';
  const body = formatMoney(Math.abs(value), currency, opts);
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}

export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}
```

- [ ] **Step 5: Run the stats tests to see them pass**

Run: `npm test -- --watchAll=false --testPathPattern=huntStats`
Expected: PASS.

- [ ] **Step 6: Write the failing board tests**

Create `src/components/hunts/__tests__/huntBoard.test.js`:

```js
import { entryName, guessOf, guessPosition, lineupRows, meterModel, rankEntries, tickerItems } from '../huntBoard';
import { huntStats } from '../huntStats';

const at = (min) => ({ toMillis: () => min * 60 * 1000 });
const entry = (id, payoutGuess, min, extra = {}) => ({
  id,
  twitchId: id,
  displayName: id,
  payoutGuess,
  submittedAt: at(min),
  ...extra,
});

const ENTRIES = [
  entry('skillsytv', 1855, 1),
  entry('G4KUR4', 3663, 2),
  entry('GRUMPZILLA12', 3100, 3),
  entry('RYGARTEARROW', 2777, 4),
  entry('Xilentdrifter', 2122, 5),
  entry('JESSEJEK', 3333, 6),
];
const SETTLED = {
  status: 'settled',
  actual: { payout: 2046.12 },
  winners: [
    { place: 1, twitchId: 'Xilentdrifter' },
    { place: 2, twitchId: 'skillsytv' },
  ],
};

test('guessOf and entryName tolerate malformed entries (Review Focus 3)', () => {
  expect(guessOf({ payoutGuess: '12' })).toBeNull();
  expect(guessOf({ payoutGuess: NaN })).toBeNull();
  expect(guessOf(null)).toBeNull();
  expect(entryName({ twitchName: 'tn' })).toBe('tn');
  expect(entryName({})).toBe('Viewer');
});

test('ranking mirrors pickWinners: closest first, ties to the earlier final guess', () => {
  const tied = [entry('late', 2100, 9, { lastEditAt: at(9) }), entry('early', 1900, 1)];
  expect(rankEntries(tied, 2000).map((e) => e.id)).toEqual(['early', 'late']);
  expect(rankEntries(ENTRIES, 2046.12).map((e) => e.id)).toEqual([
    'Xilentdrifter',
    'skillsytv',
    'RYGARTEARROW',
    'GRUMPZILLA12',
    'JESSEJEK',
    'G4KUR4',
  ]);
});

test('settled lineup: places, signed offsets, winner places from round.winners', () => {
  const { rows, total } = lineupRows({ mode: 'settled', entries: ENTRIES, round: SETTLED, myId: null });
  expect(total).toBe(6);
  expect(rows[0]).toMatchObject({ name: 'Xilentdrifter', place: 1, no: 5, winnerPlace: 1 });
  expect(rows[0].off).toBeCloseTo(75.88, 2);
  expect(rows[1]).toMatchObject({ name: 'skillsytv', place: 2, winnerPlace: 2 });
  expect(rows[1].off).toBeCloseTo(-191.12, 2);
});

test('locked lineup runs low to high and skips entries without a guess', () => {
  const entries = [...ENTRIES, { id: 'broken', twitchId: 'broken' }];
  const { rows, total } = lineupRows({ mode: 'locked', entries, round: { status: 'locked' }, myId: null });
  expect(total).toBe(6);
  expect(rows.map((r) => r.guess)).toEqual([1855, 2122, 2777, 3100, 3333, 3663]);
});

// Review Focus 5: the viewer outside the top 10 is pinned; winner beats viewer.
test('the viewer is pinned under a long list and expanding unpins them', () => {
  const many = Array.from({ length: 14 }, (_, i) => entry(`v${i}`, 1000 + i, i));
  const me = entry('me', 9999, 20);
  const { rows, pinned, hiddenCount } = lineupRows({ mode: 'locked', entries: [...many, me], round: {}, myId: 'me' });
  expect(rows).toHaveLength(10);
  expect(hiddenCount).toBe(5);
  expect(pinned).toMatchObject({ name: 'me', isMe: true });
  const open = lineupRows({ mode: 'locked', entries: [...many, me], round: {}, myId: 'me', expanded: true });
  expect(open.rows).toHaveLength(15);
  expect(open.pinned).toBeNull();
});

test('guessPosition counts others either side', () => {
  const entries = [...ENTRIES, entry('me', 2450, 7)];
  expect(guessPosition(entries, 'me')).toEqual({ below: 2, above: 4 });
  expect(guessPosition(entries, 'nobody')).toBeNull();
});

test('sealed meter: half to one-and-a-half times the start cost, only the viewer dot', () => {
  const m = meterModel({
    mode: 'open',
    sealed: true,
    entries: [],
    myEntry: entry('me', 2450, 1),
    myId: 'me',
    startCost: 2000,
    wonSoFar: null,
    round: { entryCount: 9 },
  });
  expect(m.lo).toBeLessThanOrEqual(1000);
  expect(m.hi).toBeGreaterThanOrEqual(3000);
  expect(m.dots).toEqual([expect.objectContaining({ tone: 'me', value: 2450 })]);
  expect(m.markers.map((x) => x.key)).toEqual(['break-even']);
  expect(m.count).toBe(9);
  expect(m.sealed).toBe(true);
});

test('sealed meter widens for a far-off guess and hides with no cost and no guess', () => {
  const m = meterModel({ mode: 'open', sealed: true, entries: [], myEntry: entry('me', 9000, 1), myId: 'me', startCost: 2000, round: {} });
  expect(m.hi).toBeGreaterThan(9000);
  expect(meterModel({ mode: 'open', sealed: true, entries: [], myEntry: null, myId: null, startCost: null, round: {} })).toBeNull();
});

test('settled meter: actual marker, winner and runner-up tones, others dim; off air has none', () => {
  const m = meterModel({ mode: 'settled', sealed: false, entries: ENTRIES, myEntry: null, myId: null, startCost: 2421.82, round: SETTLED });
  expect(m.markers).toEqual([expect.objectContaining({ key: 'actual', value: 2046.12, tone: 'winner' })]);
  const tones = Object.fromEntries(m.dots.map((d) => [d.id, d.tone]));
  expect(tones).toMatchObject({ Xilentdrifter: 'winner', skillsytv: 'runner', G4KUR4: 'dim' });
  expect(m.dots.every((d) => d.pct >= 0 && d.pct <= 100)).toBe(true);
  expect(meterModel({ mode: 'offair', sealed: false, entries: [], startCost: 1, round: null })).toBeNull();
});

test('locked meter adds a so-far marker under the track', () => {
  const m = meterModel({ mode: 'locked', sealed: false, entries: ENTRIES, myEntry: null, myId: null, startCost: 2421.82, wonSoFar: 883.38, round: {} });
  expect(m.markers.map((x) => [x.key, x.labelAt])).toEqual([['break-even', 'top'], ['so-far', 'bottom']]);
});

test('ticker items per mode', () => {
  const stats = huntStats(
    { bonuses: [{ slot: 'Wanted Dead or a Wild', bet: 0.6, win: 487.2, multiplier: 812 }, { slot: 'Mental', bet: 0.4, win: null }] },
    { status: 'open', source: 'manual', manualTotalCost: 2421.82 }
  );
  const money = (v) => `$${v}`;
  const signed = (v) => `${v}`;
  const open = tickerItems('open', { stats, guessCount: 6, prize: '+500 tickets', money, signed });
  expect(open[0]).toBe('Predictions open');
  expect(open).toContain('6 guesses in');
  expect(open).toContain('Closest guess wins +500 tickets');
  const settled = tickerItems('settled', {
    stats: { ...stats, result: -375.7 },
    guessCount: 6,
    winner: { name: 'Xilentdrifter', prize: '+500 tickets' },
    runnerUp: { name: 'skillsytv', prize: '+100 tickets' },
    money,
    signed,
  });
  expect(settled[0]).toBe('Xilentdrifter takes +500 tickets');
  expect(settled).toContain('Hunt finishes -375.7');
  expect(settled).toContain('Best hit · Wanted Dead or a Wild 812x');
  expect(settled).toContain('Runner-up skillsytv +100 tickets');
  expect(tickerItems('settled', { stats, winner: null, money, signed })[0]).toBe('No eligible guesses');
  expect(tickerItems('offair', { stats, isLive: false, money, signed })).toContain('Predictions open when Goofer starts a round');
});
```

- [ ] **Step 7: Run the board tests to see them fail**

Run: `npm test -- --watchAll=false --testPathPattern=huntBoard`
Expected: FAIL with "Cannot find module '../huntBoard'".

- [ ] **Step 8: Write `huntBoard.js`**

Create `src/components/hunts/huntBoard.js`:

```js
import { toMs } from './huntTime';
import { formatAvg } from './huntStats';
import { formatMultiplier } from '../../utils/huntFormat';

// Pure derivations over a round's entries: ranking, lineup rows, the meter,
// the viewer's position and the chyron items. Entries arrive in submission
// order (the listener orders by submittedAt), so list position is the entry
// number. Entry ids are Twitch ids.

export function guessOf(entry) {
  const v = entry && entry.payoutGuess;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function entryName(entry) {
  return (entry && (entry.displayName || entry.twitchName)) || 'Viewer';
}

const keyOf = (e) => e.twitchId || e.id;
const finalGuessMs = (e) => toMs(e.lastEditAt) || toMs(e.submittedAt);

function winnerPlaces(round) {
  const map = {};
  ((round && round.winners) || []).forEach((w) => {
    if (w && w.twitchId) map[w.twitchId] = w.place;
  });
  return map;
}

function actualOf(round) {
  const v = round && round.actual && round.actual.payout;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// Closest first; a tie goes to whoever settled on their final guess first.
// Mirrors pickWinners in api/_lib/predictions.js.
export function rankEntries(entries, actual) {
  return entries
    .filter((e) => guessOf(e) != null)
    .map((e) => ({ ...e, diff: Math.abs(e.payoutGuess - actual) }))
    .sort((a, b) => a.diff - b.diff || finalGuessMs(a) - finalGuessMs(b));
}

export function lineupRows({ mode, entries, round, myId, limit = 10, expanded = false }) {
  const places = winnerPlaces(round);
  const actual = actualOf(round);
  const numbered = entries.map((e, i) => ({ ...e, no: i + 1 })).filter((e) => guessOf(e) != null);
  const ordered =
    mode === 'settled' && actual != null
      ? rankEntries(numbered, actual).map((e, i) => ({ ...e, place: i + 1, off: e.payoutGuess - actual }))
      : numbered
          .slice()
          .sort((a, b) => a.payoutGuess - b.payoutGuess || a.no - b.no)
          .map((e) => ({ ...e, place: null, off: null }));
  const rows = ordered.map((e) => ({
    id: e.id,
    twitchId: keyOf(e),
    name: entryName(e),
    avatar: e.profileImageUrl || null,
    guess: e.payoutGuess,
    no: e.no,
    place: e.place,
    off: e.off,
    submittedAt: e.lastEditAt || e.submittedAt || null,
    isMe: !!myId && keyOf(e) === myId,
    winnerPlace: places[keyOf(e)] || null,
  }));
  const visible = expanded ? rows : rows.slice(0, limit);
  const mine = rows.find((r) => r.isMe) || null;
  return {
    rows: visible,
    total: rows.length,
    hiddenCount: rows.length - visible.length,
    pinned: mine && !visible.includes(mine) ? mine : null,
  };
}

export function guessPosition(entries, myId) {
  const mine = entries.find((e) => keyOf(e) === myId);
  const g = guessOf(mine);
  if (g == null) return null;
  let below = 0;
  let above = 0;
  entries.forEach((e) => {
    if (keyOf(e) === myId) return;
    const v = guessOf(e);
    if (v == null) return;
    if (v < g) below += 1;
    else if (v > g) above += 1;
  });
  return { below, above };
}

const DOT_ORDER = { dim: 0, open: 0, runner: 1, winner: 2, me: 3 };

export function meterModel({ mode, sealed, entries, myEntry, myId, startCost, wonSoFar, round }) {
  if (mode === 'offair' || mode === 'tuning') return null;
  const places = winnerPlaces(round);
  const myGuess = guessOf(myEntry);

  const points = sealed
    ? myGuess != null
      ? [{ id: myId || 'me', value: myGuess, tone: 'me', name: 'You' }]
      : []
    : entries
        .filter((e) => guessOf(e) != null)
        .map((e) => {
          const place = places[keyOf(e)];
          const tone =
            place === 1 ? 'winner' : place === 2 ? 'runner' : keyOf(e) === myId ? 'me' : mode === 'settled' ? 'dim' : 'open';
          return { id: e.id, value: e.payoutGuess, tone, name: entryName(e) };
        });

  const markers = [];
  if (mode === 'settled') {
    const actual = actualOf(round);
    if (actual != null) markers.push({ key: 'actual', label: 'Actual', value: actual, tone: 'winner', labelAt: 'top' });
  } else {
    if (startCost) markers.push({ key: 'break-even', label: 'Break-even', value: startCost, tone: 'signal', labelAt: 'top' });
    if (mode === 'locked' && wonSoFar) markers.push({ key: 'so-far', label: 'So far', value: wonSoFar, tone: 'muted', labelAt: 'bottom' });
  }

  const values = [...points.map((p) => p.value), ...markers.map((m) => m.value)];
  if (sealed) {
    const base = startCost || myGuess;
    if (!base) return null;
    values.push(base * 0.5, base * 1.5);
  }
  if (!values.length) return null;

  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.05, hi * 0.02, 1);
  lo = Math.max(0, lo - pad);
  hi += pad;
  const pct = (v) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));

  return {
    lo,
    hi,
    markers: markers.map((m) => ({ ...m, pct: pct(m.value) })),
    dots: points.map((p) => ({ ...p, pct: pct(p.value) })).sort((a, b) => DOT_ORDER[a.tone] - DOT_ORDER[b.tone]),
    count: sealed ? (round && round.entryCount) || points.length : points.length,
    sealed: !!sealed,
  };
}

// Chyron items, sentence case (the Monitor uppercases them with CSS so screen
// readers get words, not letters).
export function tickerItems(mode, { stats, guessCount = 0, prize = null, winner = null, runnerUp = null, isLive = false, money, signed }) {
  const items = [];
  const add = (cond, text) => {
    if (cond) items.push(text);
  };
  const best = stats.bestIndex >= 0 ? stats.bonuses[stats.bestIndex] : null;
  const bestText = best ? `${best.slot} ${formatMultiplier(best.multiplier)}` : null;
  const progress = stats.bonuses.length > 0 && stats.bonusCount;
  const guesses = `${guessCount} ${guessCount === 1 ? 'guess' : 'guesses'}`;

  if (mode === 'open') {
    add(true, 'Predictions open');
    const docket = [stats.bonusCount && `${stats.bonusCount} bonuses`, stats.startCost != null && `start cost ${money(stats.startCost)}`]
      .filter(Boolean)
      .join(' · ');
    add(docket, docket);
    add(true, `${guesses} in`);
    add(stats.requiredAvg != null, `Required avg · ${formatAvg(stats.requiredAvg)}`);
    add(prize, `Closest guess wins ${prize}`);
    add(true, 'Get your guess in before Goofer closes entries');
  } else if (mode === 'locked') {
    add(true, 'Entries closed');
    add(progress, `${stats.openedCount}/${stats.bonusCount} opened`);
    add(stats.wonSoFar != null, `Won so far ${money(stats.wonSoFar)}`);
    add(bestText, `Best hit so far · ${bestText}`);
    add(stats.stillNeedAvg != null, `Still need ${formatAvg(stats.stillNeedAvg)} avg`);
    add(true, 'Results when the last bonus opens');
  } else if (mode === 'settled') {
    add(true, winner ? `${winner.name} takes ${winner.prize || 'the round'}` : 'No eligible guesses');
    add(stats.result != null, `Hunt finishes ${signed(stats.result)}`);
    add(bestText, `Best hit · ${bestText}`);
    add(runnerUp, runnerUp && `Runner-up ${runnerUp.name}${runnerUp.prize ? ` ${runnerUp.prize}` : ''}`);
  } else {
    add(true, isLive ? 'Hunt in progress' : 'No round open');
    add(isLive && progress, `${stats.openedCount}/${stats.bonusCount} opened`);
    add(isLive && stats.wonSoFar != null, `Won so far ${money(stats.wonSoFar)}`);
    add(!isLive && stats.result != null, `Last hunt ${signed(stats.result)}`);
    add(bestText, `Best hit · ${bestText}`);
    add(true, 'Predictions open when Goofer starts a round');
  }
  return items;
}
```

- [ ] **Step 9: Run both test files to see them pass**

Run: `npm test -- --watchAll=false --testPathPattern="huntStats|huntBoard"`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add src/components/hunts/huntTime.js src/components/hunts/huntStats.js src/components/hunts/huntBoard.js src/components/hunts/__tests__/huntStats.test.js src/components/hunts/__tests__/huntBoard.test.js && git commit -m "feat(hunts): pure derivations for the On Air tab"
```

---

### Task 5: Data hooks

**Files:**
- Create: `src/components/hunts/usePredictionRound.js`, `src/components/hunts/useRoundEntries.js`, `src/components/hunts/useMyEntry.js`, `src/components/hunts/useHunt.js`, `src/components/hunts/useNow.js`
- Test: `src/components/hunts/__tests__/huntHooks.test.js`

**Interfaces:**
- Consumes: `db` (`src/config/firebase`), `useAuth` (`src/contexts/AuthContext`, `{ isStaff }`), `entriesSealed` (`src/utils/predictionRound.js`).
- Produces:
  - `usePredictionRound() => round|null|undefined` (`undefined` until the first snapshot)
  - `useRoundEntries(round) => { entries: Entry[], sealed: boolean }` (sealed also when access was denied)
  - `useMyEntry(roundId, twitchId) => Entry|null`
  - `useHunt(huntId, summary) => { hunt: object|null, loading: boolean, error: string|null }`; `__resetHuntCacheForTests()`
  - `useNow(intervalMs, enabled = true) => number` (ms)

- [ ] **Step 1: Write the failing tests**

Create `src/components/hunts/__tests__/huntHooks.test.js`:

```js
import { act, render, waitFor } from '@testing-library/react';
import { doc, onSnapshot } from 'firebase/firestore';
import useRoundEntries from '../useRoundEntries';
import useMyEntry from '../useMyEntry';
import usePredictionRound from '../usePredictionRound';
import useHunt, { __resetHuntCacheForTests } from '../useHunt';

jest.mock('../../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: jest.fn(() => ({})),
  query: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: jest.fn(),
}));
let mockIsStaff = false;
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ isStaff: mockIsStaff }),
}));

function Probe({ hook, onValue }) {
  onValue(hook());
  return null;
}

const ROUND = { id: 'r1', status: 'open', acceptPredictions: true, entryCount: 37, source: 'manual' };

beforeEach(() => {
  mockIsStaff = false;
  onSnapshot.mockReset();
  onSnapshot.mockImplementation(() => () => {});
  doc.mockClear();
  __resetHuntCacheForTests();
});

describe('useRoundEntries (sealing guarantees)', () => {
  test('viewers never query entries while the round is open', () => {
    let value;
    render(<Probe hook={() => useRoundEntries(ROUND)} onValue={(v) => { value = v; }} />);
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(value).toEqual({ entries: [], sealed: true });
  });

  test('staff subscribe while open', () => {
    mockIsStaff = true;
    render(<Probe hook={() => useRoundEntries(ROUND)} onValue={() => {}} />);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  test('the listener starts once the round locks and delivers entries', () => {
    onSnapshot.mockImplementation((q, next) => {
      next({ docs: [{ id: 'a', data: () => ({ payoutGuess: 10 }) }] });
      return () => {};
    });
    let value;
    render(<Probe hook={() => useRoundEntries({ ...ROUND, status: 'locked' })} onValue={(v) => { value = v; }} />);
    expect(value).toEqual({ entries: [{ id: 'a', payoutGuess: 10 }], sealed: false });
  });

  // Review Focus 2: an admin re-opens a locked round.
  test('re-opening a locked round unsubscribes and reseals', () => {
    const unsub = jest.fn();
    onSnapshot.mockImplementation(() => unsub);
    let value;
    const { rerender } = render(<Probe hook={() => useRoundEntries({ ...ROUND, status: 'locked' })} onValue={(v) => { value = v; }} />);
    rerender(<Probe hook={() => useRoundEntries(ROUND)} onValue={(v) => { value = v; }} />);
    expect(unsub).toHaveBeenCalledTimes(1);
    expect(value.sealed).toBe(true);
  });

  test('a permission error counts as sealed', () => {
    onSnapshot.mockImplementation((q, next, error) => {
      error(new Error('permission-denied'));
      return () => {};
    });
    let value;
    render(<Probe hook={() => useRoundEntries({ ...ROUND, status: 'locked' })} onValue={(v) => { value = v; }} />);
    expect(value.sealed).toBe(true);
  });
});

test('useMyEntry listens to hunts/{id}/entries/{twitchId}', () => {
  onSnapshot.mockImplementation((ref, next) => {
    next({ exists: () => true, id: 'viewer1', data: () => ({ payoutGuess: 2450 }) });
    return () => {};
  });
  let value;
  render(<Probe hook={() => useMyEntry('r1', 'viewer1')} onValue={(v) => { value = v; }} />);
  expect(doc).toHaveBeenCalledWith({}, 'hunts', 'r1', 'entries', 'viewer1');
  expect(value).toEqual({ id: 'viewer1', payoutGuess: 2450 });
});

test('usePredictionRound is undefined until the first snapshot, then the round or null', () => {
  let push;
  onSnapshot.mockImplementation((q, next) => {
    push = next;
    return () => {};
  });
  const seen = [];
  render(<Probe hook={usePredictionRound} onValue={(v) => seen.push(v)} />);
  expect(seen[0]).toBeUndefined();
  act(() => push({ empty: true, docs: [] }));
  expect(seen[seen.length - 1]).toBeNull();
});

describe('useHunt', () => {
  test('a summary that already carries bonuses is used as is', () => {
    global.fetch = jest.fn();
    let value;
    const live = { id: 'h1', bonuses: [] };
    render(<Probe hook={() => useHunt('h1', live)} onValue={(v) => { value = v; }} />);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(value).toEqual({ hunt: live, loading: false, error: null });
  });

  test('otherwise the detail is fetched once and cached', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ hunt: { id: 'h2', bonuses: [{ slot: 'Pug Life' }] } }) })
    );
    let value;
    const { unmount } = render(<Probe hook={() => useHunt('h2', { id: 'h2' })} onValue={(v) => { value = v; }} />);
    expect(value).toEqual({ hunt: { id: 'h2' }, loading: true, error: null });
    await waitFor(() => expect(value.hunt.bonuses).toHaveLength(1));
    expect(global.fetch).toHaveBeenCalledWith('/api/communityhunts?view=hunt&id=h2');
    unmount();
    render(<Probe hook={() => useHunt('h2', { id: 'h2' })} onValue={(v) => { value = v; }} />);
    expect(value.hunt.bonuses).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('a failed fetch reports an error and keeps the summary', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
    let value;
    render(<Probe hook={() => useHunt('h3', { id: 'h3' })} onValue={(v) => { value = v; }} />);
    await waitFor(() => expect(value.error).toBe('Could not load this hunt’s bonuses.'));
    expect(value.hunt).toEqual({ id: 'h3' });
    expect(value.loading).toBe(false);
  });

  test('no hunt id returns the summary without fetching', () => {
    global.fetch = jest.fn();
    let value;
    render(<Probe hook={() => useHunt(null, null)} onValue={(v) => { value = v; }} />);
    expect(value).toEqual({ hunt: null, loading: false, error: null });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- --watchAll=false --testPathPattern=huntHooks`
Expected: FAIL with "Cannot find module '../useRoundEntries'".

- [ ] **Step 3: Write the hooks**

Create `src/components/hunts/usePredictionRound.js`:

```js
import { useEffect, useState } from 'react';
import { collection, limit as fLimit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The latest prediction round (a settled one lingers until the next opens).
// undefined until the first snapshot lands, then the round or null, so the
// tab can tell "still tuning" from "off air".
export default function usePredictionRound() {
  const [round, setRound] = useState(undefined);
  useEffect(() => {
    const q = query(collection(db, 'hunts'), orderBy('createdAt', 'desc'), fLimit(1));
    return onSnapshot(
      q,
      (snap) => setRound(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setRound(null)
    );
  }, []);
  return round;
}
```

Create `src/components/hunts/useRoundEntries.js`:

```js
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { entriesSealed } from '../../utils/predictionRound';

// The Hunts tab's one entries listener (the lineup and the meter share it).
// While a round is open, firestore.rules hide entries from viewers, so a
// viewer never queries them; a denied read (round re-opened before this
// listener caught up) also counts as sealed.
export default function useRoundEntries(round) {
  const { isStaff } = useAuth();
  const sealed = entriesSealed(round, isStaff);
  const id = round && round.id;
  const enabled = !!id && !!(round && round.acceptPredictions) && !sealed;
  const [state, setState] = useState({ entries: [], denied: false });

  useEffect(() => {
    setState({ entries: [], denied: false });
    if (!enabled) return undefined;
    const q = query(collection(db, 'hunts', id, 'entries'), orderBy('submittedAt', 'asc'));
    return onSnapshot(
      q,
      (snap) => setState({ entries: snap.docs.map((d) => ({ id: d.id, ...d.data() })), denied: false }),
      () => setState({ entries: [], denied: true })
    );
  }, [id, enabled]);

  return { entries: state.entries, sealed: sealed || state.denied };
}
```

Create `src/components/hunts/useMyEntry.js`:

```js
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The viewer's own entry (hunts/{roundId}/entries/{twitchId}). Its owner can
// always read it, sealed round or not.
export default function useMyEntry(roundId, twitchId) {
  const [entry, setEntry] = useState(null);
  useEffect(() => {
    setEntry(null);
    if (!roundId || !twitchId) return undefined;
    return onSnapshot(
      doc(db, 'hunts', roundId, 'entries', twitchId),
      (snap) => setEntry(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setEntry(null)
    );
  }, [roundId, twitchId]);
  return entry;
}
```

Create `src/components/hunts/useHunt.js`:

```js
import { useEffect, useState } from 'react';

// A communityhunts hunt with its bonuses. The live poll already carries them;
// any other hunt (a finished round's hunt, a past episode) is fetched once from
// /api/communityhunts?view=hunt and kept for the page session.
const cache = new Map();

export function __resetHuntCacheForTests() {
  cache.clear();
}

export default function useHunt(huntId, summary) {
  const hasBonuses = !!(summary && Array.isArray(summary.bonuses));
  const [state, setState] = useState({ detail: null, error: null });

  useEffect(() => {
    if (!huntId || hasBonuses) return undefined;
    if (cache.has(huntId)) {
      setState({ detail: cache.get(huntId), error: null });
      return undefined;
    }
    setState({ detail: null, error: null });
    let cancelled = false;
    fetch(`/api/communityhunts?view=hunt&id=${encodeURIComponent(huntId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.hunt) throw new Error('Failed');
        cache.set(huntId, data.hunt);
        if (!cancelled) setState({ detail: data.hunt, error: null });
      })
      .catch(() => {
        if (!cancelled) setState({ detail: null, error: 'Could not load this hunt’s bonuses.' });
      });
    return () => {
      cancelled = true;
    };
  }, [huntId, hasBonuses]);

  if (!huntId) return { hunt: summary || null, loading: false, error: null };
  if (hasBonuses) return { hunt: summary, loading: false, error: null };
  const cached = cache.get(huntId) || null;
  const detail = state.detail && state.detail.id === huntId ? state.detail : cached;
  return { hunt: detail || summary || null, loading: !detail && !state.error, error: detail ? null : state.error };
}
```

Create `src/components/hunts/useNow.js`:

```js
import { useEffect, useState } from 'react';

// A clock that ticks every intervalMs while enabled (the monitor's live clock
// and the lineup's "5m ago").
export default function useNow(intervalMs, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- --watchAll=false --testPathPattern=huntHooks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add src/components/hunts/usePredictionRound.js src/components/hunts/useRoundEntries.js src/components/hunts/useMyEntry.js src/components/hunts/useHunt.js src/components/hunts/useNow.js src/components/hunts/__tests__/huntHooks.test.js && git commit -m "feat(hunts): one sealed entries listener and the tab's data hooks"
```

---

### Task 6: HuntMonitor, HuntMeter and ViewerAvatar

**Files:**
- Create: `src/components/hunts/ViewerAvatar.js`, `src/components/hunts/HuntMeter.js`, `src/components/hunts/HuntMonitor.js`
- Test: `src/components/hunts/__tests__/HuntMonitor.test.js`

**Interfaces:**
- Consumes: `Monitor`, `Chip`, `MONO`, `fitFigure` (Tasks 2–3); `formatAvgFigure`, `formatAvg`, `signedMoney`, `winnerPrizeText` (Task 4); `entryName` (Task 4); `formatMoney`, `formatMoneyCompact` (`src/utils/money.js`).
- Produces:
  - `<ViewerAvatar src name className />` (img with initial fallback on error)
  - `<HuntMeter meter currency />` (`role="img"` with a text summary)
  - `<HuntMonitor mode round stats meter currency guessCount prize winner chatMedian offair clock ticker phrase />` where `mode` is `'tuning'|'open'|'locked'|'settled'|'offair'`, `offair = { isLive: boolean, hasHunt: boolean, title: string|null }`, `winner` is the place-1 winner record or null.

- [ ] **Step 1: Write the failing tests**

Create `src/components/hunts/__tests__/HuntMonitor.test.js`:

```js
import { fireEvent, render, screen } from '@testing-library/react';
import HuntMonitor from '../HuntMonitor';
import { huntStats } from '../huntStats';

const ROUND = {
  id: 'r1',
  title: 'Thursday Comm Hunt',
  status: 'open',
  acceptPredictions: true,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h1', totalCost: 2421.82, currency: null, bonusCount: 3 },
};
const BONUSES = [
  { slot: 'Wanted Dead or a Wild', bet: 0.6, win: 487.2, multiplier: 812 },
  { slot: 'Gates of Olympus', bet: 0.8, win: 33.2, multiplier: 41.5 },
  { slot: 'Sugar Rush', bet: 0.6, win: null, multiplier: null },
];
const BASE = {
  currency: null,
  guessCount: 6,
  prize: '+500 tickets',
  winner: null,
  chatMedian: null,
  offair: { isLive: false, hasHunt: true, title: 'Community hunt' },
  clock: { long: 'THU OCT 1 · 9:58 PM', short: '9:58 PM' },
  ticker: ['Predictions open'],
  meter: null,
};

function renderMonitor(props) {
  return render(<HuntMonitor {...BASE} {...props} />);
}

test('open: required avg hero, side stats, chips and the open readout', () => {
  const stats = huntStats({ bonuses: BONUSES.map((b) => ({ ...b, win: null, multiplier: null })) }, ROUND);
  renderMonitor({ mode: 'open', round: ROUND, stats });
  expect(screen.getByText(/Thursday Comm Hunt · Predictions open/i)).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'What does the hunt pay?' })).toBeTruthy();
  expect(screen.getByText('1,211')).toBeTruthy();
  expect(screen.getByText('Required avg to break even')).toBeTruthy();
  expect(screen.getByText('Total bet')).toBeTruthy();
  expect(screen.getByText((_, el) => el.tagName === 'SPAN' && el.textContent === '6 guesses in')).toBeTruthy();
  expect(screen.getByText('Closest takes +500 tickets')).toBeTruthy();
  expect(screen.getByText('CH 02 · Entries open')).toBeTruthy();
  expect(screen.getByText('Live')).toBeTruthy();
});

test('open without bets falls back to the start cost as break-even', () => {
  const stats = huntStats(null, { ...ROUND, source: 'manual', manualTotalCost: 2421.82 });
  renderMonitor({ mode: 'open', round: ROUND, stats });
  expect(screen.getByText('$2,421.82')).toBeTruthy();
  expect(screen.getByText('Break-even')).toBeTruthy();
});

test('locked: won so far with progress, still-need avg and chat median', () => {
  const round = { ...ROUND, status: 'locked' };
  const stats = huntStats({ bonuses: BONUSES }, round);
  renderMonitor({ mode: 'locked', round, stats, chatMedian: 2938.5 });
  expect(screen.getByText(/Entries closed · Opening bonuses/i)).toBeTruthy();
  expect(screen.getByText('$520.40')).toBeTruthy();
  expect(screen.getByText('Won so far · 2/3 opened')).toBeTruthy();
  expect(screen.getByText('Chat median')).toBeTruthy();
  expect(screen.getByText('$2,938.50')).toBeTruthy();
  expect(screen.getAllByText('CH 02 · Entries closed').length).toBeGreaterThan(0);
});

test('settled: the winner reveal with guessed, actual and prize chips', () => {
  const round = { ...ROUND, status: 'settled', actual: { payout: 2046.12 } };
  const winner = { place: 1, twitchId: 'x', displayName: 'Xilentdrifter', payoutGuess: 2122, profileImageUrl: 'https://img/x.png', prize: { tickets: 500 } };
  const { container } = renderMonitor({ mode: 'settled', round, stats: huntStats({ bonuses: BONUSES }, round), winner });
  expect(screen.getByText(/And the closest guess is/i)).toBeTruthy();
  expect(screen.getByText('Xilentdrifter')).toBeTruthy();
  expect(screen.getByText('$2,122')).toBeTruthy();
  expect(screen.getByText('$2,046.12')).toBeTruthy();
  expect(screen.getByText('+500 tickets')).toBeTruthy();
  expect(screen.getByText('Replay')).toBeTruthy();
  fireEvent.error(container.querySelector('img'));
  expect(screen.getByText('X')).toBeTruthy();
});

test('settled without winners shows the payout and no eligible guesses', () => {
  const round = { ...ROUND, status: 'settled', actual: { payout: 2046.12 } };
  renderMonitor({ mode: 'settled', round, stats: huntStats(null, round), winner: null });
  expect(screen.getByText('No eligible guesses')).toBeTruthy();
  expect(screen.getByText('$2,046.12')).toBeTruthy();
});

test('off air: last hunt result, or nothing on when there is no hunt', () => {
  const stats = huntStats({ pot: 3103.62, totalWon: 1318.8, averageMultiple: 30.44 }, null);
  const { unmount } = renderMonitor({ mode: 'offair', round: null, stats });
  expect(screen.getByText(/Last hunt · Community hunt/i)).toBeTruthy();
  expect(screen.getByText('−$1,784.82')).toBeTruthy();
  expect(screen.getByText('CH 02 · No round')).toBeTruthy();
  unmount();
  renderMonitor({ mode: 'offair', round: null, stats: huntStats(null, null), offair: { isLive: false, hasHunt: false, title: null } });
  expect(screen.getByRole('heading', { name: 'Nothing on right now' })).toBeTruthy();
});

test('tuning shows the phrase and no status light', () => {
  renderMonitor({ mode: 'tuning', round: null, stats: huntStats(null, null), phrase: 'Tuning signal…', ticker: [] });
  expect(screen.getByText('Tuning signal…')).toBeTruthy();
  expect(screen.queryByText('Live')).toBeNull();
  expect(screen.queryByText('Replay')).toBeNull();
});

// Review Focus 1: a nine-figure ARS hero renders in one piece. (jsdom drops
// clamp()/cqi font sizes, so the sizing itself is pinned by the fitFigure
// unit test in Task 2.)
test('a huge ARS hero renders without NaN', () => {
  const round = { ...ROUND, status: 'settled', actual: { payout: 185000000.5 } };
  const { container } = renderMonitor({ mode: 'settled', round, currency: 'ARS', stats: huntStats(null, round), winner: null });
  expect(screen.getByText(/185,000,000\.50/).className).toContain('whitespace-nowrap');
  expect(container.textContent).not.toMatch(/NaN/);
});

test('the meter summarises itself for screen readers', () => {
  const meter = {
    lo: 1000,
    hi: 3000,
    markers: [{ key: 'break-even', label: 'Break-even', value: 2000, tone: 'signal', pct: 50, labelAt: 'top' }],
    dots: [{ id: 'me', value: 2450, tone: 'me', name: 'You', pct: 72.5 }],
    count: 9,
    sealed: true,
  };
  renderMonitor({ mode: 'open', round: ROUND, stats: huntStats(null, ROUND), meter });
  expect(screen.getByRole('img', { name: /Break-even \$2,000\.00\. 9 guesses, sealed until entries close/ })).toBeTruthy();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- --watchAll=false --testPathPattern=HuntMonitor`
Expected: FAIL with "Cannot find module '../HuntMonitor'".

- [ ] **Step 3: Write ViewerAvatar and HuntMeter**

Create `src/components/hunts/ViewerAvatar.js`:

```js
import { useEffect, useState } from 'react';

// A Twitch avatar that falls back to the name's initial when the image is
// missing or fails to load. Size and colours come from className.
export default function ViewerAvatar({ src, name, className = '' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <span className={`grid flex-none place-items-center overflow-hidden rounded-full font-extrabold ${className}`}>
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
```

Create `src/components/hunts/HuntMeter.js`:

```js
import { MONO } from '../onAir/classes';
import { formatMoney, formatMoneyCompact } from '../../utils/money';

// One dot per visible guess on a dotted track, with break-even / so-far /
// actual markers. Only the winner and the viewer glow.
const DOT = {
  winner: 'bg-onair-winner-hot shadow-onair-dot-winner',
  runner: 'bg-onair-ink-3 shadow-onair-dot',
  me: 'bg-onair-viewer-bright shadow-onair-dot-viewer',
  open: 'bg-onair-ink-5 shadow-onair-dot',
  dim: 'bg-onair-ink-7 shadow-onair-dot',
};
const MARK = { signal: 'text-onair-signal', winner: 'text-onair-winner-light', muted: 'text-onair-ink-3' };

function labelShift(pct) {
  if (pct < 8) return 'translateX(0)';
  if (pct > 92) return 'translateX(-100%)';
  return 'translateX(-50%)';
}

export default function HuntMeter({ meter, currency }) {
  const guesses = `${meter.count} ${meter.count === 1 ? 'guess' : 'guesses'}`;
  const summary = [
    ...meter.markers.map((m) => `${m.label} ${formatMoney(m.value, currency)}`),
    `${guesses}${meter.sealed ? ', sealed until entries close' : ''}`,
  ].join('. ');
  return (
    <div
      role="img"
      aria-label={`Guess meter. ${summary}.`}
      className="relative mt-6 rounded-onair-row bg-black/[0.35] px-4 pb-3.5 pt-[18px] shadow-onair-row sm:px-5"
    >
      <div className="relative h-14" aria-hidden="true">
        <div className="absolute inset-x-0 top-[26px] h-1 rounded-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.18)_0_2px,transparent_2px_12px)]" />
        {meter.markers.map((m) => (
          <div key={m.key} className={MARK[m.tone]}>
            <div className="absolute bottom-3 top-1.5 -ml-[1.5px] w-[3px] rounded-sm bg-current" style={{ left: `${m.pct}%` }} />
            <div
              className={`${MONO} absolute whitespace-nowrap text-[0.5625rem] tracking-[0.15em] ${m.labelAt === 'bottom' ? 'top-[44px]' : '-top-2.5'}`}
              style={{ left: `${m.pct}%`, transform: labelShift(m.pct) }}
            >
              {m.label}
            </div>
          </div>
        ))}
        {meter.dots.map((d) => (
          <div
            key={d.id}
            title={`${d.name}: ${formatMoney(d.value, currency)}`}
            className={`absolute top-[21px] -ml-[7px] h-[14px] w-[14px] rounded-full sm:top-[18px] sm:-ml-2.5 sm:h-5 sm:w-5 ${DOT[d.tone]}`}
            style={{ left: `${d.pct}%` }}
          />
        ))}
      </div>
      <div className={`${MONO} flex justify-between gap-2 text-[0.625rem] tracking-[0.15em] text-onair-screen-dim`} aria-hidden="true">
        <span>{formatMoneyCompact(meter.lo, currency)}</span>
        <span>
          {guesses}
          {meter.sealed ? ' · sealed' : ''}
        </span>
        <span>{formatMoneyCompact(meter.hi, currency)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write HuntMonitor**

Create `src/components/hunts/HuntMonitor.js`:

```js
import Monitor from '../onAir/Monitor';
import Chip from '../onAir/Chip';
import { MONO } from '../onAir/classes';
import { fitFigure } from '../onAir/fit';
import { formatMoney } from '../../utils/money';
import { formatMultiplier } from '../../utils/huntFormat';
import { formatAvg, formatAvgFigure, signedMoney, winnerPrizeText } from './huntStats';
import { entryName } from './huntBoard';
import HuntMeter from './HuntMeter';
import ViewerAvatar from './ViewerAvatar';

// The Hunts tab's stage: one screen per mode on the On Air Monitor (spec
// "What each mode shows"). Screen content is the size container for the
// fitted hero; --hero-share shrinks the hero when side stats join its row.

const SCREENS = {
  tuning: { tint: 'neutral', status: null, readout: { label: 'CH 02 · Tuning', tone: 'muted' } },
  open: { tint: 'signal', status: 'live', tag: 'Open', tone: 'signal', readout: { label: 'CH 02 · Entries open', tone: 'signal' } },
  locked: { tint: 'signal', status: 'live', tag: 'Closed', tone: 'muted', readout: { label: 'CH 02 · Entries closed', tone: 'muted' } },
  settled: { tint: 'winner', status: 'replay', tag: 'Final', tone: 'winner', readout: { label: 'CH 02 · Entries closed', tone: 'muted' } },
  offair: { tint: 'neutral', status: 'replay', tag: 'Off air', tone: 'muted', readout: { label: 'CH 02 · No round', tone: 'muted' } },
};

const EYEBROW = { signal: 'text-onair-signal', winner: 'text-onair-winner-warm', muted: 'text-onair-ink-4' };
const HERO = { ink: 'text-onair-ink-1', loss: 'text-onair-loss', signal: 'text-onair-signal-light' };

function Eyebrow({ tone, children }) {
  return (
    <p className={`${MONO} text-[0.6875rem] tracking-[0.3em] [overflow-wrap:anywhere] sm:text-xs ${EYEBROW[tone]}`}>
      {children}
    </p>
  );
}

function Question({ children }) {
  return <h2 className="text-[1.375rem] font-bold tracking-[-0.01em] text-onair-ink-3 sm:text-3xl">{children}</h2>;
}

function Hero({ text, suffix = null, label, tone = 'ink' }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col items-center gap-1.5">
      <p
        className={`whitespace-nowrap font-extrabold leading-[0.9] tracking-[-0.03em] tabular-nums ${HERO[tone]}`}
        style={{ fontSize: fitFigure(`${text}${suffix || ''}`, { min: 3.25, max: 6 }) }}
      >
        {text}
        {suffix && <span className="text-[0.58em] text-onair-signal-light">{suffix}</span>}
      </p>
      {label && <p className={`${MONO} text-[0.6875rem] tracking-[0.25em] text-onair-ink-5`}>{label}</p>}
    </div>
  );
}

function SideStats({ items }) {
  if (!items.length) return null;
  return (
    <>
      <span className="hidden h-[84px] w-px bg-white/10 sm:block" aria-hidden="true" />
      <dl className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:flex-col sm:items-start sm:gap-2 sm:pb-1">
        {items.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5 text-sm text-onair-ink-5">
            <dt>{s.label}</dt>
            <dd className="text-lg font-bold tabular-nums text-onair-ink-1">{s.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function HeroRow({ hero, side }) {
  return (
    <div className="mt-1 flex w-full flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-center sm:gap-7">
      {hero}
      <SideStats items={side} />
    </div>
  );
}

function Chips({ children }) {
  return <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">{children}</div>;
}

function Stage({ eyebrow, children }) {
  return (
    <div className="flex flex-col items-center gap-3 pb-1.5 pt-6 text-center sm:pt-[30px]">
      {eyebrow}
      {children}
    </div>
  );
}

// Open hero: required avg, else the start cost as break-even, else nothing.
function openHero(stats, money) {
  if (stats.requiredAvg != null) {
    return <Hero text={formatAvgFigure(stats.requiredAvg)} suffix="x" label="Required avg to break even" />;
  }
  if (stats.startCost != null) return <Hero text={money(stats.startCost)} label="Break-even" />;
  return null;
}

function OpenStage({ round, stats, money, guessCount, prize }) {
  const hero = openHero(stats, money);
  const side = [
    stats.totalBet != null && { label: 'Total bet', value: money(stats.totalBet) },
    stats.avgBet != null && { label: 'Avg bet', value: money(stats.avgBet) },
    stats.requiredAvg != null && stats.startCost != null && { label: 'Start cost', value: money(stats.startCost) },
  ].filter(Boolean);
  return (
    <Stage eyebrow={<Eyebrow tone="signal">{round.title} · Predictions open</Eyebrow>}>
      <Question>What does the hunt pay?</Question>
      {hero && <HeroRow hero={hero} side={side} />}
      <Chips>
        {stats.bonusCount ? (
          <Chip>
            <b>{stats.bonusCount}</b> bonuses
          </Chip>
        ) : null}
        <Chip tone="signal">
          <b>{guessCount}</b> {guessCount === 1 ? 'guess' : 'guesses'} in
        </Chip>
        {prize && <Chip>Closest takes {prize}</Chip>}
      </Chips>
    </Stage>
  );
}

function LockedStage({ round, stats, money, guessCount, prize, chatMedian }) {
  const hasBonuses = stats.bonuses.length > 0;
  const hero = hasBonuses ? (
    <Hero text={money(stats.wonSoFar)} label={`Won so far · ${stats.openedCount}/${stats.bonusCount} opened`} />
  ) : (
    openHero(stats, money)
  );
  const heroIsCost = !hasBonuses && stats.requiredAvg == null;
  const side = [
    stats.startCost != null && !heroIsCost && { label: 'Start cost', value: money(stats.startCost) },
    stats.stillNeedAvg != null && { label: 'Still need avg', value: formatAvg(stats.stillNeedAvg) },
    chatMedian != null && { label: 'Chat median', value: money(chatMedian) },
  ].filter(Boolean);
  return (
    <Stage eyebrow={<Eyebrow tone="signal">{round.title} · Entries closed · Opening bonuses</Eyebrow>}>
      <Question>Bonuses opening</Question>
      {hero && <HeroRow hero={hero} side={side} />}
      <Chips>
        {stats.bonusCount ? (
          <Chip>
            <b>{stats.bonusCount}</b> bonuses
          </Chip>
        ) : null}
        <Chip>
          <b>{guessCount}</b> {guessCount === 1 ? 'guess' : 'guesses'}
        </Chip>
        {prize && <Chip>Closest takes {prize}</Chip>}
      </Chips>
    </Stage>
  );
}

function SettledStage({ round, currency, winner }) {
  const actual = round.actual && round.actual.payout;
  if (!winner) {
    return (
      <Stage eyebrow={<Eyebrow tone="winner">{round.title} · Final payout</Eyebrow>}>
        <Hero text={formatMoney(actual, currency)} label="No eligible guesses" />
      </Stage>
    );
  }
  const name = entryName(winner);
  const prize = winnerPrizeText(winner.prize);
  return (
    <Stage eyebrow={<Eyebrow tone="winner">{round.title} · And the closest guess is</Eyebrow>}>
      <ViewerAvatar
        src={winner.profileImageUrl}
        name={name}
        className="mt-2.5 h-[84px] w-[84px] bg-gradient-to-br from-onair-signal to-onair-signal-deep text-[2.25rem] text-onair-winner-ink shadow-onair-winner-ring sm:h-[108px] sm:w-[108px] sm:text-[2.625rem]"
      />
      <p
        className="max-w-full truncate font-extrabold leading-none tracking-[-0.025em]"
        style={{ fontSize: fitFigure(name, { min: 2.25, max: 3.75, share: '0.9' }) }}
      >
        {name}
      </p>
      <Chips>
        <Chip>
          Guessed <b>{formatMoney(winner.payoutGuess, currency, { decimals: 0 })}</b>
        </Chip>
        <Chip>
          Actual <b className="text-onair-winner-light">{formatMoney(actual, currency)}</b>
        </Chip>
        {prize && <Chip tone="winner">{prize}</Chip>}
      </Chips>
    </Stage>
  );
}

function OffAirStage({ stats, money, currency, offair }) {
  if (!offair.hasHunt) {
    return (
      <Stage eyebrow={<Eyebrow tone="muted">Off air</Eyebrow>}>
        <Question>Nothing on right now</Question>
        <p className="text-sm text-onair-ink-4">Predictions open when Goofer starts a round.</p>
      </Stage>
    );
  }
  if (offair.isLive) {
    const progress = stats.bonuses.length > 0 ? ` · ${stats.openedCount}/${stats.bonusCount} opened` : '';
    const side = [
      stats.startCost != null && { label: 'Start cost', value: money(stats.startCost) },
      stats.stillNeedAvg != null && { label: 'Still need avg', value: formatAvg(stats.stillNeedAvg) },
    ].filter(Boolean);
    return (
      <Stage eyebrow={<Eyebrow tone="signal">Hunt in progress · {offair.title}</Eyebrow>}>
        <Question>Predictions aren’t open this hunt</Question>
        <HeroRow hero={<Hero text={money(stats.wonSoFar)} label={`Won so far${progress}`} />} side={side} />
      </Stage>
    );
  }
  const side = [
    stats.startCost != null && { label: 'Start cost', value: money(stats.startCost) },
    stats.won != null && stats.result != null && { label: 'Won', value: money(stats.won) },
    stats.avgMulti != null && { label: 'Avg multi', value: formatMultiplier(stats.avgMulti) },
  ].filter(Boolean);
  const hero =
    stats.result != null ? (
      <Hero text={signedMoney(stats.result, currency)} label="Result" tone={stats.result < 0 ? 'loss' : 'signal'} />
    ) : (
      <Hero text={money(stats.won)} label="Won" />
    );
  return (
    <Stage eyebrow={<Eyebrow tone="muted">Last hunt · {offair.title}</Eyebrow>}>
      <HeroRow hero={hero} side={side} />
    </Stage>
  );
}

export default function HuntMonitor({
  mode,
  round,
  stats,
  meter,
  currency,
  guessCount,
  prize,
  winner,
  chatMedian,
  offair,
  clock,
  ticker,
  phrase,
}) {
  const screen = SCREENS[mode] || SCREENS.offair;
  const status = mode === 'offair' && offair && offair.isLive ? 'live' : screen.status;
  const money = (v) => formatMoney(v, currency);
  const chyron = screen.tag && ticker && ticker.length ? { tag: screen.tag, tone: screen.tone, items: ticker } : null;
  return (
    <Monitor
      tint={screen.tint}
      status={status}
      channel="CH 02 · Hunts"
      clock={clock}
      channelKey={mode === 'tuning' ? null : mode}
      readout={screen.readout}
      chyron={chyron}
    >
      <div className="[--hero-share:0.9] sm:[--hero-share:0.55]" style={{ containerType: 'inline-size' }}>
        {mode === 'tuning' && (
          <Stage eyebrow={<Eyebrow tone="signal">{phrase}</Eyebrow>}>
            <Question>What does the hunt pay?</Question>
          </Stage>
        )}
        {mode === 'open' && <OpenStage round={round} stats={stats} money={money} guessCount={guessCount} prize={prize} />}
        {mode === 'locked' && (
          <LockedStage round={round} stats={stats} money={money} guessCount={guessCount} prize={prize} chatMedian={chatMedian} />
        )}
        {mode === 'settled' && <SettledStage round={round} currency={currency} winner={winner} />}
        {mode === 'offair' && <OffAirStage stats={stats} money={money} currency={currency} offair={offair} />}
        {meter && <HuntMeter meter={meter} currency={currency} />}
      </div>
    </Monitor>
  );
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test -- --watchAll=false --testPathPattern=HuntMonitor`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add src/components/hunts/ViewerAvatar.js src/components/hunts/HuntMeter.js src/components/hunts/HuntMonitor.js src/components/hunts/__tests__/HuntMonitor.test.js && git commit -m "feat(hunts): the On Air monitor screens and guess meter"
```

---

### Task 7: HuntLineup

**Files:**
- Create: `src/components/hunts/HuntLineup.js`
- Test: `src/components/hunts/__tests__/HuntLineup.test.js`

**Interfaces:**
- Consumes: `Panel`, `OnAirButton`, `MONO` (Task 2); `lineupRows`, `guessOf`, `entryName` (Task 4); `timeAgo` (Task 4); `signedMoney` (Task 4); `ViewerAvatar` (Task 6); `formatMoney`.
- Produces: `<HuntLineup mode sealed entries round myEntry myId currency now />` (a `section` labelled by its heading).

- [ ] **Step 1: Write the failing tests**

Create `src/components/hunts/__tests__/HuntLineup.test.js`:

```js
import { fireEvent, render, screen, within } from '@testing-library/react';
import HuntLineup from '../HuntLineup';

const NOW = 100 * 60 * 1000;
const at = (min) => ({ toMillis: () => NOW - min * 60 * 1000 });
const entry = (id, payoutGuess, min, extra = {}) => ({ id, twitchId: id, displayName: id, payoutGuess, submittedAt: at(min), ...extra });
const ENTRIES = [
  entry('skillsytv', 1855, 12),
  entry('G4KUR4', 3663, 9),
  entry('GRUMPZILLA12', 3100, 7),
  entry('RYGARTEARROW', 2777, 5),
  entry('Xilentdrifter', 2122, 3),
  entry('JESSEJEK', 3333, 1),
];

function renderLineup(props) {
  return render(<HuntLineup currency={null} myId={null} myEntry={null} now={NOW} entries={[]} round={{}} {...props} />);
}

test('sealed: your row, eight face-down rows and the rest counted', () => {
  renderLineup({
    mode: 'open',
    sealed: true,
    round: { entryCount: 37 },
    myId: 'me',
    myEntry: entry('me', 2450, 0, { displayName: 'vonbrandt' }),
  });
  expect(screen.getByRole('heading', { name: 'Guesses so far' })).toBeTruthy();
  expect(screen.getByText('Sealed until entries close')).toBeTruthy();
  expect(screen.getByText('(you)')).toBeTruthy();
  expect(screen.getByText('$2,450')).toBeTruthy();
  expect(screen.getAllByTestId('face-down-row')).toHaveLength(8);
  expect(screen.getByText('+28 more sealed')).toBeTruthy();
});

test('sealed with no guesses invites the first one', () => {
  renderLineup({ mode: 'open', sealed: true, round: { entryCount: 0 } });
  expect(screen.getByText('No guesses yet. Be the first on the board.')).toBeTruthy();
});

test('locked: revealed low to high with time ago', () => {
  renderLineup({ mode: 'locked', sealed: false, entries: ENTRIES });
  const rows = screen.getAllByRole('listitem');
  expect(within(rows[0]).getByText('skillsytv')).toBeTruthy();
  expect(within(rows[0]).getAllByText('12m ago').length).toBeGreaterThan(0);
  expect(within(rows[5]).getByText('G4KUR4')).toBeTruthy();
  expect(screen.getByText('Low to high')).toBeTruthy();
});

test('settled: closest first, the winner row lit, offsets signed', () => {
  renderLineup({
    mode: 'settled',
    sealed: false,
    entries: ENTRIES,
    round: { status: 'settled', actual: { payout: 2046.12 }, winners: [{ place: 1, twitchId: 'Xilentdrifter' }] },
  });
  expect(screen.getByRole('heading', { name: "Tonight's lineup" })).toBeTruthy();
  const rows = screen.getAllByRole('listitem');
  expect(rows[0].getAttribute('data-lit')).toBe('winner');
  expect(within(rows[0]).getByText('Xilentdrifter')).toBeTruthy();
  expect(within(rows[0]).getAllByText('+$76').length).toBeGreaterThan(0);
  expect(within(rows[1]).getAllByText('−$191').length).toBeGreaterThan(0);
});

// Review Focus 5: the viewer's own winning row shows winner styling and "(you)".
test('the winner who is also you keeps the winner light', () => {
  renderLineup({
    mode: 'settled',
    sealed: false,
    entries: ENTRIES,
    myId: 'Xilentdrifter',
    round: { status: 'settled', actual: { payout: 2046.12 }, winners: [{ place: 1, twitchId: 'Xilentdrifter' }] },
  });
  const first = screen.getAllByRole('listitem')[0];
  expect(first.getAttribute('data-lit')).toBe('winner');
  expect(within(first).getByText('(you)')).toBeTruthy();
});

test('long lists show ten, pin you, and expand in place', () => {
  const many = Array.from({ length: 14 }, (_, i) => entry(`v${i}`, 1000 + i, i));
  renderLineup({ mode: 'locked', sealed: false, entries: [...many, entry('me', 9999, 0)], myId: 'me' });
  expect(screen.getByText('Your spot')).toBeTruthy();
  const toggle = screen.getByRole('button', { name: 'Show all 15' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle);
  expect(screen.getAllByRole('listitem')).toHaveLength(15);
  expect(screen.queryByText('Your spot')).toBeNull();
  expect(screen.getByRole('button', { name: 'Show fewer' })).toBeTruthy();
});

// Review Focus 1 and 3: huge ARS figures and malformed entries.
test('ARS millions, missing names and broken avatars render cleanly', () => {
  const { container } = renderLineup({
    mode: 'locked',
    sealed: false,
    currency: 'ARS',
    entries: [
      { id: 'a', twitchId: 'a', twitchName: 'tn_only', payoutGuess: 1850000, profileImageUrl: 'https://img/a.png', submittedAt: at(1) },
      { id: 'b', twitchId: 'b', payoutGuess: 2100000, submittedAt: at(2) },
      { id: 'c', twitchId: 'c', displayName: 'no guess' },
    ],
  });
  expect(screen.getByText('tn_only')).toBeTruthy();
  expect(screen.getByText('Viewer')).toBeTruthy();
  expect(screen.queryByText('no guess')).toBeNull();
  expect(screen.getByText(/1,850,000/)).toBeTruthy();
  fireEvent.error(container.querySelector('img'));
  expect(screen.getByText('T')).toBeTruthy();
  expect(container.textContent).not.toMatch(/NaN/);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- --watchAll=false --testPathPattern=HuntLineup`
Expected: FAIL with "Cannot find module '../HuntLineup'".

- [ ] **Step 3: Write HuntLineup**

Create `src/components/hunts/HuntLineup.js`:

```js
import { useId, useState } from 'react';
import Panel from '../onAir/Panel';
import OnAirButton from '../onAir/OnAirButton';
import { MONO } from '../onAir/classes';
import { formatMoney } from '../../utils/money';
import { entryName, guessOf, lineupRows } from './huntBoard';
import { timeAgo } from './huntTime';
import { signedMoney } from './huntStats';
import ViewerAvatar from './ViewerAvatar';

// "Guesses so far" / "Tonight's lineup". While a round is open, viewers see
// their own row and face-down rows for everyone else (entries are sealed).
const FACE_DOWN_ROWS = 8;
const GRID =
  'grid grid-cols-[28px_32px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 sm:grid-cols-[44px_40px_minmax(0,1fr)_minmax(120px,auto)_110px] sm:gap-4 sm:pl-3.5 sm:pr-[18px]';
const pad2 = (n) => String(n).padStart(2, '0');
const pad3 = (n) => String(n).padStart(3, '0');

function Row({ row, mode, currency, now }) {
  const settled = mode === 'settled';
  const lit = row.winnerPlace === 1 ? 'winner' : row.isMe ? 'viewer' : null;
  const lead = row.no == null ? '··' : pad2(settled ? row.place : row.no);
  const leadTone =
    row.winnerPlace === 1
      ? 'text-onair-winner-warm'
      : row.winnerPlace === 2
        ? 'text-onair-ink-2'
        : row.isMe
          ? 'text-onair-viewer-light'
          : 'text-onair-ink-5';
  const valueTone =
    row.winnerPlace === 1
      ? 'text-onair-winner-light'
      : row.isMe || row.winnerPlace === 2
        ? 'text-white-body'
        : settled
          ? 'text-onair-ink-3'
          : 'text-onair-ink-2';
  const meta = settled ? signedMoney(row.off, currency, { decimals: 0 }) : timeAgo(row.submittedAt, now) || 'just now';
  const metaTone = !settled && row.isMe ? 'text-onair-signal' : 'text-onair-ink-5';
  return (
    <Panel as="li" radius="row" lit={lit} className={`${GRID} transition-[filter] duration-150 hover:brightness-[1.15]`}>
      <span className={`${MONO} text-center text-[0.8125rem] font-bold ${leadTone}`}>{lead}</span>
      <ViewerAvatar
        src={row.avatar}
        name={row.name}
        className="h-8 w-8 bg-gradient-to-br from-onair-surface-raised to-onair-ink-7 text-[0.9375rem] text-onair-ink-2 sm:h-10 sm:w-10"
      />
      <div className="min-w-0">
        <p className="truncate text-[0.9375rem] font-bold sm:text-[1.0625rem]">
          {row.name}
          {row.isMe && <span className="font-medium text-onair-viewer-light"> (you)</span>}
        </p>
        <p className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-5`}>
          {row.no == null ? 'Your slip · sealed' : `Entry #${pad3(row.no)}`}
        </p>
      </div>
      <div className="text-right">
        <p className={`whitespace-nowrap text-lg font-extrabold tabular-nums sm:text-[1.375rem] ${valueTone}`}>
          {formatMoney(row.guess, currency, { decimals: 0 })}
        </p>
        <p className={`text-xs sm:hidden ${metaTone}`}>{meta}</p>
      </div>
      <p className={`hidden text-right text-[0.8125rem] sm:block ${metaTone}`}>{meta}</p>
    </Panel>
  );
}

function FaceDownRow({ index }) {
  return (
    <Panel as="li" radius="row" className={GRID} data-testid="face-down-row">
      <span className={`${MONO} text-center text-[0.8125rem] font-bold text-onair-ink-6`} aria-hidden="true">
        ··
      </span>
      <span className="h-8 w-8 rounded-full bg-white/5 sm:h-10 sm:w-10" aria-hidden="true" />
      <span className="block h-3 rounded-full bg-white/10" style={{ width: `${45 + ((index * 37) % 40)}%` }} aria-hidden="true" />
      <span className={`${MONO} text-right text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>Sealed</span>
      <span className="hidden sm:block" aria-hidden="true" />
    </Panel>
  );
}

function sealedBody({ round, myEntry, myId, mode, currency, now }) {
  const count = (round && round.entryCount) || 0;
  const mine = guessOf(myEntry) != null ? myEntry : null;
  const myRow = mine && {
    id: mine.id,
    twitchId: myId,
    name: entryName(mine),
    avatar: mine.profileImageUrl || null,
    guess: mine.payoutGuess,
    no: null,
    place: null,
    off: null,
    submittedAt: mine.lastEditAt || mine.submittedAt || null,
    isMe: true,
    winnerPlace: null,
  };
  const others = Math.max(0, count - (myRow ? 1 : 0));
  const shown = Math.min(others, FACE_DOWN_ROWS);
  if (!myRow && others === 0) return null;
  return (
    <>
      <ol className="flex flex-col gap-2" aria-label={`${count} sealed ${count === 1 ? 'guess' : 'guesses'}`}>
        {myRow && <Row row={myRow} mode={mode} currency={currency} now={now} />}
        {Array.from({ length: shown }, (_, i) => (
          <FaceDownRow key={i} index={i} />
        ))}
      </ol>
      {others > shown && (
        <p className={`${MONO} mt-1 text-center text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>
          +{others - shown} more sealed
        </p>
      )}
    </>
  );
}

export default function HuntLineup({ mode, sealed, entries, round, myEntry, myId, currency, now }) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const settled = mode === 'settled';
  const title = settled ? "Tonight's lineup" : 'Guesses so far';
  const label = sealed ? 'Sealed until entries close' : settled ? 'Closest first' : 'Low to high';

  let body;
  if (sealed) {
    body = sealedBody({ round, myEntry, myId, mode, currency, now });
  } else {
    const { rows, total, hiddenCount, pinned } = lineupRows({ mode, entries, round, myId, expanded });
    body =
      total === 0 ? null : (
        <>
          <ol className="flex flex-col gap-2">
            {rows.map((r) => (
              <Row key={r.id} row={r} mode={mode} currency={currency} now={now} />
            ))}
          </ol>
          {pinned && (
            <div className="mt-1">
              <p className={`${MONO} mb-1.5 px-1 text-[0.625rem] tracking-[0.2em] text-onair-viewer-light`}>Your spot</p>
              <ol>
                <Row row={pinned} mode={mode} currency={currency} now={now} />
              </ol>
            </div>
          )}
          {(hiddenCount > 0 || expanded) && (
            <OnAirButton
              variant="ghost"
              size="sm"
              className="self-center"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Show fewer' : `Show all ${total}`}
            </OnAirButton>
          )}
        </>
      );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id={headingId} className="text-2xl font-extrabold">
          {title}
        </h2>
        <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>{label}</span>
      </div>
      {body || (
        <Panel className="px-5 py-6 text-center text-sm text-onair-ink-4">
          {mode === 'open' ? 'No guesses yet. Be the first on the board.' : 'No guesses this round.'}
        </Panel>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- --watchAll=false --testPathPattern=HuntLineup`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add src/components/hunts/HuntLineup.js src/components/hunts/__tests__/HuntLineup.test.js && git commit -m "feat(hunts): lineup with face-down rows while guesses are sealed"
```

---

### Task 8: BonusTable and HuntRecap

**Files:**
- Create: `src/components/hunts/BonusTable.js`, `src/components/hunts/HuntRecap.js`
- Test: `src/components/hunts/__tests__/HuntRecap.test.js`

**Interfaces:**
- Consumes: `Panel`, `OnAirButton`, `MONO`, `FOCUS` (Task 2); `formatAvg`, `signedMoney` (Task 4); `formatMoney`; `formatMultiplier` (`src/utils/huntFormat.js`).
- Produces:
  - `<BonusTable bonuses currency bestIndex nextIndex openedCount />` (`role="table"` labelled "Bonuses")
  - `<HuntRecap kind: 'docket'|'opening'|'final' title stats currency loading error onBack? />`

- [ ] **Step 1: Write the failing tests**

Create `src/components/hunts/__tests__/HuntRecap.test.js`:

```js
import { fireEvent, render, screen, within } from '@testing-library/react';
import HuntRecap from '../HuntRecap';
import { huntStats } from '../huntStats';

const SLOTS = ['Wanted Dead or a Wild', 'Gates of Olympus', 'Sweet Bonanza', 'Mental', 'Sugar Rush', 'Chaos Crew', 'The Dog House', 'Fruit Party', 'Starlight Princess', 'Big Bass Bonanza', 'Pug Life', 'Le Viking'];
const MULTIS = [812, 41.5, 12.2, 268, 3.1, 74, 0, 28.4, 156, 9.6, 13, null];
const BONUSES = SLOTS.map((slot, i) => ({
  slot,
  bet: 0.6,
  win: MULTIS[i] == null ? null : Math.round(0.6 * MULTIS[i] * 100) / 100,
  multiplier: MULTIS[i],
  thumb: i === 0 ? 'https://img/wanted.png' : null,
}));
const ROUND = { status: 'open', source: 'manual', manualTotalCost: 2421.82 };

function rows() {
  return within(screen.getByRole('table', { name: 'Bonuses' })).getAllByRole('row').slice(1);
}

test('docket: start cost, total bet, bonuses, required avg; all dashes and UP FIRST', () => {
  const unopened = BONUSES.map((b) => ({ ...b, win: null, multiplier: null }));
  render(<HuntRecap kind="docket" title="On the docket" stats={huntStats({ bonuses: unopened }, ROUND)} currency={null} />);
  expect(screen.getByRole('heading', { name: 'On the docket' })).toBeTruthy();
  expect(screen.getByText('12 bonuses')).toBeTruthy();
  expect(screen.getByText('Required avg')).toBeTruthy();
  expect(screen.getByText('336.4x')).toBeTruthy();
  expect(within(rows()[0]).getByText('Up first')).toBeTruthy();
  expect(within(rows()[1]).getAllByText('—')).toHaveLength(2);
});

test('final: best hit tagged, 0x in the loss colour, show all expands', () => {
  render(<HuntRecap kind="final" title="Hunt recap" stats={huntStats({ bonuses: BONUSES }, null)} currency={null} />);
  expect(within(rows()[0]).getByText('Best hit')).toBeTruthy();
  expect(within(rows()[6]).getByText('0.0x').className).toContain('text-onair-loss');
  expect(rows()).toHaveLength(10);
  fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
  expect(rows()).toHaveLength(12);
  // A final recap never tags "Up next", even if the data has an unopened bonus.
  expect(within(rows()[11]).queryByText('Up next')).toBeNull();
});

test('opening: won so far, opened count, still-need avg', () => {
  render(<HuntRecap kind="opening" title="Opening now" stats={huntStats({ bonuses: BONUSES }, ROUND)} currency={null} />);
  expect(screen.getByText('Won so far')).toBeTruthy();
  expect(screen.getByText('11/12')).toBeTruthy();
  expect(screen.getByText('Still need avg')).toBeTruthy();
});

test('hide bonuses collapses the table; a broken thumb falls back to initials', () => {
  const { container } = render(<HuntRecap kind="final" title="Hunt recap" stats={huntStats({ bonuses: BONUSES }, null)} currency={null} />);
  fireEvent.error(container.querySelector('img'));
  expect(screen.getByText('WD')).toBeTruthy();
  const toggle = screen.getByRole('button', { name: /Hide bonuses/ });
  fireEvent.click(toggle);
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.getByRole('button', { name: /Show bonuses/ }).getAttribute('aria-expanded')).toBe('false');
});

// Review Focus 4: a potless hunt without bonuses renders dashes, not NaN.
test('a potless hunt renders without NaN and offers back when browsing an episode', () => {
  const onBack = jest.fn();
  const { container } = render(
    <HuntRecap kind="final" title="Solo hunt · SEP 24" stats={huntStats({ pot: 0, totalWon: 50 }, null)} currency="CAD" onBack={onBack} />
  );
  expect(container.textContent).not.toMatch(/NaN|Infinity/);
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  fireEvent.click(screen.getByRole('button', { name: 'Back to tonight' }));
  expect(onBack).toHaveBeenCalled();
});

test('loading and error lines while a hunt detail is fetched', () => {
  const { rerender } = render(<HuntRecap kind="final" title="Hunt recap" stats={huntStats(null, null)} currency={null} loading />);
  expect(screen.getByText('Loading bonuses…')).toBeTruthy();
  rerender(<HuntRecap kind="final" title="Hunt recap" stats={huntStats(null, null)} currency={null} error="Could not load this hunt’s bonuses." />);
  expect(screen.getByText('Could not load this hunt’s bonuses.')).toBeTruthy();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- --watchAll=false --testPathPattern=HuntRecap`
Expected: FAIL with "Cannot find module '../HuntRecap'".

- [ ] **Step 3: Write BonusTable**

Create `src/components/hunts/BonusTable.js`:

```js
import { useState } from 'react';
import { FOCUS, MONO } from '../onAir/classes';
import { formatMoney } from '../../utils/money';
import { formatMultiplier } from '../../utils/huntFormat';

// Slot-by-slot table. Full layout from sm up; on phones the # column and the
// bar drop and the bet moves under the slot name.
const LIMIT = 10;
// Per-slot tile tints for the initials fallback (documented raw-colour exception).
const HUES = ['#ff8a3d', '#3ee0bf', '#b48cff', '#ffcf5c', '#ff6b8a'];
const COLS =
  'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3.5 sm:grid-cols-[44px_minmax(0,1fr)_90px_110px_200px] sm:gap-4 sm:px-[18px]';
const TAGS = {
  best: { label: 'Best hit', className: 'bg-onair-winner/20 text-onair-winner-light' },
  'up-first': { label: 'Up first', className: 'bg-onair-signal/[0.15] text-onair-signal' },
  'up-next': { label: 'Up next', className: 'bg-onair-signal/[0.15] text-onair-signal' },
};

const finite = (v) => v != null && v !== '' && Number.isFinite(Number(v));
const isOpened = (b) => finite(b && b.win);
const pad2 = (n) => String(n).padStart(2, '0');

function initials(slot) {
  const words = String(slot || '').split(/\s+/).filter(Boolean);
  const long = words.filter((w) => w.length > 2);
  return (long.length ? long : words).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

function SlotTile({ bonus, index }) {
  const [broken, setBroken] = useState(false);
  if (bonus.thumb && !broken) {
    return (
      <img
        src={bonus.thumb}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-[34px] w-[34px] flex-none rounded-onair-tile object-cover"
      />
    );
  }
  const hue = HUES[index % HUES.length];
  return (
    <span
      aria-hidden="true"
      className="grid h-[34px] w-[34px] flex-none place-items-center rounded-onair-tile text-xs font-extrabold"
      style={{ background: `linear-gradient(145deg, ${hue}33, ${hue}0d)`, color: hue }}
    >
      {initials(bonus.slot)}
    </span>
  );
}

function Tag({ kind }) {
  const tag = TAGS[kind];
  return (
    <span className={`${MONO} flex-none whitespace-nowrap rounded-full px-2.5 py-[3px] text-[0.5625rem] font-bold tracking-[0.15em] ${tag.className}`}>
      {tag.label}
    </span>
  );
}

function BonusRow({ bonus, index, currency, tag, best, maxMulti }) {
  const opened = isOpened(bonus);
  const m = Number(bonus.multiplier);
  const hasMulti = opened && finite(bonus.multiplier);
  const big = hasMulti && m >= 100;
  const dud = hasMulti && m === 0;
  const multiTone = best ? 'text-onair-winner-light' : big ? 'text-onair-winner-pale' : dud ? 'text-onair-loss' : 'text-onair-ink-3';
  const barTone = best ? 'bg-gradient-to-r from-onair-winner to-onair-winner-light' : big ? 'bg-onair-winner-warm' : 'bg-white/[0.28]';
  const barW = hasMulti && maxMulti > 0 ? Math.max(2, Math.sqrt(m / maxMulti) * 100) : 0;
  const wash = best
    ? 'bg-gradient-to-r from-onair-winner/[0.12] to-transparent to-70%'
    : tag === 'up-first' || tag === 'up-next'
      ? 'bg-gradient-to-r from-onair-signal/10 to-transparent to-70%'
      : '';
  return (
    <div role="row" className={`${COLS} border-t border-white/[0.04] py-[11px] hover:bg-white/[0.03] ${wash}`}>
      <span role="cell" className={`${MONO} hidden text-xs text-onair-ink-5 sm:block`}>
        {pad2(index + 1)}
      </span>
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <SlotTile bonus={bonus} index={index} />
        <div className="min-w-0">
          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2.5">
            <p className="max-w-full truncate text-[0.9375rem] font-bold">{bonus.slot || `Bonus ${index + 1}`}</p>
            {tag && <Tag kind={tag} />}
          </div>
          <p className="text-xs text-onair-ink-5 sm:hidden">Bet {formatMoney(bonus.bet, currency)}</p>
        </div>
      </div>
      <span role="cell" className="hidden text-right text-[0.9375rem] tabular-nums text-onair-ink-3 sm:block">
        {formatMoney(bonus.bet, currency)}
      </span>
      <span
        role="cell"
        className={`text-right text-[0.9375rem] font-bold tabular-nums ${opened && !dud ? 'text-onair-ink-1' : 'text-onair-ink-5'}`}
      >
        {opened ? formatMoney(bonus.win, currency) : '—'}
      </span>
      <div role="cell" className="flex items-center justify-end gap-2.5">
        <span className="hidden h-1.5 max-w-[110px] flex-1 overflow-hidden rounded-full bg-white/[0.06] sm:block" aria-hidden="true">
          <span className={`block h-full rounded-full ${barTone}`} style={{ width: `${barW}%` }} />
        </span>
        <span
          className={`w-[62px] text-right text-[0.9375rem] font-extrabold tabular-nums ${hasMulti ? multiTone : 'text-onair-ink-5'}`}
        >
          {hasMulti ? formatMultiplier(m) : '—'}
        </span>
      </div>
    </div>
  );
}

export default function BonusTable({ bonuses, currency, bestIndex = -1, nextIndex = -1, openedCount = 0 }) {
  const [all, setAll] = useState(false);
  const maxMulti = Math.max(0, ...bonuses.filter((b) => isOpened(b) && finite(b.multiplier)).map((b) => Number(b.multiplier)));
  const visible = all ? bonuses : bonuses.slice(0, LIMIT);
  const nextTag = openedCount === 0 ? 'up-first' : 'up-next';
  return (
    <div role="table" aria-label="Bonuses" className="flex flex-col overflow-hidden rounded-onair-inner bg-onair-surface-4 shadow-onair-row">
      <div role="row" className={`${COLS} ${MONO} bg-white/[0.025] py-3 text-[0.625rem] tracking-[0.2em] text-onair-ink-5`}>
        <span role="columnheader" className="hidden sm:block">#</span>
        <span role="columnheader">Slot</span>
        <span role="columnheader" className="hidden text-right sm:block">Bet</span>
        <span role="columnheader" className="text-right">Payout</span>
        <span role="columnheader" className="text-right">Multi</span>
      </div>
      {visible.map((b, i) => (
        <BonusRow
          key={`${b.slot}-${i}`}
          bonus={b}
          index={i}
          currency={currency}
          best={i === bestIndex}
          maxMulti={maxMulti}
          tag={i === bestIndex ? 'best' : i === nextIndex ? nextTag : null}
        />
      ))}
      {bonuses.length > LIMIT && (
        <div className="border-t border-white/[0.04] px-[18px] py-3 text-center text-sm text-onair-ink-4">
          {all ? `Showing all ${bonuses.length}` : `Showing ${LIMIT} of ${bonuses.length}`} ·{' '}
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll((v) => !v)}
            className={`rounded font-semibold text-onair-signal hover:text-onair-signal-light ${FOCUS}`}
          >
            {all ? 'Show fewer' : 'Show all'}
          </button>
        </div>
      )}
    </div>
  );
}
```

Note: the handoff draws "Show all" in orange; orange means the winner inside On Air, so the link uses the signal colour.

- [ ] **Step 4: Write HuntRecap**

Create `src/components/hunts/HuntRecap.js`:

```js
import { useId, useState } from 'react';
import Panel from '../onAir/Panel';
import OnAirButton from '../onAir/OnAirButton';
import { MONO } from '../onAir/classes';
import { formatMoney } from '../../utils/money';
import { formatMultiplier } from '../../utils/huntFormat';
import { formatAvg, signedMoney } from './huntStats';
import BonusTable from './BonusTable';

// "On the docket" / "Opening now" / "Hunt recap": four stats and the bonus
// table. `kind` picks the stats; past episodes reuse the 'final' kind.
const TONE = { signal: 'text-onair-signal', loss: 'text-onair-loss' };

function cells(kind, stats, currency) {
  const money = (v) => formatMoney(v, currency);
  if (kind === 'docket') {
    return [
      { label: 'Start cost', value: money(stats.startCost) },
      { label: 'Total bet', value: money(stats.totalBet) },
      { label: 'Bonuses', value: stats.bonusCount || '—' },
      { label: 'Required avg', value: formatAvg(stats.requiredAvg), tone: 'signal' },
    ];
  }
  if (kind === 'opening') {
    return [
      { label: 'Start cost', value: money(stats.startCost) },
      { label: 'Won so far', value: money(stats.wonSoFar) },
      { label: 'Opened', value: stats.bonusCount ? `${stats.openedCount}/${stats.bonusCount}` : '—' },
      { label: 'Still need avg', value: formatAvg(stats.stillNeedAvg), tone: 'signal' },
    ];
  }
  return [
    { label: 'Start cost', value: money(stats.startCost) },
    { label: 'Won', value: money(stats.won) },
    { label: 'Avg multi', value: formatMultiplier(stats.avgMulti) },
    {
      label: 'Result',
      value: signedMoney(stats.result, currency),
      tone: stats.result == null ? null : stats.result < 0 ? 'loss' : 'signal',
    },
  ];
}

export default function HuntRecap({ kind, title, stats, currency, loading = false, error = null, onBack = null }) {
  const [open, setOpen] = useState(true);
  const headingId = useId();
  const tableId = useId();
  const hasBonuses = stats.bonuses.length > 0;
  return (
    <Panel as="section" aria-labelledby={headingId} className="flex flex-col gap-4 p-4 sm:px-6 sm:py-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 id={headingId} className="truncate text-xl font-extrabold">
            {title}
          </h2>
          {stats.bonusCount ? (
            <span className={`${MONO} flex-none text-[0.6875rem] tracking-[0.15em] text-onair-ink-5`}>{stats.bonusCount} bonuses</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          {onBack && (
            <OnAirButton variant="ghost" size="sm" onClick={onBack}>
              Back to tonight
            </OnAirButton>
          )}
          {hasBonuses && (
            <OnAirButton variant="ghost" size="sm" aria-expanded={open} aria-controls={tableId} onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide bonuses' : 'Show bonuses'}
              <span aria-hidden="true">{open ? '↑' : '↓'}</span>
            </OnAirButton>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-onair-inner bg-white/5 sm:grid-cols-4">
        {cells(kind, stats, currency).map((c) => (
          <div key={c.label} className="flex flex-col gap-1 bg-onair-surface-2 px-4 py-3.5">
            <dt className="text-xs text-onair-ink-5">{c.label}</dt>
            <dd className={`text-xl font-extrabold tabular-nums ${TONE[c.tone] || 'text-onair-ink-1'}`}>{c.value}</dd>
          </div>
        ))}
      </dl>
      {loading && !hasBonuses && <p className={`${MONO} text-[0.625rem] tracking-[0.3em] text-onair-ink-5`}>Loading bonuses…</p>}
      {error && !hasBonuses && <p className="text-sm text-onair-loss">{error}</p>}
      {hasBonuses && open && (
        <div id={tableId}>
          <BonusTable
            bonuses={stats.bonuses}
            currency={currency}
            bestIndex={stats.bestIndex}
            nextIndex={kind === 'final' ? -1 : stats.nextIndex}
            openedCount={stats.openedCount}
          />
        </div>
      )}
    </Panel>
  );
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test -- --watchAll=false --testPathPattern=HuntRecap`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add src/components/hunts/BonusTable.js src/components/hunts/HuntRecap.js src/components/hunts/__tests__/HuntRecap.test.js && git commit -m "feat(hunts): recap card and responsive bonus table"
```

---

### Task 9: HuntSlip

**Files:**
- Create: `src/components/hunts/HuntSlip.js`
- Test: `src/components/hunts/__tests__/HuntSlip.test.js`

**Interfaces:**
- Consumes: `Ticket`, `OnAirButton`, `MONO`, `FOCUS` (Task 2); `quickPicks`, `winnerPrizeText`, `ordinal` (Task 4); `guessOf` (Task 4); `toMs` (Task 4); `authedFetch` (`src/utils/authedFetch.js`); `formatMoney`; `fitFontSize` (`src/utils/fitText.js`); amount input helpers (`src/utils/amountInput.js`); `placeLabel` (`src/utils/predictionRewards.js`).
- Produces: `<HuntSlip mode round viewer onSignIn myEntry currency startCost prize guessCount position rank />` where `viewer = { twitchId }|null`, `position = { below, above }|null`, `rank = { place, of }|null`; `fakeSerial(roundId, twitchId) => string`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/hunts/__tests__/HuntSlip.test.js`:

```js
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HuntSlip from '../HuntSlip';
import { authedFetch } from '../../../utils/authedFetch';

jest.mock('../../../utils/authedFetch', () => ({
  authedFetch: jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ isNew: true }) })),
}));

const ROUND = {
  id: 'round1',
  title: 'Sunday hunt',
  status: 'open',
  acceptPredictions: true,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h2', totalCost: 150000, currency: 'ARS', bonusCount: 40 },
};
const VIEWER = { twitchId: 'viewer1' };

function renderSlip(props) {
  return render(
    <HuntSlip
      mode="open"
      round={ROUND}
      viewer={VIEWER}
      onSignIn={() => {}}
      myEntry={null}
      currency="ARS"
      startCost={150000}
      prize="+500 tickets"
      guessCount={5}
      position={null}
      rank={null}
      {...props}
    />
  );
}

const input = () => screen.getByLabelText('Final payout guess');

beforeEach(() => authedFetch.mockClear());

test('signed out: the right title per mode and a sign-in button', () => {
  const onSignIn = jest.fn();
  renderSlip({ viewer: null, onSignIn });
  expect(screen.getByRole('heading', { name: 'Call the payout' })).toBeTruthy();
  expect(screen.getByText('Closest guess takes +500 tickets.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Twitch' }));
  expect(onSignIn).toHaveBeenCalled();
});

test('the guess is grouped while typing and submits as a plain number', async () => {
  renderSlip();
  fireEvent.change(input(), { target: { value: '1850000.5' } });
  expect(input().value).toBe('1,850,000.5');
  expect(screen.getByText('ARS')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Lock it in' }));
  await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(1));
  expect(authedFetch.mock.calls[0][0]).toBe('/api/predictions/submit');
  expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toEqual({ roundId: 'round1', payoutGuess: 1850000.5 });
  await waitFor(() => expect(screen.getByText('Slip submitted.')).toBeTruthy());
  expect(screen.getByText('Edit again in 30s')).toBeTruthy();
});

test('quick picks spread around the start cost', () => {
  renderSlip();
  fireEvent.click(screen.getByRole('button', { name: /Half back/ }));
  expect(input().value).toBe('75,000');
  fireEvent.click(screen.getByRole('button', { name: /Break-even/ }));
  expect(input().value).toBe('150,000');
  fireEvent.click(screen.getByRole('button', { name: /Double/ }));
  expect(input().value).toBe('300,000');
});

test('an empty slip cannot be locked', () => {
  renderSlip();
  expect(screen.getByRole('button', { name: 'Lock it in' }).disabled).toBe(true);
});

test('server errors are announced', async () => {
  authedFetch.mockImplementationOnce(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'NOT_OPEN' }) }));
  renderSlip();
  fireEvent.change(input(), { target: { value: '2000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lock it in' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Predictions are closed for this round.'));
});

test('a saved guess shows the locked card; change guess reopens the input', () => {
  renderSlip({ myEntry: { id: 'viewer1', payoutGuess: 2450 } });
  expect(screen.getByRole('heading', { name: "You're on the board" })).toBeTruthy();
  expect(screen.getByText('Locked')).toBeTruthy();
  expect(screen.getByText('Sealed with 4 other guesses. Revealed when entries close.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Change guess' }));
  expect(input().value).toBe('2,450');
  expect(screen.getByRole('button', { name: 'Update guess' })).toBeTruthy();
});

test('locked round: read-only guess with position, no input', () => {
  renderSlip({ mode: 'locked', myEntry: { id: 'viewer1', payoutGuess: 2450 }, position: { below: 2, above: 4 } });
  expect(screen.getByRole('heading', { name: 'Entries closed' })).toBeTruthy();
  expect(screen.getByText('2 guesses below you · 4 above')).toBeTruthy();
  expect(screen.queryByLabelText('Final payout guess')).toBeNull();
});

test('settled: a winner sees their place and prize; others see how far off', () => {
  const settled = { ...ROUND, status: 'settled', actual: { payout: 2046.12 }, winners: [{ place: 1, twitchId: 'viewer1', prize: { tickets: 500 } }] };
  const { unmount } = renderSlip({ mode: 'settled', round: settled, currency: null, myEntry: { id: 'viewer1', payoutGuess: 2122 } });
  expect(screen.getByRole('heading', { name: '1st place!' })).toBeTruthy();
  expect(screen.getByText('+500 tickets')).toBeTruthy();
  unmount();
  renderSlip({
    mode: 'settled',
    round: { ...settled, winners: [] },
    currency: null,
    myEntry: { id: 'viewer1', payoutGuess: 2450 },
    rank: { place: 4, of: 7 },
  });
  expect(screen.getByRole('heading', { name: 'Your result' })).toBeTruthy();
  expect(screen.getByText('Off by $403.88 · 4th of 7')).toBeTruthy();
});

test('off air: no round open', () => {
  renderSlip({ mode: 'offair', round: null });
  expect(screen.getByRole('heading', { name: 'No round open' })).toBeTruthy();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- --watchAll=false --testPathPattern=HuntSlip`
Expected: FAIL with "Cannot find module '../HuntSlip'".

- [ ] **Step 3: Write HuntSlip**

Create `src/components/hunts/HuntSlip.js`:

```js
import { useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import Ticket from '../onAir/Ticket';
import OnAirButton from '../onAir/OnAirButton';
import { FOCUS, MONO } from '../onAir/classes';
import { authedFetch } from '../../utils/authedFetch';
import { formatMoney } from '../../utils/money';
import { fitFontSize } from '../../utils/fitText';
import { caretAfter, formatAmountInput, localeSeparators, parseAmountInput, significantBefore } from '../../utils/amountInput';
import { placeLabel } from '../../utils/predictionRewards';
import { ordinal, quickPicks, winnerPrizeText } from './huntStats';
import { guessOf } from './huntBoard';
import { toMs } from './huntTime';

// The prediction slip on the On Air ticket. Same submit API, 30s edit
// cooldown and grouped amount input as before; only the presentation moved.
const EDIT_COOLDOWN_MS = 30 * 1000;
const ERRORS = {
  INVALID_PAYOUT: 'Enter a valid payout amount.',
  NOT_OPEN: 'Predictions are closed for this round.',
};

export function fakeSerial(roundId, twitchId) {
  if (!roundId) return '0000-0000';
  const a = roundId.slice(-4).toUpperCase();
  const b = (twitchId || '').slice(-4).toUpperCase();
  return `${a}-${b || '----'}`;
}

function useCooldown(targetMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetMs || targetMs <= Date.now()) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [targetMs]);
  return targetMs ? Math.max(0, Math.ceil((targetMs - now) / 1000)) : 0;
}

function SlipHeader({ serial, locked = false, title, sub }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={`${MONO} flex justify-between gap-2 text-[0.625rem] tracking-[0.24em] text-onair-viewer-light`}>
        <span>Your slip · No. {serial}</span>
        {locked && (
          <span className="text-onair-signal">
            <span aria-hidden="true">● </span>Locked
          </span>
        )}
      </p>
      <h2 className="text-[1.375rem] font-extrabold leading-tight">{title}</h2>
      {sub && <p className="text-sm leading-snug text-onair-viewer-muted">{sub}</p>}
    </div>
  );
}

function BigGuess({ value, currency }) {
  const text = formatMoney(value, currency);
  return (
    <div style={{ containerType: 'inline-size' }}>
      <p
        className="whitespace-nowrap text-4xl font-extrabold tracking-[-0.02em] tabular-nums"
        style={{ fontSize: fitFontSize(text, { min: 1.5, max: 2.25 }) }}
      >
        {text}
      </p>
    </div>
  );
}

function Note({ children }) {
  return <p className="text-center text-xs text-onair-viewer-muted">{children}</p>;
}

function Feedback({ feedback }) {
  return (
    <p role="status" className={`text-center text-xs ${feedback && feedback.kind === 'error' ? 'text-onair-loss' : 'text-onair-signal'}`}>
      {feedback ? feedback.message : ''}
    </p>
  );
}

function OpenSlip({ round, serial, myEntry, currency, startCost, prize, guessCount }) {
  const [editing, setEditing] = useState(false);
  const [payoutInput, setPayoutInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const cooldown = useCooldown(cooldownUntil);
  const inputId = useId();
  const inputRef = useRef(null);
  const caretRef = useRef(null);
  const [, rerender] = useReducer((n) => n + 1, 0);
  const seps = useMemo(() => localeSeparators(), []);
  const display = formatAmountInput(payoutInput, seps);
  const myGuess = guessOf(myEntry);
  const lastEditMs = toMs(myEntry && myEntry.lastEditAt);

  // Seed the input from the saved guess and resume an edit cooldown.
  useEffect(() => {
    if (myGuess != null) setPayoutInput(String(myGuess));
    if (lastEditMs && lastEditMs + EDIT_COOLDOWN_MS > Date.now()) setCooldownUntil(lastEditMs + EDIT_COOLDOWN_MS);
  }, [myGuess, lastEditMs]);

  // Regrouping moves characters around the caret; put it back after the same digit.
  useLayoutEffect(() => {
    const el = inputRef.current;
    const count = caretRef.current;
    caretRef.current = null;
    if (count == null || !el || document.activeElement !== el) return;
    const pos = caretAfter(el.value, count, seps.decimal);
    el.setSelectionRange(pos, pos);
  });

  const onAmountChange = (e) => {
    const { value, selectionStart } = e.target;
    const next = parseAmountInput(value, seps);
    const caret = (selectionStart ?? value.length) - (next === null ? 1 : 0);
    caretRef.current = significantBefore(value, caret, seps.decimal);
    if (next !== null) setPayoutInput(next);
    rerender();
  };

  const valid = payoutInput !== '' && Number(payoutInput) > 0;
  const canSubmit = valid && !submitting && cooldown === 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await authedFetch('/api/predictions/submit', {
        method: 'POST',
        body: JSON.stringify({ roundId: round.id, payoutGuess: Number(payoutInput) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === 'COOLDOWN' && data.retryAfter) {
          setCooldownUntil(Date.now() + data.retryAfter * 1000);
          setFeedback({ kind: 'error', message: `Wait ${data.retryAfter}s to edit again.` });
        } else {
          setFeedback({ kind: 'error', message: ERRORS[data.error] || data.error || 'Submit failed.' });
        }
      } else {
        setCooldownUntil(Date.now() + EDIT_COOLDOWN_MS);
        setEditing(false);
        setFeedback({ kind: 'success', message: data.isNew ? 'Slip submitted.' : 'Slip updated.' });
      }
    } catch {
      setFeedback({ kind: 'error', message: 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (myGuess != null && !editing) {
    const others = Math.max(0, guessCount - 1);
    return (
      <Ticket header={<SlipHeader serial={serial} locked title="You're on the board" sub="Good luck. Results land when the last bonus opens." />}>
        <div className="flex flex-col gap-3">
          <BigGuess value={myGuess} currency={currency} />
          <p className="text-[0.8125rem] text-onair-viewer-muted">
            {others > 0
              ? `Sealed with ${others} other ${others === 1 ? 'guess' : 'guesses'}. Revealed when entries close.`
              : 'First on the board. Revealed when entries close.'}
          </p>
          <OnAirButton
            variant="ghost"
            onClick={() => {
              setEditing(true);
              setFeedback(null);
            }}
          >
            Change guess
          </OnAirButton>
          {cooldown > 0 && <Note>Edit again in {cooldown}s</Note>}
          <Feedback feedback={feedback} />
        </div>
      </Ticket>
    );
  }

  const picks = quickPicks(startCost);
  return (
    <Ticket header={<SlipHeader serial={serial} title="Call the payout" sub={prize ? `Closest guess takes ${prize}.` : 'Closest guess wins.'} />}>
      <div className="flex flex-col gap-3">
        <label htmlFor={inputId} className="sr-only">
          Final payout guess
        </label>
        <div
          className={`flex items-center gap-1.5 rounded-onair-inner bg-black/[0.35] px-4 py-1 shadow-onair-well ring-1 focus-within:ring-2 focus-within:ring-onair-viewer-light ${
            valid ? 'ring-onair-viewer-bright/[0.55]' : 'ring-white/[0.06]'
          }`}
        >
          <span className="text-[0.9375rem] font-bold text-onair-viewer-muted">{currency || '$'}</span>
          <div className="min-w-0 flex-1" style={{ containerType: 'inline-size' }}>
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={display}
              onChange={onAmountChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder={`0${seps.decimal}00`}
              className="block w-full min-w-0 bg-transparent py-2 text-[2rem] font-extrabold tabular-nums text-white-body outline-none placeholder:text-onair-viewer-muted/50"
              style={{ fontSize: fitFontSize(display || '0.00', { min: 1.25, max: 2 }) }}
            />
          </div>
        </div>
        {picks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {picks.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPayoutInput(String(p.value))}
                className={`min-h-9 rounded-onair-tile bg-white/[0.07] px-3 text-xs text-onair-viewer-ink hover:bg-white/[0.13] ${FOCUS}`}
              >
                {p.label} {formatMoney(p.value, currency, { decimals: 0 })}
              </button>
            ))}
          </div>
        )}
        <OnAirButton variant="viewer" onClick={submit} disabled={!canSubmit}>
          {submitting ? 'Locking…' : myGuess != null ? 'Update guess' : 'Lock it in'}
        </OnAirButton>
        {cooldown > 0 && <p className="text-center text-xs text-onair-winner-warm">Edit again in {cooldown}s</p>}
        <Feedback feedback={feedback} />
        <Note>Editable until Goofer closes entries.</Note>
        {myGuess != null && (
          <OnAirButton
            variant="ghost"
            size="sm"
            className="self-center"
            onClick={() => {
              setEditing(false);
              setPayoutInput(String(myGuess));
            }}
          >
            Keep {formatMoney(myGuess, currency)}
          </OnAirButton>
        )}
      </div>
    </Ticket>
  );
}

function positionText({ below, above }) {
  return `${below} ${below === 1 ? 'guess' : 'guesses'} below you · ${above} above`;
}

export default function HuntSlip({ mode, round, viewer, onSignIn, myEntry, currency, startCost, prize, guessCount = 0, position = null, rank = null }) {
  const twitchId = viewer && viewer.twitchId;
  const serial = fakeSerial(round && round.id, twitchId);
  const prizeLine = prize ? `Closest guess takes ${prize}.` : 'Closest guess wins.';
  const myGuess = guessOf(myEntry);

  if (!twitchId) {
    const title = mode === 'open' ? 'Call the payout' : mode === 'locked' ? 'Entries closed' : 'Call the next payout';
    const sub =
      mode === 'offair'
        ? 'Predictions open when Goofer starts a round.'
        : mode === 'locked'
          ? 'Sign in to be ready for the next round.'
          : prizeLine;
    return (
      <Ticket header={<SlipHeader serial={serial} title={title} sub={sub} />}>
        <OnAirButton variant="viewer" onClick={onSignIn}>
          Sign in with Twitch
        </OnAirButton>
      </Ticket>
    );
  }

  if (mode === 'offair') {
    return (
      <Ticket header={<SlipHeader serial={serial} title="No round open" sub="Predictions open when Goofer starts a round." />}>
        <Note>Your slip unlocks when entries open.</Note>
      </Ticket>
    );
  }

  if (mode === 'open') {
    return (
      <OpenSlip
        key={round.id}
        round={round}
        serial={serial}
        myEntry={myEntry}
        currency={currency}
        startCost={startCost}
        prize={prize}
        guessCount={guessCount}
      />
    );
  }

  if (mode === 'locked') {
    if (myGuess == null) {
      return (
        <Ticket header={<SlipHeader serial={serial} title="Entries closed" sub="You didn't get a guess in this round. Next one's yours." />}>
          <Note>Results land when the last bonus opens.</Note>
        </Ticket>
      );
    }
    return (
      <Ticket header={<SlipHeader serial={serial} locked title="Entries closed" sub="Good luck. Results land when the last bonus opens." />}>
        <div className="flex flex-col gap-3">
          <BigGuess value={myGuess} currency={currency} />
          {position && <p className="text-[0.8125rem] text-onair-viewer-muted">{positionText(position)}</p>}
        </div>
      </Ticket>
    );
  }

  // settled
  if (myGuess == null) {
    return (
      <Ticket header={<SlipHeader serial={serial} title="Call the next payout" sub={prizeLine} />}>
        <Note>Next round opens when Goofer starts the next hunt.</Note>
      </Ticket>
    );
  }
  const actual = round.actual && round.actual.payout;
  const won = (round.winners || []).find((w) => w && w.twitchId === twitchId);
  const sub = won
    ? winnerPrizeText(won.prize) || 'You placed this round.'
    : rank
      ? `Off by ${formatMoney(Math.abs(myGuess - actual), currency)} · ${ordinal(rank.place)} of ${rank.of}`
      : `Off by ${formatMoney(Math.abs(myGuess - actual), currency)}`;
  return (
    <Ticket header={<SlipHeader serial={serial} title={won ? `${placeLabel(won.place)} place!` : 'Your result'} sub={sub} />}>
      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-onair-viewer-muted">Your guess</dt>
          <dd className="font-bold tabular-nums">{formatMoney(myGuess, currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-onair-viewer-muted">Actual</dt>
          <dd className="font-bold tabular-nums text-onair-winner-light">{formatMoney(actual, currency)}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <Note>Next round opens when Goofer starts the next hunt.</Note>
      </div>
    </Ticket>
  );
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- --watchAll=false --testPathPattern=HuntSlip`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add src/components/hunts/HuntSlip.js src/components/hunts/__tests__/HuntSlip.test.js && git commit -m "feat(hunts): prediction slip on the On Air ticket"
```

---

### Task 10: RunnerUpCard and PastEpisodes

**Files:**
- Create: `src/components/hunts/RunnerUpCard.js`, `src/components/hunts/PastEpisodes.js`
- Test: `src/components/hunts/__tests__/HuntRail.test.js`

**Interfaces:**
- Consumes: `Panel`, `MONO`, `FOCUS` (Task 2); `entryName` (Task 4); `winnerPrizeText`, `signedMoney` (Task 4); `formatEpisodeDate` (Task 4); `ViewerAvatar` (Task 6); `huntTypeLabel`, `profitLoss` (`src/utils/huntFormat.js`); `placeLabel` (`src/utils/predictionRewards.js`).
- Produces: `<RunnerUpCard winners />` (null when no places 2+); `<PastEpisodes hunts activeId onSelect(id|null) />` (null when empty).

- [ ] **Step 1: Write the failing tests**

Create `src/components/hunts/__tests__/HuntRail.test.js`:

```js
import { fireEvent, render, screen } from '@testing-library/react';
import RunnerUpCard from '../RunnerUpCard';
import PastEpisodes from '../PastEpisodes';

test('runner-up card lists places 2 and up with their prizes', () => {
  render(
    <RunnerUpCard
      winners={[
        { place: 1, twitchId: 'x', displayName: 'Xilentdrifter', prize: { tickets: 500 } },
        { place: 3, twitchId: 'r', displayName: 'RYGARTEARROW', prize: { tickets: 50 } },
        { place: 2, twitchId: 's', displayName: 'skillsytv', prize: { tickets: 100 } },
      ]}
    />
  );
  const labels = screen.getAllByText(/Runner-up|3rd place/).map((n) => n.textContent);
  expect(labels).toEqual(['Runner-up', '3rd place']);
  expect(screen.getByText('skillsytv')).toBeTruthy();
  expect(screen.getByText('+100 tickets')).toBeTruthy();
  expect(screen.queryByText('Xilentdrifter')).toBeNull();
});

test('runner-up card renders nothing without places 2+', () => {
  const { container } = render(<RunnerUpCard winners={[{ place: 1, twitchId: 'x' }]} />);
  expect(container.firstChild).toBeNull();
});

test('past episodes: name, date, signed result; selecting toggles', () => {
  const onSelect = jest.fn();
  const hunts = [
    { id: 'a', huntType: 'community', endedAt: '2026-09-27T23:00:00', pot: 1000, totalWon: 2284.4 },
    { id: 'b', huntType: 'solo', endedAt: '2026-09-24T23:00:00', pot: 500, totalWon: 387.95 },
    { id: 'c', huntType: 'vip', endedAt: null, pot: 0, totalWon: 50 },
  ];
  const { rerender } = render(<PastEpisodes hunts={hunts} activeId={null} onSelect={onSelect} />);
  expect(screen.getByText('Past episodes')).toBeTruthy();
  expect(screen.getByText('+$1,284.40')).toBeTruthy();
  expect(screen.getByText('−$112.05').className).toContain('text-onair-loss');
  expect(screen.getByText('SEP 27')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Community hunt/ }));
  expect(onSelect).toHaveBeenCalledWith('a');
  rerender(<PastEpisodes hunts={hunts} activeId="a" onSelect={onSelect} />);
  const active = screen.getByRole('button', { name: /Community hunt/ });
  expect(active.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(active);
  expect(onSelect).toHaveBeenLastCalledWith(null);
});

test('past episodes renders nothing for an empty list', () => {
  const { container } = render(<PastEpisodes hunts={[]} activeId={null} onSelect={() => {}} />);
  expect(container.firstChild).toBeNull();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- --watchAll=false --testPathPattern=HuntRail`
Expected: FAIL with "Cannot find module '../RunnerUpCard'".

- [ ] **Step 3: Write the components**

Create `src/components/hunts/RunnerUpCard.js`:

```js
import Panel from '../onAir/Panel';
import { MONO } from '../onAir/classes';
import { placeLabel } from '../../utils/predictionRewards';
import { entryName } from './huntBoard';
import { winnerPrizeText } from './huntStats';
import ViewerAvatar from './ViewerAvatar';

// Settled rounds: everyone who placed after the winner, with what they won.
export default function RunnerUpCard({ winners }) {
  const rest = (winners || []).filter((w) => w && w.place >= 2).sort((a, b) => a.place - b.place);
  if (!rest.length) return null;
  return (
    <Panel as="section" aria-label="Runners-up" className="flex flex-col gap-3 px-5 py-[18px]">
      {rest.map((w) => {
        const name = entryName(w);
        const prize = winnerPrizeText(w.prize);
        return (
          <div key={`${w.place}-${w.twitchId}`} className="flex items-center gap-3.5">
            <ViewerAvatar
              src={w.profileImageUrl}
              name={name}
              className="h-11 w-11 bg-gradient-to-br from-onair-ink-3 to-onair-ink-6 text-onair-surface-1"
            />
            <div className="min-w-0 flex-1">
              <p className={`${MONO} text-[0.625rem] tracking-[0.2em] text-onair-ink-5`}>
                {w.place === 2 ? 'Runner-up' : `${placeLabel(w.place)} place`}
              </p>
              <p className="truncate text-[1.0625rem] font-extrabold">{name}</p>
            </div>
            {prize && <p className="text-sm font-bold text-onair-ink-3">{prize}</p>}
          </div>
        );
      })}
    </Panel>
  );
}
```

Create `src/components/hunts/PastEpisodes.js`:

```js
import { useId } from 'react';
import Panel from '../onAir/Panel';
import { FOCUS, MONO } from '../onAir/classes';
import { huntTypeLabel, profitLoss } from '../../utils/huntFormat';
import { formatEpisodeDate } from './huntTime';
import { signedMoney } from './huntStats';

// Recent communityhunts hunts. Selecting one swaps the recap card to it;
// selecting it again goes back to tonight.
export default function PastEpisodes({ hunts, activeId, onSelect }) {
  const headingId = useId();
  const list = Array.isArray(hunts) ? hunts : [];
  if (!list.length) return null;
  return (
    <Panel as="section" aria-labelledby={headingId} className="flex flex-col gap-0.5 p-2.5">
      <h2 id={headingId} className={`${MONO} flex justify-between px-3 pb-1.5 pt-2.5 text-[0.625rem] tracking-[0.24em] text-onair-ink-5`}>
        <span>Past episodes</span>
        <span aria-hidden="true">{String(list.length).padStart(3, '0')}</span>
      </h2>
      <ul className="flex flex-col gap-0.5">
        {list.map((h) => {
          const result = profitLoss(h);
          const active = h.id === activeId;
          const tone = result == null ? 'text-onair-ink-5' : result < 0 ? 'text-onair-loss' : 'text-onair-signal';
          return (
            <li key={h.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : h.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-onair-control p-3 text-left hover:bg-white/[0.04] ${active ? 'bg-white/[0.06]' : ''} ${FOCUS}`}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[0.9375rem] font-semibold">{huntTypeLabel(h.huntType)} hunt</span>
                  <span className={`${MONO} text-[0.625rem] tracking-[0.12em] text-onair-ink-5`}>
                    {formatEpisodeDate(h.endedAt || h.startedAt)}
                  </span>
                </span>
                <span className={`text-sm font-bold tabular-nums ${tone}`}>{signedMoney(result, h.currency || null)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- --watchAll=false --testPathPattern=HuntRail`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add src/components/hunts/RunnerUpCard.js src/components/hunts/PastEpisodes.js src/components/hunts/__tests__/HuntRail.test.js && git commit -m "feat(hunts): runner-up card and past episodes rail"
```

---

### Task 11: HuntsTab, fixtures, the page swap and removal of the old tab

**Files:**
- Create: `src/components/hunts/HuntsTab.js`, `src/components/hunts/huntFixtures.js`
- Modify: `src/pages/HuntsPage.js` (full rewrite), `src/pages/__tests__/HuntsPage.test.js` (full rewrite), `src/components/hunts/__tests__/huntsTab.test.js` (trim), `tailwind.config.js` (remove `tote-flip`)
- Delete: `src/components/PredictionSlip.js`, `src/components/PredictionWall.js`, `src/components/PredictionNumberLine.js`, `src/components/hunts/CurrentHuntCard.js`, `src/components/hunts/RecentHunts.js`, `src/components/hunts/BonusReel.js`, `src/components/hunts/HuntBonuses.js`, `src/components/hunts/ProfitBadge.js`, `src/components/hunts/useHuntDetail.js`, `src/components/__tests__/PredictionSlip.test.js`, `src/components/__tests__/PredictionWall.test.js`, `src/components/__tests__/sealedGuesses.test.js`
- Test: `src/components/hunts/__tests__/HuntsTab.test.js`, `src/pages/__tests__/HuntsPage.test.js`

**Interfaces:**
- Consumes: everything from Tasks 2–10; `roundCurrency` (`src/utils/predictionRound.js`); `useTuningPhrase` (`src/hooks/useTuningPhrase.js`); `useCommunityHunts` (`src/hooks/useCommunityHunts.js`); `useTwitchAuth` (`src/contexts/TwitchAuthContext`, `{ twitchUser, loginWithTwitch }`); `CommunityHuntsPromo`, `SuggestionSubmit` (`hunt` prop), `SuggestionList` (`huntId`, `adminMode` props).
- Produces: `<HuntsTab round entries sealed myEntry viewer onSignIn live recent />` (`round` is `undefined` while loading); `HUNT_FIXTURES: { open, 'open-staff', locked, settled, offair }` each a `HuntsTab` props object without `onSignIn`.

- [ ] **Step 1: Write the failing tab test**

Create `src/components/hunts/__tests__/HuntsTab.test.js`:

```js
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HuntsTab from '../HuntsTab';
import { HUNT_FIXTURES } from '../huntFixtures';
import { __resetHuntCacheForTests } from '../useHunt';

jest.mock('../../../config/firebase', () => ({ db: {}, auth: {} }));
// Plain functions returning strings: JSX inside a jest.mock factory trips the
// hoisting guard on the injected JSX runtime import.
jest.mock('../../SuggestionSubmit', () => function MockSuggestionSubmit() {
  return 'suggest form';
});
jest.mock('../../SuggestionList', () => function MockSuggestionList() {
  return 'suggest list';
});

beforeEach(() => {
  __resetHuntCacheForTests();
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
});

// Smoke test over every dev fixture: each state renders its key copy and never NaN.
test.each([
  ['open', /Predictions open/i, 'Guesses so far'],
  ['open-staff', /Predictions open/i, 'Guesses so far'],
  ['locked', /Opening bonuses/i, 'Guesses so far'],
  ['settled', /And the closest guess is/i, "Tonight's lineup"],
])('%s fixture renders cleanly', (key, eyebrow, lineup) => {
  const { container } = render(<HuntsTab {...HUNT_FIXTURES[key]} onSignIn={() => {}} />);
  expect(screen.getAllByText(eyebrow).length).toBeGreaterThan(0);
  expect(screen.getByRole('heading', { name: lineup })).toBeTruthy();
  expect(container.textContent).not.toMatch(/NaN|Infinity/);
});

test('the open fixture matches the handoff figures', () => {
  render(<HuntsTab {...HUNT_FIXTURES['open-staff']} onSignIn={() => {}} />);
  expect(screen.getByText('109.1')).toBeTruthy();
  expect(screen.getAllByText('$22.20').length).toBeGreaterThan(0);
});

test('the settled fixture crowns Xilentdrifter and shows the hunt result', () => {
  render(<HuntsTab {...HUNT_FIXTURES.settled} onSignIn={() => {}} />);
  expect(screen.getAllByText('Xilentdrifter').length).toBeGreaterThan(0);
  expect(screen.getByText('−$375.70')).toBeTruthy();
  expect(screen.getByText('Runner-up')).toBeTruthy();
});

test('off air with no round hides the lineup and offers sign-in', () => {
  render(<HuntsTab {...HUNT_FIXTURES.offair} onSignIn={() => {}} />);
  expect(screen.queryByRole('heading', { name: 'Guesses so far' })).toBeNull();
  expect(screen.getAllByText(/Last hunt/i).length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Sign in with Twitch' })).toBeTruthy();
});

test('loading shows the tuning screen and no slip', () => {
  render(<HuntsTab {...HUNT_FIXTURES.offair} round={undefined} onSignIn={() => {}} />);
  expect(screen.getByText(/Tuning signal|Warming the tubes|Acquiring feed/)).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Prediction slip' })).toBeNull();
});

test('choosing a past episode swaps the recap, and back returns to tonight', async () => {
  render(<HuntsTab {...HUNT_FIXTURES.settled} onSignIn={() => {}} />);
  fireEvent.click(screen.getAllByRole('button', { pressed: false }).find((b) => /hunt/i.test(b.textContent) && /SEP/.test(b.textContent)));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Back to tonight' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Back to tonight' }));
  expect(screen.getByRole('heading', { name: 'Hunt recap' })).toBeTruthy();
});

test('suggestions render when the round accepts them', () => {
  const fx = HUNT_FIXTURES.open;
  render(<HuntsTab {...fx} round={{ ...fx.round, acceptSuggestions: true }} onSignIn={() => {}} />);
  expect(screen.getByText('suggest form')).toBeTruthy();
  expect(screen.getByText('suggest list')).toBeTruthy();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- --watchAll=false --testPathPattern=HuntsTab`
Expected: FAIL with "Cannot find module '../HuntsTab'".

- [ ] **Step 3: Write the fixtures**

Create `src/components/hunts/huntFixtures.js`:

```js
// Dev-only fixtures for /gamba/hunts?fixture=… (HuntsPage strips them from
// production builds). Figures reproduce the On Air handoff: 37 bonuses,
// start cost $2,421.82, total bet $22.20 (109.1x), final payout $2,046.12.

const SLOTS = [
  ['Wanted Dead or a Wild', 0.6, 812],
  ['Gates of Olympus', 0.8, 41.5],
  ['Sweet Bonanza', 0.6, 12.2],
  ['Mental', 0.4, 268],
  ['Sugar Rush', 0.6, 3.1],
  ['Chaos Crew', 0.6, 74],
  ['The Dog House', 0.8, 0],
  ['Fruit Party', 0.6, 28.4],
  ['Starlight Princess', 0.4, 156],
  ['Big Bass Bonanza', 0.6, 9.6],
];
const LATER_MULTIS = [35, 120, 8, 52, 0, 61, 15, 210, 44];
const START_COST = 2421.82;
const ACTUAL = 2046.12;
const round2 = (n) => Math.round(n * 100) / 100;

function finalBonuses() {
  const list = Array.from({ length: 37 }, (_, i) => {
    const [slot, bet0, multi0] = SLOTS[i % SLOTS.length];
    const bet = i === 36 ? 0.6 : bet0;
    const multiplier = i < 10 ? multi0 : LATER_MULTIS[(i - 10) % LATER_MULTIS.length];
    return { slot, bet, win: round2(bet * multiplier), multiplier, thumb: null };
  });
  // The last bonus closes the gap to the handoff's final payout exactly.
  const last = list[36];
  last.win = round2(ACTUAL - list.slice(0, 36).reduce((a, b) => a + b.win, 0));
  last.multiplier = round2(last.win / last.bet);
  return list;
}

const FINAL = finalBonuses();
const UNOPENED = FINAL.map((b) => ({ ...b, win: null, multiplier: null }));
const OPENING = FINAL.map((b, i) => (i < 12 ? b : { ...b, win: null, multiplier: null }));

const ago = (minutes) => new Date(Date.now() - minutes * 60 * 1000);
const GUESSES = [
  ['skillsytv', 1855, 12],
  ['G4KUR4', 3663, 9],
  ['GRUMPZILLA12', 3100, 7],
  ['RYGARTEARROW', 2777, 5],
  ['Xilentdrifter', 2122, 3],
  ['JESSEJEK', 3333, 1],
];
const ENTRIES = GUESSES.map(([name, payoutGuess, min]) => ({
  id: name,
  twitchId: name,
  displayName: name,
  profileImageUrl: null,
  payoutGuess,
  submittedAt: ago(min),
}));
const VIEWER = { twitchId: 'fx-viewer', displayName: 'vonbrandt' };
const MY_ENTRY = { id: 'fx-viewer', twitchId: 'fx-viewer', displayName: 'vonbrandt', payoutGuess: 2450, submittedAt: ago(0.2) };

const HUNT = { id: 'fx-hunt', huntType: 'community', currency: null, pot: START_COST, bonusCount: 37, startedAt: ago(90).toISOString() };
const EPISODES = [
  { id: 'fx-ep1', huntType: 'community', currency: null, pot: 1800, totalWon: 3084.4, averageMultiple: 128.5, bonusCount: 24, endedAt: '2026-09-27T23:30:00', bonuses: FINAL.slice(0, 24) },
  { id: 'fx-ep2', huntType: 'solo', currency: null, pot: 600, totalWon: 487.95, averageMultiple: 40.6, bonusCount: 12, endedAt: '2026-09-24T23:30:00', bonuses: FINAL.slice(0, 12) },
  { id: 'fx-ep3', huntType: 'vip', currency: null, pot: 1500, totalWon: 2142.9, averageMultiple: 97.4, bonusCount: 22, endedAt: '2026-09-20T23:30:00', bonuses: FINAL.slice(0, 22) },
];
const TIERS = [
  { place: 1, tickets: 500, prize: null },
  { place: 2, tickets: 100, prize: null },
];
const ROUND = {
  id: 'fx-round',
  title: 'Thursday Comm Hunt',
  acceptPredictions: true,
  acceptSuggestions: false,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'fx-hunt', totalCost: START_COST, currency: null, bonusCount: 37 },
  rewards: { tiers: TIERS },
};

export const HUNT_FIXTURES = {
  open: {
    round: { ...ROUND, status: 'open', entryCount: 7 },
    entries: [],
    sealed: true,
    myEntry: MY_ENTRY,
    viewer: VIEWER,
    live: { ...HUNT, status: 'live', totalWon: 0, bonuses: UNOPENED },
    recent: EPISODES,
  },
  'open-staff': {
    round: { ...ROUND, status: 'open', entryCount: 6 },
    entries: ENTRIES,
    sealed: false,
    myEntry: null,
    viewer: null,
    live: { ...HUNT, status: 'live', totalWon: 0, bonuses: UNOPENED },
    recent: EPISODES,
  },
  locked: {
    round: { ...ROUND, status: 'locked', entryCount: 7 },
    entries: [...ENTRIES, MY_ENTRY],
    sealed: false,
    myEntry: MY_ENTRY,
    viewer: VIEWER,
    live: { ...HUNT, status: 'live', bonuses: OPENING },
    recent: EPISODES,
  },
  settled: {
    round: {
      ...ROUND,
      status: 'settled',
      entryCount: 6,
      actual: { payout: ACTUAL },
      settledAt: new Date(2026, 9, 1, 23, 42),
      winners: [
        { place: 1, twitchId: 'Xilentdrifter', displayName: 'Xilentdrifter', profileImageUrl: null, payoutGuess: 2122, diff: 75.88, prize: { tickets: 500 } },
        { place: 2, twitchId: 'skillsytv', displayName: 'skillsytv', profileImageUrl: null, payoutGuess: 1855, diff: 191.12, prize: { tickets: 100 } },
      ],
    },
    entries: ENTRIES,
    sealed: false,
    myEntry: null,
    viewer: null,
    live: null,
    recent: [{ ...HUNT, status: 'archived', totalWon: ACTUAL, averageMultiple: round2(ACTUAL / 22.2), endedAt: '2026-10-01T23:40:00', bonuses: FINAL }, ...EPISODES],
  },
  offair: {
    round: null,
    entries: [],
    sealed: false,
    myEntry: null,
    viewer: null,
    live: null,
    recent: [{ ...HUNT, status: 'archived', totalWon: ACTUAL, averageMultiple: round2(ACTUAL / 22.2), endedAt: '2026-10-01T23:40:00', bonuses: FINAL }, ...EPISODES],
  },
};
```

- [ ] **Step 4: Write HuntsTab**

Create `src/components/hunts/HuntsTab.js`:

```js
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../utils/money';
import { huntTypeLabel } from '../../utils/huntFormat';
import { roundCurrency } from '../../utils/predictionRound';
import useTuningPhrase from '../../hooks/useTuningPhrase';
import SuggestionSubmit from '../SuggestionSubmit';
import SuggestionList from '../SuggestionList';
import CommunityHuntsPromo from './CommunityHuntsPromo';
import { huntMode, huntStats, median, signedMoney, tabHuntRef, topPrizeText, winnerPrizeText } from './huntStats';
import { entryName, guessOf, guessPosition, meterModel, rankEntries, tickerItems } from './huntBoard';
import { formatEpisodeDate, screenClock } from './huntTime';
import useHunt from './useHunt';
import useNow from './useNow';
import HuntMonitor from './HuntMonitor';
import HuntLineup from './HuntLineup';
import HuntRecap from './HuntRecap';
import HuntSlip from './HuntSlip';
import RunnerUpCard from './RunnerUpCard';
import PastEpisodes from './PastEpisodes';

const RECAP = {
  docket: 'On the docket',
  opening: 'Opening now',
  final: 'Hunt recap',
};

function recapKind(mode, isLive) {
  if (mode === 'open') return 'docket';
  if (mode === 'locked') return 'opening';
  if (mode === 'offair' && isLive) return 'opening';
  return 'final';
}

const episodeTitle = (h) => `${huntTypeLabel(h.huntType)} hunt · ${formatEpisodeDate(h.endedAt || h.startedAt)}`;

// The Hunts tab, composed from raw data: the latest round (undefined while
// loading), its entries (empty while sealed), the viewer's entry, and the
// communityhunts overview. Two columns from lg; below lg the columns become
// display:contents and the pieces reorder so the slip sits under the monitor.
export default function HuntsTab({ round, entries = [], sealed = false, myEntry = null, viewer = null, onSignIn, live = null, recent = [] }) {
  const loading = round === undefined;
  const r = loading ? null : round;
  const mode = loading ? 'tuning' : huntMode(r);
  const myId = viewer ? viewer.twitchId : null;

  const ref = tabHuntRef(r, live, recent);
  const tab = useHunt(ref.huntId, ref.summary);
  const [episodeId, setEpisodeId] = useState(null);
  const episodes = (recent || []).filter((h) => h.id !== ref.huntId);
  const episodeSummary = episodes.find((h) => h.id === episodeId) || null;
  const episode = useHunt(episodeSummary ? episodeSummary.id : null, episodeSummary);
  const recapRef = useRef(null);

  const phrase = useTuningPhrase(loading);
  const now = useNow(30 * 1000, mode === 'open' || mode === 'locked' || (mode === 'offair' && ref.isLive));

  useEffect(() => {
    if (episodeId && recapRef.current && typeof recapRef.current.scrollIntoView === 'function') {
      recapRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [episodeId]);

  const currency = roundCurrency(r) || (tab.hunt && tab.hunt.currency) || null;
  const stats = huntStats(tab.hunt, r);
  const prize = topPrizeText(r);
  const winners = ((r && r.winners) || []).filter(Boolean);
  const winner = winners.find((w) => w.place === 1) || null;
  const runnerUp = winners.find((w) => w.place === 2) || null;
  const revealed = sealed ? [] : entries;
  const guessCount = sealed ? (r && r.entryCount) || 0 : revealed.filter((e) => guessOf(e) != null).length;
  const chatMedian = mode === 'locked' || mode === 'settled' ? median(revealed.map(guessOf)) : null;
  const meter = meterModel({ mode, sealed, entries: revealed, myEntry, myId, startCost: stats.startCost, wonSoFar: stats.wonSoFar, round: r });
  const offair = { isLive: ref.isLive, hasHunt: !!tab.hunt, title: tab.hunt ? `${huntTypeLabel(tab.hunt.huntType)} hunt` : null };
  const ticker =
    mode === 'tuning'
      ? []
      : tickerItems(mode, {
          stats,
          guessCount,
          prize,
          winner: winner && { name: entryName(winner), prize: winnerPrizeText(winner.prize) },
          runnerUp: runnerUp && { name: entryName(runnerUp), prize: winnerPrizeText(runnerUp.prize) },
          isLive: ref.isLive,
          money: (v) => formatMoney(v, currency),
          signed: (v) => signedMoney(v, currency),
        });
  const clock = screenClock(mode, { round: r, hunt: tab.hunt, now, isLive: ref.isLive });

  const actual = r && r.actual && r.actual.payout;
  const ranked = mode === 'settled' && typeof actual === 'number' ? rankEntries(revealed, actual) : [];
  const myRankIndex = myId ? ranked.findIndex((e) => (e.twitchId || e.id) === myId) : -1;
  const rank = myRankIndex >= 0 ? { place: myRankIndex + 1, of: ranked.length } : null;
  const position = mode === 'locked' && myId ? guessPosition(revealed, myId) : null;

  const showLineup = mode === 'open' || mode === 'locked' || mode === 'settled';
  const showRecap = mode !== 'tuning' && (!!tab.hunt || (r && mode !== 'offair'));
  const hasRunnerUp = mode === 'settled' && winners.some((w) => w.place >= 2);

  const kind = recapKind(mode, ref.isLive);
  const recap =
    episodeId && episode.hunt
      ? {
          kind: 'final',
          title: episodeTitle(episode.hunt),
          stats: huntStats(episode.hunt, null),
          currency: episode.hunt.currency || null,
          loading: episode.loading,
          error: episode.error,
          onBack: () => setEpisodeId(null),
        }
      : { kind, title: RECAP[kind], stats, currency, loading: tab.loading, error: tab.error, onBack: null };

  return (
    <div className="flex flex-col gap-6 font-onair text-onair-ink-1">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-6">
          <div className="order-1 min-w-0">
            <HuntMonitor
              mode={mode}
              round={r}
              stats={stats}
              meter={meter}
              currency={currency}
              guessCount={guessCount}
              prize={prize}
              winner={winner}
              chatMedian={chatMedian}
              offair={offair}
              clock={clock}
              ticker={ticker}
              phrase={phrase}
            />
          </div>
          {showLineup && (
            <div className="order-3 min-w-0">
              <HuntLineup mode={mode} sealed={sealed} entries={revealed} round={r} myEntry={myEntry} myId={myId} currency={currency} now={now} />
            </div>
          )}
          {(showRecap || recap.onBack) && (
            <div className="order-4 min-w-0 scroll-mt-24" ref={recapRef}>
              <HuntRecap {...recap} />
            </div>
          )}
          {r && r.acceptSuggestions && (
            <div className="order-7 flex min-w-0 flex-col gap-6">
              <SuggestionSubmit hunt={r} />
              <SuggestionList huntId={r.id} adminMode={false} />
            </div>
          )}
        </div>
        <div className="contents lg:flex lg:w-[340px] lg:flex-none lg:flex-col lg:gap-5">
          {!loading && (
            <div className="order-2">
              <HuntSlip
                mode={mode}
                round={r}
                viewer={viewer}
                onSignIn={onSignIn}
                myEntry={myEntry}
                currency={currency}
                startCost={stats.startCost}
                prize={prize}
                guessCount={guessCount}
                position={position}
                rank={rank}
              />
            </div>
          )}
          {hasRunnerUp && (
            <div className="order-5">
              <RunnerUpCard winners={winners} />
            </div>
          )}
          {episodes.length > 0 && (
            <div className="order-6">
              <PastEpisodes hunts={episodes} activeId={episodeId} onSelect={setEpisodeId} />
            </div>
          )}
        </div>
      </div>
      <CommunityHuntsPromo />
    </div>
  );
}
```

- [ ] **Step 5: Run the tab test to see it pass**

Run: `npm test -- --watchAll=false --testPathPattern=HuntsTab`
Expected: PASS.

- [ ] **Step 6: Rewrite HuntsPage and its test**

Replace `src/pages/HuntsPage.js` with:

```js
import { useState } from 'react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import useCommunityHunts from '../hooks/useCommunityHunts';
import usePredictionRound from '../components/hunts/usePredictionRound';
import useRoundEntries from '../components/hunts/useRoundEntries';
import useMyEntry from '../components/hunts/useMyEntry';
import HuntsTab from '../components/hunts/HuntsTab';

// /gamba/hunts: wires live data into the On Air Hunts tab.
let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /gamba/hunts?fixture=open|open-staff|locked|settled|offair renders
  // the tab from the handoff's mock data. Webpack drops this branch, and the
  // fixture module with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    if (!key) return null;
    return require('../components/hunts/huntFixtures').HUNT_FIXTURES[key] || null;
  };
}

function LiveHuntsTab() {
  const round = usePredictionRound();
  const { entries, sealed } = useRoundEntries(round);
  const { twitchUser, loginWithTwitch } = useTwitchAuth();
  const myEntry = useMyEntry(round && round.id, twitchUser && twitchUser.twitchId);
  const { live, recent } = useCommunityHunts();
  return (
    <HuntsTab
      round={round}
      entries={entries}
      sealed={sealed}
      myEntry={myEntry}
      viewer={twitchUser}
      onSignIn={loginWithTwitch}
      live={live}
      recent={recent}
    />
  );
}

export default function HuntsPage() {
  const [fixture] = useState(readFixture);
  return fixture ? <HuntsTab {...fixture} onSignIn={() => {}} /> : <LiveHuntsTab />;
}
```

Replace `src/pages/__tests__/HuntsPage.test.js` with:

```js
import { render, screen, waitFor } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';
import HuntsPage from '../HuntsPage';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: (db, ...path) => ({ path: path.join('/') }),
  doc: (db, ...path) => ({ path: path.join('/') }),
  query: (ref) => ref,
  orderBy: () => ({}),
  limit: () => ({}),
  where: () => ({}),
  onSnapshot: jest.fn(),
}));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isStaff: false }) }));
jest.mock('../../contexts/TwitchAuthContext', () => ({
  useTwitchAuth: () => ({ twitchUser: null, loginWithTwitch: () => {} }),
}));

const ARCHIVED = { id: 'h1', status: 'archived', huntType: 'solo', currency: 'ARS', bonusCount: 48, pot: 150000, totalWon: 84221.4, averageMultiple: 20, endedAt: '2026-09-24T23:06:49.441Z' };

function roundSnapshot(round) {
  onSnapshot.mockImplementation((ref, next) => {
    if (ref.path === 'hunts') {
      next(round ? { empty: false, docs: [{ id: round.id, data: () => round }] } : { empty: true, docs: [] });
    }
    return () => {};
  });
}

function overview(body, ok = true) {
  global.fetch = jest.fn(() => Promise.resolve({ ok, status: ok ? 200 : 502, json: () => Promise.resolve(body) }));
}

beforeEach(() => onSnapshot.mockReset());

test('off air shows the last hunt and keeps the promo band', async () => {
  roundSnapshot(null);
  overview({ live: null, recent: [ARCHIVED] });
  render(<HuntsPage />);
  await waitFor(() => expect(screen.getAllByText(/Last hunt/i).length).toBeGreaterThan(0));
  expect(screen.getByLabelText('communityhunts.gg')).toBeTruthy();
});

// API down: the off-air screen and the promo band still render.
test('API failure keeps the off-air screen and the promo band', async () => {
  roundSnapshot(null);
  overview({ error: 'UPSTREAM_UNAVAILABLE' }, false);
  render(<HuntsPage />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Nothing on right now' })).toBeTruthy());
  expect(screen.getByLabelText('communityhunts.gg')).toBeTruthy();
});

test('an open round shows sealed rows and never queries entries', async () => {
  roundSnapshot({ id: 'r1', title: 'Sunday hunt', status: 'open', acceptPredictions: true, entryCount: 5, source: 'manual', manualTotalCost: 1000 });
  overview({ live: null, recent: [] });
  render(<HuntsPage />);
  await waitFor(() => expect(screen.getAllByTestId('face-down-row')).toHaveLength(5));
  const paths = onSnapshot.mock.calls.map(([ref]) => ref.path);
  expect(paths).not.toContain('hunts/r1/entries');
  expect(screen.queryByTestId('onair-static')).toBeNull();
});
```

- [ ] **Step 7: Trim the old hunts tab test**

In `src/components/hunts/__tests__/huntsTab.test.js`:
- Change the import block to:

```js
import { render, screen, waitFor, act } from '@testing-library/react';
import { profitLoss, huntTypeLabel, formatMultiplier } from '../../../utils/huntFormat';
import CommunityHuntsPromo from '../CommunityHuntsPromo';
import useCommunityHunts from '../../../hooks/useCommunityHunts';
```

- Delete the tests named `CurrentHuntCard shows a live hunt with its bonus reel`, `CurrentHuntCard shows the latest hunt without a reel`, `CurrentHuntCard for a finished hunt expands to load its bonuses`, `CurrentHuntCard renders a potless hunt without NaN`, `BonusReel renders an unopened bonus as em dashes` and `RecentHunts expands a row and loads its bonuses`. Their coverage now lives in `HuntRecap.test.js` (potless, unopened dashes, detail load via `huntHooks.test.js`) and `HuntsTab.test.js` (episode swap).
- Keep `huntFormat helpers`, `CommunityHuntsPromo links…` and `useCommunityHunts loads the overview…`. Delete the `LIVE` constant if nothing uses it any more.

- [ ] **Step 8: Delete the replaced components and their tests**

```bash
git rm src/components/PredictionSlip.js src/components/PredictionWall.js src/components/PredictionNumberLine.js \
  src/components/hunts/CurrentHuntCard.js src/components/hunts/RecentHunts.js src/components/hunts/BonusReel.js \
  src/components/hunts/HuntBonuses.js src/components/hunts/ProfitBadge.js src/components/hunts/useHuntDetail.js \
  src/components/__tests__/PredictionSlip.test.js src/components/__tests__/PredictionWall.test.js src/components/__tests__/sealedGuesses.test.js
```

Then confirm nothing else imports them:

```bash
grep -rnE "PredictionSlip|PredictionWall|PredictionNumberLine|CurrentHuntCard|RecentHunts|BonusReel|HuntBonuses|ProfitBadge|useHuntDetail|tote-flip" src
```

Expected: no matches except `tote-flip`, which is now unused: remove its keyframes entry (`'tote-flip': {...}` and the comment above it) and its animation entry (`'tote-flip': ...` and the two comment lines above it) from `tailwind.config.js`, then re-run the grep and expect no output.

- [ ] **Step 9: Run the full suite and the build**

Run: `npm test -- --watchAll=false`
Expected: all test suites pass (including `PredictionWinnersReveal.test.js`, still used by the Control Room).

Run: `npm run build`
Expected: "Compiled successfully." (no ESLint warnings in the new files; CI treats warnings as errors only with `CI=true`, but fix any warning shown).

Then confirm the fixtures were stripped:

```bash
grep -l "LATER_MULTIS\|fx-viewer" build/static/js/*.js
```

Expected: no output.

- [ ] **Step 10: Commit**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add -A src/components/hunts src/pages/HuntsPage.js src/pages/__tests__/HuntsPage.test.js tailwind.config.js && git add -u src/components && git commit -m "feat(hunts): On Air tab replaces the boxed slip, wall and hunt cards"
```

---

### Task 12: Docs, visual verification, independent review, PR

**Files:**
- Modify: `CLAUDE.md` (Gotchas + Design Context)

**Interfaces:**
- Consumes: the finished branch.
- Produces: a pushed branch and an open PR.

- [ ] **Step 1: Update CLAUDE.md**

In the "Design Context" section of `CLAUDE.md`, after the "A11y" bullet, add:

```markdown
- **On Air (pilot):** `/gamba/hunts` uses the On Air language (DESIGN.md §7): `onair` tokens in `tailwind.config.js`, primitives in `src/components/onAir/` (`Monitor`, `Panel`, `Chip`, `Ticket`, `OnAirButton`), Bricolage Grotesque + JetBrains Mono. Migrate other surfaces by opting into the tokens and primitives, never by copying hex values. In dev, `/gamba/hunts?fixture=open|open-staff|locked|settled|offair` renders every state from `src/components/hunts/huntFixtures.js` (stripped from production builds).
```

In the "Gotchas" hunts bullet, replace its last sentence (the one starting "The old viewer Hunt Tracker", which ends "share pages were removed.") with:

```markdown
The old viewer Hunt Tracker, `/live/*` and `/hunt-suggest/*` share pages were removed. The viewer Hunts tab is `src/components/hunts/HuntsTab.js`: pure derivations in `huntStats.js` / `huntBoard.js` / `huntTime.js`, one entries listener (`useRoundEntries`, never queried by viewers while open), and the monitor shows four modes (open, locked, settled, off air) from the latest round.
```

- [ ] **Step 2: Commit the docs**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git add CLAUDE.md && git commit -m "docs: On Air pilot and the new Hunts tab in CLAUDE.md"
```

- [ ] **Step 3: Visual check against the handoff**

Start the dev server (`npm start`, background) and open each state in the browser at 1280×900 and at 375×812:

- `/gamba/hunts?fixture=open` vs `docs/redesign/design_handoff_bonus_hunt_on_air/screenshots/01-open-top.png` (expected differences: lineup is face-down, the rail has no TV Guide)
- `/gamba/hunts?fixture=open-staff` vs `01-open-top.png`, `02-open-middle.png`, `03-open-bonus-table.png`
- `/gamba/hunts?fixture=locked` vs `04-open-slip-locked.png` (layout reference only; locked is a new screen)
- `/gamba/hunts?fixture=settled` vs `05-settled-top.png`, `06-settled-middle.png`, `07-settled-bonus-table.png`
- `/gamba/hunts?fixture=offair`

For each: no horizontal page scroll at 375px; slip directly under the monitor on phones; ticket holes show the page gradient; hero fits; lineup and bonus table use the compact grids. Then emulate `prefers-reduced-motion: reduce` (DevTools Rendering panel) and confirm the ticker is static and the LIVE dot does not pulse. Tab through the slip, quick picks, "Show all", "Hide bonuses", and the past episodes; every focus ring must be visible. Switch fixtures in place (e.g. edit the URL from `open` to `locked` is a full reload, so instead verify the static burst through the Monitor tests already in place, and do one live check by running `/admin/hunts` → lock a test round if a staff session is available; otherwise note it as unverified in the PR).

Fix anything that does not match, re-run `npm test -- --watchAll=false`, and commit fixes as `fix(hunts): …`.

- [ ] **Step 4: Independent review**

Dispatch two reviewers in parallel (Agent tool):
- `ui-finish-gate`: "Review the On Air Hunts tab (`src/components/onAir/`, `src/components/hunts/*.js`, `src/pages/HuntsPage.js`) against DESIGN.md §7 'On Air' and the spec `docs/superpowers/specs/2026-10-03-onair-hunts-design.md`. PASS/HOLD with file:line findings."
- `accessibility-auditor`: "Audit the Hunts tab slip (`src/components/hunts/HuntSlip.js`, `src/components/onAir/Ticket.js`), lineup (`HuntLineup.js`), bonus table (`BonusTable.js`), past episodes (`PastEpisodes.js`) and monitor (`src/components/onAir/Monitor.js`, `HuntMonitor.js`, `HuntMeter.js`): keyboard, focus order, screen-reader semantics, contrast against DESIGN.md §7 Readable Labels, reduced motion."

Fix every HOLD and every high-severity accessibility finding; re-run the full test suite and `npm run build`; commit as `fix(hunts): …` / `fix(onair): …`.

- [ ] **Step 5: Push and open the PR**

```bash
[ "$(git branch --show-current)" = "feat/onair-hunts" ] && git push -u origin feat/onair-hunts
```

```bash
gh pr create --base main --head feat/onair-hunts --title "On Air: redesigned Hunts tab and the On Air design language" --body "$(cat <<'EOF'
## What

The Gamba → Hunts tab rebuilt in the "On Air" look from the design handoff (`docs/redesign/design_handoff_bonus_hunt_on_air/`): a TV monitor stage, rounded layered surfaces, a perforated prediction slip. It is the pilot for replacing the site's blocky panels, so the look lands as reusable pieces rather than one-off styles.

- **Design language:** `onair` tokens in `tailwind.config.js`, Bricolage Grotesque + JetBrains Mono, primitives in `src/components/onAir/`, rules in DESIGN.md §7.
- **Four modes from the latest round:** open (guesses stay sealed: viewers see face-down rows), locked (live opening view: won so far, still-need avg, revealed guesses), settled (winner reveal, closest-first lineup), off air (last or live hunt).
- **Data:** one entries listener instead of two; the tab's hunt and past episodes load bonuses through `useHunt`.
- **Removed:** the old slip, tote board, number line, hunt card and archive components.

Spec: `docs/superpowers/specs/2026-10-03-onair-hunts-design.md`. Plan: `docs/superpowers/plans/2026-10-03-onair-hunts.md`.

## How to check

- `npm start`, then `/gamba/hunts?fixture=open|open-staff|locked|settled|offair` (dev only) at desktop and phone widths.
- `npm test -- --watchAll=false`, `npm run build`.

## Not changed

Firestore rules, the prediction API, `/admin/hunts`, the Control Room panel, other pages and the global nav.
EOF
)"
```

Expected: the PR URL is printed. Report it, along with anything from Step 3 that could not be verified.

---

## Self-review notes

- **Spec coverage:** tokens/fonts/DESIGN.md (Task 1); primitives (Tasks 2–3); mode selection, tab hunt, derivations (Task 4); single entries listener, own entry, hunt detail (Task 5); monitor screens, meter, channel change (Tasks 3, 6); lineup incl. face-down, pinned row, show all (Task 7); recap and bonus table incl. tags, show all, thumb fallback, compact grid (Task 8); slip in every mode incl. cooldown and errors (Task 9); runner-up and past episodes with swap/back (Tasks 10–11); layout reorder, suggestions, promo, dev fixture, deletions (Task 11); responsive and a11y checks, reviewers, PR (Task 12).
- **Deviations from the spec, deliberate:** the hero uses a container-fitted size with the spec's 52–96px bounds instead of `17vw` (a `vw` size overflows the 612px main column at `lg`); the bezel wordmark hides below `sm` (it doesn't fit the phone strip); `useHuntDetail` is replaced by `useHunt` (auto-fetch plus cache) because nothing used the toggle form after the old cards went; a few tokens beyond the spec table (`ink-7`, `winner-pale`, `viewer-ink`/`-muted`, `surface-raised`, `screen-*`, `ticket-*`, `rounded-onair-inner`) cover values the handoff uses; "Show all" in the bonus table uses the signal colour, not orange.
