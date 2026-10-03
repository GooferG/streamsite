"""Crop, resize and compress GSN art to its size budget.

usage: python scripts/gsn-art/to_webp.py <in.png> <out.webp> <width> <height> <max_kb>
"""
import os
import sys

from PIL import Image, ImageOps

src, out = sys.argv[1], sys.argv[2]
w, h, max_kb = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
img = ImageOps.fit(Image.open(src).convert("RGB"), (w, h), Image.LANCZOS)
for quality in range(86, 39, -4):
    img.save(out, "WEBP", quality=quality, method=6)
    kb = os.path.getsize(out) / 1024
    if kb <= max_kb:
        break
print(f"{out}: {w}x{h} q{quality} {kb:.0f} KB" + ("" if kb <= max_kb else " (OVER BUDGET)"))
