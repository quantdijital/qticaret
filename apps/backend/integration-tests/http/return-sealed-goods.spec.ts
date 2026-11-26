import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeAras, startFakeMail } from "@qticaret/testing"
import type { FakeAras, FakeMail } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import { carrierOrder, carrierShop, shipOrder } from "../helpers/carrier"
import type { CarrierShop } from "../helpers/carrier"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const MINUTE = 60 * 1000
const SHOPPER = "ambalaj.alici@example.com"

interface ProductExtension {
  withdrawal_excluded?: boolean
  kind?: string
}

/**
 * adr/0032 Ek 2026-11-03, adr/0052 Ek 2026-11-03: a physical product's
 * withdrawal mark is a sealed good (MSY md. 15/1-ç). The storefront reads
 * the mark and the kind before the purchase (md. 5/1-h); units refused at
 * receipt are told to the shopper by e-mail (`return.refused`), the only
 * message when nothing else came back.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeAras
    let mail: FakeMail
    let setup: CarrierShop
    let store: Storefront
    let customer: TestCustomer
    let clock = Date.now()

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const staff = <T>(path: string, body: unknown = {}) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))
    const productId = async () => {
      const { data } = await query().graph({
        entity: "product_variant",
        fields: ["product_id"],
        filters: { id: setup.variantId },
      })
      return (data[0] as { product_id: string }).product_id
    }
    /** A sealed good's order of the customer's, paid, shipped and delivered; asked back and approved. */
    const approvedReturn = async (quantity: number) => {
      await staff(`/admin/products/${await productId()}/catalog`, { withdrawal_excluded: true })
      const orderId = await carrierOrder(getContainer(), setup, setup.variantId, quantity)
      const { data } = await query().graph({
        entity: "order",
        fields: ["items.id", "payment_collections.payments.id"],
        filters: { id: orderId },
      })
      const row = data[0] as {
        items: { id: string }[]
        payment_collections: { payments: { id: string }[] }[]
      }
      await staff(`/admin/payments/${row.payment_collections[0]?.payments[0]?.id ?? ""}/capture`)
      await shipOrder(http, setup, orderId)
      for (let step = 0; step < 4; step += 1) {
        clock += 30 * MINUTE
        await pollShipments(getContainer(), new Date(clock))
      }
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(orderId, { customer_id: customer.id, email: SHOPPER })
      const lineId = row.items[0]?.id ?? ""
      const asked = await settle(
        http.post<{ return_request: { id: string } }>(
          `/store/orders/${orderId}/returns`,
          { items: [{ line_item_id: lineId, quantity }], reason: "changed_mind" },
          { headers: customer.headers }
        )
      )
      const id = asked.data.return_request.id
      expect((await staff(`/admin/return-requests/${id}/approve`)).status).toBe(200)
      return { id, lineId }
    }
    const returnMails = () =>
      mail.messages.filter(
        ({ to, template }) => to.includes(SHOPPER) && template.startsWith("return.")
      )

    beforeAll(async () => {
      fake = await startFakeAras()
      mail = await startFakeMail()
      process.env["ARAS_BASE_URL"] = fake.url
      process.env["EMAIL_TRANSPORT"] = "mailpit"
      process.env["MAILPIT_URL"] = mail.url
      process.env["EMAIL_FROM"] = "bildirim@platform.example"
    })

    afterAll(async () => {
      for (const name of ["ARAS_BASE_URL", "EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await Promise.all([fake.close(), mail.close()])
    })

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      setup = await carrierShop(http, getContainer(), fake)
      store = await createStorefront(getContainer())
      customer = await registerCustomer(http, store)
      mail.messages.length = 0
    })

    it("shows the storefront a product's withdrawal mark and kind, none of its other columns", async () => {
      const id = await productId()
      await staff(`/admin/products/${id}/catalog`, { withdrawal_excluded: true })
      const fields = "id,+product_extension.withdrawal_excluded,+product_extension.kind"

      const own = await settle(
        http.get<{ product: { product_extension: ProductExtension | null } }>(
          `/store/products/${id}?fields=${fields}`,
          { headers: store.headers }
        )
      )
      const listed = await settle(
        http.get<{ products: { id: string; product_extension: ProductExtension | null }[] }>(
          `/store/products?id=${id}&fields=${fields}`,
          { headers: store.headers }
        )
      )
      const other = await settle(
        http.get(`/store/products/${id}?fields=+product_extension.successor_product_id`, {
          headers: store.headers,
        })
      )
      const throughLine = await settle(
        http.get(`/store/products/${id}?fields=variants.product.product_extension.kind`, {
          headers: store.headers,
        })
      )

      expect(own.status).toBe(200)
      // A physical product's mark: a sealed good, returnable while unopened (md. 15/1-ç)
      expect(own.data.product.product_extension).toEqual({
        id: expect.any(String) as unknown,
        withdrawal_excluded: true,
        kind: "physical",
      })
      expect(listed.status).toBe(200)
      expect(listed.data.products[0]?.product_extension).toMatchObject({
        withdrawal_excluded: true,
        kind: "physical",
      })
      expect([other.status, throughLine.status]).toEqual([400, 400])
    })

    it("tells the shopper the units refused, why, and that nothing else is coming", async () => {
      const { id, lineId } = await approvedReturn(1)

      const received = await staff<{ refund_error: string | null }>(
        `/admin/return-requests/${id}/receive`,
        { refused: [{ line_item_id: lineId, quantity: 1 }] }
      )
      const mails = await eventually(
        () => Promise.resolve(returnMails()),
        (found) => found.some(({ template }) => template === "return.refused")
      )
      const refused = mails.find(({ template }) => template === "return.refused")

      expect(received.status).toBe(200)
      expect(refused?.subject).toMatch(/^İadenizde kabul edilmeyen ürünler var \(#\d+\)$/)
      expect(refused?.text).toMatch(/1 × bicak-/)
      expect(refused?.text).toContain("koruyucu ambalajı açılmış")
      expect(refused?.text).toContain("bedeli iade edilmez")
      expect(refused?.text).toContain("mağazadan teslim alabilirsiniz")
      expect(refused?.text).not.toContain("ayrıca iade edilecek")
      // Nothing was taken back: no refund, so no refund message
      expect(mails.map(({ template }) => template)).not.toContain("return.refunded")
    })

    it("tells the refused units apart from the refund of the rest", async () => {
      const { id, lineId } = await approvedReturn(2)

      const received = await staff<{ refund_error: string | null }>(
        `/admin/return-requests/${id}/receive`,
        {
          items: [{ line_item_id: lineId, quantity: 1 }],
          refused: [{ line_item_id: lineId, quantity: 1 }],
        }
      )
      const mails = await eventually(
        () => Promise.resolve(returnMails()),
        (found) =>
          ["return.refused", "return.refunded"].every((name) =>
            found.some(({ template }) => template === name)
          )
      )
      const by = (name: string) => mails.find(({ template }) => template === name)

      expect(received.data.refund_error).toBeNull()
      expect(by("return.refused")?.text).toContain("diğer ürünlerin ödemesi ayrıca iade edilecek")
      expect(by("return.refunded")?.text).toContain(
        "Kabul edilmeyen ürünler (koruyucu ambalajı açılmış) bu tutara dahil değildir."
      )
      // The sound unit and the order's shipping (md. 12/1)
      expect(by("return.refunded")?.text).toContain("₺180,00")
    })
  },
})
