import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { NO_LIMITS } from "../../src/modules/control-plane/types"
import { MAX_ATTEMPTS } from "../../src/lib/media/video/limits"
import { PROCESSING_FAILED, afterFailure } from "../../src/lib/media/video/transcode-errors"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { PRODUCT_VIDEOS } from "../../src/modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import { doc, managedForThisFile, signed } from "../helpers/control-plane"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { nextSerial, setPlanLimits, setPlanStatus } from "../helpers/plan-limits"
import { holdVideoQueueLock, linkedVideo } from "../helpers/video"

jest.setTimeout(300 * 1000)

interface VideoBody {
  video?: {
    id: string
    status: string
    title: string | null
    error_code: string | null
    retryable: boolean
  }
  message?: string
}

interface AuditRow {
  action: string
  outcome: number | null
  changes: { diff?: Record<string, { before?: unknown; after?: unknown }> } | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * adr/0069 slice 3: a video's title and "Yeniden dene" from the panel.
 * The retry takes only a clip the infrastructure failed whose source is
 * still kept, never lowers `attempts` (the job's claim fence), and counts
 * the next three tries from where it was pressed (`retry_from`).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    let productId: string

    managedForThisFile()

    const base = () => `/admin/products/${productId}/videos`
    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    const rename = (id: string, title: unknown, headers = owner.headers) =>
      settle(http.post<VideoBody>(`${base()}/${id}`, { title }, { headers }))
    const retry = (id: string, headers = owner.headers) =>
      settle(http.post<VideoBody>(`${base()}/${id}/retry`, {}, { headers }))
    const row = async (id: string) => (await media().listMediaVideos({ id }))[0]
    const clip = (fields: Record<string, unknown> = {}) =>
      linkedVideo(getContainer(), productId, {
        source_file_id: "video-kaynak-test.mp4",
        source_bytes: 1000,
        stored_bytes: 1000,
        ...fields,
      })
    const failedClip = (fields: Record<string, unknown> = {}) =>
      clip({
        status: "failed",
        error_code: PROCESSING_FAILED,
        attempts: MAX_ATTEMPTS,
        failed_at: new Date(),
        ...fields,
      })
    const auditOf = (id: string, count: number) =>
      eventually(
        async () =>
          (
            await http.get<{ audit_entries: AuditRow[] }>(
              `/admin/audit-log?resource_id=${id}&kind=mutation&limit=20`,
              { headers: owner.headers }
            )
          ).data.audit_entries,
        (entries) => entries.length >= count
      )

    // The job stays out: these cases move the record themselves (no clip is in storage)
    let releaseQueue: () => Promise<void> = () => Promise.resolve()

    beforeEach(async () => {
      releaseQueue = await holdVideoQueueLock(getContainer())
      await setPlanLimits(getContainer(), {})
      owner = await createAdminUser(http, getContainer())
      const [product] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Şef Bıçağı" }])
      productId = product?.id ?? ""
    })

    afterEach(async () => {
      await releaseQueue()
    })

    it("renames a video, clears its title, and refuses a title on two lines", async () => {
      const video = await clip({ title: "Eski" })
      const renamed = await rename(video.id, "  Yakın çekim  ")
      expect(renamed.status).toBe(200)
      expect(renamed.data.video).toMatchObject({ id: video.id, title: "Yakın çekim" })
      expect((await row(video.id))?.title).toBe("Yakın çekim")

      expect((await rename(video.id, "")).data.video?.title).toBeNull()
      expect((await rename(video.id, null)).status).toBe(200)

      for (const title of ["bir\nik", "x".repeat(201)]) {
        const refused = await rename(video.id, title)
        expect(refused.status).toBe(400)
        expect(refused.data.message).toBe("video.title_invalid")
      }
      expect((await settle(http.post(`${base()}/${video.id}`, {}, owner))).status).toBe(400)

      // Another product's video is not this one's
      const [other] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Ekmek Bıçağı" }])
      const elsewhere = await settle(
        http.post(`/admin/products/${other?.id ?? ""}/videos/${video.id}`, { title: "x" }, owner)
      )
      expect(elsewhere.status).toBe(404)

      // Recorded with the title before and after, never a storage key
      const entries = await auditOf(video.id, 1)
      const first = entries.find(
        (entry) =>
          entry.action === "POST /admin/products/:id/videos/:video_id" && entry.outcome === 200
      )
      expect(first).toBeDefined()
      expect(JSON.stringify(entries)).not.toMatch(/video-kaynak/)
    })

    it("keeps the title and the retry to the catalog roles and closes them when restricted", async () => {
      const video = await failedClip()
      const operations = await createAdminUser(http, getContainer(), "operations")
      expect((await rename(video.id, "x", operations.headers)).status).toBe(403)
      expect((await retry(video.id, operations.headers)).status).toBe(403)

      await setPlanStatus(getContainer(), "restricted")
      expect((await rename(video.id, "x")).data.message).toBe("plan.restricted")
      expect((await retry(video.id)).data.message).toBe("plan.restricted")
      expect((await row(video.id))?.status).toBe("failed")
    })

    it("answers as if the routes did not exist while the flag is off", async () => {
      const video = await failedClip()
      const flags = () =>
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      const pushFlag = async (on: boolean) => {
        const pushed = await settle(
          http.post(
            "/hooks/control-plane/plan",
            signed(
              doc(nextSerial(), {
                limits: { ...NO_LIMITS },
                platform_flags: { [PRODUCT_VIDEOS]: on },
              })
            )
          )
        )
        expect(pushed.status).toBe(200)
        expect(await flags().isFeatureEnabled(PRODUCT_VIDEOS)).toBe(on)
      }
      await pushFlag(false)
      expect([(await rename(video.id, "x")).status, (await retry(video.id)).status]).toEqual([
        404, 404,
      ])
      await pushFlag(true)
      expect((await rename(video.id, "x")).status).toBe(200)
    })

    it("refuses a retry of a clip that did not fail for the infrastructure", async () => {
      const cases = [
        await clip({ status: "ready", source_file_id: null }),
        await clip({ status: "uploaded" }),
        await failedClip({ error_code: "video.unreadable", attempts: 1 }),
      ]
      for (const video of cases) {
        const refused = await retry(video.id)
        expect(refused.status).toBe(409)
        expect(refused.data.message).toBe("video.retry_unavailable")
      }
      const before = await Promise.all(cases.map((video) => row(video.id)))
      expect(before.map((video) => video?.status)).toEqual(["ready", "uploaded", "failed"])
    })

    it("refuses a retry once the source is swept, or about to be", async () => {
      const swept = await failedClip({ source_file_id: null })
      const refused = await retry(swept.id)
      expect(refused.status).toBe(409)
      expect(refused.data.message).toBe("video.source_gone")

      // A week-old failure: the nightly sweep may be removing its source now
      const old = await failedClip({ failed_at: new Date(Date.now() - 7 * DAY_MS + 30 * 60_000) })
      const listed = await settle(http.get<{ videos: VideoBody["video"][] }>(base(), owner))
      expect(listed.data.videos.find((video) => video?.id === old.id)?.retryable).toBe(false)
      // A title change does not make it new again (review S1): the window counts from the failure
      expect((await rename(old.id, "Yakın çekim")).status).toBe(200)
      expect((await row(old.id))?.failed_at).toEqual(old.failed_at)
      const renamed = await settle(http.get<{ videos: VideoBody["video"][] }>(base(), owner))
      expect(renamed.data.videos.find((video) => video?.id === old.id)?.retryable).toBe(false)
      expect((await retry(old.id)).data.message).toBe("video.source_gone")
      expect((await row(old.id))?.status).toBe("failed")
    })

    it("queues a failed clip again, keeping its tries and counting three more from there", async () => {
      const video = await failedClip()
      const listed = await settle(http.get<{ videos: VideoBody["video"][] }>(base(), owner))
      expect(listed.data.videos[0]).toMatchObject({ id: video.id, retryable: true })

      const retried = await retry(video.id)
      expect(retried.status).toBe(202)
      expect(retried.data.video).toMatchObject({
        status: "uploaded",
        error_code: null,
        retryable: false,
      })
      expect(await row(video.id)).toMatchObject({
        status: "uploaded",
        attempts: MAX_ATTEMPTS,
        retry_from: MAX_ATTEMPTS,
        error_code: null,
      })
      // Recorded with its state before and after (read once written, before anything
      // else moves the clip)
      const entries = await auditOf(video.id, 1)
      expect(
        entries.find((each) => each.action === "POST /admin/products/:id/videos/:video_id/retry")
          ?.changes?.diff?.[video.id]
      ).toEqual({
        before: { status: "failed", error_code: PROCESSING_FAILED },
        after: { status: "uploaded", error_code: null },
      })

      // Pressed twice: the second finds it queued
      expect((await retry(video.id)).data.message).toBe("video.retry_unavailable")

      // The job takes it with the tries kept; an infrastructure failure now is the first
      // of three again, not past the cap
      const claimed = await media().claimNextVideo()
      expect(claimed).toMatchObject({ id: video.id, attempts: 3, retry_from: 3 })
      const infra = { kind: "infra" as const, code: PROCESSING_FAILED }
      const next = afterFailure(claimed?.attempts ?? 0, infra, claimed?.retry_from ?? 0)
      expect(await media().markVideoTried(video.id, 3, next)).toBe(true)
      expect(await row(video.id)).toMatchObject({ status: "uploaded", attempts: 4 })
    })

    it("keeps a job taken for dead out after a retry: the fence holds (§4 note)", async () => {
      // A job claimed the clip at 2 tries and went silent; the sweeper failed it at 3
      const video = await clip({
        status: "processing",
        attempts: MAX_ATTEMPTS - 1,
        heartbeat_at: new Date(Date.now() - DAY_MS),
      })
      const stale = MAX_ATTEMPTS - 1
      const swept = await media().requeueStaleVideos(
        new Date(Date.now() + 60_000),
        MAX_ATTEMPTS,
        PROCESSING_FAILED
      )
      expect(swept).toEqual([{ id: video.id, status: "failed" }])

      expect((await retry(video.id)).status).toBe(202)
      const claimed = await media().claimNextVideo()
      expect(claimed?.attempts).toBe(MAX_ATTEMPTS)

      // The dead job's claim (2) can write nothing over the new one's
      const ready = {
        width: 720,
        height: 1280,
        duration_ms: 12_000,
        outputs: {},
        output_file_ids: [],
        poster: {},
        poster_file_ids: [],
        stored_bytes: 1,
      }
      expect(await media().beatVideo(video.id, stale)).toBe(false)
      expect(await media().markVideoReady(video.id, stale, ready)).toBe(false)
      expect(
        await media().markVideoTried(video.id, stale, {
          status: "failed",
          attempts: MAX_ATTEMPTS,
          error_code: "video.unreadable",
        })
      ).toBe(false)
      expect(await media().beatVideo(video.id, MAX_ATTEMPTS)).toBe(true)

      // Silent again: the sweeper counts from the retry, so it goes back to the queue
      await getContainer()
        .resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
        .raw("UPDATE media_video SET heartbeat_at = ? WHERE id = ?", [
          new Date(Date.now() - DAY_MS),
          video.id,
        ])
      const again = await media().requeueStaleVideos(
        new Date(Date.now() + 60_000),
        MAX_ATTEMPTS,
        PROCESSING_FAILED
      )
      expect(again).toEqual([{ id: video.id, status: "uploaded" }])
      expect(await row(video.id)).toMatchObject({ attempts: MAX_ATTEMPTS + 1, retry_from: 3 })
    })
  },
})
