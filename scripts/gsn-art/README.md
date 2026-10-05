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

Goofer Video (/vods) swaps the set for a rental store:

VIDEO_STYLE = "1990s late-night video rental store interior, shot on a camcorder, buzzing fluorescent tube lights, deep shadows, wire racks of blank unlabeled black VHS boxes, a counter with a beige CRT television and a cash register, set lit in dark teal and plum with warm practical light, light VHS grain, slight chromatic bleed, analog video softness, no text, no letters, no logos, no signs, no watermark"

### Cartoon redraw

Goofer Video's clerk is the first piece in the site's new early-2000s adult-cable cartoon direction. It was made by redrawing a photoreal render with the Qwen edit model, using this prompt:

> Redraw this entire image as a crude early-2000s American late-night adult cable cartoon. Keep the same composition, pose, stack of tapes, shelves, CRT and counter. Make the clerk an ugly cartoon man: bulbous nose, tiny black dot eyes, heavy unibrow, stubble, slouched, dead-eyed deadpan expression. Extremely simple flat shapes, flat solid colors with no shading or gradients, clean medium-weight black outlines, minimal detail, stiff low-budget limited-animation look, muted sickly palette of olive, dull teal, faded plum and beige. Not anime, not cute, not 3D. No text, no letters, no logos.

Rules: describe traits, never name a show, studio or character; flat fills, no shading, clean black outlines, muted palette; no lettering.

Items and the ident use this redraw prompt (the operator prompt is the clerk prompt adapted to keep the headset, cardigan, phone, order slips, CRT and panelling):

> Redraw this entire image as a crude early-2000s American late-night adult cable cartoon. Keep the same composition, objects, framing and light placement. Extremely simple flat shapes, flat solid colors with no shading or gradients, clean medium-weight black outlines, minimal detail, stiff low-budget limited-animation look, muted sickly palette of olive, dull teal, faded plum and beige. Not anime, not cute, not 3D. No text, no letters, no logos.

The GSN art (operator, items, ident) was redrawn the same way on 2026-10-04, so the site now shares the one cartoon style. The "How it was made" cells below end with the cartoon step; the photoreal originals are in git history.

## What shipped

Z-Image Turbo renders use `workflows/zimage-turbo.json` with the prompt
followed by ", " + STYLE. Qwen edits use `workflows/qwen-edit-2509.json` with
`--image` set to the previous step's output. Seeds are the ones the owner picked.

| File | How it was made | Final |
| --- | --- | --- |
| `items/smoke-break.webp` | 1. Z-Image, 1280×960, seed 14: "a shadowed figure sitting at a cluttered desk in a dim 1990s TV studio back office late at night, face hidden in deep shadow, lit only by the teal glow of a CRT monitor and a small warm desk lamp, the orange ember of a joint at their lips, a long curl of smoke drifting up through the lamp light, relaxed slouch, moody and simple" → 2. Qwen edit, seed 1: "Keep the same scene, desk, CRT monitor, lamp, lighting, smoke, pose and framing exactly. Give the person long hair that falls loosely past their shoulders, still mostly in shadow." → 3. Qwen edit, seed 2: "Keep the person, long hair, desk, CRT monitor, lamp, lighting, smoke, pose and framing exactly the same. Replace the thin white cigarette in their mouth with a slim brown blunt wrapped in dark tobacco leaf, about the thickness of a finger and a little longer than a cigarette, with a glowing orange ember at the tip." → Qwen cartoon redraw, seed 2 | 1200×900 |
| `items/pick-a-slot.webp` | Z-Image, 1280×960, seed 1: "a chunky 1990s television remote control lying on a slowly turning round velvet pedestal, one oversized round button glowing teal, product hero shot, centered" → Qwen cartoon redraw, seed 2 | 1200×900 |
| `items/bonus-buy.webp` (both bonus buys) | Z-Image, 1280×960, seed 1: "a small plum velvet drawstring pouch, full and heavy, tied with a gold cord, plain with no symbols or printing, on a slowly turning round velvet pedestal, product hero shot, centered" → Qwen cartoon redraw, seed 1 | 1200×900 |
| `operator-call.webp` | Z-Image, 960×1200, seed 4: "waist-up portrait of an invented late-night phone operator at a 1990s TV home shopping call centre, a person in their thirties with a deadpan, slightly tired expression, wearing a big headset microphone and a loose cardigan over a faded band t-shirt, sitting at a cluttered desk with a beige corded telephone and stacks of order slips, one hand resting near the phone, waiting, a small CRT monitor glowing teal behind them, wood panelling" (it came out mid-call, so it is the call pose) → Qwen cartoon redraw, seed 3 | 480×600 |
| `operator-standby.webp` | Qwen edit of the call pose, seed 2: "Keep the same person, outfit, desk, framing and lighting. The handset is back on its cradle on the desk; they sit waiting with the headset on, one hand resting near the phone, looking toward the camera with a deadpan, slightly bored expression." → Qwen edit of the cartoon call pose, seed 1 (cartoon standby prompt) | 480×600 |
| `operator-shrug.webp` | Qwen edit of the call pose, seed 3: "Keep the same person, outfit, desk, framing and lighting. The handset is back on its cradle; they shrug with both palms turned up and an apologetic, deadpan face, looking toward the camera." → Qwen edit of the cartoon call pose, seed 2 (cartoon shrug prompt) | 480×600 |
| `ident.webp` | Z-Image, 1600×896, seed 2: "an empty 1990s TV home shopping studio set at night, a round velvet product pedestal centre stage under a single spotlight, a desk with a row of beige telephones to one side, haze in the air, wide shot, no people" → Qwen cartoon redraw, seed 1 | 1600×900 |
| `video/clerk-restock.webp` | 1. Z-Image, 960×1200, seed 1: "waist-up portrait of an invented late-night video rental store clerk, a person in their twenties with a deadpan, sleepy expression and messy hair, wearing a faded staff vest over a band t-shirt, carrying a tall stack of blank black VHS tapes against their chest, standing between the shelves" + ", " + VIDEO_STYLE → 2. Qwen edit (cartoon redraw), seed 3: "Redraw this entire image as a crude early-2000s American late-night adult cable cartoon. Keep the same composition, pose, stack of tapes, shelves, CRT and counter. Make the clerk an ugly cartoon man: bulbous nose, tiny black dot eyes, heavy unibrow, stubble, slouched, dead-eyed deadpan expression. Extremely simple flat shapes, flat solid colors with no shading or gradients, clean medium-weight black outlines, minimal detail, stiff low-budget limited-animation look, muted sickly palette of olive, dull teal, faded plum and beige. Not anime, not cute, not 3D. No text, no letters, no logos." | 480×600 |
| `video/clerk-asleep.webp` | Qwen edit of the cartoon restock pose, seed 1: "Keep the same cartoon man, art style, outfit, outlines, flat colors, palette and store exactly. He is now asleep behind the store counter, head resting on folded arms next to a beige CRT television and a cash register, the stack of tapes set down flat on the counter beside him, mouth slightly open, dead-eyed even while asleep. Flat solid colors, no shading, clean black outlines. No text, no letters, no logos." | 480×600 |

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

## The couch

The home page's room (`public/couch/90s/`, layout `src/components/couch/rooms/90s.json`). Work dir `$W` is a scratch folder, never the repo.

- **Base** (Z-Image Turbo, 1600×896, seed 9): the room prompt in the couch plan (Task 21 Step 1) with "seen from the back of the room just behind a couch, the whole scene sitting small in the middle of the frame with plain empty wall above it and plain empty floor below the coffee table … a low wooden coffee table close in front of the TV stand … an empty picture frame hanging low on the wall just left of the television". Seeds 1–4 of the original prompt put the frame and the table out of the safe area.
- **Fixes on the photo** (Qwen 2511): "Move the empty picture frame down the wall so it hangs just to the left of the television, with its top edge level with the top of the television" (seed 3), then "Move the coffee table and everything on it … a little further back and up in the picture" (seed 1). A padded zoom-out was tried and rejected: Qwen rebuilt the room with a TV too small to zoom into.
- **Cartoon redraw**: the Step 2 prompt, Qwen **2509** seed 2 (the owner's pick for colour), then a 2511 edit (seed 1) for a plain magazine cover (red bar and a picture block) and no lettering on the TV bezel.
- **Portrait**: the owner's selfie through the plan's portrait prompt (Qwen 2511, seed 1, "keep their hair, facial hair, face shape and any hat or glasses recognisable"), pasted into the frame's inner outline with `scripts/couch-art/frame.py`. SAM 3 can't find "blank picture inside the picture frame"; the inner mask is drawn from the frame's detected inner outline.
- **Masks** (SAM 3 via `comfy-tools.mjs mask`): good for tv, laptop, laptop screen, magazine, picture frame, blinds, lamp, can ("can"), the remote by the magazine (`"remote control" --separate`, the third instance) and the grey controller (`"game controller" --separate`, the first; the black one overlaps the game cases and stays in the room). "vcr and stack of vhs tapes" finds the three game cases (games, split in thirds for the covers). There is no tape stack: the Tapes door is the VCR, masked with `BiRefNetRMBG` (`BiRefNet_toonout`) on a crop. The TV screen is a flood fill from the screen's centre (SAM returns the whole set); the window glass and the cord's hit area are drawn from the window's geometry.
- **Empty room**: LaMa (`comfy-tools.mjs erase`) over the dilated union of the cut objects, the toys and the blinds. The shelf behind the laptop smears, but it always sits under a cut-out.
- **Lamp off**: Qwen 2511 seed 1 on the 1368-wide plate source (so it shares the plate's grid), registered (+1 px) before upscaling. Toy variants must be registered to the plate: Qwen edits drift a few pixels.
- **Halloween** (Qwen 2511 seed 3 on the plate source): "… an unlit carved jack-o'-lantern on top of the TV stand to the right of the television, a small bowl of candy on top of the TV stand to the left of the television, fake cobwebs in the top corner of the window frame … one small cartoon spider hanging from the cobweb on a thread. Nothing new on the coffee table." Asking for decorations "clear of" the doors wasn't enough: seeds 1–2 put the candy on the magazine. The pumpkin came out lit; an edit made it unlit for the resting state (registered −5 px), and the lit one is the poke. The candy is nudged 36 px left of the TV's rect.
- **The poster** (owner's request, replaces the paper bats): a streamer friend's meme, padded to portrait, through Qwen 2511 seed 5: "Turn this whole picture into a 1980s creature-feature horror movie poster drawn as a crude early-2000s American late-night adult cable cartoon … keep his face swollen and droopy like a blobfish exactly as in the photo …". The title "NIGHT OF THE LIVING BEAN" is set in Impact (deliberate type, not generated lettering), with a black outline and two tape strips, composited onto the Halloween plate with a drawn mask. It links to beantwitch.com (`THEMES.halloween.links`).
- **Outside**: Z-Image skyline (1600×400, seed 2) and witch (1024×640, seed 1) silhouettes; flat enough to skip the redraw. The white backgrounds come off by distance from white (skyline, keeping the lit window) and by darkness (witch).
- Everything is upscaled with 4x-AnimeSharp (`comfy-tools.mjs upscale`) and resized to 2560 wide before masking, then `python scripts/couch-art/measure.py "$W" 90s` writes the webps and the layout (`final: true` turns on the safe-area and placement tests).

People in the art: the owner's own likeness is allowed in the couch's picture frame, with the owner's consent (2026-10-04). Any other real person only with their OK, arranged by the owner: Bean's meme face on the Halloween poster (owner's request, 2026-10-04). Never name a show.
