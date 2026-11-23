import { setTimeout as sleep } from "node:timers/promises"
import { asValue } from "@medusajs/framework/awilix"
import { Modules, createMedusaContainer } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { acquireLocksStep, assertLockTimes } from "../acquire-locks"
import { releaseLocksStep } from "../release-locks"
import { isFree as isFreeIn, providers, silent, twoKeys } from "./providers"
import type { Provider } from "./providers"

/** A workflow's failure, which Medusa rejects with as a plain object: its message. */
const failure = (run: Promise<unknown>): Promise<string | null> =>
  run.then(
    () => null,
    (error: unknown) => (error as { message?: string }).message ?? String(error)
  )

describe("assertLockTimes", () => {
  it("wants the ttl longer than the wait", () => {
    expect(() => {
      assertLockTimes({ timeout: 10, ttl: 30 })
    }).not.toThrow()
    expect(() => {
      assertLockTimes({ timeout: 10 })
    }).not.toThrow()
    expect(() => {
      assertLockTimes({ ttl: 1 })
    }).not.toThrow()
    expect(() => {
      assertLockTimes({ timeout: 10, ttl: 10 })
    }).toThrow("Lock ttl (10s) must be longer than its timeout (10s)")
    expect(() => {
      assertLockTimes({ timeout: 10, ttl: 5 })
    }).toThrow("must be longer")
    expect(() => {
      assertLockTimes({ timeout: -1 })
    }).toThrow("timeout must be 0 or more")
  })
})

describe.each(providers)("owned locks ($name provider)", ({ name, make }) => {
  let provider: Provider
  let close: () => Promise<void>
  const isFree = (key: string) => isFreeIn(provider, key)
  const failing = jest.fn()
  const between = jest.fn()
  const seen = jest.fn()

  const betweenStep = createStep(`test-owned-between-${name}`, async () => {
    await between()
    return new StepResponse(undefined)
  })
  const failingStep = createStep(`test-owned-fails-${name}`, async () => {
    await failing()
    return new StepResponse(undefined)
  })
  // acquire → (a step) → release → (a step that may fail)
  const pair = createWorkflow(
    `test-owned-pair-${name}`,
    (input: { keys: string[]; ttl: number }) => {
      const held = acquireLocksStep({ key: input.keys, timeout: 0, ttl: input.ttl })
      betweenStep()
      releaseLocksStep(held)
      failingStep()
      return new WorkflowResponse(undefined)
    }
  )
  const timed = createWorkflow(
    `test-owned-times-${name}`,
    (input: { keys: string[]; timeout: number; ttl: number }) => {
      acquireLocksStep({ key: input.keys, timeout: input.timeout, ttl: input.ttl })
      return new WorkflowResponse(undefined)
    }
  )
  // A nested run's pair: skipped both, its parent holding the keys
  const inner = createWorkflow(`test-owned-inner-${name}`, (input: { keys: string[] }) => {
    const held = acquireLocksStep({ key: input.keys, timeout: 0, ttl: 60 })
    releaseLocksStep(held)
    return new WorkflowResponse(undefined)
  })
  const lookStep = createStep(`test-owned-look-${name}`, async (input: { keys: string[] }) => {
    seen(await Promise.all(input.keys.map((key) => isFree(key))))
    return new StepResponse(undefined)
  })
  const outer = createWorkflow(`test-owned-outer-${name}`, (input: { keys: string[] }) => {
    const held = acquireLocksStep({ key: input.keys, timeout: 0, ttl: 60 })
    inner.runAsStep({ input: { keys: input.keys } })
    lookStep({ keys: input.keys })
    releaseLocksStep(held)
    return new WorkflowResponse(undefined)
  })

  const container = () => {
    const made = createMedusaContainer()
    made.register({ [Modules.LOCKING]: asValue(provider), logger: asValue(silent) })
    return made
  }

  beforeAll(async () => {
    ;({ provider, close } = await make())
  })
  afterAll(async () => {
    await close()
  })
  beforeEach(() => {
    failing.mockReset()
    between.mockReset()
    seen.mockReset()
  })

  it("Medusa's owner-less release and an owned lock (why money paths take owned ones)", async () => {
    const { a } = twoKeys()
    await provider.acquire(a, { ownerId: "someone", expire: 60 })

    // In memory an owner-less release frees anyone's key; Redis frees only
    // owner-less ones, but every owner-less run is the same owner ("*")
    expect(await provider.release(a)).toBe(name === "in-memory")
    await provider.release(a, { ownerId: "someone" })
  })

  it("takes and gives back every key as its own owner", async () => {
    const { a, b } = twoKeys()
    between.mockImplementation(async () => {
      expect(await isFree(a)).toBe(false)
      expect(await isFree(b)).toBe(false)
    })

    await pair(container()).run({ input: { keys: [b, a], ttl: 60 }, throwOnError: true })

    expect(between).toHaveBeenCalledTimes(1)
    expect(await isFree(a)).toBe(true)
    expect(await isFree(b)).toBe(true)
  })

  it("leaves a key that ran out and was taken again to its new holder", async () => {
    const { a } = twoKeys()
    between.mockImplementation(async () => {
      await sleep(1200)
      // Another run (owner-less, as Medusa's step) takes the key ours lost
      await provider.acquire(a, { expire: 60 })
    })

    await pair(container()).run({ input: { keys: [a], ttl: 1 }, throwOnError: true })

    expect(await isFree(a)).toBe(false)
    await provider.release(a)
  })

  it("compensating after its release frees nothing another run took since", async () => {
    const { a, b } = twoKeys()
    failing.mockImplementation(async () => {
      await provider.acquire(a, { ownerId: "next-run", expire: 60 })
      throw new Error("later step")
    })

    expect(
      await failure(pair(container()).run({ input: { keys: [a, b], ttl: 60 }, throwOnError: true }))
    ).toBe("later step")

    expect(await isFree(a)).toBe(false)
    expect(await isFree(b)).toBe(true)
    await provider.release(a, { ownerId: "next-run" })
  })

  it("refuses a ttl no longer than the wait, taking nothing", async () => {
    const { a, b } = twoKeys()

    expect(
      await failure(
        timed(container()).run({
          input: { keys: [a, b], timeout: 10, ttl: 10 },
          throwOnError: true,
        })
      )
    ).toBe("Lock ttl (10s) must be longer than its timeout (10s)")

    expect(await isFree(a)).toBe(true)
    expect(await isFree(b)).toBe(true)
  })

  it("a nested run neither takes nor gives back its parent's keys", async () => {
    const { a, b } = twoKeys()

    await outer(container()).run({ input: { keys: [a, b] }, throwOnError: true })

    // Still the parent's after the nested pair ran; given back by the parent
    expect(seen).toHaveBeenCalledWith([false, false])
    expect(await isFree(a)).toBe(true)
    expect(await isFree(b)).toBe(true)
  })
})
