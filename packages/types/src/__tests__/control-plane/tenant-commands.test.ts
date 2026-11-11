import { describe, expect, it } from "vitest"
import {
  TENANT_RESULT_MAX_LENGTH,
  TENANT_RESULT_PREFIX,
  inviteOwnerResultSchema,
  planImportResultSchema,
  readTenantResult,
  tenantResultLine,
} from "../../control-plane/tenant-commands.js"

describe("tenant command results (adr/0061 Ek C10)", () => {
  it("reads the last result line among the command's log lines", () => {
    const stdout = [
      '{"level":"info","msg":"starting"}',
      tenantResultLine({ status: "same", serial: 1 }),
      "plain text",
      tenantResultLine({ status: "applied", serial: 2 }),
      "",
    ].join("\n")

    expect(readTenantResult(stdout)).toEqual({ status: "applied", serial: 2 })
  })

  it("reads nothing without a line, from a broken one, a non-object or one too long", () => {
    expect(readTenantResult('{"status":"invited"}\n')).toBeNull()
    expect(readTenantResult(`${TENANT_RESULT_PREFIX}{not json`)).toBeNull()
    expect(readTenantResult(`${TENANT_RESULT_PREFIX}[1,2]`)).toBeNull()
    expect(
      readTenantResult(
        tenantResultLine({ status: "invited", link: "x".repeat(TENANT_RESULT_MAX_LENGTH) })
      )
    ).toBeNull()
  })

  it("takes the invite and import results strictly", () => {
    expect(
      inviteOwnerResultSchema.safeParse({ status: "invited", link: "http://localhost:5173/invite" })
        .success
    ).toBe(true)
    expect(inviteOwnerResultSchema.safeParse({ status: "owner_exists" }).success).toBe(true)
    expect(inviteOwnerResultSchema.safeParse({ status: "owner_exists", link: "x" }).success).toBe(
      false
    )
    expect(planImportResultSchema.safeParse({ status: "applied", serial: 3 }).success).toBe(true)
    expect(planImportResultSchema.safeParse({ status: "applied", serial: 0 }).success).toBe(false)
    expect(
      planImportResultSchema.safeParse({ status: "refused", code: "signature.invalid" }).success
    ).toBe(true)
  })
})
