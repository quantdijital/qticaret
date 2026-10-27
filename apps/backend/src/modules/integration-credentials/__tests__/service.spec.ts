import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { anyOf, fakeSecret } from "@qticaret/testing"
import { INTEGRATION_CREDENTIALS_MODULE } from ".."
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

moduleIntegrationTestRunner<IntegrationCredentialsModuleService>({
  moduleName: INTEGRATION_CREDENTIALS_MODULE,
  resolve: "./src/modules/integration-credentials",
  moduleOptions: { encryptionKey: randomBytes(32).toString("hex") },
  testSuite: ({ service }) => {
    async function connect() {
      const draft = await service.draft("paytr", { settings, secrets })
      await service.store(draft, "verified", "user_1")
      return draft
    }

    it("starts with every provider unconnected", async () => {
      expect(service.keyConfigured()).toBe(true)
      expect(await service.describeAll()).toEqual([
        expect.objectContaining({ provider: "paytr", state: "not_configured", settings: null }),
      ])
      expect(await service.read("paytr")).toBeNull()
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
      await service.recordCheck("paytr", "verified")

      expect(await service.describe("paytr")).toMatchObject({ state: "unreadable" })
      expect(await service.read("paytr")).toBeNull()
      expect(await reasonOf(service.draft("paytr", { settings }))).toBe(
        "integration_credentials.secrets_required"
      )
    })

    it("does not open a blob moved to another provider's row", async () => {
      const draft = await connect()

      expect(() =>
        service.openDraft({ ...draft, provider: "iyzico" as unknown as typeof draft.provider })
      ).toThrow()
      expect(service.openDraft(draft)).toEqual({ settings, secrets })
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
    it("saves nothing without the server's key and says so", async () => {
      expect(service.keyConfigured()).toBe(false)
      expect(await reasonOf(service.draft("paytr", { settings, secrets }))).toBe(
        "integration_credentials.key_missing"
      )
    })
  },
})
