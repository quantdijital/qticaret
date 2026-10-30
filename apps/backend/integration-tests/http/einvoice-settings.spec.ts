import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeVkn, seededRandom } from "@qticaret/testing"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Answer {
  message?: string
  values?: Record<string, unknown>
}

/** F8 (adr/0034 §1): which program issues the invoices is the owner's to say. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves the program, the moment and the carriers' identity, the owner's alone", async () => {
      const owner = await createAdminUser(http, getContainer())
      const admin = await createAdminUser(http, getContainer(), "admin")
      const vkn = fakeVkn(seededRandom(3))
      const save = (headers: Record<string, string>, body: unknown) =>
        settle(http.post<Answer>("/admin/platform-settings/invoicing", body, { headers }))

      const before = await http.get<Answer>("/admin/platform-settings/invoicing", {
        headers: owner.headers,
      })
      const saved = await save(owner.headers, {
        provider: "external",
        trigger: "placed",
        carriers: { aras: { title: "Örnek Kargo A.Ş.", tax_id: vkn } },
      })
      const notAnId = await save(owner.headers, {
        carriers: { yurtici: { title: "Kargo", tax_id: "1234567891" } },
      })
      const byAdmin = await save(admin.headers, { provider: "none" })

      expect(before.data.values).toEqual({ provider: "none", trigger: "shipped", carriers: {} })
      expect(saved.status).toBe(200)
      expect(saved.data.values).toEqual({
        provider: "external",
        trigger: "placed",
        carriers: { aras: { title: "Örnek Kargo A.Ş.", tax_id: vkn } },
      })
      expect(notAnId.status).toBe(400)
      expect(byAdmin.status).toBe(403)
    })
  },
})
