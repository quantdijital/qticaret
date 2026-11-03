import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import {
  carrierOption,
  linkBody,
  linkFlag,
  linkRow,
  linkShop,
  linksOf,
  makeLink,
  nameStaff,
} from "../helpers/payment-links"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

type Row = Record<string, unknown>

interface Preview {
  preview?: {
    items_total: number
    discount: { amount: number } | null
    shipping_total: number | null
    shipping_estimate: string
    total: number
  }
  message?: string
}

/** adr/0051 §13: what the panel's link screens read, without asking for more than they need. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    let shop: StockShop
    let variantId: string

    const get = <T>(path: string, headers: Record<string, string> = owner.headers) =>
      settle(http.get<T>(path, { headers }))
    const post = <T>(path: string, body: unknown) =>
      settle(http.post<T>(path, body, { headers: owner.headers }))
    const previewBody = (extra: Row = {}): Row => {
      const { address } = linkBody(shop, variantId)
      return {
        lines: [{ variant_id: variantId, quantity: 2 }],
        address,
        shipping_option_id: shop.shippingOptionId,
        ...extra,
      }
    }
    const preview = (body: Row) => post<Preview>("/admin/payment-links/preview", body)

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      owner = await createAdminUser(http, container)
      variantId = (await stockedProduct(container, shop, `bicak-${String(Date.now())}`, 10, 150))
        .variantId
      await linkShop(http, container, owner.headers)
    })
    // Flags and sections live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await linkFlag(http, owner.headers, false)
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("promotions", { free_shipping_threshold: null }, null)
    })

    it("names who made and who canceled a link, never by e-mail, for operations too", async () => {
      const operations = await createAdminUser(http, getContainer(), "operations")
      await nameStaff(getContainer(), owner.userId, "Can", "Öztürk")
      await nameStaff(getContainer(), operations.userId, "Elif", "Kaya")
      const made = await makeLink(http, operations.headers, linkBody(shop, variantId))
      const id = made.data.payment_link?.id ?? ""
      const canceled = await post<{ payment_link: Row }>(`/admin/payment-links/${id}/cancel`, {})
      const list = await get<{ payment_links: Row[] }>("/admin/payment-links", operations.headers)
      const detail = await get<{ payment_link: Row }>(
        `/admin/payment-links/${id}`,
        operations.headers
      )

      expect(made.status).toBe(201)
      expect(made.data.payment_link).toMatchObject({
        created_by_name: "Elif Kaya",
        canceled_by_name: null,
      })
      expect(canceled.data.payment_link).toMatchObject({ created_by_name: "Elif Kaya" })
      expect(list.status).toBe(200)
      expect(list.data.payment_links).toEqual([
        expect.objectContaining({
          id,
          created_by: operations.userId,
          created_by_name: "Elif Kaya",
        }),
      ])
      expect(detail.data.payment_link).toMatchObject({
        status: "canceled",
        created_by_name: "Elif Kaya",
        canceled_by: owner.userId,
        canceled_by_name: "Can Öztürk",
      })
      for (const email of [owner.email, operations.email]) {
        expect(JSON.stringify([list.data, detail.data])).not.toContain(email)
      }
    })

    it("reads a link past its end as expired before the job writes it: list, filters, detail, share and extend", async () => {
      const ended = await makeLink(http, owner.headers, linkBody(shop, variantId))
      const live = await makeLink(http, owner.headers, linkBody(shop, variantId))
      const id = ended.data.payment_link?.id ?? ""
      const liveId = live.data.payment_link?.id ?? ""
      // Ten minutes past: inside the hour a payment under way may take, so the job leaves it
      await linksOf(getContainer()).updatePaymentLinks({
        id,
        expires_at: new Date(Date.now() - 10 * 60 * 1000),
      })
      const ids = async (query: string) =>
        (await get<{ payment_links: Row[] }>(`/admin/payment-links${query}`)).data.payment_links
          .map((row) => [row["id"], row["status"]])
          .sort()
      const all = await ids("")
      const open = await ids("?status=open")
      const expired = await ids("?status=expired")
      const detail = await get<{ payment_link: Row }>(`/admin/payment-links/${id}`)
      const share = await get<{ share: Row }>(`/admin/payment-links/${id}/share`)
      const extend = await post<{ message?: string }>(`/admin/payment-links/${id}/extend`, {
        hours: 24,
      })
      const resend = await post<{ message?: string }>(`/admin/payment-links/${id}/resend`, {
        channels: ["email"],
      })

      expect(all).toEqual(
        [
          [id, "expired"],
          [liveId, "open"],
        ].sort()
      )
      expect(open).toEqual([[liveId, "open"]])
      expect(expired).toEqual([[id, "expired"]])
      expect(detail.data.payment_link["status"]).toBe("expired")
      expect(share.status).toBe(200)
      expect(share.data.share).toMatchObject({ url: null, sms_text: null, whatsapp_url: null })
      expect([extend.status, extend.data.message]).toEqual([409, "payment_link.not_open"])
      expect([resend.status, resend.data.message]).toEqual([409, "payment_link.not_open"])
      // Derived, not written: the row is the job's to close
      expect((await linkRow(getContainer(), id)).status).toBe("open")
    })

    it("prices the preset flat-rate option's shipping for the address into the total, free from the basket threshold after the discount", async () => {
      const priced = await preview(previewBody())
      const threshold = await post("/admin/platform-settings/promotions", {
        free_shipping_threshold: 250,
      })
      const free = await preview(previewBody())
      const discounted = await preview(
        previewBody({ discount: { type: "percentage", value: 20, reason: "DM" } })
      )

      expect(priced.status).toBe(200)
      // Two units of 150 TL; the seed's standard option is 90 TL
      expect(priced.data.preview).toMatchObject({
        items_total: 30_000,
        shipping_total: 9_000,
        shipping_estimate: "priced",
        total: 39_000,
      })
      expect(threshold.status).toBe(200)
      expect(free.data.preview).toMatchObject({
        shipping_total: 0,
        shipping_estimate: "priced",
        total: 30_000,
      })
      // 300 less 20% is 240: under the threshold, as a cart counts it
      expect(discounted.data.preview?.discount?.amount).toBe(6_000)
      expect(discounted.data.preview).toMatchObject({ shipping_total: 9_000, total: 33_000 })
    })

    it("leaves a carrier-priced option, or a form without an address or option, to the checkout, and takes no shipping figure from the request", async () => {
      const carrier = await carrierOption(getContainer(), shop)
      const calculated = await preview(previewBody({ shipping_option_id: carrier }))
      const noAddress = await preview(previewBody({ address: undefined }))
      const noOption = await preview(previewBody({ shipping_option_id: undefined }))
      const claimed = await preview(previewBody({ shipping_total: 0 }))

      for (const answer of [calculated, noAddress, noOption]) {
        expect(answer.status).toBe(200)
        expect(answer.data.preview).toMatchObject({
          items_total: 30_000,
          shipping_total: null,
          shipping_estimate: "at_checkout",
          total: 30_000,
        })
      }
      expect(claimed.status).toBe(400)
    })
  },
})
