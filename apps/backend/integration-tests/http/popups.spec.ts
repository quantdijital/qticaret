import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface AdminPopup {
  id: string
  name: string
  type: string
  design: string
  is_active: boolean
  state: string
  pages: string[]
  frequency_days: number | null
  counts: { impressions: number; clicks: number; closes: number; signups: number }
}

interface StorePopups {
  popups: Record<string, unknown>[]
}

const INFO = {
  name: "Kış duyurusu",
  type: "info",
  title: "Kargo bedava",
  body: "500 TL üzeri siparişlerde\nkargo bizden.",
  button_label: "Alışverişe başla",
  button_href: "/kategori/kis",
  page_scope: "selected",
  pages: ["home", "category"],
  device: "mobile",
  trigger: "scroll",
  trigger_value: 40,
  frequency: "days",
  frequency_days: 3,
  layout: "corner",
  design: "split",
  priority: 5,
}

/**
 * adr/0080 S1: pop-ups written in the panel, read by the storefront only
 * while live, behind `marketing.popups`; writes for the owner and admin.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown, headers = admin.headers) =>
      settle(http.post<T & { message?: string; field?: string }>(url, body, { headers }))
    const adminGet = <T>(url: string, headers = admin.headers) =>
      settle(http.get<T>(url, { headers }))
    const storePopups = () =>
      settle(http.get<StorePopups>("/store/popups", { headers: store.headers }))
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    // Flags live in a cache that outlives the database reset between tests
    afterEach(async () => {
      await settings().setFeature("marketing.popups", true, null)
    })

    it("creates a pop-up off, shows it on the storefront once switched on, without the panel's fields", async () => {
      const created = await post<{ popup: AdminPopup }>("/admin/popups", INFO)
      expect(created.status).toBe(201)
      const { id } = created.data.popup
      expect(created.data.popup).toMatchObject({
        is_active: false,
        state: "off",
        pages: ["home", "category"],
      })
      expect(created.data.popup.counts).toEqual({
        impressions: 0,
        clicks: 0,
        closes: 0,
        signups: 0,
      })

      expect((await storePopups()).data.popups).toEqual([])

      const on = await post<{ popup: AdminPopup }>(`/admin/popups/${id}/status`, {
        is_active: true,
      })
      expect(on.data.popup.state).toBe("live")

      const live = await storePopups()
      expect(live.status).toBe(200)
      expect(live.headers["cache-control"]).toContain("max-age=60")
      expect(live.data.popups).toEqual([
        {
          id,
          type: "info",
          title: "Kargo bedava",
          body: "500 TL üzeri siparişlerde\nkargo bizden.",
          image: null,
          button: { label: "Alışverişe başla", href: "/kategori/kis" },
          submit_label: null,
          promotion: null,
          targeting: {
            pages: ["home", "category"],
            device: "mobile",
            visitor: "any",
            membership: "any",
          },
          trigger: { kind: "scroll", value: 40 },
          frequency: { kind: "days", days: 3 },
          layout: "corner",
          design: "split",
          priority: 5,
          ends_at: null,
        },
      ])
      expect(live.data.popups[0]).not.toHaveProperty("name")
      expect(live.data.popups[0]).not.toHaveProperty("is_active")
    })

    it("starts a pop-up as classic, changes its design, refuses one it does not know", async () => {
      const withoutDesign: Partial<typeof INFO> = { ...INFO }
      delete withoutDesign.design
      const created = await post<{ popup: AdminPopup }>("/admin/popups", withoutDesign)
      expect(created.status).toBe(201)
      expect(created.data.popup.design).toBe("classic")
      const { id } = created.data.popup

      const changed = await post<{ popup: AdminPopup }>(`/admin/popups/${id}`, { design: "coupon" })
      expect(changed.status).toBe(200)
      expect(changed.data.popup).toMatchObject({ design: "coupon", layout: "corner" })

      const refused = await post(`/admin/popups/${id}`, { design: "fullscreen" })
      expect(refused.status).toBe(400)
      const read = await adminGet<{ popup: { design: string } }>(`/admin/popups/${id}`)
      expect(read.data.popup.design).toBe("coupon")
    })

    it("keeps fields left out of a change, empties what a choice no longer uses", async () => {
      const { id } = (await post<{ popup: AdminPopup }>("/admin/popups", INFO)).data.popup
      const changed = await post<{ popup: AdminPopup }>(`/admin/popups/${id}`, {
        page_scope: "all",
        frequency: "session",
      })
      expect(changed.status).toBe(200)
      expect(changed.data.popup).toMatchObject({
        name: "Kış duyurusu",
        pages: [],
        frequency_days: null,
      })
    })

    it("refuses what the fields say together, naming the field", async () => {
      const cases: [Record<string, unknown>, string, string][] = [
        [{ type: "campaign" }, "popups.promotion_required", "promotion_id"],
        [{ button_href: null }, "popups.button_incomplete", "button_href"],
        [{ page_scope: "selected", pages: [] }, "popups.pages_required", "pages"],
        [{ trigger: "scroll", trigger_value: 0 }, "popups.trigger_value_invalid", "trigger_value"],
        [
          { starts_at: "2026-12-02T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" },
          "popups.dates_invalid",
          "ends_at",
        ],
        [{ type: "newsletter" }, "popups.button_link_not_allowed", "button_href"],
        [{ button_href: "javascript:alert(1)" }, "popups.link_invalid", "button_href"],
      ]
      for (const [change, message] of cases) {
        const refused = await post("/admin/popups", { ...INFO, ...change })
        expect([refused.status, refused.data.message]).toEqual([400, message])
      }
      expect((await post("/admin/popups", { ...INFO, pages: ["checkout"] })).status).toBe(400)
      expect((await adminGet<{ count: number }>("/admin/popups")).data.count).toBe(0)
    })

    it("hides a pop-up outside its dates and lists where each stands", async () => {
      const future = await post<{ popup: AdminPopup }>("/admin/popups", {
        ...INFO,
        name: "Yılbaşı",
        is_active: true,
        starts_at: "2099-01-01T00:00:00Z",
      })
      expect(future.data.popup.state).toBe("scheduled")
      const past = await post<{ popup: AdminPopup }>("/admin/popups", {
        ...INFO,
        name: "Geçen yaz",
        is_active: true,
        starts_at: "2020-06-01T00:00:00Z",
        ends_at: "2020-09-01T00:00:00Z",
      })
      expect(past.data.popup.state).toBe("ended")
      expect((await storePopups()).data.popups).toEqual([])

      const list = await adminGet<{ popups: AdminPopup[]; count: number }>("/admin/popups?q=yaz")
      expect(list.data.count).toBe(1)
      expect(list.data.popups[0]?.name).toBe("Geçen yaz")
    })

    it("deletes a pop-up: gone from the panel and the storefront", async () => {
      const { id } = (
        await post<{ popup: AdminPopup }>("/admin/popups", { ...INFO, is_active: true })
      ).data.popup
      expect((await storePopups()).data.popups).toHaveLength(1)
      const deleted = await settle(http.delete(`/admin/popups/${id}`, { headers: admin.headers }))
      expect(deleted.data).toEqual({ id, object: "popup", deleted: true })
      expect((await adminGet(`/admin/popups/${id}`)).status).toBe(404)
      expect((await storePopups()).data.popups).toEqual([])
    })

    it("answers as missing while marketing.popups is off; the storefront's frame says so", async () => {
      await post("/admin/popups", { ...INFO, is_active: true })
      const frame = async () =>
        (
          await http.get<{ features: { popups?: boolean } }>("/store/storefront", {
            headers: store.headers,
          })
        ).data.features.popups
      expect(await frame()).toBe(true)

      await post("/admin/features/marketing.popups", { enabled: false })
      expect((await storePopups()).status).toBe(404)
      expect((await adminGet("/admin/popups")).status).toBe(404)
      expect(
        (await post("/store/popups/popup_x/events", { type: "click" }, store.headers)).status
      ).toBe(404)
      expect(await frame()).toBe(false)

      await post("/admin/features/marketing.popups", { enabled: true })
      expect((await storePopups()).data.popups).toHaveLength(1)
    })

    it("lets every role read and only the owner and admin write", async () => {
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const adminRole = await createAdminUser(http, getContainer(), "admin")
      expect((await post("/admin/popups", INFO, operations.headers)).status).toBe(403)
      expect((await post("/admin/popups", INFO, readonly.headers)).status).toBe(403)
      expect((await post("/admin/popups", INFO, adminRole.headers)).status).toBe(201)
      expect((await adminGet("/admin/popups", readonly.headers)).status).toBe(200)
    })
  },
})
