import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BRANDS_MODULE } from "../../../modules/brands"
import { CATALOG_EXTENSION_MODULE } from "../../../modules/catalog-extension"
import { CONTENT_MODULE } from "../../../modules/content"
import { MIGRATION_MODULE } from "../../../modules/migration"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { followPath } from "../../seo/redirects/resolve"
import { planContentLinks } from "../link-plan"
import { linkRows } from "../link-report"

jest.mock("../link-layout", () => ({ draftPageTexts: jest.fn().mockResolvedValue(new Map()) }))
jest.mock("../../seo/redirects/resolve", () => ({ followPath: jest.fn() }))

// The product moved: its old path answers with a 301 to the new one, which is live
jest.mocked(followPath).mockImplementation((_container, request) =>
  Promise.resolve({
    resolution:
      request.path === "/urun/eski-kupa"
        ? { type: "redirect", location: "/urun/yeni-kupa" }
        : request.path === "/urun/yeni-kupa"
          ? { type: "entity", path: "/urun/yeni-kupa" }
          : { type: "not_found" },
  } as unknown as Awaited<ReturnType<typeof followPath>>)
)

/** A document of one paragraph: its text, linked to `href`. */
const docOf = (text: string, href: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text, marks: [{ type: "link", attrs: { href } }] }],
    },
  ],
})

function containerOf() {
  const categoryRows = [
    { category_id: "pcat_1", description_doc: docOf("Bakım", "/urun/eski-kupa") },
    // A deleted category's row: no page, never read
    { category_id: "pcat_gone", description_doc: docOf("Yok", "/urun/eski-kupa") },
  ]
  const brands = [
    {
      id: "brand_1",
      name: "Usta",
      description: "Usta işi",
      description_doc: docOf("Usta işi", "https://magaza.example.com/urun/eski-kupa#bakim"),
    },
    // Its text changed elsewhere: the document is stale, shown nowhere, not read
    {
      id: "brand_stale",
      name: "Eski",
      description: "Başka metin",
      description_doc: docOf("Eski metin", "/urun/eski-kupa"),
    },
  ]
  const collections = [
    {
      id: "pcol_1",
      title: "Yaz",
      collection_extension: {
        description: "Kayıp",
        description_doc: docOf("Kayıp", "/hic-olmayan"),
      },
    },
    { id: "pcol_plain", title: "Düz", collection_extension: null },
  ]
  // A blog category's live document (adr/0075 Ek 2026-11-24) and a tag's stale one
  const terms = [
    {
      id: "cterm_1",
      kind: "category",
      name: "Rehberler",
      description: "Bakım rehberi",
      description_doc: docOf("Bakım rehberi", "/urun/eski-kupa"),
    },
    {
      id: "cterm_stale",
      kind: "tag",
      name: "Eski",
      description: "Başka metin",
      description_doc: docOf("Eski metin", "/urun/eski-kupa"),
    },
  ]
  const graph = jest.fn(({ entity, filters }: { entity: string; filters: { id?: string[] } }) =>
    Promise.resolve({
      data:
        entity === "product_category"
          ? [{ id: "pcat_1", name: "Bıçaklar", description: "Bakım" }].filter((row) =>
              filters.id?.includes(row.id)
            )
          : entity === "product_collection"
            ? collections.filter((row) => !filters.id || filters.id.includes(row.id))
            : [],
    })
  )
  const services: Record<string, unknown> = {
    [PLATFORM_SETTINGS_MODULE]: {
      getSection: jest.fn().mockResolvedValue({ canonical_host: "magaza.example.com" }),
    },
    [MIGRATION_MODULE]: { listMigrationItems: jest.fn().mockResolvedValue([]) },
    [CONTENT_MODULE]: {
      listContentEntries: jest.fn().mockResolvedValue([]),
      listContentTerms: jest.fn((filter: { id?: string[] }) =>
        Promise.resolve(terms.filter((row) => !filter.id || filter.id.includes(row.id)))
      ),
    },
    [ContainerRegistrationKeys.QUERY]: { graph },
    [CATALOG_EXTENSION_MODULE]: {
      listCategoryExtensions: jest.fn((filter: { category_id?: string[] }) =>
        Promise.resolve(
          categoryRows.filter(
            (row) => !filter.category_id || filter.category_id.includes(row.category_id)
          )
        )
      ),
    },
    [BRANDS_MODULE]: {
      listBrands: jest.fn((filter: { id?: string[] }) =>
        Promise.resolve(brands.filter((row) => !filter.id || filter.id.includes(row.id)))
      ),
    },
  }
  return {
    services,
    graph,
    resolve: (key: string): never => services[key] as never,
  }
}

describe("planContentLinks: listing descriptions (adr/0075)", () => {
  it("reads categories', brands', collections' and blog terms' current documents and plans their writes", async () => {
    const container = containerOf()

    const plan = await planContentLinks(container, {})

    // The category, the live brand, the collection and the blog category; never the orphan or a stale one
    expect(plan.documents).toBe(4)
    expect(plan.writes.listings).toEqual([
      { kind: "category", id: "pcat_1" },
      { kind: "brand", id: "brand_1" },
    ])
    expect(plan.writes.terms).toEqual(["cterm_1"])
    expect(plan.writes.entries).toEqual([])
    expect(plan.writes.products).toEqual([])
    expect(plan.next).toEqual({
      "/urun/eski-kupa": "/urun/yeni-kupa",
      "https://magaza.example.com/urun/eski-kupa#bakim": "/urun/yeni-kupa#bakim",
    })
    expect(plan.changed.map((row) => [row.kind, row.id, row.title])).toEqual([
      ["category", "pcat_1", "Bıçaklar"],
      ["brand", "brand_1", "Usta"],
      ["post_category", "cterm_1", "Rehberler"],
    ])
    expect(plan.unresolved).toEqual([
      {
        kind: "collection",
        id: "pcol_1",
        title: "Yaz",
        href: "/hic-olmayan",
        target: null,
        reason: "not_found",
      },
    ])
    // The report names each kind in the shop's words
    expect(linkRows(plan).changed.map((row) => row[0])).toEqual([
      "Kategori açıklaması",
      "Marka açıklaması",
      "Blog kategorisi açıklaması",
    ])
    expect(linkRows(plan).unresolved[0]?.[0]).toBe("Koleksiyon açıklaması")
  })

  it("reads only the listings a scope names; an empty list reads none", async () => {
    const container = containerOf()

    const named = await planContentLinks(container, {
      scope: {
        entries: [],
        products: [],
        categories: [],
        brands: ["brand_1"],
        collections: [],
        terms: [],
      },
    })
    const none = await planContentLinks(containerOf(), {
      scope: {
        entries: [],
        products: [],
        categories: [],
        brands: [],
        collections: [],
        terms: ["cterm_1"],
      },
    })

    expect(named.documents).toBe(1)
    expect(named.writes.listings).toEqual([{ kind: "brand", id: "brand_1" }])
    expect(
      (container.services[CATALOG_EXTENSION_MODULE] as { listCategoryExtensions: jest.Mock })
        .listCategoryExtensions
    ).not.toHaveBeenCalled()
    // A named blog category is read alone
    expect(none.documents).toBe(1)
    expect(none.writes.terms).toEqual(["cterm_1"])
  })
})
