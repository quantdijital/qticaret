import { entityFacts } from "../facts"
import { MEDIA_FACT_FIELDS, mediaFacts } from "../facts/media"
import type { FactsContainer } from "../facts/types"
import { buildPrompt } from "../prompt"

/**
 * Aşama 5 (adr/0071 §10): what leaves the shop for an image's alt text.
 * The picture by its stored file, the product's name and category when a
 * product shows it; never the file name, the uploader or an address.
 */

interface Asked {
  entity: string
  fields: string[]
  filters: Record<string, unknown>
}

const PRODUCT = {
  title: "Seramik Kupa",
  subtitle: "El yapımı, ayse.yilmaz@example.com",
  description: "<p>Gizli not</p>",
  categories: [{ name: "Mutfak", is_internal: false, is_active: true }],
  attribute_values: [],
}

function containerWith(media: Record<string, unknown> | null): {
  container: FactsContainer
  asked: Asked[]
} {
  const asked: Asked[] = []
  const query = {
    graph: (request: Asked) => {
      asked.push(request)
      if (request.entity === "media_asset") {
        return Promise.resolve({ data: media ? [media] : [] })
      }
      return Promise.resolve({ data: [PRODUCT] })
    },
  }
  return { container: { resolve: () => query }, asked }
}

const STORED = {
  id: "media_01",
  file_id: "file_01",
  mime_type: "image/webp",
  alt: null,
  product: { id: "prod_01" },
}

describe("an image's facts for its alt text", () => {
  it("gives the picture by its file and the product's name and shown category only", async () => {
    const { container, asked } = containerWith(STORED)
    const facts = await mediaFacts(container, "media_01")
    expect(facts.image).toEqual({ file_id: "file_01" })
    expect(facts.fields).toEqual({ product: "Seramik Kupa", category: "Mutfak" })
    // The media record is read for what the task needs, nothing about people or names
    expect(asked[0]).toMatchObject({ entity: "media_asset", filters: { id: "media_01" } })
    expect([...MEDIA_FACT_FIELDS]).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/filename|uploaded_by|url/)])
    )
    const data = buildPrompt({ instruction: "x", fields: facts.fields }).data
    expect(data).not.toMatch(/example\.com|Gizli|El yapımı|file_01/)
  })

  it("has no product facts for a library picture no product shows", async () => {
    const { container } = containerWith({ ...STORED, product: null })
    expect((await mediaFacts(container, "media_01")).fields).toEqual({
      product: null,
      category: null,
    })
  })

  it("turns away an unknown image, one with no stored file and an SVG", async () => {
    await expect(mediaFacts(containerWith(null).container, "media_x")).rejects.toThrow(
      "ai.unknown_entity"
    )
    await expect(
      mediaFacts(containerWith({ ...STORED, file_id: null }).container, "media_01")
    ).rejects.toThrow("ai.input_unsupported")
    await expect(
      mediaFacts(containerWith({ ...STORED, mime_type: "image/svg+xml" }).container, "media_01")
    ).rejects.toThrow("ai.input_unsupported")
  })

  it("leaves the shop's name out of an image's data and checks the id's kind", async () => {
    const { container } = containerWith(STORED)
    const facts = await entityFacts(container, "media", "media_01")
    expect(facts.image).toEqual({ file_id: "file_01" })
    expect(facts.fields).not.toHaveProperty("shop")
    await expect(entityFacts(container, "media", "prod_01")).rejects.toThrow("ai.unknown_entity")
  })
})
