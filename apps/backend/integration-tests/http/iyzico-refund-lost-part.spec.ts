import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import { iyzicoRefundShop } from "../helpers/iyzico-refunds"

jest.setTimeout(120 * 1000)

/**
 * D4-1 (follow-up of PR #153), review M2: an iyzico refund with a part
 * whose answer was lost is settled by staff's answer for that part, read
 * off iyzico's panel; the server works out the rest from its ledger. Made
 * in part, it closes at what was made; whole, as made; nothing, as not
 * made. Never without that answer; owner and admin only.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const shop = iyzicoRefundShop(api, getContainer)
    const { http, paidOrder, refund, check, entryOf, sentFor, halfway } = shop

    /** Medusa's refunds (lira) of the refund's payment. */
    const medusaRefunds = async (reference: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "payment",
          fields: ["refunds.amount"],
          filters: { id: (await entryOf(reference)).payment_id },
        })
      return (data[0] as { refunds: { amount: unknown }[] }).refunds.map(({ amount }) =>
        Number(amount)
      )
    }
    /** 300 TL asked: the cups' part (240) answered, the shipping's (60) answer lost. */
    const lostHalfway = async (orderId: string, reference: string) => {
      halfway({ drop: true })
      await refund(orderId, { amount: 300, reference })
      expect((await entryOf(reference)).provider_parts).toEqual([
        expect.objectContaining({ amount: 24000, state: "done" }),
        expect.objectContaining({ amount: 6000, state: "sending" }),
      ])
    }

    it("never settles without an answer for the lost part", async () => {
      const { orderId } = await paidOrder()
      const reference = "b0000000000000000000000000000001"
      await lostHalfway(orderId, reference)

      const answers = [
        await check(orderId, reference, { outcome: "made" }),
        await check(orderId, reference, { outcome: "made_in_part" }),
        await check(orderId, reference, { outcome: "made", lost_part: "made" }),
      ]

      expect(answers.map(({ data }) => data.message)).toEqual([
        "orders.refund_lost_part_required",
        "orders.refund_lost_part_required",
        "orders.refund_settle_mode",
      ])
      expect(await entryOf(reference)).toMatchObject({ status: "pending", amount: 30000 })
    })

    it("closes in part at the answered parts when the lost one was not made; the rest refunds anew", async () => {
      const { orderId } = await paidOrder()
      const reference = "b0000000000000000000000000000002"
      await lostHalfway(orderId, reference)

      const checked = await check(orderId, reference, { lost_part: "not_made" })
      const closed = await entryOf(reference)
      const records = await medusaRefunds(reference)
      const [audit] = await eventually(
        async () =>
          (
            await getContainer().resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).listAuditEntries({
              resource_type: "order",
              resource_id: orderId,
              action: "POST /admin/orders/:id/refunds/:reference/settle",
            })
          ).filter((each) => each.outcome === 200),
        (entries) => entries.length > 0
      )
      const rest = await refund(orderId, {
        amount: 60,
        reference: "b0000000000000000000000000000003",
      })

      expect(checked.data.refund).toMatchObject({ status: "done" })
      expect(closed).toMatchObject({
        status: "done",
        amount: 24000,
        error_code: "checked_made_in_part",
        provider_parts: [expect.objectContaining({ amount: 24000, state: "done" })],
      })
      expect(records).toEqual([240])
      // Which answer staff gave for the lost part
      expect(audit?.changes).toMatchObject({ result: { lost_part: "not_made", status: "done" } })
      // The payment refunds again, the lost part's 60 among what is left
      expect(rest.data.refund).toMatchObject({ amount: "60.00" })
      expect(sentFor(reference)).toBe(2)
    })

    it("closes as made when the lost part was made and the parts add up", async () => {
      const { orderId } = await paidOrder()
      const reference = "b0000000000000000000000000000004"
      // All 330 TL: the cups' part (240) answered, the shipping's (90) answer lost
      halfway({ drop: true })
      await refund(orderId, { amount: 330, reference })
      const parts = (await entryOf(reference)).provider_parts

      const checked = await check(orderId, reference, { lost_part: "made" })
      const closed = await entryOf(reference)

      expect(parts).toEqual([
        expect.objectContaining({ amount: 24000, state: "done" }),
        expect.objectContaining({ amount: 9000, state: "sending" }),
      ])
      expect(checked.data.refund).toMatchObject({ status: "done" })
      expect(closed).toMatchObject({
        status: "done",
        amount: 33000,
        error_code: "checked_made",
        provider_parts: [
          expect.objectContaining({ state: "done" }),
          expect.objectContaining({ state: "done" }),
        ],
      })
      expect(await medusaRefunds(reference)).toEqual([330])
      expect(sentFor(reference)).toBe(2)
    })

    it("fails a refund whose only part was not made: its money refunds again", async () => {
      const { orderId } = await paidOrder()
      const reference = "b0000000000000000000000000000005"
      shop.fake().queue("/payment/refund", { drop: true })
      await refund(orderId, { amount: 50, reference })

      const checked = await check(orderId, reference, { lost_part: "not_made" })
      const closed = await entryOf(reference)
      const next = await refund(orderId, {
        amount: 50,
        reference: "b0000000000000000000000000000006",
      })

      expect(checked.data.refund).toMatchObject({ status: "failed" })
      expect(closed).toMatchObject({ status: "failed", provider_parts: [] })
      expect(next.data.refund).toMatchObject({ amount: "50.00" })
    })

    it("takes the answer from owner and admin only", async () => {
      const { orderId } = await paidOrder()
      const reference = "b0000000000000000000000000000007"
      await lostHalfway(orderId, reference)
      const operations = await createAdminUser(http, getContainer(), "operations")

      const denied = await check(orderId, reference, { lost_part: "not_made" }, operations.headers)

      expect(denied.status).toBe(403)
      expect(await entryOf(reference)).toMatchObject({ status: "pending", amount: 30000 })
    })
  },
})
