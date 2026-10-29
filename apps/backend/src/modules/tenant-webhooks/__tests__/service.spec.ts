import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { TENANT_WEBHOOKS_MODULE } from ".."
import type TenantWebhooksModuleService from "../service"
import { MAX_STREAK } from "../service"

jest.setTimeout(120 * 1000)

const later = (minutes: number) => new Date(Date.now() + minutes * 60_000)

moduleIntegrationTestRunner<TenantWebhooksModuleService>({
  moduleName: TENANT_WEBHOOKS_MODULE,
  resolve: "./src/modules/tenant-webhooks",
  // A key made for the run: no fixed secret lives in the repo
  moduleOptions: { encryptionKey: randomBytes(32).toString("hex") },
  testSuite: ({ service }) => {
    const subscribe = (events: ("order.placed" | "stock.changed")[]) =>
      service.subscribe({ url: "https://hooks.example.com/qt", events, created_by: null })

    it("keeps the secret sealed and gives it back to the sender only", async () => {
      const { subscription, secret } = await subscribe(["order.placed"])

      expect(secret).toMatch(/^whsec_[0-9a-f]{48}$/)
      expect(subscription.secret_encrypted).not.toContain(secret)
      expect(service.secretOf(subscription.id, subscription.secret_encrypted)).toBe(secret)
    })

    it("queues an event once, for the active subscriptions that take it", async () => {
      await subscribe(["order.placed"])
      await subscribe(["stock.changed"])
      const off = await subscribe(["order.placed"])
      await service.updateWebhookSubscriptions({ id: off.subscription.id, status: "disabled" })

      const first = await service.enqueue("order.placed", "order.placed:o1", { order_id: "o1" })
      const again = await service.enqueue("order.placed", "order.placed:o1", { order_id: "o1" })
      const [due] = await service.claimDue(10)

      expect([first, again]).toEqual([1, 0])
      expect(due).toMatchObject({ event: "order.placed", payload: { order_id: "o1" }, attempts: 0 })
      expect(await service.claimDue(10)).toEqual([])
    })

    it("turns a subscription off after its failures in a row, once, and on again on request", async () => {
      const { subscription } = await subscribe(["order.placed"])
      const outcomes: { stopped: boolean; disabled: boolean }[] = []
      for (let n = 0; n < MAX_STREAK; n++) {
        await service.enqueue("order.placed", `order.placed:o${String(n)}`, { n })
        const [due] = await service.claimDue(1, later(24 * 60 * (n + 1)))
        if (due) {
          outcomes.push(
            await service.markFailed(due, { status: 500, duration_ms: 12, code: "http_500" })
          )
        }
      }
      const [row] = await service.listWebhookSubscriptions({ id: subscription.id })

      expect(outcomes.map((outcome) => outcome.disabled)).toEqual([
        ...Array.from({ length: MAX_STREAK - 1 }, () => false),
        true,
      ])
      expect(row).toMatchObject({ status: "disabled", failure_streak: MAX_STREAK })
      // Off: nothing of it is sent
      await service.enqueue("order.placed", "order.placed:late", {})
      expect(await service.claimDue(10, later(60 * 24 * 30))).toEqual([])

      await service.reactivate(subscription.id)
      expect(await service.listWebhookSubscriptions({ id: subscription.id })).toEqual([
        expect.objectContaining({ status: "active", failure_streak: 0 }),
      ])
    })

    it("remembers how far a feed was read", async () => {
      expect(await service.cursorOf("stock")).toBe(0)
      await service.moveCursor("stock", 42)
      await service.moveCursor("stock", 57)

      expect(await service.cursorOf("stock")).toBe(57)
    })
  },
})
