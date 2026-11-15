import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { SLIDER_DEFAULTS } from "@qticaret/types/section-scroller"
import type { HeroSlideView, HomeSectionView, ImageView } from "@qticaret/ui"
import { fieldKey, fieldMark } from "@qticaret/ui"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The editor's field marks in Atölye (adr/0065 §9, Faz 2b): with a view
 * that says it is drawn in the theme editor's live preview (`editor`), the
 * opening's words, buttons and picture, the slides' and the sections'
 * titles carry `data-qf="<the design's path>"`, and the announcement bar
 * its section mark and its lines theirs. Without it nothing is printed:
 * a live page's HTML (and the preset lock's) is as it was.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1600,
  height: 900,
  sources: { avif: null, webp: null },
})

type Hero = Extract<HomeSectionView, { type: "hero" }>

const hero = (over: Partial<Hero> = {}): HomeSectionView => ({
  id: "giris1",
  type: "hero",
  eyebrow: "Yeni sezon",
  heading: "Bıçak, çakı ve kamp aletleri",
  intro: "Her modelin çeliği yazılı.",
  actions: [{ label: "Tüm ürünler", path: "/magaza" }],
  image: picture("acilis"),
  ...over,
})

const catalog = (slides?: NonNullable<Hero["catalog"]>["slides"]): Partial<Hero> => ({
  variant: "category_list",
  catalog: {
    list: [],
    all: { label: "Tüm kategoriler", path: "/kategoriler" },
    tiles: [],
    chips: [],
    picks: [],
    from: null,
    ...(slides ? { slides, slider: { settings: SLIDER_DEFAULTS, interval: 6 } } : {}),
  },
})

const slide = (name: string): HeroSlideView => ({
  image: picture(name),
  mobileImage: null,
  heading: `${name} başlığı`,
  text: `${name} satırı`,
  link: { label: "Göz atın", path: "/magaza" },
  position: "left",
  tone: "light",
})

const slider = (editor: boolean): HomeSectionView => ({
  id: "kayan1",
  type: "hero_slider",
  slides: [slide("bir"), slide("iki")],
  height: "regular",
  settings: SLIDER_DEFAULTS,
  interval: 6,
  ...(editor ? { editor: true as const } : {}),
})

const brands = (editor: boolean): HomeSectionView => ({
  id: "marka1",
  type: "brands",
  title: "Markalar",
  brands: [{ label: "Victorinox", path: "/marka/victorinox" }],
  ...(editor ? { editor: true as const } : {}),
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const marks = (html: string) => [...html.matchAll(/data-qf="([^"]*)"/g)].map((match) => match[1])

describe("the field mark", () => {
  it("is printed only in the editor's preview", () => {
    expect(fieldMark(true, "heading")).toEqual({ "data-qf": "heading" })
    expect(fieldMark(undefined, "heading")).toEqual({})
    expect(fieldMark(false, "heading")).toEqual({})
    expect(fieldKey("slides", 2, "heading")).toBe("slides.2.heading")
  })
})

describe("the field marks in Atölye", () => {
  it("print nothing on a live page", () => {
    const html = home([hero(), hero({ id: "giris2", ...catalog() }), slider(false), brands(false)])
    expect(html).not.toContain("data-qf")
  })

  it("mark the opening's heading, line, button and picture", () => {
    const html = home([{ ...hero(), editor: true }])
    expect(marks(html)).toEqual(["image", "heading", "text", "links.0"])
    expect(html).toMatch(/<h1 id="[^"]*" data-qf="heading"[^>]*>Bıçak, çakı ve kamp aletleri<\/h1>/)
  })

  it("mark a button by its place in the design when a broken one before it was left out", () => {
    const html = home([{ ...hero({ actionsAt: [1] }), editor: true }])
    expect(marks(html)).toEqual(["image", "heading", "text", "links.1"])
    const slides = home([
      {
        ...hero(
          catalog([
            {
              heading: "Bir",
              intro: null,
              actions: [{ label: "İkinci", path: "/b" }],
              actionsAt: [1],
              image: null,
              link: null,
            },
          ])
        ),
        editor: true,
      },
    ])
    expect(marks(slides)).toContain("slides.0.links.1")
    expect(marks(slides)).not.toContain("slides.0.links.0")
  })

  it("mark a catalogue opening saved before slides with its own fields", () => {
    const html = home([{ ...hero(catalog()), editor: true }])
    expect(marks(html)).toEqual(["eyebrow", "heading", "text", "links.0", "image"])
  })

  it("mark a catalogue opening's slides by their place in the design", () => {
    const html = home([
      {
        ...hero(
          catalog([
            { heading: "Birinci", intro: null, actions: [], image: null, link: null },
            // The design's third: its second was left out of the drawing
            { heading: "Üçüncü", intro: "Satır", actions: [], image: null, link: null, at: 2 },
          ])
        ),
        editor: true,
      },
    ])
    expect(marks(html)).toContain("slides.0.heading")
    expect(marks(html)).toContain("slides.2.heading")
    expect(marks(html)).toContain("slides.2.text")
    expect(marks(html)).not.toContain("slides.1.heading")
  })

  it("mark each slide of the sliding opening", () => {
    const found = marks(home([slider(true)]))
    for (const at of [0, 1]) {
      for (const part of ["image", "heading", "text", "link"]) {
        expect(found).toContain(`slides.${String(at)}.${part}`)
      }
    }
  })

  it("mark a section's title through the shared head", () => {
    const html = home([brands(true)])
    expect(html).toMatch(/<h2 id="[^"]*" data-qf="title">Markalar<\/h2>/)
  })

  it("mark the announcement bar and its lines in the preview, by their place in the design", () => {
    const lines = ["", "Kargo bedava", "Aynı gün kargo"]
    const live = renderFrame(atolyeTheme, shopFixture({ announcements: lines }))
    expect(live).not.toContain("data-qf")
    expect(live).not.toContain('data-qs="duyuru01"')
    const preview = renderFrame(
      atolyeTheme,
      shopFixture({
        announcements: lines,
        announcementSettings: { mode: "inline" } as never,
        announcementMark: "duyuru01",
      })
    )
    expect(preview).toContain('data-qs="duyuru01"')
    expect(marks(preview)).toEqual(["lines.1", "lines.2"])
  })
})
