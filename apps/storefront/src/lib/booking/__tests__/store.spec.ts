import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const api = vi.hoisted(() => ({
  storeGet: vi.fn(),
  storePost: vi.fn(),
  storeDelete: vi.fn(),
}))
vi.mock("@/lib/store-api/server", () => api)
vi.mock("@/lib/store-api/requests", () => ({
  liraRegion: vi.fn(() => Promise.resolve({ id: "reg_try" })),
  storefrontSettings: vi.fn(() => Promise.resolve({ features: {} })),
}))
const cookie = vi.hoisted(() => ({
  cartIdFromCookie: vi.fn(),
  forgetCart: vi.fn(),
  rememberCart: vi.fn(),
}))
vi.mock("@/lib/cart/cookie", () => cookie)
vi.mock("@/lib/security/cookies", () => ({ cookieName: (name: string) => name }))
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}))

const { bookIntoCart, cartBooking, productBooking } = await import("../store")

const SLOT = "bkslot_01K0000000000000000000000"
const ITEMS = [{ variant_id: "variant_01K0000000000000000000000", quantity: 2 }]

beforeEach(() => {
  vi.clearAllMocks()
  api.storePost.mockImplementation((path: string) =>
    Promise.resolve(path === "/store/carts" ? { cart: { id: "cart_new" } } : {})
  )
})

describe("a departure's places into the cart", () => {
  it("opens a cart when the shopper has none and books into it", async () => {
    cookie.cartIdFromCookie.mockResolvedValue(null)
    await bookIntoCart(SLOT, ITEMS)
    expect(api.storePost).toHaveBeenCalledWith("/store/carts", { region_id: "reg_try" })
    expect(cookie.rememberCart).toHaveBeenCalledWith("cart_new")
    expect(api.storePost).toHaveBeenCalledWith("/store/carts/cart_new/bookings", {
      slot_id: SLOT,
      items: ITEMS,
    })
  })

  it("books into the open cart, sending no price", async () => {
    cookie.cartIdFromCookie.mockResolvedValue("cart_open")
    api.storeGet.mockResolvedValue({ cart: { id: "cart_open", completed_at: null } })
    await bookIntoCart(SLOT, ITEMS)
    expect(api.storePost).toHaveBeenCalledTimes(1)
    expect(api.storePost.mock.calls[0]).toEqual([
      "/store/carts/cart_open/bookings",
      { slot_id: SLOT, items: ITEMS },
    ])
  })

  it("opens a fresh cart once when the remembered one is gone", async () => {
    cookie.cartIdFromCookie.mockResolvedValue("cart_open")
    api.storeGet.mockResolvedValue({ cart: { id: "cart_open", completed_at: null } })
    api.storePost.mockImplementation((path: string) => {
      if (path === "/store/carts/cart_open/bookings") {
        return Promise.reject(new StoreApiError(404, "cart.unknown", null))
      }
      return Promise.resolve(path === "/store/carts" ? { cart: { id: "cart_new" } } : {})
    })
    await bookIntoCart(SLOT, ITEMS)
    expect(cookie.forgetCart).toHaveBeenCalled()
    expect(api.storePost).toHaveBeenLastCalledWith("/store/carts/cart_new/bookings", {
      slot_id: SLOT,
      items: ITEMS,
    })
  })

  it("keeps the cart when dated sales are off (a bare 404) and says why", async () => {
    cookie.cartIdFromCookie.mockResolvedValue("cart_open")
    api.storeGet.mockResolvedValue({ cart: { id: "cart_open", completed_at: null } })
    api.storePost.mockRejectedValue(new StoreApiError(404, null, null))
    await expect(bookIntoCart(SLOT, ITEMS)).rejects.toMatchObject({
      name: "BookingRefused",
      key: "booking.unavailable",
    })
    expect(cookie.forgetCart).not.toHaveBeenCalled()
  })
})

describe("reading dated products and carts", () => {
  it("answers null on a refusal so the page stays up", async () => {
    api.storeGet.mockRejectedValue(new StoreApiError(404, null, null))
    expect(await productBooking("prod_1")).toBeNull()
    expect(await cartBooking("cart_1")).toBeNull()
  })

  it("asks the product's departures in the lira region", async () => {
    api.storeGet.mockResolvedValue({ booking: { slots: [] } })
    expect(await productBooking("prod_1")).toEqual({ slots: [] })
    expect(api.storeGet).toHaveBeenCalledWith("/store/products/prod_1/booking", {
      region_id: "reg_try",
    })
  })
})
