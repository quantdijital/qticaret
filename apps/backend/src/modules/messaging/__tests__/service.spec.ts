import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { MESSAGING_MODULE } from ".."
import type MessagingModuleService from "../service"

jest.setTimeout(60 * 1000)

moduleIntegrationTestRunner<MessagingModuleService>({
  moduleName: MESSAGING_MODULE,
  resolve: "./src/modules/messaging",
  moduleOptions: {
    hashKey: randomBytes(32).toString("hex"),
    encryptionKey: randomBytes(32).toString("hex"),
  },
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

      it("keeps the proof with the change, and lets no one rewrite or remove it", async () => {
        await service.recordConsent({
          channel: "email",
          address: "kanit@example.com",
          status: "granted",
          source: "panel",
          changed_by: "user_1",
          evidence: { note: "Mağazada imzalı form" },
        })
        const [event] = await service.listMessageConsentEvents({ source: "panel" })

        expect(event?.evidence).toEqual({ note: "Mağazada imzalı form" })
        expect(() => service.updateMessageConsentEvents()).toThrow("append-only")
        expect(() => service.deleteMessageConsentEvents()).toThrow("append-only")
        expect(() => service.createMessageConsentEvents()).toThrow("append-only")
      })

      it("withdraws a consent found by its keyed hash, as an unsubscribe link names it", async () => {
        await service.recordConsent({
          channel: "email",
          address: "cik@example.com",
          status: "granted",
          source: "checkout",
        })
        const hash = service.recipientOf("email", "cik@example.com")?.hash ?? ""

        const first = await service.revokeByHash("email", hash, "unsubscribe")
        const again = await service.revokeByHash("email", hash, "unsubscribe")
        const unknown = await service.revokeByHash("email", "0".repeat(64), "unsubscribe")

        expect([first.changed, again.changed, unknown.changed]).toEqual([true, false, false])
        expect(await service.consentOf("email", "cik@example.com")).toBe("revoked")
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

    describe("double opt-in (security review 2026-10-29)", () => {
      it("records a requested consent once its link is confirmed, and only once", async () => {
        const { token } = await service.requestConsent({
          channel: "sms",
          address: "0532 765 43 21",
          status: "granted",
          source: "account",
          customer_id: "cus_9",
          evidence: { text_version: "test" },
        })
        const before = await service.consentOf("sms", "+905327654321")
        const [kept] = await service.listConsentRequests({ customer_id: "cus_9" })

        const confirmed = await service.confirmConsentRequest(token)
        const again = await service.confirmConsentRequest(token)
        const unknown = await service.confirmConsentRequest(`${token}x`)

        expect(before).toBeNull()
        expect(JSON.stringify(kept)).not.toMatch(/765|4321/)
        expect(JSON.stringify(kept)).not.toContain(token)
        expect(confirmed).toEqual({ channel: "sms", status: "granted" })
        expect(again).toBeNull()
        expect(unknown).toBeNull()
        expect(await service.consentOf("sms", "+905327654321")).toBe("granted")
      })

      it("tells a request still on its way from one answered, another's or too old", async () => {
        const asked = {
          channel: "email" as const,
          address: "Bekleyen@Example.com",
          status: "granted" as const,
          customer_id: "cus_7",
        }
        const before = new Date(Date.now() - 60_000)
        const none = await service.consentRequestPending(asked, before)
        const { token } = await service.requestConsent({ ...asked, source: "account" })

        const pending = await service.consentRequestPending(
          { ...asked, address: " bekleyen@example.com" },
          before
        )
        const later = await service.consentRequestPending(asked, new Date(Date.now() + 60_000))
        const other = await service.consentRequestPending(
          { ...asked, customer_id: "cus_8" },
          before
        )
        const revoke = await service.consentRequestPending({ ...asked, status: "revoked" }, before)
        await service.confirmConsentRequest(token)
        const answered = await service.consentRequestPending(asked, before)

        expect(none).toBe(false)
        expect(pending).toBe(true)
        expect(later).toBe(false)
        expect(other).toBe(false)
        expect(revoke).toBe(false)
        expect(answered).toBe(false)
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

    describe("messages not sent (F12.8)", () => {
      const skip = {
        send_key: "order.placed:email:order_1",
        template: "order.placed",
        channel: "email" as const,
        reason: "channel_off" as const,
        resource_type: "order",
        resource_id: "order_1",
        receiver_id: "cus_1",
        recipient_masked: null,
      }

      it("keeps one per send with its latest reason, until it goes out", async () => {
        await service.noteSkip(skip)
        await service.noteSkip({
          ...skip,
          reason: "suppressed",
          recipient_masked: "ay***@example.com",
        })

        const rows = await service.listMessageSkips({ resource_id: "order_1" })
        expect(rows).toEqual([
          expect.objectContaining({ reason: "suppressed", recipient_masked: "ay***@example.com" }),
        ])

        await service.clearSkip(skip.send_key)
        expect(await service.listMessageSkips({ resource_id: "order_1" })).toEqual([])
      })

      it("lets old ones go", async () => {
        await service.noteSkip({
          ...skip,
          send_key: "order.placed:email:order_2",
          resource_id: "order_2",
        })

        expect(await service.pruneSkips(new Date(Date.now() - 60_000))).toBe(0)
        expect(await service.pruneSkips(new Date(Date.now() + 60_000))).toBe(1)
      })
    })
  },
})
