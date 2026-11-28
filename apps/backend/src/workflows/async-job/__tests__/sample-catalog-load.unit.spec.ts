import type { MedusaContainer } from "@medusajs/framework/types"
import type { AsyncJobRecord } from "../../../modules/async-job/service"
import { loadSampleCatalogWorkflow, progressReporter } from "../../sample-catalog/load"
import { sampleCatalogLoad } from "../types/sample-catalog-load"

jest.mock("../../sample-catalog/load", () => ({
  ...jest.requireActual<Record<string, unknown>>("../../sample-catalog/load"),
  loadSampleCatalogWorkflow: jest.fn(),
}))

const workflow = loadSampleCatalogWorkflow as unknown as jest.Mock

describe("the sample catalogue load job (owner, 2026-11-28)", () => {
  it("runs the load with its own id, so the workflow reports how far it is", async () => {
    const run = jest.fn().mockResolvedValue({
      result: { pack: "travel", products: 10, categories_made: 2, categories_opened: 0 },
    })
    workflow.mockReturnValue({ run })
    const progress = jest.fn().mockResolvedValue(undefined)
    const job = { id: "job_1", requested_by: "user_1" } as AsyncJobRecord
    const done = await sampleCatalogLoad.execute(
      { container: {} as MedusaContainer, job, progress, resultFile: jest.fn() },
      { pack: "travel" }
    )
    expect(run).toHaveBeenCalledWith({ input: { pack: "travel", job_id: "job_1" } })
    expect(progress).toHaveBeenCalledWith(1)
    expect(done.summary).toEqual({
      pack: "travel",
      products: 10,
      categories_made: 2,
      categories_opened: 0,
    })
  })

  it("takes only a pack name", () => {
    expect(sampleCatalogLoad.input.safeParse({ pack: "travel" }).success).toBe(true)
    expect(sampleCatalogLoad.input.safeParse({ pack: "travel", extra: 1 }).success).toBe(false)
    expect(sampleCatalogLoad.input.safeParse({}).success).toBe(false)
  })
})

describe("the load's progress reporter", () => {
  const containerWith = (reportProgress: jest.Mock) =>
    ({ resolve: () => ({ reportProgress }) }) as unknown as MedusaContainer

  it("writes 5–99 % product by product, forced past the throttle", async () => {
    const reportProgress = jest.fn().mockResolvedValue(true)
    const report = progressReporter(containerWith(reportProgress), "job_1", 10)
    await report(1)
    await report(10)
    expect(reportProgress.mock.calls).toEqual([
      ["job_1", 14, null, true],
      ["job_1", 99, null, true],
    ])
  })

  it("stops the load when its job was cancelled or swept", async () => {
    const report = progressReporter(containerWith(jest.fn().mockResolvedValue(false)), "job_1", 4)
    await expect(report(1)).rejects.toThrow("stopped")
  })

  it("does nothing for a load run outside a job", async () => {
    const reportProgress = jest.fn()
    await progressReporter(containerWith(reportProgress), undefined, 4)(1)
    expect(reportProgress).not.toHaveBeenCalled()
  })
})
