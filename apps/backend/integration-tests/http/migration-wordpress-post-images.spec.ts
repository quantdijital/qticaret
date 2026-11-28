import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { ContentDoc } from "../../src/lib/content/doc"
import { wxrFixture } from "../../src/lib/migration/sources/wordpress/__tests__/wxr"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import type { HttpClient } from "../helpers/http"
import type { Counts } from "../helpers/wordpress"
import { wordpressFixture } from "../helpers/wordpress"

jest.setTimeout(600 * 1000)

const POST_PICTURE = /<figure><img [^>]*><\/figure>/

/**
 * adr/0042 Ek 2026-11-27: posts a run moved before the pictures in their
 * texts moved, given them by a refresh-only run (`refresh=post_images`):
 * stored in the media library, put after the text they followed, the
 * owner's edits and the revision date kept; again, nothing twice; one the
 * owner took out stays out.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const wp = wordpressFixture(http, getContainer)
    const content = () => getContainer().resolve<ContentModuleService>(CONTENT_MODULE)

    const send = async (xml: string, query: string) => {
      const queued = await wp.start(Buffer.from(xml), query)
      expect(queued.status).toBe(202)
      const job = await wp.settled(queued.data.async_job.id)
      expect(job.status).toBe("succeeded")
      return job.result_summary as { counts: Counts; refresh?: string[] }
    }
    const post = async () => {
      const [entry] = await content().listContentEntries({ kind: "post", handle: "tava-bakimi" })
      if (!entry) {
        throw new Error("the post is not there")
      }
      return entry
    }
    const types = (body: unknown) => (body as ContentDoc).content.map((block) => block.type)

    it("adds the left-out pictures to posts moved before, once", async () => {
      const wxr = wxrFixture(wp.site())
      expect(wxr).toMatch(POST_PICTURE)
      // The post as a run before this change moved it: its text without the picture
      await send(wxr.replace(POST_PICTURE, ""), "mode=apply")
      const moved = await post()
      expect(types(moved.body)).toEqual(["paragraph", "heading", "paragraph"])
      // The owner adds a line since; it stays
      const edited: ContentDoc = {
        type: "doc",
        content: [
          ...(moved.body as unknown as ContentDoc).content,
          { type: "paragraph", content: [{ type: "text", text: "Sahibin notu." }] },
        ],
      }
      await content().updateContentEntries({ id: moved.id, body: edited as never })
      const revised = moved.revised_at

      const dry = await send(wxr, "mode=check&refresh=post_images")
      expect(dry.refresh).toEqual(["post_images"])
      expect(dry.counts["post"]).toMatchObject({ read: 1, updated: 1 })
      expect(dry.counts["image"]).toMatchObject({ read: 1, created: 1 })
      expect(types((await post()).body)).toHaveLength(4)

      const applied = await send(wxr, "mode=apply&refresh=post_images")
      expect(applied.counts["post"]).toMatchObject({ read: 1, updated: 1, failed: 0 })
      expect(applied.counts["image"]).toMatchObject({ read: 1, created: 1, skipped: 0 })
      // Nothing else of the run: no product touched
      expect(applied.counts["product"]).toMatchObject({ created: 0, updated: 0 })
      const after = await post()
      expect(types(after.body)).toEqual(["paragraph", "image", "heading", "paragraph", "paragraph"])
      const picture = (after.body as unknown as ContentDoc).content[1] as {
        attrs: { src: string; alt?: string | null }
      }
      expect(picture.attrs.alt).toBe("x")
      expect(picture.attrs.src.startsWith(wp.site())).toBe(false)
      const assets = await getContainer()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ url: picture.attrs.src })
      expect(assets).toHaveLength(1)
      expect(after.revised_at).toEqual(revised)

      // Again: stored before, nothing fetched or added
      const fetched = wp.pictures.length
      const again = await send(wxr, "mode=apply&refresh=post_images")
      expect(again.counts["post"]).toMatchObject({ updated: 0, found: 1 })
      expect(again.counts["image"]).toMatchObject({ read: 1, created: 0, found: 1 })
      expect(wp.pictures.length).toBe(fetched)
      expect(types((await post()).body)).toHaveLength(5)

      // The owner takes the picture out: a later refresh leaves it out
      await content().updateContentEntries({ id: moved.id, body: edited as never })
      const later = await send(wxr, "mode=apply&refresh=post_images")
      expect(later.counts["post"]).toMatchObject({ updated: 0, found: 1 })
      expect(types((await post()).body)).toHaveLength(4)
    })
  },
})
