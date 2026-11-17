import { asValue } from "@medusajs/framework/awilix"
import {
  ContainerRegistrationKeys,
  Modules,
  createMedusaContainer,
} from "@medusajs/framework/utils"
import type { ProviderPart, RefundLine } from "../../../modules/order-refunds/service"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import { linesMadeInPart, madeInPart, resolveLostPart } from "../made-in-part"
import { checkedNote } from "../made-refund-record"
import { settleRefundByHand } from "../settle-refund-by-hand"
import { closeRefundEntry } from "../steps/order-refund"

const done = (amount: number, id = "t1"): ProviderPart => ({
  transaction_id: id,
  amount,
  state: "done",
})
const sending = (amount: number, id = "t2"): ProviderPart => ({
  transaction_id: id,
  amount,
  state: "sending",
})

// The key a refund with these parts is refused with; undefined when it is one made in part
const refusalOf = (amount: number, parts: readonly ProviderPart[]): string | undefined => {
  try {
    madeInPart(amount, parts)
    return undefined
  } catch (error) {
    return (error as { safeMessage?: string }).safeMessage
  }
}

describe("an iyzico refund made in part: what was made and what is left (D4-1)", () => {
  it("is the sum of the answered parts, the rest what is left", () => {
    expect(madeInPart(30000, [done(24000)])).toEqual({ done: 24000, remainder: 6000 })
    expect(madeInPart(30000, [done(10000, "t1"), done(5000, "t2")])).toEqual({
      done: 15000,
      remainder: 15000,
    })
  })

  it("never counts a part without an answer as not made", () => {
    expect(refusalOf(30000, [done(24000), sending(3000)])).toBe("orders.refund_check_part_unknown")
    expect(refusalOf(30000, [sending(3000)])).toBe("orders.refund_check_part_unknown")
  })

  it.each([
    ["no parts", []],
    ["parts made whole", [done(24000), done(6000, "t2")]],
    ["parts past the amount", [done(31000)]],
    ["nothing given back", [done(0)]],
  ])("is no refund made in part with %s", (_, parts: ProviderPart[]) => {
    expect(refusalOf(30000, parts)).toBe("orders.refund_check_not_partial")
  })

  it("spreads the made part over the lines by what each was to give back, units kept", () => {
    const lines: RefundLine[] = [
      { id: "item_1", kind: "item", quantity: 2, net: 21818 },
      { id: "ship_1", kind: "shipping", quantity: 0, net: 8182 },
    ]

    const made = linesMadeInPart(lines, 24000)

    expect(made.reduce((sum, line) => sum + line.net, 0)).toBe(24000)
    expect(made.map((line) => line.quantity)).toEqual([2, 0])
    // No line gives back more than it was to: the rest of each is free again
    made.forEach((line, index) => {
      expect(line.net).toBeLessThanOrEqual(lines[index]?.net ?? 0)
    })
  })

  it("answers for a lost part: made, it is done; not made, it is taken off (M2)", () => {
    const parts = [done(24000), sending(3000)]

    expect(resolveLostPart(parts, "made")).toEqual([done(24000), done(3000, "t2")])
    expect(resolveLostPart(parts, "not_made")).toEqual([done(24000)])
    expect(resolveLostPart([sending(3000)], "not_made")).toEqual([])
  })

  it("drops a line left with nothing and no units; keeps none for a refund of no lines", () => {
    const lines: RefundLine[] = [
      { id: "item_1", kind: "item", quantity: 0, net: 9999 },
      { id: "ship_1", kind: "shipping", quantity: 0, net: 1 },
    ]

    expect(linesMadeInPart(lines, 1)).toHaveLength(1)
    expect(linesMadeInPart([], 5000)).toEqual([])
  })
})

const REFERENCE = "0123456789abcdef0123456789abcdef"
const raw = (lira: number) => ({ value: String(lira), precision: 20 })

function shopWith(entry: Record<string, unknown>, refunded = 0) {
  const calls: string[] = []
  const track =
    <T>(name: string, value?: T) =>
    () => {
      calls.push(name)
      return Promise.resolve(value)
    }
  const createRefunds = jest.fn<Promise<{ id: string }>, [{ amount: string }]>()
  const updateOrderRefunds = jest.fn(track("updateOrderRefunds"))
  const updatePayment = jest.fn<Promise<undefined>, [{ data?: Record<string, unknown> }]>()
  const addOrderTransactions = jest.fn(track("addOrderTransactions"))
  const payment = {
    id: "pay_01",
    currency_code: "try",
    payment_collection_id: "paycol_01",
    data: { refunds: [] } as Record<string, unknown>,
    captures: [{ raw_amount: raw(330) }],
    refunds: (refunded ? [{ id: "ref_00", raw_amount: raw(refunded) }] : []) as {
      id: string
      raw_amount: ReturnType<typeof raw>
    }[],
  }
  // Medusa's record written: the payment holds it, and its data then names it (`keepRecord`)
  createRefunds.mockImplementation((data: { amount: string }) => {
    calls.push("createRefunds")
    payment.refunds.push({ id: "ref_NEW", raw_amount: raw(Number(data.amount)) })
    return Promise.resolve({ id: "ref_NEW" })
  })
  updatePayment.mockImplementation((update: { data?: Record<string, unknown> }) => {
    calls.push("updatePayment")
    payment.data = { ...payment.data, ...update.data }
    return Promise.resolve(undefined)
  })
  const container = createMedusaContainer()
  container.register({
    [ContainerRegistrationKeys.QUERY]: asValue({
      graph: ({ entity }: { entity: string }) =>
        Promise.resolve({ data: [entity === "payment" ? payment : { payments: [payment] }] }),
    }),
    [Modules.ORDER]: asValue({
      listOrderTransactions: () => Promise.resolve([]),
      addOrderTransactions,
    }),
    [Modules.PAYMENT]: asValue({
      listPayments: () => Promise.resolve([payment]),
      createRefunds,
      updatePayment,
      updatePaymentCollections: jest.fn(),
    }),
    [ORDER_REFUNDS_MODULE]: asValue({
      listOrderRefunds: () => Promise.resolve([entry]),
      updateOrderRefunds,
      saveProviderParts: jest.fn(),
    }),
  })
  return { container, calls, createRefunds, updateOrderRefunds, addOrderTransactions }
}

describe("staff close an iyzico refund made in part, sending nothing (D4-1)", () => {
  const open = {
    id: "oref_01",
    order_id: "order_01",
    payment_id: "pay_01",
    reference: REFERENCE,
    status: "pending",
    amount: 30000,
    lines: [
      { id: "item_1", kind: "item", quantity: 2, net: 21818 },
      { id: "ship_1", kind: "shipping", quantity: 0, net: 8182 },
    ],
    provider_parts: [done(24000)],
  }
  const input = {
    order_id: "order_01",
    reference: REFERENCE,
    actor_id: "user_01",
    outcome: "made_in_part" as const,
  }

  it("records exactly the answered parts in Medusa, then closes the entry at that amount", async () => {
    const shop = shopWith(open)

    expect(await settleRefundByHand(shop.container, input)).toEqual({
      reference: REFERENCE,
      status: "done",
    })
    expect(shop.createRefunds).toHaveBeenCalledWith({
      payment: "pay_01",
      amount: "240.00",
      created_by: "user_01",
      note: checkedNote(REFERENCE),
    })
    expect(shop.addOrderTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ reference_id: "ref_NEW", currency_code: "try" })
    )
    // The entry first rewritten to what was made (cut short, it reads shown), closed last
    expect(shop.updateOrderRefunds).toHaveBeenNthCalledWith(1, {
      id: "oref_01",
      amount: 24000,
      lines: [
        expect.objectContaining({ id: "item_1", quantity: 2 }),
        expect.objectContaining({ id: "ship_1", quantity: 0 }),
      ],
      // Marked with the rewrite: a check cut short keeps it (L1)
      error_code: "checked_made_in_part",
    })
    expect(shop.updateOrderRefunds).toHaveBeenLastCalledWith({
      id: "oref_01",
      status: "done",
      error_code: "checked_made_in_part",
    })
    expect(shop.calls.indexOf("updateOrderRefunds")).toBeLessThan(
      shop.calls.indexOf("createRefunds")
    )
    expect(shop.calls.at(-1)).toBe("updateOrderRefunds")
  })

  it("refuses a part without an answer until staff answer for it, writing nothing", async () => {
    const shop = shopWith({ ...open, provider_parts: [done(24000), sending(3000)] })

    await expect(settleRefundByHand(shop.container, input)).rejects.toMatchObject({
      safeMessage: "orders.refund_lost_part_required",
    })
    expect(shop.createRefunds).not.toHaveBeenCalled()
    expect(shop.updateOrderRefunds).not.toHaveBeenCalled()
  })

  const lostInput = { order_id: "order_01", reference: REFERENCE, actor_id: "user_01" }

  it("closes in part at the answered parts when the lost part was not made (M2)", async () => {
    const shop = shopWith({ ...open, provider_parts: [done(24000), sending(3000)] })

    expect(
      await settleRefundByHand(shop.container, { ...lostInput, lost_part: "not_made" })
    ).toEqual({ reference: REFERENCE, status: "done" })
    expect(shop.createRefunds).toHaveBeenCalledWith(expect.objectContaining({ amount: "240.00" }))
    // The answer written with the rewrite: the lost part taken off
    expect(shop.updateOrderRefunds).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ amount: 24000, provider_parts: [done(24000)] })
    )
  })

  it("counts the lost part when it was made: in part, or whole when it adds up (M2)", async () => {
    const short = shopWith({ ...open, provider_parts: [done(24000), sending(3000)] })
    const whole = shopWith({ ...open, provider_parts: [done(24000), sending(6000)] })

    await settleRefundByHand(short.container, { ...lostInput, lost_part: "made" })
    await settleRefundByHand(whole.container, { ...lostInput, lost_part: "made" })

    expect(short.createRefunds).toHaveBeenCalledWith(expect.objectContaining({ amount: "270.00" }))
    expect(short.updateOrderRefunds).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "done", error_code: "checked_made_in_part" })
    )
    expect(whole.createRefunds).toHaveBeenCalledWith(expect.objectContaining({ amount: "300.00" }))
    expect(whole.updateOrderRefunds).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "done", error_code: "checked_made" })
    )
  })

  it("leaves a flow's refund open with its lost part answered, recording nothing (M1, M2)", async () => {
    const reference = "cancelpay01JABC"
    const shop = shopWith({ ...open, reference, provider_parts: [done(24000), sending(3000)] })
    const saveProviderParts = jest.fn()
    shop.container.register({
      [ORDER_REFUNDS_MODULE]: asValue({
        listOrderRefunds: () =>
          Promise.resolve([{ ...open, reference, provider_parts: [done(24000), sending(3000)] }]),
        updateOrderRefunds: shop.updateOrderRefunds,
        saveProviderParts,
      }),
    })

    expect(
      await settleRefundByHand(shop.container, { ...lostInput, reference, lost_part: "not_made" })
    ).toEqual({ reference, status: "pending" })
    expect(saveProviderParts).toHaveBeenCalledWith(reference, [done(24000)])
    expect(shop.createRefunds).not.toHaveBeenCalled()
    expect(shop.updateOrderRefunds).not.toHaveBeenCalled()
  })

  it.each(["cancelpay01JABC", "returnrreq01JABC"])(
    "leaves a flow's own refund (%s) to its flow, writing nothing (S1)",
    async (reference) => {
      const shop = shopWith({ ...open, reference })

      await expect(
        settleRefundByHand(shop.container, { ...input, reference })
      ).rejects.toMatchObject({ safeMessage: "orders.refund_in_part_flow_owned" })
      expect(shop.createRefunds).not.toHaveBeenCalled()
      expect(shop.updateOrderRefunds).not.toHaveBeenCalled()
    }
  )

  it("closes an edit's refund in part: the edit never makes it again (MF1)", async () => {
    const reference = "editordch01JABC"
    const shop = shopWith({ ...open, reference })

    expect(await settleRefundByHand(shop.container, { ...input, reference })).toEqual({
      reference,
      status: "done",
    })
    expect(shop.createRefunds).toHaveBeenCalledWith(expect.objectContaining({ amount: "240.00" }))
  })

  it("records a flow's rest given back by hand as made, sending nothing; never a panel refund's (SF1)", async () => {
    const reference = "cancelpay01JABC"
    const cancel = shopWith({ ...open, reference })
    const panel = shopWith(open)
    const made = { order_id: "order_01", actor_id: "user_01", outcome: "made" as const }

    expect(await settleRefundByHand(cancel.container, { ...made, reference })).toEqual({
      reference,
      status: "done",
      rest_by_hand: 6000,
    })
    // The whole amount recorded: what iyzico made and what staff gave back by hand
    expect(cancel.createRefunds).toHaveBeenCalledWith(expect.objectContaining({ amount: "300.00" }))
    expect(cancel.updateOrderRefunds).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "done", error_code: "checked_made" })
    )
    await expect(
      settleRefundByHand(panel.container, { ...made, reference: REFERENCE })
    ).rejects.toMatchObject({ safeMessage: "orders.refund_check_partial" })
    expect(panel.createRefunds).not.toHaveBeenCalled()
  })

  it("keeps the mark when the job closes a check cut short, and only a check's (L1)", async () => {
    const cut = shopWith({ ...open, amount: 24000, error_code: "checked_made_in_part" })
    const plain = shopWith({ ...open, error_code: "refund_incomplete" })

    await closeRefundEntry(cut.container, "oref_01", "pay_01")
    await closeRefundEntry(plain.container, "oref_01", "pay_01")

    expect(cut.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "done",
      error_code: "checked_made_in_part",
    })
    expect(plain.updateOrderRefunds).toHaveBeenCalledWith({
      id: "oref_01",
      status: "done",
      error_code: null,
    })
  })

  it("refuses a refund that is no iyzico refund made in part", async () => {
    const paytr = shopWith({ ...open, provider_parts: null })
    const whole = shopWith({ ...open, provider_parts: [done(24000), done(6000, "t2")] })

    for (const shop of [paytr, whole]) {
      await expect(settleRefundByHand(shop.container, input)).rejects.toMatchObject({
        safeMessage: "orders.refund_check_not_partial",
      })
      expect(shop.updateOrderRefunds).not.toHaveBeenCalled()
    }
  })

  it("refuses a made part past what the payment can still give back", async () => {
    const shop = shopWith(open, 100)

    await expect(settleRefundByHand(shop.container, input)).rejects.toMatchObject({
      safeMessage: "orders.refund_exceeds_paid",
    })
    expect(shop.createRefunds).not.toHaveBeenCalled()
    // Refused before the entry is rewritten: it stays as it was, open
    expect(shop.updateOrderRefunds).not.toHaveBeenCalled()
  })
})
