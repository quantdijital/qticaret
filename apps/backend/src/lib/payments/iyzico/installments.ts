import { z } from "@medusajs/framework/zod"
import { kurus } from "../../money"
import type { Kurus } from "../../money"
import type { InstallmentFamily } from "../installments"
import { iyzicoPrice, parseIyzicoPrice } from "./amounts"

/**
 * iyzico's installment table without a card number (`/payment/iyzipos/installment`,
 * no `binNumber`): every card family with its totals for the amount. The
 * sandbox gave 6 families for 100 TL (2026-10-27). iyzico prices each
 * count itself, so its totals are shown as they are.
 */

const price = iyzicoPrice

export const installmentAnswer = z.object({
  installmentDetails: z
    .array(
      z.object({
        cardFamilyName: z.string().nullish(),
        installmentPrices: z.array(
          z.object({ installmentNumber: z.number().int(), totalPrice: price })
        ),
      })
    )
    .default([]),
})

export function iyzicoInstallmentTable(
  amount: Kurus,
  answer: z.infer<typeof installmentAnswer>,
  limit: number
): InstallmentFamily[] {
  const families = new Map<string, InstallmentFamily>()
  for (const detail of answer.installmentDetails) {
    const family = (detail.cardFamilyName ?? "").trim().toLowerCase()
    if (!family || families.has(family)) {
      continue
    }
    const options = detail.installmentPrices
      .filter(({ installmentNumber }) => installmentNumber >= 2 && installmentNumber <= limit)
      .sort((a, b) => a.installmentNumber - b.installmentNumber)
      .map(({ installmentNumber: count, totalPrice }) => {
        const total = parseIyzicoPrice(totalPrice)
        return {
          count,
          rate: Math.round(((total - amount) / amount) * 10_000) / 100,
          total,
          per_installment: kurus(Math.round(total / count)),
        }
      })
    if (options.length > 0) {
      families.set(family, {
        family,
        options: [{ count: 1, rate: 0, total: amount, per_installment: amount }, ...options],
      })
    }
  }
  return [...families.values()]
}

const TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 500

/** Tables by mode and amount for a few minutes: product pages must not ask iyzico on every view. */
export function createInstallmentCache(now: () => number = Date.now) {
  const entries = new Map<string, { at: number; answer: z.infer<typeof installmentAnswer> }>()
  return {
    get: (key: string) => {
      const entry = entries.get(key)
      return entry && now() - entry.at < TTL_MS ? entry.answer : undefined
    },
    set: (key: string, answer: z.infer<typeof installmentAnswer>) => {
      if (entries.size >= MAX_ENTRIES) {
        entries.delete(entries.keys().next().value ?? "")
      }
      entries.set(key, { at: now(), answer })
    },
  }
}
