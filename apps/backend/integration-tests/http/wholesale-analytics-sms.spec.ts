import { randomInt, randomUUID } from "node:crypto"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { orderAccessKey, orderAccessToken } from "../../src/lib/orders"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { resolveAudience } from "../../src/workflows/campaigns/audience"
import { campaignFixture } from "../helpers/campaigns"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"
import { accountApi, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

/** A mobile of this run: the same number as E.164 and as a shopper types it. */
const mobile = () => {
  const digits = `53${String(randomInt(10_000_000, 99_999_999))}`
  return {
    e164: `+90${digits}`,
    typed: `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`,
  }
}

/**
 * ADR-0068 slice 5 review, taken up (2026-11-18). L2: the order page's
 * purchase event asks the order whether it was a wholesale order
 * (`GET /store/orders/:id/wholesale`), with the page's own access, so a
 * page opened signed out knows too. L4: a text campaign leaves out any
 * phone a wholesaler is known by, a guest order's consent or an imported
 * number included; a retail number is unaffected.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const f = campaignFixture(http, getContainer)

    const wholesaler = async () => {
      const staff = wholesaleApi(http, f.admin.headers)
      await staff.flag(true)
      const email = `toptanci-${randomUUID().slice(0, 8)}@example.com`
      const account = await accountApi(http, f.admin.headers).made({
        email,
        contact_name: "Ali Kaya",
        company_name: "Kaya Bıçak Ltd",
        // A price source of its own, as `wholesale-marketing.spec.ts` makes theirs
        own_prices: true,
      })
      return { staff, email, customerId: account.customer?.id ?? "" }
    }
    /** A granted text consent no customer record stands behind, told to İYS. */
    const guestConsent = async (phone: string) => {
      const { id } = await f.messaging().recordConsent({
        channel: "sms",
        address: phone,
        status: "granted",
        source: "checkout",
        customer_id: null,
        evidence: { text_version: "test" },
      })
      await f.messaging().updateMessageConsents({ id, iys_status: "sent" })
    }
    /** A text campaign to the consents with no record, and its audience count now. */
    const textCampaign = async () => {
      await f.settings().saveSection("marketing", { sms_opt_out_text: "Ret için RET 4600" }, null)
      const created = await f.post<{ campaign: { id: string } }>("", {
        name: "Kış indirimi",
        channel: "sms",
        audience: [{ kind: "newsletter" }],
        sms_text: "Kış indirimi başladı",
      })
      expect(created.status).toBe(201)
      const id = created.data.campaign.id
      return {
        id,
        preview: async () =>
          (await f.post<{ audience: number; eligible: number }>(`/${id}/audience-preview`, {}))
            .data,
      }
    }

    it("tells the order's own holder whether it was a wholesale order, and nobody else", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const storefront = await createStorefront(container)
      const { variantId } = await stockedProduct(
        container,
        shop,
        `toptan-l2-${String(Date.now())}`,
        10,
        120
      )
      const guestOrder = async (email: string) => {
        const id = await placeOrder(container, {
          regionId: shop.regionId,
          salesChannelId: shop.salesChannelId,
          shippingOptionId: shop.shippingOptionId,
          items: [{ variant_id: variantId, quantity: 2 }],
          address: PAYTR_ADDRESS,
          email,
        })
        return { id, key: orderAccessToken(orderAccessKey(), { id, email }) }
      }
      const { customerId } = await wholesaler()
      // Placed by the wholesaler: the stamp may not be written yet, the account's dates decide
      const wholesale = await guestOrder(`toptan-siparis-${randomUUID().slice(0, 6)}@example.com`)
      await container.resolve(Modules.ORDER).updateOrders(wholesale.id, { customer_id: customerId })
      const retail = await guestOrder(`perakende-${randomUUID().slice(0, 6)}@example.com`)
      const stranger = await registerCustomer(http, storefront)
      const ask = (orderId: string, headers: Record<string, string> = {}) =>
        settle(
          http.get<{ wholesale?: boolean; message?: string }>(
            `/store/orders/${orderId}/wholesale`,
            { headers: { ...storefront.headers, ...headers } }
          )
        )

      const signedOut = await ask(wholesale.id, { "x-order-token": wholesale.key })
      const retailAnswer = await ask(retail.id, { "x-order-token": retail.key })
      const bare = await ask(wholesale.id)
      const crossed = await ask(wholesale.id, { "x-order-token": retail.key })
      const signedInStranger = await ask(wholesale.id, stranger.headers)

      expect([signedOut.status, signedOut.data]).toEqual([200, { wholesale: true }])
      expect(signedOut.headers["cache-control"]).toBe("private, no-store")
      expect([retailAnswer.status, retailAnswer.data]).toEqual([200, { wholesale: false }])
      for (const refused of [bare, crossed, signedInStranger]) {
        expect([refused.status, refused.data.wholesale]).toEqual([404, undefined])
      }
    })

    it("leaves a wholesaler's phone out of a text campaign wherever it turns up, a retail one in", async () => {
      const container = getContainer()
      const theirs = mobile()
      const retail = mobile()
      // A guest order's consent and an imported number: no customer record behind either
      await guestConsent(theirs.e164)
      await guestConsent(retail.e164)
      const campaign = await textCampaign()
      const { preview } = campaign
      const before = await preview()

      // The wholesaler's phone only in their address book, written as a shopper types it
      const { staff, customerId } = await wholesaler()
      await container.resolve(Modules.CUSTOMER).createCustomerAddresses([
        {
          customer_id: customerId,
          ...PAYTR_ADDRESS,
          phone: theirs.typed,
        },
      ])
      const during = await preview()
      // What the send freezes at its start is the same reading (I1 unchanged)
      const frozen = await resolveAudience(container, {
        channel: "sms",
        sources: [{ kind: "newsletter" }],
        campaign_id: campaign.id,
      })
      await staff.flag(false)
      const flagOff = await preview()

      const hashOf = (phone: string) => f.messaging().recipientOf("sms", phone)?.hash
      const eligible = frozen.eligible.map((candidate) => candidate.hash)
      expect(during).toMatchObject({
        audience: before.audience - 1,
        eligible: before.eligible - 1,
      })
      expect(eligible).not.toContain(hashOf(theirs.typed))
      expect(eligible).toContain(hashOf(retail.e164))
      // Retail again: the number reaches the campaign as before
      expect(flagOff).toMatchObject({ audience: before.audience, eligible: before.eligible })
    })

    it("knows a wholesaler's guest order under their address however its case was typed", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const { variantId } = await stockedProduct(
        container,
        shop,
        `toptan-l4-${String(Date.now())}`,
        10,
        120
      )
      const theirs = mobile()
      await guestConsent(theirs.e164)
      const { preview } = await textCampaign()
      const before = await preview()

      const { email } = await wholesaler()
      // Signed out, the address typed in another case; the phone only on this order
      const orderId = await placeOrder(container, {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 2 }],
        address: { ...PAYTR_ADDRESS, phone: theirs.typed },
        email: email.replace(/^t/, "T").replace("@example.com", "@Example.COM"),
      })
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["email"],
        filters: { id: orderId },
      })
      const during = await preview()

      // Kept as typed: an exact match would have missed it
      expect((data[0] as { email: string }).email).not.toBe(email)
      expect(during).toMatchObject({
        audience: before.audience - 1,
        eligible: before.eligible - 1,
      })
    })
  },
})
