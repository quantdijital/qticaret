import { describe, expect, it } from "vitest"
import {
  TENANT_RESULT_MAX_LENGTH,
  TENANT_RESULT_PREFIX,
  applyPackResultSchema,
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
        tenantResultLine({ status: "invited", token: "x".repeat(TENANT_RESULT_MAX_LENGTH) })
      )
    ).toBeNull()
  })

  it("takes the apply-pack result strictly (Ek C12)", () => {
    const applied = {
      status: "applied",
      pack: "cutlery",
      version: 2,
      added: 3,
      kept: 1,
      skipped: 0,
    }
    expect(applyPackResultSchema.safeParse(applied).success).toBe(true)
    expect(applyPackResultSchema.safeParse({ status: "unknown_pack" }).success).toBe(true)
    for (const bad of [
      { ...applied, items: [] },
      { ...applied, pack: "Bıçak" },
      { ...applied, version: 0 },
      { ...applied, added: -1 },
      { status: "unknown_pack", pack: "cutlery" },
    ]) {
      expect(applyPackResultSchema.safeParse(bad).success).toBe(false)
    }
  })

  it("takes the invite and import results strictly: a token, never a link", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Imludml0ZSJ9.c2lnbmF0dXJlX29mX3Rva2Vu"
    expect(inviteOwnerResultSchema.safeParse({ status: "invited", token }).success).toBe(true)
    for (const bad of [
      "http://evil.example/invite#token=abcdefghijklmnop",
      "short",
      "abcdefghijklmnop qrstu",
      `${token}#x`,
    ]) {
      expect(inviteOwnerResultSchema.safeParse({ status: "invited", token: bad }).success).toBe(
        false
      )
    }
    expect(
      inviteOwnerResultSchema.safeParse({ status: "invited", token, link: "http://x/invite" })
        .success
    ).toBe(false)
    expect(inviteOwnerResultSchema.safeParse({ status: "owner_exists" }).success).toBe(true)
    expect(inviteOwnerResultSchema.safeParse({ status: "owner_exists", token }).success).toBe(false)
    expect(planImportResultSchema.safeParse({ status: "applied", serial: 3 }).success).toBe(true)
    expect(planImportResultSchema.safeParse({ status: "applied", serial: 0 }).success).toBe(false)
    expect(
      planImportResultSchema.safeParse({ status: "refused", code: "signature.invalid" }).success
    ).toBe(true)
  })
})
