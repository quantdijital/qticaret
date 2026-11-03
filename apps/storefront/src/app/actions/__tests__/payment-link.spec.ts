import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const next = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))
vi.mock("next/cache", () => ({ revalidatePath: next.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: next.redirect }))
const store = vi.hoisted(() => ({ storePost: vi.fn() }))
vi.mock("@/lib/store-api/server", () => store)
const cookie = vi.hoisted(() => ({ rememberCart: vi.fn(), forgetCart: vi.fn() }))
vi.mock("@/lib/cart/cookie", () => cookie)
const cart = vi.hoisted(() => ({ currentCart: vi.fn() }))
vi.mock("@/lib/cart/cart", () => cart)

const { leaveLinkCart, openPaymentLink } = await import("../payment-link")

const TOKEN = `pl_${"A".repeat(20)}-_.mhx2k1.${"Zz_-".repeat(10)}abc`
const CART = "cart_01JABCDEFGHJKMNPQRSTV"

const press = (token: string = TOKEN) => {
  const form = new FormData()
  form.set("token", token)
  return openPaymentLink(form)
}

/** adr/0051 §3: "Ödemeye geç" opens the link's cart and goes to checkout; a refusal says why. */
describe("openPaymentLink", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps the link's new cart as this browser's and goes to checkout, sending nothing but the token", async () => {
    store.storePost.mockResolvedValue({ cart_id: CART })
    await expect(press()).rejects.toThrow("redirect:/odeme")
    expect(store.storePost).toHaveBeenCalledWith(`/store/payment-links/${TOKEN}/cart`, {})
    expect(cookie.rememberCart).toHaveBeenCalledWith(CART)
    expect(next.revalidatePath).toHaveBeenCalledWith("/", "layout")
  })

  it.each([
    [409, "payment_link.prices_changed", "fiyat"],
    [409, "payment_link.out_of_stock", "stok"],
    [404, "payment_link.unavailable", "yok"],
    // The links off: Express's bare 404
    [404, null, "yok"],
    // A cart that could not be bound to the link
    [409, "payment_link.unavailable", "yok"],
    [429, "errors.too_many_requests", "yogun"],
    [500, null, "hata"],
  ])("a %i %s comes back to the link's page as ?durum=%s, once", async (status, key, word) => {
    store.storePost.mockRejectedValue(new StoreApiError(status, key, null))
    await expect(press()).rejects.toThrow(`redirect:/ode/${TOKEN}?durum=${word}`)
    expect(store.storePost).toHaveBeenCalledTimes(1)
    expect(cookie.rememberCart).not.toHaveBeenCalled()
  })

  it("asks the backend nothing for a token without its shape", async () => {
    await expect(press("pl_bozuk")).rejects.toThrow("redirect:/")
    expect(store.storePost).not.toHaveBeenCalled()
  })

  it("keeps no cart id that is not one", async () => {
    store.storePost.mockResolvedValue({ cart_id: "<script>" })
    await expect(press()).rejects.toThrow(`redirect:/ode/${TOKEN}?durum=hata`)
    expect(cookie.rememberCart).not.toHaveBeenCalled()
  })

  it("lets an unexpected failure through to the error page", async () => {
    store.storePost.mockRejectedValue(new TypeError("fetch failed"))
    await expect(press()).rejects.toThrow("fetch failed")
    expect(next.redirect).not.toHaveBeenCalled()
  })
})

describe("leaveLinkCart", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lets a payment link's cart go and shows the empty cart", async () => {
    cart.currentCart.mockResolvedValue({
      id: CART,
      items: [],
      metadata: { qt_payment_link: "pl_1" },
    })
    await expect(leaveLinkCart()).rejects.toThrow("redirect:/sepet")
    expect(cookie.forgetCart).toHaveBeenCalledTimes(1)
  })

  it("keeps any other cart", async () => {
    cart.currentCart.mockResolvedValue({ id: CART, items: [], metadata: null })
    await expect(leaveLinkCart()).rejects.toThrow("redirect:/sepet")
    expect(cookie.forgetCart).not.toHaveBeenCalled()
  })
})
