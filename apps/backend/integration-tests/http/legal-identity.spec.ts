import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeVkn, seededRandom } from "@qticaret/testing"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Entry {
  key: string
  done: boolean
}

/** F13.9 (adr/0041 §3; KK4): the shop's legal identity, its gaps shown, its details public. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("warns while the identity lacks a detail, then shows it in the footer, the structured data and the texts", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const admin = <T>(method: "get" | "post", url: string, body?: unknown) =>
        settle(
          method === "get"
            ? http.get<T & { message?: string }>(url, { headers: owner.headers })
            : http.post<T & { message?: string }>(url, body, { headers: owner.headers })
        )
      const missing = async () =>
        (await admin<{ legal_identity_missing: number }>("get", "/admin/dashboard/tasks")).data
          .legal_identity_missing
      const identityItem = async () =>
        (await admin<{ items: Entry[] }>("get", "/admin/seo/setup")).data.items.find(
          (item) => item.key === "legal_identity"
        )
      const vkn = fakeVkn(seededRandom(7))

      const before = await missing()
      const badMersis = await admin("post", "/admin/platform-settings/legal", { mersis: "123" })
      const badTaxNumber = await admin("post", "/admin/platform-settings/legal", {
        tax_number: "1234567891",
      })
      const saved = await admin("post", "/admin/platform-settings/legal", {
        company_title: "Örnek Ticaret Ltd. Şti.",
        mersis: "0123 4567 8901 2345",
        tax_office: "Kadıköy",
        tax_number: vkn,
        address: "Örnek Mah. 1. Sok. No: 2, Kadıköy / İstanbul",
        kep: "Ornek@HS01.kep.tr",
        same_as: ["https://instagram.com/ornek"],
      })
      const stillMissing = await missing()
      await admin("post", "/admin/platform-settings/store", {
        contact_email: "destek@ornek.com",
        whatsapp_phone: "0532 123 45 67",
        map_url: "https://maps.app.goo.gl/ornek",
        opening_hours: [
          { day: 1, opens: "09:00", closes: "18:00" },
          { day: 6, opens: "10:00", closes: "14:00" },
        ],
      })
      await admin("post", "/admin/platform-settings/seo", { canonical_host: "ornek.com" })
      const after = await missing()
      const footer = await settle(
        http.get<{ identity: Record<string, unknown> }>("/store/legal-identity", {
          headers: store.headers,
        })
      )
      const site = await settle(
        http.get<{ jsonLd: Record<string, unknown>[] }>("/store/seo/site", {
          headers: store.headers,
        })
      )
      const preview = await admin<{ html: string }>(
        "post",
        "/admin/legal-documents/privacy_notice/preview",
        {
          body: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "{mağaza_unvanı}, {vkn}" }] },
            ],
          },
        }
      )

      // Title, address, tax office, tax number and a way to reach the shop
      expect(before).toBe(5)
      expect(badMersis.status).toBe(400)
      expect(badMersis.data.message).toBe("platform_settings.mersis_invalid")
      expect(badTaxNumber.status).toBe(400)
      expect(saved.status).toBe(200)
      expect(stillMissing).toBe(1)
      expect(after).toBe(0)
      expect(await identityItem()).toMatchObject({ done: true })
      expect(footer.data.identity).toMatchObject({
        company_title: "Örnek Ticaret Ltd. Şti.",
        mersis: "0123456789012345",
        tax_number: vkn,
        kep: "ornek@hs01.kep.tr",
        email: "destek@ornek.com",
        // How the shop is reached, from its store details (adr/0048)
        whatsapp: "+905321234567",
        map_url: "https://maps.app.goo.gl/ornek",
        opening_hours: [
          { day: 1, opens: "09:00", closes: "18:00" },
          { day: 6, opens: "10:00", closes: "14:00" },
        ],
      })
      expect(site.data.jsonLd[0]).toMatchObject({
        "@type": "OnlineStore",
        legalName: "Örnek Ticaret Ltd. Şti.",
        taxID: vkn,
        address: { "@type": "PostalAddress", addressCountry: "TR" },
        sameAs: ["https://instagram.com/ornek"],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: "destek@ornek.com",
          hoursAvailable: [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: "https://schema.org/Monday",
              opens: "09:00",
              closes: "18:00",
            },
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: "https://schema.org/Saturday",
              opens: "10:00",
              closes: "14:00",
            },
          ],
        },
      })
      expect(preview.data.html).toContain(`Örnek Ticaret Ltd. Şti., ${vkn}`)
    })

    it("shows the licence line the shop names once it has a name and a number (adr/0076 §12)", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const save = (body: Record<string, unknown>) =>
        settle(http.post("/admin/platform-settings/legal", body, { headers: owner.headers }))
      const shown = async () =>
        (
          await settle(
            http.get<{ identity: { document: unknown } }>("/store/legal-identity", {
              headers: store.headers,
            })
          )
        ).data.identity.document

      expect(await shown()).toBeNull()
      // A name alone says nothing
      expect((await save({ document_name: "TÜRSAB belge no" })).status).toBe(200)
      expect(await shown()).toBeNull()
      const bad = await save({ document_number: "12\u0007" })
      expect(bad.status).toBe(400)
      expect((await save({ document_number: " 12345 ", document_holder: "" })).status).toBe(200)
      expect(await shown()).toEqual({ name: "TÜRSAB belge no", number: "12345", holder: null })
      await save({ document_holder: "Örnek Turizm Seyahat Acentası" })
      expect(await shown()).toEqual({
        name: "TÜRSAB belge no",
        number: "12345",
        holder: "Örnek Turizm Seyahat Acentası",
      })
    })
  },
})
