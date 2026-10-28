import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface View {
  available: boolean
  sender: string | null
  domain: { name: string; status: string; records: { record: string }[] } | null
  dmarc: { name: string; value: string }
}

/** F9.6 (adr/0036): the shop's own sender domain, verified at Resend before e-mail goes from it. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let shop: StockShop
    let variantId: string
    let admin: { headers: Record<string, string> }
    const PATH = "/admin/messaging/sender-domain"

    const send = <T>(method: "get" | "post" | "delete", path: string, body?: unknown) =>
      settle(
        method === "post"
          ? http.post<T & { message?: string }>(path, body ?? {}, { headers: admin.headers })
          : http[method]<T & { message?: string }>(path, { headers: admin.headers })
      )
    const orderMailFrom = async (email: string) => {
      await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        email,
      })
      const [mail] = await eventually(
        () => Promise.resolve(fake.messages.filter(({ to }) => to.includes(email))),
        (found) => found.length > 0
      )
      return mail?.from
    }

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "resend",
        RESEND_API_KEY: fake.apiKey,
        RESEND_BASE_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of ["EMAIL_TRANSPORT", "RESEND_API_KEY", "RESEND_BASE_URL", "EMAIL_FROM"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120))
        .variantId
      admin = await createAdminUser(http, container)
      fake.messages.length = 0
    })

    it("sends from the platform until the shop's domain is verified, then from the shop's own", async () => {
      const empty = await send<View>("get", PATH)
      const added = await send<View>("post", PATH, { name: "Magaza.Example.com" })
      const twice = await send<View>("post", PATH, { name: "baska.example.com" })
      // The second domain was added at Resend, then withdrawn when it could not be kept
      const atResend = fake.domains.size
      const beforeVerified = await orderMailFrom("once@example.com")
      const pending = await send<View>("post", `${PATH}/check`)
      fake.publish("magaza.example.com")
      const verified = await send<View>("post", `${PATH}/check`)
      const afterVerified = await orderMailFrom("sonra@example.com")
      const removed = await send<View>("delete", PATH)

      expect(empty.data).toMatchObject({
        available: true,
        sender: "bildirim@platform.example",
        domain: null,
      })
      expect(added.status).toBe(201)
      expect(added.data.domain).toMatchObject({ name: "magaza.example.com", status: "not_started" })
      expect(added.data.domain?.records.map(({ record }) => record)).toEqual(["DKIM", "SPF", "SPF"])
      expect(added.data.dmarc).toMatchObject({ name: "_dmarc", value: "v=DMARC1; p=none;" })
      expect(twice.data.message).toBe("messaging.domain_exists")
      expect(atResend).toBe(1)
      expect(beforeVerified).toBe('"Medusa Store" <bildirim@platform.example>')
      expect(pending.data.domain?.status).toBe("pending")
      expect(verified.data).toMatchObject({ sender: "bildirim@magaza.example.com" })
      expect(afterVerified).toBe('"Medusa Store" <bildirim@magaza.example.com>')
      expect(removed.data).toMatchObject({ sender: "bildirim@platform.example", domain: null })
      expect(fake.domains.size).toBe(0)
    })
  },
})
