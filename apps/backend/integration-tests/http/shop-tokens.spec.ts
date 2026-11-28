import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Tokens {
  tokens: { name: string; value: string | null }[]
}

/** adr/0048: the shop's details a text may stand in for, as they show now. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("lists each detail with its value, none until given", async () => {
      const owner = await createAdminUser(http, getContainer())
      const tokens = async () =>
        (await settle(http.get<Tokens>("/admin/shop-tokens", { headers: owner.headers }))).data
          .tokens
      const before = await tokens()
      await settle(
        http.post(
          "/admin/platform-settings/store",
          { contact_phone: "0532 123 45 67", whatsapp_phone: "+905321234568" },
          { headers: owner.headers }
        )
      )
      await settle(
        http.post(
          "/admin/platform-settings/promotions",
          { free_shipping_threshold: 1499.9 },
          { headers: owner.headers }
        )
      )
      const after = Object.fromEntries((await tokens()).map((token) => [token.name, token.value]))
      const anonymous = await settle(http.get("/admin/shop-tokens"))

      expect(before.map((token) => token.name)).toEqual([
        "mağaza_adı",
        "telefon",
        "e_posta",
        "adres",
        "whatsapp",
        "ücretsiz_kargo_eşiği",
        "hazırlama_süresi",
        "kargo_süresi",
        "iade_süresi",
      ])
      expect(before.find((token) => token.name === "telefon")?.value).toBeNull()
      expect(after).toMatchObject({
        telefon: "0532 123 45 67",
        whatsapp: "0532 123 45 68",
        ücretsiz_kargo_eşiği: "₺1.499,90",
      })
      expect(anonymous.status).toBe(401)
    })
  },
})
