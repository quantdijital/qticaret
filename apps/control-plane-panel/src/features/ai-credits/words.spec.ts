import { describe, expect, it } from "vitest"
import { AI_CREDIT_ORDER_STATUSES, AI_TARGET_CAPABILITIES } from "@qticaret/types/control-plane"
import en from "@/locales/en.json" with { type: "json" }
import tr from "@/locales/tr.json" with { type: "json" }
import { CHECK_REASONS } from "./api/schemas"

// This feature's own sources (its tests apart), as text
const sources = import.meta.glob<string>(["./**/*.{ts,tsx}", "!./**/*.spec.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
})

function keysOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix]
  }
  return Object.entries(value).flatMap(([key, inner]) =>
    keysOf(inner, prefix ? `${prefix}.${key}` : key)
  )
}

const has = (keys: Set<string>, key: string) =>
  keys.has(key) || (keys.has(`${key}_one`) && keys.has(`${key}_other`))

describe("the AI credits' words", () => {
  const trKeys = new Set(keysOf(tr))
  const enKeys = new Set(keysOf(en))

  it("has every key the screens name, in both languages", () => {
    const used = new Set(
      Object.values(sources).flatMap((text) =>
        [...text.matchAll(/["`]((?:aiCredits|billing|common)\.[A-Za-z_.]+)["`]/g)].map(
          (match) => match[1] ?? ""
        )
      )
    )
    expect(used.size).toBeGreaterThan(40)
    for (const key of used) {
      expect(has(trKeys, key), `tr: ${key}`).toBe(true)
      expect(has(enKeys, key), `en: ${key}`).toBe(true)
    }
  })

  it("has the keys the screens build from a value", () => {
    const built = [
      ...AI_CREDIT_ORDER_STATUSES.flatMap((status) => [
        `aiCredits.orders.statuses.${status}`,
        `aiCredits.orders.empty.${status}`,
      ]),
      ...AI_TARGET_CAPABILITIES.map((capability) => `aiCredits.capabilities.${capability}`),
      ...CHECK_REASONS.map((reason) => `aiCredits.providers.check.${reason}`),
      ...["plan", "purchased"].map((bucket) => `aiCredits.buckets.${bucket}`),
      ...["add", "take"].map((sign) => `aiCredits.adjust.submit.${sign}`),
      ...["grant_purchase", "grant_plan_monthly", "spend", "release", "expire", "adjust"].map(
        (kind) => `aiCredits.ledger.kinds.${kind}`
      ),
      ...["deepseek", "minimax", "gemini", "photoroom", "fake"].map(
        (service) => `aiCredits.services.${service}`
      ),
      "nav.aiOrders",
      "nav.aiSettings",
    ]
    for (const key of built) {
      expect(has(trKeys, key), `tr: ${key}`).toBe(true)
      expect(has(enKeys, key), `en: ${key}`).toBe(true)
    }
  })
})
