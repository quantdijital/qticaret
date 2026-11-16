import { privateKeyFromSeed, signDocument, signerFromPrivateKey } from "@qticaret/server-kit"
import { PLAN_DOCUMENT_PURPOSE } from "@qticaret/types/control-plane"
import { TENANT_ID, TEST_ONLY_CP_SEED, planDocument } from "@qticaret/types/control-plane/testing"
import { logger } from "../../../lib/logging"
import {
  LastVerified,
  stateOfStored,
  storedRowProblem,
  stricterThanRestricted,
  unverifiedStatus,
} from "../trusted-state"
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

  it("trusts a row only when its own serial and shop are the signed document's (review A-3)", () => {
    const stored = row()
    // An older signed document taken again by lowering the column
    expect(storedRowProblem({ ...stored, serial: stored.serial - 1 }, config)).toBe(
      "control_plane.stored_serial_mismatch"
    )
    expect(storedRowProblem({ ...stored, serial: stored.serial + 1 }, config)).toBe(
      "control_plane.stored_serial_mismatch"
    )
    expect(storedRowProblem({ ...stored, tenant_id: "ten_other" }, config)).toBe(
      "control_plane.stored_tenant_mismatch"
    )
    expect(storedRowProblem(stored, config)).toBeNull()
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

describe("what an untrusted row or a lost one may still say (adr/0061 Ek C19 takip)", () => {
  it("only ever tightens restricted: suspended > restricted > active (LOW-2)", () => {
    expect(stricterThanRestricted("suspended")).toBe("suspended")
    expect(stricterThanRestricted("closing")).toBe("closing")
    expect(stricterThanRestricted("closed")).toBe("closed")
    for (const looser of ["active", "provisioning", "restricted", "paused", 7, null, undefined]) {
      expect(stricterThanRestricted(looser)).toBe("restricted")
    }
  })

  it("keeps a suspended shop closed when its row fails and nothing is held (LOW-2)", () => {
    jest.spyOn(logger, "error").mockImplementation(() => undefined)
    const forged = row({ ...planDocument, status: "suspended" })
    const last = new LastVerified()

    expect(last.fallback(TENANT_ID, "signature.invalid", unverifiedStatus(forged))).toMatchObject({
      managed: true,
      status: "suspended",
      serial: null,
    })
    // A forged active row still restricts
    const active = row({ ...planDocument, status: "active" })
    expect(last.fallback(TENANT_ID, "signature.invalid", unverifiedStatus(active))).toMatchObject({
      status: "restricted",
    })
    // A row with no document object says nothing
    const broken = { ...forged, document: "x" as unknown as StoredPlan["document"] }
    expect(unverifiedStatus(broken)).toBeUndefined()
  })

  it("restricts a shop whose row is gone, or keeps the stricter status it verified (LOW-3)", () => {
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    const last = new LastVerified()

    expect(last.missing(TENANT_ID)).toMatchObject({ managed: true, status: "restricted" })
    last.remember(TENANT_ID, stateOfStored(row({ ...planDocument, status: "active" })))
    expect(last.missing(TENANT_ID)).toMatchObject({ status: "restricted", serial: null })
    last.remember(TENANT_ID, stateOfStored(row({ ...planDocument, status: "suspended" })))
    expect(last.missing(TENANT_ID)).toMatchObject({ status: "suspended", serial: null })
    expect(error.mock.calls).toEqual([
      [{ event: "control_plane.document_missing", kept: false }],
      [{ event: "control_plane.document_missing", kept: true }],
      [{ event: "control_plane.document_missing", kept: true }],
    ])
  })
})
