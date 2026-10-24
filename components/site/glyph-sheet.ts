// Letters drawn once, then stamped. A canvas that sets a letter with fillText under a turn and a size that change every
// frame makes the browser cut the letter's outline again each time (its cache of cut letters is keyed by the transform),
// and hundreds of letters a frame stalled the scroll for a quarter of a second. So a section asks this sheet for each
// letter it will use, once per layout, in its face and ink, and a frame stamps it with drawImage under the same matrix
// it would have given fillText, which costs the same at any angle.

type Page = { cv: HTMLCanvasElement; used: number }
/** One letter (or a few) as it sits on the sheet: its page and box in sheet pixels, and where the text's origin is in it. */
export type Glyph = { page: number; x: number; y: number; w: number; h: number; ax: number; ay: number }
type Job = { g: Glyph; font: string; fill: string; text: string; baseline: CanvasTextBaseline }

const PAD = 2, WIDTH = 2048, TALL = 4096

/**
 * A sheet for one layout. `dpr` is the canvas's density; letters are cut a little sharper than that (`over`), so a
 * stamp turned or shrunk by a hair never has to be stretched. Colours are taken as given, so a theme change means a new
 * sheet, which every section's layout already makes.
 */
export function glyphSheet(dpr: number, over = 1.25) {
  const k = dpr * over, jobs: Job[] = [], seen = new Map<string, Glyph>(), pages: Page[] = []
  let dirty = false, pen: CanvasRenderingContext2D | null = null

  /** The letter for `text` set in `font` and `fill`, centred on its origin and standing on `baseline` there. Same arguments, same glyph. */
  const glyph = (font: string, fill: string, text: string, baseline: CanvasTextBaseline = "alphabetic") => {
    const key = `${baseline}|${fill}|${font}|${text}`
    let g = seen.get(key)
    if (!g) {
      seen.set(key, (g = { page: 0, x: 0, y: 0, w: 0, h: 0, ax: 0, ay: 0 }))
      jobs.push({ g, font, fill, text, baseline })
      dirty = true
    }
    return g
  }

  /** Cuts every letter asked for so far. Called by the section's layout once they are all in; a late one is cut by its first stamp. */
  const bake = () => {
    dirty = false
    pen ??= document.createElement("canvas").getContext("2d")
    if (!pen) return
    for (const p of pages) p.cv.width = p.cv.height = 0
    pages.length = 0
    let page = 0, x = 0, y = 0, row = 0
    pen.textAlign = "center"
    for (const j of jobs) {
      pen.font = j.font
      pen.textBaseline = j.baseline
      const t = pen.measureText(j.text), L = t.actualBoundingBoxLeft, R = t.actualBoundingBoxRight, A = t.actualBoundingBoxAscent, D = t.actualBoundingBoxDescent
      const g = j.g
      if (!j.text.trim() || L + R <= 0 || A + D <= 0) {
        Object.assign(g, { w: 0, h: 0 })
        continue
      }
      const w = Math.ceil((L + R) * k) + 2 * PAD, h = Math.ceil((A + D) * k) + 2 * PAD
      if (x + w > WIDTH) [x, y, row] = [0, y + row, 0]
      if (y + h > TALL) [page, x, y, row] = [page + 1, 0, 0, 0]
      Object.assign(g, { page, x, y, w, h, ax: PAD + L * k, ay: PAD + A * k })
      x += w
      row = Math.max(row, h)
      const p = (pages[page] ??= { cv: document.createElement("canvas"), used: 0 })
      p.used = Math.max(p.used, y + h)
    }
    for (const p of pages) {
      p.cv.width = WIDTH
      p.cv.height = p.used
    }
    const ctxs = pages.map((p) => p.cv.getContext("2d")!)
    for (const c of ctxs) {
      c.textAlign = "center"
    }
    for (const j of jobs) {
      const g = j.g
      if (!g.w) continue
      const c = ctxs[g.page]
      c.setTransform(k, 0, 0, k, g.x + g.ax, g.y + g.ay)
      c.font = j.font
      c.textBaseline = j.baseline
      c.fillStyle = j.fill
      c.fillText(j.text, 0, 0)
    }
  }

  /** Stamps a glyph at the context's origin, under whatever matrix it has, as `fillText(text, 0, 0)` would have set it. */
  const draw = (ctx: CanvasRenderingContext2D, g: Glyph) => {
    if (dirty) bake()
    if (!g.w) return
    if (ctx.imageSmoothingQuality !== "high") ctx.imageSmoothingQuality = "high"
    ctx.drawImage(pages[g.page].cv, g.x, g.y, g.w, g.h, -g.ax / k, -g.ay / k, g.w / k, g.h / k)
  }

  return { glyph, bake, draw }
}

export type GlyphSheet = ReturnType<typeof glyphSheet>
