import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import sharp from "sharp"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { AI_MODULE } from "../../src/modules/ai"
import type AiModuleService from "../../src/modules/ai/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import { askFor, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface Job {
  id: string
  status: string
  result_summary: {
    done: { media_id: string; result_id: string; suggestion_id: string | null }[]
    failed: { media_id: string; key: string }[]
    skipped: number
  } | null
}

const picture = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 40, g: 90, b: 160 } } })
    .png()
    .toBuffer()

/**
 * Aşama 4 (adr/0071 §5, §8; docs/22 PR 4-1): a background job over
 * pictures of the library, on the fake service only (nothing leaves the
 * machine). The result is a new record beside the original, marked as AI
 * edited; the original is untouched; each picture has its usage row.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    const usages = () => getContainer().resolve<AiModuleService>(AI_MODULE).listAiUsages({})

    managedForThisFile()

    async function upload(): Promise<string> {
      const form = new FormData()
      form.append(
        "files",
        new Blob([new Uint8Array(await picture())], { type: "image/png" }),
        "vazo.png"
      )
      const { data } = await http.post<{ files: { id: string }[] }>("/admin/uploads", form, {
        headers: owner.headers,
      })
      const registered = await http.post<{ media: { id: string }[] }>(
        "/admin/media",
        { file_ids: data.files.map((file) => file.id), library: true },
        { headers: owner.headers }
      )
      const id = registered.data.media[0]?.id
      if (!id) {
        throw new Error("no media registered")
      }
      return id
    }

    async function settled(id: string): Promise<Job> {
      for (let attempt = 0; attempt < 480; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(`/admin/async-jobs/${id}`, {
          headers: owner.headers,
        })
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      throw new Error("job did not finish")
    }

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
      await connectFake(http, owner.headers, key)
    })

    it("edits a picture into a new marked record, the original untouched, one usage row", async () => {
      const originalId = await upload()
      const [before] = await media().listMediaAssets({ id: originalId })

      const asked = await settle(
        http.post<{ job_id: string; service: string }>(
          "/admin/ai/suggestions",
          {
            task: "image_background",
            entity_type: "media",
            entity_ids: [originalId],
            option: "white",
            service: "fake",
          },
          { headers: owner.headers }
        )
      )
      expect(asked.status).toBe(202)
      expect(asked.data.service).toBe("fake")

      const job = await settled(asked.data.job_id)
      expect(job.status).toBe("succeeded")
      expect(job.result_summary).toMatchObject({ failed: [], skipped: 0 })
      const resultId = job.result_summary?.done[0]?.result_id ?? "none"

      const [copy] = await media().listMediaAssets({ derived_from_id: originalId })
      expect(copy).toMatchObject({ id: resultId, ai_source: "edited", in_library: false })
      expect(copy?.url).not.toBe(before?.url)
      const [after] = await media().listMediaAssets({ id: originalId })
      expect(after).toMatchObject({ url: before?.url, size: before?.size, ai_source: null })

      const rows = await usages()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        task: "image_background",
        capability: "image_edit",
        service: "fake",
        status: "succeeded",
        entity_type: "media",
        entity_id: originalId,
        images: 1,
        // The fake service has no price
        estimated_cost_micros: null,
        requested_by: owner.userId,
      })
    })

    it("refuses an SVG and a record with no stored master, queueing nothing", async () => {
      const svg = await media().createMediaAssets({
        file_id: "logo-01J.svg",
        url: "http://localhost/static/logo-01J.svg",
        mime_type: "image/svg+xml",
      })
      // Linked from another site: no bytes of ours to send
      const foreign = await media().createMediaAssets({
        url: "https://elsewhere.example/vazo.png",
        mime_type: "image/png",
      })
      const body = (id: string) => ({
        task: "image_background",
        entity_type: "media",
        entity_ids: [id],
        option: "white",
        service: "fake",
      })

      const refusedSvg = await ask(owner.headers, body(svg.id))
      const refusedForeign = await ask(owner.headers, body(foreign.id))
      // A text task cannot be asked of pictures, nor this task of a product
      const wrongEntity = await ask(owner.headers, {
        task: "image_background",
        entity_type: "product",
        entity_id: "prod_01",
      })

      expect([refusedSvg.status, refusedSvg.data.message]).toEqual([400, "ai.input_unsupported"])
      expect([refusedForeign.status, refusedForeign.data.message]).toEqual([
        400,
        "ai.unknown_entity",
      ])
      expect(wrongEntity.status).toBe(400)
      expect(await usages()).toEqual([])
    })
  },
})
