import { EventEmitter } from "node:events"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { logger } from "../../../lib/logging"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { auditMutations } from "../audit"
import { AUDIT_CHANGE, auditChangeOf } from "../audit/notes"
import { flattenSettings } from "../audit/resources/settings"

const flush = () => new Promise((resolve) => setImmediate(resolve))

// A settings save whose section a racing save moves between the reads
// around the request: the snapshot reads see the other save's field too
function settingsSave(reads: Record<string, unknown>[]) {
  const record = jest.fn(() => Promise.resolve({ id: "aud_1" }))
  const readSection = jest.fn(() => Promise.resolve({ values: reads.shift() ?? {}, version: 1 }))
  const req = {
    originalUrl: "/admin/platform-settings/store",
    method: "POST",
    body: { weight_unit: "kg" },
    query: {},
    params: {},
    headers: { "user-agent": "jest" },
    ip: "203.0.113.7",
    requestId: "req-12345678",
    auth_context: { actor_type: "user", actor_id: "user_01ABC" },
    scope: {
      resolve: (key: string) =>
        key === AUDIT_LOG_MODULE
          ? { record }
          : key === PLATFORM_SETTINGS_MODULE
            ? { readSection }
            : undefined,
    },
  } as unknown as MedusaRequest
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    end: jest.fn(),
    locals: {},
  })
  return { req, res: res as unknown as MedusaResponse & EventEmitter, record, readSection }
}

const diffOf = (record: jest.Mock): unknown =>
  (record.mock.calls[0] as [{ changes: { diff?: unknown } }])[0].changes.diff

beforeEach(() => {
  jest.spyOn(logger, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("a handler's own audit change (#249)", () => {
  const before = { weight_unit: "g", contact_email: null }
  const raced = { weight_unit: "kg", contact_email: "destek@example.com" }

  it("takes the diff from the handler's before and after, not the reads around it", async () => {
    const { req, res, record } = settingsSave([before, raced])
    await auditMutations(req, res, jest.fn())
    res.locals[AUDIT_CHANGE] = {
      before: flattenSettings(before),
      after: flattenSettings({ weight_unit: "kg", contact_email: null }),
    }
    res.emit("finish")
    await flush()

    expect(diffOf(record)).toEqual({ weight_unit: { before: "g", after: "kg" } })
  })

  it("still writes a sensitive field of the handler's change as changed only", async () => {
    const { req, res, record } = settingsSave([before, before])
    await auditMutations(req, res, jest.fn())
    res.locals[AUDIT_CHANGE] = {
      before: flattenSettings(before),
      after: flattenSettings({ ...before, contact_email: "destek@example.com" }),
    }
    res.emit("finish")
    await flush()

    expect(diffOf(record)).toEqual({ contact_email: { changed: true, after_last4: ".com" } })
  })

  it("reads again after the request when the handler gave no change (a failed save)", async () => {
    const { req, res, record, readSection } = settingsSave([before, raced])
    await auditMutations(req, res, jest.fn())
    res.emit("finish")
    await flush()

    expect(readSection).toHaveBeenCalledTimes(2)
    expect(diffOf(record)).toMatchObject({ weight_unit: { before: "g", after: "kg" } })
  })

  it("takes only a change with both snapshots", () => {
    expect(auditChangeOf({ before: {}, after: { a: 1 } })).toEqual({ before: {}, after: { a: 1 } })
    expect(auditChangeOf({ before: {} })).toBeNull()
    expect(auditChangeOf({ before: [], after: {} })).toBeNull()
    expect(auditChangeOf("change")).toBeNull()
    expect(auditChangeOf(null)).toBeNull()
  })
})
