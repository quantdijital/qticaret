import { privateKeyFromSeed, signDocument, signerFromPrivateKey } from "@qticaret/server-kit"
import { PLAN_DOCUMENT_PURPOSE } from "@qticaret/types/control-plane"
import { TENANT_ID, TEST_ONLY_CP_SEED, planDocument } from "@qticaret/types/control-plane/testing"
import { logger } from "../../../lib/logging"
import { LastVerified, stateOfStored, storedRowProblem } from "../trusted-state"
import type { StoredPlan } from "../types"

const cp = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_CP_SEED))
const config = {
  managed: true,
  publicKeys: new Map([[cp.kid, cp.privateKey]]),
  tenantId: TENANT_ID,
  url: null,
}

const row = (document = planDocument): StoredPlan => ({
  tenant_id: TENANT_ID,
  serial: document.serial,
  document,
  ...signDocument(PLAN_DOCUMENT_PURPOSE, document, cp),
  received_at: new Date("2026-11-12T08:00:00Z"),
  confirmed_at: null,
  source: "push",
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("the stored plan document, checked again (adr/0061 Ek C19 I2)", () => {
  it("trusts a row as signed, and none changed after", () => {
    const stored = row()
    expect(storedRowProblem(stored, config)).toBeNull()
    expect(
      storedRowProblem({ ...stored, document: { ...stored.document, status: "active" } }, config)
    ).toBeNull()
    const changed = { ...stored, document: { ...stored.document, status: "suspended" as const } }
    expect(storedRowProblem(changed, config)).toBe("signature.invalid")
    expect(storedRowProblem(stored, { ...config, publicKeys: new Map() })).toBe(
      "signature.unknown_key"
    )
    expect(storedRowProblem(stored, { ...config, tenantId: "ten_other" })).toBe(
      "control_plane.wrong_tenant"
    )
  })

  it("keeps the last verified state of this shop, else restricts; logs the code only", () => {
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    const last = new LastVerified()

    const none = last.fallback(TENANT_ID, "signature.invalid")
    expect(none).toMatchObject({ managed: true, status: "restricted", serial: null })

    const verified = last.remember(TENANT_ID, stateOfStored(row()))
    expect(last.fallback(TENANT_ID, "signature.invalid")).toBe(verified)
    // Another shop's id never takes this one's state
    expect(last.fallback("ten_other", "signature.invalid")).toMatchObject({ status: "restricted" })
    expect(error.mock.calls).toEqual([
      [{ event: "control_plane.stored_invalid", code: "signature.invalid", kept: false }],
      [{ event: "control_plane.stored_invalid", code: "signature.invalid", kept: true }],
      [{ event: "control_plane.stored_invalid", code: "signature.invalid", kept: false }],
    ])
  })
})
