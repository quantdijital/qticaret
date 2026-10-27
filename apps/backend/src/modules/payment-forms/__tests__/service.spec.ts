import { randomUUID } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { PAYMENT_FORMS_MODULE } from ".."
import type PaymentFormsModuleService from "../service"

jest.setTimeout(120 * 1000)

const form = {
  provider: "iyzico",
  session_id: "payses_01ABCDEFGHJKMNPQRSTVWXYZ",
  cart_id: "cart_01ABCDEFGHJKMNPQRSTVWXYZ",
  // Fresh per run: no fixed token-like value lives in the repo (docs/04)
  token: randomUUID(),
  expires_at: new Date("2026-10-27T12:30:00Z"),
}

moduleIntegrationTestRunner<PaymentFormsModuleService>({
  moduleName: PAYMENT_FORMS_MODULE,
  resolve: "./src/modules/payment-forms",
  testSuite: ({ service }) => {
    it("keeps a form open until it is closed with what became of it, once", async () => {
      await service.record(form)
      const open = await service.listPaymentForms({ status: "open" })
      await service.close(form.session_id, "paid")
      await service.close(form.session_id, "orphan")
      const [closed] = await service.listPaymentForms({ session_id: form.session_id })

      expect(open).toHaveLength(1)
      expect(closed).toMatchObject({ status: "closed", outcome: "paid" })
    })

    it("records a session's form once", async () => {
      await service.record(form)

      await expect(service.record(form)).rejects.toThrow()
    })
  },
})
