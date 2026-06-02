"""Generate the GooferG 'GG' favicon assets with Pillow.

CRT scanline GG, bold dark-emerald outline, soft emerald glow, on a dark
rounded-square tile. Renders at high resolution and downsamples for crisp
antialiasing, then writes logo512.png, logo192.png, and favicon.ico (16/32/48).
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PUBLIC = os.path.join(os.path.dirname(__file__), "..", "public")
FONT_PATH = r"C:\Windows\Fonts\ariblk.ttf"  # Arial Black — heavy display face

# Brand colors
TILE = (14, 14, 17, 255)          # #0e0e11
TILE_STROKE = (255, 255, 255, 20)  # faint white edge
EMERALD = (52, 211, 153, 255)     # #34d399
OUTLINE = (6, 61, 44, 255)        # #063d2c dark-emerald
GLOW = (52, 211, 153)             # glow tint


def render(px):
    """Render the mark at `px` size by drawing at 4x and downsampling."""
    S = px * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded tile
    pad = int(S * 0.03)
    radius = int(S * 0.20)
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=radius, fill=TILE)
    d.rounded_rectangle(
        [pad, pad, S - pad, S - pad], radius=radius, outline=TILE_STROKE, width=max(1, S // 256)
    )

    # Fit "GG" to ~76% of tile width
    text = "GG"
    target_w = S * 0.76
    size = S  # start big, shrink to fit
    font = ImageFont.truetype(FONT_PATH, size)
    while size > 8:
        font = ImageFont.truetype(FONT_PATH, size)
        box = d.textbbox((0, 0), text, font=font)
        if (box[2] - box[0]) <= target_w:
            break
        size -= 4
    box = d.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    tx = (S - tw) / 2 - box[0]
    ty = (S - th) / 2 - box[1]

    stroke_w = max(2, int(S * 0.030))  # bold outline

    # Glow: emerald text on its own layer, blurred, composited under the mark
    glow_layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    gd.text((tx, ty), text, font=font, fill=GLOW + (200,))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(S * 0.018))
    img = Image.alpha_composite(img, glow_layer)

    # Main GG: emerald fill + dark-emerald bold outline
    d = ImageDraw.Draw(img)
    d.text(
        (tx, ty), text, font=font, fill=EMERALD,
        stroke_width=stroke_w, stroke_fill=OUTLINE,
    )

    # Scanlines: faint dark horizontal lines over the whole tile
    scan = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scan)
    step = max(4, int(S * 0.07))
    lh = max(1, int(S * 0.02))
    inset = int(S * 0.06)
    y = int(S * 0.10)
    while y < S - inset:
        sd.rectangle([inset, y, S - inset, y + lh], fill=(0, 0, 0, 46))
        y += step
    # clip scanlines to the rounded tile
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [pad, pad, S - pad, S - pad], radius=radius, fill=255
    )
    img = Image.composite(Image.alpha_composite(img, scan), img, mask)

    return img.resize((px, px), Image.LANCZOS)


def main():
    out512 = render(512)
    out512.save(os.path.join(PUBLIC, "logo512.png"))
    render(192).save(os.path.join(PUBLIC, "logo192.png"))

    # favicon.ico with multiple embedded sizes
    ico = render(64)
    ico.save(
        os.path.join(PUBLIC, "favicon.ico"),
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )
    print("wrote logo512.png, logo192.png, favicon.ico")


if __name__ == "__main__":
    main()
