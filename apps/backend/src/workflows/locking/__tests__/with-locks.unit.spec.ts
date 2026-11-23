import type { ILockingModule } from "@medusajs/framework/types"
import { withLocks } from "../with-locks"
import { isFree as isFreeIn, providers, twoKeys } from "./providers"
import type { Provider } from "./providers"

const TIMED_OUT = "Timed-out acquiring lock."

describe.each(providers)("withLocks ($name provider)", ({ make }) => {
  let provider: Provider
  let close: () => Promise<void>
  // The locking module hands `execute` to its default provider as it is
  const locking = () => provider as unknown as ILockingModule
  const isFree = (key: string) => isFreeIn(provider, key)

  beforeAll(async () => {
    ;({ provider, close } = await make())
  })
  afterAll(async () => {
    await close()
  })

  it("Medusa's execute keeps a key it took when it times out on another (why ours exists)", async () => {
    const { a, b } = twoKeys()
    await provider.acquire(b, { expire: 60 })
    const job = jest.fn(() => Promise.resolve())

    await expect(provider.execute([a, b], job, { timeout: 1 })).rejects.toThrow(TIMED_OUT)

    // Redis: until its 60 s lease runs out; in memory: until `b` frees.
    // If this starts failing, Medusa gives keys back itself and withLocks can go.
    expect(job).not.toHaveBeenCalled()
    expect(await isFree(a)).toBe(false)
    await provider.release(b)
  })

  it("gives back the keys it took when another stays held", async () => {
    const { a, b } = twoKeys()
    await provider.acquire(b, { expire: 60 })
    const job = jest.fn(() => Promise.resolve())

    await expect(withLocks(locking(), [b, a], job, { timeout: 1 })).rejects.toThrow(TIMED_OUT)

    expect(job).not.toHaveBeenCalled()
    expect(await isFree(a)).toBe(true)
    expect(await isFree(b)).toBe(false)
    await provider.release(b)
  })

  it("runs the job holding every key and gives them all back", async () => {
    const { a, b } = twoKeys()
    const held = await withLocks(
      locking(),
      [b, a],
      async () => [await isFree(a), await isFree(b)],
      { timeout: 1 }
    )

    expect(held).toEqual([false, false])
    expect(await isFree(a)).toBe(true)
    expect(await isFree(b)).toBe(true)
  })

  it("waits for a held key within the timeout", async () => {
    const { a, b } = twoKeys()
    await provider.acquire(b, { expire: 60 })
    setTimeout(() => void provider.release(b), 200)

    await expect(
      withLocks(locking(), [a, b], () => Promise.resolve("done"), { timeout: 3 })
    ).resolves.toBe("done")
    expect(await isFree(a)).toBe(true)
    expect(await isFree(b)).toBe(true)
  })

  it("gives every key back when the job fails", async () => {
    const { a, b } = twoKeys()

    await expect(
      withLocks(locking(), [a, b], () => Promise.reject(new Error("job failed")), { timeout: 1 })
    ).rejects.toThrow("job failed")

    expect(await isFree(a)).toBe(true)
    expect(await isFree(b)).toBe(true)
  })
})
