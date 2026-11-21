import { randomUUID } from "node:crypto"
import { rmSync } from "node:fs"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import sharp from "sharp"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, aiRecords, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

const FILE_NAME = "ozellik-doldurma-deneme.png"
// A hidden attribute's value: never sent, as no price or person is
const SUPPLIER = "TDR-99812"

interface Answer {
  suggestion?: {
    id: string
    text: string | null
    attributes?: { values: Record<string, unknown>; dropped: number } | null
  }
  message?: string
  problems?: string[]
}

const picture = () =>
  sharp({ create: { width: 600, height: 600, channels: 3, background: { r: 40, g: 90, b: 200 } } })
    .png()
    .toBuffer()

/** The code the data block names an attribute by (`{"label":"a2","value":"Hacim · sayı…"}`). */
function codeOf(data: string, label: string): string {
  const block = JSON.parse(data) as {
    data: { attribute_choices?: { label: string; value: string }[] }
  }
  return (
    block.data.attribute_choices?.find((each) => each.value.startsWith(`${label} ·`))?.label ??
    "missing"
  )
}

/**
 * adr/0074 §5 madde 3: values for a product's empty public attributes, on
 * the fake service. Only empty, public attributes of the product's saved
 * template are named, by code; a value that does not fit or a code not in
 * the list is dropped, the rest kept; an answer with none is refused.
 * The product's first picture goes when the service sees one. Nothing is
 * written; only owner and admin ask; the JSON task takes no guidance.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    const key = `test-key-${fakeSecret()}`
    const ask = (headers: Record<string, string>, productId: string) =>
      settle(
        http.post<Answer>(
          "/admin/ai/suggestions",
          { task: "product_attributes", entity_type: "product", entity_id: productId },
          { headers }
        )
      )
    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T>(url, body, { headers: owner.headers }))
    const records = () => aiRecords(getContainer())

    managedForThisFile()

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
      await connectFake(http, owner.headers, key)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    afterAll(() => {
      for (const path of filesNamed(/ozellik-doldurma-deneme/)) {
        rmSync(path, { force: true })
      }
    })

    function answering(text: (request: TextRequest) => string): TextRequest[] {
      const seen: TextRequest[] = []
      jest.spyOn(fakeTextConnector, "complete").mockImplementation((request) => {
        seen.push(request)
        return Promise.resolve({
          text: text(request),
          usage: { inputTokens: 10, outputTokens: 10 },
        })
      })
      return seen
    }

    /** A product on a template: one public field filled, one hidden filled, three empty. */
    async function shop(values: Record<string, unknown> = {}) {
      const product = await aiProduct(getContainer(), "Çelik Termos 750 ml")
      const template = await post<{ attribute_template: { id: string } }>(
        "/admin/attribute-templates",
        {
          name: "Termos",
          handle: `termos-${randomUUID()}`,
          definitions: [
            {
              key: "material",
              label: "Malzeme",
              type: "select",
              rank: 0,
              options: [
                { value: "steel", label: "Çelik" },
                { value: "glass", label: "Cam" },
              ],
            },
            { key: "volume", label: "Hacim", type: "number", unit: "ml", rank: 1 },
            { key: "origin", label: "Menşei", type: "text", rank: 2 },
            { key: "color", label: "Renk", type: "text", rank: 3 },
            { key: "supplier", label: "Tedarikçi kodu", type: "text", rank: 4, is_public: false },
          ],
        }
      )
      const templateId = template.data.attribute_template.id
      const saved = await post(`/admin/products/${product}/attributes`, {
        template_id: templateId,
        values: { color: "Gümüş", supplier: SUPPLIER, ...values },
      })
      expect(saved.status).toBe(200)
      return { product, templateId }
    }

    const storedValues = async (product: string) =>
      (
        await http.get<{ values: Record<string, unknown> }>(
          `/admin/products/${product}/attributes`,
          { headers: owner.headers }
        )
      ).data.values

    it("offers values for the empty public fields only, the misfits dropped, nothing written", async () => {
      const { product } = await shop()
      const seen = answering((request) =>
        JSON.stringify({
          [codeOf(request.data, "Malzeme")]: "Çelik",
          [codeOf(request.data, "Hacim")]: 750,
          // Out of its type, a code not in the list, a field's key: dropped, not the rest
          [codeOf(request.data, "Menşei")]: ["Türkiye"],
          a99: "uydurma",
          supplier: "X",
          price: 1,
        })
      )
      const answer = await ask(owner.headers, product)

      expect(answer.status).toBe(201)
      expect(answer.data.suggestion?.attributes).toEqual({
        values: { material: "steel", volume: 750 },
        dropped: 4,
      })
      const [request] = seen
      expect(request?.json).toBe(true)
      expect(request?.images).toBeUndefined()
      expect(request?.data).toContain("attribute_choices")
      expect(request?.data).toContain("steel = Çelik")
      // The filled public value is a fact, never a choice; the hidden field and its value never go
      expect(codeOf(request?.data ?? "", "Renk")).toBe("missing")
      expect(request?.data).toContain("Gümüş")
      for (const leak of ["Tedarikçi", SUPPLIER, "450", "atdef_", "atpl_", '"material"']) {
        expect(request?.data).not.toContain(leak)
      }
      expect(request?.system).not.toContain("Mağaza yönergesi")
      expect(await storedValues(product)).toEqual({ color: "Gümüş", supplier: SUPPLIER })
      expect((await records().usages()).at(-1)).toMatchObject({
        task: "product_attributes",
        capability: "text",
        status: "succeeded",
      })
    })

    it("refuses an answer with no value that fits, keeping no text", async () => {
      const { product } = await shop()
      answering((request) => JSON.stringify({ [codeOf(request.data, "Malzeme")]: "Ahşap", a77: 1 }))
      const answer = await ask(owner.headers, product)
      expect([answer.status, answer.data.message, answer.data.problems]).toEqual([
        422,
        "ai.suggestion_refused",
        ["no_valid_value"],
      ])
      const drafts = await records().drafts()
      expect(
        drafts.filter((each) => each.status === "refused").every((each) => each.text === "")
      ).toBe(true)
    })

    it("turns away a product with nothing empty, or no template, before any call", async () => {
      const { product } = await shop({ material: "glass", volume: 500, origin: "Türkiye" })
      const bare = await aiProduct(getContainer())
      const seen = answering(() => "{}")
      for (const id of [product, bare]) {
        const answer = await ask(owner.headers, id)
        expect([answer.status, answer.data.message]).toEqual([400, "ai.no_empty_attributes"])
      }
      expect(seen).toHaveLength(0)
      expect(await records().usages()).toHaveLength(0)
    })

    it("sends the product's first picture to a service that sees, as vision", async () => {
      const { product } = await shop()
      const form = new FormData()
      form.append(
        "files",
        new Blob([new Uint8Array(await picture())], { type: "image/png" }),
        FILE_NAME
      )
      const files = await http.post<{ files: { id: string }[] }>("/admin/uploads", form, {
        headers: owner.headers,
      })
      const registered = await http.post<{ media: { id: string }[] }>(
        "/admin/media",
        { file_ids: [files.data.files[0]?.id] },
        { headers: owner.headers }
      )
      const mediaId = registered.data.media[0]?.id ?? ""
      const [asset] = await getContainer()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ id: mediaId }, { take: 1 })
      const url = asset?.url ?? ""
      await getContainer()
        .resolve(Modules.PRODUCT)
        .updateProducts(product, { images: [{ url }], thumbnail: url })
      await getContainer()
        .resolve(ContainerRegistrationKeys.LINK)
        .create({
          [Modules.PRODUCT]: { product_id: product },
          [MEDIA_MODULE]: { media_asset_id: mediaId },
        })
      const seen = answering((request) =>
        JSON.stringify({ [codeOf(request.data, "Malzeme")]: "steel" })
      )

      const answer = await ask(owner.headers, product)

      expect(answer.status).toBe(201)
      expect(answer.data.suggestion?.attributes?.values).toEqual({ material: "steel" })
      expect(seen[0]?.images).toHaveLength(1)
      // The picture goes as bytes, never by its address or file name
      expect(`${seen[0]?.system ?? ""}${seen[0]?.data ?? ""}`).not.toMatch(
        /ozellik-doldurma|uploads|http/
      )
      expect((await records().usages()).at(-1)).toMatchObject({
        task: "product_attributes",
        capability: "vision",
        images: 1,
      })
    })

    it("lets only owner and admin ask, on a product only, and keeps guidance off it", async () => {
      const { product } = await shop()
      const seen = answering((request) => JSON.stringify({ [codeOf(request.data, "Hacim")]: 750 }))
      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")

      expect((await ask(admin.headers, product)).status).toBe(201)
      expect((await ask(operations.headers, product)).status).toBe(403)
      expect((await ask(readonly.headers, product)).status).toBe(403)
      const category = await post<{ product_category: { id: string } }>(
        "/admin/product-categories",
        { name: `Termoslar ${randomUUID()}`, is_active: true }
      )
      const other = await settle(
        http.post<Answer>(
          "/admin/ai/suggestions",
          {
            task: "product_attributes",
            entity_type: "category",
            entity_id: category.data.product_category.id,
          },
          { headers: owner.headers }
        )
      )
      expect([other.status, other.data.message]).toEqual([400, "ai.unknown_entity"])
      expect(seen).toHaveLength(1)

      const saved = await settle(
        http.post(
          "/admin/platform-settings/ai_guidance",
          { tasks: { product_attributes: { extra: "Kısa yaz." } } },
          { headers: owner.headers }
        )
      )
      expect(saved.status).toBe(400)
      expect(JSON.stringify(saved.data)).toContain("ai.guidance_unknown_task")
    })
  },
})
