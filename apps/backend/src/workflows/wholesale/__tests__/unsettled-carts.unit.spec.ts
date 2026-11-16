import type { MedusaContainer } from "@medusajs/framework/types"
import { queueWholesaleCarts } from "../queue"
import { requeueUnsettledCarts } from "../unsettled-carts"

jest.mock("../queue", () => ({ queueWholesaleCarts: jest.fn() }))

const queue = queueWholesaleCarts as jest.MockedFunction<typeof queueWholesaleCarts>
const NOW = new Date("2026-11-16T10:00:00Z")

function containerWith(last: Record<string, unknown> | null) {
  const listAsyncJobs = jest.fn().mockResolvedValue(last ? [last] : [])
  return {
    container: { resolve: () => ({ listAsyncJobs }) } as unknown as MedusaContainer,
    listAsyncJobs,
  }
}

const run = (summary: Record<string, unknown> | null, fields: Record<string, unknown> = {}) =>
  containerWith({
    id: "ajob_1",
    status: "succeeded",
    finished_at: new Date(NOW.getTime() - 60_000),
    result_summary: summary,
    ...fields,
  })

beforeEach(() => {
  jest.resetAllMocks()
  queue.mockResolvedValue(true)
})

describe("requeueUnsettledCarts (M1)", () => {
  it("queues the carts job again, one attempt further, after an unsettled run", async () => {
    const { container, listAsyncJobs } = run({ settled: false, attempt: 0 })

    await expect(requeueUnsettledCarts(container, NOW)).resolves.toBe("queued")
    expect(queue).toHaveBeenCalledWith(container, null, 1)
    expect(listAsyncJobs).toHaveBeenCalledWith(
      { type: "wholesale.carts" },
      { order: { created_at: "DESC", id: "DESC" }, take: 1 }
    )
  })

  it("gives up after three re-runs, so it cannot loop", async () => {
    const { container } = run({ settled: false, attempt: 3 })

    await expect(requeueUnsettledCarts(container, NOW)).resolves.toBe("gave_up")
    expect(queue).not.toHaveBeenCalled()
  })

  it("leaves a settled run, a run before this change, one still running or long past", async () => {
    for (const { container } of [
      run({ settled: true, attempt: 0 }),
      run({ wholesalers: 1, repriced: 1, failed: 0 }),
      run(null, { status: "running", finished_at: null }),
      run({ settled: false }, { finished_at: new Date(NOW.getTime() - 60 * 60_000) }),
      containerWith(null),
    ]) {
      await expect(requeueUnsettledCarts(container, NOW)).resolves.toBe("none")
    }
    expect(queue).not.toHaveBeenCalled()
  })

  it("queues a failed or interrupted run again, by its input's attempt (#93 review D2)", async () => {
    for (const errorCode of ["interrupted", "internal"]) {
      const { container } = run(null, {
        status: "failed",
        error_code: errorCode,
        input: { attempt: 1 },
      })
      await expect(requeueUnsettledCarts(container, NOW)).resolves.toBe("queued")
      expect(queue).toHaveBeenLastCalledWith(container, null, 2)
    }
    // The flag's own run carries no attempt
    const first = run(null, { status: "failed", input: {} })
    await expect(requeueUnsettledCarts(first.container, NOW)).resolves.toBe("queued")
    expect(queue).toHaveBeenLastCalledWith(first.container, null, 1)
  })

  it("gives a failing run up at the same bound, and leaves a cancelled one", async () => {
    const failing = run(null, { status: "failed", input: { attempt: 3 } })
    await expect(requeueUnsettledCarts(failing.container, NOW)).resolves.toBe("gave_up")
    const cancelled = run(null, { status: "cancelled", input: {} })
    await expect(requeueUnsettledCarts(cancelled.container, NOW)).resolves.toBe("none")
    expect(queue).not.toHaveBeenCalled()
  })

  it("says so when another carts run is already queued or running", async () => {
    queue.mockResolvedValue(false)
    const { container } = run({ settled: false })

    await expect(requeueUnsettledCarts(container, NOW)).resolves.toBe("busy")
    expect(queue).toHaveBeenCalledWith(container, null, 1)
  })
})
