import { randomBytes } from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { kekFingerprint, keyFingerprint, sealSecret } from "@qticaret/server-kit"
import {
  anyOf,
  fakePaytrAccount,
  fakeSecret,
  paytrNotification,
  startFakePaytr,
} from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import credentialsRewrapJob from "../../src/jobs/credentials-rewrap"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../src/lib/payments/checkout"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../src/modules/integration-credentials"
import { contextOf } from "../../src/modules/integration-credentials/rows"
import type IntegrationCredentialsModuleService from "../../src/modules/integration-credentials/service"
import { runCredentialKeysCommand } from "../../src/scripts/credentials-keys"
import { rewrapCredentialsWorkflow } from "../../src/workflows/integration-credentials/rewrap-credentials"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { restoreCredentialKeys, useCredentialKeys } from "../helpers/credential-keys"
import { captureOutput } from "../helpers/logs"
import { connectPaytr, orderOfCart, readyCart, storeReturnUrls } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

// A made-up PayTR account and test-only keys, fresh per run
const account = fakePaytrAccount()
const iyzico = {
  settings: { test_mode: true },
  secrets: { api_key: fakeSecret(), secret_key: fakeSecret() },
}
const [oldKey, newKey] = [0, 1].map(() => randomBytes(32).toString("hex")) as [string, string]
const kekIdOf = (hex: string) => kekFingerprint(Buffer.from(hex, "hex"))
const SECRETS = anyOf(
  account.merchantKey,
  account.merchantSalt,
  iyzico.secrets.api_key,
  iyzico.secrets.secret_key,
  ...[oldKey, newKey].flatMap((hex) => [
    hex,
    Buffer.from(hex, "hex").toString("base64"),
    Buffer.from(hex, "hex").toString("base64url"),
  ])
)
const FORM = { headers: { "content-type": "application/x-www-form-urlencoded" } }

const useKeys = useCredentialKeys

/**
 * adr/0061 F17.4 KK3: the credentials key is rotated without downtime. A
 * shop with today's single key and adr/0027 rows takes payments before,
 * during (new key first, old kept, the rewrap half done) and after the
 * rotation (old key removed); no row and no log holds a secret.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string

    const credentials = () =>
      getContainer().resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    const rawRows = async () => {
      const result = await getContainer()
        .resolve(ContainerRegistrationKeys.PG_CONNECTION)
        .raw<{ rows: Record<string, unknown>[] }>("SELECT * FROM integration_credential")
      return result.rows
    }

    /** A PayTR payment from the storefront to the order, as PayTR reports it. */
    async function pay(): Promise<string | null> {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await http.post<{ payment_session: { data: Record<string, unknown> } }>(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: PAYTR_PAYMENT_PROVIDER_ID, return_urls: storeReturnUrls() },
        { headers: storefront.headers }
      )
      const merchantOid = String(started.data.payment_session.data["merchant_oid"])
      fake.pay(merchantOid)
      const notified = await settle(
        http.post<string>(
          "/hooks/paytr",
          new URLSearchParams(
            paytrNotification(account, {
              merchantOid,
              status: "success",
              paymentAmount: 21000,
              testMode: true,
            })
          ).toString(),
          FORM
        )
      )
      expect(notified.data).toBe("OK")
      return orderOfCart(getContainer(), cartId)
    }

    /** The PayTR row as a shop made it before C17: adr/0027's box straight under the single key. */
    async function makePaytrLegacy() {
      const service = credentials()
      const key = Buffer.from(oldKey, "hex")
      const [paytr] = await service.listIntegrationCredentials({ provider: "paytr" })
      await service.updateIntegrationCredentials({
        id: paytr?.id ?? "",
        secret_ciphertext: sealSecret(
          JSON.stringify({
            merchant_key: account.merchantKey,
            merchant_salt: account.merchantSalt,
          }),
          key,
          contextOf("paytr", paytr?.settings ?? {})
        ),
        key_id: keyFingerprint(key),
      })
    }

    /** Both accounts in adr/0027's format: PayTR, and iyzico written as it was. */
    async function makeLegacy() {
      await makePaytrLegacy()
      const key = Buffer.from(oldKey, "hex")
      await credentials().createIntegrationCredentials({
        provider: "iyzico",
        settings: iyzico.settings,
        secret_ciphertext: sealSecret(
          JSON.stringify(iyzico.secrets),
          key,
          contextOf("iyzico", iyzico.settings)
        ),
        key_id: keyFingerprint(key),
        secrets_version: 1,
        verification: "verified",
      })
    }

    beforeAll(async () => {
      fake = await startFakePaytr(account)
      // Read on the first PayTR call (lib/payments/paytr/client.ts)
      process.env["PAYTR_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["PAYTR_BASE_URL"]
      restoreCredentialKeys()
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
    })

    it("takes payments before, during and after a key rotation; no secret anywhere", async () => {
      // Today's shop: the single key, its accounts in adr/0027's format
      useKeys([oldKey], true)
      const admin = await connectPaytr(http, getContainer(), account)
      await makeLegacy()

      const output = await captureOutput(async () => {
        // Before: the old format is read, the payment completes, the rows are upgraded
        expect(await pay()).toMatch(/^order_/)
        expect((await credentials().keyStatus()).keys).toEqual([
          { kek_id: kekIdOf(oldKey), state: "current", records: 2 },
        ])
        // A row nobody has read since: the hourly job upgrades it
        await makePaytrLegacy()
        await credentialsRewrapJob(getContainer())
        expect(await credentials().keyStatus()).toMatchObject({ pending: 0 })

        // During: the new key first, the old one kept, the rewrap half done
        useKeys([newKey, oldKey])
        const half = await rewrapCredentialsWorkflow(getContainer()).run({ input: { limit: 1 } })
        expect(half.result.rewrapped).toBe(1)
        expect(await credentials().keyStatus()).toMatchObject({ pending: 1, stranded: 0 })
        expect(await pay()).toMatch(/^order_/)
        // Reads leave an older KEK's envelope to the rewrap
        expect(await credentials().keyStatus()).toMatchObject({ pending: 1, stranded: 0 })

        // The hourly job moves no row between KEKs (review L1): it says so and waits
        await credentialsRewrapJob(getContainer())
        expect(await credentials().keyStatus()).toMatchObject({ pending: 1 })

        // The operator's rewrap from the updated config finishes; the old key may go
        expect(await runCredentialKeysCommand(getContainer(), "rewrap")).toBe(0)
        expect(await runCredentialKeysCommand(getContainer(), "status")).toBe(0)
        const done = await credentials().keyStatus()
        expect(done).toMatchObject({ pending: 0, stranded: 0, removable: [kekIdOf(oldKey)] })

        // After: the old key removed, payments go on
        useKeys([newKey])
        expect(await pay()).toMatch(/^order_/)
        const listed = await http.get<{ accounts: { provider: string; state: string }[] }>(
          "/admin/integrations/credentials",
          { headers: admin.headers }
        )
        expect(listed.data.accounts.filter(({ state }) => state === "connected")).toEqual([
          expect.objectContaining({ provider: "paytr" }),
          expect.objectContaining({ provider: "iyzico" }),
        ])
        expect(JSON.stringify(listed.data)).not.toMatch(SECRETS)
      })

      const rows = await rawRows()
      expect(rows).toHaveLength(2)
      for (const row of rows) {
        expect(row["key_id"]).toBe(kekIdOf(newKey))
        expect(String(row["secret_ciphertext"])).toMatch(/^qtenv1\./)
      }
      // Not in any column, in the clear or as hex/base64 of the keys
      expect(JSON.stringify(rows)).not.toMatch(SECRETS)
      expect(output).not.toMatch(SECRETS)
      expect(output).toContain('"from":"legacy"')
      expect(output).toMatch(/"event":"integration_credentials\.rewrap_done"[^\n]*"upgraded":1,/)
      expect(output).toMatch(
        new RegExp(
          `"event":"integration_credentials\\.kek_order_conflict","current":"${kekIdOf(newKey)}","older":\\[\\{"kek_id":"${kekIdOf(oldKey)}","records":1\\}\\]`
        )
      )
      expect(output).toContain("credentials:keys: rewrapped 1, upgraded 0, failed 0, stranded 0")
      expect(output).not.toContain("integration_credentials.kek_missing")
    })
  },
})
