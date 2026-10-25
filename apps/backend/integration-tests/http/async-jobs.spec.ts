import { readFileSync, readdirSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import asyncJobRetention from "../../src/jobs/async-job-retention"
import asyncJobSweeper from "../../src/jobs/async-job-sweeper"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Job {
  id: string
  status: string
  progress: number
  has_result: boolean
  result_summary: { rows?: number } | null
}

// The local file provider's folder in tests (no object store in CI)
const STATIC_DIR = join(process.cwd(), "static")

function filesNamed(pattern: RegExp, dir = STATIC_DIR): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory()
      ? filesNamed(pattern, path)
      : pattern.test(name)
        ? [path]
        : []
  })
}

/** F2.8 (adr/0014): queued jobs, their run in the subscriber, results, recovery and retention. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    const service = () => getContainer().resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)

    async function settled(id: string): Promise<Job> {
      for (let attempt = 0; attempt < 50; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(`/admin/async-jobs/${id}`, {
          headers: admin.headers,
        })
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("job did not finish")
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    afterAll(() => {
      for (const path of filesNamed(/audit-log-.*\.csv$/)) {
        rmSync(path, { force: true })
      }
    })

    it("exports the audit log as an escaped CSV and records the download", async () => {
      // Something to export: reading the audit log is itself recorded
      await http.get("/admin/audit-log", { headers: admin.headers })

      const queued = await http.post<{ async_job: Job }>(
        "/admin/async-jobs",
        { type: "audit_log.export", input: { kind: "sensitive_read" } },
        { headers: admin.headers }
      )
      const job = await settled(queued.data.async_job.id)
      const result = await http.get<{ url: string }>(`/admin/async-jobs/${job.id}/result`, {
        headers: admin.headers,
      })
      const file = filesNamed(/audit-log-.*\.csv$/).find((path) =>
        result.data.url.endsWith(path.split("/").pop() ?? "")
      )
      const csv = readFileSync(file ?? "", "utf8")
      const { data: reads } = await http.get<{ audit_entries: { resource_id: string }[] }>(
        "/admin/audit-log?resource_type=async_job",
        { headers: admin.headers }
      )

      expect(queued.status).toBe(202)
      expect(job).toMatchObject({ status: "succeeded", progress: 100, has_result: true })
      // The file's key stays out of the API
      expect(job).not.toHaveProperty("result_file_id")
      expect(job.result_summary?.rows).toBeGreaterThan(0)
      expect(result.headers["cache-control"]).toBe("no-store")
      expect(csv.startsWith("﻿id;created_at;kind;action;")).toBe(true)
      expect(csv).toContain(";sensitive_read;GET /admin/audit-log;")
      expect(reads.audit_entries.map((entry) => entry.resource_id)).toContain(job.id)
    })

    it("keeps exports from API keys, one export at a time, and checks the input", async () => {
      const { result } = await createApiKeysWorkflow(getContainer()).run({
        input: { api_keys: [{ title: "integration", type: "secret", created_by: "user_test" }] },
      })
      const basic = Buffer.from(`${result[0]?.token ?? ""}:`).toString("base64")
      const post = (body: unknown, headers = admin.headers) =>
        settle(http.post<{ message?: string }>("/admin/async-jobs", body, { headers }))

      const byKey = await post({ type: "audit_log.export" }, { authorization: `Basic ${basic}` })
      const unknownType = await post({ type: "nope" })
      const badInput = await post({ type: "audit_log.export", input: { kind: "everything" } })
      await service().createAsyncJobs({ type: "audit_log.export" })
      const second = await post({ type: "audit_log.export" })

      expect(byKey.status).toBe(403)
      expect(unknownType.data.message).toBe("async_job.type_unknown")
      expect(badInput.data.message).toBe("async_job.input_invalid")
      expect(second.status).toBe(409)
      expect(second.data.message).toBe("async_job.already_running")
    })

    it("fails jobs that stopped beating and deletes results past their expiry", async () => {
      const stale = await service().createAsyncJobs({ type: "audit_log.export" })
      await service().markRunning(stale.id)
      await service().updateAsyncJobs({
        id: stale.id,
        heartbeat_at: new Date(Date.now() - 60 * 60 * 1000),
      })
      const files = getContainer().resolve(Modules.FILE)
      const stored = await files.createFiles({
        filename: "audit-log-expired.csv",
        mimeType: "text/csv",
        content: Buffer.from("x").toString("base64"),
        access: "private",
      })
      const done = await service().createAsyncJobs({ type: "audit_log.export" })
      await service().updateAsyncJobs({
        id: done.id,
        status: "succeeded",
        result_file_id: stored.id,
        expires_at: new Date(Date.now() - 1000),
      })

      await asyncJobSweeper(getContainer())
      await asyncJobRetention(getContainer())
      const expired = await settle(
        http.get(`/admin/async-jobs/${done.id}/result`, { headers: admin.headers })
      )

      expect(await service().retrieveAsyncJob(stale.id)).toMatchObject({
        status: "failed",
        error_code: "interrupted",
      })
      expect((await service().retrieveAsyncJob(done.id)).result_file_id).toBeNull()
      expect(expired.status).toBe(404)
    })

    it("keeps job results and direct uploads out of Medusa's upload routes", async () => {
      await http.get("/admin/audit-log", { headers: admin.headers })
      const queued = await http.post<{ async_job: Job }>(
        "/admin/async-jobs",
        { type: "audit_log.export" },
        { headers: admin.headers }
      )
      const job = await settled(queued.data.async_job.id)
      const fileId = (await service().retrieveAsyncJob(job.id)).result_file_id ?? ""
      const { result } = await createApiKeysWorkflow(getContainer()).run({
        input: { api_keys: [{ title: "integration", type: "secret", created_by: "user_test" }] },
      })
      const basic = Buffer.from(`${result[0]?.token ?? ""}:`).toString("base64")

      const viaUploads = await settle(
        http.get(`/admin/uploads/${encodeURIComponent(fileId)}`, { headers: admin.headers })
      )
      const deleteViaUploads = await settle(
        http.delete(`/admin/uploads/${encodeURIComponent(fileId)}`, { headers: admin.headers })
      )
      const presigned = await settle(
        http.post(
          "/admin/uploads/presigned-urls",
          { originalname: "x.csv", mime_type: "text/csv", size: 10, access: "private" },
          { headers: admin.headers }
        )
      )
      const byKey = await settle(
        http.get(`/admin/async-jobs/${job.id}/result`, {
          headers: { authorization: `Basic ${basic}` },
        })
      )

      expect(viaUploads.status).toBe(404)
      expect(deleteViaUploads.status).toBe(404)
      expect(presigned.status).toBe(404)
      expect(byKey.status).toBe(403)
    })

    it("does not let a queued job that lost its event block its type", async () => {
      const lost = await service().createAsyncJobs({ type: "audit_log.export" })
      // created_at belongs to the database; the test ages a job on purpose
      await service().updateAsyncJobs({
        id: lost.id,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      } as never)

      const queued = await settle(
        http.post<{ async_job: Job }>(
          "/admin/async-jobs",
          { type: "audit_log.export" },
          { headers: admin.headers }
        )
      )
      await settled(queued.data.async_job.id)
      await asyncJobSweeper(getContainer())

      expect(queued.status).toBe(202)
      expect((await service().retrieveAsyncJob(lost.id)).error_code).toBe("not_started")
    })
  },
})
