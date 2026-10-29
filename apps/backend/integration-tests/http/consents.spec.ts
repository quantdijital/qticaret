import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { sendMessageWorkflow } from "../../src/workflows/messaging/send-message"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface ConsentsBody {
  consents: Record<
    "email" | "sms",
    { address: boolean; consent: { status: string; source: string } | null }
  >
}

/**
 * F10 (adr/0038 §1–2): consent given in the account and at checkout,
 * kept with its proof, and a campaign e-mail's one-click way out.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    const MAIL_ENV = ["EMAIL_TRANSPORT", "RESEND_API_KEY", "RESEND_BASE_URL", "EMAIL_FROM"]
    const backend = process.env["BACKEND_URL"]
    const messaging = () => getContainer().resolve<MessagingModuleService>(MESSAGING_MODULE)

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "resend",
        RESEND_API_KEY: fake.apiKey,
        RESEND_BASE_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
        // A confirmation's link is a backend page
        BACKEND_URL: "https://api.magaza.example",
      })
    })

    afterAll(async () => {
      for (const name of MAIL_ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      if (backend === undefined) {
        Reflect.deleteProperty(process.env, "BACKEND_URL")
      } else {
        process.env["BACKEND_URL"] = backend
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120))
        .variantId
    })

    it("records a customer's own answer from the account, with the text's version", async () => {
      const customer = await registerCustomer(http, storefront)
      const give = await http.post<ConsentsBody>(
        "/store/customers/me/consents",
        { channel: "email", status: "granted", text_version: "2026-10" },
        { headers: customer.headers }
      )
      const read = await http.get<ConsentsBody>("/store/customers/me/consents", {
        headers: customer.headers,
      })
      const anonymous = await settle(
        http.get("/store/customers/me/consents", { headers: storefront.headers })
      )
      const [event] = await messaging().listMessageConsentEvents({ source: "account" })

      expect(give.data.consents.email.consent).toMatchObject({
        status: "granted",
        source: "account",
      })
      expect(read.data.consents.email.consent?.status).toBe("granted")
      expect(JSON.stringify(read.data)).not.toContain(customer.email)
      expect(anonymous.status).toBe(401)
      expect(event?.evidence).toMatchObject({ text_version: "2026-10" })
      expect(JSON.stringify(event?.evidence)).not.toContain("127.0.0.1")
    })

    it("records the boxes ticked at checkout for the order's address, an unticked one not at all", async () => {
      const email = `odeme-${String(Date.now())}@example.com`
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: { ...PAYTR_ADDRESS, phone: "05321234567" },
        email,
        beforeComplete: async (cartId) => {
          await http.post(
            `/store/carts/${cartId}/consents`,
            { email: true, sms: false, text_version: "2026-10" },
            { headers: storefront.headers }
          )
        },
      })

      // The address was only typed: its owner confirms from it before anything is recorded
      const mail = await eventually(
        () => Promise.resolve(fake.messages.find(({ to }) => to.includes(email))),
        (found) => found !== undefined
      )
      const beforeConfirming = await messaging().consentOf("email", email)
      const token = /consents\/confirm\?t=([\w-]{43})/.exec(mail?.html ?? "")?.[1] ?? ""
      const page = await settle(
        http.get<string>(`/consents/confirm?t=${token}`, { responseType: "text" })
      )
      const afterOpening = await messaging().consentOf("email", email)
      const confirmed = await settle(
        http.post<string>(`/consents/confirm?t=${token}`, undefined, { responseType: "text" })
      )
      const again = await settle(
        http.post<string>(`/consents/confirm?t=${token}`, undefined, { responseType: "text" })
      )
      const [event] = await messaging().listMessageConsentEvents({ source: "checkout" })

      expect(mail?.template).toBe("consent_confirm")
      expect(beforeConfirming).toBeNull()
      // A mail scanner opening the link records nothing: the page asks
      expect(page.status).toBe(200)
      expect(afterOpening).toBeNull()
      expect(confirmed.status).toBe(200)
      expect(again.status).toBe(400)
      expect(await messaging().consentOf("email", email)).toBe("granted")
      expect(await messaging().consentOf("sms", "05321234567")).toBeNull()
      expect(event?.evidence).toMatchObject({
        order_id: orderId,
        text_version: "2026-10",
        confirmed_at: expect.any(String) as unknown,
      })
      expect(await messaging().listCheckoutConsents({})).toHaveLength(0)
    })

    it("asks a typed phone's owner before its consent counts, from the account", async () => {
      const customer = await registerCustomer(http, storefront)
      const phone = `0532${String(Date.now()).slice(-7)}`
      await getContainer().resolve(Modules.CUSTOMER).updateCustomers(customer.id, { phone })
      const asked = await http.post<ConsentsBody & { pending: string | null }>(
        "/store/customers/me/consents",
        { channel: "sms", status: "granted", text_version: "2026-10" },
        { headers: customer.headers }
      )
      const [request] = await messaging().listConsentRequests({ customer_id: customer.id })

      expect(asked.status).toBe(202)
      expect(asked.data.pending).toBe("sms")
      expect(await messaging().consentOf("sms", phone)).toBeNull()
      expect(request).toMatchObject({ channel: "sms", status: "granted", confirmed_at: null })
      expect(JSON.stringify(request)).not.toContain(phone)
    })

    it("gives a campaign e-mail a one-click way out that withdraws the consent", async () => {
      const backend = process.env["BACKEND_URL"]
      process.env["BACKEND_URL"] = "https://api.magaza.example"
      try {
        const admin = await createAdminUser(http, getContainer())
        const email = `kampanya-${String(Date.now())}@example.com`
        const [customer] = await getContainer()
          .resolve(Modules.CUSTOMER)
          .createCustomers([{ email, first_name: "Ayşe" }])
        const customerId = customer?.id ?? ""
        await http.post(
          `/admin/customers/${customerId}/consents`,
          { channel: "email", status: "granted", evidence: "Mağazada imzalı form" },
          { headers: admin.headers }
        )
        const announce = (key: string) =>
          sendMessageWorkflow(getContainer()).run({
            input: {
              template: "marketing.announcement",
              resource_id: customerId,
              key,
              extra: { title: "Yeni sezon", body: "Seçili ürünlerde indirim." },
            },
          })

        await announce("u1")
        const [mail] = await eventually(
          () => Promise.resolve(fake.messages.filter(({ to }) => to.includes(email))),
          (found) => found.length > 0
        )
        const header = mail?.headers["List-Unsubscribe"] ?? ""
        const link = new URL(/^<(.+)>$/.exec(header)?.[1] ?? "https://none.example")
        const path = `${link.pathname}${link.search}`
        const opened = await settle(http.get<string>(path, { responseType: "text" }))
        const stillGranted = await messaging().consentOf("email", email)
        const forged = await settle(
          http.post(`${link.pathname}?t=${"0".repeat(64)}.${"A".repeat(43)}`, "")
        )
        const left = await settle(
          http.post(path, "List-Unsubscribe=One-Click", {
            headers: { "content-type": "application/x-www-form-urlencoded" },
          })
        )
        const after = await announce("u2")

        expect(link.origin).toBe("https://api.magaza.example")
        expect(mail?.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
        expect(mail?.html).toContain("Bu iletileri almak istemiyorum")
        expect(opened.status).toBe(200)
        expect(opened.data).toContain("Çıkışı onayla")
        expect(stillGranted).toBe("granted")
        expect(forged.status).toBe(400)
        expect(left.status).toBe(200)
        expect(await messaging().consentOf("email", email)).toBe("revoked")
        expect(after.result).toMatchObject({ email: "no_consent" })
      } finally {
        if (backend === undefined) {
          Reflect.deleteProperty(process.env, "BACKEND_URL")
        } else {
          process.env["BACKEND_URL"] = backend
        }
      }
    })
  },
})
