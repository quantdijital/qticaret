import { asValue } from "@medusajs/framework/awilix"
import { Modules, createMedusaContainer } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep } from "@medusajs/medusa/core-flows"
import { acquireLocksStep, lockOrder } from "../acquire-locks"
import { isFree as isFreeIn, providers, silent, twoKeys } from "./providers"
import type { Provider } from "./providers"

/** A workflow's failure, which Medusa rejects with as a plain object: its message. */
const failure = (run: Promise<unknown>): Promise<string | null> =>
  run.then(
    () => null,
    (error: unknown) => (error as { message?: string }).message ?? String(error)
  )

describe("lockOrder", () => {
  it("takes the keys once each, always in the same order", () => {
    expect(lockOrder(["storefront-layout", "content", "storefront-menus", "content"])).toEqual([
      "content",
      "storefront-layout",
      "storefront-menus",
    ])
    expect(lockOrder("content")).toEqual(["content"])
    expect(lockOrder(["", "a"])).toEqual(["a"])
  })
})

describe.each(providers)("locking several keys ($name provider)", ({ name, make }) => {
  let provider: Provider
  let close: () => Promise<void>
  const failing = jest.fn()

  const medusaLocks = createWorkflow(`test-medusa-locks-${name}`, (input: { keys: string[] }) => {
    acquireLockStep({ key: input.keys, timeout: 0.5, ttl: 60 })
    return new WorkflowResponse(undefined)
  })
  const ourLocks = createWorkflow(
    `test-our-locks-${name}`,
    (input: { keys: string[]; timeout: number }) => {
      acquireLocksStep({ key: input.keys, timeout: input.timeout, ttl: 60, retryInterval: 0.05 })
      return new WorkflowResponse(undefined)
    }
  )
  const afterwards = createStep(`test-fails-afterwards-${name}`, async () => {
    await failing()
    return new StepResponse(undefined)
  })
  const ourLocksThenFail = createWorkflow(
    `test-our-locks-then-fail-${name}`,
    (input: { keys: string[] }) => {
      acquireLocksStep({ key: input.keys, timeout: 0, ttl: 60 })
      afterwards()
      return new WorkflowResponse(undefined)
    }
  )
  // A nested workflow's locks are its parent's to take, as with Medusa's step
  const nested = createWorkflow(`test-our-locks-nested-${name}`, (input: { keys: string[] }) => {
    ourLocks.runAsStep({ input: { keys: input.keys, timeout: 0 } })
    return new WorkflowResponse(undefined)
  })

  const container = () => {
    const made = createMedusaContainer()
    made.register({ [Modules.LOCKING]: asValue(provider), logger: asValue(silent) })
    return made
  }
  const isFree = (key: string) => isFreeIn(provider, key)
  const keys = twoKeys

  beforeAll(async () => {
    ;({ provider, close } = await make())
  })
  afterAll(async () => {
    await close()
  })

  it("Medusa's step leaves a key it took locked when another is held (why ours exists)", async () => {
    const { a, b } = keys()
    await provider.acquire(b, { expire: 60 })

    // The first try takes `a` and fails on `b`; every retry then fails on
    // `a`, taken without an owner and so nobody's to take again: the error
    // names the key the workflow itself holds
    expect(
      await failure(medusaLocks(container()).run({ input: { keys: [a, b] }, throwOnError: true }))
    ).toBe(`Failed to acquire lock for key "${a}"`)

    // Held until its TTL: whoever comes next for it fails. If this starts
    // failing, Medusa gives keys back itself and our step can be dropped.
    expect(await isFree(a)).toBe(false)
    await provider.release([a, b])
  })

  it("gives back the keys it took when another stays held", async () => {
    const { a, b } = keys()
    await provider.acquire(b, { expire: 60 })

    expect(
      await failure(
        ourLocks(container()).run({ input: { keys: [a, b], timeout: 0.3 }, throwOnError: true })
      )
    ).toBe(`Failed to acquire lock for key "${b}"`)

    expect(await isFree(a)).toBe(true)
    expect(await isFree(b)).toBe(false)
    await provider.release(b)
  })

  it("waits for a held key and then holds them all", async () => {
    const { a, b } = keys()
    await provider.acquire(b, { expire: 60 })
    setTimeout(() => void provider.release(b), 200)

    await ourLocks(container()).run({ input: { keys: [b, a], timeout: 3 }, throwOnError: true })

    expect(await isFree(a)).toBe(false)
    expect(await isFree(b)).toBe(false)
    await provider.release([a, b])
  })

  it("gives the keys back when a later step fails", async () => {
    const { a, b } = keys()
    failing.mockRejectedValueOnce(new Error("later step"))

    expect(
      await failure(
        ourLocksThenFail(container()).run({ input: { keys: [a, b] }, throwOnError: true })
      )
    ).toBe("later step")

    expect(await isFree(a)).toBe(true)
    expect(await isFree(b)).toBe(true)
  })

  it("takes nothing in a nested workflow, its parent holding the locks", async () => {
    const { a, b } = keys()
    await provider.acquire(b, { expire: 60 })

    await nested(container()).run({ input: { keys: [a, b] }, throwOnError: true })

    expect(await isFree(a)).toBe(true)
    await provider.release(b)
  })
})
