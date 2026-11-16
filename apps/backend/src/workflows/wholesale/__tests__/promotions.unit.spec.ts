import type { MedusaContainer } from "@medusajs/framework/types"
import { wholesalePromotionContext } from "../promotions"
import { NOT_WHOLESALE, wholesaleShopper } from "../shopper"

jest.mock("../shopper", () => ({
  ...jest.requireActual<Record<string, unknown>>("../shopper"),
  wholesaleShopper: jest.fn(),
}))

const shopper = wholesaleShopper as jest.MockedFunction<typeof wholesaleShopper>
const scope = {} as MedusaContainer

const cart = {
  customer_id: "cus_1",
  metadata: null,
  items: [{ id: "item_1", adjustments: [{ id: "adj_1", code: "KIS" }] }],
  shipping_methods: [{ id: "sm_1", adjustments: [] }],
}

beforeEach(() => {
  jest.clearAllMocks()
  shopper.mockResolvedValue({ active: true, vat_exclusive: true, min_quantity: null })
})

/** ADR-0068 §6, Ek 2026-11-16: no campaign or code on an active wholesaler's cart. */
describe("wholesalePromotionContext", () => {
  it("gives an active wholesaler's cart to the rules as shells, its adjustments to come off", async () => {
    const context = await wholesalePromotionContext(scope, cart)
    expect(context?.items).toEqual([
      expect.objectContaining({ id: "item_1", is_discountable: false }),
    ])
    expect(context?.items[0]?.["adjustments"]).toEqual([{ id: "adj_1", code: "KIS" }])
    expect(context?.shipping_methods).toEqual([
      expect.objectContaining({ id: "sm_1", subtotal: 0 }),
    ])
    expect(shopper).toHaveBeenCalledWith(scope, "cus_1")
  })

  it("leaves every other cart as Medusa reads it", async () => {
    await expect(
      wholesalePromotionContext(scope, { ...cart, customer_id: null })
    ).resolves.toBeUndefined()
    await expect(
      wholesalePromotionContext(scope, { ...cart, metadata: { qt_payment_link: "plink_1" } })
    ).resolves.toBeUndefined()
    await expect(wholesalePromotionContext(scope, null)).resolves.toBeUndefined()
    expect(shopper).not.toHaveBeenCalled()
    // A closed wholesaler, or the shop's flag off: retail, its campaigns with it
    shopper.mockResolvedValue(NOT_WHOLESALE)
    await expect(wholesalePromotionContext(scope, cart)).resolves.toBeUndefined()
  })
})
