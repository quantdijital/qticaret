import type { MedusaContainer } from "@medusajs/framework/types"
import type { AsyncJobRecord } from "../../../modules/async-job/service"
import type { WholesaleList } from "../../../modules/wholesale/service"
import { pendingLists, syncWholeList } from "../../wholesale/sync"
import { wholesaleSync } from "../types/wholesale-sync"

jest.mock("../../wholesale/sync", () => ({
  NO_CHANGES: { created: 0, updated: 0, deleted: 0 },
  pendingLists: jest.fn(),
  syncWholeList: jest.fn(),
}))

const pending = pendingLists as jest.MockedFunction<typeof pendingLists>
const sync = syncWholeList as jest.MockedFunction<typeof syncWholeList>

const list = (rate: number | null): WholesaleList => ({
  kind: "level",
  owner_id: "wtier_1",
  price_list_id: "plist_1",
  customer_group_id: "cusgroup_1",
  rate_bps: rate,
  sync_requested_at: new Date("2026-11-15T10:00:00Z"),
  synced_at: null,
})

function run(current: (WholesaleList | null)[]) {
  const service = {
    wholesaleList: jest.fn(),
    recordSynced: jest.fn().mockResolvedValue(undefined),
  }
  for (const each of current) {
    service.wholesaleList.mockResolvedValueOnce(each)
  }
  const container = { resolve: () => service } as unknown as MedusaContainer
  const job = { id: "job_1", requested_by: null } as AsyncJobRecord
  const done = wholesaleSync.execute(
    { container, job, progress: jest.fn(), resultFile: jest.fn() },
    {}
  )
  return { service, done }
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe("the wholesale sync job (ADR-0068 §4)", () => {
  it("writes the rate standing when its pass starts, not the one it listed (M4)", async () => {
    pending.mockResolvedValueOnce([list(1000)]).mockResolvedValue([])
    sync.mockResolvedValue({ created: 1, updated: 0, deleted: 0 })
    const { service, done } = run([list(2000)])

    await expect(done).resolves.toMatchObject({ summary: { lists: 1, created: 1 } })
    expect(sync).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rate_bps: 2000 }),
      expect.any(Function)
    )
    expect(service.recordSynced).toHaveBeenCalledTimes(1)
  })

  it("passes a level taken away before its pass by, and does not mark it", async () => {
    pending.mockResolvedValueOnce([list(1000)]).mockResolvedValue([])
    const { service, done } = run([null])

    await expect(done).resolves.toMatchObject({ summary: { lists: 0, skipped: 1 } })
    expect(sync).not.toHaveBeenCalled()
    expect(service.recordSynced).not.toHaveBeenCalled()
  })

  it("passes a level taken away during its pass by, and fails on any other error", async () => {
    pending.mockResolvedValueOnce([list(1000)]).mockResolvedValue([])
    sync.mockRejectedValueOnce(new Error("price list gone"))
    const gone = run([list(1000), null])
    await expect(gone.done).resolves.toMatchObject({ summary: { skipped: 1 } })

    pending.mockResolvedValueOnce([list(1000)]).mockResolvedValue([])
    sync.mockRejectedValueOnce(new Error("database down"))
    const failed = run([list(1000), list(1000)])
    await expect(failed.done).rejects.toThrow("database down")
  })

  it("reports lists still pending when its rounds run out, for the sweep", async () => {
    pending.mockResolvedValue([list(1000)])
    sync.mockResolvedValue({ created: 0, updated: 0, deleted: 0 })
    const { done } = run(Array.from({ length: 5 }, () => list(1000)))
    await expect(done).resolves.toMatchObject({ summary: { lists: 5, left: 1 } })
  })
})
