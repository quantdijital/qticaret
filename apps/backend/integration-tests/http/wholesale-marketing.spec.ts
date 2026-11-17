import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { transferCartCustomerWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { randomUUID } from "node:crypto"
import cartReminders from "../../src/jobs/cart-reminders"
import { CART_REMINDERS_MODULE } from "../../src/modules/cart-reminders"
import type CartRemindersModuleService from "../../src/modules/cart-reminders/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { sendPurchaseConversionsWorkflow } from "../../src/workflows/conversions/send"
import { customerData } from "../../src/workflows/legal/customer-data"
import { campaignFixture } from "../helpers/campaigns"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS, readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"
import { accountApi, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

/**
 * ADR-0068 slice 5. Decision 16: a bulk campaign and a cart reminder never
 * go to an active wholesaler (they show retail prices and offers), under
 * their account or a bare newsletter consent at their address; with the
 * flag off they are retail customers again. §10: their KVKK copy holds
 * their wholesale account and which orders were wholesale. Slice 3 review
 * I2: a wholesale order's purchase is not told to Meta or GA4.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const f = campaignFixture(http, getContainer)
    const address = (name: string) => `${name}-${randomUUID().slice(0, 8)}@example.com`

    const wholesaler = async (fields: Record<string, unknown> = {}) => {
      const staff = wholesaleApi(http, f.admin.headers)
      await staff.flag(true)
      const email = address("toptanci")
      const account = await accountApi(http, f.admin.headers).made({
        email,
        contact_name: "Ali Kaya",
        company_name: "Kaya Bıçak Ltd",
        own_prices: true,
        ...fields,
      })
      return { staff, account, email, customerId: account.customer?.id ?? "" }
    }
    const consentOf = (email: string, customerId: string | null) =>
      f.messaging().recordConsent({
        channel: "email",
        address: email,
        status: "granted",
        source: customerId ? "account" : "newsletter",
        customer_id: customerId,
        evidence: { text_version: "test" },
      })
    const toldToIys = async (email: string, customerId: string | null) => {
      const { id } = await consentOf(email, customerId)
      await f.messaging().updateMessageConsents({ id, iys_status: "sent" })
    }

    it("leaves active wholesalers out of a campaign's audience, by account and by address", async () => {
      const campaign = await f.draft([{ kind: "group", id: f.groupId }, { kind: "newsletter" }])
      const preview = () =>
        f.post<{ audience: number; eligible: number }>(`/${campaign.id}/audience-preview`, {})
      const before = (await preview()).data

      // One in the campaign's group, consented; one known only by a newsletter consent
      const inGroup = await wholesaler()
      await getContainer()
        .resolve(Modules.CUSTOMER)
        .addCustomerToGroup({ customer_id: inGroup.customerId, customer_group_id: f.groupId })
      await toldToIys(inGroup.email, inGroup.customerId)
      const subscribed = await wholesaler()
      await toldToIys(subscribed.email, null)

      const during = (await preview()).data
      await inGroup.staff.flag(false)
      const flagOff = (await preview()).data

      expect(during).toEqual(before)
      // Retail customers again: both reach the audience
      expect(flagOff).toMatchObject({
        audience: before.audience + 2,
        eligible: before.eligible + 2,
      })
    })

    it("sends no cart reminder to a wholesaler, and staff's button says why", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const { variantId } = await stockedProduct(
        container,
        shop,
        `toptan-${String(Date.now())}`,
        10,
        120
      )
      await f
        .settings()
        .saveSection(
          "marketing",
          { abandoned_cart_enabled: true, abandoned_cart_delay_minutes: 30 },
          null
        )
      const { email } = await wholesaler()
      const retail = address("perakende")
      await Promise.all([consentOf(email, null), consentOf(retail, null)])
      const leftCart = async (to: string) => {
        const cartId = await readyCart(container, shop, variantId, PAYTR_ADDRESS)
        await container.resolve(Modules.CART).updateCarts(cartId, { email: to })
        await container
          .resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
          .raw("update cart set updated_at = now() - interval '2 hours' where id = ?", [cartId])
        return cartId
      }
      // Left signed out, under the wholesaler's address
      const wholesaleCart = await leftCart(email)
      await leftCart(retail)

      await cartReminders(container)
      const claims = await container
        .resolve<CartRemindersModuleService>(CART_REMINDERS_MODULE)
        .listCartReminders({ cart_id: wholesaleCart })
      const detail = await settle(
        http.get<{ cart: { actions: { email_block: string | null } } }>(
          `/admin/abandoned-carts/${wholesaleCart}`,
          { headers: f.admin.headers }
        )
      )
      const remind = await settle(
        http.post<{ message?: string }>(
          `/admin/abandoned-carts/${wholesaleCart}/remind`,
          {},
          { headers: f.admin.headers }
        )
      )

      expect(f.mailsTo(retail)).toHaveLength(1)
      expect(f.mailsTo(email)).toHaveLength(0)
      expect(claims).toEqual([])
      expect(detail.data.cart.actions.email_block).toBe("wholesale")
      expect([remind.status, remind.data.message]).toEqual([409, "abandoned_carts.wholesale"])
      expect(f.mailsTo(email)).toHaveLength(0)
    })

    it("hands a wholesaler their account in their KVKK copy, and tells no tag their order", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const { variantId } = await stockedProduct(
        container,
        shop,
        `kvkk-${String(Date.now())}`,
        10,
        120
      )
      const staff = wholesaleApi(http, f.admin.headers)
      await staff.flag(true)
      const tier = await staff.tier({ name: `Toptan K ${randomUUID().slice(0, 4)}` })
      const { customerId, account } = await wholesaler({ tier_id: tier.id, min_quantity: 2 })
      const orderId = await placeOrder(container, {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 2 }],
        address: PAYTR_ADDRESS,
        beforeComplete: async (cartId) => {
          await transferCartCustomerWorkflow(container).run({
            input: { id: cartId, customer_id: customerId },
          })
        },
      })
      const conversions = await sendPurchaseConversionsWorkflow(container).run({
        input: { order_id: orderId },
      })
      // The stamp is the order.placed subscriber's
      const copy = await eventually(
        () => customerData(container, customerId),
        (data) => (data.toptan_hesap[0]?.toptan_siparişler.length ?? 0) > 0
      )

      expect(conversions.result).toEqual({ meta: "wholesale", ga4: "wholesale" })
      expect(copy.toptan_hesap).toEqual([
        expect.objectContaining({
          durum: "etkin",
          firma_adı: "Kaya Bıçak Ltd",
          seviye: tier.name,
          özel_fiyat_listesi: true,
          en_az_adet: 2,
          giriş_şifresini_personel_belirledi: true,
          kapanma: null,
          silinme: null,
          toptan_siparişler: [expect.any(Number)],
        }),
      ])
      expect(copy.siparişler).toHaveLength(1)
      // Nothing of staff's: who opened it is the shop's record
      expect(JSON.stringify(copy.toptan_hesap)).not.toMatch(/user_|created_by/)
      expect(account.staff_login).toBe(true)
    })
  },
})
