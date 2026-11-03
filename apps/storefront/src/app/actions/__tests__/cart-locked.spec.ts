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

const { addToCart, applyPromotion, changeCartLine, removeCartPromotion } = await import("../cart")

const LOCKED = () => new StoreApiError(400, "cart.payment_link_locked", null)
const NO_STATE = { ok: false, error: null }

const formOf = (fields: Record<string, string>) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value)
  }
  return form
}

/** adr/0051 §4: a payment link's cart refuses every change of lines and code; the shopper is told why. */
describe("the cart actions on a payment link's cart", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("says why a product does not go in", async () => {
    cart.addLine.mockRejectedValue(LOCKED())
    await expect(
      addToCart(NO_STATE, formOf({ variant_id: "variant_01JABCDEFGHJ", quantity: "1" }))
    ).resolves.toEqual({ ok: false, error: "cart.payment_link_locked" })
  })

  it("brings a quantity change or a removal back to the cart with the note", async () => {
    cart.changeLine.mockRejectedValue(LOCKED())
    await expect(
      changeCartLine(formOf({ line_id: "cali_01JABCDEFGHJ", quantity: "3" }))
    ).rejects.toThrow("redirect:/sepet?hata=cart.payment_link_locked")
    await expect(
      changeCartLine(formOf({ line_id: "cali_01JABCDEFGHJ", remove: "1" }))
    ).rejects.toThrow("redirect:/sepet?hata=cart.payment_link_locked")
  })

  it("says why a code is not taken, or not taken off", async () => {
    cart.addPromotion.mockRejectedValue(LOCKED())
    await expect(applyPromotion(NO_STATE, formOf({ code: "YAZ10" }))).resolves.toEqual({
      ok: false,
      error: "cart.payment_link_locked",
    })
    cart.removePromotion.mockRejectedValue(LOCKED())
    await expect(removeCartPromotion(formOf({ code: "PL-ABCDEFGHJKMN" }))).rejects.toThrow(
      "redirect:/sepet?hata=cart.payment_link_locked"
    )
  })

  it("keeps its other answers as they were", async () => {
    cart.changeLine.mockRejectedValue(new StoreApiError(400, "invalid_data", null))
    await expect(
      changeCartLine(formOf({ line_id: "cali_01JABCDEFGHJ", quantity: "3" }))
    ).rejects.toThrow("redirect:/sepet?hata=cart.update_failed")
    cart.addLine.mockRejectedValue(new StoreApiError(400, "invalid_data", null))
    await expect(
      addToCart(NO_STATE, formOf({ variant_id: "variant_01JABCDEFGHJ", quantity: "1" }))
    ).resolves.toEqual({ ok: false, error: "cart.variant_unavailable" })
  })
})
