import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { storefrontSection } from "../../src/modules/platform-settings/sections/storefront"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Roles {
  contact_page_id: string | null
  payment_page_id: string | null
  shipping_page_id: string | null
  contact_form_path: string | null
  payment_info_path: string | null
  shipping_info_path: string | null
}

/**
 * The storefront's page roles by the page's id (adr/0073 Açık kararlar 3):
 * a page whose address changes keeps its role; a section saved before the
 * ids still finds its pages by their old addresses.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    // A section as saved before the ids: the paths only (the service skips the workflow's roles)
    const pathsOnly = () =>
      settings().saveSection("storefront", { ...storefrontSection.defaults }, null)

    beforeEach(pathsOnly)
    // Settings outlive the database reset between tests (their cache)
    afterEach(pathsOnly)

    it("keeps a role when its page's address changes, and drops it when the page goes", async () => {
      const container = getContainer()
      const owner = { headers: (await createAdminUser(http, container)).headers }
      const store = await createStorefront(container)
      const frame = async () =>
        (
          await settle(
            http.get<{ storefront: Roles }>("/store/storefront", { headers: store.headers })
          )
        ).data.storefront
      const save = (body: unknown) =>
        settle(http.post("/admin/platform-settings/storefront", body, owner))
      const stored = async () =>
        (await settle(http.get<{ values: Roles }>("/admin/platform-settings/storefront", owner)))
          .data.values
      const entry = async (body: Record<string, unknown>, id?: string) =>
        (
          await settle(
            http.post<{ entry: { id: string } }>(
              id ? `/admin/content/${id}` : "/admin/content",
              body,
              { headers: owner.headers }
            )
          )
        ).data.entry

      const contact = await entry({
        kind: "page",
        title: "İletişim",
        handle: "iletisim",
        status: "published",
      })
      const shipping = await entry({
        kind: "page",
        title: "Kargo",
        handle: "kargo",
        status: "draft",
      })
      const post = await entry({ kind: "post", title: "Duyuru", status: "published" })

      // Saved before the ids: the page at the old address has the role
      const legacy = await frame()
      // The next save writes the page's id, and no path
      expect((await save({ announcements: [] })).status).toBe(200)
      const converted = await stored()
      await entry({ handle: "bize-ulasin" }, contact.id)
      const renamed = await frame()
      const aPost = await save({ payment_page_id: post.id })
      const nothing = await save({ payment_page_id: "cnt_01JDNOTHERE" })
      const draft = await save({ shipping_page_id: shipping.id })
      const withDraft = await frame()
      await settle(http.delete(`/admin/content/${contact.id}`, owner))
      const deleted = await frame()
      // The deleted page's id stays stored: other saves go on
      const after = await save({ announcements: [] })

      expect(legacy).toMatchObject({ contact_page_id: contact.id, contact_form_path: "/iletisim" })
      expect(converted).toMatchObject({
        contact_page_id: contact.id,
        contact_form_path: null,
        // No page at the old addresses yet: kept, the page may come
        payment_page_id: null,
        payment_info_path: "/odeme-secenekleri",
      })
      expect(renamed).toMatchObject({
        contact_page_id: contact.id,
        contact_form_path: "/bize-ulasin",
      })
      expect(aPost.status).toBe(400)
      expect(JSON.stringify(aPost.data)).toContain("platform_settings.page_unknown")
      expect(nothing.status).toBe(400)
      expect(draft.status).toBe(200)
      // A draft has its role, but no address to link to
      expect(withDraft).toMatchObject({ shipping_page_id: shipping.id, shipping_info_path: null })
      expect(deleted).toMatchObject({ contact_page_id: null, contact_form_path: null })
      expect(after.status).toBe(200)
    })

    it("turns a role off: the old address no longer finds a page", async () => {
      const container = getContainer()
      const owner = { headers: (await createAdminUser(http, container)).headers }
      const store = await createStorefront(container)
      await settle(
        http.post(
          "/admin/content",
          { kind: "page", title: "İletişim", handle: "iletisim", status: "published" },
          { headers: owner.headers }
        )
      )

      const off = await settle(
        http.post(
          "/admin/platform-settings/storefront",
          { contact_page_id: null },
          { headers: owner.headers }
        )
      )
      const { data } = await settle(
        http.get<{ storefront: Roles }>("/store/storefront", { headers: store.headers })
      )

      expect(off.status).toBe(200)
      expect(data.storefront).toMatchObject({ contact_page_id: null, contact_form_path: null })
    })
  },
})
