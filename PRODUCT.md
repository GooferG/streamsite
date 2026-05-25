# Product

## Register

brand

The streamer site is the primary surface. It carries the public-facing identity for GooferG. Embedded tools (`/gamba/*`, `/admin/*`, suggestion overlay) override to **product** register per-task. They are utilities for an in-group and should be evaluated against product laws when worked on directly. Marketing and identity pages (home, schedule, vods, gear, about) drive default decisions.

## Users

Returning Twitch viewers. Chatters and gamba-curious regulars dropping in between or during streams. They land late at night, usually on a second monitor or a phone, already engaged with the channel. They want to check the schedule, dig through clips, suggest content, or follow the hunt tracker live. Nobody is here to be sold to.

First-time visitors arriving from Twitch, YouTube, or X are a secondary audience. They need the nav and core flows to make sense without being in on the joke.

Jobs to be done:
- Check what's streaming and when (schedule).
- Catch up on what they missed (vods, clips).
- Participate (suggest content, follow active bonus hunts).
- Lurk and absorb the vibe between streams.

## Product Purpose

A late-night CRT-feel hub for the GooferG channel. The site extends the broadcast outside of stream hours. Success looks like a regular viewer landing here and immediately recognizing the channel's tone, finding what they want in under three clicks, and treating the gamba and suggestion tools as part of the show.

## Brand Personality

Late-night couch energy. The brand reads as self-aware, slightly chaotic, with a welcoming streak underneath. Voice runs dry and in-group when it can. It goes plain and obvious where users need clarity (nav, errors, admin). Visual direction commits to lo-fi TV texture, including TV static intro, grain overlay, snow effect, and tinted dark gradients. The reference points are Adult Swim and late-night cable bumpers. The anti-references are gamer-esports-modern and vaporwave aesthetics.

## Anti-references

- **Generic Twitch panel template.** Stock streamer-overlay aesthetic. Twitch-purple-everywhere, glossy beveled buttons, default Twitch fonts. The current `from-zinc-950 via-emerald-950 to-purple-950` gradient is the line. Don't drift further toward pure Twitch purple.
- **SaaS landing.** The Stripe and Linear clone reflex. Hero stat plus three-card grid plus gradient text plus "trusted by" row. This site is a streamer brand. A B2B homepage layout has no place here.
- **Casino and gambling chrome.** Even though `/gamba` exists, never let the site read as a real casino. No gold-on-black slot-machine UI, no spinning coin animations, no "JACKPOT" type treatments.
- **Cyberpunk drift.** Neon-green-on-black, glitch text, Blade Runner palettes. The dark gradient flirts with this lane. Stay on the warm and grimy side of it. Chrome and neon belong to a different brand.

## Design Principles

1. **Atmosphere over information density.** On brand pages, prefer mood and pacing over packing every section with stats and CTAs. White space, slow scroll moments, and texture all count as content.
2. **Speak in-group without locking newcomers out.** Headlines, button copy, and section labels can be irreverent and community-specific. Nav labels, error messages, and admin and login flows stay plain and obvious so a first-time visitor never gets stuck.
3. **Imperfection on purpose, performance stays tight.** Grain, static, slight misalignment, and off-kilter type all count as intentional design. They only work if the page still feels responsive. Effects must be cheap (CSS or SVG, never heavy canvas loops), respect a 60fps budget, and degrade gracefully on low-power devices. A janky site reads as broken.
4. **Tools earn their visual weight.** The hunt tracker, slot picker, wheel, and admin pages should look denser, more utilitarian, and less atmospheric than the marketing pages. Switching surface should feel like flipping channels. The site identity carries across the cut.

## Voice Rules

Hard constraints for all generated copy. These are not stylistic preferences. They apply to every surface where the brand speaks, and they apply retroactively to anything generated from this document.

- **No em dashes.** Use commas, colons, semicolons, periods, or parentheses.
- **No "X, not Y" parallelism.** Avoid constructions like "features, not bugs" or "an extension of the broadcast, not a press kit." State what something is on its own terms.
- **No AI-tell vocabulary.** Forbidden: leverage, harness, utilize, seamless, robust, cutting-edge, unlock, delve, navigate (as a verb meaning "deal with"), elevate, empower, foster, streamline, holistic, synergy, ecosystem (outside literal tech context).
- **No three-item rule-of-three marketing rhythm.** Avoid the cadence of "fast, clean, reliable" or "smart, simple, scalable." Vary sentence shape.
- **No "in a world where..." or "imagine a..." openers.**
- **No marketing superlatives without specificity.** "Incredible" and "amazing" are forbidden. Concrete claims are fine.
- **Sentence case in body copy.** Title case only for proper nouns and brand names.

## Accessibility & Inclusion

No formal WCAG target. The aesthetic is motion-and-texture-first by intention, and committing to AA strictly would gut the visual direction. Practical commitments:

- Body copy stays legible on the dark gradient. Keep neutrals at sufficient lightness contrast even when the design calls for "moody."
- Decorative motion (TV static intro, snow, grain animation) should honor `prefers-reduced-motion` when feasible. It is not a hard gate.
- Nav, forms, and admin flows must remain keyboard-navigable and screen-reader-sensible. Marketing flourishes can be exempted.
- Document this stance so future decisions don't drift. The position rejects both "AA at all costs" and "accessibility doesn't matter."
