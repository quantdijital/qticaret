import { randomBytes } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import { paymentLinkTokenHash } from "../../src/lib/payment-links/token"
import { erasePaymentLinks, sweepPaymentLinks } from "../../src/workflows/payment-links/retention"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import {
  GUEST,
  LINK_DEFAULTS,
  linkBody,
  linkFlag,
  linkRow,
  linkSettings,
  linkShop,
  linksOf,
  makeLink,
  tokenOf,
} from "../helpers/payment-links"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const HOUR = 60 * 60 * 1000

interface View {
  payment_link?: Record<string, unknown>
  message?: string
}

/** adr/0051: staff make a payment link; the customer's page shows what it offers. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    let store: Storefront
    let shop: StockShop
    let variantId: string

    const view = (token: string) =>
      settle(http.get<View>(`/store/payment-links/${token}`, { headers: store.headers }))

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      owner = await createAdminUser(http, container)
      variantId = (await stockedProduct(container, shop, `bicak-${String(Date.now())}`, 10, 150))
        .variantId
      await linkShop(http, container, owner.headers)
    })
    // The flag lives in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await linkFlag(http, owner.headers, false)
      await linkSettings(http, owner.headers, LINK_DEFAULTS)
    })

    it("makes a link with re-auth, at the catalog's price, never the request's, and shares it naming no one", async () => {
      const noProof = await makeLink(http, owner.plain, linkBody(shop, variantId))
      const priced = await makeLink(
        http,
        owner.headers,
        linkBody(shop, variantId, {
          lines: [{ variant_id: variantId, quantity: 2, unit_price: 1 }],
        })
      )
      const made = await makeLink(
        http,
        owner.headers,
        linkBody(shop, variantId, { discount: { type: "percentage", value: 10, reason: "DM" } })
      )
      const id = made.data.payment_link?.id ?? ""
      const share = await settle(
        http.get<{ share: Record<string, string | null> }>(`/admin/payment-links/${id}/share`, {
          headers: owner.headers,
        })
      )
      const row = await linkRow(getContainer(), id)
      const token = tokenOf(made.data.share?.url)

      expect(noProof.status).toBe(428)
      expect(priced.status).toBe(400)
      expect(made.status).toBe(201)
      expect(made.data.payment_link).toMatchObject({
        status: "open",
        items_total: 30_000,
        discount_total: 3_000,
        total: 27_000,
      })
      expect(made.data.share?.url).toMatch(/^https:\/\/magaza\.example\.com\/ode\/pl_/)
      // The token is kept as a hash and a seal, never as itself
      expect(row.token_hash).toBe(paymentLinkTokenHash(token))
      expect(JSON.stringify(row)).not.toContain(token)
      expect(JSON.stringify(row)).not.toContain(GUEST.email)
      expect(share.data.share["sms_text"]).toContain("toplam ₺270,00")
      expect(share.data.share["sms_text"]).toContain(made.data.share?.url ?? "-")
      for (const personal of [GUEST.email, GUEST.first_name, GUEST.last_name, "532"]) {
        expect(share.data.share["sms_text"]).not.toContain(personal)
      }
      expect(share.data.share["whatsapp_url"]).toMatch(/^https:\/\/wa\.me\/905321234567\?text=/)
    })

    it("lets operations make a link without a discount only, and an admin give a fifth at most", async () => {
      const operations = await createAdminUser(http, getContainer(), "operations")
      const admin = await createAdminUser(http, getContainer(), "admin")
      const discounted = await makeLink(
        http,
        operations.headers,
        linkBody(shop, variantId, { discount: { type: "fixed", value: 1_000, reason: "DM" } })
      )
      const plain = await makeLink(http, operations.headers, linkBody(shop, variantId))
      const cancel = await settle(
        http.post(
          `/admin/payment-links/${plain.data.payment_link?.id ?? ""}/cancel`,
          {},
          { headers: operations.headers }
        )
      )
      const over = await makeLink(
        http,
        admin.headers,
        linkBody(shop, variantId, { discount: { type: "percentage", value: 25, reason: "DM" } })
      )
      const within = await makeLink(
        http,
        admin.headers,
        linkBody(shop, variantId, { discount: { type: "percentage", value: 20, reason: "DM" } })
      )

      expect(discounted.status).toBe(403)
      expect(discounted.data.message).toBe("payment_link.discount_not_allowed")
      expect(plain.status).toBe(201)
      expect(cancel.status).toBe(403)
      expect(over.status).toBe(403)
      expect(over.data.message).toBe("payment_link.discount_over_limit")
      expect(within.status).toBe(201)
    })

    it("holds an admin to the discount limit the owner sets, which the admin cannot raise", async () => {
      const admin = await createAdminUser(http, getContainer(), "admin")
      const discount = (value: number) =>
        linkBody(shop, variantId, { discount: { type: "percentage", value, reason: "DM" } })
      const defaults = await settle(
        http.get<{ values: Record<string, unknown> }>("/admin/platform-settings/payment_links", {
          headers: owner.headers,
        })
      )
      const raised = await linkSettings(http, admin.headers, { admin_max_discount_percent: 99 })
      const outOfRange = await linkSettings(http, owner.headers, {
        admin_max_discount_percent: 100,
      })
      const lowered = await linkSettings(http, owner.headers, { admin_max_discount_percent: 10 })
      const over = await makeLink(http, admin.headers, discount(15))
      const within = await makeLink(http, admin.headers, discount(10))
      const owners = await makeLink(http, owner.headers, discount(50))

      expect(defaults.data.values).toEqual(LINK_DEFAULTS)
      expect(raised.status).toBe(403)
      expect(outOfRange.status).toBe(400)
      expect(lowered.status).toBe(200)
      expect([over.status, over.data.message]).toEqual([403, "payment_link.discount_over_limit"])
      expect(within.status).toBe(201)
      // The owner's own limit stays 99, whatever the admin's
      expect(owners.status).toBe(201)
    })

    it("shows the link to its token alone, the first name only; forged, ended and canceled links are one 404", async () => {
      const made = await makeLink(http, owner.headers, linkBody(shop, variantId))
      const token = tokenOf(made.data.share?.url)
      const shown = await view(token)
      const forged = await view(
        `${token.split(".").slice(0, 2).join(".")}.${randomBytes(32).toString("base64url").slice(0, 43)}`
      )
      const unknown = await view("pl_kisa")

      const ended = await makeLink(http, owner.headers, linkBody(shop, variantId))
      const endedId = ended.data.payment_link?.id ?? ""
      await linksOf(getContainer()).updatePaymentLinks({
        id: endedId,
        expires_at: new Date(Date.now() - 2 * HOUR),
      })
      const endedView = await view(tokenOf(ended.data.share?.url))
      await sweepPaymentLinks(getContainer())

      await settle(
        http.post(
          `/admin/payment-links/${made.data.payment_link?.id ?? ""}/cancel`,
          {},
          {
            headers: owner.headers,
          }
        )
      )
      const canceled = await view(token)

      expect(shown.status).toBe(200)
      expect(shown.headers["referrer-policy"]).toBe("no-referrer")
      expect(shown.headers["cache-control"]).toContain("no-store")
      expect(shown.data.payment_link).toMatchObject({
        state: "open",
        first_name: "Ayşe",
        items_total: 30_000,
        total: 30_000,
        shipping: { preset: true },
      })
      for (const personal of [GUEST.email, GUEST.last_name, "532", "Atatürk"]) {
        expect(JSON.stringify(shown.data)).not.toContain(personal)
      }
      for (const answer of [forged, unknown, endedView, canceled]) {
        expect(answer.status).toBe(404)
        expect(answer.data.message).toBe("payment_link.unavailable")
      }
      expect((await linkRow(getContainer(), endedId)).status).toBe("expired")
    })

    it("answers as if it did not exist while the flag is off, and closes Medusa's draft orders", async () => {
      const made = await makeLink(http, owner.headers, linkBody(shop, variantId))
      await linkFlag(http, owner.headers, false)
      const shown = await view(tokenOf(made.data.share?.url))
      const create = await makeLink(http, owner.headers, linkBody(shop, variantId))
      const draft = await settle(
        http.post<{ message?: string }>(
          "/admin/draft-orders",
          { region_id: shop.regionId, email: GUEST.email },
          { headers: owner.headers }
        )
      )

      expect(shown.status).toBe(404)
      expect(create.status).toBe(404)
      expect(draft.status).toBe(400)
      expect(draft.data.message).toBe("orders.use_payment_link")
    })

    it("sends the link to its customer once in ten minutes, and extends it no further than seven days", async () => {
      const fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
      try {
        const made = await makeLink(http, owner.headers, linkBody(shop, variantId))
        const id = made.data.payment_link?.id ?? ""
        const send = () =>
          settle(
            http.post<{ outcomes?: Record<string, string>; message?: string }>(
              `/admin/payment-links/${id}/resend`,
              { channels: ["email", "sms"] },
              { headers: owner.headers }
            )
          )
        const extend = (hours: number) =>
          settle(
            http.post<{ message?: string }>(
              `/admin/payment-links/${id}/extend`,
              { hours },
              { headers: owner.headers }
            )
          )
        const first = await send()
        const again = await send()
        const shorter = await extend(24)
        const longer = await extend(168)
        const mail = fake.messages.find((message) => message.to.includes(GUEST.email))

        expect(first.status).toBe(200)
        // No SMS account in the test shop: the text is not sent, the e-mail is
        expect(first.data.outcomes).toEqual({ email: "sent", sms: "channel_off" })
        expect(mail?.template).toBe("payment_link.sent")
        expect(again.status).toBe(409)
        expect(again.data.message).toBe("payment_link.sent_recently")
        expect(shorter.status).toBe(400)
        expect(shorter.data.message).toBe("payment_link.extend_limit")
        expect(longer.status).toBe(200)
        const row = await linkRow(getContainer(), id)
        expect(new Date(row.expires_at).getTime()).toBe(new Date(row.token_ends_at).getTime())
      } finally {
        for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
          Reflect.deleteProperty(process.env, name)
        }
        await fake.close()
      }
    })

    it("erases a person's links: an open one canceled, its contact and token gone", async () => {
      const made = await makeLink(
        http,
        owner.headers,
        linkBody(shop, variantId, { discount: { type: "fixed", value: 500, reason: "DM" } })
      )
      const id = made.data.payment_link?.id ?? ""
      const before = await linkRow(getContainer(), id)
      const erased = await erasePaymentLinks(getContainer(), "cus_none", [
        GUEST.email.toUpperCase(),
      ])
      const after = await linkRow(getContainer(), id)
      const [promotion] = await getContainer()
        .resolve(Modules.PROMOTION)
        .listPromotions({ id: [before.promotion_id ?? ""] }, { select: ["status"] })

      expect(before.sealed).not.toBeNull()
      expect(erased).toBe(1)
      expect(after).toMatchObject({
        status: "canceled",
        sealed: null,
        email_hash: null,
        token_sealed: null,
        token_hash: null,
      })
      expect(promotion?.status).toBe("inactive")
      expect((await view(tokenOf(made.data.share?.url))).status).toBe(404)
    })
  },
})
