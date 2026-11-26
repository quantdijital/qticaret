import { describe, expect, it } from "vitest"
import type { ProductDetail } from "@/features/products/api/products"
import { bulkEdit, bulkValue, filtered } from "./variant-bulk"
import { groupVariants } from "./variant-grouping"
import { draftProblem, planVariants, savedOptions } from "./variant-options"
import type { Variant } from "./variant-values"
import { COLOR, PRODUCT, stocked, variant } from "./variants-card.fixture"

const PLACEHOLDER = { title: "Seçenek", value: "Standart" }

const saved = () => savedOptions(PRODUCT, PLACEHOLDER)

describe("planning variants from the options", () => {
  it("makes only the combinations no variant stands for, never one twice", () => {
    const drafts = [
      { ...saved()[0], values: ["Sarı", "Pembe", "Mor", "Mavi"] },
      { id: null, title: "Boy", values: ["20 cm", "25 cm"] },
    ] as ReturnType<typeof saved>
    const plan = planVariants(PRODUCT, drafts, PLACEHOLDER)

    expect(plan.options).toEqual({
      add: [{ title: "Boy", values: ["20 cm", "25 cm"] }],
      remove: [],
      update: [{ optionId: "opt_color", add: ["Mavi"], remove: [] }],
    })
    // The three colours lacked a size: each takes the first one
    expect(plan.fill).toEqual([
      { id: "variant_1", options: { Renk: "Sarı", Boy: "20 cm" } },
      { id: "variant_2", options: { Renk: "Pembe", Boy: "20 cm" } },
      { id: "variant_3", options: { Renk: "Mor", Boy: "20 cm" } },
    ])
    expect(plan.create.map((each) => each.title)).toEqual([
      "Sarı / 25 cm",
      "Pembe / 25 cm",
      "Mor / 25 cm",
      "Mavi / 20 cm",
      "Mavi / 25 cm",
    ])
    // After the stored variants, untracked as they are
    expect(plan.create[0]).toMatchObject({ variant_rank: 4, manage_inventory: false })
  })

  it("has nothing to do while the options are as stored", () => {
    expect(planVariants(PRODUCT, saved(), PLACEHOLDER)).toEqual({
      options: { add: [], remove: [], update: [] },
      fill: [],
      create: [],
    })
  })

  it("takes an unused value off by its id", () => {
    const product = {
      ...PRODUCT,
      variants: PRODUCT.variants?.slice(0, 2),
    } as unknown as ProductDetail
    const plan = planVariants(
      product,
      [{ id: "opt_color", title: "Renk", values: ["Sarı", "Pembe"] }],
      PLACEHOLDER
    )
    expect(plan.options.update).toEqual([
      { optionId: "opt_color", add: [], remove: ["optval_mor"] },
    ])
    expect(plan.create).toEqual([])
  })

  it("keeps the wizard's placeholder out of the editor and on every new variant", () => {
    const product = {
      ...PRODUCT,
      options: [{ id: "opt_default", title: "Seçenek", values: [{ id: "v0", value: "Standart" }] }],
      variants: [
        {
          ...variant("variant_1", "Standart"),
          options: [{ value: "Standart", option_id: "opt_default" }],
        },
      ],
    } as unknown as ProductDetail
    expect(savedOptions(product, PLACEHOLDER)).toEqual([])
    const plan = planVariants(
      product,
      [{ id: null, title: "Renk", values: ["Kırmızı", "Mavi"] }],
      PLACEHOLDER
    )
    expect(plan.fill).toEqual([
      { id: "variant_1", options: { Seçenek: "Standart", Renk: "Kırmızı" } },
    ])
    expect(plan.create).toEqual([
      {
        title: "Mavi",
        options: { Seçenek: "Standart", Renk: "Mavi" },
        variant_rank: 2,
        manage_inventory: false,
      },
    ])
  })

  it("asks for a name and refuses one used twice", () => {
    expect(draftProblem([{ id: null, title: " ", values: ["S"] }])).toBe("name")
    expect(
      draftProblem([
        { id: null, title: "Renk", values: [] },
        { id: null, title: "renk", values: [] },
      ])
    ).toBe("duplicate")
    expect(draftProblem(saved())).toBeNull()
  })
})

describe("bulk changes", () => {
  const variants: Variant[] = PRODUCT.variants ?? []
  const sari = variant("variant_1", "Sarı") as unknown as Variant

  it("narrows to an option's value", () => {
    expect(filtered(PRODUCT, variants, "Renk=Pembe").map((each) => each.id)).toEqual(["variant_2"])
    expect(filtered(PRODUCT, variants, "")).toHaveLength(3)
  })

  it("takes a price above zero, a cost from zero and a whole stock count", () => {
    expect(bulkValue("price", "0")).toBeNull()
    expect(bulkValue("price", "1.250,50")).toBe(1250.5)
    expect(bulkValue("cost", "0")).toBe(0)
    expect(bulkValue("stock", "12")).toBe(12)
    expect(bulkValue("stock", "1,5")).toBeNull()
  })

  it("writes stock only where it is counted, and a price only where it changes", () => {
    const counted = stocked("variant_9", "Mor", 3) as unknown as Variant
    expect(bulkEdit(sari, "stock", 5, "sloc_1")).toBeNull()
    expect(bulkEdit(counted, "stock", 5, "sloc_1")?.stock).toEqual({
      inventoryItemId: "iitem_variant_9",
      quantity: 5,
      hasLevel: true,
    })
    expect(bulkEdit(sari, "price", 3100, "sloc_1")).toBeNull()
    expect(bulkEdit(sari, "price", 2900, "sloc_1")?.amount).toBe(2900)
  })
})

describe("grouping a long list", () => {
  it("groups by the first option's value past ten variants", () => {
    const many = Array.from({ length: 12 }, (_, at) =>
      variant(`variant_${String(at)}`, COLOR.values[at % 3]?.value ?? "")
    )
    const product = { ...PRODUCT, variants: many } as unknown as ProductDetail
    const groups = groupVariants(product, many as unknown as Variant[], saved())
    expect(groups?.map((group) => [group.label, group.variants.length])).toEqual([
      ["Renk: Sarı", 4],
      ["Renk: Pembe", 4],
      ["Renk: Mor", 4],
    ])
    expect(groupVariants(PRODUCT, PRODUCT.variants ?? [], saved())).toBeNull()
  })
})
