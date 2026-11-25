import { fakeSecret } from "@qticaret/testing"
import { CHECK_FIELDS } from "../../../lib/integrations/account-check"
import { CREDENTIAL_PROVIDERS, CREDENTIAL_PROVIDER_NAMES, isCredentialProvider } from "../providers"
import {
  AI_CREDENTIAL_PROVIDERS,
  isAiCredentialProvider,
  offersLocalProviders,
} from "../providers-ai"
import { accountChanges, planSave, statusOf } from "../rules"
import type { IntegrationCredentialRecord } from "../types"

/** rules.unit.spec.ts for the AI services (adr/0071 §3); that file is at its length. */

const reasonOf = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    const fields = error as { safeMessage?: unknown; field?: unknown }
    return { key: fields.safeMessage, field: fields.field }
  }
  return "no error"
}

// Plainly fake and fresh per run (docs/04)
const key = () => `test-key-${fakeSecret()}`
const AI = ["deepseek", "minimax", "gemini", "photoroom", "qwen"] as const

describe("AI service accounts (adr/0071 §3)", () => {
  it("are providers of their own, after the others and in the registry's order", () => {
    expect(CREDENTIAL_PROVIDER_NAMES.slice(-(AI.length + 1))).toEqual([...AI, "fake"])
    for (const provider of AI) {
      expect(isCredentialProvider(provider)).toBe(true)
      expect(isAiCredentialProvider(provider)).toBe(true)
      expect(CHECK_FIELDS[provider]).toEqual({
        merchant_invalid: "secrets.api_key",
        secret_invalid: "secrets.api_key",
      })
    }
    expect(isAiCredentialProvider("paytr")).toBe(false)
    expect(isAiCredentialProvider("toString")).toBe(false)
  })

  it("offer the fake service's account in development and tests only", () => {
    expect(offersLocalProviders("test")).toBe(true)
    expect(offersLocalProviders("development")).toBe(true)
    for (const env of ["production", "staging"]) {
      expect(offersLocalProviders(env)).toBe(false)
    }
  })

  it.each(AI)("%s asks for the key on a first save and stores nothing in the clear", (provider) => {
    expect(reasonOf(() => planSave(provider, { settings: {} }, undefined, null))).toEqual({
      key: "integration_credentials.secrets_required",
      field: "secrets.api_key",
    })
    const given = key()
    const plan = planSave(
      provider,
      { settings: {}, secrets: { api_key: ` ${given} ` } },
      undefined,
      null
    )

    expect(plan).toEqual({
      settings: {},
      secrets: { api_key: given },
      needsCheck: true,
      secretsChanged: true,
    })
    const record = {
      provider,
      settings: {},
      verification: "verified",
      secrets_version: 1,
      verified_at: null,
      updated_at: new Date("2026-11-17T10:00:00Z"),
      updated_by: "user_1",
    } as unknown as IntegrationCredentialRecord
    const status = statusOf(provider, record, { api_key: given })

    expect(status).toMatchObject({ state: "connected", secrets: { api_key: true } })
    expect(JSON.stringify(status)).not.toContain(given)
  })

  it.each(AI)("%s takes no address, region or other setting", (provider) => {
    for (const settings of [
      { base_url: "https://attacker.invalid" },
      { region: "cn" },
      { model: "x" },
    ]) {
      expect(
        reasonOf(() =>
          planSave(provider, { settings, secrets: { api_key: key() } }, undefined, null)
        )
      ).toMatchObject({ key: "integration_credentials.invalid" })
    }
    expect(
      reasonOf(() =>
        planSave(
          provider,
          { settings: {}, secrets: { api_key: key(), token: key() } },
          undefined,
          null
        )
      )
    ).toEqual({ key: "integration_credentials.invalid", field: "secrets.token" })
  })

  it("takes a key of 16 to 256 characters, the route's bound for any secret", () => {
    const sized = (length: number) => `test-key-${"x".repeat(length - 9)}`
    for (const length of [16, 256]) {
      expect(
        planSave("deepseek", { settings: {}, secrets: { api_key: sized(length) } }, undefined, null)
          .secrets
      ).toEqual({ api_key: sized(length) })
    }
    expect(
      reasonOf(() =>
        planSave("deepseek", { settings: {}, secrets: { api_key: sized(257) } }, undefined, null)
      )
    ).toMatchObject({ field: "secrets.api_key" })
  })

  it("refuses a key too short or with spaces", () => {
    for (const bad of ["short", "test key with spaces inside"]) {
      expect(
        reasonOf(() =>
          planSave("deepseek", { settings: {}, secrets: { api_key: bad } }, undefined, null)
        )
      ).toMatchObject({ field: "secrets.api_key" })
    }
  })

  it("keeps a stored key left blank, and checks a new one", () => {
    const stored = { api_key: key() }
    const row = { settings: {}, verification: "verified" as const }

    expect(planSave("gemini", { settings: {}, secrets: { api_key: "" } }, row, stored)).toEqual({
      settings: {},
      secrets: stored,
      needsCheck: false,
      secretsChanged: false,
    })
    expect(
      planSave("gemini", { settings: {}, secrets: { api_key: key() } }, row, stored)
    ).toMatchObject({ needsCheck: true, secretsChanged: true })
  })

  it("names a new key and a disconnect in the bell", () => {
    const before = { settings: {} }

    expect(accountChanges("minimax", null, { settings: {}, secrets_changed: true })).toEqual([
      "connected",
    ])
    expect(accountChanges("minimax", before, { settings: {}, secrets_changed: true })).toEqual([
      "secrets",
    ])
    expect(accountChanges("minimax", before, null)).toEqual(["removed"])
  })

  it("share one shape: a key and nothing else", () => {
    for (const definition of Object.values(AI_CREDENTIAL_PROVIDERS)) {
      expect(definition.secrets).toEqual(["api_key"])
      expect(definition.identity).toEqual([])
      expect(definition.settings.safeParse({}).success).toBe(true)
    }
    expect(Object.keys(CREDENTIAL_PROVIDERS)).toEqual(
      expect.arrayContaining(["paytr", "shopify", ...AI])
    )
  })
})
