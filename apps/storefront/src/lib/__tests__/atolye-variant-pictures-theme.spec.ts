import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { ImageView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { Gallery } from "../../../../../packages/themes/atolye/src/product/Gallery"
import {
  pictureOrder,
  pressedAgain,
} from "../../../../../packages/themes/atolye/src/product/variant-pictures"
import { galleryWords } from "../../../../../packages/themes/atolye/src/product/words"

/**
 * The Grafit gallery follows the variant chosen (owner 2026-11-05):
 * its own pictures first, the ones tied to no variant after them, the
 * other variants' stepping aside; one with none of its own keeps what
 * shows. `?variant=` opens on its pictures, in the first HTML.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.webp`,
  alt: name,
  width: 1000,
  height: 1000,
  sources: { avif: null, webp: null },
})

// The set, the red one's, the green one's, a close-up
const images = ["set", "kirmizi", "yesil", "yakin"].map(picture)
const own = { variant_kirmizi: [1], variant_yesil: [2] }

describe("pictureOrder", () => {
  it("shows every picture in the product's order while no variant with pictures is chosen", () => {
    expect(pictureOrder(4, own, null)).toEqual([0, 1, 2, 3])
    expect(pictureOrder(4, own, "variant_mavi")).toEqual([0, 1, 2, 3])
  })

  it("brings the chosen variant's own first and keeps the shared ones after, the others' left out", () => {
    expect(pictureOrder(4, own, "variant_yesil")).toEqual([2, 0, 3])
    expect(pictureOrder(4, own, "variant_kirmizi")).toEqual([1, 0, 3])
  })

  it("ignores a place past the pictures", () => {
    expect(pictureOrder(2, { variant_x: [5] }, "variant_x")).toEqual([0, 1])
  })
})

describe("the gallery's first HTML", () => {
  const render = (openOn: string | null) =>
    renderToStaticMarkup(
      createElement(Gallery, { images, own, openOn, initial: "R", words: galleryWords(t) })
    )

  it("opens on the product's order without a variant asked for", () => {
    const html = render(null)
    const order = [...html.matchAll(/<li[^>]*id="gorsel-\d+"[\s\S]*?src="\/media\/(\w+)\.webp"/g)]
    expect(order.map((match) => match[1])).toEqual(["set", "kirmizi", "yesil", "yakin"])
    expect(html).toContain("1 / 4")
  })

  it("opens on the asked variant's own picture first, eager, the counter counting its set", () => {
    const html = render("variant_yesil")
    const order = [...html.matchAll(/<li[^>]*id="gorsel-\d+"[\s\S]*?src="\/media\/(\w+)\.webp"/g)]
    expect(order.map((match) => match[1])).toEqual(["yesil", "set", "yakin"])
    expect(html).toContain("1 / 3")
    expect(html.match(/fetchPriority="high"/g)).toHaveLength(1)
    expect(html.indexOf('fetchPriority="high"')).toBeLessThan(html.indexOf("/media/set.webp"))
  })
})

describe("pressedAgain", () => {
  it("is true only for an option's radio on the value already chosen", () => {
    const radio = (name: string, value: string) => ({ name, value }) as unknown as EventTarget
    const chosen = { opt_renk: "Kırmızı" }
    expect(pressedAgain(radio("option_opt_renk", "Kırmızı"), chosen)).toBe(true)
    expect(pressedAgain(radio("option_opt_renk", "Yeşil"), chosen)).toBe(false)
    expect(pressedAgain(radio("addon_gravur", "Kırmızı"), chosen)).toBe(false)
  })
})
