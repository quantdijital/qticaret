import type { Context } from "@medusajs/framework/types"
import { lockSection, sectionLockKey } from "../section-lock"
import PlatformSettingsModuleService from "../service"

const TIMEOUT_SQL = "SET LOCAL lock_timeout = '5s'"
const LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext(?))"

interface Row {
  id: string
  values: object
  version: number
}

// The save and the restore run their body straight on a context that
// already holds a transaction (InjectTransactionManager), so the order of
// the calls on it is what a real transaction would see
function fakeModule(row: Row | null, lockError?: Error) {
  const calls: string[] = []
  const execute = jest.fn((sql: string, params?: unknown[]) => {
    if (sql === TIMEOUT_SQL) {
      calls.push("timeout")
      return Promise.resolve([])
    }
    calls.push(`lock:${String(params?.[0])}`)
    return lockError ? Promise.reject(lockError) : Promise.resolve([])
  })
  const module = {
    listSettingsSections: jest.fn(() => {
      calls.push("read")
      return Promise.resolve(row ? [row] : [])
    }),
    updateSettingsSections: jest.fn(() => {
      calls.push("update")
      return Promise.resolve()
    }),
    createSettingsSections: jest.fn(() => {
      calls.push("create")
      return Promise.resolve()
    }),
    deleteSettingsSections: jest.fn(() => {
      calls.push("delete")
      return Promise.resolve()
    }),
  }
  const context = { transactionManager: { execute } } as unknown as Context
  return { calls, execute, module, context }
}

type Method = (this: unknown, ...args: unknown[]) => Promise<unknown>
const prototype = PlatformSettingsModuleService.prototype as unknown as Record<
  "saveSectionInTransaction_" | "restoreSectionInTransaction_",
  Method
>
const method = (name: keyof typeof prototype): Method => prototype[name]

const LOCKED = ["timeout", "lock:settings_section:store", "read"]

describe("settings section lock (PR #248 review L2)", () => {
  it("bounds the wait, then takes one advisory lock per section to the transaction's end", async () => {
    const { execute, context } = fakeModule(null)
    await lockSection(context, "ai_guidance")

    expect(execute.mock.calls).toEqual([
      [TIMEOUT_SQL],
      [LOCK_SQL, ["settings_section:ai_guidance"]],
    ])
    expect(sectionLockKey("store")).not.toBe(sectionLockKey("seo"))
  })

  it("answers a wait past the timeout as busy, to be tried again (review D2)", async () => {
    const timedOut = Object.assign(new Error("canceling statement due to lock timeout"), {
      code: "55P03",
    })
    const { context } = fakeModule(null, timedOut)

    await expect(lockSection(context, "store")).rejects.toMatchObject({
      name: "RetryableError",
      safeMessage: "errors.busy",
      retryAfterMs: 2_000,
    })
  })

  it("passes any other failure of the lock on as it is", async () => {
    const lost = new Error("Connection terminated")
    const { context } = fakeModule(null, lost)

    await expect(lockSection(context, "store")).rejects.toBe(lost)
  })

  it("refuses to run outside a transaction, where the lock would end at once", async () => {
    await expect(lockSection({}, "store")).rejects.toThrow(
      "platform_settings.lock_outside_transaction"
    )
  })

  it("locks before reading the row a save merges over, and names the version it wrote", async () => {
    const { calls, module, context } = fakeModule({
      id: "set_1",
      values: { weight_unit: "kg" },
      version: 3,
    })
    const change = await method("saveSectionInTransaction_").call(
      module,
      "store",
      { contact_email: "destek@example.com" },
      "user_1",
      context
    )

    expect(calls).toEqual([...LOCKED, "update"])
    expect(module.updateSettingsSections).toHaveBeenCalledWith(
      expect.objectContaining({ id: "set_1", version: 4 }),
      context
    )
    expect(change).toMatchObject({ version: 4, previous: { version: 3 } })
  })

  it("locks a first save too, when there is no row yet to lock", async () => {
    const { calls, module, context } = fakeModule(null)
    const change = await method("saveSectionInTransaction_").call(
      module,
      "store",
      { weight_unit: "kg" },
      null,
      context
    )

    expect(calls).toEqual([...LOCKED, "create"])
    expect(change).toMatchObject({ version: 1, previous: null })
  })
})

describe("settings section restore (review O1)", () => {
  const restore = (row: Row | null, previous: Row | null, savedVersion: number) => {
    const fake = fakeModule(row)
    const run = method("restoreSectionInTransaction_").call(
      fake.module,
      "store",
      previous,
      savedVersion,
      fake.context
    )
    return { ...fake, run }
  }

  it("locks, then puts the row back while it holds the version the save wrote", async () => {
    const { calls, module, run } = restore(
      { id: "set_1", values: { weight_unit: "kg" }, version: 4 },
      { id: "set_1", values: { weight_unit: "g" }, version: 3 },
      4
    )
    await run

    expect(calls).toEqual([...LOCKED, "update"])
    expect(module.updateSettingsSections).toHaveBeenCalledWith(
      expect.objectContaining({ id: "set_1", values: { weight_unit: "g" }, version: 5 }),
      expect.anything()
    )
  })

  it("removes a row the undone save created", async () => {
    const { calls, run } = restore({ id: "set_1", values: {}, version: 1 }, null, 1)
    await run

    expect(calls).toEqual([...LOCKED, "delete"])
  })

  it("leaves a row another save wrote over since", async () => {
    const { calls, run } = restore(
      { id: "set_1", values: { weight_unit: "kg", dimension_unit: "mm" }, version: 5 },
      { id: "set_1", values: { weight_unit: "g" }, version: 3 },
      4
    )
    await run

    expect(calls).toEqual(LOCKED)
  })

  it("leaves a section whose row is gone", async () => {
    const { calls, run } = restore(null, null, 1)
    await run

    expect(calls).toEqual(LOCKED)
  })
})
