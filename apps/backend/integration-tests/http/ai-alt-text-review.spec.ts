import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CONTENT_DRAFTS_MODULE } from "../../src/modules/content-drafts"
import type ContentDraftsModuleService from "../../src/modules/content-drafts/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import { pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface OpenSuggestion {
  id: string
  service: string
  text: string
  media: { id: string; url: string; filename: string; alt: string | null }
}

/**
 * docs/22 "Aşama 5", PR 5-2: the panel's review list of image alt text
 * suggestions. Only open ones, the newest per image, for images that
 * still exist; the task's roles only; reading writes nothing. No service
 * is called: the suggestions are kept as the bulk job leaves them.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const drafts = () => getContainer().resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    const list = (headers: Record<string, string>, task = "image_alt_text") =>
      settle(
        http.get<{ suggestions: OpenSuggestion[]; message?: string }>(
          `/admin/ai/suggestions?task=${task}`,
          { headers }
        )
      )

    managedForThisFile()

    beforeEach(async () => {
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
    })

    async function image(name: string) {
      const [asset] = await media().createMediaAssets([
        {
          url: `http://localhost:9000/static/${name}.jpg`,
          file_id: `${name}.jpg`,
          filename: `${name}.jpg`,
          mime_type: "image/jpeg",
        },
      ])
      if (!asset) {
        throw new Error("no media created")
      }
      return asset
    }

    async function suggestion(
      entityId: string,
      text: string,
      status = "draft",
      kind = "image_alt_text"
    ) {
      const [draft] = await drafts().createContentDrafts([
        {
          entity_type: "media",
          entity_id: entityId,
          kind,
          text,
          prompt: "-",
          provider: "fake",
          source: "ai_suggestion",
          status: status as "draft",
          created_by: owner.userId,
        },
      ])
      // Apart in time, so "newest" is not left to the clock's resolution
      await new Promise((resolve) => setTimeout(resolve, 15))
      return draft
    }

    it("lists the open suggestions, the newest per image, with the image", async () => {
      const first = await image("kupa")
      const second = await image("tabak")
      await suggestion(first.id, "Eski öneri")
      const newest = await suggestion(first.id, "Mavi seramik kupa")
      const other = await suggestion(second.id, "Beyaz porselen tabak")
      await suggestion(second.id, "Reddedilmiş öneri", "rejected")
      await suggestion("media_01GONE", "Silinmiş görsel")
      // adr/0005's old drafts in the same table are not the core's
      const [old] = await drafts().createContentDrafts([
        {
          entity_type: "media",
          entity_id: second.id,
          kind: "image_alt_text",
          text: "Eski taslak",
          prompt: "-",
          provider: "fake",
          source: "ai_draft",
          status: "draft",
          created_by: owner.userId,
        },
      ])

      const answer = await list(owner.headers)

      expect(answer.status).toBe(200)
      expect(answer.data.suggestions).toEqual([
        {
          id: other?.id,
          service: "fake",
          text: "Beyaz porselen tabak",
          created_at: expect.any(String) as unknown,
          media: { id: second.id, url: second.url, filename: "tabak.jpg", alt: null },
        },
        {
          id: newest?.id,
          service: "fake",
          text: "Mavi seramik kupa",
          created_at: expect.any(String) as unknown,
          media: { id: first.id, url: first.url, filename: "kupa.jpg", alt: null },
        },
      ])
      expect(answer.data.suggestions.map((each) => each.id)).not.toContain(old?.id)
      // Reading decides nothing
      const [kept] = await drafts().listContentDrafts({ id: newest?.id ?? "" }, { take: 1 })
      expect(kept?.status).toBe("draft")
    })

    it("answers an empty list when nothing waits", async () => {
      const answer = await list(owner.headers)
      expect(answer.status).toBe(200)
      expect(answer.data.suggestions).toEqual([])
    })

    it("takes the image task only, and the task's roles only", async () => {
      expect((await list(owner.headers, "seo_title")).status).toBe(400)
      const operations = await createAdminUser(http, getContainer(), "operations")
      const refused = await list(operations.headers)
      expect(refused.status).toBe(403)
      const unsigned = await settle(http.get("/admin/ai/suggestions?task=image_alt_text"))
      expect(unsigned.status).toBe(401)
    })
  },
})
