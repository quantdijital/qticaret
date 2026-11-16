import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { ImageView } from "@qticaret/ui"
import { buildAtolyeCss } from "@/test/tailwind-build"
import {
  STRIPS_LOOK_BEFORE,
  Strips,
  stripSizes,
} from "../../../../../packages/themes/atolye/src/parts/Strips"
import type { StripItem, StripsLook } from "../../../../../packages/themes/atolye/src/parts/Strips"

/**
 * The slanted strips' core (`parts/Strips.tsx`, `strips.css`; adr/0049 Ek
 * 2026-11-15 and 2026-11-16): any section's photographs as upright strips
 * with parallel slanted seams, the look and the count as attributes (no
 * inline style), words over a strip's foot and the whole strip a link when
 * the section gives them.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 800,
  sources: { avif: null, webp: `/media/${name}-800.webp 800w` },
})

const items = (count: number, more: Partial<StripItem> = {}): StripItem[] =>
  Array.from({ length: count }, (_, at) => ({
    key: String(at),
    image: picture(`p${String(at)}`),
    ...more,
  }))

const draw = (list: StripItem[], look: StripsLook = STRIPS_LOOK_BEFORE, max?: number) =>
  renderToStaticMarkup(
    <Strips items={list} look={look} span={92} max={max} className="aspect-[21/9]" />
  )

const count = (html: string, needle: string) => html.split(needle).length - 1

describe("the strips' markup", () => {
  it("prints today's look as no attribute at all, only the count", () => {
    const html = draw(items(3))
    expect(html).toMatch(/^<ul class="gf-strips rounded-media aspect-\[21\/9\]" data-count="3">/)
    expect(html).not.toMatch(/data-(slant|line|overlap|dim|hover)=/)
    expect(html).not.toContain("style=")
    // No link without a target: a plain box, no words without them
    expect(count(html, '<div class="gf-strip-cut"><span class="gf-strip-frame">')).toBe(3)
    expect(html).not.toContain("gf-strip-text")
  })

  it("names every other step as an attribute", () => {
    const html = draw(items(2), {
      slant: "steep",
      line: "thick",
      overlap: true,
      dim: true,
      hover: "still",
    })
    expect(html).toContain(
      'data-count="2" data-slant="steep" data-line="thick" data-overlap="on" data-dim="on" data-hover="still"'
    )
  })

  it("makes the whole strip a link, words over its foot with the editor's marks", () => {
    const html = draw(
      items(2, {
        href: "/urun/a",
        title: "Şef Bıçağı",
        note: "1.749,00 TL",
        titleMark: { "data-qf": "items.0.title" },
      })
    )
    expect(count(html, '<a href="/urun/a" class="gf-strip-cut">')).toBe(2)
    expect(html).toContain(
      '<span class="gf-strip-text"><span class="gf-strip-title" data-qf="items.0.title">Şef Bıçağı</span><span class="gf-strip-note">1.749,00 TL</span></span>'
    )
  })

  it("draws at most its max, never more than eight", () => {
    expect(draw(items(6), STRIPS_LOOK_BEFORE, 5)).toContain('data-count="5"')
    expect(draw(items(12), STRIPS_LOOK_BEFORE, 12)).toContain('data-count="8"')
    expect(draw(items(6))).toContain('data-count="4"')
  })

  it("sizes an image as a widened strip from 1024 px, a tablet's four and a phone's three below", () => {
    expect(stripSizes(1, 53)).toBe("(min-width: 1024px) 53vw, 100vw")
    expect(stripSizes(3, 53)).toBe("(min-width: 1024px) 31vw, 34vw")
    expect(stripSizes(6, 92)).toBe("(min-width: 1024px) 33vw, (min-width: 640px) 25vw, 34vw")
    // Steeper and overlapping seams widen the strips' sum; equal strips when they stay still
    expect(stripSizes(4, 53, { slant: "steep", overlap: true })).toBe(
      "(min-width: 1024px) 42vw, (min-width: 640px) 25vw, 34vw"
    )
    expect(stripSizes(4, 53, { slant: "soft", overlap: false, hover: "still" })).toBe(
      "(min-width: 1024px) 14vw, (min-width: 640px) 25vw, 34vw"
    )
  })

  it("asks for the width a photograph covers the box's height at, at most the screen's", () => {
    const shape = { phone: 1, tablet: 9 / 16, desktop: 3 / 4 }
    // 4:3 photograph: 53vw × 0.75 × 4/3 from 1024 px, 56.25vw × 4/3 on a tablet, capped on a phone
    expect(stripSizes(4, 53, STRIPS_LOOK_BEFORE, { shape, aspect: 4 / 3 })).toBe(
      "(min-width: 1024px) 53vw, (min-width: 640px) 75vw, 100vw"
    )
    // A slim photograph keeps the strips' shares; an unknown one too
    expect(stripSizes(4, 53, STRIPS_LOOK_BEFORE, { shape, aspect: 0.2 })).toBe(
      "(min-width: 1024px) 26vw, (min-width: 640px) 25vw, 34vw"
    )
    expect(stripSizes(4, 53, STRIPS_LOOK_BEFORE, { shape, aspect: null })).toBe(stripSizes(4, 53))
  })

  it("sizes each image by its own photograph when the box's shape is given", () => {
    const wide = { ...picture("genis"), width: 1600, height: 900 }
    const slim = { ...picture("ince"), width: 300, height: 900 }
    const html = renderToStaticMarkup(
      <Strips
        items={[wide, slim].map((image) => ({ key: image.src, image }))}
        look={STRIPS_LOOK_BEFORE}
        span={53}
        shape={{ phone: 1, tablet: 1, desktop: 3 / 4 }}
        className="aspect-square"
      />
    )
    expect(html).toContain('sizes="(min-width: 1024px) 71vw, 100vw"')
    expect(html).toContain('sizes="(min-width: 1024px) 39vw, 50vw"')
  })
})

/** Every rule written for `selector`, with the at-rules around it, in the built stylesheet. */
function rules(css: string, selector: string): { around: string[]; body: string }[] {
  const found: { around: string[]; body: string }[] = []
  let from = 0
  for (;;) {
    const at = css.indexOf(`${selector} {`, from)
    if (at < 0) return found
    from = at + selector.length
    if (!/\s/.test(css[at - 1] ?? "\n")) continue
    const around: string[] = []
    let head = 0
    for (let index = 0; index < at; index++) {
      const char = css[index]
      if (char === "{") {
        around.push(css.slice(head, index).trim())
        head = index + 1
      } else if (char === "}") {
        around.pop()
        head = index + 1
      } else if (char === ";") {
        head = index + 1
      }
    }
    const open = css.indexOf("{", at)
    found.push({ around, body: css.slice(open + 1, css.indexOf("}", open)).trim() })
  }
}

const HOVER = "@media (min-width: 64rem) and (hover: hover) and (pointer: fine)"
const WIDE = "@media (min-width: 64rem)"

describe("the strips' stylesheet", () => {
  it("widens a strip under a hovering pointer only from 1024 px, in one ease-out slide", async () => {
    const css = await buildAtolyeCss([])
    const [hover] = rules(css, ".gf-strip:hover")
    expect(hover?.around).toEqual(["@layer components", HOVER])
    expect(hover?.body).toContain("flex-grow: var(--strip-grow);")
    const moving = rules(css, ".gf-strip").find((rule) => rule.body.startsWith("transition"))
    expect(moving?.around).toEqual(["@layer components", WIDE])
    expect(moving?.body).toBe("transition: flex-grow var(--dur-long) var(--ease-out);")
  })

  it("widens the strip holding the keyboard's focus alike, and keeps its ring inside the clip", async () => {
    const css = await buildAtolyeCss([])
    const [focus] = rules(css, ".gf-strip:has(.gf-strip-cut:focus-visible)")
    expect(focus?.around).toEqual(["@layer components", WIDE])
    expect(focus?.body).toContain("flex-grow: var(--strip-grow);")
    expect(rules(css, ".gf-strip-cut:focus-visible")[0]?.body).toBe("outline: none;")
    const ring = rules(css, ".gf-strip-cut:focus-visible::after")[0]?.body
    expect(ring).toContain("inset: 4px calc(var(--strip-run) + 4px);")
    expect(ring).toContain("outline: 2px solid var(--color-focus);")
  })

  it("shows four strips on a tablet's width and three on a phone's, the last shown straight", async () => {
    const css = await buildAtolyeCss([])
    expect(rules(css, ".gf-strip:nth-child(n + 5)")[0]?.around).toEqual([
      "@layer components",
      "@media (max-width: 63.99rem)",
    ])
    const [phone] = rules(css, ".gf-strip:nth-child(n + 4)")
    expect(phone?.around).toEqual(["@layer components", "@media (max-width: 39.99rem)"])
    expect(phone?.body).toBe("display: none;")
    expect(rules(css, ".gf-strip:nth-child(3):not(:last-child) .gf-strip-cut")[0]?.body).toBe(
      "clip-path: polygon(var(--strip-run) 0, 100% 0, 100% 100%, 0 100%);"
    )
  })

  it("snaps at once under reduced motion", async () => {
    const css = await buildAtolyeCss([])
    const still = rules(css, ".gf-strip").find((rule) =>
      rule.around.includes("@media (prefers-reduced-motion: reduce)")
    )
    expect(still?.body).toBe("transition: none;")
  })

  it("slants every seam by one run, the outer edges and a lone strip straight", async () => {
    const css = await buildAtolyeCss([])
    expect(rules(css, ".gf-strip")[0]?.body).toContain("flex: 1 1 0;")
    expect(rules(css, ".gf-strip-cut")[0]?.body).toMatch(
      /clip-path: polygon\(\s*var\(--strip-run\) 0,/
    )
    expect(rules(css, ".gf-strip:first-child .gf-strip-cut")[0]?.body).toContain(
      "polygon(0 0, 100% 0,"
    )
    expect(rules(css, ".gf-strip:only-child .gf-strip-cut")[0]?.body).toBe("clip-path: none;")
    expect(rules(css, ".gf-strip + .gf-strip")[0]?.body).toBe("margin-left: var(--strip-step);")
  })

  it("keeps today's run and gap with no attribute: 8 px then 24 px from 1024 px, a 12 px line", async () => {
    const css = await buildAtolyeCss([])
    const [box] = rules(css, ".gf-strips")
    const wide = rules(css, ".gf-strips").find((rule) => rule.around.includes(WIDE))
    expect(box?.body).toContain("--strip-run: var(--space-xs);")
    expect(box?.body).toContain("--strip-line: var(--space-sm);")
    expect(box?.body).toContain("--strip-step: calc(var(--strip-line) - var(--strip-run));")
    expect(box?.body).toContain("container-type: size;")
    expect(wide?.around).toEqual(["@layer components", WIDE])
    expect(wide?.body).toContain("--strip-run: var(--space-lg);")
  })
})
