import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

const doc = (...texts: string[]) => ({
  type: "doc",
  content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
})

const SHOP_TEXT = doc(
  "Satıcı: {mağaza_unvanı} ({mağaza_adı}). Adres: {adres}.",
  "Telefon: {telefon}. E-posta: {e_posta}. KEP: {kep}. MERSİS: {mersis}.",
  "İnternet sitesi: {alan_adı}. Cayma süresi {iade_süresi} gün."
)

/** The legal texts print the shop's details as a reader reads them (adr/0041 §1). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("prints the phone, the site, the address and an order's money and date in reading form", async () => {
      const container = getContainer()
      const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.saveSection(
        "store",
        { contact_email: "destek@ornekbicak.com", contact_phone: "0534 255 11 45" },
        null
      )
      await settings.saveSection(
        "legal",
        {
          company_title: "Örnek Bıçakçılık Ltd. Şti.",
          mersis: "0123456789012345",
          address: "Caferağa Mah. Moda Cad. No: 12\tD: 3 Kadıköy / İstanbul",
          kep: "ornekbicak@hs01.kep.tr",
        },
        null
      )
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const post = <T>(url: string, body: unknown = {}) =>
        settle(http.post<T & { message?: string }>(url, body, { headers: owner.headers }))
      const read = () =>
        settle(
          http.get<{ document: { html: string } }>("/store/legal/return_policy", {
            headers: store.headers,
          })
        )

      await post("/admin/legal-documents/return_policy/draft", {
        title: "İade politikası",
        body: SHOP_TEXT,
      })
      const published = await post("/admin/legal-documents/return_policy/publish")
      // A deployed shop with no domain yet names none
      const noDomain = await read()
      await settings.saveSection("seo", { canonical_host: "www.ornekbicak.com" }, null)
      const shown = await read()
      const preview = await post<{ html: string }>(
        "/admin/legal-documents/distance_sales/preview",
        {
          body: doc(
            "Alıcı telefonu: {alıcı_telefon}. Teslimat adresi: {teslimat_adresi}.",
            "Sipariş tarihi: {sipariş_tarihi}. Toplam: {toplam}. İndirim: {indirim}.",
            "{sipariş_kalemleri}"
          ),
        }
      )

      expect(published.status).toBe(200)
      expect(noDomain.status).toBe(200)
      expect(noDomain.data.document.html).toContain("İnternet sitesi: —.")
      expect(shown.status).toBe(200)
      const { html } = shown.data.document
      expect(html).toContain("Adres: Caferağa Mah. Moda Cad. No: 12 D: 3 Kadıköy / İstanbul.")
      expect(html).toContain(
        "Telefon: 0534 255 11 45. E-posta: destek@ornekbicak.com. KEP: ornekbicak@hs01.kep.tr. MERSİS: 0123456789012345."
      )
      expect(html).toContain("İnternet sitesi: www.ornekbicak.com. Cayma süresi 14 gün.")
      expect(html).not.toMatch(/\+90|https?:\/\//u)
      // The made-up order of a contract's preview reads as a real one will
      expect(preview.status).toBe(200)
      expect(preview.data.html).toContain(
        "Alıcı telefonu: 0532 000 00 00. Teslimat adresi: Örnek Mah., Örnek Sok. No: 1, 34710 Kadıköy / İstanbul."
      )
      expect(preview.data.html).toContain(
        "Sipariş tarihi: 1 Ocak 2026 10:30. Toplam: 550,00 TL. İndirim: 0,00 TL."
      )
      expect(preview.data.html).toContain("500,00 TL")
      expect(preview.data.html).not.toContain("₺")
    })
  },
})
