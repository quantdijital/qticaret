import { asValue } from "@medusajs/framework/awilix"
import { MedusaError, Modules, createMedusaContainer } from "@medusajs/framework/utils"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import { API_KEY_SCOPES_MODULE } from "../../../modules/api-key-scopes"
import type * as WorkflowsSdk from "@medusajs/framework/workflows-sdk"
import { deleteScopedApiKeyWorkflow, isDeletable } from "../delete-api-key"

// Medusa's own delete, as a step this test watches (its revocation check is Medusa's)
const medusaDelete = jest.fn()
jest.mock("@medusajs/medusa/core-flows", () => {
  const sdk = jest.requireActual<typeof WorkflowsSdk>("@medusajs/framework/workflows-sdk")
  const step = sdk.createStep("test-delete-api-keys", async (input: { ids: string[] }) => {
    await medusaDelete(input.ids)
    return new sdk.StepResponse(undefined)
  })
  return {
    deleteApiKeysWorkflow: sdk.createWorkflow(
      "test-delete-api-keys-wf",
      (input: { ids: string[] }) => {
        step(input)
        return new sdk.WorkflowResponse(undefined)
      }
    ),
  }
})

const REVOKED = {
  id: "apk_1",
  title: "Depo programı",
  redacted: "sk_abc***xyz",
  revoked_at: new Date("2026-11-01T10:00:00Z"),
}
const SCOPE_ROW = { id: "apkscope_1", api_key_id: "apk_1", scopes: ["orders:read"] }

const apiKeys = { listApiKeys: jest.fn() }
const scopes = {
  listApiKeyScopes: jest.fn(),
  deleteApiKeyScopes: jest.fn(),
  createApiKeyScopes: jest.fn(),
}
const audit = { record: jest.fn() }

function container() {
  const made = createMedusaContainer()
  made.register({
    [Modules.API_KEY]: asValue(apiKeys),
    [API_KEY_SCOPES_MODULE]: asValue(scopes),
    [AUDIT_LOG_MODULE]: asValue(audit),
  })
  return made
}

const run = () =>
  deleteScopedApiKeyWorkflow(container())
    .run({
      input: { id: "apk_1", actor_id: "user_1", request_id: "req_1" },
      throwOnError: true,
    })
    .then(
      ({ result }) => ({ result, error: null }),
      (error: unknown) => ({ result: null, error: error as MedusaError })
    )

beforeEach(() => {
  apiKeys.listApiKeys.mockResolvedValue([REVOKED])
  scopes.listApiKeyScopes.mockResolvedValue([SCOPE_ROW])
  scopes.deleteApiKeyScopes.mockResolvedValue(undefined)
  scopes.createApiKeyScopes.mockResolvedValue([])
  audit.record.mockResolvedValue({ id: "audit_1" })
  medusaDelete.mockResolvedValue(undefined)
})
afterEach(() => {
  jest.resetAllMocks()
})

describe("deleting an API key", () => {
  it("removes a revoked key with its scopes and records who deleted which key", async () => {
    const { result, error } = await run()

    expect(error).toBeNull()
    expect(result).toEqual({ id: "apk_1", title: "Depo programı", redacted: "sk_abc***xyz" })
    expect(apiKeys.listApiKeys).toHaveBeenCalledWith({ id: "apk_1", type: "secret" }, { take: 1 })
    expect(scopes.deleteApiKeyScopes).toHaveBeenCalledWith(["apkscope_1"])
    expect(medusaDelete).toHaveBeenCalledWith(["apk_1"])
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "mutation",
        action: "api_key.deleted",
        actor_type: "user",
        actor_id: "user_1",
        resource_type: "api_key",
        resource_id: "apk_1",
        request_id: "req_1",
        changes: { title: "Depo programı", redacted: "sk_abc***xyz" },
      })
    )
  })

  it("refuses an active key and touches nothing", async () => {
    apiKeys.listApiKeys.mockResolvedValue([{ ...REVOKED, revoked_at: null }])

    const { error } = await run()

    expect(error).toMatchObject({
      type: MedusaError.Types.NOT_ALLOWED,
      message: "api_key.delete_active",
    })
    expect(scopes.deleteApiKeyScopes).not.toHaveBeenCalled()
    expect(medusaDelete).not.toHaveBeenCalled()
    expect(audit.record).not.toHaveBeenCalled()
  })

  it("does not know a key that is not the shop's secret key", async () => {
    apiKeys.listApiKeys.mockResolvedValue([])

    const { error } = await run()

    expect(error).toMatchObject({ type: MedusaError.Types.NOT_FOUND, message: "api_key.unknown" })
    expect(scopes.deleteApiKeyScopes).not.toHaveBeenCalled()
  })

  it("puts the scopes back when Medusa does not delete the key", async () => {
    medusaDelete.mockRejectedValue(new MedusaError(MedusaError.Types.NOT_ALLOWED, "not revoked"))

    const { error } = await run()

    expect(error).not.toBeNull()
    expect(scopes.deleteApiKeyScopes).toHaveBeenCalledWith(["apkscope_1"])
    expect(scopes.createApiKeyScopes).toHaveBeenCalledWith([
      { api_key_id: "apk_1", scopes: ["orders:read"] },
    ])
    expect(audit.record).not.toHaveBeenCalled()
  })
})

describe("isDeletable", () => {
  const now = new Date("2026-11-06T12:00:00Z")

  it("takes a key whose revocation has taken effect only", () => {
    expect(isDeletable(new Date("2026-11-06T11:59:59Z"), now)).toBe(true)
    expect(isDeletable("2026-11-01T00:00:00Z", now)).toBe(true)
    expect(isDeletable(null, now)).toBe(false)
    expect(isDeletable(undefined, now)).toBe(false)
    // Revoked with a delay Medusa allows: still working, so not yet deletable
    expect(isDeletable(new Date("2026-11-06T13:00:00Z"), now)).toBe(false)
  })
})
