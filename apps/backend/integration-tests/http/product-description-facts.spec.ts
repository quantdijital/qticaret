import { randomUUID } from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { serverErrorMessage } from "../../src/lib/errors/messages"
import { descriptionOf } from "../../src/lib/migration/description"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { createStorefront, createTestProduct } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(300 * 1000)

interface Template {
  id: string
  definitions: { id: string; key: string; label: string; aliases: string[] | null }[]
}

interface PreviewRow {
  label: string
  value: string
  status: string
  field?: string
  value_parsed?: unknown
}

interface Preview {
  products: { id: string; template_id: string | null; rows: PreviewRow[] }[]
  suggestions: { template_id: string; fields: { label: string; type: string; key: string }[] }[]
  counts: Record<string, number>
  suggested_template_id: string | null
  message?: string
}

// Sector-neutral: a template of four fields, one known by another name too
const DEFINITIONS = [
  { key: "uzunluk", label: "Uzunluk", type: "number", unit: "cm" },
  {
    key: "renk",
    label: "Renk",
    type: "select",
    options: [
      { value: "siyah", label: "Siyah" },
      { value: "beyaz", label: "Beyaz" },
    ],
  },
  { key: "mensei", label: "Menşei", type: "text", aliases: ["Üretim yeri"] },
  { key: "kullanim", label: "Kullanım", type: "text" },
]

const BODY = `
  <h2>Teknik Özellikler</h2>
  <table>
    <tr><th>Özellik</th><th>Değer</th></tr>
    <tr><td>Uzunluk</td><td>220 mm</td></tr>
    <tr><td>RENK</td><td>Siyah</td></tr>
    <tr><td>Üretim Yeri</td><td>Türkiye</td></tr>
    <tr><td>Garanti</td><td>2 yıl</td></tr>
    <tr><td>Kasa Rengi</td><td>Gri</td></tr>
  </table>`

/** adr/0013 Ek 2026-11-05: the facts in products' descriptions, previewed and written. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let storefront: Storefront
    const sheets = sheetClient(http, getContainer, () => admin.headers)
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    const createTemplate = async () =>
      (
        await http.post<{ attribute_template: Template }>(
          "/admin/attribute-templates",
          { name: "Örnek", handle: `ornek-${randomUUID()}`, definitions: DEFINITIONS },
          { headers: admin.headers }
        )
      ).data.attribute_template

    async function product(html: string, templateId: string | null): Promise<string> {
      const variantId = await createTestProduct(getContainer(), storefront.salesChannelId, {
        handle: `urun-${randomUUID()}`,
        price: 1000,
      })
      const { data } = await query().graph({
        entity: "product_variant",
        fields: ["product_id"],
        filters: { id: variantId },
      })
      const id = (data[0] as { product_id: string }).product_id
      await http.post(
        `/admin/products/${id}/catalog`,
        { description_doc: descriptionOf(html).doc },
        { headers: admin.headers }
      )
      if (templateId) {
        await http.post(
          `/admin/products/${id}/attributes`,
          { template_id: templateId, values: {} },
          { headers: admin.headers }
        )
      }
      return id
    }

    const preview = (body: unknown) =>
      settle(
        http.post<Preview>("/admin/description-facts/preview", body, { headers: admin.headers })
      )

    async function apply(input: Record<string, unknown>): Promise<SheetJob> {
      const queued = await settle(
        http.post<{ async_job: SheetJob }>(
          "/admin/async-jobs",
          { type: "catalog.description_facts", input },
          { headers: admin.headers }
        )
      )
      expect(queued.status).toBe(202)
      return sheets.settled(queued.data.async_job.id)
    }

    const attributesOf = async (id: string) =>
      (
        await http.get<{ template: { id: string } | null; values: Record<string, unknown> }>(
          `/admin/products/${id}/attributes`,
          { headers: admin.headers }
        )
      ).data

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      storefront = await createStorefront(getContainer())
    })

    it("previews each row's field and value, and the labels no field names", async () => {
      const template = await createTemplate()
      const own = await product(BODY, template.id)
      const bare = await product("<ul><li>Renk: Beyaz</li><li>Boy: 40 cm</li></ul>", null)
      await http.post(
        `/admin/products/${own}/attributes`,
        { template_id: template.id, values: { renk: "beyaz" } },
        { headers: admin.headers }
      )
      const { status, data } = await preview({ product_ids: [own, bare] })
      expect(status).toBe(200)
      const [first, second] = data.products
      expect(
        first?.rows.map((row) => [row.label, row.status, row.field ?? null, row.value_parsed])
      ).toEqual([
        ["Uzunluk", "ready", "uzunluk", 22],
        ["RENK", "filled", "renk", "siyah"],
        ["Üretim Yeri", "ready", "mensei", "Türkiye"],
        ["Garanti", "unmatched", null, undefined],
        ["Kasa Rengi", "unmatched", null, undefined],
      ])
      // Without a template its rows name no field; the template its facts fit is suggested
      expect(second).toMatchObject({ id: bare, template_id: null })
      expect(data.suggested_template_id).toBe(template.id)
      expect(data.counts).toMatchObject({ products: 2, with_facts: 2, no_template: 1, ready: 2 })
      expect(data.suggestions).toEqual([
        {
          template_id: template.id,
          fields: [
            expect.objectContaining({
              label: "Garanti",
              type: "number",
              unit: "yıl",
              key: "garanti",
            }),
            expect.objectContaining({ label: "Kasa Rengi", type: "text", key: "kasa_rengi" }),
          ],
        },
      ])
      // A template the shop does not have is refused, nothing is read
      const unknown = await preview({ product_ids: [own], template_id: "atpl_yok" })
      expect(unknown.status).toBe(400)
      expect(unknown.data.message).toBe("description_facts.template_unknown")
    })

    it("writes the values, adds the fields and names ticked, keeps what the product holds", async () => {
      const template = await createTemplate()
      const own = await product(BODY, template.id)
      const bare = await product("<ul><li>Renk: Beyaz</li><li>Kullanım: Günlük</li></ul>", null)
      await http.post(
        `/admin/products/${own}/attributes`,
        { template_id: template.id, values: { renk: "beyaz" } },
        { headers: admin.headers }
      )
      const docBefore = (
        await http.get<{ description_doc: unknown }>(`/admin/products/${own}/catalog`, {
          headers: admin.headers,
        })
      ).data.description_doc
      const job = await apply({
        product_ids: [own, bare, "prod_yok"],
        template_id: template.id,
        fields: [{ template_id: template.id, label: "Garanti", type: "text" }],
        aliases: [{ template_id: template.id, key: "renk", label: "Kasa Rengi" }],
      })
      expect(job.status).toBe("succeeded")
      expect(job.result_summary).toMatchObject({
        products: 3,
        changed: 2,
        skipped: 1,
        fields_added: 1,
        aliases_added: 1,
      })
      // The colour the product holds stays; "Kasa Rengi" now names the colour, at odds with it
      expect(await attributesOf(own)).toMatchObject({
        template: { id: template.id },
        values: { uzunluk: 22, renk: "beyaz", mensei: "Türkiye", garanti: "2 yıl" },
      })
      expect(await attributesOf(bare)).toMatchObject({
        template: { id: template.id },
        values: { renk: "beyaz", kullanim: "Günlük" },
      })
      const saved = (
        await http.get<{ attribute_template: Template }>(
          `/admin/attribute-templates/${template.id}`,
          { headers: admin.headers }
        )
      ).data.attribute_template
      expect(saved.definitions.find((each) => each.key === "renk")?.aliases).toEqual(["Kasa Rengi"])
      expect(saved.definitions.map((each) => each.key)).toContain("garanti")
      // The description is never touched
      expect(
        (
          await http.get<{ description_doc: unknown }>(`/admin/products/${own}/catalog`, {
            headers: admin.headers,
          })
        ).data.description_doc
      ).toEqual(docBefore)
      const report = await sheets.fileOf(job)
      expect(report.find((cells) => cells[0] === "prod_yok")?.[4]).toBe(
        serverErrorMessage("bulk_edit.product_missing", "tr")
      )
      // In the audit log: the run, the template it changed and each product it wrote
      const audit = getContainer().resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const runEntries = await audit.listAuditEntries(
        { resource_id: job.id },
        { select: ["action"] }
      )
      expect(runEntries.map((entry) => entry.action).sort()).toEqual([
        "catalog.description_facts_finished",
        "catalog.description_facts_started",
        "catalog.description_facts_template",
      ])
      const [entry] = await audit.listAuditEntries(
        { resource_id: own, action: "catalog.description_facts_product" },
        { select: ["changes"] }
      )
      expect(entry?.changes).toMatchObject({
        job_id: job.id,
        after: { uzunluk: 22, mensei: "Türkiye", garanti: "2 yıl" },
      })

      // Asked to write over, the description's colour replaces the product's ("Gri" is no option)
      const again = await apply({ product_ids: [own], overwrite: true })
      expect(again.result_summary).toMatchObject({ changed: 1, values: 1 })
      expect((await attributesOf(own)).values).toMatchObject({ renk: "siyah", uzunluk: 22 })
    })

    it("writes over the product's value only when asked", async () => {
      const template = await createTemplate()
      const id = await product("<h3>Özellikler</h3><p>Renk: Siyah</p>", template.id)
      await http.post(
        `/admin/products/${id}/attributes`,
        { template_id: template.id, values: { renk: "beyaz" } },
        { headers: admin.headers }
      )
      const kept = await apply({ product_ids: [id] })
      expect(kept.result_summary).toMatchObject({ changed: 0, unchanged: 1 })
      expect((await attributesOf(id)).values).toMatchObject({ renk: "beyaz" })
      const over = await apply({ product_ids: [id], overwrite: true })
      expect(over.result_summary).toMatchObject({ changed: 1, values: 1 })
      expect((await attributesOf(id)).values).toMatchObject({ renk: "siyah" })
    })

    it("names a required field the description leaves empty, and the product stays as it was", async () => {
      const { data } = await http.post<{ attribute_template: Template }>(
        "/admin/attribute-templates",
        {
          name: "Zorunlu",
          handle: `zorunlu-${randomUUID()}`,
          definitions: [
            { key: "renk", label: "Renk", type: "text" },
            { key: "mensei", label: "Menşei", type: "text", is_required: true },
          ],
        },
        { headers: admin.headers }
      )
      const id = await product("<ul><li>Renk: Siyah</li><li>Boy: 40 cm</li></ul>", null)
      const job = await apply({ product_ids: [id], template_id: data.attribute_template.id })
      expect(job.result_summary).toMatchObject({ skipped: 1, changed: 0 })
      const report = await sheets.fileOf(job)
      expect(report.find((cells) => cells[2] === "Atlandı")?.[4]).toBe(
        serverErrorMessage("description_facts.required_missing", "tr", { fields: "Menşei" })
      )
      expect(await attributesOf(id)).toMatchObject({ template: null, values: {} })
    })
  },
})
