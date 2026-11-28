import {
  dropKeys,
  isEditedSample,
  isSampleRecord,
  isSampleReviewRef,
  packOfTag,
  sampleMark,
  sampleReviewRef,
  sampleTag,
} from "../mark"
import { freeHandle } from "../load-plan"
import { planRemoval } from "../plan"
import type { CategoryRow, SampleProductRow } from "../plan"

const at = new Date("2026-11-28T10:00:00Z")

describe("a sample record's mark", () => {
  const tag = sampleTag("travel", 1)

  it("is the set's tag and the record's own id", () => {
    expect(tag).toBe("travel@1")
    expect(packOfTag(tag)).toBe("travel")
    expect(packOfTag("nope")).toBeNull()
    expect(isSampleRecord({ id: "prod_1", metadata: sampleMark(tag, "prod_1", at) })).toBe(true)
  })

  it("does not make a copy a sample: the copy carries another id", () => {
    expect(isSampleRecord({ id: "prod_2", metadata: sampleMark(tag, "prod_1", at) })).toBe(false)
    expect(isSampleRecord({ id: "prod_1", metadata: { sample: tag } })).toBe(false)
    expect(isSampleRecord({ id: "prod_1", metadata: null })).toBe(false)
  })

  it("reads a product saved well after it was made as edited", () => {
    const metadata = sampleMark(tag, "prod_1", at)
    expect(isEditedSample({ metadata, updated_at: new Date(at.getTime() + 30_000) })).toBe(false)
    expect(isEditedSample({ metadata, updated_at: new Date(at.getTime() + 600_000) })).toBe(true)
    expect(isEditedSample({ metadata: {}, updated_at: at })).toBe(false)
  })

  it("names a review by the set, the product and its place", () => {
    const ref = sampleReviewRef(tag, "efes", 0)
    expect(ref).toBe("sample:travel@1:efes:1")
    expect(isSampleReviewRef(ref)).toBe(true)
    expect(isSampleReviewRef("demo-catalog x:efes:1")).toBe(false)
  })

  it("drops a key with an empty value (Medusa merges metadata)", () => {
    expect(dropKeys(["sample_opened"])).toEqual({ sample_opened: "" })
  })
})

describe("a sample product's handle", () => {
  it("is the set's, or with -ornek when the shop has one by that name", () => {
    expect(freeHandle("efes", new Set())).toBe("efes")
    expect(freeHandle("efes", new Set(["efes"]))).toBe("efes-ornek")
    expect(freeHandle("efes", new Set(["efes", "efes-ornek"]))).toBe("efes-ornek-2")
  })
})

const product = (id: string, over: Partial<SampleProductRow> = {}): SampleProductRow => ({
  id,
  title: id,
  ordered: false,
  booked: false,
  ...over,
})
const category = (id: string, over: Partial<CategoryRow> = {}): CategoryRow => ({
  id,
  name: id,
  sample: true,
  opened: false,
  is_active: true,
  parent_id: null,
  product_ids: [],
  ...over,
})
const ALL = { parts: ["products", "categories", "reviews"] as const, keep_product_ids: [] }

describe("what removing the samples takes", () => {
  it("takes every sample product, its reviews and the emptied sample categories", () => {
    const plan = planRemoval(
      {
        products: [product("p1"), product("p2")],
        categories: [category("c1", { product_ids: ["p1", "p2"] })],
        reviews: [
          { id: "r1", product_id: "p1" },
          { id: "r2", product_id: "p2" },
        ],
      },
      ALL
    )
    expect(plan.product_ids).toEqual(["p1", "p2"])
    expect(plan.review_ids).toEqual(["r1", "r2"])
    expect(plan.category_ids).toEqual(["c1"])
    expect(plan.blocked).toEqual([])
  })

  it("leaves a product an order holds or whose place is sold, and names it", () => {
    const plan = planRemoval(
      {
        products: [
          product("p1", { ordered: true }),
          product("p2", { booked: true }),
          product("p3"),
        ],
        categories: [category("c1", { product_ids: ["p1", "p3"] })],
        reviews: [{ id: "r1", product_id: "p1" }],
      },
      { parts: ["products", "categories"], keep_product_ids: [] }
    )
    expect(plan.product_ids).toEqual(["p3"])
    expect(plan.blocked).toEqual([
      { id: "p1", title: "p1", reason: "ordered" },
      { id: "p2", title: "p2", reason: "booked" },
    ])
    // Its reviews stay with it; its category keeps it
    expect(plan.review_ids).toEqual([])
    expect(plan.category_ids).toEqual([])
    expect(plan.categories_kept).toEqual([{ id: "c1", name: "c1", reason: "samples_left" }])
  })

  it("keeps a sample category holding a product of the shop's, and one with the shop's child", () => {
    const plan = planRemoval(
      {
        products: [product("p1")],
        categories: [
          category("c1", { product_ids: ["p1", "own"] }),
          category("c2"),
          category("own-child", { sample: false, parent_id: "c2" }),
          category("c3"),
          category("c3-child", { parent_id: "c3", product_ids: ["p1"] }),
        ],
        reviews: [],
      },
      ALL
    )
    expect(plan.category_ids.sort()).toEqual(["c3", "c3-child"])
    expect(plan.categories_kept).toEqual([
      { id: "c1", name: "c1", reason: "own_products" },
      { id: "c2", name: "c2", reason: "children" },
    ])
  })

  it("keeps the products the owner picked out, with their reviews", () => {
    const plan = planRemoval(
      {
        products: [product("p1"), product("p2")],
        categories: [],
        reviews: [
          { id: "r1", product_id: "p1" },
          { id: "r2", product_id: "p2" },
        ],
      },
      { parts: ["products"], keep_product_ids: ["p2"] }
    )
    expect(plan.product_ids).toEqual(["p1"])
    expect(plan.review_ids).toEqual(["r1"])
  })

  it("takes only the reviews when only the reviews are chosen", () => {
    const plan = planRemoval(
      {
        products: [product("p1")],
        categories: [category("c1", { product_ids: ["p1"] })],
        reviews: [{ id: "r1", product_id: "p1" }],
      },
      { parts: ["reviews"], keep_product_ids: [] }
    )
    expect(plan).toMatchObject({ product_ids: [], category_ids: [], review_ids: ["r1"] })
  })

  it("hides again a pack category the samples opened once its last product goes", () => {
    const plan = planRemoval(
      {
        products: [product("p1"), product("p2")],
        categories: [
          category("opened", { sample: false, opened: true, product_ids: ["p1"] }),
          category("still", { sample: false, opened: true, product_ids: ["p2", "own"] }),
          category("hidden", {
            sample: false,
            opened: true,
            is_active: false,
            product_ids: ["p1"],
          }),
        ],
        reviews: [],
      },
      { parts: ["products"], keep_product_ids: [] }
    )
    expect(plan.hide_category_ids).toEqual(["opened"])
    expect(plan.category_ids).toEqual([])
  })
})
