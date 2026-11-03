import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Doc {
  type: "doc"
  content: unknown[]
}

const doc = (...texts: string[]): Doc => ({
  type: "doc",
  content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
})

/** F13.1 (adr/0041 §1): the shop's legal texts, in versions never changed once published. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves a draft, publishes it, keeps each published version and shows the storefront the one in force", async () => {
      const container = getContainer()
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("store", { contact_email: "destek@magaza.example" }, null)
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const as = (headers: Record<string, string>) => ({
        get: <T>(url: string) => settle(http.get<T & { message?: string }>(url, { headers })),
        post: <T>(url: string, body: unknown = {}) =>
          settle(http.post<T & { message?: string }>(url, body, { headers })),
        delete: <T>(url: string) => settle(http.delete<T>(url, { headers })),
      })
      const admin = as(owner.headers)
      const storefront = as(store.headers)
      const base = "/admin/legal-documents/return_policy"

      const starter = await admin.get<{ starter: { title: string; body: Doc } }>(`${base}/starter`)
      const unknownToken = await admin.post(`${base}/draft`, {
        title: "İade",
        body: doc("Süre: {iade_süresi}, alıcı: {alıcı_adı}"),
      })
      const notYet = await storefront.get("/store/legal/return_policy")
      const first = await admin.post<{ draft: { id: string; version: number } }>(`${base}/draft`, {
        title: "İade politikası",
        body: doc("İade süresi {iade_süresi} gün. Bize {e_posta} adresinden yazın."),
      })
      const published = await admin.post<{ published: { version: number; body_hash: string } }>(
        `${base}/publish`
      )
      const shown = await storefront.get<{ document: { version: number; html: string } }>(
        "/store/legal/return_policy"
      )
      // A second version: a draft beside the published text, then in force
      const second = await admin.post<{ draft: { version: number } }>(`${base}/draft`, {
        title: "İade politikası",
        body: doc("Yeni metin: {iade_süresi} gün."),
      })
      const stillFirst = await storefront.get<{ document: { version: number } }>(
        "/store/legal/return_policy"
      )
      await admin.post(`${base}/publish`)
      const detail = await admin.get<{
        document: {
          published: { version: number }
          draft: null
          history: { version: number; status: string }[]
        }
      }>(base)
      const overview = await admin.get<{
        documents: { kind: string; published: { version: number } | null }[]
      }>("/admin/legal-documents")
      const noDraft = await admin.post(`${base}/publish`)
      const unknownKind = await admin.get("/admin/legal-documents/uydurma")

      expect(starter.status).toBe(200)
      expect(JSON.stringify(starter.data.starter.body)).toContain("avukat")
      expect(unknownToken.status).toBe(400)
      expect(unknownToken.data.message).toBe("legal.token_invalid")
      expect(notYet.status).toBe(404)
      expect(first.data.draft.version).toBe(1)
      expect(published.data.published).toMatchObject({ version: 1 })
      expect(published.data.published.body_hash).toMatch(/^[0-9a-f]{64}$/)
      expect(shown.data.document.version).toBe(1)
      expect(shown.data.document.html).toContain("İade süresi 14 gün")
      expect(shown.data.document.html).toContain("destek@magaza.example")
      expect(second.data.draft.version).toBe(2)
      expect(stillFirst.data.document.version).toBe(1)
      expect(detail.data.document.published.version).toBe(2)
      expect(detail.data.document.draft).toBeNull()
      expect(detail.data.document.history.map(({ version, status }) => [version, status])).toEqual([
        [2, "published"],
        [1, "retired"],
      ])
      expect(
        overview.data.documents.find((row) => row.kind === "return_policy")?.published
      ).toMatchObject({ version: 2 })
      expect(noDraft.status).toBe(404)
      expect(unknownKind.status).toBe(404)
    })

    it("keeps a draft with the starter's note a draft, and publishes it once the note is deleted", async () => {
      const owner = await createAdminUser(http, getContainer())
      const post = <T>(url: string, body: unknown = {}) =>
        settle(http.post<T & { message?: string }>(url, body, { headers: owner.headers }))
      const base = "/admin/legal-documents/privacy_notice"
      const starter = await settle(
        http.get<{ starter: { title: string; body: Doc } }>(`${base}/starter`, {
          headers: owner.headers,
        })
      )
      const { title, body } = starter.data.starter

      const saved = await post(`${base}/draft`, { title, body })
      const refused = await post(`${base}/publish`)
      const still = await settle(
        http.get<{ document: { draft: { version: number } | null; published: unknown } }>(base, {
          headers: owner.headers,
        })
      )
      // The owner deletes the note (the starter's first block) once a lawyer has read it
      await post(`${base}/draft`, { title, body: { ...body, content: body.content.slice(1) } })
      const published = await post<{ published: { version: number } }>(`${base}/publish`)

      expect(saved.status).toBe(200)
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("legal.draft_note_present")
      expect(still.data.document.published).toBeNull()
      expect(still.data.document.draft?.version).toBe(1)
      expect(published.status).toBe(200)
      expect(published.data.published.version).toBe(1)
    })

    it("previews a contract with a made-up order, and leaves editing to the owner and admin", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const ops = await createAdminUser(http, container, "operations")
      const base = "/admin/legal-documents/distance_sales"
      const body = doc(
        "Alıcı: {alıcı_adı}",
        "{sipariş_kalemleri}",
        "Satıcı unvanı: {mağaza_unvanı}"
      )

      const preview = await settle(
        http.post<{ html: string }>(`${base}/preview`, { body }, { headers: owner.headers })
      )
      const opsSave = await settle(
        http.post(`${base}/draft`, { title: "Sözleşme", body }, { headers: ops.headers })
      )
      const opsRead = await settle(http.get("/admin/legal-documents", { headers: ops.headers }))
      const saved = await settle(
        http.post(`${base}/draft`, { title: "Sözleşme", body }, { headers: owner.headers })
      )
      const dropped = await settle(http.delete(`${base}/draft`, { headers: owner.headers }))
      // A dropped draft's number is taken again: the first text published is still v1
      const again = await settle(
        http.post<{ draft: { version: number } }>(
          `${base}/draft`,
          { title: "Sözleşme", body },
          { headers: owner.headers }
        )
      )

      expect(preview.status).toBe(200)
      expect(preview.data.html).toContain("Ayşe Yılmaz")
      expect(preview.data.html).toContain("<table")
      // The legal identity comes with its settings (F13.9): until then a dash
      expect(preview.data.html).toContain("Satıcı unvanı: —")
      expect(opsSave.status).toBe(403)
      expect(opsRead.status).toBe(200)
      expect(saved.status).toBe(200)
      expect(dropped.status).toBe(200)
      expect(again.data.draft.version).toBe(1)
    })
  },
})
