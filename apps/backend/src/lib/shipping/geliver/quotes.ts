import { z } from "@medusajs/framework/zod"
import { fromMedusaAmount } from "../../money"
import type { Kurus } from "../../money"
import type { Parcel } from "../parcel"
import type { GeliverCall } from "./client"
import type { GeliverCredentials } from "./types"

/**
 * Prices for a parcel from Geliver's price list (`GET /priceList`, F7.2):
 * one per carrier service. The SDK leaves the answer untyped; read here
 * as a list of services with an amount, in `data` or under `list`
 * (adr/0031: to be checked with a real account). Cached ten minutes per
 * parcel: a checkout asks again on every shipping choice.
 */

const amount = z.union([z.string(), z.number()]).transform(String)

const priceRow = z
  .object({
    providerCode: z.string().nullish(),
    providerServiceCode: z.string().min(1),
    totalAmount: amount.nullish(),
    amount: amount.nullish(),
    price: amount.nullish(),
    currency: z.string().nullish(),
    averageEstimatedTime: z.number().nullish(),
  })
  .loose()

const priceList = z.union([
  z.array(priceRow),
  z
    .object({ list: z.array(priceRow) })
    .loose()
    .transform((value) => value.list),
])

export interface GeliverQuote {
  provider_code: string | null
  service_code: string
  amount: Kurus
  /** Hours on average, when Geliver says. */
  estimated_hours: number | null
}

/** How a shipping option picks its service: the cheapest, the fastest, or one by its code. */
export type QuoteChoice = { by: "cheapest" } | { by: "fastest" } | { by: "service"; code: string }

const TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 500

export function createQuoteCache(now: () => number = Date.now) {
  const entries = new Map<string, { at: number; quotes: GeliverQuote[] }>()
  return {
    get: (key: string) => {
      const entry = entries.get(key)
      return entry && now() - entry.at < TTL_MS ? entry.quotes : undefined
    },
    set: (key: string, quotes: GeliverQuote[]) => {
      if (entries.size >= MAX_ENTRIES) {
        entries.clear()
      }
      entries.set(key, { at: now(), quotes })
    },
  }
}

const toQuote = (row: z.infer<typeof priceRow>): GeliverQuote | null => {
  const text = row.totalAmount ?? row.amount ?? row.price
  if (!text || (row.currency && row.currency.toUpperCase() !== "TRY")) {
    return null
  }
  const kurus = fromMedusaAmount(text, { allowRounding: true })
  return kurus > 0
    ? {
        provider_code: row.providerCode ?? null,
        service_code: row.providerServiceCode,
        amount: kurus,
        estimated_hours: row.averageEstimatedTime ?? null,
      }
    : null
}

export function quoteCalls(call: GeliverCall) {
  const cache = createQuoteCache()

  /** Every service's price for the parcel, cheapest first. */
  async function quotes(credentials: GeliverCredentials, parcel: Parcel): Promise<GeliverQuote[]> {
    const key = [parcel.length_cm, parcel.width_cm, parcel.height_cm, parcel.weight_kg].join(":")
    const cached = cache.get(key)
    if (cached) {
      return cached
    }
    const rows = await call(
      credentials,
      {
        method: "GET",
        path: "/priceList",
        query: {
          paramType: "parcel",
          length: parcel.length_cm.toFixed(1),
          width: parcel.width_cm.toFixed(1),
          height: parcel.height_cm.toFixed(1),
          distanceUnit: "cm",
          weight: parcel.weight_kg.toFixed(2),
          massUnit: "kg",
        },
      },
      priceList
    )
    const found = rows
      .map(toQuote)
      .filter((quote): quote is GeliverQuote => quote !== null)
      .sort((a, b) => a.amount - b.amount)
    cache.set(key, found)
    return found
  }

  return { quotes }
}

/** The quote an option's choice takes; null when none fits. */
export function chooseQuote(
  quotes: readonly GeliverQuote[],
  choice: QuoteChoice
): GeliverQuote | null {
  if (choice.by === "service") {
    return quotes.find((quote) => quote.service_code === choice.code) ?? null
  }
  if (choice.by === "fastest") {
    const timed = quotes.filter((quote) => quote.estimated_hours !== null)
    return (
      [...timed].sort(
        (a, b) => (a.estimated_hours ?? 0) - (b.estimated_hours ?? 0) || a.amount - b.amount
      )[0] ??
      quotes[0] ??
      null
    )
  }
  return quotes[0] ?? null
}
