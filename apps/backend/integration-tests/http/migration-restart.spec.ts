import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import asyncJobSweeper from "../../src/jobs/async-job-sweeper"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import { MIGRATION_FILE_PREFIX } from "../../src/workflows/async-job/types/migration-run"
import { bundle, fileOf } from "../fixtures/migration-bundle"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop } from "../helpers/stock"

jest.setTimeout(600 * 1000)

interface RunRow {
  id: string
  status: string
  error_code: string | null
}

const HOUR_AGO = () => new Date(Date.now() - 60 * 60 * 1000)

/** F14 (adr/0042 §9): a run its worker left half-way is failed by the sweep and started again. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    const { settled } = sheetClient(http, getContainer, () => owner.headers)
    const migration = () => getContainer().resolve<MigrationModuleService>(MIGRATION_MODULE)
    const jobs = () => getContainer().resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    const files = () => getContainer().resolve(Modules.FILE)

    /** A run whose worker died: its job running and silent for an hour, its file stored or not. */
    async function interruptedRun(mode: "check" | "apply", { stored = true } = {}) {
      const upload = await files().getUploadStream({
        filename: `${MIGRATION_FILE_PREFIX}${randomUUID()}.json`,
        mimeType: "application/json",
        access: "private",
      })
      upload.writeStream.end(fileOf(bundle))
      await upload.promise
      if (!stored) {
        await files().deleteFiles(upload.fileKey)
      }
      const job = await jobs().createAsyncJobs({
        type: "migration.run",
        status: "running",
        input: { source: "bundle", source_file_id: upload.fileKey, mode, defaults: null },
        requested_by: owner.userId,
        started_at: HOUR_AGO(),
        heartbeat_at: HOUR_AGO(),
      })
      const run = await migration().createMigrationRuns({
        source: "bundle",
        mode,
        job_id: job.id,
        started_by: owner.userId,
      })
      return { run, job, fileKey: upload.fileKey }
    }

    const runsListed = async () =>
      (await http.get<{ runs: RunRow[] }>("/admin/migrations", { headers: owner.headers })).data
        .runs
    const restart = (id: string, headers = owner.headers) =>
      settle(
        http.post<{ async_job: SheetJob; message?: string }>(
          `/admin/migrations/${id}/restart`,
          {},
          { headers }
        )
      )

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
      await stockShop(getContainer())
    })

    it("fails a run its job left half-way in the sweep, and starts it again from its file", async () => {
      const { run, job, fileKey } = await interruptedRun("check")
      // One stuck before the sweep knew of runs: its job failed long ago
      const old = await jobs().createAsyncJobs({
        type: "migration.run",
        status: "failed",
        error_code: "interrupted",
        input: { source: "shopify", mode: "check", defaults: null },
        finished_at: HOUR_AGO(),
      })
      const stuck = await migration().createMigrationRuns({
        source: "shopify",
        mode: "check",
        job_id: old.id,
      })
      expect((await runsListed()).find((row) => row.id === run.id)?.status).toBe("running")

      await asyncJobSweeper(getContainer())

      expect(await jobs().retrieveAsyncJob(job.id)).toMatchObject({
        status: "failed",
        error_code: "interrupted",
      })
      const listed = await runsListed()
      expect(listed.find((row) => row.id === run.id)).toMatchObject({
        status: "failed",
        error_code: "interrupted",
      })
      expect(listed.find((row) => row.id === stuck.id)).toMatchObject({
        status: "failed",
        error_code: "interrupted",
      })

      const restarted = await restart(run.id)
      expect(restarted.status).toBe(202)
      const again = await settled(restarted.data.async_job.id)
      expect(again.status).toBe("succeeded")
      const [newJob] = await jobs().listAsyncJobs({ id: again.id }, { select: ["input"] })
      const copy = (newJob?.input as { source_file_id: string; mode: string }).source_file_id
      expect(newJob?.input).toMatchObject({ source: "bundle", mode: "check" })
      expect(copy).not.toBe(fileKey)
      expect(copy).toContain(MIGRATION_FILE_PREFIX)
      // Neither file is kept: the old one went with the restart, the copy with its run
      await expect(files().getAsBuffer(fileKey)).rejects.toThrow()
      await expect(files().getAsBuffer(copy)).rejects.toThrow()
      // Started again once: the stopped run says so and refuses a second start
      expect((await runsListed()).find((row) => row.id === run.id)?.error_code).toBe("restarted")
      const twice = await restart(run.id)
      expect([twice.status, twice.data.message]).toEqual([409, "migration.run_not_interrupted"])
    })

    it("asks for the file again when it is gone, and refuses any other run", async () => {
      const { run } = await interruptedRun("check", { stored: false })
      await asyncJobSweeper(getContainer())
      const done = await migration().createMigrationRuns({
        source: "bundle",
        mode: "check",
        status: "done",
      })

      const gone = await restart(run.id)
      const finished = await restart(done.id)
      const unknown = await restart("mrun_yok")

      expect([gone.status, gone.data.message]).toEqual([400, "migration.source_file_gone"])
      // Nothing changed: it can still be started once the file is there
      expect((await runsListed()).find((row) => row.id === run.id)?.error_code).toBe("interrupted")
      expect([finished.status, finished.data.message]).toEqual([
        409,
        "migration.run_not_interrupted",
      ])
      expect(unknown.status).toBe(404)
    })

    it("is the owner's, and asks them again to start an apply", async () => {
      const { run } = await interruptedRun("apply")
      await asyncJobSweeper(getContainer())
      const admin = await createAdminUser(http, getContainer(), "admin")

      expect((await restart(run.id, admin.headers)).status).toBe(403)
      expect((await restart(run.id, owner.plain)).status).toBe(428)
      // Refused before anything moved
      expect((await runsListed()).find((row) => row.id === run.id)?.error_code).toBe("interrupted")
    })
  },
})
