# Turns the landing's two public-domain pictures into tone grids, once, by hand:
#   python3 scripts/build-figures.py
# The page draws the grids with real, measured letters, so it never samples an image and no image ships.
# Sources (scripts/data/figures/, downsized, kept out of the site):
#   creation-of-adam.jpg  Michelangelo, The Creation of Adam, about 1512 (the hands, cropped)
#   great-wave.jpg        Hokusai, Under the Wave off Kanagawa, about 1831
# Output: lib/site/figures.ts (the hands, and where the wave's crest is) and lib/site/wave.ts (the wave). The wave
# is its own file so the page loads it only as the sea nears the screen. Each row is run-length coded, a tone letter
# and a count: a is empty, b light, c middle, d dark. "a12d4" is twelve empty cells, then four dark ones.
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / "data" / "figures"
OUT = ROOT / "lib" / "site" / "figures.ts"
OUT_WAVE = ROOT / "lib" / "site" / "wave.ts"


def hsv(a):
    mx, mn = a.max(-1), a.min(-1)
    sat = (mx - mn) / (mx + 1e-6)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = mx - mn + 1e-6
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return hue, sat, mx


def lum(a):
    return 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]


def largest(mask, keep):
    lab, n = ndimage.label(mask)
    if n == 0:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    ids = np.argsort(sizes)[::-1][:keep] + 1
    return np.isin(lab, ids)


def hand(box, width, keep):
    # The crop on disk starts at (230, 205) in a 1400-wide frame of the fresco; boxes are in that frame.
    im = Image.open(SRC / "creation-of-adam.jpg").convert("RGB")
    s = im.width / (700 - 230)
    c = im.crop(tuple(round((v - o) * s) for v, o in zip(box, (230, 205, 230, 205))))
    h = round(width * c.height / c.width)
    c = c.resize((width, h), Image.LANCZOS).filter(ImageFilter.MedianFilter(3))
    a = np.asarray(c).astype(float) / 255
    hue, sat, val = hsv(a)
    ys, xs = np.mgrid[0:h, 0:width]
    skin = (hue >= 10) & (hue <= 48) & (sat > 0.24) & (val > 0.25) & keep(xs / width, ys / h)
    skin = largest(ndimage.binary_closing(skin, iterations=1), 1)
    L = lum(a)
    q1, q2 = np.quantile(L[skin], [0.25, 0.6])
    tone = np.where(skin, np.where(L < q1, 3, np.where(L < q2, 2, 1)), 0)
    return trim(tone), (box[2] - box[0]) / width


def wave():
    im = Image.open(SRC / "great-wave.jpg").convert("RGB")
    s = im.width / 1280
    im = im.crop(tuple(round(v * s) for v in (0, 40, 1280, 860)))
    a = np.asarray(im).astype(float) / 255
    hue, sat, val = hsv(a)
    L = lum(a)
    # The foam is unprinted paper, the same colour as the sky, so colour cannot tell them apart; Hokusai's outlines
    # can. Paper is the warm cream or the grey of the horizon. The sky is the paper that reaches the top edge without
    # crossing a line; paper held inside the lines is foam (and the boats and Fuji's snow, which are light as well).
    rb = a[..., 0] - a[..., 2]
    paper = ((rb > 0.04) & (L > 0.72)) | ((sat < 0.14) & (rb >= 0) & (L > 0.4))
    wall = ndimage.binary_dilation(~paper, iterations=2)  # thicken the outlines so a gap of a pixel or two still holds
    lab, n = ndimage.label(~wall)
    top = np.unique(lab[0][lab[0] > 0])
    sky = ndimage.binary_dilation(np.isin(lab, top), iterations=2) & paper
    sea = ~sky
    # The title cartouche and the signature are words already: leave out whatever lies wholly inside their corner.
    lab, n = ndimage.label(sea)
    for k, (ys, xs) in enumerate(ndimage.find_objects(lab), 1):
        if ys.stop <= round(300 * s) and xs.stop <= round(135 * s):
            sea[lab == k] = False
    small = Image.fromarray((sea * 255).astype("uint8")).resize((320, 205), Image.BOX)
    sea = np.asarray(small) > 140
    L = np.asarray(Image.fromarray((L * 255).astype("uint8")).resize((320, 205), Image.LANCZOS)).astype(float) / 255
    sea = largest(sea, 12)
    # Drop specks: anything under a few cells reads as dirt, not spray.
    lab, n = ndimage.label(sea)
    sizes = ndimage.sum(sea, lab, range(1, n + 1))
    sea = np.isin(lab, np.nonzero(sizes >= 40)[0] + 1)
    # Foam is light, the middle blue is middle and the Prussian blue is dark: the darker the sea, the heavier the letters.
    return np.where(sea, np.where(L < 0.45, 3, np.where(L < 0.74, 2, 1)), 0)


def trim(tone):
    ys, xs = np.nonzero(tone)
    return tone[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def rle(row):
    out, last, n = [], None, 0
    for t in row:
        if t == last:
            n += 1
            continue
        if last is not None:
            out.append(f"{'abcd'[last]}{n}")
        last, n = int(t), 1
    out.append(f"{'abcd'[last]}{n}")
    return "".join(out)


def figure(tone, **extra):
    return {"w": int(tone.shape[1]), "h": int(tone.shape[0]), **extra, "rows": [rle(r) for r in tone]}


adam, adam_cell = hand((240, 225, 535, 340), 300, lambda x, y: ~((y > 0.86) & (x > 0.3) & (x < 0.6)))
god, god_cell = hand((528, 215, 690, 335), 260, lambda x, y: (y > 0.28) & ~((x > 0.8) & ((y < 0.33) | (y > 0.68))))
sea = wave()

data = {
    "adam": figure(adam, cell=round(adam_cell, 4)),
    "god": figure(god, cell=round(god_cell, 4)),
    "wave": figure(sea),
}


# The crest: the inked cell that reaches furthest right in the top tenth of the print, where the claw of foam hangs.
# The page's note points at it, so it is known before the wave itself arrives.
def crest(tone):
    col, row = 0, 0
    for i, r in enumerate(tone[: -(-tone.shape[0] // 10)]):
        inked = np.nonzero(r)[0]
        if len(inked) and inked[-1] > col:
            col, row = int(inked[-1]), i
    return {"x": round((col + 1) / tone.shape[1], 4), "y": round((row + 0.5) / tone.shape[0], 4)}


GENERATED = "// Generated by scripts/build-figures.py from scripts/data/figures. Do not edit; run the script again.\n"
const = lambda k, v, t="Figure": f"export const {k}: {t} = {json.dumps(v, separators=(',', ':'))}\n"
OUT.write_text(
    GENERATED
    + "// Tone grids for the landing's hands. Each row is run-length coded: a tone letter (a empty, b light,\n"
    "// c middle, d dark) and a count of cells. `cell` is a hand's cell size in the fresco's frame, so both hands\n"
    "// keep their true scale to each other. The wave is in wave.ts, loaded as the sea nears the screen; its crest,\n"
    "// as fractions of the print's width and height, is here.\n\n"
    "export type Figure = { w: number; h: number; cell?: number; rows: string[] }\n\n"
    + const("ADAM", data["adam"])
    + const("GOD", data["god"])
    + const("WAVE_CREST", crest(sea), "{ x: number; y: number }")
)
OUT_WAVE.write_text(
    GENERATED
    + "// Hokusai's wave as a tone grid, coded as in figures.ts.\n\n"
    'import type { Figure } from "./figures"\n\n'
    + const("WAVE", data["wave"])
)
for k, v in data.items():
    print(k, v["w"], "x", v["h"], sum(len(r) for r in v["rows"]), "chars")

# --preview DIR writes each grid as a picture, to check by eye that it still reads.
if "--preview" in sys.argv:
    where = Path(sys.argv[sys.argv.index("--preview") + 1])
    for k, t in (("adam", adam), ("god", god), ("wave", sea)):
        Image.fromarray(np.array([255, 190, 110, 0], dtype=np.uint8)[t]).resize((t.shape[1] * 3, t.shape[0] * 3), Image.NEAREST).save(where / f"{k}-tone.png")
