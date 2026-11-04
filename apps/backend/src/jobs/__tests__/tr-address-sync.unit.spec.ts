import type { MedusaContainer } from "@medusajs/framework/types"
import { ConflictError, ValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import type { AsyncJobRecord } from "../../modules/async-job/service"
import { enqueueAsyncJobWorkflow } from "../../workflows/async-job/enqueue-async-job"
import { trAddressSync as syncJobType } from "../../workflows/async-job/types/tr-address-sync"
import { checkTrAddressVersionWorkflow } from "../../workflows/tr-address/check-tr-address-version"
import { importTrAddressWorkflow } from "../../workflows/tr-address/import-tr-address"
import trAddressSync from "../tr-address-sync"

jest.mock("../../workflows/tr-address/check-tr-address-version", () => ({
  checkTrAddressVersionWorkflow: jest.fn(),
}))
jest.mock("../../workflows/async-job/enqueue-async-job", () => ({
  enqueueAsyncJobWorkflow: jest.fn(),
}))
jest.mock("../../workflows/tr-address/import-tr-address", () => ({
  importTrAddressWorkflow: jest.fn(),
}))

const container = {} as MedusaContainer
const check = jest.fn()
const enqueue = jest.fn()
const importRun = jest.fn()

beforeEach(() => {
  jest.mocked(checkTrAddressVersionWorkflow).mockReturnValue({ run: check } as never)
  jest.mocked(enqueueAsyncJobWorkflow).mockReturnValue({ run: enqueue } as never)
  jest.mocked(importTrAddressWorkflow).mockReturnValue({ run: importRun } as never)
  jest.spyOn(logger, "error").mockImplementation(() => undefined)
  jest.spyOn(logger, "warn").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.resetAllMocks()
  jest.restoreAllMocks()
})

/** adr/0008 Ek 2026-11-04: no one in the shop watches the address data; the operator's alerting does. */
describe("the weekly address data check", () => {
  it("queues the sync only for a dataset the shop does not have", async () => {
    check.mockResolvedValueOnce({ result: { current: true } })
    await trAddressSync(container)
    expect(enqueue).not.toHaveBeenCalled()

    check.mockResolvedValueOnce({ result: { current: false } })
    enqueue.mockResolvedValueOnce({ result: { id: "job_1" } })
    await trAddressSync(container)
    expect(enqueue).toHaveBeenCalledWith({
      input: { type: "tr_address.sync", input: { only_if_changed: true }, requested_by: null },
    })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it("logs a failed check at error level with its code, never throwing", async () => {
    check.mockRejectedValueOnce(new ValidationError("tr_address.source_unavailable"))
    await expect(trAddressSync(container)).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "tr_address.check_failed",
        code: "tr_address.source_unavailable",
      })
    )

    check.mockResolvedValueOnce({ result: { current: false } })
    enqueue.mockRejectedValueOnce(new Error("database gone"))
    await trAddressSync(container)
    expect(logger.error).toHaveBeenLastCalledWith(
      expect.objectContaining({ event: "tr_address.check_failed", code: "failed" })
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("leaves a sync already queued or running alone, silently", async () => {
    check.mockResolvedValueOnce({ result: { current: false } })
    enqueue.mockRejectedValueOnce(new ConflictError("async_job.already_running"))
    await trAddressSync(container)
    expect(logger.error).not.toHaveBeenCalled()
  })
})

describe("the address data sync job", () => {
  const job = { id: "job_1", requested_by: null } as AsyncJobRecord
  const run = () =>
    syncJobType.execute(
      { container, job, progress: jest.fn(), resultFile: jest.fn() },
      { only_if_changed: true }
    )

  it("reports the import's counts", async () => {
    importRun.mockResolvedValueOnce({ result: { skipped: false, dataset_version: "2025" } })
    await expect(run()).resolves.toEqual({
      summary: { skipped: false, dataset_version: "2025" },
    })
    expect(importRun).toHaveBeenCalledWith({
      input: { source: "turkiyeapi", only_if_changed: true, actor_id: null, job_id: "job_1" },
    })
  })

  it("logs a failure at error level for the operator and still fails the job", async () => {
    const down = new ValidationError("tr_address.source_unavailable")
    importRun.mockRejectedValueOnce(down)
    await expect(run()).rejects.toBe(down)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "tr_address.sync_failed",
        jobId: "job_1",
        code: "tr_address.source_unavailable",
      })
    )
  })

  it("does not call a cancelled job a failure", async () => {
    importRun.mockRejectedValueOnce(new ConflictError("async_job.cancelled"))
    await expect(run()).rejects.toThrow()
    expect(logger.error).not.toHaveBeenCalled()
  })
})
