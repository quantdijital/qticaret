import { beforeEach, describe, expect, it, vi } from "vitest"
import type { QuickViewView } from "@qticaret/ui"
import { StoreApiError } from "@/lib/store-api/errors"
import { DEFAULT_THEME } from "@/lib/views/theme"

const requests = vi.hoisted(() => ({
  productById: vi.fn(),
  pathsOf: vi.fn(),
  priceDisplays: vi.fn(),
  storefrontSettings: vi.fn(),
}))
vi.mock("@/lib/store-api/requests", () => requests)
const addons = vi.hoisted(() => ({ productAddonsOrNone: vi.fn() }))
vi.mock("@/lib/cart/addons", () => addons)
const extras = vi.hoisted(() => ({ cardFacts: vi.fn() }))
vi.mock("@/lib/store-api/extras", () => extras)
const texts = vi.hoisted(() => ({ productTexts: vi.fn() }))
vi.mock("@/lib/store-api/product-description", () => texts)
const theme = vi.hoisted(() => ({ currentTheme: vi.fn() }))
vi.mock("@/lib/views/theme-settings", () => theme)
const layout = vi.hoisted(() => ({ currentShared: vi.fn() }))
vi.mock("@/lib/views/layout", () => layout)

const { GET } = await import("../api/quick-view/route")

const ask = (id?: string) =>
  GET(
    new Request(
      `http://localhost:8000/api/quick-view${id === undefined ? "" : `?id=${encodeURIComponent(id)}`}`
    )
  )

const variant = (id: string, value: string, quantity: number) => ({
  id,
  title: value,
  sku: null,
  manage_inventory: true,
  allow_backorder: false,
  inventory_quantity: quantity,
  options: [{ id: `optval_${value}`, value, option_id: "opt_color" }],
  calculated_price: { calculated_amount: 450, original_amount: 450, currency_code: "try" },
})

const PRODUCT = {
  id: "prod_01",
  title: "Katlanır Çakı",
  handle: "katlanir-caki",
  subtitle: null,
  description: "Paslanmaz çelik.\n\nİkinci paragraf.",
  thumbnail: null,
  brand: { id: "brand_1", name: "Atölye" },
  options: [
    {
      id: "opt_color",
      title: "Renk",
      values: [
        { id: "optval_Siyah", value: "Siyah" },
        { id: "optval_Kahve", value: "Kahve" },
      ],
    },
  ],
  variants: [variant("variant_1", "Siyah", 0), variant("variant_2", "Kahve", 3)],
}

const withCard = (card: Partial<typeof DEFAULT_THEME.product_card>) => ({
  ...DEFAULT_THEME,
  product_card: { ...DEFAULT_THEME.product_card, quick_view: true, ...card },
})

describe("GET /api/quick-view (adr/0049 Ek 2026-11-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requests.productById.mockResolvedValue(PRODUCT)
    requests.pathsOf.mockResolvedValue({ prod_01: "/urun/katlanir-caki" })
    requests.priceDisplays.mockResolvedValue({})
    requests.storefrontSettings.mockResolvedValue({ features: { gift_cards: true } })
    addons.productAddonsOrNone.mockResolvedValue([])
    extras.cardFacts.mockResolvedValue({
      prod_01: { stock: "in", quick_add: null, rating: { average: 4.5, count: 12 } },
    })
    texts.productTexts.mockResolvedValue({ description: null, summary: "<p>Kısa</p>" })
    theme.currentTheme.mockResolvedValue(withCard({}))
    layout.currentShared.mockResolvedValue({ trust_badges: [], color_swatches: [] })
  })

  it("answers the product as the dialog shows it, priced on the server, kept by nobody, never indexed", async () => {
    const response = await ask("prod_01")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-robots-tag")).toBe("noindex")
    const view = (await response.json()) as QuickViewView
    expect(view).toMatchObject({
      id: "prod_01",
      title: "Katlanır Çakı",
      path: "/urun/katlanir-caki",
      brand: "Atölye",
      options: [{ id: "opt_color", title: "Renk", values: ["Siyah", "Kahve"] }],
      // The first variant in stock, as the product page opens
      selectedVariantId: "variant_2",
      rating: { average: "4,5", count: 12 },
      summaryHtml: "<p>Kısa</p>",
      summaryText: null,
      quantity: true,
    })
    expect(view.variants).toHaveLength(2)
    expect(view.variants[1]).toMatchObject({ id: "variant_2", available: true })
    expect(view.variants[1]?.price?.current).toMatch(/450/)
    expect(view.variants[0]).not.toHaveProperty("installments")
    expect(requests.productById).toHaveBeenCalledWith("prod_01")
  })

  it("leaves out what the shop hides in the dialog, the brand as its cards show it", async () => {
    theme.currentTheme.mockResolvedValue(
      withCard({
        show_brand: false,
        quick_view_rating: false,
        quick_view_summary: false,
        quick_view_quantity: false,
      })
    )
    const view = (await (await ask("prod_01")).json()) as QuickViewView
    expect(view).toMatchObject({
      brand: null,
      rating: null,
      summaryHtml: null,
      summaryText: null,
      quantity: false,
    })
  })

  it("stands the description's first paragraph in for a missing short description", async () => {
    texts.productTexts.mockResolvedValue({ description: null, summary: null })
    const view = (await (await ask("prod_01")).json()) as QuickViewView
    expect(view.summaryHtml).toBeNull()
    expect(view.summaryText).toBe("Paslanmaz çelik.")
  })

  it("refuses anything but a product id before the backend", async () => {
    for (const id of [undefined, "", "../admin", "prod_01;drop", "variant_1"]) {
      const response = await ask(id)
      expect(response.status).toBe(400)
    }
    expect(requests.productById).not.toHaveBeenCalled()
  })

  it("answers 404 with the same headers and no backend call when the shop has the quick view off", async () => {
    theme.currentTheme.mockResolvedValue(withCard({ quick_view: false }))
    const response = await ask("prod_01")
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-robots-tag")).toBe("noindex")
    expect(await response.json()).toEqual({ message: "quick_view.not_found" })
    for (const call of [
      requests.productById,
      requests.pathsOf,
      requests.priceDisplays,
      texts.productTexts,
      extras.cardFacts,
    ]) {
      expect(call).not.toHaveBeenCalled()
    }
  })

  it("asks the product first: an unknown id is one call, a 404, and never asks for a path", async () => {
    requests.productById.mockRejectedValue(new StoreApiError(404, "not_found", null))
    const response = await ask("prod_unknown")
    expect(response.status).toBe(404)
    expect(requests.productById).toHaveBeenCalledTimes(1)
    expect(requests.pathsOf).not.toHaveBeenCalled()
    expect(texts.productTexts).not.toHaveBeenCalled()
  })

  it("sends a gift card or a product with a required add-on to its page, not the button", async () => {
    expect(((await (await ask("prod_01")).json()) as QuickViewView).needsPage).toBe(false)

    // A gift card asks its recipient (and takes no add-ons), while the shop has gift cards on
    addons.productAddonsOrNone.mockClear()
    requests.productById.mockResolvedValue({
      ...PRODUCT,
      product_extension: { is_gift_card: true },
    })
    expect(((await (await ask("prod_01")).json()) as QuickViewView).needsPage).toBe(true)
    expect(addons.productAddonsOrNone).not.toHaveBeenCalled()
    // ... as the page, which shows no recipient form while they are off
    requests.storefrontSettings.mockResolvedValue({ features: { gift_cards: false } })
    expect(((await (await ask("prod_01")).json()) as QuickViewView).needsPage).toBe(false)

    requests.productById.mockResolvedValue(PRODUCT)
    addons.productAddonsOrNone.mockResolvedValue([{ id: "addon_1", required: false }])
    expect(((await (await ask("prod_01")).json()) as QuickViewView).needsPage).toBe(false)
    addons.productAddonsOrNone.mockResolvedValue([
      { id: "addon_1", required: false },
      { id: "addon_2", required: true },
    ])
    expect(((await (await ask("prod_01")).json()) as QuickViewView).needsPage).toBe(true)
  })

  it("asks the path only after the product is found", async () => {
    const order: string[] = []
    requests.productById.mockImplementation(async () => {
      await Promise.resolve()
      order.push("product")
      return PRODUCT
    })
    requests.pathsOf.mockImplementation(() => {
      order.push("path")
      return Promise.resolve({ prod_01: "/urun/katlanir-caki" })
    })
    expect((await ask("prod_01")).status).toBe(200)
    expect(order).toEqual(["product", "path"])
  })

  it("answers 404 for a product not sold here or without a live page, 502 or the 429 for a failure", async () => {
    requests.pathsOf.mockResolvedValue({})
    expect((await ask("prod_01")).status).toBe(404)
    requests.productById.mockRejectedValue(new StoreApiError(404, "not_found", null))
    expect((await ask("prod_01")).status).toBe(404)
    requests.productById.mockRejectedValue(new StoreApiError(429, null, null))
    expect((await ask("prod_01")).status).toBe(429)
    requests.productById.mockRejectedValue(new Error("down"))
    const failed = await ask("prod_01")
    expect(failed.status).toBe(502)
    expect(failed.headers.get("cache-control")).toBe("private, no-store")
  })
})
