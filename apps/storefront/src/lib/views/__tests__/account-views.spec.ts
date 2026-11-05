import { beforeEach, describe, expect, it, vi } from "vitest"
import { t } from "@/lib/i18n"

// The account's views (adr/0046 Ek 2026-11-05, hesap): the order rows' photos and the order
// page's steps, the favourites' live cards, the categories to start from
const server = vi.hoisted(() => ({ storeGet: vi.fn() }))
const requests = vi.hoisted(() => ({ listProducts: vi.fn(), pathsOf: vi.fn() }))
const rails = vi.hoisted(() => ({ railCards: vi.fn() }))
const tiles = vi.hoisted(() => ({ categoryTiles: vi.fn() }))
vi.mock("@/lib/store-api/server", () => server)
vi.mock("@/lib/store-api/requests", () => requests)
vi.mock("../section-data", () => rails)
vi.mock("../category-tiles", () => tiles)

const { customerFavorites, customerOrders, startingCategories } = await import("../account")
const { StoreApiError } = await import("@/lib/store-api/errors")

const row = (over: Record<string, unknown> = {}) => ({
  id: "order_01ABCDEFGHJK",
  display_id: 713,
  created_at: "2026-11-05T09:00:00Z",
  status: "pending",
  payment_status: "not_paid",
  fulfillment_status: "not_fulfilled",
  total: 1179.3,
  items: [
    { quantity: 1, title: "Gama Balta", thumbnail: "https://cdn.example.com/a.jpg" },
    { quantity: 2, title: "Kılıf", thumbnail: null },
    { quantity: 1, title: "Çakı", thumbnail: "https://cdn.example.com/b.jpg" },
    { quantity: 1, title: "Bileği taşı", thumbnail: "https://cdn.example.com/c.jpg" },
    { quantity: 1, title: "Kutu", thumbnail: "https://cdn.example.com/d.jpg" },
  ],
  payment_collections: [{ payment_sessions: [{ provider_id: "pp_bank-transfer_bank-transfer" }] }],
  ...over,
})

describe("the account's order rows", () => {
  beforeEach(() => {
    server.storeGet.mockReset()
  })

  it("asks the statuses, photos and payment sessions with the orders", async () => {
    server.storeGet.mockResolvedValue({ orders: [], count: 0 })
    await customerOrders(0, 3, t)
    const query = server.storeGet.mock.calls[0]?.[1] as { fields?: string } | undefined
    const fields = query?.fields ?? ""
    expect(fields).toContain("+fulfillment_status")
    expect(fields).toContain("items.thumbnail")
    expect(fields).toContain("*payment_collections.payment_sessions")
  })

  it("gives each order up to three of its photos and its steps from its statuses", async () => {
    server.storeGet.mockResolvedValue({ orders: [row()], count: 1 })
    const { orders } = await customerOrders(0, 3, t)
    const [order] = orders
    expect(order?.images?.map((image) => image.alt)).toEqual(["Gama Balta", "Çakı", "Bileği taşı"])
    expect(order?.itemCount).toBe(6)
    expect(order?.progress?.map(({ key, state }) => `${key}:${state}`)).toEqual([
      "placed:done",
      "paid:current",
      "packed:ahead",
      "shipped:ahead",
      "delivered:ahead",
    ])
  })

  it("has no payment step for cash on delivery, no steps for a cancelled order", async () => {
    server.storeGet.mockResolvedValue({
      orders: [
        row({ payment_collections: [{ payment_sessions: [{ provider_id: "pp_cod_cod" }] }] }),
        row({ id: "order_02ABCDEFGHJK", status: "canceled" }),
      ],
      count: 2,
    })
    const { orders } = await customerOrders(0, 3, t)
    expect(orders[0]?.progress?.map((step) => step.key)).not.toContain("paid")
    expect(orders[1]?.progress).toBeNull()
  })

  it("leaves the steps out when the backend did not say the fulfilment", async () => {
    server.storeGet.mockResolvedValue({
      orders: [row({ fulfillment_status: undefined })],
      count: 1,
    })
    const { orders } = await customerOrders(0, 3, t)
    expect(orders[0]).not.toHaveProperty("progress")
  })
})

describe("the account's favourites", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    server.storeGet.mockResolvedValue({
      items: [
        { id: "wish_1", product: { id: "prod_1", title: "Gama Balta", thumbnail: null } },
        {
          id: "wish_2",
          product: { id: "prod_2", title: "Eski Çakı", thumbnail: "https://cdn.example.com/e.jpg" },
        },
      ],
    })
    requests.pathsOf.mockResolvedValue({ prod_1: "/urun/gama-balta", prod_2: "/urun/eski-caki" })
    // Only the first is on sale here now
    requests.listProducts.mockResolvedValue({ products: [{ id: "prod_1" }], count: 1 })
    rails.railCards.mockResolvedValue([
      { id: "prod_1", title: "Gama Balta", path: "/urun/gama-balta" },
    ])
  })

  it("gives a saved product on sale its live card, another its name and photo only", async () => {
    const favorites = await customerFavorites()
    expect(requests.listProducts).toHaveBeenCalledWith({ limit: 2, ids: ["prod_1", "prod_2"] })
    expect(favorites.map((item) => [item.id, item.card?.id ?? null])).toEqual([
      ["wish_1", "prod_1"],
      ["wish_2", null],
    ])
    expect(favorites[1]?.image?.src).toBe("https://cdn.example.com/e.jpg")
  })

  it("keeps the list when the catalogue does not answer", async () => {
    requests.listProducts.mockRejectedValue(new StoreApiError(503, "errors.unavailable", null))
    rails.railCards.mockResolvedValue([])
    const favorites = await customerFavorites()
    expect(favorites.map((item) => item.card)).toEqual([null, null])
  })
})

describe("the categories to start from", () => {
  it("are the home page's tiles, none when the catalogue does not answer", async () => {
    tiles.categoryTiles.mockResolvedValueOnce([{ label: "Çakılar", path: "/kategori/cakilar" }])
    expect(await startingCategories()).toHaveLength(1)
    expect(tiles.categoryTiles).toHaveBeenCalledWith([])
    tiles.categoryTiles.mockRejectedValueOnce(new StoreApiError(503, "errors.unavailable", null))
    expect(await startingCategories()).toEqual([])
  })
})
