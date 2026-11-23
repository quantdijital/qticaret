import type { AddonTemplateSource, StoredAddon } from "../../../../lib/catalog/addons"
import { BulkEditInput } from "../change"
import { planBulkChange } from "../plan"
import type { BulkProduct } from "../products"
import { SCOPE_PAGE, scopeChunks, scopeFilters } from "../scope"
import type { ScopeRow } from "../scope"

const rowsOf = (count: number, from = 0): ScopeRow[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `prod_${String(from + index).padStart(5, "0")}`,
  }))

// A catalogue read by id after a cursor, as Medusa's query pages it
const reader = (rows: ScopeRow[]) => {
  const calls: { after: string | null; take: number }[] = []
  const read = (after: string | null, take: number) => {
    calls.push({ after, take })
    const rest = after === null ? rows : rows.filter((row) => row.id > after)
    return Promise.resolve(rest.slice(0, take))
  }
  return { read, calls }
}

const collect = async (chunks: AsyncIterable<string[]>) => {
  const out: string[][] = []
  for await (const chunk of chunks) {
    out.push(chunk)
  }
  return out
}

describe("bulk edit scope: the input", () => {
  const change = { action: "addon_template", mode: "add", template_id: "adtpl_1" }

  it("takes a scope for an add-on template, in place of named products", () => {
    expect(BulkEditInput.safeParse({ scope: { kind: "all" }, change }).success).toBe(true)
    expect(
      BulkEditInput.safeParse({ scope: { kind: "category", category_id: "pcat_1" }, change })
        .success
    ).toBe(true)
  })

  it("refuses both, neither, or a scope for another change", () => {
    expect(
      BulkEditInput.safeParse({ product_ids: ["prod_1"], scope: { kind: "all" }, change }).success
    ).toBe(false)
    expect(BulkEditInput.safeParse({ change }).success).toBe(false)
    expect(
      BulkEditInput.safeParse({
        scope: { kind: "all" },
        change: { action: "status", status: "draft" },
      }).success
    ).toBe(false)
    expect(BulkEditInput.safeParse({ scope: { kind: "category" }, change }).success).toBe(false)
    expect(
      BulkEditInput.safeParse({ scope: { kind: "all", category_id: "pcat_1" }, change }).success
    ).toBe(false)
  })
})

describe("bulk edit scope: what it reads", () => {
  it("filters nothing for the whole catalogue", () => {
    expect(scopeFilters({ kind: "all" }, [])).toEqual({})
  })

  it("takes a category with every one below it", () => {
    const categories = [
      { id: "pcat_knives", parent_category_id: null },
      { id: "pcat_chef", parent_category_id: "pcat_knives" },
      { id: "pcat_santoku", parent_category_id: "pcat_chef" },
      { id: "pcat_boards", parent_category_id: null },
    ]
    const filters = scopeFilters({ kind: "category", category_id: "pcat_knives" }, categories)
    expect(filters).toEqual({
      categories: {
        id: expect.arrayContaining(["pcat_knives", "pcat_chef", "pcat_santoku"]) as unknown,
      },
    })
    expect((filters["categories"] as { id: string[] }).id).not.toContain("pcat_boards")
  })
})

describe("bulk edit scope: paging", () => {
  it("reads past 1,000 products a page at a time, in chunks, each once", async () => {
    const rows = rowsOf(2_345)
    const { read, calls } = reader(rows)
    const chunks = await collect(scopeChunks(read, 20))
    const ids = chunks.flat()
    expect(ids).toEqual(rows.map((row) => row.id))
    expect(chunks.every((chunk) => chunk.length <= 20)).toBe(true)
    expect(calls.every((call) => call.take === SCOPE_PAGE)).toBe(true)
    // A page per 200, the last one short
    expect(calls).toHaveLength(Math.ceil(2_345 / SCOPE_PAGE))
    expect(calls[1]?.after).toBe(rows[SCOPE_PAGE - 1]?.id)
  })

  it("asks once more after a full last page, and stops on the empty one", async () => {
    const { read, calls } = reader(rowsOf(400))
    const ids = (await collect(scopeChunks(read, 20))).flat()
    expect(ids).toHaveLength(400)
    expect(calls).toHaveLength(3)
  })

  it("leaves gift card products out", async () => {
    const rows: ScopeRow[] = [
      { id: "prod_a" },
      { id: "prod_b", product_extension: { is_gift_card: true } },
      { id: "prod_c", product_extension: { is_gift_card: false } },
    ]
    const ids = (await collect(scopeChunks(reader(rows).read, 20))).flat()
    expect(ids).toEqual(["prod_a", "prod_c"])
  })

  it("gives nothing for an empty catalogue", async () => {
    expect(await collect(scopeChunks(reader([]).read, 20))).toEqual([])
  })
})

describe("bulk edit scope: the limit of five over a scope", () => {
  const text = (id: string): StoredAddon => ({
    id,
    kind: "text",
    label: id,
    help: null,
    required: false,
    max_quantity: null,
    non_withdrawable: false,
    price: 10,
    text: { max_length: 50, charset: "letters_digits" },
  })
  const templates = new Map<string, AddonTemplateSource>([
    ["adtpl_new", { id: "adtpl_new", name: "Kazıma", addons: [text("n1")] }],
  ])

  it("links each product with room and skips the full ones, chunk by chunk", async () => {
    const rows = rowsOf(45)
    const full = new Set(rows.filter((_, index) => index % 10 === 0).map((row) => row.id))
    const products = new Map<string, BulkProduct>(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          handle: row.id,
          title: row.id,
          status: "published",
          product_extension: {
            addons: { items: full.has(row.id) ? ["a", "b", "c", "d", "e"].map(text) : [] },
          },
        },
      ])
    )
    const outcomes = { write: 0, skipped: 0, unchanged: 0 }
    for await (const chunk of scopeChunks(reader(rows).read, 20)) {
      for (const id of chunk) {
        const product = products.get(id)
        if (!product) {
          throw new Error(`missing ${id}`)
        }
        const plan = planBulkChange(
          product,
          { action: "addon_template", mode: "add", template_id: "adtpl_new" },
          { locationId: null, addonTemplates: templates }
        )
        outcomes[plan.kind] += 1
        if (plan.kind === "skipped") {
          expect(plan.key).toBe("addons.too_many")
        }
      }
    }
    expect(outcomes).toEqual({ write: 40, skipped: 5, unchanged: 0 })
  })
})
