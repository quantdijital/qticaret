import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const listings = vi.hoisted(() => ({ suggestPage: vi.fn() }))
vi.mock("@/lib/store-api/listings", () => listings)
const requests = vi.hoisted(() => ({
  listProducts: vi.fn(),
  pathsOf: vi.fn(),
  priceDisplays: vi.fn(),
}))
vi.mock("@/lib/store-api/requests", () => requests)

const { GET } = await import("../api/search/suggest/route")

const ask = (q?: string) =>
  GET(
    new Request(
      `http://localhost:8000/api/search/suggest${q === undefined ? "" : `?q=${encodeURIComponent(q)}`}`
    )
  )

describe("GET /api/search/suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listings.suggestPage.mockResolvedValue({
      product_ids: ["p1"],
      count: 12,
      suggestions: [],
      related: { categories: [{ id: "pcat_1", name: "Çakılar" }], brands: [] },
    })
    requests.listProducts.mockResolvedValue({
      products: [
        {
          id: "p1",
          title: "Katlanır Çakı",
          handle: "katlanir-caki",
          subtitle: null,
          description: null,
          thumbnail: null,
          variants: [
            {
              id: "variant_1",
              title: "Standart",
              sku: null,
              manage_inventory: false,
              allow_backorder: false,
              inventory_quantity: 0,
              options: [],
              calculated_price: {
                calculated_amount: 450,
                original_amount: 450,
                currency_code: "try",
              },
            },
          ],
        },
      ],
      count: 1,
    })
    requests.pathsOf.mockImplementation((type: string) =>
      Promise.resolve(
        type === "product" ? { p1: "/urun/katlanir-caki" } : { pcat_1: "/kategori/cakilar" }
      )
    )
    requests.priceDisplays.mockResolvedValue({})
  })

  it("answers the panel's view from the server's own calls, never stored on the way", async () => {
    const response = await ask("  çakı ")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(await response.json()).toEqual({
      q: "çakı",
      total: 12,
      allPath: "/arama?q=%C3%A7ak%C4%B1",
      products: [
        {
          id: "p1",
          title: "Katlanır Çakı",
          path: "/urun/katlanir-caki",
          image: null,
          price: { current: "450,00 TL", before: null, from: false, discount: null, saving: null },
        },
      ],
      categories: [{ label: "Çakılar", path: "/kategori/cakilar" }],
      brands: [],
      suggestions: [],
    })
    expect(listings.suggestPage).toHaveBeenCalledWith("çakı")
    expect(requests.listProducts).toHaveBeenCalledWith({ ids: ["p1"], limit: 1 })
    expect(requests.priceDisplays).toHaveBeenCalledWith(["variant_1"])
  })

  it("asks nothing for fewer than two characters", async () => {
    for (const q of [undefined, "", " ç "]) {
      const response = await ask(q)
      expect(response.status).toBe(400)
    }
    expect(listings.suggestPage).not.toHaveBeenCalled()
  })

  it("loads no products when the search found none", async () => {
    listings.suggestPage.mockResolvedValue({
      product_ids: [],
      count: 0,
      suggestions: [],
      related: { categories: [], brands: [] },
    })
    const response = await ask("zzqq")
    expect((await response.json()) as unknown).toMatchObject({ total: 0, products: [] })
    expect(requests.listProducts).not.toHaveBeenCalled()
  })

  it("answers words the search cannot read as nothing found, and a failure quietly", async () => {
    listings.suggestPage.mockRejectedValueOnce(new StoreApiError(400, "invalid_data", null))
    const unreadable = await ask("?!")
    expect(unreadable.status).toBe(200)
    expect(await unreadable.json()).toMatchObject({ q: "?!", total: 0, products: [] })

    listings.suggestPage.mockRejectedValueOnce(new StoreApiError(429, "rate_limited", null))
    expect((await ask("çakı")).status).toBe(429)

    listings.suggestPage.mockRejectedValueOnce(new Error("socket hang up"))
    const failed = await ask("çakı")
    expect(failed.status).toBe(502)
    expect(failed.headers.get("cache-control")).toBe("private, no-store")
  })
})
