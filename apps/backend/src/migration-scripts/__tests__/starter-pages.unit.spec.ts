import { sectorPack } from "@qticaret/sector-packs"
import type { ContentDoc } from "../../lib/content"
import { faqRowsOf } from "../../lib/storefront/faq-text"
import { planStarterPages, roleHandles, startersFor } from "../../lib/storefront/starter-pages"
import type { StarterFacts, StarterPage } from "../../lib/storefront/starter-pages"
import { openStarterPages } from "../starter-pages"
import type { StarterPagesPorts } from "../starter-pages"

const doc = { type: "doc", content: [] }
const STARTERS: StarterPage[] = [
  { handle: "hakkimizda", title: "Hakkımızda", body: doc },
  { handle: "iletisim", title: "İletişim", body: doc },
  { handle: "sik-sorulan-sorular", title: "Sık Sorulan Sorular", body: doc },
  { handle: "odeme-secenekleri", title: "Ödeme Seçenekleri", body: doc },
  { handle: "kargo-ve-teslimat", title: "Kargo ve Teslimat", body: doc },
]
const NO_ROLES = { contact: null, payment: null, shipping: null }

function ports(facts: StarterFacts, taken: readonly string[] = []) {
  const opened: string[] = []
  const fake = {
    starters: async () => Promise.resolve(STARTERS),
    facts: jest.fn(async () => Promise.resolve(facts)),
    open: jest.fn(async (page: StarterPage) => {
      if (taken.includes(page.handle)) {
        return Promise.resolve(null)
      }
      opened.push(page.handle)
      return Promise.resolve(`cnt_${page.handle.replace(/-/g, "")}`)
    }),
  } satisfies StarterPagesPorts
  return { fake, opened }
}

describe("starter pages (adr/0073 Ek 2026-11-28 migration script)", () => {
  it("opens every starter page a shop lacks as a draft", async () => {
    const { fake, opened } = ports({ pages: new Set(), roles: NO_ROLES })

    expect(await openStarterPages(fake)).toEqual({ opened: 5, kept: 0, role_held: 0, taken: 0 })
    expect(opened).toEqual(STARTERS.map((page) => page.handle))
  })

  it("keeps the shop's own pages and is harmless run again", async () => {
    const all = new Set(STARTERS.map((page) => page.handle))
    const { fake } = ports({
      pages: all,
      roles: { contact: "iletisim", payment: "odeme-secenekleri", shipping: "kargo-ve-teslimat" },
    })

    expect(await openStarterPages(fake)).toEqual({ opened: 0, kept: 5, role_held: 0, taken: 0 })
    expect(fake.open).not.toHaveBeenCalled()
  })

  it("leaves a role's starter when the role names another page, and counts a taken address", async () => {
    const { fake, opened } = ports(
      { pages: new Set(["hakkimizda"]), roles: { ...NO_ROLES, contact: "bize-ulasin" } },
      ["kargo-ve-teslimat"]
    )

    expect(await openStarterPages(fake)).toEqual({ opened: 2, kept: 1, role_held: 1, taken: 1 })
    expect(opened).toEqual(["sik-sorulan-sorular", "odeme-secenekleri"])
  })
})

describe("planStarterPages", () => {
  it("knows the roles' default addresses", () => {
    expect(roleHandles()).toEqual({
      contact: "iletisim",
      payment: "odeme-secenekleri",
      shipping: "kargo-ve-teslimat",
    })
  })

  it("opens a role's starter when the role names that very page or none", () => {
    const plan = planStarterPages(STARTERS, {
      pages: new Set(),
      roles: { ...NO_ROLES, payment: "odeme-secenekleri" },
    })

    expect(plan.open.map((page) => page.handle)).toContain("odeme-secenekleri")
    expect(plan.role_held).toEqual([])
  })

  it("writes the questions page so it turns into its FAQ section, group by group", () => {
    const faq = sectorPack("general")?.pages?.find((page) => page.handle === "sik-sorulan-sorular")
    const rows = faqRowsOf(faq?.body as unknown as ContentDoc) ?? []

    expect(rows.filter((row) => "heading" in row).map((row) => row.heading)).toEqual([
      "Sipariş ve ödeme",
      "Kargo ve teslimat",
      "İade ve değişim",
      "Bize ulaşın",
    ])
    expect(rows.filter((row) => "question" in row)).toHaveLength(9)
  })

  it("takes the shop's sector pack's own texts, and only the pages it offers", () => {
    const general = sectorPack("general")?.pages ?? []
    const travel = sectorPack("travel")
    const cutlery = sectorPack("cutlery")

    expect(startersFor(general, [])).toEqual(general)
    expect(startersFor(general, cutlery ? [cutlery] : [])).toEqual(general)
    const tour = startersFor(general, travel ? [travel] : [])
    // A tour shop: no shipping page, its own questions, never the pack's other pages
    expect(tour.map((page) => page.handle)).toEqual([
      "hakkimizda",
      "iletisim",
      "sik-sorulan-sorular",
      "odeme-secenekleri",
    ])
    expect(JSON.stringify(tour[2]?.body)).toContain("Rezervasyon")
  })

  it("takes the general pack's pages: the five starters", () => {
    expect(sectorPack("general")?.pages?.map((page) => page.handle)).toEqual(
      STARTERS.map((page) => page.handle)
    )
  })
})
