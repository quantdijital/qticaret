import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { BACK_IN_STOCK_MODULE } from "../../src/modules/back-in-stock"
import type BackInStockModuleService from "../../src/modules/back-in-stock/service"
import { CONVERSIONS_MODULE } from "../../src/modules/conversions"
import type ConversionsModuleService from "../../src/modules/conversions/service"
import { LEGAL_MODULE } from "../../src/modules/legal"
import type LegalModuleService from "../../src/modules/legal/service"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { PAYMENT_FORMS_MODULE } from "../../src/modules/payment-forms"
import type PaymentFormsModuleService from "../../src/modules/payment-forms/service"
import {
  forgetAbandonedCarts,
  forgetAuditClients,
  forgetOldCookieConsents,
  forgetSettledStockAlerts,
  forgetSpentConsentRequests,
} from "../../src/workflows/compliance/retention"
import {
  forgetAbandonedCartContacts,
  forgetGaClients,
  forgetSentMessages,
} from "../../src/workflows/compliance/retention-contacts"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const DAY = 24 * 60 * 60 * 1000

/** F13.5 (adr/0041 §6): what the nightly retention job forgets, and what it keeps. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("forgets an abandoned cart's records after 30 days, keeps an order's, and old cookie answers", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const storefront = await createStorefront(container)
      const admin = await createAdminUser(http, container)
      const { variantId } = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10)
      const legal = container.resolve<LegalModuleService>(LEGAL_MODULE)
      const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
      const conversions = container.resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
      const now = new Date()
      const long = new Date(now.getTime() - 40 * DAY)
      const recent = new Date(now.getTime() - 5 * DAY)

      // Paid at the door: the cart becomes an order
      await http.post(
        "/admin/platform-settings/cash_on_delivery",
        {
          fee_type: "none",
          fee_value: 0,
          max_amount: 100_000,
          shipping_option_ids: [shop.shippingOptionId],
        },
        { headers: admin.headers }
      )
      await http.post(
        "/admin/features/payments.cash_on_delivery",
        { enabled: true },
        { headers: admin.headers }
      )
      const ordered = await readyCart(container, shop, variantId)
      await http.post(
        `/store/carts/${ordered}/payment-session`,
        { provider_id: "pp_cod_cod" },
        { headers: storefront.headers }
      )
      await http.post(`/store/carts/${ordered}/complete`, {}, { headers: storefront.headers })
      const abandoned = await readyCart(container, shop, variantId)
      const fresh = await readyCart(container, shop, variantId)

      const consent = (cartId: string, givenAt: Date) =>
        legal.createLegalConsents({
          cart_id: cartId,
          documents: [] as unknown as Record<string, unknown>,
          ip_encrypted: null,
          given_at: givenAt,
        })
      await consent(ordered, long)
      await consent(abandoned, long)
      await consent(fresh, recent)
      await legal.createAgeDeclarations({ cart_id: abandoned, min_age: 18, declared_at: long })
      await messaging.createCheckoutConsents({
        cart_id: abandoned,
        email: true,
        sms: false,
        text_version: "1",
        ip_hash: null,
        given_at: long,
      })
      await conversions.createTrackingConsents({
        cart_id: abandoned,
        analytics: true,
        marketing: false,
        given_at: long,
      })
      await legal.createCookieConsents([
        {
          visitor_hash: "eski",
          analytics: true,
          marketing: true,
          policy_version: null,
          given_at: new Date(now.getTime() - 800 * DAY),
        },
        {
          visitor_hash: "yeni",
          analytics: true,
          marketing: false,
          policy_version: null,
          given_at: recent,
        },
      ])

      const deleted = await forgetAbandonedCarts(container, now)
      const cookies = await forgetOldCookieConsents(container, now)
      const left = (await legal.listLegalConsents({})).map((row) => row.cart_id).sort()

      expect(deleted).toEqual({
        legal_consent: 1,
        age_declaration: 1,
        checkout_consent: 1,
        tracking_consent: 1,
      })
      expect(left).toEqual([ordered, fresh].sort())
      expect(cookies).toBe(1)
      expect((await legal.listCookieConsents({})).map((row) => row.visitor_hash)).toEqual(["yeni"])
    })

    it("clears the audit log's client after two years, and settled alerts and spent requests", async () => {
      const container = getContainer()
      const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const alerts = container.resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE)
      const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
      const now = new Date()
      // Records cannot be dated back: the job is run as if it were later
      const later = (days: number) => new Date(now.getTime() + days * DAY)
      const entry = await audit.record({
        kind: "mutation",
        action: "POST /admin/products/:id",
        ip: "203.0.113.7",
        user_agent: "TestBrowser/1.0",
      })
      const alert = {
        variant_id: "variant_1",
        product_id: "prod_1",
        email_encrypted: "x",
        email_masked: "a***@example.com",
      }
      await alerts.createStockAlerts([
        { ...alert, email_hash: "notified", status: "notified", notified_at: now },
        { ...alert, email_hash: "active", status: "active" },
        { ...alert, email_hash: "pending", status: "pending", confirm_expires_at: later(1) },
      ])
      const request = {
        channel: "email" as const,
        recipient_hash: "h",
        recipient_encrypted: "x",
        status: "granted" as const,
        source: "checkout" as const,
      }
      await messaging.createConsentRequests([
        { ...request, token_hash: "spent", expires_at: new Date(now.getTime() - 40 * DAY) },
        { ...request, token_hash: "open", expires_at: later(7) },
      ])

      const notYet = await forgetAuditClients(container, now)
      const cleared = await forgetAuditClients(container, later(731))
      const [kept] = await audit.listAuditEntries({ id: entry.id })
      const settled = await forgetSettledStockAlerts(container, later(182))
      const requests = await forgetSpentConsentRequests(container, now)

      expect(notYet).toBe(0)
      expect(cleared).toBeGreaterThanOrEqual(1)
      // What was done stays; who sent it goes
      expect(kept).toMatchObject({ action: "POST /admin/products/:id", ip: null, user_agent: null })
      expect(settled).toBe(2)
      expect((await alerts.listStockAlerts({})).map((row) => row.email_hash)).toEqual(["active"])
      expect(requests).toBe(1)
      expect((await messaging.listConsentRequests({})).map((row) => row.token_hash)).toEqual([
        "open",
      ])
    })
    it("deletes a cart left 90 days, keeps a paying one, and forgets GA ids and old sends", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const { variantId } = await stockedProduct(
        container,
        shop,
        `bardak-${String(Date.now())}`,
        10
      )
      const conversions = container.resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
      const carts = container.resolve(Modules.CART)
      const notifications = container.resolve(Modules.NOTIFICATION)
      const now = new Date()
      // Records cannot be dated back: the job is run as if it were later
      const later = (days: number) => new Date(now.getTime() + days * DAY)
      const left = await readyCart(container, shop, variantId)
      const paying = await readyCart(container, shop, variantId)
      await container.resolve<PaymentFormsModuleService>(PAYMENT_FORMS_MODULE).createPaymentForms({
        provider: "iyzico",
        session_id: "payses_test",
        cart_id: paying,
        token: "form-token",
        expires_at: later(1),
      })
      await conversions.createTrackingConsents({
        order_id: "order_old",
        analytics: true,
        marketing: false,
        ga_client_id: "GA1.1.123.456",
        given_at: now,
      })
      // The panel's bell is no message to a person; an e-mail's record is
      const [bell, mail] = await notifications.createNotifications([
        { to: "", channel: "feed", template: "admin-ui", data: { title: "Not" } },
        { to: "", channel: "feed", template: "admin-ui", data: { title: "Not" } },
      ])
      await (
        notifications as unknown as {
          updateNotifications: (data: {
            id: string
            to: string
            channel: string
          }) => Promise<unknown>
        }
      ).updateNotifications({ id: mail?.id ?? "", to: "ayse@example.com", channel: "email" })

      const notYet = await forgetAbandonedCartContacts(container, later(80))
      const deleted = await forgetAbandonedCartContacts(container, later(91))
      const remaining = (await carts.listCarts({ id: [left, paying] })).map((cart) => cart.id)
      // The return window (14 days unless the shop set more) and a margin of 45
      const gaKept = await forgetGaClients(container, later(50))
      const gaCleared = await forgetGaClients(container, later(60))
      const [tracking] = await conversions.listTrackingConsents({ order_id: "order_old" })
      const sendsKept = await forgetSentMessages(container, later(1000))
      const sendsDeleted = await forgetSentMessages(container, later(1096))
      const sends = (await notifications.listNotifications({})).map((row) => row.id)

      expect(notYet).toBe(0)
      // Carts the tests before left count too
      expect(deleted).toBeGreaterThanOrEqual(1)
      expect(remaining).toEqual([paying])
      expect(gaKept).toBe(0)
      expect(gaCleared).toBeGreaterThanOrEqual(1)
      expect(tracking?.ga_client_id).toBeNull()
      expect([sendsKept, sendsDeleted]).toEqual([0, 1])
      expect(sends).toContain(bell?.id)
      expect(sends).not.toContain(mail?.id)
    })
  },
})
