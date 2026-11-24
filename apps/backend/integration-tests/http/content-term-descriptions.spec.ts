import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { ContentDoc } from "../../src/lib/content/doc"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Term {
  id: string
  kind: "category" | "tag"
  description: string | null
  description_doc: ContentDoc | null
}

interface Answer {
  type: string
  seo?: { description: string } | null
}

/** A heading and a paragraph, as the panel's editor sends a pasted text. */
const richDoc = (heading: string, text: string) => ({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: heading }] },
    { type: "paragraph", content: [{ type: "text", text, marks: [{ type: "bold" }] }] },
  ],
})

const body = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

/**
 * adr/0075 Ek 2026-11-24: a blog category's or tag's description as a
 * listing's: a checked document with its plain text written beside it,
 * plain text still taken (and the document dropped), the storefront's
 * HTML from its own route, the meta description from the plain text.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, data: unknown) =>
      settle(http.post<T & { message?: string }>(url, data, { headers: admin.headers }))
    const term = (data: Record<string, unknown>, id?: string) =>
      post<{ term: Term }>(id ? `/admin/content/terms/${id}` : "/admin/content/terms", data)
    const storeGet = <T>(url: string) => settle(http.get<T>(url, { headers: store.headers }))
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    afterEach(async () => {
      await settings().saveSection("seo", { canonical_host: null }, null)
    })

    it("keeps a document and its plain text; plain text drops it; both at once is refused", async () => {
      const made = await term({
        kind: "category",
        name: "Rehberler",
        description_doc: richDoc("Bakım", "Kuru tutun."),
      })
      expect(made.status).toBe(201)
      expect(made.data.term.description_doc).toEqual(richDoc("Bakım", "Kuru tutun."))
      expect(made.data.term.description).toContain("Kuru tutun.")
      const id = made.data.term.id

      const both = await term({ description: "Düz", description_doc: body("Belge") }, id)
      expect([both.status, both.data.message]).toEqual([400, "catalog.description_one_of"])
      const picture = await term(
        {
          description_doc: {
            type: "doc",
            content: [{ type: "image", attrs: { src: "https://cdn.example.com/a.jpg", alt: "" } }],
          },
        },
        id
      )
      expect(picture.status).toBe(400)

      const plain = await term({ description: "Düz metin." }, id)
      expect(plain.data.term).toMatchObject({ description: "Düz metin.", description_doc: null })
      const cleared = await term(
        { description_doc: { type: "doc", content: [{ type: "paragraph" }] } },
        id
      )
      expect(cleared.data.term).toMatchObject({ description: null, description_doc: null })
    })

    it("serves a live term's text as HTML for its archive's foot, the meta description from its text", async () => {
      const made = (
        await term({ kind: "tag", name: "Çelik", description_doc: richDoc("Çelik", "Sert.") })
      ).data.term
      // No live post: not listed, not served
      const hidden = await storeGet(`/store/content/terms/${made.id}/description`)
      expect(hidden.status).toBe(404)

      await post("/admin/content", {
        kind: "post",
        title: "Çelik türleri",
        status: "published",
        body: body("Çelik türleri"),
        tag_ids: [made.id],
      })
      const shown = await storeGet<{ term_id: string; description_html: string | null }>(
        `/store/content/terms/${made.id}/description`
      )
      expect(shown.status).toBe(200)
      expect(shown.data.term_id).toBe(made.id)
      expect(shown.data.description_html).toContain("<h2")
      expect(shown.data.description_html).toContain("<strong>Sert.</strong>")
      expect(shown.headers["cache-control"]).toContain("max-age=60")
      expect((await storeGet(`/store/content/terms/cterm_0NOPE/description`)).status).toBe(404)
      expect((await storeGet(`/store/content/terms/${made.id}/description?x=1`)).status).toBe(400)

      // The meta description falls back to the plain text, as before
      const resolved = await storeGet<Answer>(
        `/store/seo/resolve?path=${encodeURIComponent("/blog/etiket/celik")}`
      )
      expect(resolved.data.seo?.description).toContain("Sert.")

      // Plain text only: no HTML, the list's `description` is shown
      await term({ description: "Yalın." }, made.id)
      const bare = await storeGet<{ description_html: string | null }>(
        `/store/content/terms/${made.id}/description`
      )
      expect(bare.data.description_html).toBeNull()
    })
  },
})
