import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface Stats {
  stats: {
    customer_id: string
    orders: number
    spent: string
    average: string
    last_order_at: string | null
    city: string | null
  }[]
  currency_code: string
  capped: boolean
}

interface Origin {
  origin: {
    source: string
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    referrer_host: string | null
  } | null
}

/** CU1, O4, O6: a customer's numbers and an order's first landing, for the panel. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }

    const get = <T>(url: string, headers = admin.headers) => settle(http.get<T>(url, { headers }))
    const order = (
      variantId: string,
      quantity: number,
      email: string,
      beforeComplete?: (cartId: string) => Promise<void>
    ) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity }],
        email,
        address: {
          first_name: "Ayşe",
          last_name: "Yılmaz",
          address_1: "Demo Sokak 1",
          province: "İstanbul",
          city: "Kadıköy",
        },
        beforeComplete,
      })
    const orderOf = async (id: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["id", "customer_id", "total"], filters: { id } })
      return data[0] as { id: string; customer_id: string; total: number | string }
    }

    beforeEach(async () => {
      const container = getContainer()
      // The carts' il and ilçe are checked against the address data (F1.4)
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
    })

    it("counts a customer's sales as the reports do, leaving the canceled out", async () => {
      const { variantId } = await stockedProduct(
        getContainer(),
        shop,
        `musteri-${String(Date.now())}`,
        20,
        100
      )
      const email = `ayse-${String(Date.now())}@example.com`
      const first = await orderOf(await order(variantId, 1, email))
      const second = await orderOf(await order(variantId, 2, email))
      await advanceOrder(getContainer(), await order(variantId, 3, email), "canceled")
      const other = await orderOf(
        await order(variantId, 1, `ali-${String(Date.now())}@example.com`)
      )

      const answer = await get<Stats>(
        `/admin/customer-stats?ids=${first.customer_id},${other.customer_id}`
      )
      const spent = Number(first.total) + Number(second.total)

      expect(first.customer_id).toBe(second.customer_id)
      expect(answer.status).toBe(200)
      expect(answer.data.currency_code).toBe("try")
      expect(answer.data.capped).toBe(false)
      expect(answer.data.stats).toEqual([
        expect.objectContaining({
          customer_id: first.customer_id,
          orders: 2,
          spent: spent.toFixed(2),
          average: (spent / 2).toFixed(2),
          city: "İstanbul",
        }),
        expect.objectContaining({ customer_id: other.customer_id, orders: 1 }),
      ])
      expect(answer.data.stats[0]?.last_order_at).not.toBeNull()
    })

    it("answers zeros for a customer without orders; refuses bad ids and strangers", async () => {
      // A read-only teammate reads it, as the customers list
      const reader = await createAdminUser(http, getContainer(), "readonly")
      const created = await settle(
        http.post<{ customer: { id: string } }>(
          "/admin/customers",
          { email: `bos-${String(Date.now())}@example.com`, first_name: "Boş" },
          { headers: admin.headers }
        )
      )
      const id = created.data.customer.id

      const empty = await get<Stats>(`/admin/customer-stats?ids=${id}`, reader.headers)
      const bad = await get(`/admin/customer-stats?ids=order_1`)
      const none = await get(`/admin/customer-stats`)
      const anonymous = await settle(http.get(`/admin/customer-stats?ids=${id}`))

      expect(empty.status).toBe(200)
      expect(empty.data.stats).toEqual([
        {
          customer_id: id,
          orders: 0,
          spent: "0.00",
          average: "0.00",
          last_order_at: null,
          city: null,
        },
      ])
      expect(bad.status).toBe(400)
      expect(none.status).toBe(400)
      expect(anonymous.status).toBe(401)
    })

    it("tells where an order's shopper first landed from, and null when not told", async () => {
      const { variantId } = await stockedProduct(
        getContainer(),
        shop,
        `kaynak-${String(Date.now())}`,
        20,
        100
      )
      const email = `kaynak-${String(Date.now())}@example.com`
      const tracked = await order(variantId, 1, email, async (cartId) => {
        await http.post(
          `/store/carts/${cartId}/source`,
          { utm_source: "bulten", utm_medium: "email", utm_campaign: "kasim" },
          { headers: storefront.headers }
        )
      })
      const untracked = await order(variantId, 1, email)

      const told = await get<Origin>(`/admin/orders/${tracked}/origin`)
      const silent = await get<Origin>(`/admin/orders/${untracked}/origin`)
      const missing = await get(`/admin/orders/order_01UNKNOWN0000000000000000/origin`)

      expect(told.status).toBe(200)
      expect(told.data.origin).toMatchObject({
        source: "email",
        utm_source: "bulten",
        utm_medium: "email",
        utm_campaign: "kasim",
      })
      expect(silent.data.origin).toBeNull()
      expect(missing.status).toBe(404)
    })
  },
})
