import { layoutDocument } from "../layout"

// Every body section shows on every screen unless the shop picks one (bilesen-standardi §2)
const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const badge = (more: Record<string, unknown> = {}) => ({
  id: "puan00001",
  type: "google_rating",
  ...more,
})
const parses = (doc: Record<string, unknown>) => layoutDocument.safeParse(doc).success

describe("the home page's Google rating badge (adr/0058 Ek 2026-11-06)", () => {
  it("fills its options: the storefront's title, no excerpts, the link to Google on", () => {
    const [read] = layoutDocument.parse({ home: [badge()] }).home
    expect(read).toEqual({
      id: "puan00001",
      type: "google_rating",
      ...ALWAYS,
      title: null,
      excerpts: 0,
      profile_link: true,
    })
  })

  it("takes its own title, zero to three excerpts and the link to Google off", () => {
    const [read] = layoutDocument.parse({
      home: [badge({ title: "Google'da {mağaza_adı}", excerpts: 3, profile_link: false })],
    }).home
    expect(read).toMatchObject({
      title: "Google'da {mağaza_adı}",
      excerpts: 3,
      profile_link: false,
    })
    for (const excerpts of [0, 1, 2, 3]) {
      expect(parses({ home: [badge({ excerpts })] })).toBe(true)
    }
  })

  it("refuses more than three excerpts, a part count, a minimum of its own and extra fields", () => {
    for (const wrong of [
      { excerpts: 4 },
      { excerpts: -1 },
      { excerpts: 1.5 },
      { excerpts: "2" },
      { min_rating: 3 },
      { reviews: [] },
      { rating: 5 },
      { profile_link: "evet" },
      { title: "x".repeat(61) },
    ]) {
      expect(parses({ home: [badge(wrong)] })).toBe(false)
    }
  })

  it("is the home page's only", () => {
    expect(parses({ product: [badge()] })).toBe(false)
    expect(parses({ category: [{ ...badge(), placement: "top" }] })).toBe(false)
  })
})
