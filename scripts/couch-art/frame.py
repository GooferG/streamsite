"""Paste the cartoon portrait into the picture frame's inner area.

usage: python scripts/couch-art/frame.py <plate.png> <frame-inner-mask.png> <portrait.png> <out.png>
"""
import sys

import numpy as np
from PIL import Image, ImageOps

plate_path, mask_path, portrait_path, out_path = sys.argv[1:5]
plate = Image.open(plate_path).convert("RGB")
mask = Image.open(mask_path).convert("L").resize(plate.size)
ys, xs = np.nonzero(np.array(mask) > 127)
if not len(xs):
    raise SystemExit("empty mask")
box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
portrait = ImageOps.fit(Image.open(portrait_path).convert("RGB"), (box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
plate.paste(portrait, box[:2])
plate.save(out_path)
print(f"{out_path}: portrait at {box}")
