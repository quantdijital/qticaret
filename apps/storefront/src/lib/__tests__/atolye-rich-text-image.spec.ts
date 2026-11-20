import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { richTextOffPages } from "@qticaret/types/section-rich-text"
import { SECTION_VARIANTS } from "@qticaret/types/section-variants"
import type { HomeSectionView, ImageView, PlaceOrderResult } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The rich text's "Görselli metin" (adr/0073 §3) in Atölye: the pane's
 * shadowed surface, the shop's picture on one side (5/12) and the heading
 * and text on the other (7/12) from 1024 px, the picture on top on a
 * phone; lazy, its alt as given, its box held before it loads. The pane
 * draws as it did before variants.
 */

const PHOTO: ImageView = {
  src: "/media/atolye.jpg",
  alt: "Atölyede bıçak bileme",
  width: 1600,
  height: 1200,
  sources: { avif: null, webp: null },
}

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", {
    view: { sections },
    subscribe: (): Promise<PlaceOrderResult> =>
      Promise.resolve({ ok: true, error: null, challenge: null }),
  })

const story = (more: Partial<Extract<HomeSectionView, { type: "rich_text" }>> = {}) =>
  ({
    id: "hikaye",
    type: "rich_text",
    title: "Hakkımızda",
    html: "<p>Atölyemizden.</p>",
    ...more,
  }) as HomeSectionView

/** The section's own markup, from its region to its end. */
const sectionOf = (html: string) => {
  const start = html.indexOf('aria-labelledby="bolum-hikaye"')
  return html.slice(start, html.indexOf("</section>", start))
}

describe("the rich text's picture variant (adr/0073 §3)", () => {
  it("puts the picture first, the heading and text beside it on the same pane", () => {
    const html = sectionOf(home([story({ variant: "with_image", image: PHOTO })]))

    expect(html).toContain("rounded-tile gf-pane lg:grid-cols-12")
    expect(html).toContain("lg:col-span-5")
    expect(html).toContain("lg:col-span-7")
    // On a phone the picture is on top: it comes first, and stays first by default
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf(">Hakkımızda</h2>"))
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("<p>Atölyemizden.</p>"))
    expect(html).not.toContain("lg:order-last")
  })

  it("moves the picture to the far side from 1024 px when set to end, still on top on a phone", () => {
    const html = sectionOf(home([story({ variant: "with_image", image: PHOTO, imageSide: "end" })]))

    expect(html).toMatch(/class="[^"]*lg:col-span-5[^"]*lg:order-last/)
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf(">Hakkımızda</h2>"))
  })

  it("loads the picture lazily with its alt, its box held before it loads", () => {
    const html = sectionOf(home([story({ variant: "with_image", image: PHOTO })]))

    expect(html).toMatch(/<img[^>]*alt="Atölyede bıçak bileme"/)
    expect(html).toMatch(/<img[^>]*loading="lazy"/)
    expect(html).toMatch(/<img[^>]*width="1600"[^>]*height="1200"/)
    expect(html).toContain("aspect-[4/3]")
  })

  it("marks the picture, the title and the text for the editor only", () => {
    const marked = sectionOf(home([story({ variant: "with_image", image: PHOTO, editor: true })]))
    expect(marked).toMatch(/<img[^>]*data-qf="image"/)
    expect(marked).toContain('data-qf="title"')
    expect(marked).toContain('data-qf="body"')
    expect(sectionOf(home([story({ variant: "with_image", image: PHOTO })]))).not.toContain(
      "data-qf"
    )
  })

  it("draws the pane as before when the variant has no picture, or is the pane", () => {
    const pane = sectionOf(home([story()]))
    expect(sectionOf(home([story({ variant: "with_image", image: null })]))).toBe(pane)
    expect(pane).not.toContain("<img")
    expect(pane).toContain(
      "grid gap-6 rounded-tile gf-pane p-6 sm:p-10 lg:grid-cols-12 lg:gap-(--gap-columns) lg:p-16"
    )
  })

  it("draws each variant on the contract's list its own way", () => {
    // `article` is a content page's own text, drawn by the page (`atolye-content-page-text.spec.ts`)
    const variants = SECTION_VARIANTS.rich_text.filter(
      (variant): variant is Exclude<typeof variant, "article"> => richTextOffPages(variant)
    )
    const drawn = variants.map((variant) => sectionOf(home([story({ variant, image: PHOTO })])))
    expect(new Set(drawn).size).toBe(variants.length)
  })
})
