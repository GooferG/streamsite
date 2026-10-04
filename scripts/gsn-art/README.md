# GSN art

Generated art for the Goofer Shopping Network store (`/store`). Made once
on the owner's ComfyUI Desktop (port 8000), picked by the owner, then
committed as webp under `public/gsn/`. Nothing calls ComfyUI at request time.

Rules: no lettering in the art (names, prices and the GSN bug are CSS); no
real people's likenesses; never put art in `public/store/` (it would shadow
the `/store` route).

## Style (shared by every Z-Image prompt)

STYLE = "1990s late-night home shopping television broadcast still, shot on a
TV studio set, hard key light, deep shadows, warm practical lights glowing in
the background, set lit in dark teal and plum, light VHS grain, slight
chromatic bleed, analog video softness, no text, no letters, no logos, no watermark"

## What shipped

Z-Image Turbo renders use `workflows/zimage-turbo.json` with the prompt
followed by ", " + STYLE. Qwen edits use `workflows/qwen-edit-2509.json` with
`--image` set to the previous step's output. Seeds are the ones the owner picked.

| File | How it was made | Final |
| --- | --- | --- |
| `items/smoke-break.webp` | 1. Z-Image, 1280×960, seed 14: "a shadowed figure sitting at a cluttered desk in a dim 1990s TV studio back office late at night, face hidden in deep shadow, lit only by the teal glow of a CRT monitor and a small warm desk lamp, the orange ember of a joint at their lips, a long curl of smoke drifting up through the lamp light, relaxed slouch, moody and simple" → 2. Qwen edit, seed 1: "Keep the same scene, desk, CRT monitor, lamp, lighting, smoke, pose and framing exactly. Give the person long hair that falls loosely past their shoulders, still mostly in shadow." → 3. Qwen edit, seed 2: "Keep the person, long hair, desk, CRT monitor, lamp, lighting, smoke, pose and framing exactly the same. Replace the thin white cigarette in their mouth with a slim brown blunt wrapped in dark tobacco leaf, about the thickness of a finger and a little longer than a cigarette, with a glowing orange ember at the tip." | 1200×900 |
| `items/pick-a-slot.webp` | Z-Image, 1280×960, seed 1: "a chunky 1990s television remote control lying on a slowly turning round velvet pedestal, one oversized round button glowing teal, product hero shot, centered" | 1200×900 |
| `items/bonus-buy.webp` (both bonus buys) | Z-Image, 1280×960, seed 1: "a small plum velvet drawstring pouch, full and heavy, tied with a gold cord, plain with no symbols or printing, on a slowly turning round velvet pedestal, product hero shot, centered" | 1200×900 |
| `operator-call.webp` | Z-Image, 960×1200, seed 4: "waist-up portrait of an invented late-night phone operator at a 1990s TV home shopping call centre, a person in their thirties with a deadpan, slightly tired expression, wearing a big headset microphone and a loose cardigan over a faded band t-shirt, sitting at a cluttered desk with a beige corded telephone and stacks of order slips, one hand resting near the phone, waiting, a small CRT monitor glowing teal behind them, wood panelling" (it came out mid-call, so it is the call pose) | 480×600 |
| `operator-standby.webp` | Qwen edit of the call pose, seed 2: "Keep the same person, outfit, desk, framing and lighting. The handset is back on its cradle on the desk; they sit waiting with the headset on, one hand resting near the phone, looking toward the camera with a deadpan, slightly bored expression." | 480×600 |
| `operator-shrug.webp` | Qwen edit of the call pose, seed 3: "Keep the same person, outfit, desk, framing and lighting. The handset is back on its cradle; they shrug with both palms turned up and an apologetic, deadpan face, looking toward the camera." | 480×600 |
| `ident.webp` | Z-Image, 1600×896, seed 2: "an empty 1990s TV home shopping studio set at night, a round velvet product pedestal centre stage under a single spotlight, a desk with a row of beige telephones to one side, haze in the air, wide shot, no people" | 1600×900 |

Item art budget is 120 KB, operator 60 KB, ident 150 KB; `to_webp.py` steps
the quality down until a file fits.

## Lessons from the picking rounds

- Z-Image draws any "joint" or "blunt" with a cigarette filter tip unless the
  prompt says "brown tobacco-leaf wrap" and "no filter"; editing an existing
  image with Qwen was the reliable way to get the right blunt.
- Banknotes always come out with made-up text and faces, which breaks the
  no-lettering rule. Use an object (pouch, envelope) instead of cash.
- Watch CRT screens: edits sometimes put lines of text on them.

## Commands

    node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/zimage-turbo.json <out.png> --prompt "<prompt>, <STYLE>" --width 1280 --height 960 --seed <n>
    node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/qwen-edit-2509.json <out.png> --image <source.png> --prompt "<edit prompt>" --seed <n>
    python scripts/gsn-art/to_webp.py <picked.png> public/gsn/<file>.webp <w> <h> <max_kb>

If ComfyUI rejects a workflow (a `node_errors` reply), open the matching
template in ComfyUI Desktop (Z-Image Turbo, or Qwen Image Edit 2509), use
Workflow → Export (API), and pass that file instead. The script finds nodes
by type. ComfyUI 0.38 added a required `resolution_steps` input to
`ImageScaleToTotalPixels`; the Qwen workflow sets it to 1.
