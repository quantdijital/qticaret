import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Doc {
  type: "doc"
  content: unknown[]
}

interface Version {
  id: string
  version: number
  title: string
  body: Doc
  updated_at: string
  published_at: string | null
}

interface AuditRow {
  action: string
  resource_id: string | null
  outcome: number
  changes: { fields?: string[]; diff?: Record<string, { before?: unknown; after?: unknown }> }
}

const doc = (...texts: string[]): Doc => ({
  type: "doc",
  content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
})

const RESET = "POST /admin/legal-documents/:kind/draft/reset"
const DISCARD = "DELETE /admin/legal-documents/:kind/draft"

/**
 * The owner, 2026-11-04: a legal text's draft dropped (the published text
 * stays in force) or started again, from the platform's starter or a copy
 * of the published text; each recorded in the audit log.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("starts a draft from the starter or the published text, drops it, and records each", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const as = (headers: Record<string, string>) => ({
        get: <T>(url: string) => settle(http.get<T & { message?: string }>(url, { headers })),
        post: <T>(url: string, body: unknown = {}) =>
          settle(http.post<T & { message?: string }>(url, body, { headers })),
        delete: <T>(url: string) => settle(http.delete<T & { message?: string }>(url, { headers })),
      })
      const admin = as(owner.headers)
      const base = "/admin/legal-documents/cookie_policy"
      const reset = (source: string) =>
        admin.post<{ draft: Version }>(`${base}/draft/reset`, { source })
      const detail = async () =>
        (await admin.get<{ document: { published: Version | null; draft: Version | null } }>(base))
          .data.document

      const starter = await admin.get<{ starter: { title: string; body: Doc } }>(`${base}/starter`)
      const nothingToCopy = await reset("published")
      const nothingToDrop = await admin.delete(`${base}/draft`)
      const fromStarter = await reset("starter")
      // The owner writes their own text over it and publishes it as v1
      await admin.post(`${base}/draft`, { title: "Çerez politikası", body: doc("İlk metin.") })
      await admin.post(`${base}/publish`)
      const fromPublished = await reset("published")
      // Edited, then started again from the starter: the same draft, the starter's text
      await admin.post(`${base}/draft`, { title: "Çerez politikası", body: doc("Değişti.") })
      const backToStarter = await reset("starter")
      const dropped = await admin.delete<{ id: string; deleted: boolean }>(`${base}/draft`)
      const afterDrop = await detail()
      const shown = await settle(
        http.get<{ document: { version: number; html: string } }>("/store/legal/cookie_policy", {
          headers: store.headers,
        })
      )
      const unknownSource = await admin.post(`${base}/draft/reset`, { source: "blank" })
      const extraField = await admin.post(`${base}/draft/reset`, { source: "starter", body: {} })
      const unknownKind = await admin.post("/admin/legal-documents/uydurma/draft/reset", {
        source: "starter",
      })
      const audit = await eventually(
        () =>
          admin.get<{ audit_entries: AuditRow[] }>(
            "/admin/audit-log?resource_type=legal_document&resource_id=cookie_policy&kind=mutation&limit=100"
          ),
        (answer) =>
          answer.data.audit_entries.filter((entry) => [RESET, DISCARD].includes(entry.action))
            .length >= 8
      )

      expect(nothingToCopy.status).toBe(409)
      expect(nothingToCopy.data.message).toBe("legal.nothing_published")
      expect(nothingToDrop.status).toBe(404)
      expect(nothingToDrop.data.message).toBe("legal.draft_missing")

      expect(fromStarter.status).toBe(200)
      expect(fromStarter.data.draft).toMatchObject({
        version: 1,
        title: starter.data.starter.title,
        body: starter.data.starter.body,
        published_at: null,
      })

      // A copy of v1 as the draft v2, beside the published v1
      expect(fromPublished.status).toBe(200)
      expect(fromPublished.data.draft).toMatchObject({
        version: 2,
        title: "Çerez politikası",
        body: doc("İlk metin."),
      })
      expect(backToStarter.status).toBe(200)
      expect(backToStarter.data.draft.id).toBe(fromPublished.data.draft.id)
      expect(backToStarter.data.draft).toMatchObject({
        version: 2,
        body: starter.data.starter.body,
      })

      expect(dropped.status).toBe(200)
      expect(dropped.data).toMatchObject({ id: fromPublished.data.draft.id, deleted: true })
      expect(afterDrop.draft).toBeNull()
      expect(afterDrop.published).toMatchObject({ version: 1, body: doc("İlk metin.") })
      expect(shown.data.document.version).toBe(1)
      expect(shown.data.document.html).toContain("İlk metin.")

      expect(unknownSource.status).toBe(400)
      expect(extraField.status).toBe(400)
      expect(unknownKind.status).toBe(404)

      // Each reset and drop, refused ones too, by its kind; what the draft was and became
      const rows = audit.data.audit_entries.filter((entry) =>
        [RESET, DISCARD].includes(entry.action)
      )
      expect(rows.map(({ action, outcome }) => `${action} ${String(outcome)}`).sort()).toEqual(
        [
          `${RESET} 409`,
          `${DISCARD} 404`,
          `${RESET} 200`,
          `${RESET} 200`,
          `${RESET} 200`,
          `${DISCARD} 200`,
          `${RESET} 400`,
          `${RESET} 400`,
        ].sort()
      )
      expect(rows.every((row) => row.resource_id === "cookie_policy")).toBe(true)
      expect(rows.find((row) => row.outcome === 409)?.changes.fields).toEqual(["source"])
      const hash: unknown = expect.stringMatching(/^[0-9a-f]{64}$/)
      expect(rows.filter((row) => row.outcome === 200).map((row) => row.changes.diff)).toEqual(
        expect.arrayContaining([
          // From the starter, no draft before; a copy of v1; the starter over the edited v2
          expect.objectContaining({ draft_version: { after: 1 }, draft_hash: { after: hash } }),
          expect.objectContaining({ draft_version: { after: 2 } }),
          {
            draft_title: { before: "Çerez politikası", after: starter.data.starter.title },
            draft_hash: { before: hash, after: hash },
          },
          // Dropped: no draft after it
          expect.objectContaining({ draft_version: { before: 2 } }),
        ])
      )
    })

    it("leaves dropping and starting a draft again to the owner and admin", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const admin = await createAdminUser(http, container, "admin")
      const ops = await createAdminUser(http, container, "operations")
      const base = "/admin/legal-documents/membership"
      const reset = (headers: Record<string, string>) =>
        settle(http.post(`${base}/draft/reset`, { source: "starter" }, { headers }))
      const drop = (headers: Record<string, string>) =>
        settle(http.delete(`${base}/draft`, { headers }))

      const byOwner = await reset(owner.headers)
      const opsReset = await reset(ops.headers)
      const opsDrop = await drop(ops.headers)
      const opsRead = await settle(http.get(base, { headers: ops.headers }))
      const byAdmin = await reset(admin.headers)
      const adminDrop = await drop(admin.headers)

      expect(byOwner.status).toBe(200)
      expect([opsReset.status, opsDrop.status]).toEqual([403, 403])
      expect(opsRead.status).toBe(200)
      expect(byAdmin.status).toBe(200)
      expect(adminDrop.status).toBe(200)
    })
  },
})
