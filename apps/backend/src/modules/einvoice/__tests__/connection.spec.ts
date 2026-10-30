import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { EINVOICE_MODULE } from ".."
import { ProviderError } from "../../../lib/errors"
import type EinvoiceModuleService from "../service"
import type { ParasutTokenPair } from "../service"

jest.setTimeout(120 * 1000)

const pair = (n: number, expiresAt = new Date(Date.now() + 3600_000)): ParasutTokenPair => ({
  accessToken: `erisim-${String(n)}`,
  refreshToken: `yenileme-${String(n)}`,
  expiresAt,
})
const expired = () => new Date(Date.now() - 1000)

moduleIntegrationTestRunner<EinvoiceModuleService>({
  moduleName: EINVOICE_MODULE,
  resolve: "./src/modules/einvoice",
  moduleOptions: { encryptionKey: randomBytes(32).toString("hex") },
  testSuite: ({ service }) => {
    it("keeps the tokens encrypted and shows the connection without them", async () => {
      await service.saveParasutConnection({ company_id: "123456", tokens: pair(1), by: "user_1" })
      const [row] = await service.listParasutConnections({})
      const refresh = jest.fn()

      expect(row?.access_token_encrypted).not.toContain("erisim-1")
      expect(row?.refresh_token_encrypted).not.toContain("yenileme-1")
      expect(await service.parasutConnection()).toMatchObject({
        company_id: "123456",
        status: "connected",
        connected_by: "user_1",
      })
      expect(JSON.stringify(await service.parasutConnection())).not.toContain("erisim")
      expect(await service.parasutAccess(refresh)).toEqual({
        company_id: "123456",
        token: "erisim-1",
      })
      expect(refresh).not.toHaveBeenCalled()
    })

    it("refreshes a dead token once for two processes asking at once, and keeps the new pair", async () => {
      await service.saveParasutConnection({
        company_id: "123456",
        tokens: pair(1, expired()),
        by: null,
      })
      const spent: string[] = []
      const refresh = async (refreshToken: string) => {
        spent.push(refreshToken)
        await new Promise((resolve) => setTimeout(resolve, 50))
        return pair(2)
      }

      const answers = await Promise.all([
        service.parasutAccess(refresh),
        service.parasutAccess(refresh),
      ])

      expect(spent).toEqual(["yenileme-1"])
      expect(answers).toEqual([
        { company_id: "123456", token: "erisim-2" },
        { company_id: "123456", token: "erisim-2" },
      ])
    })

    it("leaves the connection broken when Paraşüt refuses the refresh token", async () => {
      await service.saveParasutConnection({
        company_id: "123456",
        tokens: pair(1, expired()),
        by: null,
      })
      const refused = () =>
        Promise.reject(
          new ProviderError({
            provider: "parasut",
            providerCode: "invalid_grant",
            retryable: false,
          })
        )

      expect(await service.parasutAccess(refused)).toEqual({
        problem: "einvoice.parasut_disconnected",
      })
      expect(await service.parasutConnection()).toMatchObject({
        status: "broken",
        last_error: "invalid_grant",
      })
      expect(await service.parasutAccess(refused)).toEqual({
        problem: "einvoice.parasut_disconnected",
      })
    })

    it("connects again over a broken connection, puts it back on undo, and forgets it for good", async () => {
      await service.saveParasutConnection({ company_id: "111", tokens: pair(1), by: null })
      const previous = await service.saveParasutConnection({
        company_id: "222",
        tokens: pair(2),
        by: null,
      })
      await service.restoreParasutConnection(previous)
      const restored = await service.parasutAccess(jest.fn())
      const removed = await service.removeParasutConnection()

      expect(restored).toEqual({ company_id: "111", token: "erisim-1" })
      expect(removed).toBe(true)
      expect(await service.parasutAccess(jest.fn())).toEqual({
        problem: "einvoice.parasut_not_connected",
      })
      expect(await service.listParasutConnections({}, { withDeleted: true })).toEqual([])
    })
  },
})
