import {
  planNewVatRate,
  planVatDefault,
  planVatRemoval,
  planVatRename,
  planVatRestore,
} from "../vat-plan"
import type { VatRate, VatState, VatType } from "../vat-plan"

const rate = (id: string, value: number, extra: Partial<VatRate> = {}): VatRate => ({
  id,
  code: `KDV${String(value)}`,
  name: `KDV %${String(value)}`,
  rate: value,
  is_default: false,
  active: true,
  product_type_id: `ptyp_${String(value)}`,
  ...extra,
})
const type = (id: string, value: string, active = true): VatType => ({ id, value, active })

// A new shop: KDV %20 the default on no type, %10 and %1 each on its own
const shop = (): VatState => ({
  rates: [
    rate("txr_20", 20, { is_default: true, product_type_id: null }),
    rate("txr_10", 10),
    rate("txr_1", 1),
  ],
  types: [type("ptyp_10", "KDV %10"), type("ptyp_1", "KDV %1")],
})

/** What the plan threw; nothing when it threw nothing. */
function thrown(plan: () => unknown): unknown {
  try {
    plan()
  } catch (error) {
    return error
  }
  return undefined
}
const conflict = (key: string, extra: object = {}) => ({
  qtErrorKind: "conflict",
  safeMessage: key,
  ...extra,
})
const invalid = (key: string) => ({ qtErrorKind: "validation", safeMessage: key })

describe("a new KDV rate", () => {
  it("is named and coded by its percentage, on a new product type of its name", () => {
    expect(planNewVatRate(shop(), { rate: 8.5 })).toEqual({
      rate: 8.5,
      name: "KDV %8,5",
      code: "KDV8_5",
      type: { create: "KDV %8,5" },
    })
  })

  it("keeps the name and code given, the code in capitals", () => {
    expect(planNewVatRate(shop(), { rate: 0, name: " İstisna ", code: "kdv0" })).toMatchObject({
      name: "İstisna",
      code: "KDV0",
      type: { create: "İstisna" },
    })
  })

  it("takes a product type of its name standing unbound", () => {
    const state = { ...shop(), types: [...shop().types, type("ptyp_free", "KDV %8")] }
    expect(planNewVatRate(state, { rate: 8 }).type).toEqual({ reuse: "ptyp_free" })
  })

  it("is refused while a rate in use has its percentage, its name or its code", () => {
    expect(thrown(() => planNewVatRate(shop(), { rate: 10 }))).toMatchObject(
      conflict("vat.rate_exists")
    )
    expect(thrown(() => planNewVatRate(shop(), { rate: 9, name: "kdv %10" }))).toMatchObject(
      conflict("vat.name_taken")
    )
    expect(thrown(() => planNewVatRate(shop(), { rate: 9, code: "kdv1" }))).toMatchObject(
      conflict("vat.code_taken")
    )
  })

  it("may have a removed rate's percentage, under another code", () => {
    const removed: VatState = {
      rates: shop().rates.map((r) => (r.id === "txr_10" ? { ...r, active: false } : r)),
      types: [type("ptyp_10", "KDV %10", false), type("ptyp_1", "KDV %1")],
    }
    expect(planNewVatRate(removed, { rate: 10 })).toMatchObject({
      code: "KDV10_2",
      type: { create: "KDV %10" },
    })
  })

  it("is refused past twenty rates in use", () => {
    const full: VatState = {
      rates: Array.from({ length: 20 }, (_, n) => rate(`txr_${String(n)}`, n + 30)),
      types: [],
    }
    expect(thrown(() => planNewVatRate(full, { rate: 5 }))).toMatchObject(invalid("vat.too_many"))
  })
})

describe("renaming a KDV rate", () => {
  it("renames its product type with it", () => {
    expect(planVatRename(shop(), "txr_10", " İndirimli ")).toEqual({
      rate_id: "txr_10",
      name: "İndirimli",
      type_id: "ptyp_10",
    })
    expect(planVatRename(shop(), "txr_20", "Genel")).toEqual({
      rate_id: "txr_20",
      name: "Genel",
      type_id: null,
    })
    expect(planVatRename(shop(), "txr_10", "KDV %10")).toBeNull()
  })

  it("is refused onto another rate's name or any other product type's", () => {
    expect(thrown(() => planVatRename(shop(), "txr_10", "KDV %1"))).toMatchObject(
      conflict("vat.name_taken")
    )
    const state = { ...shop(), types: [...shop().types, type("ptyp_free", "Serbest")] }
    expect(thrown(() => planVatRename(state, "txr_10", "serbest"))).toMatchObject(
      conflict("vat.name_taken")
    )
  })

  it("is refused for an unknown or a removed rate", () => {
    expect(thrown(() => planVatRename(shop(), "txr_x", "Yeni"))).toMatchObject({
      message: "vat.rate_unknown",
    })
    const state = shop()
    const removed = {
      ...state,
      rates: state.rates.map((r) => (r.id === "txr_1" ? { ...r, active: false } : r)),
    }
    expect(thrown(() => planVatRename(removed, "txr_1", "Yeni"))).toMatchObject(
      invalid("vat.rate_inactive")
    )
  })
})

describe("removing a KDV rate", () => {
  it("takes its product type with it when no product is on it", () => {
    expect(planVatRemoval(shop(), "txr_10", 0)).toEqual({ rate_id: "txr_10", type_id: "ptyp_10" })
  })

  it("is refused for the default and while products are on it, with their count", () => {
    expect(thrown(() => planVatRemoval(shop(), "txr_20", 0))).toMatchObject(
      conflict("vat.rate_is_default")
    )
    expect(thrown(() => planVatRemoval(shop(), "txr_10", 3))).toMatchObject(
      conflict("vat.rate_in_use", { count: 3 })
    )
  })

  it("does nothing to a rate removed already", () => {
    const state = shop()
    const removed = {
      ...state,
      rates: state.rates.map((r) => (r.id === "txr_1" ? { ...r, active: false } : r)),
    }
    expect(planVatRemoval(removed, "txr_1", 0)).toBeNull()
  })
})

describe("bringing a KDV rate back", () => {
  const removed = (): VatState => {
    const state = shop()
    return {
      rates: state.rates.map((r) => (r.id === "txr_10" ? { ...r, active: false } : r)),
      types: [type("ptyp_10", "KDV %10", false), type("ptyp_1", "KDV %1")],
    }
  }

  it("restores it and its product type", () => {
    expect(planVatRestore(removed(), "txr_10")).toEqual({ rate_id: "txr_10", type_id: "ptyp_10" })
    expect(planVatRestore(shop(), "txr_10")).toBeNull()
  })

  it("is refused while another rate in use has its percentage or its name", () => {
    const again = removed()
    const taken: VatState = {
      rates: [...again.rates, rate("txr_new", 10, { code: "KDV10_2", product_type_id: "ptyp_n" })],
      types: [...again.types, type("ptyp_n", "KDV %10")],
    }
    expect(thrown(() => planVatRestore(taken, "txr_10"))).toMatchObject(conflict("vat.rate_exists"))
    const named: VatState = {
      rates: again.rates,
      types: [...again.types, type("ptyp_free", "kdv %10")],
    }
    expect(thrown(() => planVatRestore(named, "txr_10"))).toMatchObject(conflict("vat.name_taken"))
  })
})

describe("moving the default", () => {
  it("binds the old default to a new product type of its name", () => {
    expect(planVatDefault(shop(), "txr_10")).toEqual({
      from: { id: "txr_20", type: { create: "KDV %20" } },
      to: "txr_10",
    })
  })

  it("keeps the old default's own product type, or takes an unbound one of its name", () => {
    const state = shop()
    const typed: VatState = {
      rates: state.rates.map((r) => (r.id === "txr_20" ? { ...r, product_type_id: "ptyp_20" } : r)),
      types: [...state.types, type("ptyp_20", "KDV %20")],
    }
    expect(planVatDefault(typed, "txr_1")).toEqual({
      from: { id: "txr_20", type: null },
      to: "txr_1",
    })
    const unbound = { ...state, types: [...state.types, type("ptyp_free", "KDV %20")] }
    expect(planVatDefault(unbound, "txr_1")?.from?.type).toEqual({ reuse: "ptyp_free" })
  })

  it("does nothing for the default, and refuses a removed rate", () => {
    expect(planVatDefault(shop(), "txr_20")).toBeNull()
    const state = shop()
    const removed = {
      ...state,
      rates: state.rates.map((r) => (r.id === "txr_1" ? { ...r, active: false } : r)),
    }
    expect(thrown(() => planVatDefault(removed, "txr_1"))).toMatchObject(
      invalid("vat.rate_inactive")
    )
  })
})
