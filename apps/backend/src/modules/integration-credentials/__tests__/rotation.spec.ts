import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { kekFingerprint, keyFingerprint, sealSecret } from "@qticaret/server-kit"
import { anyOf, fakeSecret } from "@qticaret/testing"
import {
  restoreCredentialKeys,
  useCredentialKeys,
} from "../../../../integration-tests/helpers/credential-keys"
import { logger } from "../../../lib/logging"
import { INTEGRATION_CREDENTIALS_MODULE } from ".."
import type { CredentialProviderName } from "../providers"
import { contextOf } from "../rows"
import type IntegrationCredentialsModuleService from "../service"

jest.setTimeout(120 * 1000)

// Test-only keys and made-up accounts, fresh per run
const [oldKey, newKey] = [0, 1].map(() => randomBytes(32).toString("hex")) as [string, string]
const kekIdOf = (hex: string) => kekFingerprint(Buffer.from(hex, "hex"))
const settings = { merchant_id: "100001", test_mode: true }
const secrets = { merchant_key: fakeSecret(), merchant_salt: fakeSecret() }
const iyzicoSettings = { test_mode: true }
const iyzicoSecrets = { api_key: fakeSecret(), secret_key: fakeSecret() }
const SECRETS = anyOf(...Object.values(secrets), ...Object.values(iyzicoSecrets))

// `single`: the single-key form, as every shop before C17 is configured
const useKeys = useCredentialKeys
afterAll(restoreCredentialKeys)

/** adr/0061 Ek C17: the credentials KEK rotation, the old format and the rewrap. */
moduleIntegrationTestRunner<IntegrationCredentialsModuleService>({
  moduleName: INTEGRATION_CREDENTIALS_MODULE,
  resolve: "./src/modules/integration-credentials",
  moduleOptions: {},
  testSuite: ({ service }) => {
    let errors: jest.SpyInstance

    beforeEach(() => {
      useKeys([oldKey], true)
      errors = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    })

    afterEach(() => {
      errors.mockRestore()
    })

    const rowOf = async (provider: CredentialProviderName) => {
      const [row] = await service.listIntegrationCredentials({ provider })
      if (!row) {
        throw new Error(`no ${provider} row`)
      }
      return row
    }

    /** A row exactly as adr/0027 stored it, under the single key. */
    async function storeLegacy(
      provider: CredentialProviderName,
      account: { settings: Record<string, unknown>; secrets: Record<string, string> }
    ) {
      const key = Buffer.from(oldKey, "hex")
      await service.createIntegrationCredentials({
        provider,
        settings: account.settings,
        secret_ciphertext: sealSecret(
          JSON.stringify(account.secrets),
          key,
          contextOf(provider, account.settings)
        ),
        key_id: keyFingerprint(key),
        secrets_version: 3,
        verification: "verified",
        verified_at: new Date(),
      })
    }

    async function connect(provider: CredentialProviderName = "paytr") {
      const draft =
        provider === "paytr"
          ? await service.draft("paytr", { settings, secrets })
          : await service.draft("iyzico", { settings: iyzicoSettings, secrets: iyzicoSecrets })
      await service.store(draft, "verified", "user_1")
    }

    it("reads an adr/0027 row and rewrites it as an envelope, changing nothing else", async () => {
      await storeLegacy("paytr", { settings, secrets })
      const before = await rowOf("paytr")

      expect(await service.read("paytr")).toEqual({ settings, secrets })
      const after = await rowOf("paytr")

      expect(after.secret_ciphertext).toMatch(/^qtenv1\./)
      expect(after.key_id).toBe(kekIdOf(oldKey))
      // The account did not change: its version, check and stamp stay
      expect(after.secrets_version).toBe(3)
      expect(new Date(after.updated_at).getTime()).toBe(new Date(before.updated_at).getTime())
      expect(JSON.stringify(after)).not.toMatch(SECRETS)
      expect(await service.describe("paytr")).toMatchObject({ state: "connected" })
      expect((await service.keyStatus()).keys).toEqual([
        { kek_id: kekIdOf(oldKey), state: "current", records: 1 },
      ])
    })

    it("keeps every account readable through a rotation, then lets the old key go", async () => {
      await connect("paytr")
      await storeLegacy("iyzico", { settings: iyzicoSettings, secrets: iyzicoSecrets })

      // 1. The new key is put first; the old one stays
      useKeys([newKey, oldKey])
      expect(await service.keyStatus()).toMatchObject({ pending: 2, stranded: 0, removable: [] })

      // 2. A partial run: one account moved, the other still under the old key
      const partial = await service.rewrapAll({ limit: 1 })
      expect(partial.rewrapped + partial.upgraded).toBe(1)
      expect(await service.keyStatus()).toMatchObject({ pending: 1 })
      expect((await service.readForCheck("paytr"))?.account).toEqual({ settings, secrets })
      expect(await service.read("iyzico")).toEqual({
        settings: iyzicoSettings,
        secrets: iyzicoSecrets,
      })

      // 3. The rest; a second run finds nothing to do
      await service.rewrapAll()
      expect(await service.rewrapAll()).toEqual({
        rewrapped: 0,
        upgraded: 0,
        stranded: 0,
        failed: 0,
        failed_providers: [],
      })
      const status = await service.keyStatus()
      expect(status).toMatchObject({ pending: 0, stranded: 0, removable: [kekIdOf(oldKey)] })

      // 4. The old key removed: everything opens under the new one alone
      useKeys([newKey])
      expect(await service.read("paytr")).toEqual({ settings, secrets })
      expect(await service.read("iyzico")).toEqual({
        settings: iyzicoSettings,
        secrets: iyzicoSecrets,
      })
      expect(errors).not.toHaveBeenCalled()
      for (const provider of ["paytr", "iyzico"] as const) {
        const row = await rowOf(provider)
        expect(row.key_id).toBe(kekIdOf(newKey))
        expect(JSON.stringify(row)).not.toMatch(SECRETS)
      }
    })

    it("says loudly when a key was removed too early, and recovers when it is put back", async () => {
      await connect("paytr")
      useKeys([newKey])

      expect(await service.read("paytr")).toBeNull()
      expect(await service.describe("paytr")).toMatchObject({ state: "unreadable" })
      expect(errors).toHaveBeenCalledWith({
        event: "integration_credentials.kek_missing",
        provider: "paytr",
        key_id: kekIdOf(oldKey),
      })
      expect(await service.keyStatus()).toMatchObject({
        stranded: 1,
        keys: expect.arrayContaining([
          { kek_id: kekIdOf(oldKey), state: "missing", records: 1 },
        ]) as unknown,
      })
      expect(await service.rewrapAll()).toMatchObject({ stranded: 1, failed_providers: ["paytr"] })

      // The fix: the old key back after the current one, then a rewrap
      useKeys([newKey, oldKey])
      expect(await service.read("paytr")).toEqual({ settings, secrets })
      await service.rewrapAll()
      expect(await service.keyStatus()).toMatchObject({ pending: 0, stranded: 0 })
      expect(JSON.stringify(errors.mock.calls)).not.toMatch(SECRETS)
    })

    it("never undoes a save made while a stale copy is being upgraded", async () => {
      await storeLegacy("paytr", { settings, secrets })
      const stale = await rowOf("paytr")
      const newSalt = fakeSecret()
      const draft = await service.draft("paytr", { settings, secrets: { merchant_salt: newSalt } })
      await service.store(draft, "unverified", "user_2")

      // An upgrade working from the copy read before the save: its swap finds the row changed
      const opened = await (
        service as unknown as { openRow: (row: unknown) => Promise<unknown> }
      ).openRow(stale)

      expect(opened).toEqual(secrets)
      expect(await service.read("paytr")).toEqual({
        settings,
        secrets: { ...secrets, merchant_salt: newSalt },
      })
      expect((await rowOf("paytr")).secrets_version).toBe(4)
    })

    it("lets two upgrades of the same row race: one wins, both read the same account", async () => {
      await storeLegacy("paytr", { settings, secrets })
      useKeys([newKey, oldKey])

      const [first, second] = await Promise.all([
        service.describe("paytr"),
        service.readForCheck("paytr"),
      ])

      expect(first).toMatchObject({ state: "connected" })
      expect(second?.account).toEqual({ settings, secrets })
      expect((await rowOf("paytr")).key_id).toBe(kekIdOf(newKey))
      expect(await service.keyStatus()).toMatchObject({ pending: 0 })
    })
  },
})
