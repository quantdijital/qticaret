import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

// The backend's answers as each test sets them
const api = vi.hoisted(() => ({
  storeGet: vi.fn(),
  storePost: vi.fn(),
  storeDelete: vi.fn(),
}))
vi.mock("../../store-api/server", () => api)
vi.mock("../../store-api/requests", () => ({
  storefrontSettings: () => Promise.resolve({ features: { gift_cards: false } }),
  liraRegion: () => Promise.resolve({ id: "reg_1" }),
}))
vi.mock("../cookie", () => ({
  cartIdFromCookie: () => Promise.resolve("cart_1"),
  forgetCart: vi.fn(),
  rememberCart: vi.fn(),
}))

const { addPromotion, removePromotion } = await import("../cart")

const cartWith = (codes: string[], options: string[]) => ({
  cart: {
    id: "cart_1",
    completed_at: null,
    items: [],
    promotions: codes.map((code) => ({ code, is_automatic: false })),
    shipping_methods: options.map((shipping_option_id) => ({ shipping_option_id })),
  },
})

const shippingPosts = () =>
  api.storePost.mock.calls.filter(([path]) => String(path).endsWith("/shipping-methods"))

/**
 * F4.5: Medusa re-prices shipping when items change, not when a code
 * comes or goes; the chosen option is chosen again so a code that takes
 * the basket under the free-shipping threshold does not keep its 0 TL.
 */
describe("a code and the shipping already chosen", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset())
    api.storePost.mockResolvedValue({})
    api.storeDelete.mockResolvedValue({})
  })

  it("chooses the shipping again once a code is taken", async () => {
    api.storeGet.mockResolvedValue(cartWith(["YAZ2026"], ["so_aras", "so_aras"]))
    await expect(addPromotion("yaz2026")).resolves.toBe(true)
    expect(api.storePost).toHaveBeenNthCalledWith(1, "/store/carts/cart_1/promotions", {
      promo_codes: ["yaz2026"],
    })
    expect(shippingPosts()).toEqual([
      ["/store/carts/cart_1/shipping-methods", { option_id: "so_aras" }],
    ])
  })

  it("leaves the shipping alone when the code is refused, or none is chosen yet", async () => {
    api.storeGet.mockResolvedValue(cartWith([], ["so_aras"]))
    await expect(addPromotion("YOKBOYLE")).resolves.toBe(false)
    api.storeGet.mockResolvedValue(cartWith(["YAZ2026"], []))
    await expect(addPromotion("YAZ2026")).resolves.toBe(true)
    expect(shippingPosts()).toEqual([])
  })

  it("chooses it again once a code comes off", async () => {
    api.storeGet.mockResolvedValue(cartWith([], ["so_yurtici"]))
    await removePromotion("YAZ2026")
    expect(api.storeDelete).toHaveBeenCalledWith("/store/carts/cart_1/promotions", {
      promo_codes: ["YAZ2026"],
    })
    expect(shippingPosts()).toEqual([
      ["/store/carts/cart_1/shipping-methods", { option_id: "so_yurtici" }],
    ])
  })

  it("keeps the code when the option is no longer offered; the backend stops a stale order", async () => {
    api.storeGet.mockResolvedValue(cartWith(["YAZ2026"], ["so_aras"]))
    api.storePost.mockImplementation((path: string) =>
      path.endsWith("/shipping-methods")
        ? Promise.reject(new StoreApiError(400, "cart.shipping_option_invalid", null))
        : Promise.resolve({})
    )
    await expect(addPromotion("YAZ2026")).resolves.toBe(true)
  })

  it("keeps a taken code taken whatever the re-pricing's failure", async () => {
    api.storeGet.mockResolvedValue(cartWith(["YAZ2026"], ["so_aras", "so_yurtici"]))
    api.storePost.mockImplementation((path: string) =>
      path.endsWith("/shipping-methods")
        ? Promise.reject(new TypeError("fetch failed"))
        : Promise.resolve({})
    )
    await expect(addPromotion("YAZ2026")).resolves.toBe(true)
    // Each option is still tried: one failing does not leave the next unpriced
    expect(shippingPosts()).toHaveLength(2)
  })

  it("takes a code off even when the cart cannot be read again for its shipping", async () => {
    api.storeGet.mockRejectedValue(new TypeError("fetch failed"))
    await expect(removePromotion("YAZ2026")).resolves.toBeUndefined()
    expect(api.storeDelete).toHaveBeenCalledTimes(1)
    expect(shippingPosts()).toEqual([])
  })
})
