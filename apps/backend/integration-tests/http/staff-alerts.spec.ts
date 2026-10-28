import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import seoDigest from "../../src/jobs/seo-digest"
import { SEO_ADVISOR_MODULE } from "../../src/modules/seo-advisor"
import type SeoAdvisorModuleService from "../../src/modules/seo-advisor/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { PAYTR_ADDRESS, readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const STAFF = ["sahip@magaza.example", "depo@magaza.example"]

/** F9.7 (adr/0036): the shop's own alerts by e-mail to its staff list, beside the bell. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let productId: string
    let admin: { headers: Record<string, string> }

    const mailsTo = (address: string) =>
      fake.messages.filter(({ to }) => to.includes(address)).map(({ template }) => template)
    const settings = (body: Record<string, unknown>) =>
      http.post("/admin/platform-settings/notifications", body, { headers: admin.headers })

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      productId = cup.productId
      admin = await createAdminUser(http, container)
      await http.post(
        "/admin/platform-settings/bank_transfer",
        {
          enabled: true,
          account_holder: "Örnek Ticaret A.Ş.",
          bank_name: "Örnek Bankası",
          iban: "TR330006100519786457841326",
          deadline_hours: 24,
        },
        { headers: admin.headers }
      )
      await settings({ staff_emails: STAFF })
      fake.messages.length = 0
    })

    it("tells every listed staff member of an order, and of a bank transfer to confirm, in the bell too", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      await http.post(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: "pp_bank-transfer_bank-transfer" },
        { headers: storefront.headers }
      )
      const { data } = await http.post<{ order: { id: string; email: string } }>(
        `/store/carts/${cartId}/complete`,
        {},
        { headers: storefront.headers }
      )
      await eventually(
        () => Promise.resolve(STAFF.flatMap(mailsTo)),
        (templates) => templates.length === 4
      )
      const bell = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "feed", resource_id: data.order.id })
      const shopper = fake.messages.find(({ template }) => template === "order.placed")

      for (const address of STAFF) {
        expect(mailsTo(address).sort()).toEqual(["staff.bank_transfer", "staff.new_order"])
      }
      expect(bell).toHaveLength(1)
      expect(bell[0]?.data).toMatchObject({ kind: "bank_transfer_pending" })
      expect(shopper?.text).toContain("IBAN: TR33 0006 1005 1978 6457 8413 26")
    })

    it("sends no alert the shop turned off, and none without a staff list", async () => {
      await settings({ alert_new_order: false })
      await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        email: "musteri@example.com",
      })
      await eventually(
        () => Promise.resolve(mailsTo("musteri@example.com")),
        (found) => found.length > 0
      )
      await new Promise((resolve) => setTimeout(resolve, 300))

      expect(STAFF.flatMap(mailsTo)).toEqual([])
    })

    it("sends Monday's SEO digest once a week", async () => {
      // The product's own assessment, made when it was saved, set to a poor score
      const advisor = getContainer().resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)
      const [assessment] = await eventually(
        () => advisor.listSeoAssessments({ entity_type: "product", entity_id: productId }),
        (rows) => rows.length > 0
      )
      await advisor.updateSeoAssessments({
        id: assessment?.id ?? "",
        score: 41,
        grade: "poor",
        critical: 1,
      })

      await seoDigest(getContainer())
      await seoDigest(getContainer())
      const digest = fake.messages.find(
        ({ template, to }) => template === "staff.seo_digest" && to.includes(STAFF[0] ?? "")
      )

      expect(STAFF.flatMap(mailsTo)).toEqual(["staff.seo_digest", "staff.seo_digest"])
      expect(digest?.subject).toMatch(/^Haftalık SEO özeti: ortalama \d+\/100$/)
      expect(digest?.text).toMatch(/kupa-\d+: 41\/100/)
    })
  },
})
