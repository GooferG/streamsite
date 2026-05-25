---
name: GooferG Live
description: Late-night cable-channel feel for the GooferG Twitch hub.
colors:
  emerald-signal: "#10b981"
  emerald-bright: "#34d399"
  emerald-pale: "#a7f3d0"
  emerald-haze: "#064e3b"
  purple-gamba: "#a855f7"
  purple-bright: "#c084fc"
  purple-haze: "#581c87"
  orange-admin: "#f97316"
  orange-bright: "#fb923c"
  red-destructive: "#ef4444"
  zinc-broadcast: "#09090b"
  zinc-card: "#18181b"
  zinc-elevated: "#27272a"
  white-body: "#fafafa"
  white-muted: "#a1a1aa"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(4rem, 12vw, 9rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body-large:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 300
    lineHeight: 1.5
    letterSpacing: "0.01em"
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  mono:
    fontFamily: "source-code-pro, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
  hero: "96px"
components:
  button-primary:
    backgroundColor: "{colors.emerald-signal}"
    textColor: "{colors.zinc-broadcast}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.emerald-bright}"
    textColor: "{colors.zinc-broadcast}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.white-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-ghost-active:
    backgroundColor: "transparent"
    textColor: "{colors.emerald-bright}"
  button-danger:
    backgroundColor: "{colors.red-destructive}"
    textColor: "{colors.white-body}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  pill-live:
    backgroundColor: "{colors.emerald-haze}"
    textColor: "{colors.emerald-bright}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
  pill-offline:
    backgroundColor: "{colors.zinc-elevated}"
    textColor: "{colors.white-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
  card-marketing:
    backgroundColor: "{colors.zinc-card}"
    textColor: "{colors.white-body}"
    rounded: "{rounded.xl}"
    padding: "24px"
  card-tool:
    backgroundColor: "{colors.zinc-card}"
    textColor: "{colors.white-body}"
    rounded: "{rounded.md}"
    padding: "16px"
  input-default:
    backgroundColor: "{colors.zinc-card}"
    textColor: "{colors.white-body}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

# Design System: GooferG Live

## 1. Overview

**Creative North Star: "The Late-Night Channel"**

The site reads like a cable channel you flip to after midnight: a TV-static cold open, a grain overlay that never fully settles, schedule pages that act like an EPG, and gamba tools that feel like the slot wall behind the bar. Marketing surfaces (`/`, `/schedule`, `/vods`, `/about`, `/gear`) carry the on-air vibe. They are atmospheric, slow, full of glow halos and tracking-wider labels. Utility surfaces (`/gamba/*`, `/admin/*`, suggestion overlay) are the back-of-house. They are denser, calmer, less decorated, and still visibly part of the same broadcast.

The palette commits to two roles. Emerald (`#10b981`) is the **signal color**: live indicator, primary action, positive state, active nav, accent glow on the marketing pages. Purple (`#a855f7`) is the **gamba color**: special-day status on the schedule, glow halos on the hero, decorative weight on gamba and wheel surfaces. Red is destructive only. Orange is admin-scope only. The dark gradient (`from-zinc-950 via-emerald-950 to-purple-950`) is the surface the whole site sits on. Never replace it with a flat black. The tinted depth is the channel's signature.

This system explicitly rejects: generic Twitch-purple panel templates (the gradient must stay tinted); SaaS landing tropes (hero stat + 3-card grid + gradient text); casino chrome (no gold-on-black, no slot-machine bevels even on `/gamba`); cyberpunk drift (no neon green on flat black, no glitch text). Atmosphere comes from texture: grain, static, snow, glow. Chrome has no place here.

**Key Characteristics:**

- Always-on dark surface with tinted depth, never `#000`.
- Emerald and purple two-role accent system. Red and orange are reserved.
- Glow-and-glass depth instead of shadows. Backdrop-blur is purposeful, never default.
- Tracking-wider uppercase labels and 900-weight display headers. Long-form copy stays warm and lowercase.
- Marketing and tools sit on the same brand. The register shift between them is visible but never absolute.

## 2. Colors

A tinted-dark palette with two semantic accents. Everything sits on the `from-zinc-950 via-emerald-950 to-purple-950` body gradient — neutrals are tinted toward emerald and purple, never pure grey.

### Primary

- **Emerald Signal** (`#10b981`): The single most important color in the system. Live indicator dot, primary button background, active nav text, focus rings, scrollbar thumb. Carries every "this is live / this is on" signal.
- **Emerald Bright** (`#34d399`): Hover state for the signal color. Also the brighter tier in gradients and pulse animations.
- **Emerald Pale** (`#a7f3d0`): Reserved for text on emerald-tinted backgrounds where contrast demands it.

### Secondary

- **Gamba Purple** (`#a855f7`): The second-role accent. Used for `/gamba` surface accents, "special" status on schedule entries, decorative glow halos on the hero, and as the second stop in two-color hover gradients. Never the live/positive signal — that's emerald's job.
- **Purple Bright** (`#c084fc`): Hover and bright tier for gamba accents.

### Tertiary

- **Admin Orange** (`#f97316`): Scoped to `/admin/*` exclusively. Nav active state, admin badges. Treat as a register tell, not a global accent.
- **Destructive Red** (`#ef4444`): Reserved for delete buttons, error states, offline-bad signals. Never decorative.

### Neutral

- **Zinc Broadcast** (`#09090b`): Body background base, before the gradient overlay. Closest the system gets to black.
- **Zinc Card** (`#18181b`): Card and surface fills. Sits visibly above the gradient.
- **Zinc Elevated** (`#27272a`): Hover surface, input fill, secondary card layer.
- **White Body** (`#fafafa`): Body copy on dark surfaces. Never `#fff`.
- **White Muted** (`#a1a1aa`): Inactive nav, secondary copy, helper text. The site uses `text-white/60` constantly — this is the resolved value.

### Named Rules

**The Two-Role Rule.** Emerald means signal (live, action, positive, active). Purple means gamba (special, decorative weight). Red is destructive only. Orange is admin-scope only. Never use red for emphasis, never use purple for the live state, never use emerald for `/admin`.

**The Tinted-Dark Rule.** The body gradient is part of the brand. Pages render onto `from-zinc-950 via-emerald-950 to-purple-950`. Don't replace it with flat `bg-black`. Don't add a second full-surface gradient on top of it.

## 3. Typography

**Display Font:** `ui-sans-serif, system-ui, sans-serif`. The site uses the OS sans (SF on Mac, Segoe on Windows). It never ships a webfont. The system stack is the chosen typography for this brand, treated as a first-class commitment.
**Body Font:** `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto` (system body stack from `src/index.css`).
**Label/Mono Font:** `source-code-pro, Menlo, Monaco, Consolas, monospace` (the global `code` fallback).

**Character:** Brutal contrast between two registers. Display sets text to black-weight (900) with negative tracking and clamps up to 9rem. Body sets text to 300 or 400 weight, generous line-height, slightly looser tracking on the large variant. Labels go small, bold, uppercase, with letter-spacing wide enough to read like a chyron.

### Hierarchy

- **Display** (900, `clamp(4rem, 12vw, 9rem)`, line-height 0.95, tracking `-0.04em`): Hero wordmarks only. Page titles do not use display weight.
- **Headline** (700, `clamp(2rem, 5vw, 3.5rem)`, line-height 1.05, tracking `-0.02em`): Page titles on `/about`, `/schedule`, `/vods`, section breaks.
- **Title** (700, `1.5rem`, line-height 1.2): Card titles, schedule day labels, modal headers.
- **Body** (400, `1rem`, line-height 1.6): Default running text. Cap line length at 65–75ch on marketing pages.
- **Body Large** (300, `1.25rem`–`1.5rem`, line-height 1.5, tracking `0.01em`): Hero supporting copy. Always a lighter weight than body. The contrast is the point.
- **Label** (700, `0.875rem`, line-height 1, tracking `0.08em`, UPPERCASE): Nav items, button text, pill labels, "LIVE NOW", "OFFLINE", section eyebrows.
- **Mono** (400, `0.875rem`): Reserved for stat counters, code-like values, timestamps if needed. Used sparingly.

### Named Rules

**The Two-Weight Rule.** Body copy is either 300 (large, atmospheric) or 400 (default). Headlines are either 700 (page titles) or 900 (hero wordmarks). Weights 500 and 600 do not appear in this system. The gap between body and headline is intentional.

**The Chyron Rule.** Anything tagged as a label (button, nav item, pill, eyebrow) gets `tracking-wider` (≈0.08em) and UPPERCASE. This is the cable-broadcast tell. Don't break it for "softer" mixed-case nav.

## 4. Elevation

This system has **no box shadows**. Depth comes from three sources, in order of frequency:

1. **Tonal layering on the body gradient.** Surfaces float on top of `from-zinc-950 via-emerald-950 to-purple-950` using `bg-zinc-900` / `bg-zinc-800` and translucent overlays (`bg-white/5`, `bg-emerald-500/10`). The tint of the underlying gradient bleeds through.
2. **Glow halos.** Large `blur-3xl` discs of `bg-emerald-500/20` and `bg-purple-500/20` positioned behind the hero, animated with the `glow` keyframe (`opacity 0.5↔0.8`, `blur 20px↔30px`, 8–10s ease loop). They suggest a CRT bloom.
3. **Glass surfaces.** Top nav and mobile drawer use `backdrop-blur-xl` with `bg-black/20` or `bg-zinc-950/80` and a 1px emerald-tinted border. Glass is purposeful in this system. It lets the gradient and grain show through the nav. It is never a decorative default on every card.

### Named Rules

**The No-Shadow Rule.** `box-shadow` does not appear on cards, buttons, or surfaces. If something needs to feel lifted, use a glow halo behind it or a tonal step up (`bg-zinc-900` → `bg-zinc-800`). Drop shadows read SaaS. This site reads cable.

**The Purposeful Glass Rule.** `backdrop-blur` is for surfaces the gradient must show through: top nav, mobile menu drawer, the LIVE pill over the hero video region. It is not the default for cards, modals, or list items.

## 5. Components

### Buttons

- **Shape:** `rounded-md` (8px). Pills (`rounded-full`) only for status indicators and avatars, never for primary actions.
- **Primary:** Emerald Signal background, zinc-broadcast text, label typography (uppercase, tracking-wider), `12px 24px` padding. Hover lifts to Emerald Bright with a 300ms ease transition.
- **Ghost:** Transparent background, white-muted text. Hover lifts text to Emerald Bright (or Orange Admin on `/admin`). Used for nav items and secondary actions.
- **Danger:** Destructive Red background, white body text, same shape as primary. Used for delete/cancel only.
- **Hover treatment:** Color and opacity transitions only. No `translateY`, no scale, no shadow lift.

### Pills (Status indicators)

- **Live pill:** `bg-emerald-500/10` fill, `border border-emerald-500/30`, `text-emerald-400`, optional `backdrop-blur-sm` when over media. Contains a 2×2px pulsing emerald dot.
- **Offline pill:** `bg-white/5` fill, `border border-white/10`, `text-white/60`, dot is non-animated `bg-white/40`.
- **Status (schedule):** "REGULAR" = emerald, "SPECIAL" = purple, "OFF" = neutral muted. These are not interactive; they're chyron-style.

### Cards / Containers

- **Marketing card:** `bg-zinc-900` (or `bg-zinc-900/50` when the gradient should show through), `rounded-xl` (16px), `24px` internal padding. Borders are subtle: `border border-white/5` or accent-tinted `border-emerald-500/10`.
- **Tool card** (gamba / admin): `bg-zinc-900`, `rounded-lg` (12px), `16px` internal padding. Denser, smaller radius, less translucency. Visibly part of the same system but tuned for information density.
- **No nested cards.** A card inside a card is wrong. Use tonal step-up (`bg-zinc-800`) for sub-sections.
- **No shadow.** See the No-Shadow Rule.

### Inputs / Fields

- **Style:** `bg-zinc-900`, `rounded-lg` (12px) or `rounded-md` (8px), `border border-white/10`, body typography.
- **Focus:** `border-emerald-500/50` + subtle emerald glow via outline. No box-shadow ring.
- **Error:** `border-red-500/50`. Helper text in `text-red-400`.

### Navigation

- **Top nav:** Fixed, `backdrop-blur-xl bg-black/20`, `border-b border-emerald-500/10`. Nav items use label typography (uppercase, tracking-wider, 700 weight). Default is `text-white/60`; active is `text-emerald-400`; hover grows an underline (`h-0.5 bg-gradient-to-r from-emerald-400 to-purple-400`) from `w-0` to `w-full` over 300ms. Admin nav item swaps emerald for orange (active state and underline gradient).
- **Mobile drawer:** `from-zinc-950 to-emerald-950/50` vertical gradient surface, `backdrop-blur-xl`, slide-in from right. Nav items are full-width rounded-lg pills, emerald-tinted when active.

### Signature: The Live Indicator

The hero LIVE pill is the system's signature component. It collapses brand + product into one element: it broadcasts state (live vs. offline), references the cable-channel North Star (chyron typography, pulsing dot), and exists in two purposeful glass variants. Treat it as a fixed component. When other surfaces need a live signal, reuse it rather than inventing a new visual.

### Streaming-specific surfaces

Components unique to a streaming-channel hub. Their visual weight pulls more from broadcast television than from web product convention.

- **Hero.** Above-the-fold marketing block. Display wordmark, Body Large supporting copy, the Live Pill anchored to the player region. Two glow halos behind, one emerald and one purple, both animated with the `glow` keyframe. Inherits the body gradient. No solid background panel.
- **Player Frame.** 16:9 container wrapping the Twitch iframe embed. Two states: live and offline. Live state shows the embed with the Live Pill (inline variant) anchored top-left over the media. Offline state shows a poster image with Body Large copy and a Primary Button CTA. 1px emerald-tinted border (`border-emerald-500/10`). No box-shadow.
- **Schedule Grid.** EPG-style container that holds Schedule Rows. Day-column headers run Title typography. Horizontal layout on `lg`, stacks on `md`. Each cell can host a Schedule Status Pill (REGULAR = emerald, SPECIAL = purple, OFF = neutral muted).
- **Schedule Row.** Single day in the schedule. Day label (Title), time block (Mono), category (Label), optional Schedule Status Pill. Reads as a TV listing.
- **VOD Card.** Marketing Card variant. 16:9 thumbnail with a Mono duration chyron anchored bottom-right of the thumbnail. Title below. Date and game in Label typography, muted. Hover lifts thumbnail brightness only. No transform, no shadow.
- **Grain Overlay.** Site-wide noise texture. `position: fixed`, full viewport, `pointer-events: none`. Opacity between 0.04 and 0.06, `mix-blend-mode: overlay`. Disabled under `prefers-reduced-motion`. The texture that never fully settles.
- **Snow Effect.** Decorative falling-snow particle layer, scoped per-page (typically hero or schedule). Cheap CSS animation or SVG-driven, never canvas. Density tuned so the layer reads as ambience. Disabled under `prefers-reduced-motion`.
- **TV Static Cold Open.** First-load intro overlay. SVG or CSS noise pattern at full opacity for about 600ms, then fades out as the page resolves. Plays once per session (stored in `sessionStorage`). Disabled under `prefers-reduced-motion`, replaced with an instant fade-in.
- **Glow Halo.** Absolute-positioned blurred disc behind marketing surfaces. `blur-3xl`, `bg-{accent}-500/20`, animated by the `glow` keyframe (`opacity 0.5↔0.8`, `blur 20px↔30px`, 8–10s ease loop). Used in pairs (emerald and purple) for hero depth. Never on `/admin` or `/gamba` tool surfaces.
- **Live Pill (Inline variant).** Variant of the Live Pill anchored inside the Player Frame top-left when the channel is live. `backdrop-blur-sm` is justified here because it sits over media. Identical typography to the base Live Pill.

### Named Rules

**The Tools Look Like Tools Rule.** Cards in `/gamba/*` and `/admin/*` use `rounded-lg` (12px) and smaller padding (16px). Marketing pages use `rounded-xl` (16px) and 24px padding. The radius drop is the register shift. Don't unify them.

## 6. Do's and Don'ts

### Do

- **Do** use Emerald Signal (`#10b981`) for every "live / active / primary / positive" signal. One color, one job.
- **Do** use Gamba Purple (`#a855f7`) for `/gamba` accents, schedule "special" status, and decorative glow halos. Nothing else.
- **Do** layer surfaces tonally on the `from-zinc-950 via-emerald-950 to-purple-950` body gradient. The tint is part of the brand.
- **Do** use `tracking-wider` UPPERCASE label typography for nav, buttons, pills, and eyebrows. This is the chyron tell.
- **Do** reach for glow halos (`blur-3xl` discs of `bg-{accent}-500/20` with the `glow` keyframe) when a marketing surface needs depth.
- **Do** drop the radius from `rounded-xl` to `rounded-lg` and tighten padding when designing `/gamba` and `/admin` surfaces. Make the register shift visible.
- **Do** keep decorative motion (grain, snow, TV static) cheap enough that prefers-reduced-motion can disable it without breaking layout.

### Don't

- **Don't** use gradient text (`bg-clip-text` + `bg-gradient-to-*`). It's the SaaS-landing tell PRODUCT.md rejects. *Known violations to revisit: hero wordmark on `HomePage.js:198,202` ("GOOFER" / "LIVE"); nav logo on `Navigation.js:32` ("GooferG").*
- **Don't** ship a SaaS landing template. No hero stat plus 3-card grid plus gradient text plus "trusted by" row. The home page is a channel feed.
- **Don't** drift toward Twitch-corporate purple. The gradient must stay tinted (`from-zinc-950 via-emerald-950 to-purple-950`). Avoid using `purple-500` as a flat fill across whole surfaces. If a surface looks like a stock Twitch panel, it's wrong.
- **Don't** add casino chrome to `/gamba`. No gold-on-black, no slot-machine bevels, no glossy "JACKPOT" treatments. The gamba section is a streamer's tracker.
- **Don't** add cyberpunk drift: neon green on flat `#000`, glitch text, Blade Runner palettes. The dark gradient flirts with this lane. Stay on the warm and grimy side.
- **Don't** use `box-shadow` on cards, buttons, or surfaces. Depth comes from tonal layering and glow halos. Shadows read SaaS.
- **Don't** use glassmorphism (`backdrop-blur`) as a default. It belongs on three surfaces: top nav, mobile drawer, the LIVE pill over media. Anywhere else, justify it.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored side-stripe accent. Use a full border, a tonal background, or a leading icon.
- **Don't** introduce middle font weights (500, 600). The system is 300 / 400 / 700 / 900 with intentional gaps.
- **Don't** import a webfont. No Google Fonts, no `@font-face`, no `next/font`. The system stack is the chosen typography for this brand. Treat it as a first-class commitment.
- **Don't** soften the Chyron Rule for "readability" or "modernity." Tracking-wider uppercase labels are the cable-broadcast tell, and that tell is the brand.
- **Don't** use em dashes in copy. Commas, colons, semicolons, periods, or parentheses instead.
- **Don't** use "X, not Y" parallelism in copy. Constructions like "features, not bugs" or "an extension of the broadcast, not a press kit" are forbidden. State what something is on its own terms.
- **Don't** use AI-tell vocabulary: leverage, harness, utilize, seamless, robust, cutting-edge, unlock, delve, navigate (as a verb meaning "deal with"), elevate, empower, foster, streamline, holistic, synergy, ecosystem (outside literal tech context).
- **Don't** nest cards. For sub-sections inside a card, step the background tonally (`bg-zinc-900` → `bg-zinc-800`).
