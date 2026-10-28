import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { MESSAGING_MODULE } from ".."
import type MessagingModuleService from "../service"

jest.setTimeout(60 * 1000)

moduleIntegrationTestRunner<MessagingModuleService>({
  moduleName: MESSAGING_MODULE,
  resolve: "./src/modules/messaging",
  moduleOptions: { hashKey: randomBytes(32).toString("hex") },
  testSuite: ({ service }) => {
    describe("consent (adr/0036)", () => {
      it("finds an address however it is written, and stores no plaintext", async () => {
        await service.recordConsent({
          channel: "email",
          address: " Ayse.Yilmaz@Example.com ",
          status: "granted",
          source: "checkout",
          customer_id: "cus_1",
        })

        expect(await service.consentOf("email", "ayse.yilmaz@example.com")).toBe("granted")
        expect(await service.consentOf("sms", "ayse.yilmaz@example.com")).toBeNull()
        const [row] = await service.listMessageConsents({})
        expect(row).toMatchObject({ recipient_masked: "ay***@example.com", customer_id: "cus_1" })
        expect(JSON.stringify(row)).not.toMatch(/yilmaz/i)
      })

      it("keeps every change as proof, and the same answer again as nothing", async () => {
        const phone = "0532 123 45 67"
        const first = await service.recordConsent({
          channel: "sms",
          address: phone,
          status: "granted",
          source: "checkout",
        })
        const again = await service.recordConsent({
          channel: "sms",
          address: "+905321234567",
          status: "granted",
          source: "account",
        })
        const withdrawn = await service.recordConsent({
          channel: "sms",
          address: phone,
          status: "revoked",
          source: "panel",
          changed_by: "user_1",
        })

        expect(again).toEqual({ id: first.id, changed: false })
        expect(withdrawn).toEqual({ id: first.id, changed: true })
        expect(await service.consentOf("sms", phone)).toBe("revoked")
        const events = await service.listMessageConsentEvents(
          { consent_id: first.id },
          { order: { changed_at: "ASC" } }
        )
        expect(events.map(({ status, source }) => [status, source])).toEqual([
          ["granted", "checkout"],
          ["revoked", "panel"],
        ])
        const [row] = await service.listMessageConsents({ id: first.id })
        expect(row?.recipient_masked).toBe("+905*** *** ** 67")
      })

      it("refuses what is no address of the channel", async () => {
        await expect(
          service.recordConsent({
            channel: "sms",
            address: "123",
            status: "granted",
            source: "panel",
          })
        ).rejects.toMatchObject({ safeMessage: "messaging.recipient_invalid" })
      })
    })

    describe("suppression (adr/0036)", () => {
      it("lists an address once, keeps the first reason, and lets the shop take it off", async () => {
        const first = await service.suppress({
          channel: "email",
          address: "geri@example.com",
          reason: "bounce",
          source: "resend",
          detail: "Permanent",
        })
        const again = await service.suppress({
          channel: "email",
          address: "GERI@example.com",
          reason: "complaint",
          source: "resend",
        })

        expect(again).toEqual({ id: first.id, created: false })
        expect(await service.isSuppressed("email", "geri@example.com")).toBe(true)
        expect(await service.isSuppressed("email", "baska@example.com")).toBe(false)

        await service.unsuppress(first.id, "user_1")

        expect(await service.isSuppressed("email", "geri@example.com")).toBe(false)
        const [removed] = await service.listMessageSuppressions(
          { id: first.id },
          { withDeleted: true }
        )
        expect(removed).toMatchObject({ reason: "bounce", removed_by: "user_1" })
      })
    })
  },
})
