import { randomUUID } from "node:crypto"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface Row {
  id: string
  email: string | null
  phone_masked: string | null
  lines: { title: string; quantity: number }[]
  total: number
  reminder: { outcome: string } | null
  consent: { email: string | null; sms: string | null }
}

interface Detail extends Row {
  phone: string | null
  actions: { email_block: string | null; whatsapp: string | null }
}

interface Who {
  headers: Record<string, string>
}

const address = (name: string) => `${name}-${randomUUID().slice(0, 8)}@example.com`

/** 2026-11-06: carts left behind, followed up by staff within İYS consent. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let shop: StockShop
    let variantId: string
    let owner: Who
    const backend = process.env["BACKEND_URL"]

    const messaging = () => getContainer().resolve<MessagingModuleService>(MESSAGING_MODULE)
    const grant = (channel: "email" | "sms", to: string) =>
      messaging().recordConsent({
        channel,
        address: to,
        status: "granted",
        source: "checkout",
        evidence: { text_version: "test" },
      })
    /** A cart with a line, the e-mail and the address's phone, last changed hours ago. */
    const leftCart = async (email: string, hoursAgo: number) => {
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
    const list = (who: Who = owner) =>
      settle(
        http.get<{ carts: Row[]; count: number }>("/admin/abandoned-carts?limit=50", {
          headers: who.headers,
        })
      )
    const detail = async (id: string) =>
      (await http.get<{ cart: Detail }>(`/admin/abandoned-carts/${id}`, { headers: owner.headers }))
        .data.cart
    const remind = (id: string, who: Who = owner) =>
      settle(
        http.post<{ outcome?: string; message?: string }>(
          `/admin/abandoned-carts/${id}/remind`,
          {},
          { headers: who.headers }
        )
      )

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
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
      variantId = (await stockedProduct(container, shop, `sepet-${String(Date.now())}`, 10, 150))
        .variantId
      owner = await createAdminUser(http, container)
      const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      await settings.saveSection("notifications", { email_daily_limit: 200_000 }, null)
      fake.messages.length = 0
    })

    it("lists carts left an hour to 30 days ago for owner and operations, not read-only staff", async () => {
      const consented = address("izinli")
      const silent = address("izinsiz")
      await grant("email", consented)
      const kept = await leftCart(consented, 2)
      const unconsented = await leftCart(silent, 5)
      const fresh = await leftCart(address("taze"), 0)
      const old = await leftCart(address("eski"), 24 * 40)
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")

      const seen = await list()
      const ids = seen.data.carts.map((cart) => cart.id)

      expect(ids).toEqual(expect.arrayContaining([kept, unconsented]))
      expect(ids).not.toContain(fresh)
      expect(ids).not.toContain(old)
      // Newest activity first
      expect(ids.indexOf(kept)).toBeLessThan(ids.indexOf(unconsented))
      const row = seen.data.carts.find((cart) => cart.id === kept)
      expect(row).toMatchObject({
        email: consented,
        phone_masked: "+905*** *** ** 00",
        reminder: null,
        consent: { email: "granted", sms: null },
      })
      expect(row?.lines[0]?.quantity).toBe(1)
      expect(row?.total).toBeGreaterThan(0)
      expect((await list(operations)).status).toBe(200)
      expect((await list(readonly)).status).toBe(403)
      expect(
        (await settle(http.get(`/admin/abandoned-carts/${kept}`, { headers: readonly.headers })))
          .status
      ).toBe(403)
    })

    it("reminds by e-mail only with consent, once; WhatsApp only with the SMS consent", async () => {
      const consented = address("hatirlat")
      const silent = address("sessiz")
      await grant("email", consented)
      const cart = await leftCart(consented, 2)
      const unconsented = await leftCart(silent, 3)
      const readonly = await createAdminUser(http, getContainer(), "readonly")

      const before = await detail(cart)
      const refused = await remind(unconsented)
      const byReadonly = await remind(cart, readonly)
      const sent = await remind(cart)
      const again = await remind(cart)
      await grant("sms", "+905320000000")
      const after = await detail(cart)

      expect(before.phone).toBe("+905320000000")
      expect(before.actions).toEqual({ email_block: null, whatsapp: null })
      expect((await detail(unconsented)).actions.email_block).toBe("no_consent")
      expect(refused.status).toBe(409)
      expect(refused.data.message).toBe("abandoned_carts.no_consent")
      expect(byReadonly.status).toBe(403)
      expect(sent.data.outcome).toBe("sent")
      expect(fake.messages.filter(({ to }) => to.includes(consented))).toHaveLength(1)
      expect(again.status).toBe(409)
      expect(again.data.message).toBe("abandoned_carts.reminded")
      expect(after.reminder).toMatchObject({ outcome: "sent" })
      expect(after.actions).toEqual({ email_block: "reminded", whatsapp: "905320000000" })
      expect(fake.messages.filter(({ to }) => to.includes(silent))).toEqual([])
      expect((await settle(http.get("/admin/abandoned-carts/cart_yok", owner))).status).toBe(404)
    })
  },
})
