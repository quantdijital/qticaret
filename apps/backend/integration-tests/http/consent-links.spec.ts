import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { resetClientIpSecret } from "../../src/api/http/client-ip"
import { CLIENT_IP_HEADERS, signClientIp } from "../../src/lib/security/client-ip"
import { unsubscribeToken } from "../../src/lib/messaging/unsubscribe"
import { BACK_IN_STOCK_MODULE } from "../../src/modules/back-in-stock"
import type BackInStockModuleService from "../../src/modules/back-in-stock/service"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { sendMessageWorkflow } from "../../src/workflows/messaging/send-message"
import { eventually } from "../helpers/eventually"
import type { HttpClient, HttpResponse, RequestConfig } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

// The links' budget at its real size here (integration tests grow per-IP
// limits a hundredfold): read when the app's middlewares are made
process.env["RATE_LIMIT_RELAXED"] = "0"
// The storefront signs its shopper's address; read lazily by `clientIp`
const IP_SECRET = `consent-links-${randomUUID()}`
process.env["STOREFRONT_IP_SECRET"] = IP_SECRET

const signedAs = (ip: string): Record<string, string> => {
  const time = Math.floor(Date.now() / 1000)
  return {
    [CLIENT_IP_HEADERS.ip]: ip,
    [CLIENT_IP_HEADERS.time]: String(time),
    [CLIENT_IP_HEADERS.signature]: signClientIp(IP_SECRET, ip, time),
  }
}

// An old link's answer as sent: a redirect is not followed to the shop's host
const NO_FOLLOW = { responseType: "text", maxRedirects: 0 } as RequestConfig
const HOST = "magaza.example.com"

/**
 * adr/0038 Ek 2026-11-02: a message's token links open the storefront's
 * pages, which send the token to `/store/...` once the reader confirms;
 * the backend's old pages keep working and send their visitor on.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let storefront: Storefront
    const ENV = [
      "EMAIL_TRANSPORT",
      "RESEND_API_KEY",
      "RESEND_BASE_URL",
      "EMAIL_FROM",
      "BACKEND_URL",
    ]
    const saved: Record<string, string | undefined> = {}
    const messaging = () => getContainer().resolve<MessagingModuleService>(MESSAGING_MODULE)
    const alerts = () => getContainer().resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE)
    const shopHost = (host: string | null) =>
      getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: host }, null)
    const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
      settle(
        http.post<{ status?: string; message?: string }>(path, body, {
          headers: { ...storefront.headers, ...headers },
        })
      )
    const location = (response: HttpResponse<unknown>) => String(response.headers["location"])

    beforeAll(async () => {
      resetClientIpSecret()
      fake = await startFakeMail()
      for (const name of ENV) {
        saved[name] = process.env[name]
      }
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "resend",
        RESEND_API_KEY: fake.apiKey,
        RESEND_BASE_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
        BACKEND_URL: "https://api.magaza.example",
      })
    })

    afterAll(async () => {
      for (const name of ENV) {
        if (saved[name] === undefined) {
          Reflect.deleteProperty(process.env, name)
        } else {
          process.env[name] = saved[name]
        }
      }
      await fake.close()
    })

    beforeEach(async () => {
      storefront = await createStorefront(getContainer())
    })

    afterEach(async () => {
      await shopHost(null)
    })

    it("withdraws a consent by its signed token, the same answer again, never by a forged one", async () => {
      const email = `cikis-${randomUUID()}@example.com`
      await messaging().recordConsent({
        channel: "email",
        address: email,
        status: "granted",
        source: "panel",
        evidence: { note: "Mağazada imzalı form" },
      })
      const hash = messaging().recipientOf("email", email)?.hash ?? ""
      const token = unsubscribeToken(hash)

      const forged = await post("/store/consents/unsubscribe", {
        token: `${"0".repeat(64)}.${token.slice(65)}`,
      })
      const malformed = await post("/store/consents/unsubscribe", { token: "abc" })
      const extra = await post("/store/consents/unsubscribe", { token, email })
      const beforeConfirming = await messaging().consentOf("email", email)
      const left = await post("/store/consents/unsubscribe", { token })
      const again = await post("/store/consents/unsubscribe", { token })
      const events = await messaging().listMessageConsentEvents({ source: "unsubscribe" })

      expect([forged.status, forged.data.message]).toEqual([400, "consents.link_invalid"])
      expect(malformed.status).toBe(400)
      expect(extra.status).toBe(400)
      expect(beforeConfirming).toBe("granted")
      expect([left.status, left.data.status]).toEqual([200, "revoked"])
      expect([again.status, again.data.status]).toEqual([200, "revoked"])
      expect(await messaging().consentOf("email", email)).toBe("revoked")
      // Withdrawn once: the second press changed nothing
      expect(events).toHaveLength(1)
      expect(events[0]?.evidence).toMatchObject({ via: "link" })
    })

    it("records a consent request's answer once, never a used, late or unknown one", async () => {
      const email = `onay-${randomUUID()}@example.com`
      const ask = (status: "granted" | "revoked") =>
        messaging().requestConsent({
          channel: "email",
          address: email,
          status,
          source: "newsletter",
        })

      const granting = await ask("granted")
      const confirmed = await post("/store/consents/confirm", { token: granting.token })
      const replayed = await post("/store/consents/confirm", { token: granting.token })
      const granted = await messaging().consentOf("email", email)

      const late = await ask("revoked")
      await messaging().updateConsentRequests({
        id: late.id,
        expires_at: new Date(Date.now() - 1000),
      })
      const expired = await post("/store/consents/confirm", { token: late.token })
      const revoking = await ask("revoked")
      const withdrawn = await post("/store/consents/confirm", { token: revoking.token })
      const unknown = await post("/store/consents/confirm", { token: "x".repeat(43) })
      const malformed = await post("/store/consents/confirm", { token: "kisa" })

      expect([confirmed.status, confirmed.data.status]).toEqual([200, "granted"])
      expect([replayed.status, replayed.data.message]).toEqual([400, "consents.link_invalid"])
      expect(granted).toBe("granted")
      expect([expired.status, expired.data.message]).toEqual([400, "consents.link_invalid"])
      expect([withdrawn.status, withdrawn.data.status]).toEqual([200, "revoked"])
      expect(await messaging().consentOf("email", email)).toBe("revoked")
      expect(unknown.status).toBe(400)
      expect(malformed.status).toBe(400)
    })

    it("turns a guest's stock alert on once, never a used, late or unknown one", async () => {
      const subscribe = (email: string) =>
        alerts().subscribe({
          variant_id: `variant_${randomUUID()}`,
          product_id: "prod_link",
          email,
          customer_id: null,
          confirmed: false,
        })

      const guest = await subscribe(`stok-${randomUUID()}@example.com`)
      const confirmed = await post("/store/stock-alerts/confirm", { token: guest.token })
      const replayed = await post("/store/stock-alerts/confirm", { token: guest.token })
      const late = await subscribe(`gec-${randomUUID()}@example.com`)
      await alerts().updateStockAlerts({
        id: late.id,
        confirm_expires_at: new Date(Date.now() - 1000),
      })
      const expired = await post("/store/stock-alerts/confirm", { token: late.token })
      const unknown = await post("/store/stock-alerts/confirm", { token: "y".repeat(43) })
      const [row] = await alerts().listStockAlerts({ id: guest.id })

      expect([confirmed.status, confirmed.data.status]).toEqual([200, "active"])
      expect(row?.status).toBe("active")
      expect([replayed.status, replayed.data.message]).toEqual([400, "stock_alerts.link_invalid"])
      expect([expired.status, expired.data.message]).toEqual([400, "stock_alerts.link_invalid"])
      expect(unknown.status).toBe(400)
      expect((await alerts().listStockAlerts({ id: late.id }))[0]?.status).toBe("pending")
    })

    it("keeps the old pages before the shop has a host, and sends them on to its pages after", async () => {
      const token = "z".repeat(43)
      const unsubscribe = unsubscribeToken("d".repeat(64))
      const before = await settle(http.get<string>(`/consents/confirm?t=${token}`, NO_FOLLOW))

      await shopHost(HOST)
      const leave = await settle(http.get<string>(`/unsubscribe?t=${unsubscribe}`, NO_FOLLOW))
      const consent = await settle(http.get<string>(`/consents/confirm?t=${token}`, NO_FOLLOW))
      const stock = await settle(http.get<string>(`/stock-alerts/confirm?t=${token}`, NO_FOLLOW))
      const junk = await settle(
        http.get<string>(`/stock-alerts/confirm?t=${encodeURIComponent("<a>")}`, NO_FOLLOW)
      )
      // A mail client's one-click still goes to the backend and still works
      const email = `tek-tik-${randomUUID()}@example.com`
      await messaging().recordConsent({
        channel: "email",
        address: email,
        status: "granted",
        source: "panel",
        evidence: { note: "Mağazada imzalı form" },
      })
      const oneClick = await settle(
        http.post(
          `/unsubscribe?t=${unsubscribeToken(messaging().recipientOf("email", email)?.hash ?? "")}`,
          "List-Unsubscribe=One-Click",
          { headers: { "content-type": "application/x-www-form-urlencoded" } }
        )
      )

      expect(before.status).toBe(200)
      expect(before.data).toContain("İzninizi onaylayın")
      expect(leave.status).toBe(302)
      expect(location(leave)).toBe(`https://${HOST}/abonelik/cik?t=${unsubscribe}`)
      expect(leave.headers["referrer-policy"]).toBe("no-referrer")
      expect(leave.headers["cache-control"]).toBe("no-store")
      expect([consent.status, location(consent)]).toEqual([
        302,
        `https://${HOST}/abonelik/onay?t=${token}`,
      ])
      expect([stock.status, location(stock)]).toEqual([
        302,
        `https://${HOST}/stok-bildirimi/onay?t=${token}`,
      ])
      expect(location(junk)).toBe(`https://${HOST}/stok-bildirimi/onay`)
      expect(oneClick.status).toBe(200)
      expect(await messaging().consentOf("email", email)).toBe("revoked")
    })

    it("links a message's pages on the storefront once the shop has a host, one-click on the backend", async () => {
      await shopHost(HOST)
      const email = `kampanya-${randomUUID()}@example.com`
      const [customer] = await getContainer()
        .resolve(Modules.CUSTOMER)
        .createCustomers([{ email, first_name: "Ayşe" }])
      await messaging().recordConsent({
        channel: "email",
        address: email,
        status: "granted",
        source: "panel",
        customer_id: customer?.id ?? null,
        evidence: { note: "Mağazada imzalı form" },
      })
      await sendMessageWorkflow(getContainer()).run({
        input: {
          template: "marketing.announcement",
          resource_id: customer?.id ?? "",
          key: `link-${randomUUID()}`,
          extra: { title: "Yeni sezon", body: "Seçili ürünlerde indirim." },
        },
      })
      const subscriber = `bulten-${randomUUID()}@example.com`
      await post("/store/newsletter", { email: subscriber, text_version: "bulten-1" })
      const [campaign] = await eventually(
        () => Promise.resolve(fake.messages.filter(({ to }) => to.includes(email))),
        (found) => found.length > 0
      )
      const [confirm] = await eventually(
        () => Promise.resolve(fake.messages.filter(({ to }) => to.includes(subscriber))),
        (found) => found.length > 0
      )
      const page = /href="(https:\/\/[^"]+\/abonelik\/cik\?t=[^"]+)"/.exec(
        campaign?.html ?? ""
      )?.[1]
      const header = /^<(.+)>$/.exec(campaign?.headers["List-Unsubscribe"] ?? "")?.[1] ?? ""
      const confirmUrl = /href="(https:\/\/[^"]+\/abonelik\/onay\?t=[^"]+)"/.exec(
        confirm?.html ?? ""
      )?.[1]
      const token = new URL(confirmUrl ?? "https://none.example").searchParams.get("t")
      const confirmed = await post("/store/consents/confirm", { token })

      expect(new URL(page ?? "https://none.example").origin).toBe(`https://${HOST}`)
      expect(new URL(header).origin).toBe("https://api.magaza.example")
      expect(new URL(header).pathname).toBe("/unsubscribe")
      expect(new URL(confirmUrl ?? "https://none.example").origin).toBe(`https://${HOST}`)
      expect([confirmed.status, confirmed.data.status]).toEqual([200, "granted"])
      expect(await messaging().consentOf("email", subscriber)).toBe("granted")
    })

    it("counts the store endpoints within the links' budget, per shopper", async () => {
      const shopper = signedAs("203.0.113.40")
      const statuses: number[] = []
      for (let batch = 0; batch < 12; batch++) {
        const answers = await Promise.all(
          Array.from({ length: 50 }, () => post("/store/consents/confirm", { token: "x" }, shopper))
        )
        statuses.push(...answers.map(({ status }) => status))
      }
      const over = await post("/store/stock-alerts/confirm", { token: "y".repeat(43) }, shopper)
      const unsubscribe = await post("/store/consents/unsubscribe", { token: "x" }, shopper)
      const other = await post("/store/consents/confirm", { token: "x" }, signedAs("203.0.113.41"))

      // 600 a minute (the webhook profile), like the backend's own link pages
      expect(statuses.filter((status) => status === 429)).toEqual([])
      expect(over.status).toBe(429)
      expect(over.headers["retry-after"]).toBeDefined()
      expect(unsubscribe.status).toBe(429)
      expect(other.status).toBe(400)
    })
  },
})
