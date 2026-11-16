import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  StoreLayoutImage,
  StoreStripGalleryItem,
  StoreStripGallerySection,
} from "@qticaret/types"
import type { ImageView } from "@qticaret/ui"
import { stripGalleryView, stripItemView } from "../strip-gallery"
import type { SourceFacts } from "../strip-sources"
import { stripSources } from "../strip-sources"
import type * as StripSourcesModule from "../strip-sources"

vi.mock("server-only", () => ({}))
vi.mock("../strip-sources", async (importActual) => ({
  ...(await importActual<typeof StripSourcesModule>()),
  stripSources: vi.fn(),
}))
vi.mock("../layout", () => ({
  layoutImage: (image: StoreLayoutImage, fallback: string): ImageView => ({
    src: image.url,
    alt: image.alt ?? fallback,
    width: null,
    height: null,
    sources: { avif: null, webp: null },
  }),
  layoutLink: (link: { path: string | null; label: string | null } | null) =>
    link?.path ? { label: link.label ?? "", path: link.path } : null,
}))

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${Object.values(values).map(String).join(",")}` : key

const photo = (src: string, alt = ""): ImageView => ({
  src,
  alt,
  width: 800,
  height: 1000,
  sources: { avif: null, webp: null },
})

const own: StoreLayoutImage = {
  url: "/static/kendi.webp",
  alt: null,
  width: 1200,
  height: 1600,
  derivatives: null,
}

const facts = new Map<string, SourceFacts>([
  [
    "product:prod_1",
    { name: "Şef bıçağı", path: "/urun/sef", image: photo("/p1.webp", "Şef"), note: "1.250,00 TL" },
  ],
  [
    "category:pcat_1",
    { name: "Mutfak", path: "/mutfak", image: photo("/c1.webp"), note: "24 ürün" },
  ],
  ["brand:brand_1", { name: "Marka", path: "/marka", image: null, note: null }],
])

const item = (more: Partial<StoreStripGalleryItem> = {}): StoreStripGalleryItem => ({
  at: 0,
  source: { kind: "product", target: "prod_1" },
  image: null,
  title: null,
  note: null,
  link: null,
  ...more,
})

describe("a strip gallery's strip (adr/0049 Ek 2026-11-16)", () => {
  it("takes what the shop left empty from its source: picture, name, price, page", () => {
    expect(stripItemView(item(), facts, true, t)).toEqual({
      at: 0,
      // The name drawn over it names the link: the picture's own words would say it twice
      image: { ...photo("/p1.webp"), alt: "" },
      title: "Şef bıçağı",
      note: "1.250,00 TL",
      href: "/urun/sef",
    })
    expect(
      stripItemView(item({ source: { kind: "category", target: "pcat_1" } }), facts, true, t)
    ).toMatchObject({ title: "Mutfak", note: "24 ürün", href: "/mutfak" })
  })

  it("lets the shop's own words, picture and link stand over the source's", () => {
    const view = stripItemView(
      item({
        at: 3,
        image: { ...own, alt: "Atölyeden" },
        title: "Yeni sezon",
        note: "Elde bilenmiş",
        link: { label: "Kampanya", kind: "url", target: null, path: "/kampanyalar" },
      }),
      facts,
      true,
      t
    )
    expect(view).toEqual({
      at: 3,
      image: expect.objectContaining({ src: "/static/kendi.webp", alt: "Atölyeden" }) as unknown,
      title: "Yeni sezon",
      note: "Elde bilenmiş",
      href: "/kampanyalar",
    })
  })

  it("draws a custom strip from the shop's picture alone, a link only when given", () => {
    const custom = item({ source: { kind: "custom" }, image: own, title: "Hikâyemiz" })
    expect(stripItemView(custom, facts, true, t)).toMatchObject({
      title: "Hikâyemiz",
      note: null,
      href: null,
    })
  })

  it("leaves out a strip whose source has no live page here, or that has no picture", () => {
    expect(
      stripItemView(item({ source: { kind: "product", target: "prod_gone" } }), facts, true, t)
    ).toBeNull()
    expect(
      stripItemView(item({ source: { kind: "brand", target: "brand_1" } }), facts, true, t)
    ).toBeNull()
    // The shop's own picture brings it back
    expect(
      stripItemView(
        item({ source: { kind: "brand", target: "brand_1" }, image: own }),
        facts,
        true,
        t
      )
    ).toMatchObject({ title: "Marka", href: "/marka" })
  })

  it("drops the words with captions off, the picture then named by them for a screen reader", () => {
    expect(stripItemView(item({ title: "Kendi adı" }), facts, false, t)).toMatchObject({
      title: null,
      note: null,
      image: { alt: "Şef" },
    })
    const unnamed = new Map([
      [
        "product:prod_1",
        { name: "Şef bıçağı", path: "/urun/sef", image: photo("/p1.webp"), note: "1.250,00 TL" },
      ],
    ])
    expect(stripItemView(item(), unnamed, false, t)?.image.alt).toBe("Şef bıçağı")
  })
})

describe("the strip gallery's view", () => {
  const section = (items: StoreStripGalleryItem[]): StoreStripGallerySection => ({
    id: "serit01",
    type: "strip_gallery",
    title: "Öne çıkanlar",
    text: null,
    items,
  })

  beforeEach(() => {
    vi.mocked(stripSources).mockResolvedValue(facts)
  })

  it("asks for the named sources only and reads the settings forgivingly", async () => {
    const view = await stripGalleryView(
      {
        ...section([
          item(),
          item({ at: 1, source: { kind: "custom" }, image: own }),
          item({ at: 2, source: { kind: "category", target: "pcat_1" } }),
        ]),
        height: "tall" as never,
        captions: "off",
      },
      t
    )
    expect(stripSources).toHaveBeenCalledWith(
      [
        { kind: "product", target: "prod_1" },
        { kind: "category", target: "pcat_1" },
      ],
      t
    )
    expect(view).toMatchObject({
      id: "serit01",
      type: "strip_gallery",
      title: "Öne çıkanlar",
      width: "full",
      height: "medium",
      captions: "off",
      strips_slant: "medium",
      strips_line: "thin",
      strips_overlap: "off",
      strips_dim: "on",
    })
    expect(view?.items.map((each) => each.at)).toEqual([0, 1, 2])
  })

  it("keeps each strip's saved place when one before it is left out", async () => {
    const view = await stripGalleryView(
      section([item({ source: { kind: "product", target: "prod_gone" } }), item({ at: 1 })]),
      t
    )
    expect(view?.items.map((each) => each.at)).toEqual([1])
  })

  it("is left out when no strip is left", async () => {
    vi.mocked(stripSources).mockResolvedValue(new Map())
    expect(await stripGalleryView(section([item(), item({ at: 1 })]), t)).toBeNull()
  })
})
