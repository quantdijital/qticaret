import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface AdminPopup {
  id: string
  state: string
  promotion: { id: string; code: string | null; state: string } | null
  counts: { impressions: number; clicks: number; closes: number; signups: number }
  daily: { day: string; impressions: number; clicks: number }[]
}

interface StorePopup {
  id: string
  promotion: { code: string | null; automatic: boolean } | null
  image: { url: string; alt: string | null; width: number | null; height: number | null } | null
  submit_label: string | null
}

const IMAGE = "https://cdn.example.com/media/kis-kampanya.jpg"

/**
 * adr/0080 S1: a campaign pop-up shows its promotion's code only while the
 * promotion takes orders; pictures come from the media library; the
 * storefront's counters count live pop-ups only, without the visitor.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown, headers = admin.headers) =>
      settle(http.post<T & { message?: string }>(url, body, { headers }))
    const live = async () =>
      (await http.get<{ popups: StorePopup[] }>("/store/popups", { headers: store.headers })).data
        .popups
    const detail = async (id: string) =>
      (await http.get<{ popup: AdminPopup }>(`/admin/popups/${id}`, { headers: admin.headers }))
        .data.popup
    const count = (id: string, type: string) =>
      post(`/store/popups/${id}/events`, { type }, store.headers)

    const promotion = async (code: string, extra: Record<string, unknown> = {}) =>
      (
        await post<{ promotion: { id: string } }>("/admin/promotions", {
          code,
          type: "standard",
          is_automatic: false,
          is_tax_inclusive: true,
          status: "active",
          application_method: {
            type: "percentage",
            target_type: "order",
            allocation: "across",
            value: 10,
          },
          ...extra,
        })
      ).data.promotion.id

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    it("shows a live promotion's code and hides the pop-up once the promotion stops", async () => {
      const promotionId = await promotion("KIS10")
      const created = await post<{ popup: AdminPopup }>("/admin/popups", {
        name: "Kış kampanyası",
        type: "campaign",
        title: "%10 indirim",
        promotion_id: promotionId,
        is_active: true,
      })
      expect(created.status).toBe(201)
      const { id } = created.data.popup
      expect(created.data.popup.state).toBe("live")
      expect(created.data.popup.promotion).toEqual({
        id: promotionId,
        code: "KIS10",
        state: "live",
      })
      expect((await live()).map((each) => [each.id, each.promotion])).toEqual([
        [id, { code: "KIS10", automatic: false }],
      ])

      await post(`/admin/promotions/${promotionId}`, { status: "inactive" })
      expect(await live()).toEqual([])
      expect((await detail(id)).state).toBe("campaign_inactive")
    })

    it("refuses a promotion that does not exist and a promotion on another type", async () => {
      const unknown = await post("/admin/popups", {
        name: "x",
        type: "campaign",
        title: "x",
        promotion_id: "promo_yok",
      })
      expect([unknown.status, unknown.data.message]).toEqual([400, "popups.promotion_unknown"])
      const promotionId = await promotion("BILGI5")
      const other = await post("/admin/popups", {
        name: "x",
        type: "info",
        title: "x",
        promotion_id: promotionId,
      })
      expect([other.status, other.data.message]).toEqual([400, "popups.promotion_not_allowed"])
    })

    it("takes a picture from the media library only, and gives its size to the storefront", async () => {
      const outside = await post("/admin/popups", {
        name: "x",
        type: "newsletter",
        title: "Bültene katılın",
        image_url: "https://elsewhere.example.com/a.jpg",
      })
      expect([outside.status, outside.data.message]).toEqual([400, "popups.image_unknown"])

      await getContainer()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .createMediaAssets([
          {
            url: IMAGE,
            file_id: "kis-kampanya",
            mime_type: "image/jpeg",
            width: 1200,
            height: 800,
            in_library: true,
          },
        ])
      const created = await post<{ popup: AdminPopup }>("/admin/popups", {
        name: "Bülten",
        type: "newsletter",
        title: "Bültene katılın",
        image_url: IMAGE,
        image_alt: "Karlı dağ",
        button_label: "Abone ol",
        is_active: true,
      })
      expect(created.status).toBe(201)
      const [shown] = await live()
      expect(shown?.image).toMatchObject({ url: IMAGE, alt: "Karlı dağ", width: 1200, height: 800 })
      expect(shown?.submit_label).toBe("Abone ol")
    })

    it("counts a live pop-up's events by day, nothing for unknown ids or the wrong event", async () => {
      const { id } = (
        await post<{ popup: AdminPopup }>("/admin/popups", {
          name: "Duyuru",
          type: "info",
          title: "Yeni sezon",
          is_active: true,
        })
      ).data.popup
      for (const type of ["impression", "impression", "click", "close", "signup"]) {
        expect((await count(id, type)).status).toBe(204)
      }
      // The same answer for an id that does not exist
      expect((await count("popup_yok", "impression")).status).toBe(204)
      expect((await count(id, "purchase")).status).toBe(400)

      const read = await detail(id)
      // A sign-up is a newsletter pop-up's only
      expect(read.counts).toEqual({ impressions: 2, clicks: 1, closes: 1, signups: 0 })
      expect(read.daily).toHaveLength(1)
      expect(read.daily[0]).toMatchObject({ impressions: 2, clicks: 1 })

      // Switched off, it counts no more
      await post(`/admin/popups/${id}/status`, { is_active: false })
      await count(id, "impression")
      expect((await detail(id)).counts.impressions).toBe(2)
    })
  },
})
