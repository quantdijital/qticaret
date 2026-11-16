import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

const ICON = "https://cdn.magaza.example/simge.png"
const PHOTO = "https://cdn.magaza.example/kapak.jpg"
const HEAVY = "https://cdn.magaza.example/agir.png"
const UNMEASURED = "https://cdn.magaza.example/olcusuz.png"

interface Site {
  shop: { name: string; logo_url: string | null; favicon_url: string | null }
}

/**
 * The store profile's site icon: one of the shop's uploads, a PNG within
 * 1 MB, kept like the share image, and served to the storefront's frame
 * (`/store/seo/site`); none, the storefront keeps its own.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("takes a PNG from the library as the site icon and gives it to the storefront", async () => {
      const container = getContainer()
      const admin = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
      // As uploads leave them: a file behind each address
      const [icon] = await media.createMediaAssets([
        { url: ICON, file_id: "favicon-icon", mime_type: "image/png", size: 4_096 },
        { url: PHOTO, file_id: "favicon-photo", mime_type: "image/jpeg", size: 40_960 },
        { url: HEAVY, file_id: "favicon-heavy", mime_type: "image/png", size: 2 * 1024 * 1024 },
        { url: UNMEASURED, file_id: "favicon-unmeasured", mime_type: "image/png", size: null },
      ])
      const save = (favicon_url: string | null) =>
        settle(
          http.post<{ message?: string; values?: { favicon_url: string | null } }>(
            "/admin/platform-settings/appearance",
            { favicon_url },
            { headers: admin.headers }
          )
        )
      const site = async () =>
        (await http.get<Site>("/store/seo/site", { headers: store.headers })).data.shop

      // None yet: the storefront keeps its own icon
      expect((await site()).favicon_url).toBeNull()

      const stranger = await save("https://evil.example/x.png")
      expect([stranger.status, stranger.data.message]).toEqual([
        400,
        "platform_settings.favicon_unknown",
      ])
      const photo = await save(PHOTO)
      expect([photo.status, photo.data.message]).toEqual([400, "platform_settings.favicon_type"])
      const heavy = await save(HEAVY)
      expect([heavy.status, heavy.data.message]).toEqual([
        400,
        "platform_settings.favicon_too_large",
      ])
      // A record that never measured its file proves no limit
      const unmeasured = await save(UNMEASURED)
      expect([unmeasured.status, unmeasured.data.message]).toEqual([
        400,
        "platform_settings.favicon_unknown",
      ])
      // Not script-capable or inline, as a logo
      expect((await save("data:image/png;base64,AAAA")).status).toBe(400)

      const saved = await save(ICON)
      expect(saved.status).toBe(200)
      expect(saved.data.values?.favicon_url).toBe(ICON)
      expect((await site()).favicon_url).toBe(ICON)
      // Kept from the nightly sweep of abandoned uploads, and named where it is used
      const [kept] = await media.listMediaAssets(
        { id: icon?.id ?? "" },
        { select: ["attached_at"] }
      )
      expect(kept?.attached_at).not.toBeNull()
      const detail = await http.get<{ media: { usage: { kind: string }[] } }>(
        `/admin/media/${icon?.id ?? ""}`,
        { headers: admin.headers }
      )
      expect(detail.data.media.usage.map((use) => use.kind)).toContain("favicon")

      // Taken off: the storefront's own again
      expect((await save(null)).status).toBe(200)
      expect((await site()).favicon_url).toBeNull()
    })
  },
})
