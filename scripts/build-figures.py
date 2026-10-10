# Turns the landing's two public-domain pictures into tone grids, once, by hand:
#   python3 scripts/build-figures.py
# The page draws the grids with real, measured letters, so it never samples an image and no image ships.
# Sources (scripts/data/figures/, downsized, kept out of the site):
#   creation-hands.png    Michelangelo, The Creation of Adam, about 1512: the two hands cut from their ground
#   great-wave.jpg        Hokusai, Under the Wave off Kanagawa, about 1831
# Output: lib/site/hands.ts (the hands), lib/site/figures.ts (where the wave's crest is) and lib/site/wave.ts (the
# wave). The hands and the wave are files of their own, so the page loads each only when it draws it. The wave's
# rows are run-length coded, a tone letter and a count: a is empty, b light, c middle, d dark. "a12d4" is twelve empty
# cells, then four dark ones. The hands' are coded the same way in sixteen shades, "." outside the hand, then a (the
# deepest shadow) to p (the brightest light); a letter with no count is one cell.
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
OUT_HANDS = ROOT / "lib" / "site" / "hands.ts"


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


# The cut-out is 675 by 210; Adam's hand is left of SPLIT, God's from it on. The fingertips are where the two reach.
SPLIT, ADAM_TIP, GOD_TIP = 345, (335, 111), (354, 102)


def hands():
    a = np.asarray(Image.open(SRC / "creation-hands.png").convert("RGBA")).astype(float)
    inside = a[..., 3] >= 128
    L = lum(a[..., :3])
    shade = np.zeros(L.shape)
    # Each hand is ranked against itself, so both have their full range from shadow to light whatever the fresco's
    # light did: the 4th and 96th centiles are the ends.
    for x0, x1 in ((0, SPLIT), (SPLIT, a.shape[1])):
        part = inside[:, x0:x1]
        lo, hi = np.quantile(L[:, x0:x1][part], [0.04, 0.96])
        shade[:, x0:x1] = np.clip((L[:, x0:x1] - lo) / (hi - lo), 0, 1)
    level = np.minimum(15, (shade * 16).astype(int))
    rows = []
    for y in range(a.shape[0]):
        cells = ["." if not inside[y, x] else "abcdefghijklmnop"[level[y, x]] for x in range(a.shape[1])]
        out, i = [], 0
        while i < len(cells):
            j = i
            while j < len(cells) and cells[j] == cells[i]:
                j += 1
            out.append(cells[i] + (str(j - i) if j - i > 1 else ""))
            i = j
        rows.append("".join(out))
    return {"w": int(a.shape[1]), "h": int(a.shape[0]), "split": SPLIT, "adam": list(ADAM_TIP), "god": list(GOD_TIP), "rows": rows}


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


sea = wave()

data = {
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
    + "// The tone grid's shape, coded as in wave.ts. The wave is loaded as the sea nears the screen; its crest, as\n"
    "// fractions of the print's width and height, is here.\n\n"
    "export type Figure = { w: number; h: number; cell?: number; rows: string[] }\n\n"
    + const("WAVE_CREST", crest(sea), "{ x: number; y: number }")
)
OUT_WAVE.write_text(
    GENERATED
    + "// Hokusai's wave as a tone grid, coded as in figures.ts.\n\n"
    'import type { Figure } from "./figures"\n\n'
    + const("WAVE", data["wave"])
)
HANDS = hands()
OUT_HANDS.write_text(
    GENERATED
    + "// Michelangelo's two hands, cut from their ground, in sixteen shades ranked within each hand: each row is run-length\n"
    "// coded, \".\" outside the hand and a (deepest shadow) to p (brightest light), a count after a letter that repeats.\n"
    "// Adam's hand is left of `split`, God's from it on; `adam` and `god` are their fingertips. The hero loads this file\n"
    "// when it draws them.\n\n"
    "export type Hands = { w: number; h: number; split: number; adam: [number, number]; god: [number, number]; rows: string[] }\n\n"
    + const("HANDS", HANDS, "Hands")
)
data["hands"] = HANDS
for k, v in data.items():
    print(k, v["w"], "x", v["h"], sum(len(r) for r in v["rows"]), "chars")

# --preview DIR writes each grid as a picture, to check by eye that it still reads.
if "--preview" in sys.argv:
    where = Path(sys.argv[sys.argv.index("--preview") + 1])
    for k, t in (("wave", sea),):
        Image.fromarray(np.array([255, 190, 110, 0], dtype=np.uint8)[t]).resize((t.shape[1] * 3, t.shape[0] * 3), Image.NEAREST).save(where / f"{k}-tone.png")
