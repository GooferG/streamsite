# GSN art

Generated art for the Goofer Shopping Network store (`/store`). Made once
on the owner's ComfyUI Desktop, picked by the owner, then committed as webp
under `public/gsn/`. Nothing calls ComfyUI at request time.

Rules: no lettering in the art (names, prices and the GSN bug are CSS); no
real people's likenesses; never put art in `public/store/` (it would shadow
the `/store` route).

## Style (shared by every prompt)

STYLE = "1990s late-night home shopping television broadcast still, shot on a
TV studio set, hard key light, deep shadows, warm practical lights glowing in
the background, set lit in dark teal and plum, light VHS grain, slight
chromatic bleed, analog video softness, no text, no letters, no logos, no watermark"

## Prompts

| Asset | Prompt (then ", " + STYLE) | Render | Final |
| --- | --- | --- | --- |
| `items/roll-a-blunt` | a single neatly hand-rolled joint resting on a small brass ashtray, a thin curl of smoke catching the key light, displayed on a slowly turning round velvet pedestal, product hero shot, centered | 1280×960 | 1200×900, ≤120 KB |
| `items/pick-a-slot` | a chunky 1990s television remote control lying on a slowly turning round velvet pedestal, one oversized round button glowing teal, product hero shot, centered | 1280×960 | 1200×900, ≤120 KB |
| `items/ars-bonus-buy` | a thick bundle of colourful banknotes held by a red rubber band, standing on a slowly turning round velvet pedestal, product hero shot, centered, banknote details blurred and unreadable | 1280×960 | 1200×900, ≤120 KB |
| `operator-standby` | waist-up portrait of an invented late-night phone operator at a 1990s TV home shopping call centre, a person in their thirties with a deadpan, slightly tired expression, wearing a big headset microphone and a loose cardigan over a faded band t-shirt, sitting at a cluttered desk with a beige corded telephone and stacks of order slips, one hand resting near the phone, waiting, a small CRT monitor glowing teal behind them, wood panelling | 960×1200 | 480×600, ≤60 KB |
| `ident` | an empty 1990s TV home shopping studio set at night, a round velvet product pedestal centre stage under a single spotlight, a desk with a row of beige telephones to one side, haze in the air, wide shot, no people | 1600×896 | 1600×900, ≤150 KB |

Operator poses are edits of the picked standby image (Qwen Image Edit 2509),
so the character stays the same:

| Asset | Edit prompt |
| --- | --- |
| `operator-call` | Keep the same person, outfit, desk, framing and lighting. They now press the headset to their ear with one hand and talk, leaning toward the desk, focused. |
| `operator-shrug` | Keep the same person, outfit, desk, framing and lighting. They now shrug with both palms up and an apologetic, deadpan face. |

## Commands

    node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/zimage-turbo.json <out.png> --prompt "<prompt>, <STYLE>" --width 1280 --height 960 --seed <n>
    node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/qwen-edit-2509.json <out.png> --image <standby.png> --prompt "<edit prompt>" --seed <n>
    python scripts/gsn-art/to_webp.py <picked.png> public/gsn/<asset>.webp <w> <h> <max_kb>

If ComfyUI rejects a workflow (a `node_errors` reply), open the matching
template in ComfyUI Desktop (Z-Image Turbo, or Qwen Image Edit 2509), use
Workflow → Export (API), and pass that file instead. The script finds nodes
by type.
