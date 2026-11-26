import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { HERO_FULL_DEFAULTS } from "@qticaret/types/section-hero-full"
import type {
  BannerSectionView,
  HandNoteView,
  HeroFullView,
  HomeSectionView,
  ImageView,
  PlaceOrderResult,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The hand note (sahip 2026-11-24, "el yazısı not") in Atölye: over the
 * full image opening's heading and the split band's, in the accent face
 * when the shop chose one, else italic in the theme's own; with none the
 * section draws exactly as before it.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1600,
  height: 900,
  sources: { avif: null, webp: null },
})

const full = (parts: Partial<HeroFullView> = {}): HeroFullView => ({
  settings: { ...HERO_FULL_DEFAULTS },
  accent: null,
  search: null,
  trust: [],
  video: null,
  ...parts,
})

const cover = (view: HeroFullView): HomeSectionView => ({
  id: "kapak",
  type: "hero",
  eyebrow: "Dünyayı keşfet",
  heading: "Doğayı keşfet.",
  intro: "Nefes kesen yerler.",
  actions: [{ label: "Hemen keşfet", path: "/magaza" }],
  image: picture("vadi"),
  variant: "full_image",
  full: view,
})

const band = (over: Partial<BannerSectionView> = {}): HomeSectionView => ({
  id: "kampanya",
  type: "banner",
  slides: [
    {
      image: picture("vadi"),
      mobileImage: null,
      heading: "Sıradaki maceranız",
      text: "Esnek rezervasyon",
      link: { label: "Paketleri gör", path: "/turlar" },
      secondLink: null,
      tone: "light",
    },
  ],
  width: "boxed",
  height: "medium",
  text_position: "bottom_left",
  overlay: "medium",
  button_style: "solid",
  ...over,
})

const draw = (section: HomeSectionView) =>
  renderPage(atolyeTheme, "HomePage", {
    view: { sections: [section] },
    subscribe: (): Promise<PlaceOrderResult> =>
      Promise.resolve({ ok: true, error: null, challenge: null }),
  })

const HAND: HandNoteView = { text: "Sizi bekliyoruz!", hand: true }
const PLAIN: HandNoteView = { text: "Sizi bekliyoruz!", hand: false }

/** The note's paragraph: its tag and its words. */
const noteOf = (html: string) => /<p[^>]*-rotate-2[^>]*>([^<]*)<\/p>/.exec(html)

describe("the full image opening's hand note", () => {
  it("draws the opening as before when it has none", () => {
    const before = draw(cover(full()))
    expect(draw(cover(full({ note: null })))).toBe(before)
    expect(before).not.toContain("-rotate-2")
    expect(before).not.toContain("--font-accent")
  })

  it("draws it over the heading in the accent face when the shop chose one", () => {
    const html = draw(cover(full({ note: HAND })))
    const note = noteOf(html)

    expect(note?.[1]).toBe("Sizi bekliyoruz!")
    expect(note?.[0]).toContain("font-(family-name:--font-accent)")
    expect(note?.[0]).toContain("data-hand")
    expect(note?.[0]).not.toContain("italic")
    // Over the heading, after the upper line: real text a screen reader reads in order
    expect(html.indexOf("Dünyayı keşfet")).toBeLessThan(html.indexOf("Sizi bekliyoruz!"))
    expect(html.indexOf("Sizi bekliyoruz!")).toBeLessThan(html.indexOf("<h1"))
    expect(note?.[0]).not.toContain("aria-hidden")
    // The heading's ink on the stage
    expect(note?.[0]).toContain("text-stage-text")
  })

  it("draws it italic in the theme's own face when the shop chose none", () => {
    const note = noteOf(draw(cover(full({ note: PLAIN }))))

    expect(note?.[1]).toBe("Sizi bekliyoruz!")
    expect(note?.[0]).toContain("italic")
    expect(note?.[0]).not.toContain("--font-accent")
    expect(note?.[0]).not.toContain("data-hand")
  })

  it("takes the page's ink beside the photograph", () => {
    const view = full({ note: HAND, settings: { ...HERO_FULL_DEFAULTS, image_side: "end" } })
    expect(noteOf(draw(cover(view)))?.[0]).toMatch(/ text-text( |")/)
  })
})

describe("the split band's hand note", () => {
  it("draws the band as before when it has none", () => {
    const before = draw(band({ variant: "split", eyebrow: "Özel fırsat" }))
    expect(draw(band({ variant: "split", eyebrow: "Özel fırsat", note: null }))).toBe(before)
    expect(before).not.toContain("-rotate-2")
  })

  it("draws it over the panel's heading, in the face the shop chose or italic", () => {
    const hand = draw(band({ variant: "split", note: HAND }))
    expect(noteOf(hand)?.[0]).toContain("font-(family-name:--font-accent)")
    expect(hand.indexOf("Sizi bekliyoruz!")).toBeLessThan(hand.indexOf("Sıradaki maceranız"))

    expect(noteOf(draw(band({ variant: "split", note: PLAIN })))?.[0]).toContain("italic")
  })

  it("draws none on today's band, which has no one heading", () => {
    expect(draw(band({ note: HAND }))).toBe(draw(band()))
  })
})

describe("the accent face's reach", () => {
  const themeSource = fileURLToPath(
    new URL("../../../../../packages/themes/atolye/src", import.meta.url)
  )
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]
    )

  // The footer's text block in its hand style (adr/0070, `style: hand`) is the one other reader
  it("is read by the hand note and the footer's hand text alone: no other text can fetch the face", () => {
    const readers = files(themeSource).filter((path) =>
      readFileSync(path, "utf8").includes("--font-accent")
    )
    expect(readers.map((path) => path.slice(themeSource.length + 1)).sort()).toEqual([
      "frame/footer-blocks/TextBlock.tsx",
      "parts/HandNote.tsx",
    ])
  })
})
