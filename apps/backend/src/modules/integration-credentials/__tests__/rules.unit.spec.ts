import { anyOf, fakeSecret } from "@qticaret/testing"
import { accountChanges, planSave, statusOf } from "../rules"
import type { IntegrationCredentialRecord } from "../types"

const reasonOf = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    const fields = error as { safeMessage?: unknown; field?: unknown }
    return { key: fields.safeMessage, field: fields.field }
  }
  return "no error"
}

// Fresh per run: no fixed secret in the repo, fake or not (docs/04)
const stored = { merchant_key: fakeSecret(), merchant_salt: fakeSecret() }
const newSecret = fakeSecret()
const row = {
  settings: { merchant_id: "100001", test_mode: true },
  verification: "verified" as const,
}

describe("planSave", () => {
  it("asks for every secret on a first save", () => {
    expect(
      reasonOf(() =>
        planSave("paytr", { settings: { merchant_id: "100001", test_mode: true } }, undefined, null)
      )
    ).toEqual({ key: "integration_credentials.secrets_required", field: "secrets.merchant_key" })
  })

  it("keeps stored secrets left blank; changing test mode alone asks nobody", () => {
    const plan = planSave(
      "paytr",
      { settings: { merchant_id: "100001", test_mode: false }, secrets: { merchant_key: "" } },
      row,
      stored
    )

    expect(plan).toEqual({
      settings: { merchant_id: "100001", test_mode: false },
      secrets: stored,
      needsCheck: false,
      secretsChanged: false,
    })
  })

  it("checks again when a secret changes", () => {
    const plan = planSave(
      "paytr",
      { settings: row.settings, secrets: { merchant_salt: ` ${newSecret} ` } },
      row,
      stored
    )

    expect(plan.secrets).toEqual({ ...stored, merchant_salt: newSecret })
    expect(plan).toMatchObject({ needsCheck: true, secretsChanged: true })
  })

  it("asks again and counts a version for a secret sent, even one equal to the stored", () => {
    // No comparison with the stored value: the answer must not tell a guess right from wrong
    const plan = planSave(
      "paytr",
      { settings: row.settings, secrets: { merchant_key: stored.merchant_key } },
      row,
      stored
    )

    expect(plan).toMatchObject({ needsCheck: true, secretsChanged: true, secrets: stored })
  })

  it("asks for both secrets again when the shop number changes", () => {
    const settings = { merchant_id: "100002", test_mode: true }

    expect(
      reasonOf(() =>
        planSave("paytr", { settings, secrets: { merchant_key: newSecret } }, row, stored)
      )
    ).toEqual({ key: "integration_credentials.secrets_required", field: "secrets.merchant_salt" })
  })

  it("asks for both secrets again when the stored ones no longer open", () => {
    expect(reasonOf(() => planSave("paytr", { settings: row.settings }, row, null))).toMatchObject({
      key: "integration_credentials.secrets_required",
    })
  })

  it("checks a save made while the last check could not reach the provider", () => {
    const plan = planSave(
      "paytr",
      { settings: row.settings },
      { ...row, verification: "unverified" },
      stored
    )

    expect(plan.needsCheck).toBe(true)
  })

  it.each([
    [
      { settings: { merchant_id: "12AB", test_mode: true } },
      "paytr.merchant_id_invalid",
      "settings.merchant_id",
    ],
    [
      { settings: { merchant_id: "1", test_mode: true, extra: 1 } },
      "integration_credentials.invalid",
      "settings",
    ],
    [
      { settings: row.settings, secrets: { merchant_key: "with space inside" } },
      "integration_credentials.secret_invalid",
      "secrets.merchant_key",
    ],
    [
      { settings: row.settings, secrets: { api_key: "x".repeat(20) } },
      "integration_credentials.invalid",
      "secrets.api_key",
    ],
  ])("refuses %p", (input, key, field) => {
    expect(reasonOf(() => planSave("paytr", input, row, stored))).toEqual({ key, field })
  })
})

describe("statusOf", () => {
  const record = {
    ...row,
    provider: "paytr",
    secrets_version: 3,
    verified_at: null,
    updated_at: new Date("2026-10-27T10:00:00Z"),
    updated_by: "user_1",
  } as unknown as IntegrationCredentialRecord

  it("shows which secrets are stored, never their values", () => {
    const status = statusOf("paytr", record, true)

    expect(status).toMatchObject({
      state: "connected",
      secrets: { merchant_key: true, merchant_salt: true },
      secrets_version: 3,
    })
    expect(JSON.stringify(status)).not.toMatch(
      anyOf(stored.merchant_key, stored.merchant_salt, "secret_ciphertext")
    )
  })

  it("tells nothing stored, unchecked and unreadable apart", () => {
    expect(statusOf("paytr", undefined, false).state).toBe("not_configured")
    expect(statusOf("paytr", { ...record, verification: "unverified" }, true).state).toBe(
      "unverified"
    )
    expect(statusOf("paytr", record, false)).toMatchObject({
      state: "unreadable",
      secrets: { merchant_key: false, merchant_salt: false },
    })
  })
})

describe("accountChanges", () => {
  const before = { settings: { merchant_id: "100001", test_mode: true } }

  it("names a first connection and a disconnect", () => {
    expect(accountChanges("paytr", null, { ...before, secrets_changed: true })).toEqual([
      "connected",
    ])
    expect(accountChanges("paytr", before, null)).toEqual(["removed"])
    expect(accountChanges("paytr", null, null)).toEqual([])
  })

  it("names a new shop number, new secrets and the test mode", () => {
    expect(
      accountChanges("paytr", before, {
        settings: { merchant_id: "100002", test_mode: false },
        secrets_changed: true,
      })
    ).toEqual(["account", "test_mode_off"])
    expect(accountChanges("paytr", before, { ...before, secrets_changed: true })).toEqual([
      "secrets",
    ])
    expect(
      accountChanges(
        "paytr",
        { settings: { ...before.settings, test_mode: false } },
        { ...before, secrets_changed: false }
      )
    ).toEqual(["test_mode_on"])
    expect(accountChanges("paytr", before, { ...before, secrets_changed: false })).toEqual([])
  })
})
