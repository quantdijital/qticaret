import { Modules } from "@medusajs/framework/utils"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import { postDraftInput } from "../../../workflows/ai/steps/post-draft-input"
import { AI_FACT_MAX_LENGTHS, entityFacts } from "../facts"
import { POST_BODY_FACT_LENGTH, POST_FACT_FIELDS, postFacts } from "../facts/post"
import { postLinkFacts, stemsOf } from "../facts/post-links"
import type { FactsContainer } from "../facts/types"
import { LINK_CHOICES_FIELD } from "../post-draft"
import { POST_DRAFT_TASK, POST_LINK_CATEGORIES, POST_LINK_CHOICES } from "../registry/tasks"

jest.mock("../../../workflows/messaging/brand", () => ({
  brandOf: () => Promise.resolve({ shopName: "Demo Mağaza" }),
}))

/**
 * A blog post's facts (adr/0074 §5 madde 5, adr/0071 §10): its title,
 * summary, the body's opening and its search fields, never its author; a
 * content page's id is no post. A draft's link candidates: shown
 * categories and published products in the storefront's channels with a
 * path of their own, sent by code and name only.
 */

interface Asked {
  entity: string
  fields: string[]
  filters?: Record<string, unknown>
}

const doc = (text: string) => ({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Giriş" }] },
    { type: "paragraph", content: [{ type: "text", text }] },
  ],
})

const POST = {
  id: "cnt_1",
  title: "Termos nasıl temizlenir?",
  excerpt: "Termosu <b>temiz</b> tutmanın yolları.",
  body: doc("Uzun bir metin. ".repeat(200)),
  author_name: "Ayşe Yılmaz",
  author_id: "cauth_1",
  seo_meta: {
    focus_keyword: "termos temizliği",
    seo_title: "Termos | Demo",
    seo_description: null,
  },
}

interface World {
  posts?: unknown[]
  categories?: unknown[]
  products?: { id: string; title: string }[]
  channels?: Record<string, string[]>
  paths?: Record<string, string>
}

function containerWith(world: World = {}) {
  const asked: Asked[] = []
  const urls: Record<string, unknown>[] = []
  const query = {
    graph: (request: Asked) => {
      asked.push(request)
      if (request.entity === "content_entry") {
        return Promise.resolve({ data: world.posts ?? [] })
      }
      if (request.entity === "product_category") {
        return Promise.resolve({ data: world.categories ?? [] })
      }
      if (request.entity === "api_key") {
        return Promise.resolve({
          data: [{ id: "apk_1", revoked_at: null, sales_channels: [{ id: "sc_1" }] }],
        })
      }
      if (request.entity === "product") {
        const ids = (request.filters?.["id"] as string[] | undefined) ?? []
        return Promise.resolve({
          data: ids.map((id) => ({
            id,
            sales_channels: (world.channels?.[id] ?? ["sc_1"]).map((each) => ({ id: each })),
          })),
        })
      }
      return Promise.resolve({ data: [] })
    },
  }
  const products = {
    listProducts: (filters: Record<string, unknown>) => {
      expect(filters).toEqual({ status: "published" })
      return Promise.resolve(world.products ?? [])
    },
  }
  const registry = {
    listUrlEntries: (filters: { entity_id: string[]; entity_type: string; status: string }) => {
      urls.push(filters)
      return Promise.resolve(
        filters.entity_id.flatMap((id) =>
          world.paths?.[id] ? [{ entity_id: id, path: world.paths[id] }] : []
        )
      )
    },
  }
  const container: FactsContainer = {
    resolve: (key: string) =>
      key === Modules.PRODUCT ? products : key === URL_REGISTRY_MODULE ? registry : query,
  }
  return { container, asked, urls }
}

describe("a blog post's facts", () => {
  it("sends the title, summary, search fields and the body's opening, never the author", async () => {
    const { container, asked } = containerWith({ posts: [POST] })

    const facts = await postFacts(container, "cnt_1")

    expect(asked[0]).toMatchObject({
      entity: "content_entry",
      filters: { id: "cnt_1", kind: "post" },
    })
    expect(POST_FACT_FIELDS.some((field) => /author|image|published|revised/.test(field))).toBe(
      false
    )
    expect(facts).toMatchObject({
      name: "Termos nasıl temizlenir?",
      summary: "Termosu temiz tutmanın yolları.",
      focus_keyword: "termos temizliği",
      current_seo_title: "Termos | Demo",
    })
    expect(typeof facts["body"] === "string" && facts["body"].startsWith("Giriş")).toBe(true)
    expect((facts["body"] as string).length).toBeLessThanOrEqual(POST_BODY_FACT_LENGTH)
    expect(JSON.stringify(facts)).not.toContain("Ayşe")
  })

  it("answers a content page's id as unknown: the kind is part of the filter", async () => {
    // A page's row is not found under `kind: "post"`
    const { container } = containerWith({ posts: [] })
    await expect(postFacts(container, "cnt_page")).rejects.toThrow("ai.unknown_entity")
  })

  it("is read as a post with the shop's name and the body's own length", async () => {
    const { container, asked } = containerWith({ posts: [POST] })

    await expect(entityFacts(container, "post", "prod_1")).rejects.toThrow("ai.unknown_entity")
    expect(asked).toEqual([])
    const read = await entityFacts(container, "post", "cnt_1")
    expect(read.fields["shop"]).toBe("Demo Mağaza")
    expect(read.maxLengths["body"]).toBe(POST_BODY_FACT_LENGTH)
    // A page keeps its shorter body
    expect((await entityFacts(container, "page", "cnt_1")).maxLengths["body"]).toBe(
      AI_FACT_MAX_LENGTHS["body"]
    )
  })
})

const CATEGORIES = [
  { id: "pcat_1", name: "Mutfak", is_active: true, is_internal: false, parent_category_id: null },
  {
    id: "pcat_2",
    name: "Termoslar",
    is_active: true,
    is_internal: false,
    parent_category_id: "pcat_1",
  },
  { id: "pcat_3", name: "Gizli", is_active: true, is_internal: true, parent_category_id: null },
  { id: "pcat_4", name: "Yolu yok", is_active: true, is_internal: false, parent_category_id: null },
]

describe("a post draft's link candidates", () => {
  it("lists shown categories and storefront products with a path, by code, nearest first", async () => {
    const { container } = containerWith({
      categories: CATEGORIES,
      products: [
        { id: "prod_1", title: "Kahve Fincanı" },
        { id: "prod_2", title: "Çelik Termos 750 ml" },
        { id: "prod_3", title: "Başka Kanaldaki Termos" },
        { id: "prod_4", title: "Yolu Olmayan Termos" },
      ],
      channels: { prod_3: ["sc_other"] },
      paths: {
        pcat_1: "/kategori/mutfak",
        pcat_2: "/kategori/mutfak/termoslar",
        pcat_3: "/kategori/gizli",
        prod_1: "/urun/kahve-fincani",
        prod_2: "/urun/celik-termos",
        prod_3: "/urun/baska",
      },
    })

    const facts = await postLinkFacts(container, "Termos nasıl temizlenir? termos temizliği")

    expect(facts.allowed.choices).toEqual([
      {
        code: "k1",
        kind: "category",
        id: "pcat_2",
        name: "Mutfak > Termoslar",
        path: "/kategori/mutfak/termoslar",
      },
      { code: "k2", kind: "category", id: "pcat_1", name: "Mutfak", path: "/kategori/mutfak" },
      {
        code: "u1",
        kind: "product",
        id: "prod_2",
        name: "Çelik Termos 750 ml",
        path: "/urun/celik-termos",
      },
      {
        code: "u2",
        kind: "product",
        id: "prod_1",
        name: "Kahve Fincanı",
        path: "/urun/kahve-fincani",
      },
    ])
    // Only the code and the name leave the shop
    const sent = JSON.stringify(facts.fields)
    expect(facts.fields[LINK_CHOICES_FIELD]).toEqual([
      { label: "k1", value: "Kategori: Mutfak > Termoslar" },
      { label: "k2", value: "Kategori: Mutfak" },
      { label: "u1", value: "Ürün: Çelik Termos 750 ml" },
      { label: "u2", value: "Ürün: Kahve Fincanı" },
    ])
    for (const leak of ["pcat_", "prod_", "/urun/", "/kategori/", "Gizli"]) {
      expect(sent).not.toContain(leak)
    }
  })

  it("lists at most thirty, ten of them categories", async () => {
    const categories = Array.from({ length: 20 }, (_, index) => ({
      id: `pcat_${String(index)}`,
      name: `Kategori ${String(index)}`,
      is_active: true,
      is_internal: false,
      parent_category_id: null,
    }))
    const products = Array.from({ length: 40 }, (_, index) => ({
      id: `prod_${String(index)}`,
      title: `Ürün ${String(index)}`,
    }))
    const paths = Object.fromEntries(
      [...categories, ...products].map((each) => [each.id, `/x/${each.id}`])
    )
    const { container } = containerWith({ categories, products, paths })

    const facts = await postLinkFacts(container, "Bir yazı")

    expect(facts.allowed.choices).toHaveLength(POST_LINK_CHOICES)
    expect(facts.allowed.choices.filter((each) => each.kind === "category")).toHaveLength(
      POST_LINK_CATEGORIES
    )
  })

  it("matches words by their stem, leaving out the words that say nothing", () => {
    expect([...stemsOf("Termosların temizliği için bir rehber")]).toEqual(["termo", "temiz"])
  })
})

describe("a post draft's input", () => {
  it("sends the title, keyword, summary and shop with the link list; not the body or search texts", async () => {
    const { container } = containerWith({
      posts: [POST],
      categories: CATEGORIES.slice(0, 2),
      paths: { pcat_1: "/kategori/mutfak" },
    })

    const input = await postDraftInput(container, POST_DRAFT_TASK, "talimat", {
      entity_type: "post",
      entity_id: "cnt_1",
    })
    const data = (JSON.parse(input.data) as { data: Record<string, unknown> }).data

    expect(Object.keys(data).sort()).toEqual(
      [LINK_CHOICES_FIELD, "focus_keyword", "name", "shop", "summary"].sort()
    )
    expect(input.allowed.choices.map((each) => each.code)).toEqual(["k1"])
    expect(input.data).not.toContain("Uzun bir metin")
    expect(input.data).not.toContain("Ayşe")
  })
})
