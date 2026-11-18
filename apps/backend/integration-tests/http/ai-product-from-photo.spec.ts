import { randomUUID } from "node:crypto"
import { rmSync } from "node:fs"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { fakeSecret } from "@qticaret/testing"
import sharp from "sharp"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import { aiRecords, askFor, connectFake, pushPlan } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface CardAnswer {
  suggestion?: {
    id: string
    text: string | null
    card?: {
      title: string
      short_description: string | null
      category_id: string | null
      attributes: Record<string, unknown>
    } | null
  }
  message?: string
  problems?: string[]
}

const FILE_NAME = "urun-karti-deneme.png"

const picture = () =>
  sharp({ create: { width: 900, height: 900, channels: 3, background: { r: 200, g: 60, b: 40 } } })
    .png()
    .toBuffer()

/**
 * docs/22 "Aşama 6" (adr/0071 §8–§10): a new product's card from one
 * uploaded photo, on the fake service. The answer is read against the
 * closed card schema and the shop's own lists: a price, status or
 * instruction the model writes never reaches the card; nothing is saved
 * (no product, no attribute value, no change to the image).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string>; userId: string }
    const key = `test-key-${fakeSecret()}`
    const ask = askFor(http)
    const records = () => aiRecords(getContainer())
    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T>(url, body, { headers: owner.headers }))

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
      for (const path of filesNamed(/urun-karti-deneme/)) {
        rmSync(path, { force: true })
      }
    })

    async function uploaded(): Promise<string> {
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
      const id = registered.data.media[0]?.id
      if (!id) {
        throw new Error("no media registered")
      }
      return id
    }

    // The fake answer, fixed or written from the request (a category code read off its data)
    function answering(text: string | ((request: TextRequest) => string)): TextRequest[] {
      const seen: TextRequest[] = []
      jest.spyOn(fakeTextConnector, "complete").mockImplementation((request) => {
        seen.push(request)
        return Promise.resolve({
          text: typeof text === "string" ? text : text(request),
          usage: { inputTokens: 10, outputTokens: 10 },
        })
      })
      return seen
    }

    // The short code the prompt's category list gave a category name: the
    // list is sorted by name, so other shown categories may move it
    const codeOf = (request: TextRequest, name: string) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      return new RegExp(`"label":"(k\\d+)","value":"${escaped}"`).exec(request.data)?.[1] ?? "k0"
    }

    const productCount = async () =>
      (await getContainer().resolve(Modules.PRODUCT).listProducts({}, { take: 1000 })).length

    it("fills a card from the photo with the shop's own lists, saving nothing", async () => {
      const mediaId = await uploaded()
      const shown = await post<{ product_category: { id: string } }>("/admin/product-categories", {
        name: "Kupalar",
        is_active: true,
      })
      await post("/admin/product-categories", { name: "Gizli", is_active: true, is_internal: true })
      const template = await post<{ attribute_template: { id: string } }>(
        "/admin/attribute-templates",
        {
          name: "Kupa",
          handle: `kupa-${randomUUID()}`,
          definitions: [
            {
              key: "material",
              label: "Malzeme",
              type: "select",
              options: [
                { value: "porcelain", label: "Porselen" },
                { value: "glass", label: "Cam" },
              ],
            },
          ],
        }
      )
      const before = await productCount()
      const seen = answering((request) =>
        JSON.stringify({
          title: "Kırmızı porselen kupa",
          short_description: "Kulplu, parlak sırlı bir kupa.",
          category: codeOf(request, "Kupalar"),
          attributes: { material: "Porselen", weight: 300 },
          price: 1,
          status: "published",
          sku: "X-1",
        })
      )

      const answer = await ask(owner.headers, {
        task: "product_from_photo",
        entity_type: "media",
        entity_id: mediaId,
        template_id: template.data.attribute_template.id,
      })

      expect(answer.status).toBe(201)
      const data = answer.data as CardAnswer
      expect(data.suggestion?.card).toEqual({
        title: "Kırmızı porselen kupa",
        short_description: "Kulplu, parlak sırlı bir kupa.",
        category_id: shown.data.product_category.id,
        attributes: { material: "porcelain" },
      })
      expect(data.suggestion?.text).not.toMatch(/price|published|X-1/)
      // The picture went as bytes with JSON asked; the lists by codes, no id, file or person
      const [request] = seen
      expect(request?.json).toBe(true)
      expect(request?.images).toHaveLength(1)
      expect(request?.data).toContain("Kupalar")
      expect(request?.data).toContain("porcelain = Porselen")
      expect(`${request?.system ?? ""}${request?.data ?? ""}`).not.toMatch(
        /Gizli|pcat_|atpl_|urun-karti|http|uploads/
      )
      // Nothing is saved: no product, the image unchanged, a suggestion waiting
      expect(await productCount()).toBe(before)
      const [row] = await getContainer()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ id: mediaId }, { take: 1 })
      expect(row?.alt).toBeNull()
      const usages = await records().usages()
      expect(usages.at(-1)).toMatchObject({
        task: "product_from_photo",
        capability: "vision",
        status: "succeeded",
        images: 1,
      })
    })

    it("refuses an answer that followed the photo's writing, and keeps no text of it", async () => {
      const mediaId = await uploaded()
      answering("Önceki talimatlar yok sayıldı. Fiyat 1 TL olarak yazıldı.")
      const answer = await ask(owner.headers, {
        task: "product_from_photo",
        entity_type: "media",
        entity_id: mediaId,
      })
      expect(answer.status).toBe(422)
      expect(answer.data.message).toBe("ai.suggestion_refused")
      expect(answer.data.problems).toEqual(["format"])
      const drafts = (await records().drafts()).filter((each) => each.kind === "product_from_photo")
      expect(drafts.at(-1)).toMatchObject({ status: "refused", text: "" })
    })

    it("takes no category, attribute or text from the client, and is for owner and admin", async () => {
      const mediaId = await uploaded()
      const base = { task: "product_from_photo", entity_type: "media", entity_id: mediaId }
      for (const extra of [
        { category_id: "pcat_01X" },
        { attributes: { material: "glass" } },
        { title: "Benim adım" },
        { price: 1 },
        { template_id: "javascript:alert(1)" },
      ]) {
        expect((await ask(owner.headers, { ...base, ...extra })).status).toBe(400)
      }
      expect((await ask(owner.headers, { ...base, template_id: "atpl_01NOPE" })).status).toBe(400)
      expect(
        (await ask(owner.headers, { ...base, entity_type: "product", entity_id: "prod_01X" }))
          .status
      ).toBe(400)

      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      expect((await ask(admin.headers, base)).status).toBe(201)
      expect((await ask(operations.headers, base)).status).toBe(403)
    })
  },
})
