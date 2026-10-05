"""Turn the picked room art and its masks into the couch's assets and layout.

usage: python scripts/couch-art/measure.py <work-dir> [room-id]

<work-dir> holds (see the art task in the plan), every image 2560 wide:
  plate.png, empty.png              the room, and the room with every door object,
                                    toy and the blinds erased
  masks/<door>.png                  tv tapes guide laptop games remote photo (white = object)
  masks/screen-tv.png, screen-laptop.png, window-glass.png, blinds.png, cord.png (optional)
  masks/case-1.png … case-3.png     game case fronts, left to right (optional)
  masks/lamp.png, controller.png, can.png   the room's toys
  lamp-off.png                      the plate with the lamp switched off
  neon/ (optional)                  lit.png, off.png, mask.png: the GOOFER sign lit (with its glow on
                                    the wall), switched off, and a SOFT alpha mask (box and cord 255,
                                    glow halo fading to 0); cut with the mask's own values as alpha
                                    into toy-neon.webp / toy-neon-off.webp (60 KB each)
  skyline.png                       the night skyline strip, transparent background (optional)
  halloween/ (optional)             plate.png, pumpkin-lit.png, witch.png (transparent) and
                                    masks/cobweb.png, poster.png, pumpkin.png, spider.png, candy.png
Writes public/couch/<room>/… and src/components/couch/rooms/<room>.json (final: true).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOORS = ["tv", "tapes", "guide", "laptop", "games", "remote", "photo"]
CUT = ["tapes", "guide", "laptop", "games", "remote", "photo"]
WIDTHS = {1280: 90, 1920: 150, 2560: 250}
DOOR_SCALE = 2560
CUT_KB = 40
NEON_KB = 60
NAMES = {"tv": "TV", "note": "Note", "laptop": "Laptop", "tapes": "Tapes", "guide": "TV guide", "games": "Games", "remote": "Remote", "photo": "Photo"}
TOYS = [("lamp", "toggle"), ("controller", "wiggle"), ("can", "fizz")]
HALLOWEEN_DRESSING = ["cobweb", "poster"]
HALLOWEEN_TOYS = [("pumpkin", "light"), ("spider", "drop"), ("candy", "scatter")]


def load_mask(path, size):
    return Image.open(path).convert("L").resize(size)


def bbox(mask, threshold=127):
    a = np.array(mask) > threshold
    ys, xs = np.nonzero(a)
    if not len(xs):
        raise SystemExit("empty mask")
    h, w = a.shape
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    return [round(100 * x0 / w, 2), round(100 * y0 / h, 2), round(100 * (x1 - x0) / w, 2), round(100 * (y1 - y0) / h, 2)]


def webp(img, out, max_kb):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for quality in range(86, 39, -4):
        img.save(out, "WEBP", quality=quality, method=6)
        kb = os.path.getsize(out) / 1024
        if kb <= max_kb:
            break
    print(f"{out}: {img.size[0]}x{img.size[1]} q{quality} {kb:.0f} KB" + ("" if kb <= max_kb else " (OVER BUDGET)"))
    return kb <= max_kb


def cutout(img, mask, rect, out, max_kb=CUT_KB, scale=1920):
    W, H = img.size
    box = (round(rect[0] * W / 100), round(rect[1] * H / 100), round((rect[0] + rect[2]) * W / 100), round((rect[1] + rect[3]) * H / 100))
    piece = img.crop(box).convert("RGBA")
    piece.putalpha(mask.crop(box).filter(ImageFilter.GaussianBlur(0.6)))
    target = max(1, round(rect[2] / 100 * scale))
    if piece.width > target:
        piece = piece.resize((target, round(piece.height * target / piece.width)), Image.LANCZOS)
    return webp(piece, out, max_kb)


def phone_crop(a, b, W, H, pad=4.0):
    x0, y0 = min(a[0], b[0]) - pad, min(a[1], b[1]) - pad
    x1, y1 = max(a[0] + a[2], b[0] + b[2]) + pad, max(a[1] + a[3], b[1] + b[3]) + pad
    w, h = x1 - x0, y1 - y0
    if w * W / (h * H) < 4 / 3:
        nw = h * H * 4 / 3 / W
        x0, w = x0 - (nw - w) / 2, nw
    else:
        nh = w * W * 3 / 4 / H
        y0, h = y0 - (nh - h) / 2, nh
    x0, y0 = min(max(0, x0), 100 - w), min(max(0, y0), 100 - h)
    return [round(x0, 2), round(y0, 2), round(w, 2), round(h, 2)]


def main(work, room="90s"):
    pub = os.path.join(ROOT, "public", "couch", room)
    layout_path = os.path.join(ROOT, "src", "components", "couch", "rooms", f"{room}.json")

    def url(name):
        return f"/couch/{room}/{name}"

    plate = Image.open(os.path.join(work, "plate.png")).convert("RGB")
    W, H = plate.size
    size = (W, H)
    empty = Image.open(os.path.join(work, "empty.png")).convert("RGB").resize(size)

    def mask(name):
        return load_mask(os.path.join(work, "masks", f"{name}.png"), size)

    def has_mask(name):
        return os.path.exists(os.path.join(work, "masks", f"{name}.png"))

    ok = True

    # The glass is transparent in both plates, so the night shows through.
    glass_mask = mask("window-glass")
    alpha = Image.eval(glass_mask, lambda v: 0 if v > 127 else 255)
    plate_a, empty_a = plate.convert("RGBA"), empty.convert("RGBA")
    plate_a.putalpha(alpha)
    empty_a.putalpha(alpha)
    plate_map, empty_map = {}, {}
    for w, kb in WIDTHS.items():
        dims = (w, round(w * H / W))
        ok &= webp(plate_a.resize(dims, Image.LANCZOS), os.path.join(pub, f"room-{w}.webp"), kb)
        ok &= webp(empty_a.resize(dims, Image.LANCZOS), os.path.join(pub, f"empty-{w}.webp"), kb)
        plate_map[str(w)], empty_map[str(w)] = url(f"room-{w}.webp"), url(f"empty-{w}.webp")

    doors = {}
    for d in DOORS:
        m = mask(d)
        rect = bbox(m)
        entry = {"rect": rect, "anchor": [round(rect[0] + rect[2] / 2, 2), rect[1]]}
        if d in CUT:
            # Doors are the camera's zoom targets: cut them at the plate's full width.
            ok &= cutout(plate, m, rect, os.path.join(pub, f"cut-{d}.webp"), scale=DOOR_SCALE)
            entry["cutout"] = url(f"cut-{d}.webp")
        doors[d] = entry
    tv = doors["tv"]["rect"]
    note = [round(tv[0] + tv[2] * 0.04, 2), round(tv[1] + tv[3] * 0.04, 2), round(tv[2] * 0.2, 2), round(tv[3] * 0.24, 2)]
    doors["note"] = {"rect": note, "anchor": [round(note[0] + note[2] / 2, 2), note[1]]}
    cases = [bbox(mask(f"case-{i}")) for i in (1, 2, 3) if has_mask(f"case-{i}")]
    if cases:
        doors["games"]["cases"] = cases
    screens = {k: bbox(mask(f"screen-{k}")) for k in ("tv", "laptop")}

    # The window: the glass, the blinds (cut from the plate), the cord, the skyline.
    glass = bbox(glass_mask)
    blinds_mask = mask("blinds")
    blinds_rect = bbox(blinds_mask)
    ok &= cutout(plate, blinds_mask, blinds_rect, os.path.join(pub, "blinds.webp"), 60)
    window = {"glass": glass, "blinds": {"src": url("blinds.webp"), "rect": blinds_rect}}
    if has_mask("cord"):
        window["cord"] = bbox(mask("cord"))
    sky_path = os.path.join(work, "skyline.png")
    if os.path.exists(sky_path):
        sky = Image.open(sky_path).convert("RGBA")
        sky_w = max(1, round(glass[2] / 100 * 1920))
        sky = sky.resize((sky_w, round(sky.height * sky_w / sky.width)), Image.LANCZOS)
        sky_h = round(100 * sky.height / (1920 * H / W), 2)  # its height in percent of the art
        ok &= webp(sky, os.path.join(pub, "skyline.webp"), CUT_KB)
        window["skyline"] = {"src": url("skyline.webp"), "rect": [glass[0], round(glass[1] + glass[3] - sky_h, 2), glass[2], sky_h]}

    # The room's toys, cut from the plate; the lamp's off state from lamp-off.png.
    lamp_off = Image.open(os.path.join(work, "lamp-off.png")).convert("RGB").resize(size)
    toys = []
    for name, effect in TOYS:
        m = mask(name)
        rect = bbox(m)
        ok &= cutout(plate, m, rect, os.path.join(pub, f"toy-{name}.webp"))
        art = {"idle": url(f"toy-{name}.webp")}
        if name == "lamp":
            ok &= cutout(lamp_off, m, rect, os.path.join(pub, "toy-lamp-off.webp"))
            art["active"] = url("toy-lamp-off.webp")
        toys.append({"id": name, "effect": effect, "rect": rect, "art": art})

    # The neon sign: lit and off art, both cut with the soft mask (glow halo included).
    neon = os.path.join(work, "neon")
    if all(os.path.exists(os.path.join(neon, n)) for n in ("lit.png", "off.png", "mask.png")):
        nm = load_mask(os.path.join(neon, "mask.png"), size)
        rect = bbox(nm, 8)
        for src, out in (("lit.png", "toy-neon.webp"), ("off.png", "toy-neon-off.webp")):
            img = Image.open(os.path.join(neon, src)).convert("RGB").resize(size)
            ok &= cutout(img, nm, rect, os.path.join(pub, out), NEON_KB)
        # The pointer area is the sign's box: the hard part of the mask, minus the cord
        # (rows narrower than 30% of the widest row).
        hard = np.array(nm) >= 250
        counts = hard.sum(axis=1)
        keep = counts >= 0.3 * counts.max()
        ys = np.nonzero(keep)[0]
        xs = np.nonzero(hard[keep].any(axis=0))[0]
        h, w = hard.shape
        hit = [round(100 * xs.min() / w, 2), round(100 * ys.min() / h, 2), round(100 * (xs.max() + 1 - xs.min()) / w, 2), round(100 * (ys.max() + 1 - ys.min()) / h, 2)]
        toys.append({"id": "neon", "effect": "neon", "rect": rect, "hit": hit, "art": {"idle": url("toy-neon.webp"), "active": url("toy-neon-off.webp")}})

    # Halloween: dressing and toys cut from the Halloween plate.
    themes = {}
    hw = os.path.join(work, "halloween")
    if os.path.isdir(hw):
        hplate = Image.open(os.path.join(hw, "plate.png")).convert("RGB").resize(size)
        lit = Image.open(os.path.join(hw, "pumpkin-lit.png")).convert("RGB").resize(size)

        def hmask(name):
            return load_mask(os.path.join(hw, "masks", f"{name}.png"), size)

        dressing = []
        for name in HALLOWEEN_DRESSING:
            m = hmask(name)
            rect = bbox(m)
            ok &= cutout(hplate, m, rect, os.path.join(pub, "halloween", f"{name}.webp"))
            dressing.append({"id": name, "src": url(f"halloween/{name}.webp"), "rect": rect})
        htoys = []
        for name, effect in HALLOWEEN_TOYS:
            m = hmask(name)
            rect = bbox(m)
            ok &= cutout(hplate, m, rect, os.path.join(pub, "halloween", f"{name}.webp"))
            art = {"idle": url(f"halloween/{name}.webp")}
            if name == "pumpkin":
                ok &= cutout(lit, m, rect, os.path.join(pub, "halloween", "pumpkin-lit.webp"))
                art["active"] = url("halloween/pumpkin-lit.webp")
            htoys.append({"id": name, "effect": effect, "rect": rect, "art": art})
        # The unlit pumpkin doubles as the laptop's screensaver bug.
        theme = {"dressing": dressing, "toys": htoys, "laptopBug": url("halloween/pumpkin.webp")}
        witch_path = os.path.join(hw, "witch.png")
        if os.path.exists(witch_path):
            witch = Image.open(witch_path).convert("RGBA")
            witch = witch.resize((400, round(witch.height * 400 / witch.width)), Image.LANCZOS)
            ok &= webp(witch, os.path.join(pub, "halloween", "witch.webp"), CUT_KB)
            theme["witch"] = url("halloween/witch.webp")
        themes["halloween"] = theme

    s = screens["tv"]
    layout = {
        "final": True,
        "room": {"id": room, "screen": "crt", "names": NAMES},
        "art": {
            "width": W,
            "height": H,
            "focal": [round(s[0] + s[2] / 2, 2), round(s[1] + s[3] / 2, 2)],
            "plate": plate_map,
            "empty": empty_map,
        },
        "screens": screens,
        "doors": doors,
        "window": window,
        "toys": toys,
        "themes": themes,
        "phoneCrop": phone_crop(tv, doors["tapes"]["rect"], W, H),
    }
    with open(layout_path, "w", newline="\n") as f:
        json.dump(layout, f, indent=2)
        f.write("\n")
    print(f"wrote {layout_path}")
    if not ok:
        raise SystemExit("some files are over budget")


if __name__ == "__main__":
    main(*sys.argv[1:3])
