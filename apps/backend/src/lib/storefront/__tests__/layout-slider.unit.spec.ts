import { layoutDocument } from "../layout"
import { sliderImages } from "../layout-slider"

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const picture = (name: string) => ({ url: `http://localhost:9000/static/${name}.webp`, alt: null })
const slide = (name: string, more: Record<string, unknown> = {}) => ({
  image: picture(name),
  ...more,
})
const slider = (more: Record<string, unknown> = {}) => ({
  id: "kayan0001",
  type: "hero_slider",
  slides: [slide("bir"), slide("iki")],
  ...more,
})
const parses = (doc: Record<string, unknown>) => layoutDocument.safeParse(doc).success

describe("the home page's hero slider (adr/0049 Ek 2026-11-06)", () => {
  it("fills its options: still, regular height, dots and arrows, 6 s once it plays", () => {
    const [read] = layoutDocument.parse({ home: [slider()] }).home
    expect(read).toEqual({
      id: "kayan0001",
      type: "hero_slider",
      ...ALWAYS,
      slides: ["bir", "iki"].map((name) => ({
        image: picture(name),
        mobile_image: null,
        heading: null,
        text: null,
        link: null,
        position: "left",
        tone: "light",
      })),
      height: "regular",
      autoplay: false,
      interval: 6,
      dots: true,
      arrows: true,
    })
  })

  it("takes a slide's phone picture, words, one action, place and tone", () => {
    const own = slide("bir", {
      mobile_image: { url: "/static/bir-dar.webp", alt: "Yakın çekim" },
      heading: "{mağaza_adı} atölyesinden",
      text: "Elde bilenmiş ağızlar.",
      link: { kind: "system", target: "shop", label: "Ürünlere göz atın" },
      position: "right",
      tone: "dark",
    })
    const doc = layoutDocument.parse({
      home: [
        slider({ slides: [own, slide("iki")], height: "compact", autoplay: true, interval: 10 }),
      ],
    })
    expect(doc.home[0]).toMatchObject({ height: "compact", autoplay: true, interval: 10 })
    expect(sliderImages(doc.home[0] as never)).toEqual([
      picture("bir").url,
      "/static/bir-dar.webp",
      picture("iki").url,
    ])
  })

  it("holds two to six slides", () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => slide(`gorsel${String(index)}`))
    expect(parses({ home: [slider({ slides: many(1) })] })).toBe(false)
    expect(parses({ home: [slider({ slides: many(2) })] })).toBe(true)
    expect(parses({ home: [slider({ slides: many(6) })] })).toBe(true)
    expect(parses({ home: [slider({ slides: many(7) })] })).toBe(false)
  })

  it("refuses an interval outside 5–10 s, an unknown place, tone or height, and extra fields", () => {
    for (const wrong of [
      { interval: 4 },
      { interval: 11 },
      { interval: 6.5 },
      { height: "tall" },
      { eyebrow: "Yeni" },
      { slides: [slide("bir", { position: "top" }), slide("iki")] },
      { slides: [slide("bir", { tone: "red" }), slide("iki")] },
      { slides: [slide("bir", { links: [] }), slide("iki")] },
      { slides: [{ image: { url: "//evil.example/x.png", alt: null } }, slide("iki")] },
      {
        slides: [
          slide("bir", { mobile_image: { url: "javascript:alert(1)", alt: null } }),
          slide("iki"),
        ],
      },
      { slides: [slide("bir", { heading: "{bilinmeyen}" }), slide("iki")] },
    ]) {
      expect(parses({ home: [slider(wrong)] })).toBe(false)
    }
  })

  it("is the home page's only", () => {
    expect(parses({ product: [slider()] })).toBe(false)
    expect(parses({ category: [{ ...slider(), placement: "top" }] })).toBe(false)
  })

  it("stands beside the still hero", () => {
    const hero = { id: "giris01", type: "hero" }
    expect(layoutDocument.parse({ home: [slider(), hero] }).home.map((each) => each.type)).toEqual([
      "hero_slider",
      "hero",
    ])
  })
})
