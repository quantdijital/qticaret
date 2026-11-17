import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { WEBHOOK_EVENTS_MODULE } from ".."
import type WebhookEventsModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<WebhookEventsModuleService>({
  moduleName: WEBHOOK_EVENTS_MODULE,
  resolve: "./src/modules/webhook-events",
  testSuite: ({ service }) => {
    it("handles an event once: a repeat after it is processed is only acknowledged", async () => {
      const first = await service.claim("paytr", "payses01A:success", { amount: 21000 })
      await service.markProcessed(first.id)
      const repeat = await service.claim("paytr", "payses01A:success", { amount: 21000 })

      expect(first).toMatchObject({ state: "new", attempts: 1 })
      expect(repeat).toEqual({ id: first.id, state: "done", attempts: 1 })
    })

    it("lets one of two racing deliveries handle the event; the other comes back later", async () => {
      const claims = await Promise.all([
        service.claim("paytr", "payses01B:success", {}),
        service.claim("paytr", "payses01B:success", {}),
      ])

      expect(claims.map(({ state }) => state).sort()).toEqual(["busy", "new"])
      expect(await service.listWebhookEvents({ event_key: "payses01B:success" })).toHaveLength(1)
    })

    it("tries a failed event again, counting the attempts, and keeps only its error code", async () => {
      const first = await service.claim("paytr", "payses01C:success", {})
      await service.markFailed(first.id, "cart_lock_timeout")
      const again = await service.claim("paytr", "payses01C:success", {})
      const [stored] = await service.listWebhookEvents({ id: first.id })

      expect(again).toEqual({ id: first.id, state: "retry", attempts: 2 })
      expect(stored).toMatchObject({ status: "processing", attempts: 2, error_code: null })
    })

    it("keeps providers apart", async () => {
      const paytr = await service.claim("paytr", "same-key", {})
      const iyzico = await service.claim("iyzico", "same-key", {})

      expect([paytr.state, iyzico.state]).toEqual(["new", "new"])
    })

    it("counts every take of a result without a notice, two at once included", async () => {
      const first = await service.countTake("iyzico", "payses_01E:paid")
      const racing = await Promise.all([
        service.countTake("iyzico", "payses_01E:paid"),
        service.countTake("iyzico", "payses_01E:paid"),
      ])
      const other = await service.countTake("iyzico", "payses_01F:paid")
      const [stored] = await service.listWebhookEvents({ event_key: "payses_01E:paid" })

      expect(first).toBe(1)
      expect(racing.sort()).toEqual([2, 3])
      expect(other).toBe(1)
      expect(stored).toMatchObject({ provider: "iyzico", attempts: 3 })
    })

    it("gives a failed event to one of two racing retries", async () => {
      const first = await service.claim("paytr", "payses01D:success", {})
      await service.markFailed(first.id, "processing_failed")

      const retries = await Promise.all([
        service.claim("paytr", "payses01D:success", {}),
        service.claim("paytr", "payses01D:success", {}),
      ])

      expect(retries.map(({ state }) => state).sort()).toEqual(["busy", "retry"])
    })
  },
})
