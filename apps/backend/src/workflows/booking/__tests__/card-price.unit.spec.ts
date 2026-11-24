import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { kurus } from "../../../lib/money"
import { PRICE_HISTORY_MODULE } from "../../../modules/price-history"
import { priceDisplays } from "../../pricing/price-display"
import { placeDisplays, placeKey } from "../card-price"
import type { BasePrice } from "../card-price"

/**
 * A dated card's price with the automatic promotions (adr/0076 Ek "kart
 * fiyatı promosyonlu"), through the storefront's own price display. The
 * promotion module is a stand-in that applies a promotion as Medusa does
 * for what this test needs: active, inside its campaign's dates, on the
 * products it targets; which promotions are shown before the cart is the
 * real rule (`offerOf`).
 */

const NOW = new Date("2026-12-01T09:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000

interface Promo {
  code: string
  is_automatic: boolean
  method: "percentage" | "fixed"
  value: number
  products: string[]
  starts_at?: Date
  ends_at?: Date
}

const promo = (extra: Partial<Promo> & Pick<Promo, "code">): Promo => ({
  is_automatic: true,
  method: "percentage",
  value: 20,
  products: ["prod_tour"],
  ...extra,
})

/** A promotion as Query reads it, as the panel makes it (tax inclusive, each unit). */
const rowOf = (each: Promo) => ({
  code: each.code,
  type: "standard",
  status: "active",
  is_automatic: each.is_automatic,
  is_tax_inclusive: true,
  created_at: new Date(NOW.getTime() - 2 * DAY).toISOString(),
  rules: [],
  application_method: {
    type: each.method,
    target_type: "items",
    allocation: "each",
    value: each.value,
    max_quantity: null,
    currency_code: "try",
    buy_rules_min_quantity: null,
  },
  campaign: each.starts_at ? { starts_at: each.starts_at.toISOString(), budget: null } : null,
})

interface Line {
  id: string
  unit_price: number | string
  product: { id: string }
}

function shop(
  promos: Promo[],
  history: Record<string, { at: Date; amount: number; original: number }[]> = {},
  selling: Record<string, number> = {}
) {
  const computeActions = jest.fn((codes: string[], context: { items: Line[] }) =>
    context.items.flatMap((item) =>
      promos
        .filter(
          (each) =>
            (each.is_automatic || codes.includes(each.code)) &&
            each.products.includes(item.product.id) &&
            (!each.starts_at || each.starts_at <= NOW) &&
            (!each.ends_at || each.ends_at > NOW)
        )
        .map((each) => ({
          action: "addItemAdjustment",
          item_id: item.id,
          code: each.code,
          amount:
            each.method === "percentage"
              ? (Number(item.unit_price) * each.value) / 100
              : Math.min(each.value, Number(item.unit_price)),
        }))
    )
  )
  const rows = ({ entity, fields }: { entity: string; fields: string[] }) => {
    if (entity === "promotion") {
      // Every row, a code's too: the shown rule, not the read, keeps it out
      return { data: promos.map(rowOf) }
    }
    if (fields.some((field) => field.startsWith("calculated_price"))) {
      return {
        data: Object.entries(selling).map(([id, amount]) => ({
          id,
          calculated_price: { calculated_amount: amount, original_amount: amount },
        })),
      }
    }
    return {
      data: ["adult", "child"].map((id) => ({
        id,
        product: { id: "prod_tour", discountable: true },
      })),
    }
  }
  const asked: string[] = []
  const graph = (args: { entity: string; fields: string[] }) => {
    asked.push(args.entity)
    return Promise.resolve(rows(args))
  }
  const historyOf = (ids: readonly string[]) =>
    Promise.resolve(
      new Map(
        ids.map((id) => [
          id,
          (history[id] ?? []).map((point) => ({
            recorded_at: point.at,
            amount: point.amount,
            original_amount: point.original,
          })),
        ])
      )
    )
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: { graph },
    [Modules.PROMOTION]: { computeActions },
    [PRICE_HISTORY_MODULE]: { historyOf },
  }
  const container = { resolve: (key: string) => services[key] } as unknown as MedusaContainer
  return { container, computeActions, asked }
}

const base = (lira: number, original = lira): BasePrice => ({
  calculated: kurus(lira * 100),
  original: kurus(original * 100),
})
const bases = new Map([["adult", base(1500)]])
// The adult's place on a departure 250,50 TL dearer, and on one at the base price
const unit = { variant_id: "adult", adjustment: 25_050, amount: kurus(175_050) }
const level = { variant_id: "adult", adjustment: 0, amount: kurus(150_000) }

const shownOf = async (promos: Promo[], history = {}, place = unit) => {
  const { container } = shop(promos, history)
  return (await placeDisplays(container, [place], bases, "try", NOW)).get(placeKey(place))
}

describe("placeDisplays", () => {
  it("is the unit's own price without a promotion, nothing struck through", async () => {
    expect(await shownOf([])).toEqual({ current: 175_050, before: null })
  })

  it("takes a percentage off the unit price the cart sees, the departure's difference included", async () => {
    const { container, computeActions } = shop([promo({ code: "OTO20" })])
    const shown = (await placeDisplays(container, [unit], bases, "try", NOW)).get(placeKey(unit))
    // 1.750,50 less 20%: 1.400,40; a difference has no record, so nothing struck through
    expect(shown).toEqual({ current: 140_040, before: null })
    // No code is ever asked: only what every shopper gets
    expect(computeActions.mock.calls[0]?.[0]).toEqual([])
    expect(computeActions.mock.calls[0]?.[1].items[0]).toMatchObject({
      id: "adult:25050",
      variant_id: "adult",
      unit_price: "1750.50",
      product: { id: "prod_tour" },
    })
  })

  it("takes a fixed amount off each unit, never below zero", async () => {
    const fixed = [promo({ code: "OTO300", method: "fixed", value: 300 })]
    expect(await shownOf(fixed)).toEqual({ current: 145_050, before: null })
    expect(await shownOf(fixed, {}, level)).toEqual({ current: 120_000, before: 150_000 })
    expect(await shownOf([promo({ code: "HEPSI", method: "fixed", value: 5000 })])).toMatchObject({
      current: 0,
    })
  })

  it("leaves a code's promotion, one ended or not begun, and one on another product out", async () => {
    const yesterday = new Date(NOW.getTime() - DAY)
    const tomorrow = new Date(NOW.getTime() + DAY)
    const none = { current: 175_050, before: null }
    expect(await shownOf([promo({ code: "KOD20", is_automatic: false })])).toEqual(none)
    expect(await shownOf([promo({ code: "BITTI", ends_at: yesterday })])).toEqual(none)
    expect(await shownOf([promo({ code: "YARIN", starts_at: tomorrow })])).toEqual(none)
    expect(await shownOf([promo({ code: "BASKA", products: ["prod_other"] })])).toEqual(none)
  })

  it("strikes a departure without a difference through by the price-before rule, from the record", async () => {
    const ten = [promo({ code: "OTO10", value: 10 })]
    // Sold at 1.300 five days ago, 1.500 since three: 1.350 is no discount on 1.300
    const raised = {
      adult: [
        { at: new Date(NOW.getTime() - 5 * DAY), amount: 1300, original: 1300 },
        { at: new Date(NOW.getTime() - 3 * DAY), amount: 1500, original: 1500 },
      ],
    }
    expect(await shownOf(ten, raised, level)).toEqual({ current: 135_000, before: null })
    // At 1.500 all along: 1.500 struck through
    const steady = {
      adult: [{ at: new Date(NOW.getTime() - 20 * DAY), amount: 1500, original: 1500 }],
    }
    expect(await shownOf(ten, steady, level)).toEqual({ current: 135_000, before: 150_000 })
  })

  it("never strikes a departure with a difference through: its price was never recorded", async () => {
    // Base 1.500 all along, the difference raised to +1.000 today, then 20% off: 2.000, not "2.500 struck"
    const steady = {
      adult: [{ at: new Date(NOW.getTime() - 20 * DAY), amount: 1500, original: 1500 }],
    }
    const raisedToday = { variant_id: "adult", adjustment: 100_000, amount: kurus(250_000) }
    const twenty = [promo({ code: "OTO20" })]
    expect(await shownOf(twenty, steady, raisedToday)).toEqual({ current: 200_000, before: null })
    // The same promotion on a departure without one: struck through
    expect(await shownOf(twenty, steady, level)).toEqual({ current: 120_000, before: 150_000 })
  })

  it("is the price the index keeps for the same unit (one rule, adr/0077 §5)", async () => {
    const promos = [promo({ code: "OTO20" })]
    const { container } = shop(promos, {}, { adult: 1500 })
    const index = (await priceDisplays(container, ["adult"], "try", NOW)).get("adult")
    const card = (await placeDisplays(container, [level], bases, "try", NOW)).get(placeKey(level))
    expect(index?.current).toBe(120_000)
    expect(card?.current).toBe(index?.current)
  })

  it("prices one category on many departures apart, reading the record and promotions once", async () => {
    const { container, computeActions, asked } = shop([promo({ code: "OTO20" })], {
      adult: [{ at: new Date(NOW.getTime() - 20 * DAY), amount: 1500, original: 1500 }],
    })
    const places = [level, unit, { ...level }]
    const shown = await placeDisplays(container, places, bases, "try", NOW)
    // Two departures alike are one line; each a line of the same variant at its own price
    expect(computeActions).toHaveBeenCalledTimes(1)
    expect(computeActions.mock.calls[0]?.[1].items).toEqual([
      expect.objectContaining({ id: "adult:0", variant_id: "adult", unit_price: "1500.00" }),
      expect.objectContaining({ id: "adult:25050", variant_id: "adult", unit_price: "1750.50" }),
    ])
    expect(asked.filter((entity) => entity === "promotion")).toHaveLength(1)
    expect(shown.get(placeKey(level))).toEqual({ current: 120_000, before: 150_000 })
    expect(shown.get(placeKey(unit))).toEqual({ current: 140_040, before: null })
  })

  it("reads the promotions once however many parts of 100 variants it prices", async () => {
    const selling = Object.fromEntries(
      Array.from({ length: 250 }, (_, index) => [`variant_${String(index)}`, 100])
    )
    const { container, asked } = shop([promo({ code: "OTO20" })], {}, selling)
    await priceDisplays(container, Object.keys(selling), "try", NOW)
    expect(asked.filter((entity) => entity === "promotion")).toHaveLength(1)
  })
})
