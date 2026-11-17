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
const cart = vi.hoisted(() => ({
  addLine: vi.fn(),
  changeLine: vi.fn(),
  addPromotion: vi.fn(),
  removePromotion: vi.fn(),
  addGiftCard: vi.fn(),
  removeGiftCard: vi.fn(),
}))
vi.mock("@/lib/cart/cart", () => cart)
const addons = vi.hoisted(() => ({
  productAddons: vi.fn(),
  addAddonLine: vi.fn(),
  saveAddonLine: vi.fn(),
}))
vi.mock("@/lib/cart/addons", () => addons)

const { addToCart, changeCartLine } = await import("../cart")
const { addAddonsToCart } = await import("../addons")

const NO_STATE = { ok: false, error: null }
const VARIANT = "variant_01JABCDEFGHJ"
const LINE = "cali_01JABCDEFGHJ"

/** The backend's refusal of more units than are for sale, with what its body says. */
const short = (values?: unknown) =>
  new StoreApiError(400, "cart.insufficient_stock", "req-1", {
    type: "invalid_data",
    message: "cart.insufficient_stock",
    ...(values === undefined ? {} : { values }),
  })

const formOf = (fields: Record<string, string>) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value)
  }
  return form
}

const add = () => addToCart(NO_STATE, formOf({ variant_id: VARIANT, quantity: "5" }))
const change = () => changeCartLine(formOf({ line_id: LINE, quantity: "2" }))

describe("the cart actions when the shelf has fewer units than asked", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("says so for an add, never that the product is not for sale", async () => {
    cart.addLine.mockRejectedValue(short({ available: "3" }))
    await expect(add()).resolves.toEqual({ ok: false, error: "cart.insufficient_stock" })
    cart.addLine.mockRejectedValue(short())
    await expect(add()).resolves.toEqual({ ok: false, error: "cart.insufficient_stock" })
    expect(next.revalidatePath).not.toHaveBeenCalled()
  })

  it("says so for an add with add-on picks too", async () => {
    addons.productAddons.mockResolvedValue([])
    cart.addLine.mockRejectedValue(short({ available: "1" }))
    await expect(
      addAddonsToCart(
        NO_STATE,
        formOf({ product_id: "prod_01JABCDEFGHJ", variant_id: VARIANT, quantity: "2" })
      )
    ).resolves.toEqual({ ok: false, error: "cart.insufficient_stock" })
  })

  it("brings a quantity change back to the cart with the count the backend named", async () => {
    cart.changeLine.mockRejectedValue(short({ available: "1" }))
    await expect(change()).rejects.toThrow("redirect:/sepet?hata=cart.insufficient_stock&adet=1")
    // The line was not changed, and nothing else is refreshed as if it were
    expect(next.revalidatePath).not.toHaveBeenCalled()
  })

  it("puts no count in the address unless it is a small whole number", async () => {
    for (const values of [
      undefined,
      { available: "0" },
      { available: "100" },
      { available: "1.5" },
      { available: 3 },
      { available: "3&hata=x" },
      "3",
    ]) {
      cart.changeLine.mockRejectedValue(short(values))
      await expect(change()).rejects.toThrow(/^redirect:\/sepet\?hata=cart\.insufficient_stock$/)
    }
  })

  it("keeps every other refusal as before", async () => {
    cart.addLine.mockRejectedValue(new StoreApiError(400, "invalid_data", null))
    await expect(add()).resolves.toEqual({ ok: false, error: "cart.variant_unavailable" })
    cart.addLine.mockRejectedValue(new StoreApiError(500, null, null))
    await expect(add()).resolves.toEqual({ ok: false, error: "cart.add_failed" })

    cart.changeLine.mockRejectedValue(new StoreApiError(400, "Cart is completed", null))
    await expect(change()).rejects.toThrow("redirect:/sepet?hata=cart.update_failed")
    cart.changeLine.mockRejectedValue(new StoreApiError(400, "addons.max_quantity", null))
    await expect(change()).rejects.toThrow("redirect:/sepet?hata=addons.max_quantity")
    // Medusa's own words for the same refusal, should they ever reach the storefront unmapped
    cart.changeLine.mockRejectedValue(
      new StoreApiError(400, "Some variant does not have the required inventory", null)
    )
    await expect(change()).rejects.toThrow("redirect:/sepet?hata=cart.update_failed")
  })
})
