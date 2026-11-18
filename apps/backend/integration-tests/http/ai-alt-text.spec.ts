import { rmSync } from "node:fs"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import sharp from "sharp"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import { aiRecords, askFor, connectFake, pushPlan, storedRunsWith } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Job {
  id: string
  status: string
  result_summary: Record<string, unknown> | null
}

// A name that must stay home: a file name may carry a person's
const FILE_NAME = "ayse-yilmaz-kupa.png"

const picture = () =>
  sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 30, g: 90, b: 160 } } })
    .png()
    .toBuffer()

/**
 * docs/22 "Aşama 5" (adr/0071 §8–§10): an image's alt text on the fake
 * service. The picture is read from the shop's storage and sent as bytes,
 * never its address or its file name; the suggestion writes nothing to
 * the image; the bulk job asks only for images with no alt text.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())
    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)

    managedForThisFile()

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
      await connectFake(http, owner.headers, key)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    afterAll(() => {
      for (const path of filesNamed(/ayse-yilmaz-kupa/)) {
        rmSync(path, { force: true })
      }
    })

    async function libraryImage(): Promise<{ id: string; url: string }> {
      const form = new FormData()
      form.append(
        "files",
        new Blob([new Uint8Array(await picture())], { type: "image/png" }),
        FILE_NAME
      )
      const uploaded = await http.post<{ files: { id: string }[] }>("/admin/uploads", form, {
        headers: owner.headers,
      })
      const registered = await http.post<{ media: { id: string; url: string }[] }>(
        "/admin/media",
        { file_ids: [uploaded.data.files[0]?.id], library: true },
        { headers: owner.headers }
      )
      const [asset] = registered.data.media
      if (!asset) {
        throw new Error("no media registered")
      }
      return asset
    }

    function watching(): TextRequest[] {
      const seen: TextRequest[] = []
      const complete = fakeTextConnector.complete.bind(fakeTextConnector)
      jest.spyOn(fakeTextConnector, "complete").mockImplementation((request) => {
        seen.push(request)
        return complete(request)
      })
      return seen
    }

    it("suggests an alt text from the picture's bytes, writing nothing to the image", async () => {
      const asset = await libraryImage()
      const seen = watching()

      const answer = await ask(owner.headers, {
        task: "image_alt_text",
        entity_type: "media",
        entity_id: asset.id,
      })

      expect(answer.status).toBe(201)
      expect(answer.data.suggestion).toMatchObject({ task: "image_alt_text", service: "fake" })
      expect(answer.data.suggestion?.text).toEqual(expect.any(String))
      expect(seen).toHaveLength(1)
      const [request] = seen
      expect(request?.images).toHaveLength(1)
      expect(request?.images?.[0]?.mimeType).toBe("image/jpeg")
      const sent = await sharp(request?.images?.[0]?.bytes).metadata()
      expect(sent).toMatchObject({ format: "jpeg", width: 1024 })
      // Neither the file's address nor its name leaves the shop
      expect(`${request?.system ?? ""}${request?.data ?? ""}`).not.toMatch(
        /ayse|yilmaz|http|static|uploads/i
      )
      // The image's bytes are in no step's stored state
      const base64 = request?.images?.[0]?.bytes.toString("base64").slice(100, 160) ?? "-"
      expect(await storedRunsWith(getContainer(), base64)).toBe(0)

      const [row] = await media().listMediaAssets({ id: asset.id }, { take: 1 })
      expect(row?.alt).toBeNull()
      const usages = await records().usages()
      expect(usages.at(-1)).toMatchObject({
        task: "image_alt_text",
        capability: "vision",
        images: 1,
        status: "succeeded",
        entity_type: "media",
        entity_id: asset.id,
      })
    })

    it("asks an image's task for an image only, and an image for no page's task", async () => {
      const asset = await libraryImage()
      const seo = await ask(owner.headers, {
        task: "seo_title",
        entity_type: "media",
        entity_id: asset.id,
      })
      expect(seo.status).toBe(400)
      expect(seo.data.message).toBe("ai.unknown_entity")
      const wrong = await ask(owner.headers, {
        task: "image_alt_text",
        entity_type: "product",
        entity_id: "prod_01NOPE",
      })
      expect(wrong.status).toBe(400)
    })

    it("asks in bulk only for images with no alt text, each a suggestion", async () => {
      const empty = await libraryImage()
      const named = await libraryImage()
      await media().updateMediaAssets({ id: named.id, alt: "Mavi zemin" })

      const queued = await settle(
        http.post<{ async_job: Job }>(
          "/admin/async-jobs",
          { type: "ai.alt_text", input: { media_ids: [empty.id, named.id] } },
          { headers: owner.headers }
        )
      )
      expect(queued.status).toBe(202)
      let job: Job | undefined
      for (let attempt = 0; attempt < 150; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(
          `/admin/async-jobs/${queued.data.async_job.id}`,
          { headers: owner.headers }
        )
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          job = data.async_job
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(job?.status).toBe("succeeded")
      expect(job?.result_summary).toMatchObject({
        asked: 1,
        suggested: 1,
        skipped: 1,
        stopped: null,
      })
      const drafts = (await records().drafts()).filter((draft) => draft.kind === "image_alt_text")
      expect(drafts.map((draft) => draft.entity_id)).toEqual([empty.id])
      expect(drafts[0]?.status).toBe("draft")
      const [row] = await media().listMediaAssets({ id: empty.id }, { take: 1 })
      expect(row?.alt).toBeNull()

      const tooMany = await settle(
        http.post(
          "/admin/async-jobs",
          {
            type: "ai.alt_text",
            input: { media_ids: Array.from({ length: 51 }, (_, i) => `media_${String(i)}`) },
          },
          { headers: owner.headers }
        )
      )
      expect(tooMany.status).toBe(400)
    })
  },
})
