import { randomBytes } from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeVkn, seededRandom } from "@qticaret/testing"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import { checkout, shippedCart } from "../helpers/gift-cards"
import { giftCardProduct } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

interface InvoiceRow {
  id: string
  status: string
  total: string
  advance: string | null
  waived_reason: string | null
}

interface Draft {
  lines: { description: string }[]
  totals: { gross: string }
  internet_sale: { payment: string }
}

/**
 * A gift card is a payment instrument (the shop's accountant,
 * docs/mali-musavir-sorulari.md 3.2, the owner 2026-11-03): its sale is an
 * advance on no invoice; the purchase it pays for is invoiced in full.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const flag = (enabled: boolean) =>
      settle(
        http.post("/admin/features/promotions.gift_cards", { enabled }, { headers: admin.headers })
      )
    const invoicesOf = async (orderId: string) =>
      (
        await http.get<{ invoices: InvoiceRow[] }>(`/admin/invoices?order_id=${orderId}`, {
          headers: admin.headers,
        })
      ).data.invoices
    const draftOf = async (invoiceId: string) =>
      (
        await http.get<{ draft: Draft | null; problems: string[] }>(
          `/admin/invoices/${invoiceId}/draft`,
          { headers: admin.headers }
        )
      ).data
    const orderTotals = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["total", "credit_line_total", "items.total", "items.metadata"],
          filters: { id: orderId },
        })
      const row = data[0] as unknown as {
        total: number | string
        credit_line_total: number | string
        items: { total: number | string; metadata: Record<string, unknown> | null }[]
      }
      return {
        charged: Number(row.total),
        credit: Number(row.credit_line_total),
        // What its gift card lines (those naming a recipient) came to
        gifts: row.items
          .filter((item) => item.metadata && "qt_gift" in item.metadata)
          .reduce((sum, item) => sum + Number(item.total), 0),
      }
    }
    /** A placed order of `items`, each gift card line given its recipient as the storefront does. */
    const order = (items: { variant_id: string; quantity: number }[], gifts: string[]) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        ...(items.some((item) => !gifts.includes(item.variant_id))
          ? { shippingOptionId: shop.shippingOptionId }
          : {}),
        items,
        email: "ayse@example.com",
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
        beforeComplete: async (cartId) => {
          const { data } = await getContainer()
            .resolve(ContainerRegistrationKeys.QUERY)
            .graph({
              entity: "cart",
              fields: ["items.id", "items.variant_id"],
              filters: { id: cartId },
            })
          const lines = (data[0] as { items: { id: string; variant_id: string }[] }).items
          for (const line of lines.filter((each) => gifts.includes(each.variant_id))) {
            await http.post(
              `/store/carts/${cartId}/line-items/${line.id}/gift`,
              { recipient_email: "zeynep.kaya@example.com" },
              { headers: store.headers }
            )
          }
        },
      })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await flag(true)
      await http.post(
        "/admin/platform-settings/invoicing",
        {
          provider: "external",
          trigger: "placed",
          carriers: {
            manual: { title: "Örnek Kargo A.Ş.", tax_id: fakeVkn(seededRandom(37)) },
          },
        },
        { headers: admin.headers }
      )
      await http.post(
        "/admin/platform-settings/seo",
        { canonical_host: "magaza.example.com" },
        { headers: admin.headers }
      )
    })
    afterEach(async () => {
      await flag(false)
    })

    it("leaves gift cards off the sale invoice as its advance; gift cards alone get that record only", async () => {
      const container = getContainer()
      const { variants } = await giftCardProduct(http, admin.headers, shop)
      const { variantId } = await stockedProduct(
        container,
        shop,
        `hediye-fatura-${randomBytes(4).toString("hex")}`,
        10,
        120
      )
      const mixed = await order(
        [
          { variant_id: variantId, quantity: 1 },
          { variant_id: variants["500"], quantity: 1 },
        ],
        [variants["500"]]
      )
      const alone = await order([{ variant_id: variants["250"], quantity: 2 }], [variants["250"]])
      await advanceOrder(container, mixed, "to_ship")
      await advanceOrder(container, alone, "to_ship")

      const [sale] = await eventually(
        () => invoicesOf(mixed),
        (rows) => rows.length > 0
      )
      const [advance] = await eventually(
        () => invoicesOf(alone),
        (rows) => rows.length > 0
      )
      const draft = await draftOf(sale?.id ?? "")
      const { charged, gifts } = await orderTotals(mixed)
      const aloneTotals = await orderTotals(alone)

      expect(gifts).toBeGreaterThan(0)
      expect(sale).toMatchObject({ status: "pending" })
      expect(Number(sale?.advance)).toBeCloseTo(gifts, 2)
      // The invoice is what was charged less the advance
      expect(Number(sale?.total) + Number(sale?.advance)).toBeCloseTo(charged, 2)
      expect(draft.problems).toEqual([])
      expect(draft.draft?.totals.gross).toBe(Number(sale?.total).toFixed(2))
      expect(draft.draft?.lines.map((line) => line.description).join(" ")).not.toMatch(
        /Hediye Kartı/
      )
      expect(advance).toMatchObject({ status: "waived", waived_reason: "advance_only" })
      expect(Number(advance?.total)).toBe(0)
      expect(Number(advance?.advance)).toBeCloseTo(aloneTotals.gifts, 2)
      expect(Number(advance?.advance)).toBeCloseTo(aloneTotals.charged, 2)
    })

    it("invoices a purchase gift cards paid in full for the full amount, as paid by a payment instrument", async () => {
      const container = getContainer()
      const { variantId } = await stockedProduct(
        container,
        shop,
        `kartla-${randomBytes(4).toString("hex")}`,
        10,
        120
      )
      const { data: card } = await http.post<{ gift_card: { code: string } }>(
        "/admin/gift-cards",
        { currency_code: "try", value: 1000 },
        { headers: admin.headers }
      )
      const cartId = await shippedCart(container, shop, variantId)
      await http.post(
        `/store/carts/${cartId}/gift-cards`,
        { code: card.gift_card.code },
        { headers: store.headers }
      )
      const { orderId, paid } = await checkout(container, cartId)

      const [invoice] = await eventually(
        () => invoicesOf(orderId),
        (rows) => rows.length > 0
      )
      const draft = await draftOf(invoice?.id ?? "")
      const { charged, credit } = await orderTotals(orderId)

      expect(paid).toBe(0)
      expect(charged).toBe(0)
      expect(invoice).toMatchObject({ status: "pending", advance: null })
      expect(draft.draft?.internet_sale.payment).toBe("gift_card")
      // In full: the card is how it was paid, not a discount
      expect(Number(draft.draft?.totals.gross)).toBeCloseTo(credit, 2)
    })
  },
})
