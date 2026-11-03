import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import {
  LINK_DEFAULTS,
  linkBody,
  linkFlag,
  linkRow,
  linkSettings,
  linkShop,
  makeLink,
  tokenOf,
} from "../helpers/payment-links"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

const COD = "pp_cod_cod"
const COD_DEFAULTS = { fee_type: "none", fee_value: 0, max_amount: 0, shipping_option_ids: [] }

interface Answer {
  cart_id?: string
  message?: string
}

/** adr/0051 soru 4: a link's order is paid at the door only when the owner allows it. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    let store: Storefront
    let shop: StockShop
    let variantId: string

    const staff = (path: string, body: unknown) =>
      settle(http.post<{ message?: string }>(path, body, { headers: owner.headers }))
    const codFlag = (enabled: boolean) =>
      staff("/admin/features/payments.cash_on_delivery", { enabled })
    const open = (token: string) =>
      settle(
        http.post<Answer>(`/store/payment-links/${token}/cart`, {}, { headers: store.headers })
      )
    const methods = async (cartId: string) =>
      (
        await http.get<{ cash_on_delivery: unknown }>(`/store/payment/methods?cart_id=${cartId}`, {
          headers: store.headers,
        })
      ).data.cash_on_delivery
    const start = (cartId: string) =>
      settle(
        http.post<Answer>(
          `/store/carts/${cartId}/payment-session`,
          { provider_id: COD },
          { headers: store.headers }
        )
      )
    const complete = (cartId: string) =>
      settle(
        http.post<{ type: string; order?: { id: string } }>(
          `/store/carts/${cartId}/complete`,
          {},
          { headers: store.headers }
        )
      )

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      owner = await createAdminUser(http, container)
      variantId = (await stockedProduct(container, shop, `bicak-${String(Date.now())}`, 10, 150))
        .variantId
      await linkShop(http, container, owner.headers)
      await staff("/admin/platform-settings/cash_on_delivery", {
        fee_type: "fixed",
        fee_value: 2_500,
        max_amount: 100_000,
        shipping_option_ids: [shop.shippingOptionId],
      })
      await codFlag(true)
    })
    // Flags and sections live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await linkFlag(http, owner.headers, false)
      await linkSettings(http, owner.headers, LINK_DEFAULTS)
      await codFlag(false)
      await staff("/admin/platform-settings/cash_on_delivery", COD_DEFAULTS)
    })

    it("refuses cash on delivery on a link's cart until the owner allows it, then takes it with its fee", async () => {
      const made = await makeLink(http, owner.headers, linkBody(shop, variantId))
      const id = made.data.payment_link?.id ?? ""
      const cartId = (await open(tokenOf(made.data.share?.url))).data.cart_id ?? ""

      const offeredBefore = await methods(cartId)
      const refused = await start(cartId)
      const allowed = await linkSettings(http, owner.headers, { allow_cod: true })
      const offered = await methods(cartId)
      const started = await start(cartId)
      const completed = await complete(cartId)
      const paid = await eventually(
        () => linkRow(getContainer(), id),
        (row) => row.status === "paid"
      )

      expect(made.status).toBe(201)
      expect(offeredBefore).toBeNull()
      expect([refused.status, refused.data.message]).toEqual([400, "cart.payment_link_no_cod"])
      expect(allowed.status).toBe(200)
      expect(offered).toEqual({ provider_id: COD, fee: "25.00" })
      expect(started.status).toBe(200)
      // The fee line is the server's: the link's cart still reads as the link made it
      expect(completed.data.type).toBe("order")
      expect(paid.order_id).toBe(completed.data.order?.id)
    })
  },
})
