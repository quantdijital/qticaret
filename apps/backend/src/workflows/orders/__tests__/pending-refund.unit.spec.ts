import { asValue } from "@medusajs/framework/awilix"
import { Modules, createMedusaContainer } from "@medusajs/framework/utils"
import { dropPendingRefund, namesPendingRefund } from "../steps/pending-refund"

function paymentsWith(data: Record<string, unknown> | null) {
  const updatePayment = jest.fn()
  const container = createMedusaContainer()
  container.register({
    [Modules.PAYMENT]: asValue({
      listPayments: () => Promise.resolve([{ id: "pay_01", data }]),
      updatePayment,
    }),
  })
  return { container, updatePayment }
}

describe("a refund's name is taken off the payment's data (PR #149 review D1)", () => {
  it("writes the name as null alone: Medusa merges the update into the stored data", async () => {
    const { container, updatePayment } = paymentsWith({
      merchant_oid: "payses01A",
      refunds: [{ reference_no: "x", amount: 1 }],
      pending_refund: { reference_no: "x", amount: 1 },
    })

    expect(await dropPendingRefund(container, "pay_01")).toBe(true)
    expect(updatePayment).toHaveBeenCalledWith({ id: "pay_01", data: { pending_refund: null } })
  })

  it("writes nothing for a payment naming none", async () => {
    for (const data of [{ pending_refund: null }, {}, null]) {
      const { container, updatePayment } = paymentsWith(data)

      expect(await dropPendingRefund(container, "pay_01")).toBe(false)
      expect(updatePayment).not.toHaveBeenCalled()
    }
    expect(namesPendingRefund({ pending_refund: { reference_no: "x", amount: 1 } })).toBe(true)
  })
})
