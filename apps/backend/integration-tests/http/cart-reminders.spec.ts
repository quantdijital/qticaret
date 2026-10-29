import { randomUUID } from "node:crypto"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import cartReminders from "../../src/jobs/cart-reminders"
import { CART_REMINDERS_MODULE } from "../../src/modules/cart-reminders"
import type CartRemindersModuleService from "../../src/modules/cart-reminders/service"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS, readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const address = (name: string) => `${name}-${randomUUID().slice(0, 8)}@example.com`

/** F10.7 (adr/0038 §1; KK3): one reminder per cart left behind, with e-mail consent only. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }
    let variantId: string
    const backend = process.env["BACKEND_URL"]

    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const mailsTo = (email: string) => fake.messages.filter(({ to }) => to.includes(email))
    const grant = (email: string) =>
      getContainer()
        .resolve<MessagingModuleService>(MESSAGING_MODULE)
        .recordConsent({
          channel: "email",
          address: email,
          status: "granted",
          source: "checkout",
          evidence: { text_version: "test" },
        })
    /** A cart with a line and the e-mail, last changed that many hours ago. */
    const leftCart = async (email: string, hoursAgo = 2) => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      await getContainer().resolve(Modules.CART).updateCarts(cartId, { email })
      await getContainer()
        .resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
        .raw("update cart set updated_at = now() - make_interval(hours => ?) where id = ?", [
          hoursAgo,
          cartId,
        ])
      return cartId
    }
    const redeem = (token: string) =>
      settle(
        http.post<{ cart_id?: string; message?: string }>(
          "/store/cart-reminders/redeem",
          { token },
          { headers: storefront.headers }
        )
      )
    const outcomeOf = async (cartId: string) =>
      (
        await getContainer()
          .resolve<CartRemindersModuleService>(CART_REMINDERS_MODULE)
          .listCartReminders({ cart_id: cartId })
      ).map(({ outcome }) => outcome)

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
        // A commercial e-mail's way out is a backend link
        BACKEND_URL: "https://api.magaza.example",
      })
    })

    afterAll(async () => {
      for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
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
      admin = await createAdminUser(http, container)
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      // The shop's day counts every run's e-mails: far above them here
      await settings().saveSection("notifications", { email_daily_limit: 200_000 }, null)
      await settings().saveSection(
        "marketing",
        { abandoned_cart_enabled: true, abandoned_cart_delay_minutes: 30 },
        null
      )
      fake.messages.length = 0
    })

    it("reminds a consenting shopper once, with a link that opens the cart once", async () => {
      const email = address("sepet")
      await grant(email)
      const cartId = await leftCart(email)

      await cartReminders(getContainer())
      await cartReminders(getContainer())
      const [mail] = mailsTo(email)
      const token = /geri-don\?token=([\w-]{43})/.exec(mail?.html ?? "")?.[1] ?? ""
      const opened = await redeem(token)
      const again = await redeem(token)
      const summary = await http.get<{ summary: Record<string, number> }>(
        "/admin/cart-reminders/summary",
        { headers: admin.headers }
      )
      const executions: { rows: { count: number }[] } = await getContainer()
        .resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
        .raw("select count(*)::int as count from workflow_execution where context::text like ?", [
          `%${token}%`,
        ])

      expect(mailsTo(email)).toHaveLength(1)
      expect(mail?.template).toBe("cart.reminder")
      expect(mail?.html).toContain("https://magaza.example.com/sepet/geri-don?token=")
      expect(mail?.headers["List-Unsubscribe"]).toMatch(/^<https?:\/\//)
      expect(opened.data).toEqual({ cart_id: cartId })
      expect(again.status).toBe(404)
      expect(again.data.message).toBe("cart_reminders.link_invalid")
      expect(summary.data.summary).toEqual({ sent: 1, returned: 1, ordered: 0 })
      // The link's token is in the e-mail only: no workflow keeps it
      expect(executions.rows[0]?.count).toBe(0)
    })

    it("reminds an address once a week, however many carts it leaves behind", async () => {
      const email = address("cok-sepet")
      await grant(email)
      const carts = [await leftCart(email, 5), await leftCart(email, 4), await leftCart(email, 3)]

      await cartReminders(getContainer())
      const later = await leftCart(email, 2)
      await cartReminders(getContainer())

      expect(mailsTo(email)).toHaveLength(1)
      expect((await Promise.all([...carts, later].map(outcomeOf))).flat()).toEqual(["sent"])
    })

    it("sends nothing without consent, nor for a fresh cart or a shopper who ordered since", async () => {
      const unconsented = address("izinsiz")
      const fresh = address("taze")
      const ordered = address("siparis")
      await Promise.all([grant(fresh), grant(ordered)])
      await settings().saveSection("marketing", { abandoned_cart_enabled: false }, null)
      const offCart = await leftCart(unconsented)
      await cartReminders(getContainer())
      const whileOff = await outcomeOf(offCart)
      await settings().saveSection("marketing", { abandoned_cart_enabled: true }, null)
      const freshCart = await leftCart(fresh, 0)
      const orderedCart = await leftCart(ordered, 3)
      await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        email: ordered,
      })
      fake.messages.length = 0

      await cartReminders(getContainer())

      expect(whileOff).toEqual([])
      // KK3: the cart's one reminder is used, and nothing went
      expect(await outcomeOf(offCart)).toEqual(["no_consent"])
      expect(await outcomeOf(freshCart)).toEqual([])
      expect(await outcomeOf(orderedCart)).toEqual([])
      expect(fake.messages.filter(({ template }) => template === "cart.reminder")).toEqual([])
    })
  },
})
