import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { SEO_INDEXNOW } from "../../src/modules/platform-settings/features"
import { imageOf } from "../../src/workflows/seo/payload-sources"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

const SHARE = "https://cdn.magaza.example/paylasim.jpg"

interface Entry {
  key: string
  done: boolean
  blocked: string | null
}

/** F12.10 (KK3): the SEO setup checklist shows what is missing and drops what is done. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("lists a new shop's open items, takes the share image from the library and drops each done item", async () => {
      const container = getContainer()
      const admin = await createAdminUser(http, container)
      const [asset] = await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        // As an upload leaves it: a file behind the address
        .createMediaAssets([{ url: SHARE, file_id: "seo-setup-share" }])
      const open = async () =>
        (
          await http.get<{ items: Entry[] }>("/admin/seo/setup", { headers: admin.headers })
        ).data.items
          .filter((item) => !item.done)
          .map((item) => [item.key, item.blocked])
      const tasks = async () =>
        (
          await http.get<{ seo_setup_open: number }>("/admin/dashboard/tasks", {
            headers: admin.headers,
          })
        ).data.seo_setup_open
      const saveSeo = (body: Record<string, unknown>) =>
        settle(
          http.post<{ message?: string }>("/admin/platform-settings/seo", body, {
            headers: admin.headers,
          })
        )

      // No Google client in tests: those wait for the platform, not the shop
      expect(await open()).toEqual([
        ["legal_identity", null],
        ["legal_texts", null],
        ["canonical_host", null],
        ["share_image", null],
        ["search_console", "google_platform"],
        ["merchant", "google_platform"],
        ["indexnow", null],
      ])
      expect(await tasks()).toBe(5)

      const stranger = await saveSeo({ default_og_image: "https://evil.example/x.png" })
      expect(stranger.status).toBe(400)
      expect(stranger.data.message).toBe("content.image_unknown")

      expect((await saveSeo({ default_og_image: SHARE })).status).toBe(200)
      const [kept] = await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ id: asset?.id ?? "" }, { select: ["attached_at"] })
      expect(kept?.attached_at).not.toBeNull()
      // A page with no image of its own shares the shop's
      expect(await imageOf(container, null, null)).toEqual({ url: SHARE, alt: null })

      expect((await saveSeo({ canonical_host: "magaza.example.com" })).status).toBe(200)
      const flag = await http.post(
        `/admin/features/${SEO_INDEXNOW}`,
        { enabled: true },
        { headers: admin.headers }
      )
      expect(flag.status).toBe(200)

      expect(await open()).toEqual([
        ["legal_identity", null],
        ["legal_texts", null],
        ["search_console", "google_platform"],
        ["merchant", "google_platform"],
      ])
      expect(await tasks()).toBe(2)

      // A robots.txt that shuts the shop opens the item again
      expect((await saveSeo({ robots_txt: "User-agent: *\nDisallow: /" })).status).toBe(200)
      expect((await open()).map(([key]) => key)).toContain("robots")
    })
  },
})
