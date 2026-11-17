import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MAX_ATTEMPTS } from "../../src/lib/media/video/limits"
import { PROCESSING_FAILED } from "../../src/lib/media/video/transcode-errors"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { sweepProductVideosWorkflow } from "../../src/workflows/media/video/workflows"
import { createAdminUser } from "../helpers/admin"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { setPlanLimits } from "../helpers/plan-limits"
import { holdVideoQueueLock, linkedVideo, stored, storedFile } from "../helpers/video"

jest.setTimeout(300 * 1000)

const DAY_MS = 24 * 60 * 60 * 1000

type Graph = (args: { entity?: string }) => Promise<unknown>

/**
 * adr/0069 slice 3, security review S1: the nightly sweep reads every
 * video up front. A failed clip it read as a week old may be renamed and
 * retried before it acts; the sweep then leaves its source alone, and the
 * clip waits for the job with its source.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    let productId: string

    managedForThisFile()

    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    let releaseQueue: () => Promise<void> = () => Promise.resolve()

    beforeEach(async () => {
      // The job stays out: the sources here are not clips
      releaseQueue = await holdVideoQueueLock(getContainer())
      await setPlanLimits(getContainer(), {})
      owner = await createAdminUser(http, getContainer())
      const [product] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Şef Bıçağı" }])
      productId = product?.id ?? ""
    })

    afterEach(async () => {
      jest.restoreAllMocks()
      await releaseQueue()
    })

    it("keeps a source the sweep read as a week old once it is renamed and retried", async () => {
      const failedClip = async (name: string, failedDaysAgo: number) => {
        const source = await storedFile(getContainer(), Buffer.from(name))
        const video = await linkedVideo(getContainer(), productId, {
          status: "failed",
          error_code: PROCESSING_FAILED,
          attempts: MAX_ATTEMPTS,
          source_file_id: source,
          source_bytes: 6,
          stored_bytes: 6,
          failed_at: new Date(Date.now() - failedDaysAgo * DAY_MS),
        })
        return { video, source }
      }
      // Failed six days ago: still retried today, a week old on the sweep's clock below
      const raced = await failedClip("kaynak", 6)
      // Failed eight days ago and left alone: the sweep takes its source
      const idle = await failedClip("eskisi", 8)

      // The staff act between the sweep's read and its first move
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY) as unknown as {
        graph: Graph
      }
      const graph = query.graph.bind(query)
      let raceRun = false
      jest.spyOn(query, "graph").mockImplementation(async (args) => {
        const read = await graph(args)
        if (args.entity === "media_video" && !raceRun) {
          raceRun = true
          const base = `/admin/products/${productId}/videos/${raced.video.id}`
          expect((await settle(http.post(base, { title: "Yakın çekim" }, owner))).status).toBe(200)
          expect((await settle(http.post(`${base}/retry`, {}, owner))).status).toBe(202)
        }
        return read
      })

      const { result } = await sweepProductVideosWorkflow(getContainer()).run({
        input: { now: Date.now() + 2 * DAY_MS },
      })
      expect(raceRun).toBe(true)

      // The renamed and retried clip keeps its source and waits for the job
      expect(await stored(getContainer(), raced.source)).toBe(true)
      expect((await media().listMediaVideos({ id: raced.video.id }))[0]).toMatchObject({
        status: "uploaded",
        source_file_id: raced.source,
        stored_bytes: 6,
        title: "Yakın çekim",
      })
      // The untouched one's source goes, counted off
      expect(result.sources_removed).toBe(1)
      expect(await stored(getContainer(), idle.source)).toBe(false)
      expect((await media().listMediaVideos({ id: idle.video.id }))[0]).toMatchObject({
        status: "failed",
        source_file_id: null,
        stored_bytes: 0,
      })
    })
  },
})
