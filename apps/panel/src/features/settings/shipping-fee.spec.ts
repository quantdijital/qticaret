import { describe, expect, it } from "vitest"
import type { ShopShippingOption } from "@/features/settings/api/shipping-options"
import { detectFee, feeErrors, planFee, primaryOf } from "./shipping-fee"
import type { FeeChoice } from "./shipping-fee"

const option = (
  id: string,
  name: string,
  pricing: ShopShippingOption["pricing"],
  amount: string | null,
  carrier: ShopShippingOption["carrier"] = "manual"
): ShopShippingOption => ({ id, name, carrier, pricing, amount, in_store: true })

// The dev shop: Standart ₺90, Hızlı ₺150, made in the same instant
const standard = option("so_2", "Standart Kargo", "flat", "90.00")
const fast = option("so_1", "Hızlı Kargo", "flat", "150.00")
const table = option("so_3", "Aras", "table", null, "aras")
const pickup = option("so_4", "Mağazadan teslim", "flat", "0.00", "pickup")
const DEFAULTS = { name: "Standart kargo", flatCarrier: "manual" as const }
const choice = (over: Partial<FeeChoice>): FeeChoice => ({
  mode: "flat",
  fee: null,
  threshold: null,
  carrier: "aras-table",
  ...over,
})

describe("primaryOf", () => {
  it("takes the saved main option, else the cheapest flat one that delivers", () => {
    expect(primaryOf([fast, standard, pickup], null)).toBe(standard)
    expect(primaryOf([fast, standard], "so_1")).toBe(fast)
    // A removed main option: back to the cheapest
    expect(primaryOf([fast, standard], "so_gone")).toBe(standard)
    expect(primaryOf([table, pickup], null)).toBe(table)
    expect(primaryOf([pickup], null)).toBeNull()
  })
})

describe("detectFee", () => {
  it("reads a flat fee with a threshold as free above an amount", () => {
    const state = detectFee([fast, standard], null, 1500)
    expect(state.mode).toBe("threshold")
    expect(state.primary).toBe(standard)
    expect(state.extras).toEqual([fast])
    expect(state.choice).toMatchObject({ fee: 90, threshold: 1500 })
  })

  it("reads a flat fee without a threshold as a flat fee", () => {
    expect(detectFee([standard], null, null)).toMatchObject({ mode: "flat", choice: { fee: 90 } })
  })

  it("reads a free main option as free for every order", () => {
    const free = option("so_5", "Standart", "flat", "0.00")
    expect(detectFee([free, fast], "so_5", null).mode).toBe("free")
    // A threshold with no paid extra frees nothing more: still one answer
    expect(detectFee([free, pickup], "so_5", 900).mode).toBe("free")
  })

  it("reads a table- or quote-priced main option as the carrier's price", () => {
    expect(detectFee([table], null, 2000)).toMatchObject({
      mode: "carrier",
      choice: { carrier: "aras-table", threshold: 2000 },
    })
    const quote = option("so_6", "Geliver", "fastest", null, "geliver")
    expect(detectFee([quote], null, null).choice.carrier).toBe("geliver-fastest")
  })

  it("says custom when a free main option's threshold still frees paid extras", () => {
    const free = option("so_5", "Standart", "flat", "0.00")
    const state = detectFee([free, fast], "so_5", 1500)
    expect(state.mode).toBe("custom")
    // The list edits every option then, the main one too
    expect(state.extras).toEqual([free, fast])
  })

  it("says none when nothing delivers yet", () => {
    expect(detectFee([pickup], null, null)).toMatchObject({ mode: "none", primary: null })
  })
})

describe("feeErrors", () => {
  it("asks for what each answer needs", () => {
    expect(feeErrors(choice({ mode: "free" }))).toEqual([])
    expect(feeErrors(choice({ mode: "flat", fee: 0 }))).toEqual(["fee"])
    expect(feeErrors(choice({ mode: "threshold", fee: 90, threshold: null }))).toEqual([
      "threshold",
    ])
    expect(feeErrors(choice({ mode: "carrier" }))).toEqual([])
    expect(feeErrors(choice({ mode: "carrier", threshold: 0 }))).toEqual(["threshold"])
    expect(feeErrors(choice({ mode: "flat", fee: 100_001 }))).toEqual(["fee"])
  })
})

describe("planFee", () => {
  const state = { primary: standard }

  it("prices every order free: the main option at 0, no threshold", () => {
    expect(planFee(state, choice({ mode: "free" }), DEFAULTS)).toEqual({
      option: { kind: "update", id: "so_2", amount: 0 },
      threshold: null,
    })
  })

  it("keeps the fee and stores the threshold for free above an amount", () => {
    expect(
      planFee(state, choice({ mode: "threshold", fee: 90, threshold: 1500 }), DEFAULTS)
    ).toEqual({ option: { kind: "keep", id: "so_2" }, threshold: 1500 })
  })

  it("reprices a flat fee and clears the threshold", () => {
    expect(planFee(state, choice({ mode: "flat", fee: 75, threshold: 1500 }), DEFAULTS)).toEqual({
      option: { kind: "update", id: "so_2", amount: 75 },
      threshold: null,
    })
  })

  it("replaces a flat main option with a carrier-priced one under the same name", () => {
    expect(
      planFee(state, choice({ mode: "carrier", carrier: "geliver-cheapest" }), DEFAULTS)
    ).toEqual({
      option: {
        kind: "create",
        body: {
          name: "Standart Kargo",
          carrier: "geliver",
          pricing: { type: "quote", choice: "cheapest" },
        },
        replaces: "so_2",
      },
      threshold: null,
    })
  })

  it("keeps a carrier main option of the same source, and replaces it with a flat one", () => {
    expect(
      planFee({ primary: table }, choice({ mode: "carrier", threshold: 900 }), DEFAULTS)
    ).toEqual({ option: { kind: "keep", id: "so_3" }, threshold: 900 })
    expect(planFee({ primary: table }, choice({ mode: "flat", fee: 60 }), DEFAULTS)).toEqual({
      option: {
        kind: "create",
        body: { name: "Aras", carrier: "aras", pricing: { type: "flat", amount: 60 } },
        replaces: "so_3",
      },
      threshold: null,
    })
  })

  it("makes the first option when the shop has none", () => {
    const quote = option("so_6", "Geliver", "cheapest", null, "geliver")
    expect(planFee({ primary: null }, choice({ mode: "free" }), DEFAULTS).option).toEqual({
      kind: "create",
      body: { name: "Standart kargo", carrier: "manual", pricing: { type: "flat", amount: 0 } },
      replaces: null,
    })
    // Geliver takes no flat price: the shop's own delivery does
    expect(
      planFee({ primary: quote }, choice({ mode: "flat", fee: 50 }), DEFAULTS).option
    ).toMatchObject({ kind: "create", body: { carrier: "manual" }, replaces: "so_6" })
  })
})
