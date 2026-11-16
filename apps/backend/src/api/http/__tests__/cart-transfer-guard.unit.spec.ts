import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { guardCartTransfer, mayTakeCart } from "../cart-transfer-guard"

const OPEN = { customer_id: null, completed_at: null, metadata: null, customer: null }

/** ADR-0068 slice 3 review M1: which carts may move to the signed-in customer. */
describe("mayTakeCart", () => {
  it("lets a nobody's, a guest's or the caller's own open cart move", () => {
    expect(mayTakeCart(OPEN, "cus_me")).toBe(true)
    expect(
      mayTakeCart({ ...OPEN, customer_id: "cus_guest", customer: { has_account: false } }, "cus_me")
    ).toBe(true)
    expect(
      mayTakeCart({ ...OPEN, customer_id: "cus_me", customer: { has_account: true } }, "cus_me")
    ).toBe(true)
  })

  it("keeps a registered stranger's, a completed, a payment link's or an unknown cart", () => {
    expect(
      mayTakeCart({ ...OPEN, customer_id: "cus_other", customer: { has_account: true } }, "cus_me")
    ).toBe(false)
    // A customer the cart names but nobody can read: not known to be a guest
    expect(mayTakeCart({ ...OPEN, customer_id: "cus_gone", customer: null }, "cus_me")).toBe(false)
    expect(mayTakeCart({ ...OPEN, completed_at: "2026-11-15T10:00:00.000Z" }, "cus_me")).toBe(false)
    expect(mayTakeCart({ ...OPEN, metadata: { qt_payment_link: "plink_1" } }, "cus_me")).toBe(false)
    expect(mayTakeCart(null, "cus_me")).toBe(false)
  })
})

describe("guardCartTransfer", () => {
  const graph = jest.fn()

  async function guarded(cart: unknown, method = "POST") {
    graph.mockResolvedValue({ data: cart ? [cart] : [] })
    const next = jest.fn<undefined, [unknown?]>()
    await guardCartTransfer(
      {
        method,
        params: { id: "cart_1" },
        auth_context: { actor_type: "customer", actor_id: "cus_me" },
        scope: {
          resolve: (key: string) => (key === ContainerRegistrationKeys.QUERY ? { graph } : {}),
        },
      } as unknown as MedusaRequest,
      {} as MedusaResponse,
      next
    )
    return next.mock.calls[0]?.[0] as { type?: string; message?: string } | undefined
  }

  beforeEach(() => {
    graph.mockReset()
  })

  it("lets the transfer run for a cart that may move", async () => {
    expect(await guarded(OPEN)).toBeUndefined()
  })

  it("answers every cart that may not move as one that does not exist", async () => {
    const refusals = [
      await guarded({ ...OPEN, customer_id: "cus_other", customer: { has_account: true } }),
      await guarded({ ...OPEN, completed_at: "2026-11-15T10:00:00.000Z" }),
      await guarded({ ...OPEN, metadata: { qt_payment_link: "plink_1" } }),
      await guarded(null),
    ]
    for (const refusal of refusals) {
      expect({ type: refusal?.type, message: refusal?.message }).toEqual({
        type: "not_found",
        message: "cart.unknown",
      })
    }
  })

  it("reads nothing for another method", async () => {
    expect(await guarded(null, "GET")).toBeUndefined()
    expect(graph).not.toHaveBeenCalled()
  })
})
