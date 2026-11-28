import { Modules } from "@medusajs/framework/utils"
import {
  SAMPLE_LOCK,
  SAMPLE_LOCK_TTL,
  busyAsConflict,
  busyAsJobError,
  renewSampleLock,
} from "../lock"

/**
 * One load or removal at a time, the lock renewed as the run goes and a
 * busy lock answered 409 `sample_catalog.busy` (security review
 * 2026-11-28, D3).
 */
describe("the sample catalogue's lock", () => {
  const containerWith = (acquire: jest.Mock) => ({
    resolve: (key: string) => {
      if (key !== Modules.LOCKING) {
        throw new Error(`unexpected ${key}`)
      }
      return { acquire }
    },
  })

  it("is renewed as the owner that took it, a TTL longer", async () => {
    const acquire = jest.fn().mockResolvedValue(undefined)
    await renewSampleLock(containerWith(acquire), { keys: [SAMPLE_LOCK], ownerId: "qt-locks:1" })
    expect(acquire).toHaveBeenCalledWith([SAMPLE_LOCK], {
      ownerId: "qt-locks:1",
      expire: SAMPLE_LOCK_TTL,
    })
  })

  it("stops the run when another holds it now (it ran out meanwhile)", async () => {
    const acquire = jest.fn().mockRejectedValue(new Error('Failed to acquire lock for key "x"'))
    await expect(
      renewSampleLock(containerWith(acquire), { keys: [SAMPLE_LOCK], ownerId: "qt-locks:1" })
    ).rejects.toThrow("Failed to acquire lock")
  })

  it("renews nothing when the run holds none (a nested run)", async () => {
    const acquire = jest.fn()
    await renewSampleLock(containerWith(acquire), undefined)
    expect(acquire).not.toHaveBeenCalled()
  })

  it("answers a busy lock as 409 sample_catalog.busy, a job's as its code", () => {
    const busy = new Error(`Failed to acquire lock for key "${SAMPLE_LOCK}"`)
    expect(busyAsConflict(busy)).toMatchObject({
      name: "ConflictError",
      safeMessage: "sample_catalog.busy",
    })
    expect(busyAsJobError(busy)).toMatchObject({
      name: "ValidationError",
      safeMessage: "sample_catalog.busy",
    })
    const other = new Error("boom")
    expect(busyAsConflict(other)).toBe(other)
    expect(busyAsJobError(other)).toBe(other)
  })
})
