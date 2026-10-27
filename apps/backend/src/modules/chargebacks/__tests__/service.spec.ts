import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { CHARGEBACKS_MODULE } from ".."
import type ChargebacksModuleService from "../service"
import { NEXT_STATUS, isClosed } from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<ChargebacksModuleService>({
  moduleName: CHARGEBACKS_MODULE,
  resolve: "./src/modules/chargebacks",
  testSuite: ({ service }) => {
    it("keeps a dispute open until it is closed won or lost", async () => {
      const created = await service.createChargebacks({
        order_id: "order_1",
        payment_id: "pay_1",
        provider: "paytr",
        amount: 21_000,
        currency_code: "try",
        reason: "not_received",
      })

      expect(created).toMatchObject({ status: "open", closed_at: null })
      expect(NEXT_STATUS.open).toContain("evidence_submitted")
      expect(isClosed("won")).toBe(true)
      expect(isClosed("evidence_submitted")).toBe(false)
    })
  },
})
