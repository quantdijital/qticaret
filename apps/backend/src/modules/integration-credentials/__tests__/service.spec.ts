import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { anyOf, fakeSecret } from "@qticaret/testing"
import {
  restoreCredentialKeys,
  useCredentialKeys,
} from "../../../../integration-tests/helpers/credential-keys"
import { logger } from "../../../lib/logging"
import { INTEGRATION_CREDENTIALS_MODULE } from ".."
import { CREDENTIAL_PROVIDER_NAMES } from "../providers"
import type IntegrationCredentialsModuleService from "../service"

jest.setTimeout(120 * 1000)

const reasonOf = async (run: Promise<unknown>): Promise<unknown> => {
  try {
    await run
  } catch (error) {
    return (error as { safeMessage?: unknown }).safeMessage
  }
  return "no error"
}

// A made-up account and key, fresh per run
const settings = { merchant_id: "100001", test_mode: true }
const secrets = { merchant_key: fakeSecret(), merchant_salt: fakeSecret() }
const newSalt = fakeSecret()
const SECRETS = anyOf(secrets.merchant_key, secrets.merchant_salt)

// The keys are read from the environment where they are used (adr/0061 Ek C17)
afterAll(restoreCredentialKeys)

moduleIntegrationTestRunner<IntegrationCredentialsModuleService>({
  moduleName: INTEGRATION_CREDENTIALS_MODULE,
  resolve: "./src/modules/integration-credentials",
  moduleOptions: {},
  testSuite: ({ service }) => {
    const key = randomBytes(32).toString("hex")
    beforeEach(() => {
      useCredentialKeys([key])
    })

    async function connect() {
      const draft = await service.draft("paytr", { settings, secrets })
      await service.store(draft, "verified", "user_1")
      return draft
    }

    it("starts with every provider unconnected", async () => {
      expect(service.isKeyConfigured()).toBe(true)
      expect(await service.describeAll()).toEqual(
        CREDENTIAL_PROVIDER_NAMES.map(
          (provider) =>
            expect.objectContaining({
              provider,
              state: "not_configured",
              settings: null,
            }) as unknown
        )
      )
      expect(CREDENTIAL_PROVIDER_NAMES).toEqual(
        expect.arrayContaining(["paytr", "iyzico", "aras", "yurtici", "netgsm"])
      )
      expect(await service.read("paytr")).toBeNull()
      expect(await service.read("iyzico")).toBeNull()
    })

    it("seals a draft: the database and the status hold no secret", async () => {
      const draft = await connect()
      const [row] = await service.listIntegrationCredentials({ provider: "paytr" })
      const status = await service.describe("paytr")

      expect(JSON.stringify(draft)).not.toMatch(SECRETS)
      expect(JSON.stringify(row)).not.toMatch(SECRETS)
      expect(JSON.stringify(status)).not.toMatch(SECRETS)
      expect(JSON.stringify(status)).not.toMatch(/ciphertext/)
      expect(status).toMatchObject({
        state: "connected",
        settings,
        secrets: { merchant_key: true, merchant_salt: true },
        secrets_version: 1,
        updated_by: "user_1",
      })
      expect(status.verified_at).toBeInstanceOf(Date)
    })

    it("gives the provider's calls the account in the clear, the cache following saves", async () => {
      await connect()
      expect(await service.read("paytr")).toEqual({ settings, secrets })

      const draft = await service.draft("paytr", { settings: { ...settings, test_mode: false } })
      await service.store(draft, null, "user_2")

      expect(draft.needs_check).toBe(false)
      expect(await service.read("paytr")).toEqual({
        settings: { ...settings, test_mode: false },
        secrets,
      })
      expect(await service.describe("paytr")).toMatchObject({
        state: "connected",
        secrets_version: 1,
      })
    })

    it("counts a new secret as a new version", async () => {
      await connect()
      const draft = await service.draft("paytr", {
        settings,
        secrets: { merchant_salt: newSalt },
      })
      await service.store(draft, "unverified", "user_1")

      expect(await service.describe("paytr")).toMatchObject({
        state: "unverified",
        secrets_version: 2,
        verified_at: null,
      })
      expect((await service.read("paytr"))?.secrets).toEqual({
        ...secrets,
        merchant_salt: newSalt,
      })
    })

    it("treats an account sealed under another key as one to enter again", async () => {
      await connect()
      const [row] = await service.listIntegrationCredentials({ provider: "paytr" })
      await service.updateIntegrationCredentials({ id: row?.id ?? "", key_id: "0000000000000000" })

      expect(await service.describe("paytr")).toMatchObject({ state: "unreadable" })
      expect(await service.readForCheck("paytr")).toBeNull()
      expect(await reasonOf(service.draft("paytr", { settings }))).toBe(
        "integration_credentials.secrets_required"
      )
    })

    it("does not open an account whose settings were changed behind the panel's back", async () => {
      await connect()
      const [row] = await service.listIntegrationCredentials({ provider: "paytr" })
      // Test mode turned on in the database: the blob is bound to the settings it was sealed with
      await service.updateIntegrationCredentials({
        id: row?.id ?? "",
        settings: { ...settings, test_mode: false },
      })

      expect(await service.describe("paytr")).toMatchObject({ state: "unreadable" })
      expect(await service.readForCheck("paytr")).toBeNull()
    })

    it("keeps a check's result only for the account it checked", async () => {
      await connect()
      const checked = await service.readForCheck("paytr")
      const draft = await service.draft("paytr", { settings, secrets: { merchant_salt: newSalt } })
      await service.store(draft, "unverified", "user_2")

      expect(await service.recordCheck("paytr", "verified", checked?.stamp ?? "")).toBe(false)
      expect(await service.describe("paytr")).toMatchObject({ state: "unverified" })

      const current = await service.readForCheck("paytr")
      expect(await service.recordCheck("paytr", "rejected", current?.stamp ?? "")).toBe(true)
      expect(await service.describe("paytr")).toMatchObject({
        state: "rejected",
        verified_at: null,
      })
    })

    it("puts an updated account back, dates as the workflow engine passes them", async () => {
      await connect()
      const draft = await service.draft("paytr", { settings, secrets: { merchant_salt: newSalt } })
      const previous = await service.store(draft, "unverified", "user_2")
      // Compensation data crosses the engine as JSON: dates arrive as strings
      const passed = JSON.parse(JSON.stringify(previous)) as typeof previous
      await service.restore("paytr", passed)

      expect(await service.read("paytr")).toEqual({ settings, secrets })
      expect(await service.describe("paytr")).toMatchObject({
        state: "connected",
        secrets_version: 1,
        updated_by: "user_1",
      })
    })

    it("lets two first saves race: one inserts, the other updates", async () => {
      const [first, second] = await Promise.all([
        service.draft("paytr", { settings, secrets }),
        service.draft("paytr", { settings, secrets }),
      ])
      await Promise.all([
        service.store(first, "verified", "user_1"),
        service.store(second, "verified", "user_2"),
      ])

      expect(await service.listIntegrationCredentials({ provider: "paytr" })).toHaveLength(1)
      expect(await service.read("paytr")).toEqual({ settings, secrets })
    })

    it("does not open a blob moved to another provider's row", async () => {
      const draft = await connect()

      const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined)
      await expect(service.openDraft({ ...draft, provider: "iyzico" })).rejects.toThrow()
      logged.mockRestore()
      expect(await service.openDraft(draft)).toEqual({ settings, secrets })
    })

    it("deletes a removed account outright and puts it back on compensation", async () => {
      await connect()
      const previous = await service.remove("paytr")

      expect(await service.describe("paytr")).toMatchObject({ state: "not_configured" })
      expect(await service.listIntegrationCredentials({}, { withDeleted: true })).toHaveLength(0)
      expect(await service.read("paytr")).toBeNull()

      await service.restore("paytr", previous)

      expect(await service.read("paytr")).toEqual({ settings, secrets })
    })

    it("undoes a first save completely", async () => {
      const draft = await service.draft("paytr", { settings, secrets })
      const previous = await service.store(draft, "verified", null)
      await service.restore("paytr", previous)

      expect(previous).toBeNull()
      expect(await service.describe("paytr")).toMatchObject({ state: "not_configured" })
    })
  },
})

moduleIntegrationTestRunner<IntegrationCredentialsModuleService>({
  moduleName: INTEGRATION_CREDENTIALS_MODULE,
  resolve: "./src/modules/integration-credentials",
  moduleOptions: {},
  testSuite: ({ service }) => {
    beforeEach(() => {
      useCredentialKeys([])
    })

    it("saves nothing without the server's key and says so, to the owner and the operator", async () => {
      const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined)
      expect(service.isKeyConfigured()).toBe(false)
      expect(await reasonOf(service.draft("paytr", { settings, secrets }))).toBe(
        "integration_credentials.key_missing"
      )
      // The operator's setting: an error log with a stable event to alert on
      expect(logged).toHaveBeenCalledWith({
        event: "integration_credentials.key_missing",
        provider: "paytr",
      })
      logged.mockRestore()
    })
  },
})
