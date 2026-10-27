import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { PAYMENT_RECOVERY_MODULE } from ".."
import type PaymentRecoveryModuleService from "../service"
import { MAX_REFUND_ATTEMPTS } from "../service"

jest.setTimeout(120 * 1000)

const orphan = {
  provider: "paytr",
  reference: "payses01ABCDEFGHJKMNPQRSTVWXYZ",
  amount: 21000,
  currency_code: "try",
  test_mode: true,
  reason: "session_gone" as const,
}

moduleIntegrationTestRunner<PaymentRecoveryModuleService>({
  moduleName: PAYMENT_RECOVERY_MODULE,
  resolve: "./src/modules/payment-recovery",
  testSuite: ({ service }) => {
    it("records a payment to give back once, with a refund reference PayTR takes", async () => {
      const first = await service.recordOrphan(orphan)
      const again = await service.recordOrphan(orphan)
      const [stored] = await service.listPaymentRecoveries({ id: first.id })

      expect(first.created).toBe(true)
      expect(again).toEqual({ id: first.id, created: false })
      expect(stored).toMatchObject({
        status: "pending",
        attempts: 0,
        refund_reference: `R${orphan.reference}`,
      })
    })

    it("leaves a refund to the shop after its last try", async () => {
      const { id } = await service.recordOrphan({
        ...orphan,
        reference: "payses01OTHER0000000000000000",
      })

      let status = "pending"
      for (let attempt = 0; attempt < MAX_REFUND_ATTEMPTS; attempt++) {
        status = await service.markAttempt(id, attempt, "refund_locked")
      }

      expect(status).toBe("failed")
      expect((await service.retrievePaymentRecovery(id)).error_code).toBe("refund_locked")
    })
  },
})
