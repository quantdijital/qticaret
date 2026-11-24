import { beforeEach, describe, expect, it, vi } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView } from "@qticaret/ui"
import type { StoreDeparturesSection, StoreUpcomingDeparture } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0077 §10 as the storefront draws it: the nearest departures read
 * live, each linked to its tour's page with its date in the tour's zone,
 * the places left only when few and a "from" price; nothing at all
 * without one, or while dated products are off (§8).
 */

const extras = vi.hoisted(() => ({ upcomingDepartures: vi.fn() }))
const requests = vi.hoisted(() => ({
  pathsOf: vi.fn(),
  storefrontSettings: vi.fn(),
  legalIdentity: vi.fn(),
  siteSeo: vi.fn(),
}))
vi.mock("@/lib/store-api/extras", () => extras)
vi.mock("@/lib/store-api/requests", () => requests)
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }))
vi.mock("@/lib/store-api/server", () => ({ storeGet: vi.fn() }))
vi.mock("@/lib/store-api/blog", () => ({ blogPosts: vi.fn() }))

const { departuresView } = await import("@/lib/views/departures")
const { sectionViews } = await import("@/lib/views/sections")

const section = (over: Partial<StoreDeparturesSection> = {}): StoreDeparturesSection => ({
  id: "kalkislar01",
  type: "departures",
  title: null,
  intro: null,
  source: { kind: "all" },
  limit: 6,
  ...over,
})

const departure = (
  id: string,
  startsAt: string,
  over: Partial<StoreUpcomingDeparture> = {}
): StoreUpcomingDeparture => ({
  product: { id: `prod_${id}`, handle: id, title: `Tur ${id}`, thumbnail: null },
  slot_id: `bslot_${id}`,
  starts_at: startsAt,
  timezone: "Europe/Istanbul",
  left: null,
  from_price: 1750.5,
  ...over,
})

const words = (html: string) => html.replaceAll("&#x27;", "'")
const home = (sections: HomeSectionView[]) =>
  words(renderPage(atolyeTheme, "HomePage", { view: { sections } }))

beforeEach(() => {
  extras.upcomingDepartures.mockReset()
  requests.pathsOf.mockReset()
  requests.storefrontSettings.mockReset()
  requests.pathsOf.mockResolvedValue({ prod_kapadokya: "/kapadokya", prod_efes: "/efes" })
  extras.upcomingDepartures.mockResolvedValue([
    // 09:00 in Istanbul on Saturday 12 December
    departure("kapadokya", "2026-12-12T06:00:00Z", { left: 3 }),
    departure("efes", "2026-12-14T06:00:00Z", {
      from_price: null,
      product: { id: "prod_efes", handle: "efes", title: "Efes", thumbnail: "https://cdn/e.webp" },
    }),
    // No page for it now: left out
    departure("gizli", "2026-12-15T06:00:00Z"),
  ])
})

describe("the upcoming departures' view", () => {
  it("asks for the section's source and count, rows by date with their pages", async () => {
    const view = await departuresView(
      section({ source: { kind: "category", category_id: "pcat_tur" }, limit: 4 }),
      t
    )

    expect(extras.upcomingDepartures).toHaveBeenCalledWith(4, "category", "pcat_tur")
    expect(view).toMatchObject({
      type: "departures",
      title: "Yaklaşan kalkışlar",
      open: "İncele",
      layout: "list",
    })
    expect(view?.rows.map((row) => [row.path, row.left, row.price?.current ?? null])).toEqual([
      ["/kapadokya", "Son 3 yer", "1.750,50 TL'den itibaren"],
      ["/efes", null, null],
    ])
    expect(view?.rows[0]?.date).toMatchObject({ day: "12", month: "Ara", weekday: "Cmt" })
    expect(view?.rows[0]?.date.full).toContain("12 Aralık 2026 Cumartesi")
    expect(view?.rows[1]?.image).toMatchObject({ src: "https://cdn/e.webp", alt: "" })
  })

  it("is no section without a departure, and reads a layout off its list as the list", async () => {
    expect(
      (await departuresView(section({ layout: "grid" as never, title: "Takvim" }), t))?.layout
    ).toBe("list")
    extras.upcomingDepartures.mockResolvedValue([])
    expect(await departuresView(section(), t)).toBeNull()
  })

  it("is not drawn while dated products are off; asked only while on", async () => {
    requests.storefrontSettings.mockResolvedValue({ features: { booking: false } })
    expect(await sectionViews([section()], t)).toEqual([])
    expect(extras.upcomingDepartures).not.toHaveBeenCalled()

    requests.storefrontSettings.mockResolvedValue({ features: { booking: true } })
    expect((await sectionViews([section()], t)).map((view) => view.type)).toEqual(["departures"])
  })
})

describe("Atölye's upcoming departures", () => {
  it("draws a row each: the date box, the name, places left, the price and İncele", async () => {
    const view = await departuresView(section({ intro: "Yakında yola çıkıyoruz" }), t)
    const html = home(view ? [view] : [])

    expect(html).toContain('<h2 id="bolum-kalkislar01">Yaklaşan kalkışlar</h2>')
    expect(html).toContain("Yakında yola çıkıyoruz")
    expect(html).toContain('dateTime="2026-12-12T06:00:00.000Z"')
    expect(html).toContain("Tur kapadokya")
    expect(html).toContain("Son 3 yer")
    expect(html).toContain("1.750,50 TL'den itibaren")
    expect(html).toContain('href="/kapadokya"')
    expect(html.match(/>İncele</g)).toHaveLength(2)
    // The list draws no photograph
    expect(html).not.toContain("https://cdn/e.webp")
  })

  it("draws a card each with the tour's photograph in its well", async () => {
    const view = await departuresView(section({ layout: "cards" }), t)
    const html = home(view ? [view] : [])

    expect(html).toContain('src="https://cdn/e.webp"')
    expect(html.match(/bg-media\b/g)).toHaveLength(2)
    expect(html).toContain("Son 3 yer")
  })
})
