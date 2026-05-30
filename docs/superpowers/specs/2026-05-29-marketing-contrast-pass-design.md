# Marketing Contrast Pass — Design

Date: 2026-05-29
Scope: marketing pages only (`/`, `/schedule`, `/vods`, `/about`, `/gear`)

## Problem

Feedback: the site might work better with more contrast. Unpacked with the user
into two readings:

1. **Text legibility** — muted copy strains on the dark gradient, especially
   late-night on a phone. DESIGN.md already flags this as a watch-item
   ("Keep neutrals at sufficient lightness contrast even when the design calls
   for moody").
2. **Looks flat / low-energy** — the canvas reads dim and washed out.

A blanket "crank contrast" is rejected: the flatness is largely load-bearing
(no box-shadows, tinted gradient over flat black, grain overlay, two-weight type
gap). Globally raising brightness/saturation walks into the anti-references
(SaaS shadows, casino chrome, cyberpunk neon). Energy must come from focal
points, not raised baseline brightness.

## Decisions (locked with user)

- **Legibility:** push it. Low risk, brand-sanctioned.
- **Flat:** **signal & layering only.** Punch emerald focal points, strengthen
  tonal surface steps, lean on glow halos. Base gradient + grain **untouched.**
  No new chrome, no shadows, no brightened base.
- **Scope:** **marketing pages first** (`/`, `/schedule`, `/vods`, `/about`,
  `/gear`). `/gamba/*` and `/admin/*` left as-is — they are meant to be denser
  and quieter. Prove the direction on brand surfaces before any wider sweep.

## The Surgical Line (most important section)

Code audit found two distinct uses of dim text. They must be treated
differently — this is the crux of the whole change.

### A. Eyebrow / chyron labels — DO NOT TOUCH

Pattern: `text-white/40` **combined with** `tracking-eyebrow*` + `font-mono` +
`uppercase`, usually `text-[10px]`/`text-[11px]`.

Examples (leave as-is):
- `VodsPage.js:224`, `VodsPage.js:278`
- `SchedulePage.js:168`, `SchedulePage.js:193`
- `AboutPage.js:25`, `AboutPage.js:143`

Rationale: the dimness IS the cable-broadcast chyron effect. DESIGN.md's Chyron
Rule explicitly forbids softening these for "readability." Brightening them
erodes the brand tell.

### B. Body / supporting copy — BUMP

Pattern: dim text on actual readable prose (paragraphs, descriptions, hero
support copy) — `text-white/50` or `text-white/60` on `<p>`/`<span>` without the
eyebrow treatment.

Confirmed instances to raise:
- `SchedulePage.js:210` — `text-white/50` supporting paragraph → `/70`
- `VodsPage.js:231` — `text-white/40` description `<p>` → `/65`
- `GearInteractive.js:86` — `text-white/60` hero support copy → `/75`
- `GearInteractive.js:107` — `text-white/60` body `<p>` → `/75`
- `GearInteractive.js:134`, `GearInteractive.js:280` — `text-white/40` body → `/65`
- `AboutPage.js` body `<p>` instances using `/50`–`/60` → `/70`

Target tiers:
- Primary supporting/body copy: **`text-white/70`–`/75`**
- Secondary body (captions, sub-descriptions you still need to read): **`text-white/65`**
- Eyebrow labels (category A): **unchanged**

Decision rule when editing: *"Is this a sentence someone reads, or a chyron
label?"* Read → bump. Label → leave.

## Flat → Signal & Layering (marketing pages)

Within the existing system only. No base-gradient or grain changes.

1. **Emerald focal punch.** Active nav, primary buttons, live/positive states,
   key hover transitions already use emerald. Where a focal emerald element sits
   against quiet surroundings, allow the brighter tier (`emerald-signal` →
   `emerald-bright`) and/or fuller opacity so the signal reads as a clear pop.
   Contrast = saturated signal vs. deliberately quiet field, never loud-vs-loud.
   Do NOT introduce emerald onto non-signal elements (Two-Role Rule).

2. **Stronger tonal steps.** Where marketing cards sit at `bg-zinc-900/50` or
   `bg-white/5` and blend into the gradient, step the surface up so the card
   edge reads without a shadow (e.g. `bg-zinc-900` → tonal step to `bg-zinc-800`
   for sub-sections, or firm up `border-white/5` → `border-white/10`). No
   box-shadow (No-Shadow Rule). No nested cards (step tonally instead).

3. **Glow halos carry depth.** On marketing surfaces that feel flat, the
   intended depth tool is the glow halo (`blur-3xl` accent disc + `glow`
   keyframe), not shadows. Strengthen existing halos slightly rather than adding
   new chrome. Halos stay off `/admin` and `/gamba`.

## Hard Constraints (must not violate)

- Base body gradient `from-zinc-950 via-emerald-950 to-purple-950` — untouched.
- Grain overlay opacity (0.04–0.06) — untouched.
- No `box-shadow` anywhere (No-Shadow Rule).
- No gradient text, no new `backdrop-blur` defaults.
- No middle font weights (500/600).
- Two-Role color rule intact: emerald = signal, purple = gamba, no new accents.
- Chyron eyebrow labels stay dim (category A above).
- `prefers-reduced-motion` still disables decorative motion.

## Out of Scope

- `/gamba/*` and `/admin/*` surfaces.
- Brightening the base gradient or surfaces globally.
- Any shadow/saturation/neon "pop" approach.
- Restructuring the Tailwind token set (changes are per-element class edits on
  marketing pages; no token rename).

## Success Criteria

- On `/`, `/schedule`, `/vods`, `/about`, `/gear`: every readable sentence is
  comfortably legible on the gradient (no squinting on a dim phone).
- Chyron eyebrow labels still read as quiet broadcast labels.
- Marketing cards/sections are distinguishable from the background without a
  shadow.
- Emerald focal points pop more than before.
- Side-by-side, the page still reads "after-midnight cable channel," not
  "brighter SaaS dashboard." CRT north-star intact.

## Verification

- Visual check of all five pages against the criteria (screenshot or live).
- Grep confirms no eyebrow/chyron label opacity was raised.
- Grep confirms gradient/grain/shadow constraints untouched.
