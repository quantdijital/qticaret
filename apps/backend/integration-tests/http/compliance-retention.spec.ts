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
import {
  forgetAbandonedCarts,
  forgetAuditClients,
  forgetOldCookieConsents,
  forgetSettledStockAlerts,
  forgetSpentConsentRequests,
} from "../../src/workflows/compliance/retention"
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
  },
})
