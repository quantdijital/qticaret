import path from "node:path"
import { imagesOf, linksOf, recordsOf } from "../../../workflows/storefront/layout-check"
import { hydrateHero } from "../../../workflows/storefront/layout-hydrate-catalog"
import { layoutDocument, readStoredLayout } from "../layout"
import { HERO_FULL_DEFAULTS, HERO_FULL_LIMITS, HERO_FULL_SETTINGS } from "../sections/hero-full"
import type { HeroFullSetting } from "../sections/hero-full"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-hero-full.ts"
)

// Every body section shows on every screen unless the shop picks one (bilesen-standardi §2)
const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const IMAGE = { url: "http://localhost:9000/static/vadi.webp", alt: "Vadi" }
const SHOP = { kind: "system", target: "shop", label: null }
const hero = (more: Record<string, unknown> = {}) => ({ id: "kapak00001", type: "hero", ...more })
const full = (more: Record<string, unknown> = {}) => hero({ variant: "full_image", ...more })
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

const parsed = (more: Record<string, unknown> = {}) => {
  const section = layoutDocument.parse({ home: [full(more)] }).home[0]
  if (section?.type !== "hero") {
    throw new Error("no hero")
  }
  return section
}

const readers = {
  fill: (text: string | null) => (text === null ? null : text.replace("{telefon}", "Rota")),
  link: () => ({ label: "Tümü", kind: "system" as const, target: "shop", path: null }),
  image: (url: string, alt: string | null) => ({
    url,
    alt,
    width: 1600,
    height: 900,
    derivatives: null,
  }),
}

describe("the opening's full image (adr/0077 §9)", () => {
  it("mirrors the contract's settings, defaults and limits", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)

    expect(HERO_FULL_SETTINGS).toEqual(contract["HERO_FULL_SETTINGS"])
    expect(HERO_FULL_DEFAULTS).toEqual(contract["HERO_FULL_DEFAULTS"])
    expect(HERO_FULL_LIMITS).toEqual(contract["HERO_FULL_LIMITS"])
  })

  it("names each setting's default first on its list", () => {
    for (const name of Object.keys(HERO_FULL_SETTINGS) as HeroFullSetting[]) {
      expect(HERO_FULL_DEFAULTS[name]).toBe(HERO_FULL_SETTINGS[name][0])
    }
  })

  it("fills a section switched to it with the defaults, the common fields as every opening's", () => {
    expect(parsed()).toEqual({
      ...full(),
      ...ALWAYS,
      eyebrow: null,
      heading: null,
      text: null,
      links: [],
      image: null,
      title_accent: null,
      ...HERO_FULL_DEFAULTS,
      show_trust: false,
    })
  })

  it("takes every listed step, a second heading line, two buttons and the badges' switch", () => {
    const section = parsed({
      heading: "Doğayı keşfet",
      title_accent: "Kaçışını bul",
      links: [SHOP, { ...SHOP, label: "Hikâyemiz" }],
      image: IMAGE,
      action: "search",
      search_position: "overlap",
      height: "tall",
      scrim: "strong",
      align: "start",
      image_side: "end",
      edge: "wave",
      show_trust: true,
    })

    expect(section).toMatchObject({
      variant: "full_image",
      title_accent: "Kaçışını bul",
      action: "search",
      search_position: "overlap",
      height: "tall",
      scrim: "strong",
      align: "start",
      image_side: "end",
      edge: "wave",
      show_trust: true,
    })
    expect(section.links).toHaveLength(2)
  })

  it.each(Object.keys(HERO_FULL_SETTINGS))("refuses a %s off its list", (name) => {
    expect(issues({ home: [full({ [name]: "nope" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("refuses its fields on the other variants, a third button and an accent too long", () => {
    expect(issues({ home: [hero({ title_accent: "Kaçışını bul" })] })).not.toEqual([])
    expect(issues({ home: [hero({ variant: "category_list", action: "search" })] })).not.toEqual([])
    expect(issues({ home: [full({ links: [SHOP, SHOP, SHOP] })] })).not.toEqual([])
    expect(
      issues({ home: [full({ title_accent: "a".repeat(HERO_FULL_LIMITS.title_accent + 1) })] })
    ).not.toEqual([])
    expect(issues({ home: [full({ show_trust: "on" })] })).not.toEqual([])
    expect(issues({ home: [full({ list: { kind: "top" } })] })).not.toEqual([])
  })

  it("leaves the openings saved before it reading as they did", () => {
    const stored = {
      home: [hero({ heading: "Yeni sezon" }), hero({ id: "kapak00002", variant: "category_list" })],
    }

    const doc = readStoredLayout(stored)

    expect(doc.home[0]).toMatchObject({ variant: "standard", heading: "Yeni sezon" })
    expect(doc.home[0]).not.toHaveProperty("action")
    expect(doc.home[1]).toMatchObject({ variant: "category_list", list: { kind: "top" } })
    expect(doc.home[1]).not.toHaveProperty("title_accent")
  })

  it("reads a stored one with a step off its list's variant as the default opening, its own fields dropped", () => {
    const doc = readStoredLayout({
      home: [full({ ...ALWAYS, variant: "bento", heading: "Yeni", action: "search" })],
    })

    expect(doc.home[0]).toMatchObject({ variant: "standard", heading: "Yeni" })
    expect(doc.home[0]).not.toHaveProperty("action")
  })

  it("checks its picture and its buttons, and names no record", () => {
    const section = parsed({ image: IMAGE, links: [SHOP, SHOP] })

    expect(imagesOf(section)).toEqual([IMAGE.url])
    expect(linksOf(section)).toHaveLength(2)
    expect(recordsOf(section)).toEqual([])
  })

  it("prints its variant, its settings and its accent line filled, the picture sized", () => {
    const shown = hydrateHero(
      parsed({ image: IMAGE, title_accent: "{telefon} ile", action: "search", show_trust: true }),
      readers
    )

    expect(shown).toEqual({
      id: "kapak00001",
      type: "hero",
      eyebrow: null,
      heading: null,
      text: null,
      links: [],
      image: { url: IMAGE.url, alt: "Vadi", width: 1600, height: 900, derivatives: null },
      variant: "full_image",
      title_accent: "Rota ile",
      ...HERO_FULL_DEFAULTS,
      action: "search",
      show_trust: true,
    })
  })

  it("prints today's opening as before: no variant, none of the new fields", () => {
    const plain = layoutDocument.parse({ home: [hero({ heading: "Yeni" })] }).home[0]
    if (plain?.type !== "hero") {
      throw new Error("no hero")
    }

    const shown = hydrateHero(plain, readers)

    expect(Object.keys(shown).sort()).toEqual(
      ["eyebrow", "heading", "id", "image", "links", "text", "type"].sort()
    )
  })
})
