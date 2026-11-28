import type { MedusaContainer } from "@medusajs/framework/types"
import type * as SectorPacks from "@qticaret/sector-packs"
import { SectorPackError } from "@qticaret/sector-packs"
import { presetFit } from "../fit"

const mockPreset = jest.fn()
const mockLookups = jest.fn()
const mockOff = jest.fn()

jest.mock("@qticaret/sector-packs", () => {
  const actual = jest.requireActual<typeof SectorPacks>("@qticaret/sector-packs")
  return { ...actual, storefrontPreset: (...args: unknown[]): unknown => mockPreset(...args) }
})
jest.mock("../../../../workflows/storefront/preset-lookups", () => ({
  presetLookups: (...args: unknown[]): unknown => mockLookups(...args),
}))
jest.mock("../../../../workflows/storefront/layout-flags", () => ({
  sectionTypesOff: (...args: unknown[]): unknown => mockOff(...args),
}))

const SCHEDULE = { visible: true, starts_at: null, ends_at: null }
const container = {} as MedusaContainer

// Another sector's look: a rail of a category this shop has, one of a category it lacks, a
// close-up of a product it lacks, a dated section whose feature is off, a picture and a page
const LAYOUT = {
  header: [{ id: "duyuru", type: "announcement_bar", ...SCHEDULE, lines: ["Kargo bedava"] }],
  home: [
    {
      id: "acilis",
      type: "hero",
      ...SCHEDULE,
      title: "Hoş geldiniz",
      image: { $image: "images/acilis.webp", alt: null },
    },
    {
      id: "turlar",
      type: "categories",
      ...SCHEDULE,
      title: "Turlar",
      category_ids: [{ $handle: "category:turlar" }],
    },
    {
      id: "cakilar",
      type: "categories",
      ...SCHEDULE,
      title: "Çakılar",
      category_ids: [{ $handle: "category:cakilar" }, { $handle: "category:kiliclar" }],
    },
    {
      id: "yakinplan",
      type: "featured_product",
      ...SCHEDULE,
      product_id: { $handle: "product:alageyik" },
    },
    { id: "kalkislar", type: "departures", ...SCHEDULE, title: "Kalkışlar" },
  ],
  pages: [{ page_id: { $handle: "page:hakkimizda" }, sections: [] }],
}

describe("a look's fit in this shop (owner, 2026-11-28)", () => {
  beforeEach(() => {
    mockPreset.mockReset().mockReturnValue({ layout: LAYOUT })
    mockLookups
      .mockReset()
      .mockImplementation((_c: unknown, _m: unknown, images: ReadonlyMap<string, string>) =>
        Promise.resolve({
          records: new Map([["category:turlar", "pcat_1"]]),
          links: new Map(),
          images,
        })
      )
    mockOff.mockReset().mockResolvedValue(new Map([["departures", "catalog.booking"]]))
  })

  it("names the sections a full apply would leave out, with what took them", async () => {
    const unfit = await presetFit(container, "cutlery", "tezgah")
    expect(unfit).toEqual([
      {
        where: "home.cakilar",
        type: "categories",
        title: "Çakılar",
        refs: ["category:cakilar", "category:kiliclar"],
        reason: "missing",
      },
      {
        where: "home.yakinplan",
        type: "featured_product",
        title: null,
        refs: ["product:alageyik"],
        reason: "missing",
      },
      {
        where: "home.kalkislar",
        type: "departures",
        title: "Kalkışlar",
        refs: ["departures"],
        reason: "feature_off",
      },
    ])
    expect(mockPreset).toHaveBeenCalledWith("cutlery", "tezgah")
    // The look's pictures stood in for, its pages left aside: no record asked of them
    const markers = (mockLookups.mock.calls[0] as unknown[] | undefined)?.[1] as {
      handles: Set<string>
    }
    expect([...markers.handles]).not.toContain("page:hakkimizda")
  })

  it("has none for a look this build lacks or its loader refuses; lets anything else through", async () => {
    mockPreset.mockReturnValueOnce(null)
    await expect(presetFit(container, "yok", "yok")).resolves.toBeNull()
    mockPreset.mockImplementationOnce(() => {
      throw new SectorPackError("cutlery/presets/x: unreadable")
    })
    await expect(presetFit(container, "cutlery", "x")).resolves.toBeNull()
    mockPreset.mockImplementationOnce(() => {
      throw new Error("disk")
    })
    await expect(presetFit(container, "cutlery", "x")).rejects.toThrow("disk")
    expect(mockLookups).not.toHaveBeenCalled()
  })

  it("is empty for a look whose every record the shop has", async () => {
    mockPreset.mockReturnValueOnce({ layout: { home: [LAYOUT.home[1]] } })
    await expect(presetFit(container, "travel", "vadi")).resolves.toEqual([])
  })
})
