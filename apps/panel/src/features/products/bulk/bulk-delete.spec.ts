import { describe, expect, it, vi } from "vitest"
import { DELETE_AT_ONCE, deleteEach, groupReasons } from "./bulk-delete"

describe("deleting picked products", () => {
  it("deletes each, skips the refused ones and keeps the picked order", async () => {
    const remove = vi.fn(async (id: string) => {
      await new Promise((resolve) => setTimeout(resolve, id === "a" ? 5 : 0))
      if (id === "c") {
        throw new Error("refused")
      }
    })
    const progress: number[] = []

    const outcome = await deleteEach(["a", "b", "c", "d"], remove, (done) => progress.push(done))

    expect(outcome.deleted).toEqual(["a", "b", "d"])
    expect(outcome.failed.map((item) => item.id)).toEqual(["c"])
    expect(remove).toHaveBeenCalledTimes(4)
    expect(progress).toEqual([1, 2, 3, 4])
  })

  it("never runs more than a few at once", async () => {
    let running = 0
    let most = 0
    await deleteEach(
      Array.from({ length: 10 }, (_, index) => `p${String(index)}`),
      async () => {
        running += 1
        most = Math.max(most, running)
        await new Promise((resolve) => setTimeout(resolve, 1))
        running -= 1
      }
    )
    expect(most).toBe(DELETE_AT_ONCE)
  })

  it("does nothing for nothing picked", async () => {
    const remove = vi.fn()
    expect(await deleteEach([], remove)).toEqual({ deleted: [], failed: [] })
    expect(remove).not.toHaveBeenCalled()
  })

  it("names each reason once with its count, most frequent first", () => {
    const failed = [
      { id: "a", failure: "plan" },
      { id: "b", failure: "role" },
      { id: "c", failure: "role" },
    ]
    expect(groupReasons(failed, String)).toEqual([
      { reason: "role", count: 2 },
      { reason: "plan", count: 1 },
    ])
  })
})
