import type { Context } from "@medusajs/framework/types"
import { lockSection, sectionLockKey } from "../section-lock"
import PlatformSettingsModuleService from "../service"

// The save and the restore run their body straight on a context that
// already holds a transaction (InjectTransactionManager), so the order of
// the calls on it is what a real transaction would see
function fakeModule(row: { id: string; values: object; version: number } | null) {
  const calls: string[] = []
  const execute = jest.fn((_sql: string, params: unknown[]) => {
    calls.push(`lock:${String(params[0])}`)
    return Promise.resolve([])
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

describe("settings section lock (PR #248 review L2)", () => {
  it("takes one advisory lock per section, held to the transaction's end", async () => {
    const { execute, context } = fakeModule(null)
    await lockSection(context, "ai_guidance")

    expect(execute).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock(hashtext(?))", [
      "settings_section:ai_guidance",
    ])
    expect(sectionLockKey("store")).not.toBe(sectionLockKey("seo"))
  })

  it("refuses to run outside a transaction, where the lock would end at once", async () => {
    await expect(lockSection({}, "store")).rejects.toThrow(
      "platform_settings.lock_outside_transaction"
    )
  })

  it("locks before reading the row a save merges over", async () => {
    const { calls, module, context } = fakeModule({
      id: "set_1",
      values: { weight_unit: "kg" },
      version: 3,
    })
    await method("saveSectionInTransaction_").call(
      module,
      "store",
      { contact_email: "destek@example.com" },
      "user_1",
      context
    )

    expect(calls).toEqual(["lock:settings_section:store", "read", "update"])
    expect(module.updateSettingsSections).toHaveBeenCalledWith(
      expect.objectContaining({ id: "set_1", version: 4 }),
      context
    )
  })

  it("locks a first save too, when there is no row yet to lock", async () => {
    const { calls, module, context } = fakeModule(null)
    await method("saveSectionInTransaction_").call(
      module,
      "store",
      { weight_unit: "kg" },
      null,
      context
    )

    expect(calls).toEqual(["lock:settings_section:store", "read", "create"])
  })

  it("locks before a restore reads the row it puts back", async () => {
    const { calls, module, context } = fakeModule({ id: "set_1", values: {}, version: 2 })
    await method("restoreSectionInTransaction_").call(module, "store", null, context)

    expect(calls).toEqual(["lock:settings_section:store", "read", "delete"])
  })
})
