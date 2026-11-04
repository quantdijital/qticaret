import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeVkn, seededRandom } from "@qticaret/testing"
import { EINVOICE_MODULE } from "../../src/modules/einvoice"
import type EinvoiceModuleService from "../../src/modules/einvoice/service"
import { bootstrapTenant } from "../../src/scripts/bootstrap"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { orderOne, stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront, createTestProduct } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface VatRateView {
  id: string
  code: string | null
  product_type_id: string | null
  product_type_name: string | null
  active: boolean
}

interface VatRates {
  default: { code: string | null; rate: number } | null
  rates: VatRateView[]
}

interface CartLine {
  variant_id: string
  tax_total: number
  tax_lines: { code: string }[]
}

interface DraftLine {
  vat_rate: number
  net: string
  vat: string
  gross: string
}

interface AuditRow {
  action: string
  outcome: number
  changes: { diff?: Record<string, { before?: unknown; after?: unknown }> }
}

/**
 * adr/0007 Ek 2026-11-04: what the owner changes on the KDV screen taxes
 * the cart, the order and the invoice draft, line by line.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("moves the default: products on no type are taxed at it, the old one stays to choose", async () => {
      const container = getContainer()
      const { regionId } = await bootstrapTenant(container)
      const owner = await createAdminUser(http, container)
      const storefront = await createStorefront(container)
      const list = async () =>
        (await http.get<VatRates>("/admin/vat-rates", { headers: owner.headers })).data
      const ten = (await list()).rates.find((rate) => rate.code === "KDV10")

      const moved = await http.post<VatRates>(
        "/admin/vat-rates/default",
        { rate_id: ten?.id },
        { headers: owner.headers }
      )
      const twenty = (await list()).rates.find((rate) => rate.code === "KDV20")
      const plain = await createTestProduct(container, storefront.salesChannelId, {
        handle: "turu-yok",
        price: 110,
      })
      const standard = await createTestProduct(container, storefront.salesChannelId, {
        handle: "genel-oranli",
        price: 120,
        typeId: twenty?.product_type_id ?? "",
      })
      const cart = await http.post<{ cart: { id: string } }>(
        "/store/carts",
        {
          region_id: regionId,
          shipping_address: { country_code: "tr" },
          items: [
            { variant_id: plain, quantity: 1 },
            { variant_id: standard, quantity: 1 },
          ],
        },
        { headers: storefront.headers }
      )
      const { data } = await http.get<{ cart: { items: CartLine[] } }>(
        `/store/carts/${cart.data.cart.id}?fields=*items,*items.tax_lines`,
        { headers: storefront.headers }
      )
      const line = (variant: string) => data.cart.items.find((item) => item.variant_id === variant)
      // The shop's own choice stands on a rerun
      await bootstrapTenant(container)
      const audit = await eventually(
        () =>
          http.get<{ audit_entries: AuditRow[] }>(
            "/admin/audit-log?resource_type=vat_rate&kind=mutation&limit=100",
            { headers: owner.headers }
          ),
        (answer) => answer.data.audit_entries.length > 0
      )

      expect(moved.data.default).toMatchObject({ code: "KDV10", rate: 10 })
      expect(twenty).toMatchObject({ product_type_name: "KDV %20", active: true })
      expect(line(plain)).toMatchObject({ tax_total: 10, tax_lines: [{ code: "KDV10" }] })
      expect(line(standard)).toMatchObject({ tax_total: 20, tax_lines: [{ code: "KDV20" }] })
      expect((await list()).default).toMatchObject({ code: "KDV10" })
      const entry = audit.data.audit_entries.find(
        (row) => row.action === "POST /admin/vat-rates/default" && row.outcome === 200
      )
      expect(entry?.changes.diff).toMatchObject({
        default_code: { before: "KDV20", after: "KDV10" },
        default_rate: { before: 20, after: 10 },
      })
    })

    it("taxes a product on a new rate with it, in the order and in the invoice draft", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const owner = await createAdminUser(http, container)
      const added = await http.post<{ vat_rate: { product_type_id: string; code: string } }>(
        "/admin/vat-rates",
        { rate: 8 },
        { headers: owner.headers }
      )
      const { productId, variantId } = await stockedProduct(container, shop, "sekizli", 10, 108)
      // As the product page saves its KDV group
      await http.post(
        `/admin/products/${productId}`,
        { type_id: added.data.vat_rate.product_type_id },
        { headers: owner.headers }
      )
      await http.post(
        "/admin/platform-settings/invoicing",
        {
          provider: "external",
          trigger: "placed",
          carriers: { manual: { title: "Örnek Kargo A.Ş.", tax_id: fakeVkn(seededRandom(8)) } },
        },
        { headers: owner.headers }
      )
      await http.post(
        "/admin/platform-settings/seo",
        { canonical_host: "magaza.example.com" },
        { headers: owner.headers }
      )

      const orderId = await orderOne(container, shop, variantId)
      const { data: orders } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["items.tax_lines.code", "items.tax_lines.rate"],
        filters: { id: orderId },
      })
      await advanceOrder(container, orderId, "to_ship")
      const invoice = await eventually(
        async () =>
          (
            await container
              .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
              .listInvoices({ order_id: orderId })
          )[0],
        Boolean
      )
      const draft = await http.get<{ draft: { lines: DraftLine[] } | null; problems: string[] }>(
        `/admin/invoices/${invoice?.id ?? ""}/draft`,
        { headers: owner.headers }
      )

      expect(added.data.vat_rate.code).toBe("KDV8")
      const items = (orders[0] as { items: { tax_lines: { code: string; rate: number }[] }[] })
        .items
      expect(items[0]?.tax_lines).toEqual([expect.objectContaining({ code: "KDV8", rate: 8 })])
      expect(draft.data.problems).toEqual([])
      expect(draft.data.draft?.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ vat_rate: 8, net: "100.00", vat: "8.00", gross: "108.00" }),
        ])
      )
    })
  },
})
