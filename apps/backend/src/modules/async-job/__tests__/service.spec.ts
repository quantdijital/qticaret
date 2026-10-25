import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { ASYNC_JOB_MODULE } from ".."
import type AsyncJobModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<AsyncJobModuleService>({
  moduleName: ASYNC_JOB_MODULE,
  resolve: "./src/modules/async-job",
  testSuite: ({ service }) => {
    it("runs a queued job once and records its end", async () => {
      const job = await service.createAsyncJobs({ type: "audit_log.export", input: {} })

      const running = await service.markRunning(job.id)
      const again = await service.markRunning(job.id).then(
        () => "started twice",
        (error: unknown) => (error as { safeMessage?: string }).safeMessage
      )
      const done = await service.markSucceeded(job.id, {
        fileId: "file_1",
        summary: { rows: 3 },
        ttlDays: 7,
      })

      expect(running).toMatchObject({ status: "running", attempt: 1, progress: 0 })
      expect(again).toBe("async_job.not_queued")
      expect(done).toMatchObject({ status: "succeeded", progress: 100, result_file_id: "file_1" })
      const ttl = new Date(done.expires_at ?? 0).getTime() - Date.now()
      expect(ttl).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
    })

    it("writes progress at most once a second unless forced", async () => {
      const job = await service.createAsyncJobs({ type: "audit_log.export" })
      await service.markRunning(job.id)

      await service.reportProgress(job.id, 10)
      await service.reportProgress(job.id, 20)
      expect((await service.retrieveAsyncJob(job.id)).progress).toBe(10)

      await service.reportProgress(job.id, 150, "async_job.writing", true)
      expect(await service.retrieveAsyncJob(job.id)).toMatchObject({
        progress: 100,
        progress_key: "async_job.writing",
      })
    })

    it("fails running jobs whose heartbeat stopped, and only those", async () => {
      const stale = await service.createAsyncJobs({ type: "audit_log.export" })
      const fresh = await service.createAsyncJobs({ type: "audit_log.export" })
      await service.markRunning(stale.id)
      await service.markRunning(fresh.id)
      await service.updateAsyncJobs({
        id: stale.id,
        heartbeat_at: new Date(Date.now() - 60 * 60 * 1000),
      })

      const swept = await service.sweepInterrupted(10 * 60 * 1000)

      expect(swept).toEqual([stale.id])
      expect(await service.retrieveAsyncJob(stale.id)).toMatchObject({
        status: "failed",
        error_code: "interrupted",
      })
      expect((await service.retrieveAsyncJob(fresh.id)).status).toBe("running")
    })

    it("does not mark a swept job succeeded, and fails queued jobs that never started", async () => {
      const slow = await service.createAsyncJobs({ type: "audit_log.export" })
      await service.markRunning(slow.id)
      await service.updateAsyncJobs({
        id: slow.id,
        heartbeat_at: new Date(Date.now() - 60 * 60 * 1000),
      })
      const lost = await service.createAsyncJobs({ type: "audit_log.export" })
      // created_at belongs to the database; the test ages a job on purpose
      await service.updateAsyncJobs({
        id: lost.id,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      } as never)

      await service.sweepInterrupted(10 * 60 * 1000)
      const late = await service
        .markSucceeded(slow.id, { fileId: "file_1", summary: {}, ttlDays: 7 })
        .then(
          () => "succeeded",
          (error: unknown) => (error as { safeMessage?: string }).safeMessage
        )

      expect(late).toBe("async_job.not_running")
      expect(await service.retrieveAsyncJob(slow.id)).toMatchObject({
        status: "failed",
        result_file_id: null,
      })
      expect(await service.retrieveAsyncJob(lost.id)).toMatchObject({
        status: "failed",
        error_code: "not_started",
      })
    })

    it("starts a queued job once when two runs race", async () => {
      const job = await service.createAsyncJobs({ type: "audit_log.export" })

      const results = await Promise.allSettled([
        service.markRunning(job.id),
        service.markRunning(job.id),
      ])

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
      expect((await service.retrieveAsyncJob(job.id)).attempt).toBe(1)
    })
  },
})
